import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeTlvTipDistribution } from "./lib/economics/tlv-tip.mjs";
import { validatePayoutPolicyContent } from "./tlv-payout-policy-content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, pass: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const cases = [
  [0, 0, 0],
  [1, 0, 1],
  [4_999_999, 3_999_999, 1_000_000],
  [5_000_000, 4_000_000, 1_000_000],
  [5_000_001, 4_000_000, 1_000_001],
  [9_999_999, 8_499_999, 1_500_000],
  [10_000_000, 8_500_000, 1_500_000],
  [10_000_001, 8_500_000, 1_500_001],
  [29_999_999, 27_499_999, 2_500_000],
  [30_000_000, 27_500_000, 2_500_000],
  [30_000_001, 27_500_000, 2_500_001],
  [100_000_000, 96_800_000, 3_200_000],
];

function oracle(eligible) {
  const brackets = [
    [0, 5_000_000, 80],
    [5_000_000, 10_000_000, 90],
    [10_000_000, 30_000_000, 95],
    [30_000_000, Number.POSITIVE_INFINITY, 99],
  ];
  let numerator = 0n;
  for (const [lower, upper, pct] of brackets) {
    const portion = Math.max(0, Math.min(eligible, upper) - lower);
    numerator += BigInt(portion) * BigInt(pct);
  }
  const creator = Number(numerator / 100n);
  return { creator, tasful: eligible - creator };
}

check("independent_progressive_oracle_12_boundaries", () => {
  for (const [eligible, expectedCreator, expectedTasful] of cases) {
    const actual = computeTlvTipDistribution(eligible);
    const expected = oracle(eligible);
    assert.deepEqual(expected, { creator: expectedCreator, tasful: expectedTasful });
    assert.equal(actual.revenue_share_model, "TLV_PROGRESSIVE_V1");
    assert.equal(actual.creator_distribution_jpy, expectedCreator);
    assert.equal(actual.tasful_share_jpy, expectedTasful);
    assert.equal(actual.creator_distribution_jpy + actual.tasful_share_jpy, eligible);
    assert.equal(actual.rate_semantics, "MARGINAL_BRACKET_ONLY");
  }
});

check("30m_and_100m_examples", () => {
  assert.deepEqual(oracle(30_000_000), { creator: 27_500_000, tasful: 2_500_000 });
  assert.deepEqual(oracle(100_000_000), { creator: 96_800_000, tasful: 3_200_000 });
});

check("marginal_and_effective_rates_are_not_whole_amount_ssot", () => {
  for (const eligible of [5_000_001, 10_000_000, 30_000_000, 100_000_000]) {
    const actual = computeTlvTipDistribution(eligible);
    assert.notEqual(
      actual.creator_distribution_jpy,
      Math.floor((eligible * actual.creator_pct) / 100),
      `whole-amount marginal rate unexpectedly matched at ${eligible}`
    );
  }
});

check("invalid_inputs_fail_closed", () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => computeTlvTipDistribution(value), /nonnegative_safe_integer/);
  }
});

check("snapshot_schema_is_progressive_and_immutable", () => {
  const migration = read("supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql");
  for (const token of [
    "eligible_net_basis_jpy",
    "revenue_share_model",
    "revenue_share_brackets",
    "applied_marginal_bracket",
    "creator_marginal_share_rate_pct",
    "creator_effective_share_rate_pct",
    "tasful_retained_revenue_jpy",
    "monthly_settlements_mutation_guard",
  ]) assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /\btier_basis_jpy\b|\bapplied_tier\b|\bcreator_share_rate_pct\b|\btasful_retained_rate_pct\b/);
});

check("option_a_uses_persisted_progressive_snapshot_amount", () => {
  const migration = read("supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql");
  assert.match(migration, /v_settlement\.payout_amount_jpy, 0, v_settlement\.payout_amount_jpy/);
  assert.match(migration, /canonical_payout_financial_identity_immutable/);
  const validation = read("scripts/sql/tlv-step5l-progressive-option-a-payout-validation.sql");
  for (const token of [
    "eligible_net_basis_jpy = 100000000",
    "creator_payable_current_period_jpy = 96800000",
    "tasful_retained_revenue_jpy = 3200000",
    "TLV_PROGRESSIVE_OPTION_A_PAYOUT_VALIDATION: PASS",
    "canonical_payout_financial_identity_immutable",
  ]) assert.ok(validation.includes(token), token);
});

check("isolated_runner_covers_full_chain_rerun_restore_cleanup", () => {
  const runner = read("scripts/test-tlv-step5l-prod-gate-02-isolated.ps1");
  for (const token of [
    "--rm", "--network", "none", "gate02_progressive", "tlv-step5-isolated-db-verify.sql",
    "tlv-step5l-progressive-option-a-payout-validation.sql", "tlv-step5k-isolated-validation.sql",
    "tlv-step5l-prod-gate-02-full-chain-validation.sql", "pg_dump", "pg_restore",
    "TLV_PROGRESSIVE_BOUNDARY_DB_VALIDATION: PASS (12/12)",
  ]) assert.ok(runner.includes(token), token);
  assert.ok(runner.split("20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql").length - 1 >= 2);
  assert.ok(runner.split("20260828210000_tlv_synthetic_qa_disposition_v1.sql").length - 1 >= 2);
});

check("production_preflight_is_read_only", () => {
  const sql = read("reports/sql/tlv-step5l-prod-gate-02-production-readonly-preflight.sql");
  assert.match(sql, /begin;/i);
  assert.match(sql, /set transaction read only;/i);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /(^|\n)\s*(insert\s+into|update\s+|delete\s+from|alter\s+|drop\s+|truncate\s+)/i);
});

check("public_candidate_explains_progressive_contract", () => {
  const result = validatePayoutPolicyContent(read("live/payout-policy.html"));
  assert.equal(result.all_pass, true, JSON.stringify(result));
  assert.doesNotMatch(read("live/live-channel-content.js"), /収益分配率"\s*,\s*value:\s*"90%"/);
});

check("legacy_simulator_is_fail_closed_and_non_authoritative", () => {
  for (const file of [
    "scripts/tlv-payout-engine.mjs",
    "scripts/tlv-payout-financial.mjs",
    "live/data/monthly-payout-decision.json",
    "live/data/creator-rank-explanation.json",
    "live/data/condition-lines.json",
  ]) assert.ok(read(file).includes("HISTORICAL_SUPERSEDED"), file);
  for (const file of ["live/tlv-creator-payout-display.js", "live/live-admin-payouts.js"]) {
    const source = read(file);
    assert.ok(source.includes("TLV_PROGRESSIVE_V1"), file);
    assert.ok(source.includes("tlv.monthly_settlements"), file);
  }
});

check("authoritative_docs_supersede_old_one_shot_policy", () => {
  const ad040 = read("docs/adr/ADR-040-tasful-product-option-benefit-policy.md");
  assert.match(ad040, /一括Tier方式ではない/);
  assert.match(ad040, /30,000,000円超部分[^\n]*99%/);
  for (const file of [
    "docs/TLV_DB_SCHEMA.md", "docs/PRICING.md", "docs/FINANCIAL_MODEL.md",
    "docs/MONETIZATION.md", "docs/LIVE_PLATFORM_CONCEPT.md", "docs/ADMIN_SYSTEM.md",
  ]) assert.match(read(file), /SUPERSESSION \(2026-08-28\)/, file);
});

check("sha256_manifest_matches", () => {
  const lines = read("reports/tlv-step5l-prod-gate-02-progressive-sha256.txt")
    .split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  assert.ok(lines.length >= 15);
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    assert.ok(match, line);
    const normalized = fs.readFileSync(path.join(root, match[2]), "utf8").replace(/\r\n/g, "\n");
    const actual = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
    assert.equal(actual, match[1], match[2]);
  }
});

check("gate02_report_closes_required_safety_fields", () => {
  const report = read("reports/tlv-step5l-prod-gate-02-revenue-share-progressive-update.md");
  for (const token of [
    "VERDICT: PASS_WITH_FINDINGS",
    "BOUNDARY_TESTS: PASS (12/12)",
    "FULL_CHAIN: PASS",
    "INDEPENDENT_JUDGE: PASS",
    "LEGACY_EFFECTIVE_REFERENCES: 0",
    "PRODUCTION_READ_ACCESSED: NO",
    "PRODUCTION_WRITE_EXECUTED: NO",
    "PRODUCTION_CHANGED: NO",
    "SHARED_STAGING_CHANGED: NO",
    "REAL_FINANCIAL_TRANSACTION_EXECUTED: NO",
    "TLV_STEP5L_PROD_GATE_03_STARTED: NO",
  ]) assert.ok(report.includes(token), token);
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_STEP5L_GATE02_PROGRESSIVE_INDEPENDENT_JUDGE: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
