# chat-detail 取引アクションボタン — 390px レイアウト（Gemini修正）

## 原因

`.chat-complete-btn` に `.chat-review-notify-banner` 用の `display: grid` が誤結合され、
390px で `flex-wrap` + `min-width: 0` + `flex-shrink` によりボタン幅が潰れ、
1文字ずつ縦折返しが発生していました。

## 修正ファイル

- `chat.css` — ボタン/バナー分離、390px 縦積みレイアウト
- `chat-detail.js` — 取引ステータス別アクション出し分け

## 状態別表示ロジック

| フェーズ | 表示 | 非表示 |
|---------|------|--------|
| review_pending | レビューCTA 1つ（バナー or インライン） | 取引管理ボタン一式 |
| in_progress | 取引完了・キャンセル申請（必要時 やりとり完了を承認） | レビュー系CTA |
| completion_approval_pending | やりとり完了を承認 | 取引完了・キャンセル・レビュー |
| cancel_respond_pending | 承認する / 却下する | 取引完了・キャンセル・レビュー |
| review_done | レビュー済み表示のみ | 全アクション |

## 修正内容

- `.chat-complete-btn` を `inline-flex` + `white-space: nowrap` + `flex-shrink: 0` に復元
- 390px: `.chat-room-status-row__actions` を `flex-direction: column`（縦積み）
- 全ボタン `width: 100%` / `min-height: 44px`
- 承認する/却下する のみ2列 grid
- レビュー通知バナー幅・CTA を390px向けに維持

実施: 2026-06-12T16:01:22.216Z

| 種別 | 結果 | スクショ |
|------|------|----------|
| 求人チャット | PASS | `screenshots/chat-action-buttons-390/job-mobile390.png` |
| 案件チャット | PASS | `screenshots/chat-action-buttons-390/project-mobile390.png` |
| 取引チャット | PASS | `screenshots/chat-action-buttons-390/trade-mobile390.png` |
| 複数アクション（全ボタン表示） | PASS | `screenshots/chat-action-buttons-390/multi-actions-mobile390.png` |
| レビュー通知 → レビュー専用画面 | PASS | `screenshots/chat-action-buttons-390/job-review-notify-mobile390.png` |

## 検証コマンド

```bash
node scripts/capture-chat-action-buttons-390.mjs
node scripts/capture-talk-notify-flow-review.mjs --gemini-a
```

**全体: PASS**
