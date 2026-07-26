#!/usr/bin/env node
/**
 * ANPI Phase 16 — static proof for retention purge package.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PURGE = path.join(root, "sql", "anpi-phase16-notification-retention-purge.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase16-notification-retention-rollback.sql");
const SCHED = path.join(root, "sql", "anpi-phase16-notification-retention-scheduler-disabled.sql");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

const purge = fs.readFileSync(PURGE, "utf8");
const rollback = fs.readFileSync(ROLLBACK, "utf8");
const sched = fs.readFileSync(SCHED, "utf8");
const purgeExec = stripSqlComments(purge);
const rollbackExec = stripSqlComments(rollback);

check("Phase 10 migration hash unchanged", () => {
  const file = path.join(
    root,
    "supabase",
    "migrations",
    "20260727100000_anpi_phase10_talk_write_path.sql",
  );
  const h = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
  assert.equal(h, "4fc078ea58672410");
});

check("packages target staging allowlist / no production ref in exec", () => {
  // PRODUCTION DENY: production project ref must never appear as apply target
  assert.match(purge, /ahlxuyvhzqdqaojiywmu/);
  assert.doesNotMatch(purgeExec + rollbackExec, /ddojquacsyqesrjhcvmn/);
});

check("purge function is SECURITY DEFINER with pinned search_path", () => {
  assert.match(purgeExec, /security\s+definer/i);
  assert.match(purgeExec, /set\s+search_path\s*=\s*pg_catalog,\s*public/i);
  assert.match(
    purgeExec,
    /anpi_phase16_purge_expired_talk_notifications/i,
  );
});

check("default dry_run true and service_role-only EXECUTE", () => {
  assert.match(purgeExec, /p_dry_run\s+boolean\s+default\s+true/i);
  assert.match(
    purgeExec,
    /revoke\s+all\s+on\s+function\s+public\.anpi_phase16_purge_expired_talk_notifications[\s\S]*from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    purgeExec,
    /grant\s+execute\s+on\s+function\s+public\.anpi_phase16_purge_expired_talk_notifications[\s\S]*to\s+service_role/i,
  );
});

check("purge only targets READ rows with retention; unread never deleted", () => {
  assert.match(purgeExec, /read_at\s+is\s+not\s+null/i);
  assert.match(purgeExec, /interval\s+'90\s+days'/i);
  assert.match(purgeExec, /order\s+by\s+n\.created_at\s+asc,\s*n\.id\s+asc/i);
  assert.match(purgeExec, /limit\s+v_batch/i);
  assert.match(purgeExec, /batch_size_cap_1000|p_batch_size\s*>\s*1000/i);
});

check("no publication / trigger / mapping mutation / auth.users writes", () => {
  assert.doesNotMatch(purgeExec, /\balter\s+publication\b/i);
  assert.doesNotMatch(purgeExec, /\bcreate\s+trigger\b/i);
  assert.doesNotMatch(purgeExec, /\b(delete|update|insert)\s+.*\banpi_user_contexts\b/i);
  assert.doesNotMatch(purgeExec, /\b(delete|update|insert)\s+.*\bauth\.users\b/i);
  assert.doesNotMatch(purgeExec, /\binsert\s+into\s+public\.talk_notifications\b/i);
});

check("no hard-coded UUID / secrets", () => {
  assert.doesNotMatch(purgeExec, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  assert.doesNotMatch(purge + rollback, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(purge + rollback, /service_role.*key|SUPABASE_SERVICE/i);
});

check("rollback drops function + index only; no DROP TABLE", () => {
  assert.match(rollbackExec, /drop\s+function\s+if\s+exists\s+public\.anpi_phase16_purge_expired_talk_notifications/i);
  assert.match(rollbackExec, /drop\s+index\s+if\s+exists\s+public\.talk_notifications_purge_read_created_idx/i);
  assert.doesNotMatch(rollbackExec, /\bdrop\s+table\b/i);
  assert.doesNotMatch(rollbackExec, /\bdelete\s+from\s+public\.anpi_user_contexts\b/i);
});

check("scheduler file is disabled / does not schedule", () => {
  assert.match(sched, /DO NOT RUN|DISABLED|disabled/i);
  const schedExec = stripSqlComments(sched);
  assert.doesNotMatch(schedExec, /\bcron\.schedule\b/i);
});

check("partial purge index present", () => {
  assert.match(
    purgeExec,
    /create\s+index\s+if\s+not\s+exists\s+talk_notifications_purge_read_created_idx/i,
  );
  assert.match(purgeExec, /where\s+read_at\s+is\s+not\s+null/i);
});

console.log(`ANPI Phase 16 static: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
