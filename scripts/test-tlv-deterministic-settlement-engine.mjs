import assert from "node:assert/strict";
import {
  TLV_SETTLEMENT_POLICY,
  calculateTlvMonthlySettlement,
  resolveSettlementJobTarget,
  resolveLateEventPeriod,
  evaluateSettlementHold,
  markSettlementReviewable,
  finalizeSettlement,
  assertFinalizedSnapshotImmutable,
  buildTransferInstruction,
  transitionSettlement,
  buildSettlementReconciliation,
  computeTlvTipDistribution,
} from "./lib/economics/index.mjs";

const CREATOR_A = "creator-a";
const CALCULATED_AT = "2026-08-01T00:00:00.000Z";
let sequence = 0;

function row(net, overrides = {}) {
  sequence += 1;
  return {
    id: `ledger-${sequence}`,
    source_table: "tlv.revenue_ledger",
    creator_id: CREATOR_A,
    event_kind: "GIFT",
    gross_amount_jpy: net,
    fee_amount_jpy: 0,
    net_amount_jpy: net,
    occurred_at: "2026-07-15T03:00:00.000Z",
    payment_provider_event_id: `provider-event-${sequence}`,
    payment_id: `payment-${sequence}`,
    coin_lot_id: `coin-lot-${sequence}`,
    tip_id: `tip-${sequence}`,
    ...overrides,
  };
}

function calculate(ledgerRows, overrides = {}) {
  const requestedCarry = Number(overrides.carry_forward_in_jpy ?? 0);
  return calculateTlvMonthlySettlement({
    creator_id: CREATOR_A,
    settlement_period: "2026-07",
    version: 1,
    ledger_rows: ledgerRows,
    carry_forward_in_jpy: 0,
    attributable_cost_status: "UNAVAILABLE",
    calculated_at: CALCULATED_AT,
    created_at: CALCULATED_AT,
    ...(requestedCarry > 0 && !overrides.carry_forward_source ? {
      carry_forward_source: {
        settlement_id: "prior-finalized-settlement-a",
        creator_id: CREATOR_A,
        carry_forward_out_jpy: requestedCarry,
        status: "FINALIZED",
      },
    } : {}),
    ...overrides,
  });
}

function mustCalculate(ledgerRows, overrides = {}) {
  const result = calculate(ledgerRows, overrides);
  assert.equal(result.ok, true, result.error);
  return result.snapshot;
}

const progressiveCases = [
  [0, "JPY_0_TO_5M", 80, 0, 0, 0],
  [1, "JPY_0_TO_5M", 80, 0, 1, 0.8],
  [4_999_999, "JPY_0_TO_5M", 80, 3_999_999, 1_000_000, 0.2],
  [5_000_000, "JPY_0_TO_5M", 80, 4_000_000, 1_000_000, 0],
  [5_000_001, "JPY_5M_TO_10M", 90, 4_000_000, 1_000_001, 0.9],
  [9_999_999, "JPY_5M_TO_10M", 90, 8_499_999, 1_500_000, 0.1],
  [10_000_000, "JPY_5M_TO_10M", 90, 8_500_000, 1_500_000, 0],
  [10_000_001, "JPY_10M_TO_30M", 95, 8_500_000, 1_500_001, 0.95],
  [29_999_999, "JPY_10M_TO_30M", 95, 27_499_999, 2_500_000, 0.05],
  [30_000_000, "JPY_10M_TO_30M", 95, 27_500_000, 2_500_000, 0],
  [30_000_001, "JPY_ABOVE_30M", 99, 27_500_000, 2_500_001, 0.99],
  [100_000_000, "JPY_ABOVE_30M", 99, 96_800_000, 3_200_000, 0],
];
for (const [net, bracket, marginalRate, payable, retained, residual] of progressiveCases) {
  const snapshot = mustCalculate([row(net)]);
  assert.equal(snapshot.eligible_net_basis_jpy, net);
  assert.equal(snapshot.revenue_share_model, "TLV_PROGRESSIVE_V1");
  assert.equal(snapshot.applied_marginal_bracket, bracket);
  assert.equal(snapshot.creator_marginal_share_rate_pct, marginalRate);
  assert.equal(snapshot.creator_payable_current_period_jpy, payable);
  assert.equal(snapshot.tasful_retained_revenue_jpy, retained);
  assert.equal(payable + retained, net);
  assert.ok(Math.abs(snapshot.rounding_residual_jpy - residual) < 1e-9);
}
assert.equal(mustCalculate([row(30_000_000)]).tasful_retained_revenue_jpy, 2_500_000);
assert.equal(mustCalculate([row(100_000_000)]).tasful_retained_revenue_jpy, 3_200_000);
assert.throws(() => computeTlvTipDistribution(-1), /nonnegative_safe_integer/);
assert.throws(() => computeTlvTipDistribution(1.5), /nonnegative_safe_integer/);
assert.throws(() => computeTlvTipDistribution(Number.NaN), /nonnegative_safe_integer/);

// Provider/payment fee is deducted before the AD-040 Net tier.
{
  const snapshot = mustCalculate([row(5_200_000, { gross_amount_jpy: 5_300_000, fee_amount_jpy: 100_000 })]);
  assert.equal(snapshot.creator_attributed_net_jpy, 5_200_000);
  assert.equal(snapshot.applied_marginal_bracket, "JPY_5M_TO_10M");
}

// A monthly final floor occurs once; two 1-yen rows yield floor(2 * 80%) = 1.
{
  const snapshot = mustCalculate([row(1), row(1)]);
  assert.equal(snapshot.creator_amount_before_rounding_jpy, 1.6);
  assert.equal(snapshot.creator_payable_current_period_jpy, 1);
  assert.ok(Math.abs(snapshot.rounding_residual_jpy - 0.6) < 1e-9);
}

// Refund and chargeback reuse negative append-only tlv.revenue_ledger adjustment rows.
{
  const refund = row(-500, {
    event_kind: "ADJUSTMENT",
    gross_amount_jpy: -500,
    net_amount_jpy: -500,
    adjustment_kind: "REFUND",
  });
  const chargeback = row(-250, {
    event_kind: "ADJUSTMENT",
    gross_amount_jpy: -250,
    net_amount_jpy: -250,
    notes: "chargeback:qa-provider-event",
  });
  const snapshot = mustCalculate([row(2_000), refund, chargeback]);
  assert.equal(snapshot.refund_jpy, 500);
  assert.equal(snapshot.chargeback_jpy, 250);
  assert.equal(snapshot.creator_attributed_net_jpy, 1_250);
  assert.equal(snapshot.creator_payable_current_period_jpy, 1_000);
}

// Existing public.live_tips and cross-creator inputs fail closed.
assert.equal(calculate([row(1000, { source_table: "public.live_tips" })]).error, "noncanonical_financial_source");
assert.equal(calculate([row(1000, { creator_id: "creator-b" })]).error, "cross_creator_ledger_row");
assert.equal(calculate([row(1000, { event_kind: "MEMBERSHIP" })]).error, "feature_not_enabled");
assert.equal(calculate([row(1000, { event_kind: "ADS" })]).error, "feature_not_enabled");

// JST boundary and canonical preceding-month job target.
assert.equal(mustCalculate([row(1_000, { occurred_at: "2026-06-30T15:00:00.000Z" })]).settlement_period, "2026-07");
assert.equal(calculate([row(1_000, { occurred_at: "2026-06-30T14:59:59.999Z" })]).error, "ledger_row_outside_settlement_period");
assert.deepEqual(resolveSettlementJobTarget("2026-07-31T21:00:00.000Z"), {
  ok: true,
  settlement_period: "2026-07",
  timezone: "Asia/Tokyo",
});
assert.equal(resolveSettlementJobTarget("2026-08-01T21:00:00.000Z").error, "outside_canonical_settlement_job_window");

// Pre-final late events stay in their economic month; post-final events become next-OPEN adjustments.
assert.deepEqual(resolveLateEventPeriod({ occurred_at: "2026-07-31T14:59:59.999Z", original_period_finalized: false }), {
  ok: true,
  economic_period: "2026-07",
  recognition_period: "2026-07",
  append_only_adjustment: false,
  original_period_reopened: false,
});
assert.deepEqual(resolveLateEventPeriod({ occurred_at: "2026-07-31T14:59:59.999Z", original_period_finalized: true, next_open_period: "2026-08" }), {
  ok: true,
  economic_period: "2026-07",
  recognition_period: "2026-08",
  append_only_adjustment: true,
  original_period_reopened: false,
});
{
  const lateAdjustment = row(-100, {
    event_kind: "ADJUSTMENT",
    gross_amount_jpy: -100,
    net_amount_jpy: -100,
    adjustment_kind: "REFUND",
    occurred_at: "2026-07-31T14:59:59.999Z",
    recognition_period: "2026-08",
    adjustment_of_settlement_id: "finalized-july",
  });
  const result = calculateTlvMonthlySettlement({
    creator_id: CREATOR_A,
    settlement_period: "2026-08",
    version: 1,
    ledger_rows: [row(2_000, { occurred_at: "2026-08-10T00:00:00.000Z" }), lateAdjustment],
    carry_forward_in_jpy: 0,
    calculated_at: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.snapshot.refund_jpy, 100);
}

// Minimum payout and creator-specific positive, no-expiry carry-forward.
{
  const below = mustCalculate([row(1_000)], { carry_forward_in_jpy: 199 });
  assert.equal(below.final_creator_payable_jpy, 999);
  assert.equal(below.payout_amount_jpy, 0);
  assert.equal(below.carry_forward_out_jpy, 999);
  const threshold = mustCalculate([row(1_000)], { carry_forward_in_jpy: 200 });
  assert.equal(threshold.final_creator_payable_jpy, 1_000);
  assert.equal(threshold.payout_amount_jpy, 1_000);
  assert.equal(threshold.carry_forward_out_jpy, 0);
  const nextMonth = calculateTlvMonthlySettlement({
    creator_id: CREATOR_A,
    settlement_period: "2026-08",
    version: 1,
    ledger_rows: [row(500, { occurred_at: "2026-08-10T00:00:00.000Z" })],
    carry_forward_in_jpy: below.carry_forward_out_jpy,
    carry_forward_source: {
      settlement_id: below.id,
      creator_id: CREATOR_A,
      carry_forward_out_jpy: below.carry_forward_out_jpy,
      status: "FINALIZED",
    },
    calculated_at: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(nextMonth.ok, true);
  assert.equal(nextMonth.snapshot.final_creator_payable_jpy, 1_399);
  assert.equal(TLV_SETTLEMENT_POLICY.carry_forward_expiry, null);
  assert.equal(calculate([row(1_000)], { carry_forward_in_jpy: -1 }).error, "invalid_carry_forward_in");
  assert.equal(calculate([row(1_000)], {
    carry_forward_in_jpy: 200,
    carry_forward_source: { settlement_id: "creator-b-source", creator_id: "creator-b", carry_forward_out_jpy: 200, status: "FINALIZED" },
  }).error, "creator_specific_finalized_carry_source_required");
}

// Verified actual cost reduces TASFUL retained only; unavailable cost does not infer zero.
{
  const known = mustCalculate([row(10_000)], { attributable_cost_status: "COMPLETE_ACTUAL", verified_attributable_cost_jpy: 500, verified_attributable_cost_evidence_ids: ["infra-cost-actual-1"] });
  assert.equal(known.creator_payable_current_period_jpy, 8_000);
  assert.equal(known.tasful_retained_revenue_jpy, 2_000);
  assert.equal(known.contribution_profit_jpy, 1_500);
  const unknown = mustCalculate([row(10_000)]);
  assert.equal(unknown.contribution_profit_jpy, null);
}

// Hold blocks transfer; 30 elapsed days escalate but do not auto-release.
{
  const hold = { active: true, reason: "CHARGEBACK", started_at: "2026-07-01T00:00:00.000Z", evidence_ids: ["cb-1"] };
  const held = mustCalculate([row(10_000)], { hold });
  assert.equal(held.transfer_eligible_non_tax, false);
  const evaluated = evaluateSettlementHold({ hold, as_of: "2026-08-01T00:00:00.000Z" });
  assert.equal(evaluated.ok, true);
  assert.equal(evaluated.hold.active, true);
  assert.equal(evaluated.escalation_required, true);
  assert.equal(evaluated.hold.auto_release, false);
  const released = evaluateSettlementHold({ hold, as_of: "2026-08-01T00:00:00.000Z", release: { released_at: "2026-08-01T00:00:00.000Z", approved_by: "finops-human", evidence_ids: ["review-1"] } });
  assert.equal(released.hold.active, false);
  const reviewable = markSettlementReviewable(held, { reviewed_at: "2026-08-02T00:00:00.000Z", reviewed_by: "finops-reviewer" });
  const finalized = finalizeSettlement(reviewable.snapshot, { finalized_at: "2026-08-03T00:00:00.000Z", approved_by: "finops-approver", finalization_key: "held-finalize-a" });
  assert.equal(buildTransferInstruction(finalized.snapshot, { provider_account_binding: "acct-held", environment: "test" }).error, "active_hold_blocks_transfer");
  assert.equal(buildTransferInstruction(finalized.snapshot, { provider_account_binding: "acct-released", environment: "test", hold_evaluation: released }).ok, true);
}

// Calculation/finalization/idempotency, immutable final snapshot, and transfer state machine.
{
  const inputRows = [row(20_000)];
  const first = calculate(inputRows);
  const second = calculate(inputRows);
  assert.deepEqual(first, second);
  const reviewable = markSettlementReviewable(first.snapshot, { reviewed_at: "2026-08-02T00:00:00.000Z", reviewed_by: "finops-reviewer" });
  assert.equal(reviewable.ok, true);
  const finalized = finalizeSettlement(reviewable.snapshot, { finalized_at: "2026-08-03T00:00:00.000Z", approved_by: "finops-approver", finalization_key: "finalize-a-2026-07-v1" });
  assert.equal(finalized.ok, true);
  assert.equal(finalizeSettlement(finalized.snapshot, { finalization_key: "finalize-a-2026-07-v1" }).idempotent, true);
  assert.equal(finalizeSettlement(finalized.snapshot, { finalization_key: "different" }).error, "already_finalized_with_different_key");
  assert.equal(assertFinalizedSnapshotImmutable(finalized.snapshot, { ...finalized.snapshot, gross_jpy: 99 }).error, "immutable_finalized_snapshot_changed");

  const testInstruction = buildTransferInstruction(finalized.snapshot, { provider_account_binding: "acct_test_binding", environment: "test" });
  assert.equal(testInstruction.ok, true);
  assert.equal(testInstruction.instruction.provider_execution_performed, false);
  assert.equal(buildTransferInstruction(finalized.snapshot, { provider_account_binding: "acct_prod_binding", environment: "production" }).error, "tax_policy_not_configured");
  assert.equal(finalized.snapshot.production_transfer_eligible, false);
  assert.equal(finalized.snapshot.tax_policy_status, "NOT_CONFIGURED");

  const pending = transitionSettlement(finalized.snapshot, {
    to_status: "TRANSFER_PENDING", transition_key: "state-pending-1", transitioned_at: "2026-08-04T00:00:00.000Z",
    actor_id: "transfer-worker", evidence_ids: ["approval-1"], transfer_instruction: testInstruction.instruction,
  });
  assert.equal(pending.ok, true);
  assert.equal(transitionSettlement(pending.snapshot, { to_status: "PAID" }).error, "invalid_state_transition");
  const unknown = transitionSettlement(pending.snapshot, {
    to_status: "TRANSFER_UNKNOWN", transition_key: "state-unknown-1", transitioned_at: "2026-08-04T00:01:00.000Z",
    actor_id: "transfer-worker", evidence_ids: ["timeout-1"], provider_correlation_id: testInstruction.instruction.correlation_id,
  });
  assert.equal(unknown.ok, true);
  assert.equal(transitionSettlement(unknown.snapshot, {
    to_status: "FAILED", transition_key: "state-failed-bad", transitioned_at: "2026-08-04T01:00:00.000Z", actor_id: "reconciler", evidence_ids: ["probe-1"],
  }).error, "provider_no_transfer_confirmation_required");
  const failed = transitionSettlement(unknown.snapshot, {
    to_status: "FAILED", transition_key: "state-failed-1", transitioned_at: "2026-08-04T01:00:00.000Z",
    actor_id: "reconciler", evidence_ids: ["provider-no-transfer-1"], provider_confirmed_no_transfer: true,
  });
  assert.equal(failed.ok, true);
  assert.equal(transitionSettlement(failed.snapshot, {
    to_status: "TRANSFER_PENDING", transition_key: "state-retry-bad", transitioned_at: "2026-08-04T02:00:00.000Z",
    actor_id: "transfer-worker", evidence_ids: ["retry-1"], transfer_instruction: testInstruction.instruction,
  }).error, "retry_safety_confirmation_required");
  const retry = transitionSettlement(failed.snapshot, {
    to_status: "TRANSFER_PENDING", transition_key: "state-retry-1", transitioned_at: "2026-08-04T02:00:00.000Z",
    actor_id: "transfer-worker", evidence_ids: ["provider-no-transfer-1", "retry-approval-1"], transfer_instruction: testInstruction.instruction, retry_safe: true,
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.snapshot.transfer_instruction.idempotency_key, testInstruction.instruction.idempotency_key);
  const transferred = transitionSettlement(retry.snapshot, {
    to_status: "TRANSFERRED", transition_key: "state-transferred-1", transitioned_at: "2026-08-04T03:00:00.000Z",
    actor_id: "reconciler", evidence_ids: ["provider-transfer-1"], provider_transfer_id: "tr_test_1",
  });
  assert.equal(transferred.ok, true);
  const paid = transitionSettlement(transferred.snapshot, {
    to_status: "PAID", transition_key: "state-paid-1", transitioned_at: "2026-08-05T00:00:00.000Z",
    actor_id: "payout-reconciler", evidence_ids: ["external-payout-1"], provider_payout_id: "po_test_1", external_payout_confirmed: true,
  });
  assert.equal(paid.ok, true);

  const reconciliation = buildSettlementReconciliation(paid.snapshot, { payout_log_id: "payout-log-1" });
  assert.equal(reconciliation.ok, true);
  assert.equal(reconciliation.canonical_ledger, "tlv.revenue_ledger");
  assert.equal(reconciliation.second_financial_ledger_created, false);
  assert.equal(reconciliation.chains[0].provider_event_id != null, true);
  assert.equal(reconciliation.chains[0].payout_log_id, "payout-log-1");
}

console.log("TLV_DETERMINISTIC_SETTLEMENT_ENGINE_TEST: PASS");
console.log(`POLICY_VERSION: ${TLV_SETTLEMENT_POLICY.policy_version}`);
console.log("FINANCIAL_TRANSACTION_EXECUTED: NO");
