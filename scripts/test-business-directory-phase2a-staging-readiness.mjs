#!/usr/bin/env node
/**
 * Business Directory Phase 2a — Staging DB readiness (SELECT only)
 *
 * Local static checks (default):
 *   node scripts/test-business-directory-phase2a-staging-readiness.mjs
 *
 * Remote Staging DB checks (requires supabase link to STAGING project):
 *   set BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn
 *   npx supabase link --project-ref ahlxuyvhzqdqaojiywmu
 *   node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote
 *
 * Aborts when CLI link equals Production ref (manifest or BD_PRODUCTION_PROJECT_REF).
 * Does NOT run migrations or destructive SQL.
 * SSOT: docs/supabase-environments.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkStagingNotProductionLinked,
  getProductionRef,
  getStagingRef,
} from "./lib/supabase-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const PHASE2A_VERSION = "20260717120000";
const PROFILE_COLUMNS = [
  "short_description",
  "full_description",
  "seo_title",
  "meta_description",
  "faq_items",
  "recommended_uses",
];

let pass = 0;
let fail = 0;
let note = 0;

function ok(label, detail = "") {
  pass += 1;
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label, detail = "") {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function nlabel(label) {
  note += 1;
  console.log(`NOTE: ${label}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function parseSupabaseJson(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function assertNotProductionLinked() {
  const guard = checkStagingNotProductionLinked();
  if (!guard.ok) {
    bad("production guard", guard.message);
    return false;
  }
  if (guard.linked === getStagingRef()) {
    ok("staging guard", guard.message);
  } else if (guard.linked) {
    nlabel(guard.message);
  } else {
    nlabel(`${guard.message} · staging=${getStagingRef()} prod=${getProductionRef()}`);
  }
  return true;
}

function runQuery(sql) {
  const tmp = path.join(os.tmpdir(), `bd-phase2a-staging-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
      "supabase",
      "db",
      "query",
      "--linked",
      "--output",
      "json",
      "-f",
      tmp,
    ], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
    if (r.status !== 0) {
      return { ok: false, error: (r.stderr || r.stdout || "").slice(0, 400) };
    }
    const parsed = parseSupabaseJson(`${r.stdout || ""}\n${r.stderr || ""}`);
    if (!parsed) return { ok: false, error: "json parse failed" };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    return { ok: true, rows };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function runLocalChecks() {
  const migration = read(`supabase/migrations/${PHASE2A_VERSION}_business_directory_page_content_phase2a.sql`);
  for (const col of ["seo_title", "meta_description", "faq_items", "recommended_uses"]) {
    if (migration.includes(col)) ok(`migration file mentions ${col}`);
    else bad(`migration file mentions ${col}`);
  }
  if (migration.includes("business_directory_listings_public")) ok("migration updates public view");
  else bad("migration updates public view");

  if (fs.existsSync(path.join(root, "reports/business-directory-phase2a-staging-verification.md"))) {
    ok("staging verification doc exists");
  } else bad("staging verification doc exists");

  if (fs.existsSync(path.join(root, "reports/business-directory-phase2a-staging-operator-runbook.md"))) {
    ok("legacy staging operator runbook exists");
  } else nlabel("legacy staging operator runbook missing (optional reference)");

  if (fs.existsSync(path.join(root, "reports/business-directory-phase2a-production-controlled-migration.md"))) {
    ok("production controlled migration runbook exists");
  } else nlabel("production controlled migration runbook missing (optional reference)");

  const shared = read("supabase/functions/_shared/business-directory.ts");
  for (const token of ["seo_title", "meta_description", "faq_items", "recommended_uses"]) {
    if (shared.includes(token)) ok(`Edge shared handles ${token}`);
    else bad(`Edge shared handles ${token}`);
  }
}

function runRemoteChecks() {
  if (!assertNotProductionLinked()) return;

  const colsSql = `
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_directory_profiles'
  and column_name in (${PROFILE_COLUMNS.map((c) => `'${c}'`).join(", ")})
order by column_name;
`;
  const cols = runQuery(colsSql);
  if (!cols.ok) {
    bad("profile columns query", cols.error);
    return;
  }
  if (cols.rows.length === PROFILE_COLUMNS.length) {
    ok("profile columns count", String(cols.rows.length));
  } else {
    bad("profile columns count", `expected ${PROFILE_COLUMNS.length}, got ${cols.rows.length}`);
  }

  const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]));
  if (byName.faq_items?.data_type === "jsonb") ok("faq_items type jsonb");
  else bad("faq_items type jsonb", byName.faq_items?.data_type || "missing");
  if (byName.recommended_uses?.data_type === "ARRAY") ok("recommended_uses type ARRAY");
  else bad("recommended_uses type ARRAY", byName.recommended_uses?.data_type || "missing");
  if (byName.faq_items?.is_nullable === "NO") ok("faq_items NOT NULL");
  else bad("faq_items NOT NULL", byName.faq_items?.is_nullable);
  if (byName.short_description?.is_nullable === "NO") ok("short_description NOT NULL");
  else bad("short_description NOT NULL");

  const viewSql = `
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_directory_listings_public'
  and column_name in (${PROFILE_COLUMNS.map((c) => `'${c}'`).join(", ")})
order by column_name;
`;
  const view = runQuery(viewSql);
  if (!view.ok) bad("public view columns query", view.error);
  else if (view.rows.length === PROFILE_COLUMNS.length) ok("public view columns", String(view.rows.length));
  else bad("public view columns", `expected ${PROFILE_COLUMNS.length}, got ${view.rows.length}`);

  const migSql = `
select version from supabase_migrations.schema_migrations
where version = '${PHASE2A_VERSION}';
`;
  const mig = runQuery(migSql);
  if (!mig.ok) bad("migration history query", mig.error);
  else if (mig.rows.length === 1) ok("migration 20260717120000 recorded");
  else bad("migration 20260717120000 recorded", String(mig.rows?.length ?? 0));

  const sanitySql = `
select
  count(*)::int as total_profiles,
  count(*) filter (where faq_items is null)::int as null_faq,
  count(*) filter (where recommended_uses is null)::int as null_uses
from public.business_directory_profiles;
`;
  const sanity = runQuery(sanitySql);
  if (!sanity.ok) bad("profile sanity query", sanity.error);
  else {
    const row = sanity.rows[0] || {};
    if (Number(row.null_faq) === 0 && Number(row.null_uses) === 0) {
      ok("profile defaults applied", `total=${row.total_profiles}`);
    } else {
      bad("profile defaults applied", `null_faq=${row.null_faq} null_uses=${row.null_uses}`);
    }
  }
}

console.log("=== Business Directory Phase 2a — Staging readiness ===\n");

runLocalChecks();

console.log("\n--- remote DB verification ---\n");

if (!remote) {
  nlabel("skipped remote — run: node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote");
  nlabel("requires: supabase link to Staging (ahlxuyvhzqdqaojiywmu) · see docs/supabase-environments.md");
} else {
  runRemoteChecks();
}

console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
console.log("See: docs/supabase-environments.md");
console.log("     reports/business-directory-phase2a-production-controlled-migration.md (Option B apply)");
console.log("     reports/business-directory-phase2a-staging-verification.md (post-apply checks)\n");
process.exit(fail > 0 ? 1 : 0);
