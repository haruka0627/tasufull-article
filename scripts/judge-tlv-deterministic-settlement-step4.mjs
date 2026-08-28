import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateTlvMonthlySettlement,
  buildTransferInstruction,
  resolveSettlementJobTarget,
} from "./lib/economics/tlv-settlement.mjs";

const creator = "judge-creator";
function ledger(net, id) {
  return {
    id: `judge-ledger-${id}`,
    source_table: "tlv.revenue_ledger",
    creator_id: creator,
    event_kind: "GIFT",
    gross_amount_jpy: net,
    fee_amount_jpy: 0,
    net_amount_jpy: net,
    occurred_at: "2026-07-20T00:00:00.000Z",
  };
}

function oracle(net) {
  const definitions = [
    [0, 5_000_000, 80, "JPY_0_TO_5M"],
    [5_000_000, 10_000_000, 90, "JPY_5M_TO_10M"],
    [10_000_000, 30_000_000, 95, "JPY_10M_TO_30M"],
    [30_000_000, null, 99, "JPY_ABOVE_30M"],
  ];
  let numerator = 0n;
  for (const [lower, upper, rate] of definitions) {
    const portion = Math.max(0, (upper == null ? net : Math.min(net, upper)) - lower);
    numerator += BigInt(portion) * BigInt(rate);
  }
  const marginal = [...definitions].reverse().find(([lower]) => net > lower) || definitions[0];
  return {
    marginalRate: marginal[2],
    marginalBracket: marginal[3],
    payable: Number(numerator / 100n),
    residualHundredths: Number(numerator % 100n),
  };
}

const values = [0, 1, 4_999_999, 5_000_000, 5_000_001, 9_999_999, 10_000_000, 10_000_001, 29_999_999, 30_000_000, 30_000_001, 100_000_000];
for (const [index, net] of values.entries()) {
  const result = calculateTlvMonthlySettlement({
    creator_id: creator,
    settlement_period: "2026-07",
    version: 7,
    ledger_rows: [ledger(net, index)],
    carry_forward_in_jpy: 0,
    calculated_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
  });
  assert.equal(result.ok, true, result.error);
  const expected = oracle(net);
  assert.equal(result.snapshot.creator_marginal_share_rate_pct, expected.marginalRate);
  assert.equal(result.snapshot.applied_marginal_bracket, expected.marginalBracket);
  assert.equal(result.snapshot.creator_payable_current_period_jpy, expected.payable);
  assert.equal(Math.round(result.snapshot.rounding_residual_jpy * 100), expected.residualHundredths);
  assert.equal(result.snapshot.tasful_retained_revenue_jpy + result.snapshot.creator_payable_current_period_jpy, net);
}

// Row partitioning cannot change a creator-month result.
const one = calculateTlvMonthlySettlement({
  creator_id: creator, settlement_period: "2026-07", version: 1,
  ledger_rows: [ledger(5_000_001, "one")], carry_forward_in_jpy: 0,
  calculated_at: "2026-08-01T00:00:00.000Z", created_at: "2026-08-01T00:00:00.000Z",
});
const many = calculateTlvMonthlySettlement({
  creator_id: creator, settlement_period: "2026-07", version: 1,
  ledger_rows: [ledger(1, "many-a"), ledger(5_000_000, "many-b")], carry_forward_in_jpy: 0,
  calculated_at: "2026-08-01T00:00:00.000Z", created_at: "2026-08-01T00:00:00.000Z",
});
assert.equal(one.snapshot.creator_payable_current_period_jpy, many.snapshot.creator_payable_current_period_jpy);
assert.equal(one.snapshot.applied_marginal_bracket, many.snapshot.applied_marginal_bracket);

assert.equal(oracle(30_000_000).payable, 27_500_000);
assert.equal(oracle(100_000_000).payable, 96_800_000);

assert.equal(resolveSettlementJobTarget("2026-12-31T21:00:00.000Z").settlement_period, "2026-12");

const fakeFinalized = { ...one.snapshot, status: "FINALIZED", finalized_at: "2026-08-02T00:00:00.000Z" };
assert.equal(buildTransferInstruction(fakeFinalized, { provider_account_binding: "judge-test", environment: "production" }).error, "tax_policy_not_configured");

const migration = readFileSync(new URL("../supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", import.meta.url), "utf8");
assert.equal((migration.match(/create table if not exists tlv\.revenue_ledger/gi) || []).length, 0);
assert.equal(/public\.live_tips/i.test(migration), false);
assert.equal(/membership_status\s*=\s*'ENABLED'|ads_status\s*=\s*'ENABLED'/i.test(migration), false);

console.log("STEP_4_INDEPENDENT_JUDGE: PASS");
console.log(`ORACLE_CASES: ${values.length}`);
console.log("SECOND_LEDGER: NO");
console.log("PROVIDER_EXECUTION: NO");
