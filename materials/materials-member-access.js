/**
 * TASFUL Materials — 会員アクセス判定（ログイン · 有料会員 · 将来 API 差し替え用）
 */
(function (global) {
  "use strict";

  const PAID_PLANS = new Set(["standard", "pro", "premium", "paid", "plus"]);

  function pickPlan(raw) {
    return String(
      raw?.plan ||
        raw?.subscriptionPlan ||
        raw?.subscription_plan ||
        raw?.member_plan ||
        raw?.memberPlan ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  function isAuthenticatedSync() {
    return Boolean(global.TasuMemberAuth?.isAuthenticatedSync?.());
  }

  async function isAuthenticated() {
    if (isAuthenticatedSync()) return true;
    return Boolean(await global.TasuMemberAuth?.isAuthenticated?.());
  }

  /**
   * 有料会員判定 — session / profile の plan フィールド、または dev 用 ?matPaid=1
   * 将来: Supabase profiles / Stripe subscription API に差し替え
   */
  function isPaidMemberSync() {
    if (!isAuthenticatedSync()) return false;
    try {
      if (new URLSearchParams(global.location.search).get("matPaid") === "1") return true;
    } catch {
      /* ignore */
    }
    const session = global.TasuMemberAuth?.readMemberSession?.();
    if (PAID_PLANS.has(pickPlan(session))) return true;
    const profile = global.TasuMemberAuth?.readLastProfile?.();
    if (PAID_PLANS.has(pickPlan(profile))) return true;
    return false;
  }

  function buildLoginUrl(returnUrl) {
    const ret =
      returnUrl ||
      `${global.location.pathname || "/materials/detail.html"}${global.location.search || ""}`;
    return `/login.html?return=${encodeURIComponent(ret)}`;
  }

  function redirectToLogin(returnUrl) {
    global.location.href = buildLoginUrl(returnUrl);
  }

  global.TasuMaterialsMemberAccess = {
    PAID_PLANS,
    isAuthenticatedSync,
    isAuthenticated,
    isPaidMemberSync,
    buildLoginUrl,
    redirectToLogin,
  };
})(typeof window !== "undefined" ? window : globalThis);
