# TALK 通知導線 — レビュー準備

実施: 2026-06-12T16:07:11.526Z

## 目的

通知一覧のUI整理後、**通知を押した後にTALK内で迷わず行動できるか**を実クリックで確認する。

## 確認観点

| 観点 | 確認内容 |
|------|----------|
| 次アクションの明確さ | 通知クリック後、遷移先で次アクションが把握できる |
| コンテキスト | 相手・案件・取引状態が分かる |
| 戻り導線 | from=notify または戻る導線が表示される |
| モバイル操作性 | 390px 幅で主要操作要素が表示される |

## 導線検証（実クリック）

| 通知名 | 遷移先 | 期待アクション | 実際の次アクション | 結果 |
|--------|--------|----------------|-------------------|------|
| スキルが購入されました | http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=notify | 支払い確認 / Stripeで支払う / 購入者・掲載コンテキスト表示 | 購入者: ひろ / 案件: プロ品質の動画編集・ショート動画制作 / やり取り手数料: ¥550 / Stripeで支払う | PASS |

## 対象導線

1. チャット通知 → chat-detail.html → 返信
2. 購入通知 → 取引チャット / 支払い確認 → 取引開始
3. 完了報告通知 → board-thread.html#completion → 承認 / 差し戻し
4. レビュー通知 → chat-detail.html / review導線 → 評価入力
5. Connect通知 → payment-settings.html → 本人確認

## 登録スクショ（390px）

- `screenshots/talk-notify-flow/talk-notify-chat-detail-mobile390.png`
- `screenshots/talk-notify-flow/talk-notify-purchase-mobile390.png`
- `screenshots/talk-notify-flow/talk-notify-completion-mobile390.png`
- `screenshots/talk-notify-flow/talk-notify-review-mobile390.png`
- `screenshots/talk-notify-flow/talk-notify-connect-mobile390.png`

## Gemini 提出セット

- `screenshots/talk-notify-flow/talk-notify-chat-detail.png`
- `screenshots/talk-notify-flow/talk-notify-purchase.png`
- `screenshots/talk-notify-flow/talk-notify-completion.png`
- `screenshots/talk-notify-flow/talk-notify-review.png`
- `screenshots/talk-notify-flow/talk-notify-connect.png`

## QA Center

- Viewer: `screenshots-viewer.html?search=talk-notify`（http://localhost:5173/screenshots-viewer.html?search=talk-notify）
- 検索キーワード: **talk-notify**（登録済み 10 枚）
- IMAGE_META 登録数: 79
- 未登録 ⚠: 0


**全体: PASS**
