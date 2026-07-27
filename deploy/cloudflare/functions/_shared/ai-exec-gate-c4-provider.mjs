/**
 * AI Execution Gate — Phase C4 provider-neutral adapter integration boundary.
 *
 * Design Freeze: port remains `secretary_deepseek` (AD-010). Provider execute NOT wired.
 * Code-constant allowlist + NoOp only · no env/DB/remote · no network · no SDK · no secrets.
 *
 * Identifier note:
 * - Formal Gate port: secretary_deepseek (unchanged)
 * - C4 provider ids include `deepseek` (Design Freeze binding) plus future-neutral
 *   `openai` | `gemini` | `anthropic` (user C4 candidates) — all NoOp-only in C4.
 */

import {
  PHASE_C1_SOURCE_STATUSES,
  buildOpsReportProviderRequest,
  validateOpsReportProviderRequest,
} from "./ai-exec-gate-c1-contracts.mjs";

export const PHASE_C4_SCHEMA_VERSION = "phase_c4.provider_adapter.v1";

/**
 * Fixed provider identifier allowlist (exact · case-sensitive · no aliases).
 * Design Freeze primary for this surface: deepseek.
 * User C4 candidates retained as NoOp registry slots only.
 */
export const PHASE_C4_PROVIDER_IDS = Object.freeze([
  "deepseek",
  "openai",
  "gemini",
  "anthropic",
]);

/** Pipeline default — Design Freeze / AD-010 surface binding (not user-selectable). */
export const PHASE_C4_DEFAULT_PROVIDER_ID = "deepseek";

export const PHASE_C4_ERROR_CODES = Object.freeze({
  INVALID_PROVIDER_ID: "INVALID_PROVIDER_ID",
  UNKNOWN_PROVIDER: "UNKNOWN_PROVIDER",
  PROVIDER_REGISTRY_ERROR: "PROVIDER_REGISTRY_ERROR",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  INVALID_PREPARED_REQUEST: "INVALID_PREPARED_REQUEST",
  PROVIDER_EXECUTE_FORBIDDEN: "PROVIDER_EXECUTE_FORBIDDEN",
});

/** Adapter availability uses C1/C2 status vocabulary (no new status invented). */
export const PHASE_C4_ADAPTER_STATUS = Object.freeze({
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  UNSUPPORTED: "unsupported",
  DISABLED: "disabled",
});

/**
 * Exact-match provider id validation (fail-closed).
 * No trim · no case-fold · no unicode alias.
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateProviderIdentifier(value) {
  if (typeof value !== "string") {
    return { ok: false, error: PHASE_C4_ERROR_CODES.INVALID_PROVIDER_ID };
  }
  if (
    value.length === 0 ||
    /\s/.test(value) ||
    value !== value.trim()
  ) {
    return { ok: false, error: PHASE_C4_ERROR_CODES.INVALID_PROVIDER_ID };
  }
  if (
    value === "__proto__" ||
    value === "prototype" ||
    value === "constructor"
  ) {
    return { ok: false, error: PHASE_C4_ERROR_CODES.INVALID_PROVIDER_ID };
  }
  // Exact allowlist match only — no case-fold, trim, or unicode aliasing.
  if (!PHASE_C4_PROVIDER_IDS.includes(value)) {
    return { ok: false, error: PHASE_C4_ERROR_CODES.UNKNOWN_PROVIDER };
  }
  // Reject if NFC form differs from provided string (silent normalize forbidden).
  if (value.normalize("NFC") !== value) {
    return { ok: false, error: PHASE_C4_ERROR_CODES.UNKNOWN_PROVIDER };
  }
  return { ok: true, value };
}

/**
 * @typedef {{
 *   provider_id: string,
 *   status: string,
 *   provider_called: false,
 *   recorded_api_cost: 0,
 *   prepare: (req: unknown) => { ok: boolean, error?: string, prepared?: unknown },
 *   validatePrepared: (prepared: unknown) => { ok: boolean, error?: string },
 *   normalizeResult: (raw: unknown) => { ok: boolean, error?: string, result?: unknown },
 *   estimatePlaceholder: () => { estimated: 0, currency: "USD" },
 *   execute: () => { ok: false, error: string, status: string, provider_called: false, recorded_api_cost: 0 },
 * }} ProviderAdapter
 */

/**
 * Shared NoOp core — no network · no SDK · no secrets · no fake AI output.
 * @param {string} providerId
 * @returns {ProviderAdapter}
 */
export function createNoOpProviderAdapter(providerId) {
  const idCheck = validateProviderIdentifier(providerId);
  if (!idCheck.ok) {
    throw new Error(PHASE_C4_ERROR_CODES.INVALID_PROVIDER_ID);
  }
  const provider_id = idCheck.value;

  return Object.freeze({
    provider_id,
    status: PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
    provider_called: false,
    recorded_api_cost: 0,
    prepare(req) {
      const v = validateOpsReportProviderRequest(req);
      if (!v.ok) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.INVALID_PREPARED_REQUEST,
        };
      }
      return {
        ok: true,
        prepared: Object.freeze({
          schema_version: PHASE_C4_SCHEMA_VERSION,
          provider_id,
          provider_called: false,
          recorded_api_cost: 0,
          request: v.value,
          adapter_status: PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
        }),
      };
    },
    validatePrepared(prepared) {
      if (!prepared || typeof prepared !== "object" || Array.isArray(prepared)) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.INVALID_PREPARED_REQUEST,
        };
      }
      const o = /** @type {Record<string, unknown>} */ (prepared);
      if (o.provider_id !== provider_id) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.INVALID_PREPARED_REQUEST,
        };
      }
      if (o.provider_called !== false || o.recorded_api_cost !== 0) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.INVALID_PREPARED_REQUEST,
        };
      }
      return { ok: true };
    },
    normalizeResult(raw) {
      // Never invent success AI text. Only pass through non-execution envelope.
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.PROVIDER_UNAVAILABLE,
        };
      }
      const o = /** @type {Record<string, unknown>} */ (raw);
      if (o.provider_called === true || o.recorded_api_cost !== 0) {
        return {
          ok: false,
          error: PHASE_C4_ERROR_CODES.PROVIDER_EXECUTE_FORBIDDEN,
        };
      }
      return {
        ok: true,
        result: Object.freeze({
          status: PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
          provider_id,
          provider_called: false,
          recorded_api_cost: 0,
          summary: null,
          priorities: Object.freeze([]),
          error_code: PHASE_C4_ERROR_CODES.PROVIDER_UNAVAILABLE,
        }),
      };
    },
    estimatePlaceholder() {
      return Object.freeze({ estimated: 0, currency: "USD" });
    },
    execute() {
      // Contract stub only — executor MUST NOT call this in C4.
      return Object.freeze({
        ok: false,
        error: PHASE_C4_ERROR_CODES.PROVIDER_EXECUTE_FORBIDDEN,
        status: PHASE_C4_ADAPTER_STATUS.UNSUPPORTED,
        provider_called: false,
        recorded_api_cost: 0,
      });
    },
  });
}

/**
 * Prototype-safe · immutable ProviderRegistry (code constants only).
 */
export function createProviderRegistry() {
  /** @type {Map<string, ProviderAdapter>} */
  const map = new Map();

  for (const id of PHASE_C4_PROVIDER_IDS) {
    if (map.has(id)) {
      throw new Error(PHASE_C4_ERROR_CODES.PROVIDER_REGISTRY_ERROR);
    }
    map.set(id, createNoOpProviderAdapter(id));
  }

  return Object.freeze({
    schema_version: PHASE_C4_SCHEMA_VERSION,
    listIds() {
      return Object.freeze([...PHASE_C4_PROVIDER_IDS]);
    },
    has(id) {
      const v = validateProviderIdentifier(id);
      return v.ok && map.has(v.value);
    },
    /**
     * @param {unknown} id
     * @returns {{ ok: true, adapter: ProviderAdapter } | { ok: false, error: string }}
     */
    get(id) {
      const v = validateProviderIdentifier(id);
      if (!v.ok) return v;
      const adapter = map.get(v.value);
      if (!adapter) {
        return { ok: false, error: PHASE_C4_ERROR_CODES.UNKNOWN_PROVIDER };
      }
      // Return frozen adapter reference (adapters themselves are frozen)
      return { ok: true, adapter };
    },
    /**
     * External mutation probe — returns a detached copy of ids.
     */
    snapshot() {
      return Object.freeze({
        ids: Object.freeze([...PHASE_C4_PROVIDER_IDS]),
        size: map.size,
      });
    },
  });
}

/** Singleton frozen registry (lazy). */
let _registry = null;

export function getPhaseC4ProviderRegistry() {
  if (!_registry) _registry = createProviderRegistry();
  return _registry;
}

/**
 * Resolve provider id → NoOp adapter. No fallback · no env · no dynamic import.
 * @param {unknown} providerId
 * @param {{ registry?: ReturnType<typeof createProviderRegistry> }} [opts]
 */
export function resolveProviderAdapter(providerId, opts = {}) {
  const registry = opts.registry || getPhaseC4ProviderRegistry();
  return registry.get(providerId);
}

/**
 * Prepare provider-neutral request from C1 sanitized snapshot (reuse C1).
 * @param {Record<string, unknown>} snapshot
 * @param {string} providerId
 */
export function prepareProviderNeutralRequest(snapshot, providerId) {
  const resolved = resolveProviderAdapter(providerId);
  if (!resolved.ok) return resolved;
  const built = buildOpsReportProviderRequest(snapshot);
  if (!built.ok) {
    return {
      ok: false,
      error: PHASE_C4_ERROR_CODES.INVALID_PREPARED_REQUEST,
    };
  }
  const prepared = resolved.adapter.prepare(built.value);
  if (!prepared.ok) return prepared;
  const validated = resolved.adapter.validatePrepared(prepared.prepared);
  if (!validated.ok) return validated;
  return {
    ok: true,
    provider_id: resolved.adapter.provider_id,
    adapter_status: resolved.adapter.status,
    prepared: prepared.prepared,
    provider_called: false,
    recorded_api_cost: 0,
    estimate: resolved.adapter.estimatePlaceholder(),
  };
}

/**
 * Sanitized metadata for events / responses (no secrets).
 * @param {{
 *   provider_id: string,
 *   adapter_status: string,
 *   provider_called?: boolean,
 *   recorded_api_cost?: number,
 * }} info
 */
export function sanitizeProviderResolveMetadata(info) {
  return Object.freeze({
    provider_id: info.provider_id,
    adapter_status: info.adapter_status,
    provider_called: false,
    recorded_api_cost: 0,
    port: "secretary_deepseek",
  });
}

/**
 * Assert status is from existing C1 vocabulary.
 * @param {unknown} status
 */
export function isKnownAdapterStatus(status) {
  return (
    typeof status === "string" &&
    PHASE_C1_SOURCE_STATUSES.includes(/** @type {any} */ (status))
  );
}
