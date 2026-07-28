/**
 * Diff & Approve — Phase A4 Apply Engine (path validation only · no real Apply).
 *
 * Pipeline:
 *   Approved → Apply Readiness → Apply Engine → Validation →
 *   Execution Snapshot → Persist(concept)
 *
 * execution_state may be planned | validated in A4.
 * applied=false · executed=false · transmit=false · provider_called=false · cost=0 always.
 * No provider · network · SDK · credential · migration · production write.
 */

import {
  PHASE_A1_STATUSES,
  deepFreeze,
  isPhaseA1ChangeType,
  isPhaseA1ResourceType,
} from "./ai-diff-approve-a1-foundation.mjs";
import {
  PHASE_A3_DECISIONS,
  PHASE_A3_SCHEMA_VERSION,
  buildApplyPlan,
  evaluateApplyReadiness,
  validateApprovedProposal,
} from "./ai-diff-approve-a3-apply-readiness.mjs";

export { deepFreeze };

export const PHASE_A4_SCHEMA_VERSION = "diff_approve.a4.apply_engine.v1";

/** Full execution vocabulary — A4 only emits planned | validated. */
export const PHASE_A4_EXECUTION_STATES = Object.freeze({
  PLANNED: "planned",
  VALIDATED: "validated",
  EXECUTED: "executed",
  FAILED: "failed",
  ROLLED_BACK: "rolled_back",
});

export const PHASE_A4_ACTIVE_STATES = Object.freeze([
  PHASE_A4_EXECUTION_STATES.PLANNED,
  PHASE_A4_EXECUTION_STATES.VALIDATED,
]);

export const PHASE_A4_REASONS = Object.freeze({
  ENGINE_VALIDATED: "engine_validated",
  ENGINE_PLANNED: "engine_planned",
  NOT_APPROVED: "not_approved",
  NOT_READY: "not_ready",
  DUPLICATE_APPLY: "duplicate_apply",
  INVALID_PLAN: "invalid_plan",
  MISSING_EXECUTION_GATE: "missing_execution_gate",
  INVALID_GATE_RESULT: "invalid_gate_result",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  IMMUTABLE_VIOLATION: "immutable_violation",
  APPLY_FORBIDDEN: "apply_forbidden",
  EXECUTED_FORBIDDEN: "executed_forbidden",
  UNKNOWN_STATE: "unknown_state",
});

const PLAN_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "resource_type",
  "resource_id",
  "change_type",
  "estimated_steps",
  "requires_apply",
]);

const GATE_ALLOWLIST = Object.freeze([
  "ok",
  "execution_id",
  "decision",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

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

const SNAPSHOT_ALLOWLIST = Object.freeze([
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

const CONTEXT_ALLOWLIST = Object.freeze([
  "proposal",
  "diff",
  "impact",
  "actor",
  "plan",
  "readiness",
  "gate_result",
  "execution_id",
  "timestamp",
  "idempotency_store",
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
 * Deterministic FNV-1a hex (no crypto).
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
 */
export function computeExecutionHash(proposalId, executionId) {
  return `fnv1a32:${fnv1aHex(`${proposalId}:${executionId}`)}`;
}

/**
 * IdempotencyValidator — rejects duplicate proposal_id + execution_id.
 *
 * @param {{
 *   proposal_id?: unknown,
 *   execution_id?: unknown,
 *   store?: unknown,
 * }} input
 */
export function validateIdempotency(input = {}) {
  if (
    typeof input.proposal_id !== "string" ||
    !UUID_RE.test(input.proposal_id) ||
    typeof input.execution_id !== "string" ||
    !UUID_RE.test(input.execution_id)
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
    };
  }

  // Reject unicode zwsp in ids (already blocked by UUID_RE mostly)
  if (
    /[\u200b\u200c\u200d\ufeff]/.test(input.proposal_id) ||
    /[\u200b\u200c\u200d\ufeff]/.test(input.execution_id)
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
    };
  }

  const hash = computeExecutionHash(input.proposal_id, input.execution_id);
  const store = input.store;

  if (store != null) {
    if (!(store instanceof Set) && !isPlainObject(store)) {
      return {
        ok: false,
        error: PHASE_A4_REASONS.INVALID_CONTEXT,
        reason: PHASE_A4_REASONS.INVALID_CONTEXT,
      };
    }
    if (store instanceof Set) {
      if (store.has(hash)) {
        return {
          ok: false,
          error: PHASE_A4_REASONS.DUPLICATE_APPLY,
          reason: PHASE_A4_REASONS.DUPLICATE_APPLY,
          execution_hash: hash,
          duplicate_apply: true,
        };
      }
    } else {
      const o = /** @type {Record<string, unknown>} */ (store);
      if (o[hash] === true) {
        return {
          ok: false,
          error: PHASE_A4_REASONS.DUPLICATE_APPLY,
          reason: PHASE_A4_REASONS.DUPLICATE_APPLY,
          execution_hash: hash,
          duplicate_apply: true,
        };
      }
    }
  }

  return {
    ok: true,
    proposal_id: input.proposal_id,
    execution_id: input.execution_id,
    execution_hash: hash,
    duplicate_apply: false,
  };
}

/**
 * Record hash into store after successful validation (in-memory only).
 * @param {unknown} store
 * @param {string} hash
 */
export function rememberExecutionHash(store, hash) {
  if (typeof hash !== "string") return false;
  if (store instanceof Set) {
    store.add(hash);
    return true;
  }
  if (isPlainObject(store)) {
    /** @type {Record<string, unknown>} */ (store)[hash] = true;
    return true;
  }
  return false;
}

/**
 * Validate ApplyPlan from A3.
 * @param {unknown} plan
 * @param {string} [proposalId]
 */
export function validateApplyPlan(plan, proposalId) {
  if (!isPlainObject(plan) || !Object.isFrozen(plan)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_PLAN,
      reason: PHASE_A4_REASONS.INVALID_PLAN,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (plan);
  if (!rejectExtraKeys(Object.keys(o), PLAN_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXTRA_FIELDS,
      reason: PHASE_A4_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.schema_version !== PHASE_A3_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_PLAN,
      reason: PHASE_A4_REASONS.INVALID_PLAN,
    };
  }
  if (
    typeof o.proposal_id !== "string" ||
    !UUID_RE.test(o.proposal_id) ||
    !isPhaseA1ResourceType(o.resource_type) ||
    !isPhaseA1ChangeType(o.change_type) ||
    o.requires_apply !== true ||
    !Array.isArray(o.estimated_steps)
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_PLAN,
      reason: PHASE_A4_REASONS.INVALID_PLAN,
    };
  }
  if (proposalId && o.proposal_id !== proposalId) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_PLAN,
      reason: PHASE_A4_REASONS.INVALID_PLAN,
    };
  }
  return { ok: true, value: o };
}

/**
 * Validate opaque Execution Gate result (sanitized · no prompt).
 * @param {unknown} gate
 */
export function validateGateResult(gate) {
  if (gate == null) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.MISSING_EXECUTION_GATE,
      reason: PHASE_A4_REASONS.MISSING_EXECUTION_GATE,
    };
  }
  if (!isPlainObject(gate)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_GATE_RESULT,
      reason: PHASE_A4_REASONS.INVALID_GATE_RESULT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (gate);
  if (!rejectExtraKeys(Object.keys(o), GATE_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXTRA_FIELDS,
      reason: PHASE_A4_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.ok !== true) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_GATE_RESULT,
      reason: PHASE_A4_REASONS.INVALID_GATE_RESULT,
    };
  }
  if (typeof o.execution_id !== "string" || !UUID_RE.test(o.execution_id)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_GATE_RESULT,
      reason: PHASE_A4_REASONS.INVALID_GATE_RESULT,
    };
  }
  if (
    o.provider_called === true ||
    o.executed === true ||
    o.transmit === true ||
    (typeof o.recorded_api_cost === "number" && o.recorded_api_cost !== 0)
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXECUTED_FORBIDDEN,
      reason: PHASE_A4_REASONS.EXECUTED_FORBIDDEN,
    };
  }
  return {
    ok: true,
    value: deepFreeze({
      ok: true,
      execution_id: o.execution_id,
      decision: typeof o.decision === "string" ? o.decision : null,
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
    }),
  };
}

/**
 * RollbackPlan — record only (no real rollback).
 * @param {{
 *   change_type?: unknown,
 *   reason?: unknown,
 * }} input
 */
export function buildRollbackPlan(input = {}) {
  const changeType =
    typeof input.change_type === "string" ? input.change_type : "update";
  const steps =
    changeType === "create"
      ? Object.freeze(["delete_created_resource"])
      : changeType === "delete"
        ? Object.freeze(["restore_previous_value"])
        : Object.freeze(["restore_before_snapshot", "verify_restore"]);

  return deepFreeze({
    schema_version: PHASE_A4_SCHEMA_VERSION,
    rollback_required: true,
    rollback_steps: steps,
    rollback_reason:
      typeof input.reason === "string"
        ? input.reason.slice(0, 500)
        : "precomputed_for_validated_apply",
  });
}

/**
 * ExecutionSnapshot — minimal · no prompt.
 * @param {Record<string, unknown>} fields
 */
export function buildExecutionSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXTRA_FIELDS,
      reason: PHASE_A4_REASONS.EXTRA_FIELDS,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
    };
  }
  const state = o.execution_state;
  if (
    state !== PHASE_A4_EXECUTION_STATES.PLANNED &&
    state !== PHASE_A4_EXECUTION_STATES.VALIDATED
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.UNKNOWN_STATE,
      reason: PHASE_A4_REASONS.UNKNOWN_STATE,
    };
  }

  const snap = deepFreeze({
    schema_version: PHASE_A4_SCHEMA_VERSION,
    proposal_id: o.proposal_id,
    execution_state: state,
    result: typeof o.result === "string" ? o.result : "ok",
    timestamp:
      typeof o.timestamp === "string" ? o.timestamp : "1970-01-01T00:00:00.000Z",
    execution_id:
      typeof o.execution_id === "string" ? o.execution_id : null,
    execution_hash:
      typeof o.execution_hash === "string" ? o.execution_hash : null,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: snap };
}

/**
 * ApplyExecutor — advances planned → validated only (no side effects).
 *
 * @param {{
 *   proposal?: unknown,
 *   plan?: unknown,
 *   gate_result?: unknown,
 *   readiness?: unknown,
 *   execution_hash?: unknown,
 *   timestamp?: unknown,
 * }} input
 */
export function runApplyExecutor(input = {}) {
  const zero = zeroSideEffects();

  const proposalCheck = validateApprovedProposal(input.proposal);
  if (!proposalCheck.ok) {
    return {
      ok: false,
      error: proposalCheck.error || PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: proposalCheck.reason || PHASE_A4_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  const proposal = proposalCheck.value;
  if (proposal.status !== PHASE_A1_STATUSES.APPROVED) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.NOT_APPROVED,
      reason: PHASE_A4_REASONS.NOT_APPROVED,
      ...zero,
    };
  }

  const planCheck = validateApplyPlan(input.plan, String(proposal.proposal_id));
  if (!planCheck.ok) return { ...planCheck, ...zero };

  const gateCheck = validateGateResult(input.gate_result);
  if (!gateCheck.ok) return { ...gateCheck, ...zero };

  if (
    input.readiness == null ||
    !isPlainObject(input.readiness) ||
    /** @type {Record<string, unknown>} */ (input.readiness).decision !==
      PHASE_A3_DECISIONS.READY
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.NOT_READY,
      reason: PHASE_A4_REASONS.NOT_READY,
      ...zero,
    };
  }

  if (
    typeof input.execution_hash !== "string" ||
    !input.execution_hash.startsWith("fnv1a32:")
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";

  const rollback = buildRollbackPlan({
    change_type: proposal.change_type,
    reason: "engine_precompute",
  });

  // planned intermediate (not returned as final — engine ends at validated)
  const planned = deepFreeze({
    schema_version: PHASE_A4_SCHEMA_VERSION,
    execution_state: PHASE_A4_EXECUTION_STATES.PLANNED,
    reason: PHASE_A4_REASONS.ENGINE_PLANNED,
  });
  void planned;

  const applyResult = deepFreeze({
    schema_version: PHASE_A4_SCHEMA_VERSION,
    proposal_id: proposal.proposal_id,
    execution_id: gateCheck.value.execution_id,
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    execution_hash: input.execution_hash,
    result: "validated_ok",
    rollback,
    timestamp,
    reason: PHASE_A4_REASONS.ENGINE_VALIDATED,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  if (!rejectExtraKeys(Object.keys(applyResult), RESULT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXTRA_FIELDS,
      reason: PHASE_A4_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  const snapBuilt = buildExecutionSnapshot({
    proposal_id: proposal.proposal_id,
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    result: "validated_ok",
    timestamp,
    execution_id: gateCheck.value.execution_id,
    execution_hash: input.execution_hash,
  });
  if (!snapBuilt.ok) {
    return { ...snapBuilt, ...zero };
  }

  return {
    ok: true,
    result: applyResult,
    snapshot: snapBuilt.value,
    rollback,
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    reason: PHASE_A4_REASONS.ENGINE_VALIDATED,
    ...zero,
  };
}

/**
 * ApplyEngine — orchestrates readiness + idempotency + executor.
 *
 * @param {{
 *   proposal?: unknown,
 *   diff?: unknown,
 *   impact?: unknown,
 *   actor?: unknown,
 *   plan?: unknown,
 *   readiness?: unknown,
 *   gate_result?: unknown,
 *   execution_id?: unknown,
 *   timestamp?: unknown,
 *   idempotency_store?: unknown,
 * }} input
 */
export function runApplyEngine(input = {}) {
  const zero = zeroSideEffects();

  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: PHASE_A4_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.EXTRA_FIELDS,
      reason: PHASE_A4_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  const proposalCheck = validateApprovedProposal(input.proposal);
  if (!proposalCheck.ok) {
    return {
      ok: false,
      error: proposalCheck.error || PHASE_A4_REASONS.INVALID_CONTEXT,
      reason: proposalCheck.reason || PHASE_A4_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }
  if (proposalCheck.value.status !== PHASE_A1_STATUSES.APPROVED) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.NOT_APPROVED,
      reason: PHASE_A4_REASONS.NOT_APPROVED,
      ...zero,
    };
  }

  const gateCheck = validateGateResult(input.gate_result);
  if (!gateCheck.ok) return { ...gateCheck, ...zero };

  const executionId =
    typeof input.execution_id === "string"
      ? input.execution_id
      : gateCheck.value.execution_id;
  if (executionId !== gateCheck.value.execution_id) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.INVALID_GATE_RESULT,
      reason: PHASE_A4_REASONS.INVALID_GATE_RESULT,
      ...zero,
    };
  }

  const idem = validateIdempotency({
    proposal_id: proposalCheck.value.proposal_id,
    execution_id: executionId,
    store: input.idempotency_store,
  });
  if (!idem.ok) {
    return {
      ok: false,
      error: idem.error,
      reason: idem.reason,
      execution_hash: idem.execution_hash || null,
      duplicate_apply: idem.duplicate_apply === true,
      ...zero,
    };
  }

  let readiness = input.readiness;
  if (readiness == null) {
    readiness = evaluateApplyReadiness({
      proposal: input.proposal,
      diff: input.diff,
      impact: input.impact,
      actor: input.actor,
      timestamp: input.timestamp,
    });
  }
  if (
    !isPlainObject(readiness) ||
    /** @type {Record<string, unknown>} */ (readiness).decision !==
      PHASE_A3_DECISIONS.READY
  ) {
    return {
      ok: false,
      error: PHASE_A4_REASONS.NOT_READY,
      reason: PHASE_A4_REASONS.NOT_READY,
      ...zero,
    };
  }

  let plan = input.plan;
  if (plan == null) {
    if (
      isPlainObject(readiness) &&
      isPlainObject(/** @type {Record<string, unknown>} */ (readiness).plan)
    ) {
      plan = /** @type {Record<string, unknown>} */ (readiness).plan;
    } else {
      const built = buildApplyPlan({
        proposal: proposalCheck.value,
        impact: input.impact,
      });
      if (!built.ok) {
        return {
          ok: false,
          error: PHASE_A4_REASONS.INVALID_PLAN,
          reason: PHASE_A4_REASONS.INVALID_PLAN,
          ...zero,
        };
      }
      plan = built.value;
    }
  }

  const executed = runApplyExecutor({
    proposal: input.proposal,
    plan,
    gate_result: gateCheck.value,
    readiness,
    execution_hash: idem.execution_hash,
    timestamp: input.timestamp,
  });
  if (!executed.ok) return { ...executed, ...zero };

  // Remember after successful validation to block duplicates
  rememberExecutionHash(input.idempotency_store, idem.execution_hash);

  return {
    ok: true,
    result: executed.result,
    snapshot: executed.snapshot,
    rollback: executed.rollback,
    execution_state: PHASE_A4_EXECUTION_STATES.VALIDATED,
    execution_hash: idem.execution_hash,
    reason: PHASE_A4_REASONS.ENGINE_VALIDATED,
    ...zero,
  };
}

/** Alias matching ticket vocabulary. */
export function applyExecutor(input) {
  return runApplyExecutor(input);
}

/**
 * Real apply remains forbidden.
 * @param {unknown} [_input]
 */
export function commitApply(_input) {
  return {
    ok: false,
    error: PHASE_A4_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A4_REASONS.APPLY_FORBIDDEN,
    ...zeroSideEffects(),
  };
}
