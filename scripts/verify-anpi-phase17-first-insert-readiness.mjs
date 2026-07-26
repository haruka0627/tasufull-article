#!/usr/bin/env node
/**
 * ANPI Phase 17 — first staging insert readiness gate.
 * STAGING TEST ONLY · DO NOT APPLY TO PRODUCTION.
 * Read-only / dry-run against staging. Never live INSERT.
 * PRODUCTION DENY: refuse linked production project ref.
 * FINAL: GO_FOR_PHASE18 | NO-GO
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const ARTIFACT = path.join(root, "reports", "_anpi-phase17-readiness");
const results = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`${status} ${id}${detail ? ` — ${detail}` : ""}`);
}

function exists(rel, id) {
  record(id, fs.existsSync(path.join(root, rel)) ? "PASS" : "FAIL", rel);
}

function linkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : "";
}

function query(sql, label) {
  fs.mkdirSync(ARTIFACT, { recursive: true });
  const tmp = path.join(ARTIFACT, `_q-${label}.sql`);
  fs.writeFileSync(tmp, sql.endsWith(";") ? sql : `${sql};`, "utf8");
  const res = spawnSync("npx", ["supabase", "db", "query", "--linked", "-o", "json", "-f", tmp], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout: 90_000,
    env: { ...process.env, npm_config_loglevel: "error" },
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`;
  if (res.status !== 0) throw new Error(`${label}: ${out.slice(-600)}`);
  const s = out.indexOf("{");
  const e = out.lastIndexOf("}");
  return JSON.parse(out.slice(s, e + 1)).rows || [];
}

function main() {
  console.log("ANPI Phase 17 First Insert Readiness — starting");

  exists("sql/anpi-phase17-first-insert-readiness-foundation.sql", "artifact.foundation");
  exists("sql/anpi-phase17-first-insert-cleanup.sql", "artifact.cleanup");
  exists("sql/anpi-phase17-first-insert-readiness-rollback.sql", "artifact.rollback");
  exists("docs/anpi-phase17-first-staging-insert-readiness.md", "artifact.doc");
  exists("docs/anpi-phase16-real-insert-enablement-checklist.md", "artifact.checklist");

  const packages = [
    "sql/anpi-phase17-first-insert-readiness-foundation.sql",
    "sql/anpi-phase17-first-insert-cleanup.sql",
    "scripts/verify-anpi-phase17-first-insert-readiness.mjs",
  ];
  let secretOk = true;
  let uuidLeak = false;
  for (const rel of packages) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const body = fs.readFileSync(p, "utf8");
    if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(body)) secretOk = false;
    // UUID literal in exec SQL (excluding comments) is forbidden in packages
    const exec = body
      .split(/\r?\n/)
      .filter((l) => !/^\s*--/.test(l))
      .join("\n");
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(exec)) {
      uuidLeak = true;
    }
  }
  record("static.no_jwt", secretOk ? "PASS" : "FAIL");
  record("static.no_raw_uuid_in_package", uuidLeak ? "FAIL" : "PASS");

  const linked = linkedRef();
  if (linked === PRODUCTION_REF) record("env.production_denied", "BLOCKED");
  else if (linked === STAGING_REF) record("env.staging_linked", "PASS", linked);
  else record("env.staging_linked", "FAIL", linked || "(empty)");

  let writer = "UNKNOWN";
  let target = "UNKNOWN";
  let polling = "UNKNOWN";
  let featureFlag = "UNKNOWN";
  let emergency = "UNKNOWN";
  let cleanup = "UNKNOWN";

  if (linked === STAGING_REF) {
    try {
      const r = query(
        `select
          (select enabled from public.anpi_phase17_insert_gate where id=1) as enabled,
          (select target_bound from (
             select target_auth_user_id is not null and target_talk_user_id is not null as target_bound
             from public.anpi_phase17_insert_gate where id=1
           ) s) as target_bound,
          (select target_auth_sha8 from public.anpi_phase17_insert_gate where id=1) as sha8,
          (select count(*) from public.anpi_user_contexts where mapping_status='approved_phase15') as maps,
          (select count(*) from public.talk_notifications) as inbox,
          to_regprocedure('public.anpi_phase17_insert_first_test_notification(boolean,text)') is not null as writer,
          to_regprocedure('public.anpi_phase17_emergency_disable()') is not null as emergency,
          to_regprocedure('public.anpi_phase17_cleanup_first_test_notification(boolean)') is not null as cleanup,
          has_function_privilege('authenticated','public.anpi_phase17_insert_first_test_notification(boolean,text)','EXECUTE') as auth_ex,
          has_function_privilege('anon','public.anpi_phase17_insert_first_test_notification(boolean,text)','EXECUTE') as anon_ex,
          has_table_privilege('authenticated','public.talk_notifications','INSERT') as auth_insert,
          has_table_privilege('anon','public.talk_notifications','SELECT') as anon_select,
          (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='talk_notifications') as rt,
          to_regprocedure('public.anpi_talk_notification_create_internal(uuid,timestamptz,boolean)') is not null as phase10_writer`,
        "gate",
      )[0];

      record("db.maps_4", Number(r.maps) === 4 ? "PASS" : "FAIL", String(r.maps));
      record("db.inbox_0", Number(r.inbox) === 0 ? "PASS" : "FAIL", String(r.inbox));
      record("db.target_bound", r.target_bound ? "PASS" : "FAIL");
      record("db.target_sha8", r.sha8 === "0411f04d" ? "PASS" : "FAIL", String(r.sha8));
      record("db.flag_default_off", r.enabled === false ? "PASS" : "FAIL");
      record("db.writer_wrapper", r.writer ? "PASS" : "FAIL");
      record("db.phase10_writer_absent_expected", r.phase10_writer ? "FAIL" : "PASS", "wrapper used");
      record("db.writer_priv_service_only", r.auth_ex === false && r.anon_ex === false ? "PASS" : "FAIL");
      record("db.auth_insert_false", r.auth_insert === false ? "PASS" : "FAIL");
      record("db.anon_select_false", r.anon_select === false ? "PASS" : "FAIL");
      record("db.realtime_disabled", Number(r.rt) === 0 ? "PASS" : "FAIL");
      record("db.emergency_fn", r.emergency ? "PASS" : "FAIL");
      record("db.cleanup_fn", r.cleanup ? "PASS" : "FAIL");

      const dry = query(
        `select reason_code, inserted_count, dry_run, enabled from public.anpi_phase17_insert_first_test_notification(true)`,
        "writer-dry",
      )[0];
      record(
        "db.writer_dry_flag_off",
        dry && dry.reason_code === "anpi_phase17_flag_off" && Number(dry.inserted_count) === 0
          ? "PASS"
          : "FAIL",
        JSON.stringify(dry),
      );

      const poll = query(`select * from public.anpi_phase17_polling_reader_dry_run()`, "poll")[0];
      record(
        "db.polling_parity",
        poll && poll.writer_reader_parity === true && Number(poll.inbox_for_target) === 0
          ? "PASS"
          : "FAIL",
        JSON.stringify(poll),
      );

      const clean = query(
        `select matched_count, deleted_count, reason_code from public.anpi_phase17_cleanup_first_test_notification(true)`,
        "cleanup-dry",
      )[0];
      record(
        "db.cleanup_dry_zero",
        clean && Number(clean.matched_count) === 0 && Number(clean.deleted_count) === 0
          ? "PASS"
          : "FAIL",
        JSON.stringify(clean),
      );

      query(`select * from public.anpi_phase17_emergency_disable()`, "emergency");
      const after = query(`select enabled from public.anpi_phase17_insert_gate where id=1`, "flag-after")[0];
      record("db.emergency_disable_off", after && after.enabled === false ? "PASS" : "FAIL");

      writer = r.writer ? "READY_WITH_SAFE_WRAPPER" : "NOT_PRESENT";
      target = r.target_bound && r.sha8 === "0411f04d" ? "BOUND" : "UNBOUND";
      polling = poll?.writer_reader_parity ? "PASS" : "FAIL";
      featureFlag = r.enabled === false ? "OFF" : "ON";
      emergency = r.emergency ? "PASS" : "FAIL";
      cleanup = r.cleanup ? "PASS" : "FAIL";

      // Phase16 NOT_TESTED closures for first polling insert
      record("close.realtime_enablement", "NOT_APPLICABLE", "polling-first; KEEP_DISABLED");
      record("close.realtime_event_scope", "NOT_APPLICABLE", "Realtime unused for Phase18 first insert");
      record("close.feature_flag", "PASS", "anpi_phase17_insert_gate.enabled default false");
      record("close.emergency_disable", "PASS", "anpi_phase17_emergency_disable()");
      record("close.retention_scheduler", "NOT_APPLICABLE", "manual until post-GO");
    } catch (err) {
      record("db.error", "FAIL", String(err.message || err).slice(0, 200));
      writer = "BLOCKED";
    }
  }

  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0, NOT_TESTED: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;

  let final = "GO_FOR_PHASE18";
  if (counts.FAIL > 0 || counts.BLOCKED > 0 || counts.NOT_TESTED > 0) final = "NO-GO";
  if (writer !== "READY_WITH_SAFE_WRAPPER" && writer !== "READY_AS_IS") final = "NO-GO";
  if (target !== "BOUND") final = "NO-GO";
  if (featureFlag !== "OFF") final = "NO-GO";

  console.log("");
  console.log("ANPI Phase 17 First Insert Readiness");
  console.log(`PASS: ${counts.PASS}`);
  console.log(`FAIL: ${counts.FAIL}`);
  console.log(`BLOCKED: ${counts.BLOCKED}`);
  console.log(`NOT_TESTED: ${counts.NOT_TESTED}`);
  console.log("");
  console.log(`WRITER: ${writer}`);
  console.log(`TARGET: ${target}`);
  console.log(`POLLING: ${polling}`);
  console.log(`FEATURE_FLAG: ${featureFlag}`);
  console.log(`EMERGENCY_DISABLE: ${emergency}`);
  console.log(`CLEANUP: ${cleanup}`);
  console.log(`FINAL: ${final}`);

  fs.writeFileSync(
    path.join(ARTIFACT, "readiness-summary.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), counts, final, writer, target, polling, featureFlag, emergency, cleanup, results }, null, 2),
  );

  if (counts.FAIL > 0 || counts.BLOCKED > 0) process.exitCode = 1;
}

main();
