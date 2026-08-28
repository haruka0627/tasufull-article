# TLV Financial Contract Scope Freeze

**STEP 4 implementation companion:** [`TLV_SETTLEMENT_ENGINE.md`](./TLV_SETTLEMENT_ENGINE.md) records the local deterministic implementation candidate. It does not change this policy freeze and has not been applied to Production or Shared Staging.

**Scope:** TLV Production Readiness STEP 2 — Financial Contract Reconciliation / Scope Freeze  
**Status:** Accepted · STEP 3B Human Financial Policy Decision Freeze applied · Production financial execution remains blocked  
**Date:** 2026-08-27  
**Policy amendment:** 2026-08-27 · STEP 3B  
**Change class:** Contract documentation only · no DB/runtime/provider change

## 1. SSOT hierarchy

This document reconciles existing repository evidence. It does not override an ADR or make an unresolved business decision.

1. `docs/adr/ADR-040-tasful-product-option-benefit-policy.md` — tip revenue-share bands.
2. `docs/adr/ADR-043-tasful-creator-customer-benefit-economics-policy.md` — non-cash Creator Benefit boundary.
3. `docs/adr/ADR-021-tlv-creator-economy-v1.md` — AD-040 reconciliation and explicit supersession of Rank/Score share rules.
4. `docs/TLV_DB_SCHEMA.md` and `db/tlv_schema.sql` — current financial objects and relations.
5. Applied SQL migrations — current local runtime contract candidates.
6. `docs/TLV_PAYMENT_ENGINE.md` — lower-level design only where it does not conflict with the ADRs or current schema.
7. Reports and simulators — evidence/history, not financial decision SSOT.

Where these sources did not determine an answer, STEP 3 recovered existing policy and STEP 3B recorded the Human Decisions in this document. Historical evidence is in [`STEP 2`](../reports/tlv-production-readiness-step2-financial-contract-scope-freeze.md), [`STEP 3`](../reports/tlv-production-readiness-step3-policy-recovery.md), and [`STEP 3B`](../reports/tlv-production-readiness-step3b-human-financial-policy-decision-freeze.md).

## 2. Canonical financial flow

```text
verified Provider Event
  -> tlv.payment_provider_events
  -> tlv.payments
  -> tlv.coin_lots / wallet state
  -> tlv.tip_coin_lot_allocations
  -> tlv.tips
  -> tlv.revenue_ledger
  -> AD-040 monthly revenue-share calculation
  -> logical monthly settlement state machine
  -> tlv.payout_log
  -> Stripe Connect Transfer
  -> reconciliation
```

Rules:

- `tlv.revenue_ledger` is the sole creator-revenue financial SSOT candidate. No second revenue or settlement ledger may be introduced.
- `tlv.payment_provider_events` is the provider-event idempotency boundary; it is not a replacement revenue ledger.
- Wallet and coin-lot objects establish coin ownership/origin and consumption; they are not creator JPY revenue truth.
- `tlv.tip_coin_lot_allocations` is the existing lot-to-tip trace and web-origin allocation evidence.
- `tlv.payout_log` is the existing monthly payout execution object. It is downstream of a locked ledger snapshot and must not become an alternative revenue source.
- `public.live_tips` is a P0 UI stub. It is excluded from Production financial truth, tier inputs, settlement inputs, payout inputs, and reconciliation. Its presence may remain until a later approved implementation disables or removes the financial-looking route.

## 3. Creator revenue and AD-040 progressive contract

### 3.1 Frozen decisions

The 2026-08-28 Human Decision supersedes the former one-shot tier selection. The only accepted TLV share model is progressive application to monthly Eligible Net:

| Monthly Eligible Net portion | Creator marginal rate | TASFUL marginal rate |
| --- | ---: | ---: |
| `JPY 0–5,000,000` | 80% | 20% |
| `> JPY 5,000,000–10,000,000` | 90% | 10% |
| `> JPY 10,000,000–30,000,000` | 95% | 5% |
| `> JPY 30,000,000` | 99% | 1% |

- Rank, Score, popularity, achievement conditions, `base_rate`, and `override_tier` must not determine the rate.
- The grouping key is the existing `creator_id` plus monthly `ledger_month` shape.
- Only eligible, recognized tip revenue present in the canonical ledger snapshot can participate.
- Fraud-excluded/self-gift-review items that have not been posted to the ledger cannot participate.
- Refund and chargeback effects must be represented by adjustment rows, never by rewriting historical ledger rows.

### 3.2 STEP 3B Human Decision Freeze

The following decisions are final for the stated scope and must be implemented without silent substitution:

| Policy key | Frozen decision | Status |
| --- | --- | --- |
| `TAX_POLICY` | `EXPERT_GATE_REMAINS` — no AI/Codex tax calculation; tax-dependent Production enable is fail closed until an expert-approved Tax Matrix exists | `HUMAN_DECISION_CONFIRMED` · `EXPERT_GATE_REMAINS` |
| Revenue-share basis | Creator-attributed Net: Gross − Provider/Payment Fee − Refund − Chargeback | `FINAL` |
| `ROUNDING_POLICY` | `MONTHLY_FINAL_FLOOR_ONCE` | `FINAL` |
| `LATE_EVENT_POLICY` | `OCCURRED_AT_BEFORE_FINALIZATION_ELSE_NEXT_OPEN_ADJUSTMENT` | `FINAL` |
| `MINIMUM_PAYOUT_JPY` | `1000` | `FINAL_FOR_INITIAL_PRODUCTION` |
| `POSITIVE_CARRY_FORWARD` | `NO_EXPIRY` | `FINAL_FOR_INITIAL_PRODUCTION` |
| `HOLD_POLICY` | `30_DAY_STANDARD_WITH_NO_AUTOMATIC_RELEASE` | `FINAL` |
| `PAID_POLICY` | `EXTERNAL_PROVIDER_PAYOUT_SUCCESS_CONFIRMED` | `FINAL` |
| Membership | `NOT_ENABLED` | `FUTURE_NOT_ENABLED` |
| Ads | `NOT_ENABLED` | `FUTURE_NOT_ENABLED` |

Rounding rules:

- Do not round per ledger row, event, or intermediate calculation.
- For each creator, floor the final monthly payable once to the JPY minimum unit of ¥1.
- Preserve amount conservation and store an auditable rounding residual.

Minimum payout and positive carry-forward rules:

- Final creator payable of at least ¥1,000 is payout eligible.
- A positive payable below ¥1,000 is not transferred; it remains attributable to that creator and carries into later periods without expiry.
- Carry-forward cannot be offset against another creator or reclassified as TASFUL revenue.
- A later policy version may change ¥1,000 only by Human Decision and cannot apply retroactively to a finalized settlement.
- Account closure/withdrawal residual handling remains a separate legal/accounting/provider Human Gate and does not block deterministic core implementation.

Tax rules:

- Do not decide tax-inclusive versus tax-exclusive share basis, consumption-tax separation, creator payout tax, withholding, or tax-liability ownership without an expert-approved Tax Matrix.
- Tax-dependent Production Settlement must fail closed or return explicit `NOT_CONFIGURED`.
- The missing Tax Matrix does not block implementation, unit tests, fixtures, mocks, or deterministic QA of the non-tax settlement core.

## 4. Monthly settlement contract

### 4.1 Period and close

- Reporting timezone: `Asia/Tokyo`, consistent with the documented monthly job (`1st 06:00 JST`) and the economics adapter.
- Target period: prior calendar month.
- Existing runtime conflict: the tip RPC derives `ledger_month` in UTC, while the chargeback adjustment RPC derives it in `Asia/Tokyo`.
- Economic attribution month is the `Asia/Tokyo` calendar month of canonical `occurred_at`.
- A verified late event arriving before `FINALIZED` is attributed to its `occurred_at` month and causes Eligible Net, progressive brackets, and payable recalculation.
- A late event arriving after `FINALIZED` does not reopen or mutate the closed period and enters the next `OPEN` period as an append-only adjustment.
- No period is immutable merely because the scheduled calculation ran. Immutability starts only at `FINALIZED`.

### 4.2 Logical state machine

> The physical-gap statements below are the STEP 2/3B discovery snapshot. STEP 4 implements the missing local schema candidate in `20260827210000_tlv_deterministic_monthly_settlement_v1.sql`; Production apply remains a Human Gate.

| Logical state | Entry condition | Permitted actions | Exit / invariant |
| --- | --- | --- | --- |
| `OPEN` | Period accepts eligible ledger entries. | Append canonical ledger/adjustment rows. | No payout instruction exists. |
| `CALCULATED` | Deterministic calculation completed from an identified ledger snapshot and contract version. | Re-run with no external effect; replace an unfinalized calculation if inputs change. | Same inputs/version must produce the same result. |
| `REVIEWABLE` | Completeness, exclusion, reconciliation, and hold checks completed. | Human review; return to `CALCULATED`; place/clear an authorized hold. | Not transferable. |
| `FINALIZED` | Authorized human approves an identified immutable snapshot and calculation. | Read, audit, or append a later correcting adjustment only. | Period inputs/rate/amount cannot be mutated in place. |
| `TRANSFER_PENDING` | Finalized, payable, not held, connected-account eligibility verified, and one idempotent instruction recorded. | Submit or reconcile the same instruction. | No new idempotency key on retry. |
| `TRANSFERRED` | Stripe confirms a unique Connect Transfer and transfer ID is persisted. | Reconcile provider state; do not resubmit. | This state is distinct from bank payout completion. |
| `PAID` | Provider evidence confirms successful payout to the creator's external bank account or equivalent external destination. | Reconciliation/audit only. | `TRANSFERRED` alone must not be displayed as bank payment completed; no direct amount mutation. |
| `FAILED` | Provider confirms no successful transfer and the failure is terminal or safely retryable. | Correct cause; retry the same logical instruction after reconciliation/approval. | A timeout or unknown response is not proof of failure. |
| `TRANSFER_UNKNOWN` | Timeout, connection loss, ambiguous provider response, or local-write gap after submission. | Hold and query Stripe by stable idempotency/correlation data. | Must resolve to `TRANSFERRED` or confirmed `FAILED` before any retry. |

Existing physical `tlv.payout_status` is only a partial mapping:

| Logical | Existing physical candidate |
| --- | --- |
| `OPEN` | no row |
| `CALCULATED` | `pending` |
| `REVIEWABLE` | `pending` or `hold` |
| `FINALIZED` | `approved` |
| `TRANSFER_PENDING` | `processing` |
| `TRANSFERRED` | **not representable distinctly** |
| `PAID` | `paid` |
| `FAILED` | `failed` |

`TRANSFERRED`/`TRANSFER_UNKNOWN`, calculation version, immutable input snapshot, and settlement-to-ledger correlation require later implementation. This step does not change the enum or schema.

### 4.3 Rerun, lock, adjustment, and carry-forward rules

- `CALCULATED` is rerunnable and side-effect free. A rerun must use the same contract version and explicit snapshot identity.
- A new eligible ledger row before finalization invalidates the prior draft and returns it to `CALCULATED`.
- `REVIEWABLE -> FINALIZED` requires human approval and must record approver/time.
- After `FINALIZED`, do not edit settled ledger rows, progressive bracket snapshot, rate, or amount. Corrections are append-only adjustment rows applied to a later open period and linked to the origin.
- A finalized payout with a newly discovered liability is held before transfer. Existing one-row-per-creator/month schema cannot safely version a replacement; corrective versioning is `IMPLEMENTATION_REQUIRED`.
- Negative wallet balance is prohibited. Negative creator payable is also prohibited by the present payout shape.
- Existing recovery direction is controlled future-period deduction/carry-forward with FinOps approval and hold, or manual recovery after transfer. It must not create a second ledger or silently rewrite prior payouts.
- Positive payable below ¥1,000 carries forward for that creator without expiry and never becomes TASFUL revenue.
- Standard hold duration is up to 30 days, but elapsed time never releases a hold automatically. Release requires the reason to be resolved, required evidence, settlement/reconciliation consistency, and Human approval where required.
- An unresolved hold at 30 days escalates to a Human. AI/BOT may detect anomalies, collect evidence, recommend, and escalate; it may not finally release a monetary hold, accept risk, or force payout.

## 5. Refund, chargeback, and clawback contract

The existing `reverse_tip_revenue_for_lot`/chargeback path and append-only `event_kind = adjustment` model are reusable. Confirmed reversals allocate through the existing tip/lot relationship and must preserve origin IDs.

| Timing | Frozen behavior |
| --- | --- |
| A. Before `FINALIZED` | Post an append-only negative adjustment using the existing RPC contract. If it belongs to the open settlement snapshot, invalidate and recalculate all progressive brackets. Never update/delete the original revenue row. |
| B. After `FINALIZED`, before transfer | Fail closed: hold/block transfer, do not mutate the finalized snapshot, and record the adjustment. A corrected payout version/instruction is required before release; current schema cannot represent this safely. |
| C. After `TRANSFERRED`/`PAID` | Do not automatically reverse-send Stripe funds. Record the adjustment/shortfall, freeze or hold where the existing contract requires, and use FinOps-approved future deductions or manual recovery. No negative wallet balance and no blind provider retry. |

Refund/chargeback/reversal execution remains outside this step.

## 6. Stripe Connect boundary

- Stripe Connect is the only payout/transfer provider boundary in scope. No live account creation, onboarding, KYB, secret, API call, or transfer occurs in this step.
- The creator-to-Connected-Account binding is server/DB-owned verified data. A client request must never choose or overwrite the destination account.
- Only a `FINALIZED`, payable, not-held settlement can create one transfer instruction.
- A stable settlement/payout instruction identity must be the idempotency anchor and remain unchanged across retries.
- The Stripe idempotency key and metadata must carry non-secret internal correlation identifiers.
- Before submitting, check local instruction state. After any timeout or ambiguous result, reconcile by the same key/metadata before attempting again.
- Persist transfer ID, provider status, safe failure code, attempt timestamps, and reconciliation evidence in/alongside the existing `payout_log` contract. Do not create another revenue ledger.
- Duplicate prevention is both local uniqueness and provider idempotency; neither alone is sufficient.
- Transfer success confirmed by provider evidence maps to `TRANSFERRED`. Only provider-confirmed payout success to the creator's external bank account or equivalent external destination maps to `PAID` and the creator-facing「支払済み」label.

## 7. Future revenue boundaries

### 7.1 Membership

Classification: `FUTURE_NOT_ENABLED`.

```text
verified membership provider event
  -> membership payment/invoice producer
  -> tlv.revenue_ledger (separate membership event)
  -> common monthly settlement
```

- Membership must not be forced through wallet, coins, coin lots, or `tlv.tips`.
- It may reuse the common provider-event idempotency boundary and the common creator-revenue ledger/settlement downstream.
- Current DB enum uses `membership`; future design text also mentions `subscription_revenue`. No second event kind may be invented silently. The current schema name remains the candidate unless an explicitly reviewed migration supersedes it.
- Price, eligibility, revenue-share policy, grace, refund behavior, entitlement/payment-state authorization, tax, and provider product IDs are Human Gates.

### 7.2 Ads

Classification: `FUTURE_NOT_ENABLED`.

- No provider is selected by this document.
- Only provider-evidenced, recognized, creator-attributable actual ad revenue may enter `tlv.revenue_ledger` through the existing `ad_share` event candidate and common settlement.
- Estimated RPM, estimated revenue, impressions-only calculations, and UI projections are prohibited from the financial ledger and payout input.
- Provider, recognition policy, attribution method, invalid-traffic treatment, currency conversion, and share policy are Human Gates.

### 7.3 Creator Benefit

Classification: `FUTURE_NOT_ENABLED` for Production runtime; policy is reusable.

- AD-043 Creator Benefit is a non-cash internal-cost budget/cap, not creator revenue, cash, coin, balance, cashback, settlement, Stripe payout, or carry-forward.
- It must not enter the AD-040 Eligible Net basis, creator cash payout, or `tlv.payout_log`.
- It must not change the 80/20, 90/10, 95/5, or 99/1 progressive brackets.
- Its internal cost/accounting evidence remains separate from cash settlement and must be counted once only. Production enablement has its own approval gate.

## 8. Reconciliation contract

The reconciliation chain must be traceable without a second financial ledger:

```text
(provider, provider_event_id)
  -> payment_provider_events.id / payment_id
  -> payments.id
  -> coin_lots.payment_id
  -> tip_coin_lot_allocations.coin_lot_id / tip_id
  -> tips.id
  -> revenue_ledger.payment_id / tip_id
  -> settlement snapshot/allocation
  -> payout_log.id
  -> Stripe idempotency key / transfer_id
```

Existing reusable correlations are provider-event uniqueness, payment references, payment-to-lot, lot-to-tip allocation, and ledger `payment_id`/`tip_id` references.

Missing correlation/immutability fields or relations, to be added only in a later approved implementation:

- settlement period identity, timezone, cutoff, and finalized timestamp;
- calculation contract version, rounding policy version, Eligible Net basis, progressive breakdown, marginal and effective rates;
- immutable input snapshot identity/hash and deterministic result hash;
- settlement-to-ledger allocation or deterministic membership proof for every included row;
- corrected version/supersession relation without overwriting the finalized record;
- stable transfer instruction/idempotency key, provider attempt state, and `TRANSFER_UNKNOWN` representation;
- Stripe transfer status/reconciliation timestamps and the separate semantic needed for `PAID`;
- origin adjustment/recovery correlation through settlement and payout.

Reconciliation must prove completeness, uniqueness, amount conservation, status consistency, excluded-stub absence, and no unresolved provider outcome before `PAID`.

## 9. Scope-freeze classification

| Item | Classification | Financial decision rule |
| --- | --- | --- |
| `tlv.revenue_ledger` | `CANONICAL` | Sole creator-revenue SSOT candidate and settlement input. |
| `tlv.payment_provider_events` / `tlv.payments` / lot allocation / `tlv.tips` | `CANONICAL` | Upstream evidence and idempotent path into the ledger. |
| AD-040 `TLV_PROGRESSIVE_V1` (80/20 · 90/10 · 95/5 · 99/1) | `CANONICAL` | Marginal brackets on monthly Eligible Net; Rank/Score excluded. |
| `tlv.payout_log` | `CANONICAL` + `IMPLEMENTATION_REQUIRED` | Reuse as downstream payout object; remove Rank-dependent calculation semantics and extend safe state/correlation capability. |
| Existing refund/chargeback/clawback adjustment RPC | `CANONICAL` | Reuse append-only adjustment behavior; integrate with settlement states later. |
| `public.live_tips` | `DEPRECATED_FOR_FINANCIAL_DECISION` | UI stub only; never money truth or settlement input. |
| Rank/Score/base/override payout rules | `DEPRECATED_FOR_FINANCIAL_DECISION` | May remain historical/engagement data; never set the share rate. |
| `scripts/tlv-payout-engine.mjs` offline simulator | `DEPRECATED_FOR_FINANCIAL_DECISION` | QA/history only; no Production rate or payout authority. |
| Membership | `FUTURE_NOT_ENABLED` | Production disabled; pricing/share/payment/access decisions are a later Human Gate and do not block the core settlement implementation. |
| Ads | `FUTURE_NOT_ENABLED` | Production disabled; provider/recognition/attribution/share remain future decisions and estimates are excluded from the ledger. |
| Creator Benefit | `FUTURE_NOT_ENABLED` | Non-cash separate accounting; never cash payout or tier input. |
| Stripe Connect | `IMPLEMENTATION_REQUIRED` | Only approved external transfer boundary; `TRANSFERRED` and `PAID` semantics are frozen, but no live operation is enabled. |
| Net basis, rounding, late events, minimum payable, positive carry-forward, hold, `PAID` semantics | `CANONICAL` | Frozen by STEP 3B Human Decision. |
| Tax Matrix | `HUMAN_GATE_REQUIRED` | Expert approval blocks tax-dependent Production enable only; non-tax implementation and QA may proceed fail closed. |

## 10. Production gate

The contract can guide a later implementation, but TLV Production settlement remains `BLOCKED` until:

1. an expert-approved Tax Matrix is configured for every tax-dependent Production branch;
2. one AD-040 settlement calculator is connected to `tlv.revenue_ledger` and tested;
3. the UTC/JST month conflict and amount-basis conflict are corrected;
4. settlement locking, versioning, minimum/carry-forward, hold, transfer idempotency, unknown-outcome recovery, and reconciliation are implemented;
5. `public.live_tips` cannot enter or mimic the Production money path;
6. Production financial RLS/privilege separation, webhook signature/idempotency, and audit evidence pass a separate approved gate;
7. Stripe Connect Production ownership/onboarding/KYB and external payout evidence wiring receive Human approval.

STEP 4 deterministic settlement implementation is ready to start under the frozen policy. Tax-dependent branches must remain fail closed/`NOT_CONFIGURED`; STEP 4 readiness is not Production enable approval.

No Production, Shared Staging, DB, payment, refund, transfer, payout, provider, secret, deploy, commit, or push operation was authorized by this scope freeze.
