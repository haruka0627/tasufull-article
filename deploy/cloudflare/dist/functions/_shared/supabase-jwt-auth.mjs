/**
 * Shared Supabase JWT auth for Pages Functions (fail-closed).
 *
 * Error contract (Phase 3-A):
 *   auth_required    401 — missing / empty Bearer
 *   invalid_token    401 — malformed / expired / rejected JWT
 *   auth_unavailable 503 — Auth provider / config failure
 *   user_mismatch    403 — claimed user id ≠ verified JWT subject
 */

export function pickSupabaseAuthEnv(env) {
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(env?.TASFUL_SUPABASE_ANON_KEY || env?.SUPABASE_ANON_KEY || "").trim();
  return { url, anonKey };
}

export function extractBearerToken(request) {
  const raw = String(request?.headers?.get?.("Authorization") || "").trim();
  if (!raw) return { ok: false, error: "auth_required", http: 401 };
  const m = raw.match(/^Bearer\s+(\S+)$/i);
  if (!m) return { ok: false, error: "auth_required", http: 401 };
  const token = String(m[1] || "").trim();
  if (!token || token.toLowerCase() === "bearer") {
    return { ok: false, error: "auth_required", http: 401 };
  }
  return { ok: true, token };
}

/**
 * Verify access token via Supabase Auth /auth/v1/user (decode-only forbidden).
 * @returns {Promise<{ ok: true, userId: string, talkUserId: string } | { ok: false, error: string, http: number }>}
 */
export async function verifySupabaseAccessToken(bearerToken, supabaseUrl, anonKey, fetchImpl) {
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : fetch;
  if (!bearerToken) return { ok: false, error: "auth_required", http: 401 };
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: "auth_unavailable", http: 503 };
  }
  try {
    const res = await doFetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: anonKey,
      },
    });
    if (res.status >= 500) {
      return { ok: false, error: "auth_unavailable", http: 503 };
    }
    if (!res.ok) {
      return { ok: false, error: "invalid_token", http: 401 };
    }
    let data;
    try {
      data = await res.json();
    } catch {
      return { ok: false, error: "auth_unavailable", http: 503 };
    }
    const userId = String(data?.id || "").trim();
    if (!userId) {
      return { ok: false, error: "invalid_token", http: 401 };
    }
    const talkUserId = String(
      data?.app_metadata?.talk_user_id ||
        data?.app_metadata?.member_id ||
        userId,
    ).trim();
    return { ok: true, userId, talkUserId };
  } catch {
    return { ok: false, error: "auth_unavailable", http: 503 };
  }
}

/**
 * Full request auth: Bearer parse → Auth verify → optional claimed-user mismatch.
 * Never trusts client user id; returns verified userId only.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @param {{ claimedUserId?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function requireSupabaseUser(request, env, opts = {}) {
  const parsed = extractBearerToken(request);
  if (!parsed.ok) return parsed;

  const { url, anonKey } = pickSupabaseAuthEnv(env);
  if (!url || !anonKey) {
    return { ok: false, error: "auth_unavailable", http: 503 };
  }

  const verified = await verifySupabaseAccessToken(
    parsed.token,
    url,
    anonKey,
    opts.fetchImpl,
  );
  if (!verified.ok) return verified;

  const claimed = String(opts.claimedUserId || "").trim();
  if (claimed && claimed !== verified.userId) {
    return { ok: false, error: "user_mismatch", http: 403 };
  }

  return {
    ok: true,
    userId: verified.userId,
    talkUserId: verified.talkUserId || verified.userId,
  };
}

export function authCorsHeaders(methods = "POST, OPTIONS") {
  return {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
