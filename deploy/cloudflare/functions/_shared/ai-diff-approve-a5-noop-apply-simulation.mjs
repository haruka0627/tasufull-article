/**
 * Diff & Approve — Phase A5 NoOp Apply Simulation (no real Apply).
 *
 * Pipeline:
 *   Approved → Readiness → Apply Engine (validated) →
 *   NoOp Simulation (simulated) → Audit → Persist(concept)
 *
 * simulation_state may be simulated | simulation_failed.
 * applied=false · executed=false · provider_called=false · transmit=false · cost=0 always.
 * No production write · DB · provider · network · SDK · credential · migration · Dashboard.
 */

import {
  PHASE_A4_EXECUTION_STATES,
  PHASE_A4_SCHEMA_VERSION,
  deepFreeze,
  rememberExecutionHash,
  validateApplyPlan,
  validateIdempotency,
} from "./ai-diff-approve-a4-apply-engine.mjs";

export { deepFreeze };

export const PHASE_A5_SCHEMA_VERSION = "diff_approve.a5.apply_simulation.v1";

export const PHASE_A5_SIMULATION_STATES = Object.freeze({
  PLANNED: "planned",
  VALIDATED: "validated",
  SIMULATED: "simulated",
  SIMULATION_FAILED: "simulation_failed",
});

export const PHASE_A5_REASONS = Object.freeze({
  SIMULATED_OK: "simulated_ok",
  NOT_VALIDATED: "not_validated",
  INVALID_SNAPSHOT: "invalid_snapshot",
  INVALID_RESULT: "invalid_result",
  DUPLICATE_SIMULATION: "duplicate_simulation",
  INVALID_ROLLBACK: "invalid_rollback",
  INVALID_PLAN: "invalid_plan",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  IMMUTABLE_VIOLATION: "immutable_violation",
  APPLY_FORBIDDEN: "apply_forbidden",
  EXECUTED_FORBIDDEN: "executed_forbidden",
});

const RESULT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "execution_id",
  "execution_state",
  "execution_hash",
  "result",
  "rollback",
  "timestamp",
  "reason",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

const SNAPSHOT_IN_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "execution_state",
  "result",
  "timestamp",
  "execution_id",
  "execution_hash",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

const SIM_RESULT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "execution_id",
  "simulation_state",
  "execution_state",
  "simulation_hash",
  "result",
  "rollback_simulation",
  "audit",
  "timestamp",
  "reason",
  "duration_ms",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

const SIM_SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "simulation_result",
  "execution_state",
  "simulation_state",
  "timestamp",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

const AUDIT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "execution_id",
  "simulation_state",
  "duration_ms",
  "timestamp",
]);

const ROLLBACK_SIM_ALLOWLIST = Object.freeze([
  "schema_version",
  "rollback_required",
  "rollback_steps",
  "rollback_simulated",
  "rollback_result",
]);

const CONTEXT_ALLOWLIST = Object.freeze([
  "apply_result",
  "execution_snapshot",
  "plan",
  "timestamp",
  "idempotency_store",
  "started_at_ms",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} keys
 * @param {readonly string[]} allowlist
 */
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

function zeroSideEffects() {
  return {
    applied: /** @type {false} */ (false),
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };
}

/**
 * @param {string} text
 */
function fnv1aHex(text) {
  let h = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * @param {string} proposalId
 * @param {string} executionId
 * @param {string} executionHash
 */
export function computeSimulationHash(proposalId, executionId, executionHash) {
  return `fnv1a32:${fnv1aHex(`sim:${proposalId}:${executionId}:${executionHash}`)}`;
}

/**
 * Validate A4 ApplyResult (must be validated · frozen · zero side effects).
 * @param {unknown} result
 */
export function validateApplyResultForSimulation(result) {
  if (!isPlainObject(result) || !Object.isFrozen(result)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_RESULT,
      reason: PHASE_A5_REASONS.INVALID_RESULT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (result);
  if (!rejectExtraKeys(Object.keys(o), RESULT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.schema_version !== PHASE_A4_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_RESULT,
      reason: PHASE_A5_REASONS.INVALID_RESULT,
    };
  }
  if (o.execution_state !== PHASE_A4_EXECUTION_STATES.VALIDATED) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.NOT_VALIDATED,
      reason: PHASE_A5_REASONS.NOT_VALIDATED,
    };
  }
  if (
    typeof o.proposal_id !== "string" ||
    !UUID_RE.test(o.proposal_id) ||
    typeof o.execution_id !== "string" ||
    !UUID_RE.test(o.execution_id) ||
    typeof o.execution_hash !== "string"
  ) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_RESULT,
      reason: PHASE_A5_REASONS.INVALID_RESULT,
    };
  }
  if (
    o.applied !== false ||
    o.executed !== false ||
    o.provider_called !== false ||
    o.transmit !== false ||
    o.recorded_api_cost !== 0
  ) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXECUTED_FORBIDDEN,
      reason: PHASE_A5_REASONS.EXECUTED_FORBIDDEN,
    };
  }
  return { ok: true, value: o };
}

/**
 * Validate A4 ExecutionSnapshot for simulation input.
 * @param {unknown} snapshot
 */
export function validateExecutionSnapshotForSimulation(snapshot) {
  if (!isPlainObject(snapshot) || !Object.isFrozen(snapshot)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_SNAPSHOT,
      reason: PHASE_A5_REASONS.INVALID_SNAPSHOT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (snapshot);
  if (!rejectExtraKeys(Object.keys(o), SNAPSHOT_IN_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.schema_version !== PHASE_A4_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_SNAPSHOT,
      reason: PHASE_A5_REASONS.INVALID_SNAPSHOT,
    };
  }
  if (o.execution_state !== PHASE_A4_EXECUTION_STATES.VALIDATED) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.NOT_VALIDATED,
      reason: PHASE_A5_REASONS.NOT_VALIDATED,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_SNAPSHOT,
      reason: PHASE_A5_REASONS.INVALID_SNAPSHOT,
    };
  }
  if (
    o.applied !== false ||
    o.executed !== false ||
    o.provider_called !== false ||
    o.transmit !== false ||
    o.recorded_api_cost !== 0
  ) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXECUTED_FORBIDDEN,
      reason: PHASE_A5_REASONS.EXECUTED_FORBIDDEN,
    };
  }
  return { ok: true, value: o };
}

/**
 * RollbackSimulation — record only (no real rollback).
 * @param {{ rollback?: unknown }} input
 */
export function buildRollbackSimulation(input = {}) {
  if (!isPlainObject(input.rollback)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_ROLLBACK,
      reason: PHASE_A5_REASONS.INVALID_ROLLBACK,
    };
  }
  const rb = /** @type {Record<string, unknown>} */ (input.rollback);
  if (rb.rollback_required !== true || !Array.isArray(rb.rollback_steps)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_ROLLBACK,
      reason: PHASE_A5_REASONS.INVALID_ROLLBACK,
    };
  }
  const steps = rb.rollback_steps
    .filter((s) => typeof s === "string")
    .slice(0, 20);

  const sim = deepFreeze({
    schema_version: PHASE_A5_SCHEMA_VERSION,
    rollback_required: true,
    rollback_steps: Object.freeze([...steps]),
    rollback_simulated: true,
    rollback_result: "simulated_ok",
  });
  if (!rejectExtraKeys(Object.keys(sim), ROLLBACK_SIM_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
    };
  }
  return { ok: true, value: sim };
}

/**
 * ExecutionAudit — minimal.
 * @param {Record<string, unknown>} fields
 */
export function buildExecutionAudit(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), AUDIT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
    };
  }
  if (
    typeof o.proposal_id !== "string" ||
    !UUID_RE.test(o.proposal_id) ||
    typeof o.execution_id !== "string" ||
    !UUID_RE.test(o.execution_id)
  ) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
    };
  }
  if (
    o.simulation_state !== PHASE_A5_SIMULATION_STATES.SIMULATED &&
    o.simulation_state !== PHASE_A5_SIMULATION_STATES.SIMULATION_FAILED
  ) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
    };
  }
  const audit = deepFreeze({
    schema_version: PHASE_A5_SCHEMA_VERSION,
    proposal_id: o.proposal_id,
    execution_id: o.execution_id,
    simulation_state: o.simulation_state,
    duration_ms:
      typeof o.duration_ms === "number" &&
      Number.isFinite(o.duration_ms) &&
      o.duration_ms >= 0
        ? Math.floor(o.duration_ms)
        : 0,
    timestamp:
      typeof o.timestamp === "string" ? o.timestamp : "1970-01-01T00:00:00.000Z",
  });
  return { ok: true, value: audit };
}

/**
 * SimulationSnapshot — minimal · no prompt.
 * @param {Record<string, unknown>} fields
 */
export function buildSimulationSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), SIM_SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
    };
  }
  const snap = deepFreeze({
    schema_version: PHASE_A5_SCHEMA_VERSION,
    proposal_id: o.proposal_id,
    simulation_result:
      typeof o.simulation_result === "string" ? o.simulation_result : "ok",
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    simulation_state:
      o.simulation_state === PHASE_A5_SIMULATION_STATES.SIMULATED
        ? PHASE_A5_SIMULATION_STATES.SIMULATED
        : PHASE_A5_SIMULATION_STATES.SIMULATION_FAILED,
    timestamp:
      typeof o.timestamp === "string" ? o.timestamp : "1970-01-01T00:00:00.000Z",
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: snap };
}

/**
 * NoOpApplyExecutor — simulate apply without side effects.
 *
 * @param {{
 *   apply_result?: unknown,
 *   execution_snapshot?: unknown,
 *   plan?: unknown,
 *   timestamp?: unknown,
 *   idempotency_store?: unknown,
 *   started_at_ms?: unknown,
 * }} input
 */
export function runNoOpApplySimulation(input = {}) {
  const zero = zeroSideEffects();

  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  const resultCheck = validateApplyResultForSimulation(input.apply_result);
  if (!resultCheck.ok) return { ...resultCheck, ...zero };
  const applyResult = resultCheck.value;

  const snapCheck = validateExecutionSnapshotForSimulation(
    input.execution_snapshot
  );
  if (!snapCheck.ok) return { ...snapCheck, ...zero };
  const execSnap = snapCheck.value;

  if (execSnap.proposal_id !== applyResult.proposal_id) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_SNAPSHOT,
      reason: PHASE_A5_REASONS.INVALID_SNAPSHOT,
      ...zero,
    };
  }

  const planCheck = validateApplyPlan(
    input.plan,
    String(applyResult.proposal_id)
  );
  if (!planCheck.ok) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_PLAN,
      reason: PHASE_A5_REASONS.INVALID_PLAN,
      ...zero,
    };
  }

  const simHash = computeSimulationHash(
    String(applyResult.proposal_id),
    String(applyResult.execution_id),
    String(applyResult.execution_hash)
  );

  // Reuse A4 idempotency store mechanics with simulation-specific hash key
  const idem = validateIdempotency({
    proposal_id: applyResult.proposal_id,
    execution_id: applyResult.execution_id,
    store: null,
  });
  if (!idem.ok) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.INVALID_CONTEXT,
      reason: PHASE_A5_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  const store = input.idempotency_store;
  if (store instanceof Set && store.has(simHash)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.DUPLICATE_SIMULATION,
      reason: PHASE_A5_REASONS.DUPLICATE_SIMULATION,
      simulation_hash: simHash,
      ...zero,
    };
  }
  if (isPlainObject(store) && /** @type {Record<string, unknown>} */ (store)[simHash] === true) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.DUPLICATE_SIMULATION,
      reason: PHASE_A5_REASONS.DUPLICATE_SIMULATION,
      simulation_hash: simHash,
      ...zero,
    };
  }

  const rbSim = buildRollbackSimulation({ rollback: applyResult.rollback });
  if (!rbSim.ok) return { ...rbSim, ...zero };

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";

  const started =
    typeof input.started_at_ms === "number" && Number.isFinite(input.started_at_ms)
      ? input.started_at_ms
      : 0;
  const duration_ms = started > 0 ? 0 : 0; // NoOp: deterministic zero duration

  const auditBuilt = buildExecutionAudit({
    proposal_id: applyResult.proposal_id,
    execution_id: applyResult.execution_id,
    simulation_state: PHASE_A5_SIMULATION_STATES.SIMULATED,
    duration_ms,
    timestamp,
  });
  if (!auditBuilt.ok) return { ...auditBuilt, ...zero };

  const simulationResult = deepFreeze({
    schema_version: PHASE_A5_SCHEMA_VERSION,
    proposal_id: applyResult.proposal_id,
    execution_id: applyResult.execution_id,
    simulation_state: PHASE_A5_SIMULATION_STATES.SIMULATED,
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    simulation_hash: simHash,
    result: "noop_simulated_ok",
    rollback_simulation: rbSim.value,
    audit: auditBuilt.value,
    timestamp,
    reason: PHASE_A5_REASONS.SIMULATED_OK,
    duration_ms,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  if (!rejectExtraKeys(Object.keys(simulationResult), SIM_RESULT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A5_REASONS.EXTRA_FIELDS,
      reason: PHASE_A5_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  const simSnap = buildSimulationSnapshot({
    proposal_id: applyResult.proposal_id,
    simulation_result: "noop_simulated_ok",
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    simulation_state: PHASE_A5_SIMULATION_STATES.SIMULATED,
    timestamp,
  });
  if (!simSnap.ok) return { ...simSnap, ...zero };

  rememberExecutionHash(store, simHash);

  return {
    ok: true,
    simulation: simulationResult,
    snapshot: simSnap.value,
    audit: auditBuilt.value,
    rollback_simulation: rbSim.value,
    simulation_state: PHASE_A5_SIMULATION_STATES.SIMULATED,
    reason: PHASE_A5_REASONS.SIMULATED_OK,
    ...zero,
  };
}

/** Alias matching ticket vocabulary. */
export function noOpApplyExecutor(input) {
  return runNoOpApplySimulation(input);
}

/**
 * Real apply remains forbidden.
 * @param {unknown} [_input]
 */
export function commitSimulatedApply(_input) {
  return {
    ok: false,
    error: PHASE_A5_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A5_REASONS.APPLY_FORBIDDEN,
    ...zeroSideEffects(),
  };
}
