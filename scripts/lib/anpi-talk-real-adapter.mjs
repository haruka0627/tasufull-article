/**
 * ANPI Talk Real Adapter Foundation (Phase 9) — local + shadow only.
 *
 * Phase 8 interface compatible: send | cancel | status | health | dryRun
 * Feature flag: ANPI_TALK_ADAPTER=local|shadow (real hard-disabled)
 * Never writes public.talk_notifications. Never Push/Realtime.
 */

import { validateContract } from "./anpi-talk-contract.mjs";
import { createLocalTalkAdapter, TalkAdapterInterface } from "./anpi-talk-adapter.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_MODES = new Set(["local", "shadow"]);

export function normalizeAdapterMode(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (!v) return "local";
  if (v === "real") throw new Error("anpi_adapter_real_disabled");
  if (!ALLOWED_MODES.has(v)) throw new Error("anpi_adapter_invalid_mode");
  return v;
}

export function resolveAdapterModeFromEnv(env = process.env) {
  // Service-side only. Never read URL query / localStorage.
  return normalizeAdapterMode(env.ANPI_TALK_ADAPTER);
}

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

function firstRow(json) {
  return Array.isArray(json) ? json[0] : json;
}

/**
 * Create Real Adapter foundation (shadow/local). Production send is hard-disabled.
 * @param {{ apiUrl: string, serviceKey: string, mode?: string }} opts
 */
export function createRealTalkAdapter(opts) {
  const apiUrl = opts.apiUrl;
  const serviceKey = opts.serviceKey;
  assertLocalApi(apiUrl);
  if (!serviceKey || typeof serviceKey !== "string") {
    throw new Error("anpi_adapter_missing_credentials");
  }
  const mode = normalizeAdapterMode(opts.mode ?? resolveAdapterModeFromEnv());

  if (mode === "local") {
    // Preserve Phase 8 local behavior behind the same interface.
    return createLocalTalkAdapter({ apiUrl, serviceKey });
  }

  return Object.freeze({
    mode: "shadow",
    productionSend: false,

    async health() {
      const json = await rpc(apiUrl, serviceKey, "anpi_phase9_adapter_health", {});
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
          mode: "shadow",
        };
      }
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase9_adapter_dry_run", {
          p_contract: contract,
          p_mode: "shadow",
        }),
      );
      return {
        status: row?.status || null,
        valid: Boolean(row?.valid),
        error_code: row?.error_code ?? null,
        template_key: row?.template_key ?? null,
        idempotency_key: row?.idempotency_key ?? null,
        mode: row?.mode || "shadow",
      };
    },

    async status(idempotencyKey) {
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase9_adapter_status", {
          p_idempotency_key: idempotencyKey,
        }),
      );
      return {
        status: row?.status ?? null,
        provider_message_id: row?.provider_message_id ?? null,
        error_code: row?.error_code ?? null,
        found: Boolean(row?.receipt_found || row?.shadow_found),
        receipt_found: Boolean(row?.receipt_found),
        shadow_found: Boolean(row?.shadow_found),
        template_key: row?.template_key ?? null,
      };
    },

    async cancel(idempotencyKey, reason = "anpi_cancelled") {
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase9_adapter_cancel", {
          p_idempotency_key: idempotencyKey,
          p_reason: String(reason || "anpi_cancelled").slice(0, 64),
          p_now: new Date().toISOString(),
        }),
      );
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
          mode: "shadow",
        };
      }
      const recipient = opts.recipientUserId || null;
      if (!recipient) {
        return {
          status: "failed",
          provider_message_id: null,
          error_code: "anpi_invalid_recipient",
          already_seen: false,
          stub_result: null,
          mode: "shadow",
        };
      }
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase9_adapter_send", {
          p_contract: contract,
          p_recipient_user_id: recipient,
          p_mode: "shadow",
          p_now: new Date().toISOString(),
        }),
      );
      return {
        status: row?.status || null,
        provider_message_id: row?.provider_message_id ?? null,
        error_code: row?.error_code ?? null,
        already_seen: Boolean(row?.already_seen),
        stub_result: row?.stub_result ?? null,
        mode: row?.mode || "shadow",
      };
    },
  });
}

/**
 * Factory: selects local vs shadow from mode / env. Never enables real.
 */
export function createTalkAdapter(opts) {
  const mode = normalizeAdapterMode(opts.mode ?? resolveAdapterModeFromEnv());
  if (mode === "local") {
    return createLocalTalkAdapter(opts);
  }
  return createRealTalkAdapter({ ...opts, mode: "shadow" });
}

export const RealTalkAdapterFoundation = Object.freeze({
  interface: TalkAdapterInterface,
  allowedModes: Object.freeze(["local", "shadow"]),
  productionSend: false,
  writesTalkNotifications: false,
  shadowTable: "anpi_talk_shadow_notifications",
});
