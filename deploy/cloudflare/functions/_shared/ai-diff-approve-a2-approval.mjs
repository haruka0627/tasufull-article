/**
 * Diff & Approve — Phase A2 Approval Workflow (no Apply).
 *
 * State machine (A2):
 *   pending_approval → approved | rejected | revision_requested
 *
 * A1 owns draft → pending_approval.
 * expired is vocabulary only (no transition).
 * Apply remains forbidden.
 *
 * No DB · no network · no SDK · no provider · no Dashboard · no credentials.
 */

import {
  PHASE_A1_SCHEMA_VERSION,
  PHASE_A1_STATUSES,
  deepFreeze,
  validateDiffProposal,
} from "./ai-diff-approve-a1-foundation.mjs";

export { deepFreeze };

export const PHASE_A2_SCHEMA_VERSION = "diff_approve.a2.approval.v1";

/** Actor roles — unknown roles rejected. */
export const PHASE_A2_ACTOR_ROLES = Object.freeze({
  APPROVER: "approver",
  REQUESTER: "requester",
  SYSTEM: "system",
});

export const PHASE_A2_ACTOR_ROLE_SET = Object.freeze(
  new Set(Object.values(PHASE_A2_ACTOR_ROLES))
);

/** Audit events (Apply events forbidden). */
export const PHASE_A2_EVENTS = Object.freeze({
  APPROVAL_REQUESTED: "approval_requested",
  APPROVAL_GRANTED: "approval_granted",
  APPROVAL_REJECTED: "approval_rejected",
  REVISION_REQUESTED: "revision_requested",
});

/** Decision vocabulary (= terminal to_status for A2). */
export const PHASE_A2_DECISIONS = Object.freeze({
  APPROVED: "approved",
  REJECTED: "rejected",
  REVISION_REQUESTED: "revision_requested",
});

export const PHASE_A2_REASONS = Object.freeze({
  APPROVAL_GRANTED: "approval_granted",
  APPROVAL_REJECTED: "approval_rejected",
  REVISION_REQUESTED: "revision_requested",
  APPROVAL_REQUESTED: "approval_requested",
  UNKNOWN_ACTOR: "unknown_actor",
  UNKNOWN_STATE: "unknown_state",
  INVALID_TRANSITION: "invalid_transition",
  APPROVED_TWICE: "approved_twice",
  REJECTED_TWICE: "rejected_twice",
  ALREADY_TERMINAL: "already_terminal",
  ACTOR_NOT_ALLOWED: "actor_not_allowed",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  IMMUTABLE_VIOLATION: "immutable_violation",
  APPLY_FORBIDDEN: "apply_forbidden",
  EXPIRED_FORBIDDEN: "expired_forbidden",
  MISSING_PROPOSAL: "missing_proposal",
});

/** Allowed transitions: from → Set(to). */
export const PHASE_A2_TRANSITIONS = Object.freeze({
  [PHASE_A1_STATUSES.DRAFT]: Object.freeze([
    PHASE_A1_STATUSES.PENDING_APPROVAL,
  ]),
  [PHASE_A1_STATUSES.PENDING_APPROVAL]: Object.freeze([
    PHASE_A1_STATUSES.APPROVED,
    PHASE_A1_STATUSES.REJECTED,
    PHASE_A1_STATUSES.REVISION_REQUESTED,
  ]),
});

const ACTOR_ALLOWLIST = Object.freeze(["role", "id"]);
const DECISION_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "decision",
  "event",
  "actor",
  "from_status",
  "to_status",
  "reason",
  "timestamp",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);
const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "status",
  "actor",
  "reason",
  "timestamp",
  "event",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);
const REVISION_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal_id",
  "actor",
  "reason",
  "timestamp",
  "notes",
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

/**
 * @param {unknown} role
 */
export function isPhaseA2ActorRole(role) {
  return typeof role === "string" && PHASE_A2_ACTOR_ROLE_SET.has(role);
}

/**
 * Validate ApprovalActor.
 * @param {unknown} actor
 */
export function validateApprovalActor(actor) {
  if (!isPlainObject(actor)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.UNKNOWN_ACTOR,
      reason: PHASE_A2_REASONS.UNKNOWN_ACTOR,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (actor);
  if (!rejectExtraKeys(Object.keys(o), ACTOR_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.EXTRA_FIELDS,
      reason: PHASE_A2_REASONS.EXTRA_FIELDS,
    };
  }
  if (!isPhaseA2ActorRole(o.role)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.UNKNOWN_ACTOR,
      reason: PHASE_A2_REASONS.UNKNOWN_ACTOR,
    };
  }
  if (o.id != null && typeof o.id !== "string") {
    return {
      ok: false,
      error: PHASE_A2_REASONS.UNKNOWN_ACTOR,
      reason: PHASE_A2_REASONS.UNKNOWN_ACTOR,
    };
  }
  if (typeof o.id === "string") {
    if (o.id.length === 0 || /[\u200b\u200c\u200d\ufeff]/.test(o.id)) {
      return {
        ok: false,
        error: PHASE_A2_REASONS.UNKNOWN_ACTOR,
        reason: PHASE_A2_REASONS.UNKNOWN_ACTOR,
      };
    }
  }

  return {
    ok: true,
    value: deepFreeze({
      role: o.role,
      id: typeof o.id === "string" ? o.id.slice(0, 128) : null,
    }),
  };
}

/**
 * Authority matrix for A2 decisions.
 * @param {string} decision
 * @param {string} role
 */
export function isActorAllowedForDecision(decision, role) {
  if (decision === PHASE_A2_DECISIONS.APPROVED) {
    return (
      role === PHASE_A2_ACTOR_ROLES.APPROVER ||
      role === PHASE_A2_ACTOR_ROLES.SYSTEM
    );
  }
  if (decision === PHASE_A2_DECISIONS.REJECTED) {
    return (
      role === PHASE_A2_ACTOR_ROLES.APPROVER ||
      role === PHASE_A2_ACTOR_ROLES.SYSTEM
    );
  }
  if (decision === PHASE_A2_DECISIONS.REVISION_REQUESTED) {
    return (
      role === PHASE_A2_ACTOR_ROLES.APPROVER ||
      role === PHASE_A2_ACTOR_ROLES.REQUESTER ||
      role === PHASE_A2_ACTOR_ROLES.SYSTEM
    );
  }
  return false;
}

/**
 * Check transition edge.
 * @param {unknown} from
 * @param {unknown} to
 */
export function isTransitionAllowed(from, to) {
  if (typeof from !== "string" || typeof to !== "string") return false;
  if (to === PHASE_A1_STATUSES.EXPIRED) return false;
  const allowed = PHASE_A2_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Map decision → event.
 * @param {string} decision
 */
export function decisionToEvent(decision) {
  if (decision === PHASE_A2_DECISIONS.APPROVED) {
    return PHASE_A2_EVENTS.APPROVAL_GRANTED;
  }
  if (decision === PHASE_A2_DECISIONS.REJECTED) {
    return PHASE_A2_EVENTS.APPROVAL_REJECTED;
  }
  if (decision === PHASE_A2_DECISIONS.REVISION_REQUESTED) {
    return PHASE_A2_EVENTS.REVISION_REQUESTED;
  }
  return null;
}

/**
 * Build approval_requested event (pending confirmation).
 * @param {{
 *   proposal?: unknown,
 *   actor?: unknown,
 *   timestamp?: unknown,
 *   reason?: unknown,
 * }} input
 */
export function requestApproval(input = {}) {
  const zero = {
    applied: /** @type {false} */ (false),
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };

  const proposalCheck = validateDiffProposal(input.proposal);
  if (!proposalCheck.ok) {
    return {
      ok: false,
      error: proposalCheck.error || PHASE_A2_REASONS.MISSING_PROPOSAL,
      reason: proposalCheck.reason || PHASE_A2_REASONS.MISSING_PROPOSAL,
      ...zero,
    };
  }
  const proposal = proposalCheck.value;
  if (proposal.status !== PHASE_A1_STATUSES.PENDING_APPROVAL) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_TRANSITION,
      reason: PHASE_A2_REASONS.INVALID_TRANSITION,
      ...zero,
    };
  }

  const actorCheck = validateApprovalActor(
    input.actor || { role: PHASE_A2_ACTOR_ROLES.SYSTEM }
  );
  if (!actorCheck.ok) return { ...actorCheck, ...zero };

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";

  const event = deepFreeze({
    schema_version: PHASE_A2_SCHEMA_VERSION,
    event: PHASE_A2_EVENTS.APPROVAL_REQUESTED,
    proposal_id: proposal.proposal_id,
    status: PHASE_A1_STATUSES.PENDING_APPROVAL,
    actor: actorCheck.value,
    reason:
      typeof input.reason === "string"
        ? input.reason.slice(0, 500)
        : PHASE_A2_REASONS.APPROVAL_REQUESTED,
    timestamp,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  return { ok: true, value: event, proposal, ...zero };
}

/**
 * Build ApprovalSnapshot (minimal · no prompt).
 * @param {Record<string, unknown>} fields
 */
export function buildApprovalSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_CONTEXT,
      reason: PHASE_A2_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  if (!rejectExtraKeys(Object.keys(o), SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.EXTRA_FIELDS,
      reason: PHASE_A2_REASONS.EXTRA_FIELDS,
    };
  }
  if (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_CONTEXT,
      reason: PHASE_A2_REASONS.INVALID_CONTEXT,
    };
  }
  const actorCheck = validateApprovalActor(o.actor);
  if (!actorCheck.ok) return actorCheck;

  const snap = deepFreeze({
    schema_version: PHASE_A2_SCHEMA_VERSION,
    proposal_id: o.proposal_id,
    status: typeof o.status === "string" ? o.status : null,
    actor: actorCheck.value,
    reason: typeof o.reason === "string" ? o.reason.slice(0, 500) : null,
    timestamp:
      typeof o.timestamp === "string" ? o.timestamp : "1970-01-01T00:00:00.000Z",
    event: typeof o.event === "string" ? o.event : null,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: snap };
}

/**
 * Create RevisionRequest payload (does not apply transition alone).
 * @param {{
 *   proposal_id?: unknown,
 *   actor?: unknown,
 *   reason?: unknown,
 *   timestamp?: unknown,
 *   notes?: unknown,
 * }} input
 */
export function createRevisionRequest(input = {}) {
  if (typeof input.proposal_id !== "string" || !UUID_RE.test(input.proposal_id)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_CONTEXT,
      reason: PHASE_A2_REASONS.INVALID_CONTEXT,
    };
  }
  const actorCheck = validateApprovalActor(input.actor);
  if (!actorCheck.ok) return actorCheck;
  if (
    !isActorAllowedForDecision(
      PHASE_A2_DECISIONS.REVISION_REQUESTED,
      actorCheck.value.role
    )
  ) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.ACTOR_NOT_ALLOWED,
      reason: PHASE_A2_REASONS.ACTOR_NOT_ALLOWED,
    };
  }

  /** @type {Record<string, unknown>} */
  const raw = {
    schema_version: PHASE_A2_SCHEMA_VERSION,
    proposal_id: input.proposal_id,
    actor: actorCheck.value,
    reason:
      typeof input.reason === "string"
        ? input.reason.slice(0, 500)
        : PHASE_A2_REASONS.REVISION_REQUESTED,
    timestamp:
      typeof input.timestamp === "string" && input.timestamp.length > 0
        ? input.timestamp
        : "1970-01-01T00:00:00.000Z",
  };
  if (typeof input.notes === "string") {
    raw.notes = input.notes.slice(0, 500);
  }
  if (!rejectExtraKeys(Object.keys(raw), REVISION_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.EXTRA_FIELDS,
      reason: PHASE_A2_REASONS.EXTRA_FIELDS,
    };
  }
  return { ok: true, value: deepFreeze(raw) };
}

/**
 * ApprovalTransition — apply decision to pending proposal (in-memory only).
 *
 * @param {{
 *   proposal?: unknown,
 *   decision?: unknown,
 *   actor?: unknown,
 *   reason?: unknown,
 *   timestamp?: unknown,
 * }} input
 */
export function applyApprovalTransition(input = {}) {
  const zero = {
    applied: /** @type {false} */ (false),
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };

  if (!isPlainObject(input.proposal)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.MISSING_PROPOSAL,
      reason: PHASE_A2_REASONS.MISSING_PROPOSAL,
      ...zero,
    };
  }

  // Accept frozen pending proposals via A1 validator; terminals need custom check
  const p = /** @type {Record<string, unknown>} */ (input.proposal);
  if (!Object.isFrozen(p)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A2_REASONS.IMMUTABLE_VIOLATION,
      ...zero,
    };
  }

  const fromStatus = p.status;
  if (fromStatus === PHASE_A1_STATUSES.APPROVED) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.APPROVED_TWICE,
      reason: PHASE_A2_REASONS.APPROVED_TWICE,
      ...zero,
    };
  }
  if (fromStatus === PHASE_A1_STATUSES.REJECTED) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.REJECTED_TWICE,
      reason: PHASE_A2_REASONS.REJECTED_TWICE,
      ...zero,
    };
  }
  if (
    fromStatus === PHASE_A1_STATUSES.REVISION_REQUESTED ||
    fromStatus === PHASE_A1_STATUSES.EXPIRED
  ) {
    return {
      ok: false,
      error:
        fromStatus === PHASE_A1_STATUSES.EXPIRED
          ? PHASE_A2_REASONS.EXPIRED_FORBIDDEN
          : PHASE_A2_REASONS.ALREADY_TERMINAL,
      reason:
        fromStatus === PHASE_A1_STATUSES.EXPIRED
          ? PHASE_A2_REASONS.EXPIRED_FORBIDDEN
          : PHASE_A2_REASONS.ALREADY_TERMINAL,
      ...zero,
    };
  }

  if (fromStatus !== PHASE_A1_STATUSES.PENDING_APPROVAL) {
    // Prefer A1 validation message for non-pending drafts etc.
    const a1 = validateDiffProposal(input.proposal);
    if (!a1.ok) {
      return {
        ok: false,
        error: a1.error || PHASE_A2_REASONS.UNKNOWN_STATE,
        reason: a1.reason || PHASE_A2_REASONS.UNKNOWN_STATE,
        ...zero,
      };
    }
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_TRANSITION,
      reason: PHASE_A2_REASONS.INVALID_TRANSITION,
      ...zero,
    };
  }

  // Validate pending proposal shape via A1
  const pendingCheck = validateDiffProposal(input.proposal);
  if (!pendingCheck.ok) {
    return {
      ok: false,
      error: pendingCheck.error || PHASE_A2_REASONS.MISSING_PROPOSAL,
      reason: pendingCheck.reason || PHASE_A2_REASONS.MISSING_PROPOSAL,
      ...zero,
    };
  }

  const decision = input.decision;
  if (
    decision !== PHASE_A2_DECISIONS.APPROVED &&
    decision !== PHASE_A2_DECISIONS.REJECTED &&
    decision !== PHASE_A2_DECISIONS.REVISION_REQUESTED
  ) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.UNKNOWN_STATE,
      reason: PHASE_A2_REASONS.UNKNOWN_STATE,
      ...zero,
    };
  }

  if (!isTransitionAllowed(PHASE_A1_STATUSES.PENDING_APPROVAL, decision)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.INVALID_TRANSITION,
      reason: PHASE_A2_REASONS.INVALID_TRANSITION,
      ...zero,
    };
  }

  const actorCheck = validateApprovalActor(input.actor);
  if (!actorCheck.ok) return { ...actorCheck, ...zero };

  if (!isActorAllowedForDecision(decision, actorCheck.value.role)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.ACTOR_NOT_ALLOWED,
      reason: PHASE_A2_REASONS.ACTOR_NOT_ALLOWED,
      ...zero,
    };
  }

  const event = decisionToEvent(decision);
  if (!event) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.UNKNOWN_STATE,
      reason: PHASE_A2_REASONS.UNKNOWN_STATE,
      ...zero,
    };
  }

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.length > 0
      ? input.timestamp
      : "1970-01-01T00:00:00.000Z";
  const reason =
    typeof input.reason === "string"
      ? input.reason.slice(0, 500)
      : decision === PHASE_A2_DECISIONS.APPROVED
        ? PHASE_A2_REASONS.APPROVAL_GRANTED
        : decision === PHASE_A2_DECISIONS.REJECTED
          ? PHASE_A2_REASONS.APPROVAL_REJECTED
          : PHASE_A2_REASONS.REVISION_REQUESTED;

  const nextProposal = deepFreeze({
    schema_version: pendingCheck.value.schema_version || PHASE_A1_SCHEMA_VERSION,
    proposal_id: pendingCheck.value.proposal_id,
    request_id: pendingCheck.value.request_id,
    capability: pendingCheck.value.capability,
    resource_type: pendingCheck.value.resource_type,
    resource_id: pendingCheck.value.resource_id,
    change_type: pendingCheck.value.change_type,
    status: decision,
    created_at: pendingCheck.value.created_at,
    reason,
  });

  const approvalDecision = deepFreeze({
    schema_version: PHASE_A2_SCHEMA_VERSION,
    proposal_id: pendingCheck.value.proposal_id,
    decision,
    event,
    actor: actorCheck.value,
    from_status: PHASE_A1_STATUSES.PENDING_APPROVAL,
    to_status: decision,
    reason,
    timestamp,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  if (!rejectExtraKeys(Object.keys(approvalDecision), DECISION_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A2_REASONS.EXTRA_FIELDS,
      reason: PHASE_A2_REASONS.EXTRA_FIELDS,
      ...zero,
    };
  }

  const snapBuilt = buildApprovalSnapshot({
    proposal_id: pendingCheck.value.proposal_id,
    status: decision,
    actor: actorCheck.value,
    reason,
    timestamp,
    event,
  });
  if (!snapBuilt.ok) {
    return { ...snapBuilt, ...zero };
  }

  return {
    ok: true,
    proposal: nextProposal,
    decision: approvalDecision,
    snapshot: snapBuilt.value,
    event,
    status: decision,
    reason,
    ...zero,
  };
}

/**
 * Convenience: grant approval.
 * @param {{ proposal?: unknown, actor?: unknown, reason?: unknown, timestamp?: unknown }} input
 */
export function grantApproval(input = {}) {
  return applyApprovalTransition({
    ...input,
    decision: PHASE_A2_DECISIONS.APPROVED,
  });
}

/**
 * Convenience: reject approval.
 * @param {{ proposal?: unknown, actor?: unknown, reason?: unknown, timestamp?: unknown }} input
 */
export function rejectApproval(input = {}) {
  return applyApprovalTransition({
    ...input,
    decision: PHASE_A2_DECISIONS.REJECTED,
  });
}

/**
 * Convenience: request revision (+ transition).
 * @param {{ proposal?: unknown, actor?: unknown, reason?: unknown, timestamp?: unknown, notes?: unknown }} input
 */
export function requestRevision(input = {}) {
  const transition = applyApprovalTransition({
    proposal: input.proposal,
    actor: input.actor,
    reason: input.reason,
    timestamp: input.timestamp,
    decision: PHASE_A2_DECISIONS.REVISION_REQUESTED,
  });
  if (!transition.ok) return transition;

  const rev = createRevisionRequest({
    proposal_id: transition.proposal.proposal_id,
    actor: input.actor,
    reason: input.reason,
    timestamp: input.timestamp,
    notes: input.notes,
  });
  if (!rev.ok) return rev;

  return {
    ...transition,
    revision_request: rev.value,
  };
}

/**
 * Apply remains forbidden in A2.
 * @param {unknown} [_input]
 */
export function applyApprovedProposal(_input) {
  return {
    ok: false,
    error: PHASE_A2_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A2_REASONS.APPLY_FORBIDDEN,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  };
}
