# Voice Core Phase 5-B — WebSocket Transport 計画

**Status:** Phase 5-B 実装済（transport 層 · opt-in · 本番接続なし）  
**Base:** Phase 5-A (`phase5a-openai-live-boundary`)  
**VERSION:** `phase5b-websocket-transport`

## 目的

Phase 5-A の policy / config / injectable wire client 境界の上に、OpenAI Realtime 用 **WebSocket transport adapter** を追加する。

- 本番 Realtime 接続は **デフォルト無効**（policy + transport 両方 opt-in）
- API key / ephemeral token は **transport に保持しない**（connect 時のみ使用）
- mock transport · injectable fake transport の回帰を維持

**Phase 5-B では行わない:** Edge token 発行 · staging E2E · deploy · Secret 直読み

## アーキテクチャ

```
shared/voice-core/
├── voice-realtime-connect-policy.js      # Phase 5-A（変更なし · WebSocket なし）
├── voice-realtime-config.js              # Phase 5-A（変更なし）
├── voice-openai-realtime-wire-client.js  # Phase 5-A injectable 境界
├── transports/
│   └── voice-openai-realtime-websocket-transport.js  # Phase 5-B 新規
├── adapters/voice-openai-realtime-adapter.js         # transport 解決拡張
└── voice-core.js                         # export + VERSION
```

## Transport 選択（adapter）

| 優先 | 条件 | transport |
|------|------|-----------|
| 1 | `options._voiceCoreTransport` | 明示注入 |
| 2 | `setSessionRuntime(_, transport)` | セッション注入 |
| 3 | `useWebSocketTransport: true` + factory 存在 | WebSocket transport |
| 4 | （live 時デフォルト） | noop → `transport_not_configured` |

**Live 接続に必要な三条件（変更なし）:**

1. `mockCompatible: false`
2. feature flag ON（`VOICE_CORE_OPENAI_LIVE_ENABLED=1` 等）
3. endpoint + credential 注入 + transport（WebSocket は `useWebSocketTransport: true` で明示）

## WebSocket Transport 契約

```javascript
createOpenAiRealtimeWebSocketTransport({
  WebSocket,       // injectable（テスト用 MockWebSocket）
  preferHeaders,   // Node 等 · Authorization ヘッダー対応 factory
})

// connect params（credential は connect 内のみ · インスタンスに保存しない）
transport.connect({
  endpoint,        // 注入 URL（ハードコードなし）
  credential,      // { type, value } — ephemeral / bearer
  model,
  sessionOptions,
  onServerEvent,
})
```

**ブラウザ:** 標準 WebSocket は Authorization ヘッダー不可 → OpenAI subprotocol  
**Node / カスタム factory:** `preferHeaders: true` で Bearer ヘッダー

## クライアント wire イベント（送信）

| メソッド | OpenAI client event |
|----------|---------------------|
| `sendText` | `conversation.item.create` (input_text) |
| `sendAudio` | `input_audio_buffer.append` (base64) |
| `close` | `session.close` + socket close |

サーバーイベントは Phase 5-A の `normalizeOpenAiServerEvent` 経由で Voice Core イベントへ。

## テスト

```bash
node scripts/test-voice-core-phase5.mjs
```

検証:

- Phase 5-A 境界ファイル（policy / config / wire-client）に forbidden I/O なし
- transport モジュールに secret 直書きなし
- MockWebSocket で connect / sendText / sendAudio / close（ネットワークなし）
- injectable fake transport 回帰
- `useWebSocketTransport: true` + MockWebSocket で adapter live path
- デフォルト policy mock · live_disabled 回帰
- Phase 1–4 + Builder AI Phase 7 回帰
- `npm run build:pages` · source ↔ dist 一致

## Phase 分割（更新）

| Sub-phase | 内容 | 状態 |
|-----------|------|------|
| **5-A** | policy / config / wire client / mapper / adapter 委譲 | ✅ |
| **5-B** | WebSocket transport（opt-in · injectable factory） | ✅ 本 PR |
| **5-C** | Edge ephemeral token + staging E2E | 未着手 |
| **5-D** | Builder AI / 秘書 / TASFUL AI 統合 | Phase 5 完了後 |

## セキュリティ

- リポジトリ: `sk-` / Bearer 直書き禁止（テストスキャン）
- transport インスタンスに credential を保持しない
- 本番 URL / API key をコードに含めない
- live は flag + mockCompatible:false + transport 明示の三層

## ファイル一覧（Phase 5-B）

| ファイル | 操作 |
|----------|------|
| `shared/voice-core/transports/voice-openai-realtime-websocket-transport.js` | 新規 |
| `shared/voice-core/adapters/voice-openai-realtime-adapter.js` | transport 解決 |
| `shared/voice-core/voice-core.js` | export / VERSION |
| `shared/voice-core/voice-core-test.html` | script 追加 |
| `shared/voice-core/voice-openai-realtime-wire-client.js` | コメント |
| `scripts/test-voice-core-phase5.mjs` | 5-B テスト拡張 |
| `reports/voice-core-phase5b-websocket-transport-plan.md` | 本ドキュメント |
| `deploy/cloudflare/dist/shared/voice-core/*` | build:pages ミラー |

## 次アクション（5-C）

1. Edge Function: `POST /voice/openai/session` → ephemeral token
2. staging: flag ON + Edge token + MockWebSocket 以外の短い smoke
3. fallback 実 failover（session 再開）を `voice-session.js` に追加
