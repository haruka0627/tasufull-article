#!/usr/bin/env node
/**
 * ANPI Phase 15 — static proof for identity mapping foundation package.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-foundation.sql");
const SEED = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-seed.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-rollback.sql");
const PHASE10 = path.join(
  root,
  "supabase",
  "migrations",
  "20260727100000_anpi_phase10_talk_write_path.sql",
);

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

function sha16(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

const schema = fs.readFileSync(SCHEMA, "utf8");
const seed = fs.readFileSync(SEED, "utf8");
const rollback = fs.readFileSync(ROLLBACK, "utf8");
const schemaExec = stripSqlComments(schema);
const seedExec = stripSqlComments(seed);
const rollbackExec = stripSqlComments(rollback);
const phase10 = fs.readFileSync(PHASE10, "utf8");

check("Phase 10 migration hash unchanged", () => {
  assert.equal(sha16(PHASE10), "4fc078ea58672410");
});

check("packages target staging allowlist / reject production ref in exec SQL", () => {
  // PRODUCTION DENY: production project ref must never appear as apply target
  assert.match(schema, /ahlxuyvhzqdqaojiywmu/);
  assert.doesNotMatch(schemaExec + seedExec, /ddojquacsyqesrjhcvmn/);
});

check("schema creates anpi_user_contexts with canonical + Phase10 columns", () => {
  assert.match(schemaExec, /create\s+table\s+if\s+not\s+exists\s+public\.anpi_user_contexts/i);
  assert.match(schemaExec, /\bauth_user_id\s+uuid\s+not\s+null\b/i);
  assert.match(schemaExec, /\btalk_user_id\s+text\s+not\s+null\b/i);
  assert.match(schemaExec, /\banpi_user_id\s+text\s+not\s+null\b/i);
  assert.match(schemaExec, /\bmember_id\s+text\s+not\s+null\b/i);
});

check("schema installs Phase 10-compatible resolver", () => {
  assert.match(schemaExec, /create\s+or\s+replace\s+function\s+public\.anpi_resolve_talk_user_id\s*\(\s*p_auth_user_id\s+uuid\s*\)/i);
  assert.match(schemaExec, /security\s+definer/i);
  assert.match(schemaExec, /set\s+search_path\s*=\s*pg_catalog,\s*public/i);
  assert.match(schemaExec, /grant\s+execute\s+on\s+function\s+public\.anpi_resolve_talk_user_id\(uuid\)\s+to\s+service_role/i);
  assert.match(schemaExec, /revoke\s+all\s+on\s+function\s+public\.anpi_resolve_talk_user_id\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
  // Same lookup contract as Phase 10
  assert.match(phase10, /where anpi_user_id = \$1/);
  assert.match(schemaExec, /where anpi_user_id = \$1/);
  assert.match(schemaExec, /select nullif\(trim\(member_id\)/);
});

check("schema RLS has no *_dev / no authenticated write policies", () => {
  assert.match(schemaExec, /enable\s+row\s+level\s+security/i);
  assert.match(schemaExec, /anpi_user_contexts_select_phase15/);
  assert.doesNotMatch(schemaExec, /create\s+policy\s+"[^"]*_dev"/i);
  assert.doesNotMatch(
    schemaExec,
    /create\s+policy\s+"[^"]+"\s+on\s+public\.anpi_user_contexts[\s\S]*?\bfor\s+(insert|update|delete)\b/i,
  );
});

check("schema least-privilege grants (no authenticated write)", () => {
  assert.match(schemaExec, /revoke\s+all\s+on\s+table\s+public\.anpi_user_contexts\s+from\s+authenticated/i);
  assert.match(schemaExec, /grant\s+select\s+on\s+table\s+public\.anpi_user_contexts\s+to\s+authenticated/i);
  assert.match(schemaExec, /grant\s+all\s+on\s+table\s+public\.anpi_user_contexts\s+to\s+service_role/i);
});

check("schema/seed have no Realtime / Push / talk_notifications INSERT", () => {
  const all = schemaExec + seedExec;
  assert.doesNotMatch(all, /\balter\s+publication\b/i);
  assert.doesNotMatch(all, /\bcreate\s+trigger\b/i);
  assert.doesNotMatch(all, /\binsert\s+into\s+public\.talk_notifications\b/i);
  assert.doesNotMatch(all, /\bdrop\s+table\b/i);
});

check("seed inserts only mismatch claim rows; no notification writes", () => {
  assert.match(seedExec, /insert\s+into\s+public\.anpi_user_contexts/i);
  assert.match(seedExec, /approved_phase15/);
  assert.match(seedExec, /app_metadata\.talk_user_id|raw_app_meta_data\s*->>\s*'talk_user_id'/i);
  assert.match(seedExec, /anpi_resolve_talk_user_id/);
});

check("default rollback does not DROP TABLE (SECTION B commented)", () => {
  assert.match(rollback, /SECTION B/);
  assert.match(rollbackExec, /delete\s+from\s+public\.anpi_user_contexts/i);
  assert.match(rollbackExec, /drop\s+function\s+if\s+exists\s+public\.anpi_resolve_talk_user_id/i);
  // Active (non-comment) DROP TABLE must not appear — already stripped comments
  assert.doesNotMatch(rollbackExec, /\bdrop\s+table\b/i);
});

console.log(`ANPI Phase 15 static: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
