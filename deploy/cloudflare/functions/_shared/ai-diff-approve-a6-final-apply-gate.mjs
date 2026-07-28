/**
 * Diff & Approve — Phase A6 Final Apply Gate (static eligibility · no real Apply).
 *
 * Decision: eligible_for_apply | not_eligible_for_apply
 * eligible ≠ production apply permission — static pre-boundary only.
 *
 * Always: applied=false · executed=false · provider_called=false · transmit=false · cost=0
 * No network · DB · provider · credential · real apply/rollback.
 */

import { PHASE_A1_STATUSES, deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";
import { PHASE_A3_DECISIONS } from "./ai-diff-approve-a3-apply-readiness.mjs";
import { PHASE_A4_EXECUTION_STATES } from "./ai-diff-approve-a4-apply-engine.mjs";
import { PHASE_A5_SIMULATION_STATES } from "./ai-diff-approve-a5-noop-apply-simulation.mjs";

export { deepFreeze };

export const PHASE_A6_SCHEMA_VERSION = "diff_approve.a6.final_apply_gate.v1";

export const PHASE_A6_DECISIONS = Object.freeze({
  ELIGIBLE_FOR_APPLY: "eligible_for_apply",
  NOT_ELIGIBLE_FOR_APPLY: "not_eligible_for_apply",
});

export const PHASE_A6_REASONS = Object.freeze({
  FINAL_GATE_ELIGIBLE: "final_gate_eligible",
  NOT_APPROVED: "not_approved",
  NOT_READY: "not_ready",
  NOT_VALIDATED: "not_validated",
  NOT_SIMULATED: "not_simulated",
  SIMULATION_FAILED: "simulation_failed",
  INVALID_ROLLBACK_SIM: "invalid_rollback_simulation",
  GATE_NOT_READY: "execution_gate_not_ready",
  ACTIVATION_INCONSISTENT: "activation_inconsistent",
  CONFLICTS_PRESENT: "conflicts_present",
  IDEMPOTENCY_INVALID: "idempotency_invalid",
  SECURITY_VIOLATION: "security_violation",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  APPLY_FORBIDDEN: "apply_forbidden",
});

const CONTEXT_ALLOWLIST = Object.freeze([
  "proposal",
  "readiness",
  "apply_result",
  "simulation",
  "production_readiness",
  "activation",
  "timestamp",
]);

const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "decision",
  "reason",
  "blocking_reasons",
  "timestamp",
  "applied",
  "executed",
  "provider_called",
  "transmit",
  "recorded_api_cost",
  "network_called",
  "db_written",
  "production_written",
  "rollback_executed",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function zeroInvariants() {
  return {
    applied: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    provider_called: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
    network_called: /** @type {false} */ (false),
    db_written: /** @type {false} */ (false),
    production_written: /** @type {false} */ (false),
    rollback_executed: /** @type {false} */ (false),
  };
}

/**
 * @param {Record<string, unknown>} fields
 */
export function buildFinalApplySnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A6_REASONS.INVALID_CONTEXT,
      reason: PHASE_A6_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A6_REASONS.EXTRA_FIELDS,
      reason: PHASE_A6_REASONS.EXTRA_FIELDS,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A6_REASONS.INVALID_CONTEXT,
      reason: PHASE_A6_REASONS.INVALID_CONTEXT,
    };
  }
  const decision =
    o.decision === PHASE_A6_DECISIONS.ELIGIBLE_FOR_APPLY ||
    o.decision === PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY
      ? o.decision
      : PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY;

  const blocking = Array.isArray(o.blocking_reasons)
    ? o.blocking_reasons.filter((r) => typeof r === "string").slice(0, 32)
    : [];

  return {
    ok: true,
    value: deepFreeze({
      schema_version: PHASE_A6_SCHEMA_VERSION,
      proposal_id: o.proposal_id,
      decision,
      reason:
        typeof o.reason === "string"
          ? o.reason.slice(0, 500)
          : PHASE_A6_REASONS.INVALID_CONTEXT,
      blocking_reasons: Object.freeze([...blocking]),
      timestamp:
        typeof o.timestamp === "string"
          ? o.timestamp
          : "1970-01-01T00:00:00.000Z",
      ...zeroInvariants(),
    }),
  };
}

/**
 * Final Apply Gate evaluator.
 * @param {Record<string, unknown>} [input]
 */
export function evaluateFinalApplyGate(input = {}) {
  const zero = zeroInvariants();

  if (!isPlainObject(input)) {
    return {
      ok: false,
      decision: PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY,
      reason: PHASE_A6_REASONS.INVALID_CONTEXT,
      error: PHASE_A6_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      decision: PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY,
      reason: PHASE_A6_REASONS.EXTRA_FIELDS,
      error: PHASE_A6_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  /** @type {string[]} */
  const blocking = [];

  const proposal = isPlainObject(input.proposal)
    ? /** @type {Record<string, unknown>} */ (input.proposal)
    : null;
  if (!proposal || typeof proposal.proposal_id !== "string") {
    return {
      ok: false,
      decision: PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY,
      reason: PHASE_A6_REASONS.INVALID_CONTEXT,
      error: PHASE_A6_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  if (proposal.status !== PHASE_A1_STATUSES.APPROVED) {
    blocking.push(PHASE_A6_REASONS.NOT_APPROVED);
  }

  const readiness = isPlainObject(input.readiness)
    ? /** @type {Record<string, unknown>} */ (input.readiness)
    : null;
  if (!readiness || readiness.decision !== PHASE_A3_DECISIONS.READY) {
    blocking.push(PHASE_A6_REASONS.NOT_READY);
  }

  const applyResult = isPlainObject(input.apply_result)
    ? /** @type {Record<string, unknown>} */ (input.apply_result)
    : null;
  if (
    !applyResult ||
    applyResult.execution_state !== PHASE_A4_EXECUTION_STATES.VALIDATED
  ) {
    blocking.push(PHASE_A6_REASONS.NOT_VALIDATED);
  }

  const simulation = isPlainObject(input.simulation)
    ? /** @type {Record<string, unknown>} */ (input.simulation)
    : null;
  if (!simulation) {
    blocking.push(PHASE_A6_REASONS.NOT_SIMULATED);
  } else if (
    simulation.simulation_state === PHASE_A5_SIMULATION_STATES.SIMULATION_FAILED
  ) {
    blocking.push(PHASE_A6_REASONS.SIMULATION_FAILED);
  } else if (
    simulation.simulation_state !== PHASE_A5_SIMULATION_STATES.SIMULATED
  ) {
    blocking.push(PHASE_A6_REASONS.NOT_SIMULATED);
  } else if (
    simulation.result !== "noop_simulated_ok" &&
    simulation.reason !== "simulated_ok"
  ) {
    blocking.push(PHASE_A6_REASONS.SIMULATION_FAILED);
  }

  if (simulation) {
    const rb = simulation.rollback_simulation;
    if (
      !isPlainObject(rb) ||
      /** @type {Record<string, unknown>} */ (rb).rollback_simulated !== true ||
      /** @type {Record<string, unknown>} */ (rb).rollback_required !== true
    ) {
      blocking.push(PHASE_A6_REASONS.INVALID_ROLLBACK_SIM);
    }
  }

  // Optional execution-gate production readiness (pure snapshot input)
  if (input.production_readiness != null) {
    const pr = isPlainObject(input.production_readiness)
      ? /** @type {Record<string, unknown>} */ (input.production_readiness)
      : null;
    if (!pr || (pr.decision !== "ready" && pr.decision !== true)) {
      blocking.push(PHASE_A6_REASONS.GATE_NOT_READY);
    }
  }

  // Activation: not_eligible is OK for non-live; reject unknown shapes
  if (input.activation != null) {
    const act = isPlainObject(input.activation)
      ? /** @type {Record<string, unknown>} */ (input.activation)
      : null;
    const d =
      act &&
      (typeof act.activation_decision === "string"
        ? act.activation_decision
        : typeof act.decision === "string"
          ? act.decision
          : null);
    if (d !== "eligible" && d !== "not_eligible") {
      blocking.push(PHASE_A6_REASONS.ACTIVATION_INCONSISTENT);
    }
  }

  if (
    readiness &&
    isPlainObject(readiness.conflicts) &&
    /** @type {Record<string, unknown>} */ (readiness.conflicts).blocking ===
      true
  ) {
    blocking.push(PHASE_A6_REASONS.CONFLICTS_PRESENT);
  }

  // Security invariants on inputs
  for (const obj of [applyResult, simulation]) {
    if (!obj) continue;
    if (
      obj.applied !== false ||
      obj.executed !== false ||
      obj.provider_called !== false ||
      obj.transmit !== false ||
      obj.recorded_api_cost !== 0
    ) {
      blocking.push(PHASE_A6_REASONS.SECURITY_VIOLATION);
      break;
    }
  }

  if (
    applyResult &&
    typeof applyResult.execution_hash !== "string"
  ) {
    blocking.push(PHASE_A6_REASONS.IDEMPOTENCY_INVALID);
  }

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";

  const uniqueBlocking = Object.freeze([...new Set(blocking)]);
  const eligible = uniqueBlocking.length === 0;
  const decision = eligible
    ? PHASE_A6_DECISIONS.ELIGIBLE_FOR_APPLY
    : PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY;
  const reason = eligible
    ? PHASE_A6_REASONS.FINAL_GATE_ELIGIBLE
    : uniqueBlocking[0];

  const snap = buildFinalApplySnapshot({
    proposal_id: proposal.proposal_id,
    decision,
    reason,
    blocking_reasons: uniqueBlocking,
    timestamp,
  });
  if (!snap.ok) {
    return {
      ok: false,
      decision: PHASE_A6_DECISIONS.NOT_ELIGIBLE_FOR_APPLY,
      reason: snap.reason || PHASE_A6_REASONS.INVALID_CONTEXT,
      error: snap.error || PHASE_A6_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  return {
    ok: true,
    decision,
    reason,
    blocking_reasons: uniqueBlocking,
    snapshot: snap.value,
    ...zero,
  };
}

/**
 * Real apply remains forbidden at Final Gate.
 * @param {unknown} [_input]
 */
export function performFinalApply(_input) {
  return {
    ok: false,
    error: PHASE_A6_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A6_REASONS.APPLY_FORBIDDEN,
    ...zeroInvariants(),
  };
}
