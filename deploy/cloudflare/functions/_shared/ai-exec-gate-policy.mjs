/**
 * AI Execution Gate — Phase B3 policy / request validation (pure + B1 preflight).
 * Control SSOT remains B1 env evaluators. No DB flag/stop tables.
 */

import {
  PHASE_B_ACTION_TYPE,
  PHASE_B_CAPABILITY_KEYS,
  PHASE_B_EXECUTOR_PORTS,
  PHASE_B_TARGET_SERVICE,
  isPhaseBCapabilityAllowed,
  isPhaseBPortAllowed,
} from "./ai-exec-gate-capabilities.mjs";
import {
  evaluatePhaseB1Preflight,
  evaluatePhaseBFeatureFlag,
  isPhaseBEmergencyStopActive,
  detectGateEnvironment,
  PHASE_B_FEATURE_FLAG_KEY,
  PHASE_B_FEATURE_FLAG_STATE,
} from "./ai-exec-gate-flags.mjs";
import {
  parseHardCapUsd,
  resolvePhaseBHardCapUsd,
  PHASE_B_HARD_CAP_CURRENCY,
} from "./ai-exec-gate-budget.mjs";
import { sanitizeGateMetadata } from "./ai-exec-gate-redaction.mjs";
import {
  GATE_BLOCKED_REASON_SET,
  gateBlockedResult,
} from "./ai-exec-gate-types.mjs";

/** Server-fixed B3-only request estimate (USD). Not a live pipeline cost. Client never trusted. B4+ replaces with real estimator. */
export const PHASE_B3_FIXED_REQUEST_ESTIMATE_USD = 0.01;

/** @deprecated alias — use PHASE_B3_FIXED_REQUEST_ESTIMATE_USD */
export const PHASE_B_PIPELINE_ESTIMATED_API_COST_USD =
  PHASE_B3_FIXED_REQUEST_ESTIMATE_USD;

export const PHASE_B_MAX_BODY_BYTES = 8 * 1024;
export const PHASE_B_MAX_METADATA_KEYS = 16;
export const PHASE_B_MAX_METADATA_STRING = 200;
export const PHASE_B_IDEMPOTENCY_MIN = 8;
export const PHASE_B_IDEMPOTENCY_MAX = 200;

/** Ordered pipeline capabilities (FREEZE / PLAN single-request pipeline). */
export const PHASE_B_PIPELINE_CAPABILITIES = Object.freeze([
  ...PHASE_B_CAPABILITY_KEYS,
]);

/** Ordered ports for the pipeline. */
export const PHASE_B_PIPELINE_PORTS = Object.freeze([...PHASE_B_EXECUTOR_PORTS]);

export const GATE_EVENT_TYPES = Object.freeze({
  REQUEST_RECEIVED: "request_received",
  GATE_EVALUATED: "gate_evaluated",
  REQUEST_ALLOWED: "request_allowed",
  REQUEST_BLOCKED: "request_blocked",
  /** @deprecated B3 stub — retained for historical rows */
  EXECUTE_STUB_ACCEPTED: "execute_stub_accepted",
  /** @deprecated B3 stub — retained for historical rows */
  EXECUTE_STUB_COMPLETED: "execute_stub_completed",
  EXECUTOR_CLAIMED: "executor_claimed",
  EXECUTION_STARTED: "execution_started",
  STEP_COLLECT_START: "step_collect_start",
  STEP_COLLECT_DONE: "step_collect_done",
  STEP_COLLECT_FAILED: "step_collect_failed",
  STEP_REPORT_START: "step_report_start",
  STEP_REPORT_DONE: "step_report_done",
  STEP_REPORT_FAILED: "step_report_failed",
  STEP_AUDIT_DONE: "step_audit_done",
  RESULT_PERSISTED: "result_persisted",
  EXECUTION_SUCCEEDED: "execution_succeeded",
  EXECUTION_FAILED: "execution_failed",
  BUDGET_GUARD_EVALUATED: "budget_guard_evaluated",
  BUDGET_GUARD_BLOCKED: "budget_guard_blocked",
  PROVIDER_RESOLVED: "provider_resolved",
  PROVIDER_PREPARE_DONE: "provider_prepare_done",
  EXECUTION_BOUNDARY_DISPATCHED: "execution_boundary_dispatched",
  PROVIDER_INVOCATION_DENIED: "provider_invocation_denied",
  USAGE_SNAPSHOT_LOADED: "usage_snapshot_loaded",
  USAGE_SNAPSHOT_UNAVAILABLE: "usage_snapshot_unavailable",
  PROVIDER_INVOCATION_DRY_RUN: "provider_invocation_dry_run",
});

/** B4 executor failure codes — separate from B1 Gate blocked reasons. */
export const EXECUTOR_FAILURE_CODES = Object.freeze({
  EXECUTION_NOT_FOUND: "execution_not_found",
  EXECUTION_NOT_ALLOWED: "execution_not_allowed",
  EXECUTION_NOT_QUEUED: "execution_not_queued",
  EXECUTION_ALREADY_CLAIMED: "execution_already_claimed",
  EXECUTION_ALREADY_COMPLETED: "execution_already_completed",
  EXECUTION_FAILED_TERMINAL: "execution_failed_terminal",
  CLAIM_FAILED: "claim_failed",
  COLLECTOR_FAILED: "collector_failed",
  REPORT_GENERATION_FAILED: "report_generation_failed",
  RESULT_PERSIST_FAILED: "result_persist_failed",
  EVENT_PERSIST_FAILED: "event_persist_failed",
  EXECUTION_TIMEOUT: "execution_timeout",
  INVALID_EXECUTION_CONTRACT: "invalid_execution_contract",
  FORBIDDEN: "forbidden",
  INTERNAL_ERROR: "internal_error",
  BUDGET_HARD_CAP: "budget_hard_cap",
  USAGE_SNAPSHOT_UNAVAILABLE: "usage_snapshot_unavailable",
  UNKNOWN_PROVIDER: "unknown_provider",
  PROVIDER_RESOLVE_FAILED: "provider_resolve_failed",
});

/** B4 overall timeout (ms) — deterministic pipeline must finish inside Pages request. */
export const PHASE_B4_EXECUTOR_TIMEOUT_MS = 10_000;

/**
 * JST calendar day key YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
export function budgetDayKeyJst(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/**
 * @param {unknown} key
 * @returns {{ ok: true, key: string } | { ok: false, error: string }}
 */
export function validateIdempotencyKey(key) {
  if (typeof key !== "string") {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  const k = key.trim();
  if (k.length < PHASE_B_IDEMPOTENCY_MIN || k.length > PHASE_B_IDEMPOTENCY_MAX) {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  if (/\s/.test(k)) {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  return { ok: true, key: k };
}

/**
 * @param {unknown} capabilities
 * @returns {{ ok: true, capabilities: string[] } | { ok: false, error: string }}
 */
export function validatePipelineCapabilities(capabilities) {
  if (!Array.isArray(capabilities)) {
    return { ok: false, error: "invalid_capabilities" };
  }
  if (capabilities.length !== PHASE_B_PIPELINE_CAPABILITIES.length) {
    return { ok: false, error: "invalid_capabilities" };
  }
  for (let i = 0; i < PHASE_B_PIPELINE_CAPABILITIES.length; i += 1) {
    if (capabilities[i] !== PHASE_B_PIPELINE_CAPABILITIES[i]) {
      return { ok: false, error: "invalid_capabilities" };
    }
    if (!isPhaseBCapabilityAllowed(capabilities[i])) {
      return { ok: false, error: "invalid_capabilities" };
    }
  }
  const uniq = new Set(capabilities);
  if (uniq.size !== capabilities.length) {
    return { ok: false, error: "invalid_capabilities" };
  }
  return { ok: true, capabilities: [...capabilities] };
}

/**
 * @param {unknown} ports
 * @returns {{ ok: true, ports: string[] } | { ok: false, error: string }}
 */
export function validatePipelinePorts(ports) {
  if (!Array.isArray(ports)) {
    return { ok: false, error: "invalid_ports" };
  }
  if (ports.length !== PHASE_B_PIPELINE_PORTS.length) {
    return { ok: false, error: "invalid_ports" };
  }
  for (let i = 0; i < PHASE_B_PIPELINE_PORTS.length; i += 1) {
    if (ports[i] !== PHASE_B_PIPELINE_PORTS[i]) {
      return { ok: false, error: "invalid_ports" };
    }
    if (!isPhaseBPortAllowed(ports[i])) {
      return { ok: false, error: "invalid_ports" };
    }
  }
  return { ok: true, ports: [...ports] };
}

/**
 * @param {unknown} metadata
 * @returns {{ ok: true, metadata: Record<string, unknown> } | { ok: false, error: string }}
 */
export function validateAndSanitizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return { ok: true, metadata: {} };
  }
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ok: false, error: "invalid_metadata" };
  }
  const keys = Object.keys(metadata);
  if (keys.length > PHASE_B_MAX_METADATA_KEYS) {
    return { ok: false, error: "invalid_metadata" };
  }
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v === "string" && v.length > PHASE_B_MAX_METADATA_STRING) {
      return { ok: false, error: "invalid_metadata" };
    }
    if (v !== null && typeof v === "object") {
      return { ok: false, error: "invalid_metadata" };
    }
  }
  return { ok: true, metadata: sanitizeGateMetadata(metadata) };
}

/**
 * Canonical create fingerprint fields (for payload_hash / idempotency mismatch).
 * @param {{
 *   actionType: string,
 *   targetService: string,
 *   capabilities: string[],
 *   ports: string[],
 * }} input
 */
export function buildCreateFingerprint(input) {
  return {
    action_type: input.actionType,
    target_service: input.targetService,
    capabilities: [...input.capabilities],
    requested_ports: [...input.ports],
  };
}

/**
 * Stable JSON for hashing (sorted keys at top level only).
 * @param {Record<string, unknown>} obj
 */
export function stableStringify(obj) {
  const keys = Object.keys(obj).sort();
  const ordered = {};
  for (const k of keys) ordered[k] = obj[k];
  return JSON.stringify(ordered);
}

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node fallback for unit tests
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Validate create body (after JSON parse). Rejects client cost / spoof fields.
 * @param {unknown} body
 */
export function validateCreateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_request" };
  }
  const b = /** @type {Record<string, unknown>} */ (body);

  if (b.estimated_api_cost != null || b.estimatedApiCost != null) {
    return { ok: false, error: "client_estimate_forbidden" };
  }
  if (b.role != null || b.is_ops != null || b.isOps != null) {
    return { ok: false, error: "spoofed_role_forbidden" };
  }

  const actionType =
    b.action_type != null
      ? b.action_type
      : b.action != null
        ? b.action
        : PHASE_B_ACTION_TYPE;
  if (actionType !== PHASE_B_ACTION_TYPE) {
    return { ok: false, error: "action_not_allowed" };
  }

  const targetService =
    b.target_service != null
      ? b.target_service
      : b.service != null
        ? b.service
        : PHASE_B_TARGET_SERVICE;
  if (targetService !== PHASE_B_TARGET_SERVICE) {
    return { ok: false, error: "service_not_allowed" };
  }

  const idem = validateIdempotencyKey(b.idempotency_key ?? b.idempotencyKey);
  if (!idem.ok) return idem;

  const caps = validatePipelineCapabilities(
    b.capabilities ?? PHASE_B_PIPELINE_CAPABILITIES
  );
  if (!caps.ok) return caps;

  const ports = validatePipelinePorts(
    b.requested_ports ?? b.ports ?? PHASE_B_PIPELINE_PORTS
  );
  if (!ports.ok) return ports;

  const meta = validateAndSanitizeMetadata(b.metadata);
  if (!meta.ok) return meta;

  const correlationId = String(
    b.correlation_id ?? b.correlationId ?? ""
  ).trim();

  return {
    ok: true,
    idempotencyKey: idem.key,
    actionType: PHASE_B_ACTION_TYPE,
    targetService: PHASE_B_TARGET_SERVICE,
    capabilities: caps.capabilities,
    ports: ports.ports,
    metadata: meta.metadata,
    correlationId: correlationId || null,
    /** Entry capability stored on request row (pipeline start). */
    capabilityKey: PHASE_B_PIPELINE_CAPABILITIES[0],
  };
}

/**
 * Run B1 preflight for pipeline entry capability + first port.
 * @param {{
 *   env: Record<string, unknown>,
 *   capabilityKey: string,
 *   actionType: string,
 *   targetService: string,
 *   executorPort?: string,
 *   daySpentSoFar: number,
 *   estimatedApiCost?: number,
 * }} input
 */
export function evaluateCreateGatePolicy(input) {
  const estimatedApiCost =
    typeof input.estimatedApiCost === "number"
      ? input.estimatedApiCost
      : PHASE_B3_FIXED_REQUEST_ESTIMATE_USD;

  const result = evaluatePhaseB1Preflight({
    env: input.env,
    capabilityKey: input.capabilityKey,
    actionType: input.actionType,
    targetService: input.targetService,
    executorPort: input.executorPort,
    daySpentSoFar: input.daySpentSoFar,
    estimatedApiCost,
  });

  const environment = detectGateEnvironment(input.env);
  const emergencyStopActive = isPhaseBEmergencyStopActive(input.env);
  const flag = evaluatePhaseBFeatureFlag(input.env, environment);
  const capResolved = resolvePhaseBHardCapUsd(input.env);

  return {
    ...result,
    snapshots: {
      environment,
      emergencyStopActive,
      featureFlagKey: PHASE_B_FEATURE_FLAG_KEY,
      featureFlagState: flag.state || PHASE_B_FEATURE_FLAG_STATE,
      featureFlagEnabled: Boolean(flag.enabled),
      budgetCurrency: PHASE_B_HARD_CAP_CURRENCY,
      budgetLimitSnapshot:
        capResolved.ok && capResolved.value > 0 ? capResolved.value : null,
      estimatedApiCost,
      hardCapParseOk: capResolved.ok,
    },
  };
}

/**
 * @param {string|null|undefined} reason
 */
export function isKnownBlockedReason(reason) {
  return GATE_BLOCKED_REASON_SET.has(/** @type {string} */ (reason));
}

export {
  evaluatePhaseB1Preflight,
  detectGateEnvironment,
  parseHardCapUsd,
  sanitizeGateMetadata,
  gateBlockedResult,
  PHASE_B_ACTION_TYPE,
  PHASE_B_TARGET_SERVICE,
  PHASE_B_FEATURE_FLAG_KEY,
};
