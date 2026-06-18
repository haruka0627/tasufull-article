# 求人カテゴリ UI 手動レビュー

生成日時: 2026-06-07T10:45:31.320Z

ローカル dev: `npm run dev` → **http://localhost:5173**

目的: **人間の目視確認**（AI PASS 判定は不要）。各画面のスクショ・URL・確認観点を照合してください。

## フロー全体

```
求人一覧 → 求人詳細 → 応募 → 応募通知 → 応募者確認 → やりとりに進む
→ 550円支払い → チャット → 採用通知 → 採用結果
```

## 通知（求人）

求人で存在する通知は **2件** です。いずれも **タイトル + 「確認する」** のみ。

| # | 通知ID | タイトル | 受信者 | 遷移先 |
|---|--------|----------|--------|--------|
| ① | `platform-verify-job-apply-001` | この求人に応募がありました | 掲載者 (`u_job_demo_full`) | 応募者確認 (`view=applications`) |
| ② | `platform-verify-job-hired-001` | 採用されました | 応募者 (`u_hiro`) | 採用結果 (`view=hire-result`) |

### 通知導線 ① この求人に応募がありました

通知 → 確認する → 応募者確認

確認項目:
- 正しいページへ飛ぶか
- 応募者カードが表示されるか
- 応募先タイトルが表示されるか
- 不要なセクションが出ないか
- 応募者確認として成立しているか

### 通知導線 ② 採用されました

通知 → 確認する → 採用結果カード

確認項目:
- 正しいページへ飛ぶか
- 採用結果カードが表示されるか
- 求人タイトルが表示されるか
- 採用状況が分かるか
- 不要なセクションが出ないか

### 通知チャネル（通知タブ + TASFUL TALK）

| 通知 | 通知タブ | TASFUL TALK |
|------|----------|-------------|
| ① この求人に応募がありました | [`04-notify.png`](screenshots/platform-manual-review/job/04-notify.png) | [`04-notify-talk-390.png`](screenshots/platform-manual-review/job/04-notify-talk-390.png) |
| ② 採用されました | [`08-hired-notify.png`](screenshots/platform-manual-review/job/08-hired-notify.png) | [`08-notify-talk-390.png`](screenshots/platform-manual-review/job/08-notify-talk-390.png) |

TASFUL TALK は `talk-home.html?tab=chat&thread=official_tasful` の公式ルーム。求人通知2件の一覧: 
[notify-talk-job-both-390.png](screenshots/platform-manual-review/job/notify-talk-job-both-390.png)

## 全画面共通 UI 確認項目

1. タイトルは分かりやすいか
2. 何の求人か分かるか
3. ボタン文言は自然か
4. 不要なセクションが残っていないか
5. 余白は適切か
6. CTAは見つけやすいか
7. 情報の優先順位は正しいか
8. スマホ390pxで見やすいか
9. 「—」表示が残っていないか
10. 開発文言が残っていないか

---

## 画面別レビュー（提出順）

### 01. 求人一覧

![求人一覧](screenshots/platform-manual-review/job/01-job-list.png)

- **スクショ:** `screenshots/platform-manual-review/job/01-job-list.png`
- **URL:** [`job-top.html`](http://localhost:5173/job-top.html)
- **何を確認する画面か:** 求人カテゴリの入口。一覧から対象求人へ進めるか確認。
- **操作:** 求人一覧を開く
- **確認ポイント:**
  - 求人カードが一覧表示される
  - TasuFull求人トップが表示される
  - 390pxでカードが読める
- **気になった点:** 初回表示は検索フォーム中心で、求人カードはスクロール後。PR/注目求人の見え方は別途確認。
- **改善案:** 一覧到達までのスクロール量が多い場合、ヒーロー求人1件をフォーム上に出す検討。

### 02. 求人詳細

![求人詳細](screenshots/platform-manual-review/job/02-job-detail.png)

- **スクショ:** `screenshots/platform-manual-review/job/02-job-detail.png`
- **URL:** [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1)
- **何を確認する画面か:** 応募前の求人詳細。何の求人か・報酬・応募CTAが分かるか。
- **操作:** 求人詳細を開く（応募者 u_hiro）
- **確認ポイント:**
  - ヒーロー・報酬・応募ボタン
  - 職場イメージ等の詳細セクション
  - タイトルが分かりやすい
- **気になった点:** 出品者に @u_job_demo_full が見える（デモID）。
- **改善案:** デモ時以外は表示名のみにする。

### 03. 応募

![応募](screenshots/platform-manual-review/job/03-apply.png)

- **スクショ:** `screenshots/platform-manual-review/job/03-apply.png`
- **URL:** [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1)
- **何を確認する画面か:** 応募操作後の状態（応募済み表示または完了フィードバック）。
- **操作:** 応募ボタン押下（または応募済み表示）
- **確認ポイント:**
  - 「応募済み」または応募完了表示
  - CTA文言が自然
  - 開発文言・「—」がない
- **気になった点:** CTAが「応募済み」に変わるほか、緑の完了メッセージを表示。
- **改善案:** —

### 04. 応募通知

![応募通知](screenshots/platform-manual-review/job/04-notify.png)

**TASFUL TALK:** ![応募通知 TALK](screenshots/platform-manual-review/job/04-notify-talk-390.png)

- **スクショ:** `screenshots/platform-manual-review/job/04-notify.png`
- **URL:** [`talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1)
- **何を確認する画面か:** 掲載者向け応募通知。通知タブとTASFUL TALKの両方で確認。
- **操作:** 通知タブ（u_job_demo_full）→ 求人フィルター → 該当カード
- **確認ポイント:**
  - タイトル「この求人に応募がありました」
  - TALK側はタイトル＋「確認する」
  - 本文・余計なラベルなし
- **気になった点:** 通知タブも TALK 同様、タイトル＋「確認する」の最小カードに統一済み。
- **改善案:** —

### 05. 応募者確認

![応募者確認](screenshots/platform-manual-review/job/05-applications.png)

- **スクショ:** `screenshots/platform-manual-review/job/05-applications.png`
- **URL:** [`detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications`](http://localhost:5173/detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications)
- **何を確認する画面か:** 通知①の着地。掲載者が応募者を確認する画面。
- **操作:** 「確認する」→ view=applications
- **確認ポイント:**
  - 応募者カード・検索/フィルター/並び替え
  - 応募先求人タイトルが見える
  - 職場イメージ・通常求人詳細は非表示
  - 「やりとりに進む」CTA
- **気になった点:** CTAは「やりとりに進む」に統一。見出しはモバイルヘッダーのみ表示。
- **改善案:** —

### 06. 550円支払い

![550円支払い](screenshots/platform-manual-review/job/06-pay-550.png)

- **スクショ:** `screenshots/platform-manual-review/job/06-pay-550.png`
- **URL:** [`platform-chat-fee-pay.html?thread=chat-1780829119740-5k0w7p&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002`](http://localhost:5173/platform-chat-fee-pay.html?thread=chat-1780829119740-5k0w7p&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002)
- **何を確認する画面か:** やりとり開始前の利用料550円。求人専用の説明・CTA。
- **操作:** 「やりとりに進む」→ 支払い画面
- **確認ポイント:**
  - タイトル「やりとり開始利用料のお支払い」
  - 550円・求人向け説明
  - CTA「550円を支払ってチャットを始める」
  - Connect/5%/Stripe表記なし
- **気になった点:** 特になし（求人向け説明・CTAは整理済み）。
- **改善案:** 支払い対象の応募者名があると、複数応募時の安心感が増す。

### 07. チャット

![チャット](screenshots/platform-manual-review/job/07-chat.png)

- **スクショ:** `screenshots/platform-manual-review/job/07-chat.png`
- **URL:** [`chat-detail.html?thread=chat-1780829119740-5k0w7p`](http://localhost:5173/chat-detail.html?thread=chat-1780829119740-5k0w7p)
- **何を確認する画面か:** 支払い後の求人マッチングチャット。求人カードと初回メッセージ。
- **操作:** 550円支払い完了 → チャット
- **確認ポイント:**
  - 求人応募カード（求人/タイトル/応募者/マッチング成立）
  - deal-detail・開発文言なし
  - アバター・初回メッセージが自然
- **気になった点:** 【ご注意】バナーが上部に常時表示され、カードとの距離は許容範囲。
- **改善案:** 初回のみ注意表示にする等、慣れ後の縦スペース削減を検討。

### 08. 採用通知

![採用通知](screenshots/platform-manual-review/job/08-hired-notify.png)

**TASFUL TALK:** ![採用通知 TALK](screenshots/platform-manual-review/job/08-notify-talk-390.png)

- **スクショ:** `screenshots/platform-manual-review/job/08-hired-notify.png`
- **URL:** [`talk-home.html?tab=notify&userId=u_hiro&talkDev=1`](http://localhost:5173/talk-home.html?tab=notify&userId=u_hiro&talkDev=1)
- **何を確認する画面か:** 応募者向け採用通知。通知タブとTASFUL TALKの両方で確認。
- **操作:** 通知タブ（u_hiro）→ 求人フィルター → 該当カード
- **確認ポイント:**
  - タイトル「採用されました」
  - TALK側はタイトル＋「確認する」
  - hire-result へ遷移する href
- **気になった点:** 求人フィルターは platform_fee 系を除外。レビュー対象は応募・採用の2件のみ。
- **改善案:** —

### 09. 採用結果

![採用結果](screenshots/platform-manual-review/job/09-hired-card.png)

- **スクショ:** `screenshots/platform-manual-review/job/09-hired-card.png`
- **URL:** [`detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications`](http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications)
- **何を確認する画面か:** 通知②の着地。応募者向け採用結果カード。
- **操作:** 「確認する」→ view=hire-result
- **確認ポイント:**
  - 採用結果カード1件
  - 求人タイトル・採用状況が分かる
  - 通常求人詳細は非表示
  - 次アクション（やりとり等）が明確
- **気になった点:** 採用結果画面のバッジは「やりとり開始待ち」または「採用されました」を表示。
- **改善案:** —

---

## URL 一覧（求人）

01. 求人一覧: http://localhost:5173/job-top.html
02. 求人詳細: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
03. 応募: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1
04. 応募通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_job_demo_full&talkDev=1
05. 応募者確認: http://localhost:5173/detail-job.html?id=job_demo_full_001&view=applications&userId=u_job_demo_full&talkDev=1&from=talk#applications
06. 550円支払い: http://localhost:5173/platform-chat-fee-pay.html?thread=chat-1780829119740-5k0w7p&listingId=job_demo_full_001&category=job&applicationId=job-app-demo-002
07. チャット: http://localhost:5173/chat-detail.html?thread=chat-1780829119740-5k0w7p
08. 採用通知: http://localhost:5173/talk-home.html?tab=notify&userId=u_hiro&talkDev=1
09. 採用結果: http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications

## 再現メモ

- `06-pay-550` / `07-chat` の `thread=` は実行時の動的IDです。`05-applications` から「やりとりに進む」→ 支払い → チャットで再現してください。
- 通知タブは `userId` で掲載者/応募者を切替: 応募通知=`u_job_demo_full`、採用通知=`u_hiro`。
- 撮影: `node scripts/capture-platform-job-ui-review-390.mjs`
