# 安否 Supabase 本番移行チェックリスト（P9-5）

ステージング / 本番に安否（Anpi）の Supabase 永続化と RLS を適用する際の確認項目です。

## 1. SQL 適用順序

SQL Editor で **この順序** に実行してください。

| 順 | ファイル | 内容 |
|----|----------|------|
| 1 | `sql/anpi-user-context.sql` | `anpi_user_contexts` テーブル・開発用 RLS |
| 2 | `sql/anpi-notification-logs.sql` | `anpi_notification_logs` テーブル・開発用 RLS |
| 3 | `sql/anpi-identity-linking.sql` | `member_id` / `anpi_user_id` 等のカラム・インデックス |
| 4 | `sql/anpi-rls-production.sql` | 本番 RLS ヘルパー関数・`*_prod` ポリシー |
| 5 | **`sql/anpi-rls-drop-dev-policies.sql`** | **開発用 `*_dev` 全削除（RLS 検証前に必須）** |

適用後、ステージング確認用に `sql/anpi-rls-staging-verify.sql` を実行し、結果を目視確認してください。

**重要:** 手順 5 を省略すると `*_dev` の `using (true)` が `*_prod` と OR 結合され、anon 挿入・他人参照が通ってしまいます。

## 2. 開発用ポリシー削除（本番のみ必須）

`anpi_*_dev` ポリシーが **1 つでも残っていると** `using (true)` が OR 結合され、本番 RLS が実質無効になります。

本番 / ステージング（RLS 検証時）では以下を **すべて DROP** してください。

### anpi_user_contexts

- `anpi_user_contexts_select_dev`
- `anpi_user_contexts_insert_dev`
- `anpi_user_contexts_update_dev`
- `anpi_user_contexts_delete_dev`

### anpi_notification_logs

- `anpi_notification_logs_select_dev`
- `anpi_notification_logs_insert_dev`
- `anpi_notification_logs_update_dev`
- `anpi_notification_logs_delete_dev`

`sql/anpi-rls-production.sql` 末尾のコメントアウトを外して実行しても構いません。

## 3. 本番ポリシー（authenticated）の確認

以下が存在すること（`sql/anpi-rls-staging-verify.sql` 参照）。

### anpi_user_contexts

- `anpi_user_contexts_select_prod`
- `anpi_user_contexts_insert_prod`
- `anpi_user_contexts_update_prod`
- `anpi_user_contexts_delete_prod`

### anpi_notification_logs

- `anpi_notification_logs_select_prod`
- `anpi_notification_logs_insert_prod`
- `anpi_notification_logs_update_prod`
- `anpi_notification_logs_delete_prod`

## 4. JWT / 認証

| 項目 | 確認 |
|------|------|
| JWT に `member_id` クレーム | ログイン会員 ID と DB 行の `member_id` が一致 |
| 代替 | `sub` または `auth.uid()` が会員 ID と一致する設計なら可 |
| `authenticated` ロール | ブラウザは Supabase Auth セッション付き anon キーで API 呼び出し |
| 管理者 | `app_metadata.role = tasu_admin`（または JWT `role = tasu_admin`） |

## 5. 動作確認（必須）

| シナリオ | 期待結果 |
|----------|----------|
| anon / 未認証 | `insert` / `select` が拒否（RLS） |
| authenticated 本人 | 自分の context / logs の CRUD 可能 |
| authenticated 他人 | 他人の行は `select` / `update` / `delete` 不可 |
| 契約者 | `contract_holder_id` が自分の logs を参照可能 |
| 管理者 JWT | 全件 `select` / `update` 可能 |

自動検証:

```bash
# 環境変数を設定したうえで（下記参照）
node scripts/verify-anpi-rls-real-db.mjs
```

## 6. ブラウザ / クライアント

| 項目 | 確認 |
|------|------|
| 未ログイン | Supabase upsert を **実行しない**（localStorage のみ） |
| 未ログイン | 管理画面に「DB同期停止」系の表示 |
| RLS 拒否 | 赤いアラート・`tasu:anpi-rls-unauthorized` |
| 管理者 UI フラグ | `?anpi_admin=1` は **UI のみ**。DB 全件は JWT `tasu_admin` |

E2E（モック不要）:

```bash
node scripts/test-anpi-rls-production-browser.mjs
```

## 7. 環境変数（実 DB RLS 検証）

`scripts/verify-anpi-rls-real-db.mjs` 用:

| 変数 | 説明 |
|------|------|
| `SUPABASE_URL` | プロジェクト URL |
| `SUPABASE_ANON_KEY` | anon public キー |
| `ANPI_RLS_USER_A_JWT` | 会員 A の access JWT |
| `ANPI_RLS_USER_B_JWT` | 会員 B の access JWT |
| `ANPI_RLS_ADMIN_JWT` | 管理者の access JWT |

いずれか不足時はスクリプトが **明示的に終了** します（skip しません）。

### JWT の取得（未実装ではなく手順は別ドキュメント）

リポジトリ内に **専用テストユーザー A/B/Admin の自動作成は含まれません**。  
ステージングで次のいずれかを行い、上記 3 JWT を `.env` に設定してください。

**推奨（自動）**

```bash
# .env に SUPABASE_SERVICE_ROLE_KEY を追加
node scripts/issue-anpi-rls-jwt.mjs
# または
node scripts/issue-anpi-rls-jwt.mjs --write-env
node scripts/verify-anpi-rls-real-db.mjs
```

**手動** — Dashboard で Auth ユーザーを 3 名作成し、`app_metadata.member_id`（Admin は `role: tasu_admin`）を設定 → パスワードログインで `access_token` を取得。

詳細: **[docs/anpi-rls-jwt-setup.md](./anpi-rls-jwt-setup.md)**

| テスト主体 | JWT クレーム要件 |
|------------|------------------|
| User A / B | `app_metadata.member_id` が互いに異なる（例: `anpi_rls_member_a` / `anpi_rls_member_b`） |
| Admin | 上記に加え `app_metadata.role` = `tasu_admin` |

JWT は有効期限付きです。検証失敗時は `issue-anpi-rls-jwt.mjs` で再発行してください。

## 8. 本番リリース前最終確認

- [ ] SQL 1〜5 適用済み（**5 = drop-dev 必須**）
- [ ] dev ポリシー 0 件（`anpi-rls-staging-verify.sql` セクション 3）
- [ ] `anpi_is_admin()` 再適用済み（`anpi-rls-production.sql` 内 OR 判定）
- [ ] `verify-anpi-rls-real-db.mjs` 全項目 OK
- [ ] 登録 → 再読込 → localStorage クリア → 復元（本人 JWT）
- [ ] 他人データが UI / API に露出しない
- [ ] `node scripts/test-anpi-all.mjs` 成功

## 関連ファイル

- `sql/anpi-rls-staging-verify.sql` — ポリシー・カラム・関数の一覧確認
- `sql/anpi-rls-drop-dev-policies.sql` — 開発用ポリシー削除（実 DB 検証前）
- `scripts/verify-anpi-rls-real-db.mjs` — 実 Supabase RLS 自動検証
- `scripts/test-anpi-rls-production-browser.mjs` — ブラウザ側ガード E2E
