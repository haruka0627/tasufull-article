import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const hash = (relative) => crypto.createHash("sha256")
  .update(read(relative).replace(/\r\n/g, "\n"), "utf8")
  .digest("hex");
const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
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

const report = read("reports/tlv-step5l-prod-gate-04-production-checkpoint-preflight.md");
const scope = read("reports/tlv-step5l-prod-gate-04-scope-recovery.txt");
const runbook = read("reports/tlv-step5l-prod-gate-04-production-checkpoint-runbook.md");
const sql = read("reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql");
const runner = read("scripts/test-tlv-step5l-prod-gate-04-backup-restore-isolated.ps1");

check("scope_is_recovered_not_invented", () => {
  assert(scope.includes("GATE_04_SCOPE: PRODUCTION_BACKUP_RESTORE_CHECKPOINT_AND_WRITER_FREEZE_RUNBOOK_APPROVAL"), "scope mismatch");
  assert(scope.includes("f10342ea4dda4aa048340877a7c7c7e0e8a4c1a0cb701dfb859ac4eb6a627273"), "STEP5J source missing");
  assert(scope.includes("43c8d4b2bd1019732c904bb81d38e74af360222c01085fbb525d32c7cac3f647"), "Gate 02 source missing");
  assert(scope.includes("LOCAL_ONLY_MIGRATION_DRIFT_SCOPE: NO"), "drift boundary missing");
});

check("parent_release_anchor_fixed", () => {
  assert(report.includes("959436e8514f0eb22951cc3aa24f1293bf113486"), "parent anchor missing");
  assert(report.includes("Formal scope: `PRODUCTION_BACKUP_RESTORE_CHECKPOINT_AND_WRITER_FREEZE_RUNBOOK_APPROVAL`"), "formal scope missing");
});

check("production_preflight_is_read_only", () => {
  const executable = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "").toLowerCase();
  assert(/^\s*begin\s*;/.test(executable), "transaction missing");
  assert(/set\s+transaction\s+read\s+only/.test(executable), "read-only missing");
  assert(/rollback\s*;\s*$/.test(executable), "rollback missing");
  assert(!/\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|call|copy)\b/.test(executable), "mutation keyword present");
  assert(sql.includes("full_signature_count") && sql.includes("exact_source_seven_sha256"), "exact-seven proof missing");
});

check("backup_restore_mechanics_complete", () => {
  for (const token of ["postgres:17.6-alpine", "--network none", "--rm", ":/repo:ro", "pg_dump", "pg_restore --list", "chmod 600", "gate04_restored"]) {
    assert(runner.includes(token), token);
  }
  assert(report.includes("GATE_04_BACKUP_RESTORE_ISOLATED: PASS"), "isolated PASS missing");
  assert(report.includes("ISOLATED_CONTAINER_CLEANUP: PASS"), "cleanup missing");
});

check("writer_freeze_and_retention_fail_closed", () => {
  for (const token of ["ABORT_NO_CONNECTION", "ABORT_REVIEW_REQUIRED", "writer-freeze mechanism", "encrypted", "retention", "independent reviewer", "separate, disposable PostgreSQL 17.6 database"]) {
    assert(runbook.toLowerCase().includes(token.toLowerCase()), token);
  }
  assert(runbook.includes("do not apply migrations"), "migration deny missing");
});

check("production_evidence_not_fabricated", () => {
  assert(report.includes("GATE_04_VERDICT: BLOCKED"), "blocked verdict missing");
  assert(report.includes("PRODUCTION_READ_ONLY_PREFLIGHT_EXECUTED: NO"), "Production preflight status missing");
  assert(report.includes("PRODUCTION_BACKUP_CREATED: NO"), "Production backup status missing");
  assert(report.includes("PRODUCTION_RESTORE_REHEARSED: NO"), "Production restore status missing");
  assert(report.includes("HUMAN_GATE_REQUIRED: YES"), "Human gate missing");
});

check("production_financial_and_next_gate_safety", () => {
  for (const token of [
    "PRODUCTION_READ_ACCESSED: NO", "PRODUCTION_WRITE_EXECUTED: NO", "PRODUCTION_CHANGED: NO",
    "SHARED_STAGING_ACCESSED: NO", "SHARED_STAGING_CHANGED: NO", "MIGRATION_APPLIED: NO",
    "DISPOSITION_INVOKED: NO", "SETTLEMENT_EXECUTED: NO", "STRIPE_PROVIDER_OPERATION: NO",
    "REAL_FINANCIAL_TRANSACTION_EXECUTED: NO", "DEPLOYED: NO", "PUSHED: NO", "GATE_05_STARTED: NO",
  ]) assert(report.includes(token), token);
});

check("manifest_matches", () => {
  const lines = read("reports/tlv-step5l-prod-gate-04-sha256.txt")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"));
  assert(lines.length >= 5, "manifest too small");
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    assert(match, `invalid manifest line: ${line}`);
    assert(hash(match[2]) === match[1], `hash mismatch: ${match[2]}`);
  }
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_STEP5L_PROD_GATE_04_INDEPENDENT_JUDGE: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
