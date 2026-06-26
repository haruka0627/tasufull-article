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

  const PLANS = {
    featured_7days: {
      id: "featured_7days",
      label: "上位掲載（7日）",
      priceLabel: "¥980",
      days: 7,
      amountJpy: 980,
      kind: "featured",
      priority: 1,
      stripePriceId: "",
    },
    featured_30days: {
      id: "featured_30days",
      label: "上位掲載（30日）",
      priceLabel: "¥2,980",
      days: 30,
      amountJpy: 2980,
      kind: "featured",
      priority: 2,
      stripePriceId: "",
    },
    pr_30days: {
      id: "pr_30days",
      label: "PR掲載（30日）",
      priceLabel: "¥4,980",
      days: 30,
      amountJpy: 4980,
      kind: "pr",
      priority: 3,
      stripePriceId: "",
    },
  };

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
