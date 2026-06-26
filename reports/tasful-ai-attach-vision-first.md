# TASFUL AI Attach / Vision First — 実装レポート

実装日: 2026-06-26

## 目的

TASFUL AI Workspace の添付 UI を Gateway / Vision 接続まで進め、画像・文書を AI 相談に渡せる状態にする。`TasuAiModelGateway.completeTurn()` の既存契約は維持。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `ai-workspace-attachments.js` | **新規** — 添付準備・検証・エラー UI |
| `ai-workspace-chat.js` | `sendMessage` から添付収集 → `requestAssistantReply` / Gateway へ |
| `ai-model-gateway.js` | 後方互換 `attachments` 引数、プロンプト合成、mock 拡張 |
| `tasful-general-ai-shell.js` | `clearAttachments()` 追加（プレビュー UI 維持） |
| `ai-workspace.html` | `accept` 拡張、スクリプト追加 |
| `ai-workspace-chat.css` | `.ai-attach-error` |
| `supabase/functions/_shared/ai-attachments.ts` | **新規** — Edge 共通 attachment 型・Vision 組み立て |
| `supabase/functions/gemini-chat/index.ts` | Vision inlineData 対応 |
| `supabase/functions/openai-chat/index.ts` | image_url 対応 |
| `supabase/functions/claude-chat/index.ts` | base64 image block 対応 |
| `scripts/test-tasful-ai-attach-vision-browser.mjs` | **新規** E2E |
| `reports/tasful-ai-attach-vision-first.md` | 本レポート |

**変更していないもの:** `postUserCommand`、Action Registry、AI秘書 Phase2、gen-ai-workspace、Platform/Builder/TLV。

## 添付対応形式

| 種別 | 拡張子 | 処理 |
| --- | --- | --- |
| 画像 | png, jpg, jpeg, webp | base64 → Edge Vision（Gemini inlineData / OpenAI image_url / Claude image） |
| 文書 | txt, md, csv, json | クライアントで UTF-8 抽出 → プロンプトに `[添付: ファイル名]` ブロック |
| PDF | pdf | **受信のみ** — 名前・サイズ + 「PDF本文解析は後続フェーズ」注記をプロンプトに含める |

非対応形式は `.ai-attach-error` に明示（例: `.exe`）。

## サイズ上限

| 種別 | 上限 |
| --- | --- |
| 画像 | 4 MB / ファイル |
| 文書 (txt/md/csv/json) | 512 KB / ファイル |
| PDF | 4 MB / ファイル |
| 件数 | 最大 5 ファイル / 送信 |
| テキスト抽出 | 12,000 文字 / ファイル |

定数: `window.TasuAiWorkspaceAttachments`（`ai-workspace-attachments.js`）

## Gateway への渡し方

```javascript
await TasuAiModelGateway.completeTurn({
  userText: "...",
  // 既存引数はそのまま
  attachments: [
    { name, mimeType, kind: "image", base64, sizeBytes },
    { name, mimeType, kind: "document", textContent, sizeBytes },
    { name, mimeType, kind: "pdf", sizeBytes, note },
  ],
});
```

- 既存 text-only 呼び出しは **attachments 省略可**（従来どおり）
- 添付あり時は Web 検索を自動スキップ（`skipSearch: true`）
- 返却に後方互換フィールド `attachments_count` を追加（既存フィールドは不変）

## Vision 対応範囲

| プロバイダ | Edge | 方式 |
| --- | --- | --- |
| Gemini | `gemini-chat` | `inlineData` parts（`buildGeminiUserParts`） |
| OpenAI | `openai-chat` | `image_url` + `gpt-4o-mini` 等 Vision 対応モデル |
| Claude | `claude-chat` | `image` base64 block |

API キーは Edge secrets のみ（クライアントに secret 追加なし）。

## PDF の対応状況

- ファイル選択・プレビュー・Gateway へのメタデータ渡し: **対応**
- 本文パース / Vision 読取: **未実装**（プロンプトに後続フェーズ注記）
- PDF パーサーは意図的に未導入

## fallback / mock の挙動

Edge 未設定・API エラー時:

- `mockReply()` が添付ファイル名を `[添付受信]` として言及
- PDF 添付時は「PDF本文解析は後続フェーズ」を追記
- 画像添付時は「Vision 接続時に参照（モックではファイル名のみ）」を追記
- チャット送信・履歴・Voice イベントは継続

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-admin-ai-secretary-text-chat-browser.mjs` | **PASS** |
| `node scripts/test-talk-ops-assistant-browser.mjs` | **PASS** |
| `node scripts/test-admin-operations-dashboard-browser.mjs` | **PASS** |
| `node scripts/test-ai-voice-core-browser.mjs` | **PASS** |
| `node scripts/test-tasful-ai-attach-vision-browser.mjs` | **PASS** |

## 未実装事項

- PDF 本文解析（パーサー / Vision PDF）
- 添付履歴の永続化（サーバー DB）
- 複数画像のサムネイル UI
- 添付付きメッセージの再生成
- gen-ai-workspace との添付 UI 統合
