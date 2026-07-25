/**
 * SAFE-05 — Cloudflare Pages 用 AI Usage Guard
 * 正本: supabase/functions/_shared/ai-usage-guard.ts
 *
 * OCR: 全許可 surface で強制。env / RPC 失敗は fail-closed。
 * Quota 帰属は server-derived user_id（body 申告を信用しない前提で呼び出し側が上書き）。
 */

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
var WORKSPACE_SURFACE = "ai-workspace";
var FEATURE_TEXT = "text_turn";
var FEATURE_VISION = "vision_turn";
var FEATURE_OCR = "ocr_turn";
/** OCR quota は DB 既存 vision_turn バケット（client feature 不信） */
var OCR_QUOTA_FEATURE = FEATURE_VISION;
var FREE_DAILY_LIMIT = 5;

var OCR_ALLOWED_SURFACES = Object.freeze([
  "ai-workspace",
  "chat",
  "listing",
  "builder-ai",
]);

function pickStr() {
  for (var i = 0; i < arguments.length; i += 1) {
    var s = String(arguments[i] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getTokyoDateKey() {
  try {
    return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch (_e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function guardUnavailableResponse(displayFeature) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "usage_guard_unavailable",
      feature: displayFeature || FEATURE_OCR,
      provider: "gemini",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}

export function getGuardSupabaseConfig(env) {
  var url = pickStr(env && env.TASFUL_SUPABASE_URL, env && env.SUPABASE_URL).replace(/\/$/, "");
  var serviceRoleKey = pickStr(env && env.SUPABASE_SERVICE_ROLE_KEY);
  return { url: url, serviceRoleKey: serviceRoleKey };
}

/** @deprecated Staging-only checks — OCR は assertOcrGuardSupabaseUrl を使用 */
export function assertStagingSupabaseUrl(url) {
  if (!url) return false;
  if (url.indexOf(PRODUCTION_REF) >= 0) return false;
  return url.indexOf(STAGING_REF) >= 0;
}

/**
 * Staging / Production の既知 Supabase URL のみ許可（未知ホスト拒否）
 */
export function assertOcrGuardSupabaseUrl(url) {
  if (!url) return false;
  var hasStaging = url.indexOf(STAGING_REF) >= 0;
  var hasProduction = url.indexOf(PRODUCTION_REF) >= 0;
  if (hasStaging && !hasProduction) return true;
  if (hasProduction && !hasStaging) return true;
  return false;
}

export function resolveGuardUserId(body) {
  return pickStr(body && body.user_id, body && body.userId);
}

export function isWorkspaceSurface(body) {
  return pickStr(body && body.surface) === WORKSPACE_SURFACE;
}

/**
 * OCR surface allowlist（string · trim · lowercase · 完全一致のみ）
 * @param {unknown} raw
 * @returns {string} 許可 surface または ""
 */
export function normalizeOcrSurface(raw) {
  if (typeof raw !== "string") return "";
  var s = raw.trim().toLowerCase();
  if (!s) return "";
  for (var i = 0; i < OCR_ALLOWED_SURFACES.length; i += 1) {
    if (OCR_ALLOWED_SURFACES[i] === s) return s;
  }
  return "";
}

export function isAllowedOcrSurface(raw) {
  return normalizeOcrSurface(raw) !== "";
}

export function getOcrQuotaFeature() {
  return OCR_QUOTA_FEATURE;
}

export function getOcrAllowedSurfaces() {
  return OCR_ALLOWED_SURFACES.slice();
}

/**
 * body.feature は信用しない。OCR は常に vision_turn。
 * （text/vision 正規化は他用途向けに残す）
 */
export function normalizeGuardFeature(feature, body) {
  var explicit = pickStr(feature, body && body.feature);
  if (explicit === FEATURE_OCR || explicit === FEATURE_VISION) return FEATURE_VISION;
  if (explicit === FEATURE_TEXT) return FEATURE_TEXT;
  return FEATURE_TEXT;
}

function quotaExceededJson(status, displayFeature) {
  return {
    ok: false,
    error: "quota_exceeded",
    feature: displayFeature || status.feature || FEATURE_OCR,
    reply: "",
    plan: status.planCode || "free",
    planLabel: status.planLabel || "無料枠",
    dailyLimit: status.dailyLimit ?? 0,
    used: status.used ?? status.dailyLimit ?? 0,
    remaining: 0,
    dateJst: status.dateJst,
    userId: status.userId,
    provider: "gemini",
  };
}

/**
 * @returns {Promise<{ planCode: string, planLabel: string, dailyLimit: number }>}
 */
async function getDailyLimitForUser(userId, supabaseUrl, serviceRoleKey) {
  var planCode = "free";
  var planLabel = "無料枠";
  var dailyLimit = FREE_DAILY_LIMIT;

  var res = await fetch(
    supabaseUrl +
      "/rest/v1/gen_ai_subscriptions?user_id=eq." +
      encodeURIComponent(userId) +
      "&select=plan_code,plan_label,daily_text_limit,status,subscription_status&limit=1",
    {
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
    }
  );
  if (!res.ok) {
    throw new Error("plan_http_" + res.status);
  }
  var rows = await res.json();
  if (!Array.isArray(rows)) {
    throw new Error("plan_invalid_shape");
  }
  if (rows.length > 0) {
    var row = rows[0] || {};
    var subStatus = pickStr(row.subscription_status, row.status).toLowerCase();
    if (!subStatus || subStatus === "active" || subStatus === "trialing") {
      planCode = pickStr(row.plan_code) || "free";
      planLabel = pickStr(row.plan_label) || planLabel;
      var limitNum = Number(row.daily_text_limit);
      if (!Number.isFinite(limitNum) || limitNum < 0) {
        throw new Error("plan_invalid_limit");
      }
      dailyLimit = Math.floor(limitNum);
    }
  }

  if (!Number.isFinite(dailyLimit) || dailyLimit < 0) {
    throw new Error("plan_invalid_limit");
  }

  return { planCode: planCode, planLabel: planLabel, dailyLimit: dailyLimit };
}

async function callQuotaRpc(rpcName, userId, feature, limit, supabaseUrl, serviceRoleKey) {
  var res = await fetch(supabaseUrl + "/rest/v1/rpc/" + rpcName, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_date_jst: getTokyoDateKey(),
      p_feature: feature,
      p_limit: limit,
    }),
  });
  if (!res.ok) {
    throw new Error("rpc_" + rpcName + "_http_" + res.status);
  }
  return await res.json();
}

/**
 * OCR 入口ガード（許可 surface すべて強制 · fail-closed）
 * @returns {Promise<{ blocked: Response|null, shouldConsume: boolean, meta: object|null }>}
 */
export async function enforceCfOcrGuard(request, body, env) {
  var surface = normalizeOcrSurface(body && body.surface);
  if (!surface) {
    return {
      blocked: new Response(
        JSON.stringify({
          ok: false,
          error: "invalid_surface",
          feature: FEATURE_OCR,
          provider: "gemini",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        }
      ),
      shouldConsume: false,
      meta: null,
    };
  }

  var userId = resolveGuardUserId(body);
  if (!userId || userId === "anonymous") {
    return {
      blocked: new Response(
        JSON.stringify({
          ok: false,
          error: "guard_missing_user_id",
          feature: FEATURE_OCR,
          provider: "gemini",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        }
      ),
      shouldConsume: false,
      meta: null,
    };
  }

  var config = getGuardSupabaseConfig(env);
  if (!config.url || !assertOcrGuardSupabaseUrl(config.url)) {
    return {
      blocked: guardUnavailableResponse(FEATURE_OCR),
      shouldConsume: false,
      meta: null,
    };
  }

  if (!config.serviceRoleKey) {
    console.warn("[ai-usage-guard] SUPABASE_SERVICE_ROLE_KEY missing — OCR guard fail-closed");
    return {
      blocked: guardUnavailableResponse(FEATURE_OCR),
      shouldConsume: false,
      meta: null,
    };
  }

  var quotaFeature = OCR_QUOTA_FEATURE;

  try {
    var plan = await getDailyLimitForUser(userId, config.url, config.serviceRoleKey);
    if (!Number.isFinite(plan.dailyLimit) || plan.dailyLimit < 0) {
      return {
        blocked: guardUnavailableResponse(FEATURE_OCR),
        shouldConsume: false,
        meta: null,
      };
    }

    var row = await callQuotaRpc(
      "check_ai_workspace_quota",
      userId,
      quotaFeature,
      plan.dailyLimit,
      config.url,
      config.serviceRoleKey
    );

    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.allowed !== "boolean") {
      return {
        blocked: guardUnavailableResponse(FEATURE_OCR),
        shouldConsume: false,
        meta: null,
      };
    }

    var usedNum = Number(row.used);
    if (row.used != null && (!Number.isFinite(usedNum) || usedNum < 0)) {
      return {
        blocked: guardUnavailableResponse(FEATURE_OCR),
        shouldConsume: false,
        meta: null,
      };
    }
    if (Number.isFinite(usedNum) && usedNum > plan.dailyLimit && row.allowed === true) {
      return {
        blocked: guardUnavailableResponse(FEATURE_OCR),
        shouldConsume: false,
        meta: null,
      };
    }

    if (plan.dailyLimit === 0 || row.allowed !== true) {
      var status = {
        feature: FEATURE_OCR,
        userId: userId,
        planCode: plan.planCode,
        planLabel: plan.planLabel,
        dailyLimit: plan.dailyLimit,
        used: Math.max(0, Number.isFinite(usedNum) ? usedNum : plan.dailyLimit),
        dateJst: getTokyoDateKey(),
      };
      return {
        blocked: new Response(JSON.stringify(quotaExceededJson(status, FEATURE_OCR)), {
          status: 402,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        }),
        shouldConsume: false,
        meta: status,
      };
    }

    return {
      blocked: null,
      shouldConsume: true,
      meta: {
        userId: userId,
        feature: quotaFeature,
        limit: plan.dailyLimit,
        surface: surface,
        supabaseUrl: config.url,
        serviceRoleKey: config.serviceRoleKey,
      },
    };
  } catch (err) {
    console.error("[ai-usage-guard] check failed:", err);
    return {
      blocked: guardUnavailableResponse(FEATURE_OCR),
      shouldConsume: false,
      meta: null,
    };
  }
}

export async function finalizeCfOcrConsume(meta) {
  if (!meta || !meta.userId || !meta.serviceRoleKey || !meta.supabaseUrl) return null;
  try {
    return await callQuotaRpc(
      "consume_ai_workspace_quota",
      meta.userId,
      meta.feature || OCR_QUOTA_FEATURE,
      meta.limit || FREE_DAILY_LIMIT,
      meta.supabaseUrl,
      meta.serviceRoleKey
    );
  } catch (err) {
    console.error("[ai-usage-guard] consume failed:", err);
    return null;
  }
}
