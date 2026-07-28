/**
 * Diff & Approve — Phase A3 Apply Readiness (evaluation only · no Apply).
 *
 * Pipeline:
 *   Approved Proposal → Consistency → Conflict Detection →
 *   Apply Readiness → Apply Plan → Persist(concept)
 *
 * Decision: ready | not_ready only.
 * Apply remains forbidden. No DB · network · SDK · provider · Dashboard.
 */

import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import {
  PHASE_A1_SCHEMA_VERSION,
  PHASE_A1_STATUSES,
  PHASE_A1_CHANGE_TYPE_SET,
  PHASE_A1_RESOURCE_TYPE_SET,
  deepFreeze,
  isPhaseA1ChangeType,
  isPhaseA1ResourceType,
} from "./ai-diff-approve-a1-foundation.mjs";
import { validateApprovalActor } from "./ai-diff-approve-a2-approval.mjs";

export { deepFreeze };

export const PHASE_A3_SCHEMA_VERSION = "diff_approve.a3.apply_readiness.v1";

export const PHASE_A3_DECISIONS = Object.freeze({
  READY: "ready",
  NOT_READY: "not_ready",
});

export const PHASE_A3_REASONS = Object.freeze({
  APPLY_READY: "apply_ready",
  NOT_APPROVED: "not_approved",
  UNKNOWN_CAPABILITY: "unknown_capability",
  UNKNOWN_RESOURCE: "unknown_resource",
  UNKNOWN_CHANGE_TYPE: "unknown_change_type",
  UNKNOWN_ACTOR: "unknown_actor",
  MISSING_DIFF: "missing_diff",
  MISSING_IMPACT: "missing_impact",
  MISSING_PROPOSAL: "missing_proposal",
  RESOURCE_MISMATCH: "resource_mismatch",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  IMMUTABLE_VIOLATION: "immutable_violation",
  APPLY_FORBIDDEN: "apply_forbidden",
  CONFLICTS_PRESENT: "conflicts_present",
});

export const PHASE_A3_CONFLICT_CODES = Object.freeze({
  PROPOSAL_STATUS: "proposal_status",
  RESOURCE_MISMATCH: "resource_mismatch",
  MISSING_DIFF: "missing_diff",
  MISSING_IMPACT: "missing_impact",
  UNKNOWN_CAPABILITY: "unknown_capability",
  UNKNOWN_RESOURCE: "unknown_resource",
});

const PROPOSAL_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "request_id",
  "capability",
  "resource_type",
  "resource_id",
  "change_type",
  "status",
  "created_at",
  "reason",
]);

const DIFF_ALLOWLIST = Object.freeze([
  "schema_version",
  "resource_type",
  "before",
  "after",
  "summary",
]);

const IMPACT_ALLOWLIST = Object.freeze([
  "schema_version",
  "changed_fields",
  "estimated_risk",
  "approval_required",
  "affected_scope",
]);

const PLAN_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "resource_type",
  "resource_id",
  "change_type",
  "estimated_steps",
  "requires_apply",
]);

const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "decision",
  "reason",
  "conflicts",
  "timestamp",
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
  "timestamp",
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

const zeroSideEffects = () => ({
  applied: /** @type {false} */ (false),
  provider_called: /** @type {false} */ (false),
  executed: /** @type {false} */ (false),
  transmit: /** @type {false} */ (false),
  recorded_api_cost: /** @type {0} */ (0),
});

/**
 * Validate approved proposal shape (A3 sibling — A1 forbids approved as active).
 * @param {unknown} proposal
 */
export function validateApprovedProposal(proposal) {
  if (!isPlainObject(proposal)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.MISSING_PROPOSAL,
      reason: PHASE_A3_REASONS.MISSING_PROPOSAL,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (proposal);
  if (!rejectExtraKeys(Object.keys(o), PROPOSAL_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.EXTRA_FIELDS,
      reason: PHASE_A3_REASONS.EXTRA_FIELDS,
    };
  }
  for (const key of PROPOSAL_ALLOWLIST) {
    if (!(key in o)) {
      return {
        ok: false,
        error: PHASE_A3_REASONS.MISSING_PROPOSAL,
        reason: PHASE_A3_REASONS.MISSING_PROPOSAL,
      };
    }
  }
  if (!Object.isFrozen(o)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A3_REASONS.IMMUTABLE_VIOLATION,
    };
  }
  if (
    o.schema_version !== PHASE_A1_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
    };
  }
  if (
    typeof o.proposal_id !== "string" ||
    !UUID_RE.test(o.proposal_id) ||
    typeof o.request_id !== "string" ||
    !UUID_RE.test(o.request_id)
  ) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
    };
  }
  if (!isPhaseBCapabilityAllowed(o.capability)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.UNKNOWN_CAPABILITY,
      reason: PHASE_A3_REASONS.UNKNOWN_CAPABILITY,
    };
  }
  if (!isPhaseA1ResourceType(o.resource_type)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.UNKNOWN_RESOURCE,
      reason: PHASE_A3_REASONS.UNKNOWN_RESOURCE,
    };
  }
  if (!isPhaseA1ChangeType(o.change_type)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.UNKNOWN_CHANGE_TYPE,
      reason: PHASE_A3_REASONS.UNKNOWN_CHANGE_TYPE,
    };
  }
  return { ok: true, value: o };
}

/**
 * ConsistencyValidator — structural checks (fail-closed).
 * @param {{
 *   proposal?: unknown,
 *   diff?: unknown,
 *   impact?: unknown,
 *   actor?: unknown,
 * }} input
 */
export function validateConsistency(input = {}) {
  const conflicts = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
      conflicts: Object.freeze([]),
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.EXTRA_FIELDS,
      reason: PHASE_A3_REASONS.EXTRA_FIELDS,
      conflicts: Object.freeze([]),
    };
  }

  const proposalCheck = validateApprovedProposal(input.proposal);
  if (!proposalCheck.ok) {
    return {
      ok: false,
      error: proposalCheck.error,
      reason: proposalCheck.reason,
      conflicts: Object.freeze([]),
    };
  }
  const proposal = proposalCheck.value;

  if (proposal.status !== PHASE_A1_STATUSES.APPROVED) {
    conflicts.push(
      deepFreeze({
        code: PHASE_A3_CONFLICT_CODES.PROPOSAL_STATUS,
        detail: String(proposal.status),
      })
    );
  }

  if (!isPhaseBCapabilityAllowed(proposal.capability)) {
    conflicts.push(
      deepFreeze({
        code: PHASE_A3_CONFLICT_CODES.UNKNOWN_CAPABILITY,
        detail: String(proposal.capability),
      })
    );
  }

  if (
    typeof proposal.resource_type !== "string" ||
    !PHASE_A1_RESOURCE_TYPE_SET.has(proposal.resource_type)
  ) {
    conflicts.push(
      deepFreeze({
        code: PHASE_A3_CONFLICT_CODES.UNKNOWN_RESOURCE,
        detail: String(proposal.resource_type),
      })
    );
  }

  if (!isPlainObject(input.diff) || !Object.isFrozen(input.diff)) {
    conflicts.push(
      deepFreeze({
        code: PHASE_A3_CONFLICT_CODES.MISSING_DIFF,
        detail: "diff",
      })
    );
  } else {
    const diff = /** @type {Record<string, unknown>} */ (input.diff);
    if (!rejectExtraKeys(Object.keys(diff), DIFF_ALLOWLIST)) {
      return {
        ok: false,
        error: PHASE_A3_REASONS.EXTRA_FIELDS,
        reason: PHASE_A3_REASONS.EXTRA_FIELDS,
        conflicts: Object.freeze([]),
      };
    }
    if (diff.resource_type !== proposal.resource_type) {
      conflicts.push(
        deepFreeze({
          code: PHASE_A3_CONFLICT_CODES.RESOURCE_MISMATCH,
          detail: "diff.resource_type",
        })
      );
    }
    if (
      typeof diff.resource_type === "string" &&
      !PHASE_A1_RESOURCE_TYPE_SET.has(diff.resource_type)
    ) {
      conflicts.push(
        deepFreeze({
          code: PHASE_A3_CONFLICT_CODES.UNKNOWN_RESOURCE,
          detail: String(diff.resource_type),
        })
      );
    }
  }

  if (!isPlainObject(input.impact) || !Object.isFrozen(input.impact)) {
    conflicts.push(
      deepFreeze({
        code: PHASE_A3_CONFLICT_CODES.MISSING_IMPACT,
        detail: "impact",
      })
    );
  } else {
    const impact = /** @type {Record<string, unknown>} */ (input.impact);
    if (!rejectExtraKeys(Object.keys(impact), IMPACT_ALLOWLIST)) {
      return {
        ok: false,
        error: PHASE_A3_REASONS.EXTRA_FIELDS,
        reason: PHASE_A3_REASONS.EXTRA_FIELDS,
        conflicts: Object.freeze([]),
      };
    }
  }

  const actorCheck = validateApprovalActor(input.actor);
  if (!actorCheck.ok) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.UNKNOWN_ACTOR,
      reason: PHASE_A3_REASONS.UNKNOWN_ACTOR,
      conflicts: Object.freeze([...conflicts]),
    };
  }

  return {
    ok: true,
    proposal,
    actor: actorCheck.value,
    conflicts: Object.freeze([...conflicts]),
    consistent: conflicts.length === 0,
  };
}

/**
 * ConflictSummary — record only.
 * @param {unknown} conflicts
 */
export function buildConflictSummary(conflicts) {
  const list = Array.isArray(conflicts) ? conflicts : [];
  const codes = list
    .filter((c) => isPlainObject(c) && typeof c.code === "string")
    .map((c) => /** @type {Record<string, unknown>} */ (c).code);

  return deepFreeze({
    schema_version: PHASE_A3_SCHEMA_VERSION,
    count: codes.length,
    codes: Object.freeze([...codes]),
    blocking: codes.length > 0,
  });
}

/**
 * ApplyPlan — never executes.
 * @param {{
 *   proposal?: Record<string, unknown>,
 *   impact?: unknown,
 * }} input
 */
export function buildApplyPlan(input = {}) {
  const proposal = input.proposal;
  if (!isPlainObject(proposal)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.MISSING_PROPOSAL,
      reason: PHASE_A3_REASONS.MISSING_PROPOSAL,
    };
  }
  const p = /** @type {Record<string, unknown>} */ (proposal);
  if (
    typeof p.proposal_id !== "string" ||
    !UUID_RE.test(p.proposal_id) ||
    !isPhaseA1ResourceType(p.resource_type) ||
    !isPhaseA1ChangeType(p.change_type)
  ) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
    };
  }

  let fieldCount = 1;
  if (isPlainObject(input.impact)) {
    const impact = /** @type {Record<string, unknown>} */ (input.impact);
    if (Array.isArray(impact.changed_fields)) {
      fieldCount = Math.max(1, impact.changed_fields.length);
    }
  }

  const estimated_steps = Object.freeze([
    "validate_target",
    "preview_change",
    "apply_change",
    "verify_result",
  ]);

  const plan = deepFreeze({
    schema_version: PHASE_A3_SCHEMA_VERSION,
    proposal_id: p.proposal_id,
    resource_type: p.resource_type,
    resource_id: typeof p.resource_id === "string" ? p.resource_id : null,
    change_type: p.change_type,
    estimated_steps,
    requires_apply: true,
  });

  if (!rejectExtraKeys(Object.keys(plan), PLAN_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.EXTRA_FIELDS,
      reason: PHASE_A3_REASONS.EXTRA_FIELDS,
    };
  }

  // fieldCount reserved for future step sizing; keep plan minimal per contract
  void fieldCount;
  void PHASE_A1_CHANGE_TYPE_SET;

  return { ok: true, value: plan };
}

/**
 * ReadinessSnapshot — minimal · no prompt.
 * @param {Record<string, unknown>} fields
 */
export function buildReadinessSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.EXTRA_FIELDS,
      reason: PHASE_A3_REASONS.EXTRA_FIELDS,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
    };
  }
  const decision =
    o.decision === PHASE_A3_DECISIONS.READY ||
    o.decision === PHASE_A3_DECISIONS.NOT_READY
      ? o.decision
      : PHASE_A3_DECISIONS.NOT_READY;

  const snap = deepFreeze({
    schema_version: PHASE_A3_SCHEMA_VERSION,
    proposal_id: o.proposal_id,
    decision,
    reason:
      typeof o.reason === "string"
        ? o.reason.slice(0, 500)
        : PHASE_A3_REASONS.INVALID_CONTEXT,
    conflicts: isPlainObject(o.conflicts)
      ? deepFreeze({ .../** @type {object} */ (o.conflicts) })
      : buildConflictSummary([]),
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
 * ApplyReadiness evaluator — ready | not_ready only.
 *
 * @param {{
 *   proposal?: unknown,
 *   diff?: unknown,
 *   impact?: unknown,
 *   actor?: unknown,
 *   timestamp?: unknown,
 * }} input
 */
export function evaluateApplyReadiness(input = {}) {
  const zero = zeroSideEffects();

  if (!isPlainObject(input)) {
    return {
      ok: false,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason: PHASE_A3_REASONS.INVALID_CONTEXT,
      error: PHASE_A3_REASONS.INVALID_CONTEXT,
      conflicts: buildConflictSummary([]),
      ...zero,
    };
  }
  if (!rejectExtraKeys(Object.keys(input), CONTEXT_ALLOWLIST)) {
    return {
      ok: false,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason: PHASE_A3_REASONS.EXTRA_FIELDS,
      error: PHASE_A3_REASONS.EXTRA_FIELDS,
      conflicts: buildConflictSummary([]),
      ...zero,
    };
  }

  const consistency = validateConsistency({
    proposal: input.proposal,
    diff: input.diff,
    impact: input.impact,
    actor: input.actor,
  });
  if (!consistency.ok) {
    return {
      ok: false,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason: consistency.reason || PHASE_A3_REASONS.INVALID_CONTEXT,
      error: consistency.error || PHASE_A3_REASONS.INVALID_CONTEXT,
      conflicts: buildConflictSummary(consistency.conflicts || []),
      ...zero,
    };
  }

  const conflictSummary = buildConflictSummary(consistency.conflicts);
  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";

  if (!consistency.consistent || conflictSummary.blocking) {
    const reason =
      consistency.conflicts.some(
        (c) => c.code === PHASE_A3_CONFLICT_CODES.PROPOSAL_STATUS
      )
        ? PHASE_A3_REASONS.NOT_APPROVED
        : consistency.conflicts.some(
              (c) => c.code === PHASE_A3_CONFLICT_CODES.MISSING_DIFF
            )
          ? PHASE_A3_REASONS.MISSING_DIFF
          : consistency.conflicts.some(
                (c) => c.code === PHASE_A3_CONFLICT_CODES.MISSING_IMPACT
              )
            ? PHASE_A3_REASONS.MISSING_IMPACT
            : consistency.conflicts.some(
                  (c) => c.code === PHASE_A3_CONFLICT_CODES.RESOURCE_MISMATCH
                )
              ? PHASE_A3_REASONS.RESOURCE_MISMATCH
              : consistency.conflicts.some(
                    (c) => c.code === PHASE_A3_CONFLICT_CODES.UNKNOWN_CAPABILITY
                  )
                ? PHASE_A3_REASONS.UNKNOWN_CAPABILITY
                : consistency.conflicts.some(
                      (c) => c.code === PHASE_A3_CONFLICT_CODES.UNKNOWN_RESOURCE
                    )
                  ? PHASE_A3_REASONS.UNKNOWN_RESOURCE
                  : PHASE_A3_REASONS.CONFLICTS_PRESENT;

    const snapBuilt = buildReadinessSnapshot({
      proposal_id: consistency.proposal.proposal_id,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason,
      conflicts: conflictSummary,
      timestamp,
    });
    if (!snapBuilt.ok) {
      return {
        ok: false,
        decision: PHASE_A3_DECISIONS.NOT_READY,
        reason: snapBuilt.reason || reason,
        error: snapBuilt.error || reason,
        conflicts: conflictSummary,
        ...zero,
      };
    }
    return {
      ok: true,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason,
      conflicts: conflictSummary,
      snapshot: snapBuilt.value,
      plan: null,
      ...zero,
    };
  }

  const planBuilt = buildApplyPlan({
    proposal: consistency.proposal,
    impact: input.impact,
  });
  if (!planBuilt.ok) {
    return {
      ok: false,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason: planBuilt.reason || PHASE_A3_REASONS.INVALID_CONTEXT,
      error: planBuilt.error || PHASE_A3_REASONS.INVALID_CONTEXT,
      conflicts: conflictSummary,
      ...zero,
    };
  }

  const snapBuilt = buildReadinessSnapshot({
    proposal_id: consistency.proposal.proposal_id,
    decision: PHASE_A3_DECISIONS.READY,
    reason: PHASE_A3_REASONS.APPLY_READY,
    conflicts: conflictSummary,
    timestamp,
  });
  if (!snapBuilt.ok) {
    return {
      ok: false,
      decision: PHASE_A3_DECISIONS.NOT_READY,
      reason: snapBuilt.reason || PHASE_A3_REASONS.INVALID_CONTEXT,
      error: snapBuilt.error || PHASE_A3_REASONS.INVALID_CONTEXT,
      conflicts: conflictSummary,
      ...zero,
    };
  }

  return {
    ok: true,
    decision: PHASE_A3_DECISIONS.READY,
    reason: PHASE_A3_REASONS.APPLY_READY,
    conflicts: conflictSummary,
    snapshot: snapBuilt.value,
    plan: planBuilt.value,
    actor: consistency.actor,
    ...zero,
  };
}

/**
 * Explicit Apply forbid (A3).
 * @param {unknown} [_input]
 */
export function applyProposalChanges(_input) {
  return {
    ok: false,
    error: PHASE_A3_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A3_REASONS.APPLY_FORBIDDEN,
    ...zeroSideEffects(),
  };
}
