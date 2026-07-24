/**
 * Platform Request P5-8 — shared notification INSERT helpers (service_role only)
 */

var STAGING_REF = "ahlxuyvhzqdqaojiywmu";

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

async function notificationExists(serviceRoleKey, supabaseUrl, filterPath) {
  var res = await fetch(supabaseUrl + filterPath + "&select=id&limit=1", {
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
    },
  });
  if (!res.ok) return false;
  var rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function insertNotification(serviceRoleKey, supabaseUrl, row) {
  if (row.match_id) {
    var existsFilter =
      "/rest/v1/platform_request_notifications?request_id=eq." +
      encodeURIComponent(row.request_id) +
      "&recipient_id=eq." +
      encodeURIComponent(row.recipient_id) +
      "&match_id=eq." +
      encodeURIComponent(row.match_id);
    if (await notificationExists(serviceRoleKey, supabaseUrl, existsFilter)) {
      return { ok: true, skipped: true };
    }
  }

  var res = await fetch(supabaseUrl + "/rest/v1/platform_request_notifications", {
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
    if (/duplicate|unique|23505/i.test(errText)) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: errText };
  }
  var data = await res.json();
  var inserted = Array.isArray(data) ? data[0] : data;
  return { ok: true, row: inserted, skipped: false };
}

export async function insertMatchNotifications(cfg, payload) {
  var requestId = pickStr(payload.request_id);
  var matchId = pickStr(payload.match_id);
  var ownerId = pickStr(payload.owner_id);
  var candidateUserId = pickStr(payload.candidate_user_id);
  if (!isUuid(requestId) || !isUuid(matchId) || !isUuid(ownerId) || !isUuid(candidateUserId)) {
    return { ok: false, inserted: 0, skipped: 0 };
  }

  var inserted = 0;
  var skipped = 0;

  var ownerResult = await insertNotification(cfg.serviceRoleKey, cfg.url, {
    request_id: requestId,
    match_id: matchId,
    recipient_id: ownerId,
    channel: "in_app",
    status: "pending",
  });
  if (ownerResult.skipped) skipped += 1;
  else if (ownerResult.ok) inserted += 1;

  var candidateResult = await insertNotification(cfg.serviceRoleKey, cfg.url, {
    request_id: requestId,
    match_id: matchId,
    recipient_id: candidateUserId,
    channel: "in_app",
    status: "pending",
  });
  if (candidateResult.skipped) skipped += 1;
  else if (candidateResult.ok) inserted += 1;

  return { ok: true, inserted: inserted, skipped: skipped };
}

export { insertNotification, pickStr, isUuid, STAGING_REF };
