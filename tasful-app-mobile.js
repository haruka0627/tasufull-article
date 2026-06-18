/**
 * TASFUL — スマホアプリ共通（下部タブ・戻る・safe-area）
 */
(function (global) {
  "use strict";

  const MOBILE_MQ = "(max-width: 960px)";
  const CSS_HREFS = [
    "tasful-app-mobile.css",
    "tasful-app-mobile-detail.css",
    "tasful-mobile-detail-template.css",
  ];
  const FALLBACK_HOME = "dashboard.html";
  const FALLBACK_NOTIFY = "talk-home.html?tab=notify";

  const TAB_PAGES = Object.freeze({
    home: "dashboard.html",
    chat: "talk-home.html?tab=chat",
    notify: "talk-home.html?tab=notify",
    ai: "ai-workspace.html",
    mypage: "profile-settings.html",
  });

  /** 専用シェル済み（戻るバー自動注入しない） */
  const NO_AUTO_BACK_PAGES = new Set([
    "dashboard.html",
    "talk-home.html",
    "profile-settings.html",
    "profile-edit.html",
    "tasful-notification-settings.html",
  ]);

  /** TASFULアプリ内詳細 — 下部タブを必ず表示 */
  const APP_DETAIL_PAGES = new Set([
    "deal-detail.html",
    "demo-progress.html",
    "demo-complete.html",
    "demo-paid.html",
    "demo-unpaid.html",
    "detail-worker.html",
    "detail-job.html",
    "detail-skill.html",
    "detail-product.html",
    "detail-shop.html",
    "detail-shop-store.html",
    "detail-general.html",
    "detail-business-service.html",
    "detail-business.html",
    "anpi-dashboard.html",
    "anpi-register.html",
    "anpi-notifications.html",
    "mvp-project-detail.html",
    "mvp-thread.html",
    "mvp-calendar.html",
    "partner-assignment.html",
    "board-project-detail.html",
    "board-thread.html",
    "board-projects.html",
    "public-board-detail.html",
    "chat-detail.html",
    "platform-chat-fee-pay.html",
    "order-complete.html",
    "talk-ops-room.html",
  ]);

  function appBasePrefix() {
    const path = global.location?.pathname || "";
    if (/\/builder(?:\/|$)/i.test(path)) return "../";
    return "";
  }

  function appHref(page) {
    return `${appBasePrefix()}${page}`;
  }

  function buildTabbarHtml() {
    const p = appBasePrefix();
    return `
<nav class="tasu-app-tabbar" data-tasu-app-tabbar data-tasu-app-tabbar-injected aria-label="アプリメニュー">
  <a class="tasu-app-tabbar__item" href="${p}dashboard.html" data-tasu-app-tab="home">
    <span class="tasu-app-tabbar__icon" aria-hidden="true">🏠</span>
    <span class="tasu-app-tabbar__label">ホーム</span>
  </a>
  <a class="tasu-app-tabbar__item" href="${p}talk-home.html?tab=chat" data-tasu-app-tab="chat">
    <span class="tasu-app-tabbar__icon" aria-hidden="true">💬</span>
    <span class="tasu-app-tabbar__label">TALK</span>
  </a>
  <a class="tasu-app-tabbar__item" href="${p}ai-workspace.html" data-tasu-app-tab="ai">
    <span class="tasu-app-tabbar__icon" aria-hidden="true">✨</span>
    <span class="tasu-app-tabbar__label">AI</span>
  </a>
  <a class="tasu-app-tabbar__item" href="${p}profile-settings.html" data-tasu-app-tab="mypage">
    <span class="tasu-app-tabbar__icon" aria-hidden="true">👤</span>
    <span class="tasu-app-tabbar__label">マイページ</span>
  </a>
</nav>`;
  }

  const TABBAR_HTML = buildTabbarHtml(); /* @deprecated — use buildTabbarHtml() */

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scriptBaseUrl() {
    const cur = global.document?.currentScript;
    if (cur?.src) {
      try {
        return new URL("./", cur.src).href;
      } catch {
        /* fall through */
      }
    }
    return "";
  }

  function ensureStylesheets() {
    if (!global.document?.head) return;
    const base = scriptBaseUrl();
    const loaded = new Set(
      [...global.document.querySelectorAll('link[rel="stylesheet"]')].map((l) =>
        String(l.getAttribute("href") || "")
      )
    );
    CSS_HREFS.forEach((file) => {
      const href = base ? `${base}${file}` : file;
      if ([...loaded].some((h) => h.includes(file.replace(".css", "")))) return;
      const link = global.document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      global.document.head.appendChild(link);
    });
  }

  function pageFileName() {
    const path = global.location?.pathname || "";
    const parts = path.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "index.html";
  }

  function isMobileViewport() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch {
      return false;
    }
  }

  /** 下部タブを常時表示するコア画面 */
  const CORE_APP_PAGES = new Set([
    "dashboard.html",
    "talk-home.html",
    "profile-settings.html",
    "profile-edit.html",
    "tasful-notification-settings.html",
  ]);

  function isFromNotifyEntry() {
    try {
      return new URLSearchParams(global.location.search || "").get("from") === "notify";
    } catch {
      return false;
    }
  }

  function isPlatformTalkNotifyEntry() {
    return isFromTalkEntry() || isFromNotifyEntry();
  }

  function shouldEnableMobileShell() {
    if (!isMobileViewport()) return false;
    if (CORE_APP_PAGES.has(pageFileName())) return true;
    if (isPlatformTalkNotifyEntry()) return true;
    if (pageFileName() === "chat-detail.html") return true;
    return false;
  }

  function isFromTalkEntry() {
    try {
      return new URLSearchParams(global.location.search || "").get("from") === "talk";
    } catch {
      return false;
    }
  }

  function detectActiveTab() {
    const path = pageFileName();
    const tab = new URLSearchParams(global.location.search || "").get("tab") || "";
    if (isFromNotifyEntry()) return "chat";
    if (isFromTalkEntry()) return "chat";
    if (path === "profile-settings.html" || path === "profile-edit.html") return "mypage";
    if (path === "dashboard.html") return "home";
    if (path === "talk-home.html") {
      if (tab === "notify") return "chat";
      return "chat";
    }
    if (path === "ai-workspace.html" || path === "gen-ai-workspace.html") return "ai";
    return "";
  }

  function syncTabbar(active) {
    const id = active || detectActiveTab();
    document.querySelectorAll("[data-tasu-app-tab], [data-talk-mobile-tab]").forEach((el) => {
      const tabId = el.getAttribute("data-tasu-app-tab") || el.getAttribute("data-talk-mobile-tab");
      const on = Boolean(id) && tabId === id;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  function hasNativeTabbar() {
    return Boolean(
      document.querySelector(
        "[data-tasu-app-tabbar]:not([data-tasu-app-tabbar-injected]), [data-talk-mobile-tabbar]"
      )
    );
  }

  function hasTabbar() {
    return Boolean(
      document.querySelector("[data-tasu-app-tabbar], [data-talk-mobile-tabbar]")
    );
  }

  function shouldInjectTabbar() {
    return !hasTabbar();
  }

  function syncBodyTabbarPadding() {
    if (!document.body.classList.contains("tasu-app-mobile-page")) return;
    if (!hasTabbar()) return;
    if (document.body.dataset.detailType === "job") return;
    if (document.body.dataset.page === "chat") return;
    const hasFixedPageCta = Boolean(
      document.querySelector("[data-tasu-mdetail-cta-dock]:not([hidden])")
    );
    if (hasFixedPageCta) return;
    document.body.style.setProperty("padding-bottom", "var(--tasu-app-tabbar-pad)");
  }

  function markPlatformShellBody() {
    if (isPlatformTalkNotifyEntry()) {
      document.body.dataset.tasuPlatformShell = "1";
    } else {
      delete document.body.dataset.tasuPlatformShell;
    }
  }

  function injectTabbar() {
    if (!shouldInjectTabbar()) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = buildTabbarHtml().trim();
    const nav = wrap.firstElementChild;
    if (!nav) return;
    document.body.appendChild(nav);
  }

  function deriveShellTitle() {
    const raw = String(document.title || "").trim();
    if (!raw) return "TASFUL";
    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts[0];
    return raw.replace(/\s*[-—]\s*TASFUL.*$/i, "").trim() || raw;
  }

  function refreshMobileShellTitle() {
    const el = document.querySelector(".tasu-mobile-page-head__title");
    if (!el) return;
    const next = deriveShellTitle();
    if (next) el.textContent = next;
  }

  /** 戻るバー自動注入しない（専用ヘッダーあり） */
  const NO_AUTO_BACK_BAR_PAGES = new Set([
    "platform-chat-fee-pay.html",
    "chat-detail.html",
  ]);

  function shouldInjectBackBar() {
    if (document.querySelector("[data-tasu-mobile-page-head], [data-tasu-mobile-shell-head]")) {
      return false;
    }
    if (NO_AUTO_BACK_BAR_PAGES.has(pageFileName())) return false;
    if (isPlatformTalkNotifyEntry()) return true;
    if (NO_AUTO_BACK_PAGES.has(pageFileName())) return false;
    return true;
  }

  function normalizeTalkNotifyHref(href) {
    try {
      const u = new URL(String(href || ""), global.location.href);
      const file = (u.pathname.split("/").pop() || "").toLowerCase();
      if (file !== "talk-home.html") return appHref(FALLBACK_NOTIFY);
      const tab = String(u.searchParams.get("tab") || "").toLowerCase();
      if (tab === "notify" || tab === "notifications") {
        u.searchParams.set("tab", "notify");
      } else if (!tab) {
        u.searchParams.set("tab", "chat");
      }
      u.hash = "";
      return `${appBasePrefix()}talk-home.html${u.search}`;
    } catch {
      return appHref(FALLBACK_NOTIFY);
    }
  }

  function talkNotifyReturnUrl() {
    return appHref("talk-home.html?tab=notify");
  }

  function injectMobileBackBar() {
    if (!shouldInjectBackBar()) return;

    const fromTalkNotify = isPlatformTalkNotifyEntry();
    const backLabel = fromTalkNotify ? "TALKに戻る" : "← 戻る";
    const backAttrs = fromTalkNotify
      ? 'data-tasu-talk-back data-tasu-mobile-back aria-label="TASFUL TALKに戻る"'
      : 'data-tasu-mobile-back data-detail-back aria-label="戻る"';

    const head = document.createElement("header");
    head.className = "tasu-mobile-page-head tasu-mobile-shell-head";
    head.setAttribute("data-tasu-mobile-shell-head", "");
    head.innerHTML =
      `<div class="tasu-mobile-page-head__slot tasu-mobile-page-head__slot--start">` +
      `<button type="button" class="tasu-mobile-page-head__back app-detail-back deal-detail-back tasu-talk-back-btn" ${backAttrs}>${escapeHtml(backLabel)}</button>` +
      `</div>` +
      `<h1 class="tasu-mobile-page-head__title">${escapeHtml(deriveShellTitle())}</h1>` +
      `<div class="tasu-mobile-page-head__slot tasu-mobile-page-head__slot--end" aria-hidden="true"></div>`;

    const dashMain = document.querySelector(".dash-main");
    if (dashMain) {
      dashMain.insertBefore(head, dashMain.firstChild);
      return;
    }
    document.body.insertBefore(head, document.body.firstChild);
  }

  function wireMobileBack() {
    document.querySelectorAll("[data-tasu-mobile-back], [data-tasu-talk-back]").forEach((btn) => {
      if (btn.dataset.tasuMobileBackWired) return;
      btn.dataset.tasuMobileBackWired = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.hasAttribute("data-tasu-talk-back") || isPlatformTalkNotifyEntry()) {
          goBackToTalk();
        } else {
          goBackOrHome();
        }
      });
    });
    syncBuilderTalkBackVisibility();
  }

  function syncBuilderTalkBackVisibility() {
    const fromTalkNotify = isPlatformTalkNotifyEntry();
    document.querySelectorAll("[data-builder-talk-back]").forEach((el) => {
      el.hidden = !fromTalkNotify;
    });
  }

  function syncLegacyTalkBackLinks() {
    const fromTalkNotify = isPlatformTalkNotifyEntry();
    const mobile = isMobileViewport();
    document.querySelectorAll(".talk-ops-back").forEach((el) => {
      if (fromTalkNotify && mobile) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      if (fromTalkNotify) {
        el.textContent = "TALKに戻る";
        if (el.dataset.tasuTalkOpsWired) return;
        el.dataset.tasuTalkOpsWired = "1";
        el.addEventListener("click", (e) => {
          e.preventDefault();
          goBackToTalk();
        });
      }
    });
  }

  function goBackToTalk() {
    const fallbackNotify = talkNotifyReturnUrl();

    try {
      const stored = global.sessionStorage.getItem("tasu_talk_return_url");
      const shouldRestore =
        global.sessionStorage.getItem("talkRestoreOnLoad") === "1" ||
        global.sessionStorage.getItem("talkScrollPosition");
      const tab = global.sessionStorage.getItem("talkActiveTab") || "chat";
      const notifyReturn = `${appHref(`talk-home.html?tab=${encodeURIComponent(tab === "notify" || tab === "notifications" ? "notify" : tab)}`)}`;

      if (stored && /talk-home\.html/i.test(stored)) {
        global.location.href = normalizeTalkNotifyHref(stored);
        return;
      }
      if (shouldRestore) {
        global.location.href = normalizeTalkNotifyHref(notifyReturn);
        return;
      }
    } catch {
      /* ignore */
    }

    const ref = String(global.document?.referrer || "");
    if (/talk-home\.html/i.test(ref) && global.history.length > 1) {
      try {
        global.history.back();
        return;
      } catch {
        /* fall through */
      }
    }

    global.location.href = fallbackNotify;
  }

  function goBackOrHome() {
    try {
      if (global.history.length > 1) {
        global.history.back();
        return;
      }
    } catch {
      /* ignore */
    }
    const ref = String(global.document?.referrer || "");
    if (/talk-home\.html/i.test(ref)) {
      global.location.href = appHref(FALLBACK_NOTIFY);
      return;
    }
    global.location.href = appHref(FALLBACK_HOME);
  }

  function teardownMobileShell() {
    document.body.classList.remove("tasu-app-mobile-page");
    delete document.body.dataset.tasuPlatformShell;
    document.body.style.removeProperty("padding-bottom");
    global.TasuMobileDetailTemplate?.teardown?.();
    document.querySelector("[data-tasu-app-tabbar-injected]")?.remove();
    document.querySelector("[data-tasu-mobile-shell-head]")?.remove();
  }

  function init(options) {
    ensureStylesheets();
    wireMobileBack();

    if (!shouldEnableMobileShell()) {
      teardownMobileShell();
      syncBuilderTalkBackVisibility();
      syncLegacyTalkBackLinks();
      return;
    }

    document.body.classList.add("tasu-app-mobile-page");
    markPlatformShellBody();
    if (shouldInjectTabbar()) {
      injectTabbar();
    } else if (hasNativeTabbar()) {
      document.querySelector("[data-tasu-app-tabbar-injected]")?.remove();
    }
    injectMobileBackBar();
    wireMobileBack();
    refreshMobileShellTitle();
    syncTabbar(options?.active || detectActiveTab());
    syncBodyTabbarPadding();
    syncBuilderTalkBackVisibility();
    syncLegacyTalkBackLinks();
    global.TasuMobileDetailTemplate?.scheduleRefresh?.();
    try {
      global.dispatchEvent(new CustomEvent("tasu:mobile-shell-ready"));
    } catch {
      /* ignore */
    }
  }

  function markAppShellNavigation(options) {
    try {
      sessionStorage.setItem("tasu_app_shell", "1");
      const returnUrl = options?.returnUrl || talkNotifyReturnUrl();
      sessionStorage.setItem("tasu_talk_return_url", returnUrl);
    } catch {
      /* ignore */
    }
  }

  function isAppDetailPage() {
    const file = pageFileName();
    if (APP_DETAIL_PAGES.has(file)) return true;
    if (/^detail-/.test(file)) return true;
    if (document.body?.dataset?.detailPage === "1") return true;
    if (document.body?.dataset?.page === "deal-detail") return true;
    return false;
  }

  global.TasufulAppMobile = {
    init,
    syncTabbar,
    detectActiveTab,
    goBackOrHome,
    goBackToTalk,
    isFromTalkEntry,
    isFromNotifyEntry,
    isPlatformTalkNotifyEntry,
    isMobileViewport,
    isAppDetailPage,
    markAppShellNavigation,
    talkNotifyReturnUrl,
    normalizeTalkNotifyHref,
    refreshMobileShellTitle,
    appBasePrefix,
    appHref,
    TAB_PAGES,
    FALLBACK_HOME,
    FALLBACK_NOTIFY,
  };

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.addEventListener?.("resize", () => {
    init({ active: detectActiveTab() });
  });
})(typeof window !== "undefined" ? window : globalThis);
