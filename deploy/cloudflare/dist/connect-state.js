/**
 * Connect 状態 — DB / 認証ユーザー基準（NB-3 STEP 4）
 * 本番 host: localStorage / URL による ready 判定禁止。
 */
(function (global) {
  "use strict";

  const CONNECT_STORAGE_KEY = "tasful_connect_onboarding_v1";
  const SELLER_STATUS_KEY = "tasful_demo_connect_seller_status_v1";

  const CONNECT_STEPS = Object.freeze([
    "top",
    "apply",
    "identity",
    "qualification",
    "reviewing",
    "approved",
    "ready",
  ]);

  let cachedState = null;
  let refreshPromise = null;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function auth() {
    return global.TasuAuthCurrentUser || {};
  }

  function canUseLsFallback() {
    return auth().canUseLocalStorageFallback?.() === true;
  }

  function isProductionHost() {
    return auth().isProductionHost?.() === true;
  }

  function resolveTalkUserId() {
    return pickStr(
      auth().getCurrentUser?.()?.talkUserId,
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      global.TasuChatUserIdentity?.getCurrentUserId?.()
    );
  }

  function readForcedConnectStepFromUrl() {
    if (!canUseLsFallback()) return "";
    try {
      return pickStr(new URLSearchParams(global.location?.search || "").get("connectStep"));
    } catch {
      return "";
    }
  }

  function readDemoOnboardingLs() {
    if (!canUseLsFallback()) return {};
    try {
      const raw = global.localStorage.getItem(CONNECT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readDemoSellerStatus(userId) {
    if (!canUseLsFallback()) return "";
    try {
      const raw = global.localStorage.getItem(SELLER_STATUS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const row = map?.[userId];
      return pickStr(row?.status, row);
    } catch {
      return "";
    }
  }

  function sellerStatusToStep(status) {
    if (status === "identity") return "identity";
    if (status === "payout") return "qualification";
    if (status === "ready") return "ready";
    return "";
  }

  function sellerStatusLegacy(status) {
    if (status === "identity") return "identity";
    if (status === "payout") return "payout";
    return "ready";
  }

  function stepToSellerStatus(step) {
    const s = pickStr(step);
    if (s === "ready" || s === "approved") return "ready";
    if (s === "qualification" || s === "reviewing") return "payout";
    if (s === "identity" || s === "apply" || s === "top") return "identity";
    return "identity";
  }

  function isValidStep(step) {
    return CONNECT_STEPS.includes(pickStr(step));
  }

  function mergeForcedStep(baseStep, forcedStep, savedStep) {
    const forced = pickStr(forcedStep);
    const saved = pickStr(savedStep);
    const base = pickStr(baseStep, "top");
    if (!forced || !isValidStep(forced)) return base;
    if (!saved || !isValidStep(saved)) return forced;
    const savedIdx = CONNECT_STEPS.indexOf(saved);
    const forcedIdx = CONNECT_STEPS.indexOf(forced);
    return savedIdx >= forcedIdx ? saved : forced;
  }

  function snapshotFromDbRow(row) {
    if (!row || typeof row !== "object") return null;
    const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
    const stripeAccountId = pickStr(row.stripe_account_id, fd.stripe_account_id);
    const payoutStatus = pickStr(row.payout_account_status, fd.payout_account_status, "not_connected");
    const payoutEnabled = row.payout_enabled === true || fd.payout_enabled === true;
    const active = /^(active|verified|enabled)$/i.test(payoutStatus);

    if (stripeAccountId && (payoutEnabled || active) && active) {
      return {
        step: "ready",
        ready: true,
        stripeAccountId,
        source: "db_listing",
      };
    }
    if (stripeAccountId) {
      return {
        step: "reviewing",
        ready: false,
        stripeAccountId,
        source: "db_listing",
      };
    }
    return {
      step: "top",
      ready: false,
      stripeAccountId: null,
      source: "db_listing",
    };
  }

  function buildState(partial) {
    const step = isValidStep(partial?.step) ? pickStr(partial.step) : "top";
    const ready = partial?.ready === true || step === "ready";
    return {
      step,
      ready,
      onboardingRequired: !ready,
      talkUserId: pickStr(partial?.talkUserId),
      stripeAccountId: partial?.stripeAccountId || null,
      source: pickStr(partial?.source, "none"),
      updatedAt: partial?.updatedAt || new Date().toISOString(),
    };
  }

  function resolveDemoState(talkUserId) {
    const forced = readForcedConnectStepFromUrl();
    const saved = pickStr(readDemoOnboardingLs().step);
    let step = mergeForcedStep("top", forced, saved);

    if (step === "top") {
      const sellerStatus = sellerStatusToStep(readDemoSellerStatus(talkUserId));
      if (sellerStatus) step = sellerStatus;
    }

    if (!isValidStep(step)) step = "top";
    const ready = step === "ready";
    let source = saved ? "demo_localStorage" : "demo_seller_status";
    if (forced) source = "demo_url";
    if (saved && step === saved) source = "demo_localStorage";

    return buildState({
      step,
      ready,
      talkUserId,
      source,
    });
  }

  function resolveProductionState(talkUserId, dbSnapshot) {
    if (!talkUserId) {
      return buildState({
        step: "top",
        ready: false,
        talkUserId: "",
        source: "unauthenticated",
      });
    }
    if (dbSnapshot) {
      return buildState({
        step: dbSnapshot.step,
        ready: dbSnapshot.ready,
        talkUserId,
        stripeAccountId: dbSnapshot.stripeAccountId,
        source: dbSnapshot.source,
      });
    }
    return buildState({
      step: "top",
      ready: false,
      talkUserId,
      source: "none",
    });
  }

  function computeConnectState(dbSnapshot) {
    const talkUserId = resolveTalkUserId();
    if (isProductionHost()) {
      return resolveProductionState(talkUserId, dbSnapshot);
    }
    return resolveDemoState(talkUserId);
  }

  function getConnectState() {
    if (!cachedState) {
      cachedState = computeConnectState(null);
    }
    return { ...cachedState };
  }

  function getConnectStateSource() {
    return getConnectState().source;
  }

  function getConnectStep() {
    return getConnectState().step;
  }

  function isConnectReady(step) {
    const s = step != null ? pickStr(step) : getConnectStep();
    return s === "ready";
  }

  function isConnectOnboardingRequired() {
    return getConnectState().onboardingRequired === true;
  }

  function invalidateConnectStateCache() {
    cachedState = null;
    refreshPromise = null;
  }

  async function fetchDbConnectSnapshot(talkUserId) {
    const uid = pickStr(talkUserId);
    if (!uid) return null;
    const sb = global.TasuSupabase?.getClient?.();
    if (!sb?.from) return null;

    const tables = ["listings", "business_listings"];
    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      try {
        const { data, error } = await sb
          .from(table)
          .select("stripe_account_id, payout_account_status, payout_enabled, form_data")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (error) continue;
        const row = Array.isArray(data) ? data[0] : data;
        const snap = snapshotFromDbRow(row);
        if (snap) return snap;
      } catch {
        /* try next table */
      }
    }
    return null;
  }

  async function refreshConnectStateFromDb(options) {
    const opts = options && typeof options === "object" ? options : {};
    const talkUserId = resolveTalkUserId();
    if (!talkUserId && isProductionHost()) {
      cachedState = resolveProductionState("", null);
      return getConnectState();
    }

    if (!global.TasuSupabase?.isConfigured?.()) {
      cachedState = computeConnectState(null);
      return getConnectState();
    }

    if (refreshPromise && !opts.force) {
      await refreshPromise;
      return getConnectState();
    }

    refreshPromise = (async () => {
      const dbSnapshot = await fetchDbConnectSnapshot(talkUserId);
      cachedState = computeConnectState(dbSnapshot);
      return cachedState;
    })();

    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
    return getConnectState();
  }

  function requireConnectReady(options) {
    const opts = options && typeof options === "object" ? options : {};
    const state = getConnectState();
    if (state.ready) return state;
    const err = new Error("TasuConnectState: Connect onboarding required");
    err.code = "CONNECT_ONBOARDING_REQUIRED";
    err.state = state;
    if (opts.redirect === true) {
      const href = pickStr(opts.redirectUrl, "payment-settings.html");
      global.location.assign(href);
    }
    throw err;
  }

  function getSellerStatusForUser(userId) {
    const sid = pickStr(userId);
    if (!sid) return null;
    if (isProductionHost()) {
      const current = resolveTalkUserId();
      if (sid !== current) return null;
      return stepToSellerStatus(getConnectStep());
    }
    if (!canUseLsFallback()) return null;
    const legacy = readDemoSellerStatus(sid);
    if (legacy) return sellerStatusLegacy(legacy);
    return null;
  }

  function saveDemoOnboarding(patch) {
    if (!canUseLsFallback()) return null;
    const prev = readDemoOnboardingLs();
    const next = {
      ...prev,
      ...(patch && typeof patch === "object" ? patch : {}),
      updatedAt: new Date().toISOString(),
    };
    global.localStorage.setItem(CONNECT_STORAGE_KEY, JSON.stringify(next));
    invalidateConnectStateCache();
    return next;
  }

  function autoRefreshOnLoad() {
    const page = String(document.body?.dataset?.page || "");
    if (page !== "payment-settings" && page !== "dashboard") return;
    void refreshConnectStateFromDb().then(() => {
      global.TasuConnectMemberUi?.renderDashboardBanner?.();
      global.TasuPaymentSettings?.renderConnectOnboarding?.();
    });
  }

  global.TasuConnectState = {
    CONNECT_STORAGE_KEY,
    SELLER_STATUS_KEY,
    CONNECT_STEPS,
    getConnectState,
    getConnectStateSource,
    getConnectStep,
    isConnectReady,
    isConnectOnboardingRequired,
    requireConnectReady,
    refreshConnectStateFromDb,
    invalidateConnectStateCache,
    getSellerStatusForUser,
    saveDemoOnboarding,
    readDemoOnboardingLs,
    canUseLsFallback,
    resolveTalkUserId,
    snapshotFromDbRow,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoRefreshOnLoad);
  } else {
    autoRefreshOnLoad();
  }
})(typeof window !== "undefined" ? window : globalThis);
