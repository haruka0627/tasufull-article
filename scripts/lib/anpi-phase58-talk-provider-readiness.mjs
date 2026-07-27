/**
 * ANPI Phase 58 — Talk notification provider readiness (staging-safe).
 *
 * Canonical Production path (design):
 *   Phase 6 claim/process → Phase 10 talk_notifications writer
 *   (type=anpi, target_url='#', official_anpi presentation on client)
 *
 * Current Production send: DISABLED (anpi_talk_real_write_disabled).
 * Current staging periodic path: talk_local* via Cloudflare Cron (Phase 56/57).
 *
 * This module does NOT enable real inbox writes. It verifies foundation health,
 * contract safety, and mode gates.
 */

import {
  ANPI_TALK_TEMPLATES,
  buildNotificationContract,
  validateContract,
  templateForKind,
} from "./anpi-talk-contract.mjs";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";

export const ANPI_OFFICIAL_ROOM_ID = "official_anpi";
export const ANPI_TALK_NOTIFICATION_TYPE = "anpi";
export const ANPI_TARGET_URL_POLICY = "fixed_hash_no_url"; // always '#'
export const ANPI_STUB_PROVIDER_PREFIX = "talk_local";
export const ANPI_WRITE_PROVIDER = "talk_write";

export const ANPI_NOTIFY_KINDS = Object.freeze([
  "initial",
  "reminder",
  "contact_unconfirmed",
  "late_confirmation",
]);

function extractProjectRef(apiUrl) {
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

export function assertStagingOrLocalApi(apiUrl) {
  const url = String(apiUrl || "");
  if (!url) throw new Error("anpi_p58_missing_apiUrl");
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error("anpi_p58_refusing_production_endpoint");
  }
  const ref = extractProjectRef(apiUrl);
  if (ref === PRODUCTION_SUPABASE_REF) {
    throw new Error("anpi_p58_refusing_production_project_ref");
  }
  if (ref !== "local" && ref !== STAGING_SUPABASE_REF) {
    throw new Error("anpi_p58_unexpected_project_ref");
  }
  return ref;
}

/**
 * Providers allowed for Phase 48/56 periodic runtime today.
 * Real talk_write is NOT allowed until Production/staging real mode is explicitly enabled.
 */
export function isAllowedRuntimeProvider(provider, { allowWriteProvider = false } = {}) {
  const p = String(provider || "");
  if (!p) return false;
  if (p.startsWith(ANPI_STUB_PROVIDER_PREFIX)) return true;
  if (allowWriteProvider && (p === ANPI_WRITE_PROVIDER || p === "talk")) return true;
  return false;
}

export function validateRuntimeProviders(providers, opts = {}) {
  const list = Array.isArray(providers) ? providers : [];
  const bad = list.filter((p) => !isAllowedRuntimeProvider(p, opts));
  return {
    ok: bad.length === 0,
    providers: [...new Set(list.map(String))].sort(),
    nonAllowed: bad,
    allowWriteProvider: Boolean(opts.allowWriteProvider),
  };
}

/**
 * Build + validate contracts for all ANPI notify kinds (ids only, no PII/URLs).
 */
export function buildAndValidateKindContracts(sample = {}) {
  const checkId = sample.check_id || "00000000-0000-4000-8000-000000000001";
  const ownerId = sample.owner_id || "00000000-0000-4000-8000-000000000002";
  const out = [];
  for (const kind of ANPI_NOTIFY_KINDS) {
    const job = {
      id: sample[`job_${kind}`] || `00000000-0000-4000-8000-00000000000${ANPI_NOTIFY_KINDS.indexOf(kind) + 3}`,
      kind,
      check_id: checkId,
      subject_user_id: ownerId,
      attempt_count: 1,
      idempotency_key: `anpi:p58:${kind}:1`,
    };
    const template = templateForKind(kind);
    const contract = buildNotificationContract(job);
    const err = validateContract(contract);
    out.push({
      kind,
      template_key: template,
      contract_ok: err == null,
      error: err,
      channel: contract.channel,
      actions: contract.actions,
    });
  }
  return out;
}

/**
 * Evaluate Phase 10 health payload for provider readiness.
 */
export function evaluateTalkWriteHealth(health) {
  const h = health && typeof health === "object" ? health : {};
  const findings = [];
  const req = [
    ["ok", h.ok === true],
    ["adapter_talk_write_path", h.adapter === "talk_write_path"],
    ["talk_table_present", h.talk_table_present === true],
    ["target_url_fixed_hash", h.target_url_policy === "fixed_hash_no_url" || ANPI_TARGET_URL_POLICY === "fixed_hash_no_url"],
    ["production_send_false", h.production_send === false],
    ["staging_send_false", h.staging_send === false],
    ["user_facing_inbox_write_false", h.user_facing_inbox_write === false],
    ["real_mode_enabled_false", h.real_mode_enabled === false],
    ["push_false", h.push === false],
    ["realtime_false", h.realtime === false],
    ["identity_mapping", Boolean(h.identity_mapping)],
    ["sidecar_ledger", h.sidecar_ledger === true],
  ];
  for (const [name, pass] of req) {
    findings.push({ check: name, pass: Boolean(pass) });
  }
  const contracts = buildAndValidateKindContracts();
  const contractsOk = contracts.every((c) => c.contract_ok);
  findings.push({ check: "all_kind_contracts_valid", pass: contractsOk });

  const foundationOk = findings.every((f) => f.pass);
  return {
    foundation_ok: foundationOk,
    official_room_id: ANPI_OFFICIAL_ROOM_ID,
    notification_type: ANPI_TALK_NOTIFICATION_TYPE,
    target_url_policy: ANPI_TARGET_URL_POLICY,
    stub_provider_prefix: ANPI_STUB_PROVIDER_PREFIX,
    write_provider: ANPI_WRITE_PROVIDER,
    templates: Object.keys(ANPI_TALK_TEMPLATES),
    kinds: [...ANPI_NOTIFY_KINDS],
    contracts,
    findings,
    /** Design is ready; real user-facing send is intentionally off. */
    design_ready: foundationOk,
    staging_real_send_ready: false,
    production_real_send_ready: false,
    periodic_runtime_provider: "talk_local*",
    canonical_path:
      "anpi_phase6_claim/process → anpi_phase10 talk_notifications writer (type=anpi, target_url='#')",
  };
}

async function rpc(apiUrl, serviceKey, name, args = {}) {
  assertStagingOrLocalApi(apiUrl);
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
    throw new Error(`anpi_p58_rpc_${name}:${String(code).slice(0, 100)}`);
  }
  return json;
}

/**
 * Staging/local probe: health + real-mode hard-disable check. Never enables send.
 */
export async function probeTalkProviderReadiness({ apiUrl, serviceKey }) {
  assertStagingOrLocalApi(apiUrl);
  if (!serviceKey) throw new Error("anpi_p58_missing_serviceKey");

  const health = await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_health", {});
  const evaluated = evaluateTalkWriteHealth(health);

  let realModeBlocked = false;
  let realModeError = null;
  try {
    await rpc(apiUrl, serviceKey, "anpi_phase10_write_for_job", {
      p_job_id: "00000000-0000-0000-0000-000000000001",
      p_mode: "real",
    });
  } catch (err) {
    const msg = String(err?.message || err);
    realModeBlocked = msg.includes("anpi_talk_real_write_disabled") || msg.includes("22023");
    realModeError = msg.slice(0, 120);
  }

  evaluated.findings.push({ check: "real_mode_hard_disabled", pass: realModeBlocked });
  evaluated.foundation_ok = evaluated.findings.every((f) => f.pass);
  evaluated.design_ready = evaluated.foundation_ok;
  evaluated.real_mode_probe = { blocked: realModeBlocked, error: realModeError };
  evaluated.project_ref = extractProjectRef(apiUrl);
  evaluated.probed_at = new Date().toISOString();
  return evaluated;
}
