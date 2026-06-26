# Voice Core Phase 3 — 実装レポート

実装日: 2026-06-27

## 目的

OpenAI Realtime に続き **Gemini Live Adapter Skeleton** を追加する。  
Phase 3 は **mock-compatible のみ** — Live API / WebSocket / fetch / API キー / 本番接続なし。

## 追加ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/voice-gemini-live-options.js` | Gemini Live session options · 正規化 |
| `shared/voice-core/voice-gemini-live-event-mapper.js` | Wire → Voice Core イベント変換 |
| `shared/voice-core/adapters/voice-gemini-live-adapter.js` | Gemini Live skeleton adapter |
| `scripts/test-voice-core-phase3.mjs` | Phase 3 テスト |
| `reports/voice-core-phase3.md` | 本レポート |

## 更新ファイル

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/voice-provider-router.js` | `gemini_live:live` 登録 |
| `shared/voice-core/voice-core.js` | Gemini exports · VERSION 更新 |
| `shared/voice-core/voice-core-test.html` | Gemini スクリプト読込 · auto test ボタン |

## Provider 構成

| provider | kind | adapter id | Phase 3 |
| --- | --- | --- | --- |
| `mock` | `mock` | `mock-local` | 既存（変更なし） |
| `openai_realtime` | `live` | `openai-realtime-skeleton` | 既存（変更なし） |
| `gemini_live` | `live` | `gemini-live-skeleton` | **新規** |

## Skeleton 構成

```
shared/voice-core/
├── voice-gemini-live-options.js
├── voice-gemini-live-event-mapper.js
├── adapters/
│   ├── voice-openai-realtime-adapter.js  (Phase 2)
│   └── voice-gemini-live-adapter.js      (Phase 3)
├── voice-provider-router.js
└── voice-core.js
```

### Wire → Voice Core 変換（Gemini Live）

| Wire | Voice Core |
| --- | --- |
| `live.session.opened` | `session_started` |
| `server.content.text` | `text_delta` |
| `server.content.audio` | `audio_delta_mock` |
| `turn.complete` | `text_delta` (final) |
| `live.error` | `error_mock` |
| `live.session.closed` | `session_stopped` |

### 接続状態

`idle` → `mock_active` → `disconnected`（OpenAI Realtime skeleton と同構造）

## テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-voice-core-phase3.mjs` | **32/32 PASS** |
| `node scripts/test-voice-core-phase1.mjs`（Phase 3 内） | **25/25 PASS** |
| `node scripts/test-voice-core-phase2.mjs`（Phase 3 内） | **22/22 PASS** |
| `node scripts/test-builder-ai-ui-phase7.mjs`（Phase 3 内） | **PASS** |
| `npm run build:pages`（Phase 3 内） | **PASS** |

## コミット対象一覧（選別用 · 未コミット）

```
shared/voice-core/voice-gemini-live-options.js
shared/voice-core/voice-gemini-live-event-mapper.js
shared/voice-core/adapters/voice-gemini-live-adapter.js
shared/voice-core/voice-provider-router.js
shared/voice-core/voice-core.js
shared/voice-core/voice-core-test.html
scripts/test-voice-core-phase3.mjs
reports/voice-core-phase3.md
deploy/cloudflare/dist/shared/voice-core/*
```

## 次フェーズ（未着手）

- Edge proxy 経由の Gemini Live 実接続
- 各プロダクト surface への段階的統合
