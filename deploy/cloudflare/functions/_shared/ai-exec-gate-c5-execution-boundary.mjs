/**
 * AI Execution Gate — Phase C5 execution boundary (plan · envelope · dispatcher).
 *
 * Completes the pre-execute pipeline. Does NOT call ProviderAdapter.execute().
 * provider_called=false · recorded_api_cost=0 · no network · no SDK · no secrets.
 *
 * Reuses C1 prepared request · C3 budget decision · C4 provider resolve metadata.
 */

import { PHASE_C4_ADAPTER_STATUS } from "./ai-exec-gate-c4-provider.mjs";
import { validateProviderIdentifier } from "./ai-exec-gate-c4-provider.mjs";

export const PHASE_C5_SCHEMA_VERSION = "phase_c5.execution_boundary.v1";

export const PHASE_C5_ERROR_CODES = Object.freeze({
  INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
  INVALID_EXECUTION_ENVELOPE: "INVALID_EXECUTION_ENVELOPE",
  INVALID_EXECUTION_METADATA: "INVALID_EXECUTION_METADATA",
  INVALID_EXECUTION_CONTEXT: "INVALID_EXECUTION_CONTEXT",
  DISPATCH_FORBIDDEN_EXECUTE: "DISPATCH_FORBIDDEN_EXECUTE",
  IMMUTABLE_VIOLATION: "IMMUTABLE_VIOLATION",
});

export const PHASE_C5_REASONS = Object.freeze({
  BOUNDARY_NOOP_STOP: "boundary_noop_stop",
  PROVIDER_EXECUTE_NOT_WIRED: "provider_execute_not_wired",
  BUDGET_BLOCKED_SHORT_CIRCUIT: "budget_blocked_short_circuit",
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deep-freeze for plan/envelope immutability (acyclic trees only).
 * @param {object} obj
 */
export function deepFreeze(obj) {
  if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
  for (const key of Object.keys(obj)) {
    const v = /** @type {Record<string, unknown>} */ (obj)[key];
    if (v && typeof v === "object") deepFreeze(v);
  }
  return Object.freeze(obj);
}

/**
 * @param {unknown} meta
 * @returns {{ ok: true, value: Readonly<Record<string, unknown>> } | { ok: false, error: string }}
 */
export function validateExecutionMetadata(meta) {
  if (!isPlainObject(meta)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_METADATA };
  }
  const o = /** @type {Record<string, unknown>} */ (meta);
  const allow = new Set([
    "port",
    "provider_id",
    "adapter_status",
    "provider_called",
    "recorded_api_cost",
    "schema_version",
    "purpose",
    "action",
    "environment",
  ]);
  for (const key of Object.keys(o)) {
    if (!allow.has(key)) {
      return {
        ok: false,
        error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_METADATA,
      };
    }
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor"
    ) {
      return {
        ok: false,
        error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_METADATA,
      };
    }
  }
  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return {
      ok: false,
      error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_METADATA,
    };
  }
  if (typeof o.provider_id === "string") {
    const id = validateProviderIdentifier(o.provider_id);
    if (!id.ok) {
      return {
        ok: false,
        error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_METADATA,
      };
    }
  }
  return { ok: true, value: Object.freeze({ ...o }) };
}

/**
 * ExecutionContext — runtime ids only (no secrets).
 * @param {{
 *   execution_id: unknown,
 *   request_id?: unknown,
 *   correlation_id?: unknown,
 *   actor_id?: unknown,
 *   budget_day_key?: unknown,
 * }} input
 */
export function buildExecutionContext(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_CONTEXT };
  }
  const execution_id = String(input.execution_id || "").trim();
  if (!execution_id) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_CONTEXT };
  }
  const ctx = deepFreeze({
    schema_version: PHASE_C5_SCHEMA_VERSION,
    execution_id,
    request_id:
      input.request_id == null ? execution_id : String(input.request_id),
    correlation_id:
      input.correlation_id == null ? null : String(input.correlation_id),
    actor_id: input.actor_id == null ? null : String(input.actor_id),
    budget_day_key:
      input.budget_day_key == null ? null : String(input.budget_day_key),
  });
  return { ok: true, value: ctx };
}

/**
 * Build immutable ExecutionPlan.
 * @param {{
 *   context: Record<string, unknown>,
 *   provider_id: string,
 *   prepared_request: unknown,
 *   budget_decision: unknown,
 *   metadata: Record<string, unknown>,
 * }} input
 */
export function buildExecutionPlan(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  const ctx = buildExecutionContext(input.context || {});
  if (!ctx.ok) return ctx;

  const idCheck = validateProviderIdentifier(input.provider_id);
  if (!idCheck.ok) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  if (!isPlainObject(input.prepared_request)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  if (!isPlainObject(input.budget_decision)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  const meta = validateExecutionMetadata(input.metadata || {});
  if (!meta.ok) return meta;

  const budget = /** @type {Record<string, unknown>} */ (input.budget_decision);
  if (budget.provider_called === true || budget.recorded_api_cost !== 0) {
    // Budget decision from C3 always has these; tolerate missing and force zeros in plan copy.
  }

  const plan = deepFreeze({
    schema_version: PHASE_C5_SCHEMA_VERSION,
    provider: idCheck.value,
    prepared_request: input.prepared_request,
    budget_decision: Object.freeze({
      decision: budget.decision,
      reason: budget.reason,
      blocked: Boolean(budget.blocked),
      warning: Boolean(budget.warning),
      remaining: budget.remaining,
      budget_limit: budget.budget_limit,
      current_usage: budget.current_usage,
      provider_called: false,
      recorded_api_cost: 0,
    }),
    metadata: meta.value,
    request_id: ctx.value.request_id,
    execution_id: ctx.value.execution_id,
    correlation_id: ctx.value.correlation_id,
    provider_called: false,
    recorded_api_cost: 0,
  });

  const validated = validateExecutionPlan(plan);
  if (!validated.ok) return validated;
  return { ok: true, value: validated.value };
}

/**
 * @param {unknown} plan
 */
export function validateExecutionPlan(plan) {
  if (!isPlainObject(plan)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  const o = /** @type {Record<string, unknown>} */ (plan);
  const required = [
    "schema_version",
    "provider",
    "prepared_request",
    "budget_decision",
    "metadata",
    "request_id",
    "execution_id",
  ];
  for (const k of required) {
    if (!(k in o)) {
      return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
    }
  }
  if (o.schema_version !== PHASE_C5_SCHEMA_VERSION) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  const id = validateProviderIdentifier(o.provider);
  if (!id.ok) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  if (!isPlainObject(o.prepared_request) || !isPlainObject(o.budget_decision)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  const meta = validateExecutionMetadata(o.metadata);
  if (!meta.ok) return meta;
  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_PLAN };
  }
  if (!Object.isFrozen(o)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.IMMUTABLE_VIOLATION };
  }
  return { ok: true, value: o };
}

/**
 * Envelope holds what would be sent to a provider — never transmitted in C5.
 * @param {Readonly<Record<string, unknown>>} plan
 */
export function buildExecutionEnvelope(plan) {
  const v = validateExecutionPlan(plan);
  if (!v.ok) return v;
  const p = v.value;
  const envelope = deepFreeze({
    schema_version: PHASE_C5_SCHEMA_VERSION,
    provider: p.provider,
    prepared_request: p.prepared_request,
    metadata: p.metadata,
    execution_id: p.execution_id,
    request_id: p.request_id,
    transmit: false,
    provider_called: false,
    recorded_api_cost: 0,
  });
  const checked = validateExecutionEnvelope(envelope);
  if (!checked.ok) return checked;
  return { ok: true, value: checked.value };
}

/**
 * @param {unknown} envelope
 */
export function validateExecutionEnvelope(envelope) {
  if (!isPlainObject(envelope)) {
    return {
      ok: false,
      error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_ENVELOPE,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (envelope);
  if (o.transmit !== false) {
    return {
      ok: false,
      error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_ENVELOPE,
    };
  }
  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return {
      ok: false,
      error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_ENVELOPE,
    };
  }
  if (!Object.isFrozen(o)) {
    return { ok: false, error: PHASE_C5_ERROR_CODES.IMMUTABLE_VIOLATION };
  }
  const id = validateProviderIdentifier(o.provider);
  if (!id.ok) {
    return {
      ok: false,
      error: PHASE_C5_ERROR_CODES.INVALID_EXECUTION_ENVELOPE,
    };
  }
  return { ok: true, value: o };
}

/**
 * @param {{
 *   plan: Readonly<Record<string, unknown>>,
 *   envelope: Readonly<Record<string, unknown>>,
 *   reason?: string,
 * }} input
 */
export function buildExecutionResult(input) {
  const reason = input.reason || PHASE_C5_REASONS.BOUNDARY_NOOP_STOP;
  return deepFreeze({
    schema_version: PHASE_C5_SCHEMA_VERSION,
    ok: true,
    dispatched: true,
    executed: false,
    status: PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
    reason,
    provider: input.plan.provider,
    execution_id: input.plan.execution_id,
    request_id: input.plan.request_id,
    provider_called: false,
    recorded_api_cost: 0,
    envelope_transmit: false,
    summary: null,
    priorities: Object.freeze([]),
  });
}

/**
 * ExecutionDispatcher — builds envelope + non-execution result.
 * NEVER calls ProviderAdapter.execute() / network / SDK.
 *
 * @param {{
 *   plan: unknown,
 * }} input
 */
export function dispatchExecutionPlan(input) {
  const planCheck = validateExecutionPlan(input?.plan);
  if (!planCheck.ok) return planCheck;

  const plan = planCheck.value;
  if (plan.budget_decision && /** @type {any} */ (plan.budget_decision).blocked) {
    return {
      ok: false,
      error: PHASE_C5_REASONS.BUDGET_BLOCKED_SHORT_CIRCUIT,
    };
  }

  const envelope = buildExecutionEnvelope(plan);
  if (!envelope.ok) return envelope;

  const result = buildExecutionResult({
    plan,
    envelope: envelope.value,
    reason: PHASE_C5_REASONS.PROVIDER_EXECUTE_NOT_WIRED,
  });

  return {
    ok: true,
    plan,
    envelope: envelope.value,
    result,
    provider_called: false,
    recorded_api_cost: 0,
  };
}

/**
 * Sanitized metadata for audit events.
 * @param {Readonly<Record<string, unknown>>} dispatchResult
 */
export function sanitizeExecutionBoundaryMetadata(dispatchResult) {
  const r = dispatchResult?.result || {};
  return Object.freeze({
    schema_version: PHASE_C5_SCHEMA_VERSION,
    provider: r.provider || null,
    executed: false,
    dispatched: true,
    status: r.status || PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
    reason: r.reason || PHASE_C5_REASONS.BOUNDARY_NOOP_STOP,
    provider_called: false,
    recorded_api_cost: 0,
    envelope_transmit: false,
  });
}
