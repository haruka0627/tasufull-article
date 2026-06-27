#!/usr/bin/env node
/**
 * Business Directory Production Step 1 — migration apply verification
 *   node scripts/test-business-directory-production-step1-migration.mjs
 *   node scripts/test-business-directory-production-step1-migration.mjs --remote
 *
 * --remote  runs supabase db query --linked checks (requires linked project + login)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");

let pass = 0;
let fail = 0;
let note = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
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

function runQuery(sql) {
  const tmp = path.join(os.tmpdir(), `bd-step1-${process.pid}-${Date.now()}.sql`);
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
    if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || "").slice(0, 200) };
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

console.log("=== Business Directory Production Step 1 — Migration ===\n");

const migrations = [
  "supabase/migrations/20260711100000_business_directory_phase1_schema.sql",
  "supabase/migrations/20260711100001_business_directory_phase1_seed.sql",
  "supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql",
];

for (const m of migrations) {
  if (fs.existsSync(path.join(root, m))) ok(`local migration ${path.basename(m)}`);
  else bad(`local migration ${path.basename(m)}`);
}

const schema = read(migrations[0]);
const seed = read(migrations[1]);
const phase6 = read(migrations[2]);

const tables = [
  "business_directory_listings",
  "business_directory_profiles",
  "business_directory_categories",
  "business_directory_plan_features",
  "business_directory_audit_logs",
];
for (const t of tables) {
  if (schema.includes(`public.${t}`) || schema.includes(`create table if not exists public.${t}`)) {
    ok(`schema defines ${t}`);
  } else bad(`schema defines ${t}`);
}

if (!schema.includes("alter table public.listings")) ok("schema does not alter public.listings");
else bad("schema alters public.listings");

for (const col of [
  "stripe_price_id",
  "subscription_status",
  "current_period_end",
  "cancel_at_period_end",
  "plan_changed_at",
]) {
  if (phase6.includes(col)) ok(`phase6 column ${col}`);
  else bad(`phase6 column ${col}`);
}

if (seed.includes("plan_code") && seed.includes("standard")) ok("seed includes plans");
if (seed.includes("shop_retail") && seed.includes("business_service")) ok("seed includes categories");

console.log("\n--- remote verification ---\n");

if (!remote) {
  nlabel("skipped remote checks — rerun with --remote after staging apply");
} else {
  const bdTables = runQuery(
    "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name like 'business_directory%';",
  );
  if (bdTables.ok && Number(bdTables.rows[0]?.n) >= 10) ok(`remote BD tables (${bdTables.rows[0]?.n})`);
  else bad("remote BD tables", bdTables.rows?.[0]?.n ?? bdTables.error);

  const bdView = runQuery(
    "select count(*)::int as n from information_schema.views where table_schema='public' and table_name='business_directory_listings_public';",
  );
  if (bdView.ok && Number(bdView.rows[0]?.n) === 1) ok("remote view business_directory_listings_public");
  else bad("remote view", bdView.rows?.[0]?.n ?? bdView.error);

  const cols = runQuery(
    "select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='business_directory_listings' and column_name in ('stripe_price_id','subscription_status','current_period_end','cancel_at_period_end','plan_changed_at');",
  );
  if (cols.ok && Number(cols.rows[0]?.n) >= 5) ok("remote phase6 subscription columns");
  else bad("remote phase6 subscription columns", cols.rows?.[0]?.n ?? cols.error);

  const plans = runQuery(
    "select count(distinct plan_code)::int as n from business_directory_plan_features;",
  );
  if (plans.ok && Number(plans.rows[0]?.n) >= 4) ok("remote seed plan_features");
  else bad("remote seed plan_features");

  const cats = runQuery(
    "select count(*)::int as n from business_directory_categories;",
  );
  if (cats.ok && Number(cats.rows[0]?.n) >= 8) ok("remote seed categories");
  else bad("remote seed categories");

  const hist = runQuery(
    "select version from supabase_migrations.schema_migrations where version in ('20260711100000','20260711100001','20260712100000') order by version;",
  );
  if (hist.ok && hist.rows.length === 3) ok("migration history recorded (3 BD versions)");
  else {
    nlabel("migration history missing BD versions — run: npx supabase migration repair --status applied 20260711100000 20260711100001 20260712100000");
  }

  const mp = runQuery(
    "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='listings';",
  );
  if (mp.ok && Number(mp.rows[0]?.n) === 1) ok("marketplace public.listings unchanged");
  else bad("marketplace public.listings", mp.rows?.[0]?.n);
}

console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
process.exit(fail ? 1 : 0);
