(function () {
  "use strict";

  var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
  var CREATE_CHECKOUT_PATH = "/api/platform-request-create-checkout";
  var CONFIRM_CHECKOUT_PATH = "/api/platform-request-confirm-checkout";
  var CONTACT_REVEAL_PATH = "/api/platform-request-contact-reveal";
  var FEE_JPY = 550;
  var SKU = "platform_request_match_contact";

  /** @type {Map<string, Promise<object>>} */
  var inflight = new Map();

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

  function resolveFeeYen() {
    var RT = window.TasuPricingRuntime;
    if (RT?.getSkuAmountJpy) {
      var fromCatalog = RT.getSkuAmountJpy(SKU);
      if (fromCatalog > 0) return fromCatalog;
    }
    return FEE_JPY;
  }

  function isConfigured() {
    if (!window.TasuSupabase?.isConfigured?.()) return false;
    var ref = window.TasuSupabase?.getProjectRef?.() || "";
    if (!ref || ref === PRODUCTION_REF) return false;
    return ref === STAGING_REF;
  }

  function getAccessToken() {
    var sb = window.TasuSupabase?.getClient?.();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      return res?.data?.session?.access_token || null;
    });
  }

  function edgePost(path, body) {
    return getAccessToken().then(function (token) {
      if (!token) return { ok: false, reason: "not_authenticated" };
      return fetch(path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: false, error: "invalid_json" };
          }).then(function (data) {
            return {
              ok: res.ok && data?.ok !== false,
              status: res.status,
              data: data,
              error: pickStr(data?.error),
            };
          });
        })
        .catch(function (err) {
          return { ok: false, reason: "network_error", error: err };
        });
    });
  }

  function buildDetailReturnUrls(requestId, matchId) {
    var origin = window.location.origin;
    var base =
      origin +
      "/platform-request-detail.html?id=" +
      encodeURIComponent(requestId) +
      "&match_id=" +
      encodeURIComponent(matchId) +
      "&prq_store=supabase";
    return {
      success:
        base + "&prq_checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel: base + "&prq_checkout=cancelled",
    };
  }

  function startCheckout(requestId, matchId) {
    var rid = pickStr(requestId);
    var mid = pickStr(matchId);
    if (!isUuid(rid) || !isUuid(mid)) {
      return Promise.resolve({ ok: false, reason: "invalid_args" });
    }
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, reason: "not_configured" });
    }

    var key = "checkout:" + rid + ":" + mid;
    if (inflight.has(key)) return inflight.get(key);

    var urls = buildDetailReturnUrls(rid, mid);
    var run = edgePost(CREATE_CHECKOUT_PATH, {
      request_id: rid,
      match_id: mid,
      success_url: urls.success,
      cancel_url: urls.cancel,
      origin: window.location.origin,
    }).then(function (res) {
      if (!res.ok) return res;
      var data = res.data || {};
      if (data.already_paid) {
        return { ok: true, already_paid: true, data: data };
      }
      if (data.simulate && data.session_id) {
        return confirmCheckout(data.session_id, rid, mid).then(function (confirmRes) {
          return confirmRes.ok ? confirmRes : { ok: false, error: confirmRes.error || "simulate_confirm_failed" };
        });
      }
      if (data.url) {
        window.location.href = data.url;
        return { ok: true, redirect: true, session_id: data.session_id };
      }
      return { ok: false, error: pickStr(data.error, "missing_checkout_url") };
    });

    inflight.set(key, run);
    return run.finally(function () {
      inflight.delete(key);
    });
  }

  function confirmCheckout(sessionId, requestId, matchId) {
    var sid = pickStr(sessionId);
    if (!sid) return Promise.resolve({ ok: false, reason: "missing_session" });
    return edgePost(CONFIRM_CHECKOUT_PATH, {
      session_id: sid,
      request_id: pickStr(requestId),
      match_id: pickStr(matchId),
    }).then(function (res) {
      if (!res.ok) return res;
      return {
        ok: true,
        paid: Boolean(res.data?.paid || res.data?.already_paid),
        contact_reveal: Boolean(res.data?.contact_reveal),
        data: res.data,
      };
    });
  }

  function fetchContactReveal(requestId, matchId) {
    return edgePost(CONTACT_REVEAL_PATH, {
      request_id: pickStr(requestId),
      match_id: pickStr(matchId),
    }).then(function (res) {
      if (!res.ok) return res;
      return {
        ok: true,
        revealed_for: res.data?.revealed_for,
        contact: res.data?.contact || null,
        data: res.data,
      };
    });
  }

  function hasPaidEntitlementAsync(matchId) {
    var mid = pickStr(matchId);
    if (!isUuid(mid) || !isConfigured()) {
      return Promise.resolve({ ok: false, paid: false });
    }
    var sb = window.TasuSupabase?.getClient?.();
    if (!sb) return Promise.resolve({ ok: false, paid: false });
    return sb
      .from("platform_request_payments")
      .select("id,status,match_id")
      .eq("match_id", mid)
      .eq("status", "paid")
      .limit(1)
      .then(function (res) {
        if (res.error) return { ok: false, paid: false, error: res.error };
        var row = res.data && res.data[0];
        return { ok: true, paid: Boolean(row), payment_id: row?.id || null };
      })
      .catch(function () {
        return { ok: false, paid: false };
      });
  }

  function parseCheckoutReturnParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      var checkout = pickStr(params.get("prq_checkout"));
      if (!checkout) return null;
      return {
        outcome: checkout,
        session_id: pickStr(params.get("session_id")),
        request_id: pickStr(params.get("id")),
        match_id: pickStr(params.get("match_id")),
      };
    } catch (_e) {
      return null;
    }
  }

  function clearCheckoutQueryParams() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("prq_checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (_e) {
      /* ignore */
    }
  }

  window.TasuPlatformRequestPaymentBridge = {
    STAGING_REF: STAGING_REF,
    SKU: SKU,
    FEE_JPY: FEE_JPY,
    CREATE_CHECKOUT_PATH: CREATE_CHECKOUT_PATH,
    CONFIRM_CHECKOUT_PATH: CONFIRM_CHECKOUT_PATH,
    CONTACT_REVEAL_PATH: CONTACT_REVEAL_PATH,
    isUuid: isUuid,
    isConfigured: isConfigured,
    resolveFeeYen: resolveFeeYen,
    startCheckout: startCheckout,
    confirmCheckout: confirmCheckout,
    fetchContactReveal: fetchContactReveal,
    hasPaidEntitlementAsync: hasPaidEntitlementAsync,
    parseCheckoutReturnParams: parseCheckoutReturnParams,
    clearCheckoutQueryParams: clearCheckoutQueryParams,
  };
})();
