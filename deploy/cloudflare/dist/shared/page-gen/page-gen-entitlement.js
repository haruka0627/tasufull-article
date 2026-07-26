/**
 * TASFUL Page Gen — paid feature entitlement contract.
 *
 * Phase 1 does not call billing APIs. A host verifies the user's plan with
 * the existing TASFUL billing system and passes the resulting entitlement.
 */
(function (global) {
  "use strict";

  const FEATURE_ID = "ai_page_gen_paid";
  const STATUS = Object.freeze({
    UNKNOWN: "unknown",
    ACTIVE: "active",
    INACTIVE: "inactive",
    EXPIRED: "expired",
  });

  function normalize(raw) {
    const status = Object.values(STATUS).includes(raw?.status) ? raw.status : STATUS.UNKNOWN;
    return {
      feature_id: String(raw?.feature_id || FEATURE_ID),
      status,
      plan: String(raw?.plan || ""),
      source: String(raw?.source || ""),
      verified_at: raw?.verified_at ? String(raw.verified_at) : null,
      expires_at: raw?.expires_at ? String(raw.expires_at) : null,
    };
  }

  function isActive(raw, now) {
    const entitlement = normalize(raw);
    if (entitlement.feature_id !== FEATURE_ID || entitlement.status !== STATUS.ACTIVE) return false;
    if (!entitlement.expires_at) return true;
    const at = now ? new Date(now).getTime() : Date.now();
    const expires = new Date(entitlement.expires_at).getTime();
    return Number.isFinite(expires) && expires > at;
  }

  function check(raw, now) {
    const entitlement = normalize(raw);
    if (isActive(entitlement, now)) {
      return { ok: true, entitlement, error: null };
    }
    return {
      ok: false,
      entitlement,
      error: {
        code: "paid_entitlement_required",
        message: "AIページ生成の有効な有料プランが必要です",
      },
    };
  }

  global.TasuPageGenEntitlement = {
    FEATURE_ID,
    STATUS,
    normalize,
    isActive,
    check,
  };
})(typeof window !== "undefined" ? window : globalThis);
