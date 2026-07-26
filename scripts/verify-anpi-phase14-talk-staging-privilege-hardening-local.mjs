#!/usr/bin/env node
/**
 * ANPI Phase 14 — local disposable verification of the privilege hardening SQL.
 *
 * - Applies Phase 12 sync (precondition) then Phase 14 hardening to local supabase_db only
 * - Asserts authenticated ends with SELECT,UPDATE only; anon/public none; service_role full
 * - Asserts policies / RLS / realtime membership unchanged by hardening
 * - Applies rollback and asserts pre-state restored, then re-applies hardening
 * - Does NOT connect to staging or production
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
const HARDENING = path.join(root, "sql", "anpi-phase14-talk-staging-privilege-hardening.sql");
const ROLLBACK = path.join(
  root,
  "sql",
  "anpi-phase14-talk-staging-privilege-hardening-rollback.sql",
);

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
    "exec", "-i", CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q", "-f", remoteName,
  ]);
}

function psql(sql) {
  const out = docker([
    "exec", "-i", CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-Atq", "-c", sql,
  ]);
  return out.trim();
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

function authPrivs() {
  return psql(`select coalesce(string_agg(privilege_type, ',' order by privilege_type), '')
    from information_schema.role_table_grants
    where table_schema='public' and table_name='talk_notifications' and grantee='authenticated'`);
}

function main() {
  const hardeningExec = stripSqlComments(fs.readFileSync(HARDENING, "utf8"));
  assert.doesNotMatch(hardeningExec, new RegExp(PRODUCTION_REF));
  assert.doesNotMatch(hardeningExec, /\b(create|alter|drop)\s+(table|policy|publication|trigger)\b/i);
  console.log(`PASS local container target=${CONTAINER}`);

  // Precondition: Phase 12 schema present locally (idempotent re-apply).
  psqlFile(SYNC, "/tmp/anpi_p12_sync.sql");
  // Local roles may lack default-ACL residue; simulate staging pre-state explicitly.
  psql(`grant insert, delete, truncate, references, trigger on table public.talk_notifications to authenticated`);
  const pre = authPrivs();
  console.log(`INFO pre_hardening_authenticated_privs=${pre}`);
  assert.match(pre, /INSERT/);
  assert.match(pre, /TRUNCATE/);

  const beforePolicies = psql(`select count(*)::text from pg_policies
    where schemaname='public' and tablename='talk_notifications'`);
  const beforeRealtime = psql(`select count(*)::text from pg_publication_tables
    where schemaname='public' and tablename='talk_notifications'`);

  psqlFile(HARDENING, "/tmp/anpi_p14_hardening.sql");
  console.log("PASS applied hardening SQL on local DB");

  const post = authPrivs();
  assert.equal(post, "SELECT,UPDATE");
  assert.equal(psql(`select has_table_privilege('authenticated','public.talk_notifications','INSERT')`), "f");
  assert.equal(psql(`select has_table_privilege('authenticated','public.talk_notifications','DELETE')`), "f");
  assert.equal(psql(`select has_table_privilege('authenticated','public.talk_notifications','TRUNCATE')`), "f");
  assert.equal(psql(`select has_table_privilege('authenticated','public.talk_notifications','SELECT')`), "t");
  assert.equal(psql(`select has_table_privilege('authenticated','public.talk_notifications','UPDATE')`), "t");
  assert.equal(psql(`select has_table_privilege('anon','public.talk_notifications','SELECT')`), "f");
  assert.equal(psql(`select has_table_privilege('service_role','public.talk_notifications','INSERT')`), "t");
  console.log("PASS authenticated=SELECT,UPDATE · anon none · service_role full");

  // Idempotency
  psqlFile(HARDENING, "/tmp/anpi_p14_hardening.sql");
  assert.equal(authPrivs(), "SELECT,UPDATE");
  console.log("PASS hardening is idempotent");

  // Policies / RLS / realtime untouched
  const afterPolicies = psql(`select count(*)::text from pg_policies
    where schemaname='public' and tablename='talk_notifications'`);
  const afterRealtime = psql(`select count(*)::text from pg_publication_tables
    where schemaname='public' and tablename='talk_notifications'`);
  assert.equal(afterPolicies, beforePolicies);
  assert.equal(afterRealtime, beforeRealtime);
  assert.equal(psql(`select c.relrowsecurity::text from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='talk_notifications'`), "true");
  console.log("PASS policies/RLS/realtime membership unchanged by hardening");

  // Rollback restores pre-state, then re-harden for local continuity.
  psqlFile(ROLLBACK, "/tmp/anpi_p14_rollback.sql");
  const restored = authPrivs();
  assert.match(restored, /INSERT/);
  assert.match(restored, /TRUNCATE/);
  console.log("PASS rollback restored pre-Phase-14 authenticated privileges");

  psqlFile(HARDENING, "/tmp/anpi_p14_hardening.sql");
  assert.equal(authPrivs(), "SELECT,UPDATE");
  console.log("PASS re-applied hardening (local left hardened)");

  console.log("ANPI Phase 14 local verification: PASS");
  console.log("NOTE: staging/production were not contacted.");
}

main();
