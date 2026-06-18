# 求人 end-to-end — 実機確認URL（修正後）

前提: `npm run dev` → **http://192.168.3.3:5173**（PC IP に読み替え）

リセット:
- 応募前: `&jobFullFresh=1`
- デモ再シード: `&jobFullReset=1`

---

## 修正サマリー（2026-06-07）

| 優先 | 内容 |
|:---:|------|
| ① | チャット未作成時もエラー画面にせず「応募状況へ戻る」等の導線を表示 |
| ② | `roomId` 表示を廃止。利用者向け文言に変更 |
| ③ | `review=job-full` 時は `hire-result` 旧UIを無効化・リダイレクト |
| ④ | 取引完了後は即レビュー遷移せず、完了カード＋通知（完了→レビュー依頼） |
| ⑤ | 完了通知の着地を `job-completion.html` に変更（案件名・相手・日時・レビューボタン） |

---

## 固定URL一覧

| 用途 | URL |
|------|-----|
| 通知タブ（5件） | `/talk-home.html?tab=notify&review=job-full&talkDev=1` |
| TASFUL TALK（5件） | `/talk-home.html?tab=chat&thread=official_tasful&review=job-full&talkDev=1` |
| やりとりチャット | `/chat-detail.html?thread=chat-demo-job-full-001&review=job-full&talkDev=1` |
| **完了通知着地** | `/job-completion.html?thread=chat-demo-job-full-001&review=job-full&talkDev=1` |
| 評価レビュー | `/job-review.html?thread=chat-demo-job-full-001&review=job-full&talkDev=1` |

---

## 実機ステップ表

`BASE` = `http://192.168.3.3:5173`

| # | 画面 | 開始URL | 操作 | 遷移先 | 通知 | スクショ | 確認 |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| 0 | 初期化 | `{BASE}/talk-home.html?jobFullFresh=1&talkDev=1` | 開く | — | — | — | ひろの応募がリセット |
| 1 | 求人詳細 | `{BASE}/detail-job.html?id=job_demo_full_001&userId=u_hiro&talkDev=1&jobFullFresh=1` | 確認 | 同左 | — | `01-job-detail-390.png` | 応募ボタン表示 |
| 2 | 応募完了 | 上 | 応募する | 同左 | — | `02-apply-complete-390.png` | 完了表示 |
| 3 | 応募通知 | `{BASE}/talk-home.html?tab=notify&review=job-full&userId=u_job_demo_full&talkDev=1` | 確認する | 応募者確認 | この求人に応募がありました | `03-apply-notify-390.png` | 5件のみ |
| 4 | 応募者確認 | 遷移先 | 確認 | 同左 | — | `04-applications-390.png` | やりとりに進む |
| 5 | 550円支払い | やりとりに進む | 確認 | fee-pay | — | `05-fee-pay-550-390.png` | ¥550のみ |
| 6 | 支払い完了 | 上 | Stripeで支払う | チャット | — | `06-fee-pay-complete-390.png` | チャット作成 |
| 7 | チャット | `{BASE}/chat-detail.html?thread=chat-demo-job-full-001&userId=u_job_demo_full&review=job-full&talkDev=1` | 確認 | 同左 | — | `07-chat-after-pay-390.png` | 開始カード |
| 8 | 開始通知 | `{BASE}/talk-home.html?tab=notify&review=job-full&userId=u_hiro&talkDev=1` | 確認する | チャット | 掲載者とのやりとりを開始してください | `08-chat-start-notify-390.png` | **エラーにならない** |
| 9 | 通知→チャット | 遷移先 | 確認 | 同左 | — | `09-notify-to-chat-390.png` | 着地OK |
| 10 | 開始カード | 同左 | 確認 | 同左 | — | `10-chat-start-card-390.png` | カード表示 |
| 11 | メッセージ | 同左 | 送信 | 同左 | — | `11-message-sent-390.png` | 吹き出し |
| 12 | 取引完了 | 同左（u_hiro） | 取引完了 | 同左＋トースト | — | — | 「通知タブからレビュー」表示 |
| 13 | 完了通知 | `{BASE}/talk-home.html?tab=notify&review=job-full&userId=u_hiro&talkDev=1` | 確認する | 完了ページ | やりとりが完了しました | `12-complete-notify-390.png` | 通知到達 |
| 14 | 完了ページ | 遷移先 | 確認 | 同左 | — | `13-completion-landing-390.png` | 案件名・相手・日時・レビューする |
| 15 | 完了カード | チャットを見る | 確認 | チャット | — | `14-completion-card-390.png` | カード表示 |
| 16 | レビュー | レビューする | 入力 | job-review | 評価をお願いします | `15-review-page-390.png` | レビュー画面 |
| 17 | 送信後 | 評価を送る | 送信 | 完了表示 | — | `16-review-submitted-390.png` | 終了メッセージ |
| 18 | 終了 | `{BASE}/talk-home.html?tab=chat&thread=official_tasful&review=job-full&userId=u_hiro&talkDev=1` | 確認 | 同左 | — | `17-flow-ended-390.png` | 戻れる |

### チャット未作成時（①②）

支払い前に「やりとり開始」通知から開いた場合:

- **NG**: `roomId: chat-demo-job-full-001` 表示
- **OK**: 「やりとりを開始できませんでした」＋ **[応募状況へ戻る]** / 通知へ / TALKへ

---

## 390px スクショ

`screenshots/platform-job-full-flow/`（17枚）

```bash
node scripts/capture-job-full-flow-390.mjs
```

---

## 修正ファイル

| ファイル | 変更 |
|----------|------|
| `chat-detail.js` | 未作成時UI・自動シード・取引完了後トースト |
| `platform-chat-job-flow.js` | 復帰URL・完了ページURL・シード helpers |
| `job-completion.html` / `job-completion.js` | **新規** 完了通知着地 |
| `talk-platform-notify.js` | 完了通知→job-completion |
| `talk-notify-actions.js` | 完了通知ルーティング |
| `talk-platform-notify-master-v1.js` | 完了通知 href 更新 |
| `job-detail-applications.js` | job-full 時 hire-result 無効 |
| `detail-job.html` | hire-result → applications リダイレクト |
| `talk-job-review-mode.js` | job-full 時は旧 review=job 無効 |
| `chat.css` | チャット未作成パネル样式 |

---

## 実機確認結果（自動検証）

- [x] `review=job-full` 通知5件フィルタ
- [x] チャット未作成時に roomId 非表示・応募状況へ戻る
- [x] やりとり開始通知 → チャット着地（デモシード）
- [x] 取引完了 → 完了カード + トースト（即レビュー遷移なし）
- [x] 完了通知 → job-completion（案件名・相手・日時・レビューする）
- [x] レビュー通知 → job-review
- [x] 390px スクショ17枚生成
