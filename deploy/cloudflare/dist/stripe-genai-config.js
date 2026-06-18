/**
 * Stripe 生成AIプラン — エンドポイント・プラン定義（フロント共通）
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

  const FREE_PLAN = {
    plan: "free",
    label: "無料枠",
    priceLabel: "¥0",
    dailyTextLimit: 5,
    dailyVoiceLimit: 5,
    dailyImageLimit: 3,
    amountJpy: 0,
  };

  const PLANS = {
    genai_basic_300: {
      id: "genai_basic_300",
      plan: "basic_300",
      label: "生成AIスタンダード",
      priceLabel: "¥300/月",
      amountJpy: 300,
      checkoutMode: "subscription",
      dailyTextLimit: 30,
      dailyVoiceLimit: 30,
      dailyImageLimit: 10,
      stripeProductId: "prod_TASFUL_GENAI_BASIC_300",
      stripePriceId: "",
    },
    genai_pro_980: {
      id: "genai_pro_980",
      plan: "pro_980",
      label: "生成AIプロ",
      priceLabel: "¥980/月",
      amountJpy: 980,
      checkoutMode: "subscription",
      dailyTextLimit: 100,
      dailyVoiceLimit: 100,
      dailyImageLimit: 30,
      stripeProductId: "prod_TASFUL_GENAI_PRO_980",
      stripePriceId: "",
    },
  };

  const ADDON_PLANS = {
    genai_2d_live_300: {
      id: "genai_2d_live_300",
      label: "TASFUL AI 2D Live",
      priceLabel: "¥300/月",
      amountJpy: 300,
      checkoutMode: "subscription",
      description: "画像アニメ（2D Live）を無制限で利用",
      stripeProductId: "prod_TASFUL_GENAI_2D_LIVE_300",
      lookupKey: "tasful_genai_2d_live_300",
    },
    genai_3d_generate_500: {
      id: "genai_3d_generate_500",
      label: "TASFUL AI 3D Generate",
      priceLabel: "¥500",
      amountJpy: 500,
      checkoutMode: "payment",
      description: "3D生成チケット +1（3D生成APIは準備中）",
      stripeProductId: "prod_TASFUL_GENAI_3D_GENERATE_500",
      lookupKey: "tasful_genai_3d_generate_500",
      apiReady: false,
    },
  };

  window.TasuStripeGenAiConfig = {
    supabaseUrl: base,
    anonKey,
    FREE_PLAN,
    PLANS,
    ADDON_PLANS,
    STRIPE_PRODUCT_IDS: {
      genai_basic_300: PLANS.genai_basic_300.stripeProductId,
      genai_pro_980: PLANS.genai_pro_980.stripeProductId,
      genai_2d_live_300: ADDON_PLANS.genai_2d_live_300.stripeProductId,
      genai_3d_generate_500: ADDON_PLANS.genai_3d_generate_500.stripeProductId,
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
