#!/usr/bin/env node
/**
 * TASFUL TALK — 本番 RLS 適用（リンク済み Supabase）
 *
 *   node scripts/apply-talk-production-supabase.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/talk-rls-production.sql",
  "sql/talk-rls-drop-dev-policies.sql",
];

function run(file) {
  console.log(`\n→ ${file}`);
  const r = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--yes", "-f", path.join(ROOT, file)],
    { cwd: ROOT, stdio: "inherit", shell: true }
  );
  if (r.status !== 0) throw new Error(`Failed: ${file}`);
}

function main() {
  console.log("TASFUL TALK — apply production RLS (linked project)");
  for (const f of FILES) run(f);
  console.log("\nDone. Run: node scripts/verify-talk-rls-staging.mjs");
}

main();
