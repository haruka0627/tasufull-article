/**
 * ANPI Talk Adapter Interface + Local implementation.
 *
 * Worker depends on this interface only — not on real TALK / Push / Realtime.
 * Local adapter delegates durable send/cancel/status to SQL RPCs on localhost.
 *
 * Methods: send | cancel | status | health | dryRun
 */

import { validateContract } from "./anpi-talk-contract.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const RECEIPT_STATUSES = new Set([
  "received",
  "accepted",
  "delivered",
  "cancelled",
  "failed",
]);

/**
 * @typedef {object} TalkAdapter
 * @property {(contract: object, opts?: object) => Promise<object>} send
 * @property {(idempotencyKey: string, reason?: string) => Promise<object>} cancel
 * @property {(idempotencyKey: string) => Promise<object>} status
 * @property {() => Promise<object>} health
 * @property {(contract: object) => Promise<object>} dryRun
 */

function assertLocalApi(apiUrl) {
  const url = new URL(String(apiUrl || ""));
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("anpi_adapter_non_local");
  }
  if (url.origin !== "http://127.0.0.1:54321") {
    throw new Error("anpi_adapter_expected_local_api");
  }
}

async function rpc(apiUrl, serviceKey, name, args) {
  assertLocalApi(apiUrl);
  const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`adapter_rpc_${name}:${String(code).slice(0, 80)}`);
  }
  return json;
}

function normalizeReceipt(row) {
  const status = String(row?.status || "");
  if (status && !RECEIPT_STATUSES.has(status)) {
    throw new Error("anpi_invalid_receipt_status");
  }
  return {
    status: status || null,
    provider_message_id: row?.provider_message_id ?? null,
    error_code: row?.error_code ?? null,
    already_seen: Boolean(row?.already_seen),
    stub_result: row?.stub_result ?? null,
      found: row?.receipt_found ?? row?.found,
    valid: row?.valid,
    template_key: row?.template_key ?? null,
    idempotency_key: row?.idempotency_key ?? null,
  };
}

/**
 * Create a local Talk adapter. serviceKey is never stored on the contract
 * and must never be logged by callers.
 */
export function createLocalTalkAdapter({ apiUrl, serviceKey }) {
  assertLocalApi(apiUrl);
  if (!serviceKey || typeof serviceKey !== "string") {
    throw new Error("anpi_adapter_missing_credentials");
  }

  /** @type {TalkAdapter} */
  const adapter = {
    async health() {
      const json = await rpc(apiUrl, serviceKey, "anpi_phase8_adapter_health", {});
      return json && typeof json === "object" ? json : { ok: false };
    },

    async dryRun(contract) {
      const err = validateContract(contract);
      if (err) {
        return {
          status: "failed",
          valid: false,
          error_code: err,
          template_key: contract?.template_key ?? null,
          idempotency_key: contract?.idempotency_key ?? null,
        };
      }
      const rows = await rpc(apiUrl, serviceKey, "anpi_phase8_adapter_dry_run", {
        p_contract: contract,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return normalizeReceipt(row);
    },

    async status(idempotencyKey) {
      const rows = await rpc(apiUrl, serviceKey, "anpi_phase8_adapter_status", {
        p_idempotency_key: idempotencyKey,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return normalizeReceipt(row);
    },

    async cancel(idempotencyKey, reason = "anpi_cancelled") {
      const rows = await rpc(apiUrl, serviceKey, "anpi_phase8_adapter_cancel", {
        p_idempotency_key: idempotencyKey,
        p_reason: String(reason || "anpi_cancelled").slice(0, 64),
        p_now: new Date().toISOString(),
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return {
        status: row?.status || "cancelled",
        already_terminal: Boolean(row?.already_terminal),
      };
    },

    async send(contract, opts = {}) {
      const err = validateContract(contract);
      if (err) {
        return {
          status: "failed",
          provider_message_id: null,
          error_code: err,
          already_seen: false,
          stub_result: null,
        };
      }
      const stubMode = opts.stubMode || "success";
      const rows = await rpc(apiUrl, serviceKey, "anpi_phase8_adapter_send", {
        p_contract: contract,
        p_stub_mode: stubMode,
        p_now: new Date().toISOString(),
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return normalizeReceipt(row);
    },
  };

  return Object.freeze(adapter);
}

export const TalkAdapterInterface = Object.freeze({
  methods: Object.freeze(["send", "cancel", "status", "health", "dryRun"]),
  receiptStatuses: Object.freeze([...RECEIPT_STATUSES]),
  localOnly: true,
  production: false,
});
