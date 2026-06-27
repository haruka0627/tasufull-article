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

  global.TasuBusinessDirectoryPlan = {
    PLANS,
    PLAN_NOTES,
    getPlan,
    renderPlanLimits,
    isPhotoSlotLocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
