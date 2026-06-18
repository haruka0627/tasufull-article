# TASFUL TALK — Supabase 同期

## セットアップ

ステージング一括適用:

```bash
node scripts/apply-talk-staging-supabase.mjs
```

手動の場合:

1. `sql/talk-sync-schema.sql`
2. `sql/talk-follow-subscriptions.sql`
3. `sql/talk-broadcast-drafts-send.sql`
4. `sql/talk-realtime-publication.sql`
5. 本番前: `sql/talk-rls-production.sql` + dev ポリシー削除

3. `chat-supabase-config.js` の Project URL / anon key が正しいこと

## 動作

| データ | localStorage キー | DB テーブル |
|--------|-------------------|-------------|
| AI 下書き | `tasful_talk_ai_drafts` | `talk_ai_drafts` |
| 配信下書き | `tasful_talk_broadcast_drafts` | `talk_broadcast_drafts` |
| 通知 | `tasful_talk_notifications` | `talk_notifications` |
| フォロー | `tasful_talk_follow_store` | `talk_follow_subscriptions` |

- `talk-supabase-sync.js` が pull / upsert / delete / Realtime / オフラインキュー（`tasful_talk_sync_pending_v1`）を担当
- `user_id` は `TasuChatUserIdentity.getEffectiveUserId()`（URL `?userId=` または config）
- 接続不可・`file:` プロトコル時は localStorage のみ（UI は落ちない）
- 他画面（`detail-job.html` 等）で追加した通知は local に保存。`talk-home.html` 表示時に DB へ reconcile

## テスト

```bash
npx serve -l 8765
node scripts/test-talk-supabase-sync-browser.mjs
node scripts/test-talk-broadcast-drafts-browser.mjs
node scripts/test-talk-follow-notify-browser.mjs
node scripts/test-talk-category-phase13-browser.mjs
```

DB 同期まで厳密に見る場合:

```bash
SUPABASE_STRICT=1 node scripts/test-talk-all-browser.mjs
node scripts/verify-talk-rls-staging.mjs
node scripts/test-talk-staging-multiuser-browser.mjs
```
