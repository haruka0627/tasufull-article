#!/usr/bin/env node
/**
 * ANPI Phase 17 — static proof for first-insert readiness package.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FOUNDATION = path.join(root, "sql", "anpi-phase17-first-insert-readiness-foundation.sql");
const CLEANUP = path.join(root, "sql", "anpi-phase17-first-insert-cleanup.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase17-first-insert-readiness-rollback.sql");

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

function strip(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

const foundation = fs.readFileSync(FOUNDATION, "utf8");
const cleanup = fs.readFileSync(CLEANUP, "utf8");
const rollback = fs.readFileSync(ROLLBACK, "utf8");
const fExec = strip(foundation);
const cExec = strip(cleanup);

check("Phase 10 migration hash unchanged", () => {
  const file = path.join(
    root,
    "supabase",
    "migrations",
    "20260727100000_anpi_phase10_talk_write_path.sql",
  );
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16),
    "4fc078ea58672410",
  );
});

check("targets staging allowlist; no production host binding", () => {
  // PRODUCTION DENY: production host / project must never be an apply target
  assert.match(foundation, /ahlxuyvhzqdqaojiywmu/);
  assert.doesNotMatch(fExec, /ddojquacsyqesrjhcvmn\.supabase\.co/);
  assert.doesNotMatch(fExec, /ddojquacsyqesrjhcvmn/);
});

check("feature flag defaults OFF", () => {
  assert.match(fExec, /enabled\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.match(fExec, /anpi_phase17_emergency_disable/i);
  assert.match(fExec, /anpi_phase17_enable_flag/i);
});

check("writer is service_role-only SECURITY DEFINER with dry_run default true", () => {
  assert.match(fExec, /anpi_phase17_insert_first_test_notification/i);
  assert.match(fExec, /p_dry_run\s+boolean\s+default\s+true/i);
  assert.match(fExec, /security\s+definer/i);
  assert.match(fExec, /set\s+search_path\s*=\s*pg_catalog,\s*public/i);
  assert.match(
    fExec,
    /revoke\s+all\s+on\s+function\s+public\.anpi_phase17_insert_first_test_notification[\s\S]*from\s+public,\s*anon,\s*authenticated/i,
  );
});

check("uses canonical resolver and type anpi; target_url hash", () => {
  assert.match(fExec, /anpi_resolve_talk_user_id/i);
  assert.match(fExec, /'anpi'/);
  assert.match(fExec, /'#'/);
  assert.match(fExec, /anpi_phase17_test/);
  assert.match(fExec, /max_inserts\s+integer\s+not\s+null\s+default\s+1/i);
});

check("target bound by sha8 not raw UUID literal in package", () => {
  assert.match(fExec, /0411f04d/);
  assert.doesNotMatch(
    fExec,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
});

check("cleanup guards 0 / 1 / >1", () => {
  assert.match(cExec, /anpi_phase17_cleanup_none|matched_count\s*=\s*0/i);
  assert.match(cExec, /anpi_phase17_cleanup_ambiguous|matched_count\s*>\s*1/i);
  assert.match(cExec, /source\s*=\s*'anpi_phase17_test'/i);
  assert.match(cExec, /p_dry_run\s+boolean\s+default\s+true/i);
});

check("no Realtime / Push / mapping mutation", () => {
  assert.doesNotMatch(fExec + cExec, /\balter\s+publication\b/i);
  assert.doesNotMatch(fExec + cExec, /\bcreate\s+trigger\b/i);
  assert.doesNotMatch(fExec + cExec, /\b(delete|update|insert)\s+.*anpi_user_contexts\b/i);
});

check("rollback drops gate without touching Phase15 maps intentionally", () => {
  assert.match(strip(rollback), /drop\s+table\s+if\s+exists\s+public\.anpi_phase17_insert_gate/i);
  assert.match(rollback, /phase15_maps|anpi_user_contexts/);
});

console.log(`ANPI Phase 17 static: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
