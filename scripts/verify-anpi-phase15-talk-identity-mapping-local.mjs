#!/usr/bin/env node
/**
 * ANPI Phase 15 — local disposable verification of identity mapping foundation.
 * Does NOT contact staging/production. Does NOT insert talk_notifications.
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
const SCHEMA = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-foundation.sql");
const SEED = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-seed.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-rollback.sql");
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

function die(msg, code = 2) {
  console.error(`FAIL ${msg}`);
  process.exit(code);
}

function docker(args) {
  const res = spawnSync(DOCKER, args, { encoding: "utf8", shell: false, timeout: 120_000 });
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
  return docker([
    "exec", "-i", CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-Atq", "-c", sql,
  ]).trim();
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

function main() {
  const schemaExec = stripSqlComments(fs.readFileSync(SCHEMA, "utf8"));
  assert.doesNotMatch(schemaExec, new RegExp(PRODUCTION_REF));
  assert.doesNotMatch(schemaExec, /\binsert\s+into\s+public\.talk_notifications\b/i);
  console.log(`PASS local container target=${CONTAINER}`);

  psqlFile(SCHEMA, "/tmp/anpi_p15_schema.sql");
  console.log("PASS applied schema SQL on local DB");

  assert.equal(psql(`select to_regclass('public.anpi_user_contexts') is not null`), "t");
  assert.equal(psql(`select to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null`), "t");
  assert.equal(
    psql(`select c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='anpi_user_contexts'`),
    "true",
  );
  assert.equal(
    psql(`select count(*)::text from pg_policies where schemaname='public'
      and tablename='anpi_user_contexts' and policyname like '%\\_dev'`),
    "0",
  );
  assert.equal(
    psql(`select count(*)::text from pg_policies where schemaname='public'
      and tablename='anpi_user_contexts' and cmd='INSERT'`),
    "0",
  );
  assert.equal(psql(`select has_table_privilege('authenticated','public.anpi_user_contexts','INSERT')`), "f");
  assert.equal(psql(`select has_table_privilege('authenticated','public.anpi_user_contexts','SELECT')`), "t");
  assert.equal(psql(`select has_table_privilege('service_role','public.anpi_user_contexts','INSERT')`), "t");
  console.log("PASS table/RLS/grants/resolver present");

  // Fixture mapping (local only — no auth.users dependency)
  const authId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const talkId = "MbrLocalPhase15Test01";
  psql(`delete from public.anpi_user_contexts where anpi_user_id='${authId}'`);
  psql(`insert into public.anpi_user_contexts (
      auth_user_id, talk_user_id, anpi_user_id, member_id, user_id,
      mapping_source, mapping_status
    ) values (
      '${authId}'::uuid, '${talkId}', '${authId}', '${talkId}', '${talkId}',
      'local_fixture', 'approved_phase15'
    )`);

  const resolved = psql(`select public.anpi_resolve_talk_user_id('${authId}'::uuid)`);
  assert.equal(resolved, talkId);
  console.log("PASS resolver returns talk_user_id for mapped auth user");

  const unmapped = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const fallback = psql(`select public.anpi_resolve_talk_user_id('${unmapped}'::uuid)`);
  assert.equal(fallback, unmapped);
  console.log("PASS resolver falls back to auth uid text when unmapped");

  // Seed package is additive / idempotent against auth.users (may insert 0 locally)
  psqlFile(SEED, "/tmp/anpi_p15_seed.sql");
  console.log("PASS seed package applied (local auth.users may yield 0 rows)");

  // No talk_notifications pollution from this package
  const notifDelta = psql(`select count(*)::text from public.talk_notifications
    where id like 'anpi-p15%' or source = 'anpi_phase15'`);
  assert.equal(notifDelta, "0");

  // Rollback SECTION A: removes approved_phase15 + drops resolver
  psqlFile(ROLLBACK, "/tmp/anpi_p15_rollback.sql");
  assert.equal(psql(`select to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null`), "f");
  assert.equal(
    psql(`select count(*)::text from public.anpi_user_contexts where mapping_status='approved_phase15'`),
    "0",
  );
  console.log("PASS rollback removed seed rows + resolver (table retained)");

  // Re-apply schema for local continuity
  psqlFile(SCHEMA, "/tmp/anpi_p15_schema.sql");
  console.log("PASS re-applied schema after rollback smoke");

  console.log("ANPI Phase 15 local verification: PASS");
  console.log("NOTE: staging/production were not contacted.");
}

main();
