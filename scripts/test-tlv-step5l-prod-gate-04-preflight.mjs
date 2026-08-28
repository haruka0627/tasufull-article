import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const normalizedHash = (relative) => crypto.createHash("sha256")
  .update(read(relative).replace(/\r\n/g, "\n"), "utf8")
  .digest("hex");

const scope = read("reports/tlv-step5l-prod-gate-04-scope-recovery.txt");
const sql = read("reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql");
const runbook = read("reports/tlv-step5l-prod-gate-04-production-checkpoint-runbook.md");
const runner = read("scripts/test-tlv-step5l-prod-gate-04-backup-restore-isolated.ps1");

assert.match(scope, /GATE_04_SCOPE: PRODUCTION_BACKUP_RESTORE_CHECKPOINT_AND_WRITER_FREEZE_RUNBOOK_APPROVAL/);
assert.match(scope, /Parent release anchor: 959436e8514f0eb22951cc3aa24f1293bf113486/);
assert.match(scope, /GATE_04_PRODUCTION_MUTATION_SCOPE: NO/);
assert.match(scope, /LOCAL_ONLY_MIGRATION_DRIFT_SCOPE: NO/);
assert.equal(
  normalizedHash("reports/tlv-production-readiness-step5j-final-implementation-plan.md"),
  "f10342ea4dda4aa048340877a7c7c7e0e8a4c1a0cb701dfb859ac4eb6a627273",
);
assert.equal(
  normalizedHash("reports/tlv-step5l-prod-gate-03-shared-staging-parity-preflight.md"),
  "a340a3ed0a6edca250029f530c11a8fdd85e4cf3f814f45bc13dad19c952fec6",
);

const executable = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*--.*$/gm, "")
  .toLowerCase();
assert.match(executable, /^\s*begin\s*;/);
assert.match(executable, /set\s+transaction\s+read\s+only\s*;/);
assert.match(executable.trim(), /rollback\s*;$/);
assert.doesNotMatch(executable, /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|call|copy)\b/);
assert.match(sql, /ddojquacsyqesrjhcvmn/);
assert.match(sql, /ahlxuyvhzqdqaojiywmu/);
for (const key of [
  "target_count", "case_count", "full_signature_count", "exact_source_seven_sha256",
  "payout_rows", "creator_score_monthly_rows", "legacy_score_fk_present",
  "disposition_registry_present", "synthetic_correction_count", "target_migrations",
]) assert.ok(sql.includes(`'${key}'`), `missing preflight key: ${key}`);

assert.match(runbook, /CANDIDATE_REQUIRES_PRODUCTION_ACCESS_APPROVAL/);
assert.match(runbook, /ABORT_NO_CONNECTION/);
assert.match(runbook, /ABORT_REVIEW_REQUIRED/);
assert.match(runbook, /writer-freeze mechanism/i);
assert.match(runbook, /custom-format full logical database dump/);
assert.match(runbook, /encrypted exact-seven source snapshot/);
assert.match(runbook, /separate, disposable PostgreSQL 17\.6 database/);
assert.match(runbook, /do not apply migrations/i);
assert.match(runbook, /Gate 05/);

assert.match(runner, /postgres:17\.6-alpine/);
assert.match(runner, /--network none/);
assert.match(runner, /--rm/);
assert.match(runner, /:\/repo:ro/);
assert.match(runner, /pg_dump/);
assert.match(runner, /pg_restore --list/);
assert.match(runner, /chmod 600/);
assert.match(runner, /createdb -U postgres gate04_restored/);
assert.match(runner, /TLV_STEP5L_PROD_GATE_04_BACKUP_RESTORE_ISOLATED: PASS/);
assert.doesNotMatch(runner, /https?:\/\/|ddojquacsyqesrjhcvmn|ahlxuyvhzqdqaojiywmu|stripe/i);

console.log("TLV_STEP5L_PROD_GATE_04_PREFLIGHT_TEST: PASS");
console.log("GATE_04_SCOPE_RECOVERY: PASS");
console.log("PRODUCTION_SQL_STATIC_SAFETY: PASS");
console.log("PRODUCTION_ACCESSED: NO");
