/**
 * Diff & Approve — Phase A7 Persistence Contract + In-Memory Repository.
 * No SQL · Supabase · filesystem · remote KV · production storage.
 */

import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";

export { deepFreeze };

export const PHASE_A7_SCHEMA_VERSION = "diff_approve.a7.persistence.v1";

export const PHASE_A7_RECORD_TYPES = Object.freeze([
  "proposal",
  "approval",
  "apply_readiness",
  "apply_validation",
  "simulation",
  "final_gate",
  "audit",
  "idempotency",
]);

export const PHASE_A7_REASONS = Object.freeze({
  STORED: "stored",
  DUPLICATE_KEY: "duplicate_key",
  NOT_FOUND: "not_found",
  STALE_VERSION: "stale_version",
  INVALID_RECORD: "invalid_record",
  UNKNOWN_TYPE: "unknown_type",
  EXTRA_FIELDS: "extra_fields",
  INVALID_CONTEXT: "invalid_context",
  SERIALIZE_FAILED: "serialize_failed",
});

const RECORD_ALLOWLIST = Object.freeze([
  "schema_version",
  "record_type",
  "record_id",
  "proposal_id",
  "execution_id",
  "payload",
  "record_version",
  "created_at",
  "updated_at",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectExtraKeys(keys, allowlist) {
  for (const key of keys) {
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !allowlist.includes(key)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Deterministic JSON serialization (sorted keys · depth-limited).
 * @param {unknown} value
 * @param {number} depth
 */
export function serializeRecordPayload(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const parts = value.slice(0, 100).map((v) => serializeRecordPayload(v, depth + 1));
    if (parts.some((p) => p == null)) return null;
    return `[${parts.join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((k) => k !== "__proto__" && k !== "prototype" && k !== "constructor")
      .sort()
      .slice(0, 64);
    const parts = keys.map((k) => {
      const ser = serializeRecordPayload(
        /** @type {Record<string, unknown>} */ (value)[k],
        depth + 1
      );
      if (ser == null) return null;
      return `${JSON.stringify(k)}:${ser}`;
    });
    if (parts.some((p) => p == null)) return null;
    return `{${parts.join(",")}}`;
  }
  return null;
}

/**
 * @param {unknown} input
 */
export function validatePersistenceRecord(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (input);
  if (!rejectExtraKeys(Object.keys(o), RECORD_ALLOWLIST)) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.EXTRA_FIELDS,
      reason: PHASE_A7_REASONS.EXTRA_FIELDS,
    };
  }
  if (o.schema_version !== PHASE_A7_SCHEMA_VERSION) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  if (
    typeof o.record_type !== "string" ||
    !PHASE_A7_RECORD_TYPES.includes(o.record_type)
  ) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.UNKNOWN_TYPE,
      reason: PHASE_A7_REASONS.UNKNOWN_TYPE,
    };
  }
  if (typeof o.record_id !== "string" || o.record_id.length === 0) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  if (
    o.proposal_id != null &&
    (typeof o.proposal_id !== "string" || !UUID_RE.test(o.proposal_id))
  ) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  if (
    typeof o.record_version !== "number" ||
    !Number.isInteger(o.record_version) ||
    o.record_version < 1
  ) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  if (!isPlainObject(o.payload)) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.INVALID_RECORD,
      reason: PHASE_A7_REASONS.INVALID_RECORD,
    };
  }
  const ser = serializeRecordPayload(o.payload);
  if (ser == null) {
    return {
      ok: false,
      error: PHASE_A7_REASONS.SERIALIZE_FAILED,
      reason: PHASE_A7_REASONS.SERIALIZE_FAILED,
    };
  }
  return {
    ok: true,
    value: deepFreeze({
      schema_version: PHASE_A7_SCHEMA_VERSION,
      record_type: o.record_type,
      record_id: o.record_id,
      proposal_id: typeof o.proposal_id === "string" ? o.proposal_id : null,
      execution_id: typeof o.execution_id === "string" ? o.execution_id : null,
      payload: deepFreeze({ .../** @type {object} */ (o.payload) }),
      record_version: o.record_version,
      created_at:
        typeof o.created_at === "string"
          ? o.created_at
          : "1970-01-01T00:00:00.000Z",
      updated_at:
        typeof o.updated_at === "string"
          ? o.updated_at
          : "1970-01-01T00:00:00.000Z",
      serialized: ser,
    }),
  };
}

/**
 * Create an empty in-memory repository.
 */
export function createInMemoryRepository() {
  /** @type {Map<string, Readonly<Record<string, unknown>>>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const idempotency = new Map();

  return {
    /**
     * @param {unknown} record
     */
    put(record) {
      const checked = validatePersistenceRecord(record);
      if (!checked.ok) return checked;
      const r = checked.value;
      const key = `${r.record_type}:${r.record_id}`;
      const existing = byId.get(key);
      if (existing) {
        if (
          /** @type {number} */ (existing.record_version) !==
          /** @type {number} */ (r.record_version) - 1
        ) {
          // first write conflict or stale
          if (
            /** @type {number} */ (existing.record_version) >=
            /** @type {number} */ (r.record_version)
          ) {
            return {
              ok: false,
              error: PHASE_A7_REASONS.DUPLICATE_KEY,
              reason: PHASE_A7_REASONS.DUPLICATE_KEY,
            };
          }
          return {
            ok: false,
            error: PHASE_A7_REASONS.STALE_VERSION,
            reason: PHASE_A7_REASONS.STALE_VERSION,
          };
        }
      } else if (/** @type {number} */ (r.record_version) !== 1) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.STALE_VERSION,
          reason: PHASE_A7_REASONS.STALE_VERSION,
        };
      }
      byId.set(key, r);
      return { ok: true, value: r, reason: PHASE_A7_REASONS.STORED };
    },

    /**
     * @param {string} recordType
     * @param {string} recordId
     */
    get(recordType, recordId) {
      const key = `${recordType}:${recordId}`;
      const row = byId.get(key);
      if (!row) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.NOT_FOUND,
          reason: PHASE_A7_REASONS.NOT_FOUND,
        };
      }
      return { ok: true, value: row };
    },

    /**
     * @param {string} proposalId
     */
    listByProposal(proposalId) {
      const out = [];
      for (const row of byId.values()) {
        if (row.proposal_id === proposalId) out.push(row);
      }
      return Object.freeze([...out]);
    },

    /**
     * @param {string} key
     * @param {string} token
     */
    claimIdempotency(key, token) {
      if (typeof key !== "string" || typeof token !== "string") {
        return {
          ok: false,
          error: PHASE_A7_REASONS.INVALID_CONTEXT,
          reason: PHASE_A7_REASONS.INVALID_CONTEXT,
        };
      }
      if (idempotency.has(key)) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.DUPLICATE_KEY,
          reason: PHASE_A7_REASONS.DUPLICATE_KEY,
          existing: idempotency.get(key),
        };
      }
      idempotency.set(key, token);
      return { ok: true, value: token };
    },

    size() {
      return byId.size;
    },

    clear() {
      byId.clear();
      idempotency.clear();
    },
  };
}
