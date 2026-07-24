/**
 * Platform Request P5-7 — Match sync (service_role server-side only)
 * P5-8 — match INSERT 後に通知 fan-out
 *
 * POST /api/platform-request-match-sync
 * Authorization: Bearer <Supabase access_token>
 * Body: { request_id, candidates: [{ candidate_type, candidate_id, match_score, match_reasons }] }
 */

import { insertMatchNotifications } from "../_shared/platform-request-notifications.mjs";

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
var DIRECT_USER_TYPES = { user: true, freelancer: true };
var RESOLVABLE_TYPES = {
  user: true,
  freelancer: true,
  worker: true,
  builder_partner: true,
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
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

function pickStr() {
  for (var i = 0; i < arguments.length; i += 1) {
    var s = String(arguments[i] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function isUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

function getSupabaseConfig(env) {
  var url = pickStr(
    env.TASFUL_SUPABASE_URL,
    env.SUPABASE_URL,
    "https://" + STAGING_REF + ".supabase.co"
  ).replace(/\/$/, "");
  var anonKey = pickStr(env.TASFUL_SUPABASE_ANON_KEY, env.SUPABASE_ANON_KEY);
  var serviceRoleKey = pickStr(env.SUPABASE_SERVICE_ROLE_KEY);
  return { url: url, anonKey: anonKey, serviceRoleKey: serviceRoleKey };
}

function assertStagingUrl(url) {
  if (!url) return false;
  if (url.indexOf(PRODUCTION_REF) >= 0) return false;
  return url.indexOf(STAGING_REF) >= 0;
}

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
    return pickStr(data?.id) || null;
  } catch (_e) {
    return null;
  }
}

async function restGet(serviceRoleKey, supabaseUrl, path) {
  var res = await fetch(supabaseUrl + path, {
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
    },
  });
  if (!res.ok) return null;
  var rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveCandidateUserId(candidateType, candidateId, serviceRoleKey, supabaseUrl) {
  var type = pickStr(candidateType);
  var cid = pickStr(candidateId);
  if (!type || !cid || !isUuid(cid)) return null;
  if (!RESOLVABLE_TYPES[type]) return null;

  if (DIRECT_USER_TYPES[type]) return cid;

  if (type === "worker") {
    var worker = await restGet(
      serviceRoleKey,
      supabaseUrl,
      "/rest/v1/builder_workers?id=eq." + encodeURIComponent(cid) + "&select=owner_auth_uid&limit=1"
    );
    var wUid = pickStr(worker?.owner_auth_uid);
    return isUuid(wUid) ? wUid : null;
  }

  if (type === "builder_partner") {
    var partner = await restGet(
      serviceRoleKey,
      supabaseUrl,
      "/rest/v1/builder_partners?id=eq." +
        encodeURIComponent(cid) +
        "&select=owner_auth_uid&limit=1"
    );
    var pUid = pickStr(partner?.owner_auth_uid);
    return isUuid(pUid) ? pUid : null;
  }

  return null;
}

async function verifyRequestOwner(requestId, userId, bearerToken, supabaseUrl, anonKey) {
  var res = await fetch(
    supabaseUrl +
      "/rest/v1/platform_requests?id=eq." +
      encodeURIComponent(requestId) +
      "&select=id,owner_id&limit=1",
    {
      headers: {
        Authorization: "Bearer " + bearerToken,
        apikey: anonKey,
      },
    }
  );
  if (!res.ok) return false;
  var rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return false;
  return pickStr(rows[0]?.owner_id) === userId;
}

async function insertMatch(serviceRoleKey, supabaseUrl, row) {
  var res = await fetch(supabaseUrl + "/rest/v1/platform_request_matches", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (res.status === 409 || res.status === 400) {
    var errBody = await res.text().catch(function () {
      return "";
    });
    if (/duplicate|unique|23505/i.test(errBody)) {
      return { ok: false, duplicate: true };
    }
    return { ok: false, duplicate: false, error: errBody };
  }
  if (!res.ok) {
    var failText = await res.text().catch(function () {
      return "";
    });
    return { ok: false, duplicate: false, error: failText };
  }
  var data = await res.json();
  var inserted = Array.isArray(data) ? data[0] : data;
  return { ok: true, row: inserted };
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
    return jsonResponse(
      {
        ok: false,
        error: "supabase_not_configured",
        hint: "Set Staging SUPABASE_* in .env.staging → dist/.dev.vars (see docs/supabase-environments.md)",
        missing: {
          url: !cfg.url,
          anonKey: !cfg.anonKey,
          serviceRoleKey: !cfg.serviceRoleKey,
        },
      },
      503
    );
  }
  if (!assertStagingUrl(cfg.url)) {
    return jsonResponse({ ok: false, error: "production_forbidden" }, 403);
  }

  var authHeader = pickStr(request.headers.get("Authorization"));
  var bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  var userId = await verifySupabaseJwt(bearer, cfg.url, cfg.anonKey);
  if (!userId) {
    return jsonResponse({ ok: false, error: "invalid_token" }, 401);
  }

  var body;
  try {
    body = await request.json();
  } catch (_eJson) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  var requestId = pickStr(body?.request_id);
  if (!isUuid(requestId)) {
    return jsonResponse({ ok: false, error: "invalid_request_id" }, 400);
  }

  var ownsRequest = await verifyRequestOwner(requestId, userId, bearer, cfg.url, cfg.anonKey);
  if (!ownsRequest) {
    return jsonResponse({ ok: false, error: "forbidden_not_owner" }, 403);
  }

  var candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  if (!candidates.length) {
    return jsonResponse({ ok: true, inserted: [], skipped: [], reason: "empty" });
  }

  var inserted = [];
  var skipped = [];

  for (var i = 0; i < candidates.length; i += 1) {
    var c = candidates[i] || {};
    var candidateType = pickStr(c.candidate_type, c.candidateType);
    var candidateId = pickStr(c.candidate_id, c.candidateId);
    var matchScore = Math.max(0, Math.min(100, Number(c.match_score ?? c.matchScore) || 0));
    var reasons = Array.isArray(c.match_reasons || c.matchReasons)
      ? c.match_reasons || c.matchReasons
      : [];

    if (!candidateType || !isUuid(candidateId)) {
      skipped.push({
        candidate_type: candidateType,
        candidate_id: candidateId,
        reason: "invalid_candidate",
      });
      continue;
    }

    var candidateUserId = await resolveCandidateUserId(
      candidateType,
      candidateId,
      cfg.serviceRoleKey,
      cfg.url
    );
    if (!candidateUserId) {
      skipped.push({
        candidate_type: candidateType,
        candidate_id: candidateId,
        reason: "unresolved_candidate_user_id",
      });
      continue;
    }

    var insertResult = await insertMatch(cfg.serviceRoleKey, cfg.url, {
      request_id: requestId,
      candidate_type: candidateType,
      candidate_id: candidateId,
      candidate_user_id: candidateUserId,
      match_score: matchScore,
      match_reasons: reasons,
      status: "candidate",
    });

    if (insertResult.ok && insertResult.row) {
      await insertMatchNotifications(cfg, {
        request_id: requestId,
        match_id: pickStr(insertResult.row.id),
        owner_id: userId,
        candidate_user_id: candidateUserId,
      });
      inserted.push(insertResult.row);
      continue;
    }
    if (insertResult.duplicate) {
      skipped.push({
        candidate_type: candidateType,
        candidate_id: candidateId,
        reason: "duplicate",
      });
      continue;
    }
    skipped.push({
      candidate_type: candidateType,
      candidate_id: candidateId,
      reason: "insert_failed",
      detail: pickStr(insertResult.error),
    });
  }

  return jsonResponse({
    ok: true,
    inserted: inserted,
    skipped: skipped,
  });
}
