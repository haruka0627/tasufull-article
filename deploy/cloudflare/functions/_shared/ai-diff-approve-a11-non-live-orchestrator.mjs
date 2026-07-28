/**
 * Diff & Approve — Phase A11 Non-Live Orchestrator.
 * Wires A1–A10. Never calls real apply / network / DB drivers.
 */

import {
  buildPendingApprovalProposal,
  deepFreeze,
} from "./ai-diff-approve-a1-foundation.mjs";
import { grantApproval } from "./ai-diff-approve-a2-approval.mjs";
import { evaluateApplyReadiness } from "./ai-diff-approve-a3-apply-readiness.mjs";
import { runApplyEngine } from "./ai-diff-approve-a4-apply-engine.mjs";
import { runNoOpApplySimulation } from "./ai-diff-approve-a5-noop-apply-simulation.mjs";
import { evaluateFinalApplyGate } from "./ai-diff-approve-a6-final-apply-gate.mjs";
import { createInMemoryRepository } from "./ai-diff-approve-a7-persistence-in-memory.mjs";
import { projectReadModel } from "./ai-diff-approve-a8-read-model.mjs";
import {
  buildTimelineEvent,
  createAuditTimeline,
} from "./ai-diff-approve-a9-audit-timeline.mjs";
import { detectTampering, hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";

export { deepFreeze };

export const PHASE_A11_SCHEMA_VERSION = "diff_approve.a11.orchestrator.v1";

export const PHASE_A11_REASONS = Object.freeze({
  ORCHESTRATION_OK: "orchestration_ok",
  ORCHESTRATION_FAILED: "orchestration_failed",
  TAMPER_DETECTED: "tamper_detected",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
});

const CONTEXT_ALLOWLIST = Object.freeze([
  "capability",
  "resource_type",
  "resource_id",
  "change_type",
  "before",
  "after",
  "proposal_id",
  "request_id",
  "created_at",
  "seed",
  "approver",
  "gate_result",
  "production_readiness",
  "activation",
  "timestamp",
  "repository",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectExtraKeys(keys, allowlist) {
  for (const key of keys) {
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !allowlist.includes(key)
    ) {
      return false;
    }
  }
  return true;
}

function securityInvariants() {
  return deepFreeze({
    applied: false,
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
    network_called: false,
    db_written: false,
    production_written: false,
    rollback_executed: false,
  });
}

/**
 * @param {ReturnType<typeof createAuditTimeline>} timeline
 * @param {Record<string, unknown>} fields
 */
function pushEvent(timeline, fields) {
  const built = buildTimelineEvent(fields);
  if (!built.ok) return built;
  return timeline.append(built.value);
}

/**
 * End-to-end non-live orchestration.
 * @param {Record<string, unknown>} [input]
 */
export function runNonLiveOrchestrator(input = {}) {
  const invariants = securityInvariants();

  if (!isPlainObject(input)) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.INVALID_CONTEXT,
      error: PHASE_A11_REASONS.INVALID_CONTEXT,
      security_invariants: invariants,
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.EXTRA_FIELDS,
      error: PHASE_A11_REASONS.EXTRA_FIELDS,
      security_invariants: invariants,
    };
  }

  const timestamp =
    typeof input.timestamp === "string"
      ? input.timestamp
      : "2026-07-28T05:00:00.000Z";

  const pending = buildPendingApprovalProposal({
    capability: input.capability,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    change_type: input.change_type,
    before: input.before,
    after: input.after,
    proposal_id: input.proposal_id,
    request_id: input.request_id,
    created_at: input.created_at,
    seed: input.seed,
  });
  if (!pending.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: pending.reason || pending.error,
      stage: "proposal",
      security_invariants: invariants,
    };
  }

  const timeline = createAuditTimeline();
  const pid = pending.proposal.proposal_id;
  let seq = 0;
  const ts = timestamp;

  for (const [type, payload] of [
    ["proposal_created", { status: "draft" }],
    ["proposal_submitted", { status: "pending_approval" }],
    ["approval_requested", {}],
  ]) {
    const ev = pushEvent(timeline, {
      event_id: `${pid}:${type}`,
      event_type: type,
      proposal_id: pid,
      timestamp: ts,
      sequence: seq++,
      payload,
    });
    if (!ev.ok) {
      return {
        ok: false,
        reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
        error: ev.reason,
        stage: "timeline",
        security_invariants: invariants,
      };
    }
  }

  const granted = grantApproval({
    proposal: pending.proposal,
    actor: isPlainObject(input.approver)
      ? input.approver
      : { role: "approver", id: "orch-approver" },
    reason: "orchestrator_grant",
    timestamp: ts,
  });
  if (!granted.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: granted.reason,
      stage: "approval",
      security_invariants: invariants,
    };
  }
  pushEvent(timeline, {
    event_id: `${pid}:approval_granted`,
    event_type: "approval_granted",
    proposal_id: pid,
    timestamp: ts,
    sequence: seq++,
    payload: { decision: "approved" },
  });

  const readiness = evaluateApplyReadiness({
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
    timestamp: ts,
  });
  if (!readiness.ok || readiness.decision !== "ready") {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: readiness.reason || "not_ready",
      stage: "readiness",
      security_invariants: invariants,
    };
  }
  pushEvent(timeline, {
    event_id: `${pid}:apply_readiness_evaluated`,
    event_type: "apply_readiness_evaluated",
    proposal_id: pid,
    timestamp: ts,
    sequence: seq++,
    payload: { decision: readiness.decision },
  });
  pushEvent(timeline, {
    event_id: `${pid}:apply_plan_created`,
    event_type: "apply_plan_created",
    proposal_id: pid,
    timestamp: ts,
    sequence: seq++,
    payload: { requires_apply: true },
  });

  const gateResult = isPlainObject(input.gate_result)
    ? input.gate_result
    : {
        ok: true,
        execution_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        decision: "allowed",
        provider_called: false,
        executed: false,
        transmit: false,
        recorded_api_cost: 0,
      };

  const engine = runApplyEngine({
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
    plan: readiness.plan,
    readiness,
    gate_result: gateResult,
    timestamp: ts,
  });
  if (!engine.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: engine.reason,
      stage: "validation",
      security_invariants: invariants,
    };
  }
  pushEvent(timeline, {
    event_id: `${pid}:apply_validated`,
    event_type: "apply_validated",
    proposal_id: pid,
    execution_id: engine.result.execution_id,
    timestamp: ts,
    sequence: seq++,
    payload: { execution_state: "validated" },
  });

  pushEvent(timeline, {
    event_id: `${pid}:simulation_started`,
    event_type: "simulation_started",
    proposal_id: pid,
    execution_id: engine.result.execution_id,
    timestamp: ts,
    sequence: seq++,
    payload: {},
  });

  const simulation = runNoOpApplySimulation({
    apply_result: engine.result,
    execution_snapshot: engine.snapshot,
    plan: readiness.plan,
    timestamp: ts,
  });
  if (!simulation.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: simulation.reason,
      stage: "simulation",
      security_invariants: invariants,
    };
  }
  pushEvent(timeline, {
    event_id: `${pid}:simulation_completed`,
    event_type: "simulation_completed",
    proposal_id: pid,
    execution_id: engine.result.execution_id,
    timestamp: ts,
    sequence: seq++,
    payload: { simulation_state: "simulated" },
  });
  pushEvent(timeline, {
    event_id: `${pid}:rollback_simulated`,
    event_type: "rollback_simulated",
    proposal_id: pid,
    execution_id: engine.result.execution_id,
    timestamp: ts,
    sequence: seq++,
    payload: { rollback_simulated: true },
  });

  const finalGate = evaluateFinalApplyGate({
    proposal: granted.proposal,
    readiness,
    apply_result: engine.result,
    simulation: simulation.simulation,
    production_readiness: input.production_readiness || { decision: "ready" },
    activation: input.activation || { activation_decision: "not_eligible" },
    timestamp: ts,
  });
  if (!finalGate.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: finalGate.reason,
      stage: "final_gate",
      security_invariants: invariants,
    };
  }
  pushEvent(timeline, {
    event_id: `${pid}:final_apply_gate_evaluated`,
    event_type: "final_apply_gate_evaluated",
    proposal_id: pid,
    execution_id: engine.result.execution_id,
    timestamp: ts,
    sequence: seq++,
    payload: { decision: finalGate.decision },
  });

  const expectedHashes = {
    proposal: hashValue(granted.proposal),
    diff: hashValue(pending.diff),
    approval: hashValue(granted.decision),
    plan: hashValue(readiness.plan),
    simulation: hashValue(simulation.simulation),
  };
  const tamper = detectTampering({
    proposal: granted.proposal,
    diff: pending.diff,
    approval: granted.decision,
    plan: readiness.plan,
    simulation: simulation.simulation,
    expected: expectedHashes,
  });
  if (!tamper.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.TAMPER_DETECTED,
      error: tamper.reason,
      stage: "tamper",
      security_invariants: invariants,
    };
  }

  const repo =
    input.repository && typeof input.repository.put === "function"
      ? input.repository
      : createInMemoryRepository();

  const records = [
    {
      schema_version: "diff_approve.a7.persistence.v1",
      record_type: "proposal",
      record_id: `${pid}:proposal`,
      proposal_id: pid,
      payload: { status: granted.proposal.status },
      record_version: 1,
      created_at: ts,
      updated_at: ts,
    },
    {
      schema_version: "diff_approve.a7.persistence.v1",
      record_type: "final_gate",
      record_id: `${pid}:final_gate`,
      proposal_id: pid,
      execution_id: engine.result.execution_id,
      payload: { decision: finalGate.decision },
      record_version: 1,
      created_at: ts,
      updated_at: ts,
    },
  ];
  for (const rec of records) {
    const put = repo.put(rec);
    if (!put.ok) {
      return {
        ok: false,
        reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
        error: put.reason,
        stage: "persistence",
        security_invariants: invariants,
      };
    }
  }

  const readModel = projectReadModel({
    proposal: granted.proposal,
    approval: granted.decision,
    readiness,
    impact: pending.impact,
    simulation: simulation.simulation,
    final_gate: finalGate,
    audit_timeline: timeline.list(),
  });
  if (!readModel.ok) {
    return {
      ok: false,
      reason: PHASE_A11_REASONS.ORCHESTRATION_FAILED,
      error: readModel.reason,
      stage: "read_model",
      security_invariants: invariants,
    };
  }

  return {
    ok: true,
    reason: PHASE_A11_REASONS.ORCHESTRATION_OK,
    proposal: granted.proposal,
    approval: granted.decision,
    readiness,
    validation: engine.result,
    simulation: simulation.simulation,
    final_gate: finalGate,
    audit_timeline: timeline.list(),
    read_model: readModel.value,
    security_invariants: invariants,
    tamper,
  };
}
