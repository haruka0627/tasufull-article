# TASFUL — Auth Hook linked ref L5 CREATE OFF 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l4-jwt-refresh.md` · L4 判定 `READY_FOR_LINKED_REF_L5_HOOK_CREATE_OFF` |
| Dashboard Auth Hook | **OFF（変更なし · L6 まで有効化禁止）** |
| DB Hook 関数 | **`public.custom_access_token_hook` CREATE 済**（Auth 経路では未呼び出し） |

---

## 1. 実施サマリ

| # | L5 完了条件 | 結果 |
|---|-------------|------|
| 1 | migration で `custom_access_token_hook` CREATE | **PASS** |
| 2 | linked ref へ migration 適用 | **PASS** |
| 3 | DB 上 hook 関数 **1 件** | **PASS**（`hook_func_count=1`） |
| 4 | 直接呼び出し — T1 claims merge | **PASS**（§4） |
| 5 | 直接呼び出し — T2 missing · claims 不変 | **PASS**（§4） |
| 6 | 実ログイン JWT — Dashboard OFF · L4 同等 | **PASS**（§5） |
| 7 | T2–T5 / 既存 7 件 metadata 不変 | **PASS**（§6） |
| 8 | MATCH migration 未適用 | **PASS**（`match_table_count=0`） |
| 9 | Dashboard Hook **OFF** 維持 | **PASS**（§7） |

**実行**

```bash
npx supabase db query --linked --yes -f supabase/migrations/20260621150000_create_custom_access_token_hook.sql
node scripts/verify-auth-hook-l5-create-off.mjs
```

**自動検証:** `L5 result: PASS (8 checks)`

---

## 2. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| Dashboard Auth Hook 有効化 | ✓ **OFF のまま** |
| 既存 7 ユーザー metadata 変更 | ✓ |
| T1–T5 metadata 変更 | ✓ |
| RLS 変更 | ✓ |
| MATCH migration 適用 | ✓（`match_*` = 0） |
| UI 変更 | ✓ |
| 既存データ UPDATE/DELETE | ✓ |
| service role key / JWT / password の report 記載 | ✓ 非掲載 |

---

## 3. migration 適用

| 項目 | 内容 |
|------|------|
| ファイル | `supabase/migrations/20260621150000_create_custom_access_token_hook.sql` |
| 適用方法 | `npx supabase db query --linked --yes -f …`（**hook migration のみ** · MATCH 草案 3 件は未適用） |
| 関数 | `public.custom_access_token_hook(event jsonb) returns jsonb` |
| owner | `postgres` |
| search_path | `public` |
| security | `SECURITY DEFINER` · `STABLE` |
| grants | `EXECUTE` → `supabase_auth_admin` · `REVOKE` from `public`, `anon`, `authenticated` |
| 補助 grant | `GRANT SELECT ON auth.users TO supabase_auth_admin` |

### 3.1 claim merge 方針

| 条件 | 挙動 |
|------|------|
| `auth.users.raw_app_meta_data.talk_user_id` **あり** | `app_metadata` に `talk_user_id` / `member_id`（欠落時 coalesce）/ `role` / `platform_role` / `is_ops` を **merge** |
| `talk_user_id` **なし** | **event をそのまま返す**（例外なし · 既存 claims 不変） |
| `provider` / `providers` | merge 時も **既存 `app_metadata` キーを保持**（`||` merge） |
| 標準 JWT claim（`iss` / `sub` / `aud` 等） | hook 内で **触らない** |

---

## 4. 直接呼び出しテスト（Dashboard OFF · SQL）

`sql/auth-hook-l5-verify-gates.sql` 経由（関数を `SELECT public.custom_access_token_hook(…)` で直接実行）。

| ケース | 入力 | 期待 | 実測 |
|--------|------|------|------|
| **T1** | user `2d537fc9-…` · claims に provider/providers のみ | `talk_user_id`/`member_id` = **`t1`** · provider 維持 | **PASS** |
| **T1** | 同上 | `iss` 維持 | **PASS** |
| **T2** | user `d9f57cfa-…` · DB に talk/member なし | `claims_unchanged` = **true** · provider/providers 維持 | **PASS** |

**gates JSON（抜粋 · token/secret 非掲載）**

| フィールド | 値 |
|------------|-----|
| `hook_func_count` | **1** |
| `t1_talk_user_id` / `t1_member_id` | **`t1`** / **`t1`** |
| `t1_provider` | `email` |
| `t1_providers` | `["email"]` |
| `t2_claims_unchanged` | **true** |
| `match_table_count` | **0** |

---

## 5. 実ログイン JWT（Dashboard Hook OFF）

Dashboard Auth Hook **OFF** のため、発行 JWT は **L4 と同型**（`auth.users` の app_metadata を Auth がそのまま載せる経路 · hook **未介入**）。

### 5.1 T1（`t1@tasful.invalid`）

| タイミング | HTTP | app_metadata（decode · 非 token 掲載） |
|------------|------|----------------------------------------|
| login | 200 | `talk_user_id=t1` · `member_id=t1` · `provider=email` · `providers=["email"]` |
| refresh | 200 | **login と同一 claim** |

**L4 との差分:** **なし**（Hook OFF · CREATE のみ）

### 5.2 T2（`t2@tasful.invalid`）

| フィールド | 値 |
|------------|-----|
| `app_metadata.talk_user_id` | **null** |
| `app_metadata.member_id` | **null** |
| `provider` / `providers` | `email` / `["email"]` |

---

## 6. metadata · baseline 不変

| 区分 | 結果 |
|------|------|
| T1 app_metadata | L3/L4 から **不変**（Admin API READ · script `metadata sanity` PASS） |
| T2–T5 talk/member | **NULL のまま**（`sql/auth-hook-l5-verify-readonly.sql` §4） |
| 既存 7 件 `@tasful-dev.test` | L1 §3.3 **diff なし**（§5 READ） |
| T1 user_metadata | `{"email_verified":true}` — **不変** |

---

## 7. Dashboard Auth Hook 状態

| 項目 | 状態 |
|------|------|
| Supabase Dashboard → Authentication → Hooks → Custom Access Token | **OFF（有効化していない）** |
| 実ログイン / refresh | hook 関数 **未呼び出し**（§5 · L4 同等 JWT で確認） |
| L6 以降 | Dashboard **ON** + WARN 監視（別フェーズ） |

**明記:** 本フェーズ（L5）では Dashboard 側の Hook トグルは **一切変更していない**。

---

## 8. MATCH / RLS

| 確認 | 結果 |
|------|------|
| `match_*` テーブル | **0** |
| RLS policy 変更 | **なし** |

---

## 9. rollback SQL

L5 で追加した hook 関数のみを除去する場合:

```sql
-- Rollback L5 (hook function only · Dashboard remains OFF)
revoke all on function public.custom_access_token_hook(jsonb) from supabase_auth_admin;

drop function if exists public.custom_access_token_hook(jsonb);
```

**注意:** `grant select on auth.users to supabase_auth_admin` は Supabase Auth hook 標準要件。rollback 後 L6 前に再 grant が必要になる場合あり。

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `supabase/migrations/20260621150000_create_custom_access_token_hook.sql` | L5 migration（CREATE OR REPLACE + grants） |
| `sql/auth-hook-l5-verify-readonly.sql` | 手動 READ 監査（baseline · hook 直接呼び出し例） |
| `sql/auth-hook-l5-verify-gates.sql` | CLI 自動 gates（単一 result set） |
| `scripts/verify-auth-hook-l5-create-off.mjs` | L5 自動検証（SQL gates + login JWT） |

---

## 11. 判定

| 判定 | 理由 |
|------|------|
| **`READY_FOR_LINKED_REF_L6_HOOK_ON_WARN`** | hook 関数 CREATE · 直接呼び出し merge/不変 PASS · Dashboard OFF で実 JWT L4 同等 · metadata/MATCH/RLS 不変 |

---

## 12. 次ステップ（L6）

| 順 | 作業 |
|----|------|
| 1 | Dashboard **Custom Access Token Hook ON**（`public.custom_access_token_hook` を指定） |
| 2 | T1 login/refresh で hook 経由 claims を確認 |
| 3 | T2–T5 missing `talk_user_id` は **WARN**（U-7 staging）· token は発行継続 |
| 4 | 既存 7 件 · provider/providers 維持を再確認 |
