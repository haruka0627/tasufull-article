#!/usr/bin/env node
/**
 * Diff & Approve — Safe batch integration + A6–A11 coverage
 *   node scripts/test-diff-approve-safe-batch-integration.mjs
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

function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function assertNoNetwork(label, src) {
  const c = codeOnly(src);
  assert(`${label} no fetch`, !/\bfetch\s*\(/.test(c));
  assert(`${label} no axios`, !/\baxios\b/.test(c));
  assert(`${label} no process.env`, !/process\.env\b/.test(c));
  assert(`${label} no eval`, !/\beval\s*\(|new\s+Function\b/.test(c));
  assert(`${label} no dynamic import`, !/\bimport\s*\(/.test(c));
  assert(`${label} no adapter.execute`, !/adapter\.execute\s*\(/.test(c));
}

const modules = {
  a6: "deploy/cloudflare/functions/_shared/ai-diff-approve-a6-final-apply-gate.mjs",
  a7: "deploy/cloudflare/functions/_shared/ai-diff-approve-a7-persistence-in-memory.mjs",
  a8: "deploy/cloudflare/functions/_shared/ai-diff-approve-a8-read-model.mjs",
  a9: "deploy/cloudflare/functions/_shared/ai-diff-approve-a9-audit-timeline.mjs",
  a10: "deploy/cloudflare/functions/_shared/ai-diff-approve-a10-tamper-detection.mjs",
  a11: "deploy/cloudflare/functions/_shared/ai-diff-approve-a11-non-live-orchestrator.mjs",
};

console.log("Safe-batch — static security");
for (const [k, p] of Object.entries(modules)) {
  assert(`exists ${k}`, existsSync(join(root, p)));
  assertNoNetwork(k, readFileSync(join(root, p), "utf8"));
}

const a1 = await import(relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs"));
const a2 = await import(relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a2-approval.mjs"));
const a3 = await import(relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a3-apply-readiness.mjs"));
const a4 = await import(relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a4-apply-engine.mjs"));
const a5 = await import(relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a5-noop-apply-simulation.mjs"));
const a6 = await import(relUrl(modules.a6));
const a7 = await import(relUrl(modules.a7));
const a8 = await import(relUrl(modules.a8));
const a9 = await import(relUrl(modules.a9));
const a10 = await import(relUrl(modules.a10));
const a11 = await import(relUrl(modules.a11));

const FIXED = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};

function buildSimBundle() {
  const pending = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { enabled: false },
    after: { enabled: true },
  });
  assert("pending", pending.ok);
  const granted = a2.grantApproval({
    proposal: pending.proposal,
    actor: { role: "approver", id: "a" },
  });
  assert("granted", granted.ok);
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
      execution_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      decision: "allowed",
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
    }),
  });
  assert("engine", engine.ok);
  const sim = a5.runNoOpApplySimulation({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
  });
  assert("sim", sim.ok);
  return { pending, granted, readiness, engine, sim };
}

console.log("\nA6 — Final Apply Gate");
{
  const b = buildSimBundle();
  const ok = a6.evaluateFinalApplyGate({
    proposal: b.granted.proposal,
    readiness: b.readiness,
    apply_result: b.engine.result,
    simulation: b.sim.simulation,
    production_readiness: { decision: "ready" },
    activation: { activation_decision: "not_eligible" },
  });
  assert("eligible", ok.decision === "eligible_for_apply");
  assert("invariants", ok.applied === false && ok.executed === false);
  assert("perform forbidden", a6.performFinalApply({}).ok === false);

  const blocked = a6.evaluateFinalApplyGate({
    proposal: b.pending.proposal,
    readiness: b.readiness,
    apply_result: b.engine.result,
    simulation: b.sim.simulation,
  });
  assert("blocked not approved", blocked.decision === "not_eligible_for_apply");
}

console.log("\nA7 — Persistence");
{
  const repo = a7.createInMemoryRepository();
  const put = repo.put({
    schema_version: a7.PHASE_A7_SCHEMA_VERSION,
    record_type: "proposal",
    record_id: "r1",
    proposal_id: FIXED.proposal_id,
    payload: { status: "approved" },
    record_version: 1,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
  });
  assert("put ok", put.ok);
  const dup = repo.put({
    schema_version: a7.PHASE_A7_SCHEMA_VERSION,
    record_type: "proposal",
    record_id: "r1",
    proposal_id: FIXED.proposal_id,
    payload: { status: "approved" },
    record_version: 1,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
  });
  assert("duplicate", dup.reason === "duplicate_key");
  const claim = repo.claimIdempotency("k1", "t1");
  assert("idem claim", claim.ok);
  assert("idem dup", repo.claimIdempotency("k1", "t2").ok === false);
}

console.log("\nA8/A9 — Read model + Timeline");
{
  const tl = a9.createAuditTimeline();
  const e1 = a9.buildTimelineEvent({
    event_id: "e1",
    event_type: "proposal_created",
    proposal_id: FIXED.proposal_id,
    timestamp: "2026-07-28T00:00:00.000Z",
    sequence: 0,
    payload: {},
  });
  assert("event1", e1.ok && tl.append(e1.value).ok);
  const e2 = a9.buildTimelineEvent({
    event_id: "e2",
    event_type: "approval_granted",
    proposal_id: FIXED.proposal_id,
    timestamp: "2026-07-28T00:00:01.000Z",
    sequence: 1,
    payload: {},
  });
  assert("event2", e2.ok && tl.append(e2.value).ok);
  assert(
    "ooo",
    tl.append(
      a9.buildTimelineEvent({
        event_id: "e3",
        event_type: "approval_granted",
        proposal_id: FIXED.proposal_id,
        timestamp: "2026-07-28T00:00:02.000Z",
        sequence: 1,
        payload: {},
      }).value
    ).reason === "out_of_order"
  );
  assert(
    "unknown event",
    a9.buildTimelineEvent({
      event_id: "ex",
      event_type: "applied",
      proposal_id: FIXED.proposal_id,
      timestamp: "2026-07-28T00:00:00.000Z",
      sequence: 9,
      payload: {},
    }).ok === false
  );

  const rm = a8.projectReadModel({
    proposal: { proposal_id: FIXED.proposal_id, status: "approved", capability: "generate_ops_report", resource_type: "settings" },
    approval: { decision: "approved", actor: { role: "approver" } },
    readiness: { decision: "ready" },
    impact: { estimated_risk: "medium", approval_required: true, changed_fields: ["enabled"] },
    simulation: { simulation_state: "simulated" },
    final_gate: { decision: "eligible_for_apply", blocking_reasons: [] },
    audit_timeline: tl.list(),
  });
  assert("read model", rm.ok && rm.value.status === "approved");
  const q = a8.queryReadModels([rm.value], { status: "approved", page: 1, pageSize: 10 });
  assert("query", q.total === 1);
  assert("group", a8.groupByStatus([rm.value]).approved === 1);
}

console.log("\nA10 — Tamper");
{
  const v = { a: 1 };
  const h = a10.hashValue(v);
  assert("hash", typeof h === "string");
  const ok = a10.detectTampering({ proposal: v, expected: { proposal: h } });
  assert("tamper ok", ok.ok);
  const bad = a10.detectTampering({
    proposal: { a: 2 },
    expected: { proposal: h },
  });
  assert("tamper detect", bad.ok === false);
  const chain = a10.hashChain([h, h]);
  assert(
    "chain mismatch",
    a10.detectTampering({
      audit_hashes: [h, h],
      expected_chain: "wrong",
    }).reason === "audit_chain_mismatch"
  );
  assert("chain ok", a10.detectTampering({ audit_hashes: [h, h], expected_chain: chain }).ok);
}

console.log("\nA11 — E2E orchestrator");
{
  const out = a11.runNonLiveOrchestrator({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "json",
    resource_id: "cfg",
    change_type: "update",
    before: { x: 1 },
    after: { x: 2 },
    production_readiness: { decision: "ready" },
    activation: { activation_decision: "not_eligible" },
  });
  assert("e2e ok", out.ok === true);
  assert("final eligible", out.final_gate.decision === "eligible_for_apply");
  assert("timeline events", out.audit_timeline.length >= 8);
  assert("read model", out.read_model.final_gate_decision === "eligible_for_apply");
  assert("sec applied false", out.security_invariants.applied === false);
  assert("sec executed false", out.security_invariants.executed === false);
  assert("sec db false", out.security_invariants.db_written === false);
  assert("sec network false", out.security_invariants.network_called === false);

  const fail = a11.runNonLiveOrchestrator({
    capability: "nope",
    resource_type: "json",
    change_type: "update",
    before: {},
    after: {},
  });
  assert("e2e fail-closed", fail.ok === false);
}

console.log("\nRegression A1–A5 forbid apply");
{
  assert("a1", a1.applyProposal({}).ok === false);
  assert("a2", a2.applyApprovedProposal({}).ok === false);
  assert("a3", a3.applyProposalChanges({}).ok === false);
  assert("a4", a4.commitApply({}).ok === false);
  assert("a5", a5.commitSimulatedApply({}).ok === false);
  assert("a6", a6.performFinalApply({}).ok === false);
}

console.log(
  errors.length === 0
    ? `\nSAFE BATCH PASSED (${errors.length} failures)`
    : `\nSAFE BATCH FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
