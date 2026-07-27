/**
 * ANPI Talk Write Path Foundation (Phase 10) — local-only, user-invisible.
 *
 * Phase 8 interface compatible: send | cancel | status | health | dryRun
 * Feature flag: ANPI_TALK_ADAPTER=local|shadow|real_dry (real HARD-DISABLED).
 *
 * real_dry: resolve recipient + validate + map + dedup + would_insert. It NEVER
 * writes public.talk_notifications, never increments unread, never Push/Realtime.
 * The guarded real INSERT (anpi_talk_notification_create_internal) is only ever
 * reachable via local rollback SQL fixtures with p_local_test=true, never here.
 */

import { validateContract } from "./anpi-talk-contract.mjs";
import { createTalkAdapter } from "./anpi-talk-real-adapter.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_MODES = new Set(["local", "shadow", "real_dry"]);

export function normalizeWriteMode(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "local";
  if (v === "real") throw new Error("anpi_talk_real_write_disabled");
  if (!ALLOWED_MODES.has(v)) throw new Error("anpi_talk_invalid_mode");
  return v;
}

export function resolveWriteModeFromEnv(env = process.env) {
  // Service-side only. Never read URL query / localStorage / client input.
  return normalizeWriteMode(env.ANPI_TALK_ADAPTER);
}

function assertLocalApi(apiUrl) {
  const url = new URL(String(apiUrl || ""));
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("anpi_write_path_non_local");
  }
  if (url.origin !== "http://127.0.0.1:54321") {
    throw new Error("anpi_write_path_expected_local_api");
  }
}

async function rpc(apiUrl, serviceKey, name, args, timeoutMs = 8000) {
  assertLocalApi(apiUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      // Never surface payloads/UUIDs; only a short safe code.
      const code = json?.code || json?.message || `HTTP_${res.status}`;
      throw new Error(`write_path_rpc_${name}:${String(code).slice(0, 80)}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function firstRow(json) {
  return Array.isArray(json) ? json[0] : json;
}

/**
 * Create the Phase 10 write-path adapter.
 * local -> Phase 8/9 stub · shadow -> Phase 9 shadow · real_dry -> dry write.
 * real is never constructable.
 * @param {{ apiUrl: string, serviceKey: string, mode?: string }} opts
 */
export function createWritePathAdapter(opts) {
  const apiUrl = opts.apiUrl;
  const serviceKey = opts.serviceKey;
  assertLocalApi(apiUrl);
  if (!serviceKey || typeof serviceKey !== "string") {
    throw new Error("anpi_write_path_missing_credentials");
  }
  const mode = normalizeWriteMode(opts.mode ?? resolveWriteModeFromEnv());

  // local / shadow delegate to the Phase 9 adapter (unchanged interface).
  if (mode !== "real_dry") {
    return createTalkAdapter({ apiUrl, serviceKey, mode });
  }

  return Object.freeze({
    mode: "real_dry",
    productionSend: false,
    stagingSend: false,
    writesTalkNotifications: false,

    async health() {
      const json = await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_health", {});
      return json && typeof json === "object" ? json : { ok: false };
    },

    // dryRun validates contract locally, then resolves would_insert via job.
    async dryRun(jobId) {
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_dry_run", {
          p_job_id: jobId,
        }),
      );
      return {
        status: row?.status ?? null,
        would_insert: Boolean(row?.would_insert),
        talk_notification_id: row?.talk_notification_id ?? null,
        error_code: row?.error_code ?? null,
        talk_table_present: Boolean(row?.talk_table_present),
        already_written: Boolean(row?.already_written),
        mode: "real_dry",
      };
    },

    // send() in real_dry performs the dry write path only (no inbox INSERT).
    async send(contract, sendOpts = {}) {
      const err = validateContract(contract);
      if (err) {
        return {
          status: "failed",
          would_insert: false,
          talk_notification_id: null,
          error_code: err,
          mode: "real_dry",
        };
      }
      const jobId = sendOpts.schedulerJobId || contract?.scheduler_job_id || null;
      if (!jobId) {
        return {
          status: "failed",
          would_insert: false,
          talk_notification_id: null,
          error_code: "anpi_missing_scheduler_job",
          mode: "real_dry",
        };
      }
      const out = await rpc(apiUrl, serviceKey, "anpi_phase10_write_for_job", {
        p_job_id: jobId,
        p_mode: "real_dry",
      });
      const res = out && typeof out === "object" && !Array.isArray(out) ? out : firstRow(out) || {};
      return {
        status: res?.status ?? null,
        would_insert: Boolean(res?.would_insert),
        talk_notification_id: res?.talk_notification_id ?? null,
        error_code: res?.error_code ?? null,
        mode: "real_dry",
      };
    },

    async status(idempotencyKey) {
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_status", {
          p_idempotency_key: idempotencyKey,
        }),
      );
      return {
        status: row?.status ?? null,
        talk_notification_id: row?.talk_notification_id ?? null,
        talk_user_bound: Boolean(row?.talk_user_bound),
        cancel_reason_code: row?.cancel_reason_code ?? null,
        found: Boolean(row?.link_found),
        mode: "real_dry",
      };
    },

    async cancel(idempotencyKey, reason = "anpi_cancelled") {
      const row = firstRow(
        await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_cancel", {
          p_idempotency_key: idempotencyKey,
          p_reason: String(reason || "anpi_cancelled").replace(/[^a-z0-9_]/gi, "_").slice(0, 64),
          p_now: new Date().toISOString(),
        }),
      );
      return {
        status: row?.status || "cancelled",
        already_terminal: Boolean(row?.already_terminal),
      };
    },
  });
}

/**
 * Factory: selects local | shadow | real_dry from mode / env. real is refused.
 */
export function createWritePath(opts) {
  const mode = normalizeWriteMode(opts.mode ?? resolveWriteModeFromEnv());
  return createWritePathAdapter({ ...opts, mode });
}

export const WritePathFoundation = Object.freeze({
  allowedModes: Object.freeze(["local", "shadow", "real_dry"]),
  realModeEnabled: false,
  productionSend: false,
  stagingSend: false,
  writesTalkNotifications: false,
  userFacingInbox: false,
  realtime: false,
  push: false,
  targetUrlPolicy: "fixed_hash_no_url",
  identityMapping: "anpi_resolve_talk_user_id",
  sidecarLedger: "anpi_talk_notification_links",
});
