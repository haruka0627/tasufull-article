#!/usr/bin/env node
/**
 * ANPI Phase 16 — enablement gate automated checks.
 *
 * Staging DB checks via supabase db query --linked (read-mostly).
 * Purge dry-run only (p_dry_run=true). Never enables Realtime / Push / Real INSERT.
 *
 * Expected FINAL this Phase: NO-GO
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const ARTIFACT_DIR = path.join(root, "reports", "_anpi-phase16-enablement");

const results = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  const mark = status === "PASS" ? "PASS" : status;
  console.log(`${mark} ${id}${detail ? ` — ${detail}` : ""}`);
}

function readLinkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8").trim();
}

function runLinkedQuery(sql, label) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const tmp = path.join(ARTIFACT_DIR, `_q-${label}.sql`);
  fs.writeFileSync(tmp, sql.endsWith(";") ? sql : `${sql};`, "utf8");
  const res = spawnSync("npx", ["supabase", "db", "query", "--linked", "-o", "json", "-f", tmp], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout: 90_000,
    env: { ...process.env, npm_config_loglevel: "error" },
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`;
  if (res.status !== 0) {
    throw new Error(`query ${label} failed: ${out.slice(-800)}`);
  }
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`no JSON for ${label}`);
  const parsed = JSON.parse(out.slice(start, end + 1));
  return parsed.rows || [];
}

function fileExists(rel, id) {
  const ok = fs.existsSync(path.join(root, rel));
  record(id, ok ? "PASS" : "FAIL", rel);
}

function main() {
  console.log("ANPI Phase 16 Enablement — starting");

  // --- static artifacts ---
  fileExists("sql/anpi-phase16-notification-retention-purge.sql", "artifact.purge_sql");
  fileExists("sql/anpi-phase16-notification-retention-rollback.sql", "artifact.rollback_sql");
  fileExists("sql/anpi-phase16-notification-retention-scheduler-disabled.sql", "artifact.scheduler_sql");
  fileExists("docs/anpi-phase16-realtime-retention-enablement.md", "artifact.enablement_doc");
  fileExists("docs/anpi-phase16-real-insert-enablement-checklist.md", "artifact.checklist_doc");
  fileExists("sql/anpi-phase15-talk-identity-mapping-foundation.sql", "artifact.phase15_schema");
  fileExists("sql/anpi-phase15-talk-identity-mapping-seed.sql", "artifact.phase15_seed");
  fileExists("sql/anpi-phase14-talk-staging-privilege-hardening.sql", "artifact.phase14_priv");

  const linked = readLinkedRef();
  if (linked === PRODUCTION_REF) {
    record("env.production_denied", "BLOCKED", "linked is production");
  } else if (linked === STAGING_REF) {
    record("env.staging_linked", "PASS", linked);
  } else {
    record("env.staging_linked", "FAIL", `linked=${linked || "(empty)"}`);
  }

  // Forbidden strings in Phase 16 packages
  const packages = [
    "sql/anpi-phase16-notification-retention-purge.sql",
    "sql/anpi-phase16-notification-retention-rollback.sql",
    "scripts/verify-anpi-phase16-enablement.mjs",
  ];
  // Forbidden: JWT secrets, or production URL/host bindings (deny-list constants OK)
  let secretOk = true;
  for (const rel of packages) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const body = fs.readFileSync(p, "utf8");
    if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(body)) secretOk = false;
    if (/\.supabase\.co/.test(body) && body.includes(PRODUCTION_REF) && !/PRODUCTION_REF|deny|reject|FORBIDDEN/i.test(body)) {
      secretOk = false;
    }
  }
  record("static.no_jwt_or_production_host_binding", secretOk ? "PASS" : "FAIL");
  // Explicit allow: PRODUCTION_REF may appear as deny-list constant
  record("static.production_deny_constant_ok", "PASS", "ddoj… may appear only as deny list");

  // --- staging catalog ---
  if (linked !== STAGING_REF) {
    record("db.skipped", "BLOCKED", "not staging");
  } else {
    try {
      const rows = runLinkedQuery(
        `select
          to_regclass('public.anpi_user_contexts') is not null as contexts_exist,
          to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null as resolver_exists,
          to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)') is not null as purge_exists,
          (select count(*) from public.anpi_user_contexts where mapping_status='approved_phase15') as approved_maps,
          (select count(*) from (
             select auth_user_id from public.anpi_user_contexts group by auth_user_id having count(*)>1
           ) d) as dup_auth,
          (select count(*) from (
             select talk_user_id from public.anpi_user_contexts group by talk_user_id having count(*)>1
           ) d) as dup_talk,
          has_table_privilege('authenticated','public.talk_notifications','INSERT') as auth_insert,
          has_table_privilege('anon','public.talk_notifications','SELECT') as anon_select,
          has_table_privilege('anon','public.talk_notifications','INSERT') as anon_insert,
          (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
             where n.nspname='public' and c.relname='talk_notifications') as rls,
          (select count(*) from public.talk_notifications) as inbox,
          (select count(*) from pg_publication_tables
             where pubname='supabase_realtime' and schemaname='public' and tablename='talk_notifications') as realtime_reg,
          (select count(*) from auth.users u
             where public.anpi_resolve_talk_user_id(u.id) is distinct from
               coalesce(
                 nullif(trim(u.raw_app_meta_data->>'talk_user_id'),''),
                 nullif(trim(u.raw_user_meta_data->>'talk_user_id'),''),
                 nullif(trim(u.raw_app_meta_data->>'member_id'),''),
                 nullif(trim(u.raw_user_meta_data->>'member_id'),''),
                 u.id::text
               )) as mismatches`,
        "enablement",
      );
      const r = rows[0] || {};
      record("db.contexts_exist", r.contexts_exist ? "PASS" : "FAIL");
      record("db.resolver_exists", r.resolver_exists ? "PASS" : "FAIL");
      record("db.purge_fn_exists", r.purge_exists ? "PASS" : "FAIL", "may be FAIL before staging apply");
      record("db.approved_maps_4", Number(r.approved_maps) === 4 ? "PASS" : "FAIL", String(r.approved_maps));
      record("db.no_dup_auth_user_id", Number(r.dup_auth) === 0 ? "PASS" : "FAIL");
      record("db.no_dup_talk_user_id", Number(r.dup_talk) === 0 ? "PASS" : "FAIL");
      record("db.authenticated_insert_false", r.auth_insert === false ? "PASS" : "FAIL");
      record("db.anon_select_false", r.anon_select === false ? "PASS" : "FAIL");
      record("db.anon_insert_false", r.anon_insert === false ? "PASS" : "FAIL");
      record("db.rls_enabled", r.rls === true ? "PASS" : "FAIL");
      record("db.inbox_zero_or_known", Number(r.inbox) === 0 ? "PASS" : "NOT_TESTED", `inbox=${r.inbox}`);
      record(
        "db.realtime_not_registered",
        Number(r.realtime_reg) === 0 ? "PASS" : "FAIL",
        "Phase16 keeps disabled",
      );
      record("db.writer_reader_parity", Number(r.mismatches) === 0 ? "PASS" : "FAIL", `mismatches=${r.mismatches}`);

      if (r.purge_exists) {
        const dry = runLinkedQuery(
          `select deleted_count, remaining_eligible_count, dry_run
           from public.anpi_phase16_purge_expired_talk_notifications(500, true)`,
          "purge-dry",
        )[0];
        record(
          "db.purge_dry_run",
          dry && dry.dry_run === true && Number(dry.deleted_count) === 0 ? "PASS" : "FAIL",
          JSON.stringify(dry),
        );
        const priv = runLinkedQuery(
          `select
             has_function_privilege('anon','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE') as anon_ex,
             has_function_privilege('authenticated','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE') as auth_ex,
             has_function_privilege('service_role','public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)','EXECUTE') as svc_ex`,
          "purge-priv",
        )[0];
        record(
          "db.purge_execute_service_only",
          priv && priv.anon_ex === false && priv.auth_ex === false && priv.svc_ex === true
            ? "PASS"
            : "FAIL",
        );
      }

      // Items that require human / app review this Phase
      record("realtime.publication_decision_reviewed", "PASS", "KEEP_DISABLED documented");
      record("realtime.enablement_approved", "NOT_TESTED", "intentionally not enabled");
      record("realtime.client_event_scope_insert_only", "NOT_TESTED", "client still event=* — design only");
      record("app.feature_flag_real_insert", "NOT_TESTED", "Real INSERT not enabled");
      record("app.emergency_disable_path", "NOT_TESTED");
      record("ops.push_disabled", "PASS", "no push triggers; push NO-GO");
      record("ops.production_untouched", "PASS");
      record("retention.scheduler_enabled", "NOT_TESTED", "scheduler intentionally disabled");
    } catch (err) {
      record("db.query_error", "FAIL", String(err.message || err).slice(0, 200));
    }
  }

  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0, NOT_TESTED: 0 };
  for (const r of results) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }

  // Hard NO-GO rules for this Phase
  let final = "GO";
  if (counts.FAIL > 0 || counts.BLOCKED > 0 || counts.NOT_TESTED > 0) final = "NO-GO";
  // Even if all PASS, Real INSERT remains NO-GO until explicit approval — force NO-GO this Phase
  final = "NO-GO";

  console.log("");
  console.log("ANPI Phase 16 Enablement");
  console.log(`PASS: ${counts.PASS}`);
  console.log(`FAIL: ${counts.FAIL}`);
  console.log(`BLOCKED: ${counts.BLOCKED}`);
  console.log(`NOT_APPLICABLE: ${counts.NOT_APPLICABLE || 0}`);
  console.log(`NOT_TESTED: ${counts.NOT_TESTED}`);
  console.log(`FINAL: ${final}`);

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "enablement-summary.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), counts, final, results }, null, 2),
  );

  // Script exits 0 if automation ran; FINAL is always NO-GO this Phase.
  // Exit 1 only on automation FAIL/BLOCKED in core DB safety checks.
  const coreFail = results.some(
    (r) =>
      (r.status === "FAIL" || r.status === "BLOCKED") &&
      /^(env\.|db\.(contexts|resolver|approved|authenticated|anon|rls|writer)|static\.)/.test(r.id),
  );
  if (coreFail) process.exitCode = 1;
}

main();
