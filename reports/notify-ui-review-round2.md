# 通知 UI レビュー round2（Gemini 反映）

Captured: 2026-06-12T14:42:49.220Z

## 優先度A

1. 通知一覧を重要通知と通常通知に分離
2. Connect通知文言改善
3. 重要通知の視覚差（オレンジ/赤アクセント）

## 優先度B

4. Connect状態ラベル整理（未対応/提出済み/審査中/完了）— `connect-member-ui.js` / `payment-settings.js`
5. 安否通知の「無事です」最優先表示

## 検証結果

**PASS**

| チェック | 結果 |
| --- | --- |
| 重要通知と通常通知を分離 | PASS |
| Connect通知文言改善 | PASS |
| 重要通知の視覚差（オレンジ/赤アクセント） | PASS |
| 重要通知はボタン付きカード | PASS |
| 通常通知はカード全体タップ・CTA廃止 | PASS |
| 安否「無事です」を最優先表示 | PASS |

## スクリーンショット

- `screenshots/notify-ui-review/notify-list-mobile390.png`
- `screenshots/notify-ui-review/notify-connect-mobile390.png`
- `screenshots/notify-ui-review/notify-anpi-mobile390.png`

## QA Center

- 検索: `notify` (20 件)
- Viewer: http://localhost:5500/screenshots-viewer.html?search=notify
- 未登録: 0
- QA Gate: PASS
