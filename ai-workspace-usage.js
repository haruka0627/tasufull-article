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

  /** @type {{ remaining: number | null, dailyLimit: number | null, used: number | null, syncedAt: number, gauge: object | null, fetchError: boolean, planSummary: object | null, serverPlanId: string | null }} */
  const serverCache = {
    remaining: null,
    dailyLimit: null,
    used: null,
    syncedAt: 0,
    gauge: null,
    fetchError: false,
    planSummary: null,
    serverPlanId: null,
  };

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

  function resolveCatalogLimitsForPlanCode(planCode) {
    const RT = global.TasuPricingRuntime;
    if (!RT?.resolveGenAiSkuForPlanCode || !RT?.getDailyLimit) return null;
    const skuId = RT.resolveGenAiSkuForPlanCode(planCode);
    if (!skuId) return null;
    const textLimit = RT.getDailyLimit(skuId, "text_turn");
    const voiceLimit = RT.getDailyLimit(skuId, "voice_turn");
    const imageLimit = RT.getDailyLimit(skuId, "image_turn");
    const out = {};
    if (Number.isFinite(textLimit)) out.dailyTextLimit = textLimit;
    if (Number.isFinite(voiceLimit)) out.dailyVoiceLimit = voiceLimit;
    if (Number.isFinite(imageLimit)) out.dailyImageLimit = imageLimit;
    return Object.keys(out).length ? out : null;
  }

  function resolveStripePlanLimits(planCode) {
    const cfg = global.TasuStripeGenAiConfig;
    const plans = cfg?.PLANS;
    if (!plans || typeof plans !== "object") return null;
    const entry = Object.values(plans).find((p) => p && p.plan === planCode);
    if (!entry) return null;
    const out = {};
    if (Number.isFinite(Number(entry.dailyTextLimit))) out.dailyTextLimit = Number(entry.dailyTextLimit);
    if (Number.isFinite(Number(entry.dailyVoiceLimit))) out.dailyVoiceLimit = Number(entry.dailyVoiceLimit);
    if (Number.isFinite(Number(entry.dailyImageLimit))) out.dailyImageLimit = Number(entry.dailyImageLimit);
    return Object.keys(out).length ? out : null;
  }

  function resolvePaidPlanLimits(planCode) {
    return resolveCatalogLimitsForPlanCode(planCode) || resolveStripePlanLimits(planCode);
  }

  function readGenAiPlan() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_GENAI_PLAN) || "null");
      if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_FREE_PLAN, ...getDefaultLimits() };
      }
      const planCode = String(raw.plan || DEFAULT_FREE_PLAN.plan);
      const defaults = getDefaultLimits();
      const paidLimits = planCode !== "free" ? resolvePaidPlanLimits(planCode) : null;
      const dailyTextLimit = Math.max(
        0,
        Number(
          raw.dailyTextLimit ??
            paidLimits?.dailyTextLimit ??
            defaults.dailyTextLimit
        ) || defaults.dailyTextLimit
      );
      return {
        plan: planCode,
        label: String(raw.label || (planCode === "free" ? "無料枠" : planCode || DEFAULT_FREE_PLAN.label)),
        dailyTextLimit,
        dailyVoiceLimit: paidLimits?.dailyVoiceLimit,
        dailyImageLimit: paidLimits?.dailyImageLimit,
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
    serverCache.used = used;
    serverCache.syncedAt = Date.now();
    serverCache.fetchError = false;
    if (status.usage && typeof status.usage === "object") {
      serverCache.gauge = status.usage;
    } else {
      serverCache.gauge = buildLocalGauge({
        used,
        limit,
        allowed: remaining > 0,
        authoritative: status.authMode === "jwt",
        source: "quota-derived",
      });
    }
    if (status.plan && typeof status.plan === "object") {
      serverCache.planSummary = status.plan;
      serverCache.serverPlanId = String(status.plan.planId || status.planCode || "").trim() || null;
    } else if (status.planCode) {
      serverCache.serverPlanId = String(status.planCode).trim();
      const Policy = global.TasuAiPlanPolicy;
      if (Policy?.buildPublicPlanSummary && Policy?.getPlanPolicy) {
        serverCache.planSummary = Policy.buildPublicPlanSummary(
          Policy.getPlanPolicy(status.planCode),
          { used, remaining }
        );
      }
    }
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

  function buildLocalGauge(overrides) {
    const Gauge = global.TasuAiUsageGauge;
    const plan = readGenAiPlan();
    const limit = overrides?.limit != null ? overrides.limit : getDailyLimit();
    const used =
      overrides?.used != null
        ? overrides.used
        : serverCache.used != null
          ? serverCache.used
          : getUsage().textTurnUsed;
    const remaining =
      overrides?.remaining != null
        ? overrides.remaining
        : Math.max(0, limit - used);
    if (!Gauge?.buildUsageGauge) {
      return null;
    }
    return Gauge.buildUsageGauge({
      used,
      limit,
      dateJst: getTokyoDateKey(),
      allowed: overrides?.allowed != null ? overrides.allowed : remaining > 0,
      planCode: plan.plan,
      planLabel: plan.label,
      feature: FEATURE_TEXT_TURN,
      source: overrides?.source || (getUserId() === "anonymous" ? "local_estimate" : "local"),
      authoritative: Boolean(overrides?.authoritative),
      forceUnavailable: Boolean(overrides?.forceUnavailable),
    });
  }

  function getServerPlanId() {
    if (serverCache.serverPlanId) return serverCache.serverPlanId;
    const Policy = global.TasuAiPlanPolicy;
    if (getUserId() === "anonymous") return "anonymous";
    return Policy?.normalizePlanId?.(readGenAiPlan().plan) || "free";
  }

  function getPlanSummary() {
    if (serverCache.planSummary) return serverCache.planSummary;
    const Policy = global.TasuAiPlanPolicy;
    if (!Policy?.buildPublicPlanSummary) return null;
    const planId = getServerPlanId();
    const policy =
      planId === "anonymous" ? Policy.getAnonymousPolicy() : Policy.getPlanPolicy(planId);
    return Policy.buildPublicPlanSummary(policy, {
      used: serverCache.used ?? getUsage().textTurnUsed,
      remaining: getDailyRemaining(),
    });
  }

  function getDailyLimit() {
    if (serverCache.dailyLimit != null) {
      return Math.max(0, Number(serverCache.dailyLimit) || DEFAULT_FREE_PLAN.dailyTextLimit);
    }
    const Policy = global.TasuAiPlanPolicy;
    if (Policy?.getPlanPolicy) {
      const policy = Policy.getPlanPolicy(getServerPlanId());
      if (Number.isFinite(policy.dailyTextLimit)) return Math.max(0, policy.dailyTextLimit);
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

  async function resolveAccessToken() {
    try {
      const client = global.TasuSupabaseClient?.getClient?.();
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession();
        const token = data?.session?.access_token;
        if (token) return String(token);
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  async function postQuotaAction(action, featureKey) {
    const url = getQuotaEdgeUrl();
    const baseHeaders = stripeHeaders();
    const userId = getUserId();
    if (!url || !baseHeaders || !userId || userId === "anonymous") return null;
    const accessToken = await resolveAccessToken();
    const headers = { ...baseHeaders };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
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
    const userId = getUserId();
    if (!userId || userId === "anonymous") {
      serverCache.gauge = buildLocalGauge({
        authoritative: false,
        source: "anonymous_local",
      });
      return false;
    }
    const out = await postQuotaAction("status", FEATURE_TEXT_TURN);
    if (!out?.data?.ok) {
      serverCache.fetchError = true;
      serverCache.gauge = buildLocalGauge({ forceUnavailable: true, source: "fetch_error" });
      return false;
    }
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

  function getGaugeSnapshot() {
    if (serverCache.fetchError) {
      return (
        buildLocalGauge({ forceUnavailable: true, source: "fetch_error" }) || {
          status: "unavailable",
          statusLabel: "利用状況を取得できません",
          canExecute: false,
        }
      );
    }
    if (serverCache.gauge) return serverCache.gauge;
    const userId = getUserId();
    if (userId === "anonymous") {
      return buildLocalGauge({
        authoritative: false,
        source: "anonymous_local",
      });
    }
    return buildLocalGauge({
      authoritative: false,
      source: "local_cache",
    });
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
          const token = await resolveAccessToken();
          if (token) {
            const headers = new Headers(init.headers || {});
            headers.set("Authorization", `Bearer ${token}`);
            init = { ...init, headers };
          }
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
    const gauge = getGaugeSnapshot();
    const Gauge = global.TasuAiUsageGauge;

    const statusEl = global.document?.querySelector?.("[data-ai-workspace-usage-status]");
    if (statusEl) {
      const compact =
        (Gauge?.formatCompactLine && Gauge.formatCompactLine(gauge)) ||
        `${planLabel} · 本日 残り ${remaining} / ${limit} 回`;
      const pct = gauge?.displayPercent;
      const tone = gauge?.status || "unavailable";
      statusEl.innerHTML =
        `<div class="ai-workspace-usage__compact" data-ai-usage-gauge-compact data-gauge-status="${escapeAttr(tone)}">` +
        `<span class="ai-workspace-usage__line">${escapeHtml(compact)}</span>` +
        (pct != null
          ? `<span class="ai-workspace-usage__meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="本日の利用状況 ${pct}%">` +
            `<span class="ai-workspace-usage__meter-fill" style="width:${pct}%"></span></span>`
          : "") +
        `</div>`;
      statusEl.classList.toggle(
        "ai-workspace-usage--depleted",
        remaining <= 0 || tone === "stopped" || tone === "near_limit"
      );
      statusEl.classList.toggle("ai-workspace-usage--warn", tone === "elevated" || tone === "low");
      statusEl.classList.toggle("ai-workspace-usage--error", tone === "unavailable");
    }

    updateUsageDetailPanel(gauge);

    const heavyHint = global.document?.querySelector?.("[data-ai-usage-heavy-hint]");
    if (heavyHint) {
      const note = getManualHeavyModelHint();
      if (note) {
        heavyHint.hidden = false;
        heavyHint.textContent = note;
      } else {
        heavyHint.hidden = true;
        heavyHint.textContent = "";
      }
    }

    if (remaining > 0 && gauge?.status !== "stopped") hideUsageLimitBanner();

    if (isTlvSource()) {
      global.TasuAiWorkspaceTlvSource?.refreshFreeQuotaUi?.();
    }

    try {
      global.dispatchEvent(
        new CustomEvent("tasu:ai-usage-gauge-updated", { detail: { gauge: getGaugeSnapshot() } })
      );
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function updateUsageDetailPanel(gauge) {
    const detail = global.document?.querySelector?.("[data-ai-usage-gauge-detail]");
    if (!detail) return;
    const g = gauge || getGaugeSnapshot();
    const Gauge = global.TasuAiUsageGauge;
    const resetLabel = Gauge?.formatResetLabel?.(g.resetAt) || "—";
    const pct = g.displayPercent;
    const remPct = pct == null ? "—" : `${Math.max(0, 100 - pct)}%`;
    const authNote =
      getUserId() === "anonymous"
        ? "未ログインのため端末上の目安です。ログイン後にサーバー利用枠を表示します。"
        : g.authoritative
          ? "サーバー上の本日の利用枠に基づきます。"
          : "直近の同期結果または端末キャッシュに基づく目安です。";
    const plan = getPlanSummary();
    const planLine = plan
      ? `利用区分: ${plan.displayName}（${plan.planId}） · モデル: ${(plan.allowedModels || []).join(", ") || "—"}`
      : "";

    detail.innerHTML =
      `<p class="ai-usage-gauge-detail__status"><strong>${escapeHtml(g.statusLabel || "—")}</strong> — ${escapeHtml(g.statusHint || "")}</p>` +
      (planLine ? `<p class="ai-usage-gauge-detail__plan">${escapeHtml(planLine)}</p>` : "") +
      `<ul class="ai-usage-gauge-detail__list">` +
      `<li>利用期間: 本日（Asia/Tokyo）</li>` +
      `<li>現在の利用状況: ${pct == null ? "—" : `${pct}%`}</li>` +
      `<li>残り目安: ${escapeHtml(remPct)}</li>` +
      `<li>次回更新: ${escapeHtml(resetLabel)}</li>` +
      `<li>上限時: 新規送信を停止（更新待ち）</li>` +
      `<li>実行: ${g.canExecute && plan?.canExecute !== false ? "可能" : "停止または上限"}</li>` +
      `</ul>` +
      `<p class="ai-usage-gauge-detail__note">${escapeHtml(g.heavyModelNote || Gauge?.HEAVY_MODEL_NOTE || "")}</p>` +
      `<p class="ai-usage-gauge-detail__auth">${escapeHtml(authNote)}</p>` +
      `<button type="button" class="ai-usage-gauge-detail__retry" data-ai-usage-gauge-retry>利用状況を再取得</button>`;
  }

  function bindUsageDetailRetry() {
    const doc = global.document;
    if (!doc || doc.__tasuUsageGaugeRetryBound) return;
    doc.__tasuUsageGaugeRetryBound = true;
    doc.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!t || !t.closest?.("[data-ai-usage-gauge-retry]")) return;
      const detail = doc.querySelector("[data-ai-usage-gauge-detail]");
      if (detail) detail.setAttribute("data-loading", "1");
      void syncUsageFromServer().then(() => {
        if (detail) detail.removeAttribute("data-loading");
        updateUsageUi();
      });
    });
  }

  function getManualHeavyModelHint() {
    const Router = global.TasuAiWorkspaceModelRouterSettings;
    const Plans = global.TasuAiPlanModels;
    if (Router?.isAutoMode?.()) return "";
    const id = Plans?.getSelectedModelId?.() || "";
    if (id === "claude" || id === "gpt") {
      return global.TasuAiUsageGauge?.HEAVY_MODEL_NOTE || "";
    }
    return "";
  }

  function mountUsageBanner() {
    const host = global.document?.getElementById?.("bottom-container");
    if (!host || host.querySelector("[data-ai-workspace-usage-status]")) return;
    updateUsageUi();
  }

  async function init() {
    installEdgePayloadHook();
    bindUsageDetailRetry();
    mountUsageBanner();
    updateUsageUi();
    await syncPlanFromServer();
    await syncUsageFromServer();
    updateUsageUi();
    global.addEventListener("focus", () => {
      void syncUsageFromServer().then(() => updateUsageUi());
    });
    global.addEventListener("tasu:ai-model-router-settings-changed", () => updateUsageUi());
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
    getGaugeSnapshot,
    getServerPlanId,
    getPlanSummary,
    getManualHeavyModelHint,
    isPhase2ServerEnabled,
    applyServerStatusToCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
