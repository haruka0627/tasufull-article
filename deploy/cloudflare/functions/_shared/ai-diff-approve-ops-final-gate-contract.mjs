/**
 * Diff & Approve — Staging Final Apply Gate + staging_simulation contract.
 * No real Apply / Provider. Proposal status stays approved.
 */

import { hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";
import {
  nfcTrim,
  normalizeUuid,
} from "./ai-diff-approve-ops-apply-plan-contract.mjs";

export const FINAL_GATE_SCHEMA = "diff_approve.ops.final_gate.v1";
export const EXEC_ATTEMPT_SCHEMA = "diff_approve.ops.execution_attempt.v1";

export const CONFIRMATION_PHRASE = "CONFIRM_STAGING_APPLY_GATE";

export const GATE_STATUSES = Object.freeze({
  APPLY_READY: "apply_ready",
  BLOCKED: "blocked",
});

export const EXEC_MODES = Object.freeze({
  STAGING_SIMULATION: "staging_simulation",
});

/** Avoid names that imply real provider success. */
export const EXEC_STATUSES = Object.freeze({
  PREPARED: "prepared",
  SIMULATED: "simulated",
  FAILED: "failed",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
});

export const GATE_ERRORS = Object.freeze({
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  INVALID_UUID: "invalid_uuid",
  INVALID_VERSION: "invalid_expected_version",
  INVALID_IDEMPOTENCY_KEY: "invalid_idempotency_key",
  INVALID_CONFIRMATION: "invalid_confirmation",
  INVALID_STATUS: "INVALID_STATUS",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  STALE_PLAN: "STALE_PLAN",
  TAMPER_DETECTED: "TAMPER_DETECTED",
  ALREADY_APPLIED: "ALREADY_APPLIED",
  EXECUTION_IN_PROGRESS: "EXECUTION_IN_PROGRESS",
  CAPABILITY_BLOCKED: "CAPABILITY_BLOCKED",
  BUDGET_BLOCKED: "BUDGET_BLOCKED",
  APPROVAL_MISSING: "APPROVAL_MISSING",
  ENVIRONMENT_BLOCKED: "ENVIRONMENT_BLOCKED",
  PLAN_MISSING: "PLAN_MISSING",
  PLAN_BLOCKED: "PLAN_BLOCKED",
  FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",
  GATE_NOT_READY: "GATE_NOT_READY",
  APPLY_FORBIDDEN: "apply_forbidden",
  REAL_EXECUTION_UNAVAILABLE: "real_execution_unavailable",
  NOT_FOUND: "not_found",
  AUDIT_INVALID: "AUDIT_INVALID",
});

const GATE_BODY_KEYS = Object.freeze([
  "requestId",
  "expectedVersion",
  "idempotencyKey",
  "planId",
  "planFingerprint",
  "confirmationPhrase",
]);

const SIM_BODY_KEYS = Object.freeze([
  "requestId",
  "expectedVersion",
  "idempotencyKey",
  "gateId",
  "planId",
  "outcomeHint",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:~-]{8,128}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectDangerous(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: GATE_ERRORS.INVALID_CONTEXT, http: 400 };
  }
  const o = /** @type {Record<string, unknown>} */ (body);
  if (
    Object.prototype.hasOwnProperty.call(o, "__proto__") ||
    Object.prototype.hasOwnProperty.call(o, "prototype") ||
    Object.prototype.hasOwnProperty.call(o, "constructor")
  ) {
    return { ok: false, error: GATE_ERRORS.EXTRA_FIELDS, http: 400 };
  }
  return { ok: true, value: o };
}

/**
 * @param {unknown} body
 */
export function validateApplyGateInput(body) {
  const base = rejectDangerous(body);
  if (!base.ok) return base;
  const o = base.value;
  for (const k of Object.keys(o)) {
    if (!GATE_BODY_KEYS.includes(k)) {
      return { ok: false, error: GATE_ERRORS.EXTRA_FIELDS, http: 400 };
    }
  }
  const requestId = normalizeUuid(o.requestId);
  const planId = normalizeUuid(o.planId);
  if (!requestId || !planId) {
    return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
  }
  if (
    typeof o.expectedVersion !== "number" ||
    !Number.isInteger(o.expectedVersion) ||
    o.expectedVersion < 0
  ) {
    return { ok: false, error: GATE_ERRORS.INVALID_VERSION, http: 400 };
  }
  const idem =
    typeof o.idempotencyKey === "string" ? nfcTrim(o.idempotencyKey) : "";
  if (!IDEMPOTENCY_RE.test(idem) || CONTROL_RE.test(idem)) {
    return {
      ok: false,
      error: GATE_ERRORS.INVALID_IDEMPOTENCY_KEY,
      http: 400,
    };
  }
  const fp =
    typeof o.planFingerprint === "string" ? nfcTrim(o.planFingerprint) : "";
  if (fp.length < 8 || fp.length > 128) {
    return { ok: false, error: GATE_ERRORS.INVALID_CONTEXT, http: 400 };
  }
  const phrase =
    typeof o.confirmationPhrase === "string"
      ? nfcTrim(o.confirmationPhrase)
      : "";
  if (phrase !== CONFIRMATION_PHRASE) {
    return {
      ok: false,
      error: GATE_ERRORS.INVALID_CONFIRMATION,
      http: 400,
    };
  }
  const payloadHash = hashValue({
    requestId,
    expectedVersion: o.expectedVersion,
    planId,
    planFingerprint: fp,
    confirmationPhrase: CONFIRMATION_PHRASE,
  });
  return {
    ok: true,
    value: Object.freeze({
      schema_version: FINAL_GATE_SCHEMA,
      requestId,
      expectedVersion: o.expectedVersion,
      idempotencyKey: idem,
      planId,
      planFingerprint: fp,
      confirmationPhrase: CONFIRMATION_PHRASE,
      payloadHash,
    }),
  };
}

/**
 * @param {unknown} body
 */
export function validateSimulateExecutionInput(body) {
  const base = rejectDangerous(body);
  if (!base.ok) return base;
  const o = base.value;
  for (const k of Object.keys(o)) {
    if (!SIM_BODY_KEYS.includes(k)) {
      return { ok: false, error: GATE_ERRORS.EXTRA_FIELDS, http: 400 };
    }
  }
  const requestId = normalizeUuid(o.requestId);
  const gateId = normalizeUuid(o.gateId);
  const planId = normalizeUuid(o.planId);
  if (!requestId || !gateId || !planId) {
    return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
  }
  if (
    typeof o.expectedVersion !== "number" ||
    !Number.isInteger(o.expectedVersion) ||
    o.expectedVersion < 0
  ) {
    return { ok: false, error: GATE_ERRORS.INVALID_VERSION, http: 400 };
  }
  const idem =
    typeof o.idempotencyKey === "string" ? nfcTrim(o.idempotencyKey) : "";
  if (!IDEMPOTENCY_RE.test(idem) || CONTROL_RE.test(idem)) {
    return {
      ok: false,
      error: GATE_ERRORS.INVALID_IDEMPOTENCY_KEY,
      http: 400,
    };
  }
  let outcomeHint = "ok";
  if (o.outcomeHint != null) {
    outcomeHint = nfcTrim(String(o.outcomeHint));
    if (!["ok", "transient_fail", "permanent_fail"].includes(outcomeHint)) {
      return { ok: false, error: GATE_ERRORS.INVALID_CONTEXT, http: 400 };
    }
  }
  const payloadHash = hashValue({
    requestId,
    expectedVersion: o.expectedVersion,
    gateId,
    planId,
    mode: EXEC_MODES.STAGING_SIMULATION,
    outcomeHint,
  });
  return {
    ok: true,
    value: Object.freeze({
      schema_version: EXEC_ATTEMPT_SCHEMA,
      requestId,
      expectedVersion: o.expectedVersion,
      idempotencyKey: idem,
      gateId,
      planId,
      outcomeHint,
      mode: EXEC_MODES.STAGING_SIMULATION,
      payloadHash,
    }),
  };
}

/**
 * @param {{ environment: string, actorId: string, requestId: string, idempotencyKey: string, op: string }} parts
 */
export function buildGateIdempotencyKey(parts) {
  const env = nfcTrim(parts.environment).slice(0, 32) || "staging";
  const actor = nfcTrim(parts.actorId).slice(0, 64);
  const req = nfcTrim(parts.requestId).slice(0, 64);
  const client = nfcTrim(parts.idempotencyKey).slice(0, 128);
  const op = nfcTrim(parts.op).slice(0, 40) || "gate";
  const full = `fg:${env}:${actor}:${req}:${op}:${client}`;
  if (full.length <= 200) return full;
  const digest = hashValue({ full }) || "hash";
  return `fg:${env}:${op}:${digest}`.slice(0, 200);
}

/**
 * Classify simulation outcome without claiming real provider success.
 * @param {"ok"|"transient_fail"|"permanent_fail"} hint
 */
export function classifySimulationOutcome(hint) {
  if (hint === "transient_fail") {
    return Object.freeze({
      status: EXEC_STATUSES.FAILED,
      errorCode: "SIMULATED_TRANSIENT_FAILURE",
      errorMessage: "staging_simulation_transient_failure",
      retryable: true,
      retryReason: "simulated_transient",
      maxAttempts: 3,
      nextAttemptNotScheduled: true,
      rollbackAvailable: false,
      rollbackStrategy: "none",
      rollbackPreconditions: Object.freeze(["no_provider_mutation"]),
      rollbackNotExecuted: true,
      providerExecuted: false,
      applyExecuted: false,
    });
  }
  if (hint === "permanent_fail") {
    return Object.freeze({
      status: EXEC_STATUSES.FAILED,
      errorCode: "SIMULATED_PERMANENT_FAILURE",
      errorMessage: "staging_simulation_permanent_failure",
      retryable: false,
      retryReason: "simulated_permanent",
      maxAttempts: 1,
      nextAttemptNotScheduled: true,
      rollbackAvailable: false,
      rollbackStrategy: "none",
      rollbackPreconditions: Object.freeze(["no_provider_mutation"]),
      rollbackNotExecuted: true,
      providerExecuted: false,
      applyExecuted: false,
    });
  }
  return Object.freeze({
    status: EXEC_STATUSES.SIMULATED,
    errorCode: null,
    errorMessage: null,
    retryable: false,
    retryReason: "not_needed",
    maxAttempts: 1,
    nextAttemptNotScheduled: true,
    rollbackAvailable: false,
    rollbackStrategy: "none",
    rollbackPreconditions: Object.freeze(["no_provider_mutation"]),
    rollbackNotExecuted: true,
    providerExecuted: false,
    applyExecuted: false,
  });
}

/**
 * @param {string} raw
 */
export function normalizeGateError(raw) {
  const s = String(raw || "").trim();
  const map = {
    stale_version: GATE_ERRORS.VERSION_CONFLICT,
    VERSION_CONFLICT: GATE_ERRORS.VERSION_CONFLICT,
    IDEMPOTENCY_CONFLICT: GATE_ERRORS.IDEMPOTENCY_CONFLICT,
    STALE_PLAN: GATE_ERRORS.STALE_PLAN,
    FINGERPRINT_MISMATCH: GATE_ERRORS.FINGERPRINT_MISMATCH,
    TAMPER_DETECTED: GATE_ERRORS.TAMPER_DETECTED,
    ALREADY_APPLIED: GATE_ERRORS.ALREADY_APPLIED,
    EXECUTION_IN_PROGRESS: GATE_ERRORS.EXECUTION_IN_PROGRESS,
    invalid_status: GATE_ERRORS.INVALID_STATUS,
    INVALID_STATUS: GATE_ERRORS.INVALID_STATUS,
    apply_forbidden: GATE_ERRORS.APPLY_FORBIDDEN,
    GATE_NOT_READY: GATE_ERRORS.GATE_NOT_READY,
    PLAN_MISSING: GATE_ERRORS.PLAN_MISSING,
    PLAN_BLOCKED: GATE_ERRORS.PLAN_BLOCKED,
    AUDIT_INVALID: GATE_ERRORS.AUDIT_INVALID,
  };
  return map[s] || s || "internal_error";
}

/**
 * @param {string} code
 */
export function gateErrorHttp(code) {
  const c = normalizeGateError(code);
  if (
    c === GATE_ERRORS.VERSION_CONFLICT ||
    c === GATE_ERRORS.IDEMPOTENCY_CONFLICT
  ) {
    return 409;
  }
  if (c === GATE_ERRORS.NOT_FOUND) return 404;
  if (
    c === "ops_required" ||
    c === "production_forbidden" ||
    c === GATE_ERRORS.ENVIRONMENT_BLOCKED ||
    c === GATE_ERRORS.APPLY_FORBIDDEN ||
    c === GATE_ERRORS.REAL_EXECUTION_UNAVAILABLE
  ) {
    return 403;
  }
  if (c === "auth_required" || c === "invalid_token") return 401;
  if (c === "db_unavailable") return 503;
  return 400;
}

export { nfcTrim, normalizeUuid, UUID_RE };
