/**
 * Platform Request P5-8 — Notification enqueue + mark read (service_role Edge only)
 *
 * POST /api/platform-request-notify
 * Authorization: Bearer <Supabase access_token>
 * Body actions:
 *   - status_changed: { request_id, status, previous_status? }
 *   - mark_read: { notification_ids: [uuid] }
 */

import { insertNotification, pickStr, isUuid } from "../_shared/platform-request-notifications.mjs";

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

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
  if (!res.ok) return [];
  var rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function restGetOne(serviceRoleKey, supabaseUrl, path) {
  var rows = await restGet(serviceRoleKey, supabaseUrl, path);
  return rows.length ? rows[0] : null;
}

async function getRequestOwner(requestId, bearerToken, supabaseUrl, anonKey) {
  var res = await fetch(
    supabaseUrl +
      "/rest/v1/platform_requests?id=eq." +
      encodeURIComponent(requestId) +
      "&select=id,owner_id,status&limit=1",
    {
      headers: {
        Authorization: "Bearer " + bearerToken,
        apikey: anonKey,
      },
    }
  );
  if (!res.ok) return null;
  var rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

async function handleStatusChanged(userId, body, bearer, cfg) {
  var requestId = pickStr(body?.request_id);
  var nextStatus = pickStr(body?.status);
  if (!isUuid(requestId)) {
    return jsonResponse({ ok: false, error: "invalid_request_id" }, 400);
  }
  if (nextStatus !== "open" && nextStatus !== "closed") {
    return jsonResponse({ ok: false, error: "invalid_status" }, 400);
  }

  var requestRow = await getRequestOwner(requestId, bearer, cfg.url, cfg.anonKey);
  if (!requestRow) {
    return jsonResponse({ ok: false, error: "request_not_found" }, 404);
  }
  var ownerId = pickStr(requestRow.owner_id);
  if (ownerId !== userId) {
    return jsonResponse({ ok: false, error: "forbidden_not_owner" }, 403);
  }

  var inserted = 0;
  var skipped = 0;

  var ownerNotify = await insertNotification(cfg.serviceRoleKey, cfg.url, {
    request_id: requestId,
    match_id: null,
    recipient_id: ownerId,
    channel: "in_app",
    status: "pending",
  });
  if (ownerNotify.skipped) skipped += 1;
  else if (ownerNotify.ok) inserted += 1;

  if (nextStatus === "closed") {
    var matches = await restGet(
      cfg.serviceRoleKey,
      cfg.url,
      "/rest/v1/platform_request_matches?request_id=eq." +
        encodeURIComponent(requestId) +
        "&select=id,candidate_user_id"
    );
    var seen = {};
    for (var i = 0; i < matches.length; i += 1) {
      var m = matches[i] || {};
      var candidateUid = pickStr(m.candidate_user_id);
      if (!isUuid(candidateUid) || seen[candidateUid]) continue;
      seen[candidateUid] = true;
      var candResult = await insertNotification(cfg.serviceRoleKey, cfg.url, {
        request_id: requestId,
        match_id: null,
        recipient_id: candidateUid,
        channel: "in_app",
        status: "pending",
      });
      if (candResult.skipped) skipped += 1;
      else if (candResult.ok) inserted += 1;
    }
  }

  return jsonResponse({ ok: true, inserted: inserted, skipped: skipped, status: nextStatus });
}

async function handleMarkRead(userId, body, cfg) {
  var ids = Array.isArray(body?.notification_ids) ? body.notification_ids : [];
  var validIds = ids
    .map(function (id) {
      return pickStr(id);
    })
    .filter(function (id) {
      return isUuid(id);
    });
  if (!validIds.length) {
    return jsonResponse({ ok: false, error: "empty_notification_ids" }, 400);
  }

  var updated = 0;
  var now = new Date().toISOString();

  for (var i = 0; i < validIds.length; i += 1) {
    var nid = validIds[i];
    var row = await restGetOne(
      cfg.serviceRoleKey,
      cfg.url,
      "/rest/v1/platform_request_notifications?id=eq." +
        encodeURIComponent(nid) +
        "&select=id,recipient_id,status&limit=1"
    );
    if (!row) continue;
    if (pickStr(row.recipient_id) !== userId) continue;
    if (pickStr(row.status) !== "pending") continue;

    var patchRes = await fetch(
      cfg.url +
        "/rest/v1/platform_request_notifications?id=eq." +
        encodeURIComponent(nid),
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + cfg.serviceRoleKey,
          apikey: cfg.serviceRoleKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "sent", sent_at: now }),
      }
    );
    if (patchRes.ok) updated += 1;
  }

  return jsonResponse({ ok: true, updated: updated });
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

  var action = pickStr(body?.action);
  if (action === "status_changed") {
    return handleStatusChanged(userId, body, bearer, cfg);
  }
  if (action === "mark_read") {
    return handleMarkRead(userId, body, cfg);
  }

  return jsonResponse({ ok: false, error: "invalid_action" }, 400);
}
