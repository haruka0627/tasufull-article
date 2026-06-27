# Voice Core Phase 4 — 実装レポート

実装日: 2026-06-27

## 目的

Voice Core を Live API 専用から **音声入出力を共通管理する基盤** へ拡張。  
Phase 4 は **STT · TTS · Fallback の Skeleton のみ** — API 接続 · 音声認識 · 音声合成なし。

## ファイル一覧

### 新規

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/stt/voice-stt-adapter-interface.js` | STT adapter 契約 |
| `shared/voice-core/stt/voice-stt-mock-adapter.js` | Mock STT（ダミー transcript） |
| `shared/voice-core/tts/voice-tts-adapter-interface.js` | TTS adapter 契約 |
| `shared/voice-core/tts/voice-tts-mock-adapter.js` | Mock TTS（ダミー audio event） |
| `shared/voice-core/voice-fallback-router.js` | Fallback router skeleton |
| `scripts/test-voice-core-phase4.mjs` | Phase 4 テスト |
| `reports/voice-core-phase4.md` | 本レポート |

### 更新

| ファイル | 内容 |
| --- | --- |
| `shared/voice-core/voice-core.js` | `createSTTAdapter` · `createTTSAdapter` · `createFallbackRouter` export |
| `shared/voice-core/voice-core-test.html` | STT/TTS/Fallback mock ボタン |
| `scripts/test-voice-core-phase3.mjs` | VERSION 判定を `phase` に緩和（Phase 4 回帰用） |

## STT 構成

```
shared/voice-core/stt/
├── voice-stt-adapter-interface.js   # assertSttAdapter()
└── voice-stt-mock-adapter.js          # id: stt-mock-local · kind: stt
```

| API | 説明 |
| --- | --- |
| `recognize(audioChunk, options)` | ダミー transcript + event 列を返す |
| `cancel(jobId)` | `stt_cancelled_mock` |

イベント: `stt_recognition_started_mock` → `stt_partial_mock` → `stt_final_mock`

## TTS 構成

```
shared/voice-core/tts/
├── voice-tts-adapter-interface.js   # assertTtsAdapter()
└── voice-tts-mock-adapter.js          # id: tts-mock-local · kind: tts
```

| API | 説明 |
| --- | --- |
| `synthesize(text, options)` | ダミー audio chunk + event 列 |
| `cancel(jobId)` | `tts_cancelled_mock` |

イベント: `tts_synthesis_started_mock` → `tts_audio_chunk_mock` → `tts_synthesis_done_mock`

## Fallback 構成

```
shared/voice-core/voice-fallback-router.js
```

デフォルトチェーン（Skeleton · 実切替なし）:

```
openai_realtime (live) → gemini_live (live) → mock (mock)
```

| API | 説明 |
| --- | --- |
| `createFallbackRouter(options)` | Router 生成 |
| `getPrimary()` | 第一候補 |
| `getFallbackPlan()` | 全チェーン |
| `selectProvider(query)` | 計画選択（接続なし） |
| `routeOnFailure(failedProvider)` | 次候補を返す（Skeleton） |
| `simulateFallbackWalk(startProvider)` | Mock ルーティング walk |

## Voice Core 追加 export

- `createSTTAdapter({ provider: "mock" })`
- `createTTSAdapter({ provider: "mock" })`
- `createFallbackRouter(options)`
- `VoiceFallbackRouter` · `DEFAULT_LIVE_CHAIN`

## テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-voice-core-phase4.mjs` | **38/38 PASS** |
| Phase 1 回帰 | **25/25 PASS** |
| Phase 2 回帰 | **22/22 PASS** |
| Phase 3 回帰 | **32/32 PASS** |
| Builder AI Phase 7 | **PASS** |
| `npm run build:pages` | **PASS** |

## コミット対象一覧（選別用 · 未コミット）

```
shared/voice-core/stt/voice-stt-adapter-interface.js
shared/voice-core/stt/voice-stt-mock-adapter.js
shared/voice-core/tts/voice-tts-adapter-interface.js
shared/voice-core/tts/voice-tts-mock-adapter.js
shared/voice-core/voice-fallback-router.js
shared/voice-core/voice-core.js
shared/voice-core/voice-core-test.html
scripts/test-voice-core-phase4.mjs
scripts/test-voice-core-phase3.mjs
reports/voice-core-phase4.md
deploy/cloudflare/dist/shared/voice-core/*
```
