/**
 * ANPI Phase 59 — Staging controlled real inbox write (orchestration).
 *
 * Reuses existing Phase 17 staging gate/writer (no new provider / architecture).
 * Phase 10 job writer remains hard-disabled; Cloudflare Cron stays on talk_local*.
 *
 * Fail-closed: Production ref refused · flag default OFF · max 1 insert ·
 * emergency_disable + cleanup on exit.
 */

import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";
import { validateContract, buildNotificationContract } from "./anpi-talk-contract.mjs";

export const ANPI_P59_STAGING_REF = STAGING_SUPABASE_REF;
export const ANPI_P59_PRODUCTION_REF = PRODUCTION_SUPABASE_REF;
export const ANPI_P59_IDEMPOTENCY_KEY = "anpi-phase59-controlled-write-v1";
export const ANPI_P59_SOURCE = "anpi_phase17_test"; // existing writer marker
export const ANPI_P59_TYPE = "anpi";
export const ANPI_P59_TARGET_URL = "#";
export const ANPI_P59_TARGET_AUTH_SHA8 = "0411f04d";
export const ANPI_P59_TARGET_TALK_SHA16 = "88d3dbfacf62520b";

export function extractProjectRef(apiUrl) {
  try {
    const host = new URL(String(apiUrl || "")).hostname || "";
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    if (m) return m[1];
    if (host === "127.0.0.1" || host === "localhost") return "local";
    return host || "";
  } catch {
    return "";
  }
}

export function assertStagingApiUrl(apiUrl) {
  const url = String(apiUrl || "");
  if (!url) throw new Error("anpi_p59_missing_apiUrl");
  if (url.includes(ANPI_P59_PRODUCTION_REF)) {
    throw new Error("anpi_p59_refusing_production_endpoint");
  }
  const ref = extractProjectRef(apiUrl);
  if (ref === ANPI_P59_PRODUCTION_REF) {
    throw new Error("anpi_p59_refusing_production_project_ref");
  }
  if (ref !== ANPI_P59_STAGING_REF) {
    throw new Error("anpi_p59_unexpected_project_ref");
  }
  return ref;
}

export function assertEnvProjectRef(envRef) {
  const ref = String(envRef || "").trim();
  if (!ref) throw new Error("anpi_p59_missing_env_project_ref");
  if (ref === ANPI_P59_PRODUCTION_REF) {
    throw new Error("anpi_p59_env_production_ref");
  }
  if (ref !== ANPI_P59_STAGING_REF) {
    throw new Error("anpi_p59_env_unexpected_ref");
  }
  return ref;
}

export function sha16(value) {
  // Node crypto used by callers when available; placeholder for pure tests.
  return String(value || "");
}

export function expectedNotificationIdPrefix() {
  return "anpi-p17-";
}

export function validatePhase58ShapeContract() {
  const contract = buildNotificationContract({
    id: "00000000-0000-4000-8000-000000000059",
    kind: "initial",
    check_id: "00000000-0000-4000-8000-000000000001",
    subject_user_id: "00000000-0000-4000-8000-000000000002",
    attempt_count: 1,
    idempotency_key: ANPI_P59_IDEMPOTENCY_KEY,
  });
  const err = validateContract(contract);
  return { ok: err == null, error: err, contract };
}

export function evaluateRowShape(row) {
  const findings = [];
  const checks = [
    ["type_anpi", row?.type === ANPI_P59_TYPE],
    ["target_url_hash", row?.target_url === ANPI_P59_TARGET_URL],
    ["source_marker", row?.source === ANPI_P59_SOURCE],
    ["id_prefix", String(row?.id || "").startsWith(expectedNotificationIdPrefix())],
    ["no_http_in_body", !/https?:\/\//i.test(String(row?.body || ""))],
    ["no_http_in_title", !/https?:\/\//i.test(String(row?.title || ""))],
  ];
  for (const [name, pass] of checks) findings.push({ check: name, pass: Boolean(pass) });
  return { ok: findings.every((f) => f.pass), findings };
}

/**
 * Minimal REST client — never logs secrets.
 */
export function createStagingRestClient({ apiUrl, serviceKey, anonKey }) {
  assertStagingApiUrl(apiUrl);
  if (!serviceKey) throw new Error("anpi_p59_missing_serviceKey");

  async function rpc(name, args = {}, key = serviceKey) {
    const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
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
    return { ok: res.ok, status: res.status, json, code: json?.code || json?.message || null };
  }

  async function rest(path, { method = "GET", key = serviceKey, body, headers = {} } = {}) {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text: text.slice(0, 400) };
  }

  async function authAdmin(path, { method = "GET", body } = {}) {
    const res = await fetch(`${apiUrl}/auth/v1${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  }

  return Object.freeze({
    apiUrl,
    anonKey: anonKey || null,
    rpc,
    rest,
    authAdmin,
    async enableFlag() {
      return rpc("anpi_phase17_enable_flag");
    },
    async emergencyDisable() {
      return rpc("anpi_phase17_emergency_disable");
    },
    async insert({ dryRun, forceKey = ANPI_P59_IDEMPOTENCY_KEY } = {}) {
      return rpc("anpi_phase17_insert_first_test_notification", {
        p_dry_run: dryRun !== false,
        p_force_idempotency_key: forceKey,
      });
    },
    async cleanup({ dryRun } = {}) {
      return rpc("anpi_phase17_cleanup_first_test_notification", {
        p_dry_run: dryRun !== false,
      });
    },
    async polling() {
      return rpc("anpi_phase17_polling_reader_dry_run");
    },
    async phase10Health() {
      return rpc("anpi_phase10_talk_write_health");
    },
    async setGateIdempotencyKey(key) {
      return rest("/rest/v1/anpi_phase17_insert_gate?id=eq.1", {
        method: "PATCH",
        body: { idempotency_key: key },
      });
    },
    async readGate() {
      return rest(
        "/rest/v1/anpi_phase17_insert_gate?id=eq.1&select=id,enabled,target_auth_sha8,idempotency_key,inserted_count,max_inserts,last_notification_id,target_auth_user_id,target_talk_user_id"
      );
    },
  });
}

export function firstRpcRow(result) {
  const j = result?.json;
  if (Array.isArray(j)) return j[0] || null;
  return j;
}
