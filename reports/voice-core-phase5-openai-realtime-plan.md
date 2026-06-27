# Voice Core Phase 5 — OpenAI Realtime 実接続計画

**Status:** Phase 5-A 実装済（接続境界・注入・テスト）  
**Base commit:** `89457b1` (Phase 1–4 完了)  
**VERSION:** `phase5a-openai-live-boundary`

## 目的

OpenAI Realtime の**実接続**に向け、Phase 1–4 の mock / skeleton / fallback を壊さずに以下を整備する。

1. 接続境界（policy / config / wire client）
2. OpenAI サーバーイベント → Voice Core 共通イベント変換
3. feature flag / env guard による live 分離
4. injectable transport によるテスト可能な live パス（ネイティブ socket なし）
5. fallback router の policy 連携

**Phase 5 完了後**に Builder AI / AI秘書 / TASFUL AI へ統合。Gemini Live 実接続は Phase 6 以降。

## 現状アーキテクチャ（Phase 5-A 後）

```
shared/voice-core/
├── voice-realtime-connect-policy.js   # feature flag / env guard
├── voice-realtime-config.js           # endpoint / model / credential 注入
├── voice-openai-realtime-wire-client.js  # injectable transport 境界
├── voice-realtime-event-mapper.js     # + normalizeOpenAiServerEvent
├── adapters/voice-openai-realtime-adapter.js  # mock デフォルト + live 委譲
├── voice-fallback-router.js           # + resolveStartPlan / classifyConnectFailure
└── voice-core.js                      # 公開 API
```

## 接続境界

### 1. Connect Policy (`voice-realtime-connect-policy.js`)

| 条件 | 結果 |
|------|------|
| `mockCompatible !== false`（デフォルト） | `mode: mock` — 既存 Phase 2 動作 |
| `mockCompatible: false` + flag OFF | `live_disabled` エラー → fallback 候補 |
| `mockCompatible: false` + flag ON | `mode: live` — wire client へ |

**Feature flag（いずれか）:**

- 環境変数: `VOICE_CORE_OPENAI_LIVE_ENABLED=1`（Node / CI）
- ブラウザ: `window.__TASU_VOICE_CORE_OPENAI_LIVE__ = true`（開発時のみ）
- ランタイム: `TasuVoiceCore.setRuntimeInjectors({ isLiveEnabled: () => true })`

### 2. Config Injection (`voice-realtime-config.js`)

ソースに **API key / endpoint / secret を直書きしない**。注入インターフェース:

```javascript
createRealtimeConfig({
  getEndpoint(ctx) { return "…"; },           // Edge から供給
  getModel(ctx) { return "gpt-4o-realtime-preview"; },
  async getSessionCredential(ctx) {
    return { type: "ephemeral_token", value: "…" }; // 短命トークンのみ
  },
  getSessionOptions(ctx) { return { voice: "alloy", … }; },
});
```

**本番想定:** Cloudflare Worker / Supabase Edge が OpenAI Sessions API で ephemeral token を発行 → クライアントは注入のみ。

### 3. Wire Client (`voice-openai-realtime-wire-client.js`)

- **Phase 5-A:** `WebSocket` / `fetch` / `wss://` を voice-core ツリーに含めない
- `createWireClient({ policy, config, transport, emit, ctx })`
- デフォルト transport: `noop` → `transport_not_configured`
- テスト / 将来 Phase 5-B: `transport.connect({ endpoint, credential, onServerEvent })` を実装

### 4. Event Mapping

OpenAI Realtime サーバー JSON → 内部 `WIRE_EVENT` → Voice Core `EVENT`:

| OpenAI server type | Internal wire | Voice Core |
|--------------------|---------------|------------|
| `session.created` / `session.updated` | `session.created` | `session_started` |
| `response.text.delta` | `response.text.delta` | `text_delta` |
| `response.audio_transcript.delta` | `response.text.delta` | `text_delta` |
| `response.audio.delta` | `response.audio.delta` | `audio_delta` / `audio_delta_mock` |
| `response.done` | `response.done` | `text_delta` (final) |
| `error` | `error` | `error` / `error_mock` |

## Fallback 連携

`voice-fallback-router.js`:

- `resolveStartPlan(query, options, injectors)` — policy 込みの開始計画
- `classifyConnectFailure(code)` — `live_disabled` / `live_not_configured` は retriable + suggestFallback

チェーン（変更なし）: `openai_realtime → gemini_live → mock`

## mockCompatible 維持

- デフォルト `mockCompatible: true` — Phase 1–4 テスト・UI はそのまま PASS
- `openai-realtime-skeleton` adapter ID 維持
- Gemini Live adapter は Phase 5 で未変更（mock-only）

## Phase 分割

| Sub-phase | 内容 | 状態 |
|-----------|------|------|
| **5-A** | policy / config / wire client 境界 / mapper 拡張 / adapter 委譲 / テスト | ✅ 本 PR |
| **5-B** | ネイティブ WebSocket transport（voice-core 外 or 動的ロード） | 未着手 |
| **5-C** | Edge ephemeral token 発行 + E2E smoke（staging） | 未着手 |
| **5-D** | Builder AI / 秘書 / TASFUL AI 統合 | Phase 5 完了後 |

## テスト

```bash
node scripts/test-voice-core-phase5.mjs
```

検証項目:

- Phase 5 新規ファイルに forbidden I/O / secret なし
- policy デフォルト mock / flag なし live_disabled
- config 注入 / OpenAI event normalize
- mock-compatible 回帰（session_started … session_stopped）
- injectable fake transport で live `session_started`（API 不要）
- Phase 1–4 + Builder AI Phase 7 回帰
- `npm run build:pages`

## セキュリティ

- リポジトリ内: API key / Bearer / `sk-` 禁止（phase5 テストでスキャン）
- live 接続: flag + credential + endpoint の三条件
- ephemeral token のみクライアントへ（長期 API key は Edge のみ）

## ファイル一覧（Phase 5-A）

| ファイル | 操作 |
|----------|------|
| `shared/voice-core/voice-realtime-connect-policy.js` | 新規 |
| `shared/voice-core/voice-realtime-config.js` | 新規 |
| `shared/voice-core/voice-openai-realtime-wire-client.js` | 新規 |
| `shared/voice-core/voice-realtime-event-mapper.js` | 拡張 |
| `shared/voice-core/adapters/voice-openai-realtime-adapter.js` | 拡張 |
| `shared/voice-core/voice-fallback-router.js` | 拡張 |
| `shared/voice-core/voice-core.js` | export / VERSION |
| `shared/voice-core/voice-core-test.html` | script 順 + policy ボタン |
| `scripts/test-voice-core-phase5.mjs` | 新規 |
| `deploy/cloudflare/dist/shared/voice-core/*` | build:pages 反映 |

## 次アクション（5-B）

1. `shared/voice-core/transports/` に OpenAI WebSocket transport を**別モジュール**として追加（build 時のみ bundle / dynamic import）
2. Edge Function: `POST /voice/openai/session` → ephemeral token
3. staging E2E: flag ON + Edge token + 短い音声ラウンドトリップ
4. fallback 実 failover（session 再開）を `voice-session.js` に追加
