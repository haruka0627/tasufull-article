/**
 * Stripe 生成AIプラン — エンドポイント・プラン定義（フロント共通）
 * 価格・日次上限: shared/pricing catalog（TasuPricingRuntime）参照。
 * 価格IDは Supabase Edge Function 環境変数 STRIPE_GENAI_PRICE_* で設定。
 * 未設定時は Edge Function が price_data で Checkout を生成します。
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

  const LEGACY_GENAI_LABELS = Object.freeze({
    genai_basic_300: "生成AIスタンダード",
    genai_pro_980: "生成AIプロ",
  });

  const LEGACY_STRIPE_PRODUCT_IDS = Object.freeze({
    genai_basic_300: "prod_TASFUL_GENAI_BASIC_300",
    genai_pro_980: "prod_TASFUL_GENAI_PRO_980",
  });

  const FREE_PLAN = {
    plan: "free",
    label: "無料枠",
    priceLabel: "¥0",
    dailyTextLimit: 5,
    dailyVoiceLimit: 5,
    dailyImageLimit: 3,
    amountJpy: 0,
  };

  function hydrateStripePlan(planId) {
    const RT = window.TasuPricingRuntime;
    const built = RT?.buildGenAiStripePlan?.(planId);
    if (!built) return null;
    return {
      ...built,
      label: LEGACY_GENAI_LABELS[planId] || built.label,
      stripeProductId: LEGACY_STRIPE_PRODUCT_IDS[planId] || "",
      stripePriceId: "",
    };
  }

  const PLANS = (function buildPlans() {
    const plans = {};
    for (const planId of ["genai_basic_300", "genai_pro_980"]) {
      const plan = hydrateStripePlan(planId);
      if (plan) plans[planId] = plan;
    }
    return plans;
  })();

  const MAX_PLACEHOLDER = window.TasuPricingRuntime?.buildGenAiMaxPlaceholder?.() || null;

  const ADDON_PLANS = (function buildAddons() {
    const built = window.TasuPricingRuntime?.buildGenAiAddonPlans?.();
    return built && typeof built === "object" ? built : {};
  })();

  window.TasuStripeGenAiConfig = {
    supabaseUrl: base,
    anonKey,
    FREE_PLAN,
    PLANS,
    MAX_PLACEHOLDER,
    ADDON_PLANS,
    STRIPE_PRODUCT_IDS: {
      genai_basic_300: PLANS.genai_basic_300?.stripeProductId || LEGACY_STRIPE_PRODUCT_IDS.genai_basic_300,
      genai_pro_980: PLANS.genai_pro_980?.stripeProductId || LEGACY_STRIPE_PRODUCT_IDS.genai_pro_980,
      genai_2d_live_300: ADDON_PLANS.genai_2d_live_300?.stripeProductId || "prod_TASFUL_GENAI_2D_LIVE_300",
      genai_3d_generate_500: ADDON_PLANS.genai_3d_generate_500?.stripeProductId || "prod_TASFUL_GENAI_3D_GENERATE_500",
    },
    createCheckoutUrl: fnUrl("stripe-create-genai-checkout"),
    confirmCheckoutUrl: fnUrl("stripe-confirm-genai-checkout"),
    getPlanUrl: fnUrl("stripe-get-genai-plan"),
    createPortalUrl: fnUrl("stripe-create-genai-portal"),
    resolvePublishableAnonKey: resolveKey,
    getPublishableAnonKey() {
      return anonKey;
    },
    isConfigured() {
      return Boolean(
        base &&
          anonKey &&
          this.createCheckoutUrl &&
          this.confirmCheckoutUrl &&
          this.getPlanUrl &&
          this.createPortalUrl
      );
    },
  };
})();
