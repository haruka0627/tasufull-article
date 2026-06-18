#!/usr/bin/env node
/**
 * 安否未応答 Phase2 — Supabase SQL 適用
 *
 *   node scripts/apply-anpi-no-response-phase2-supabase.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/anpi-no-response-phase2-schema.sql",
  "sql/anpi-no-response-phase2-rls.sql",
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

function main() {
  console.log("TASFUL 安否未応答 Phase2 — apply SQL (linked project)");
  for (const f of FILES) run(f);
  console.log("\nDone.");
}

main();
