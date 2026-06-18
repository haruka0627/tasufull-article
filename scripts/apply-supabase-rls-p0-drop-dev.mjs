#!/usr/bin/env node
/**
 * Supabase RLS P0 — dev ポリシー DROP 一括適用
 *
 *   node scripts/apply-supabase-rls-p0-drop-dev.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/talk-rls-drop-dev-policies.sql",
  "sql/anpi-rls-drop-dev-policies.sql",
  "sql/anpi-no-response-phase2-drop-dev-policies.sql",
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
  console.log("Supabase RLS P0 — drop dev policies (linked project)");
  for (const f of FILES) run(f);
  console.log("\nDone.");
}

main();
