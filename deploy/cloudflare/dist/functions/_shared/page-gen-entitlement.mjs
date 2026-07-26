/**
 * Platform AI Page Gen — server entitlement (reuse GenAI paid subscription).
 *
 * SSOT: gen_ai_subscriptions via service_role.
 * Client flags (isPaid / plan / entitled) are never trusted.
 * JWT user id from /auth/v1/user is the only actor identity.
 */

export const FEATURE_ID = "ai_page_gen_paid";
export const PAID_PLAN_CODES = Object.freeze(["basic_300", "pro_980"]);
const IMMEDIATE_FREE = new Set(["unpaid", "incomplete_expired"]);

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function pickEnv(env) {
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(env?.TASFUL_SUPABASE_ANON_KEY || env?.SUPABASE_ANON_KEY || "").trim();
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, anonKey, serviceRoleKey };
}

export function extractBearer(request) {
  const match = String(request?.headers?.get?.("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || "";
}

export async function verifySupabaseJwt(bearerToken, supabaseUrl, anonKey) {
  if (!bearerToken || !supabaseUrl || !anonKey) return null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return String(data?.id || "").trim() || null;
  } catch {
    return null;
  }
}

export function isPeriodEndActive(periodEnd) {
  if (!periodEnd) return false;
  const t = new Date(periodEnd).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Mirror of hasPaidGenAiAccessFromRow (apply-genai-plan.ts). */
export function hasPaidGenAiAccessFromRow(row) {
  if (!row) return false;
  const subscriptionStatus = String(row.subscription_status ?? row.status ?? "").trim();
  if (IMMEDIATE_FREE.has(subscriptionStatus)) return false;

  const periodEnd = row.current_period_end;
  const periodActive = isPeriodEndActive(periodEnd);
  const cancelAtPeriodEnd = Boolean(row.cancel_at_period_end);

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    if (!periodEnd) return true;
    return periodActive;
  }

  if (periodActive) {
    if (cancelAtPeriodEnd) return true;
    if (subscriptionStatus === "canceled") return true;
    const planCode = String(row.plan_code || "");
    if (PAID_PLAN_CODES.includes(planCode)) return true;
  }

  return false;
}

export async function fetchGenAiSubscriptionRow(userId, supabaseUrl, serviceRoleKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/gen_ai_subscriptions?user_id=eq.${encodeURIComponent(userId)}` +
      `&select=plan_code,subscription_status,status,current_period_end,cancel_at_period_end,updated_at&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );
  if (!res.ok) throw new Error("plan_lookup_failed");
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export function buildEntitlement(row, userId) {
  const paid = hasPaidGenAiAccessFromRow(row);
  const planCode = String(row?.plan_code || "free").trim() || "free";
  return {
    feature_id: FEATURE_ID,
    status: paid ? "active" : "inactive",
    plan: paid ? planCode : "free",
    source: "gen_ai_subscriptions",
    verified_at: new Date().toISOString(),
    expires_at: row?.current_period_end ? String(row.current_period_end) : null,
    user_id: userId,
  };
}

/**
 * Full auth + entitlement check.
 * Distinguishes: auth_required · user_mismatch · entitlement_unavailable · paid_entitlement_required
 */
export async function resolvePageGenEntitlement(request, env, body) {
  const { url, anonKey, serviceRoleKey } = pickEnv(env);
  const token = extractBearer(request);
  if (!token || !url || !anonKey) {
    return { ok: false, error: "auth_required", http: 401 };
  }
  if (!serviceRoleKey) {
    return { ok: false, error: "entitlement_unavailable", http: 503 };
  }

  const userId = await verifySupabaseJwt(token, url, anonKey);
  if (!userId) return { ok: false, error: "auth_required", http: 401 };

  const claimed = String(body?.user_id ?? body?.userId ?? "").trim();
  if (claimed && claimed !== userId) {
    return { ok: false, error: "user_mismatch", http: 403 };
  }

  try {
    const row = await fetchGenAiSubscriptionRow(userId, url, serviceRoleKey);
    const entitlement = buildEntitlement(row, userId);
    if (entitlement.status !== "active") {
      return {
        ok: false,
        error: "paid_entitlement_required",
        http: 402,
        entitlement,
        userId,
      };
    }
    return { ok: true, entitlement, userId, url, serviceRoleKey };
  } catch {
    return { ok: false, error: "entitlement_unavailable", http: 503, userId };
  }
}
