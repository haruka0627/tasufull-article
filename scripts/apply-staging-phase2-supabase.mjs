#!/usr/bin/env node
/**
 * TASFUL Supabase Phase 2 — Staging へ SQL 適用
 *
 *   node scripts/apply-staging-phase2-supabase.mjs
 *
 * 要: npx supabase link（リンク済み Staging プロジェクト）
 * 本番接続・公開は行わない。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "sql/talk-sync-schema.sql",
  "sql/talk-follow-subscriptions.sql",
  "sql/staging-phase2-ops-schema.sql",
  "sql/staging-phase2-member-listings.sql",
  "sql/staging-phase2-ops-rls-dev.sql",
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
  console.log("TASFUL Supabase Phase 2 — apply staging SQL (linked project)");
  console.log("Tables: support_*, ai_ops_*, builder_partner_*, talk_ops_messages, member_favorites, listings");
  console.log("RLS: staging-phase2-ops-rls-dev.sql (SELECT only for anon — staging PoC)\n");
  for (const f of FILES) run(f);
  console.log("\nDone. Optional seed: node scripts/seed-staging-phase2-read-poc.mjs");
  console.log("Verify read PoC: node scripts/test-supabase-phase2-read-poc.mjs");
}

main();
