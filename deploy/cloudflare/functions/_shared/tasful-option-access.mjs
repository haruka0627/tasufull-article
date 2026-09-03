/**
 * TASFUL Option access — Edge shared (Phase 8E Staging).
 * hasOptionAccess = paid OR ACTIVE Benefit (time-bound fail-closed).
 * Does not rewrite GenAI / BD / Platform Request paid SSOTs.
 * No localStorage. Cache-Control: no-store on HTTP responses.
 */

import {
  evaluateActiveBenefitGrant,
  hasPaidOptionAccessStub,
  isApprovedGrantActivatable,
  isGrantPastExpiry,
  mergeOptionAccess,
  toEpochMs,
} from "./tasful-option-access-core.mjs";
import { buildSupabaseServerHeaders, tryResolveSupabaseServerSecret } from "./supabase-server-secret.mjs";

export {
  evaluateActiveBenefitGrant,
  hasPaidOptionAccessStub,
  isApprovedGrantActivatable,
  isGrantPastExpiry,
  mergeOptionAccess,
  toEpochMs,
} from "./tasful-option-access-core.mjs";

export const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
export const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

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
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Tasful-Benefit-Tick-Secret",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function pickEnv(env) {
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(env?.TASFUL_SUPABASE_ANON_KEY || env?.SUPABASE_ANON_KEY || "").trim();
  const resolved = tryResolveSupabaseServerSecret(env);
  const serverCredential = resolved.ok ? resolved.credential : null;
  const serviceRoleKey = serverCredential?.value || "";
  const tickSecret = String(
    env?.TASFUL_BENEFIT_LIFECYCLE_TICK_SECRET || env?.BENEFIT_LIFECYCLE_TICK_SECRET || "",
  ).trim();
  return { url, anonKey, serviceRoleKey, serverCredential, tickSecret };
}

export function assertStagingOnlyUrl(url) {
  if (!url) {
    return { ok: false, error: "supabase_url_missing" };
  }
  if (url.includes(PRODUCTION_REF)) {
    return { ok: false, error: "production_forbidden" };
  }
  if (!url.includes(STAGING_REF)) {
    return { ok: false, error: "staging_ref_required" };
  }
  return { ok: true };
}

export function extractBearer(request) {
  const match = String(request?.headers?.get?.("Authorization") || "").match(
    /^Bearer\s+(\S+)$/i,
  );
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

function restHeaders(serviceRoleKey) {
  return buildSupabaseServerHeaders(serviceRoleKey, {
    contentType: "application/json",
    prefer: "return=representation",
  });
}

/**
 * Paid Option adapter — stub false for Premium Options without paid SSOT.
 * Injectable for tests via deps.hasPaidOptionAccess.
 */
export async function hasPaidOptionAccess(ctx) {
  if (typeof ctx?.deps?.hasPaidOptionAccess === "function") {
    return ctx.deps.hasPaidOptionAccess(ctx);
  }
  return hasPaidOptionAccessStub(ctx);
}

async function restGet(url, pathQuery, serviceRoleKey) {
  const res = await fetch(`${url}/rest/v1/${pathQuery}`, {
    headers: restHeaders(serviceRoleKey),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`rest_get_failed:${res.status}:${text.slice(0, 200)}`);
  }
  return res.json();
}

async function restPatch(url, pathQuery, body, serviceRoleKey) {
  const res = await fetch(`${url}/rest/v1/${pathQuery}`, {
    method: "PATCH",
    headers: restHeaders(serviceRoleKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`rest_patch_failed:${res.status}:${text.slice(0, 200)}`);
  }
  return res.json();
}

async function restPost(url, table, body, serviceRoleKey) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...restHeaders(serviceRoleKey),
      Prefer: "return=representation,resolution=ignore-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // unique violation on event idempotency → treat as ok duplicate
    if (res.status === 409 || /23505|duplicate/i.test(text)) {
      return { duplicate: true, rows: [] };
    }
    throw new Error(`rest_post_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const rows = await res.json();
  return { duplicate: false, rows: Array.isArray(rows) ? rows : [] };
}

export async function insertBenefitEvent(url, serviceRoleKey, event) {
  try {
    return await restPost(url, "tasful_benefit_events", event, serviceRoleKey);
  } catch (e) {
    if (/23505|duplicate/i.test(String(e.message || e))) {
      return { duplicate: true, rows: [] };
    }
    throw e;
  }
}

/**
 * Expire due grants (ACTIVE|APPROVED with expires_at <= now).
 * @returns {{ expired: number, errors: string[] }}
 */
export async function expireDueBenefitGrants({
  url,
  serviceRoleKey,
  now = new Date(),
  userId = null,
  optionId = null,
  limit = 100,
}) {
  const nowIso = new Date(toEpochMs(now)).toISOString();
  let q =
    `tasful_benefit_grants?select=id,user_id,option_id,status,starts_at,expires_at,approval_id,candidate_id` +
    `&status=in.(APPROVED,ACTIVE)&expires_at=lte.${encodeURIComponent(nowIso)}` +
    `&order=expires_at.asc&limit=${Math.max(1, Math.min(limit, 500))}`;
  if (userId) q += `&user_id=eq.${encodeURIComponent(userId)}`;
  if (optionId) q += `&option_id=eq.${encodeURIComponent(optionId)}`;

  const rows = await restGet(url, q, serviceRoleKey);
  const list = Array.isArray(rows) ? rows : [];
  let expired = 0;
  const errors = [];

  for (const row of list) {
    if (!isGrantPastExpiry(row, now)) continue;
    try {
      const patched = await restPatch(
        url,
        `tasful_benefit_grants?id=eq.${encodeURIComponent(row.id)}&status=in.(APPROVED,ACTIVE)`,
        { status: "EXPIRED", updated_at: nowIso },
        serviceRoleKey,
      );
      if (Array.isArray(patched) && patched.length) {
        expired += 1;
        await insertBenefitEvent(url, serviceRoleKey, {
          event_type: "BENEFIT_EXPIRED",
          grant_id: row.id,
          candidate_id: row.candidate_id || null,
          approval_id: row.approval_id || null,
          payload: { at: nowIso, path: "expire_due" },
        });
      }
    } catch (e) {
      errors.push(String(e.message || e).slice(0, 200));
    }
  }
  return { expired, errors, scanned: list.length };
}

/**
 * Activate due APPROVED grants (starts_at <= now < expires_at).
 * Relies on DB trigger for APPROVE evidence + transition rules.
 */
export async function activateDueBenefitGrants({
  url,
  serviceRoleKey,
  now = new Date(),
  userId = null,
  optionId = null,
  limit = 100,
}) {
  const nowIso = new Date(toEpochMs(now)).toISOString();
  let q =
    `tasful_benefit_grants?select=id,user_id,option_id,status,starts_at,expires_at,approval_id,candidate_id,revoked_at` +
    `&status=eq.APPROVED&starts_at=lte.${encodeURIComponent(nowIso)}` +
    `&expires_at=gt.${encodeURIComponent(nowIso)}` +
    `&order=starts_at.asc&limit=${Math.max(1, Math.min(limit, 500))}`;
  if (userId) q += `&user_id=eq.${encodeURIComponent(userId)}`;
  if (optionId) q += `&option_id=eq.${encodeURIComponent(optionId)}`;

  const rows = await restGet(url, q, serviceRoleKey);
  const list = Array.isArray(rows) ? rows : [];
  let activated = 0;
  const errors = [];

  for (const row of list) {
    if (!isApprovedGrantActivatable(row, now)) continue;
    try {
      const patched = await restPatch(
        url,
        `tasful_benefit_grants?id=eq.${encodeURIComponent(row.id)}&status=eq.APPROVED` +
          `&starts_at=lte.${encodeURIComponent(nowIso)}&expires_at=gt.${encodeURIComponent(nowIso)}`,
        {
          status: "ACTIVE",
          activated_at: nowIso,
          updated_at: nowIso,
        },
        serviceRoleKey,
      );
      if (Array.isArray(patched) && patched.length) {
        activated += 1;
        await insertBenefitEvent(url, serviceRoleKey, {
          event_type: "BENEFIT_ACTIVATED",
          grant_id: row.id,
          candidate_id: row.candidate_id || null,
          approval_id: row.approval_id || null,
          payload: { at: nowIso, path: "activate_due" },
        });
      }
    } catch (e) {
      const msg = String(e.message || e).slice(0, 200);
      // Unique (user_id, option_id) ACTIVE conflict: leave APPROVED row for ops;
      // do not count as hard failure (idempotent skip / fixture collision).
      if (/409|23505|duplicate key/i.test(msg)) {
        continue;
      }
      errors.push(msg);
    }
  }
  return { activated, errors, scanned: list.length };
}

export async function fetchBenefitGrantsForUserOption({
  url,
  serviceRoleKey,
  userId,
  optionId,
}) {
  const q =
    `tasful_benefit_grants?select=id,user_id,option_id,status,starts_at,expires_at,activated_at,revoked_at,approval_id,candidate_id` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&option_id=eq.${encodeURIComponent(optionId)}` +
    `&order=updated_at.desc&limit=20`;
  const rows = await restGet(url, q, serviceRoleKey);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Request-time: expire due → activate due → evaluate ACTIVE window.
 * Benefit DB errors → deny Benefit only (paid preserved by merge).
 */
export async function resolveHasOptionAccess({
  userId,
  optionId,
  now = new Date(),
  url,
  serviceRoleKey,
  deps = {},
  requestTimeLifecycle = true,
}) {
  const paid = await hasPaidOptionAccess({
    userId,
    optionId,
    now,
    deps,
  });

  let benefit = {
    allowed: false,
    source: "none",
    reason: "not_evaluated",
    grantId: null,
    expiresAt: null,
    error: null,
  };

  try {
    if (!url || !serviceRoleKey) {
      throw new Error("benefit_unavailable");
    }
    if (requestTimeLifecycle) {
      await expireDueBenefitGrants({
        url,
        serviceRoleKey,
        now,
        userId,
        optionId,
        limit: 20,
      });
      await activateDueBenefitGrants({
        url,
        serviceRoleKey,
        now,
        userId,
        optionId,
        limit: 20,
      });
    }

    const grants = await fetchBenefitGrantsForUserOption({
      url,
      serviceRoleKey,
      userId,
      optionId,
    });

    // Prefer ACTIVE rows; still time-bound deny if stale ACTIVE
    const activeRows = grants.filter((g) => String(g.status) === "ACTIVE");
    const candidates = activeRows.length ? activeRows : grants;
    let best = evaluateActiveBenefitGrant(null, { userId, optionId, now });
    for (const g of candidates) {
      const ev = evaluateActiveBenefitGrant(g, { userId, optionId, now });
      if (ev.allowed) {
        best = ev;
        break;
      }
      best = ev;
    }
    benefit = { ...best, error: null };
  } catch (e) {
    benefit = {
      allowed: false,
      source: "none",
      reason: "benefit_error",
      grantId: null,
      expiresAt: null,
      error: String(e.message || e).slice(0, 200),
    };
  }

  const merged = mergeOptionAccess(paid, benefit);
  return {
    ...merged,
    userId,
    optionId,
    now: new Date(toEpochMs(now)).toISOString(),
  };
}

/**
 * HTTP resolve: JWT identity + hasOptionAccess.
 */
export async function resolveOptionAccessRequest(request, env, body = {}) {
  const { url, anonKey, serviceRoleKey, serverCredential } = pickEnv(env);
  const staging = assertStagingOnlyUrl(url);
  if (!staging.ok) {
    return { ok: false, error: staging.error, http: 403 };
  }

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

  const optionId = String(body?.option_id ?? body?.optionId ?? "").trim();
  if (!optionId) {
    return { ok: false, error: "option_id_required", http: 400 };
  }

  const access = await resolveHasOptionAccess({
    userId,
    optionId,
    url,
    serviceRoleKey: serverCredential,
    requestTimeLifecycle: body?.skip_lifecycle !== true,
  });

  return {
    ok: true,
    http: 200,
    userId,
    access: {
      allowed: access.allowed,
      source: access.source,
      expiresAt: access.expiresAt,
      // no economics / cost fields
    },
    detail: {
      benefitReason: access.benefit?.reason || null,
      benefitError: access.benefitError || null,
    },
  };
}

export async function runLifecycleTick(env, { limit = 100 } = {}) {
  const { url, serviceRoleKey, serverCredential } = pickEnv(env);
  const staging = assertStagingOnlyUrl(url);
  if (!staging.ok) {
    return { ok: false, error: staging.error };
  }
  if (!serviceRoleKey) {
    return { ok: false, error: "entitlement_unavailable" };
  }
  const now = new Date();
  const expired = await expireDueBenefitGrants({
    url,
    serviceRoleKey: serverCredential,
    now,
    limit,
  });
  const activated = await activateDueBenefitGrants({
    url,
    serviceRoleKey: serverCredential,
    now,
    limit,
  });
  return {
    ok: true,
    staging: STAGING_REF,
    now: now.toISOString(),
    expire: expired,
    activate: activated,
  };
}
