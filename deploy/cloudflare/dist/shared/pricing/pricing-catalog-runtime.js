/**
 * Pricing catalog runtime bridge — Platform P1 matching + Boost · TASFUL AI P2
 * Requires generated tasful-pricing-config.js and/or tasful-pricing-snapshot.js
 */
(function (global) {
  "use strict";

  const SKU = Object.freeze({
    MATCH_JOB_CONTACT: "platform_match_job_contact",
    MATCH_GENERAL_CONTACT: "platform_match_general_contact",
    MATCH_CONNECT_RATE: "platform_match_connect_rate",
    BOOST_FEATURED_7D: "platform_boost_featured_7d",
    BOOST_FEATURED_30D: "platform_boost_featured_30d",
    BOOST_PR_30D: "platform_boost_pr_30d",
    TASFUL_AI_LITE: "tasful_ai_lite",
    TASFUL_AI_PRO: "tasful_ai_pro",
    TASFUL_AI_MAX: "tasful_ai_max_placeholder",
    TASFUL_AI_ADDON_2D_LIVE: "tasful_ai_addon_2d_live_300",
    TASFUL_AI_ADDON_3D_GENERATE: "tasful_ai_addon_3d_generate_500",
    TASFUL_AI_DEEP_RESEARCH: "tasful_ai_deep_research",
    TASFUL_AI_VIDEO_GENERATE: "tasful_ai_video_generate",
    TASFUL_AI_REALTIME_VOICE: "tasful_ai_realtime_voice",
    TASFUL_AI_ULTRA: "tasful_ai_ultra",
    TASFUL_AI_ENTERPRISE: "tasful_ai_enterprise",
    TASFUL_AI_API_CREDIT: "tasful_ai_api_credit",
  });

  const BOOST_PLAN_SKU = Object.freeze({
    featured_7days: SKU.BOOST_FEATURED_7D,
    featured_30days: SKU.BOOST_FEATURED_30D,
    pr_30days: SKU.BOOST_PR_30D,
  });

  const GENAI_PLAN_SKU = Object.freeze({
    genai_basic_300: SKU.TASFUL_AI_LITE,
    genai_pro_980: SKU.TASFUL_AI_PRO,
  });

  const GENAI_PLAN_CODE_SKU = Object.freeze({
    basic_300: SKU.TASFUL_AI_LITE,
    pro_980: SKU.TASFUL_AI_PRO,
    lite: SKU.TASFUL_AI_LITE,
    pro: SKU.TASFUL_AI_PRO,
  });

  const BILLING_PLAN_SKU = Object.freeze({
    lite: SKU.TASFUL_AI_LITE,
    pro: SKU.TASFUL_AI_PRO,
    max: SKU.TASFUL_AI_MAX,
  });

  const GENAI_ADDON_SKU = Object.freeze({
    genai_2d_live_300: SKU.TASFUL_AI_ADDON_2D_LIVE,
    genai_3d_generate_500: SKU.TASFUL_AI_ADDON_3D_GENERATE,
  });

  const ADDON_LEGACY_META = Object.freeze({
    genai_2d_live_300: {
      stripeProductId: "prod_TASFUL_GENAI_2D_LIVE_300",
      lookupKey: "tasful_genai_2d_live_300",
      checkoutMode: "subscription",
      apiReady: true,
    },
    genai_3d_generate_500: {
      stripeProductId: "prod_TASFUL_GENAI_3D_GENERATE_500",
      lookupKey: "tasful_genai_3d_generate_500",
      checkoutMode: "payment",
      apiReady: false,
    },
  });

  function catalog() {
    return global.TasuPricingCatalog || null;
  }

  function snapshotSkus() {
    const snap = global.TasuPricingSnapshot;
    return snap?.skus && typeof snap.skus === "object" ? snap.skus : null;
  }

  function getSkuRow(skuId) {
    const id = String(skuId || "").trim();
    if (!id) return null;
    const row = catalog()?.getSku?.(id);
    if (row) return row;
    const fb = catalog()?.fallbackSkus?.[id];
    if (fb) return fb;
    return snapshotSkus()?.[id] || null;
  }

  function getFixedAmount(skuId) {
    const c = catalog();
    const fromApi = c?.getFixedAmount?.(skuId);
    if (Number.isFinite(fromApi)) return fromApi;
    const row = getSkuRow(skuId);
    if (row && (row.billingType === "fixed" || row.billingType === "subscription")) {
      const n = Number(row.amount);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function calcConnectFee(gmvYen) {
    const skuId = SKU.MATCH_CONNECT_RATE;
    const c = catalog();
    const fromApi = c?.calcPercentFee?.(skuId, gmvYen);
    if (Number.isFinite(fromApi)) return fromApi;
    const row = getSkuRow(skuId);
    if (!row || row.billingType !== "percent") return null;
    const gmv = Math.max(0, Number(gmvYen) || 0);
    const pct = Number(row.percent) || 0;
    const min = Math.max(0, Number(row.minimumAmount) || 0);
    const raw = Math.floor(gmv * (pct / 100));
    return Math.max(min, raw);
  }

  function getConnectPercent() {
    const row = getSkuRow(SKU.MATCH_CONNECT_RATE);
    const pct = Number(row?.percent);
    return Number.isFinite(pct) ? pct : null;
  }

  function getConnectMinAmount() {
    const row = getSkuRow(SKU.MATCH_CONNECT_RATE);
    const min = Number(row?.minimumAmount);
    if (Number.isFinite(min)) return min;
    return getFixedAmount(SKU.MATCH_GENERAL_CONTACT);
  }

  function formatYen(amount) {
    const c = catalog();
    if (c?.formatYen) return c.formatYen(amount);
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    return "¥" + n.toLocaleString("ja-JP");
  }

  function formatYenSuffix(amount) {
    const n = Math.round(Number(amount) || 0);
    return `${n.toLocaleString("ja-JP")}円`;
  }

  function formatConnectRateLabel() {
    const pct = getConnectPercent();
    const min = getConnectMinAmount();
    if (!Number.isFinite(pct) || !Number.isFinite(min)) return "—";
    return `${pct}%（最低${formatYenSuffix(min)}）`;
  }

  function resolveBoostPriority(row, planId) {
    const features = Array.isArray(row?.features) ? row.features : [];
    const fromFeature = features
      .map((f) => String(f || ""))
      .find((f) => /^priority_\d+$/.test(f));
    if (fromFeature) {
      const n = Number(fromFeature.replace("priority_", ""));
      if (Number.isFinite(n)) return n;
    }
    if (planId === "featured_7days") return 1;
    if (planId === "featured_30days") return 2;
    return 3;
  }

  function resolveBoostKind(row) {
    const features = Array.isArray(row?.features) ? row.features : [];
    return features.includes("pr") ? "pr" : "featured";
  }

  function buildFeaturedPlan(planId) {
    const skuId = BOOST_PLAN_SKU[planId];
    if (!skuId) return null;
    const row = getSkuRow(skuId);
    const amountJpy = getFixedAmount(skuId);
    const days = Number(row?.durationDays);
    if (!Number.isFinite(amountJpy) || !Number.isFinite(days)) return null;
    return {
      id: planId,
      label: String(row?.label || planId),
      priceLabel: formatYen(amountJpy),
      days,
      amountJpy,
      kind: resolveBoostKind(row),
      priority: resolveBoostPriority(row, planId),
      stripePriceId: "",
    };
  }

  function buildFeaturedPlans() {
    const plans = {};
    for (const planId of Object.keys(BOOST_PLAN_SKU)) {
      const plan = buildFeaturedPlan(planId);
      if (plan) plans[planId] = plan;
    }
    return plans;
  }

  function isSkuEnabled(skuId) {
    const c = catalog();
    if (c?.isEnabled) return c.isEnabled(skuId) === true;
    const row = getSkuRow(skuId);
    return row?.enabled === true;
  }

  function getDailyLimit(skuId, featureKey) {
    const row = getSkuRow(skuId);
    const daily = row?.limits?.daily;
    if (!daily || typeof daily !== "object") return null;
    const v = daily[String(featureKey || "").trim()];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function resolveGenAiSkuForPlanCode(planCode) {
    const code = String(planCode || "").trim();
    if (!code || code === "free") return null;
    return GENAI_PLAN_CODE_SKU[code] || null;
  }

  function buildGenAiStripePlan(legacyPlanId) {
    const planId = String(legacyPlanId || "").trim();
    const skuId = GENAI_PLAN_SKU[planId];
    if (!skuId) return null;
    const row = getSkuRow(skuId);
    const amountJpy = getFixedAmount(skuId);
    if (!row || !Number.isFinite(amountJpy)) return null;
    const textLimit = getDailyLimit(skuId, "text_turn");
    const voiceLimit = getDailyLimit(skuId, "voice_turn");
    const imageLimit = getDailyLimit(skuId, "image_turn");
    if (!Number.isFinite(textLimit) || !Number.isFinite(voiceLimit) || !Number.isFinite(imageLimit)) {
      return null;
    }
    const planCode = planId === "genai_basic_300" ? "basic_300" : "pro_980";
    return {
      id: planId,
      plan: planCode,
      label: String(row.label || planId),
      priceLabel: `${formatYen(amountJpy)}/月`,
      amountJpy,
      checkoutMode: "subscription",
      dailyTextLimit: textLimit,
      dailyVoiceLimit: voiceLimit,
      dailyImageLimit: imageLimit,
      catalogSku: skuId,
      enabled: isSkuEnabled(skuId),
    };
  }

  function buildGenAiStripePlans() {
    const plans = {};
    for (const planId of Object.keys(GENAI_PLAN_SKU)) {
      const plan = buildGenAiStripePlan(planId);
      if (plan) plans[planId] = plan;
    }
    return plans;
  }

  function buildGenAiMaxPlaceholder() {
    const skuId = SKU.TASFUL_AI_MAX;
    const row = getSkuRow(skuId);
    const amountJpy = getFixedAmount(skuId);
    if (!row || !Number.isFinite(amountJpy)) return null;
    return {
      id: "genai_max_placeholder",
      plan: "max_placeholder",
      sku: skuId,
      label: String(row.label || "TASFUL AI Max（未実装）"),
      priceLabel: `${formatYen(amountJpy)}/月`,
      amountJpy,
      checkoutMode: "subscription",
      enabled: false,
      isPlaceholder: true,
      status: String(row.status || "draft"),
      catalogSku: skuId,
    };
  }

  function buildGenAiAddonPlan(legacyAddonId) {
    const planId = String(legacyAddonId || "").trim();
    const skuId = GENAI_ADDON_SKU[planId];
    const meta = ADDON_LEGACY_META[planId];
    if (!skuId || !meta) return null;
    const row = getSkuRow(skuId);
    const amountJpy = getFixedAmount(skuId);
    if (!row || !Number.isFinite(amountJpy)) return null;
    const enabled = isSkuEnabled(skuId);
    const priceLabel =
      meta.checkoutMode === "subscription" ? `${formatYen(amountJpy)}/月` : formatYen(amountJpy);
    return {
      id: planId,
      label: String(row.label || planId),
      priceLabel,
      amountJpy,
      checkoutMode: meta.checkoutMode,
      description: String(row.description || ""),
      stripeProductId: meta.stripeProductId,
      lookupKey: meta.lookupKey,
      catalogSku: skuId,
      enabled,
      provisional: row.provisional === true,
      status: String(row.status || "draft"),
      apiReady: meta.apiReady === true && enabled,
    };
  }

  function buildGenAiAddonPlans() {
    const plans = {};
    for (const planId of Object.keys(GENAI_ADDON_SKU)) {
      const plan = buildGenAiAddonPlan(planId);
      if (plan) plans[planId] = plan;
    }
    return plans;
  }

  const BILLING_PLAN_META = Object.freeze({
    lite: {
      label: "Lite",
      aiModels: "Gemini",
      features: ["基本チャット", "広告なし", "Web検索", "画像生成（少量）"],
      recommended: false,
    },
    pro: {
      label: "Pro",
      aiModels: "Gemini · ChatGPT · Claude",
      features: ["マルチAIルーティング", "画像生成", "Web検索", "優先処理"],
      recommended: true,
    },
    max: {
      label: "Max",
      aiModels: "全AI · フェアユース拡張",
      features: ["Proの全機能", "回答数拡張", "動画生成", "大容量解析"],
      recommended: false,
    },
  });

  function buildGenAiBillingPlan(planId) {
    const id = String(planId || "").trim();
    const skuId = BILLING_PLAN_SKU[id];
    const meta = BILLING_PLAN_META[id];
    if (!skuId || !meta) return null;
    const amountJpy = getFixedAmount(skuId);
    if (!Number.isFinite(amountJpy)) return null;
    const enabled = id === "max" ? isSkuEnabled(skuId) : true;
    return {
      id,
      label: meta.label,
      priceYen: amountJpy,
      priceUnit: "/ 月",
      aiModels: meta.aiModels,
      features: [...meta.features],
      recommended: meta.recommended,
      catalogSku: skuId,
      enabled,
      isPlaceholder: id === "max" && !enabled,
    };
  }

  function buildGenAiBillingPlans() {
    const plans = [];
    for (const planId of Object.keys(BILLING_PLAN_SKU)) {
      const plan = buildGenAiBillingPlan(planId);
      if (plan) plans.push(plan);
    }
    return plans;
  }

  function buildGenAiUsageSnapshot(planId) {
    const skuId = BILLING_PLAN_SKU[planId] || SKU.TASFUL_AI_PRO;
    const textLimit = getDailyLimit(skuId, "text_turn");
    const imageLimit = getDailyLimit(skuId, "image_turn");
    const U = global.TasuAiWorkspaceUsage;
    const textUsed = Math.max(0, Number(U?.getUsage?.()?.textTurnUsed) || 0);
    if (!Number.isFinite(textLimit)) {
      return {
        aiChat: { used: textUsed, limit: 1, unit: "メッセージ" },
        imageGen: { used: 0, limit: 1, unit: "枚" },
        videoGen: { used: 0, limit: 0, unit: "分" },
        webSearch: { used: 0, limit: 1, unit: "回" },
      };
    }
    const imageUsed = Number.isFinite(imageLimit) ? Math.min(textUsed, imageLimit) : 0;
    return {
      aiChat: { used: textUsed, limit: textLimit, unit: "メッセージ" },
      imageGen: {
        used: imageUsed,
        limit: Number.isFinite(imageLimit) ? imageLimit : 1,
        unit: "枚",
      },
      videoGen: { used: 0, limit: 0, unit: "分" },
      webSearch: { used: 0, limit: textLimit, unit: "回" },
    };
  }

  global.TasuPricingRuntime = {
    SKU,
    BOOST_PLAN_SKU,
    GENAI_PLAN_SKU,
    GENAI_PLAN_CODE_SKU,
    BILLING_PLAN_SKU,
    GENAI_ADDON_SKU,
    getSkuRow,
    getFixedAmount,
    calcConnectFee,
    getConnectPercent,
    getConnectMinAmount,
    formatYen,
    formatYenSuffix,
    formatConnectRateLabel,
    buildFeaturedPlan,
    buildFeaturedPlans,
    isSkuEnabled,
    getDailyLimit,
    resolveGenAiSkuForPlanCode,
    buildGenAiStripePlan,
    buildGenAiStripePlans,
    buildGenAiMaxPlaceholder,
    buildGenAiAddonPlan,
    buildGenAiAddonPlans,
    buildGenAiBillingPlan,
    buildGenAiBillingPlans,
    buildGenAiUsageSnapshot,
  };
})(typeof window !== "undefined" ? window : globalThis);
