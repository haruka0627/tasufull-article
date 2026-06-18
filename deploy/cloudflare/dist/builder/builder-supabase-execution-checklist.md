# Builder Supabase 実行前 最終確認チェック（メモ）

**重要: このファイルは実行手順メモです。まだSQL実行しないでください。**
**重要: Supabase接続・Edge Function deploy・migration実行もまだしないでください。**
実行前に人間が確認してから進める前提です。

## 最上部: SQL実行前の必須確認（人間チェック）
- **Supabase project ID**
- **実行環境**: dev / staging / production
- **SQLを入れる順番**: schema → RLS → Storage
- **JWT claims の最終仕様**
  - `actor_id`
  - `actor_type`
  - `partner_id`
  - `owner_id`
- **partner_id が `builder_partners.id (uuid)` と一致**しているか
- **owner_id が `builder_projects.owner_id (text)` と一致**しているか
- helper function のJWT取得方式が **`auth.jwt()` か `current_setting` か**（未確定ならRLS SQLは入れない）
- RPC `builder_can_read_project(p_project_id)` の **関数名/引数名**
- Storage path 先頭が **uuid project_id** であること（`split_part(... )::uuid` 前提）
- bucket は **private**
- **selected_partner_ids は本番では使わない**（正は applications.status='selected'）

## 0. 対象のSupabase環境
- **Supabase project ID**: `______________`
- **実行環境**: `dev / staging / production`（どれ？）: `______________`
- **実行者**: `______________`
- **実行日時（予定）**: `______________`

## 1. SQL投入順（案）
> RLSを入れる前に migration/seed の方針を確定すること。

1. `sql/builder-schema.sql`（DDL: tables / constraints / indexes）
2. `sql/builder-rls-policies.sql`（RLS helper + enable rls + policies）
3. `sql/builder-storage-policies.sql`（Storage buckets/policies）
4. Storage bucket確認（`builder-photos`, `builder-pdfs` が **private**）
5. Edge Function deploy（`builder-create-signed-url`）
6. signed_url 動作確認（権限OK/NG）
7. migration dry-run（ローカルでJSONを読むだけ）
8. migration execute（service roleで投入。※この段階で初めて実insert）
9. RLS権限テスト（owner/partner/adminで実動作確認）

## 2. JWT claims 最終仕様（確定が必要）
- **actor_id**: string（uuid or legacy）
- **actor_type**: `owner | partner | admin`
- **partner_id**: uuid（partnerの時のみ）
- **owner_id**: string（ownerの時のみ、`builder_projects.owner_id` と一致させる）

確認:
- actor_id / owner_id / partner_id の **対応関係**（どのテーブルのどの列と一致するか）
- partner_id は `builder_partners.id (uuid)` で良いか（legacy idなら変換が必要）

## 3. helper function のJWT取得方法
`sql/builder-rls-policies.sql` は現状 `current_setting('request.jwt.claims', true)` 前提。

確認:
- Supabase環境で `current_setting` が期待通り取れるか
- 取れない場合は `auth.jwt()` など Supabase推奨の方式に寄せる必要がある

## 4. RPC/関数の引数名確認
Edge Functionは以下を呼ぶ前提:
- `builder_can_read_project(p_project_id uuid)`

確認:
- **関数名**: `builder_can_read_project`
- **引数名**: `p_project_id`
- **戻り値**: boolean

## 5. Storage path の前提（uuid）
Storage policy案は `split_part(name,'/',1)::uuid` で project_id を抽出。

確認:
- path先頭の `{project_id}` は **必ずuuid**
- 旧 `demo-project-001` をそのままpathに入れない（uuid mapで置換してから upload）

## 6. Bucketは必ず private
確認:
- `builder-photos` / `builder-pdfs` は **public=false**
- public bucket にしない（signed_url運用を前提）

## 7. Edge Function の環境変数
`supabase/functions/builder-create-signed-url/index.ts` 前提:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

確認:
- deploy先に env が設定されている
- RPCがRLS評価される（user JWTで評価される設計）

## 8. RLS有効化タイミング
確認:
- migration/seed を service role で行うなら RLSの影響は回避可能
- ただし **本番権限テスト**（owner/partner/admin）は必ず行う

## 9. migration script の --execute 解放タイミング
現状 `scripts/migrate-builder-export-to-supabase.mjs` は:
- dry-run: OK
- `--execute`: envチェックのみ（実insert未実装）

確認:
- `--execute` を解放する（実insert実装する）タイミングは、SQL/RLS/Storage/Edge Function の基本動作確認後
- env:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 10. selected_partner_ids 最終方針（重要）
- **採用状態の正**: `builder_project_applications.status='selected'`
- `selected_partner_ids` は Supabase本番では使わない（MVP互換の派生値）
- export payload に残っていても **insert時は無視**（もしくはキャッシュ列へ投入する場合も“正”にしない）

## 11. 実行前の最小テストケース
- owner: 自分のprojectが見える / 更新できる
- partner:
  - 応募済みprojectが見える
  - selected の project でのみ photo/report/event が insert できる
- admin: 全件操作可
- Storage:
  - owner/selected partnerが photos upload できる
  - partnerは read のみ（方針通り）
  - pdf upload は owner/admin のみ
- signed_url:
  - 権限OKなら200
  - 権限NGなら403
