/**
 * AI Execution Gate — ops authorization for Pages Functions (fail-closed).
 * Claim rules mirror scripts/lib/auth-current-user-core.mjs isOpsFromClaims
 * (is_ops OR role === tasu_admin). No body/header role spoof. No new admin secret.
 */

import {
  extractBearerToken,
  pickSupabaseAuthEnv,
} from "./supabase-jwt-auth.mjs";

/**
 * @param {{ is_ops?: unknown, role?: unknown }|null|undefined} claims
 * @returns {boolean}
 */
export function isOpsFromClaims(claims) {
  if (!claims || typeof claims !== "object") return false;
  const isOps =
    claims.is_ops === true ||
    claims.is_ops === "true" ||
    claims.is_ops === 1 ||
    claims.is_ops === "1";
  if (isOps) return true;
  return String(claims.role || "").toLowerCase() === "tasu_admin";
}

/**
 * Verify Bearer via Supabase Auth and require ops claims.
 * Claims: app_metadata merged with top-level user fields (mirrors auth-current-user-core extract).
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<
 *   | { ok: true, userId: string, talkUserId: string, isOps: true }
 *   | { ok: false, error: string, http: number }
 * >}
 */
export async function requireGateOpsUser(request, env, opts = {}) {
  const parsed = extractBearerToken(request);
  if (!parsed.ok) return parsed;

  const { url, anonKey } = pickSupabaseAuthEnv(env);
  if (!url || !anonKey) {
    return { ok: false, error: "auth_unavailable", http: 503 };
  }

  const doFetch = typeof opts.fetchImpl === "function" ? opts.fetchImpl : fetch;
  let data;
  try {
    const res = await doFetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${parsed.token}`,
        apikey: anonKey,
      },
    });
    if (res.status >= 500) {
      return { ok: false, error: "auth_unavailable", http: 503 };
    }
    if (!res.ok) {
      return { ok: false, error: "invalid_token", http: 401 };
    }
    data = await res.json();
  } catch {
    return { ok: false, error: "auth_unavailable", http: 503 };
  }

  const userId = String(data?.id || "").trim();
  if (!userId) {
    return { ok: false, error: "invalid_token", http: 401 };
  }

  const appMeta =
    data?.app_metadata && typeof data.app_metadata === "object"
      ? data.app_metadata
      : {};
  const claims = {
    is_ops: appMeta.is_ops ?? data?.is_ops,
    role: appMeta.role ?? data?.role,
  };
  if (!isOpsFromClaims(claims)) {
    return { ok: false, error: "ops_required", http: 403 };
  }

  const talkUserId = String(
    appMeta.talk_user_id || appMeta.member_id || userId
  ).trim();

  return {
    ok: true,
    userId,
    talkUserId: talkUserId || userId,
    isOps: true,
  };
}
