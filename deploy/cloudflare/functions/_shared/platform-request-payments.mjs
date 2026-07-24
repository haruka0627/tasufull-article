/**
 * Platform Request P5-10 — payments + contact reveal (service_role Edge only)
 */

import { isSimulateSessionId } from "./stripe-api.mjs";
import {
  STAGING_REF,
  assertStagingUrl,
  getSupabaseConfig,
  isParticipant,
  isUuid,
  pickStr,
  verifySupabaseJwt,
} from "./platform-request-talk.mjs";

var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
var FEE_JPY = 550;
var PURPOSE = "platform_request_match_contact";
var ORDER_TYPE = "platform_request_match_contact";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function restRows(serviceRoleKey, supabaseUrl, path) {
  var res = await fetch(supabaseUrl + path, {
    headers: {
      Authorization: "Bearer " + serviceRoleKey,
      apikey: serviceRoleKey,
    },
  });
  if (!res.ok) return { ok: false, error: await res.text().catch(function () { return ""; }) };
  var rows = await res.json();
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

async function restGetOne(serviceRoleKey, supabaseUrl, path) {
  var result = await restRows(serviceRoleKey, supabaseUrl, path + "&limit=1");
  if (!result.ok) return null;
  return result.rows.length ? result.rows[0] : null;
}

async function loadMatchContext(serviceRoleKey, supabaseUrl, matchId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_request_matches?id=eq." +
      encodeURIComponent(matchId) +
      "&select=id,request_id,candidate_user_id,candidate_type,candidate_id,status"
  );
}

async function loadRequestOwner(serviceRoleKey, supabaseUrl, requestId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_requests?id=eq." +
      encodeURIComponent(requestId) +
      "&select=id,owner_id,title"
  );
}

async function findPaidPayment(serviceRoleKey, supabaseUrl, matchId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_request_payments?match_id=eq." +
      encodeURIComponent(matchId) +
      "&status=eq.paid&select=id,match_id,request_id,payer_id,status,paid_at&order=paid_at.desc"
  );
}

async function findPaymentBySession(serviceRoleKey, supabaseUrl, sessionId) {
  return restGetOne(
    serviceRoleKey,
    supabaseUrl,
    "/rest/v1/platform_request_payments?stripe_checkout_session_id=eq." +
      encodeURIComponent(sessionId) +
      "&select=id,match_id,request_id,payer_id,status,stripe_checkout_session_id,amount_jpy,purpose"
  );
}

async function insertPaymentPending(serviceRoleKey, supabaseUrl, row) {
  var res = await fetch(supabaseUrl + "/rest/v1/platform_request_payments", {
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
    return { ok: false, error: await res.text().catch(function () { return ""; }) };
  }
  var data = await res.json();
  var inserted = Array.isArray(data) ? data[0] : data;
  return { ok: true, row: inserted };
}

async function patchPayment(serviceRoleKey, supabaseUrl, paymentId, patch) {
  var res = await fetch(
    supabaseUrl + "/rest/v1/platform_request_payments?id=eq." + encodeURIComponent(paymentId),
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    return { ok: false, error: await res.text().catch(function () { return ""; }) };
  }
  var data = await res.json();
  return { ok: true, row: Array.isArray(data) ? data[0] : data };
}

async function patchMatchStatus(serviceRoleKey, supabaseUrl, matchId, status) {
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
      body: JSON.stringify({ status: status }),
    }
  );
  return res.ok;
}

async function fetchUserEmail(serviceRoleKey, supabaseUrl, userId) {
  if (!isUuid(userId)) return null;
  try {
    var res = await fetch(supabaseUrl + "/auth/v1/admin/users/" + encodeURIComponent(userId), {
      headers: {
        Authorization: "Bearer " + serviceRoleKey,
        apikey: serviceRoleKey,
      },
    });
    if (!res.ok) return null;
    var data = await res.json();
    return pickStr(data?.email) || null;
  } catch (_e) {
    return null;
  }
}

function resolveSiteOrigin(request, bodyOrigin) {
  var fromBody = pickStr(bodyOrigin).replace(/\/$/, "");
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;
  try {
    return new URL(request.url).origin;
  } catch (_e) {
    return "http://127.0.0.1:8788";
  }
}

function stripeSimulateEnabled(env) {
  if (pickStr(env.PLATFORM_REQUEST_STRIPE_SIMULATE) === "1") return true;
  return !pickStr(env.STRIPE_SECRET_KEY);
}

function buildDetailReturnUrl(origin, requestId, matchId, outcome) {
  var url = new URL(origin + "/platform-request-detail.html");
  url.searchParams.set("id", requestId);
  url.searchParams.set("match_id", matchId);
  url.searchParams.set("prq_store", "supabase");
  url.searchParams.set("prq_checkout", outcome);
  return url.toString();
}

async function markPaymentPaid(cfg, payment, stripeSession) {
  var paidAt = new Date().toISOString();
  var patch = {
    status: "paid",
    paid_at: paidAt,
  };
  if (stripeSession?.payment_intent) {
    patch.stripe_payment_intent_id = String(stripeSession.payment_intent);
  }
  var updated = await patchPayment(cfg.serviceRoleKey, cfg.url, payment.id, patch);
  if (!updated.ok) return updated;

  await patchMatchStatus(cfg.serviceRoleKey, cfg.url, payment.match_id, "talk_started");
  return {
    ok: true,
    payment: updated.row,
    paid_at: paidAt,
    contact_reveal: true,
  };
}

export async function createPlatformRequestCheckout(cfg, env, userId, body, request) {
  var requestId = pickStr(body?.request_id);
  var matchId = pickStr(body?.match_id);
  if (!isUuid(requestId) || !isUuid(matchId) || !isUuid(userId)) {
    return { ok: false, error: "invalid_ids", status: 400 };
  }

  var match = await loadMatchContext(cfg.serviceRoleKey, cfg.url, matchId);
  if (!match) return { ok: false, error: "match_not_found", status: 404 };
  if (pickStr(match.request_id) !== requestId) {
    return { ok: false, error: "request_mismatch", status: 400 };
  }

  var req = await loadRequestOwner(cfg.serviceRoleKey, cfg.url, requestId);
  if (!req) return { ok: false, error: "request_not_found", status: 404 };

  var ownerId = pickStr(req.owner_id);
  var candidateUserId = pickStr(match.candidate_user_id);
  if (!isUuid(ownerId) || !isUuid(candidateUserId)) {
    return { ok: false, error: "unresolved_participants", status: 422 };
  }

  if (userId !== candidateUserId) {
    return { ok: false, error: "forbidden_initiator_only", status: 403 };
  }

  var paid = await findPaidPayment(cfg.serviceRoleKey, cfg.url, matchId);
  if (paid) {
    return {
      ok: true,
      already_paid: true,
      payment_id: paid.id,
      match_id: matchId,
      request_id: requestId,
      contact_reveal: true,
    };
  }

  var origin = resolveSiteOrigin(request, body?.origin);
  var successUrl =
    pickStr(body?.success_url) ||
    buildDetailReturnUrl(origin, requestId, matchId, "success") +
      "&session_id={CHECKOUT_SESSION_ID}";
  var cancelUrl =
    pickStr(body?.cancel_url) || buildDetailReturnUrl(origin, requestId, matchId, "cancelled");

  var insertResult = await insertPaymentPending(cfg.serviceRoleKey, cfg.url, {
    request_id: requestId,
    match_id: matchId,
    payer_id: userId,
    amount_jpy: FEE_JPY,
    purpose: PURPOSE,
    status: "pending",
  });
  if (!insertResult.ok || !insertResult.row?.id) {
    return { ok: false, error: "payment_insert_failed", status: 500, detail: insertResult.error };
  }

  var paymentId = insertResult.row.id;
  var stripeSecret = pickStr(env.STRIPE_SECRET_KEY);
  var simulate = stripeSimulateEnabled(env);

  if (simulate) {
    var simSessionId = "prq_sim_" + paymentId.replace(/-/g, "");
    await patchPayment(cfg.serviceRoleKey, cfg.url, paymentId, {
      stripe_checkout_session_id: simSessionId,
    });
    await patchMatchStatus(cfg.serviceRoleKey, cfg.url, matchId, "payment_pending");
    return {
      ok: true,
      simulate: true,
      session_id: simSessionId,
      payment_id: paymentId,
      match_id: matchId,
      request_id: requestId,
      amount_jpy: FEE_JPY,
      confirm_path: "/api/platform-request-confirm-checkout",
    };
  }

  var { createCheckoutSession } = await import("./stripe-api.mjs");
  var productName = "Platform Request — 情報開示料（Talk開始）";
  var productDescription = pickStr(req.title, "依頼マッチ");
  var sessionResult = await createCheckoutSession(stripeSecret, {
    successUrl: successUrl,
    cancelUrl: cancelUrl,
    amountJpy: FEE_JPY,
    productName: productName,
    productDescription: productDescription,
    metadata: {
      order_type: ORDER_TYPE,
      request_id: requestId,
      match_id: matchId,
      payment_id: paymentId,
      payer_id: userId,
      purpose: PURPOSE,
    },
  });

  if (!sessionResult.ok || !sessionResult.data?.id) {
    await patchPayment(cfg.serviceRoleKey, cfg.url, paymentId, { status: "cancelled" });
    return {
      ok: false,
      error: "stripe_session_failed",
      status: 502,
      detail: sessionResult.error,
    };
  }

  await patchPayment(cfg.serviceRoleKey, cfg.url, paymentId, {
    stripe_checkout_session_id: sessionResult.data.id,
  });
  await patchMatchStatus(cfg.serviceRoleKey, cfg.url, matchId, "payment_pending");

  return {
    ok: true,
    session_id: sessionResult.data.id,
    url: sessionResult.data.url,
    payment_id: paymentId,
    match_id: matchId,
    request_id: requestId,
    amount_jpy: FEE_JPY,
  };
}

export async function confirmPlatformRequestCheckout(cfg, env, userId, body) {
  var sessionId = pickStr(body?.session_id);
  var requestId = pickStr(body?.request_id);
  var matchId = pickStr(body?.match_id);
  if (!sessionId) return { ok: false, error: "session_id_required", status: 400 };

  var payment = await findPaymentBySession(cfg.serviceRoleKey, cfg.url, sessionId);
  if (!payment) return { ok: false, error: "payment_not_found", status: 404 };

  if (requestId && pickStr(payment.request_id) !== requestId) {
    return { ok: false, error: "request_mismatch", status: 400 };
  }
  if (matchId && pickStr(payment.match_id) !== matchId) {
    return { ok: false, error: "match_mismatch", status: 400 };
  }

  requestId = pickStr(payment.request_id);
  matchId = pickStr(payment.match_id);

  var match = await loadMatchContext(cfg.serviceRoleKey, cfg.url, matchId);
  if (!match) return { ok: false, error: "match_not_found", status: 404 };

  var req = await loadRequestOwner(cfg.serviceRoleKey, cfg.url, requestId);
  if (!req) return { ok: false, error: "request_not_found", status: 404 };

  var ownerId = pickStr(req.owner_id);
  var candidateUserId = pickStr(match.candidate_user_id);
  if (!isParticipant(userId, ownerId, candidateUserId)) {
    return { ok: false, error: "forbidden_not_participant", status: 403 };
  }

  if (payment.status === "paid") {
    return {
      ok: true,
      already_paid: true,
      payment_id: payment.id,
      match_id: matchId,
      request_id: requestId,
      contact_reveal: true,
    };
  }

  var stripeSecret = pickStr(env.STRIPE_SECRET_KEY);
  var simulate = isSimulateSessionId(sessionId) && stripeSimulateEnabled(env);

  if (simulate) {
    if (userId !== pickStr(payment.payer_id) && userId !== ownerId) {
      return { ok: false, error: "forbidden_confirm", status: 403 };
    }
    var simResult = await markPaymentPaid(cfg, payment, null);
    if (!simResult.ok) return { ok: false, error: "payment_update_failed", status: 500 };
    return {
      ok: true,
      paid: true,
      simulate: true,
      payment_id: payment.id,
      match_id: matchId,
      request_id: requestId,
      contact_reveal: true,
    };
  }

  if (!stripeSecret) {
    return { ok: false, error: "stripe_not_configured", status: 503 };
  }

  var { retrieveCheckoutSession } = await import("./stripe-api.mjs");
  var sessionResult = await retrieveCheckoutSession(stripeSecret, sessionId);
  if (!sessionResult.ok) {
    return { ok: false, error: "stripe_retrieve_failed", status: 502, detail: sessionResult.error };
  }

  var session = sessionResult.data;
  if (pickStr(session.payment_status) !== "paid" && pickStr(session.status) !== "complete") {
    return { ok: false, error: "payment_not_completed", status: 409 };
  }

  var paidResult = await markPaymentPaid(cfg, payment, session);
  if (!paidResult.ok) return { ok: false, error: "payment_update_failed", status: 500 };

  return {
    ok: true,
    paid: true,
    payment_id: payment.id,
    match_id: matchId,
    request_id: requestId,
    contact_reveal: true,
  };
}

export async function getPlatformRequestContactReveal(cfg, userId, requestId, matchId) {
  if (!isUuid(requestId) || !isUuid(matchId) || !isUuid(userId)) {
    return { ok: false, error: "invalid_ids", status: 400 };
  }

  var match = await loadMatchContext(cfg.serviceRoleKey, cfg.url, matchId);
  if (!match) return { ok: false, error: "match_not_found", status: 404 };
  if (pickStr(match.request_id) !== requestId) {
    return { ok: false, error: "request_mismatch", status: 400 };
  }

  var req = await loadRequestOwner(cfg.serviceRoleKey, cfg.url, requestId);
  if (!req) return { ok: false, error: "request_not_found", status: 404 };

  var ownerId = pickStr(req.owner_id);
  var candidateUserId = pickStr(match.candidate_user_id);
  if (!isParticipant(userId, ownerId, candidateUserId)) {
    return { ok: false, error: "forbidden_not_participant", status: 403 };
  }

  var paid = await findPaidPayment(cfg.serviceRoleKey, cfg.url, matchId);
  if (!paid) {
    return { ok: false, error: "payment_required", status: 402 };
  }

  var ownerEmail = await fetchUserEmail(cfg.serviceRoleKey, cfg.url, ownerId);
  var candidateEmail = await fetchUserEmail(cfg.serviceRoleKey, cfg.url, candidateUserId);

  var reveal = {
    owner: { user_id: ownerId, email: ownerEmail || null },
    candidate: { user_id: candidateUserId, email: candidateEmail || null },
  };

  if (userId === ownerId) {
    return {
      ok: true,
      revealed_for: "owner",
      contact: reveal.candidate,
      payment_id: paid.id,
    };
  }

  return {
    ok: true,
    revealed_for: "candidate",
    contact: reveal.owner,
    payment_id: paid.id,
  };
}

export {
  FEE_JPY,
  PURPOSE,
  ORDER_TYPE,
  STAGING_REF,
  PRODUCTION_REF,
  getSupabaseConfig,
  assertStagingUrl,
  verifySupabaseJwt,
  pickStr,
  isUuid,
  jsonResponse,
  findPaidPayment,
};
