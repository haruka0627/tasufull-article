# TASFUL — Auth Hook / JWT Claim Phase 0 dry-run レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（dry-run レビューのみ） |
| 作成日 | 2026-06-21 |
| ステータス | **未接続 · 未適用 · Hook 未有効化** |
| 前提 | `tasful-auth-hook-implementation-plan.md`, `tasful-auth-hook-jwt-claim-design.md`, `match-rls-d2-talk-user-id-draft-review.md`, `match-local-edge-smoke-result.md` |
| 判定入力 | `READY_FOR_AUTH_HOOK_DRY_RUN` |
| 本書の範囲 | mapping / SQL / Hook **草案の peer review**。DB 接続 · SQL 適用 · Dashboard · Hook 有効化 **一切なし** |

---

## 0. Phase 0 の目的

Custom Access Token Hook を有効化する**前**に、以下を **文書・草案レベルで固定**する。

| # | 確認対象 |
|---|----------|
| 1 | 既存 auth users（棚卸し計画） |
| 2 | `TasuAuthCurrentUser` 解決順 |
| 3 | TALK `buyer_id` / `seller_id` |
| 4 | Marketplace `user_id` |
| 5 | Builder 参加者 `user_id` |
| 6 | MATCH stub `user_id` |
| 7 | demo user / localStorage fallback |
| 8 | `app_metadata.talk_user_id` |
| 9 | `app_metadata.member_id` |
| 10 | JWT claim 反映前後の確認方法 |

**成果:** Hook ON 前の mapping 規則 · backfill/Hook/検証 SQL 草案 · U-5 infra 判断材料 · 実行禁止リスト。

---

## 1. 実行しないこと

| 禁止 | Phase 0 遵守 |
|------|--------------|
| 実 DB 接続（`supabase db query` 等） | ✓ 本書は repo / 設計のみ |
| SQL 適用（migration / ad-hoc UPDATE） | ✓ 草案は `DO NOT APPLY` |
| Supabase Dashboard 変更 | ✓ |
| Custom Access Token Hook **有効化** | ✓ |
| Hook 関数の DB **CREATE**（本番/staging） | ✓ 草案は migration ファイル案として記載のみ |
| `app_metadata` backfill 実行 | ✓ |
| RLS / MATCH schema 適用 | ✓ |
| UI / `auth-current-user.js` 変更 | ✓ |
| 本番 `tasful.jp` 反映 | ✓ |
| JWT.io 等への本番 token 貼付 | ✓ セキュリティ |

---

## 2. mapping 草案

### 2.1 列定義（CSV / スプレッドシート想定）

| 列 | 型 | 説明 |
|----|-----|------|
| `auth_user_id` | uuid | `auth.users.id`（`sub`） |
| `email` | text | 照合 · テストユーザー選定 |
| `talk_user_id` | text | 提案する canonical 業務 ID |
| `member_id` | text | **= talk_user_id**（D-3） |
| `display_name` | text | 運用メモ（Auth / TALK 表示名） |
| `source` | enum | 下表 |
| `confidence` | enum | `high` / `medium` / `manual_review` |
| `action_required` | enum | `backfill_ok` / `skip` / `create_new_u_*` / `manual_review` / `exclude_demo` |

**`source` 候補**

| 値 | 意味 |
|----|------|
| `talk_room_buyer` | `transaction_rooms.buyer_id` から逆引き |
| `talk_room_seller` | `transaction_rooms.seller_id` から逆引き |
| `marketplace_listing` | `listings.user_id` |
| `builder_application` | Builder 参加者列 |
| `auth_only` | Auth のみ · TALK 行なし → 新規 `u_*` 発行候補 |
| `demo_config` | `chat-supabase-config.js` `u_me` 等 · **本番 backfill 禁止** |
| `match_stub` | `stub-user-current` · **Auth 接続前 · DB 行なし** |
| `manual_ops` | 運営手動 |

### 2.2 ルール（peer review 固定）

1. **1 auth_user_id → 1 talk_user_id**（全体 UNIQUE）
2. TALK 既存 text ID を **優先**（新 UUID マッピングテーブルは将来 · 既存行は書き換えない）
3. `confidence != high` は **自動 backfill 禁止**
4. **`u_me` / demo ID** — `action_required = exclude_demo`（本番）または staging テストユーザー限定
5. **`sub` を talk_user_id にしない**
6. email 1 件に TALK ID が複数 → `manual_review`

### 2.3 サンプル行（**テンプレート · 実 DB 未接査**）

Phase 1 棚卸し時に実 UUID/email で置換する。以下は repo 上の **既知 ID 空間**に基づく例示のみ。

| auth_user_id | email | talk_user_id | member_id | display_name | source | confidence | action_required |
|--------------|-------|--------------|-----------|--------------|--------|------------|-----------------|
| `{TEST_UUID_1}` | `auth-hook-test-1@tasful.invalid` | `u_auth_test_001` | `u_auth_test_001` | Auth Hook Test 1 | `auth_only` | high | `backfill_ok` |
| `{TEST_UUID_2}` | `auth-hook-test-2@tasful.invalid` | `u_me` | `u_me` | Demo mapping (staging only) | `demo_config` | medium | `manual_review` |
| `{TEST_UUID_3}` | `{existing_talk_user@example}` | `u_hiro` | `u_hiro` | TALK participant | `talk_room_buyer` | high | `backfill_ok` |
| `{PLACEHOLDER}` | — | `stub-user-current` | — | MATCH stub | `match_stub` | — | `skip` |
| `{UNKNOWN}` | `{email}` | `{proposed}` | `{same}` | — | `talk_room_seller` | medium | `manual_review` |

**ドメイン別の mapping 入力源（Phase 1 読取計画）**

| ドメイン | DB / コード参照 | talk_user_id 空間 |
|----------|-----------------|-------------------|
| TALK | `transaction_rooms.buyer_id`, `seller_id` | text · 既存チャット |
| Marketplace | `listings.user_id` | text · seller |
| Builder | `applications.user_id` 等 | text |
| MATCH | 草案 `match_profiles.user_id` · 現 stub | `stub-user-current`（未 DB 接続） |
| Client | `TasuAuthCurrentUser` · `chat-supabase-config.js` | JWT / demo `u_me` |
| Edge stub | `match-auth.ts` · LOCAL smoke | `stub-user-current` |

### 2.4 TasuAuthCurrentUser との整合

| 項目 | dry-run 固定 |
|------|--------------|
| Client 読取 | `app_metadata.talk_user_id` → root → `member_id` → `sub` |
| mapping 出力 | **`talk_user_id` 列 = Client が返すべき最終値** |
| 本番 host | JWT 必須 · LS fallback は mapping **対象外** |

---

## 3. backfill SQL 草案

**⚠️ DO NOT APPLY — テストユーザー限定 · service_role / Dashboard SQL Editor での実行は Phase 3 以降**

Supabase では `auth.users.raw_app_meta_data` 更新は **service_role Admin API 推奨**。SQL 草案は ops レビュー用。実行前に **単一行 SELECT で対象 UUID 確認**必須。

### 3.1 事前確認（READ · Phase 3 で初実行）

```sql
-- DO NOT APPLY in Phase 0
-- テストユーザー 1 件のみ想定
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as existing_talk_user_id,
  raw_app_meta_data->>'member_id' as existing_member_id,
  raw_app_meta_data->>'role' as existing_role
from auth.users
where id = '{TEST_UUID_1}'::uuid;
```

### 3.2 単一テストユーザー backfill（MERGE · 限定）

```sql
-- DO NOT APPLY in Phase 0
-- Target: auth-hook-test-1@tasful.invalid ONLY
-- Requires: service_role / supabase_auth_admin context

update auth.users
set
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'talk_user_id', 'u_auth_test_001',
    'member_id',    'u_auth_test_001',
    'role',         coalesce(raw_app_meta_data->>'role', 'authenticated'),
    'platform_role', coalesce(raw_app_meta_data->>'platform_role', 'member'),
    'is_ops',       coalesce((raw_app_meta_data->>'is_ops')::boolean, false)
  ),
  updated_at = now()
where id = '{TEST_UUID_1}'::uuid
  and email = 'auth-hook-test-1@tasful.invalid'
  -- 安全: 既に別 talk_user_id がある場合は更新しない
  and (
    raw_app_meta_data->>'talk_user_id' is null
    or raw_app_meta_data->>'talk_user_id' = ''
  );

-- 期待: UPDATE 0 or 1 行 · 1 行以外は中止
```

### 3.3 ロールバック用（同テストユーザー）

```sql
-- DO NOT APPLY in Phase 0
update auth.users
set
  raw_app_meta_data = raw_app_meta_data - 'talk_user_id' - 'member_id',
  updated_at = now()
where id = '{TEST_UUID_1}'::uuid
  and email = 'auth-hook-test-1@tasful.invalid';
```

### 3.4 Admin API 代替（推奨 · 概念）

```http
PUT /auth/v1/admin/users/{TEST_UUID_1}
Authorization: Bearer {SERVICE_ROLE}
Content-Type: application/json

{
  "app_metadata": {
    "talk_user_id": "u_auth_test_001",
    "member_id": "u_auth_test_001",
    "role": "authenticated",
    "platform_role": "member",
    "is_ops": false
  }
}
```

| 方針 |
|------|
| Phase 3 最初の 1 件は **Admin API** 推奨（監査ログ · merge 明示） |
| SQL UPDATE は ops 手順書に **TEST_UUID 固定**で記載 |

---

## 4. Hook SQL 草案 peer review

**⚠️ 草案のみ — Phase 4 で migration 化 · Phase 0 では CREATE / ENABLE しない**

**配置案:** `supabase/migrations/YYYYMMDDHHMMSS_auth_custom_access_token_hook_draft.sql`（将来 PR）

**Supabase 公式:** `public.custom_access_token_hook(event jsonb) returns jsonb` · `GRANT EXECUTE TO supabase_auth_admin` · `REVOKE FROM authenticated, anon, public`

### 4.1 関数草案

```sql
-- DO NOT APPLY — Phase 0 dry-run draft only
-- Ref: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  app_meta jsonb;
  v_user_id uuid;
  v_talk_user_id text;
  v_member_id text;
  v_role text;
  v_is_ops boolean;
  v_platform_role text;
begin
  -- Supabase Auth admin only (enforced by GRANT, not inside function)
  v_user_id := (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);

  -- Layer 1: existing JWT app_metadata from Auth (pre-hook)
  app_meta := coalesce(claims->'app_metadata', '{}'::jsonb);

  -- Layer 2: authoritative read from auth.users (ensures fresh metadata at token issue)
  select
    nullif(trim(u.raw_app_meta_data->>'talk_user_id'), ''),
    nullif(trim(u.raw_app_meta_data->>'member_id'), ''),
    nullif(trim(u.raw_app_meta_data->>'role'), ''),
    coalesce((u.raw_app_meta_data->>'is_ops')::boolean, false),
    nullif(trim(u.raw_app_meta_data->>'platform_role'), '')
  into v_talk_user_id, v_member_id, v_role, v_is_ops, v_platform_role
  from auth.users u
  where u.id = v_user_id;

  -- Future: member_identities fallback when table exists
  -- if v_talk_user_id is null then
  --   select talk_user_id into v_talk_user_id
  --   from public.member_identities where auth_user_id = v_user_id;
  -- end if;

  -- Missing talk_user_id handling (U-7: staging=warn, production=reject)
  if v_talk_user_id is null then
    -- STAGING: allow token but log (replace with RAISE in production)
    raise warning 'custom_access_token_hook: missing talk_user_id for user %', v_user_id;
    -- PRODUCTION OPTION (enable later):
    -- raise exception 'talk_user_id required' using errcode = 'P0001';
  else
    -- member_id defaults to talk_user_id (D-3)
    v_member_id := coalesce(v_member_id, v_talk_user_id);
    v_role := coalesce(v_role, 'authenticated');
    v_platform_role := coalesce(v_platform_role, 'member');

    app_meta := app_meta
      || jsonb_build_object(
           'talk_user_id', v_talk_user_id,
           'member_id', v_member_id,
           'role', v_role,
           'platform_role', v_platform_role,
           'is_ops', v_is_ops
         );

    -- Ensure app_metadata object exists on claims
    if jsonb_typeof(claims->'app_metadata') is null then
      claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
    end if;

    claims := jsonb_set(claims, '{app_metadata}', app_meta, true);

    -- Optional root mirror (U-4: not required for RLS)
    -- claims := jsonb_set(claims, '{talk_user_id}', to_jsonb(v_talk_user_id), true);
  end if;

  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

-- Permissions (required by Supabase)
grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- auth.users read for hook (if RLS blocks supabase_auth_admin)
grant select on table auth.users to supabase_auth_admin;
```

### 4.2 peer review 観点

| 観点 | 評価 | メモ |
|------|------|------|
| `app_metadata.talk_user_id` を載せる | ✓ | `auth.users` から再読込 · JWT 既存値より DB 正 |
| 欠落時 | △ | staging `RAISE WARNING` · 本番 `RAISE EXCEPTION` は U-7 で切替 |
| 既存 claims を壊さない | ✓ | `jsonb_set` merge · 標準 claim（iss/sub/exp 等）は触らない |
| `role` / `is_ops` 拡張 | ✓ | 同関数内 · ops 同期将来対応 |
| `user_metadata` 不使用 | ✓ | D-4 準拠 |
| `sub` を talk_user_id にしない | ✓ | |
| `security definer` | 要 | `auth.users` 読取のため · `search_path` 固定 |
| `member_identities` | 将来 | コメントアウト JOIN を Phase 2 以降で有効化 |

### 4.3 Hook 有効化前の追加確認（Phase 4）

- [ ] `supabase_auth_admin` が `auth.users` SELECT 可能
- [ ] Dashboard → Authentication → Hooks → function 選択 **のみ**（Phase 0 では未実施）
- [ ] テストユーザー login → JWT decode → `app_metadata.talk_user_id` 存在

---

## 5. 検証 SQL 草案

**⚠️ DO NOT APPLY in Phase 0 — Phase 1/3/5 で READ 実行 · WRITE 禁止**

### 5.1 `app_metadata.talk_user_id` 存在監査

```sql
select
  count(*) as total_users,
  count(*) filter (
    where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
  ) as with_talk_user_id,
  count(*) filter (
    where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is null
  ) as missing_talk_user_id
from auth.users;
```

### 5.2 `talk_user_id` 重複（auth.users 内）

```sql
select
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  count(*) as cnt
from auth.users
where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
group by 1
having count(*) > 1;
-- 期待: 0 rows
```

### 5.3 TALK `buyer_id` / `seller_id` との一致（cohort）

```sql
-- auth 側 talk_user_id が TALK に存在するか（孤立 auth 検出）
with auth_ids as (
  select distinct nullif(trim(raw_app_meta_data->>'talk_user_id'), '') as talk_user_id
  from auth.users
  where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
),
talk_ids as (
  select distinct buyer_id as talk_user_id from public.transaction_rooms where buyer_id is not null
  union
  select distinct seller_id from public.transaction_rooms where seller_id is not null
)
select a.talk_user_id
from auth_ids a
left join talk_ids t on t.talk_user_id = a.talk_user_id
where t.talk_user_id is null;
-- 解釈: auth_only 新規ユーザーは行が出る · 既存 TALK 参加者は 0 が理想
```

### 5.4 逆方向 — TALK ID が auth に未登録

```sql
with talk_ids as (
  select distinct buyer_id as talk_user_id from public.transaction_rooms where buyer_id is not null
  union
  select distinct seller_id from public.transaction_rooms where seller_id is not null
),
auth_ids as (
  select distinct nullif(trim(raw_app_meta_data->>'talk_user_id'), '') as talk_user_id
  from auth.users
)
select t.talk_user_id
from talk_ids t
left join auth_ids a on a.talk_user_id = t.talk_user_id
where a.talk_user_id is null
order by 1;
-- backfill 候補リスト（mapping CSV 入力）
```

### 5.5 JWT claim 前提 — metadata 整合

```sql
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id,
  case
    when raw_app_meta_data->>'member_id' is null then 'member_id_missing'
    when raw_app_meta_data->>'member_id' <> raw_app_meta_data->>'talk_user_id' then 'member_id_mismatch'
    else 'ok'
  end as member_id_check,
  raw_app_meta_data->>'role' as role,
  raw_app_meta_data->>'is_ops' as is_ops
from auth.users
where id in ('{TEST_UUID_1}'::uuid)  -- テストユーザー限定
;
```

### 5.6 demo user 混入チェック

```sql
select id, email, raw_app_meta_data->>'talk_user_id' as talk_user_id
from auth.users
where lower(coalesce(raw_app_meta_data->>'talk_user_id', '')) in ('u_me', 'stub-user-current', 'stub-user-id')
   or email ilike '%+demo%';
-- 本番 cohort: 0 件が理想 · staging テストユーザーは allowlist で除外
```

### 5.7 JWT claim 反映前後（非 SQL · Phase 5 手順）

| タイミング | 方法 | 確認 |
|------------|------|------|
| **前** backfill 直後 · 旧 token | ローカル JWT decode script | `talk_user_id` 欠落の可能性 |
| **後** `refreshSession()` | client / curl + anon | `app_metadata.talk_user_id` 存在 |
| **後** Hook ON | 同上 + Postgres `auth.jwt()`（authenticated SQL） | coalesce 第一候補一致 |
| Client | `TasuAuthCurrentUser.getCurrentUser().talkUserId` | = metadata |
| Edge | signed JWT smoke（Phase 7） | `requireUser` = 同一 ID |

**禁止:** 本番 token を第三者サービスへ送信。

---

## 6. U-5 infra 比較

| 評価項目 | **A: 専用 staging Supabase ref 新規作成** | **B: linked ref `ddojquacsyqesrjhcvmn` · テストユーザー限定** |
|----------|------------------------------------------|----------------------------------------------------------------|
| **安全性** | ◎ 本番 Auth/DB と完全分離 | △ 共有 DB · TALK RLS 既適用 · Hook SPOF が本番 Auth に波及 |
| **手間** | △ project 作成 · seed · secrets · CI 分岐 | ◎ 追加 infra 最小 |
| **本番影響** | ◎ なし（別 ref） | △ Hook ON/OFF · metadata 誤更新が本番ユーザーに及ぶリスク |
| **検証精度** | ◎ claim · Hook · RLS 試験を破壊的に実施可 | ○ テスト 3–5 件なら可 · 全量 backfill 不可 |
| **ロールバック容易性** | ◎ project ごと破棄可 | ○ Hook OFF + 単一 user metadata 戻し · 共有 DB は残る |
| **TALK RLS 回帰** | △ staging seed で別途 | ◎ 既存 `verify-talk-rls-staging.mjs` と同 DB |
| **総合** | **中〜大規模本番前に推奨** | **短期 PoC · 人手不足時の限定 fallback** |

### 6.1 dry-run 推奨

| 判断 | 内容 |
|------|------|
| **推奨** | **A** — Auth Hook は Auth 全体 SPOF のため専用 staging を作成 |
| **B 許容条件** | ① テストユーザー **3 名固定** · email allowlist ② Hook は **メンテ窗口**のみ ③ 全量 backfill **禁止** ④ Dashboard Hook OFF を 1 クリックで実行可能 ⑤ product/infra **書面承認** |
| **B 禁止** | 全 auth.users backfill · Hook 常時 ON · RLS D2 同時適用 |

**Phase 0 時点:** U-5 は **未決** — 本 dry-run で比較表を提示 · **次ゲートで product/infra 決定**。

---

## 7. demo / fallback 対応

| コンテキスト | talk_user_id | JWT / Hook | localStorage fallback |
|--------------|--------------|------------|------------------------|
| 本番 `tasful.jp` | 必須 · `u_*` 新規 | Hook + backfill | **禁止**（現行維持） |
| localhost / talkDev | UI のみ `u_me` | 未ログイン時 N/A | 許可 · **mapping 対象外** |
| MATCH stub | `stub-user-current` | stub token · LOCAL smoke | `match-auth.js` · DB なし |
| staging テストユーザー | Admin 設定 `u_auth_test_*` | 検証用 | 使わない |

**mapping:** `source=demo_config` / `match_stub` → `action_required=exclude_demo` or `skip`

---

## 8. リスク

| リスク | dry-run 緩和 | 残存 |
|--------|--------------|------|
| mapping 誤り | confidence / manual_review · テスト 1 件先行 | Phase 1 実読取 |
| Hook SPOF | staging 限定 · OFF 手順 | B 選択時は本番 Auth 影響 |
| `auth.users` GRANT 過不足 | 草案で `supabase_auth_admin` 明示 | Phase 4 実測 |
| refresh lag | §5.7 手順 | backfill 直後 |
| demo `u_me` 本番混入 | §5.6 SQL | product ルール |
| RLS 先行適用 | 実行禁止リスト | MATCH 凍結 |

---

## 9. 次ステップ

| 順 | ゲート | 成果物 |
|----|--------|--------|
| 1 | **U-5 決定**（A or B + 条件） | infra/product 承認メモ |
| 2 | Phase 1 — mapping 棚卸し **READ** | 実 CSV · `{TEST_UUID_*}` 確定 |
| 3 | Phase 3 — テスト 1 件 backfill（**Admin API**） | `tasful-auth-hook-backfill-result.md` |
| 4 | JWT refresh 実測（Hook **OFF**） | token before/after |
| 5 | Hook migration PR + **staging のみ ENABLE** | JWT 実測 |
| 6 | Edge verifyJwt + signed smoke | Phase 7 |
| 7 | RLS D2 ゲート G1–G7 | MATCH 凍結解除 |

---

## 10. Hook 有効化前に絶対やらないこと（実行禁止事項リスト）

1. Custom Access Token Hook の **Dashboard ENABLE**
2. 全 auth.users への **一括 backfill**
3. **`user_metadata.talk_user_id`** の設定 · RLS 利用
4. **`auth.uid()::text` を業務 user_id** として TALK/MATCH 行に書込
5. **RLS D2 / MATCH ENABLE**（JWT claim ゲート前）
6. **本番 `tasful.jp`** 向け UI / config 変更
7. **MATCH `edge_stub` デフォルト化** · 新機能追加
8. **service_role を client** に配布
9. **本番 JWT を外部 decode サービス**へ送信
10. **confidence != high** の自動 backfill
11. **`u_me` を本番ユーザー**に恒久 mapping
12. **TALK/Builder/Marketplace Edge** 本体の同時改修
13. **Hook 有効化と RLS 適用の同日**実施
14. **ロールバック手順未確認**のまま Hook ON
15. **テストユーザー allowlist 未固定**のまま linked ref で Hook ON（B 選択時）

---

## 11. 判定

### **READY_FOR_AUTH_HOOK_STAGING_DECISION**

**理由**

- Phase 0 目的（mapping · backfill/Hook/検証 SQL 草案 · U-5 比較 · 禁止リスト）を **DB 非接続で完了**
- Hook SQL 草案は Supabase 公式シグネチャ · TASFUL claim 構造 · 欠落時方針 · 拡張性を peer review 済み
- JWT 前後確認 · demo/fallback · 横断ドメイン整合を dry-run 計画に固定
- **次の明示ゲートは U-5（A vs B）** — 実装・Hook 有効化の前提

**NEEDS_DECISION（次アクションとして必須 · dry-run 自体は完了）**

- **U-5:** 専用 staging ref 作成（**推奨 A**）vs linked ref 限定 B
- **U-7:** 本番 Hook で `talk_user_id` 欠落時 login **拒否**するか（staging は warn 推奨）

U-5 が **B** かつ product 承認なしの場合 → Hook 有効化 Phase 4 へ **進行不可**。

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-hook-implementation-plan.md` | Phase 0–10 |
| `reports/tasful-auth-hook-jwt-claim-design.md` | 案 A |
| `reports/match-rls-d2-talk-user-id-draft-review.md` | RLS ゲート |
| `reports/match-local-edge-smoke-result.md` | LOCAL_EDGE_SMOKE_PASS |
| `auth-current-user.js` | Client 解決順 |
| [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) | Hook 公式 |
