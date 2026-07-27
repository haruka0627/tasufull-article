/**
 * AI Execution Gate — Phase C6 Controlled Provider Invocation Gate.
 *
 * Provider-neutral · fail-closed · always deny invoke in C6.
 * NO network · NO SDK · NO fetch · NO process.env · NO credentials ·
 * NO adapter.execute · NO dynamic import.
 *
 * Reuses C4 provider id validation · C5 plan/envelope immutability.
 * Design Freeze normal deny reason: provider_disabled (not a new synonym).
 */

import { validateProviderIdentifier } from "./ai-exec-gate-c4-provider.mjs";
import {
  deepFreeze,
  validateExecutionEnvelope,
  validateExecutionPlan,
  PHASE_C5_REASONS,
} from "./ai-exec-gate-c5-execution-boundary.mjs";

export const PHASE_C6_SCHEMA_VERSION = "phase_c6.invocation_gate.v1";

/** Decision vocabulary — `allowed` reserved for future; C6 never emits it. */
export const PHASE_C6_DECISIONS = Object.freeze({
  DENIED: "denied",
  ALLOWED: "allowed",
});

/**
 * Fail-closed reason vocabulary.
 * Normal C6 deny (policy flags off / Design Freeze): provider_disabled.
 * policy_disabled is an alias string equal to provider_disabled (single reason).
 */
export const PHASE_C6_REASONS = Object.freeze({
  PROVIDER_DISABLED: "provider_disabled",
  /** Alias — same string as PROVIDER_DISABLED; prefer PROVIDER_DISABLED. */
  POLICY_DISABLED: "provider_disabled",
  BUDGET_HARD_CAP: "budget_hard_cap",
  BUDGET_BLOCKED_SHORT_CIRCUIT: PHASE_C5_REASONS.BUDGET_BLOCKED_SHORT_CIRCUIT,
  UNKNOWN_PROVIDER: "unknown_provider",
  INVALID_PLAN: "invalid_plan",
  INVALID_ENVELOPE: "invalid_envelope",
  TRANSMIT_FORBIDDEN: "transmit_forbidden",
  EXECUTED_FORBIDDEN: "executed_forbidden",
  PROVIDER_CALLED_FORBIDDEN: "provider_called_forbidden",
  COST_NONZERO_FORBIDDEN: "cost_nonzero_forbidden",
  IMMUTABLE_VIOLATION: "immutable_violation",
  INVALID_CONTEXT: "invalid_context",
});

/**
 * Private frozen policy constants — used by evaluateInvocationGate.
 * Callers must not be able to mutate enablement via getInvocationPolicy() return value.
 */
const INTERNAL_INVOCATION_POLICY = deepFreeze({
  schema_version: PHASE_C6_SCHEMA_VERSION,
  provider_execution_enabled: false,
  network_transmission_enabled: false,
  credentials_enabled: false,
  actual_cost_recording_enabled: false,
});

/**
 * Public frozen policy snapshot (same values as internal).
 * Prefer getInvocationPolicy() for a defensive deep-frozen copy.
 */
export const PHASE_C6_INVOCATION_POLICY = deepFreeze({
  schema_version: PHASE_C6_SCHEMA_VERSION,
  provider_execution_enabled: false,
  network_transmission_enabled: false,
  credentials_enabled: false,
  actual_cost_recording_enabled: false,
});

/**
 * Deep-frozen defensive copy of invocation policy.
 * Mutations on the returned object do not affect gate evaluation.
 * @returns {Readonly<{
 *   schema_version: string,
 *   provider_execution_enabled: false,
 *   network_transmission_enabled: false,
 *   credentials_enabled: false,
 *   actual_cost_recording_enabled: false,
 * }>}
 */
export function getInvocationPolicy() {
  return deepFreeze({
    schema_version: INTERNAL_INVOCATION_POLICY.schema_version,
    provider_execution_enabled:
      INTERNAL_INVOCATION_POLICY.provider_execution_enabled,
    network_transmission_enabled:
      INTERNAL_INVOCATION_POLICY.network_transmission_enabled,
    credentials_enabled: INTERNAL_INVOCATION_POLICY.credentials_enabled,
    actual_cost_recording_enabled:
      INTERNAL_INVOCATION_POLICY.actual_cost_recording_enabled,
  });
}

/** InvocationContext allowlist (exact keys only). */
const CONTEXT_ALLOWLIST = Object.freeze([
  "schema_version",
  "provider_id",
  "plan",
  "envelope",
  "executed",
  "provider_called",
  "recorded_api_cost",
  "execution_id",
  "request_id",
]);

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
function isDangerousKey(value) {
  return (
    value === "__proto__" ||
    value === "prototype" ||
    value === "constructor"
  );
}

/**
 * Validate InvocationContext — allowlist only · immutable.
 * @param {unknown} ctx
 * @returns {{ ok: true, value: Readonly<Record<string, unknown>> } | { ok: false, error: string, reason: string }}
 */
export function validateInvocationContext(ctx) {
  if (!isPlainObject(ctx)) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (ctx);
  for (const key of Object.keys(o)) {
    if (isDangerousKey(key) || !CONTEXT_ALLOWLIST.includes(key)) {
      return {
        ok: false,
        error: PHASE_C6_REASONS.INVALID_CONTEXT,
        reason: PHASE_C6_REASONS.INVALID_CONTEXT,
      };
    }
  }
  if (o.schema_version != null && o.schema_version !== PHASE_C6_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (typeof o.provider_id !== "string") {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (!isPlainObject(o.plan) || !isPlainObject(o.envelope)) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  const executionId =
    o.execution_id == null ? "" : String(o.execution_id).trim();
  const requestId = o.request_id == null ? "" : String(o.request_id).trim();
  if (!executionId || !requestId) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (o.executed != null && typeof o.executed !== "boolean") {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (o.provider_called != null && typeof o.provider_called !== "boolean") {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (
    o.recorded_api_cost != null &&
    (typeof o.recorded_api_cost !== "number" ||
      !Number.isFinite(o.recorded_api_cost))
  ) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (!Object.isFrozen(o)) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.IMMUTABLE_VIOLATION,
      reason: PHASE_C6_REASONS.IMMUTABLE_VIOLATION,
    };
  }
  return { ok: true, value: o };
}

/**
 * Build immutable InvocationContext (allowlisted fields only).
 * @param {{
 *   provider_id: unknown,
 *   plan: unknown,
 *   envelope: unknown,
 *   executed?: unknown,
 *   provider_called?: unknown,
 *   recorded_api_cost?: unknown,
 *   execution_id?: unknown,
 *   request_id?: unknown,
 * }} input
 * @returns {{ ok: true, value: Readonly<Record<string, unknown>> } | { ok: false, error: string, reason: string }}
 */
export function buildInvocationContext(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  const src = /** @type {Record<string, unknown>} */ (input);
  for (const key of Object.keys(src)) {
    if (isDangerousKey(key) || !CONTEXT_ALLOWLIST.includes(key)) {
      return {
        ok: false,
        error: PHASE_C6_REASONS.INVALID_CONTEXT,
        reason: PHASE_C6_REASONS.INVALID_CONTEXT,
      };
    }
  }
  if (typeof src.provider_id !== "string") {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }
  if (!isPlainObject(src.plan) || !isPlainObject(src.envelope)) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }

  const plan = /** @type {Record<string, unknown>} */ (src.plan);
  const envelope = /** @type {Record<string, unknown>} */ (src.envelope);

  const execution_id = String(
    src.execution_id == null ? plan.execution_id ?? "" : src.execution_id
  ).trim();
  const request_id = String(
    src.request_id == null ? plan.request_id ?? "" : src.request_id
  ).trim();
  if (!execution_id || !request_id) {
    return {
      ok: false,
      error: PHASE_C6_REASONS.INVALID_CONTEXT,
      reason: PHASE_C6_REASONS.INVALID_CONTEXT,
    };
  }

  const ctx = deepFreeze({
    schema_version: PHASE_C6_SCHEMA_VERSION,
    provider_id: src.provider_id,
    plan,
    envelope,
    executed: src.executed === true,
    provider_called: src.provider_called === true,
    recorded_api_cost:
      typeof src.recorded_api_cost === "number" &&
      Number.isFinite(src.recorded_api_cost)
        ? src.recorded_api_cost
        : 0,
    execution_id,
    request_id,
  });

  return validateInvocationContext(ctx);
}

/**
 * @param {{
 *   provider_id?: string | null,
 *   reason: string,
 *   decision?: string,
 * }} partial
 * @returns {Readonly<Record<string, unknown>>}
 */
function deniedDecision(partial) {
  return deepFreeze({
    schema_version: PHASE_C6_SCHEMA_VERSION,
    decision: PHASE_C6_DECISIONS.DENIED,
    reason: partial.reason,
    invoke: false,
    provider_id: partial.provider_id == null ? null : partial.provider_id,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

/**
 * Controlled Provider Invocation Gate — always fail-closed.
 * Even a valid C5 plan/envelope yields denied + provider_disabled
 * because all policy enable flags are frozen false.
 *
 * Decision order (deterministic):
 * 1. invalid context
 * 2. unknown/invalid provider
 * 3. invalid/mutable plan
 * 4. invalid envelope / transmit !== false
 * 5. executed / provider_called / cost !== 0
 * 6. budget.blocked (read C3 decision; do not recalculate hard cap)
 * 7. any policy enable flag false → provider_disabled
 * 8. C6 always denied (never allowed)
 *
 * @param {{ context: unknown }} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function evaluateInvocationGate(input) {
  const rawCtx =
    input && typeof input === "object"
      ? /** @type {{ context?: unknown }} */ (input).context
      : null;

  const ctxCheck = validateInvocationContext(rawCtx);
  if (!ctxCheck.ok) {
    return deniedDecision({
      reason: ctxCheck.reason || PHASE_C6_REASONS.INVALID_CONTEXT,
      provider_id: null,
    });
  }
  const ctx = ctxCheck.value;
  const provider_id = /** @type {string} */ (ctx.provider_id);

  // 2. unknown / invalid provider (C4 allowlist — no duplicate enums)
  const idCheck = validateProviderIdentifier(provider_id);
  if (!idCheck.ok) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.UNKNOWN_PROVIDER,
      provider_id,
    });
  }

  // 3. invalid / mutable plan
  const planCheck = validateExecutionPlan(ctx.plan);
  if (!planCheck.ok) {
    const err = planCheck.error;
    const reason =
      err === "IMMUTABLE_VIOLATION"
        ? PHASE_C6_REASONS.IMMUTABLE_VIOLATION
        : PHASE_C6_REASONS.INVALID_PLAN;
    return deniedDecision({ reason, provider_id: idCheck.value });
  }
  const plan = planCheck.value;

  if (plan.provider !== idCheck.value) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.INVALID_PLAN,
      provider_id: idCheck.value,
    });
  }

  // 4. invalid envelope / transmit !== false
  const envelopeRaw = /** @type {Record<string, unknown>} */ (ctx.envelope);
  if (envelopeRaw.transmit !== false) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.TRANSMIT_FORBIDDEN,
      provider_id: idCheck.value,
    });
  }
  const envelopeCheck = validateExecutionEnvelope(ctx.envelope);
  if (!envelopeCheck.ok) {
    const err = envelopeCheck.error;
    const reason =
      err === "IMMUTABLE_VIOLATION"
        ? PHASE_C6_REASONS.IMMUTABLE_VIOLATION
        : PHASE_C6_REASONS.INVALID_ENVELOPE;
    return deniedDecision({ reason, provider_id: idCheck.value });
  }
  const envelope = envelopeCheck.value;

  // 5. executed / provider_called / cost !== 0
  if (ctx.executed === true) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.EXECUTED_FORBIDDEN,
      provider_id: idCheck.value,
    });
  }
  if (
    ctx.provider_called === true ||
    plan.provider_called === true ||
    envelope.provider_called === true
  ) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.PROVIDER_CALLED_FORBIDDEN,
      provider_id: idCheck.value,
    });
  }
  const costs = [
    ctx.recorded_api_cost,
    plan.recorded_api_cost,
    envelope.recorded_api_cost,
  ];
  for (const c of costs) {
    if (c !== 0 && c != null) {
      return deniedDecision({
        reason: PHASE_C6_REASONS.COST_NONZERO_FORBIDDEN,
        provider_id: idCheck.value,
      });
    }
  }

  // 6. budget.blocked — read C3 decision; do not recalculate hard cap
  const budget = /** @type {Record<string, unknown> | undefined} */ (
    plan.budget_decision
  );
  if (budget && budget.blocked === true) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.BUDGET_BLOCKED_SHORT_CIRCUIT,
      provider_id: idCheck.value,
    });
  }

  // 7. any policy enable flag false → provider_disabled (Design Freeze)
  // Internal constants only — ignore caller-mutated getInvocationPolicy() copies.
  const policy = INTERNAL_INVOCATION_POLICY;
  if (
    policy.provider_execution_enabled !== true ||
    policy.network_transmission_enabled !== true ||
    policy.credentials_enabled !== true ||
    policy.actual_cost_recording_enabled !== true
  ) {
    return deniedDecision({
      reason: PHASE_C6_REASONS.PROVIDER_DISABLED,
      provider_id: idCheck.value,
    });
  }

  // 8. C6 always denied (never allowed) — unreachable while flags are frozen false
  return deniedDecision({
    reason: PHASE_C6_REASONS.PROVIDER_DISABLED,
    provider_id: idCheck.value,
  });
}

/**
 * Audit snapshot for events — allowlisted fields only.
 * @param {Readonly<Record<string, unknown>> | unknown} decision
 * @returns {Readonly<{
 *   schema_version: string,
 *   provider_id: string | null,
 *   decision: string,
 *   reason: string,
 *   provider_called: false,
 *   recorded_api_cost: 0,
 * }>}
 */
export function buildInvocationAuditSnapshot(decision) {
  const d =
    decision && typeof decision === "object" && !Array.isArray(decision)
      ? /** @type {Record<string, unknown>} */ (decision)
      : {};
  return deepFreeze({
    schema_version: PHASE_C6_SCHEMA_VERSION,
    provider_id:
      typeof d.provider_id === "string" ? d.provider_id : null,
    decision:
      typeof d.decision === "string"
        ? d.decision
        : PHASE_C6_DECISIONS.DENIED,
    reason:
      typeof d.reason === "string"
        ? d.reason
        : PHASE_C6_REASONS.PROVIDER_DISABLED,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

/**
 * Sanitize decision / audit for event metadata (same allowlist as snapshot).
 * @param {unknown} decision
 */
export function sanitizeInvocationAuditMetadata(decision) {
  return buildInvocationAuditSnapshot(decision);
}
