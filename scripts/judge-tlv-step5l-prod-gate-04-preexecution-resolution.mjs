import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const report = read("reports/tlv-step5l-prod-gate-04-human-approval-preexecution-resolution.md");
const runbook = read("reports/tlv-step5l-prod-gate-04-production-checkpoint-runbook.md");
const plan = read("reports/tlv-production-readiness-step5j-final-implementation-plan.md");
const environments = read("docs/supabase-environments.md");
const historicalBackup = read("reports/payment-production-dashboard-verification.md");
const readiness = read("reports/tlv-payment-production-readiness.md");

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, pass: false });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

check("human_approval_recorded_without_scope_expansion", () => {
  assert.match(report, /HUMAN_APPROVAL_RECEIVED: YES/);
  assert.match(report, /does not authorize migration apply, disposition, Settlement, payout, refund, transfer/);
});

check("step5j_requires_writer_freeze", () => {
  assert.match(plan, /Require reviewed logical backup plus independently proved restore, documented recovery owner, maintenance window, and writer freeze/);
});

check("gate04_runbook_denies_invented_freeze", () => {
  assert.match(runbook, /Repository Evidence does not define a safe universal freeze command; do not invent one/);
  assert.match(runbook, /Missing any prerequisite is `ABORT_NO_CONNECTION`/);
});

check("backup_policy_is_not_represented_as_known", () => {
  assert.match(environments, /PITR なし/);
  assert.match(historicalBackup, /Backup Retention[\s\S]{0,160}API 未返却/);
  assert.match(report, /NOT_STARTED_BLOCKED_NO_APPROVED_STORAGE_CONTROL/);
});

check("generic_roles_are_not_fabricated_as_checkpoint_owners", () => {
  assert.match(readiness, /Eng \+ FinOps/);
  assert.match(report, /does not define a writer-freeze control/);
  assert.match(report, /GATE_04_CHECKPOINT_CONTROL_RECORD_REQUIRED/);
});

check("no_production_or_financial_execution_claimed", () => {
  for (const token of [
    "PRODUCTION_READ_ACCESSED: NO",
    "PRODUCTION_WRITE_EXECUTED: NO",
    "PRODUCTION_CHANGED: NO",
    "MIGRATION_APPLIED: NO",
    "DISPOSITION_INVOKED: NO",
    "SETTLEMENT_EXECUTED: NO",
    "REAL_FINANCIAL_TRANSACTION_EXECUTED: NO",
    "DEPLOYED: NO",
    "GATE_05_STARTED: NO",
  ]) assert.ok(report.includes(token), token);
});

check("credential_values_not_recorded", () => {
  assert.match(report, /Only presence\/absence was inspected/);
  assert.doesNotMatch(report, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(report, /(?:service_role|access_token|password)\s*[=:]\s*[A-Za-z0-9._-]{12,}/i);
});

check("single_bundled_human_gate_is_minimal", () => {
  assert.match(report, /Required single operational control record/);
  assert.match(report, /The existing Human approval does not need to be repeated/);
  assert.match(report, /PREEXECUTION_VERDICT: BLOCKED_FAIL_CLOSED/);
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_STEP5L_PROD_GATE_04_PREEXECUTION_JUDGE: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
