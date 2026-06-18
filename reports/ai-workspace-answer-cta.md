# AI Workspace 回答カード CTA 検証

実施: 2026-06-12T13:10:14.258Z

## プロンプト

`草刈り業者への問い合わせ文を作って`

## 方針

- 回答直下に **次にできること** CTA（問い合わせ文生成 → TASFUL TALKへ送る）
- 回答カード右上に **コピー**
- Markdown / AI補足の後処理
- プレースホルダーはログイン情報で自動補完（不可時は下書き時に入力）
- **自動送信なし** / モデル切替UIは維持

## 結果

- 総合: **PASS**

### ChatGPT

- スクショ: `screenshots/ai-workspace-multi-ai/chatgpt-real-api.png`
- 応答元バッジ: ChatGPT
- コピー: true
- 次にできること: true
- CTA: TASFUL TALKへ送る
- Markdown残骸なし: true
- プレースホルダー（名前）: OK
- 連絡先プレースホルダー残存: あり（下書き時入力可）
- モデル切替表示: true

### Claude

- スクショ: `screenshots/ai-workspace-multi-ai/claude-real-api.png`
- 応答元バッジ: Claude
- コピー: true
- 次にできること: true
- CTA: TASFUL TALKへ送る
- Markdown残骸なし: true
- プレースホルダー（名前）: OK
- 連絡先プレースホルダー残存: なし
- モデル切替表示: true


## QA Center

- Viewer: `screenshots-viewer.html?search=ChatGPT`
- Viewer: `screenshots-viewer.html?search=Claude`
- 登録済み: ChatGPT / Claude 実API 各1枚
