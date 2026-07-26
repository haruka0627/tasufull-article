#!/usr/bin/env node
/**
 * ANPI Phase 12 — static verification of staging schema sync package.
 * No remote DB connection.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

const syncPath = path.join(root, "sql", "anpi-phase12-talk-staging-schema-sync.sql");
const rollbackPath = path.join(root, "sql", "anpi-phase12-talk-staging-schema-sync-rollback.sql");
const reportPath = path.join(root, "reports", "anpi-phase12-talk-staging-schema-sync.md");
const applyPath = path.join(root, "docs", "anpi-phase12-talk-staging-schema-apply.md");
const localVerifyPath = path.join(
  root,
  "scripts",
  "verify-anpi-phase12-talk-staging-schema-local.mjs",
);

const MIGRATIONS = [
  ["20260727020000_anpi_phase2_data_foundation.sql", "4a8f4e3573c13ed3"],
  ["20260727030000_anpi_phase3_core_checkin.sql", "f340bf5b8603eade"],
  ["20260727040000_anpi_phase4_scheduler.sql", "f3d35ed96198fcf7"],
  ["20260727050000_anpi_phase5_emergency_contacts.sql", "d1b09e67aee93441"],
  ["20260727060000_anpi_phase6_delivery_worker.sql", "f5d4640574dee460"],
  ["20260727080000_anpi_phase8_talk_adapter.sql", "a0434669bd311091"],
  ["20260727090000_anpi_phase9_talk_real_adapter.sql", "6c338cc23bfa47b0"],
  ["20260727100000_anpi_phase10_talk_write_path.sql", "4fc078ea58672410"],
];

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}

function sha16(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function stripComments(sql) {
  return sql
    .split("\n")
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

const sync = read(syncPath);
const rollback = read(rollbackPath);
const report = read(reportPath);
const apply = read(applyPath);
const localVerify = read(localVerifyPath);
const execSync = stripComments(sync);
const execRollbackActive = stripComments(
  rollback.split(/SECTION B/i)[0] || rollback,
);

check("Phase 2-10 migration hashes unchanged", () => {
  for (const [name, expected] of MIGRATIONS) {
    assert.equal(sha16(path.join(root, "supabase", "migrations", name)), expected, name);
  }
});

check("package targets staging allowlist and rejects production apply automation", () => {
  assert.match(sync, new RegExp(STAGING_REF));
  assert.match(apply, new RegExp(STAGING_REF));
  assert.match(apply, new RegExp(PRODUCTION_REF));
  assert.match(apply, /自動適用禁止|DO NOT auto-apply|human/i);
  assert.doesNotMatch(localVerify, /db query --linked/);
});

check("sync SQL is additive / non-destructive", () => {
  assert.match(execSync, /create table if not exists public\.talk_notifications/i);
  assert.match(execSync, /create index if not exists talk_notifications_user_created_idx/i);
  assert.doesNotMatch(execSync, /\bdrop\s+table\b/i);
  assert.doesNotMatch(execSync, /\btruncate\b/i);
  assert.doesNotMatch(execSync, /\bdelete\s+from\b/i);
  assert.doesNotMatch(execSync, /\bupdate\s+public\./i);
  assert.doesNotMatch(execSync, /\balter\s+table\s+public\.talk_notifications\s+drop\b/i);
  assert.doesNotMatch(execSync, /\balter\s+publication\b/i);
  assert.doesNotMatch(execSync, /\bcreate\s+trigger\b/i);
});

check("sync SQL enables RLS without authenticated INSERT/DELETE or *_dev policies", () => {
  assert.match(execSync, /enable row level security/i);
  assert.match(execSync, /talk_notifications_select_phase12/);
  assert.match(execSync, /talk_notifications_update_phase12/);
  assert.doesNotMatch(execSync, /create policy[\s\S]*for insert/i);
  assert.doesNotMatch(execSync, /create policy[\s\S]*for delete/i);
  assert.doesNotMatch(execSync, /using\s*\(\s*true\s*\)/i);
  assert.match(execSync, /drop policy if exists "talk_notifications_select_dev"/i);
});

check("canonical columns and target_url '#' default present", () => {
  for (const col of [
    "id text primary key",
    "user_id text not null",
    "type text not null",
    "title text not null",
    "body text not null",
    "target_url text not null default '#'",
    "created_at timestamptz not null",
    "read_at timestamptz",
    "source text not null",
    "priority text not null",
    "updated_at timestamptz not null",
  ]) {
    assert.match(sync, new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

check("helpers are security definer with pinned search_path", () => {
  assert.match(execSync, /talk_current_user_id[\s\S]*security definer[\s\S]*search_path = public/i);
  assert.match(execSync, /talk_is_admin[\s\S]*security definer[\s\S]*search_path = public/i);
  assert.match(execSync, /member_id/);
  assert.match(execSync, /auth\.uid\(\)::text/);
});

check("default rollback does not DROP TABLE", () => {
  assert.doesNotMatch(execRollbackActive, /\bdrop\s+table\b/i);
  assert.doesNotMatch(execRollbackActive, /\btruncate\b/i);
  assert.match(rollback, /SECTION B/);
  assert.match(rollback, /drop table if exists public\.talk_notifications/i);
});

check("docs require human review, Phase 11 re-audit, and keep Real INSERT NO-GO until re-audit", () => {
  assert.match(apply, /Phase 11/);
  assert.match(apply, /audit-anpi-phase11-talk-staging-parity/);
  assert.match(report, /Client contract/);
  assert.match(report, /NO-GO/);
  assert.match(report, /authenticated INSERT/);
  assert.match(report, /Realtime enable禁止|NO Realtime/i);
});

check("local verify script is local-only", () => {
  assert.match(localVerify, /supabase_db_tasufull-article/);
  assert.doesNotMatch(localVerify, /ahlxuyvhzqdqaojiywmu\.supabase\.co/);
  assert.match(localVerify, /PRODUCTION_REF/);
  assert.doesNotMatch(localVerify, /db query --linked/);
  assert.doesNotMatch(localVerify, /supabase\.co/);
});

console.log(`ANPI Phase 12 static: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
