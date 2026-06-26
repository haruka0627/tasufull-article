/**
 * TASFUL市場 — 下部 tabbar 共通化（SP）
 */
(function (global) {
  "use strict";

  const ITEMS = Object.freeze([
    { id: "home", href: "shop-store.html", label: "ホーム", icon: "🏠" },
    { id: "search", href: "shop-search.html", label: "探す", icon: "🔍" },
    { id: "sell", href: "post.html?scope=business", label: "出品", icon: "＋" },
    { id: "orders", href: "shop-market-order-history.html", label: "注文", icon: "📦" },
    { id: "mypage", href: "profile-settings.html", label: "マイページ", icon: "👤" },
  ]);

  const TAB_BY_PAGE = {
    shop_market_home: "home",
    shop_market_search: "search",
    shop_market_cart: "search",
    shop_market_checkout: "orders",
    shop_market_order_history: "orders",
  };

  function resolveActiveTab() {
    const mount = global.document?.querySelector("[data-tasful-market-tabbar-mount]");
    const explicit = mount?.getAttribute("data-tasful-market-tab-active");
    if (explicit) return explicit;
    const page = global.document?.body?.dataset?.page || "";
    return TAB_BY_PAGE[page] || "";
  }

  function renderTabbar() {
    const doc = global.document;
    if (!doc || doc.querySelector("[data-tasu-market-tabbar]")) return;

    const mount = doc.querySelector("[data-tasful-market-tabbar-mount]");
    if (!mount) return;

    const active = resolveActiveTab();
    const nav = doc.createElement("nav");
    nav.className = "tasful-market-tabbar";
    nav.setAttribute("data-tasu-market-tabbar", "");
    nav.setAttribute("aria-label", "市場メニュー");

    nav.innerHTML = ITEMS.map((item) => {
      const on = item.id === active;
      return (
        `<a href="${item.href}" class="tasful-market-tabbar__item${on ? " is-active" : ""}"` +
        `${on ? ' aria-current="page"' : ""}>` +
        `<span class="tasful-market-tabbar__icon" aria-hidden="true">${item.icon}</span>` +
        `<span class="tasful-market-tabbar__label">${item.label}</span>` +
        `</a>`
      );
    }).join("");

    mount.replaceWith(nav);
  }

  function init() {
    renderTabbar();
  }

  global.TasuShopMarketTabbar = {
    ITEMS,
    render: renderTabbar,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
