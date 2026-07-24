# TLV Payment RLS — Staging Apply & Test Report

**Date:** 2026-06-28  
**Scope:** TODO-07 RLS migration · staging apply · **production 未適用**  
**Project:** `ddojquacsyqesrjhcvmn` (staging linked)  
**Design:** [tlv-payment-rls-design.md](./tlv-payment-rls-design.md)

---

## Executive summary

| Item | Result |
| --- | --- |
| Migration `20260628150000_tlv_payment_rls.sql` | **Applied (staging)** |
| RLS ENABLE + FORCE (10 tables) | **Confirmed** |
| Policy count | **23 policies** |
| RPC EXECUTE | **service_role only** (payment RPCs) |
| `node scripts/test-tlv-payment-logic.mjs` | **26/26 PASS** |
| `node scripts/test-tlv-create-tip-rpc-staging.mjs` | **19/19 PASS** (T-TIP-01〜10 + DB integrity) |
| `node scripts/test-tlv-payment-edge.mjs` | **PASS** |
| `node scripts/test-tlv-payment-rls-staging.mjs` | **30/30 PASS** |
| **Staging Go/No-Go** | **Go** |
| **Production Go/No-Go** | **No-Go** — TODO-06 chargeback/clawback · RLS **production 未適用** |

---

## 1. Migration contents

**File:** `supabase/migrations/20260628150000_tlv_payment_rls.sql`

| Section | Content |
| --- | --- |
| Prerequisite | `public.talk_is_admin()` (idempotent · existing TALK pattern) |
| Helpers | `tlv.jwt_talk_user_id()` · `tlv.is_creator_of(uuid)` · `tlv.is_tlv_ops_admin()` |
| Index | `streams_live_id_idx` partial (live stream_events SELECT) |
| RLS | ENABLE + FORCE on 10 Payment tables |
| Policies | Owner/payer/creator/admin SELECT · no client INSERT/UPDATE/DELETE |
| GRANT | `authenticated` SELECT only · `anon` REVOKE usage · `service_role` ALL |
| RPC | REVOKE EXECUTE from public/anon/authenticated · GRANT payment RPCs to service_role |

**Apply command (staging):**

```bash
npx supabase db query --linked -f supabase/migrations/20260628150000_tlv_payment_rls.sql
```

---

## 2. RLS enabled tables

| Table | RLS | FORCE | Policies |
| --- | --- | --- | --- |
| `viewer_wallets` | ✅ | ✅ | `vw_owner_select` · `vw_admin_select` |
| `wallet_ledger` | ✅ | ✅ | `wl_owner_select` · `wl_admin_select` |
| `coin_lots` | ✅ | ✅ | `cl_owner_select` · `cl_admin_select` |
| `payments` | ✅ | ✅ | `pay_payer_select` · `pay_admin_select` |
| `tips` | ✅ | ✅ | `tips_payer_select` · `tips_creator_select` · `tips_admin_select` |
| `tip_coin_lot_allocations` | ✅ | ✅ | `tcla_payer_select` · `tcla_admin_select` |
| `revenue_ledger` | ✅ | ✅ | `rl_admin_select` only |
| `payment_provider_events` | ✅ | ✅ | `ppe_admin_select` only |
| `stream_events` | ✅ | ✅ | `se_live_select` · `se_creator_select` · `se_admin_select` |
| `creator_score_events` | ✅ | ✅ | `cse_admin_select` only (plan B) |

---

## 3. Helper functions

| Function | Purpose | Admin hook dependency |
| --- | --- | --- |
| `tlv.jwt_talk_user_id()` | Creator RLS · JWT `talk_user_id` | `custom_access_token_hook` injects `app_metadata.talk_user_id` |
| `tlv.is_creator_of(uuid)` | Creator tip/stream SELECT | creators.user_id (text) |
| `tlv.is_tlv_ops_admin()` | Admin SELECT policies | `public.talk_is_admin()` OR `app_metadata.is_ops` |

**未完（設計上）:**

- `app_role=tlv_admin` — **未実装** · TODO-RLS-03 候補
- Admin Policy は staging 上 **authenticated + tasu_admin/is_ops JWT** で有効 · 一般 Creator/Viewer テストでは admin SELECT 未検証（Ops UI 未接続）

---

## 4. RPC privilege

| RPC | EXECUTE |
| --- | --- |
| `tlv.create_tip_transaction` | service_role only |
| `tlv.handle_payment_webhook_success` | service_role only |
| `tlv.record_payment_provider_event_terminal` | service_role only |
| `tlv.compute_gauge_pct` | service_role only |

**Verified:**

- anon → RPC `401`
- authenticated → RPC `403`
- service_role → RPC callable (`400` on invalid stream = permission OK)

**TODO-RLS-02（解消）:** staging 手動 `GRANT EXECUTE ON ALL ROUTINES IN SCHEMA tlv TO authenticated` は migration `20260628150000` で **REVOKE 済**。anon への `USAGE ON SCHEMA tlv` も revoke。

**TODO-RLS-03（保留）:** `tlv_admin` / `app_role=tlv_admin` は **新設しない**。Admin 判定は `public.talk_is_admin()` + `app_metadata.is_ops` のみ。

---

## 5. PostgREST `tlv` expose

| Environment | Config | Notes |
| --- | --- | --- |
| **staging** | `schemas = ["public", "graphql_public", "tlv"]` | Edge `client.rpc()` 要件 · [config.toml](../supabase/config.toml) |
| **production** | **変更なし** | RLS migration **適用前に expose 禁止** |

**staging expose 理由:** Edge Functions が PostgREST 経由で `tlv.create_tip_transaction` を呼ぶため。

**RLS 適用後:** authenticated 直 SELECT は Policy 下で限定 · anon は schema usage なし → `401`。

---

## 6. RLS test results (`scripts/test-tlv-payment-rls-staging.mjs`)

| Group | Tests | Result |
| --- | --- | --- |
| META RLS enabled | 10 | PASS |
| A anon deny | 6 | PASS |
| B viewer own / other | 7 | PASS |
| C creator / plan B | 4 | PASS |
| D write deny | 8 | PASS |
| E service_role | 2 | PASS |
| F dangerous RPC | 2 | PASS |

**Supporting SQL:**

- `scripts/sql/tlv-staging-rls-meta.sql`
- `scripts/sql/tlv-staging-rls-fixture.sql`
- `scripts/sql/tlv-staging-rls-cleanup.sql`

---

## 7. Payment Engine regression

| Script | Result |
| --- | --- |
| `test-tlv-payment-logic.mjs` | 26/26 PASS |
| `test-tlv-create-tip-rpc-staging.mjs` | 19/19 PASS |
| `test-tlv-payment-edge.mjs` | PASS (webhook E2E + anon guards) |

**RLS 後も `create_tip_transaction` · webhook RPC は service_role 経由で正常動作。**

---

## 8. Issues / notes

| ID | Issue | Severity | Status |
| --- | --- | --- | --- |
| RLS-01 | RLS smoke tip が integration cleanup を阻害 | 低 | `tlv-staging-rls-cleanup.sql` で解消 |
| RLS-02 | Admin SELECT Policy 未 E2E（Ops JWT なし） | 低 | TODO-RLS-03 · hook 拡張後 |
| RLS-03 | `creator_score_events` plan B — Creator 直読不可 | 設計通り | TODO-RLS-04 で Studio 要件確定 |
| CAND-P2-05 | `bot_flag` 単独 gauge 抑止 | RLS 外 | 維持 |

---

## 9. Production Go / No-Go

| Gate | Status |
| --- | --- |
| RLS design | ✅ Go |
| RLS staging migration | ✅ Go |
| RLS staging tests | ✅ Go |
| Payment Engine regression (staging) | ✅ Go |
| TODO-06 chargeback/clawback | ❌ No-Go |
| RLS production apply | ❌ No-Go（未実施） |
| **Production Payment Engine** | **No-Go** |

**Production 適用順序（案）:**

1. TODO-06 設計/実装完了
2. production で `20260628150000_tlv_payment_rls.sql` 適用
3. `test-tlv-payment-rls-staging.mjs` 相当を production read-only smoke
4. PostgREST `tlv` expose + GRANT 整理
5. Go/No-Go 再判定

---

## 10. Remaining TODO

| ID | Content |
| --- | --- |
| TODO-07 | **staging 検証済 · production 適用待ち** |
| TODO-06 | chargeback/clawback — production blocker |
| ~~TODO-RLS-02~~ | staging 手動 GRANT revoke — **migration で解消** |
| TODO-RLS-03 | Admin JWT E2E · **`tlv_admin` 新設不要/保留** |
| TODO-RLS-04 | `creator_score_events` plan A/B 確定 |
| TODO-RLS-05 | `public.tlv_*_safe` VIEW（クライアント読取） |
| CAND-P2-05 | bot_flag gauge 抑止判断 |

---

## 11. References

- [tlv-payment-rls-design.md](./tlv-payment-rls-design.md)
- [tlv-payment-create-tip-transaction-staging-test.md](./tlv-payment-create-tip-transaction-staging-test.md)
- [docs/TLV_DB_SCHEMA.md §9](../docs/TLV_DB_SCHEMA.md)
- [docs/TLV_PAYMENT_ENGINE.md §9.4](../docs/TLV_PAYMENT_ENGINE.md)
