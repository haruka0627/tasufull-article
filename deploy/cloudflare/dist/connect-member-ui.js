/**
 * Connect — 会員向け共通 UI（ダッシュボードバナー / 手続き状態）
 */
(function (global) {
  "use strict";

  const CONNECT_STORAGE_KEY = "tasful_connect_onboarding_v1";

  const CONNECT_STEPS = [
    { id: "top", label: "Connect トップ" },
    { id: "apply", label: "申請" },
    { id: "identity", label: "本人確認" },
    { id: "qualification", label: "資格・振込先確認" },
    { id: "reviewing", label: "審査中" },
    { id: "approved", label: "承認" },
    { id: "ready", label: "利用開始" },
  ];

  const CONNECT_BADGE = {
    top: "未対応",
    apply: "未対応",
    identity: "未対応",
    qualification: "提出済み",
    reviewing: "審査中",
    approved: "審査中",
    ready: "完了",
  };

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getConnectOnboarding() {
    try {
      const raw = global.localStorage.getItem(CONNECT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function resolveUserId() {
    return pickStr(
      new URLSearchParams(global.location?.search || "").get("userId"),
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      global.TasuChatUserIdentity?.getCurrentUserId?.(),
      "u_sachi"
    );
  }

  function resolveConnectStep() {
    const params = new URLSearchParams(global.location?.search || "");
    const forced = pickStr(params.get("connectStep"));
    const row = getConnectOnboarding();
    const saved = pickStr(row.step);
    if (saved && CONNECT_STEPS.some((s) => s.id === saved)) {
      if (!forced) return saved;
      const savedIdx = CONNECT_STEPS.findIndex((s) => s.id === saved);
      const forcedIdx = CONNECT_STEPS.findIndex((s) => s.id === forced);
      if (savedIdx >= 0 && forcedIdx >= 0 && savedIdx >= forcedIdx) return saved;
      if (forced && CONNECT_STEPS.some((s) => s.id === forced)) return forced;
      return saved;
    }
    if (forced && CONNECT_STEPS.some((s) => s.id === forced)) return forced;

    const sellerStatus = global.TasuPlatformChatConnectChatFlow?.getSellerConnectStatus?.(resolveUserId());
    if (sellerStatus === "identity") return "identity";
    if (sellerStatus === "payout") return "qualification";
    return "top";
  }

  function isConnectReady(step) {
    return pickStr(step || resolveConnectStep()) === "ready";
  }

  function needsIdentityBanner(step) {
    const s = pickStr(step || resolveConnectStep());
    return s === "top" || s === "apply" || s === "identity";
  }

  function buildSettingsUrl(step) {
    const u = new URL("payment-settings.html", global.location?.href || "http://localhost/");
    u.searchParams.set("talkDev", "1");
    const uid = resolveUserId();
    if (uid) u.searchParams.set("userId", uid);
    if (step) u.searchParams.set("connectStep", step);
    return `${u.pathname}${u.search}`;
  }

  function renderDashboardBanner() {
    const host = document.querySelector("[data-connect-member-banner]");
    if (!host) return;

    const step = resolveConnectStep();
    if (!needsIdentityBanner(step)) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    const href = buildSettingsUrl(step === "top" ? "" : "identity");
    host.hidden = false;
    host.innerHTML =
      `<div class="dash-connect-banner__inner">` +
      `<div class="dash-connect-banner__text">` +
      `<p class="dash-connect-banner__tag">【重要】</p>` +
      `<p class="dash-connect-banner__title">売上の受け取りと安全な取引のために<br>本人確認を完了してください</p>` +
      `</div>` +
      `<a class="dash-btn dash-btn--primary dash-connect-banner__cta" href="${href}">本人確認を始める</a>` +
      `</div>`;
  }

  function mountMemberBanner() {
    if (document.body?.dataset?.page !== "dashboard") return;
    renderDashboardBanner();
  }

  global.TasuConnectMemberUi = {
    CONNECT_STORAGE_KEY,
    CONNECT_STEPS,
    CONNECT_BADGE,
    getConnectOnboarding,
    resolveConnectStep,
    resolveUserId,
    isConnectReady,
    needsIdentityBanner,
    buildSettingsUrl,
    mountMemberBanner,
    renderDashboardBanner,
  };

  if (document.body?.dataset?.page === "dashboard") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountMemberBanner);
    } else {
      mountMemberBanner();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
