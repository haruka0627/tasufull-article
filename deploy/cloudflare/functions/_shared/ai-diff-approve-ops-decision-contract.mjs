/**
 * Diff & Approve — Staging Operator Decision Write contract (no Apply).
 *
 * Maps operator actions onto existing A1/A2 status vocabulary:
 *   propose  : draft → pending_approval   (user term "proposed")
 *   approve  : pending_approval → approved
 *   reject   : pending_approval → rejected
 *   cancel   : pending_approval → cancelled
 *
 * Apply / provider / queue / production remain forbidden.
 */

import { hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";

export const DECISION_WRITE_SCHEMA = "diff_approve.ops.decision_write.v1";

export const DECISION_ACTIONS = Object.freeze({
  PROPOSE: "propose",
  APPROVE: "approve",
  REJECT: "reject",
  CANCEL: "cancel",
});

export const DECISION_ACTION_SET = Object.freeze(
  new Set(Object.values(DECISION_ACTIONS))
);

/** Existing A1 status vocabulary (+ cancelled terminal for operator cancel). */
export const DECISION_STATUSES = Object.freeze({
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  REVISION_REQUESTED: "revision_requested",
  EXPIRED: "expired",
  APPLYING: "applying",
  APPLIED: "applied",
  APPLY_FAILED: "apply_failed",
});

export const DECISION_EVENTS = Object.freeze({
  PROPOSAL_SUBMITTED: "proposal_submitted",
  APPROVAL_GRANTED: "approval_granted",
  APPROVAL_REJECTED: "approval_rejected",
  APPROVAL_CANCELLED: "approval_cancelled",
});

/** Allowed edges for this foundation only (no applying/applied). */
export const DECISION_TRANSITIONS = Object.freeze({
  [DECISION_ACTIONS.PROPOSE]: Object.freeze({
    from: DECISION_STATUSES.DRAFT,
    to: DECISION_STATUSES.PENDING_APPROVAL,
    event: DECISION_EVENTS.PROPOSAL_SUBMITTED,
  }),
  [DECISION_ACTIONS.APPROVE]: Object.freeze({
    from: DECISION_STATUSES.PENDING_APPROVAL,
    to: DECISION_STATUSES.APPROVED,
    event: DECISION_EVENTS.APPROVAL_GRANTED,
  }),
  [DECISION_ACTIONS.REJECT]: Object.freeze({
    from: DECISION_STATUSES.PENDING_APPROVAL,
    to: DECISION_STATUSES.REJECTED,
    event: DECISION_EVENTS.APPROVAL_REJECTED,
  }),
  [DECISION_ACTIONS.CANCEL]: Object.freeze({
    from: DECISION_STATUSES.PENDING_APPROVAL,
    to: DECISION_STATUSES.CANCELLED,
    event: DECISION_EVENTS.APPROVAL_CANCELLED,
  }),
});

export const DECISION_ERROR = Object.freeze({
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  UNKNOWN_ACTION: "unknown_action",
  INVALID_UUID: "invalid_uuid",
  INVALID_VERSION: "invalid_expected_version",
  INVALID_IDEMPOTENCY_KEY: "invalid_idempotency_key",
  INVALID_REASON: "invalid_reason",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  ALREADY_DECIDED: "ALREADY_DECIDED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  APPLY_FORBIDDEN: "apply_forbidden",
});

const ALLOWED_BODY_KEYS = Object.freeze([
  "requestId",
  "action",
  "expectedVersion",
  "idempotencyKey",
  "reason",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IDEMPOTENCY_RE = /^[A-Za-z0-9._:~-]{8,128}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_REASON = 500;

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} s
 */
export function nfcTrim(s) {
  return String(s || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {unknown} raw
 */
export function normalizeUuid(raw) {
  if (typeof raw !== "string") return null;
  const v = nfcTrim(raw).toLowerCase();
  if (!UUID_RE.test(v)) return null;
  return v;
}

/**
 * @param {unknown} status
 */
export function isTerminalDecisionStatus(status) {
  return (
    status === DECISION_STATUSES.APPROVED ||
    status === DECISION_STATUSES.REJECTED ||
    status === DECISION_STATUSES.CANCELLED ||
    status === DECISION_STATUSES.REVISION_REQUESTED ||
    status === DECISION_STATUSES.EXPIRED ||
    status === DECISION_STATUSES.APPLIED ||
    status === DECISION_STATUSES.APPLY_FAILED
  );
}

/**
 * Classify transition failure for HTTP mapping.
 * @param {string} action
 * @param {string} currentStatus
 */
export function classifyTransitionFailure(action, currentStatus) {
  const edge = DECISION_TRANSITIONS[action];
  if (!edge) {
    return {
      ok: false,
      error: DECISION_ERROR.UNKNOWN_ACTION,
      code: DECISION_ERROR.UNKNOWN_ACTION,
    };
  }
  if (currentStatus === edge.from) {
    return { ok: true, edge };
  }
  if (isTerminalDecisionStatus(currentStatus)) {
    return {
      ok: false,
      error: DECISION_ERROR.ALREADY_DECIDED,
      code: DECISION_ERROR.ALREADY_DECIDED,
      http: 409,
    };
  }
  return {
    ok: false,
    error: DECISION_ERROR.INVALID_STATE_TRANSITION,
    code: DECISION_ERROR.INVALID_STATE_TRANSITION,
    http: 409,
  };
}

/**
 * Validate operator decision write body (client fields only).
 * Actor / tenant / timestamps are never taken from the body.
 * @param {unknown} body
 */
export function validateDecisionWriteInput(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: DECISION_ERROR.INVALID_CONTEXT,
      http: 400,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (body);
  if (
    Object.prototype.hasOwnProperty.call(o, "__proto__") ||
    Object.prototype.hasOwnProperty.call(o, "prototype") ||
    Object.prototype.hasOwnProperty.call(o, "constructor")
  ) {
    return { ok: false, error: DECISION_ERROR.EXTRA_FIELDS, http: 400 };
  }
  const keys = Object.keys(o);
  for (const k of keys) {
    if (!ALLOWED_BODY_KEYS.includes(k)) {
      return { ok: false, error: DECISION_ERROR.EXTRA_FIELDS, http: 400 };
    }
  }

  const requestId = normalizeUuid(o.requestId);
  if (!requestId) {
    return { ok: false, error: DECISION_ERROR.INVALID_UUID, http: 400 };
  }

  const action =
    typeof o.action === "string" ? nfcTrim(o.action).toLowerCase() : "";
  if (!DECISION_ACTION_SET.has(action)) {
    return { ok: false, error: DECISION_ERROR.UNKNOWN_ACTION, http: 400 };
  }

  if (
    typeof o.expectedVersion !== "number" ||
    !Number.isInteger(o.expectedVersion) ||
    o.expectedVersion < 0
  ) {
    return { ok: false, error: DECISION_ERROR.INVALID_VERSION, http: 400 };
  }

  const idemRaw =
    typeof o.idempotencyKey === "string" ? nfcTrim(o.idempotencyKey) : "";
  if (!IDEMPOTENCY_RE.test(idemRaw) || CONTROL_RE.test(idemRaw)) {
    return {
      ok: false,
      error: DECISION_ERROR.INVALID_IDEMPOTENCY_KEY,
      http: 400,
    };
  }

  let reason = null;
  if (o.reason != null) {
    if (typeof o.reason !== "string") {
      return { ok: false, error: DECISION_ERROR.INVALID_REASON, http: 400 };
    }
    const r = nfcTrim(o.reason);
    if (CONTROL_RE.test(r) || r.length > MAX_REASON) {
      return { ok: false, error: DECISION_ERROR.INVALID_REASON, http: 400 };
    }
    reason = r.length ? r : null;
  }

  const edge = DECISION_TRANSITIONS[action];
  const payloadHashSource = {
    requestId,
    action,
    expectedVersion: o.expectedVersion,
    reason,
  };
  const payloadHash = hashValue(payloadHashSource);
  if (!payloadHash) {
    return { ok: false, error: DECISION_ERROR.INVALID_CONTEXT, http: 400 };
  }

  return {
    ok: true,
    value: Object.freeze({
      schema_version: DECISION_WRITE_SCHEMA,
      requestId,
      action,
      expectedVersion: o.expectedVersion,
      idempotencyKey: idemRaw,
      reason,
      fromStatus: edge.from,
      toStatus: edge.to,
      eventType: edge.event,
      payloadHash,
    }),
  };
}

/**
 * Build scoped idempotency key (no secrets).
 * Scope: environment · actor · request · operation · client key
 * @param {{
 *   environment: string,
 *   actorId: string,
 *   requestId: string,
 *   action: string,
 *   idempotencyKey: string,
 * }} parts
 */
export function buildScopedIdempotencyKey(parts) {
  const env = nfcTrim(parts.environment).slice(0, 32) || "staging";
  const actor = nfcTrim(parts.actorId).slice(0, 64);
  const req = nfcTrim(parts.requestId).slice(0, 64);
  const action = nfcTrim(parts.action).slice(0, 32);
  const client = nfcTrim(parts.idempotencyKey).slice(0, 128);
  // Keep within DB 8–200 constraint
  const full = `dw:${env}:${actor}:${req}:${action}:${client}`;
  if (full.length <= 200) return full;
  const digest = hashValue({ full }) || "hash";
  return `dw:${env}:${action}:${digest}`.slice(0, 200);
}

/**
 * Normalize RPC / adapter errors to stable API codes.
 * @param {string} raw
 */
export function normalizeDecisionError(raw) {
  const s = String(raw || "").trim();
  const map = {
    stale_version: DECISION_ERROR.VERSION_CONFLICT,
    VERSION_CONFLICT: DECISION_ERROR.VERSION_CONFLICT,
    invalid_transition: DECISION_ERROR.INVALID_STATE_TRANSITION,
    INVALID_STATE_TRANSITION: DECISION_ERROR.INVALID_STATE_TRANSITION,
    already_decided: DECISION_ERROR.ALREADY_DECIDED,
    ALREADY_DECIDED: DECISION_ERROR.ALREADY_DECIDED,
    duplicate_key: DECISION_ERROR.IDEMPOTENCY_CONFLICT,
    idempotency_conflict: DECISION_ERROR.IDEMPOTENCY_CONFLICT,
    IDEMPOTENCY_CONFLICT: DECISION_ERROR.IDEMPOTENCY_CONFLICT,
    apply_forbidden: DECISION_ERROR.APPLY_FORBIDDEN,
  };
  return map[s] || s || "internal_error";
}

/**
 * Pure transition check (unit-testable state machine).
 * @param {string} from
 * @param {string} action
 */
export function canTransition(from, action) {
  const edge = DECISION_TRANSITIONS[action];
  if (!edge) return false;
  return from === edge.from;
}
