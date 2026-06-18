# 求人カテゴリ UI 修正 — 変更サマリー

対象: `job-ui-review.md` の指摘 6 点  
再撮影: `screenshots/platform-manual-review/job/`（01–09 + notify/talk 補助）  
再現: `node scripts/capture-platform-job-ui-review-390.mjs`

---

## 修正前 → 修正後

| # | 指摘 | 修正前 | 修正後 |
|---|------|--------|--------|
| 1 | 通知タブの最小カード | タイトル + 右矢印のみ。「確認する」は sr-only で非表示 | タイトル + **確認する** ボタンをカード内に表示（TASFUL TALK と同型） |
| 2 | 応募者確認 CTA | 表示上「やりとり進む」に見えるケース | **やりとりに進む**（`white-space: nowrap` で省略防止） |
| 3 | 応募者確認見出し | モバイルヘッダー + パネル内 h2 が二重 | `view=applications` / `hire-result` ではパネル内 h2 を非表示、ヘッダーのみ |
| 4 | 採用結果バッジ | 「応募中」のまま | **やりとり開始待ち** / チャット開始済みなら **採用されました** |
| 5 | 求人通知の混在 | チャット開始後に `platform_fee` 通知が求人フィルターに混在 | 手数料通知の filter type を **`platform_fee`** に分離。求人チップはマスター2件のみ |
| 6 | 応募完了フィードバック | 「応募済み」ボタンのみ | 緑の完了メッセージ + トースト文言を具体化 |

---

## 画面別（再スクショ）

| ファイル | 確認ポイント |
|----------|--------------|
| `01-job-list.png` | 求人一覧（変更なし） |
| `02-job-detail.png` | 求人詳細 |
| `03-apply.png` | **応募完了メッセージ** + 応募済み CTA |
| `04-notify.png` | 通知タブ・求人フィルター・**確認する** ボタン |
| `04-notify-talk-390.png` | TASFUL TALK 側（応募通知） |
| `05-applications.png` | **見出し1つ**・**やりとりに進む** |
| `06-pay-550.png` | 550円支払い |
| `07-chat.png` | チャット |
| `08-hired-notify.png` | 採用通知（求人2件のみ） |
| `08-notify-talk-390.png` | TASFUL TALK 側（採用通知） |
| `09-hired-card.png` | **やりとり開始待ち** バッジ |

---

## 変更ファイル一覧

| ファイル | 内容 |
|----------|------|
| `talk-home.js` | 最小プラット通知カードをタイトル+確認するのインラインUIに変更 |
| `talk-home.css` | `.talk-notify-card--minimal-inline` スタイル（モバイルでもボタン表示） |
| `talk-home-data.js` | `platform_fee` 通知を求人フィルターから除外 |
| `talk-platform-fee-notify.js` | 手数料通知の `type: platform_fee` を明示 |
| `job-detail-applications.js` | 採用結果バッジ・応募完了バナー・見出し連携 |
| `detail-job.html` | PC向け応募完了メッセージ要素 |
| `detail-job.css` | 見出し非表示・完了バナー・CTA nowrap |
| `contact-actions.js` | 応募完了トースト文言 |
| `tasful-mobile-detail-template.js` | モバイルヒーロー描画後に完了バナー同期 |
| `scripts/capture-platform-job-ui-review-390.mjs` | 求人フィルター撮影のトグル修正・レビュー文更新 |
| `job-ui-review.md` | 再生成（最新スクショ・URL） |
| `job-ui-fixes.md` | 本ドocument |
