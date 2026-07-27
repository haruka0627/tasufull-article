/**
 * AI Execution Gate — Phase C1 provider-neutral contracts & validators.
 * No provider · no network · no secrets. TypeScript not used (JSDoc + freeze).
 */

import { PHASE_B_ACTION_TYPE } from "./ai-exec-gate-capabilities.mjs";

export const PHASE_C1_SCHEMA_VERSION = "phase_c1.ops_summary.v1";
/** Design Freeze: purpose/action share Phase B action allowlist value. */
export const PHASE_C1_PURPOSE = PHASE_B_ACTION_TYPE;
export const PHASE_C1_ACTION = PHASE_B_ACTION_TYPE;
/** Provider-neutral validated result type (persist layer still uses ops_daily_report). */
export const PHASE_C1_OUTPUT_TYPE = "daily_operations_summary";
export const PHASE_C1_PERSIST_OUTPUT_TYPE = "ops_daily_report";

export const PHASE_C1_LIMITS = Object.freeze({
  MAX_COUNT: 1_000_000_000,
  MAX_WARNING_CODES: 32,
  MAX_WARNING_CODE_LENGTH: 64,
  MAX_SUMMARY_LENGTH: 4000,
  MAX_PRIORITIES: 8,
  MAX_PRIORITY_TEXT_LENGTH: 200,
  MAX_NESTED_DEPTH: 3,
  MAX_SERIALIZED_BYTES: 16_384,
  MAX_COUNT_FIELDS: 16,
  MAX_LIMITATIONS: 16,
  MAX_LIMITATION_LENGTH: 200,
  MAX_SOURCE_ERRORS: 16,
});

export const PHASE_C1_COUNT_KEYS = Object.freeze([
  "pending_total",
  "failed_total",
  "blocked_total",
  "warning_total",
  "support_pending_total",
  "moderation_pending_total",
  "anpi_pending_total",
  "execution_failed_total",
  "execution_blocked_total",
]);

export const PHASE_C1_SOURCE_STATUSES = Object.freeze([
  "available",
  "unavailable",
  "unsupported",
  "disabled",
]);

export const PHASE_C1_PRIORITIES = Object.freeze([
  "critical",
  "high",
  "medium",
  "low",
  "none",
]);

export const PHASE_C1_ERROR_CODES = Object.freeze({
  INVALID_COLLECTOR_INPUT: "INVALID_COLLECTOR_INPUT",
  UNSUPPORTED_PURPOSE: "UNSUPPORTED_PURPOSE",
  UNSUPPORTED_ACTION: "UNSUPPORTED_ACTION",
  SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  INVALID_SNAPSHOT: "INVALID_SNAPSHOT",
  INVALID_PROVIDER_REQUEST: "INVALID_PROVIDER_REQUEST",
  INVALID_ADAPTER_OUTPUT: "INVALID_ADAPTER_OUTPUT",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  INTERNAL_EXECUTION_ERROR: "INTERNAL_EXECUTION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_WARNING: "INVALID_WARNING",
  INVALID_LIMIT: "INVALID_LIMIT",
  UNKNOWN_SOURCE: "UNKNOWN_SOURCE",
  PROTOTYPE_POLLUTION: "PROTOTYPE_POLLUTION",
  REDACTION_REJECTED: "REDACTION_REJECTED",
  UNICODE_REJECTED: "UNICODE_REJECTED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
});

/** Keys never accepted on collector / request / output surfaces. */
export const PHASE_C1_PROHIBITED_KEYS = Object.freeze([
  "email",
  "phone",
  "name",
  "address",
  "raw_message",
  "chat_body",
  "message_body",
  "user_content",
  "payment",
  "card",
  "cvv",
  "iban",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "passwd",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "secret",
  "session",
  "credential",
  "private_key",
  "stack",
  "stack_trace",
  "prompt",
  "response",
  "sql",
  "user_id",
  "email_body",
  "anpi_answer_body",
  "bearer",
]);

const PROHIBITED_SET = new Set(
  PHASE_C1_PROHIBITED_KEYS.map((k) => k.toLowerCase())
);

const POLLUTION_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * @param {unknown} key
 */
export function isPhaseC1ProhibitedKey(key) {
  if (typeof key !== "string") return true;
  return PROHIBITED_SET.has(key.toLowerCase());
}

/**
 * @param {unknown} key
 */
export function isPhaseC1PollutionKey(key) {
  if (typeof key !== "string") return true;
  return POLLUTION_KEYS.has(key) || POLLUTION_KEYS.has(key.toLowerCase());
}

/**
 * @param {unknown} value
 * @param {{ allowNull?: boolean }} [opts]
 * @returns {{ ok: true, value: number|null } | { ok: false, error: string }}
 */
export function validateCountInteger(value, opts = {}) {
  if (value === null && opts.allowNull) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  if (value < 0 || value > PHASE_C1_LIMITS.MAX_COUNT) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  return { ok: true, value };
}

/**
 * @param {unknown} obj
 * @param {number} [depth]
 */
export function assertDepth(obj, depth = 0) {
  if (depth > PHASE_C1_LIMITS.MAX_NESTED_DEPTH) {
    return false;
  }
  if (!obj || typeof obj !== "object") return true;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item !== null && typeof item === "object") {
        if (!assertDepth(item, depth + 1)) return false;
      }
    }
    return true;
  }
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === "object") {
      if (!assertDepth(v, depth + 1)) return false;
    }
  }
  return true;
}

/**
 * UTF-8 byte length of JSON serialization (fail closed on throw).
 * @param {unknown} obj
 */
export function serializedByteLength(obj) {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Bounded opaque limitation strings (no raw dumps).
 * @param {unknown} list
 * @returns {{ ok: true, value: string[] } | { ok: false, error: string }}
 */
export function validateLimitationList(list) {
  if (!Array.isArray(list)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (list.length > PHASE_C1_LIMITS.MAX_LIMITATIONS) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  /** @type {string[]} */
  const out = [];
  for (const item of list) {
    if (typeof item !== "string") {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
    if (
      item.length === 0 ||
      item.length > PHASE_C1_LIMITS.MAX_LIMITATION_LENGTH ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(item) ||
      /@/.test(item) ||
      /password|token|authorization|api[_-]?key|bearer/i.test(item)
    ) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
    out.push(item);
  }
  return { ok: true, value: out };
}

/**
 * @param {unknown} list
 */
export function validateSourceErrorList(list) {
  if (!Array.isArray(list)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (list.length > PHASE_C1_LIMITS.MAX_SOURCE_ERRORS) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  const allow = new Set(Object.values(PHASE_C1_ERROR_CODES));
  for (const code of list) {
    if (typeof code !== "string" || !allow.has(code)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
  }
  return { ok: true, value: list };
}

/**
 * Reject unknown keys · prohibited keys · nested objects beyond allowlist.
 * @param {Record<string, unknown>} obj
 * @param {ReadonlyArray<string>|Set<string>} allowKeys
 */
export function rejectUnknownKeys(obj, allowKeys) {
  const allow = allowKeys instanceof Set ? allowKeys : new Set(allowKeys);
  for (const key of Object.keys(obj)) {
    if (isPhaseC1PollutionKey(key)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.PROTOTYPE_POLLUTION };
    }
    if (isPhaseC1ProhibitedKey(key)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
    }
    if (!allow.has(key)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, value: DailyOpsCollectorInput } | { ok: false, error: string }}
 */
export function validateDailyOpsCollectorInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  const o = /** @type {Record<string, unknown>} */ (input);
  const allow = new Set([
    "purpose",
    "action",
    "environment",
    "actor",
    "actor_id",
    "business_date_jst",
    "execution_id",
    "correlation_id",
  ]);
  const unk = rejectUnknownKeys(o, allow);
  if (!unk.ok) return unk;
  if (!assertDepth(o, 0)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  if (serializedByteLength(o) > PHASE_C1_LIMITS.MAX_SERIALIZED_BYTES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }

  const purpose = o.purpose == null ? PHASE_C1_PURPOSE : o.purpose;
  if (purpose !== PHASE_C1_PURPOSE) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.UNSUPPORTED_PURPOSE };
  }
  const action = o.action == null ? PHASE_C1_ACTION : o.action;
  if (action !== PHASE_C1_ACTION) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.UNSUPPORTED_ACTION };
  }
  const environment = o.environment == null ? "staging" : o.environment;
  if (environment !== "staging") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  if (typeof o.business_date_jst !== "string") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.business_date_jst)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  const actorRaw = o.actor != null ? o.actor : o.actor_id;
  if (actorRaw != null && typeof actorRaw !== "string") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
  }
  const actor = actorRaw == null ? null : actorRaw.slice(0, 128);

  return {
    ok: true,
    value: Object.freeze({
      purpose: PHASE_C1_PURPOSE,
      action: PHASE_C1_ACTION,
      environment: "staging",
      actor,
      business_date_jst: o.business_date_jst,
      execution_id:
        o.execution_id == null ? null : String(o.execution_id).slice(0, 64),
      correlation_id:
        o.correlation_id == null
          ? null
          : String(o.correlation_id).slice(0, 64),
    }),
  };
}

/**
 * @typedef {{
 *   purpose: string,
 *   action: string,
 *   environment: string,
 *   actor: string|null,
 *   business_date_jst: string,
 *   execution_id: string|null,
 *   correlation_id: string|null,
 * }} DailyOpsCollectorInput
 */

/**
 * Validate sanitized snapshot after collector.
 * @param {unknown} snap
 */
export function validateDailyOpsSanitizedSnapshot(snap) {
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  const o = /** @type {Record<string, unknown>} */ (snap);
  const allow = new Set([
    "schema_version",
    "purpose",
    "action",
    "environment",
    "business_date_jst",
    "collected_at",
    "counts",
    "count_availability",
    "system_warning_codes",
    "source_errors",
    "limitations",
  ]);
  const unk = rejectUnknownKeys(o, allow);
  if (!unk.ok) return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  if (o.schema_version !== PHASE_C1_SCHEMA_VERSION) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (o.purpose !== PHASE_C1_PURPOSE || o.action !== PHASE_C1_ACTION) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (o.environment !== "staging") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (
    typeof o.business_date_jst !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(o.business_date_jst)
  ) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (typeof o.collected_at !== "string") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  const counts = o.counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  const countObj = /** @type {Record<string, unknown>} */ (counts);
  const countKeys = Object.keys(countObj);
  if (countKeys.length > PHASE_C1_LIMITS.MAX_COUNT_FIELDS) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  for (const k of countKeys) {
    if (!PHASE_C1_COUNT_KEYS.includes(k)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
    const v = validateCountInteger(countObj[k], { allowNull: true });
    if (!v.ok) return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  const avail = o.count_availability;
  if (!avail || typeof avail !== "object" || Array.isArray(avail)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  for (const [k, st] of Object.entries(
    /** @type {Record<string, unknown>} */ (avail)
  )) {
    if (!PHASE_C1_COUNT_KEYS.includes(k)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
    if (!PHASE_C1_SOURCE_STATUSES.includes(/** @type {string} */ (st))) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
  }
  const warnings = o.system_warning_codes;
  if (!Array.isArray(warnings)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  if (warnings.length > PHASE_C1_LIMITS.MAX_WARNING_CODES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  for (const code of warnings) {
    if (
      typeof code !== "string" ||
      code.length === 0 ||
      code.length > PHASE_C1_LIMITS.MAX_WARNING_CODE_LENGTH ||
      !/^[a-z0-9_.:-]+$/i.test(code)
    ) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
    }
  }
  const lim = validateLimitationList(o.limitations == null ? [] : o.limitations);
  if (!lim.ok) return lim;
  const errs = validateSourceErrorList(
    o.source_errors == null ? [] : o.source_errors
  );
  if (!errs.ok) return errs;
  if (serializedByteLength(o) > PHASE_C1_LIMITS.MAX_SERIALIZED_BYTES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_SNAPSHOT };
  }
  return { ok: true, value: o };
}

/**
 * @param {unknown} req
 */
export function validateOpsReportProviderRequest(req) {
  if (!req || typeof req !== "object" || Array.isArray(req)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const o = /** @type {Record<string, unknown>} */ (req);
  const allow = new Set([
    "schema_version",
    "purpose",
    "action",
    "environment",
    "business_date_jst",
    "snapshot",
    "output_requirements",
    "safety_constraints",
  ]);
  const unk = rejectUnknownKeys(o, allow);
  if (!unk.ok) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  // Must not contain provider-specific keys
  for (const bad of ["provider", "model", "api_key", "authorization", "sdk"]) {
    if (bad in o) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
    }
  }
  if (o.schema_version !== PHASE_C1_SCHEMA_VERSION) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (o.purpose !== PHASE_C1_PURPOSE || o.action !== PHASE_C1_ACTION) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (o.environment !== "staging") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const snap = validateDailyOpsSanitizedSnapshot(o.snapshot);
  if (!snap.ok) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const outReq = o.output_requirements;
  if (!outReq || typeof outReq !== "object" || Array.isArray(outReq)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const outAllow = new Set([
    "language",
    "max_priorities",
    "max_summary_length",
  ]);
  if (!rejectUnknownKeys(/** @type {Record<string, unknown>} */ (outReq), outAllow).ok) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (outReq.language !== "ja") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (outReq.max_priorities !== PHASE_C1_LIMITS.MAX_PRIORITIES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (outReq.max_summary_length !== PHASE_C1_LIMITS.MAX_SUMMARY_LENGTH) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const safety = o.safety_constraints;
  if (!safety || typeof safety !== "object" || Array.isArray(safety)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  const safetyAllow = new Set([
    "no_send",
    "no_approve",
    "no_notify",
    "provider_called_required",
    "recorded_api_cost_required",
  ]);
  if (
    !rejectUnknownKeys(/** @type {Record<string, unknown>} */ (safety), safetyAllow)
      .ok
  ) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (
    safety.no_send !== true ||
    safety.no_approve !== true ||
    safety.no_notify !== true ||
    safety.provider_called_required !== false ||
    safety.recorded_api_cost_required !== 0
  ) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  if (serializedByteLength(o) > PHASE_C1_LIMITS.MAX_SERIALIZED_BYTES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_PROVIDER_REQUEST };
  }
  return { ok: true, value: o };
}

/**
 * @param {unknown} result
 */
export function validateOpsReportValidatedResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  const o = /** @type {Record<string, unknown>} */ (result);
  const allow = new Set([
    "summary",
    "priorities",
    "warning_counts",
    "provider_called",
    "recorded_api_cost",
    "output_type",
    "completed_at",
    "error_code",
    "priority_levels",
  ]);
  const unk = rejectUnknownKeys(o, allow);
  if (!unk.ok) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (typeof o.summary !== "string") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (
    o.summary.length === 0 ||
    o.summary.length > PHASE_C1_LIMITS.MAX_SUMMARY_LENGTH
  ) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (!Array.isArray(o.priorities)) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.priorities.length > PHASE_C1_LIMITS.MAX_PRIORITIES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  for (const p of o.priorities) {
    if (
      typeof p !== "string" ||
      p.length === 0 ||
      p.length > PHASE_C1_LIMITS.MAX_PRIORITY_TEXT_LENGTH
    ) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }
  if (o.provider_called !== false) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.recorded_api_cost !== 0) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.output_type !== PHASE_C1_OUTPUT_TYPE) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (typeof o.completed_at !== "string") {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.error_code != null) {
    const codes = Object.values(PHASE_C1_ERROR_CODES);
    if (!codes.includes(/** @type {string} */ (o.error_code))) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }
  if (o.warning_counts != null) {
    if (
      typeof o.warning_counts !== "object" ||
      Array.isArray(o.warning_counts)
    ) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    for (const [k, v] of Object.entries(
      /** @type {Record<string, unknown>} */ (o.warning_counts)
    )) {
      if (!PHASE_C1_COUNT_KEYS.includes(k) && k !== "system_warning_codes") {
        return {
          ok: false,
          error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED,
        };
      }
      const cv = validateCountInteger(v, { allowNull: false });
      if (!cv.ok) {
        return {
          ok: false,
          error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED,
        };
      }
    }
  }
  if (o.priority_levels != null) {
    if (!Array.isArray(o.priority_levels)) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    if (o.priority_levels.length > PHASE_C1_LIMITS.MAX_PRIORITIES) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    if (o.priority_levels.length !== o.priorities.length) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    for (const lv of o.priority_levels) {
      if (!PHASE_C1_PRIORITIES.includes(/** @type {string} */ (lv))) {
        return {
          ok: false,
          error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED,
        };
      }
    }
  }
  if (serializedByteLength(o) > PHASE_C1_LIMITS.MAX_SERIALIZED_BYTES) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  return { ok: true, value: o };
}

/**
 * Build provider-neutral request from validated snapshot.
 * @param {Record<string, unknown>} snapshot
 */
export function buildOpsReportProviderRequest(snapshot) {
  const snap = validateDailyOpsSanitizedSnapshot(snapshot);
  if (!snap.ok) return snap;
  const s = /** @type {Record<string, unknown>} */ (snap.value);
  const req = Object.freeze({
    schema_version: PHASE_C1_SCHEMA_VERSION,
    purpose: PHASE_C1_PURPOSE,
    action: PHASE_C1_ACTION,
    environment: "staging",
    business_date_jst: s.business_date_jst,
    snapshot: s,
    output_requirements: Object.freeze({
      language: "ja",
      max_priorities: PHASE_C1_LIMITS.MAX_PRIORITIES,
      max_summary_length: PHASE_C1_LIMITS.MAX_SUMMARY_LENGTH,
    }),
    safety_constraints: Object.freeze({
      no_send: true,
      no_approve: true,
      no_notify: true,
      provider_called_required: false,
      recorded_api_cost_required: 0,
    }),
  });
  return validateOpsReportProviderRequest(req);
}
