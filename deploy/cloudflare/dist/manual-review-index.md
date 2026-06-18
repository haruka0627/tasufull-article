# プラットUI 手動レビュー索引

ローカル dev サーバー: `npm run dev` → **http://localhost:5173**

使い方: 下表の URL を開く → 実画面確認 → スクショ照合 → 修正指示

## 注意（URL再現）

- **求人**の `06-pay-550` / `07-chat` の `thread=` は撮影実行時の動的IDです。レビュー時は `05-applications` から「やりとりに進む」→ 支払い → チャットで再現してください。
- **その他5カテゴリ**の前払いは `chat-demo-{category}-fee-001`、完了フローは `chat-demo-{category}-deal-001` + `*_deal_demo_001` 固定です。
- 通知タブは `talk-home.html?tab=notify&userId={ユーザーID}&talkDev=1` でユーザー切替してください。

---

## 求人（job）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | 求人一覧 | [`01-job-list.png`](screenshots/platform-manual-review/job/01-job-list.png) | [`job-top.html`](http://localhost:5173/job-top.html) | 求人カードが一覧表示される / TasuFull求人トップが表示される |
| 2 | 求人詳細（応募者） | [`02-job-detail.png`](screenshots/platform-manual-review/job/02-job-detail.png) | [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1) | ヒーロー・報酬・応募ボタンが表示される / 職場イメージ等の詳細セクションがある |
| 3 | 応募送信 | [`03-apply.png`](screenshots/platform-manual-review/job/03-apply.png) | [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1) | 「応募済み」または応募完了トースト / 掲載者への応募通知が発火する導線 |
| 4 | 応募通知 | [`04-notify.png`](screenshots/platform-manual-review/job/04-notify.png) | [`talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1) | 「この求人に応募がありました」 / 「確認する」のみ（本文なし） |
| 5 | 応募者確認 | [`05-applications.png`](screenshots/platform-manual-review/job/05-applications.png) | [`detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications`](http://localhost:5173/detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications) | 応募者カードと検索/フィルター/並び替え / 職場イメージ・求人詳細セクションは非表示 / 件数バッジが維持される |
| 6 | 550円支払い | [`06-pay-550.png`](screenshots/platform-manual-review/job/06-pay-550.png) | [`platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002) | ¥550 定額 / Connect/5%表記なし / 求人カテゴリ |
| 7 | 求人チャット | [`07-chat.png`](screenshots/platform-manual-review/job/07-chat.png) | [`chat-detail.html?thread=chat-1780805491102-nchqp4`](http://localhost:5173/chat-detail.html?thread=chat-1780805491102-nchqp4) | 求人応募カードが表示される / deal-detail / チャットで確認 なし |
| 8 | 採用通知 | [`08-hired-notify.png`](screenshots/platform-manual-review/job/08-hired-notify.png) | [`talk-home.html?tab=notify&userId=u_hiro&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_hiro&talkDev=1) | タイトルのみ＋「確認する」 / hire-result へ遷移する href |
| 9 | 採用結果 | [`09-hired-card.png`](screenshots/platform-manual-review/job/09-hired-card.png) | [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications) | 採用結果カード1件 / やりとり開始または待機メッセージ / 通常求人詳細は非表示 |

### 遷移フロー

#### 01. 01-job-list.png

- **画面名:** 求人一覧
- **URL:** `job-top.html`
- **フルURL:** http://localhost:5173/job-top.html
- **遷移先:** `job-top.html`
- **操作:** 求人一覧を開く
- **確認ポイント:**
  - 求人カードが一覧表示される
  - TasuFull求人トップが表示される

↓

#### 02. 02-job-detail.png

- **画面名:** 求人詳細（応募者）
- **URL:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
- **遷移元:** `job-top.html`
- **遷移先:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **操作:** 求人詳細を開く
- **確認ポイント:**
  - ヒーロー・報酬・応募ボタンが表示される
  - 職場イメージ等の詳細セクションがある

↓

#### 03. 03-apply.png

- **画面名:** 応募送信
- **URL:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
- **遷移元:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **遷移先:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **操作:** 応募ボタン押下（または応募済み表示）
- **確認ポイント:**
  - 「応募済み」または応募完了トースト
  - 掲載者への応募通知が発火する導線

↓

#### 04. 04-notify.png

- **画面名:** 応募通知
- **URL:** `talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1
- **遷移元:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`
- **操作:** 掲載者が通知タブで応募通知を確認
- **確認ポイント:**
  - 「この求人に応募がありました」
  - 「確認する」のみ（本文なし）

↓

#### 05. 05-applications.png

- **画面名:** 応募者確認
- **URL:** `detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications`
- **フルURL:** http://localhost:5173/detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications
- **遷移元:** `talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`
- **遷移先:** `detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications`
- **操作:** 「確認する」→ 応募者確認（view=applications）
- **確認ポイント:**
  - 応募者カードと検索/フィルター/並び替え
  - 職場イメージ・求人詳細セクションは非表示
  - 件数バッジが維持される

↓

#### 06. 06-pay-550.png

- **画面名:** 550円支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002
- **遷移元:** `detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002`
- **操作:** 「やりとりに進む」→ 利用料550円の支払い画面
- **確認ポイント:**
  - ¥550 定額
  - Connect/5%表記なし
  - 求人カテゴリ

↓

#### 07. 07-chat.png

- **画面名:** 求人チャット
- **URL:** `chat-detail.html?thread=chat-1780805491102-nchqp4`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-1780805491102-nchqp4
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002`
- **遷移先:** `chat-detail.html?thread=chat-1780805491102-nchqp4`
- **操作:** 550円支払い完了 → チャットを開く
- **確認ポイント:**
  - 求人応募カードが表示される
  - deal-detail / チャットで確認 なし

↓

#### 08. 08-hired-notify.png

- **画面名:** 採用通知
- **URL:** `talk-home.html?tab=notify&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_hiro&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-1780805491102-nchqp4`
- **遷移先:** `talk-home.html?tab=notify&userId=u_hiro&talkDev=1`
- **操作:** 応募者が「採用されました」通知を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - hire-result へ遷移する href

↓

#### 09. 09-hired-card.png

- **画面名:** 採用結果
- **URL:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications`
- **フルURL:** http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications
- **遷移元:** `talk-home.html?tab=notify&userId=u_hiro&talkDev=1`
- **遷移先:** `detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications`
- **操作:** 「確認する」→ 採用結果カード（view=hire-result）
- **確認ポイント:**
  - 採用結果カード1件
  - やりとり開始または待機メッセージ
  - 通常求人詳細は非表示

---

## ワーカー（worker）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | ワーカー詳細 | [`01-worker-detail.png`](screenshots/platform-manual-review/worker/01-worker-detail.png) | [`detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1) | プロフィールと報酬が表示される / 依頼ボタンが表示される |
| 2 | 依頼通知 | [`02-request-notify.png`](screenshots/platform-manual-review/worker/02-request-notify.png) | [`talk-home.html?tab=notify&userId=u_worker&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1) | タイトルのみ＋「確認する」 / deal-detail へ行かない |
| 3 | 前払い支払い | [`03-fee-pay.png`](screenshots/platform-manual-review/worker/03-fee-pay.png) | [`platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk) | 5%・最低550円 / deal-detail リンクなし / worker カテゴリ |
| 4 | チャット（前払い後） | [`04-chat.png`](screenshots/platform-manual-review/worker/04-chat.png) | [`chat-detail.html?thread=chat-demo-worker-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001) | コンテンツカードが表示される / deal-detail なし |
| 5 | コンテンツカード | [`05-content-card.png`](screenshots/platform-manual-review/worker/05-content-card.png) | [`chat-detail.html?thread=chat-demo-worker-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001) | 「依頼内容」セクション / 一覧/detail への不要リンクなし |
| 6 | 完了報告（チャット） | [`06-complete.png`](screenshots/platform-manual-review/worker/06-complete.png) | [`chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1`](http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1) | 「完了報告」カード / 承認/差し戻しボタン / deal-detail へ行かない |
| 7 | 取引完了通知 | [`07-complete-notify.png`](screenshots/platform-manual-review/worker/07-complete-notify.png) | [`talk-home.html?tab=notify&userId=u_worker&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1) | タイトルのみ＋「確認する」 / chat-detail へ遷移 |
| 8 | 完了報告（通知経由） | [`08-complete-card.png`](screenshots/platform-manual-review/worker/08-complete-card.png) | [`chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk`](http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk) | 完了報告カードが表示 / チャットで確認 ボタンなし |
| 9 | 完了後5%請求 | [`09-fee-after-complete.png`](screenshots/platform-manual-review/worker/09-fee-after-complete.png) | [`platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete) | phase=complete / 5%・最低550円 / 取引完了後の請求であること |

### 遷移フロー

#### 01. 01-worker-detail.png

- **画面名:** ワーカー詳細
- **URL:** `detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1
- **遷移先:** `detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1`
- **操作:** ワーカー詳細を開く（依頼者視点）
- **確認ポイント:**
  - プロフィールと報酬が表示される
  - 依頼ボタンが表示される

↓

#### 02. 02-request-notify.png

- **画面名:** 依頼通知
- **URL:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1
- **遷移元:** `detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **操作:** 通知タブで「依頼が届きました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - deal-detail へ行かない

↓

#### 03. 03-fee-pay.png

- **画面名:** 前払い支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk`
- **操作:** 「確認する」→ 5%・最低550円の支払い画面
- **確認ポイント:**
  - 5%・最低550円
  - deal-detail リンクなし
  - worker カテゴリ

↓

#### 04. 04-chat.png

- **画面名:** チャット（前払い後）
- **URL:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk`
- **遷移先:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **操作:** 支払い完了 → チャットを開く
- **確認ポイント:**
  - コンテンツカードが表示される
  - deal-detail なし

↓

#### 05. 05-content-card.png

- **画面名:** コンテンツカード
- **URL:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001
- **遷移元:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **操作:** チャット内カード（セクションラベル確認）
- **確認ポイント:**
  - 「依頼内容」セクション
  - 一覧/detail への不要リンクなし

↓

#### 06. 06-complete.png

- **画面名:** 完了報告（チャット）
- **URL:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-worker-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1`
- **操作:** 取引スレッドで完了報告カードを確認
- **確認ポイント:**
  - 「完了報告」カード
  - 承認/差し戻しボタン
  - deal-detail へ行かない

↓

#### 07. 07-complete-notify.png

- **画面名:** 取引完了通知
- **URL:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **操作:** 通知タブで「取引が完了しました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - chat-detail へ遷移

↓

#### 08. 08-complete-card.png

- **画面名:** 完了報告（通知経由）
- **URL:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_worker&talkDev=1`
- **遷移先:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk`
- **操作:** 「確認する」→ 完了報告カード付きチャット
- **確認ポイント:**
  - 完了報告カードが表示
  - チャットで確認 ボタンなし

↓

#### 09. 09-fee-after-complete.png

- **画面名:** 完了後5%請求
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete
- **遷移元:** `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete`
- **操作:** 完了承認 → 完了時5%・最低550円の支払い画面
- **確認ポイント:**
  - phase=complete
  - 5%・最低550円
  - 取引完了後の請求であること

---

## スキル（skill）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | スキル詳細 | [`01-skill-detail.png`](screenshots/platform-manual-review/skill/01-skill-detail.png) | [`detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1) | スキル概要と価格が表示される / 相談/購入CTAが表示される |
| 2 | 購入通知 | [`02-purchase-notify.png`](screenshots/platform-manual-review/skill/02-purchase-notify.png) | [`talk-home.html?tab=notify&userId=u_sachi&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1) | タイトルのみ＋「確認する」 / 支払い画面へ遷移する |
| 3 | 前払い支払い | [`03-fee-pay.png`](screenshots/platform-manual-review/skill/03-fee-pay.png) | [`platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk) | 5%・最低550円 / deal-detail リンクなし / skill カテゴリ |
| 4 | チャット（前払い後） | [`04-chat.png`](screenshots/platform-manual-review/skill/04-chat.png) | [`chat-detail.html?thread=chat-demo-skill-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001) | コンテンツカードが表示される / deal-detail なし |
| 5 | コンテンツカード | [`05-content-card.png`](screenshots/platform-manual-review/skill/05-content-card.png) | [`chat-detail.html?thread=chat-demo-skill-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001) | 「購入内容」セクション / 一覧/detail への不要リンクなし |
| 6 | 完了報告（チャット） | [`06-complete.png`](screenshots/platform-manual-review/skill/06-complete.png) | [`chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1`](http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1) | 「完了報告」カード / 承認/差し戻しボタン / deal-detail へ行かない |
| 7 | 取引完了通知 | [`07-complete-notify.png`](screenshots/platform-manual-review/skill/07-complete-notify.png) | [`talk-home.html?tab=notify&userId=u_sachi&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1) | タイトルのみ＋「確認する」 / chat-detail へ遷移 |
| 8 | 完了報告（通知経由） | [`08-complete-card.png`](screenshots/platform-manual-review/skill/08-complete-card.png) | [`chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk`](http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk) | 完了報告カードが表示 / チャットで確認 ボタンなし |
| 9 | 完了後5%請求 | [`09-fee-after-complete.png`](screenshots/platform-manual-review/skill/09-fee-after-complete.png) | [`platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete) | phase=complete / 5%・最低550円 / 取引完了後の請求であること |

### 遷移フロー

#### 01. 01-skill-detail.png

- **画面名:** スキル詳細
- **URL:** `detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1
- **遷移先:** `detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1`
- **操作:** スキル詳細を開く（購入者視点）
- **確認ポイント:**
  - スキル概要と価格が表示される
  - 相談/購入CTAが表示される

↓

#### 02. 02-purchase-notify.png

- **画面名:** 購入通知
- **URL:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1
- **遷移元:** `detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **操作:** 通知タブで「スキルが購入されました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - 支払い画面へ遷移する

↓

#### 03. 03-fee-pay.png

- **画面名:** 前払い支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk`
- **操作:** 「確認する」→ 5%・最低550円の支払い画面
- **確認ポイント:**
  - 5%・最低550円
  - deal-detail リンクなし
  - skill カテゴリ

↓

#### 04. 04-chat.png

- **画面名:** チャット（前払い後）
- **URL:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk`
- **遷移先:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **操作:** 支払い完了 → チャットを開く
- **確認ポイント:**
  - コンテンツカードが表示される
  - deal-detail なし

↓

#### 05. 05-content-card.png

- **画面名:** コンテンツカード
- **URL:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001
- **遷移元:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **操作:** チャット内カード（セクションラベル確認）
- **確認ポイント:**
  - 「購入内容」セクション
  - 一覧/detail への不要リンクなし

↓

#### 06. 06-complete.png

- **画面名:** 完了報告（チャット）
- **URL:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-skill-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1`
- **操作:** 取引スレッドで完了報告カードを確認
- **確認ポイント:**
  - 「完了報告」カード
  - 承認/差し戻しボタン
  - deal-detail へ行かない

↓

#### 07. 07-complete-notify.png

- **画面名:** 取引完了通知
- **URL:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **操作:** 通知タブで「取引が完了しました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - chat-detail へ遷移

↓

#### 08. 08-complete-card.png

- **画面名:** 完了報告（通知経由）
- **URL:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_sachi&talkDev=1`
- **遷移先:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk`
- **操作:** 「確認する」→ 完了報告カード付きチャット
- **確認ポイント:**
  - 完了報告カードが表示
  - チャットで確認 ボタンなし

↓

#### 09. 09-fee-after-complete.png

- **画面名:** 完了後5%請求
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete
- **遷移元:** `chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete`
- **操作:** 完了承認 → 完了時5%・最低550円の支払い画面
- **確認ポイント:**
  - phase=complete
  - 5%・最低550円
  - 取引完了後の請求であること

---

## 商品（product）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | 商品詳細 | [`01-product-detail.png`](screenshots/platform-manual-review/product/01-product-detail.png) | [`detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1) | 商品画像と価格が表示される / 問い合わせ/購入CTAが表示される |
| 2 | 購入通知 | [`02-purchase-notify.png`](screenshots/platform-manual-review/product/02-purchase-notify.png) | [`talk-home.html?tab=notify&userId=u_product&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1) | タイトルのみ＋「確認する」 / 5%・最低550円の前払い導線 |
| 3 | 前払い支払い | [`03-fee-pay.png`](screenshots/platform-manual-review/product/03-fee-pay.png) | [`platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk) | 5%・最低550円 / deal-detail リンクなし / product カテゴリ |
| 4 | チャット（前払い後） | [`04-chat.png`](screenshots/platform-manual-review/product/04-chat.png) | [`chat-detail.html?thread=chat-demo-product-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001) | コンテンツカードが表示される / deal-detail なし |
| 5 | コンテンツカード | [`05-content-card.png`](screenshots/platform-manual-review/product/05-content-card.png) | [`chat-detail.html?thread=chat-demo-product-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001) | 「購入内容」セクション / 一覧/detail への不要リンクなし |
| 6 | 完了報告（チャット） | [`06-complete.png`](screenshots/platform-manual-review/product/06-complete.png) | [`chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1`](http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1) | 「完了報告」カード / 承認/差し戻しボタン / deal-detail へ行かない |
| 7 | 取引完了通知 | [`07-complete-notify.png`](screenshots/platform-manual-review/product/07-complete-notify.png) | [`talk-home.html?tab=notify&userId=u_product&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1) | タイトルのみ＋「確認する」 / chat-detail へ遷移 |
| 8 | 完了報告（通知経由） | [`08-complete-card.png`](screenshots/platform-manual-review/product/08-complete-card.png) | [`chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk`](http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk) | 完了報告カードが表示 / チャットで確認 ボタンなし |
| 9 | 完了後5%請求 | [`09-fee-after-complete.png`](screenshots/platform-manual-review/product/09-fee-after-complete.png) | [`platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete) | phase=complete / 5%・最低550円 / 取引完了後の請求であること |

### 遷移フロー

#### 01. 01-product-detail.png

- **画面名:** 商品詳細
- **URL:** `detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1
- **遷移先:** `detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1`
- **操作:** 商品詳細を開く（購入者視点）
- **確認ポイント:**
  - 商品画像と価格が表示される
  - 問い合わせ/購入CTAが表示される

↓

#### 02. 02-purchase-notify.png

- **画面名:** 購入通知
- **URL:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1
- **遷移元:** `detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **操作:** 通知タブで「商品が購入されました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - 5%・最低550円の前払い導線

↓

#### 03. 03-fee-pay.png

- **画面名:** 前払い支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk`
- **操作:** 「確認する」→ 5%・最低550円の支払い画面
- **確認ポイント:**
  - 5%・最低550円
  - deal-detail リンクなし
  - product カテゴリ

↓

#### 04. 04-chat.png

- **画面名:** チャット（前払い後）
- **URL:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk`
- **遷移先:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **操作:** 支払い完了 → チャットを開く
- **確認ポイント:**
  - コンテンツカードが表示される
  - deal-detail なし

↓

#### 05. 05-content-card.png

- **画面名:** コンテンツカード
- **URL:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001
- **遷移元:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **操作:** チャット内カード（セクションラベル確認）
- **確認ポイント:**
  - 「購入内容」セクション
  - 一覧/detail への不要リンクなし

↓

#### 06. 06-complete.png

- **画面名:** 完了報告（チャット）
- **URL:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-product-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1`
- **操作:** 取引スレッドで完了報告カードを確認
- **確認ポイント:**
  - 「完了報告」カード
  - 承認/差し戻しボタン
  - deal-detail へ行かない

↓

#### 07. 07-complete-notify.png

- **画面名:** 取引完了通知
- **URL:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **操作:** 通知タブで「取引が完了しました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - chat-detail へ遷移

↓

#### 08. 08-complete-card.png

- **画面名:** 完了報告（通知経由）
- **URL:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_product&talkDev=1`
- **遷移先:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk`
- **操作:** 「確認する」→ 完了報告カード付きチャット
- **確認ポイント:**
  - 完了報告カードが表示
  - チャットで確認 ボタンなし

↓

#### 09. 09-fee-after-complete.png

- **画面名:** 完了後5%請求
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete
- **遷移元:** `chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete`
- **操作:** 完了承認 → 完了時5%・最低550円の支払い画面
- **確認ポイント:**
  - phase=complete
  - 5%・最低550円
  - 取引完了後の請求であること

---

## 業務サービス（business）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | 業務サービス詳細 | [`01-business-detail.png`](screenshots/platform-manual-review/business/01-business-detail.png) | [`detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1) | サービス概要が表示される / 相談CTAが表示される |
| 2 | 相談通知 | [`02-consult-notify.png`](screenshots/platform-manual-review/business/02-consult-notify.png) | [`talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1) | タイトルのみ＋「確認する」 / category=business_service |
| 3 | 前払い支払い | [`03-fee-pay.png`](screenshots/platform-manual-review/business/03-fee-pay.png) | [`platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk) | 5%・最低550円 / deal-detail リンクなし / business_service カテゴリ |
| 4 | チャット（前払い後） | [`04-chat.png`](screenshots/platform-manual-review/business/04-chat.png) | [`chat-detail.html?thread=chat-demo-business-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001) | コンテンツカードが表示される / deal-detail なし |
| 5 | コンテンツカード | [`05-content-card.png`](screenshots/platform-manual-review/business/05-content-card.png) | [`chat-detail.html?thread=chat-demo-business-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001) | 「相談内容」セクション / 一覧/detail への不要リンクなし |
| 6 | 完了報告（チャット） | [`06-complete.png`](screenshots/platform-manual-review/business/06-complete.png) | [`chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1`](http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1) | 「完了報告」カード / 承認/差し戻しボタン / deal-detail へ行かない |
| 7 | 取引完了通知 | [`07-complete-notify.png`](screenshots/platform-manual-review/business/07-complete-notify.png) | [`talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1) | タイトルのみ＋「確認する」 / chat-detail へ遷移 |
| 8 | 完了報告（通知経由） | [`08-complete-card.png`](screenshots/platform-manual-review/business/08-complete-card.png) | [`chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk`](http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk) | 完了報告カードが表示 / チャットで確認 ボタンなし |
| 9 | 完了後5%請求 | [`09-fee-after-complete.png`](screenshots/platform-manual-review/business/09-fee-after-complete.png) | [`platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete) | phase=complete / 5%・最低550円 / 取引完了後の請求であること |

### 遷移フロー

#### 01. 01-business-detail.png

- **画面名:** 業務サービス詳細
- **URL:** `detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1
- **遷移先:** `detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1`
- **操作:** 業務サービス詳細を開く（相談者視点）
- **確認ポイント:**
  - サービス概要が表示される
  - 相談CTAが表示される

↓

#### 02. 02-consult-notify.png

- **画面名:** 相談通知
- **URL:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1
- **遷移元:** `detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **操作:** 通知タブで「相談が届きました（業務）」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - category=business_service

↓

#### 03. 03-fee-pay.png

- **画面名:** 前払い支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk`
- **操作:** 「確認する」→ 5%・最低550円の支払い画面
- **確認ポイント:**
  - 5%・最低550円
  - deal-detail リンクなし
  - business_service カテゴリ

↓

#### 04. 04-chat.png

- **画面名:** チャット（前払い後）
- **URL:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk`
- **遷移先:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **操作:** 支払い完了 → チャットを開く
- **確認ポイント:**
  - コンテンツカードが表示される
  - deal-detail なし

↓

#### 05. 05-content-card.png

- **画面名:** コンテンツカード
- **URL:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001
- **遷移元:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **操作:** チャット内カード（セクションラベル確認）
- **確認ポイント:**
  - 「相談内容」セクション
  - 一覧/detail への不要リンクなし

↓

#### 06. 06-complete.png

- **画面名:** 完了報告（チャット）
- **URL:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-business-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1`
- **操作:** 取引スレッドで完了報告カードを確認
- **確認ポイント:**
  - 「完了報告」カード
  - 承認/差し戻しボタン
  - deal-detail へ行かない

↓

#### 07. 07-complete-notify.png

- **画面名:** 取引完了通知
- **URL:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **操作:** 通知タブで「取引が完了しました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - chat-detail へ遷移

↓

#### 08. 08-complete-card.png

- **画面名:** 完了報告（通知経由）
- **URL:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=u_business_demo&talkDev=1`
- **遷移先:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk`
- **操作:** 「確認する」→ 完了報告カード付きチャット
- **確認ポイント:**
  - 完了報告カードが表示
  - チャットで確認 ボタンなし

↓

#### 09. 09-fee-after-complete.png

- **画面名:** 完了後5%請求
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete
- **遷移元:** `chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete`
- **操作:** 完了承認 → 完了時5%・最低550円の支払い画面
- **確認ポイント:**
  - phase=complete
  - 5%・最低550円
  - 取引完了後の請求であること

---

## 店舗販売（shop）

| # | 画面 | スクショ | URL | 確認ポイント |
|---|------|----------|-----|--------------|
| 1 | 店舗詳細 | [`01-shop-detail.png`](screenshots/platform-manual-review/shop/01-shop-detail.png) | [`detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1) | 店舗ヒーローと商品一覧が表示される / 問い合わせ/購入導線がある |
| 2 | 購入通知 | [`02-purchase-notify.png`](screenshots/platform-manual-review/shop/02-purchase-notify.png) | [`talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1) | タイトルのみ＋「確認する」 / category=shop_store |
| 3 | 前払い支払い | [`03-fee-pay.png`](screenshots/platform-manual-review/shop/03-fee-pay.png) | [`platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk) | 5%・最低550円 / deal-detail リンクなし / shop_store カテゴリ |
| 4 | チャット（前払い後） | [`04-chat.png`](screenshots/platform-manual-review/shop/04-chat.png) | [`chat-detail.html?thread=chat-demo-shop-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001) | コンテンツカードが表示される / deal-detail なし |
| 5 | コンテンツカード | [`05-content-card.png`](screenshots/platform-manual-review/shop/05-content-card.png) | [`chat-detail.html?thread=chat-demo-shop-fee-001`](http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001) | 「購入内容」セクション / 一覧/detail への不要リンクなし |
| 6 | 完了報告（チャット） | [`06-complete.png`](screenshots/platform-manual-review/shop/06-complete.png) | [`chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1`](http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1) | 「完了報告」カード / 承認/差し戻しボタン / deal-detail へ行かない |
| 7 | 取引完了通知 | [`07-complete-notify.png`](screenshots/platform-manual-review/shop/07-complete-notify.png) | [`talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1) | タイトルのみ＋「確認する」 / chat-detail へ遷移 |
| 8 | 完了報告（通知経由） | [`08-complete-card.png`](screenshots/platform-manual-review/shop/08-complete-card.png) | [`chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk`](http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk) | 完了報告カードが表示 / チャットで確認 ボタンなし |
| 9 | 完了後5%請求 | [`09-fee-after-complete.png`](screenshots/platform-manual-review/shop/09-fee-after-complete.png) | [`platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete) | phase=complete / 5%・最低550円 / 取引完了後の請求であること |

### 遷移フロー

#### 01. 01-shop-detail.png

- **画面名:** 店舗詳細
- **URL:** `detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1`
- **フルURL:** http://localhost:5173/detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1
- **遷移先:** `detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1`
- **操作:** 店舗詳細を開く（購入者視点）
- **確認ポイント:**
  - 店舗ヒーローと商品一覧が表示される
  - 問い合わせ/購入導線がある

↓

#### 02. 02-purchase-notify.png

- **画面名:** 購入通知
- **URL:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1
- **遷移元:** `detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **操作:** 通知タブで「商品が購入されました（店舗）」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - category=shop_store

↓

#### 03. 03-fee-pay.png

- **画面名:** 前払い支払い
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk`
- **操作:** 「確認する」→ 5%・最低550円の支払い画面
- **確認ポイント:**
  - 5%・最低550円
  - deal-detail リンクなし
  - shop_store カテゴリ

↓

#### 04. 04-chat.png

- **画面名:** チャット（前払い後）
- **URL:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001
- **遷移元:** `platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk`
- **遷移先:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **操作:** 支払い完了 → チャットを開く
- **確認ポイント:**
  - コンテンツカードが表示される
  - deal-detail なし

↓

#### 05. 05-content-card.png

- **画面名:** コンテンツカード
- **URL:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001
- **遷移元:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **操作:** チャット内カード（セクションラベル確認）
- **確認ポイント:**
  - 「購入内容」セクション
  - 一覧/detail への不要リンクなし

↓

#### 06. 06-complete.png

- **画面名:** 完了報告（チャット）
- **URL:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-shop-fee-001`
- **遷移先:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1`
- **操作:** 取引スレッドで完了報告カードを確認
- **確認ポイント:**
  - 「完了報告」カード
  - 承認/差し戻しボタン
  - deal-detail へ行かない

↓

#### 07. 07-complete-notify.png

- **画面名:** 取引完了通知
- **URL:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **フルURL:** http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1
- **遷移元:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1`
- **遷移先:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **操作:** 通知タブで「取引が完了しました」を確認
- **確認ポイント:**
  - タイトルのみ＋「確認する」
  - chat-detail へ遷移

↓

#### 08. 08-complete-card.png

- **画面名:** 完了報告（通知経由）
- **URL:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk`
- **フルURL:** http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk
- **遷移元:** `talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1`
- **遷移先:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk`
- **操作:** 「確認する」→ 完了報告カード付きチャット
- **確認ポイント:**
  - 完了報告カードが表示
  - チャットで確認 ボタンなし

↓

#### 09. 09-fee-after-complete.png

- **画面名:** 完了後5%請求
- **URL:** `platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete`
- **フルURL:** http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete
- **遷移元:** `chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk`
- **遷移先:** `platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete`
- **操作:** 完了承認 → 完了時5%・最低550円の支払い画面
- **確認ポイント:**
  - phase=complete
  - 5%・最低550円
  - 取引完了後の請求であること

---

## URL一覧（カテゴリ別）

### 求人

1. 求人一覧: http://localhost:5173/job-top.html
2. 求人詳細（応募者）: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
3. 応募送信: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
4. 応募通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1
5. 応募者確認: http://localhost:5173/detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications
6. 550円支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-1780805491102-nchqp4&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002
7. 求人チャット: http://localhost:5173/chat-detail.html?thread=chat-1780805491102-nchqp4
8. 採用通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_hiro&talkDev=1
9. 採用結果: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications

### ワーカー

1. ワーカー詳細: http://localhost:5173/detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1
2. 依頼通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1
3. 前払い支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk
4. チャット（前払い後）: http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001
5. コンテンツカード: http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001
6. 完了報告（チャット）: http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1
7. 取引完了通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_worker&talkDev=1
8. 完了報告（通知経由）: http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk
9. 完了後5%請求: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete

### スキル

1. スキル詳細: http://localhost:5173/detail-skill.html?id=demo-skill-001&userId=u_hiro&talkDev=1
2. 購入通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1
3. 前払い支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-fee-001&listingId=demo-skill-001&category=skill&notify=platform-verify-skill-purchase-001&userId=u_sachi&talkDev=1&from=talk
4. チャット（前払い後）: http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001
5. コンテンツカード: http://localhost:5173/chat-detail.html?thread=chat-demo-skill-fee-001
6. 完了報告（チャット）: http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1
7. 取引完了通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_sachi&talkDev=1
8. 完了報告（通知経由）: http://localhost:5173/chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001&userId=u_sachi&talkDev=1&from=talk
9. 完了後5%請求: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-skill-deal-001&listingId=skill_deal_demo_001&category=skill&deal=skill_deal_demo_001&phase=complete

### 商品

1. 商品詳細: http://localhost:5173/detail-product.html?id=demo-product-001&userId=u_hiro&talkDev=1
2. 購入通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1
3. 前払い支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-fee-001&listingId=demo-product-001&category=product&notify=platform-verify-product-purchase-001&userId=u_product&talkDev=1&from=talk
4. チャット（前払い後）: http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001
5. コンテンツカード: http://localhost:5173/chat-detail.html?thread=chat-demo-product-fee-001
6. 完了報告（チャット）: http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1
7. 取引完了通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_product&talkDev=1
8. 完了報告（通知経由）: http://localhost:5173/chat-detail.html?thread=chat-demo-product-deal-001&deal=product_deal_demo_001&userId=u_product&talkDev=1&from=talk
9. 完了後5%請求: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-product-deal-001&listingId=demo-product-001&category=product&deal=product_deal_demo_001&phase=complete

### 業務サービス

1. 業務サービス詳細: http://localhost:5173/detail-business-service.html?id=demo-business-service-001&userId=u_hiro&talkDev=1
2. 相談通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1
3. 前払い支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-fee-001&listingId=demo-business-service-001&category=business_service&notify=platform-verify-business-consult-001&userId=u_business_demo&talkDev=1&from=talk
4. チャット（前払い後）: http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001
5. コンテンツカード: http://localhost:5173/chat-detail.html?thread=chat-demo-business-fee-001
6. 完了報告（チャット）: http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1
7. 取引完了通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_business_demo&talkDev=1
8. 完了報告（通知経由）: http://localhost:5173/chat-detail.html?thread=chat-demo-business-deal-001&deal=business_deal_demo_001&userId=u_business_demo&talkDev=1&from=talk
9. 完了後5%請求: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-business-deal-001&listingId=demo-business-service-001&category=business_service&deal=business_deal_demo_001&phase=complete

### 店舗販売

1. 店舗詳細: http://localhost:5173/detail-shop.html?id=demo-shop-reworks&userId=u_hiro&talkDev=1
2. 購入通知: http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1
3. 前払い支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-fee-001&listingId=demo-shop-reworks&category=shop_store&notify=platform-verify-shop-purchase-001&userId=demo_shop_user&talkDev=1&from=talk
4. チャット（前払い後）: http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001
5. コンテンツカード: http://localhost:5173/chat-detail.html?thread=chat-demo-shop-fee-001
6. 完了報告（チャット）: http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1
7. 取引完了通知: http://localhost:5173/talk-home.html?tab=notify&userId=demo_shop_user&talkDev=1
8. 完了報告（通知経由）: http://localhost:5173/chat-detail.html?thread=chat-demo-shop-deal-001&deal=shop_deal_demo_001&userId=demo_shop_user&talkDev=1&from=talk
9. 完了後5%請求: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-shop-deal-001&listingId=demo-shop-reworks&category=shop_store&deal=shop_deal_demo_001&phase=complete
