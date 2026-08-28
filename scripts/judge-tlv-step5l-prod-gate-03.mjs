import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const hash = (relative) => crypto.createHash("sha256")
  .update(fs.readFileSync(path.join(root, relative), "utf8").replace(/\r\n/g, "\n"), "utf8")
  .digest("hex");
const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, pass: false });
    console.error(`FAIL ${name}: ${error.message}`);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const report = read("reports/tlv-step5l-prod-gate-03-shared-staging-parity-preflight.md");
const scopeRecovery = read("reports/tlv-step5l-prod-gate-03-scope-recovery.txt");
const scopeFreeze = read("docs/TLV_FINANCIAL_CONTRACT_SCOPE_FREEZE.md");
const settlement = read("docs/TLV_SETTLEMENT_ENGINE.md");

check("scope_recovered_from_existing_evidence", () => {
  assert(scopeRecovery.includes("RECOVERED_SCOPE: SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY"), "recovered scope missing");
  assert(scopeRecovery.includes("43c8d4b2bd1019732c904bb81d38e74af360222c01085fbb525d32c7cac3f647"), "Gate 02 source hash missing");
  assert(scopeRecovery.includes("f10342ea4dda4aa048340877a7c7c7e0e8a4c1a0cb701dfb859ac4eb6a627273"), "STEP5J source hash missing");
  assert(/Production financial RLS\/privilege separation/.test(scopeFreeze), "scope-freeze Production gate missing");
  assert(/Production and Shared Staging are not applied/.test(settlement), "settlement environment boundary missing");
  assert(report.includes("FORMAL_SCOPE: SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY"), "formal scope mismatch");
});

check("gate02_anchor_preserved", () => {
  assert(report.includes("GATE_02_BASELINE: 70eee88b3ec88107de4e7727a0808162db3d080c"), "baseline missing");
});

check("four_migration_bytes_pinned", () => {
  const expected = new Map([
    ["supabase/migrations/20260813090000_tlv_payment_rls_production_ready_gate.sql", "6fe77b4a7941ea973a1771b80fbad6d060d9bfa74db8d55fb7a578b66dc7b92f"],
    ["supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", "2099978eb9b584674a854789b6b5f5c1f628fef978457b3768d4e8d5ce93f883"],
    ["supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql", "55f3e844fd09f6593f9589e438b73289201204be1d98ac2413b4fe8bde23858f"],
    ["supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql", "502b2ce3553fbd414370c3be4d7e3aaa9b713ee04415154e0367c1bbda52c320"],
  ]);
  for (const [relative, expectedHash] of expected) assert(hash(relative) === expectedHash, relative);
});

check("readonly_preflight_fail_closed", () => {
  const sql = read("reports/sql/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight.sql");
  const executable = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").toLowerCase();
  assert(/set\s+transaction\s+read\s+only/.test(executable), "read-only missing");
  assert(/rollback\s*;\s*$/.test(executable), "rollback missing");
  assert(!/\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|call|copy)\b/.test(executable), "mutation SQL found");
  assert(sql.includes("ahlxuyvhzqdqaojiywmu") && sql.includes("ddojquacsyqesrjhcvmn is prohibited"), "project guard missing");
});

check("postgres_17_6_isolation_evidence", () => {
  const runner = read("scripts/test-tlv-step5l-prod-gate-03-isolated.ps1");
  assert(/postgres:17\.6-alpine/.test(runner), "Gate 03 image mismatch");
  assert(/--network none/.test(runner) && /--rm/.test(runner), "Gate 03 isolation flags missing");
  assert(/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight\.sql/.test(runner), "read-only preflight not exercised");
  assert(report.includes("POSTGRES_17_6_ISOLATED_FULL_CHAIN: PASS"), "17.6 result missing");
  assert(report.includes("GATE_03_READONLY_PREFLIGHT_SQL: PASS"), "Gate 03 SQL result missing");
  assert(report.includes("ISOLATED_NETWORK: NONE"), "network isolation missing");
  assert(report.includes("ISOLATED_CONTAINER_CLEANUP: PASS"), "cleanup missing");
});

check("hosted_parity_not_fabricated", () => {
  assert(report.includes("SHARED_STAGING_APPLY: NOT_EXECUTED"), "apply status missing");
  assert(report.includes("HOSTED_JWT_POSTGREST_RLS_PARITY: NOT_EXECUTED"), "hosted status missing");
  assert(report.includes("GATE_03_VERDICT: BLOCKED"), "fail-closed verdict missing");
});

check("production_and_finance_safety", () => {
  for (const token of [
    "PRODUCTION_READ_ACCESSED: NO",
    "PRODUCTION_WRITE_EXECUTED: NO",
    "PRODUCTION_CHANGED: NO",
    "SHARED_STAGING_ACCESSED: NO",
    "SHARED_STAGING_CHANGED: NO",
    "DB_MUTATION: NO",
    "SETTLEMENT_EXECUTED: NO",
    "STRIPE_PROVIDER_OPERATION: NO",
    "REAL_FINANCIAL_TRANSACTION_EXECUTED: NO",
    "DEPLOYED: NO",
    "PUSHED: NO",
    "GATE_04_STARTED: NO",
  ]) assert(report.includes(token), token);
});

check("manifest_matches", () => {
  const lines = read("reports/tlv-step5l-prod-gate-03-sha256.txt")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"));
  assert(lines.length >= 6, "manifest too small");
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    assert(match, line);
    assert(hash(match[2]) === match[1], match[2]);
  }
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_STEP5L_PROD_GATE_03_INDEPENDENT_JUDGE: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
