import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateTlvMonthlySettlement } from "./lib/economics/tlv-settlement.mjs";

const creator = "qa-creator";
const when = "2026-08-15T00:00:00.000Z";
const base = {
  source_table: "tlv.revenue_ledger",
  creator_id: creator,
  occurred_at: when,
  recognition_period: "2026-08",
  settlement_input_reconciled: true,
};
const eligible = { ...base, id: "real-control", event_kind: "gift", gross_amount_jpy: 4_950_000, provider_payment_fee_jpy: 0, net_amount_jpy: 4_950_000 };
const cases = [10_000, 5_000, 10_000, 10_000, 10_000, 50_000, 50_000];
const dispositionRows = cases.flatMap((amount, index) => {
  const event = `disposition-${index}`;
  const evidence = {
    settlement_disposition: "EXCLUDE_SYNTHETIC_QA",
    disposition_event_id: event,
    disposition_classification: "SYNTHETIC_QA",
    disposition_evidence_valid: true,
    disposition_complete: true,
  };
  return [
    { ...base, ...evidence, id: `source-${index}`, event_kind: "gift", disposition_source_role: "ORIGINAL_SOURCE", gross_amount_jpy: amount, provider_payment_fee_jpy: 0, net_amount_jpy: amount },
    { ...base, ...evidence, id: `correction-${index}`, event_kind: "adjustment", adjustment_kind: "SYNTHETIC_QA_NEUTRALIZATION", disposition_source_role: "ACCOUNTING_NEUTRALIZATION", gross_amount_jpy: -amount, provider_payment_fee_jpy: 0, net_amount_jpy: -amount },
  ];
});
function settle(rows) {
  return calculateTlvMonthlySettlement({ creator_id: creator, settlement_period: "2026-08", calculated_at: when, ledger_rows: rows });
}

const result = settle([eligible, ...dispositionRows]);
assert.equal(result.ok, true);
assert.equal(result.snapshot.eligible_net_basis_jpy, 4_950_000);
assert.equal(result.snapshot.applied_marginal_bracket, "JPY_0_TO_5M");
assert.equal(result.snapshot.excluded_financial_disposition_ledger_ids.length, 14);
assert.equal(result.snapshot.creator_payable_current_period_jpy, 3_960_000);
assert.equal(settle([eligible]).snapshot.applied_marginal_bracket, result.snapshot.applied_marginal_bracket);

const unknown = { ...eligible, id: "unknown", settlement_disposition: "UNKNOWN" };
assert.equal(settle([unknown]).error, "unsupported_settlement_disposition");
const partial = { ...dispositionRows[0], id: "partial", disposition_complete: false };
assert.equal(settle([partial]).error, "incomplete_settlement_disposition_evidence");
const namedOnly = { ...eligible, id: "tlv-staging-tip-01" };
assert.equal(settle([namedOnly]).snapshot.eligible_net_basis_jpy, 4_950_000);
const orphanCorrection = { ...base, id: "orphan", event_kind: "adjustment", adjustment_kind: "SYNTHETIC_QA_NEUTRALIZATION", gross_amount_jpy: -1, provider_payment_fee_jpy: 0, net_amount_jpy: -1 };
assert.equal(settle([orphanCorrection]).error, "synthetic_qa_neutralization_requires_disposition");

const migration = readFileSync(new URL("../supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql", import.meta.url), "utf8");
const registryBlock = migration.match(/create table if not exists tlv\.revenue_disposition_events \(([\s\S]*?)\n\);/i)?.[1] || "";
assert.ok(registryBlock);
assert.doesNotMatch(registryBlock, /\b(amount_jpy|gross_amount|net_amount|creator_payout|platform_revenue)\b/i);
for (const token of [
  "revenue_disposition_append_only_guard", "force row level security", "SYNTHETIC_QA_NEUTRALIZATION",
  "synthetic_qa_exact_seven_signature_required", "partial_synthetic_qa_disposition_state",
  "revenue_ledger_synthetic_qa_neutralization_source_uniq", "complete_evidence_hashes_required",
  "provider_fee_semantics", "NOT_APPLICABLE", "adjustment_of_revenue_ledger_id",
]) assert.match(migration, new RegExp(token, "i"));
assert.equal((migration.match(/\('T-TIP-/g) || []).length >= 14, true);

const fixture = readFileSync(new URL("./sql/tlv-staging-create-tip-integration.sql", import.meta.url), "utf8");
assert.match(fixture, /fixture_environment_and_unique_run_id_required/);
assert.match(fixture, /gen_random_uuid\(\)/);
assert.doesNotMatch(fixture, /a0000000-0000-4000-8000-000000000103/);
assert.match(fixture.trim(), /ROLLBACK;$/);

console.log("STEP5K unit/static regression: PASS (pre-share exclusion, fail-closed, single SSOT, fixture prevention)");
