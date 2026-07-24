# TLV Payment Engine — RLS Design (TODO-07)

**Date:** 2026-06-28  
**Scope:** 設計 · レビュー · Policy / GRANT SQL **案のみ** — migration 作成 · RLS ENABLE · 本番反映 **禁止**  
**正本:** [`db/tlv_schema.sql`](../db/tlv_schema.sql) · [`supabase/config.toml`](../supabase/config.toml) · [`docs/TLV_DB_SCHEMA.md`](../docs/TLV_DB_SCHEMA.md) · [`docs/TLV_PAYMENT_ENGINE.md`](../docs/TLV_PAYMENT_ENGINE.md)

**Staging 参照:** [tlv-payment-create-tip-transaction-staging-test.md](./tlv-payment-create-tip-transaction-staging-test.md) · [tlv-payment-create-tip-transaction-rpc.md](./tlv-payment-create-tip-transaction-rpc.md)

---

## 1. RLS 基本方針

| # | 方針 |
| --- | --- |
| 1 | **anon は Payment 系原則禁止** — ライブ UX 必要分のみ authenticated + 限定 SELECT |
| 2 | **wallet / ledger / payment / provider_event の書込は service_role 専用** — Edge → RPC |
| 3 | **Viewer** — 自分の wallet / payment / tip（payer）のみ SELECT |
| 4 | **Creator** — 自分宛 tip / 自 stream の stream_events のみ SELECT（**revenue_ledger 直読禁止**） |
| 5 | **revenue_ledger / payment_provider_events** — **admin（既存 JWT）+ service_role のみ** |
| 6 | **UPDATE / DELETE** — クライアント全面禁止 · 監査テーブル INSERT-only |
| 7 | **`auth.uid()` = `payer_user_uuid` = `viewer_wallets.user_id`** — `payer_user_id` text は RLS/JOIN 禁止 |
| 8 | **Membership 系は別 Policy** — 本設計と混在しない（§10） |

---

## 2. 作業1 — テーブル別 RLS 設計表

凡例: ✅ 許可 · ❌ 禁止 · 🔒 service_role のみ · — ポリシーなし（deny）

| テーブル | RLS要否 | anon | authenticated Viewer | Creator 本人 | Admin | service_role | SELECT | INSERT | UPDATE | DELETE | 補足 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **viewer_wallets** | ✅ | ❌ | ✅ 本人 `user_id=auth.uid()` | ✅ 本人 SELECT | ✅ | 🔒 ALL | owner | 🔒 | 🔒 | 🔒 | 残高改ざん防止 · RPC のみ UPDATE |
| **wallet_ledger** | ✅ | ❌ | ✅ 本人 `user_id=auth.uid()` | ✅ 本人 SELECT | ✅ | 🔒 INSERT+SELECT | owner | 🔒 | ❌ | ❌ | INSERT-only 監査 |
| **coin_lots** | ✅ | ❌ | ✅ 本人 `user_id=auth.uid()` | ✅ 本人 SELECT | ✅ | 🔒 ALL | owner | 🔒 | 🔒 | ❌ | FIFO 消費は RPC 内 UPDATE |
| **payments** | ✅ | ❌ | ✅ payer `payer_user_uuid=auth.uid()` | ❌ | ✅ | 🔒 ALL | payer | 🔒 | 🔒 | ❌ | status 更新 webhook RPC |
| **tips** | ✅ | ❌ | ✅ payer SELECT | ✅ 自 creator SELECT | ✅ | 🔒 ALL | payer+creator | 🔒 | ❌ | ❌ | createTip は Edge のみ |
| **tip_coin_lot_allocations** | ✅ | ❌ | ✅ payer（tips JOIN） | ❌ 直読不可 | ✅ | 🔒 ALL | payer のみ | 🔒 | ❌ | ❌ | Creator は tips 集計で十分 |
| **revenue_ledger** | ✅ | ❌ | ❌ | ❌ | ✅ | 🔒 INSERT+SELECT | admin | 🔒 | ❌ | ❌ | JPY PL 正本 · Studio は safe view 経由 |
| **payment_provider_events** | ✅ | ❌ | ❌ | ❌ | ✅ | 🔒 ALL | admin | 🔒 | 🔒 | ❌ | Webhook 冪等 · payload 秘匿 |
| **stream_events** | ✅ | ❌ | ✅ live stream | ✅ 自 stream | ✅ | 🔒 INSERT+SELECT | live UX | 🔒 | ❌ | ❌ | **JPY 正本なし** · payload に jpy 禁止 |
| **creator_score_events** | ✅ | ❌ | ❌ | ⚠️ 要判断（§2.1） | ✅ | 🔒 INSERT+SELECT | 要判断 | 🔒 | ❌ | ❌ | 列は `creator_id`（`creator_user_id` なし） |

### 2.1 creator_score_events — Creator 閲覧方針（要判断 · 設計メモ）

| 案 | 内容 | 推奨 |
| --- | --- | --- |
| **A** | Creator 本人 SELECT — `tlv.is_creator_of(creator_id)` | Studio デバッグ向け · staging 検証用 |
| **B** | 集計のみ — `creator_score_monthly` / `creators.score_ma30` 経由 · イベント表直読禁止 | **production 推奨** — 軸スコア詳細の漏洩抑制 |

**本 Policy 案:** 初期 migration は **案 B（Creator 直読なし）** + Admin のみ。Studio 要件確定後に案 A Policy を追加可能。

---

## 3. 権限マトリクス（ロール × 操作）

### 3.1 SELECT（読取）

| リソース | anon | Viewer | Creator | Admin¹ | service_role |
| --- | --- | --- | --- | --- | --- |
| 自分の wallet / ledger / lots | ❌ | ✅ | ✅² | ✅ | ✅ |
| 自分の payments | ❌ | ✅ | ❌ | ✅ | ✅ |
| payer としての tips | ❌ | ✅ | ✅ | ✅ | ✅ |
| creator としての tips | ❌ | ❌ | ✅ | ✅ | ✅ |
| tip_coin_lot_allocations | ❌ | ✅³ | ❌ | ✅ | ✅ |
| revenue_ledger | ❌ | ❌ | ❌ | ✅ | ✅ |
| payment_provider_events | ❌ | ❌ | ❌ | ✅ | ✅ |
| live stream_events | ❌ | ✅ | ✅ | ✅ | ✅ |
| creator_score_events | ❌ | ❌ | ❌⁴ | ✅ | ✅ |

¹ Admin = 既存 `public.talk_is_admin()` または JWT `app_metadata.is_ops=true`（§5）  
² Creator 兼 Viewer  
³ payer 経由 tips JOIN のみ  
⁴ 案 B 採用時 · 案 A なら Creator 本人可

### 3.2 INSERT / UPDATE / DELETE（書込）

| 操作 | anon | authenticated | Creator | Admin | service_role |
| --- | --- | --- | --- | --- | --- |
| Wallet 残高 | ❌ | ❌ | ❌ | ❌ | ✅ RPC |
| Ledger 行追加 | ❌ | ❌ | ❌ | ❌ | ✅ RPC / webhook |
| tips 作成 | ❌ | ❌ | ❌ | ❌ | ✅ `create_tip_transaction` |
| payments 作成 | ❌ | ❌ | ❌ | ❌ | ✅ webhook RPC |
| 任意 UPDATE/DELETE | ❌ | ❌ | ❌ | ❌ | ❌⁵ |

⁵ 運用修正は adjustment 行 INSERT · Ops Edge 経由

---

## 4. 作業2 — テーブル別 Policy SQL 案（未適用）

### 4.0 共通ヘルパー（既存パターン準拠 · 新規 admin 方式は設けない）

```sql
-- Creator 判定: creators.user_id (text) ↔ JWT talk_user_id（既存 hook 注入）
create or replace function tlv.jwt_talk_user_id()
returns text language sql stable as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
    auth.jwt() ->> 'talk_user_id',
    auth.jwt() ->> 'sub'
  );
$$;

create or replace function tlv.is_creator_of(p_creator_id uuid)
returns boolean language sql stable security definer set search_path = tlv as $$
  select exists (
    select 1 from tlv.creators c
    where c.id = p_creator_id and c.user_id = tlv.jwt_talk_user_id()
  );
$$;

-- Admin: 既存 public.talk_is_admin() を再利用（sql/talk-rls-production.sql）
-- 追加: is_ops（custom_access_token_hook が app_metadata.is_ops を注入済）
create or replace function tlv.is_tlv_ops_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.talk_is_admin()
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_ops')::boolean, false);
$$;
```

**TODO-RLS-03（候補）:** TLV 専用 `tlv_admin` claim は **現状存在しない** — 必要なら hook 拡張を別タスクで検討。本設計では **既存 `talk_is_admin` + `is_ops` のみ**。

### 4.1 viewer_wallets

```sql
alter table tlv.viewer_wallets enable row level security;
alter table tlv.viewer_wallets force row level security;

create policy vw_owner_select on tlv.viewer_wallets
  for select to authenticated using (user_id = auth.uid());

create policy vw_admin_select on tlv.viewer_wallets
  for select to authenticated using (tlv.is_tlv_ops_admin());
-- INSERT/UPDATE/DELETE: ポリシーなし → deny（service_role バイパス）
```

### 4.2 wallet_ledger

```sql
alter table tlv.wallet_ledger enable row level security;
alter table tlv.wallet_ledger force row level security;

create policy wl_owner_select on tlv.wallet_ledger
  for select to authenticated using (user_id = auth.uid());

create policy wl_admin_select on tlv.wallet_ledger
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.3 coin_lots

```sql
alter table tlv.coin_lots enable row level security;
alter table tlv.coin_lots force row level security;

create policy cl_owner_select on tlv.coin_lots
  for select to authenticated using (user_id = auth.uid());

create policy cl_admin_select on tlv.coin_lots
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.4 payments

```sql
alter table tlv.payments enable row level security;
alter table tlv.payments force row level security;

create policy pay_payer_select on tlv.payments
  for select to authenticated using (payer_user_uuid = auth.uid());

create policy pay_admin_select on tlv.payments
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.5 tips

```sql
alter table tlv.tips enable row level security;
alter table tlv.tips force row level security;

create policy tips_payer_select on tlv.tips
  for select to authenticated using (payer_user_uuid = auth.uid());

create policy tips_creator_select on tlv.tips
  for select to authenticated using (tlv.is_creator_of(creator_id));

create policy tips_admin_select on tlv.tips
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.6 tip_coin_lot_allocations

```sql
alter table tlv.tip_coin_lot_allocations enable row level security;
alter table tlv.tip_coin_lot_allocations force row level security;

create policy tcla_payer_select on tlv.tip_coin_lot_allocations
  for select to authenticated using (
    exists (
      select 1 from tlv.tips t
      where t.id = tip_id and t.payer_user_uuid = auth.uid()
    )
  );

create policy tcla_admin_select on tlv.tip_coin_lot_allocations
  for select to authenticated using (tlv.is_tlv_ops_admin());
-- Creator 直読 Policy なし — tips / revenue 集計経由
```

### 4.7 revenue_ledger

```sql
alter table tlv.revenue_ledger enable row level security;
alter table tlv.revenue_ledger force row level security;

create policy rl_admin_select on tlv.revenue_ledger
  for select to authenticated using (tlv.is_tlv_ops_admin());
-- Viewer / Creator: ポリシーなし → deny
-- 将来: tlv.creator_revenue_summary VIEW + 別 Policy
```

### 4.8 payment_provider_events

```sql
alter table tlv.payment_provider_events enable row level security;
alter table tlv.payment_provider_events force row level security;

create policy ppe_admin_select on tlv.payment_provider_events
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.9 stream_events

```sql
alter table tlv.stream_events enable row level security;
alter table tlv.stream_events force row level security;

create policy se_live_select on tlv.stream_events
  for select to authenticated using (
    exists (
      select 1 from tlv.streams s
      where s.id = stream_id and s.status = 'live'
    )
  );

create policy se_creator_select on tlv.stream_events
  for select to authenticated using (
    exists (
      select 1 from tlv.streams s
      where s.id = stream_id and tlv.is_creator_of(s.creator_id)
    )
  );

create policy se_admin_select on tlv.stream_events
  for select to authenticated using (tlv.is_tlv_ops_admin());
```

### 4.10 creator_score_events（案 B · Creator 直読なし）

```sql
alter table tlv.creator_score_events enable row level security;
alter table tlv.creator_score_events force row level security;

create policy cse_admin_select on tlv.creator_score_events
  for select to authenticated using (tlv.is_tlv_ops_admin());

-- 案 A 追加時（任意）:
-- create policy cse_creator_select on tlv.creator_score_events
--   for select to authenticated using (tlv.is_creator_of(creator_id));
```

### 4.11 GRANT 整理案（RLS 適用 migration 内）

```sql
revoke all on all tables in schema tlv from anon, authenticated;
revoke all on all functions in schema tlv from anon, authenticated;

grant usage on schema tlv to authenticated;
-- SELECT は RLS Policy 経由（テーブル GRANT は authenticated に select 付与）
grant select on all tables in schema tlv to authenticated;

grant usage on schema tlv to service_role;
grant all on all tables in schema tlv to service_role;
grant execute on all functions in schema tlv to service_role;

-- anon: tlv schema usage も付与しない（PostgREST 経路遮断）
```

---

## 5. 作業3 — Admin 判定方式（既存調査）

### 5.1 調査結果

| 候補 | 状態 | 根拠 |
| --- | --- | --- |
| **`public.talk_is_admin()`** | ✅ **既存 · 本番パターン** | [`sql/talk-rls-production.sql`](../sql/talk-rls-production.sql) — JWT `role` / `app_metadata.role` が `tasu_admin` / `admin` |
| **`app_metadata.is_ops`** | ✅ **hook 注入済** | [`supabase/migrations/20260630100001_partner_p1_auth_hook.sql`](../supabase/migrations/20260630100001_partner_p1_auth_hook.sql) |
| **`custom_access_token_hook`** | ✅ 有効（staging linked） | [`supabase/config.toml`](../supabase/config.toml) L38–43 |
| **`builder_is_admin` / `is_ops`** | ✅ Builder 領域のみ | [`sql/builder-ai-drafts-staging.sql`](../sql/builder-ai-drafts-staging.sql) — TLV とは別 |
| **`admin_users` テーブル** | ❌ TLV Payment 未使用 | — |
| **`app_role=tlv_admin`** | ❌ **未実装** | 新規設計 **しない** → TODO-RLS-03 候補 |
| **service_role only（Admin 閲覧）** | ⚠️ 代替 | Ops ダッシュボードが Edge + service_role のみなら RLS Admin Policy 省略可 |

### 5.2 本設計での Admin

**採用:** `tlv.is_tlv_ops_admin()` = `talk_is_admin() OR is_ops`

Ops UI が authenticated JWT + PostgREST 直読する場合のみ Admin SELECT Policy を有効化。否则 Edge + service_role のみ。

---

## 6. 作業4 — RPC 権限確認

### 6.1 調査結果（migration 正本）

| RPC | SECURITY | EXECUTE GRANT | クライアント直叩き |
| --- | --- | --- | --- |
| `tlv.create_tip_transaction` | **DEFINER** | **service_role のみ** | ❌ authenticated/anon 不可 |
| `tlv.handle_payment_webhook_success` | **DEFINER** | **service_role のみ** | ❌ |
| `tlv.record_payment_provider_event_terminal` | DEFINER | service_role のみ | ❌ |
| `tlv.compute_gauge_pct` | INVOKER（非 DEFINER） | **service_role のみ** | ❌ · 内部ヘルパー |

**根拠:**

- [`supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql`](../supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql) L549–556
- [`supabase/migrations/20260628130000_tlv_payer_user_uuid.sql`](../supabase/migrations/20260628130000_tlv_payer_user_uuid.sql) L179–183

### 6.2 リスク評価

| 確認項目 | 現状 | 判定 |
| --- | --- | --- |
| authenticated から `create_tip_transaction` | GRANT なし | 🟢 安全 |
| anon から webhook RPC | GRANT なし | 🟢 安全 |
| SECURITY DEFINER + 広い GRANT | GRANT は service_role のみ | 🟢 |
| staging 手動 `GRANT EXECUTE ON ALL ROUTINES IN SCHEMA tlv TO authenticated` | **レポート記載あり · 要 revoke** | 🔴 staging 確認必須 |

### 6.3 EXECUTE privilege 案（migration 時 · 未適用）

```sql
-- 明示的 deny-by-default（既存 GRANT 上書き）
revoke execute on all functions in schema tlv from public, anon, authenticated;

grant execute on function tlv.create_tip_transaction(
  uuid, uuid, uuid, text, tlv.tip_kind, integer,
  text, jsonb, uuid, uuid, text, text, boolean, boolean, boolean
) to service_role;

grant execute on function tlv.handle_payment_webhook_success(
  tlv.payment_provider, text, text, text, text, uuid, uuid,
  tlv.payment_channel, bigint, bigint, bigint, numeric, integer, boolean,
  text, text, jsonb, uuid
) to service_role;

grant execute on function tlv.compute_gauge_pct(integer, numeric, integer, integer)
  to service_role;
```

### 6.4 推奨実行経路

```text
Browser (Viewer JWT)
  → tlv-create-tip Edge（verify_jwt=false · Edge 内で JWT 検証）
  → Supabase client (service_role)
  → tlv.create_tip_transaction(...)

Stripe
  → tlv-payment-webhook Edge（署名検証）
  → service_role → tlv.handle_payment_webhook_success(...)

禁止: Browser → PostgREST /rest/v1/rpc/create_tip_transaction（authenticated）
```

**Edge `verify_jwt=false` 注意:** [`supabase/config.toml`](../supabase/config.toml) — Edge 内で Bearer 検証必須（現行 `_shared/tlv-create-tip.ts` 実装済）。

---

## 7. 作業5 — PostgREST `tlv` schema expose リスク

### 7.1 現状（staging）

[`supabase/config.toml`](../supabase/config.toml):

```toml
[api]
schemas = ["public", "graphql_public", "tlv"]
```

staging 統合テストで Edge `client.rpc()` が `Invalid schema: tlv` を解消するため適用（[staging-test report](./tlv-payment-create-tip-transaction-staging-test.md)）。

**staging 追加 GRANT（手動 · 要確認）:**

```sql
GRANT USAGE ON SCHEMA tlv TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES/ROUTINES IN SCHEMA tlv TO service_role;
```

### 7.2 RLS **未設定** + expose 時の危険度

| テーブル | RLS なし + authenticated SELECT 付与時 | 危険度 |
| --- | --- | --- |
| viewer_wallets | 全ユーザー残高閲覧可能 | 🔴 致命 |
| wallet_ledger | 全監査行閲覧 | 🔴 |
| coin_lots | 購入履歴・JPY 内訳漏洩 | 🔴 |
| payments | 全決済閲覧 | 🔴 |
| tips | 全 tip 閲覧 | 🔴 |
| revenue_ledger | PL 全漏洩 | 🔴 |
| payment_provider_events | Webhook payload 相当 | 🔴 |

**結論:** **RLS 適用前に production で `tlv` expose + 広い GRANT は禁止。**

### 7.3 expose が必要なもの

| 需要 | 必要性 | 代替 |
| --- | --- | --- |
| Edge `service_role` RPC | PostgREST が `tlv` schema を解決 | **expose 必要**（現行 Edge SDK パターン） |
| クライアント直接 SELECT | Wallet 残高 UI 等 | **read-only VIEW on `public`** + RLS または Edge API |
| クライアント RPC | 不要 | Edge 経由のみ |

### 7.4 Production 推奨案

| # | 推奨 |
| --- | --- |
| 1 | **RLS migration を staging で PASS してから production expose** |
| 2 | production `schemas` は最小: `["public", "graphql_public", "tlv"]` 維持可 · **GRANT は service_role + authenticated SELECT（RLS 下）のみ** |
| 3 | **anon に tlv USAGE を付与しない** |
| 4 | クライアント読取は `public.tlv_viewer_wallet_safe` 等 VIEW を検討（列限定 · RLS 二重化） |
| 5 | Edge のみで足りるなら将来 **`tlv` を Dashboard API expose から外し** DB 直 RPC（postgres driver）に移行も選択肢 — **現 Phase 2 は expose 維持 + RLS 必須** |

---

## 8. 作業6 — Index / Performance

RLS `USING` 句と Index 対応（`db/tlv_schema.sql` 確認済）。

| 確認対象 | DDL 実列 | Index | 判定 |
| --- | --- | --- | --- |
| viewer_wallets.user_id | ✅ uuid | `viewer_wallets_user_id_idx` UNIQUE | ✅ |
| payments.payer_user_uuid | ✅ | `payments_payer_uuid_idx` partial | ✅ |
| tips.payer_user_uuid | ✅ | `tips_payer_uuid_idx` partial | ✅ |
| tips.creator_user_id | ❌ **列なし** | — | RLS は **`creator_id`** · `tips_creator_created_idx` ✅ |
| wallet_ledger.user_id | ✅ | `wallet_ledger_user_time_idx` | ✅ |
| wallet_ledger.wallet_id | ✅ | `wallet_ledger_wallet_time_idx` | ✅ |
| coin_lots.user_id | ✅ | `coin_lots_user_fifo_idx` partial | ✅ |
| coin_lots.wallet_id | ✅ | `coin_lots_wallet_fifo_idx` partial | ✅ |
| creator_score_events.creator_user_id | ❌ **列なし** | — | **`creator_id`** · `creator_score_events_creator_time_idx` ✅ |
| stream_events.stream_id | ✅ | `stream_events_stream_time_idx` | ✅ |
| payment_provider_events.provider_event_id | ✅ | UNIQUE `(provider, provider_event_id)` | ✅ |

### 8.1 追加 Index 提案（migration 時 · 任意）

```sql
-- stream_events live SELECT: streams.status フィルタ
create index if not exists streams_live_id_idx
  on tlv.streams (id) where status = 'live';

-- creators RLS ヘルパー: creators.user_id は UNIQUE 制約あり → 追加不要
```

---

## 9. 作業7 — Security Review

| 脅威 | RLS 適用後 | 対策 / 備考 |
| --- | --- | --- |
| **他人 wallet 閲覧** | 🟢 低 | `user_id = auth.uid()` |
| **他人 payment 閲覧** | 🟢 低 | `payer_user_uuid = auth.uid()` |
| **coin_balance 改ざん** | 🟢 低 | UPDATE Policy なし · RPC only |
| **wallet_ledger 改ざん** | 🟢 低 | INSERT-only · クライアント deny |
| **revenue_ledger 閲覧** | 🟢 低 | Creator/Viewer deny · admin only |
| **revenue_ledger 改ざん** | 🟢 低 | INSERT-only |
| **provider_event 改ざん** | 🟢 低 | admin/service only |
| **tip 二重作成** | 🟢 低 | RPC 内 idempotency_key · tips partial UNIQUE |
| **create_tip_transaction 直接実行** | 🟢 低 | EXECUTE = service_role only · Edge 内 JWT 検証 |
| **UUID 推測** | 🟡 中 | v4 + RLS deny · Edge rate limit |
| **text ID JOIN 復活** | 🟢 低 | Policy は uuid のみ · `payer_user_id` 不使用 |
| **stream_events JPY 漏洩** | 🟢 低 | DDL に jpy 列なし · payload 規約 §9.2 · Ops lint |
| **RLS 抜け（expose+GRANT）** | 🔴→🟢 | **RLS FORCE + GRANT 整理** · staging 手動 GRANT revoke |
| **service_role 漏洩** | 🔴 致命 | Secrets · ブラウザ禁止 |
| **bot_flag 単独 gauge** | 🟡 RLS 外 | `v_apply_gauge` が `p_bot_flag` 未参照 — **CAND-P2-05** |

---

## 10. 将来対象 — Membership（設計メモのみ）

Payment Engine RLS と **Policy 独立**。実装時に追加。

| テーブル | RLS 方針（案） |
| --- | --- |
| membership_tiers | 公開 active tier SELECT · 書込 service_role |
| user_subscriptions | viewer 本人 SELECT · 書込 webhook service_role |
| subscription_invoices | viewer 本人 SELECT · creator 集計 VIEW |
| membership_events | viewer/creator 限定 SELECT · JPY キー禁止 |

---

## 11. Production 適用手順案（未実施）

1. `supabase/migrations/YYYYMMDD_tlv_payment_rls.sql` 作成（本レポート §4）
2. staging: ヘルパー関数 → ENABLE+FORCE RLS → CREATE POLICY → GRANT/REVOKE
3. staging: 手動 `GRANT ALL ROUTINES TO authenticated` があれば **revoke**
4. `scripts/test-tlv-payment-rls-staging.mjs`（新規）— JWT ロール別 SELECT/INSERT/RPC 期待
5. Edge smoke — service_role RPC 成功 · authenticated RPC 403/permission denied
6. PostgREST expose 維持 + RLS PASS 確認
7. production — **TODO-06 解消後** + staging RLS PASS のみ

---

## 12. Go / No-Go

| 項目 | 判断 |
| --- | --- |
| **TODO-07 RLS 設計** | **Go** — 方針 · マトリクス · Policy SQL · RPC · expose · Security 完了 |
| **RLS migration staging** | **Go** — `20260628150000_tlv_payment_rls.sql` · 30/30 RLS test PASS |
| **Production Payment Engine** | **No-Go** — TODO-06 chargeback · TODO-07 production migration 未適用 |

---

## 13. 関連 TODO

| ID | 状態 |
| --- | --- |
| **TODO-07** | **staging 検証済 · production 適用待ち** |
| TODO-06 | 未実装 — production blocker |
| **CAND-P2-05** | bot_flag 単独時の gauge 抑止 — RPC `v_apply_gauge` 要判断 |
| TODO-RLS-01 | RLS staging 自動テスト script |
| TODO-RLS-02 | staging 手動 GRANT 監査 + revoke |
| TODO-RLS-03 | TLV 専用 admin claim — **未実装 · 既存 talk_is_admin 使用** |
| TODO-RLS-04 | `creator_score_events` 案 A/B 確定 |
| TODO-RLS-05 | `public.tlv_*_safe` VIEW（クライアント読取列限定） |

---

## 14. 参照

- [tlv-payment-create-tip-transaction-staging-test.md](./tlv-payment-create-tip-transaction-staging-test.md)
- [tlv-payment-create-tip-transaction-rpc.md](./tlv-payment-create-tip-transaction-rpc.md)
- [sql/talk-rls-production.sql](../sql/talk-rls-production.sql)
- [Supabase Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
