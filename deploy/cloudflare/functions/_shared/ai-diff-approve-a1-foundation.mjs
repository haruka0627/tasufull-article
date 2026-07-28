/**
 * Diff & Approve — Phase A1 MVP Foundation (evaluation only).
 *
 * Pipeline (conceptual):
 *   AI Request → Execution Gate → Proposal → Diff → Impact → Pending Approval → Persist
 *
 * A1 implements Proposal / Diff / Impact / Pending Approval / Snapshot / Validation.
 * Apply is NOT implemented. No DB write · no migration · no network · no SDK ·
 * no provider · no credentials · no Dashboard.
 */

import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import { deepFreeze } from "./ai-exec-gate-c5-execution-boundary.mjs";

export { deepFreeze };

export const PHASE_A1_SCHEMA_VERSION = "diff_approve.a1.foundation.v1";

/** Resource types in A1 scope (code diff excluded). */
export const PHASE_A1_RESOURCE_TYPES = Object.freeze([
  "text",
  "json",
  "settings",
]);

export const PHASE_A1_RESOURCE_TYPE_SET = Object.freeze(
  new Set(PHASE_A1_RESOURCE_TYPES)
);

/** Change types for MVP proposals. */
export const PHASE_A1_CHANGE_TYPES = Object.freeze([
  "create",
  "update",
  "delete",
  "replace",
]);

export const PHASE_A1_CHANGE_TYPE_SET = Object.freeze(
  new Set(PHASE_A1_CHANGE_TYPES)
);

/**
 * Full status vocabulary (future phases).
 * A1 transitions only: draft → pending_approval.
 */
export const PHASE_A1_STATUSES = Object.freeze({
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
});

/** Statuses reachable in A1. */
export const PHASE_A1_ACTIVE_STATUSES = Object.freeze([
  PHASE_A1_STATUSES.DRAFT,
  PHASE_A1_STATUSES.PENDING_APPROVAL,
]);

export const PHASE_A1_RISK_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

export const PHASE_A1_REASONS = Object.freeze({
  PROPOSAL_CREATED: "proposal_created",
  PENDING_APPROVAL: "pending_approval",
  MISSING_PROPOSAL: "missing_proposal",
  UNKNOWN_STATUS: "unknown_status",
  UNKNOWN_RESOURCE: "unknown_resource",
  UNKNOWN_CAPABILITY: "unknown_capability",
  UNKNOWN_CHANGE_TYPE: "unknown_change_type",
  INVALID_DIFF: "invalid_diff",
  INVALID_IMPACT: "invalid_impact",
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  IMMUTABLE_VIOLATION: "immutable_violation",
  APPLY_FORBIDDEN: "apply_forbidden",
  STATUS_TRANSITION_FORBIDDEN: "status_transition_forbidden",
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

const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "proposal",
  "diff",
  "impact",
  "status",
  "reason",
  "applied",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
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
 * @param {unknown} value
 * @returns {boolean}
 */
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Deterministic fallback id (no crypto dependency required for tests).
 * @param {string} prefix
 * @param {string} seed
 */
function makeDeterministicId(prefix, seed) {
  let h = 0x811c9dc5;
  const s = `${prefix}:${seed}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(1, 4)}-${hex.padEnd(12, "0").slice(0, 12)}`;
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
 * Sanitize a JSON-like value for diff payloads (no functions · depth-limited).
 * @param {unknown} value
 * @param {number} depth
 */
function sanitizeValue(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return null;
  if (typeof value === "string") {
    if (value.length > 8000) return value.slice(0, 8000);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) => sanitizeValue(v, depth + 1));
  }
  if (isPlainObject(value)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    const keys = Object.keys(value).slice(0, 50);
    for (const key of keys) {
      if (
        key === "__proto__" ||
        key === "prototype" ||
        key === "constructor"
      ) {
        continue;
      }
      out[key] = sanitizeValue(
        /** @type {Record<string, unknown>} */ (value)[key],
        depth + 1
      );
    }
    return out;
  }
  return null;
}

/**
 * @param {unknown} resourceType
 */
export function isPhaseA1ResourceType(resourceType) {
  return (
    typeof resourceType === "string" &&
    PHASE_A1_RESOURCE_TYPE_SET.has(resourceType)
  );
}

/**
 * @param {unknown} changeType
 */
export function isPhaseA1ChangeType(changeType) {
  return (
    typeof changeType === "string" && PHASE_A1_CHANGE_TYPE_SET.has(changeType)
  );
}

/**
 * @param {unknown} status
 */
export function isPhaseA1ActiveStatus(status) {
  return (
    typeof status === "string" &&
    PHASE_A1_ACTIVE_STATUSES.includes(status)
  );
}

/**
 * DiffGenerator — before / after / summary only (text · json · settings).
 *
 * @param {{
 *   resource_type?: unknown,
 *   before?: unknown,
 *   after?: unknown,
 * }} input
 */
export function generateDiff(input = {}) {
  if (!isPhaseA1ResourceType(input.resource_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
      reason: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
    };
  }

  const before = sanitizeValue(input.before);
  const after = sanitizeValue(input.after);

  const beforeKeys =
    isPlainObject(before) ? Object.keys(/** @type {object} */ (before)) : [];
  const afterKeys =
    isPlainObject(after) ? Object.keys(/** @type {object} */ (after)) : [];
  const changed = new Set([
    ...beforeKeys.filter((k) => {
      const b = /** @type {Record<string, unknown>} */ (before || {});
      const a = /** @type {Record<string, unknown>} */ (after || {});
      return JSON.stringify(b[k]) !== JSON.stringify(a[k]);
    }),
    ...afterKeys.filter((k) => !(beforeKeys.includes(k))),
  ]);

  let summary;
  if (input.resource_type === "text") {
    const b =
      typeof before === "string" ? before : before == null ? "" : String(before);
    const a =
      typeof after === "string" ? after : after == null ? "" : String(after);
    if (b === a) summary = "text_unchanged";
    else if (!b && a) summary = "text_created";
    else if (b && !a) summary = "text_deleted";
    else summary = "text_updated";
  } else if (changed.size === 0) {
    summary = `${input.resource_type}_unchanged`;
  } else {
    summary = `${input.resource_type}_fields_changed:${changed.size}`;
  }

  const diff = deepFreeze({
    schema_version: PHASE_A1_SCHEMA_VERSION,
    resource_type: input.resource_type,
    before,
    after,
    summary,
  });

  if (!rejectExtraKeys(Object.keys(diff), DIFF_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }

  return { ok: true, value: diff, changed_fields: Object.freeze([...changed]) };
}

/**
 * ImpactSummary — estimate only (no apply).
 *
 * @param {{
 *   resource_type?: unknown,
 *   change_type?: unknown,
 *   changed_fields?: unknown,
 *   resource_id?: unknown,
 * }} input
 */
export function generateImpactSummary(input = {}) {
  if (!isPhaseA1ResourceType(input.resource_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
      reason: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
    };
  }
  if (!isPhaseA1ChangeType(input.change_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
      reason: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
    };
  }

  const fields = Array.isArray(input.changed_fields)
    ? input.changed_fields.filter((f) => typeof f === "string").slice(0, 50)
    : [];

  let estimated_risk = PHASE_A1_RISK_LEVELS.LOW;
  if (
    input.change_type === "delete" ||
    input.change_type === "replace" ||
    fields.length >= 5
  ) {
    estimated_risk = PHASE_A1_RISK_LEVELS.HIGH;
  } else if (input.change_type === "update" || fields.length >= 2) {
    estimated_risk = PHASE_A1_RISK_LEVELS.MEDIUM;
  }

  const impact = deepFreeze({
    schema_version: PHASE_A1_SCHEMA_VERSION,
    changed_fields: Object.freeze([...fields]),
    estimated_risk,
    approval_required: true,
    affected_scope: deepFreeze({
      resource_type: input.resource_type,
      resource_id:
        typeof input.resource_id === "string" ? input.resource_id : null,
      field_count: fields.length,
    }),
  });

  if (!rejectExtraKeys(Object.keys(impact), IMPACT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }

  return { ok: true, value: impact };
}

/**
 * Create DiffProposal in draft status.
 *
 * @param {{
 *   proposal_id?: unknown,
 *   request_id?: unknown,
 *   capability?: unknown,
 *   resource_type?: unknown,
 *   resource_id?: unknown,
 *   change_type?: unknown,
 *   created_at?: unknown,
 *   reason?: unknown,
 *   seed?: unknown,
 * }} input
 */
export function createDiffProposal(input = {}) {
  if (!isPhaseBCapabilityAllowed(input.capability)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_CAPABILITY,
      reason: PHASE_A1_REASONS.UNKNOWN_CAPABILITY,
    };
  }
  if (!isPhaseA1ResourceType(input.resource_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
      reason: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
    };
  }
  if (!isPhaseA1ChangeType(input.change_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
      reason: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
    };
  }

  const seed =
    typeof input.seed === "string"
      ? input.seed
      : `${input.capability}:${input.resource_type}:${input.resource_id || ""}`;

  const proposal_id = isUuid(input.proposal_id)
    ? input.proposal_id
    : makeDeterministicId("proposal", seed);
  const request_id = isUuid(input.request_id)
    ? input.request_id
    : makeDeterministicId("request", seed);

  if (!isUuid(proposal_id) || !isUuid(request_id)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.INVALID_CONTEXT,
      reason: PHASE_A1_REASONS.INVALID_CONTEXT,
    };
  }

  const created_at =
    typeof input.created_at === "string" && input.created_at.length > 0
      ? input.created_at
      : "1970-01-01T00:00:00.000Z";

  const proposal = deepFreeze({
    schema_version: PHASE_A1_SCHEMA_VERSION,
    proposal_id,
    request_id,
    capability: input.capability,
    resource_type: input.resource_type,
    resource_id:
      typeof input.resource_id === "string" ? input.resource_id : null,
    change_type: input.change_type,
    status: PHASE_A1_STATUSES.DRAFT,
    created_at,
    reason:
      typeof input.reason === "string"
        ? input.reason.slice(0, 500)
        : PHASE_A1_REASONS.PROPOSAL_CREATED,
  });

  if (!rejectExtraKeys(Object.keys(proposal), PROPOSAL_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }

  return { ok: true, value: proposal };
}

/**
 * Validate proposal shape (allowlist · active status only in A1).
 * @param {unknown} proposal
 */
export function validateDiffProposal(proposal) {
  if (!isPlainObject(proposal)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.MISSING_PROPOSAL,
      reason: PHASE_A1_REASONS.MISSING_PROPOSAL,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (proposal);
  if (!rejectExtraKeys(Object.keys(o), PROPOSAL_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }
  for (const key of PROPOSAL_ALLOWLIST) {
    if (!(key in o)) {
      return {
        ok: false,
        error: PHASE_A1_REASONS.MISSING_PROPOSAL,
        reason: PHASE_A1_REASONS.MISSING_PROPOSAL,
      };
    }
  }
  if (o.schema_version !== PHASE_A1_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.INVALID_CONTEXT,
      reason: PHASE_A1_REASONS.INVALID_CONTEXT,
    };
  }
  if (!isUuid(o.proposal_id) || !isUuid(o.request_id)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.INVALID_CONTEXT,
      reason: PHASE_A1_REASONS.INVALID_CONTEXT,
    };
  }
  if (!isPhaseBCapabilityAllowed(o.capability)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_CAPABILITY,
      reason: PHASE_A1_REASONS.UNKNOWN_CAPABILITY,
    };
  }
  if (!isPhaseA1ResourceType(o.resource_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
      reason: PHASE_A1_REASONS.UNKNOWN_RESOURCE,
    };
  }
  if (!isPhaseA1ChangeType(o.change_type)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
      reason: PHASE_A1_REASONS.UNKNOWN_CHANGE_TYPE,
    };
  }
  if (!isPhaseA1ActiveStatus(o.status)) {
    // approved/rejected/expired exist in vocab but are unknown for A1 active use
    if (
      o.status === PHASE_A1_STATUSES.APPROVED ||
      o.status === PHASE_A1_STATUSES.REJECTED ||
      o.status === PHASE_A1_STATUSES.EXPIRED
    ) {
      return {
        ok: false,
        error: PHASE_A1_REASONS.STATUS_TRANSITION_FORBIDDEN,
        reason: PHASE_A1_REASONS.STATUS_TRANSITION_FORBIDDEN,
      };
    }
    return {
      ok: false,
      error: PHASE_A1_REASONS.UNKNOWN_STATUS,
      reason: PHASE_A1_REASONS.UNKNOWN_STATUS,
    };
  }
  if (!Object.isFrozen(o)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
    };
  }
  return { ok: true, value: o };
}

/**
 * Transition draft → pending_approval (ApproveProposal entry for A1).
 * Does NOT apply changes.
 *
 * @param {{ proposal?: unknown }} input
 */
export function markProposalPendingApproval(input = {}) {
  const checked = validateDiffProposal(input.proposal);
  if (!checked.ok) return checked;
  const p = checked.value;
  if (p.status !== PHASE_A1_STATUSES.DRAFT) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.STATUS_TRANSITION_FORBIDDEN,
      reason: PHASE_A1_REASONS.STATUS_TRANSITION_FORBIDDEN,
    };
  }
  const next = deepFreeze({
    ...p,
    status: PHASE_A1_STATUSES.PENDING_APPROVAL,
    reason: PHASE_A1_REASONS.PENDING_APPROVAL,
  });
  return { ok: true, value: next };
}

/**
 * Build ProposalSnapshot (minimal · no secrets · applied=false).
 * @param {{
 *   proposal?: unknown,
 *   diff?: unknown,
 *   impact?: unknown,
 *   reason?: unknown,
 * }} input
 */
export function buildProposalSnapshot(input = {}) {
  const proposalCheck = validateDiffProposal(input.proposal);
  if (!proposalCheck.ok) return proposalCheck;

  if (!isPlainObject(input.diff)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.INVALID_DIFF,
      reason: PHASE_A1_REASONS.INVALID_DIFF,
    };
  }
  const diff = /** @type {Record<string, unknown>} */ (input.diff);
  if (!rejectExtraKeys(Object.keys(diff), DIFF_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }
  if (!Object.isFrozen(diff)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
    };
  }

  if (!isPlainObject(input.impact)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.INVALID_IMPACT,
      reason: PHASE_A1_REASONS.INVALID_IMPACT,
    };
  }
  const impact = /** @type {Record<string, unknown>} */ (input.impact);
  if (!rejectExtraKeys(Object.keys(impact), IMPACT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }
  if (!Object.isFrozen(impact)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A1_REASONS.IMMUTABLE_VIOLATION,
    };
  }

  const snap = deepFreeze({
    schema_version: PHASE_A1_SCHEMA_VERSION,
    proposal: proposalCheck.value,
    diff,
    impact,
    status: proposalCheck.value.status,
    reason:
      typeof input.reason === "string"
        ? input.reason
        : typeof proposalCheck.value.reason === "string"
          ? proposalCheck.value.reason
          : PHASE_A1_REASONS.PROPOSAL_CREATED,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  if (!rejectExtraKeys(Object.keys(snap), SNAPSHOT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A1_REASONS.EXTRA_FIELDS,
      reason: PHASE_A1_REASONS.EXTRA_FIELDS,
    };
  }

  return { ok: true, value: snap };
}

/**
 * Full A1 pipeline (in-memory only · no persist I/O · no apply).
 *
 * @param {{
 *   capability?: unknown,
 *   resource_type?: unknown,
 *   resource_id?: unknown,
 *   change_type?: unknown,
 *   before?: unknown,
 *   after?: unknown,
 *   proposal_id?: unknown,
 *   request_id?: unknown,
 *   created_at?: unknown,
 *   reason?: unknown,
 *   seed?: unknown,
 * }} input
 */
export function buildPendingApprovalProposal(input = {}) {
  const zero = {
    applied: /** @type {false} */ (false),
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };

  const draft = createDiffProposal(input);
  if (!draft.ok) {
    return { ...draft, ...zero };
  }

  const diff = generateDiff({
    resource_type: input.resource_type,
    before: input.before,
    after: input.after,
  });
  if (!diff.ok) {
    return { ...diff, ...zero };
  }

  const impact = generateImpactSummary({
    resource_type: input.resource_type,
    change_type: input.change_type,
    changed_fields: diff.changed_fields,
    resource_id: input.resource_id,
  });
  if (!impact.ok) {
    return { ...impact, ...zero };
  }

  const pending = markProposalPendingApproval({ proposal: draft.value });
  if (!pending.ok) {
    return { ...pending, ...zero };
  }

  const snapshot = buildProposalSnapshot({
    proposal: pending.value,
    diff: diff.value,
    impact: impact.value,
    reason: PHASE_A1_REASONS.PENDING_APPROVAL,
  });
  if (!snapshot.ok) {
    return { ...snapshot, ...zero };
  }

  return {
    ok: true,
    proposal: pending.value,
    diff: diff.value,
    impact: impact.value,
    snapshot: snapshot.value,
    status: PHASE_A1_STATUSES.PENDING_APPROVAL,
    reason: PHASE_A1_REASONS.PENDING_APPROVAL,
    ...zero,
  };
}

/**
 * Explicitly forbid apply in A1.
 * @param {unknown} [_input]
 */
export function applyProposal(_input) {
  return {
    ok: false,
    error: PHASE_A1_REASONS.APPLY_FORBIDDEN,
    reason: PHASE_A1_REASONS.APPLY_FORBIDDEN,
    applied: false,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  };
}

/** Alias matching ticket vocabulary. */
export function createApproveProposal(input) {
  return buildPendingApprovalProposal(input);
}
