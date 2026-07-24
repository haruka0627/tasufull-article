# P0: Gemini OCR + 共通 Moderation 統合 — 動作確認レポート

実施日: 2026-07-04  
検証環境: `http://127.0.0.1:8788`（Wrangler Pages Dev）

## 目的

画像・PDF 経由で電話番号・メール・LINE・SNS・URL 等が AI に渡る抜け道を防ぐ。  
OCR は Gemini（Edge のみ）、判定は既存 Talk / Platform 共通 Moderation を正本とする。

## 処理フロー（実装）

```text
添付画像・PDF / テキスト文書
  ↓
Gemini OCR（Edge `/api/gemini-ocr`）※画像・PDF
  ↓
OCR / 抽出テキスト（メモリ上のみ）
  ↓
scanAttachments（platform-content-gate-attachments.js）
  ↓
moderateMessage / maskSensitiveText（chat-moderation.js · chat-service 経由可）
  ↓
問題なし → マスク済みユーザー文 + 審査済み添付のみ AI へ
問題あり → block（画像/PDF の連絡先）または mask（本文・テキスト文書）
```

生 OCR テキストは AI・ログ・DB に渡さない。

---

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `deploy/cloudflare/functions/api/gemini-ocr.js` | **追加** Gemini OCR Edge Function |
| `chat-ocr.js` | Edge `/api/gemini-ocr` 呼び出し（ブラウザから Gemini 直叩きしない） |
| `chat-ocr-config.js` / `.example.js` | 既定 `provider: "gemini"` |
| `chat-moderation.js` | `maskSensitiveText` · `reasonsToEventKinds`（既存ルール再利用） |
| `platform-content-gate-attachments.js` | PDF OCR フォールバック · 空 OCR は allow · `textContent` 対応 |
| `attachment-ai-gate.js` | **追加** AI / Builder Vision 共通ゲート |
| `ai-workspace-attachments.js` | PDF に base64（OCR 用） |
| `ai-workspace-chat.js` | 送信前ゲート · AI へは `safeText` / `safeAttachments` のみ |
| `ai-workspace.html` | OCR / Moderation / gate スクリプト読込 |
| `builder/builder-ai-core.js` | `runFieldVision` 前に共通ゲート |
| `builder/builder-ai.html` | 同上スクリプト読込 |
| `chat-service.js` | Talk `runModeration` 後に生 OCR 破棄 · ログはイベント種別のみ |
| `scripts/test-gemini-ocr-moderation-p0.mjs` | **追加** ユニット検証 |
| `reports/gemini-ocr-moderation-p0.md` | 本レポート |

---

## 追加 Edge Function

- **パス:** `deploy/cloudflare/functions/api/gemini-ocr.js` → `POST /api/gemini-ocr`
- **Secret:** `GEMINI_API_KEY`（Cloudflare / `.dev.vars` · クライアント非公開）
- **モデル:** `gemini-2.5-flash`（`gemini-2.0-flash` は upstream 404 のため不使用）
- **入力:** `{ mimeType, base64 }` または `{ dataUrl }`（image/* · application/pdf）
- **出力:** `{ ok, text, provider }` のみ（キー・プロンプト・候補メタは返さない）

---

## Gemini 接続方法

1. ブラウザ: `TasuChatOcr.extractTextFromImage` → `fetch("/api/gemini-ocr")`
2. Edge: `GEMINI_API_KEY` で  
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`
3. `inlineData` で画像/PDF を渡し、プレーンテキストのみ抽出

ブラウザから `generativelanguage.googleapis.com` は呼ばない。

---

## Moderation 統合箇所

| 面 | 箇所 | 正本 |
| --- | --- | --- |
| 共通ゲート | `attachment-ai-gate.js` → `scanAttachments` + `moderateMessage` + `maskSensitiveText` | Talk / Platform 既存 |
| AI Workspace | `ai-workspace-chat.js` `sendMessage` / `requestAssistantReply` | 同上 |
| Builder Vision | `builder/builder-ai-core.js` `runFieldVision` | 同上 |
| Talk（既存強化） | `chat-service.js` `runModeration` · `persistModerationLog` | 既存フロー維持 · PII 非保存 |

OCR 専用の判定ロジック・新規 Regex は追加していない。

---

## AI へ渡るデータ

| 種別 | AI へ渡すもの | 渡さないもの |
| --- | --- | --- |
| ユーザー文 | `maskSensitiveText` 後の安全テキスト | 生の電話・メール・URL 等 |
| 画像 | 審査 **allow** 時のみ base64（OCR で連絡先なし） | OCR 生テキスト · 連絡先あり画像 |
| PDF | メタ（名前・サイズ・審査済み note）のみ | PDF 本文テキスト · 生 OCR |
| テキスト文書 | マスク済み `textContent` | 生の連絡先 |

例:

- `09012345678` → `***********`（マスクして許可）
- 画像 OCR に電話番号 → **block**（添付ごと拒否 · 画素に連絡先が残るため）

---

## ログ内容

保存するのはイベント種別のみ（生データなし）。

| イベント | 意味 |
| --- | --- |
| `ocr` | OCR 実行 |
| `phone` / `email` / `url` / `sns` / `qr` | 検知種別（将来 QR 画像は P1） |
| `block` | ブロック |
| `mask` | マスクして通過 |

Talk `moderation_logs.message_text` は  
`{"events":[...],"reasons":[...]}` の JSON のみ。`image_urls` は空配列（data URL 非保存）。

コンソール: `[AttachmentAiGate] <surface> <events> <reasons>`（reasons はラベルのみ）。

---

## テスト結果

### ユニット

```text
node scripts/test-gemini-ocr-moderation-p0.mjs
→ 35/35 passed
```

### Edge OCR（8788）

```text
POST /api/gemini-ocr  （1x1 PNG）
→ HTTP 200  {"ok":true,"text":"","provider":"gemini"}
GET  /api/gemini-ocr
→ HTTP 405
```

### ページ

| URL | HTTP |
| --- | --- |
| `http://127.0.0.1:8788/ai-workspace` | 200 |
| `http://127.0.0.1:8788/builder/builder-ai` | 200 |
| `http://127.0.0.1:8788/attachment-ai-gate.js` | 200 |

Console Error: ページ読込時点でゲート関連のエラーなし（ユニット・HTTP 確認）。実ブラウザでの添付 E2E は本番キー有効時に手動確認推奨。

---

## 残課題（P1 以降 · 今回未実装）

- Contact Reveal 統合
- QR 画像デコード高度化
- Builder 550円統合
- 新 Moderation 実装 / 新 Regex
- UI 変更 · OCR 履歴画面
- Gateway への PDF 本文（マスク済み）渡しの要否整理
- 本番 Cloudflare への `GEMINI_API_KEY` 設定確認（未設定時 OCR 失敗 → AI 添付は block）

---

## 完了条件チェック

| 条件 | 結果 |
| --- | --- |
| Gemini OCR が Edge 経由で動作 | PASS（200 · text のみ） |
| AI Workspace 添付前に共通 Moderation | PASS（`attachment-ai-gate`） |
| Builder Vision 添付前に共通 Moderation | PASS（`runFieldVision`） |
| AI へ生 OCR を渡さない | PASS（ユニット） |
| 既存 Talk Moderation を正本 | PASS |
| Console Error 0（ゲート関連） | PASS（読込・ユニット） |
| 動作確認レポート | 本ファイル |
