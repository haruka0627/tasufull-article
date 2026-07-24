/**
 * Stripe 上位掲載 — エンドポイント・プラン表示（フロント共通）
 * ブラウザでは anon public（sb_publishable_...）のみ使用。service_role は Edge Function 内のみ。
 */
(function () {
  "use strict";

  const raw = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
  const base = String(raw.url || raw.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");

  const resolveKey =
    window.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
    function fallbackResolve(config) {
      const k = String(config?.anonKey || config?.anon_key || "").trim();
      if (/^sb_secret_/i.test(k)) return "";
      return k;
    };

  const anonKey = resolveKey(raw);

  function fnUrl(name) {
    if (!base) return "";
    return `${base}/functions/v1/${name}`;
  }

  function buildPlans() {
    const RT = window.TasuPricingRuntime;
    if (RT?.buildFeaturedPlans) {
      const fromCatalog = RT.buildFeaturedPlans();
      if (fromCatalog && Object.keys(fromCatalog).length > 0) return fromCatalog;
    }
    return {};
  }

  const PLANS = buildPlans();

  window.TasuStripeFeaturedConfig = {
    supabaseUrl: base,
    anonKey,
    createCheckoutUrl: fnUrl("stripe-create-checkout"),
    confirmCheckoutUrl: fnUrl("stripe-confirm-checkout"),
    PLANS,
    resolvePublishableAnonKey: resolveKey,
    getPublishableAnonKey() {
      return anonKey;
    },
    isConfigured() {
      return Boolean(
        base &&
        anonKey &&
        this.createCheckoutUrl &&
        this.confirmCheckoutUrl
      );
    },
  };
})();
