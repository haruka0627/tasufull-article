/**
 * TASFUL Emergency Kill Switch / Circuit Breaker (Cloudflare Pages Functions).
 * SECURITY > AVAILABILITY · fail-closed for high-risk · AUTO_REENABLE forbidden.
 *
 * SSOT (Phase2 — single authoritative plane for decisions):
 *   AUTHORITATIVE_SECURITY_STATE = Supabase DB (security_circuit_controls / freezes)
 *     when remote is configured and healthy (or 404 = migration not applied → empty closed)
 *   EMERGENCY_OVERRIDE = env latches (TASFUL_CB_*) — OR-open; API cannot clear
 *   CACHE = in-process TTL + optional MEMORY_STORE write-through — NEVER independent truth
 *     when remote is healthy. MEMORY_STORE=1 alone is fixture/local SSOT only.
 *   FRONTEND = read-only consumer of the same loadSecurityCircuitPlane()
 *
 * Conflict resolution (unique):
 *   result.open = env_open OR db_open
 *   memory never forces OPEN when remote healthy; never forces ALLOW when remote unhealthy
 * Process restart: DB (+ env) preserve OPEN; memory-only fixture does NOT survive restart
 */

import { pickSupabaseAuthEnv } from "./supabase-jwt-auth.mjs";
import { buildSupabaseServerHeaders, tryResolveSupabaseServerSecret } from "./supabase-server-secret.mjs";

export const CIRCUIT_SCOPES = Object.freeze([
  "global_maintenance",
  "expensive_api",
  "financial_mutations",
  "service:ai",
  "service:short",
  "service:tlv",
  "service:marketplace",
  "service:builder",
  "service:talk",
  "service:anpi",
  "service:materials",
  "service:site_assistant",
]);

export const HIGH_RISK_CAPABILITIES = Object.freeze([
  "expensive_api",
  "financial_mutations",
  "privileged_admin_mutation",
]);

export const ENV_KEYS = Object.freeze({
  GLOBAL: "TASFUL_CB_GLOBAL",
  EXPENSIVE_API: "TASFUL_CB_EXPENSIVE_API",
  FINANCIAL: "TASFUL_CB_FINANCIAL",
  STATE_JSON: "TASFUL_CB_STATE_JSON",
  MEMORY_STORE: "TASFUL_CB_MEMORY_STORE",
  SERVICE_PREFIX: "TASFUL_CB_SERVICE_",
});

export const MAINTENANCE_PUBLIC_MESSAGE =
  "現在、安全確認のため一時的にサービスを停止しています。ご不便をおかけしますが、しばらくお待ちください。";

export const DENY_CODES = Object.freeze({
  GLOBAL: "circuit_global_maintenance",
  EXPENSIVE: "circuit_expensive_api_open",
  FINANCIAL: "circuit_financial_open",
  SERVICE: "circuit_service_open",
  USER_FREEZE: "user_security_freeze",
  FAIL_CLOSED: "circuit_state_unavailable",
  FORBIDDEN: "circuit_forbidden",
});

export function serviceScope(service) {
  return `service:${String(service || "").trim().toLowerCase()}`;
}

export function requiredScopesFor(input) {
  const capability = String(input?.capability || "").trim();
  const service = String(input?.service || "").trim().toLowerCase();
  const scopes = ["global_maintenance"];
  if (capability === "expensive_api" || capability === "provider_call") {
    scopes.push("expensive_api");
  }
  if (capability === "financial_mutations" || capability === "financial") {
    scopes.push("financial_mutations");
  }
  if (service) scopes.push(serviceScope(service));
  if (capability === "service" && service) scopes.push(serviceScope(service));
  return scopes;
}

export function isHighRiskCapability(capability) {
  const c = String(capability || "").trim();
  return (
    HIGH_RISK_CAPABILITIES.includes(c) ||
    c === "provider_call" ||
    c === "financial"
  );
}

/** @type {{ circuits: Record<string, object>, freezes: Record<string, object>, events: object[] }} */
const memoryStore = {
  circuits: Object.create(null),
  freezes: Object.create(null),
  events: [],
};

/** Non-authoritative short TTL cache (HTML middleware / multi-hit). */
const PLANE_CACHE_TTL_MS = 2500;
/** @type {{ at: number, key: string, plane: object|null }} */
let planeCache = { at: 0, key: "", plane: null };

export function __resetSecurityCircuitMemoryForTests() {
  memoryStore.circuits = Object.create(null);
  memoryStore.freezes = Object.create(null);
  memoryStore.events = [];
  planeCache = { at: 0, key: "", plane: null };
}

export function invalidateSecurityCircuitPlaneCache() {
  planeCache = { at: 0, key: "", plane: null };
}

function planeCacheKey(env) {
  const resolved = tryResolveSupabaseServerSecret(env);
  const credentialIdentity = resolved.ok
    ? `${resolved.credential.credentialType}:${resolved.credential.sourceVariable}:${resolved.credential.secretName}`
    : `invalid:${resolved.error}`;
  return [
    String(env?.[ENV_KEYS.GLOBAL] || ""),
    String(env?.[ENV_KEYS.EXPENSIVE_API] || ""),
    String(env?.[ENV_KEYS.FINANCIAL] || ""),
    String(env?.[ENV_KEYS.STATE_JSON] || "").slice(0, 64),
    String(env?.[ENV_KEYS.MEMORY_STORE] || ""),
    credentialIdentity,
    String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "").slice(0, 40),
  ].join("|");
}

function isExplicitOff(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "" || s === "0" || s === "false" || s === "no" || s === "off";
}

/** Kill latch: unset/off → closed; "1" or any other non-empty → OPEN (fail-closed). */
export function isEnvKillLatchOpen(raw) {
  if (isExplicitOff(raw)) return false;
  return true;
}

function emptyCircuit() {
  return { open: false };
}

/**
 * @param {Record<string, unknown>} env
 */
export function parseEnvCircuitState(env) {
  /** @type {Record<string, { open: boolean, reason_code?: string, source?: string }>} */
  const circuits = Object.create(null);
  for (const scope of CIRCUIT_SCOPES) circuits[scope] = emptyCircuit();

  if (isEnvKillLatchOpen(env?.[ENV_KEYS.GLOBAL])) {
    circuits.global_maintenance = {
      open: true,
      reason_code: "env_latch",
      source: "env",
    };
  }
  if (isEnvKillLatchOpen(env?.[ENV_KEYS.EXPENSIVE_API])) {
    circuits.expensive_api = {
      open: true,
      reason_code: "env_latch",
      source: "env",
    };
  }
  if (isEnvKillLatchOpen(env?.[ENV_KEYS.FINANCIAL])) {
    circuits.financial_mutations = {
      open: true,
      reason_code: "env_latch",
      source: "env",
    };
  }

  for (const scope of CIRCUIT_SCOPES) {
    if (!scope.startsWith("service:")) continue;
    const name = scope.slice("service:".length).toUpperCase().replace(/-/g, "_");
    const key = `${ENV_KEYS.SERVICE_PREFIX}${name}`;
    if (isEnvKillLatchOpen(env?.[key])) {
      circuits[scope] = { open: true, reason_code: "env_latch", source: "env" };
    }
  }

  const rawJson = String(env?.[ENV_KEYS.STATE_JSON] || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      const bag = parsed?.circuits && typeof parsed.circuits === "object" ? parsed.circuits : parsed;
      if (bag && typeof bag === "object") {
        for (const scope of CIRCUIT_SCOPES) {
          const row = bag[scope];
          if (row && (row.open === true || row === true)) {
            circuits[scope] = {
              open: true,
              reason_code: String(row.reason_code || "env_json"),
              source: "env_json",
            };
          }
        }
      }
    } catch {
      /* invalid JSON → ignore env json only; latches still apply */
    }
  }

  return circuits;
}

function memoryEnabled(env) {
  return String(env?.[ENV_KEYS.MEMORY_STORE] || "").trim() === "1";
}

function mergeOpen(a, b) {
  /** @type {Record<string, object>} */
  const out = Object.create(null);
  for (const scope of CIRCUIT_SCOPES) {
    const left = a?.[scope];
    const right = b?.[scope];
    if (left?.open || right?.open) {
      out[scope] = left?.open ? left : right;
    } else {
      out[scope] = emptyCircuit();
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ fetchImpl?: typeof fetch, bypassCache?: boolean }} [opts]
 */
export async function loadSecurityCircuitPlane(env, opts = {}) {
  const cacheKey = planeCacheKey(env || {});
  const now = Date.now();
  if (
    !opts.bypassCache &&
    !opts.fetchImpl &&
    planeCache.plane &&
    planeCache.key === cacheKey &&
    now - planeCache.at < PLANE_CACHE_TTL_MS
  ) {
    return planeCache.plane;
  }

  const envCircuits = parseEnvCircuitState(env);
  const doFetch = typeof opts.fetchImpl === "function" ? opts.fetchImpl : fetch;
  const { url } = pickSupabaseAuthEnv(env);
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  const remoteConfigured = Boolean(url && serviceRoleKey);
  const memOn = memoryEnabled(env);

  /** @type {Record<string, object>} */
  let authoritativeCircuits = Object.create(null);
  for (const scope of CIRCUIT_SCOPES) authoritativeCircuits[scope] = emptyCircuit();
  /** @type {Record<string, object>} */
  let freezes = Object.create(null);
  let remoteOk = true;
  /** @type {string} */
  let source = "env";

  if (remoteConfigured) {
    try {
      const res = await doFetch(
        `${url}/rest/v1/security_circuit_controls?select=scope,open,reason_code,opened_at,opened_by,incident_id,updated_at`,
        {
          headers: buildSupabaseServerHeaders(serverCredential, { accept: "application/json" }),
        },
      );
      // Table not applied yet → treat as empty closed DB (not integrity failure).
      if (res.status === 404 || res.status === 406) {
        remoteOk = true;
        source = "env+remote_pending";
      } else if (!res.ok) {
        remoteOk = false;
        source = "unknown";
      } else {
        const rows = await res.json();
        if (!Array.isArray(rows)) {
          remoteOk = false;
          source = "unknown";
        } else {
          source = "env+remote";
          for (const row of rows) {
            const scope = String(row?.scope || "");
            if (!CIRCUIT_SCOPES.includes(scope)) continue;
            if (row.open === true) {
              authoritativeCircuits[scope] = {
                open: true,
                reason_code: String(row.reason_code || "remote"),
                source: "remote",
                opened_at: row.opened_at,
                opened_by: row.opened_by,
                incident_id: row.incident_id,
              };
            }
          }
          // Write-through cache only — does not become independent truth on next healthy load.
          if (memOn) {
            memoryStore.circuits = { ...authoritativeCircuits };
          }
        }
      }

      if (remoteOk && res.ok) {
        const fr = await doFetch(
          `${url}/rest/v1/security_user_freezes?select=user_id,frozen,scopes,reason_code&frozen=eq.true`,
          {
            headers: buildSupabaseServerHeaders(serverCredential, { accept: "application/json" }),
          },
        );
        if (fr.status === 404 || fr.status === 406) {
          /* pending */
        } else if (fr.ok) {
          const frows = await fr.json();
          if (Array.isArray(frows)) {
            for (const row of frows) {
              const uid = String(row.user_id || "").trim();
              if (!uid) continue;
              freezes[uid] = {
                frozen: true,
                scopes: Array.isArray(row.scopes)
                  ? row.scopes
                  : ["expensive_api", "financial_mutations"],
                reason_code: String(row.reason_code || "user_freeze"),
              };
            }
            if (memOn) memoryStore.freezes = { ...freezes };
          }
        }
      }
    } catch {
      remoteOk = false;
      source = "unknown";
    }
    // When remote unhealthy: do NOT trust memory CLOSED to allow; fail-closed via ok=false.
    // Optional: merge memory OPEN hints only for diagnostics — evaluation already fails closed.
  } else if (memOn) {
    // Fixture / local SSOT when no service_role remote.
    authoritativeCircuits = mergeOpen(authoritativeCircuits, memoryStore.circuits);
    freezes = { ...memoryStore.freezes };
    source = "env+memory";
  }

  const circuits = mergeOpen(envCircuits, authoritativeCircuits);
  const plane = {
    ok: remoteConfigured ? remoteOk : true,
    remoteConfigured,
    circuits,
    freezes,
    source,
    ssot: {
      AUTHORITATIVE_SECURITY_STATE: remoteConfigured ? "db" : memOn ? "memory_fixture" : "env_only",
      EMERGENCY_OVERRIDE: "env_latch",
      CACHE: "ttl_and_optional_memory_write_through",
      FRONTEND: "read_only_same_plane",
    },
  };

  if (!opts.fetchImpl) {
    planeCache = { at: now, key: cacheKey, plane };
  }
  return plane;
}

/**
 * @param {object} plane
 * @param {{ capability: string, service?: string, userId?: string }} input
 */
export function evaluateSecurityCircuit(plane, input) {
  const capability = String(input?.capability || "").trim();
  const userId = String(input?.userId || "").trim();
  const scopes = requiredScopesFor(input);

  if (!plane?.ok && isHighRiskCapability(capability)) {
    return {
      allowed: false,
      code: DENY_CODES.FAIL_CLOSED,
      http: 503,
      scope: "control_plane",
    };
  }

  for (const scope of scopes) {
    if (plane?.circuits?.[scope]?.open) {
      let code = DENY_CODES.SERVICE;
      if (scope === "global_maintenance") code = DENY_CODES.GLOBAL;
      else if (scope === "expensive_api") code = DENY_CODES.EXPENSIVE;
      else if (scope === "financial_mutations") code = DENY_CODES.FINANCIAL;
      return {
        allowed: false,
        code,
        http: 503,
        scope,
        reason_code: plane.circuits[scope].reason_code,
      };
    }
  }

  if (userId && plane?.freezes?.[userId]?.frozen) {
    const fz = plane.freezes[userId];
    const scopesFz = Array.isArray(fz.scopes) ? fz.scopes : [];
    /** @type {string[]} */
    const needed = [];
    if (capability === "expensive_api" || capability === "provider_call") {
      needed.push("expensive_api");
    }
    if (capability === "financial_mutations" || capability === "financial") {
      needed.push("financial_mutations");
    }
    if (
      needed.length &&
      (scopesFz.includes("*") || needed.some((s) => scopesFz.includes(s)))
    ) {
      return {
        allowed: false,
        code: DENY_CODES.USER_FREEZE,
        http: 403,
        scope: "user_freeze",
        reason_code: fz.reason_code,
      };
    }
  }

  return { allowed: true };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ capability: string, service?: string, userId?: string, fetchImpl?: typeof fetch }} input
 */
export async function assertSecurityCircuitAllows(env, input) {
  const plane = await loadSecurityCircuitPlane(env, { fetchImpl: input.fetchImpl });
  const decision = evaluateSecurityCircuit(plane, input);
  return { ...decision, plane };
}

function pushEvent(entry) {
  memoryStore.events.push(entry);
  if (memoryStore.events.length > 200) memoryStore.events.shift();
}

/**
 * Persist circuit open/close. Reenable never automatic.
 * @param {Record<string, unknown>} env
 * @param {{
 *   action: "open"|"close",
 *   scope: string,
 *   actorUserId: string,
 *   reasonCode: string,
 *   reviewNote?: string,
 *   incidentId?: string,
 *   confirm: boolean,
 *   fetchImpl?: typeof fetch,
 * }} cmd
 */
export async function mutateSecurityCircuit(env, cmd) {
  const action = String(cmd?.action || "").trim();
  const scope = String(cmd?.scope || "").trim();
  if (!CIRCUIT_SCOPES.includes(scope)) {
    return { ok: false, error: "invalid_scope", http: 400 };
  }
  if (cmd?.confirm !== true) {
    return { ok: false, error: "confirmation_required", http: 400 };
  }
  if (action === "close") {
    const note = String(cmd?.reviewNote || "").trim();
    if (note.length < 8) {
      return { ok: false, error: "review_note_required", http: 400 };
    }
  }
  if (action !== "open" && action !== "close") {
    return { ok: false, error: "invalid_action", http: 400 };
  }

  if (action === "open" && scope === "global_maintenance") {
    const reason = String(cmd.reasonCode || "").trim();
    if (reason.length < 4) {
      return { ok: false, error: "global_reason_required", http: 400 };
    }
  }

  // Env latches cannot be cleared by API (Human must clear env) — refuse close if env forces open
  if (action === "close") {
    const envOnly = parseEnvCircuitState(env);
    if (envOnly[scope]?.open) {
      return { ok: false, error: "env_latch_blocks_reenable", http: 409 };
    }
  }

  const open = action === "open";
  const row = {
    scope,
    open,
    reason_code: String(cmd.reasonCode || (open ? "ops_manual_open" : "ops_manual_reenable")).slice(0, 120),
    opened_at: open ? new Date().toISOString() : null,
    opened_by: open ? cmd.actorUserId : null,
    closed_at: open ? null : new Date().toISOString(),
    closed_by: open ? null : cmd.actorUserId,
    review_note: open ? null : String(cmd.reviewNote || "").slice(0, 2000),
    incident_id: cmd.incidentId ? String(cmd.incidentId).slice(0, 120) : null,
    updated_at: new Date().toISOString(),
  };

  if (memoryEnabled(env)) {
    memoryStore.circuits[scope] = open
      ? { open: true, reason_code: row.reason_code, source: "memory_cache", opened_by: cmd.actorUserId }
      : emptyCircuit();
  }
  invalidateSecurityCircuitPlaneCache();

  const eventType =
    scope === "global_maintenance"
      ? open
        ? "GLOBAL_MAINTENANCE_ON"
        : "GLOBAL_MAINTENANCE_OFF"
      : scope.startsWith("service:")
        ? open
          ? "SERVICE_FREEZE"
          : "SERVICE_UNFREEZE"
        : open
          ? "CIRCUIT_OPEN"
          : "CIRCUIT_CLOSE";

  const event = {
    at: new Date().toISOString(),
    event_type: eventType,
    scope,
    actor_type: "ops",
    actor_user_id: cmd.actorUserId,
    reason_code: row.reason_code,
    incident_id: row.incident_id,
  };
  pushEvent(event);

  const { url } = pickSupabaseAuthEnv(env);
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  if (url && serviceRoleKey) {
    const doFetch = typeof cmd.fetchImpl === "function" ? cmd.fetchImpl : fetch;
    try {
      const res = await doFetch(`${url}/rest/v1/security_circuit_controls`, {
        method: "POST",
        headers: buildSupabaseServerHeaders(serverCredential, {
          contentType: "application/json",
          prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(row),
      });
      if (!res.ok && !memoryEnabled(env)) {
        return { ok: false, error: "persistence_failed", http: 503 };
      }
      await doFetch(`${url}/rest/v1/security_circuit_events`, {
        method: "POST",
        headers: buildSupabaseServerHeaders(serverCredential, {
          contentType: "application/json",
          prefer: "return=minimal",
        }),
        body: JSON.stringify({
          event_type: event.event_type,
          scope: event.scope,
          actor_type: event.actor_type,
          actor_user_id: event.actor_user_id,
          reason_code: event.reason_code,
          incident_id: event.incident_id,
          created_at: event.at,
        }),
      }).catch(() => null);
    } catch {
      if (!memoryEnabled(env)) {
        return { ok: false, error: "persistence_failed", http: 503 };
      }
    }
  } else if (!memoryEnabled(env)) {
    return { ok: false, error: "persistence_unavailable", http: 503 };
  }

  return { ok: true, scope, open, event };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{
 *   action: "freeze"|"unfreeze",
 *   userId: string,
 *   actorUserId: string,
 *   reasonCode: string,
 *   scopes?: string[],
 *   reviewNote?: string,
 *   confirm: boolean,
 *   fetchImpl?: typeof fetch,
 * }} cmd
 */
export async function mutateUserSecurityFreeze(env, cmd) {
  const action = String(cmd?.action || "").trim();
  const userId = String(cmd?.userId || "").trim();
  if (!userId) return { ok: false, error: "user_id_required", http: 400 };
  if (cmd?.confirm !== true) return { ok: false, error: "confirmation_required", http: 400 };
  if (action === "unfreeze") {
    const note = String(cmd?.reviewNote || "").trim();
    if (note.length < 8) return { ok: false, error: "review_note_required", http: 400 };
  }
  if (action !== "freeze" && action !== "unfreeze") {
    return { ok: false, error: "invalid_action", http: 400 };
  }

  const scopes = Array.isArray(cmd.scopes) && cmd.scopes.length
    ? cmd.scopes.map(String)
    : ["expensive_api", "financial_mutations"];
  const frozen = action === "freeze";

  if (memoryEnabled(env)) {
    if (frozen) {
      memoryStore.freezes[userId] = {
        frozen: true,
        scopes,
        reason_code: String(cmd.reasonCode || "ops_user_freeze").slice(0, 120),
      };
    } else {
      delete memoryStore.freezes[userId];
    }
  }
  invalidateSecurityCircuitPlaneCache();

  const event = {
    at: new Date().toISOString(),
    event_type: frozen ? "USER_FREEZE" : "USER_UNFREEZE",
    scope: "user_freeze",
    actor_type: "ops",
    actor_user_id: cmd.actorUserId,
    target_user_id: userId,
    reason_code: String(cmd.reasonCode || "").slice(0, 120),
  };
  pushEvent(event);

  const { url } = pickSupabaseAuthEnv(env);
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  if (url && serviceRoleKey) {
    const doFetch = typeof cmd.fetchImpl === "function" ? cmd.fetchImpl : fetch;
    try {
      await doFetch(`${url}/rest/v1/security_user_freezes`, {
        method: "POST",
        headers: buildSupabaseServerHeaders(serverCredential, {
          contentType: "application/json",
          prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify({
          user_id: userId,
          frozen,
          scopes,
          reason_code: event.reason_code,
          updated_at: new Date().toISOString(),
          updated_by: cmd.actorUserId,
          review_note: frozen ? null : String(cmd.reviewNote || "").slice(0, 2000),
        }),
      });
    } catch {
      if (!memoryEnabled(env)) return { ok: false, error: "persistence_failed", http: 503 };
    }
  } else if (!memoryEnabled(env)) {
    return { ok: false, error: "persistence_unavailable", http: 503 };
  }

  return { ok: true, userId, frozen, event };
}

export function listMemorySecurityEvents() {
  return memoryStore.events.slice();
}

export function maintenanceHtmlResponse() {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>一時停止 | TASFUL</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1419;color:#e8eef5}
    main{max-width:28rem;padding:2rem;text-align:center}
    h1{font-size:1.25rem;font-weight:600;margin:0 0 .75rem}
    p{margin:0;line-height:1.6;opacity:.9}
  </style>
</head>
<body>
  <main>
    <h1>TASFUL</h1>
    <p>${MAINTENANCE_PUBLIC_MESSAGE}</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "300",
    },
  });
}
