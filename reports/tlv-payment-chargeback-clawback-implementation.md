# TLV Payment Engine — Chargeback / Refund / Clawback Implementation (TODO-06 P0)

**Date:** 2026-06-28  
**Scope:** P0 implementation · **staging検証済** · **production適用待ち**  
**Design:** [tlv-payment-chargeback-clawback-design.md](./tlv-payment-chargeback-clawback-design.md)

---

## Migration

| File | 内容 |
| --- | --- |
| `supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql` | DDL + RPC + RLS |

### DDL 変更

1. **`revenue_ledger`** — `revenue_ledger_amounts_chk` 置換  
   - 非 `adjustment`: gross/net/fee 等 ≥ 0  
   - `adjustment`: gross/net **負値可**（逆仕訳）

2. **`payment_reversals`** — 新規テーブル  
   - ENUM: `payment_reversal_kind` · `payment_reversal_status`  
   - UNIQUE: `provider_event_id` · `(payment_id, reversal_kind, stripe_dispute_id)`

3. **`payments.stripe_charge_id`** — lookup index

---

## RPC（service_role only · 単一 TX）

| RPC | 用途 |
| --- | --- |
| `tlv.handle_payment_refund` | `charge.refunded` / `refund.updated` |
| `tlv.handle_payment_dispute` | `dispute.created` / `dispute.closed` |
| `tlv.apply_coin_clawback_for_payment` | internal — coin + revenue + TS |
| `tlv.reverse_tip_revenue_for_lot` | internal — tip 溯源 adjustment |

### 処理順

```text
provider_events 冪等
→ payment (gross/net 分離 refund)
→ coin_lot
→ wallet (chargeback_debit · 不足→frozen)
→ tip allocation → revenue_ledger adjustment
→ creator_score_events (CHARGEBACK_RECEIVED TS-20)
→ payment_reversals
→ commit
```

**Gross/Net 分離:** Stripe `amount_refunded` は gross 累積 · `refund_amount_jpy` は net 按分 · coin claw は gross 比例。

---

## Edge Webhook

| Event | Handler |
| --- | --- |
| `charge.refunded` | `applyStripeChargeRefunded` → RPC |
| `refund.updated` | `applyStripeRefundUpdated` → RPC（charge 再取得で累積） |
| `charge.dispute.created` | `applyStripeDisputeEvent(phase=open)` |
| `charge.dispute.closed` | `applyStripeDisputeEvent(phase=won/lost)` |

**方針:** Edge → service_role RPC のみ · DB 直接更新なし · duplicate → 200 no-op

---

## Tests

| Suite | Script | Result |
| --- | --- | --- |
| Unit CB-L01〜13 | `scripts/test-tlv-payment-chargeback-logic.mjs` | **13/13 PASS** |
| Staging T-CB-01〜10 | `scripts/test-tlv-payment-chargeback-staging.mjs` | **10/10 PASS** |
| Payment Logic | `scripts/test-tlv-payment-logic.mjs` | **26/26 PASS** |
| create_tip RPC | `scripts/test-tlv-create-tip-rpc-staging.mjs` | **19/19 PASS** |
| RLS | `scripts/test-tlv-payment-rls-staging.mjs` | **30/30 PASS** |
| Edge smoke | `scripts/test-tlv-payment-edge.mjs` | **PASS** |

---

## Staging 適用

```bash
npx supabase db query --linked -f supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql
```

---

## Production Go 残タスク

| # | タスク |
| --- | --- |
| 1 | TODO-06 **production migration**（staging 検証済） |
| 2 | TODO-07 RLS **production migration** |
| 3 | Edge **production deploy**（webhook 4 event register） |
| 4 | FinOps payout 後 clawback 手順 |
| 5 | P1: Gauge extension rollback |

**Production Go/No-Go:** **No-Go** — production migration / RLS / deploy 未実施
