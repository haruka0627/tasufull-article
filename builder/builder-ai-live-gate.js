/**
 * Builder AI Live — Free / Pro gate stub（本番課金未接続）
 */
(function (global) {
  "use strict";

  const SURFACE = "builder_ai";
  const DEBUG_TIER_KEY = "tasu_builder_ai_tier_debug";

  const UPGRADE_MSG =
    "この機能は Builder AI Pro でご利用いただけます（現在はプレビュー · 課金連動は未接続）。";

  function resolveBuilderTier(actor) {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const q = String(params.get("tier") || "").trim().toLowerCase();
      if (q === "pro" || q === "standard") return "pro";
      const stored = global.sessionStorage?.getItem(DEBUG_TIER_KEY);
      if (stored === "pro") return "pro";
    } catch {
      /* ignore */
    }
    void actor;
    return "free";
  }

  /**
   * @param {"camera_preview"|"camera_snapshot"|"camera_continuous"|"voice_input"|"voice_output"|"vision_remote"|"gemini_live_ws"} feature
   * @param {object} [actor]
   */
  function canUse(feature, actor) {
    const tier = resolveBuilderTier(actor);
    const rules = {
      camera_preview: true,
      camera_snapshot: true,
      camera_continuous: tier === "pro",
      voice_input: true,
      voice_output: true,
      vision_remote: tier === "pro" ? "full" : "limited",
      gemini_live_ws: tier === "pro",
    };
    const v = rules[feature];
    if (v === "limited") return true;
    return Boolean(v);
  }

  function getUpgradeMessage(feature) {
    void feature;
    return UPGRADE_MSG;
  }

  function setDebugTier(tier) {
    try {
      if (tier === "pro") global.sessionStorage?.setItem(DEBUG_TIER_KEY, "pro");
      else global.sessionStorage?.removeItem(DEBUG_TIER_KEY);
    } catch {
      /* ignore */
    }
  }

  global.TasuBuilderAILiveGate = {
    SURFACE,
    resolveBuilderTier,
    canUse,
    getUpgradeMessage,
    setDebugTier,
  };
})(typeof window !== "undefined" ? window : globalThis);
