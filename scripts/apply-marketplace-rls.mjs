#!/usr/bin/env node
/**
 * Marketplace RLS P1-S1〜S4 — リンク済み Supabase へ適用
 *
 *   node scripts/apply-marketplace-rls.mjs
 *
 * 1) sql/marketplace-rls-production.sql
 * 2) sql/marketplace-rls-drop-dev-policies.sql
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "sql/marketplace-rls-production.sql",
  "sql/marketplace-rls-drop-dev-policies.sql",
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

console.log("Marketplace RLS P1-S1〜S4 — apply (linked project)");
for (const f of FILES) run(f);
console.log("\nDone. Verify: node scripts/verify-marketplace-rls.mjs");
