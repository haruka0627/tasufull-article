import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = (relative) => crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(root, relative), "utf8").replace(/\r\n/g, "\n"), "utf8")
  .digest("hex");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const startAnchor = "6be64d38c8325e44f9369ae902bc78daef297ab4";
const migrations = Object.freeze([
  ["supabase/migrations/20260813090000_tlv_payment_rls_production_ready_gate.sql", "6fe77b4a7941ea973a1771b80fbad6d060d9bfa74db8d55fb7a578b66dc7b92f"],
  ["supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", "2099978eb9b584674a854789b6b5f5c1f628fef978457b3768d4e8d5ce93f883"],
  ["supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql", "55f3e844fd09f6593f9589e438b73289201204be1d98ac2413b4fe8bde23858f"],
  ["supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql", "502b2ce3553fbd414370c3be4d7e3aaa9b713ee04415154e0367c1bbda52c320"],
]);

for (const [relative, expected] of migrations) {
  assert(sha256(relative) === expected, `migration hash mismatch: ${relative}`);
}

const preflight = read("reports/sql/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight.sql");
const executable = preflight
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "")
  .toLowerCase();
assert(/^\s*begin\s*;/.test(executable), "preflight must begin a transaction");
assert(/set\s+transaction\s+read\s+only\s*;/.test(executable), "preflight must enforce read-only");
assert(/rollback\s*;\s*$/.test(executable), "preflight must rollback");
assert(!/\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|call|copy)\b/.test(executable), "preflight contains mutation SQL");
assert(preflight.includes("ahlxuyvhzqdqaojiywmu"), "staging ref guard is missing");
assert(preflight.includes("ddojquacsyqesrjhcvmn is prohibited"), "Production deny marker is missing");

const isolated = read("scripts/test-tlv-step5l-prod-gate-02-isolated.ps1");
assert(/\[string\]\$Image/.test(isolated), "isolated runner image override missing");
assert(/--network none/.test(isolated) && /--rm/.test(isolated), "isolated runner safety flags missing");
assert(/TLV_STEP5L_PROD_GATE_02_ISOLATED_FULL_CHAIN: PASS/.test(isolated), "full-chain marker missing");

const gate03Isolated = read("scripts/test-tlv-step5l-prod-gate-03-isolated.ps1");
assert(/postgres:17\.6-alpine/.test(gate03Isolated), "Gate 03 PostgreSQL version missing");
assert(/--network none/.test(gate03Isolated) && /--rm/.test(gate03Isolated), "Gate 03 isolation flags missing");
assert(/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight\.sql/.test(gate03Isolated), "Gate 03 SQL execution missing");
assert(/TLV_STEP5L_PROD_GATE_03_READONLY_PREFLIGHT_ISOLATED: PASS/.test(gate03Isolated), "Gate 03 PASS marker missing");

const report = read("reports/tlv-step5l-prod-gate-03-shared-staging-parity-preflight.md");
const scopeRecovery = read("reports/tlv-step5l-prod-gate-03-scope-recovery.txt");
assert(scopeRecovery.includes("RECOVERED_SCOPE: SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY"), "scope recovery artifact mismatch");
assert(scopeRecovery.includes("43c8d4b2bd1019732c904bb81d38e74af360222c01085fbb525d32c7cac3f647"), "Gate 02 source hash missing");
assert(scopeRecovery.includes("f10342ea4dda4aa048340877a7c7c7e0e8a4c1a0cb701dfb859ac4eb6a627273"), "STEP5J source hash missing");
for (const token of [
  `Start release anchor: \`${startAnchor}\``,
  "Formal scope: `SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY`",
  "POSTGRES_17_6_ISOLATED_FULL_CHAIN: PASS",
  "SHARED_STAGING_APPLY: PASS (4/4)",
  "HOSTED_JWT_POSTGREST_RLS_PARITY: PASS (18/18)",
  "GATE_03_VERDICT: PASS",
  "PRODUCTION_CHANGED: NO",
  "SHARED_STAGING_CHANGED: YES",
  "GATE_04_STARTED: NO",
]) assert(report.includes(token), `report token missing: ${token}`);

const hosted = JSON.parse(read("reports/tlv-step5l-prod-gate-03-hosted-parity.json"));
assert(hosted.environment === "shared_staging", "hosted evidence environment mismatch");
assert(hosted.project_ref === "ahlxuyvhzqdqaojiywmu", "hosted evidence project mismatch");
assert(hosted.production_ref_denied === true, "Production deny evidence missing");
assert(hosted.verdict === "PASS", "hosted parity failed");
assert(hosted.assertions.length === 18 && hosted.assertions.every((entry) => entry.pass), "hosted assertions mismatch");
assert(hosted.mutations.successful_writes === 0, "hosted write unexpectedly succeeded");

console.log("TLV_STEP5L_PROD_GATE_03_CLOSEOUT_TEST: PASS");
console.log("MIGRATION_HASHES: PASS (4/4)");
console.log("SHARED_STAGING_PARITY: PASS");
console.log("PRODUCTION_ACCESSED: NO");
