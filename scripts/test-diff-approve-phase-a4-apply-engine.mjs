#!/usr/bin/env node
/**
 * Diff & Approve — Phase A4 apply engine tests
 *   node scripts/test-diff-approve-phase-a4-apply-engine.mjs
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

const FILE =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-a4-apply-engine.mjs";

console.log("A4 — files / static security");
assert("exists a4 module", existsSync(join(root, FILE)));
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
assert("commitApply forbidden", a4.commitApply({}).reason === "apply_forbidden");

const FIXED = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};
const EXEC_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function buildApprovedBundle() {
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
  assert("readiness ready", readiness.decision === "ready");
  return {
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
    readiness,
    plan: readiness.plan,
    gate_result: Object.freeze({
      ok: true,
      execution_id: EXEC_ID,
      decision: "allowed",
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
    }),
  };
}

console.log("\nA4 — Apply Engine happy path");
{
  const b = buildApprovedBundle();
  const store = new Set();
  const out = a4.runApplyEngine({
    proposal: b.proposal,
    diff: b.diff,
    impact: b.impact,
    actor: b.actor,
    plan: b.plan,
    readiness: b.readiness,
    gate_result: b.gate_result,
    idempotency_store: store,
    timestamp: "2026-07-28T03:00:00.000Z",
  });
  assert("engine ok", out.ok === true);
  assert("state validated", out.execution_state === "validated");
  assert("result validated", out.result.execution_state === "validated");
  assert("applied false", out.applied === false && out.result.applied === false);
  assert("executed false", out.executed === false && out.result.executed === false);
  assert("provider_called false", out.provider_called === false);
  assert("transmit false", out.transmit === false);
  assert("cost 0", out.recorded_api_cost === 0);
  assert("snapshot present", out.snapshot.execution_state === "validated");
  assert("rollback present", out.rollback.rollback_required === true);
  assert("hash present", typeof out.execution_hash === "string");
  assert("result frozen", Object.isFrozen(out.result));
}

console.log("\nA4 — Idempotency");
{
  const b = buildApprovedBundle();
  const store = new Set();
  const first = a4.runApplyEngine({
    proposal: b.proposal,
    diff: b.diff,
    impact: b.impact,
    actor: b.actor,
    readiness: b.readiness,
    plan: b.plan,
    gate_result: b.gate_result,
    idempotency_store: store,
  });
  assert("first ok", first.ok === true);
  const dup = a4.runApplyEngine({
    proposal: b.proposal,
    diff: b.diff,
    impact: b.impact,
    actor: b.actor,
    readiness: b.readiness,
    plan: b.plan,
    gate_result: b.gate_result,
    idempotency_store: store,
  });
  assert("duplicate blocked", dup.reason === "duplicate_apply");
  assert("dup applied false", dup.applied === false);
}

console.log("\nA4 — Rollback Plan / Validation");
{
  const rb = a4.buildRollbackPlan({ change_type: "update" });
  assert("rollback required", rb.rollback_required === true);
  assert("steps array", Array.isArray(rb.rollback_steps));

  const b = buildApprovedBundle();
  assert(
    "not approved",
    a4.runApplyEngine({
      proposal: a1.buildPendingApprovalProposal({
        ...FIXED,
        capability: "generate_ops_report",
        resource_type: "text",
        change_type: "update",
        before: "a",
        after: "b",
      }).proposal,
      diff: b.diff,
      impact: b.impact,
      actor: b.actor,
      gate_result: b.gate_result,
    }).reason === "not_approved"
  );

  assert(
    "missing gate",
    a4.runApplyEngine({
      proposal: b.proposal,
      diff: b.diff,
      impact: b.impact,
      actor: b.actor,
      readiness: b.readiness,
      plan: b.plan,
    }).reason === "missing_execution_gate"
  );

  assert(
    "invalid plan",
    a4.runApplyExecutor({
      proposal: b.proposal,
      plan: a4.deepFreeze({
        schema_version: "wrong",
        proposal_id: FIXED.proposal_id,
        resource_type: "settings",
        resource_id: null,
        change_type: "update",
        estimated_steps: [],
        requires_apply: true,
      }),
      gate_result: b.gate_result,
      readiness: b.readiness,
      execution_hash: "fnv1a32:deadbeef",
    }).reason === "invalid_plan"
  );

  assert(
    "not ready",
    a4.runApplyExecutor({
      proposal: b.proposal,
      plan: b.plan,
      gate_result: b.gate_result,
      readiness: { decision: "not_ready" },
      execution_hash: "fnv1a32:deadbeef",
    }).reason === "not_ready"
  );

  const extras = a4.runApplyEngine({
    proposal: b.proposal,
    gate_result: b.gate_result,
    prompt: "SECRET",
  });
  assert("extra fields", extras.reason === "extra_fields");

  const badSnap = a4.buildExecutionSnapshot({
    proposal_id: FIXED.proposal_id,
    execution_state: "executed",
    result: "x",
    timestamp: "2026-07-28T00:00:00.000Z",
  });
  assert("executed state rejected in snapshot", badSnap.ok === false);

  const mutablePlan = { ...b.plan };
  assert(
    "immutable plan",
    a4.validateApplyPlan(mutablePlan).reason === "invalid_plan"
  );
}

console.log("\nA4 — Regression A1–A3");
{
  assert("a1 apply forbidden", a1.applyProposal({}).ok === false);
  assert("a2 apply forbidden", a2.applyApprovedProposal({}).ok === false);
  assert("a3 apply forbidden", a3.applyProposalChanges({}).ok === false);
  assert("a4 commit forbidden", a4.commitApply({}).ok === false);

  const b = buildApprovedBundle();
  const out = a4.runApplyEngine({
    proposal: b.proposal,
    diff: b.diff,
    impact: b.impact,
    actor: b.actor,
    gate_result: b.gate_result,
  });
  assert("engine without explicit readiness still ok", out.ok === true);
  assert("still not executed", out.executed === false);
}

console.log(
  errors.length === 0
    ? `\nA4 PASSED (${errors.length} failures)`
    : `\nA4 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
