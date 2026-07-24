/**
 * Platform Request P5-10 — Contact reveal (paid entitlement · Edge only)
 *
 * POST /api/platform-request-contact-reveal
 * Authorization: Bearer <Supabase access_token>
 * Body: { request_id, match_id }
 */

import {
  assertStagingUrl,
  getPlatformRequestContactReveal,
  getSupabaseConfig,
  jsonResponse,
  isUuid,
  pickStr,
  verifySupabaseJwt,
} from "../_shared/platform-request-payments.mjs";

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

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;

  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  var cfg = getSupabaseConfig(env);
  if (!cfg.url || !cfg.anonKey || !cfg.serviceRoleKey) {
    return jsonResponse({ ok: false, error: "supabase_not_configured" }, 503);
  }
  if (!assertStagingUrl(cfg.url)) {
    return jsonResponse({ ok: false, error: "production_forbidden" }, 403);
  }

  var authHeader = pickStr(request.headers.get("Authorization"));
  var bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (!bearer) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  var userId = await verifySupabaseJwt(bearer, cfg.url, cfg.anonKey);
  if (!userId) return jsonResponse({ ok: false, error: "invalid_token" }, 401);

  var body;
  try {
    body = await request.json();
  } catch (_eJson) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  var requestId = pickStr(body?.request_id);
  var matchId = pickStr(body?.match_id);
  if (!isUuid(requestId) || !isUuid(matchId)) {
    return jsonResponse({ ok: false, error: "invalid_ids" }, 400);
  }

  var result = await getPlatformRequestContactReveal(cfg, userId, requestId, matchId);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, result.status || 500);
  }

  return jsonResponse(result);
}
