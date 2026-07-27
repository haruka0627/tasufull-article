#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B2 DB static verification (+ B1 contract alignment)
 *   node scripts/test-ai-exec-gate-phase-b2-db.mjs
 *
 * Staging/Production apply · commit · push · deploy は行わない。
 * Local live probes (optional ops): use `npx supabase db reset` / `migration up --local`
 * then constraint probes documented in reports/ai-exec-gate-phase-b2-migration-notes.md
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationRel =
  "supabase/migrations/20260728120000_ai_exec_gate_phase_b2.sql";
const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

console.log("B2 — static migration / B1 alignment");
assert("migration file exists", existsSync(join(root, migrationRel)));
const sql = read(migrationRel);

assert(
  "creates ai_execution_requests",
  /create table if not exists public\.ai_execution_requests/i.test(sql)
);
assert(
  "creates ai_execution_events",
  /create table if not exists public\.ai_execution_events/i.test(sql)
);
assert(
  "creates ai_execution_results",
  /create table if not exists public\.ai_execution_results/i.test(sql)
);
assert(
  "does not create ai_feature_flags",
  !/create table if not exists public\.ai_feature_flags/i.test(sql)
);
assert(
  "does not create ai_emergency_controls",
  !/create table if not exists public\.ai_emergency_controls/i.test(sql)
);
assert(
  "B1 env is flag/stop SSOT comment",
  /Feature Flag \/ Emergency Stop control SSOT = B1 env only/i.test(sql)
);
assert("no capability seed table", !/ai_capability_definitions/i.test(sql));
assert("Production No-Go comment", /Production apply No-Go/i.test(sql));
assert("Phase B2 marker", /Phase B2/i.test(sql));

assert(
  "capability CHECK collect+generate",
  /collect_daily_ops/.test(sql) && /generate_ops_report/.test(sql)
);
assert(
  "action CHECK pipeline",
  /ops_secretary\.daily_pending\.report_pipeline/.test(sql)
);
assert("service CHECK ops_secretary", /target_service = 'ops_secretary'/.test(sql));
assert(
  "ports CHECK three",
  /ops_collector/.test(sql) &&
    /secretary_deepseek/.test(sql) &&
    /gate_audit_writer/.test(sql)
);
assert("blocked reason budget_hard_cap", /budget_hard_cap/.test(sql));
assert("blocked reason feature_disabled", /feature_disabled/.test(sql));
assert(
  "execution_status FREEZE set",
  /'draft'/.test(sql) && /'succeeded'/.test(sql) && /'blocked'/.test(sql)
);
assert(
  "no pending-as-status sole list",
  !/execution_status in \(\s*'pending'/i.test(sql)
);
assert(
  "preflight decision allowed|blocked",
  /preflight_decision[\s\S]{0,200}'allowed'[\s\S]{0,80}'blocked'/i.test(sql)
);
assert(
  "idempotency unique",
  /ai_exec_req_idempotency_key_unique|unique \(idempotency_key\)/i.test(sql)
);
assert(
  "idempotency length 8-200",
  /idempotency_key\) between 8 and 200/i.test(sql)
);
assert("phase_b_no_parent check", /ai_exec_req_phase_b_no_parent/i.test(sql));
assert(
  "event sequence unique",
  /unique \(execution_id, sequence_number\)/i.test(sql)
);
assert(
  "event ON DELETE RESTRICT",
  /references public\.ai_execution_requests \(id\) on delete restrict/i.test(sql)
);
assert(
  "append-only forbid trigger",
  /ai_exec_gate_forbid_event_mutation/i.test(sql)
);
assert(
  "events grant select,insert only to service_role",
  /grant select, insert on table public\.ai_execution_events to service_role/i.test(
    sql
  )
);
assert(
  "events revoke includes service_role before grant",
  /revoke all on table public\.ai_execution_events from public, anon, authenticated, service_role/i.test(
    sql
  )
);
assert(
  "requests no delete grant line",
  !/grant select, insert, update, delete on table public\.ai_execution_requests/i.test(
    sql
  )
);
assert(
  "RLS enable requests",
  /alter table public\.ai_execution_requests enable row level security/i.test(sql)
);
assert("deny-all policy requests", /ai_exec_req_deny_all/i.test(sql));
assert(
  "SAFE-06/07 not altered",
  !/alter table public\.ai_usage_events/i.test(sql) &&
    !/ai_cost_ledger/i.test(sql)
);
assert(
  "no Gate API RPC",
  !/create or replace function public\.ai_exec_gate_(create|execute)/i.test(sql)
);
assert(
  "budget snapshot columns",
  /budget_limit_snapshot/.test(sql) &&
    /estimated_api_cost/.test(sql) &&
    /budget_day_key/.test(sql)
);
assert(
  "budget currency USD only",
  /budget_currency = 'USD'/.test(sql)
);
assert(
  "budget limit positive when set",
  /budget_limit_snapshot > 0/.test(sql)
);
assert(
  "no DB numeric hard-cap default",
  !/budget_limit_snapshot[^,\n]*default\s+0\.1/i.test(sql) &&
    !/estimated_api_cost[^,\n]*default\s+0\.1/i.test(sql)
);
assert(
  "flag/stop snapshot columns (audit only)",
  /feature_flag_enabled/.test(sql) && /emergency_stop_active/.test(sql)
);

const types = await import(
  `${pathToFileURL(join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs")).href}?t=${Date.now()}`
);
const caps = await import(
  `${pathToFileURL(join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs")).href}?t=${Date.now()}`
);
const flags = await import(
  `${pathToFileURL(join(root, "deploy/cloudflare/functions/_shared/ai-exec-gate-flags.mjs")).href}?t=${Date.now()}`
);

for (const reason of types.GATE_BLOCKED_REASONS) {
  assert(`SQL contains blocked reason ${reason}`, sql.includes(`'${reason}'`));
}
for (const key of caps.PHASE_B_CAPABILITY_KEYS) {
  assert(`SQL contains capability ${key}`, sql.includes(`'${key}'`));
}
assert("SQL action matches B1", sql.includes(`'${caps.PHASE_B_ACTION_TYPE}'`));
assert(
  "SQL service matches B1",
  sql.includes(`'${caps.PHASE_B_TARGET_SERVICE}'`)
);
for (const port of caps.PHASE_B_EXECUTOR_PORTS) {
  assert(`SQL contains port ${port}`, sql.includes(`'${port}'`));
}
assert(
  "flag key string present for docs alignment",
  sql.includes(flags.PHASE_B_FEATURE_FLAG_KEY) ||
    sql.includes("ai_exec_gate.phase_b.daily_ops_report") ||
    /feature_flag_key/.test(sql)
);

assert("FREEZE doc untouched by this test", existsSync(join(root, "docs/AI/AI_EXECUTION_GATE.md")));

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  process.exit(1);
}
console.log("\nALL PASSED");
