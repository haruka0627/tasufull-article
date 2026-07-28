/**
 * Diff & Approve — Phase A9 Audit Timeline (pure · immutable).
 */

import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";

export { deepFreeze };

export const PHASE_A9_SCHEMA_VERSION = "diff_approve.a9.audit_timeline.v1";

export const PHASE_A9_EVENTS = Object.freeze([
  "proposal_created",
  "proposal_submitted",
  "approval_requested",
  "approval_granted",
  "approval_rejected",
  "revision_requested",
  "apply_readiness_evaluated",
  "apply_plan_created",
  "apply_validated",
  "simulation_started",
  "simulation_completed",
  "simulation_failed",
  "rollback_simulated",
  "final_apply_gate_evaluated",
]);

export const PHASE_A9_EVENT_SET = Object.freeze(new Set(PHASE_A9_EVENTS));

export const PHASE_A9_REASONS = Object.freeze({
  OK: "ok",
  UNKNOWN_EVENT: "unknown_event",
  DUPLICATE_EVENT: "duplicate_event",
  OUT_OF_ORDER: "out_of_order",
  INVALID_TIMESTAMP: "invalid_timestamp",
  PROPOSAL_MISMATCH: "proposal_mismatch",
  EXTRA_FIELDS: "extra_fields",
  INVALID_CONTEXT: "invalid_context",
  IMMUTABLE_VIOLATION: "immutable_violation",
});

const EVENT_ALLOWLIST = Object.freeze([
  "schema_version",
  "event_id",
  "event_type",
  "proposal_id",
  "execution_id",
  "timestamp",
  "sequence",
  "payload",
]);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

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

/**
 * @param {unknown} event
 */
export function validateTimelineEvent(event) {
  if (!isPlainObject(event) || !Object.isFrozen(event)) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_A9_REASONS.IMMUTABLE_VIOLATION,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (event);
  if (!rejectExtraKeys(Object.keys(o), EVENT_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.EXTRA_FIELDS,
      reason: PHASE_A9_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.schema_version !== PHASE_A9_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.INVALID_CONTEXT,
      reason: PHASE_A9_REASONS.INVALID_CONTEXT,
    };
  }
  if (typeof o.event_type !== "string" || !PHASE_A9_EVENT_SET.has(o.event_type)) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.UNKNOWN_EVENT,
      reason: PHASE_A9_REASONS.UNKNOWN_EVENT,
    };
  }
  if (typeof o.timestamp !== "string" || !ISO_RE.test(o.timestamp)) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.INVALID_TIMESTAMP,
      reason: PHASE_A9_REASONS.INVALID_TIMESTAMP,
    };
  }
  if (
    typeof o.sequence !== "number" ||
    !Number.isInteger(o.sequence) ||
    o.sequence < 0
  ) {
    return {
      ok: false,
      error: PHASE_A9_REASONS.INVALID_CONTEXT,
      reason: PHASE_A9_REASONS.INVALID_CONTEXT,
    };
  }
  return { ok: true, value: o };
}

/**
 * @param {Record<string, unknown>} fields
 */
export function buildTimelineEvent(fields) {
  const event = deepFreeze({
    schema_version: PHASE_A9_SCHEMA_VERSION,
    event_id: String(fields.event_id || ""),
    event_type: fields.event_type,
    proposal_id: fields.proposal_id == null ? null : String(fields.proposal_id),
    execution_id:
      fields.execution_id == null ? null : String(fields.execution_id),
    timestamp: String(fields.timestamp || "1970-01-01T00:00:00.000Z"),
    sequence: Number(fields.sequence) || 0,
    payload: isPlainObject(fields.payload)
      ? deepFreeze({ .../** @type {object} */ (fields.payload) })
      : deepFreeze({}),
  });
  return validateTimelineEvent(event);
}

export function createAuditTimeline() {
  /** @type {Readonly<Record<string, unknown>>[]} */
  const events = [];
  /** @type {Set<string>} */
  const ids = new Set();

  return {
    /**
     * @param {unknown} event
     */
    append(event) {
      const checked = validateTimelineEvent(event);
      if (!checked.ok) return checked;
      const e = checked.value;
      const eid = String(e.event_id || "");
      if (!eid || ids.has(eid)) {
        return {
          ok: false,
          error: PHASE_A9_REASONS.DUPLICATE_EVENT,
          reason: PHASE_A9_REASONS.DUPLICATE_EVENT,
        };
      }
      if (events.length > 0) {
        const prev = events[events.length - 1];
        if (
          /** @type {number} */ (e.sequence) <=
          /** @type {number} */ (prev.sequence)
        ) {
          return {
            ok: false,
            error: PHASE_A9_REASONS.OUT_OF_ORDER,
            reason: PHASE_A9_REASONS.OUT_OF_ORDER,
          };
        }
        if (
          prev.proposal_id &&
          e.proposal_id &&
          prev.proposal_id !== e.proposal_id
        ) {
          return {
            ok: false,
            error: PHASE_A9_REASONS.PROPOSAL_MISMATCH,
            reason: PHASE_A9_REASONS.PROPOSAL_MISMATCH,
          };
        }
      }
      ids.add(eid);
      events.push(e);
      return { ok: true, value: e, reason: PHASE_A9_REASONS.OK };
    },

    list() {
      return Object.freeze([...events]);
    },

    size() {
      return events.length;
    },
  };
}
