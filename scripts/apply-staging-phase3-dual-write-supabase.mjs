#!/usr/bin/env node
/**
 * Staging に Phase 3 dual-write 用 INSERT RLS を適用
 *   node scripts/apply-staging-phase3-dual-write-supabase.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = "sql/staging-phase3-ops-rls-dual-write-dev.sql";

const r = spawnSync(
  "npx",
  ["supabase", "db", "query", "--linked", "--yes", "-f", path.join(ROOT, file)],
  { cwd: ROOT, stdio: "inherit", shell: true }
);
process.exit(r.status === 0 ? 0 : 1);
