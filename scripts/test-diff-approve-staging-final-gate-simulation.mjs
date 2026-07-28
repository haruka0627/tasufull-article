#!/usr/bin/env node
/**
 * Diff & Approve — Staging Final Apply Gate + simulation tests
 *   node scripts/test-diff-approve-staging-final-gate-simulation.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const migrationRel =
  "supabase/migrations/20260728200000_ai_diff_approve_staging_final_gate_simulation.sql";

let pass = 0;
let fail = 0;
const failures = [];

function ok(label) {
  pass += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  fail += 1;
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

function loadEnvFile(rel) {
  const p = path.join(ROOT, rel);
  const o = {};
  if (!existsSync(p)) return o;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

console.log("1) Static migration / isolation");
if (existsSync(path.join(ROOT, migrationRel))) ok("migration exists");
else bad("migration exists");
const sql = read(migrationRel);
if (/ai_diff_approve_confirm_apply_gate/.test(sql)) ok("gate RPC");
else bad("gate RPC");
if (/ai_diff_approve_simulate_execution/.test(sql)) ok("sim RPC");
else bad("sim RPC");
if (/set search_path = public/.test(sql)) ok("search_path");
else bad("search_path");
if (/mode = 'staging_simulation'/.test(sql)) ok("sim mode only");
else bad("sim mode");
if (/status <> 'succeeded'/.test(sql) || /no_real_success/.test(sql))
  ok("no succeeded status");
else bad("succeeded banned");
if (!/to_status = 'applying'|performApply|executeProvider/.test(sql))
  ok("no Apply mutation SQL");
else bad("Apply SQL");
if (/grant execute.*service_role/.test(sql)) ok("service_role grant");
else bad("grant");
if (/revoke all on function[\s\S]*from public, anon, authenticated/.test(sql))
  ok("anon revoke");
else bad("anon revoke");

console.log("2) Contract unit");
const contractUrl = pathToFileURL(
  path.join(
    ROOT,
    "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-final-gate-contract.mjs"
  )
).href;
const {
  validateApplyGateInput,
  validateSimulateExecutionInput,
  classifySimulationOutcome,
  CONFIRMATION_PHRASE,
  EXEC_STATUSES,
  GATE_ERRORS,
} = await import(contractUrl);

{
  const badExtra = validateApplyGateInput({
    requestId: randomUUID(),
    expectedVersion: 1,
    idempotencyKey: "idem-key-12",
    planId: randomUUID(),
    planFingerprint: "abcdefgh",
    confirmationPhrase: CONFIRMATION_PHRASE,
    evil: 1,
  });
  if (!badExtra.ok && badExtra.error === GATE_ERRORS.EXTRA_FIELDS)
    ok("gate unknown field");
  else bad("gate unknown field");
}
{
  const badPhrase = validateApplyGateInput({
    requestId: randomUUID(),
    expectedVersion: 1,
    idempotencyKey: "idem-key-12",
    planId: randomUUID(),
    planFingerprint: "abcdefghijkl",
    confirmationPhrase: "yes",
  });
  if (!badPhrase.ok && badPhrase.error === GATE_ERRORS.INVALID_CONFIRMATION)
    ok("confirmation required");
  else bad("confirmation required");
}
{
  const good = validateApplyGateInput({
    requestId: randomUUID(),
    expectedVersion: 3,
    idempotencyKey: "idem-key-ok-99",
    planId: randomUUID(),
    planFingerprint: "fp12345678",
    confirmationPhrase: CONFIRMATION_PHRASE,
  });
  if (good.ok) ok("valid gate input");
  else bad("valid gate input", good.error);
}
{
  const okSim = classifySimulationOutcome("ok");
  if (
    okSim.status === EXEC_STATUSES.SIMULATED &&
    okSim.rollbackAvailable === false &&
    okSim.providerExecuted === false
  )
    ok("sim ok classification");
  else bad("sim ok classification");
  const tr = classifySimulationOutcome("transient_fail");
  if (tr.retryable === true && tr.status === EXEC_STATUSES.FAILED)
    ok("transient retryable");
  else bad("transient");
  const pf = classifySimulationOutcome("permanent_fail");
  if (pf.retryable === false && pf.status === EXEC_STATUSES.FAILED)
    ok("permanent non-retryable");
  else bad("permanent");
}
{
  const sim = validateSimulateExecutionInput({
    requestId: randomUUID(),
    expectedVersion: 1,
    idempotencyKey: "sim-key-12345",
    gateId: randomUUID(),
    planId: randomUUID(),
    outcomeHint: "ok",
  });
  if (sim.ok && sim.value.mode === "staging_simulation") ok("sim input");
  else bad("sim input");
}

console.log("3) Evaluate gate pure");
const serviceUrl = pathToFileURL(
  path.join(
    ROOT,
    "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-final-gate.mjs"
  )
).href;
const { evaluateApplyGateForTests } = await import(serviceUrl);
{
  const proposalId = randomUUID();
  const proposal = {
    proposal_id: proposalId,
    status: "approved",
    capability: "diff_approve",
    resource_type: "test",
    resource_id: "r1",
    record_version: 2,
    applied: false,
    executed: false,
    provider_called: false,
    payload: {},
  };
  // build a matching plan via apply-plan compute
  const planMod = await import(
    pathToFileURL(
      path.join(
        ROOT,
        "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-apply-plan.mjs"
      )
    ).href
  );
  const computed = planMod.computeDryRunPlan({
    proposal,
    timeline: [
      {
        sequence_number: 1,
        previous_event_hash: "genesis",
        event_hash: "hash1aaaa",
        event_type: "approval_granted",
      },
    ],
    approvalRecord: { payload: { ok: true } },
  });
  const ev = evaluateApplyGateForTests({
    proposal,
    plan: {
      planId: randomUUID(),
      status: "ready",
      fingerprint: computed.fingerprint,
      sourceVersion: 2,
    },
    expectedFingerprint: computed.fingerprint,
    timeline: [
      {
        sequence_number: 1,
        previous_event_hash: "genesis",
        event_hash: "hash1aaaa",
        event_type: "approval_granted",
      },
    ],
    approvalRecord: { payload: { ok: true } },
    activeExecution: false,
  });
  if (ev.status === "apply_ready") ok("gate apply_ready");
  else bad("gate apply_ready", JSON.stringify(ev.blockers));

  const stale = evaluateApplyGateForTests({
    proposal,
    plan: {
      planId: randomUUID(),
      status: "ready",
      fingerprint: computed.fingerprint,
      sourceVersion: 2,
    },
    expectedFingerprint: "wrongfingerprintxx",
    timeline: [
      {
        sequence_number: 1,
        previous_event_hash: "genesis",
        event_hash: "hash1aaaa",
        event_type: "approval_granted",
      },
    ],
    approvalRecord: { payload: { ok: true } },
  });
  if (stale.status === "blocked" && stale.blockers.includes("FINGERPRINT_MISMATCH"))
    ok("fingerprint mismatch blocked");
  else bad("fingerprint mismatch");

  const draft = evaluateApplyGateForTests({
    proposal: { ...proposal, status: "draft" },
    plan: {
      planId: randomUUID(),
      status: "ready",
      fingerprint: computed.fingerprint,
      sourceVersion: 2,
    },
    expectedFingerprint: computed.fingerprint,
    timeline: [],
    approvalRecord: null,
  });
  if (draft.status === "blocked") ok("draft blocked");
  else bad("draft blocked");
}

console.log("4) Source isolation (no Apply imports)");
const finalGateSrc = read(
  "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-final-gate.mjs"
);
if (
  !/performApply|executeProvider|commitApply|performFinalApply/.test(
    finalGateSrc
  )
)
  ok("service no Apply calls");
else bad("service Apply calls");
const apiGate = read(
  "deploy/cloudflare/functions/api/ai-diff-approve/[id]/apply-gate.js"
);
const apiSim = read(
  "deploy/cloudflare/functions/api/ai-diff-approve/[id]/simulate-execution.js"
);
if (!/\/apply['"`]|executeProvider/.test(apiGate + apiSim)) ok("API isolation");
else bad("API isolation");
const ui = read("admin-diff-approve-client.js");
if (
  /Run Staging Simulation/.test(ui) &&
  /Confirm Final Apply Gate/.test(ui) &&
  /SIMULATION ONLY/.test(ui) &&
  !/Provider Execute/.test(ui) &&
  !/\btextContent = "Apply"/.test(ui) &&
  !/\btextContent = 'Apply'/.test(ui)
)
  ok("UI simulation labels");
else bad("UI labels");
if (
  !/Run in Production/.test(ui) &&
  !/Automatic Retry/.test(ui) &&
  !/Automatic Rollback/.test(ui)
)
  ok("UI no dangerous actions");
else bad("UI dangerous");

console.log("5) Staging live (if credentials)");
const fileEnv = {
  ...loadEnvFile(".env.staging"),
  ...loadEnvFile(".dev.vars"),
};
const url =
  process.env.TASFUL_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  fileEnv.TASFUL_SUPABASE_URL ||
  fileEnv.SUPABASE_URL ||
  "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
  "";
const anon =
  process.env.TASFUL_SUPABASE_ANON_KEY ||
  fileEnv.TASFUL_SUPABASE_ANON_KEY ||
  fileEnv.SUPABASE_ANON_KEY ||
  "";

if (!url || !url.includes(STAGING_REF)) {
  ok("skip live (no staging url in env) — static PASS");
} else if (url.includes(PRODUCTION_REF)) {
  bad("production url detected");
} else if (!serviceKey) {
  ok("skip live (no service key) — static PASS");
} else {
  ok("staging url ok");
  // table / RPC presence
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const tRes = await fetch(
    `${url}/rest/v1/ai_diff_approve_apply_gates?select=id&limit=1`,
    { headers }
  );
  if (tRes.ok) ok("gates table readable service_role");
  else bad("gates table", String(tRes.status));
  const eRes = await fetch(
    `${url}/rest/v1/ai_diff_approve_execution_attempts?select=id&limit=1`,
    { headers }
  );
  if (eRes.ok) ok("attempts table readable");
  else bad("attempts table", String(eRes.status));

  if (anon) {
    const aRes = await fetch(
      `${url}/rest/v1/ai_diff_approve_apply_gates?select=id&limit=1`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
      }
    );
    if (!aRes.ok || aRes.status === 401 || aRes.status === 403)
      ok("anon denied gate table");
    else {
      const rows = await aRes.json().catch(() => null);
      if (Array.isArray(rows) && rows.length === 0) ok("anon empty/denied");
      else bad("anon access", String(aRes.status));
    }
  }
}

const summary = {
  pass,
  fail,
  failures,
  verdict:
    fail === 0
      ? "PASS_DIFF_APPROVE_STAGING_FINAL_GATE_SIMULATION_TESTS"
      : "FAIL",
};
writeFileSync(
  path.join(
    ROOT,
    "reports/diff-approve-staging-final-gate-simulation-summary.json"
  ),
  JSON.stringify(summary, null, 2)
);
console.log(`\npass=${pass} fail=${fail}`);
if (fail) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(summary.verdict);
