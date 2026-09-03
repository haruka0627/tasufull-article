/**
 * TASFUL Option Access client (Phase 8G).
 * Browser helper for POST /api/tasful-option-access.
 * CLIENT STATE IS NOT AUTHORITY — always call server before Premium enable.
 */
(function (global) {
  "use strict";

  var OPTION_BEAUTY_PREMIUM = "beauty_premium";
  var ENDPOINT = "/api/tasful-option-access";

  function getSupabaseClient() {
    try {
      if (global.TasuSupabase?.getClient) return global.TasuSupabase.getClient();
    } catch (_) {}
    try {
      if (global.supabase?.auth) return global.supabase;
    } catch (_) {}
    return null;
  }

  async function getBearerToken() {
    var sb = getSupabaseClient();
    if (!sb?.auth?.getSession) return null;
    var res = await sb.auth.getSession();
    var token = res?.data?.session?.access_token || "";
    return token || null;
  }

  /**
   * @param {{ optionId?: string, skipLifecycle?: boolean }} [opts]
   * @returns {Promise<{
   *   ok: boolean,
   *   allowed: boolean,
   *   source: string|null,
   *   expiresAt: string|null,
   *   http: number,
   *   error: string|null,
   *   detail: object|null,
   *   optionId: string
   * }>}
   */
  async function checkOptionAccess(opts) {
    var optionId = String(opts?.optionId || OPTION_BEAUTY_PREMIUM).trim();
    var deny = function (error, http) {
      return {
        ok: false,
        allowed: false,
        source: null,
        expiresAt: null,
        http: http || 0,
        error: error || "denied",
        detail: null,
        optionId: optionId,
      };
    };

    var token = null;
    try {
      token = await getBearerToken();
    } catch (_) {
      token = null;
    }
    if (!token) return deny("auth_required", 401);

    var res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          option_id: optionId,
          skip_lifecycle: opts?.skipLifecycle === true,
        }),
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch (e) {
      return deny("network_error", 0);
    }

    var json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }

    if (!res.ok || !json?.ok) {
      return deny(
        (json && json.error) || "access_denied",
        res.status || 403,
      );
    }

    var access = json.access || {};
    return {
      ok: true,
      allowed: access.allowed === true,
      source: access.source || null,
      expiresAt: access.expiresAt || null,
      http: res.status,
      error: access.allowed === true ? null : (json.detail?.benefitReason || "denied"),
      detail: json.detail || null,
      optionId: optionId,
    };
  }

  function checkBeautyPremiumAccess(opts) {
    return checkOptionAccess(
      Object.assign({}, opts || {}, { optionId: OPTION_BEAUTY_PREMIUM }),
    );
  }

  /**
   * Map access result to short UI label (no economics / internal scores).
   */
  function accessUiLabel(access) {
    if (!access || access.allowed !== true) return "Premium Option";
    if (access.source === "paid") return "Premium利用中";
    if (access.source === "benefit") return "特典で利用中";
    return "Premium利用中";
  }

  global.TasuOptionAccessClient = {
    OPTION_BEAUTY_PREMIUM: OPTION_BEAUTY_PREMIUM,
    ENDPOINT: ENDPOINT,
    checkOptionAccess: checkOptionAccess,
    checkBeautyPremiumAccess: checkBeautyPremiumAccess,
    accessUiLabel: accessUiLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
