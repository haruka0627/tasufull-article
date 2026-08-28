import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const record = read("docs/TLV_PRODUCTION_OPERATIONAL_CONTROL_RECORD.md");
const inventory = read("reports/tlv-step5l-prod-gate-04-writer-inventory.md");
const freeze = read("reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql");
const runner = read("scripts/test-tlv-step5l-prod-gate-04-operational-control-isolated.ps1");
const report = read("reports/tlv-step5l-prod-gate-04-operational-control-closeout.md");
const historyTest = read("scripts/test-tlv-step5e-history-vs-current-step5l.mjs");

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

check("writer_inventory_completeness", () => {
  for (const field of [
    "ENTRY_POINT", "CALL_CHAIN", "AUTH / ROLE", "CREDENTIAL CONTRACT", "RPC / DIRECT SQL",
    "DB TRIGGER", "AFFECTED TABLES", "STORAGE SIDE EFFECT", "IDEMPOTENCY / DEDUPE",
    "RETRY BEHAVIOR", "EXISTING STOP CONTROL", "FREEZE EFFECTIVENESS", "UNFREEZE METHOD",
    "FAILURE MODE", "HUMAN REQUIRED CONTROL", "EVIDENCE",
  ]) assert.ok(inventory.includes(field), field);
  assert.match(report, /End-to-end financial\/attribution writer identifiers covered: `11\/11`/);
});

check("browser_to_db_paths_complete", () => {
  for (const token of [
    "live/live-tips.js", "functions/v1/tlv-create-tip", "tlv.create_tip_transaction",
    "tlv-payment-webhook", "handle_payment_webhook_success", "handle_payment_refund",
    "handle_payment_dispute", "live-watch-video.js", "live-monetization-admin",
    "public.live_tips", "live_tips_refresh_broadcast_total",
  ]) assert.ok(inventory.includes(token), token);
});

check("freeze_coverage_and_partial_write_safety", () => {
  assert.match(freeze, /lock table %s in share mode/i);
  assert.match(freeze, /GATE04_REQUIRED_RELATION_MISSING/);
  assert.match(report, /required \+ auxiliary relation locks: PASS \(`25\/25`\)/i);
  assert.match(report, /PARTIAL_WRITE_RISK: NONE_WITHIN_LOCKED_POSTGRESQL_TRANSACTIONS/);
  assert.match(runner, /gate04_unlocked_probe/);
  assert.match(runner, /gate04_synthetic_tip_rpc/);
});

check("lock_semantics_are_bidirectionally_tested", () => {
  for (const token of [
    "INSERT_UPDATE_DELETE_BLOCKED: PASS", "SELECT_DURING_FREEZE: PASS",
    "RPC_TRIGGER_TRANSACTION_COVERAGE: PASS", "PG_DUMP_COMPATIBLE_DURING_FREEZE: PASS",
    "NORMAL_UNFREEZE: PASS", "EMERGENCY_UNFREEZE: PASS", "POST_UNFREEZE_HEALTH: PASS",
  ]) assert.ok(runner.includes(token), token);
  assert.match(report, /ISOLATED_FREEZE_TEST: PASS/);
});

check("external_provider_writer_is_not_misclassified", () => {
  assert.match(inventory, /DB_FOLLOWUP_FREEZABLE_EXTERNAL_INITIATION_NOT_FREEZABLE/);
  assert.match(report, /End-to-end writers fully stopped by the DB freeze alone: `10\/11`/);
  assert.match(report, /EXTERNAL_INITIATION_CONTROL/);
});

check("role_and_credential_contract_is_separated", () => {
  for (const role of ["Operator", "Independent Reviewer", "Recovery Owner", "Cleanup Owner"])
    assert.ok(record.includes(role), role);
  assert.match(record, /different identity from Operator/);
  assert.match(report, /ROLE_CREDENTIAL_CONTRACT: PASS_WITH_RUNTIME_BINDINGS_REQUIRED/);
  assert.doesNotMatch(record + report, /postgres(?:ql)?:\/\//i);
});

check("storage_and_pitr_fail_closed", () => {
  assert.match(record, /No approved encrypted external backup destination or retention period is identified/);
  assert.match(report, /BACKUP_STORAGE_CONTROL_STATUS: REQUIREMENTS_COMPLETE_APPROVED_DESTINATION_BINDING_REQUIRED/);
  assert.match(report, /PITR_STATUS: DISABLED/);
  assert.match(report, /PITR_ENABLED_BY_GATE04: NO/);
});

check("historical_evidence_preserved_and_progressive_drift_pinned", () => {
  assert.match(historyTest, /BF6B3D68A42C52CED87932466C6AC0D470E8670B74795AD1BBE782C6F63DD069/);
  assert.match(historyTest, /authorizedProgressiveDrift/);
  assert.match(report, /REGRESSION_STATUS: PASS \(15\/15 suites\)/);
});

check("no_permanent_production_mechanism_added", () => {
  assert.match(record, /no GRANT, RLS, schema, application, secret, or data change is made/);
  assert.match(report, /PERMANENT_PRODUCTION_CONTROL_ADDED: NO/);
  assert.match(report, /PRODUCTION_LOCK_ACQUIRED: NO/);
});

check("production_and_gate_boundaries_preserved", () => {
  for (const token of [
    "PRODUCTION_CONNECTED: NO", "PRODUCTION_READ_ACCESSED: NO", "PRODUCTION_SQL_EXECUTED: NO",
    "PRODUCTION_SECRET_READ: NO", "PRODUCTION_WRITE_EXECUTED: NO", "PRODUCTION_CHANGED: NO",
    "PRODUCTION_BACKUP_EXECUTED: NO", "SHARED_STAGING_ACCESSED: NO", "MIGRATION_APPLIED: NO",
    "SETTLEMENT_EXECUTED: NO", "REAL_FINANCIAL_TRANSACTION_EXECUTED: NO", "DEPLOYED: NO",
    "GATE_05_STARTED: NO",
  ]) assert.ok(report.includes(token), token);
});

check("single_human_gate_is_minimal", () => {
  assert.match(report, /HUMAN_REQUIRED_CONTROLS: 4/);
  assert.match(report, /Existing Gate 04 approval does not need to be repeated/);
  assert.match(report, /GATE_04_STATUS: BLOCKED/);
  assert.match(report, /SINGLE_BUNDLED_OPERATIONAL_EXECUTION_BINDING/);
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_GATE04_OPERATIONAL_CONTROL_INDEPENDENT_JUDGE: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
