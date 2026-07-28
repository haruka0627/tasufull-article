#!/usr/bin/env node
/**
 * Diff & Approve — Phase A5 NoOp apply simulation tests
 *   node scripts/test-diff-approve-phase-a5-apply-simulation.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

function relUrl(rel) {
  return `${pathToFileURL(join(root, rel)).href}?t=${Date.now()}`;
}

const a1 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs"
  )
);
const a2 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a2-approval.mjs")
);
const a3 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-diff-approve-a3-apply-readiness.mjs"
  )
);
const a4 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a4-apply-engine.mjs")
);
const a5 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-diff-approve-a5-noop-apply-simulation.mjs"
  )
);

const FILE =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-a5-noop-apply-simulation.mjs";

console.log("A5 — files / static security");
assert("exists a5 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert("no fetch(", !/\bfetch\s*\(/.test(codeOnly));
assert("no axios", !/\baxios\b/.test(codeOnly));
assert("no WebSocket", !/\bWebSocket\b/.test(codeOnly));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google|deepseek)/i.test(codeOnly)
);
assert("no process.env", !/process\.env\b/.test(codeOnly));
assert("no Authorization", !/Authorization/i.test(codeOnly));
assert("no api_key", !/\bapi[_-]?key\b/i.test(codeOnly));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(codeOnly));
assert("no dynamic import", !/\bimport\s*\(/.test(codeOnly));
assert("no adapter.execute", !/adapter\.execute\s*\(/.test(codeOnly));
assert(
  "commit forbidden",
  a5.commitSimulatedApply({}).reason === "apply_forbidden"
);

const FIXED = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};
const EXEC_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function buildValidatedEngineOut() {
  const pending = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { enabled: false },
    after: { enabled: true },
  });
  assert("pending ok", pending.ok === true);
  const granted = a2.grantApproval({
    proposal: pending.proposal,
    actor: { role: "approver", id: "a1" },
  });
  assert("granted ok", granted.ok === true);
  const readiness = a3.evaluateApplyReadiness({
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
  });
  assert("ready", readiness.decision === "ready");
  const engine = a4.runApplyEngine({
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
    plan: readiness.plan,
    readiness,
    gate_result: Object.freeze({
      ok: true,
      execution_id: EXEC_ID,
      decision: "allowed",
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
    }),
  });
  assert("engine validated", engine.ok === true);
  return { pending, granted, readiness, engine };
}

console.log("\nA5 — Simulation happy path");
{
  const { readiness, engine } = buildValidatedEngineOut();
  const store = new Set();
  const sim = a5.runNoOpApplySimulation({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
    idempotency_store: store,
    timestamp: "2026-07-28T04:00:00.000Z",
  });
  assert("sim ok", sim.ok === true);
  assert("state simulated", sim.simulation_state === "simulated");
  assert(
    "execution_state still validated",
    sim.simulation.execution_state === "validated"
  );
  assert("applied false", sim.applied === false);
  assert("executed false", sim.executed === false);
  assert("provider_called false", sim.provider_called === false);
  assert("transmit false", sim.transmit === false);
  assert("cost 0", sim.recorded_api_cost === 0);
  assert("rollback simulated", sim.rollback_simulation.rollback_simulated === true);
  assert("audit present", sim.audit.simulation_state === "simulated");
  assert("snapshot simulated", sim.snapshot.simulation_state === "simulated");
  assert("frozen", Object.isFrozen(sim.simulation));
}

console.log("\nA5 — Rollback / Audit / Validation");
{
  const { readiness, engine } = buildValidatedEngineOut();

  const plannedResult = a5.deepFreeze({
    schema_version: engine.result.schema_version,
    proposal_id: engine.result.proposal_id,
    execution_id: engine.result.execution_id,
    execution_state: "planned",
    execution_hash: engine.result.execution_hash,
    result: engine.result.result,
    rollback: engine.result.rollback,
    timestamp: engine.result.timestamp,
    reason: engine.result.reason,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  assert(
    "not validated",
    a5.runNoOpApplySimulation({
      apply_result: plannedResult,
      execution_snapshot: engine.snapshot,
      plan: readiness.plan,
    }).reason === "not_validated"
  );

  // Force not_validated via snapshot with wrong state using deepFreeze copy fields
  const badSnap = a5.deepFreeze({
    schema_version: engine.snapshot.schema_version,
    proposal_id: engine.snapshot.proposal_id,
    execution_state: "planned",
    result: "x",
    timestamp: engine.snapshot.timestamp,
    execution_id: engine.snapshot.execution_id,
    execution_hash: engine.snapshot.execution_hash,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  assert(
    "invalid/not validated snapshot",
    a5.runNoOpApplySimulation({
      apply_result: engine.result,
      execution_snapshot: badSnap,
      plan: readiness.plan,
    }).reason === "not_validated"
  );

  const store = new Set();
  const first = a5.runNoOpApplySimulation({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
    idempotency_store: store,
  });
  assert("first sim ok", first.ok === true);
  const dup = a5.runNoOpApplySimulation({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
    idempotency_store: store,
  });
  assert("duplicate simulation", dup.reason === "duplicate_simulation");

  assert(
    "extra fields",
    a5.runNoOpApplySimulation({
      apply_result: engine.result,
      execution_snapshot: engine.snapshot,
      plan: readiness.plan,
      prompt: "SECRET",
    }).reason === "extra_fields"
  );

  const mutableSnap = { ...engine.snapshot };
  assert(
    "immutable snapshot",
    a5.validateExecutionSnapshotForSimulation(mutableSnap).reason ===
      "invalid_snapshot"
  );

  const badRb = a5.buildRollbackSimulation({
    rollback: { rollback_required: false, rollback_steps: [] },
  });
  assert("invalid rollback", badRb.reason === "invalid_rollback");

  const audit = a5.buildExecutionAudit({
    proposal_id: FIXED.proposal_id,
    execution_id: EXEC_ID,
    simulation_state: "simulated",
    duration_ms: 0,
    timestamp: "2026-07-28T00:00:00.000Z",
  });
  assert("audit ok", audit.ok === true);
}

console.log("\nA5 — Regression A1–A4");
{
  assert("a1 apply forbidden", a1.applyProposal({}).ok === false);
  assert("a2 apply forbidden", a2.applyApprovedProposal({}).ok === false);
  assert("a3 apply forbidden", a3.applyProposalChanges({}).ok === false);
  assert("a4 commit forbidden", a4.commitApply({}).ok === false);
  assert("a5 commit forbidden", a5.commitSimulatedApply({}).ok === false);

  const { readiness, engine } = buildValidatedEngineOut();
  const sim = a5.noOpApplyExecutor({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
  });
  assert("alias works", sim.ok === true && sim.executed === false);
}

console.log(
  errors.length === 0
    ? `\nA5 PASSED (${errors.length} failures)`
    : `\nA5 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
