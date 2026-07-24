#!/usr/bin/env node
/**
 * P0-03 — Staging schema verify (Builder General Jobs)
 *
 *   node scripts/verify-builder-general-jobs-staging-schema.mjs
 *
 * exit 0 = schema ready for authenticated write E2E
 * exit 3 = P0-01 SQL not applied (stop P0-03)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

const cfgText = fs.readFileSync(path.join(root, "chat-supabase-config.js"), "utf8");
const url = cfgText.match(/url:\s*"([^"]+)"/)?.[1] || "";
const anonKey = cfgText.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

const report = {
  phase: "P0-03-schema-verify",
  timestamp: new Date().toISOString(),
  projectRef: url.includes(STAGING_REF) ? STAGING_REF : url.includes(PRODUCTION_REF) ? PRODUCTION_REF : "unknown",
  checks: [],
  missingSql: [],
  decision: null,
};

function record(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  const tag = ok ? "OK" : "MISSING";
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

if (!url || !anonKey) {
  console.error("FAIL no supabase config in chat-supabase-config.js");
  process.exit(2);
}

if (url.includes(PRODUCTION_REF)) {
  console.error("FAIL chat-supabase-config.js points to PRODUCTION — use Staging only");
  process.exit(2);
}

if (!url.includes(STAGING_REF)) {
  console.warn("WARN config URL is not Staging ref — continuing probe");
}

const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

async function probe(table, select) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers,
  });
  const text = await res.text();
  let columnMissing = false;
  try {
    const j = JSON.parse(text);
    columnMissing = j?.code === "42703" || /column .* does not exist/i.test(j?.message || "");
  } catch {
    /* ignore */
  }
  const tableMissing = res.status === 404 || /Could not find the table/i.test(text);
  return { status: res.status, text: text.slice(0, 500), columnMissing, tableMissing };
}

console.log("=== Builder General Jobs — Staging schema verify ===");
console.log(`Project: ${report.projectRef}`);
console.log(`URL: ${url}\n`);

const apps = await probe(
  "builder_project_applications",
  "id,project_id,applicant_auth_uid,status,partner_key,payload"
);
const projectsSpec = await probe("builder_projects", "spec,project_category,board_type");
const projectsBase = await probe("builder_projects", "id,owner_id,kind,title");
const partners = await probe("builder_partners", "id,partner_key,display_name");

const appsOk = apps.status === 200 && !apps.tableMissing;
const specOk = projectsSpec.status === 200 && !projectsSpec.columnMissing;
const projectsOk = projectsBase.status === 200;
const partnersOk = partners.status === 200 && !partners.tableMissing;

record("builder_projects (base)", projectsOk, `HTTP ${projectsBase.status}`);
record("builder_projects.spec", specOk, specOk ? "" : projectsSpec.text);
record("builder_projects.project_category", specOk, specOk ? "with spec cols" : "missing");
record("builder_projects.board_type", specOk, specOk ? "with spec cols" : "missing");
record("builder_project_applications", appsOk, appsOk ? "" : apps.text);
record("builder_partners (optional seed)", partnersOk, partnersOk ? "" : partners.text);

if (!specOk) {
  report.missingSql.push("supabase/migrations/20260719120000_builder_general_jobs_p0_01_staging.sql");
}
if (!appsOk) {
  report.missingSql.push("supabase/migrations/20260719120000_builder_general_jobs_p0_01_staging.sql");
}
if (appsOk && specOk) {
  record(
    "RLS policies (manual)",
    true,
    "apply supabase/manual/staging_builder_general_jobs_p0_01_rls.sql — verified at E2E runtime"
  );
} else {
  record("RLS policies (manual)", false, "requires applications table + P0-01 RLS SQL");
  if (!report.missingSql.includes("supabase/manual/staging_builder_general_jobs_p0_01_rls.sql")) {
    report.missingSql.push("supabase/manual/staging_builder_general_jobs_p0_01_rls.sql");
  }
}

const go = appsOk && specOk && projectsOk;
report.decision = go ? "Go" : "No-Go";

const outDir = path.join(root, "reports", "builder-general-jobs-p0-03");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "schema-verify.json"), JSON.stringify(report, null, 2));

console.log("");
if (go) {
  console.log("RESULT: SCHEMA_APPLIED Go — proceed with P0-03 E2E");
  process.exit(0);
}

console.log("RESULT: SCHEMA_NOT_APPLIED — stop P0-03 implementation");
console.log("\nApply on Staging Dashboard (ahlxuyvhzqdqaojiywmu) SQL Editor, in order:");
console.log("  1. supabase/migrations/20260719120000_builder_general_jobs_p0_01_staging.sql");
console.log("  2. supabase/manual/staging_builder_general_jobs_p0_01_rls.sql");
console.log("\nDo NOT apply to Production (ddojquacsyqesrjhcvmn).");
console.log(`\nMissing SQL: ${[...new Set(report.missingSql)].join(", ")}`);
console.log(`Report: ${path.join(outDir, "schema-verify.json")}`);
process.exit(3);
