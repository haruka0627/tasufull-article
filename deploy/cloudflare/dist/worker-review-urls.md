# ワーカーカテゴリ — review=worker 専用レビューURL

`review=worker` 指定時は、**ワーカーデモ通知3件のみ**を通知タブ・TASFUL TALK 公式ルームに表示します。  
求人・platform_fee 汎用・他カテゴリ通知は表示しません。

## 対象通知

| # | タイトル | 通知ID | 確認する → |
|---|----------|--------|------------|
| 1 | 依頼が届きました | `platform-verify-worker-request-001` | 手数料支払い画面 |
| 2 | 依頼を受諾しました | `platform-verify-worker-accept-001` | 手数料支払い画面 |
| 3 | 取引が完了しました | `platform-verify-worker-connect-complete-001` | やりとりチャット（完了報告カード） |

カード形式:

```
ワーカー（チップ）
↓ 依頼タイトル
↓ 通知内容
↓ 補足（依頼者：ひろ）
↓ 日時
↓ 確認する
```

---

## レビュー用 URL（ローカル dev）

前提: `npm run dev` → http://localhost:5173

### 通知タブ（ワーカー3件のみ）

http://localhost:5173/talk-home.html?tab=notify&review=worker&talkDev=1

掲載者（ワーカー）視点で確認する場合:

http://localhost:5173/talk-home.html?tab=notify&review=worker&talkDev=1&userId=u_worker

### TASFUL TALK 公式ルーム（ワーカー3件のみ）

http://localhost:5173/talk-home.html?tab=chat&thread=official_tasful&review=worker&talkDev=1

---

## 導線確認用 URL

### 依頼通知 → 前払い支払い

http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-fee-001&listingId=demo-worker-001&category=worker&notify=platform-verify-worker-request-001&userId=u_worker&talkDev=1&from=talk

### 支払い後チャット

http://localhost:5173/chat-detail.html?thread=chat-demo-worker-fee-001&userId=u_worker&talkDev=1&from=talk

### ワーカー詳細（依頼者視点）

http://localhost:5173/detail-worker.html?id=demo-worker-001&userId=u_hiro&talkDev=1

### 完了通知 → チャット（完了報告カード）

http://localhost:5173/chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk

### 完了後手数料（5% / 最低550円）

完了報告を承認後:

http://localhost:5173/platform-chat-fee-pay.html?thread=chat-demo-worker-deal-001&listingId=demo-worker-001&category=worker&deal=worker_deal_demo_001&phase=complete&userId=u_worker&talkDev=1&from=talk

---

## 390px スクショ

`screenshots/platform-worker-review-mode/`

| ファイル | 内容 |
|----------|------|
| `01-notify-tab-worker-review-390.png` | 通知タブ・ワーカー3件 |
| `02-talk-official-worker-review-390.png` | TASFUL TALK 公式ルーム・ワーカー3件 |
| `03-request-notify-to-fee-pay-390.png` | 依頼通知 → 支払い画面 |
| `04-chat-after-pay-390.png` | 支払い後チャット |
| `05-content-card-390.png` | 依頼内容カード |
| `06-complete-notify-390.png` | 完了通知 |
| `07-complete-notify-to-completion-card-390.png` | 完了通知 → 完了報告カード |
| `08-fee-after-complete-390.png` | 完了後手数料画面 |

再撮影:

```bash
node scripts/capture-worker-review-mode-390.mjs
```

---

## UI確認チェックリスト

1. 何の依頼か分かるか（依頼タイトルが先頭付近）
2. 誰からの依頼か分かるか（依頼者：）
3. 支払い画面で何の料金か分かるか
4. チャット内カードが分かりやすいか
5. 完了カードの意味が分かるか
6. 5% / 最低550円が自然に見えるか
7. 390pxで崩れていないか
8. 下部タブバーと入力欄が干渉していないか
9. 「—」表示が残っていないか
10. 開発文言が残っていないか

---

## 変更ファイル

| ファイル | 内容 |
|----------|------|
| `talk-worker-review-mode.js` | **新規** — `review=worker` 判定・フィルタ・TALK同期 |
| `talk-home.html` | スクリプト読込 |
| `talk-home-data.js` | 通知一覧をワーカー3件に絞込 |
| `talk-official-rooms.js` | 公式ルームメッセージ / 一覧を絞込 |
| `talk-home.js` | チャット一覧・サマリー・ワーカー通知カード対応 |
| `talk-home.css` | レビューモード時 UI 簡素化 |
| `talk-platform-notify-master-v1.js` | ワーカー3件に notify 詳細フィールド追加（v3.6） |
| `scripts/capture-worker-review-mode-390.mjs` | **新規** — 390px スクショ |
| `worker-review-urls.md` | 本ドキュメント |
