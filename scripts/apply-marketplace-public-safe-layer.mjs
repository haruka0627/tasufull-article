#!/usr/bin/env node
/**
 * Marketplace P2 — public safe layer 適用
 *
 *   node scripts/apply-marketplace-public-safe-layer.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "sql/marketplace-public-safe-layer.sql";

console.log("Marketplace P2 — apply public safe layer (linked project)");
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
