# TLV Deterministic Settlement Engine V1

**Status:** Local repository implementation candidate; Production and Shared Staging are not applied  
**Policy SSOT:** [`TLV_FINANCIAL_CONTRACT_SCOPE_FREEZE.md`](./TLV_FINANCIAL_CONTRACT_SCOPE_FREEZE.md)  
**Migrations:** [`20260827210000_tlv_deterministic_monthly_settlement_v1.sql`](../supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql), [`20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql`](../supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql)  
**Pure core:** [`scripts/lib/economics/tlv-settlement.mjs`](../scripts/lib/economics/tlv-settlement.mjs)  
**Date:** 2026-08-27

## 1. Boundary

The only financial ledger input is `tlv.revenue_ledger`. `tlv.monthly_settlements` is an immutable calculation snapshot, not another revenue ledger. `tlv.settlement_ledger_links` contains identifiers/correlation only and no independent financial amount.

`public.live_tips`, Rank, Score, `base_rate`, `effective_rate`, and `override_tier` are prohibited settlement inputs. New `payout_log` rows linked to a settlement must leave the legacy rate fields null.

Membership and Ads are `NOT_ENABLED`. No provider transfer, payout, refund, tax calculation, or Production action is performed by this implementation.

## 2. Deterministic calculation

For one `creator_id` and one `Asia/Tokyo` calendar month:

```text
Gross
  - verified Provider / Payment Fee
  - append-only Refund adjustment
  - append-only Chargeback adjustment
= Creator-attributed Net
```

AD-040 is applied to the aggregated Net:

The calculation uses `TLV_PROGRESSIVE_V1`. Each rate applies only to its Eligible Net portion, not to the full amount.

| Monthly Eligible Net portion | Creator marginal rate | TASFUL marginal rate |
| --- | ---: | ---: |
| `JPY 0–5,000,000` | 80% | 20% |
| `> JPY 5,000,000–10,000,000` | 90% | 10% |
| `> JPY 10,000,000–30,000,000` | 95% | 5% |
| `> JPY 30,000,000` | 99% | 1% |

The immutable snapshot distinguishes the progressive model, full bracket breakdown, highest marginal bracket/rates, and effective rates. Marginal rates must never be presented as the effective rate for the whole month.

The exact creator-month amount is floored once. Row/event/intermediate rounding and `Math.round` are not used. The fractional residual is stored. Verified attributable actual cost reduces TASFUL retained revenue only. Missing cost remains `UNAVAILABLE`; it is never inferred as zero. The result is `CONTRIBUTION_PROFIT`, not corporate net income.

The service-only `tlv.settlement_revenue_ledger_input_v1` view reconciles historical tip rows against existing `tip_coin_lot_allocations`, where actual provider/payment fee evidence already exists. It does not update historical ledger rows. New tip ledger inserts are normalized from those allocations by the canonical INSERT trigger.

## 3. Period and late events

- Economic month is `occurred_at` in `Asia/Tokyo`.
- Canonical job time is day 1 at 06:00 JST for the preceding month.
- An external UTC scheduler may run daily at 21:00 UTC; `is_settlement_job_run` admits only JST day 1 at 06:00.
- Before finalization, a late event recalculates its original JST period as a new identified version.
- After finalization, the original snapshot is never reopened. An append-only adjustment is recognized in the next OPEN period and links `adjustment_of_settlement_id`.
- The legacy UTC `ledger_month` assignment is corrected at the ledger INSERT boundary.

## 4. State and immutable snapshot

States are `OPEN`, `CALCULATED`, `REVIEWABLE`, `FINALIZED`, `TRANSFER_PENDING`, `TRANSFERRED`, `TRANSFER_UNKNOWN`, `PAID`, and `FAILED`.

The transition guard rejects invalid transitions. Every insert/transition requires a unique key, actor, timestamp, and non-empty evidence, which is copied to append-only `settlement_state_events`. Once finalized, the financial fields, source IDs, policy/calculation version, rate, rounding, carry, hold-at-finalization, amounts, cost inputs, timestamps, and hashes cannot be changed or deleted. A creator-period can have only one locked/finalized lineage.

`TRANSFER_UNKNOWN` must resolve to provider-confirmed `TRANSFERRED` or confirmed-no-transfer `FAILED`. A retry from `FAILED` requires explicit retry-safety confirmation and reuses the same deterministic instruction/idempotency key. `PAID` requires evidence of successful external payout, not merely a successful transfer.

## 5. Minimum payout, carry, and hold

- Minimum payout is JPY 1,000.
- Positive payable below the threshold is creator-specific carry-forward with no expiry.
- Positive carry-in requires the exact prior finalized settlement ID, the same creator, and an amount equal to that source's carry-out.
- Negative carry, cross-creator carry, and TASFUL reclassification fail closed.
- Account-closure residual handling remains a Human Legal/Accounting gate.

The finalized snapshot preserves hold-at-finalization. Later hold placement/release uses append-only `settlement_hold_events`. A 30-day elapsed hold escalates but does not auto-release. Release requires an explicit Human approver and evidence. Transfer checks use the evaluated current hold without mutating the finalized financial snapshot.

## 6. Transfer and tax boundary

The core can produce a deterministic instruction containing settlement, creator, provider account binding, amount, JPY currency, policy version, correlation ID, and idempotency key. It performs no provider call.

`TAX_POLICY_STATUS` is `NOT_CONFIGURED`. A Production transfer instruction fails closed until an expert-approved Tax Matrix is represented by a later reviewed policy/migration. Non-tax calculation, fixtures, mocks, and reconciliation remain usable.

## 7. Security

- Financial mutation is service-role only; authenticated clients receive SELECT only where a creator owns the settlement/payout row.
- Cross-user creator reads are denied by `tlv.is_creator_of(creator_id)`.
- Ledger links, state evidence, and hold evidence are Ops-only.
- `revenue_ledger`, ledger links, state events, and hold events are append-only even for service-role mutation paths.
- A finalized carry source can be consumed only once; Refund/Chargeback adjustments require a unique provider-event correlation.
- Settlement ledger links require non-empty correlation evidence, and payout correlation/provider IDs are unique when present.
- All relevant tables use ENABLE + FORCE RLS, deny-by-default privileges, local uniqueness, correlation, and evidence requirements.
- Isolated PostgreSQL role-level cross-user verification passed in STEP 5; Production application remains a Human Gate.

## 8. Verification

```text
node scripts/test-tlv-deterministic-settlement-engine.mjs
node scripts/test-tlv-settlement-security-contract.mjs
node scripts/judge-tlv-deterministic-settlement-step4.mjs
node scripts/test-economics-core-v1-phase1-4.mjs
node scripts/test-economics-core-v1-phase5-user-contribution.mjs
node scripts/test-tlv-payment-logic.mjs
node scripts/test-tlv-payment-chargeback-logic.mjs
node scripts/test-tlv-payment-rls-cross-user-contract.mjs
```

No SQL migration apply, provider call, financial transaction, deploy, commit, or push is part of this verification.

## 9. OPTION_A zero-legacy payout cutover boundary

STEP 5C read-only Production inventory observed `payout_log=0` and no historical payout dependency. The STEP 5D candidate therefore removes the unused OPTION_C compatibility branch:

- The migration opens an explicit transaction, takes an `ACCESS EXCLUSIVE` lock on `tlv.payout_log`, and aborts with `option_a_requires_zero_legacy_payout_log` if any row exists. The read-only inventory must be repeated before any separately approved environment apply.
- The obsolete composite `creator_score_monthly` FK is removed only after that atomic zero-row assertion. `creator_score_monthly` remains an independent analytics/ranking table and is never a Revenue Share, settlement, eligibility, or payout-amount input.
- Every payout must be created from one canonical `monthly_settlements` row. Creator, JST period, frozen JPY amount, state, and correlation must match; legacy Rank/rate inputs are null and immutable.
- `tlv.payout_log` is the provider execution/correlation owner. All corresponding fields on `monthly_settlements` are derived state-machine references and receive strict commit-time parity checks for every payout.
- `tlv.create_canonical_settlement_payout` and `tlv.transition_canonical_settlement_payout` are service-only, fixed-`search_path`, idempotent boundaries. Direct public/authenticated execution is revoked.
- Refund/Dispute remains an append-only `revenue_ledger` adjustment plus append-only `settlement_hold_events`. The old direct payout hold shape is ignored for canonical rows and no legacy payout update path remains.

The isolated PostgreSQL STEP 5D verification uses a zero-payout main database and a separate negative-control database containing one synthetic legacy payout. The main apply passes; the negative control is rejected before schema change. Production/Shared Staging application remains prohibited. STEP 5C's seven unreconciled Production ledger rows, hosted-role parity, backup/restore, tax, and provider gates still block rollout.
