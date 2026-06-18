#!/usr/bin/env node
/**
 * Marketplace RLS P3 — owner-only base SELECT 適用
 *
 *   node scripts/apply-marketplace-rls-p3.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "sql/marketplace-rls-p3-authenticated-owner-only.sql";

console.log("Marketplace RLS P3 — owner-only base SELECT (linked project)");
const abs = path.join(ROOT, FILE);
console.log(`\n→ ${FILE}`);
const r = spawnSync(
  "npx",
  ["supabase", "db", "query", "--linked", "--yes", "-f", abs],
  { cwd: ROOT, stdio: "inherit", shell: true }
);
if (r.status !== 0) {
  throw new Error(`Failed: ${FILE} (exit ${r.status})`);
}
console.log("\nDone. Verify: node scripts/verify-marketplace-rls.mjs");
