# 求人カテゴリ — review=job 専用レビューURL

`review=job` 指定時は、**求人デモ通知2件のみ**を通知タブ・TASFUL TALK 公式ルームに表示します。  
platform_fee 系・他カテゴリ通知は表示しません。

## 対象通知

| # | タイトル | 通知ID | 確認する → |
|---|----------|--------|------------|
| 1 | この求人に応募がありました | `platform-verify-job-apply-001` | 応募者確認（`view=applications`） |
| 2 | 採用されました | `platform-verify-job-hired-001` | 採用結果（`view=hire-result`） |

カード形式: **タイトル + 確認する** のみ

---

## レビュー用 URL（ローカル dev）

前提: `npm run dev` → http://localhost:5173

### 通知タブ（求人2件のみ）

http://localhost:5173/talk-home.html?tab=notify&review=job&talkDev=1

### TASFUL TALK 公式ルーム（求人2件のみ）

http://localhost:5173/talk-home.html?tab=chat&thread=official_tasful&review=job&talkDev=1

### 導線着地（直接確認用）

**応募通知 → 応募者確認**

http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&view=applications&from=talk#applications

**採用通知 → 採用結果**

http://localhost:5173/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&view=hire-result&applicationId=job-app-demo-001&from=talk#applications

---

## 390px スクショ

`screenshots/platform-job-review-mode/`

| ファイル | 内容 |
|----------|------|
| `01-notify-tab-job-review-390.png` | 通知タブ・求人2件 |
| `02-talk-official-job-review-390.png` | TASFUL TALK 公式ルーム・求人2件 |
| `03-apply-notify-to-applications-390.png` | 応募通知 → 応募者確認 |
| `04-hired-notify-to-hire-result-390.png` | 採用通知 → 採用結果 |

再撮影:

```bash
node scripts/capture-job-review-mode-390.mjs
```

---

## 確認チェックリスト

1. 通知タブで求人通知2件だけ表示される
2. TASFUL TALK で求人通知2件だけ表示される
3. どちらも「タイトル + 確認する」だけ
4. 応募通知は応募者確認カードへ飛ぶ
5. 採用通知は採用結果カードへ飛ぶ
6. platform_fee 系通知が混ざらない
7. 他カテゴリ通知が混ざらない

---

## 変更ファイル

| ファイル | 内容 |
|----------|------|
| `talk-job-review-mode.js` | **新規** — `review=job` 判定・フィルタ・TALK同期 |
| `talk-home.html` | スクリプト読込 |
| `talk-home-data.js` | 通知一覧を求人2件に絞込 |
| `talk-official-rooms.js` | 公式ルームメッセージ / 一覧を絞込 |
| `talk-home.js` | チャット一覧・サマリー文言 |
| `talk-home.css` | レビューモード時 UI 簡素化 |
| `scripts/capture-job-review-mode-390.mjs` | **新規** — 390px スクショ |
| `job-review-urls.md` | 本ドキュメント |
