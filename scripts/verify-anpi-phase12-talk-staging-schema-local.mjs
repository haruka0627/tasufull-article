#!/usr/bin/env node
/**
 * ANPI Phase 12 — local disposable verification of staging schema sync SQL.
 *
 * - Applies sync SQL to local supabase_db only
 * - Asserts table/index/RLS/policies/grants
 * - Asserts no INSERT policies / no *_dev / no realtime membership from this package
 * - Applies default rollback (policies removed)
 * - Does NOT connect to staging or production
 * - Does NOT enable Realtime / Push / ANPI real mode
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCKER =
  process.env.DOCKER_BIN ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker");
const CONTAINER = process.env.ANPI_LOCAL_DB_CONTAINER || "supabase_db_tasufull-article";
const SYNC = path.join(root, "sql", "anpi-phase12-talk-staging-schema-sync.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase12-talk-staging-schema-sync-rollback.sql");

const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

function die(msg, code = 2) {
  console.error(`FAIL ${msg}`);
  process.exit(code);
}

function docker(args, opts = {}) {
  const res = spawnSync(DOCKER, args, {
    encoding: "utf8",
    shell: false,
    timeout: opts.timeout || 120_000,
  });
  if (res.status !== 0) {
    die(`docker ${args.join(" ")}: ${(res.stderr || res.stdout || "").slice(-1500)}`);
  }
  return `${res.stdout || ""}${res.stderr || ""}`;
}

function psqlFile(localPath, remoteName) {
  docker(["cp", localPath, `${CONTAINER}:${remoteName}`]);
  return docker([
    "exec",
    "-i",
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-f",
    remoteName,
  ]);
}

function psql(sql) {
  const out = docker([
    "exec",
    "-i",
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
    "-c",
    sql,
  ]);
  return out.trim();
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

function main() {
  // Safety: never use linked remote here.
  const syncBody = fs.readFileSync(SYNC, "utf8");
  const syncExec = stripSqlComments(syncBody);
  assert.doesNotMatch(syncExec, new RegExp(PRODUCTION_REF));
  assert.match(syncBody, new RegExp(STAGING_REF));
  assert.doesNotMatch(syncExec, /\balter\s+publication\b/i);
  assert.doesNotMatch(syncExec, /\bcreate\s+trigger\b/i);
  assert.doesNotMatch(syncExec, /\bdrop\s+table\b/i);
  assert.doesNotMatch(syncExec, /\btruncate\b/i);
  assert.doesNotMatch(syncExec, /\bdelete\s+from\b/i);

  console.log(`PASS local container target=${CONTAINER}`);

  // Isolate: ensure we can detect pre-existing table without destroying unrelated data.
  const existed = psql(
    `select to_regclass('public.talk_notifications') is not null`,
  );
  console.log(`INFO pre_existing_talk_notifications=${existed}`);

  psqlFile(SYNC, "/tmp/anpi_p12_sync.sql");
  console.log("PASS applied sync SQL on local DB");

  const checks = {
    table: psql(`select to_regclass('public.talk_notifications') is not null`),
    cols: psql(`select count(*)::text from information_schema.columns
      where table_schema='public' and table_name='talk_notifications'`),
    pk: psql(`select count(*)::text from information_schema.table_constraints
      where table_schema='public' and table_name='talk_notifications' and constraint_type='PRIMARY KEY'`),
    idx: psql(`select count(*)::text from pg_indexes
      where schemaname='public' and tablename='talk_notifications'
        and indexname='talk_notifications_user_created_idx'`),
    rls: psql(`select c.relrowsecurity::text from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='talk_notifications'`),
    selectPol: psql(`select count(*)::text from pg_policies
      where schemaname='public' and tablename='talk_notifications'
        and policyname='talk_notifications_select_phase12'`),
    updatePol: psql(`select count(*)::text from pg_policies
      where schemaname='public' and tablename='talk_notifications'
        and policyname='talk_notifications_update_phase12'`),
    insertPol: psql(`select count(*)::text from pg_policies
      where schemaname='public' and tablename='talk_notifications' and cmd='INSERT'`),
    deletePol: psql(`select count(*)::text from pg_policies
      where schemaname='public' and tablename='talk_notifications' and cmd='DELETE'`),
    devPol: psql(`select count(*)::text from pg_policies
      where schemaname='public' and tablename='talk_notifications' and policyname like '%\\_dev'`),
    targetDefault: psql(`select column_default from information_schema.columns
      where table_schema='public' and table_name='talk_notifications' and column_name='target_url'`),
    realtime: psql(`select count(*)::text from pg_publication_tables
      where schemaname='public' and tablename='talk_notifications'`),
  };

  assert.equal(checks.table, "t");
  assert.equal(checks.cols, "11");
  assert.equal(checks.pk, "1");
  assert.equal(checks.idx, "1");
  assert.equal(checks.rls, "true");
  assert.equal(checks.selectPol, "1");
  assert.equal(checks.updatePol, "1");
  assert.equal(checks.insertPol, "0");
  assert.equal(checks.deletePol, "0");
  assert.equal(checks.devPol, "0");
  assert.match(checks.targetDefault, /#/);
  // Package must not add realtime membership. Pre-existing membership is tolerated as INFO.
  console.log(`INFO realtime_membership_count=${checks.realtime}`);

  // service_role-shaped insert smoke (as postgres / table owner — not a user INSERT policy test)
  psql(`insert into public.talk_notifications (id, user_id, type, title, body, source)
    values ('anpi-p12-local-fixture', 'p12-user', 'anpi', 't', 'b', 'anpi_phase12_test')
    on conflict (id) do nothing`);
  const rows = psql(
    `select count(*)::text from public.talk_notifications where id='anpi-p12-local-fixture'`,
  );
  assert.equal(rows, "1");
  console.log("PASS local owner insert + PK dedup path");

  // Cleanup fixture row only (local verification). Not part of staging apply package.
  psql(`delete from public.talk_notifications where id='anpi-p12-local-fixture'`);

  psqlFile(ROLLBACK, "/tmp/anpi_p12_rollback.sql");
  const afterRollback = psql(`select count(*)::text from pg_policies
    where schemaname='public' and tablename='talk_notifications'
      and policyname in ('talk_notifications_select_phase12','talk_notifications_update_phase12')`);
  assert.equal(afterRollback, "0");
  console.log("PASS default rollback removed Phase 12 policies");

  // Re-apply policies so local DB is left in a useful state if table was newly needed.
  // If table pre-existed with other policies, Section A rollback may have cleared them —
  // re-apply sync to restore Phase 12 hardening for local continuity.
  psqlFile(SYNC, "/tmp/anpi_p12_sync.sql");
  console.log("PASS re-applied sync after rollback smoke (local left with Phase 12 policies)");

  console.log("ANPI Phase 12 local verification: PASS");
  console.log("NOTE: staging/production were not contacted.");
}

main();
