# 通知 UI — レビュー準備

実施: 2026-06-12T14:20:18.084Z

## 目的

利用者が通知を受け取った後、**何の通知か → 何をすればいいか → どこへ行くか** を迷わず理解できる状態にする。

## 確認事項

| 観点 | 確認内容 |
|------|----------|
| 通知だけで意味が分かるか | 通知カードにタイトル・カテゴリ・CTA が表示され、何の通知か判別できる |
| 押した先で何をすればいいか分かるか | CTA ラベルから次に取る行動が分かる |
| 戻り先が分かるか | 詳細ページ遷移時は from=notify / returnTo=talk-home?tab=notify が付与される設計 |

## 対象通知カテゴリ

Connect / チャット / 案件 / 応募 / 採用 / 購入 / 完了報告 / レビュー / 安否 / 運営通知

## 通知ごとの導線（実クリック検証）

| 種別 | 通知名 | 期待行動 | 遷移先（期待） | 実際の遷移先 | CTA | 結果 |
|------|--------|----------|----------------|--------------|-----|------|
| 通知一覧 | 通知タブ一覧 | 各通知の種別と次アクションが一覧で把握できる | talk-home.html?tab=notify | talk-home.html?tab=notify | - | PASS |
| Connect | 本人確認が必要です | 支払い方法・口座管理で本人確認手続きを進める | /payment-settings.html/i | http://localhost:5500/payment-settings.html?talkDev=1&userId=u_sachi&connectStep=identity&from=notify | 本人確認を進める | PASS |
| チャット | 応募者とのやりとりを開始してください | チャットを開いて応募者とやりとりを始める | /chat-detail.html/i | http://localhost:5500/chat-detail.html?thread=chat-demo-job-full-001&talkDev=1&from=notify&listingId=job_demo_full_001&applicationId=job-app-demo-full-001&userId=u_sachi | チャットを開く | PASS |
| 案件 | 新しい案件が公開されました | 公開案件の詳細を確認する | /public-board-detail.html/i | http://localhost:5500/public-board-detail.html?id=pub-board-project-001&type=project&userId=u_sachi&talkDev=1&from=notify | 確認する | PASS |
| 応募 | この求人に応募がありました | 応募者一覧で応募内容を確認する | /detail-job.html/i | http://localhost:5500/detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&review=job-full&view=applications#applications | 応募を見る | PASS |
| 採用 | 採用されました | 採用された案件スレッドを開く | /board-thread.html/i | http://localhost:5500/builder/board-thread.html?thread_id=thread-demo-001&userId=u_sachi&talkDev=1&from=notify | チャットを開く | PASS |
| 購入 | スキルが購入されました | 購入通知を確認しチャット開始準備へ進む | /platform-chat-fee-pay.html|chat-detail.html/i | http://localhost:5500/platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=notify | 購入者を確認する | PASS |
| 完了報告 | 完了報告が届きました | 完了報告を確認して承認・差し戻しを判断する | /board-thread.html/i | http://localhost:5500/builder/board-thread.html?thread_id=thread-demo-001&role=owner&userId=u_sachi&talkDev=1&from=notify#completion | 確認する | PASS |
| レビュー | 評価をお願いします | チャットで取引相手を評価する | /chat-detail.html/i | http://localhost:5500/chat-detail.html?thread=chat-demo-job-full-001&userId=u_sachi&talkDev=1&review=job-full&from=notify&demoState=completed&openReview=1 | 評価する | PASS |
| 安否 | 安否確認通知 | 安否ダッシュボードで状況を登録・確認する | /anpi-dashboard.html/i | http://localhost:5500/anpi-dashboard.html?userId=u_sachi&talkDev=1&from=notify#check | 確認する | PASS |
| 運営通知 | 重要なお知らせがあります | 運営からのお知らせ内容を確認する | /dashboard.html/i | http://localhost:5500/dashboard.html?userId=u_sachi&talkDev=1&from=notify | 確認する | PASS |

## 登録スクショ（390px）

### 最低取得

- `screenshots/notify-ui-review/notify-list-mobile390.png`
- `screenshots/notify-ui-review/notify-chat-mobile390.png`
- `screenshots/notify-ui-review/notify-job-mobile390.png`
- `screenshots/notify-ui-review/notify-connect-mobile390.png`
- `screenshots/notify-ui-review/notify-anpi-mobile390.png`

### Gemini 提出用

- `screenshots/notify-ui-review/notify-list.png` — 通知一覧
- `screenshots/notify-ui-review/notify-to-chat.png` — 通知→チャット
- `screenshots/notify-ui-review/notify-to-project.png` — 通知→案件
- `screenshots/notify-ui-review/notify-to-connect.png` — 通知→Connect
- `screenshots/notify-ui-review/notify-to-anpi.png` — 通知→安否

## QA Center

- Viewer: `screenshots-viewer.html?search=notify`（http://localhost:5500/screenshots-viewer.html?search=notify）
- 検索キーワード: **notify**（登録済み 20 枚）
- IMAGE_META 登録数: 69
- 未登録 ⚠: 0


総合: **PASS**
