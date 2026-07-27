/**
 * AI Execution Gate — Phase B1 types / reason codes (pure · no I/O)
 * SSOT: docs/AI/AI_EXECUTION_GATE_PHASE_B_PLAN.md · TICKETS B1
 */

/** @typedef {"staging"|"production"|"unknown"} GateEnvironment */

/** @typedef {"allowed"|"blocked"} GateDecision */

/**
 * Deterministic blocked reasons (B1).
 * @typedef {(
 *   | "wrong_environment"
 *   | "emergency_stop"
 *   | "feature_disabled"
 *   | "capability_not_allowed"
 *   | "action_not_allowed"
 *   | "service_not_allowed"
 *   | "port_not_allowed"
 *   | "budget_hard_cap"
 *   | "invalid_configuration"
 * )} GateBlockedReason
 */

export const GATE_ENVIRONMENTS = Object.freeze({
  STAGING: "staging",
  PRODUCTION: "production",
  UNKNOWN: "unknown",
});

export const GATE_DECISIONS = Object.freeze({
  ALLOWED: "allowed",
  BLOCKED: "blocked",
});

/** @type {ReadonlyArray<GateBlockedReason>} */
export const GATE_BLOCKED_REASONS = Object.freeze([
  "wrong_environment",
  "emergency_stop",
  "feature_disabled",
  "capability_not_allowed",
  "action_not_allowed",
  "service_not_allowed",
  "port_not_allowed",
  "budget_hard_cap",
  "invalid_configuration",
]);

export const GATE_BLOCKED_REASON_SET = Object.freeze(
  new Set(GATE_BLOCKED_REASONS)
);

/**
 * Feature flag logical states (design catalog). Phase B flag is staging_only.
 */
export const GATE_FEATURE_FLAG_STATES = Object.freeze({
  DISABLED: "disabled",
  STAGING_ONLY: "staging_only",
  INTERNAL_ONLY: "internal_only",
  BETA: "beta",
  ENABLED: "enabled",
});

/**
 * @param {GateBlockedReason|string|null|undefined} reason
 * @returns {reason is GateBlockedReason}
 */
export function isGateBlockedReason(reason) {
  return GATE_BLOCKED_REASON_SET.has(/** @type {string} */ (reason));
}

/**
 * @param {{ decision: GateDecision, reason?: GateBlockedReason|null, details?: Record<string, unknown> }} input
 */
export function gateAllowedResult(details = {}) {
  return Object.freeze({
    decision: GATE_DECISIONS.ALLOWED,
    reason: null,
    details: Object.freeze({ ...details }),
  });
}

/**
 * @param {GateBlockedReason} reason
 * @param {Record<string, unknown>} [details]
 */
export function gateBlockedResult(reason, details = {}) {
  if (!isGateBlockedReason(reason)) {
    return Object.freeze({
      decision: GATE_DECISIONS.BLOCKED,
      reason: /** @type {GateBlockedReason} */ ("invalid_configuration"),
      details: Object.freeze({ ...details, invalidReason: reason }),
    });
  }
  return Object.freeze({
    decision: GATE_DECISIONS.BLOCKED,
    reason,
    details: Object.freeze({ ...details }),
  });
}
