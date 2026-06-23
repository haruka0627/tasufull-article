#!/usr/bin/env node
/**
 * L10 — MATCH schema migration + remote Edge smoke regression
 *
 *   node scripts/verify-auth-hook-l10-match-schema.mjs
 *   node scripts/verify-auth-hook-l10-match-schema.mjs --skip-apply
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · RLS NOT enabled
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadL7Config, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/20260621160000_create_match_schema.sql";
const skipApply = process.argv.includes("--skip-apply");

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseCliJson(out) {
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function runSqlFile(relPath) {
  const sqlPath = path.join(ROOT, relPath);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`${relPath} failed: ${combined.slice(0, 500)}`);
  return parseCliJson(combined)?.rows?.[0] ?? null;
}

function applyMigration() {
  const sqlPath = path.join(ROOT, MIGRATION);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`migration apply failed: ${combined.slice(0, 800)}`);
}

function assertPostGates(row) {
  if (Number(row.core_table_count) !== 8) {
    throw new Error(`core_table_count=${row.core_table_count}, expected 8`);
  }
  if (Number(row.legacy_user_count) !== 7) {
    throw new Error(`legacy_user_count=${row.legacy_user_count}`);
  }
  if (Number(row.allowlist_backfill_count) !== 5) {
    throw new Error(`allowlist_backfill_count=${row.allowlist_backfill_count}`);
  }
  if (Number(row.hook_func_count) !== 1) {
    throw new Error(`hook_func_count=${row.hook_func_count}`);
  }
  if (Number(row.rls_enabled_count) !== 0) {
    throw new Error(`RLS enabled on ${row.rls_enabled_count} MATCH tables`);
  }
  if (Number(row.pk_constraint_count) !== 8) {
    throw new Error(`pk_constraint_count=${row.pk_constraint_count}`);
  }
  if (Number(row.fk_constraint_count) < 3) {
    throw new Error(`fk_constraint_count=${row.fk_constraint_count}`);
  }
  if (Number(row.unique_constraint_count) < 4) {
    throw new Error(`unique_constraint_count=${row.unique_constraint_count}`);
  }
  if (Number(row.index_count) < 15) {
    throw new Error(`index_count=${row.index_count}`);
  }
  if (Number(row.status_timestamp_col_count) < 16) {
    throw new Error(`status_timestamp_col_count=${row.status_timestamp_col_count}`);
  }
}

async function runEdgeSmokeRegression() {
  const script = path.join(ROOT, "scripts", "verify-auth-hook-l9-remote-edge-smoke.mjs");
  const r = spawnSync(process.execPath, [script, "--skip-deploy", "--skip-db-gates"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`L9 edge smoke regression failed:\n${(r.stderr || r.stdout).slice(-600)}`);
  }
}

async function main() {
  loadL7Config();
  console.log(`L10 MATCH schema · ref=${PROJECT_REF}${skipApply ? " · skip-apply" : ""}`);

  try {
    const pre = runSqlFile("sql/auth-hook-l10-pre-gates.sql");
    if (!pre || Number(pre.match_table_count) !== 0) {
      throw new Error(`pre-apply match_table_count=${pre?.match_table_count ?? "null"}, expected 0`);
    }
    pass("Pre-apply gate", "match_* tables = 0");
  } catch (e) {
    if (skipApply) {
      pass("Pre-apply gate", "skipped (--skip-apply · schema may exist)");
    } else {
      fail("Pre-apply gate", e.message);
      process.exit(1);
    }
  }

  if (!skipApply) {
    try {
      applyMigration();
      pass("MATCH schema migration", MIGRATION);
    } catch (e) {
      fail("MATCH schema migration", e.message);
      process.exit(1);
    }
  } else {
    pass("MATCH schema migration", "skipped (--skip-apply)");
  }

  try {
    const row = runSqlFile("sql/auth-hook-l10-verify-gates.sql");
    if (!row) throw new Error("post gates returned no rows");
    assertPostGates(row);
    pass(
      "Post-apply schema gates",
      `tables=8 pk=8 fk>=3 idx=${row.index_count} rls=0 legacy=7 allowlist=5`,
    );
  } catch (e) {
    fail("Post-apply schema gates", e.message);
    process.exit(1);
  }

  try {
    await runEdgeSmokeRegression();
    pass("Remote Edge smoke regression", "T1 swipe/self · report/block/verification · admin 403");
  } catch (e) {
    fail("Remote Edge smoke regression", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL10 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_LINKED_REF_L11_RLS_D2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
