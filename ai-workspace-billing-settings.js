/**
 * TASFUL AI Workspace — 請求設定（プラン · 利用状況 · 支払い · 履歴）
 *
 * Billing Adapter（P4 整理 · 実装は将来）
 * - 現状モード: localStorage デモ（`STORAGE_KEY` / `loadState` / `persistState`）
 * - 将来モード: Stripe + Edge（`stripe-get-genai-plan` · `stripe-create-genai-portal` 等）
 * - 切替ポイント:
 *   1. `loadState` / `persistState` → Edge API フェッチ + キャッシュ
 *   2. `runUpgradePlan` / `runManagePlan` → `TasuStripeGenAiConfig.createCheckoutUrl` / `createPortalUrl`
 *   3. `buildBillingHistoryFromCatalog` → Stripe Invoice / Customer Portal 履歴
 *   4. `formatForApiRequest` → 本番 API 契約の正本（UI・Edge 双方が参照）
 * 詳細: docs/pricing-catalog.md §Billing Adapter
 */
(function (global) {
  "use strict";

  /** @type {"localStorage_demo"} */
  const BILLING_ADAPTER_MODE = "localStorage_demo";

  const STORAGE_KEY = "tasu_ai_billing_settings";
  const EVENT_NAME = "tasu:ai-billing-settings-changed";

  const DEFAULT_PAYMENT_METHODS = Object.freeze([
    {
      id: "pm_visa_1234",
      brand: "Visa",
      last4: "1234",
      expMonth: 12,
      expYear: 28,
      isDefault: true,
    },
  ]);

  function catalogRuntime() {
    return global.TasuPricingRuntime || null;
  }

  function buildUsageFromCatalog(planId) {
    const RT = catalogRuntime();
    if (RT?.buildGenAiUsageSnapshot) return RT.buildGenAiUsageSnapshot(planId || "pro");
    return {
      aiChat: { used: 0, limit: 1, unit: "メッセージ" },
      imageGen: { used: 0, limit: 1, unit: "枚" },
      videoGen: { used: 0, limit: 0, unit: "分" },
      webSearch: { used: 0, limit: 1, unit: "回" },
    };
  }

  function buildAvailablePlansFromCatalog() {
    const RT = catalogRuntime();
    const plans = RT?.buildGenAiBillingPlans?.();
    if (Array.isArray(plans) && plans.length) return plans;
    return [];
  }

  function buildBillingHistoryFromCatalog() {
    const RT = catalogRuntime();
    const monthly = RT?.getFixedAmount?.(RT?.SKU?.TASFUL_AI_PRO || "tasful_ai_pro");
    const proMonthly = Number.isFinite(monthly) ? monthly : 0;
    const proAnnual = proMonthly > 0 ? proMonthly * 12 : 0;
    return [
      {
        id: "inv_20260620",
        date: "2026-06-20T00:00:00.000Z",
        planLabel: "TASFUL AI Pro（年間プラン）",
        amountYen: proAnnual,
      },
      {
        id: "inv_20260520",
        date: "2026-05-20T00:00:00.000Z",
        planLabel: "TASFUL AI Pro（年間プラン）",
        amountYen: proAnnual,
      },
      {
        id: "inv_20260420",
        date: "2026-04-20T00:00:00.000Z",
        planLabel: "TASFUL AI Pro（月額プラン）",
        amountYen: proMonthly,
      },
    ];
  }

  function createDefaultState() {
    return {
      currentPlan: "pro",
      currentPlanLabel: "TASFUL AI Pro",
      billingCycle: "annual",
      renewalDate: "2026-07-20T00:00:00.000Z",
      usage: buildUsageFromCatalog("pro"),
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      defaultPaymentMethodId: "pm_visa_1234",
      billingHistory: buildBillingHistoryFromCatalog(),
      availablePlans: buildAvailablePlansFromCatalog(),
      updatedAt: "",
    };
  }

  /** @type {ReturnType<typeof createDefaultState>} */
  let DEFAULT_STATE;
  /** @type {ReturnType<typeof cloneState>} */
  let cachedState;

  function normalizeUsageItem(item, fallback) {
    const base = fallback || { used: 0, limit: 1, unit: "" };
    const used = Math.max(0, Number(item?.used ?? base.used) || 0);
    const limit = Math.max(1, Number(item?.limit ?? base.limit) || 1);
    return {
      used: Math.min(used, limit * 10),
      limit,
      unit: String(item?.unit || base.unit || ""),
    };
  }

  function cloneUsage(source, planId) {
    const base = buildUsageFromCatalog(planId || "pro");
    const input = source && typeof source === "object" ? source : {};
    return {
      aiChat: normalizeUsageItem(input.aiChat, base.aiChat),
      imageGen: normalizeUsageItem(input.imageGen, base.imageGen),
      videoGen: normalizeUsageItem(input.videoGen, base.videoGen),
      webSearch: normalizeUsageItem(input.webSearch, base.webSearch),
    };
  }

  function clonePaymentMethods(source) {
    const list = Array.isArray(source) ? source : DEFAULT_PAYMENT_METHODS;
    return list.map((item, index) => ({
      id: String(item?.id || `pm_${index}`),
      brand: String(item?.brand || "Card"),
      last4: String(item?.last4 || "0000").slice(-4),
      expMonth: Math.min(12, Math.max(1, Number(item?.expMonth) || 1)),
      expYear: Number(item?.expYear) || 30,
      isDefault: Boolean(item?.isDefault),
    }));
  }

  function cloneBillingHistory(source) {
    const list = Array.isArray(source) ? source : buildBillingHistoryFromCatalog();
    return list.map((item, index) => ({
      id: String(item?.id || `inv_${index}`),
      date: item?.date || new Date().toISOString(),
      planLabel: String(item?.planLabel || ""),
      amountYen: Math.max(0, Number(item?.amountYen) || 0),
    }));
  }

  function cloneAvailablePlans(source) {
    const fallbackList = buildAvailablePlansFromCatalog();
    const list = Array.isArray(source) && source.length ? source : fallbackList;
    return list.map((item, index) => {
      const fallback = fallbackList[index] || fallbackList[0] || {
        id: "pro",
        label: "Pro",
        priceYen: 0,
        priceUnit: "/ 月",
        aiModels: "",
        features: [],
        recommended: false,
      };
      return {
        id: String(item?.id || fallback.id),
        label: String(item?.label || fallback.label),
        priceYen: Math.max(0, Number(item?.priceYen ?? fallback.priceYen) || 0),
        priceUnit: String(item?.priceUnit || fallback.priceUnit || "/ 月"),
        aiModels: String(item?.aiModels || fallback.aiModels || ""),
        features: Array.isArray(item?.features)
          ? item.features.map((f) => String(f))
          : [...(fallback.features || [])],
        recommended: Boolean(item?.recommended ?? fallback.recommended),
        isPlaceholder: Boolean(item?.isPlaceholder ?? fallback.isPlaceholder),
        enabled: item?.enabled !== false && fallback.enabled !== false,
        catalogSku: String(item?.catalogSku || fallback.catalogSku || ""),
      };
    });
  }

  function cloneState(source) {
    const defaults = createDefaultState();
    const paymentMethods = clonePaymentMethods(source.paymentMethods);
    const defaultId =
      source.defaultPaymentMethodId ||
      paymentMethods.find((pm) => pm.isDefault)?.id ||
      paymentMethods[0]?.id ||
      "";
    return {
      currentPlan: String(source.currentPlan || defaults.currentPlan),
      currentPlanLabel: String(source.currentPlanLabel || defaults.currentPlanLabel),
      billingCycle: source.billingCycle === "monthly" ? "monthly" : "annual",
      renewalDate: source.renewalDate || defaults.renewalDate,
      usage: cloneUsage(source.usage, source.currentPlan || defaults.currentPlan),
      paymentMethods,
      defaultPaymentMethodId: String(defaultId),
      billingHistory: cloneBillingHistory(source.billingHistory),
      availablePlans: cloneAvailablePlans(source.availablePlans),
      updatedAt: source.updatedAt || "",
    };
  }

  function sanitizePartial(input, base) {
    const next = cloneState(base);
    if (!input || typeof input !== "object") return next;
    Object.keys(createDefaultState()).forEach((key) => {
      if (key in input && key !== "updatedAt") {
        if (key === "usage") {
          next.usage = cloneUsage({ ...next.usage, ...input.usage }, next.currentPlan);
        } else if (key === "paymentMethods") next.paymentMethods = clonePaymentMethods(input.paymentMethods);
        else if (key === "billingHistory") next.billingHistory = cloneBillingHistory(input.billingHistory);
        else if (key === "availablePlans") next.availablePlans = cloneAvailablePlans(input.availablePlans);
        else next[key] = cloneState({ ...next, [key]: input[key] })[key];
      }
    });
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function loadState() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return cloneState(DEFAULT_STATE);
      return sanitizePartial(raw, DEFAULT_STATE);
    } catch {
      return cloneState(DEFAULT_STATE);
    }
  }

  function persistState(next, changedKey) {
    cachedState = cloneState(next);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    } catch {
      /* ignore */
    }
    global.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { state: getSnapshot(), changedKey: changedKey || null },
      })
    );
    return cachedState;
  }

  function getState() {
    return cachedState;
  }

  function getSnapshot() {
    return Object.freeze(cloneState(cachedState));
  }

  function setState(partial, meta = {}) {
    const next = sanitizePartial(partial, cachedState);
    return persistState(next, meta.changedKey || null);
  }

  function setSetting(key, value) {
    if (!(key in DEFAULT_STATE) || key === "updatedAt") return cachedState;
    return setState({ [key]: value }, { changedKey: key });
  }

  function getLiveUsageSnapshot() {
    const Usage = global.TasuAiWorkspaceUsage;
    const gauge = Usage?.getGaugeSnapshot?.();
    if (gauge && gauge.periodLimit != null && gauge.periodUsed != null) {
      return {
        aiChat: {
          used: gauge.periodUsed,
          limit: Math.max(1, gauge.periodLimit || 1),
          unit: "回",
        },
        imageGen: { used: 0, limit: 0, unit: "枚" },
        videoGen: { used: 0, limit: 0, unit: "分" },
        webSearch: { used: 0, limit: 0, unit: "回" },
      };
    }
    const RT = catalogRuntime();
    const plan = Usage?.readGenAiPlan?.()?.plan || cachedState?.currentPlan || "free";
    if (RT?.buildGenAiUsageSnapshot) return RT.buildGenAiUsageSnapshot(plan === "free" ? "lite" : plan);
    return buildUsageFromCatalog(plan);
  }

  function getUsagePercent(item) {
    if (!item || !item.limit) return 0;
    return Math.min(100, Math.round((item.used / item.limit) * 100));
  }

  function formatUsageLine(item) {
    const pct = getUsagePercent(item);
    const used = Number(item.used || 0).toLocaleString("ja-JP");
    const limit = Number(item.limit || 0).toLocaleString("ja-JP");
    return `${pct}% (${used} / ${limit} ${item.unit || ""})`.trim();
  }

  function formatRenewalDate(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  function formatHistoryDate(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  function formatYen(amount) {
    return `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function getBillingCycleLabel(cycle) {
    return cycle === "monthly" ? "月額プラン" : "年間プラン";
  }

  function getDefaultPaymentMethod(state) {
    const snapshot = state || cachedState;
    const methods = snapshot.paymentMethods || [];
    return (
      methods.find((pm) => pm.id === snapshot.defaultPaymentMethodId) ||
      methods.find((pm) => pm.isDefault) ||
      methods[0] ||
      null
    );
  }

  function formatForApiRequest() {
    const snapshot = getSnapshot();
    return {
      subscription: {
        currentPlan: snapshot.currentPlan,
        currentPlanLabel: snapshot.currentPlanLabel,
        billingCycle: snapshot.billingCycle,
        renewalDate: snapshot.renewalDate,
      },
      usage: { ...snapshot.usage },
      paymentMethods: snapshot.paymentMethods.map((pm) => ({ ...pm })),
      defaultPaymentMethodId: snapshot.defaultPaymentMethodId,
      billingHistory: snapshot.billingHistory.map((row) => ({ ...row })),
      availablePlans: snapshot.availablePlans.map((plan) => ({ ...plan })),
      updatedAt: snapshot.updatedAt,
    };
  }

  function runManagePlan() {
    console.info("[TasuAiWorkspaceBillingSettings] manage plan (demo)");
    return { ok: true, action: "manage-plan" };
  }

  function runViewAllUsage() {
    console.info("[TasuAiWorkspaceBillingSettings] view all usage (demo)");
    return { ok: true, action: "view-all-usage" };
  }

  function runUpgradePlan(planId) {
    if (!planId) return { ok: false };
    console.info("[TasuAiWorkspaceBillingSettings] upgrade plan (demo)", planId);
    return { ok: true, action: "upgrade-plan", planId };
  }

  function runChangePaymentMethod() {
    console.info("[TasuAiWorkspaceBillingSettings] change payment method (demo)");
    return { ok: true, action: "change-payment-method" };
  }

  function runAddPaymentMethod() {
    console.info("[TasuAiWorkspaceBillingSettings] add payment method (demo)");
    return { ok: true, action: "add-payment-method" };
  }

  function runViewReceipt(invoiceId) {
    console.info("[TasuAiWorkspaceBillingSettings] view receipt (demo)", invoiceId);
    return { ok: true, action: "view-receipt", invoiceId };
  }

  function runViewAllHistory() {
    console.info("[TasuAiWorkspaceBillingSettings] view all history (demo)");
    return { ok: true, action: "view-all-history" };
  }

  function runCancelPlan() {
    console.info("[TasuAiWorkspaceBillingSettings] cancel plan requested (demo)");
    return { ok: true, action: "cancel-plan-pending" };
  }

  function runConfirmCancelPlan() {
    setSetting("billingCycle", "monthly");
    console.info("[TasuAiWorkspaceBillingSettings] cancel plan confirmed (demo — subscription marked pending)");
    return { ok: true, action: "cancel-plan" };
  }

  init();

  function init() {
    DEFAULT_STATE = Object.freeze(cloneState(createDefaultState()));
    cachedState = loadState();
  }

  global.TasuAiWorkspaceBillingSettings = {
    BILLING_ADAPTER_MODE,
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULT_STATE,
    getState,
    getSnapshot,
    setState,
    setSetting,
    getUsagePercent,
    getLiveUsageSnapshot,
    formatUsageLine,
    formatRenewalDate,
    formatHistoryDate,
    formatYen,
    getBillingCycleLabel,
    getDefaultPaymentMethod,
    formatForApiRequest,
    runManagePlan,
    runViewAllUsage,
    runUpgradePlan,
    runChangePaymentMethod,
    runAddPaymentMethod,
    runViewReceipt,
    runViewAllHistory,
    runCancelPlan,
    runConfirmCancelPlan,
  };
})(typeof window !== "undefined" ? window : globalThis);
