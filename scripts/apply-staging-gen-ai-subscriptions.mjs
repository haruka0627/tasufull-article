#!/usr/bin/env node
/**
 * Staging only — apply gen_ai_subscriptions schema (repo SSOT).
 *
 *   node scripts/apply-staging-gen-ai-subscriptions.mjs
 *
 * Requires: npx supabase link → ahlxuyvhzqdqaojiywmu (tasful-staging)
 * Never targets Production (ddojquacsyqesrjhcvmn).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

const FILES = [
  "supabase/gen_ai_subscriptions.sql",
  "supabase/gen_ai_subscriptions_period_end_columns.sql",
];

function readLinkedRef() {
  const p = path.join(ROOT, "supabase", ".temp", "project-ref");
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8").trim();
}

function run(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`missing ${file}`);
  console.log(`\n→ ${file}`);
  const r = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--yes", "-f", abs],
    { cwd: ROOT, stdio: "inherit", shell: true },
  );
  if (r.status !== 0) throw new Error(`Failed: ${file} (exit ${r.status})`);
}

function main() {
  const linked = readLinkedRef();
  console.log("TASFUL — apply gen_ai_subscriptions to Staging only");
  console.log(`linked project-ref: ${linked || "(missing)"}`);
  if (linked !== STAGING_REF) {
    console.error(`REFUSE: linked project must be Staging ${STAGING_REF}`);
    console.error(`got: ${linked || "none"}`);
    process.exit(2);
  }
  if (linked === PRODUCTION_REF) {
    console.error("REFUSE: Production project");
    process.exit(2);
  }

  console.log("SQL: CREATE TABLE IF NOT EXISTS + period-end columns (idempotent)");
  console.log("destructive: none · RLS enable · no anon policies (service_role only)");
  for (const f of FILES) run(f);
  console.log("\nDone. Verify: node scripts/verify-staging-gen-ai-subscriptions.mjs");
}

main();
