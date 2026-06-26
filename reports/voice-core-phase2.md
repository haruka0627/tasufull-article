# Voice Core Phase 2 — 実装レポート

実装日: 2026-06-27

## 目的

OpenAI Realtime Adapter の **接続境界（skeleton）** を構築する。  
Phase 2 は **mock-compatible 動作のみ** — WebSocket / fetch / API キー / 本番接続なし。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/voice-realtime-options.js` | Realtime session options 型 · 正規化 |
| `shared/voice-core/voice-realtime-event-mapper.js` | Wire イベント → Voice Core イベント変換 |
| `shared/voice-core/adapters/voice-openai-realtime-adapter.js` | OpenAI Realtime skeleton（mock-compatible） |
| `shared/voice-core/voice-provider-router.js` | `openai_realtime:live` 登録 |
| `shared/voice-core/voice-core.js` | Phase 2 exports · VERSION 更新 |
| `shared/voice-core/voice-core-test.html` | 新モジュール読込 |
| `scripts/test-voice-core-phase2.mjs` | Phase 2 テスト |
| `scripts/test-voice-core-phase1.mjs` | VERSION タグ判定緩和（phase1+2 回帰） |
| `reports/voice-core-phase2.md` | 本レポート |

**変更していないもの:** Builder AI UI、AI秘書、TASFUL AI、TLV、Gateway、Secrets、既存 `TasuAiVoiceCore`。

## OpenAI Realtime Adapter 構成

```
shared/voice-core/
├── voice-realtime-options.js          # VoiceRealtimeSessionOptions
├── voice-realtime-event-mapper.js     # WIRE_EVENT · mapWireEventToVoiceCore()
├── adapters/
│   └── voice-openai-realtime-adapter.js  # id: openai-realtime-skeleton
├── voice-provider-router.js           # openai_realtime:live 登録
└── voice-core.js                      # TasuVoiceCore ファサード
```

### Adapter 識別

| 項目 | 値 |
| --- | --- |
| provider | `openai_realtime` |
| kind | `live` |
| adapter id | `openai-realtime-skeleton` |
| Phase 2 モード | `mockCompatible: true`（必須） |

### 接続状態（session 単位）

| 状態 | 説明 |
| --- | --- |
| `idle` | 未開始 |
| `mock_active` | mock-compatible セッション稼働中 |
| `disconnected` | 停止済み |

### Wire → Voice Core イベント変換

| Wire（将来） | Voice Core |
| --- | --- |
| `session.created` | `session_started` |
| `response.text.delta` | `text_delta` |
| `response.audio.delta` | `audio_delta_mock`（mock-compatible） |
| `response.done` | `text_delta`（final） |
| `error` | `error_mock`（mock-compatible） |
| `session.closed` | `session_stopped` |

## テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-voice-core-phase2.mjs` | **22/22 PASS** |
| `node scripts/test-voice-core-phase1.mjs`（Phase 2 内） | **25/25 PASS** |
| `npm run build:pages`（Phase 2 内） | **PASS** |
| `node scripts/test-builder-ai-ui-phase7.mjs`（Phase 2 内） | **PASS** |

## コミット対象一覧（選別用 · 未コミット）

```
shared/voice-core/voice-realtime-options.js
shared/voice-core/voice-realtime-event-mapper.js
shared/voice-core/adapters/voice-openai-realtime-adapter.js
shared/voice-core/voice-provider-router.js
shared/voice-core/voice-core.js
shared/voice-core/voice-core-test.html
scripts/test-voice-core-phase2.mjs
scripts/test-voice-core-phase1.mjs
reports/voice-core-phase2.md
deploy/cloudflare/dist/shared/voice-core/*
```

## 次フェーズ（未着手）

- 実 Wire 接続（Edge proxy 経由 · クライアント直 API キー禁止）
- Gemini Live adapter skeleton
- 各プロダクト surface への段階的統合
