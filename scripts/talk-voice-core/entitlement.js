/**
 * TASFUL talk-voice-core — entitlement / free-allowance model (fail-closed when enforced)
 *
 * Config via window.TASU_TALK_VOICE_CONFIG (or TASU_CHAT_SUPABASE_CONFIG.talkVoice).
 *
 * Defaults preserve existing 1:1 WebRTC calls:
 *   voice_feature_enabled = true
 *   voice_entitlement_enforced = false  → legacy_unmetered (no free-tier open while “unknown”)
 *
 * When voice_entitlement_enforced = true, missing numeric limits → configuration_unavailable (deny).
 */
(function (global) {
  "use strict";

  const DEFAULTS = Object.freeze({
    voice_feature_enabled: true,
    voice_entitlement_enforced: false,
    benefit_purchase_threshold: null,
    daily_free_seconds: null,
    monthly_free_seconds: null,
    max_call_seconds: null,
    benefit_valid_from: null,
    benefit_valid_until: null,
    heartbeat_interval_sec: 45,
    heartbeat_grace_sec: 120,
  });

  function readRawConfig() {
    const root =
      global.TASU_TALK_VOICE_CONFIG ||
      global.TASU_CHAT_SUPABASE_CONFIG?.talkVoice ||
      {};
    return root && typeof root === "object" ? root : {};
  }

  function getConfig() {
    const raw = readRawConfig();
    return {
      ...DEFAULTS,
      ...raw,
      voice_feature_enabled:
        raw.voice_feature_enabled != null
          ? Boolean(raw.voice_feature_enabled)
          : DEFAULTS.voice_feature_enabled,
      voice_entitlement_enforced:
        raw.voice_entitlement_enforced != null
          ? Boolean(raw.voice_entitlement_enforced)
          : DEFAULTS.voice_entitlement_enforced,
    };
  }

  function toNonNegInt(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  function minPositive(values) {
    const nums = values.filter((n) => n != null && Number.isFinite(n) && n >= 0);
    if (!nums.length) return null;
    return Math.min(...nums);
  }

  /**
   * @param {{
   *   usedDailySeconds?: number,
   *   usedMonthlySeconds?: number,
   *   eligibleBenefit?: boolean,
   *   now?: Date,
   *   activeSessionExists?: boolean,
   * }} [ctx]
   */
  function evaluateEntitlement(ctx = {}) {
    const cfg = getConfig();
    if (!cfg.voice_feature_enabled) {
      return {
        allowed: false,
        reason: "feature_disabled",
        remaining_daily_seconds: 0,
        remaining_monthly_seconds: 0,
        max_session_seconds: 0,
        source: "config",
        config: cfg,
      };
    }

    if (ctx.activeSessionExists) {
      return {
        allowed: false,
        reason: "active_session_exists",
        remaining_daily_seconds: 0,
        remaining_monthly_seconds: 0,
        max_session_seconds: 0,
        source: "session",
        config: cfg,
      };
    }

    if (!cfg.voice_entitlement_enforced) {
      return {
        allowed: true,
        reason: "legacy_unmetered",
        remaining_daily_seconds: null,
        remaining_monthly_seconds: null,
        max_session_seconds: toNonNegInt(cfg.max_call_seconds),
        source: "legacy",
        config: cfg,
      };
    }

    const daily = toNonNegInt(cfg.daily_free_seconds);
    const monthly = toNonNegInt(cfg.monthly_free_seconds);
    const maxCall = toNonNegInt(cfg.max_call_seconds);
    if (daily == null && monthly == null && maxCall == null) {
      return {
        allowed: false,
        reason: "configuration_unavailable",
        remaining_daily_seconds: 0,
        remaining_monthly_seconds: 0,
        max_session_seconds: 0,
        source: "config",
        config: cfg,
      };
    }

    if (ctx.eligibleBenefit === false) {
      return {
        allowed: false,
        reason: "not_eligible",
        remaining_daily_seconds: 0,
        remaining_monthly_seconds: 0,
        max_session_seconds: 0,
        source: "benefit",
        config: cfg,
      };
    }

    const usedDaily = Math.max(0, Number(ctx.usedDailySeconds) || 0);
    const usedMonthly = Math.max(0, Number(ctx.usedMonthlySeconds) || 0);
    const remainingDaily = daily == null ? null : Math.max(0, daily - usedDaily);
    const remainingMonthly = monthly == null ? null : Math.max(0, monthly - usedMonthly);

    if (remainingDaily === 0) {
      return {
        allowed: false,
        reason: "daily_limit_reached",
        remaining_daily_seconds: 0,
        remaining_monthly_seconds: remainingMonthly,
        max_session_seconds: 0,
        source: "usage",
        config: cfg,
      };
    }
    if (remainingMonthly === 0) {
      return {
        allowed: false,
        reason: "monthly_limit_reached",
        remaining_daily_seconds: remainingDaily,
        remaining_monthly_seconds: 0,
        max_session_seconds: 0,
        source: "usage",
        config: cfg,
      };
    }

    const sessionLimit = minPositive([remainingDaily, remainingMonthly, maxCall]);
    return {
      allowed: true,
      reason: "eligible",
      remaining_daily_seconds: remainingDaily,
      remaining_monthly_seconds: remainingMonthly,
      max_session_seconds: sessionLimit,
      source: "entitlement",
      config: cfg,
    };
  }

  function computeSessionLimit(entitlement) {
    if (!entitlement?.allowed) return 0;
    if (entitlement.reason === "legacy_unmetered") {
      return entitlement.max_session_seconds == null
        ? null
        : entitlement.max_session_seconds;
    }
    return entitlement.max_session_seconds == null ? 0 : entitlement.max_session_seconds;
  }

  global.TasuTalkVoiceEntitlement = {
    DEFAULTS,
    getConfig,
    evaluateEntitlement,
    computeSessionLimit,
    minPositive,
  };
})(typeof window !== "undefined" ? window : globalThis);
