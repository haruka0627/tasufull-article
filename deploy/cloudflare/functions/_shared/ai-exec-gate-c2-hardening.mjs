/**
 * AI Execution Gate — Phase C2 redaction / validation hardening.
 * Hardening only — no provider · no network · no dashboard/runtime redesign.
 */

import {
  PHASE_C1_ERROR_CODES,
  PHASE_C1_LIMITS,
  PHASE_C1_PRIORITIES,
  PHASE_C1_OUTPUT_TYPE,
  serializedByteLength,
  validateCountInteger,
} from "./ai-exec-gate-c1-contracts.mjs";

export const PHASE_C2_SCHEMA_NOTE = "phase_c2.hardening.v1";

export const PHASE_C2_LIMITS = Object.freeze({
  MAX_NESTED_DEPTH: PHASE_C1_LIMITS.MAX_NESTED_DEPTH,
  MAX_ARRAY_LENGTH: 64,
  MAX_OBJECT_KEYS: 64,
  MAX_TOTAL_KEYS: 256,
  MAX_STRING_UTF8_BYTES: 4096,
  MAX_SERIALIZED_BYTES: PHASE_C1_LIMITS.MAX_SERIALIZED_BYTES,
  MAX_SUMMARY_LENGTH: PHASE_C1_LIMITS.MAX_SUMMARY_LENGTH,
  MAX_PRIORITIES: PHASE_C1_LIMITS.MAX_PRIORITIES,
  MAX_WARNING_CODES: PHASE_C1_LIMITS.MAX_WARNING_CODES,
});

export const PHASE_C2_ERROR_CODES = Object.freeze({
  ...PHASE_C1_ERROR_CODES,
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_WARNING: "INVALID_WARNING",
  INVALID_LIMIT: "INVALID_LIMIT",
  UNKNOWN_SOURCE: "UNKNOWN_SOURCE",
  PROTOTYPE_POLLUTION: "PROTOTYPE_POLLUTION",
  REDACTION_REJECTED: "REDACTION_REJECTED",
  UNICODE_REJECTED: "UNICODE_REJECTED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
});

/** Recursive redaction / reject key set (case-insensitive). */
export const PHASE_C2_PROHIBITED_KEYS = Object.freeze([
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "session",
  "credential",
  "private_key",
  "payment",
  "card",
  "cvv",
  "iban",
  "email",
  "phone",
  "address",
  "raw_message",
  "chat_body",
  "message_body",
  "user_content",
  "stack",
  "stack_trace",
  "prompt",
  "sql",
  "bearer",
]);

export const PHASE_C2_POLLUTION_KEYS = Object.freeze([
  "__proto__",
  "prototype",
  "constructor",
]);

/** Opaque warning allowlist only (unknown → UNKNOWN_WARNING_CODE). */
export const PHASE_C2_WARNING_CODE_ALLOWLIST = Object.freeze([
  "UNKNOWN_WARNING_CODE",
  "gate.lease",
  "gate.orphan",
  "gate.budget",
  "gate.timeout",
  "ops.pending",
  "ops.failed",
  "ops.blocked",
  "ops.warning",
  "ops.support",
  "ops.moderation",
  "ops.anpi",
]);

export const PHASE_C2_SOURCE_STATUSES = Object.freeze([
  "available",
  "unavailable",
  "unsupported",
  "disabled",
]);

const PROHIBITED_SET = new Set(
  PHASE_C2_PROHIBITED_KEYS.map((k) => k.toLowerCase())
);
const POLLUTION_SET = new Set(PHASE_C2_POLLUTION_KEYS);
const WARNING_ALLOW = new Set(
  PHASE_C2_WARNING_CODE_ALLOWLIST.map((k) => k.toLowerCase())
);

/** Dangerous Unicode / control patterns (reject or strip). */
const RE_NULL = /\u0000/;
const RE_C0_CONTROLS = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const RE_BIDI =
  /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/;
const RE_ZW = /[\u200B-\u200D\uFEFF\u2060]/;

/**
 * @param {unknown} key
 */
export function isPhaseC2ProhibitedKey(key) {
  if (typeof key !== "string") return true;
  return PROHIBITED_SET.has(key.toLowerCase());
}

/**
 * @param {unknown} key
 */
export function isPhaseC2PollutionKey(key) {
  if (typeof key !== "string") return true;
  return POLLUTION_SET.has(key) || POLLUTION_SET.has(key.toLowerCase());
}

/**
 * Own-property enumeration safe for null-prototype objects.
 * @param {object} obj
 * @returns {string[]}
 */
export function ownKeysSafe(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj);
}

/**
 * Normalize opaque warning code → allowlist or UNKNOWN_WARNING_CODE.
 * Invalid format (HTML/Markdown/JS/SQL/prompt-like) → drop (null).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeWarningCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim();
  if (
    !code ||
    code.length > PHASE_C1_LIMITS.MAX_WARNING_CODE_LENGTH ||
    !/^[a-z0-9_.:-]+$/i.test(code)
  ) {
    return null;
  }
  // Reject prompt/sql-ish tokens even if format matches loosely
  if (/prompt|select|insert|drop|script|markdown|html/i.test(code)) {
    return null;
  }
  const lower = code.toLowerCase();
  if (WARNING_ALLOW.has(lower)) {
    return PHASE_C2_WARNING_CODE_ALLOWLIST.find((c) => c.toLowerCase() === lower) ||
      "UNKNOWN_WARNING_CODE";
  }
  return "UNKNOWN_WARNING_CODE";
}

/**
 * @param {unknown[]} codes
 * @returns {string[]}
 */
export function normalizeWarningCodeList(codes) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(codes)) return out;
  if (codes.length > PHASE_C2_LIMITS.MAX_ARRAY_LENGTH) {
    return out;
  }
  for (const raw of codes) {
    const n = normalizeWarningCode(raw);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    if (out.length >= PHASE_C2_LIMITS.MAX_WARNING_CODES) break;
  }
  return out;
}

/**
 * NFC + strip bidi/zwj/null/controls. Reject if NULL remains after strip attempt
 * on fields that must stay clean.
 * @param {string} input
 * @param {{ maxBytes?: number, rejectOnDanger?: boolean }} [opts]
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function hardenUnicodeString(input, opts = {}) {
  if (typeof input !== "string") {
    return { ok: false, error: PHASE_C2_ERROR_CODES.UNICODE_REJECTED };
  }
  let s = input.normalize("NFC");
  if (RE_NULL.test(s)) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.UNICODE_REJECTED };
  }
  if (opts.rejectOnDanger && (RE_C0_CONTROLS.test(s) || RE_BIDI.test(s))) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.UNICODE_REJECTED };
  }
  // Strip bidi overrides / zero-width / leftover C0 (keep TAB/LF out of strip set already)
  s = s.replace(RE_BIDI, "").replace(RE_ZW, "").replace(RE_C0_CONTROLS, "");
  const bytes = new TextEncoder().encode(s).byteLength;
  const max = opts.maxBytes ?? PHASE_C2_LIMITS.MAX_STRING_UTF8_BYTES;
  if (bytes > max) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_LIMIT };
  }
  return { ok: true, value: s };
}

/**
 * Recursive hardening scan: pollution · prohibited keys · payload size.
 * Fail closed (reject), does not mutate input.
 *
 * @param {unknown} value
 * @param {{
 *   depth?: number,
 *   totalKeys?: { n: number },
 *   mode?: "reject_secrets" | "scan_only",
 * }} [state]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function hardenRecursiveScan(value, state = {}) {
  const depth = state.depth ?? 0;
  const totalKeys = state.totalKeys ?? { n: 0 };

  if (depth > PHASE_C2_LIMITS.MAX_NESTED_DEPTH) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_LIMIT };
  }

  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return { ok: true };
  }

  if (typeof value === "string") {
    const u = hardenUnicodeString(value, { rejectOnDanger: true });
    if (!u.ok) return u;
    return { ok: true };
  }

  if (typeof value !== "object") {
    return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_REQUEST };
  }

  if (Array.isArray(value)) {
    if (value.length > PHASE_C2_LIMITS.MAX_ARRAY_LENGTH) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.PAYLOAD_TOO_LARGE };
    }
    for (const item of value) {
      const r = hardenRecursiveScan(item, {
        depth: depth + 1,
        totalKeys,
      });
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  const keys = ownKeysSafe(value);
  if (keys.length > PHASE_C2_LIMITS.MAX_OBJECT_KEYS) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.PAYLOAD_TOO_LARGE };
  }
  totalKeys.n += keys.length;
  if (totalKeys.n > PHASE_C2_LIMITS.MAX_TOTAL_KEYS) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.PAYLOAD_TOO_LARGE };
  }

  for (const key of keys) {
    if (isPhaseC2PollutionKey(key)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.PROTOTYPE_POLLUTION };
    }
    if (isPhaseC2ProhibitedKey(key)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.REDACTION_REJECTED };
    }
    // constructor.prototype path as nested key name "constructor" already blocked
    const child = /** @type {Record<string, unknown>} */ (value)[key];
    const r = hardenRecursiveScan(child, {
      depth: depth + 1,
      totalKeys,
    });
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Full incoming payload gate (bytes + recursive).
 * @param {unknown} value
 */
export function hardenIncomingPayload(value) {
  if (value !== null && typeof value === "object") {
    const bytes = serializedByteLength(value);
    if (bytes > PHASE_C2_LIMITS.MAX_SERIALIZED_BYTES) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.PAYLOAD_TOO_LARGE };
    }
  }
  return hardenRecursiveScan(value, { depth: 0, totalKeys: { n: 0 } });
}

/**
 * Validate availability status vocabulary.
 * @param {unknown} status
 */
export function isValidSourceAvailability(status) {
  return (
    typeof status === "string" &&
    PHASE_C2_SOURCE_STATUSES.includes(/** @type {any} */ (status))
  );
}

/**
 * Map source adapter status → normalized availability (+ count nullability rule).
 * @param {unknown} status
 * @returns {"available"|"unavailable"|"unsupported"|"disabled"|null}
 */
export function normalizeSourceAvailability(status) {
  if (!isValidSourceAvailability(status)) return null;
  return /** @type {any} */ (status);
}

/**
 * Normalize internal errors for external surfaces (no stack/SQL/path/secret).
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function normalizeExternalError(err, fallback = "INTERNAL_EXECUTION_ERROR") {
  if (typeof err === "string" && Object.values(PHASE_C2_ERROR_CODES).includes(err)) {
    return err;
  }
  if (err && typeof err === "object") {
    const code = /** @type {{ code?: unknown, gateError?: unknown }} */ (err)
      .gateError;
    if (
      typeof code === "string" &&
      Object.values(PHASE_C2_ERROR_CODES).includes(code)
    ) {
      return code;
    }
    const c = /** @type {{ code?: unknown }} */ (err).code;
    if (
      typeof c === "string" &&
      Object.values(PHASE_C2_ERROR_CODES).includes(c)
    ) {
      return c;
    }
  }
  return Object.values(PHASE_C2_ERROR_CODES).includes(fallback)
    ? fallback
    : PHASE_C2_ERROR_CODES.INTERNAL_EXECUTION_ERROR;
}

/**
 * Re-validate / harden adapter output (no extra keys, no nesting, no provider meta).
 * @param {unknown} result
 */
export function hardenValidatedResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
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

  for (const key of ownKeysSafe(o)) {
    if (isPhaseC2PollutionKey(key) || isPhaseC2ProhibitedKey(key)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    if (!allow.has(key)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }

  for (const bad of [
    "provider",
    "model",
    "model_id",
    "diagnostics",
    "stack",
    "token",
    "usage",
  ]) {
    if (Object.prototype.hasOwnProperty.call(o, bad)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
  }

  if (typeof o.summary !== "string") {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  const summaryHard = hardenUnicodeString(o.summary, {
    maxBytes: PHASE_C2_LIMITS.MAX_SUMMARY_LENGTH * 4,
    rejectOnDanger: true,
  });
  if (!summaryHard.ok) return summaryHard;
  if (
    summaryHard.value.length === 0 ||
    summaryHard.value.length > PHASE_C2_LIMITS.MAX_SUMMARY_LENGTH
  ) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_LIMIT };
  }

  if (!Array.isArray(o.priorities)) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.priorities.length > PHASE_C2_LIMITS.MAX_PRIORITIES) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_LIMIT };
  }
  /** @type {string[]} */
  const priorities = [];
  for (const p of o.priorities) {
    if (typeof p !== "string") {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    const ph = hardenUnicodeString(p, {
      maxBytes: PHASE_C1_LIMITS.MAX_PRIORITY_TEXT_LENGTH * 4,
      rejectOnDanger: true,
    });
    if (!ph.ok) return ph;
    if (
      ph.value.length === 0 ||
      ph.value.length > PHASE_C1_LIMITS.MAX_PRIORITY_TEXT_LENGTH
    ) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.INVALID_LIMIT };
    }
    if (ph.value !== null && typeof ph.value === "object") {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    priorities.push(ph.value);
  }

  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (o.output_type !== PHASE_C1_OUTPUT_TYPE) {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  if (typeof o.completed_at !== "string") {
    return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }

  if (o.warning_counts != null) {
    if (typeof o.warning_counts !== "object" || Array.isArray(o.warning_counts)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    for (const [k, v] of Object.entries(
      /** @type {Record<string, unknown>} */ (o.warning_counts)
    )) {
      if (isPhaseC2PollutionKey(k) || isPhaseC2ProhibitedKey(k)) {
        return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
      }
      const cv = validateCountInteger(v, { allowNull: false });
      if (!cv.ok) {
        return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
      }
    }
  }

  if (o.priority_levels != null) {
    if (!Array.isArray(o.priority_levels)) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    if (o.priority_levels.length !== priorities.length) {
      return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
    }
    for (const lv of o.priority_levels) {
      if (!PHASE_C1_PRIORITIES.includes(/** @type {string} */ (lv))) {
        return { ok: false, error: PHASE_C2_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
      }
    }
  }

  // No nested objects beyond warning_counts (flat numbers only — already checked)
  const hardened = Object.freeze({
    summary: summaryHard.value,
    priorities: Object.freeze(priorities),
    warning_counts:
      o.warning_counts == null
        ? undefined
        : Object.freeze({
            .../** @type {Record<string, number>} */ (o.warning_counts),
          }),
    provider_called: false,
    recorded_api_cost: 0,
    output_type: PHASE_C1_OUTPUT_TYPE,
    completed_at: o.completed_at,
    error_code: o.error_code == null ? null : o.error_code,
    priority_levels:
      o.priority_levels == null
        ? undefined
        : Object.freeze([...(/** @type {string[]} */ (o.priority_levels))]),
  });

  // Drop undefined keys for stable JSON
  /** @type {Record<string, unknown>} */
  const cleaned = {};
  for (const [k, v] of Object.entries(hardened)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return { ok: true, value: Object.freeze(cleaned) };
}

/**
 * Determinism compare payload (excludes completed_at only).
 * @param {Record<string, unknown>} result
 */
export function deterministicComparePayload(result) {
  const copy = { ...result };
  delete copy.completed_at;
  return JSON.stringify(copy);
}
