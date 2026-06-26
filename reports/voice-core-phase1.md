# Voice Core Phase 1 — 実装レポート

実装日: 2026-06-27

## 目的

Builder AI / AI秘書 / TASFUL AI / 将来 TLV で共通利用できる **プロバイダー非依存の音声セッション基盤** を構築する。  
Phase 1 は **mock adapter のみ**。OpenAI Realtime / Gemini Live / 外部 STT·TTS には接続しない。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/voice-core-events.js` | イベント定数 · adapter kind |
| `shared/voice-core/voice-adapter-interface.js` | Adapter 契約検証 |
| `shared/voice-core/voice-mock-adapter.js` | ローカル mock adapter |
| `shared/voice-core/voice-provider-router.js` | Provider router（mock 登録） |
| `shared/voice-core/voice-session.js` | Session ライフサイクル |
| `shared/voice-core/voice-core.js` | 公開 API ファサード |
| `shared/voice-core/voice-core-test.html` | ブラウザ手動/自動 smoke ページ |
| `scripts/test-voice-core-phase1.mjs` | Phase 1 テスト |
| `reports/voice-core-phase1.md` | 本レポート |

**意図的に変更していないもの:** `tasful-ai-voice-core.js`（既存 STT/TTS UI 基盤）、Builder AI UI、AI秘書、TASFUL AI、TLV、Gateway、Secrets。

## Voice Core 構成

```
shared/voice-core/
├── voice-core-events.js       # EVENT, ADAPTER_KIND
├── voice-adapter-interface.js # assertAdapter()
├── voice-mock-adapter.js      # mock-local (kind: mock)
├── voice-provider-router.js   # resolveAdapter({ provider, kind })
├── voice-session.js           # createSession() → session API
├── voice-core.js              # window.TasuVoiceCore
└── voice-core-test.html       # 最小テストページ
```

### グローバル API — `window.TasuVoiceCore`

| API | 説明 |
| --- | --- |
| `startSession(options)` | Session 生成 + 開始（`options.onEvent` で開始前リスナー登録可） |
| `createSession(options)` | Session 生成のみ（`receiveEvent` → `startSession` の順推奨） |
| `resolveAdapter({ provider, kind })` | Router 経由で adapter 解決 |
| `registerAdapter(adapter, { provider })` | 将来 live/stt/tts adapter 登録用 |
| `listAdapters()` | 登録済み adapter 一覧 |
| `EVENT` / `ADAPTER_KIND` | 定数 |

### Session API

| メソッド | 説明 |
| --- | --- |
| `startSession(options)` | mock session 開始 → `session_started` |
| `sendText(text)` | mock テキスト応答 → `text_delta` |
| `sendAudio(chunk)` | mock 音声イベント → `audio_delta_mock` |
| `receiveEvent(callback)` | イベント購読（unsubscribe 関数を返す） |
| `stopSession()` | 終了 → `session_stopped` |

### Adapter 種別（Phase 1）

| kind | Phase 1 |
| --- | --- |
| `mock` | **実装済み** (`mock-local`) |
| `live` | 未実装（router 登録口のみ） |
| `stt` | 未実装 |
| `tts` | 未実装 |

### Mock イベント

- `session_started`
- `text_delta`
- `audio_delta_mock`
- `session_stopped`
- `error_mock`（空 text / 非アクティブ session 等）

## 既存 `TasuAiVoiceCore` との関係

| | `TasuAiVoiceCore` | `TasuVoiceCore` (Phase 1) |
| --- | --- | --- |
| 用途 | ブラウザ STT/TTS UI toolbar | プロバイダー差し替え可能な session 基盤 |
| 接続 | Web Speech API | mock のみ |
| 統合 | AI秘書 / Workspace 済 | **未統合**（Phase 1 スコープ外） |

## テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-voice-core-phase1.mjs` | **25/25 PASS** |
| `npm run build:pages`（テスト内） | **PASS** |
| `node scripts/test-builder-ai-ui-phase7.mjs`（テスト内） | **PASS** |

### Phase 1 チェックリスト

1. mock session 開始 — PASS  
2. sendText → mock response — PASS  
3. sendAudio → mock audio event — PASS  
4. stopSession 終了 — PASS  
5. provider router → mock adapter — PASS  
6. 外部 API 文字列·API キーなし — PASS  
7. build:pages — PASS  
8. Builder AI Phase 7 回帰 — PASS  

## コミット対象一覧（選別用 · 未コミット）

```
shared/voice-core/voice-core-events.js
shared/voice-core/voice-adapter-interface.js
shared/voice-core/voice-mock-adapter.js
shared/voice-core/voice-provider-router.js
shared/voice-core/voice-session.js
shared/voice-core/voice-core.js
shared/voice-core/voice-core-test.html
scripts/test-voice-core-phase1.mjs
reports/voice-core-phase1.md
```

`npm run build:pages` 後、`deploy/cloudflare/dist/shared/voice-core/*` も dist ミラーとして同梱可。

## 次フェーズ（未着手）

- OpenAI Realtime / Gemini Live adapter（別 provider 登録）
- STT / TTS adapter 実装
- Builder AI / AI秘書 / TASFUL AI への段階的統合
- TLV 入口（将来）
