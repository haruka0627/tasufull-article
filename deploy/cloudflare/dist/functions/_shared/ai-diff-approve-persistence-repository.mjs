/**
 * Diff & Approve — Staging Persistent Repository Adapter.
 * Compatible with A7 In-Memory Repository (put / get / listByProposal / claimIdempotency).
 * Write path: validated input → ownership hint → RPC write_step (transactional) → fail-closed.
 * No real Apply · Provider · Rollback · Production writes.
 */

import {
  PHASE_A7_REASONS,
  PHASE_A7_SCHEMA_VERSION,
  deepFreeze,
  serializeRecordPayload,
  validatePersistenceRecord,
} from "./ai-diff-approve-a7-persistence-in-memory.mjs";
import { fnv1aHex, hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";

export { deepFreeze, PHASE_A7_REASONS, PHASE_A7_SCHEMA_VERSION };

export const DIFF_APPROVE_PERSISTENCE_SCHEMA =
  "diff_approve.staging.persistence.v1";

export const DIFF_APPROVE_PERSISTENCE_FLAG =
  "DIFF_APPROVE_PERSISTENCE_ENABLED";
export const DIFF_APPROVE_READ_FLAG = "DIFF_APPROVE_READ_ENABLED";
export const DIFF_APPROVE_APPLY_FLAG = "DIFF_APPROVE_APPLY_ENABLED";

const FORBIDDEN_APPLY_FNS = Object.freeze([
  "performApply",
  "executeApply",
  "commitApply",
  "writeResourceChange",
  "executeProvider",
  "performRollback",
]);

/**
 * @param {string} s
 */
function nfc(s) {
  return String(s || "").normalize("NFC");
}

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function pickDiffApprovePersistenceEnv(env = {}) {
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const persistenceEnabled =
    String(env?.[DIFF_APPROVE_PERSISTENCE_FLAG] || "")
      .trim()
      .toLowerCase() === "true" ||
    String(env?.[DIFF_APPROVE_PERSISTENCE_FLAG] || "").trim() === "1";
  const applyEnabled =
    String(env?.[DIFF_APPROVE_APPLY_FLAG] || "")
      .trim()
      .toLowerCase() === "true" ||
    String(env?.[DIFF_APPROVE_APPLY_FLAG] || "").trim() === "1";
  const readEnabled =
    String(env?.[DIFF_APPROVE_READ_FLAG] || "")
      .trim()
      .toLowerCase() === "true" ||
    String(env?.[DIFF_APPROVE_READ_FLAG] || "").trim() === "1";
  return {
    url,
    serviceRoleKey,
    persistenceEnabled,
    readEnabled,
    applyEnabled,
  };
}

/**
 * @param {ReturnType<typeof pickDiffApprovePersistenceEnv>} cfg
 */
function assertCommonDbGuards(cfg) {
  if (cfg.applyEnabled) {
    return {
      ok: false,
      error: "apply_forbidden",
      reason: "apply_forbidden",
    };
  }
  if (!cfg.url || !cfg.serviceRoleKey) {
    return {
      ok: false,
      error: "db_unavailable",
      reason: "db_unavailable",
    };
  }
  if (/ddojquacsyqesrjhcvmn/i.test(cfg.url)) {
    return {
      ok: false,
      error: "production_forbidden",
      reason: "production_forbidden",
    };
  }
  return { ok: true };
}

/**
 * Fail-closed gate for staging persistence writes.
 * @param {ReturnType<typeof pickDiffApprovePersistenceEnv>} cfg
 */
export function assertPersistenceAllowed(cfg) {
  const common = assertCommonDbGuards(cfg);
  if (!common.ok) return common;
  if (!cfg.persistenceEnabled) {
    return {
      ok: false,
      error: "persistence_disabled",
      reason: "persistence_disabled",
    };
  }
  return { ok: true };
}

/**
 * Fail-closed gate for staging read-only operations.
 * @param {ReturnType<typeof pickDiffApprovePersistenceEnv>} cfg
 */
export function assertReadAllowed(cfg) {
  const common = assertCommonDbGuards(cfg);
  if (!common.ok) return common;
  if (!cfg.readEnabled) {
    return {
      ok: false,
      error: "read_disabled",
      reason: "read_disabled",
    };
  }
  return { ok: true };
}

/**
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} path
 * @param {RequestInit & { prefer?: string }} [init]
 */
async function rest(cfg, path, init = {}) {
  const doFetch = typeof cfg.fetchImpl === "function" ? cfg.fetchImpl : fetch;
  const headers = {
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    apikey: cfg.serviceRoleKey,
    "Content-Type": "application/json",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...(init.headers || {}),
  };
  const res = await doFetch(`${cfg.url}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, json, text };
}

/**
 * Normalize A7 record strings to NFC before persistence.
 * @param {Record<string, unknown>} record
 */
export function normalizeRecordForPersistence(record) {
  const payload = isPlainObject(record.payload)
    ? /** @type {Record<string, unknown>} */ (record.payload)
    : {};
  const normalizedPayload = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "__proto__" || k === "prototype" || k === "constructor") continue;
    normalizedPayload[nfc(k)] =
      typeof v === "string" ? nfc(v) : v;
  }
  return {
    ...record,
    record_type: nfc(String(record.record_type)),
    record_id: nfc(String(record.record_id)),
    proposal_id:
      typeof record.proposal_id === "string" ? nfc(record.proposal_id) : null,
    execution_id:
      typeof record.execution_id === "string" ? nfc(record.execution_id) : null,
    payload: normalizedPayload,
  };
}

/**
 * Build A10-compatible event hash fields for DB chain verification.
 * @param {{
 *   previous_event_hash: string,
 *   event_type: string,
 *   sequence_number: number,
 *   event_payload: unknown,
 * }} parts
 */
export function buildAuditEventHashes(parts) {
  const eventBodyHash = hashValue({
    event_type: parts.event_type,
    sequence_number: parts.sequence_number,
    event_payload: parts.event_payload,
  });
  if (!eventBodyHash) return null;
  const event_hash = `fnv1a32:${fnv1aHex(
    `${parts.previous_event_hash}|${eventBodyHash}`
  )}`;
  return {
    previous_event_hash: parts.previous_event_hash,
    event_hash,
    body_hash: eventBodyHash,
  };
}

/**
 * @param {unknown} row
 */
function rowToA7Record(row) {
  if (!isPlainObject(row)) return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const checked = validatePersistenceRecord({
    schema_version: o.schema_version || PHASE_A7_SCHEMA_VERSION,
    record_type: o.record_type,
    record_id: o.record_id,
    proposal_id: o.proposal_id ?? null,
    execution_id: o.execution_id ?? null,
    payload: o.payload,
    record_version: o.record_version,
    created_at: o.created_at,
    updated_at: o.updated_at,
  });
  if (!checked.ok) return null;
  return checked.value;
}

/**
 * Create persistent repository (A7-compatible surface + extras).
 * @param {{
 *   url?: string,
 *   serviceRoleKey?: string,
 *   persistenceEnabled?: boolean,
 *   readEnabled?: boolean,
 *   applyEnabled?: boolean,
 *   fetchImpl?: typeof fetch,
 *   ownerUserId?: string | null,
 *   env?: Record<string, unknown>,
 * }} [options]
 */
export function createPersistentRepository(options = {}) {
  const fromEnv = pickDiffApprovePersistenceEnv(options.env || {});
  const cfg = {
    url: options.url || fromEnv.url,
    serviceRoleKey: options.serviceRoleKey || fromEnv.serviceRoleKey,
    persistenceEnabled:
      options.persistenceEnabled != null
        ? Boolean(options.persistenceEnabled)
        : fromEnv.persistenceEnabled,
    readEnabled:
      options.readEnabled != null
        ? Boolean(options.readEnabled)
        : fromEnv.readEnabled,
    applyEnabled:
      options.applyEnabled != null
        ? Boolean(options.applyEnabled)
        : fromEnv.applyEnabled,
    fetchImpl: options.fetchImpl,
  };
  const defaultOwner =
    typeof options.ownerUserId === "string" ? options.ownerUserId : null;

  /** @type {Map<string, string>} */
  const localIdempotency = new Map();

  function gate() {
    return assertPersistenceAllowed(cfg);
  }

  function gateRead() {
    return assertReadAllowed(cfg);
  }

  /**
   * Forbidden apply surface — always throws / returns fail-closed.
   */
  function rejectApply(name) {
    return () => {
      const err = new Error(`${name}_forbidden`);
      err.code = "apply_forbidden";
      throw err;
    };
  }

  const api = {
    /**
     * @param {unknown} record
     * @param {{
     *   idempotency_key?: string,
     *   idempotency_token?: string,
     *   operation_type?: string,
     *   event?: Record<string, unknown>,
     *   owner_user_id?: string,
     * }} [opts]
     */
    async put(record, opts = {}) {
      const g = gate();
      if (!g.ok) return g;
      const checked = validatePersistenceRecord(record);
      if (!checked.ok) return checked;
      const normalized = normalizeRecordForPersistence(
        /** @type {Record<string, unknown>} */ (checked.value)
      );
      const ser = serializeRecordPayload(normalized.payload);
      if (ser == null) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.SERIALIZE_FAILED,
          reason: PHASE_A7_REASONS.SERIALIZE_FAILED,
        };
      }
      const payloadHash = hashValue(normalized.payload);

      /** @type {Record<string, unknown>} */
      const rpcInput = {
        owner_user_id: opts.owner_user_id || defaultOwner,
        record: {
          schema_version: normalized.schema_version,
          record_type: normalized.record_type,
          record_id: normalized.record_id,
          proposal_id: normalized.proposal_id,
          execution_id: normalized.execution_id,
          payload: normalized.payload,
          record_version: normalized.record_version,
          payload_hash: payloadHash,
        },
      };
      if (opts.idempotency_key) {
        rpcInput.idempotency_key = nfc(opts.idempotency_key);
        rpcInput.idempotency_token = nfc(
          opts.idempotency_token || normalized.record_id
        );
      }
      if (opts.operation_type) {
        rpcInput.operation_type = nfc(opts.operation_type);
      }
      if (opts.event && isPlainObject(opts.event)) {
        const ev = opts.event;
        const seq = Number(ev.sequence_number ?? ev.sequence);
        const prev =
          typeof ev.previous_event_hash === "string"
            ? ev.previous_event_hash
            : "genesis";
        const event_type = nfc(String(ev.event_type || ""));
        const event_payload = isPlainObject(ev.event_payload)
          ? ev.event_payload
          : isPlainObject(ev.payload)
            ? ev.payload
            : {};
        const hashes = buildAuditEventHashes({
          previous_event_hash: prev,
          event_type,
          sequence_number: seq,
          event_payload,
        });
        if (!hashes) {
          return {
            ok: false,
            error: PHASE_A7_REASONS.SERIALIZE_FAILED,
            reason: PHASE_A7_REASONS.SERIALIZE_FAILED,
          };
        }
        rpcInput.event = {
          sequence_number: seq,
          event_type,
          event_payload,
          previous_event_hash: hashes.previous_event_hash,
          event_hash:
            typeof ev.event_hash === "string" ? ev.event_hash : hashes.event_hash,
        };
      }

      const { res, json } = await rest(cfg, "/rest/v1/rpc/ai_diff_approve_write_step", {
        method: "POST",
        body: JSON.stringify({ p_input: rpcInput }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: "db_unavailable",
          reason: "db_unavailable",
        };
      }
      const body = isPlainObject(json) ? json : {};
      if (body.ok !== true) {
        return {
          ok: false,
          error: String(body.error || body.reason || PHASE_A7_REASONS.INVALID_RECORD),
          reason: String(body.reason || body.error || PHASE_A7_REASONS.INVALID_RECORD),
          existing: body.existing,
        };
      }
      return {
        ok: true,
        value: deepFreeze({
          ...normalized,
          payload_hash: payloadHash,
          serialized: ser,
        }),
        reason: PHASE_A7_REASONS.STORED,
      };
    },

    /**
     * @param {string} recordType
     * @param {string} recordId
     */
    async get(recordType, recordId) {
      const g = gateRead();
      if (!g.ok) return g;
      const path =
        `/rest/v1/ai_diff_approve_records?select=*` +
        `&record_type=eq.${encodeURIComponent(nfc(recordType))}` +
        `&record_id=eq.${encodeURIComponent(nfc(recordId))}` +
        `&limit=1`;
      const { res, json } = await rest(cfg, path, { method: "GET" });
      if (!res.ok) {
        return {
          ok: false,
          error: "db_unavailable",
          reason: "db_unavailable",
        };
      }
      const row = Array.isArray(json) && json[0] ? json[0] : null;
      if (!row) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.NOT_FOUND,
          reason: PHASE_A7_REASONS.NOT_FOUND,
        };
      }
      const value = rowToA7Record(row);
      if (!value) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.INVALID_RECORD,
          reason: PHASE_A7_REASONS.INVALID_RECORD,
        };
      }
      return { ok: true, value };
    },

    /**
     * @param {string} proposalId
     */
    async listByProposal(proposalId) {
      const g = gateRead();
      if (!g.ok) return Object.freeze([]);
      const path =
        `/rest/v1/ai_diff_approve_records?select=*` +
        `&proposal_id=eq.${encodeURIComponent(nfc(proposalId))}` +
        `&order=record_type.asc,record_id.asc`;
      const { res, json } = await rest(cfg, path, { method: "GET" });
      if (!res.ok || !Array.isArray(json)) return Object.freeze([]);
      const out = [];
      for (const row of json) {
        const v = rowToA7Record(row);
        if (v) out.push(v);
      }
      return Object.freeze(out);
    },

    /**
     * @param {string} key
     * @param {string} token
     * @param {{ proposal_id?: string, execution_id?: string, operation_type?: string, owner_user_id?: string }} [meta]
     */
    async claimIdempotency(key, token, meta = {}) {
      const g = gate();
      if (!g.ok) return g;
      if (typeof key !== "string" || typeof token !== "string") {
        return {
          ok: false,
          error: PHASE_A7_REASONS.INVALID_CONTEXT,
          reason: PHASE_A7_REASONS.INVALID_CONTEXT,
        };
      }
      const k = nfc(key);
      const t = nfc(token);
      if (localIdempotency.has(k)) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.DUPLICATE_KEY,
          reason: PHASE_A7_REASONS.DUPLICATE_KEY,
          existing: localIdempotency.get(k),
        };
      }
      const row = {
        idempotency_key: k,
        token: t,
        proposal_id: meta.proposal_id || null,
        execution_id: meta.execution_id || null,
        operation_type: meta.operation_type || null,
        owner_user_id: meta.owner_user_id || defaultOwner,
      };
      const { res, json, text } = await rest(
        cfg,
        "/rest/v1/ai_diff_approve_idempotency",
        {
          method: "POST",
          prefer: "return=representation",
          body: JSON.stringify(row),
        }
      );
      if (res.status === 409 || (json && String(json.code) === "23505")) {
        return {
          ok: false,
          error: PHASE_A7_REASONS.DUPLICATE_KEY,
          reason: PHASE_A7_REASONS.DUPLICATE_KEY,
        };
      }
      if (!res.ok) {
        if (/duplicate|unique/i.test(text || "")) {
          return {
            ok: false,
            error: PHASE_A7_REASONS.DUPLICATE_KEY,
            reason: PHASE_A7_REASONS.DUPLICATE_KEY,
          };
        }
        return {
          ok: false,
          error: "db_unavailable",
          reason: "db_unavailable",
        };
      }
      localIdempotency.set(k, t);
      return { ok: true, value: t };
    },

    /**
     * @param {string} proposalId
     */
    async getProposalBundle(proposalId) {
      const records = await api.listByProposal(proposalId);
      const timeline = await api.getAuditTimeline(proposalId);
      return deepFreeze({
        proposal_id: proposalId,
        records,
        timeline,
        applied: false,
        executed: false,
        provider_called: false,
        transmit: false,
        recorded_api_cost: 0,
        network_called: false,
        production_written: false,
        rollback_executed: false,
      });
    },

    /**
     * @param {{ owner_user_id?: string, limit?: number }} [q]
     */
    async listProposalBundles(q = {}) {
      const g = gateRead();
      if (!g.ok) return Object.freeze([]);
      const limit = Math.min(Number(q.limit) || 50, 200);
      let path =
        `/rest/v1/ai_diff_approve_proposals?select=proposal_id,status,owner_user_id,record_version,created_at` +
        `&order=created_at.desc&limit=${limit}`;
      const owner = q.owner_user_id || defaultOwner;
      if (owner) {
        path += `&owner_user_id=eq.${encodeURIComponent(owner)}`;
      }
      const { res, json } = await rest(cfg, path, { method: "GET" });
      if (!res.ok || !Array.isArray(json)) return Object.freeze([]);
      return Object.freeze(
        json.map((r) =>
          deepFreeze({
            proposal_id: r.proposal_id,
            status: r.status,
            owner_user_id: r.owner_user_id,
            record_version: r.record_version,
            created_at: r.created_at,
          })
        )
      );
    },

    /**
     * @param {string} proposalId
     */
    async getAuditTimeline(proposalId) {
      const g = gateRead();
      if (!g.ok) return Object.freeze([]);
      const path =
        `/rest/v1/ai_diff_approve_events?select=*` +
        `&proposal_id=eq.${encodeURIComponent(nfc(proposalId))}` +
        `&order=sequence_number.asc`;
      const { res, json } = await rest(cfg, path, { method: "GET" });
      if (!res.ok || !Array.isArray(json)) return Object.freeze([]);
      /** @type {string} */
      let prev = "genesis";
      const out = [];
      for (const row of json) {
        if (row.previous_event_hash !== prev) {
          return Object.freeze([
            deepFreeze({
              ok: false,
              reason: "audit_chain_mismatch",
              sequence_number: row.sequence_number,
            }),
          ]);
        }
        prev = String(row.event_hash);
        out.push(
          deepFreeze({
            id: row.id,
            proposal_id: row.proposal_id,
            sequence_number: row.sequence_number,
            event_type: row.event_type,
            event_payload: row.event_payload,
            previous_event_hash: row.previous_event_hash,
            event_hash: row.event_hash,
            created_at: row.created_at,
          })
        );
      }
      return Object.freeze(out);
    },

    /**
     * Convenience typed writers (A7 put underneath).
     */
    async createProposalRecord(record, opts) {
      return api.put({ .../** @type {object} */ (record), record_type: "proposal" }, opts);
    },
    async saveApprovalRecord(record, opts) {
      return api.put({ .../** @type {object} */ (record), record_type: "approval" }, opts);
    },
    async saveReadinessRecord(record, opts) {
      return api.put(
        { .../** @type {object} */ (record), record_type: "apply_readiness" },
        opts
      );
    },
    async saveValidationRecord(record, opts) {
      return api.put(
        { .../** @type {object} */ (record), record_type: "apply_validation" },
        opts
      );
    },
    async saveSimulationRecord(record, opts) {
      return api.put(
        { .../** @type {object} */ (record), record_type: "simulation" },
        opts
      );
    },
    async saveFinalGateRecord(record, opts) {
      return api.put(
        { .../** @type {object} */ (record), record_type: "final_gate" },
        opts
      );
    },
    async appendAuditEvent(record, event, opts = {}) {
      return api.put(record, { ...opts, event });
    },

    size() {
      return -1;
    },
    clear() {
      localIdempotency.clear();
    },

    securityInvariants: Object.freeze({
      applied: false,
      executed: false,
      provider_called: false,
      transmit: false,
      recorded_api_cost: 0,
      network_called: false,
      production_written: false,
      rollback_executed: false,
    }),
  };

  for (const name of FORBIDDEN_APPLY_FNS) {
    api[name] = rejectApply(name);
  }

  return api;
}
