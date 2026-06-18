# 安否 RLS 実 DB 検証 — JWT 取得手順（P9-5 / P10）

`scripts/verify-anpi-rls-real-db.mjs` は **Supabase Auth の access JWT（3 本）** が必須です。  
ブラウザ E2E（`test-anpi-rls-production-browser.mjs`）はモック／localStorage 中心のため、**JWT 発行は含まれません**。

## 前提

| 項目 | 内容 |
|------|------|
| SQL | `anpi-rls-production.sql` 適用済み、本番検証時は `*_dev` ポリシー DROP 済み |
| ID 列 | `sql/anpi-identity-linking.sql` 適用済み（`member_id` 等） |
| JWT | `authenticated` ロール。RLS は `member_id`（または `sub`）で本人判定 |
| 管理者 | JWT の `app_metadata.role` = `tasu_admin`（`anpi_is_admin()`） |

## テストユーザー（推奨デフォルト）

スクリプト `scripts/issue-anpi-rls-jwt.mjs` が使う既定アカウントです。  
**ステージング専用**のメール／パスワードにしてください（本番の実会員メールは使わない）。

| 用途 | 環境変数プレフィックス | 既定メール | 既定 `member_id` |
|------|------------------------|------------|------------------|
| User A | `ANPI_RLS_USER_A_*` | `anpi-rls-a@tasful-dev.test` | `anpi_rls_member_a` |
| User B | `ANPI_RLS_USER_B_*` | `anpi-rls-b@tasful-dev.test` | `anpi_rls_member_b` |
| Admin | `ANPI_RLS_ADMIN_*` | `anpi-rls-admin@tasful-dev.test` | `anpi_rls_admin`（+ `role: tasu_admin`） |

User A / B は **互いに異なる `member_id`** である必要があります。Admin は全件参照用です。

## 方法 A — 自動（推奨）

### 1. Service Role を用意

Supabase Dashboard → **Settings → API → service_role**（`sb_secret_...` または `eyJ...`）。  
**リポジトリにコミットしない。** `.env` のみに置く。

### 2. `.env` に最低限以下を設定

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...   # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role（JWT 発行スクリプトのみ）
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` は未設定時、`chat-supabase-config.js` から読み取ります。

### 3. JWT を発行

```bash
node scripts/issue-anpi-rls-jwt.mjs
```

成功すると `.env` に追記する行が表示されます。`.env` に貼り付けたうえで:

```bash
node scripts/verify-anpi-rls-real-db.mjs
```

`--write-env` で既存 `.env` の 3 変数だけ上書き更新もできます（他のキーは触りません）。

```bash
node scripts/issue-anpi-rls-jwt.mjs --write-env
```

### 4. カスタムアカウント

```env
ANPI_RLS_USER_A_EMAIL=...
ANPI_RLS_USER_A_PASSWORD=...
ANPI_RLS_USER_A_MEMBER_ID=anpi_rls_member_a

ANPI_RLS_USER_B_EMAIL=...
ANPI_RLS_USER_B_PASSWORD=...
ANPI_RLS_USER_B_MEMBER_ID=anpi_rls_member_b

ANPI_RLS_ADMIN_EMAIL=...
ANPI_RLS_ADMIN_PASSWORD=...
ANPI_RLS_ADMIN_MEMBER_ID=anpi_rls_admin
```

## 方法 B — 手動（Dashboard + ログイン）

### User A / User B

1. Dashboard → **Authentication → Users → Add user**
2. Email / Password を設定し、**Auto Confirm User** をオン
3. ユーザーを開き **Raw App Meta Data** に例:

   ```json
   { "member_id": "anpi_rls_member_a" }
   ```

   User B は `anpi_rls_member_b` など **別 ID**。

4. ローカルで `login.html` からログインするか、次の curl でトークン取得:

   ```bash
   curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"anpi-rls-a@tasful-dev.test\",\"password\":\"YOUR_PASSWORD\"}"
   ```

5. レスポンスの `access_token` を `.env` の `ANPI_RLS_USER_A_JWT` に設定（有効期限あり。切れたら再取得）

### Admin

1. 上と同様にユーザーを作成
2. **Raw App Meta Data**:

   ```json
   { "member_id": "anpi_rls_admin", "role": "tasu_admin" }
   ```

3. ログインして `access_token` → `ANPI_RLS_ADMIN_JWT`

## JWT の中身を確認

```bash
node -e "const p=JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url'));console.log(p)" YOUR_ACCESS_TOKEN
```

確認項目:

- `role` = `authenticated`
- `app_metadata.member_id`（または `user_metadata.member_id`）が期待どおり
- Admin は `app_metadata.role` = `tasu_admin`
- User A / B で `member_id` が **一致していない**

`verify-anpi-rls-real-db.mjs` は先頭で `JWT member_id 解決` を表示します。失敗時はトークン期限切れまたは metadata 未設定です。

## トラブルシュート

| 症状 | 対処 |
|------|------|
| 環境変数不足で exit 2 | `.env` に 3 JWT + URL/anon を設定 |
| `JWT member_id 解決` 失敗 | App Metadata に `member_id` を入れて再ログイン |
| 全テストが anon 扱い | 期限切れ JWT。再発行 |
| insert は通るが他人が見える | `*_dev` ポリシー残存 → DROP |
| Admin が他人行を見れない | `app_metadata.role` = `tasu_admin` を確認 |

## 関連

- `docs/anpi-supabase-production-checklist.md` — SQL 順序・RLS 確認一覧
- `scripts/verify-anpi-rls-real-db.mjs` — 実 DB RLS 自動検証
- `scripts/issue-anpi-rls-jwt.mjs` — JWT 自動発行
