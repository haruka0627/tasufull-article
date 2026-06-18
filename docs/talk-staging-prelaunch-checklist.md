# TASFUL TALK — ステージング / 本番公開チェックリスト

## 1. SQL 適用順

### ステージング MVP（初回）

```bash
node scripts/apply-talk-staging-supabase.mjs
```

手動の場合（この順で実行）:

1. `sql/talk-sync-schema.sql`
2. `sql/talk-follow-subscriptions.sql`
3. `sql/talk-broadcast-drafts-send.sql`
4. `sql/talk-realtime-publication.sql`

### 本番公開（RLS）

```bash
node scripts/apply-talk-production-supabase.mjs
```

手動の場合:

1. `sql/talk-rls-production.sql` — 本番ポリシー（authenticated + JWT `talk_user_id`）
2. `sql/talk-rls-drop-dev-policies.sql` — `*_dev` / `using(true)` を削除

**注意**: 本番 RLS 適用後はクライアントが **Supabase Auth JWT** 必須。`?userId=` は `talkDev=1` / localhost のみ。

## 2. dev ポリシー削除

本番前に以下が **0 件** であること:

- `talk_notifications_dev`
- `talk_ai_drafts_dev`
- `talk_broadcast_drafts_dev`
- `talk_follow_subscriptions_dev`

```bash
node scripts/verify-talk-rls-staging.mjs
```

出力の `dev policies remaining: 0` を確認。

## 3. production RLS

| テーブル | 条件 |
|----------|------|
| `talk_notifications` | `user_id = talk_current_user_id()` のみ CRUD。admin は `insert_admin_fanout` で他ユーザーへ INSERT のみ |
| `talk_ai_drafts` | 自分の `user_id` のみ read/write |
| `talk_broadcast_drafts` | 自分の read/write + admin は全件 read/update |
| `talk_follow_subscriptions` | 自分の `user_id` のみ read/write |

anon キーでは他ユーザー行を読めない（authenticated ポリシーのみ）。

## 4. Realtime publication

`supabase_realtime` に含まれること:

- `talk_notifications`
- `talk_ai_drafts`
- `talk_broadcast_drafts`
- `talk_follow_subscriptions`

## 5. JWT / 認証

- Auth ユーザーの JWT に `talk_user_id`（例: `u_me`）を載せる  
  - 推奨: `app_metadata.talk_user_id` または SQL `talk_current_user_id()` が参照する claim
- 本番: `TasuChatUserIdentity.getEffectiveUserId()` はセッション / JWT 優先
- `?userId=` は **無視**（コンソール警告）。開発のみ `?talkDev=1` または `talkDevMode`

テスト用ユーザー（RLS 検証スクリプトが自動作成）:

- `talk-rls-a@tasful-dev.test` → `u_me`
- `talk-rls-b@tasful-dev.test` → `u_store`
- `talk-rls-admin@tasful-dev.test` → `u_admin` + `tasu_admin`

## 6. 管理者一斉配信（Edge Function）

本番では **クライアント anon からの direct fanout 禁止**。

- クライアント: `broadcast_draft_id` を Edge Function に POST のみ
- Edge: admin 判定 → `service_role` で fanout → `sendHistory` / `sentAt` 更新
- 未設定時: UI に「本番配信は未設定」（`production_edge_required`）

設定（任意）:

- `chat-supabase-config.js`: `talkBroadcastEdgeUrl` または `talkBroadcastEdgeFunction`

## 7. CI（本番必須）

静的サーバー起動:

```bash
npx serve -l 8765
```

```bash
node scripts/verify-talk-rls-staging.mjs
SUPABASE_STRICT=1 node scripts/test-talk-supabase-sync-browser.mjs
node scripts/test-talk-staging-multiuser-browser.mjs
```

一括（STRICT 時は上記2本も必須）:

```bash
SUPABASE_STRICT=1 node scripts/test-talk-all-browser.mjs
```

ブラウザテストは `?talkDev=1` + `talkDevMode` で multi-user / sync を分離。

## 8. 手動確認 URL

| URL | 確認 |
|-----|------|
| `/talk-home.html` | ホーム・タブ |
| `/talk-home.html?tab=chat` | チャットハブ |
| `/talk-home.html?tab=notify` | 通知 |
| `/talk-home.html?tab=ai` | AI |
| `/dashboard.html` | TALK パネル |
| `/chat-list.html` | 一覧 |
| `/anpi-dashboard.html` | 安否連携 |
| `/builder/index.html` | Builder（案件チャット本体は対象外） |

ビューポート: **PC 1280** / **tablet 768** / **SP 390**

開発用 multi-user（本番ホストでは不可）:

- `?talkDev=1&userId=u_me` 等

## 9. Rollback

1. 緊急時のみ dev ポリシーを再適用しない（セキュリティ後退）
2. 本番 RLS を戻す場合: ステージング用 `talk-rls-dev` があれば適用、または Dashboard でポリシー無効化 + メンテナンス表示
3. クライアント: `talkProductionMode: false` は本番 CDN では設定しない
4. Edge Function 配信を止める場合: `talkBroadcastEdgeUrl` を空にし UI ガードのみ残す

## 10. 公開判定

| 項目 | 必須 |
|------|------|
| production RLS + dev 0 | ✓ |
| `verify-talk-rls-staging.mjs` PASS | ✓ |
| 必須 CI 3本 PASS | ✓ |
| JWT 本番ユーザー claim 設定 | ✓ |
| Edge Function 配信（一斉配信を使う場合） | 運用判断 |

一斉配信を本番で使わない場合は Edge 未設定でも **通知・AI・フォローのみ** なら公開可（配信ボタンは「未設定」表示）。
