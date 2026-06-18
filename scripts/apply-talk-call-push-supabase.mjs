#!/usr/bin/env node
/**
 * TASFUL TALK — Push 着信 DB / RLS 適用
 *
 *   node scripts/apply-talk-call-push-supabase.mjs
 *
 * 要: リンク済み Supabase プロジェクト（npx supabase link）
 * 前提: talk-call-schema.sql / talk-rls-production.sql 適用済み
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/talk-call-push-schema.sql",
  "sql/talk-call-push-phase71-migration.sql",
  "sql/talk-call-push-rls-production.sql",
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
  console.log("TASFUL TALK — apply Push SQL (linked project)");
  for (const f of FILES) run(f);
  console.log("\nDone.");
}

main();
