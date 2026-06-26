# AI Voice Core First — 実装レポート

実装日: 2026-06-26

## 目的

AI秘書と TASFUL AI で共通利用できる Voice API 基盤を先に構築。テキストチャットは常に利用可能とし、Voice 失敗時も既存チャットを壊さない。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `tasful-ai-voice-core.js` | 共通 Voice Core（新規） |
| `tasful-ai-voice.css` | 共通 Voice UI スタイル（新規） |
| `admin-ai-secretary-voice.js` | AI秘書への接続ブリッジ（新規） |
| `ai-workspace-voice.js` | TASFUL AI Workspace 接続準備（新規） |
| `admin-ai-secretary-phase2.js` | 送信時 `stopVoice`、応答後 `tasu:ai-voice-assistant-reply` イベント |
| `ai-workspace-chat.js` | 送信時 `stopVoice`、応答後 voice イベント |
| `admin-operations-dashboard.html` | CSS / スクリプト追加 |
| `talk-ops-room.html` | CSS / スクリプト追加、サブテキスト更新 |
| `ai-workspace.html` | CSS / スクリプト追加 |
| `scripts/test-ai-voice-core-browser.mjs` | Voice Core E2E（新規） |
| `reports/ai-voice-core-first.md` | 本レポート |

**変更していないもの:** `postUserCommand`、Action Registry、Gateway コア、`TasuAiModelGateway.completeTurn()` の挙動、Builder AI / Platform AI / TASFUL Talk AI。

## Voice Core 仕様

グローバル: `window.TasuAiVoiceCore`

| API | 説明 |
| --- | --- |
| `speechToText(options?)` | Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`）。`voiceEnabled=false` または非対応時は reject。 |
| `textToSpeech(text, options?)` | ブラウザ `SpeechSynthesis`（adapter 経由）。 |
| `playVoice(text, options?)` | `speakerEnabled=true` のときのみ読み上げ。OFF なら `{ skipped: true, reason: "speaker_off" }`。 |
| `stopVoice()` | TTS キャンセル + 認識停止。 |
| `isVoiceSupported()` | `{ stt, tts, any }` を返す。 |
| `initSurface(surface)` | surface 別 prefs 読込（sessionStorage）。 |
| `setVoiceEnabled` / `setSpeakerEnabled` | ON/OFF と prefs 保存。 |
| `voiceEnabled` / `speakerEnabled` | getter（現在 surface の状態）。 |
| `setTtsAdapter(adapter)` | 将来 OpenAI TTS / ElevenLabs 差し替え用。デフォルト `browser-speech-synthesis`。 |
| `mountToolbar({ formEl, inputEl, surface, ... })` | マイク ON/OFF、録音、スピーカー ON/OFF、停止ボタン UI。 |

**エラー fallback:** voice エラーは `.tasful-ai-voice__error` に表示。チャット送信・ログ・loading は継続。

**prefs キー:** `tasu_ai_voice_prefs_v1_{surface}_voice` / `_speaker`（sessionStorage）

## AI秘書への接続

- `admin-ai-secretary-voice.js` が `[data-ops-phase2-chat-form]` に toolbar をマウント（Command Center / talk-ops 両方）。
- 音声入力結果は `[data-ops-secretary-input]` へ填入。送信は既存 form submit → `Phase2.sendMessage`。
- 送信開始時: `TasuAiVoiceCore.stopVoice()`。
- AI 返答後: `tasu:ai-voice-assistant-reply`（`surface: "ops_secretary"`）。`speakerEnabled=true` のときのみ `playVoice`。

## TASFUL AI への接続準備

- `ai-workspace-voice.js` が composer 近傍に同 toolbar をマウント。
- `ai-workspace-chat.js` が応答後に `surface: "tasful_ai"` で同一イベントを dispatch。
- `window.TasuAiVoiceCore` / `window.TasuAiWorkspaceVoice` を export。

## 非対応ブラウザ時の挙動

- STT 非対応: マイク toggle / 録音ボタン disabled + 「音声入力はこのブラウザでは利用できません」。
- TTS 非対応: スピーカー toggle disabled + 「読み上げはこのブラウザでは利用できません」。
- テキスト入力・送信・履歴は常に利用可能。

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-admin-ai-secretary-text-chat-browser.mjs` | **PASS** |
| `node scripts/test-talk-ops-assistant-browser.mjs` | **PASS** |
| `node scripts/test-admin-operations-dashboard-browser.mjs` | **PASS** |
| `node scripts/test-ai-voice-core-browser.mjs` | **PASS** |

## 未実装事項

- OpenAI TTS
- ElevenLabs
- Voice API 外部接続（課金 API）
- TLV AI 接続
- Builder AI / Platform AI / TASFUL Talk AI 接続（今回スコープ外）
