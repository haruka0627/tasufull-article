/**
 * AI Execution Gate — Phase C1 sanitized daily operations collector.
 * Read-only · count-centric · no network · no provider · no mutation.
 *
 * Data sources are injectable adapters only. C1 does not invent DB tables/RPCs.
 * Default adapters return deterministic available zeros (empty-safe fixture).
 */

import {
  PHASE_C1_ACTION,
  PHASE_C1_COUNT_KEYS,
  PHASE_C1_ERROR_CODES,
  PHASE_C1_LIMITS,
  PHASE_C1_PURPOSE,
  PHASE_C1_SCHEMA_VERSION,
  validateCountInteger,
  validateDailyOpsCollectorInput,
  validateDailyOpsSanitizedSnapshot,
} from "./ai-exec-gate-c1-contracts.mjs";
import {
  hardenIncomingPayload,
  normalizeExternalError,
  normalizeSourceAvailability,
  normalizeWarningCodeList,
  PHASE_C2_ERROR_CODES,
} from "./ai-exec-gate-c2-hardening.mjs";

/**
 * @typedef {{
 *   id: string,
 *   count_key: string,
 *   read: (ctx: { business_date_jst: string }) =>
 *     | { status: "available", count: number, warning_codes?: string[] }
 *     | { status: "unavailable"|"unsupported"|"disabled", error_code?: string, warning_codes?: string[] }
 * }} DailyOpsSourceAdapter
 */

/**
 * Default empty-safe sources (all counts available = 0). No DB / no HTTP.
 * @returns {DailyOpsSourceAdapter[]}
 */
export function createDefaultDailyOpsSources() {
  return PHASE_C1_COUNT_KEYS.map((count_key) =>
    Object.freeze({
      id: `fixture_${count_key}`,
      count_key,
      read: () =>
        Object.freeze({
          status: "available",
          count: 0,
          warning_codes: Object.freeze([]),
        }),
    })
  );
}

/**
 * Normalize / dedupe / cap opaque warning codes (C2 allowlist).
 * @param {unknown[]} codes
 * @returns {string[]}
 */
export function normalizeWarningCodes(codes) {
  return normalizeWarningCodeList(codes);
}

/**
 * Collect sanitized daily ops snapshot from injectable read-only sources.
 *
 * @param {{
 *   input?: Record<string, unknown>,
 *   sources?: DailyOpsSourceAdapter[],
 *   collectedAt?: string,
 * }} args
 * @returns {{
 *   ok: true,
 *   snapshot: Record<string, unknown>,
 * } | {
 *   ok: false,
 *   error: string,
 * }}
 */
export function collectDailyOperationsSnapshot(args = {}) {
  const incoming = args.input || {};
  const hardened = hardenIncomingPayload(incoming);
  if (!hardened.ok) {
    return {
      ok: false,
      error: normalizeExternalError(
        hardened.error,
        PHASE_C2_ERROR_CODES.INVALID_REQUEST
      ),
    };
  }

  const validated = validateDailyOpsCollectorInput(incoming);
  if (!validated.ok) return validated;

  const input = validated.value;
  const sources =
    Array.isArray(args.sources) && args.sources.length > 0
      ? args.sources
      : createDefaultDailyOpsSources();

  if (sources.length > PHASE_C1_LIMITS.MAX_COUNT_FIELDS) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_LIMIT };
  }

  /** @type {Record<string, number|null>} */
  const counts = {};
  /** @type {Record<string, string>} */
  const count_availability = {};
  /** @type {string[]} */
  const source_errors = [];
  /** @type {string[]} */
  const warningAccum = [];

  const pushError = (code) => {
    const n = normalizeExternalError(code, PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE);
    if (!source_errors.includes(n)) source_errors.push(n);
  };

  for (const src of sources) {
    if (!src || typeof src !== "object") {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
    }
    const countKey = src.count_key;
    if (
      typeof countKey !== "string" ||
      !PHASE_C1_COUNT_KEYS.includes(countKey)
    ) {
      return { ok: false, error: PHASE_C1_ERROR_CODES.UNKNOWN_SOURCE };
    }
    if (typeof src.read !== "function") {
      return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_COLLECTOR_INPUT };
    }

    let result;
    try {
      result = src.read({ business_date_jst: input.business_date_jst });
    } catch {
      counts[countKey] = null;
      count_availability[countKey] = "unavailable";
      pushError(PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE);
      continue;
    }

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      counts[countKey] = null;
      count_availability[countKey] = "unavailable";
      pushError(PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE);
      continue;
    }

    const status = normalizeSourceAvailability(result.status);
    if (status === "available") {
      const cv = validateCountInteger(result.count, { allowNull: false });
      if (!cv.ok) {
        counts[countKey] = null;
        count_availability[countKey] = "unavailable";
        pushError(PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE);
        continue;
      }
      // Prefer first successful available read; do not invent merges.
      if (count_availability[countKey] !== "available") {
        counts[countKey] = cv.value;
        count_availability[countKey] = "available";
      }
      if (Array.isArray(result.warning_codes)) {
        warningAccum.push(...result.warning_codes);
      }
    } else if (
      status === "unavailable" ||
      status === "unsupported" ||
      status === "disabled"
    ) {
      // Never coerce failure/unsupported/disabled into 0.
      if (count_availability[countKey] !== "available") {
        counts[countKey] = null;
        count_availability[countKey] = status;
      }
      const code =
        typeof result.error_code === "string" &&
        Object.values(PHASE_C1_ERROR_CODES).includes(result.error_code)
          ? result.error_code
          : status === "unavailable"
            ? PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE
            : PHASE_C1_ERROR_CODES.UNKNOWN_SOURCE;
      pushError(code);
      if (Array.isArray(result.warning_codes)) {
        warningAccum.push(...result.warning_codes);
      }
    } else {
      counts[countKey] = null;
      count_availability[countKey] = "unavailable";
      pushError(PHASE_C1_ERROR_CODES.UNKNOWN_SOURCE);
    }
  }

  // Only keys with configured sources appear — never invent missing tables as 0.
  if (Object.keys(counts).length === 0) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.SOURCE_UNAVAILABLE };
  }

  const collected_at =
    typeof args.collectedAt === "string" && args.collectedAt
      ? args.collectedAt
      : "1970-01-01T00:00:00.000Z";

  const snapshot = Object.freeze({
    schema_version: PHASE_C1_SCHEMA_VERSION,
    purpose: PHASE_C1_PURPOSE,
    action: PHASE_C1_ACTION,
    environment: "staging",
    business_date_jst: input.business_date_jst,
    collected_at,
    counts: Object.freeze({ ...counts }),
    count_availability: Object.freeze({ ...count_availability }),
    system_warning_codes: Object.freeze(normalizeWarningCodes(warningAccum)),
    source_errors: Object.freeze([...source_errors]),
    limitations: Object.freeze([
      "Phase C1 sanitized count collector",
      "Phase C2 availability: available|unavailable|unsupported|disabled",
      "No live DB tables invented",
      "No provider invocation",
      "zero available is not failure",
    ]),
  });

  const checked = validateDailyOpsSanitizedSnapshot(snapshot);
  if (!checked.ok) return checked;
  return { ok: true, snapshot: checked.value };
}
