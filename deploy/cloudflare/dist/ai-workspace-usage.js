/**
 * TASFUL AI Workspace — 日次 quota（Phase 1 · クライアント enforcement）
 * プラン: tasu_genai_plan · usage: tasu_ai_workspace_usage
 */
(function (global) {
  "use strict";

  const STORAGE_USAGE = "tasu_ai_workspace_usage";
  const STORAGE_GENAI_PLAN = "tasu_genai_plan";
  const FEATURE_TEXT_TURN = "text_turn";

  const DEFAULT_FREE_PLAN = {
    plan: "free",
    label: "無料枠",
    dailyTextLimit: 5,
  };

  function getTokyoDateKey() {
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function readSource() {
    try {
      return String(new URLSearchParams(global.location?.search || "").get("source") || "")
        .trim()
        .toLowerCase();
    } catch {
      return "";
    }
  }

  function isTlvSource() {
    return readSource() === "tlv";
  }

  function getUserId() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.userId || cfg.user_id || "anonymous").trim() || "anonymous";
  }

  function getDefaultLimits() {
    const cfg = global.TasuStripeGenAiConfig;
    const free = cfg?.FREE_PLAN || DEFAULT_FREE_PLAN;
    return {
      dailyTextLimit: Math.max(0, Number(free.dailyTextLimit) || DEFAULT_FREE_PLAN.dailyTextLimit),
    };
  }

  function readGenAiPlan() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_GENAI_PLAN) || "null");
      if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_FREE_PLAN, ...getDefaultLimits() };
      }
      const defaults = getDefaultLimits();
      return {
        plan: String(raw.plan || DEFAULT_FREE_PLAN.plan),
        label: String(raw.label || (raw.plan === "free" ? "無料枠" : raw.plan || DEFAULT_FREE_PLAN.label)),
        dailyTextLimit: Math.max(
          0,
          Number(raw.dailyTextLimit ?? defaults.dailyTextLimit) || defaults.dailyTextLimit
        ),
        status: String(raw.status || "active"),
        subscriptionStatus: raw.subscriptionStatus || null,
      };
    } catch {
      return { ...DEFAULT_FREE_PLAN, ...getDefaultLimits() };
    }
  }

  function saveGenAiPlan(planPayload) {
    if (!planPayload || typeof planPayload !== "object") return false;
    try {
      const current = readGenAiPlan();
      const next = {
        ...current,
        ...planPayload,
        updatedAt: planPayload.updatedAt || new Date().toISOString(),
      };
      global.localStorage.setItem(STORAGE_GENAI_PLAN, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function defaultUsage(dateKey) {
    return { date: dateKey, textTurnUsed: 0 };
  }

  function resetDailyIfNeeded() {
    const today = getTokyoDateKey();
    let usage;
    try {
      usage = JSON.parse(global.localStorage.getItem(STORAGE_USAGE) || "null");
    } catch {
      usage = null;
    }
    if (!usage || typeof usage !== "object" || usage.date !== today) {
      usage = defaultUsage(today);
      saveUsage(usage);
    }
    return usage;
  }

  function saveUsage(usage) {
    try {
      global.localStorage.setItem(STORAGE_USAGE, JSON.stringify(usage));
      return true;
    } catch {
      return false;
    }
  }

  function getUsage() {
    const usage = resetDailyIfNeeded();
    return {
      date: usage.date,
      textTurnUsed: Math.max(0, Number(usage.textTurnUsed) || 0),
    };
  }

  function getDailyLimit() {
    const plan = readGenAiPlan();
    return Math.max(0, Number(plan.dailyTextLimit) || DEFAULT_FREE_PLAN.dailyTextLimit);
  }

  function getDailyRemaining() {
    const limit = getDailyLimit();
    const used = getUsage().textTurnUsed;
    return Math.max(0, limit - used);
  }

  function getTlvRemaining() {
    if (!isTlvSource()) return null;
    const fn = global.TasuAiWorkspaceTlvSource?.readFreeRemaining;
    if (typeof fn !== "function") return null;
    return Math.max(0, Number(fn()) || 0);
  }

  function getRemaining(featureKey) {
    if (featureKey && featureKey !== FEATURE_TEXT_TURN) return 0;
    let remaining = getDailyRemaining();
    const tlvRem = getTlvRemaining();
    if (tlvRem !== null) remaining = Math.min(remaining, tlvRem);
    return remaining;
  }

  function canUse(featureKey) {
    const key = featureKey || FEATURE_TEXT_TURN;
    if (key !== FEATURE_TEXT_TURN) return false;
    return getRemaining(key) > 0;
  }

  function shouldChargeTurn(turn) {
    if (!turn || typeof turn !== "object") return false;
    if (!turn.usedRemote) return false;
    const reply = String(turn.reply || "").trim();
    if (!reply) return false;
    const apiError = String(turn.apiError || "").trim();
    if (apiError) return false;
    const http = Number(turn.apiHttpStatus) || 0;
    if (http === 402 || http === 429) return false;
    if (turn.fallback_used && !turn.usedRemote) return false;
    return true;
  }

  function consume(featureKey) {
    const key = featureKey || FEATURE_TEXT_TURN;
    if (key !== FEATURE_TEXT_TURN) return getUsage();
    const usage = getUsage();
    usage.textTurnUsed += 1;
    saveUsage(usage);
    if (isTlvSource() && global.TasuAiWorkspaceTlvSource?.decrementFreeRemaining) {
      global.TasuAiWorkspaceTlvSource.decrementFreeRemaining();
    }
    updateUsageUi();
    return usage;
  }

  function stripeHeaders() {
    const cfg = global.TasuStripeGenAiConfig;
    const anonKey =
      cfg?.getPublishableAnonKey?.() ||
      cfg?.anonKey ||
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey?.(
        global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {}
      ) ||
      "";
    if (!anonKey || global.TasuSupabasePublicKey?.isForbiddenKey?.(anonKey)) {
      return null;
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    };
  }

  async function syncPlanFromServer() {
    const cfg = global.TasuStripeGenAiConfig;
    const userId = getUserId();
    if (!cfg?.getPlanUrl || !userId || userId === "anonymous") return false;
    const headers = stripeHeaders();
    if (!headers) return false;
    try {
      const res = await fetch(cfg.getPlanUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) {
        saveGenAiPlan(data.plan);
        updateUsageUi();
        return true;
      }
    } catch (err) {
      console.warn("[TasuAiWorkspaceUsage] plan sync failed:", err);
    }
    return false;
  }

  function resolveFeatureKey() {
    return FEATURE_TEXT_TURN;
  }

  function getContext() {
    const plan = readGenAiPlan();
    return {
      source: readSource() || "default",
      userId: getUserId(),
      planCode: plan.plan,
      planLabel: plan.label,
      featureKey: FEATURE_TEXT_TURN,
      dailyLimit: getDailyLimit(),
      dailyRemaining: getDailyRemaining(),
      tlvRemaining: getTlvRemaining(),
    };
  }

  function getLimits() {
    return { text_turn: getDailyLimit() };
  }

  function showUsageBlocked(featureKey) {
    const key = featureKey || FEATURE_TEXT_TURN;
    if (isTlvSource()) {
      const tlvRem = getTlvRemaining();
      if (tlvRem !== null && tlvRem <= 0) {
        global.TasuAiWorkspaceTlvSource?.refreshFreeQuotaUi?.();
        return;
      }
    }

    const plan = readGenAiPlan();
    const label = plan.label || "無料枠";
    const msg =
      plan.plan === "free"
        ? `本日の無料回数を使い切りました（${label}）`
        : `本日の利用回数上限に達しました（${label}）`;

    const limitEl = global.document?.querySelector?.("[data-ai-workspace-usage-limit]");
    const limitMsg = global.document?.querySelector?.("[data-ai-workspace-usage-limit-msg]");
    if (limitEl) limitEl.hidden = false;
    if (limitMsg) limitMsg.textContent = msg;
    updateUsageUi();
  }

  function hideUsageLimitBanner() {
    const limitEl = global.document?.querySelector?.("[data-ai-workspace-usage-limit]");
    if (limitEl) limitEl.hidden = true;
  }

  function updateUsageUi() {
    resetDailyIfNeeded();
    const plan = readGenAiPlan();
    const remaining = getRemaining(FEATURE_TEXT_TURN);
    const limit = getDailyLimit();
    const planLabel = plan.label || (plan.plan === "free" ? "無料枠" : plan.plan);

    const statusEl = global.document?.querySelector?.("[data-ai-workspace-usage-status]");
    if (statusEl) {
      statusEl.textContent = `${planLabel} · 本日 残り ${remaining} / ${limit} 回`;
      statusEl.classList.toggle("ai-workspace-usage--depleted", remaining <= 0);
    }

    if (remaining > 0) hideUsageLimitBanner();
    else if (!isTlvSource() || (getTlvRemaining() ?? 1) > 0) {
      /* depleted daily but tlv may still show its own banner */
    }

    if (isTlvSource()) {
      global.TasuAiWorkspaceTlvSource?.refreshFreeQuotaUi?.();
    }
  }

  function mountUsageBanner() {
    const host = global.document?.getElementById?.("bottom-container");
    if (!host || host.querySelector("[data-ai-workspace-usage-status]")) return;
    updateUsageUi();
  }

  function init() {
    mountUsageBanner();
    updateUsageUi();
    void syncPlanFromServer();
    global.addEventListener("focus", () => {
      updateUsageUi();
    });
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspaceUsage = {
    FEATURE_TEXT_TURN,
    STORAGE_USAGE,
    getContext,
    getLimits,
    getRemaining,
    canUse,
    shouldChargeTurn,
    consume,
    syncPlanFromServer,
    resolveFeatureKey,
    mountUsageBanner,
    updateUsageUi,
    showUsageBlocked,
    readGenAiPlan,
    getDailyLimit,
    getDailyRemaining,
    resetDailyIfNeeded,
    getUsage,
  };
})(typeof window !== "undefined" ? window : globalThis);
