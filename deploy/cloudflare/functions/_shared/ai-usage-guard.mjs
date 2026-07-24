/**
 * SAFE-05 — Cloudflare Pages 用 AI Usage Guard（Staging Supabase RPC）
 * 正本: supabase/functions/_shared/ai-usage-guard.ts
 */

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
var WORKSPACE_SURFACE = "ai-workspace";
var FEATURE_TEXT = "text_turn";
var FEATURE_VISION = "vision_turn";
var FEATURE_OCR = "ocr_turn";
var FREE_DAILY_LIMIT = 5;

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

export function getGuardSupabaseConfig(env) {
  var url = pickStr(
    env.TASFUL_SUPABASE_URL,
    env.SUPABASE_URL,
    "https://" + STAGING_REF + ".supabase.co"
  ).replace(/\/$/, "");
  var serviceRoleKey = pickStr(env.SUPABASE_SERVICE_ROLE_KEY);
  return { url: url, serviceRoleKey: serviceRoleKey };
}

export function assertStagingSupabaseUrl(url) {
  if (!url) return false;
  if (url.indexOf(PRODUCTION_REF) >= 0) return false;
  return url.indexOf(STAGING_REF) >= 0;
}

export function resolveGuardUserId(body) {
  return pickStr(body?.user_id, body?.userId) || "anonymous";
}

export function isWorkspaceSurface(body) {
  return pickStr(body?.surface) === WORKSPACE_SURFACE;
}

/** ocr_turn → vision_turn（Phase 1 · DB 変更なし） */
export function normalizeGuardFeature(feature, body) {
  var explicit = pickStr(feature, body?.feature);
  if (explicit === FEATURE_OCR || explicit === FEATURE_VISION) return FEATURE_VISION;
  if (explicit === FEATURE_TEXT) return FEATURE_TEXT;
  return FEATURE_TEXT;
}

function quotaExceededJson(status, displayFeature) {
  return {
    ok: false,
    error: "quota_exceeded",
    feature: displayFeature || status.feature || FEATURE_VISION,
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

async function getDailyLimitForUser(userId, supabaseUrl, serviceRoleKey, feature) {
  var planCode = "free";
  var planLabel = "無料枠";
  var dailyLimit = FREE_DAILY_LIMIT;

  if (!serviceRoleKey) {
    return { planCode: planCode, planLabel: planLabel, dailyLimit: dailyLimit };
  }

  try {
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
    if (res.ok) {
      var rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        var row = rows[0] || {};
        var subStatus = pickStr(row.subscription_status, row.status).toLowerCase();
        if (!subStatus || subStatus === "active" || subStatus === "trialing") {
          planCode = pickStr(row.plan_code) || "free";
          planLabel = pickStr(row.plan_label) || planLabel;
          var limit = Math.max(0, Number(row.daily_text_limit) || FREE_DAILY_LIMIT);
          dailyLimit = limit;
        }
      }
    }
  } catch (err) {
    console.error("[ai-usage-guard] plan fetch failed:", err);
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
 * OCR 入口ガード（surface=ai-workspace のみ強制）
 * @returns {{ blocked: Response|null, shouldConsume: boolean, meta: object|null }}
 */
export async function enforceCfOcrGuard(request, body, env) {
  if (!isWorkspaceSurface(body)) {
    return { blocked: null, shouldConsume: false, meta: null };
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
  if (!assertStagingSupabaseUrl(config.url)) {
    return {
      blocked: new Response(
        JSON.stringify({
          ok: false,
          error: "guard_staging_only",
          feature: FEATURE_OCR,
          provider: "gemini",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        }
      ),
      shouldConsume: false,
      meta: null,
    };
  }

  if (!config.serviceRoleKey) {
    console.warn("[ai-usage-guard] SUPABASE_SERVICE_ROLE_KEY missing — OCR guard skipped");
    return { blocked: null, shouldConsume: false, meta: { userId: userId, skipped: true } };
  }

  var quotaFeature = normalizeGuardFeature(FEATURE_OCR, body);
  var plan = await getDailyLimitForUser(userId, config.url, config.serviceRoleKey, quotaFeature);

  try {
    var row = await callQuotaRpc(
      "check_ai_workspace_quota",
      userId,
      quotaFeature,
      plan.dailyLimit,
      config.url,
      config.serviceRoleKey
    );
    var allowed = row && row.allowed === true;
    if (!allowed) {
      var status = {
        feature: FEATURE_OCR,
        userId: userId,
        planCode: plan.planCode,
        planLabel: plan.planLabel,
        dailyLimit: plan.dailyLimit,
        used: Math.max(0, Number(row?.used) || 0),
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
        supabaseUrl: config.url,
        serviceRoleKey: config.serviceRoleKey,
      },
    };
  } catch (err) {
    console.error("[ai-usage-guard] check failed:", err);
    return { blocked: null, shouldConsume: false, meta: { userId: userId, error: String(err) } };
  }
}

export async function finalizeCfOcrConsume(meta) {
  if (!meta || !meta.userId || !meta.serviceRoleKey || !meta.supabaseUrl) return null;
  try {
    return await callQuotaRpc(
      "consume_ai_workspace_quota",
      meta.userId,
      meta.feature || FEATURE_VISION,
      meta.limit || FREE_DAILY_LIMIT,
      meta.supabaseUrl,
      meta.serviceRoleKey
    );
  } catch (err) {
    console.error("[ai-usage-guard] consume failed:", err);
    return null;
  }
}
