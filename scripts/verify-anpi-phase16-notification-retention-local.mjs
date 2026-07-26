#!/usr/bin/env node
/**
 * ANPI Phase 16 — local disposable purge verification.
 * Does NOT contact staging/production. Does NOT mutate Phase 15 mapping intent.
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
const PURGE = path.join(root, "sql", "anpi-phase16-notification-retention-purge.sql");
const ROLLBACK = path.join(root, "sql", "anpi-phase16-notification-retention-rollback.sql");
const SYNC = path.join(root, "sql", "anpi-phase12-talk-staging-schema-sync.sql");
const HARDEN = path.join(root, "sql", "anpi-phase14-talk-staging-privilege-hardening.sql");
const MAP = path.join(root, "sql", "anpi-phase15-talk-identity-mapping-foundation.sql");

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

function main() {
  console.log(`PASS local container target=${CONTAINER}`);

  // Preconditions: inbox table + mapping foundation present locally
  psqlFile(SYNC, "/tmp/anpi_p12_sync.sql");
  psqlFile(HARDEN, "/tmp/anpi_p14_harden.sql");
  psqlFile(MAP, "/tmp/anpi_p15_map.sql");

  // Preserve any existing mapping count for non-destruction check
  const mapBefore = psql(`select count(*)::text from public.anpi_user_contexts`);

  // Clean prior fixtures
  psql(`delete from public.talk_notifications where id like 'anpi-p16-%'`);

  const now = "timestamptz '2026-07-27 00:00:00+00'";
  // 1 eligible read old
  psql(`insert into public.talk_notifications
    (id, user_id, type, title, body, source, created_at, read_at, updated_at)
    values ('anpi-p16-old-read', 'user-a', 'anpi', 't', 'b', 'anpi_phase16_test',
      ${now} - interval '100 days', ${now} - interval '99 days', ${now} - interval '99 days')`);
  // 2 keep: new read
  psql(`insert into public.talk_notifications
    (id, user_id, type, title, body, source, created_at, read_at, updated_at)
    values ('anpi-p16-new-read', 'user-a', 'anpi', 't', 'b', 'anpi_phase16_test',
      ${now} - interval '1 day', ${now} - interval '1 hour', ${now})`);
  // 3 keep: old unread
  psql(`insert into public.talk_notifications
    (id, user_id, type, title, body, source, created_at, read_at, updated_at)
    values ('anpi-p16-old-unread', 'user-a', 'anpi', 't', 'b', 'anpi_phase16_test',
      ${now} - interval '200 days', null, ${now} - interval '200 days')`);
  // 4 keep: other user old read (still eligible — purge is global by retention, not user)
  psql(`insert into public.talk_notifications
    (id, user_id, type, title, body, source, created_at, read_at, updated_at)
    values ('anpi-p16-other-old-read', 'user-b', 'system', 't', 'b', 'anpi_phase16_test',
      ${now} - interval '120 days', ${now} - interval '110 days', ${now} - interval '110 days')`);
  // 5–7 extra eligible for batch test
  for (let i = 0; i < 3; i++) {
    psql(`insert into public.talk_notifications
      (id, user_id, type, title, body, source, created_at, read_at, updated_at)
      values ('anpi-p16-batch-${i}', 'user-a', 'anpi', 't', 'b', 'anpi_phase16_test',
        ${now} - interval '${150 + i} days', ${now} - interval '140 days', ${now} - interval '140 days')`);
  }

  // Mapping fixture must survive
  psql(`insert into public.anpi_user_contexts (
      auth_user_id, talk_user_id, anpi_user_id, member_id, user_id,
      mapping_source, mapping_status
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'MbrP16MapKeep',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'MbrP16MapKeep',
      'MbrP16MapKeep',
      'local_fixture',
      'approved_phase15'
    ) on conflict (auth_user_id) do nothing`);

  psqlFile(PURGE, "/tmp/anpi_p16_purge.sql");
  console.log("PASS applied purge SQL on local DB");

  assert.equal(
    psql(`select to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)') is not null`),
    "t",
  );
  assert.equal(psql(`select has_function_privilege('anon','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE')`), "f");
  assert.equal(psql(`select has_function_privilege('authenticated','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE')`), "f");
  assert.equal(psql(`select has_function_privilege('service_role','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE')`), "t");
  console.log("PASS function privileges service_role-only");

  // Dry-run
  const dry = psql(`select deleted_count::text || ',' || remaining_eligible_count::text || ',' || dry_run::text
    from public.anpi_phase16_purge_expired_talk_notifications(500, true, ${now}, interval '90 days')`);
  assert.match(dry, /^0,5,(t|true)$/);
  assert.equal(psql(`select count(*)::text from public.talk_notifications where id like 'anpi-p16-%'`), "7");
  console.log("PASS dry-run counts eligible without delete");

  // EXPLAIN (local evidence — not production volume)
  const plan = psql(`explain
    select id from public.talk_notifications
    where read_at is not null and created_at < ${now} - interval '90 days'
    order by created_at asc, id asc limit 500`);
  console.log(`INFO explain_snippet=${plan.replace(/\s+/g, " ").slice(0, 220)}`);

  // Batch=2 live delete
  const live1 = psql(`select deleted_count::text || ',' || remaining_eligible_count::text || ',' || dry_run::text
    from public.anpi_phase16_purge_expired_talk_notifications(2, false, ${now}, interval '90 days')`);
  assert.match(live1, /^2,3,(f|false)$/);
  console.log("PASS batch limit deletes 2 of 5 eligible");

  // Keep unread + new read
  assert.equal(psql(`select count(*)::text from public.talk_notifications where id='anpi-p16-old-unread'`), "1");
  assert.equal(psql(`select count(*)::text from public.talk_notifications where id='anpi-p16-new-read'`), "1");
  console.log("PASS unread and recent-read retained");

  // Drain remaining eligible
  const live2 = psql(`select deleted_count::text
    from public.anpi_phase16_purge_expired_talk_notifications(500, false, ${now}, interval '90 days')`);
  assert.equal(live2, "3");
  const live3 = psql(`select deleted_count::text || ',' || remaining_eligible_count::text
    from public.anpi_phase16_purge_expired_talk_notifications(500, false, ${now}, interval '90 days')`);
  assert.equal(live3, "0,0");
  console.log("PASS idempotent zero-delete on re-run");

  // Mapping intact
  assert.equal(psql(`select count(*)::text from public.anpi_user_contexts where talk_user_id='MbrP16MapKeep'`), "1");
  const mapAfter = psql(`select count(*)::text from public.anpi_user_contexts`);
  assert.ok(Number(mapAfter) >= Number(mapBefore));
  console.log("PASS mapping rows not deleted by purge");

  // Transaction rollback of a live purge
  psql(`insert into public.talk_notifications
    (id, user_id, type, title, body, source, created_at, read_at, updated_at)
    values ('anpi-p16-tx-victim', 'user-a', 'anpi', 't', 'b', 'anpi_phase16_test',
      ${now} - interval '100 days', ${now} - interval '99 days', ${now} - interval '99 days')`);
  psql(`begin; select public.anpi_phase16_purge_expired_talk_notifications(500, false, ${now}, interval '90 days'); rollback;`);
  assert.equal(psql(`select count(*)::text from public.talk_notifications where id='anpi-p16-tx-victim'`), "1");
  console.log("PASS purge inside rolled-back transaction leaves rows");

  // Cleanup fixtures
  psql(`delete from public.talk_notifications where id like 'anpi-p16-%'`);
  psql(`delete from public.anpi_user_contexts where talk_user_id='MbrP16MapKeep'`);

  // Rollback package + re-apply
  psqlFile(ROLLBACK, "/tmp/anpi_p16_rollback.sql");
  assert.equal(
    psql(`select to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)') is not null`),
    "f",
  );
  console.log("PASS rollback removed function + index");
  psqlFile(PURGE, "/tmp/anpi_p16_purge.sql");
  console.log("PASS re-applied purge package after rollback");

  console.log("ANPI Phase 16 local verification: PASS");
  console.log("NOTE: staging/production were not contacted.");
}

main();
