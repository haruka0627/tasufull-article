/**
 * Diff & Approve — Staging Apply Plan / Dry-run contract (no Apply).
 * Plan is an immutable dry-run snapshot; request status stays approved.
 */

import { hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";

export const APPLY_PLAN_SCHEMA = "diff_approve.ops.apply_plan.v1";
export const APPLY_PLAN_POLICY_VERSION = "diff_approve.budget.policy.v1";

export const APPLY_PLAN_MODES = Object.freeze({
  DRY_RUN: "dry_run",
});

export const APPLY_PLAN_STATUSES = Object.freeze({
  READY: "ready",
  BLOCKED: "blocked",
});

export const APPLY_PLAN_ERRORS = Object.freeze({
  INVALID_CONTEXT: "invalid_context",
  EXTRA_FIELDS: "extra_fields",
  INVALID_UUID: "invalid_uuid",
  INVALID_VERSION: "invalid_expected_version",
  INVALID_IDEMPOTENCY_KEY: "invalid_idempotency_key",
  INVALID_MODE: "invalid_mode",
  INVALID_STATUS: "INVALID_STATUS",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  SOURCE_VERSION_CONFLICT: "SOURCE_VERSION_CONFLICT",
  PLAN_BLOCKED: "PLAN_BLOCKED",
  TAMPER_DETECTED: "TAMPER_DETECTED",
  CAPABILITY_DENIED: "CAPABILITY_DENIED",
  BUDGET_BLOCKED: "BUDGET_BLOCKED",
  UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
  AUDIT_INVALID: "AUDIT_INVALID",
  ALREADY_EXECUTED: "ALREADY_EXECUTED",
  APPLY_FORBIDDEN: "apply_forbidden",
  NOT_FOUND: "not_found",
});

const ALLOWED_BODY_KEYS = Object.freeze([
  "requestId",
  "expectedVersion",
  "idempotencyKey",
  "mode",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:~-]{8,128}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

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
 * @param {unknown} body
 */
export function validateApplyPlanInput(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_CONTEXT, http: 400 };
  }
  const o = /** @type {Record<string, unknown>} */ (body);
  if (
    Object.prototype.hasOwnProperty.call(o, "__proto__") ||
    Object.prototype.hasOwnProperty.call(o, "prototype") ||
    Object.prototype.hasOwnProperty.call(o, "constructor")
  ) {
    return { ok: false, error: APPLY_PLAN_ERRORS.EXTRA_FIELDS, http: 400 };
  }
  for (const k of Object.keys(o)) {
    if (!ALLOWED_BODY_KEYS.includes(k)) {
      return { ok: false, error: APPLY_PLAN_ERRORS.EXTRA_FIELDS, http: 400 };
    }
  }
  const requestId = normalizeUuid(o.requestId);
  if (!requestId) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_UUID, http: 400 };
  }
  if (
    typeof o.expectedVersion !== "number" ||
    !Number.isInteger(o.expectedVersion) ||
    o.expectedVersion < 0
  ) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_VERSION, http: 400 };
  }
  const idem =
    typeof o.idempotencyKey === "string" ? nfcTrim(o.idempotencyKey) : "";
  if (!IDEMPOTENCY_RE.test(idem) || CONTROL_RE.test(idem)) {
    return {
      ok: false,
      error: APPLY_PLAN_ERRORS.INVALID_IDEMPOTENCY_KEY,
      http: 400,
    };
  }
  const mode =
    o.mode == null ? APPLY_PLAN_MODES.DRY_RUN : nfcTrim(String(o.mode));
  if (mode !== APPLY_PLAN_MODES.DRY_RUN) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_MODE, http: 400 };
  }
  const payloadHash = hashValue({
    requestId,
    expectedVersion: o.expectedVersion,
    mode,
  });
  if (!payloadHash) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_CONTEXT, http: 400 };
  }
  return {
    ok: true,
    value: Object.freeze({
      schema_version: APPLY_PLAN_SCHEMA,
      requestId,
      expectedVersion: o.expectedVersion,
      idempotencyKey: idem,
      mode,
      payloadHash,
    }),
  };
}

/**
 * @param {{
 *   environment: string,
 *   actorId: string,
 *   requestId: string,
 *   idempotencyKey: string,
 * }} parts
 */
export function buildApplyPlanIdempotencyKey(parts) {
  const env = nfcTrim(parts.environment).slice(0, 32) || "staging";
  const actor = nfcTrim(parts.actorId).slice(0, 64);
  const req = nfcTrim(parts.requestId).slice(0, 64);
  const client = nfcTrim(parts.idempotencyKey).slice(0, 128);
  const full = `ap:${env}:${actor}:${req}:create_apply_plan:${client}`;
  if (full.length <= 200) return full;
  const digest = hashValue({ full }) || "hash";
  return `ap:${env}:create_apply_plan:${digest}`.slice(0, 200);
}

/**
 * Canonical fingerprint body (no timestamps / planId).
 * @param {Record<string, unknown>} parts
 */
export function buildApplyPlanFingerprint(parts) {
  const body = {
    environment: parts.environment || "staging",
    tenant: parts.tenant || "ops_global",
    requestId: parts.requestId,
    sourceVersion: parts.sourceVersion,
    proposalHash: parts.proposalHash,
    approvalHash: parts.approvalHash,
    capability: parts.capability,
    budgetPolicyVersion: parts.budgetPolicyVersion || APPLY_PLAN_POLICY_VERSION,
    planSchemaVersion: APPLY_PLAN_SCHEMA,
    operations: parts.operations || [],
    preconditions: parts.preconditions || [],
    warnings: parts.warnings || [],
    blockers: parts.blockers || [],
  };
  return hashValue(body);
}

/**
 * @param {string} raw
 */
export function normalizeApplyPlanError(raw) {
  const s = String(raw || "").trim();
  const map = {
    stale_version: APPLY_PLAN_ERRORS.VERSION_CONFLICT,
    VERSION_CONFLICT: APPLY_PLAN_ERRORS.VERSION_CONFLICT,
    duplicate_key: APPLY_PLAN_ERRORS.IDEMPOTENCY_CONFLICT,
    IDEMPOTENCY_CONFLICT: APPLY_PLAN_ERRORS.IDEMPOTENCY_CONFLICT,
    SOURCE_VERSION_CONFLICT: APPLY_PLAN_ERRORS.SOURCE_VERSION_CONFLICT,
    invalid_status: APPLY_PLAN_ERRORS.INVALID_STATUS,
    INVALID_STATUS: APPLY_PLAN_ERRORS.INVALID_STATUS,
    tamper_detected: APPLY_PLAN_ERRORS.TAMPER_DETECTED,
    TAMPER_DETECTED: APPLY_PLAN_ERRORS.TAMPER_DETECTED,
    audit_chain_mismatch: APPLY_PLAN_ERRORS.AUDIT_INVALID,
    AUDIT_INVALID: APPLY_PLAN_ERRORS.AUDIT_INVALID,
    apply_forbidden: APPLY_PLAN_ERRORS.APPLY_FORBIDDEN,
    already_executed: APPLY_PLAN_ERRORS.ALREADY_EXECUTED,
    ALREADY_EXECUTED: APPLY_PLAN_ERRORS.ALREADY_EXECUTED,
  };
  return map[s] || s || "internal_error";
}

/**
 * @param {string} code
 */
export function applyPlanErrorHttp(code) {
  const c = normalizeApplyPlanError(code);
  if (
    c === APPLY_PLAN_ERRORS.VERSION_CONFLICT ||
    c === APPLY_PLAN_ERRORS.IDEMPOTENCY_CONFLICT ||
    c === APPLY_PLAN_ERRORS.SOURCE_VERSION_CONFLICT
  ) {
    return 409;
  }
  if (c === APPLY_PLAN_ERRORS.NOT_FOUND) return 404;
  if (c === "ops_required" || c === "production_forbidden") return 403;
  if (c === "auth_required" || c === "invalid_token") return 401;
  if (c === "db_unavailable") return 503;
  return 400;
}
