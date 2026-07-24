/**
 * Platform Request P5-9 — Talk room ensure helpers (service_role only)
 */

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var LISTING_TYPE = "platform_request";
var SERVICE_TYPE = "platform_request";

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
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
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

async function restGetOne(serviceRoleKey, supabaseUrl, path) {
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

async function findExistingTalkRoom(serviceRoleKey, supabaseUrl, matchId, ownerId, candidateUserId) {
  var byService = await restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/transaction_rooms?service_type=eq." +
      encodeURIComponent(SERVICE_TYPE) +
      "&service_ref_id=eq." +
      encodeURIComponent(matchId) +
      "&select=id&limit=1"
  );
  if (byService?.id) return String(byService.id);

  var byListing = await restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/transaction_rooms?listing_type=eq." +
      encodeURIComponent(LISTING_TYPE) +
      "&listing_id=eq." +
      encodeURIComponent(matchId) +
      "&buyer_id=eq." +
      encodeURIComponent(ownerId) +
      "&seller_id=eq." +
      encodeURIComponent(candidateUserId) +
      "&select=id&limit=1"
  );
  if (byListing?.id) return String(byListing.id);

  return null;
}

async function insertTalkRoom(serviceRoleKey, supabaseUrl, payload) {
  var expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  var row = {
    listing_id: payload.match_id,
    listing_type: LISTING_TYPE,
    buyer_id: payload.owner_id,
    seller_id: payload.candidate_user_id,
    partner_id: payload.candidate_user_id,
    partner_display_name: pickStr(payload.candidate_label, "候補者"),
    title: pickStr(payload.title, "Platform Request"),
    expires_at: expiresAt,
    status: "active",
    source: "platform_request",
    service_type: SERVICE_TYPE,
    service_ref_id: payload.match_id,
  };

  var res = await fetch(supabaseUrl + "/rest/v1/transaction_rooms", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    var errText = await res.text().catch(function () {
      return "";
    });
    return { ok: false, error: errText };
  }

  var data = await res.json();
  var inserted = Array.isArray(data) ? data[0] : data;
  return { ok: true, row: inserted };
}

async function loadMatchContext(serviceRoleKey, supabaseUrl, matchId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_request_matches?id=eq." +
      encodeURIComponent(matchId) +
      "&select=id,request_id,candidate_user_id,candidate_type,candidate_id,status&limit=1"
  );
}

async function loadRequestOwner(serviceRoleKey, supabaseUrl, requestId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_requests?id=eq." +
      encodeURIComponent(requestId) +
      "&select=id,owner_id,title&limit=1"
  );
}

function isParticipant(userId, ownerId, candidateUserId) {
  var uid = pickStr(userId);
  if (!uid) return false;
  if (uid === pickStr(ownerId)) return true;
  if (uid === pickStr(candidateUserId)) return true;
  return false;
}

async function markMatchTalkStarted(serviceRoleKey, supabaseUrl, matchId) {
  var res = await fetch(
    supabaseUrl + "/rest/v1/platform_request_matches?id=eq." + encodeURIComponent(matchId),
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "talk_started" }),
    }
  );
  return res.ok;
}

export async function ensurePlatformRequestTalkRoom(cfg, userId, requestId, matchId) {
  if (!isUuid(requestId) || !isUuid(matchId) || !isUuid(userId)) {
    return { ok: false, error: "invalid_args", status: 400 };
  }

  var match = await loadMatchContext(cfg.serviceRoleKey, cfg.url, matchId);
  if (!match) return { ok: false, error: "match_not_found", status: 404 };
  if (pickStr(match.request_id) !== requestId) {
    return { ok: false, error: "request_mismatch", status: 400 };
  }

  var request = await loadRequestOwner(cfg.serviceRoleKey, cfg.url, requestId);
  if (!request) return { ok: false, error: "request_not_found", status: 404 };

  var ownerId = pickStr(request.owner_id);
  var candidateUserId = pickStr(match.candidate_user_id);
  if (!isUuid(ownerId) || !isUuid(candidateUserId)) {
    return { ok: false, error: "unresolved_participants", status: 422 };
  }

  if (!isParticipant(userId, ownerId, candidateUserId)) {
    return { ok: false, error: "forbidden_not_participant", status: 403 };
  }

  var existingId = await findExistingTalkRoom(
    cfg.serviceRoleKey,
    cfg.url,
    matchId,
    ownerId,
    candidateUserId
  );
  if (existingId) {
    await markMatchTalkStarted(cfg.serviceRoleKey, cfg.url, matchId);
    return {
      ok: true,
      room_id: existingId,
      created: false,
      reused: true,
      owner_id: ownerId,
      candidate_user_id: candidateUserId,
    };
  }

  var title = "【Platform Request】" + pickStr(request.title, "依頼");
  var insertResult = await insertTalkRoom(cfg.serviceRoleKey, cfg.url, {
    match_id: matchId,
    owner_id: ownerId,
    candidate_user_id: candidateUserId,
    title: title,
    candidate_label: pickStr(match.candidate_type) + " 候補",
  });

  if (!insertResult.ok || !insertResult.row?.id) {
    return { ok: false, error: "room_insert_failed", status: 500, detail: insertResult.error };
  }

  var roomId = String(insertResult.row.id);
  await markMatchTalkStarted(cfg.serviceRoleKey, cfg.url, matchId);

  return {
    ok: true,
    room_id: roomId,
    created: true,
    reused: false,
    owner_id: ownerId,
    candidate_user_id: candidateUserId,
  };
}

export {
  LISTING_TYPE,
  SERVICE_TYPE,
  STAGING_REF,
  getSupabaseConfig,
  assertStagingUrl,
  verifySupabaseJwt,
  pickStr,
  isUuid,
  isParticipant,
};
