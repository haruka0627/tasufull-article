/**
 * Business Directory — plan limits UI (AD-013 · Phase 1 seed mirror)
 */
(function (global) {
  "use strict";

  const PLANS = {
    free: {
      code: "free",
      label: "Free",
      maxPhotos: 1,
      allowBusinessHours: false,
      allowSns: false,
      allowTlv: false,
      allowAiRecommend: false,
      searchBoost: false,
    },
    standard: {
      code: "standard",
      label: "Standard",
      maxPhotos: 10,
      allowBusinessHours: true,
      allowSns: false,
      allowTlv: false,
      allowAiRecommend: false,
      searchBoost: false,
    },
    pro: {
      code: "pro",
      label: "Pro",
      maxPhotos: 20,
      allowBusinessHours: true,
      allowSns: false,
      allowTlv: false,
      allowAiRecommend: false,
      searchBoost: false,
    },
  };

  const PLAN_NOTES = {
    free: ["写真は1枚まで", "営業時間はテキストのみ（詳細設定は Standard 以降）"],
    standard: ["写真最大10枚", "SNS連携 — 近日公開", "営業時間の詳細設定"],
    pro: ["写真最大20枚", "TLV動画 — 近日公開", "上位表示 — 近日公開", "AI紹介 — 近日公開"],
  };

  function getPlan(code) {
    return PLANS[String(code || "free").toLowerCase()] || PLANS.free;
  }

  function renderPlanLimits(planCode) {
    const plan = getPlan(planCode);
    const notes = PLAN_NOTES[plan.code] || PLAN_NOTES.free;
    return { plan, notes };
  }

  function isPhotoSlotLocked(planCode, currentCount, slotIndex) {
    const plan = getPlan(planCode);
    if (slotIndex >= plan.maxPhotos) return true;
    if (plan.code === "free" && currentCount >= 1 && slotIndex > 0) return true;
    return false;
  }

  function isPeriodEndActive(iso) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  function hasPaidAccess(listing) {
    if (!listing) return false;
    const status = String(listing.subscription_status || "").trim();
    if (status === "unpaid" || status === "incomplete_expired") return false;
    const code = String(listing.plan_code || "free").toLowerCase();
    if (code !== "standard" && code !== "pro") return false;
    if (status === "active" || status === "trialing") {
      return !listing.current_period_end || isPeriodEndActive(listing.current_period_end);
    }
    if (isPeriodEndActive(listing.current_period_end)) {
      if (listing.cancel_at_period_end || status === "canceled") return true;
      if (status === "past_due" || status === "unpaid") return true;
    }
    return false;
  }

  function effectivePlanCode(listing) {
    if (!listing) return "free";
    if (hasPaidAccess(listing)) {
      const c = String(listing.plan_code || "free").toLowerCase();
      if (c === "standard" || c === "pro") return c;
    }
    return "free";
  }

  function subscriptionWarning(listing) {
    if (!listing) return null;
    const status = String(listing.subscription_status || "").trim();
    if (status === "past_due" || status === "unpaid") {
      return "お支払いに問題があります。Billing Portal から支払い方法を更新してください。";
    }
    if (listing.cancel_at_period_end && isPeriodEndActive(listing.current_period_end)) {
      try {
        const label = new Date(listing.current_period_end).toLocaleDateString("ja-JP");
        return `解約予約中です。${label} まで現行プランが利用できます。`;
      } catch {
        return "解約予約中です。期間終了まで現行プランが利用できます。";
      }
    }
    return null;
  }

  global.TasuBusinessDirectoryPlan = {
    PLANS,
    PLAN_NOTES,
    getPlan,
    renderPlanLimits,
    isPhotoSlotLocked,
    hasPaidAccess,
    effectivePlanCode,
    subscriptionWarning,
    isPeriodEndActive,
  };
})(typeof window !== "undefined" ? window : globalThis);
