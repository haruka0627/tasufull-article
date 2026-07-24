/**
 * Gemini Live Session Token（CF Pages Function）
 *
 * Phase B: Supabase JWT 検証後、Worker 接続用の短命 token を HMAC-SHA256 署名付きで発行。
 *
 * token payload: { user_id, plan, feature: "voice_live_minute", exp, iat, nonce }
 * token format:   base64url(payload) + "." + hex(hmac_sha256(secret, payload_b64))
 * 有効期限: 300 秒（5 分）
 */

var TOKEN_EXPIRY_SEC = 300;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function signPayload(payloadB64, secretRaw) {
  var encoder = new TextEncoder();
  var keyData = encoder.encode(secretRaw);
  var cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  var data = encoder.encode(payloadB64);
  var sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return Array.from(new Uint8Array(sig))
    .map(function (b) { return b.toString(16).padStart(2, "0"); })
    .join("");
}

function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateNonce() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

/**
 * Supabase の /auth/v1/user エンドポイントで JWT を検証し、user_id を取得する。
 * 既存の match-auth.ts と同じパターン。
 */
async function verifySupabaseJwt(bearerToken, supabaseUrl, anonKey) {
  try {
    var res = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: {
        Authorization: "Bearer " + bearerToken,
        apikey: anonKey,
      },
    });
    if (!res.ok) return null;
    var data = await res.json();
    return String(data?.id || "").trim() || null;
  } catch (e) {
    return null;
  }
}

/**
 * Supabase の gen_ai_subscriptions テーブルから plan_code と dailyVoiceLimit を取得する。
 * service_role key を使用（RLS バイパス）。
 */
async function getUserPlan(userId, supabaseUrl, serviceRoleKey) {
  try {
    var res = await fetch(supabaseUrl + "/rest/v1/gen_ai_subscriptions?user_id=eq." + encodeURIComponent(userId) + "&select=plan_code,daily_voice_limit,status,subscription_status&limit=1", {
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
    });
    if (!res.ok) return { plan_code: "free", daily_voice_limit: 0 };
    var rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { plan_code: "free", daily_voice_limit: 0 };
    return {
      plan_code: String(rows[0].plan_code || "free").trim() || "free",
      daily_voice_limit: Math.max(0, Number(rows[0].daily_voice_limit) || 0),
    };
  } catch (e) {
    return { plan_code: "free", daily_voice_limit: 0 };
  }
}

/**
 * interaction-log から今日の voice_live_session 使用分数を集計する。
 * ai_workspace_usage_daily テーブルから voice_used_minutes を取得。
 */
async function getTodayVoiceLiveMinutes(userId, supabaseUrl, serviceRoleKey) {
  try {
    var todayJst = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-");
    var url = supabaseUrl + "/rest/v1/ai_workspace_usage_daily?user_id=eq." + encodeURIComponent(userId) + "&select=voice_used_minutes&date_jst=eq." + todayJst + "&limit=1";
    var res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
    });
    if (res.ok) {
      var rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return Math.max(0, Math.round(Number(rows[0].voice_used_minutes) || 0));
      }
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * セッション終了時に voice_used_minutes を加算する RPC 呼び出し。
 */
async function consumeVoiceLiveMinutes(userId, minutes, limit, supabaseUrl, serviceRoleKey) {
  try {
    var todayJst = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-");
    var res = await fetch(supabaseUrl + "/rest/v1/rpc/consume_voice_live_minutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_date_jst: todayJst,
        p_minutes: minutes,
        p_limit: limit,
      }),
    });
    if (!res.ok) return { ok: false, error: "rpc_failed" };
    return await res.json();
  } catch (e) {
    return { ok: false, error: "rpc_error" };
  }
}

// Live 利用可能なプランコード一覧
var LIVE_ALLOWED_PLANS = ["basic_300", "pro_980"];

/** consume_minutes のバリデーション */
function validateConsumeMinutes(raw) {
  if (raw === null || raw === undefined || raw === "") return { ok: false, error: "consume_minutes is required" };

  var val = Number(raw);
  if (!Number.isFinite(val) || !Number.isInteger(val)) {
    return { ok: false, error: "consume_minutes must be an integer" };
  }
  if (val < 1) return { ok: false, error: "consume_minutes must be >= 1" };
  if (val > 480) return { ok: false, error: "consume_minutes exceeds max (480)" }; // 8 hours max

  return { ok: true, value: val };
}

/**
 * consume パス:
 *  - JWT 検証 → plan 取得 → limit 取得 → used 集計 → remaining 計算
 *  - remaining を超える minutes は remaining に丸める
 *  - consume RPC 呼び出し → 結果返却
 */
async function handleConsume(request, env, userId, supabaseUrl, serviceRoleKey) {
  var body;
  try { body = await request.json(); } catch { /* use {} */ }
  body = body || {};

  var valid = validateConsumeMinutes(body.consume_minutes);
  if (!valid.ok) {
    return jsonResponse({ ok: false, error: valid.error, code: "invalid_input" }, 400);
  }
  var minutes = valid.value;

  // Plan / limit 取得
  var planInfo = { plan_code: "free", daily_voice_limit: 0 };
  if (serviceRoleKey) {
    planInfo = await getUserPlan(userId, supabaseUrl, serviceRoleKey);
  }

  if (LIVE_ALLOWED_PLANS.indexOf(planInfo.plan_code) === -1) {
    return jsonResponse({
      ok: false, error: "live_not_available",
      reason: "Live 会話は Basic / Pro プラン以上でご利用いただけます",
      code: "plan_restricted",
    }, 403);
  }

  var dailyLimit = planInfo.daily_voice_limit || 30;
  var usedMinutes = await getTodayVoiceLiveMinutes(userId, supabaseUrl, serviceRoleKey);
  var remaining = Math.max(0, dailyLimit - usedMinutes);

  // remaining を超える場合は remaining に丸める
  if (minutes > remaining) minutes = remaining;
  if (minutes <= 0) {
    return jsonResponse({
      ok: false,
      error: "quota_exceeded",
      reason: "本日の音声会話の利用上限に達しました",
      code: "quota_exceeded",
      limitMinutes: dailyLimit,
      usedMinutes: usedMinutes,
      remainingMinutes: 0,
    }, 403);
  }

  // RPC 呼び出しで consume
  if (serviceRoleKey) {
    var consumeResult = await consumeVoiceLiveMinutes(userId, minutes, dailyLimit, supabaseUrl, serviceRoleKey);
    if (consumeResult && consumeResult.ok) {
      return jsonResponse({
        ok: true,
        consumed: true,
        consumedMinutes: minutes,
        limitMinutes: dailyLimit,
        usedMinutes: Math.max(0, Number(consumeResult.used) || 0),
        remainingMinutes: Math.max(0, Number(consumeResult.remaining) || 0),
      });
    }
  }

  // service_role 未設定時は optimistic consume（dev 用）
  return jsonResponse({
    ok: true,
    consumed: true,
    consumedMinutes: minutes,
    limitMinutes: dailyLimit,
    usedMinutes: usedMinutes + minutes,
    remainingMinutes: Math.max(0, dailyLimit - usedMinutes - minutes),
  });
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;

  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Authorization ヘッダーから Bearer token を取得
  var authHeader = (request.headers.get("Authorization") || "").trim();
  var bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!bearerToken) {
    return jsonResponse({
      ok: false,
      error: "unauthorized",
      reason: "ログインが必要です",
      code: "missing_token",
    }, 401);
  }

  // Supabase 設定（env 必須 · ハードコード fallback 禁止）
  var supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  var anonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  var serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({
      ok: false,
      error: "server_config_error",
      reason: "SUPABASE_URL and SUPABASE_ANON_KEY are required",
      code: "missing_config",
    }, 500);
  }

  // JWT 検証
  var userId = await verifySupabaseJwt(bearerToken, supabaseUrl, anonKey);
  if (!userId) {
    return jsonResponse({
      ok: false,
      error: "unauthorized",
      reason: "ログインが無効か期限切れです",
      code: "invalid_token",
    }, 401);
  }

  // Parse body for action routing
  var body;
  try { body = await request.json(); } catch { body = {}; }
  body = body || {};

  // consume_minutes がある場合は quota 消費パス
  if (body.consume_minutes) {
    return await handleConsume(request, env, userId, supabaseUrl, serviceRoleKey);
  }

  // Plan 取得（dailyVoiceLimit 含む）
  var planInfo = { plan_code: "free", daily_voice_limit: 0 };
  if (serviceRoleKey) {
    planInfo = await getUserPlan(userId, supabaseUrl, serviceRoleKey);
  }

  // Live 利用可否判定
  if (LIVE_ALLOWED_PLANS.indexOf(planInfo.plan_code) === -1) {
    return jsonResponse({
      ok: false,
      error: "live_not_available",
      reason: "Live 会話は Basic / Pro プラン以上でご利用いただけます",
      code: "plan_restricted",
    }, 403);
  }

  // 使用量集計
  var dailyLimit = planInfo.daily_voice_limit || 30; // fallback: basic_300 = 30
  var usedMinutes = await getTodayVoiceLiveMinutes(userId, supabaseUrl, serviceRoleKey);
  var remaining = Math.max(0, dailyLimit - usedMinutes);

  // quota チェック
  if (remaining <= 0) {
    return jsonResponse({
      ok: false,
      error: "quota_exceeded",
      reason: "本日の音声会話の利用上限に達しました",
      code: "quota_exceeded",
      limitMinutes: dailyLimit,
      usedMinutes: usedMinutes,
      remainingMinutes: 0,
    }, 403);
  }

  // Token 発行
  var nowSec = Math.floor(Date.now() / 1000);
  var payload = {
    user_id: userId,
    plan: planInfo.plan_code,
    feature: "voice_live_minute",
    limit_minutes: dailyLimit,
    used_minutes: usedMinutes,
    remaining_minutes: remaining,
    exp: nowSec + TOKEN_EXPIRY_SEC,
    iat: nowSec,
    nonce: generateNonce(),
  };

  var payloadJson = JSON.stringify(payload);
  var payloadB64 = base64urlEncode(payloadJson);

  var secret = String(env.GEMINI_LIVE_SESSION_SECRET || env.GEMINI_API_KEY || "dev_fallback_secret").trim();
  var signature = await signPayload(payloadB64, secret);
  var token = payloadB64 + "." + signature;

  return jsonResponse({
    ok: true,
    token: token,
    expiresIn: TOKEN_EXPIRY_SEC,
    expiresAt: payload.exp,
  });
}
