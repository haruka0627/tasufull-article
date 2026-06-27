/**
 * TASFUL AI Workspace — 日次 quota（Phase 2 · Edge + DB 正本）
 * プラン: tasu_genai_plan / gen_ai_subscriptions · usage: ai_workspace_usage_daily
 */
(function (global) {
  "use strict";

  const STORAGE_USAGE = "tasu_ai_workspace_usage";
  const STORAGE_GENAI_PLAN = "tasu_genai_plan";
  const FEATURE_TEXT_TURN = "text_turn";
  const WORKSPACE_SURFACE = "ai-workspace";
  const CHAT_EDGE_PATTERN = /\/functions\/v1\/(gemini-chat|openai-chat|claude-chat)(?:\?|$)/;

  const DEFAULT_FREE_PLAN = {
    plan: "free",
    label: "無料枠",
    dailyTextLimit: 5,
  };

  /** @type {{ remaining: number | null, dailyLimit: number | null, syncedAt: number }} */
  const serverCache = { remaining: null, dailyLimit: null, syncedAt: 0 };

  function isPhase2ServerEnabled() {
    if (global.__TASU_WORKSPACE_USAGE_PHASE2__ === false) return false;
    if (global.__TASU_WORKSPACE_USAGE_TEST__) return false;
    return true;
  }

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

  function getSupabaseBase() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return String(cfg.url || "").replace(/\/$/, "");
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

  function applyServerStatusToCache(status) {
    if (!status || typeof status !== "object") return;
    const limit = Math.max(0, Number(status.dailyLimit) || getDailyLimit());
    const remaining = Math.max(0, Number(status.remaining) || 0);
    const used = Math.max(0, Number(status.used) ?? limit - remaining);
    serverCache.remaining = remaining;
    serverCache.dailyLimit = limit;
    serverCache.syncedAt = Date.now();
    const today = getTokyoDateKey();
    saveUsage({ date: today, textTurnUsed: used });
    if (status.planCode || status.planLabel) {
      saveGenAiPlan({
        plan: status.planCode,
        label: status.planLabel,
        dailyTextLimit: limit,
      });
    }
  }

  function getDailyLimit() {
    if (serverCache.dailyLimit != null) {
      return Math.max(0, Number(serverCache.dailyLimit) || DEFAULT_FREE_PLAN.dailyTextLimit);
    }
    const plan = readGenAiPlan();
    return Math.max(0, Number(plan.dailyTextLimit) || DEFAULT_FREE_PLAN.dailyTextLimit);
  }

  function getDailyRemaining() {
    if (serverCache.remaining != null) {
      return Math.max(0, Number(serverCache.remaining) || 0);
    }
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

  function consumeLocal(featureKey) {
    const key = featureKey || FEATURE_TEXT_TURN;
    if (key !== FEATURE_TEXT_TURN) return getUsage();
    const usage = getUsage();
    usage.textTurnUsed += 1;
    saveUsage(usage);
    if (serverCache.remaining != null) {
      serverCache.remaining = Math.max(0, serverCache.remaining - 1);
    }
    if (isTlvSource() && global.TasuAiWorkspaceTlvSource?.decrementFreeRemaining) {
      global.TasuAiWorkspaceTlvSource.decrementFreeRemaining();
    }
    updateUsageUi();
    return usage;
  }

  function consume(featureKey) {
    if (isPhase2ServerEnabled()) {
      void syncUsageFromServer().then(() => updateUsageUi());
      if (isTlvSource() && global.TasuAiWorkspaceTlvSource?.decrementFreeRemaining) {
        global.TasuAiWorkspaceTlvSource.decrementFreeRemaining();
      }
      return getUsage();
    }
    return consumeLocal(featureKey);
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

  function getQuotaEdgeUrl() {
    const base = getSupabaseBase();
    if (!base) return "";
    return `${base}/functions/v1/ai-workspace-quota`;
  }

  async function postQuotaAction(action, featureKey) {
    const url = getQuotaEdgeUrl();
    const headers = stripeHeaders();
    const userId = getUserId();
    if (!url || !headers || !userId || userId === "anonymous") return null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action,
          user_id: userId,
          feature: featureKey || FEATURE_TEXT_TURN,
          surface: WORKSPACE_SURFACE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { httpStatus: res.status, data };
    } catch (err) {
      console.warn("[TasuAiWorkspaceUsage] quota action failed:", err);
      return null;
    }
  }

  async function syncUsageFromServer() {
    if (!isPhase2ServerEnabled()) return false;
    const out = await postQuotaAction("status", FEATURE_TEXT_TURN);
    if (!out?.data?.ok) return false;
    applyServerStatusToCache(out.data);
    return true;
  }

  async function canUseAsync(featureKey) {
    const key = featureKey || FEATURE_TEXT_TURN;
    if (key !== FEATURE_TEXT_TURN) return false;

    if (isPhase2ServerEnabled()) {
      const check = await postQuotaAction("check", key);
      if (check?.data?.ok) {
        applyServerStatusToCache(check.data);
        let remaining = Math.max(0, Number(check.data.remaining) || 0);
        const tlvRem = getTlvRemaining();
        if (tlvRem !== null) remaining = Math.min(remaining, tlvRem);
        return check.data.allowed !== false && remaining > 0;
      }
    }

    return canUse(key);
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

  function installEdgePayloadHook() {
    if (!isPhase2ServerEnabled() || global.__tasuWorkspaceEdgeHookInstalled) return;
    global.__tasuWorkspaceEdgeHookInstalled = true;
    const origFetch = global.fetch.bind(global);
    global.fetch = async function tasuWorkspaceEdgeFetch(input, init) {
      const url = typeof input === "string" ? input : input?.url || "";
      if (init?.method === "POST" && CHAT_EDGE_PATTERN.test(url)) {
        try {
          const body = JSON.parse(String(init.body || "{}"));
          body.surface = WORKSPACE_SURFACE;
          body.user_id = getUserId();
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          /* keep original body */
        }
      }
      const res = await origFetch(input, init);
      if (isPhase2ServerEnabled() && CHAT_EDGE_PATTERN.test(url) && res.status === 402) {
        void syncUsageFromServer();
      }
      return res;
    };
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
      phase2: isPhase2ServerEnabled(),
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

    if (isTlvSource()) {
      global.TasuAiWorkspaceTlvSource?.refreshFreeQuotaUi?.();
    }
  }

  function mountUsageBanner() {
    const host = global.document?.getElementById?.("bottom-container");
    if (!host || host.querySelector("[data-ai-workspace-usage-status]")) return;
    updateUsageUi();
  }

  async function init() {
    installEdgePayloadHook();
    mountUsageBanner();
    updateUsageUi();
    await syncPlanFromServer();
    await syncUsageFromServer();
    global.addEventListener("focus", () => {
      void syncUsageFromServer().then(() => updateUsageUi());
    });
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", () => {
      void init();
    });
  } else {
    void init();
  }

  global.TasuAiWorkspaceUsage = {
    FEATURE_TEXT_TURN,
    STORAGE_USAGE,
    WORKSPACE_SURFACE,
    getContext,
    getLimits,
    getRemaining,
    canUse,
    canUseAsync,
    shouldChargeTurn,
    consume,
    consumeLocal,
    syncUsageFromServer,
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
    isPhase2ServerEnabled,
    applyServerStatusToCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
