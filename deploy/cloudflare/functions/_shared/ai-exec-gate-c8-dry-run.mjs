/**
 * AI Execution Gate — Phase C8 Provider Execute Dry-Run (simulation only).
 *
 * Receives ExecutionPlan (+ optional C6 invocation decision) and returns a
 * SimulationResult. NEVER calls ProviderAdapter.execute() / network / SDK.
 *
 * Invariants: executed=false · provider_called=false · transmit=false · cost=0
 */

import { validateProviderIdentifier } from "./ai-exec-gate-c4-provider.mjs";
import {
  deepFreeze,
  validateExecutionPlan,
} from "./ai-exec-gate-c5-execution-boundary.mjs";
import { PHASE_C6_DECISIONS } from "./ai-exec-gate-c6-invocation-gate.mjs";

export { deepFreeze };

export const PHASE_C8_SCHEMA_VERSION = "phase_c8.dry_run.v1";

export const PHASE_C8_REASONS = Object.freeze({
  DRY_RUN_SIMULATED: "dry_run_simulated",
  INVALID_SIMULATION_CONTEXT: "invalid_simulation_context",
  INVALID_SIMULATION_RESULT: "invalid_simulation_result",
  INVALID_SIMULATION_METADATA: "invalid_simulation_metadata",
  INVALID_PLAN: "invalid_plan",
  IMMUTABLE_VIOLATION: "immutable_violation",
  HASH_INVALID: "hash_invalid",
  EXECUTE_FORBIDDEN: "execute_forbidden",
});

/** Prepared-request hash allowlist — structural only · never prompt/body. */
const PREPARED_HASH_KEYS = Object.freeze([
  "schema_version",
  "purpose",
  "action",
  "environment",
  "provider_id",
  "port",
]);

const METADATA_ALLOWLIST = Object.freeze([
  "schema_version",
  "provider",
  "execution_id",
  "request_id",
  "budget_decision",
  "invocation_decision",
  "invocation_reason",
  "prepared_request_hash",
  "would_invoke",
  "executed",
  "provider_called",
  "transmit",
  "recorded_api_cost",
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deterministic FNV-1a 32-bit hex (no crypto / no dynamic import).
 * @param {string} text
 * @returns {string}
 */
export function fnv1aHex(text) {
  let h = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash prepared request structure without retaining prompt/body.
 * @param {unknown} prepared
 * @returns {{ ok: true, hash: string } | { ok: false, error: string }}
 */
export function hashPreparedRequest(prepared) {
  if (!isPlainObject(prepared)) {
    return { ok: false, error: PHASE_C8_REASONS.HASH_INVALID };
  }
  const o = /** @type {Record<string, unknown>} */ (prepared);
  /** @type {Record<string, unknown>} */
  const picked = {};
  for (const key of PREPARED_HASH_KEYS) {
    if (key in o) {
      const v = o[key];
      if (v != null && typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
        return { ok: false, error: PHASE_C8_REASONS.HASH_INVALID };
      }
      picked[key] = v;
    }
  }
  const canonical = JSON.stringify(picked);
  return { ok: true, hash: `fnv1a32:${fnv1aHex(canonical)}` };
}

/**
 * @param {unknown} meta
 */
export function validateSimulationMetadata(meta) {
  if (!isPlainObject(meta)) {
    return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_METADATA };
  }
  const o = /** @type {Record<string, unknown>} */ (meta);
  for (const key of Object.keys(o)) {
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !METADATA_ALLOWLIST.includes(key)
    ) {
      return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_METADATA };
    }
  }
  if (o.schema_version !== PHASE_C8_SCHEMA_VERSION) {
    return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_METADATA };
  }
  if (o.executed !== false || o.provider_called !== false || o.transmit !== false) {
    return { ok: false, error: PHASE_C8_REASONS.EXECUTE_FORBIDDEN };
  }
  if (o.recorded_api_cost !== 0) {
    return { ok: false, error: PHASE_C8_REASONS.EXECUTE_FORBIDDEN };
  }
  if (o.would_invoke !== false) {
    return { ok: false, error: PHASE_C8_REASONS.EXECUTE_FORBIDDEN };
  }
  if (typeof o.prepared_request_hash !== "string" || !o.prepared_request_hash) {
    return { ok: false, error: PHASE_C8_REASONS.HASH_INVALID };
  }
  if (!Object.isFrozen(o)) {
    return { ok: false, error: PHASE_C8_REASONS.IMMUTABLE_VIOLATION };
  }
  return { ok: true, value: o };
}

/**
 * @param {unknown} result
 */
export function validateSimulationResult(result) {
  if (!isPlainObject(result)) {
    return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_RESULT };
  }
  const o = /** @type {Record<string, unknown>} */ (result);
  const required = [
    "schema_version",
    "ok",
    "simulated",
    "executed",
    "provider_called",
    "transmit",
    "recorded_api_cost",
    "reason",
    "provider",
    "execution_id",
    "request_id",
    "metadata",
  ];
  for (const k of required) {
    if (!(k in o)) {
      return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_RESULT };
    }
  }
  if (o.schema_version !== PHASE_C8_SCHEMA_VERSION) {
    return { ok: false, error: PHASE_C8_REASONS.INVALID_SIMULATION_RESULT };
  }
  if (
    o.ok !== true ||
    o.simulated !== true ||
    o.executed !== false ||
    o.provider_called !== false ||
    o.transmit !== false ||
    o.recorded_api_cost !== 0
  ) {
    return { ok: false, error: PHASE_C8_REASONS.EXECUTE_FORBIDDEN };
  }
  if (!Object.isFrozen(o)) {
    return { ok: false, error: PHASE_C8_REASONS.IMMUTABLE_VIOLATION };
  }
  const meta = validateSimulationMetadata(o.metadata);
  if (!meta.ok) return meta;
  return { ok: true, value: o };
}

/**
 * Build SimulationContext (immutable · allowlisted).
 * @param {{
 *   plan: unknown,
 *   invocation?: unknown,
 *   envelope_transmit?: unknown,
 * }} input
 */
export function buildSimulationContext(input = {}) {
  const planCheck = validateExecutionPlan(input.plan);
  if (!planCheck.ok) {
    return {
      ok: false,
      error: PHASE_C8_REASONS.INVALID_PLAN,
      reason: PHASE_C8_REASONS.INVALID_PLAN,
    };
  }
  const plan = planCheck.value;
  const idCheck = validateProviderIdentifier(plan.provider);
  if (!idCheck.ok) {
    return {
      ok: false,
      error: PHASE_C8_REASONS.INVALID_SIMULATION_CONTEXT,
      reason: PHASE_C8_REASONS.INVALID_SIMULATION_CONTEXT,
    };
  }

  const inv =
    input.invocation && typeof input.invocation === "object"
      ? /** @type {Record<string, unknown>} */ (input.invocation)
      : null;

  const ctx = deepFreeze({
    schema_version: PHASE_C8_SCHEMA_VERSION,
    plan,
    provider: idCheck.value,
    execution_id: String(plan.execution_id),
    request_id: String(plan.request_id),
    budget_decision:
      plan.budget_decision && typeof plan.budget_decision === "object"
        ? /** @type {Record<string, unknown>} */ (plan.budget_decision).decision ??
          null
        : null,
    invocation_decision:
      inv && typeof inv.decision === "string" ? inv.decision : null,
    invocation_reason:
      inv && typeof inv.reason === "string" ? inv.reason : null,
    envelope_transmit: input.envelope_transmit === true ? true : false,
    executed: false,
    provider_called: false,
    recorded_api_cost: 0,
  });

  return { ok: true, value: ctx };
}

/**
 * DryRunExecutor — simulate provider execute without calling it.
 *
 * @param {{
 *   plan: unknown,
 *   invocation?: unknown,
 *   envelope?: unknown,
 * }} input
 */
export function runDryRunSimulation(input = {}) {
  const ctxBuilt = buildSimulationContext({
    plan: input.plan,
    invocation: input.invocation,
    envelope_transmit:
      input.envelope &&
      typeof input.envelope === "object" &&
      /** @type {Record<string, unknown>} */ (input.envelope).transmit === true,
  });
  if (!ctxBuilt.ok) return ctxBuilt;

  const ctx = ctxBuilt.value;
  if (ctx.envelope_transmit === true) {
    return {
      ok: false,
      error: PHASE_C8_REASONS.EXECUTE_FORBIDDEN,
      reason: PHASE_C8_REASONS.EXECUTE_FORBIDDEN,
    };
  }

  const plan = /** @type {Record<string, unknown>} */ (ctx.plan);
  const hash = hashPreparedRequest(plan.prepared_request);
  if (!hash.ok) {
    return {
      ok: false,
      error: hash.error,
      reason: hash.error,
    };
  }

  const metadata = deepFreeze({
    schema_version: PHASE_C8_SCHEMA_VERSION,
    provider: ctx.provider,
    execution_id: ctx.execution_id,
    request_id: ctx.request_id,
    budget_decision: ctx.budget_decision,
    invocation_decision: ctx.invocation_decision,
    invocation_reason: ctx.invocation_reason,
    prepared_request_hash: hash.hash,
    would_invoke: false,
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
  });

  const metaCheck = validateSimulationMetadata(metadata);
  if (!metaCheck.ok) return metaCheck;

  const result = deepFreeze({
    schema_version: PHASE_C8_SCHEMA_VERSION,
    ok: true,
    simulated: true,
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
    reason: PHASE_C8_REASONS.DRY_RUN_SIMULATED,
    provider: ctx.provider,
    execution_id: ctx.execution_id,
    request_id: ctx.request_id,
    metadata,
    // Future execute compatibility: explicit non-execution markers
    invoke: false,
    would_call_adapter_execute: false,
  });

  const validated = validateSimulationResult(result);
  if (!validated.ok) return validated;

  return {
    ok: true,
    context: ctx,
    result: validated.value,
    provider_called: false,
    recorded_api_cost: 0,
    executed: false,
    transmit: false,
  };
}

/**
 * Alias matching ticket vocabulary.
 * @param {{ plan: unknown, invocation?: unknown, envelope?: unknown }} input
 */
export function executeDryRun(input) {
  return runDryRunSimulation(input);
}

/**
 * Sanitized event metadata (no prepared request body / secrets).
 * @param {unknown} dryRunOutcome
 */
export function sanitizeDryRunEventMetadata(dryRunOutcome) {
  const o =
    dryRunOutcome && typeof dryRunOutcome === "object"
      ? /** @type {Record<string, unknown>} */ (dryRunOutcome)
      : {};
  const r =
    o.result && typeof o.result === "object"
      ? /** @type {Record<string, unknown>} */ (o.result)
      : {};
  const m =
    r.metadata && typeof r.metadata === "object"
      ? /** @type {Record<string, unknown>} */ (r.metadata)
      : {};

  return deepFreeze({
    schema_version: PHASE_C8_SCHEMA_VERSION,
    simulated: true,
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
    would_invoke: false,
    reason: typeof r.reason === "string" ? r.reason : PHASE_C8_REASONS.DRY_RUN_SIMULATED,
    provider: typeof r.provider === "string" ? r.provider : null,
    prepared_request_hash:
      typeof m.prepared_request_hash === "string"
        ? m.prepared_request_hash
        : null,
    invocation_decision:
      typeof m.invocation_decision === "string"
        ? m.invocation_decision
        : null,
    invocation_reason:
      typeof m.invocation_reason === "string" ? m.invocation_reason : null,
    budget_decision:
      typeof m.budget_decision === "string" ? m.budget_decision : null,
  });
}

// Re-export decision constant for tests asserting C6 pairing
export { PHASE_C6_DECISIONS };
