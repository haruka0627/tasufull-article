/**
 * TASFUL Platform — 下部 portal tabbar（SP）
 */
(function (global) {
  "use strict";

  const AI_HREF = "/ai-workspace.html";

  const ITEMS_BY_PAGE = Object.freeze({
    portal_top: Object.freeze([
      { id: "home", href: "/", label: "ホーム", icon: "🏠" },
      { id: "listings", href: "/market/", label: "掲載を探す", icon: "🔍" },
      { id: "sell", href: "/post.html", label: "出品", icon: "＋" },
      { id: "ai", href: AI_HREF, label: "AI相談", icon: "✨" },
      { id: "login", href: "/login.html", label: "ログイン", icon: "👤" },
    ]),
    portal_listings: Object.freeze([
      { id: "top", href: "/", label: "TOP", icon: "🏠" },
      { id: "listings", href: "/market/", label: "掲載", icon: "📋" },
      { id: "general", href: "/market/?type=skill", label: "一般", icon: "🔍" },
      { id: "jobs", href: "/job-top.html", label: "求人", icon: "💼" },
      { id: "ai", href: AI_HREF, label: "AI相談", icon: "✨" },
    ]),
  });

  const TAB_BY_PAGE = Object.freeze({
    portal_top: "home",
    portal_listings: "listings",
  });

  function resolvePageKey() {
    const mount = global.document?.querySelector("[data-tasful-portal-tabbar-mount]");
    const explicit = mount?.getAttribute("data-tasful-portal-tab-active");
    if (explicit) return explicit;
    const page = global.document?.body?.dataset?.page || "";
    return TAB_BY_PAGE[page] ? page : "";
  }

  function resolveActiveTab(pageKey) {
    const mount = global.document?.querySelector("[data-tasful-portal-tabbar-mount]");
    const explicit = mount?.getAttribute("data-tasful-portal-tab-active");
    if (explicit) return explicit;
    return TAB_BY_PAGE[pageKey] || "";
  }

  function renderTabbar() {
    const doc = global.document;
    if (!doc || doc.querySelector("[data-tasu-portal-tabbar]")) return;

    const mount = doc.querySelector("[data-tasful-portal-tabbar-mount]");
    if (!mount) return;

    const pageKey = resolvePageKey();
    const items = ITEMS_BY_PAGE[pageKey];
    if (!items) return;

    const active = resolveActiveTab(pageKey);
    const nav = doc.createElement("nav");
    nav.className = "tasful-portal-tabbar";
    nav.setAttribute("data-tasu-portal-tabbar", "");
    nav.setAttribute("aria-label", "プラットフォームメニュー");

    nav.innerHTML = items
      .map((item) => {
        const on = item.id === active;
        return (
          `<a href="${item.href}" class="tasful-portal-tabbar__item${on ? " is-active" : ""}"` +
          `${on ? ' aria-current="page"' : ""}>` +
          `<span class="tasful-portal-tabbar__icon" aria-hidden="true">${item.icon}</span>` +
          `<span class="tasful-portal-tabbar__label">${item.label}</span>` +
          `</a>`
        );
      })
      .join("");

    mount.replaceWith(nav);
    doc.body.classList.add("tasful-portal-tabbar-page");
  }

  function init() {
    renderTabbar();
  }

  global.TasuPlatformPortalTabbar = {
    ITEMS_BY_PAGE,
    render: renderTabbar,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
