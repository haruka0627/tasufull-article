/**
 * AI Execution Gate — Phase C3 cost controls (Budget / Hard Cap).
 *
 * FREEZE §10 · SAFE-06/07 as cost SSOT (no double ledger).
 * C3: code-constant hard cap only · no env overwrite · no provider · no SAFE DB writes.
 * estimated=0 · actual=0 while provider disconnected.
 */

import { PHASE_B_DEFAULT_HARD_CAP_USD } from "./ai-exec-gate-budget.mjs";

/** Align with B1 default hard cap — code constant SSOT for C3 (no env read). */
export const PHASE_C3_HARD_CAP_USD = PHASE_B_DEFAULT_HARD_CAP_USD;

export const PHASE_C3_HARD_CAP_CURRENCY = "USD";

/** Soft warning when usage/limit >= this ratio (still may execute if not over hard cap). */
export const PHASE_C3_WARNING_RATIO = 0.8;

/** Provider disconnected in C3 — fixed zeros (SAFE-06/07 recording deferred). */
export const PHASE_C3_ESTIMATED_USD = 0;
export const PHASE_C3_ACTUAL_USD = 0;

export const PHASE_C3_DECISIONS = Object.freeze([
  "allowed",
  "warning",
  "blocked",
]);

export const PHASE_C3_REASONS = Object.freeze({
  WITHIN_BUDGET: "within_budget",
  APPROACHING_HARD_CAP: "approaching_hard_cap",
  BUDGET_HARD_CAP: "budget_hard_cap",
  INVALID_USAGE: "invalid_usage",
  INVALID_BUDGET: "invalid_budget",
  INVALID_LIMIT: "invalid_limit",
});

export const PHASE_C3_ERROR_CODES = Object.freeze({
  INVALID_USAGE: "INVALID_USAGE",
  INVALID_BUDGET: "INVALID_BUDGET",
  INVALID_LIMIT: "INVALID_LIMIT",
  BUDGET_HARD_CAP: "BUDGET_HARD_CAP",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
});

/**
 * Frozen BudgetPolicy (code constants only).
 * @returns {Readonly<{
 *   schema_version: string,
 *   hard_cap_usd: number,
 *   currency: string,
 *   warning_ratio: number,
 *   estimated_usd: number,
 *   actual_usd: number,
 *   provider_connected: false,
 *   safe06_write: false,
 *   safe07_write: false,
 * }>}
 */
export function getPhaseC3BudgetPolicy() {
  return Object.freeze({
    schema_version: "phase_c3.budget.v1",
    hard_cap_usd: PHASE_C3_HARD_CAP_USD,
    currency: PHASE_C3_HARD_CAP_CURRENCY,
    warning_ratio: PHASE_C3_WARNING_RATIO,
    estimated_usd: PHASE_C3_ESTIMATED_USD,
    actual_usd: PHASE_C3_ACTUAL_USD,
    provider_connected: false,
    safe06_write: false,
    safe07_write: false,
  });
}

/**
 * Validate non-negative finite number (reject NaN/Infinity/negative/non-number).
 * @param {unknown} value
 * @param {{ allowZero?: boolean }} [opts]
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
export function validateBudgetNumber(value, opts = {}) {
  if (typeof value !== "number") {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_USAGE };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_USAGE };
  }
  if (Number.isNaN(value)) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_USAGE };
  }
  if (value < 0) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_USAGE };
  }
  if (value > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_LIMIT };
  }
  if (opts.allowZero === false && value === 0) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_BUDGET };
  }
  return { ok: true, value };
}

/**
 * Validate hard-cap / budget_limit (must be positive finite).
 * @param {unknown} value
 */
export function validateBudgetLimit(value) {
  const n = validateBudgetNumber(value);
  if (!n.ok) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_BUDGET };
  }
  if (n.value <= 0) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_BUDGET };
  }
  return n;
}

/**
 * Build UsageSnapshot (internal accounting · not SAFE-06/07 write).
 * @param {{
 *   current_usage?: unknown,
 *   budget_limit?: unknown,
 *   estimated?: unknown,
 *   actual?: unknown,
 * }} [input]
 * @returns {{
 *   ok: true,
 *   snapshot: Readonly<Record<string, unknown>>,
 * } | {
 *   ok: false,
 *   error: string,
 * }}
 */
export function buildUsageSnapshot(input = {}) {
  const policy = getPhaseC3BudgetPolicy();
  const limitRaw =
    input.budget_limit === undefined ? policy.hard_cap_usd : input.budget_limit;
  const limit = validateBudgetLimit(limitRaw);
  if (!limit.ok) return limit;

  const usageRaw = input.current_usage;
  if (usageRaw === undefined) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.INVALID_USAGE };
  }
  const usage = validateBudgetNumber(usageRaw);
  if (!usage.ok) return usage;

  // C3 provider isolation: estimated/actual forced to 0 (ignore overrides that try to invent cost).
  const estimated = PHASE_C3_ESTIMATED_USD;
  const actual = PHASE_C3_ACTUAL_USD;

  const remaining = Math.max(0, limit.value - usage.value);
  const projected = usage.value + estimated;
  const blocked = projected > limit.value;

  return {
    ok: true,
    snapshot: Object.freeze({
      budget_limit: limit.value,
      current_usage: usage.value,
      remaining,
      blocked,
      reason: null,
      estimated,
      actual,
      currency: PHASE_C3_HARD_CAP_CURRENCY,
      provider_called: false,
      recorded_api_cost: 0,
    }),
  };
}

/**
 * Deterministic BudgetDecision.
 *
 * Rules (FREEZE-aligned):
 * - projected = current_usage + estimated (C3 estimated=0)
 * - projected > hard_cap → blocked (never auto-exceed)
 * - projected === hard_cap → allowed (equal allowed, same as B1)
 * - usage/limit >= warning_ratio and not blocked → warning
 * - else allowed
 *
 * @param {{
 *   current_usage?: unknown,
 *   budget_limit?: unknown,
 * }} [input]
 * @returns {{
 *   ok: true,
 *   decision: Readonly<Record<string, unknown>>,
 * } | {
 *   ok: false,
 *   error: string,
 * }}
 */
export function evaluateBudgetDecision(input = {}) {
  const built = buildUsageSnapshot(input);
  if (!built.ok) return built;

  const snap = built.snapshot;
  const limit = /** @type {number} */ (snap.budget_limit);
  const usage = /** @type {number} */ (snap.current_usage);
  const remaining = /** @type {number} */ (snap.remaining);
  const projected = usage + /** @type {number} */ (snap.estimated);

  /** @type {"allowed"|"warning"|"blocked"} */
  let decision;
  /** @type {string} */
  let reason;

  if (projected > limit) {
    decision = "blocked";
    reason = PHASE_C3_REASONS.BUDGET_HARD_CAP;
  } else if (limit > 0 && usage / limit >= PHASE_C3_WARNING_RATIO) {
    decision = "warning";
    reason = PHASE_C3_REASONS.APPROACHING_HARD_CAP;
  } else {
    decision = "allowed";
    reason = PHASE_C3_REASONS.WITHIN_BUDGET;
  }

  const raw = {
    allowed: decision !== "blocked",
    warning: decision === "warning",
    blocked: decision === "blocked",
    decision,
    reason,
    remaining,
    budget_limit: limit,
    current_usage: usage,
    estimated: PHASE_C3_ESTIMATED_USD,
    actual: PHASE_C3_ACTUAL_USD,
    currency: PHASE_C3_HARD_CAP_CURRENCY,
    provider_called: false,
    recorded_api_cost: 0,
  };

  const validated = validateBudgetDecisionOutput(raw);
  if (!validated.ok) return validated;
  return { ok: true, decision: validated.value };
}

/**
 * Fail-closed output allowlist for BudgetDecision.
 * @param {unknown} value
 */
export function validateBudgetDecisionOutput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  const o = /** @type {Record<string, unknown>} */ (value);
  const allow = new Set([
    "allowed",
    "warning",
    "blocked",
    "decision",
    "reason",
    "remaining",
    "budget_limit",
    "current_usage",
    "estimated",
    "actual",
    "currency",
    "provider_called",
    "recorded_api_cost",
  ]);
  const forbiddenExact = new Set([
    "password",
    "secret",
    "token",
    "authorization",
    "api_key",
    "stack",
    "provider",
    "sdk",
    "model",
    "diagnostics",
  ]);
  for (const key of Object.keys(o)) {
    if (!allow.has(key)) {
      return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    if (forbiddenExact.has(key.toLowerCase())) {
      return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }

  if (!PHASE_C3_DECISIONS.includes(/** @type {string} */ (o.decision))) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (typeof o.allowed !== "boolean" || typeof o.blocked !== "boolean") {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.estimated !== 0 || o.actual !== 0) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.currency !== PHASE_C3_HARD_CAP_CURRENCY) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  for (const k of ["remaining", "budget_limit", "current_usage"]) {
    const n = validateBudgetNumber(o[k]);
    if (!n.ok) {
      return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }
  if (typeof o.reason !== "string" || !o.reason) {
    return { ok: false, error: PHASE_C3_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }

  return {
    ok: true,
    value: Object.freeze({ ...o }),
  };
}

/**
 * BudgetState aggregate for persist/audit (no secrets).
 * @param {Readonly<Record<string, unknown>>} decision
 */
export function buildBudgetState(decision) {
  const v = validateBudgetDecisionOutput(decision);
  if (!v.ok) return v;
  const d = v.value;
  return {
    ok: true,
    state: Object.freeze({
      decision: d.decision,
      reason: d.reason,
      remaining: d.remaining,
      budget_limit: d.budget_limit,
      current_usage: d.current_usage,
      blocked: d.blocked,
      provider_called: false,
      recorded_api_cost: 0,
    }),
  };
}

/**
 * Sanitize decision for API/event metadata (cap value not required on client;
 * remaining/limit allowed for ops server responses — never hard-cap env key).
 * @param {Readonly<Record<string, unknown>>} decision
 */
export function sanitizeBudgetDecisionForResponse(decision) {
  const v = validateBudgetDecisionOutput(decision);
  if (!v.ok) return null;
  const d = v.value;
  return Object.freeze({
    allowed: d.allowed,
    warning: d.warning,
    blocked: d.blocked,
    decision: d.decision,
    reason: d.reason,
    remaining: d.remaining,
    budget_limit: d.budget_limit,
    current_usage: d.current_usage,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

/**
 * Execute-path budget guard (no provider).
 * @param {{
 *   current_usage?: unknown,
 *   budget_limit?: unknown,
 * }} [input]
 */
export function evaluatePhaseC3BudgetGuard(input = {}) {
  return evaluateBudgetDecision(input);
}
