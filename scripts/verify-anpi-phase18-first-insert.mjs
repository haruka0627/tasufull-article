#!/usr/bin/env node
/**
 * ANPI Phase 18 — post-run final audit (read-only).
 * Does NOT enable flag, INSERT, or cleanup.
 * Expects Phase 18 already completed: inbox=0, flag OFF, maps=4.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const ARTIFACT = path.join(root, "reports", "_anpi-phase18-insert");
const results = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`${status} ${id}${detail ? ` — ${detail}` : ""}`);
}

function linkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : "";
}

function query(sql, label) {
  fs.mkdirSync(ARTIFACT, { recursive: true });
  const tmp = path.join(ARTIFACT, `_v18-${label}.sql`);
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
  console.log("ANPI Phase 18 Final Audit — starting");

  const ref = linkedRef();
  record(
    "env.staging_linked",
    ref === STAGING_REF ? "PASS" : "FAIL",
    ref || "(missing)"
  );
  record(
    "env.production_deny",
    ref !== PRODUCTION_REF ? "PASS" : "FAIL",
    `linked≠${PRODUCTION_REF}`
  );

  for (const rel of [
    "reports/anpi-phase18-first-staging-notification-insert.md",
    "docs/anpi-phase18-first-staging-notification-insert-runbook.md",
  ]) {
    record(`artifact.${path.basename(rel)}`, fs.existsSync(path.join(root, rel)) ? "PASS" : "FAIL");
  }

  const [row] = query(
    `select
      (select count(*) from public.anpi_user_contexts where mapping_status='approved_phase15') as maps,
      (select count(*) from public.anpi_user_contexts c
        where mapping_status='approved_phase15'
          and (
            c.auth_user_id::text is distinct from c.anpi_user_id
            or c.talk_user_id is distinct from c.member_id
            or public.anpi_resolve_talk_user_id(c.auth_user_id) is distinct from c.talk_user_id
          )) as mismatches,
      (select count(*) from public.talk_notifications) as inbox,
      (select count(*) from public.talk_notifications
        where source='anpi_phase17_test' or id like 'anpi-p17-%') as markers,
      (select enabled from public.anpi_phase17_insert_gate where id=1) as flag_on,
      (select target_auth_sha8 from public.anpi_phase17_insert_gate where id=1) as sha8,
      has_table_privilege('authenticated','public.talk_notifications','INSERT') as auth_insert,
      has_table_privilege('anon','public.talk_notifications','SELECT') as anon_select,
      (select count(*) from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public'
          and tablename='talk_notifications') as realtime_reg`,
    "final"
  );

  record("db.maps_4", Number(row?.maps) === 4 ? "PASS" : "FAIL", String(row?.maps));
  record("db.mismatches_0", Number(row?.mismatches) === 0 ? "PASS" : "FAIL", String(row?.mismatches));
  record("db.inbox_0", Number(row?.inbox) === 0 ? "PASS" : "FAIL", String(row?.inbox));
  record("db.markers_0", Number(row?.markers) === 0 ? "PASS" : "FAIL", String(row?.markers));
  record("db.flag_off", row?.flag_on === false ? "PASS" : "FAIL", String(row?.flag_on));
  record("db.target_sha8", row?.sha8 === "0411f04d" ? "PASS" : "FAIL", String(row?.sha8));
  record("db.auth_insert_false", row?.auth_insert === false ? "PASS" : "FAIL");
  record("db.anon_select_false", row?.anon_select === false ? "PASS" : "FAIL");
  record("db.realtime_off", Number(row?.realtime_reg) === 0 ? "PASS" : "FAIL", String(row?.realtime_reg));

  const [probe] = query(
    `select reason_code, inserted_count, enabled, dry_run
     from public.anpi_phase17_insert_first_test_notification(true)`,
    "probe"
  );
  record(
    "db.safe_probe_flag_off",
    probe?.reason_code === "anpi_phase17_flag_off" && Number(probe?.inserted_count) === 0
      ? "PASS"
      : "FAIL",
    JSON.stringify(probe || {})
  );

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  console.log("ANPI Phase 18 Final Audit");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log(
    fail === 0
      ? "FINAL: PHASE18_POST_STATE_CLEAN"
      : "FINAL: PHASE18_POST_STATE_DIRTY"
  );
  process.exit(fail === 0 ? 0 : 1);
}

main();
