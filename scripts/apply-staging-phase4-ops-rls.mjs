#!/usr/bin/env node
/**
 * Staging — Phase 4 本番相当 ops RLS 適用（リンク済みプロジェクトのみ）
 *   node scripts/apply-staging-phase4-ops-rls.mjs
 *
 * 1) ops-rls-drop-dev-policies.sql
 * 2) ops-rls-production.sql
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "sql/ops-rls-drop-dev-policies.sql",
  "sql/ops-rls-production.sql",
];

function run(file) {
  const abs = path.join(ROOT, file);
  console.log(`\n→ ${file}`);
  const r = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--yes", "-f", abs],
    { cwd: ROOT, stdio: "inherit", shell: true }
  );
  if (r.status !== 0) {
    throw new Error(`Failed: ${file} (exit ${r.status})`);
  }
}

console.log("TASFUL Phase 4 — apply staging ops admin RLS (linked project, NOT production deploy)");
for (const f of FILES) run(f);
console.log("\nDone. Verify: node scripts/load-dotenv-run.mjs scripts/test-supabase-phase4-rls-admin.mjs");
