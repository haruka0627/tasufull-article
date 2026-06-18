#!/usr/bin/env node
/**
 * TASFUL TALK — ステージング Supabase へ SQL 適用
 *
 *   node scripts/apply-talk-staging-supabase.mjs
 *
 * 要: リンク済み Supabase プロジェクト（npx supabase link）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/talk-sync-schema.sql",
  "sql/talk-follow-subscriptions.sql",
  "sql/talk-broadcast-drafts-send.sql",
  "sql/talk-realtime-publication.sql",
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
  console.log("TASFUL TALK — apply staging SQL (linked project)");
  for (const f of FILES) run(f);
  console.log("\nDone. Optional production RLS: sql/talk-rls-production.sql");
}

main();
