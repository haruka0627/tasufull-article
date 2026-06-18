# Builder 一般案件フロー NGレポート

生成: 自動検証 `verify-builder-general-flow-bench.mjs`

## 結果

**45/45 OK** — partner_user / user_user / vendor_user 全フロー一周完了

## 検証項目（各フロー）

| 診断キー | 内容 |
|---------|------|
| application_notification_created | 応募通知「案件に応募がありました」 |
| chat_started | 掲載者「チャットへ進む」相当（選定通知） |
| thread_created | ops_partner 以外の MVP スレッド生成 |
| message_notification_created | メッセージ通知 |
| attachment_visible | 添付付きメッセージ |
| completion_notification_created | 完了通知 |
| review_notification_created | レビュー依頼通知 |
| review_submitted | レビュー投稿保存 |
| thread_exists_after_complete | 完了後もスレッド保持 |

## 2窓ベンチ URL

- `chat-dual-window-demo.html?benchMode=builder&builderFlow=partner_user`
- `chat-dual-window-demo.html?benchMode=builder&builderFlow=user_user`
- `chat-dual-window-demo.html?benchMode=builder&builderFlow=vendor_user`

## ツールバー操作

1. 案件記事を作成
2. 応募 / 相談（B側または応募者側）
3. 掲載者: チャットへ進む
4. A/B メッセージ（Bは添付付き）
5. 完了
6. レビュー投稿
7. **一周実行** — 上記を自動通し

`copy NG` に一般案件診断が追記されます。

## スクリーンショット

`screenshots/builder-general-flow-bench/`

## 再実行

```bash
node scripts/verify-builder-general-flow-bench.mjs
node scripts/capture-builder-general-flow-bench.mjs
```
