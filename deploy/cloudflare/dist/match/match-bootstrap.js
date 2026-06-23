/**
 * TASFUL MATCH — runtime bootstrap (JWT · live API · functions base)
 * Load after: chat-supabase-config.js, auth-current-user.js (optional), tasu-supabase-client.js (optional),
 *             match-auth.js, match-api.js
 */
(function (global) {
  "use strict";

  var booted = false;

  function pickString() {
    for (var i = 0; i < arguments.length; i += 1) {
      var v = String(arguments[i] ?? "").trim();
      if (v) return v;
    }
    return "";
  }

  function resolveFunctionsBaseUrl() {
    var explicit = pickString(global.__MATCH_FUNCTIONS_BASE__);
    if (explicit) return explicit.replace(/\/+$/, "");

    var cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    var url = pickString(cfg.url, cfg.SUPABASE_URL).replace(/\/$/, "");
    var ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
    if (ref) return "https://" + ref + ".supabase.co/functions/v1";
    return "";
  }

  function hasRealJwt() {
    var auth = global.TasfulMatchAuth;
    if (!auth) return false;
    var token = auth.getAccessToken?.() || "";
    return auth.isRealJwt?.(token) || (token && token.indexOf("stub-match-token") < 0 && token.split(".").length === 3);
  }

  function shouldUseLiveApi() {
    var params = new URLSearchParams(global.location?.search || "");
    if (params.get("client_stub") === "1") return false;
    if (params.get("edge_stub") === "1" || params.get("live") === "1") return true;
    if (hasRealJwt()) return true;
    if (global.TasfulMatchAuth?.isDemoMode?.()) return false;
    return false;
  }

  function configureLiveApi() {
    var api = global.TasfulMatchAPI;
    if (!api) return { ok: false, reason: "TasfulMatchAPI missing" };

    var base = resolveFunctionsBaseUrl();
    if (!base) return { ok: false, reason: "functions base missing" };

    global.__MATCH_FUNCTIONS_BASE__ = base;
    api.configure({
      mode: "live",
      functionsBaseUrl: base,
      getAuthHeaders: function () {
        if (global.TasfulMatchAuth?.ensureFreshAccessToken) {
          return global.TasfulMatchAuth.ensureFreshAccessToken().then(function () {
            return global.TasfulMatchAuth.getAuthHeaders();
          });
        }
        return global.TasfulMatchAuth?.getAuthHeaders?.() || {};
      },
    });
    return { ok: true, mode: "live", functionsBaseUrl: base };
  }

  function guardProductionStub() {
    var auth = global.TasfulMatchAuth;
    var api = global.TasfulMatchAPI;
    if (!auth?.isProductionHost?.() || !api) return;

    if (api.mode === "client_stub" && !auth.isDemoMode?.()) {
      console.error("[MatchBootstrap] client_stub is forbidden on production host");
    }
  }

  function init() {
    if (booted) return;
    booted = true;

    if (shouldUseLiveApi()) {
      var result = configureLiveApi();
      if (!result.ok) {
        console.warn("[MatchBootstrap] live API not configured:", result.reason);
      }
    }

    guardProductionStub();

    if (global.MatchLoginGate?.maybeShowForPage) {
      global.MatchLoginGate.maybeShowForPage();
    }
  }

  global.MatchBootstrap = {
    init: init,
    configureLiveApi: configureLiveApi,
    resolveFunctionsBaseUrl: resolveFunctionsBaseUrl,
    shouldUseLiveApi: shouldUseLiveApi,
    hasRealJwt: hasRealJwt,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
