/**
 * TASFUL市場 — 共通モールヘッダー
 * shop-store / shop-search / カート / 注文フローで共用
 */
(function () {
  "use strict";

  const CART_KEY = "tasu_market_cart_count";

  /** 市場フッター — 閲覧導線（shop-store）と店舗販売導線（shop-vendors）を混在させない */
  const FOOTER_ROUTES = {
    marketTop: "shop-store.html",
    vendorList: "shop-vendors.html",
    orderHistory: "shop-market-order-history.html",
    mypage: "shop-market-mypage.html",
    cart: "shop-market-cart.html",
    listingNew: "shop-market-listing-new.html",
    sellerOrders: "shop-market-seller-orders.html",
    sellerGuide: "post.html?scope=business",
    contact: "shop-market-contact.html",
    guide: "shop-market-guide.html",
    terms: "index-top.html",
    privacy: "index-top.html",
  };

  function footerNavLink(key, href, label) {
    return `<li><a href="${escAttr(href)}" data-tasful-market-footer-link="${escAttr(key)}">${esc(label)}</a></li>`;
  }

  const NAV_ITEMS = [
    { id: "all", label: "すべて", href: "shop-search.html" },
    { id: "sale", label: "タイムセール", href: "shop-search.html?sale=1" },
    { id: "rank", label: "ランキング", href: "shop-search.html?sort=reviews" },
    { id: "new", label: "新着", href: "shop-search.html?new=1" },
    { id: "food", label: "食品", href: "shop-search.html?category=food" },
    { id: "handmade", label: "ハンドメイド", href: "shop-search.html?category=handmade" },
    { id: "local", label: "地域商品", href: "shop-search.html?category=local" },
    { id: "used", label: "中古品", href: "shop-search.html?condition=used" },
    { id: "connect", label: "Connect認証済み", href: "shop-search.html?connect=1" },
    { id: "shipping", label: "送料無料", href: "shop-search.html?shipping=1" },
  ];

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function getActionLinesHtml(primary, sub) {
    const subHtml = sub
      ? `<span class="tasful-market-mall-header__action-sub">${esc(sub)}</span>`
      : "";
    return `<span class="tasful-market-mall-header__action-lines" aria-hidden="true"><span class="tasful-market-mall-header__action-primary">${esc(primary)}</span>${subHtml}</span>`;
  }

  function getSellActionHtml() {
    return `<a href="shop-market-listing-new.html" class="tasful-market-mall-header__sell" data-tasful-market-header-sell aria-label="出品する"><span class="tasful-market-mall-header__sell-icon" aria-hidden="true">🏷</span><span class="tasful-market-mall-header__sell-label">出品する</span>${getActionLinesHtml("出品する", "出品")}</a>`;
  }

  function getOrdersActionHtml() {
    return `<a href="shop-market-order-history.html" class="tasful-market-mall-header__orders" aria-label="注文履歴"><span class="tasful-market-mall-header__orders-icon" aria-hidden="true">📋</span><span class="tasful-market-mall-header__orders-label">注文履歴</span>${getActionLinesHtml("注文履歴", "注文")}</a>`;
  }

  function getAccountActionHtml() {
    return `<a href="shop-market-mypage.html" class="tasful-market-mall-header__account" aria-label="マイページ"><span class="tasful-market-mall-header__account-icon" aria-hidden="true">👤</span><span class="tasful-market-mall-header__account-label">マイページ</span>${getActionLinesHtml("ひろ", "マイページ")}</a>`;
  }

  function getCartActionHtml() {
    return `<a href="shop-market-cart.html" class="tasful-market-mall-header__cart" aria-label="カート"><span class="tasful-market-mall-header__cart-icon" aria-hidden="true">🛒</span><span class="tasful-market-mall-header__cart-badge" data-tasful-market-cart-count hidden>0</span><span class="tasful-market-mall-header__cart-label">カート</span>${getActionLinesHtml("カート", ">")}</a>`;
  }

  const PC_ACTION_ICONS = {
    account:
      '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="1.5"></circle><circle cx="18" cy="14" r="5" fill="currentColor"></circle><path d="M8 30c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="currentColor"></path></svg>',
    sell:
      '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M10 12h16l-2 16H12L10 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M8 12h20l-2-4H10l-2 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M14 20v4M22 20v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>',
    orders:
      '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><rect x="10" y="6" width="16" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M14 12h8M14 17h8M14 22h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M22 6v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
    cart:
      '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M8 8h3l2.5 14h11L27 12H11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="15" cy="28" r="2" fill="currentColor"></circle><circle cx="24" cy="28" r="2" fill="currentColor"></circle></svg>',
  };

  function getPcActionsHtml() {
    return `<div class="tasful-header-pc__actions"><a href="shop-market-mypage.html" class="tasful-header-pc__action" aria-label="マイページ"><span class="tasful-header-pc__icon">${PC_ACTION_ICONS.account}</span><span class="tasful-header-pc__main">ひろ⌄</span><span class="tasful-header-pc__sub">マイページ</span></a><a href="shop-market-listing-new.html" class="tasful-header-pc__action" data-tasful-market-header-sell aria-label="出品する"><span class="tasful-header-pc__icon">${PC_ACTION_ICONS.sell}</span><span class="tasful-header-pc__main">出品する</span><span class="tasful-header-pc__sub">出品</span></a><a href="shop-market-order-history.html" class="tasful-header-pc__action" aria-label="注文履歴"><span class="tasful-header-pc__icon">${PC_ACTION_ICONS.orders}</span><span class="tasful-header-pc__main">注文履歴</span><span class="tasful-header-pc__sub">注文</span></a><a href="shop-market-cart.html" class="tasful-header-pc__action tasful-header-pc__action--cart" aria-label="カート"><span class="tasful-header-pc__icon-wrap"><span class="tasful-header-pc__icon">${PC_ACTION_ICONS.cart}</span><span class="tasful-header-pc__badge" data-tasful-market-cart-count hidden>0</span></span><span class="tasful-header-pc__main">カート</span><span class="tasful-header-pc__sub">&gt;</span></a></div>`;
  }

  const MARKET_LOGO_SRC = "images/tasful-globe-logo.png";

  function getPcBrandHtml() {
    return `<div class="tasful-header-pc__brand"><img class="tasful-header-pc__logo" src="${MARKET_LOGO_SRC}" alt="TASFUL" width="58" height="58" decoding="async"><span class="tasful-header-pc__brand-text">TASFUL市場</span></div>`;
  }

  function getLogoHtml() {
    return `<a href="shop-store.html" class="tasful-market-mall-header__logo" aria-label="TASFUL市場トップ"><span class="tasful-market-mall-header__logo-mark" aria-hidden="true">T</span><span class="tasful-market-mall-header__logo-text">TASFUL<em>市場</em></span>${getPcBrandHtml()}</a>`;
  }

  function getSearchHtml() {
    return `<div class="tasful-market-mall-header__search-row"><form class="tasful-market-mall-header__search" role="search" data-tasful-market-search-form action="shop-search.html" method="get"><input type="search" name="keyword" class="tasful-market-mall-header__search-input" data-tasful-market-search-input placeholder="商品名・キーワードで検索" aria-label="商品名・キーワードで検索"><button type="submit" class="tasful-market-mall-header__search-btn" aria-label="検索"><svg class="tasful-market-mall-header__search-btn-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg></button></form></div>`;
  }

  function getMobileActionsHtml() {
    return `<div class="tasful-market-mall-header__actions">${getAccountActionHtml()}${getSellActionHtml()}${getOrdersActionHtml()}${getCartActionHtml()}</div>`;
  }

  function getActionsHtml() {
    return `${getMobileActionsHtml()}${getPcActionsHtml()}`;
  }

  function getHeaderMarkup() {
    return `<header class="tasful-market-mall-header" data-tasful-market-header aria-label="TASFUL市場"><div class="tasful-market-mall-header__stack"><div class="tasful-market-mall-header__top">${getLogoHtml()}${getSearchHtml()}${getActionsHtml()}</div></div><nav class="tasful-market-mall-header__nav" aria-label="市場カテゴリ"><div class="tasful-market-mall-header__nav-scroll" data-tasful-market-nav></div></nav></header>`;
  }

  function injectSellAction() {
    const actions = document.querySelector(".tasful-market-mall-header__actions");
    if (!actions || actions.querySelector("[data-tasful-market-header-sell]")) return;
    const orders = actions.querySelector(".tasful-market-mall-header__orders");
    const cart = actions.querySelector(".tasful-market-mall-header__cart");
    const wrap = document.createElement("div");
    wrap.innerHTML = getSellActionHtml();
    const sell = wrap.firstElementChild;
    if (orders) actions.insertBefore(sell, orders);
    else if (cart) actions.insertBefore(sell, cart);
    else actions.appendChild(sell);
  }

  function injectOrdersAction() {
    const actions = document.querySelector(".tasful-market-mall-header__actions");
    if (!actions || actions.querySelector(".tasful-market-mall-header__orders")) return;
    const cart = actions.querySelector(".tasful-market-mall-header__cart");
    const wrap = document.createElement("div");
    wrap.innerHTML = getOrdersActionHtml();
    const orders = wrap.firstElementChild;
    if (cart) actions.insertBefore(orders, cart);
    else actions.appendChild(orders);
  }

  function upgradeSearchButton(btn) {
    if (!btn || btn.querySelector(".tasful-market-mall-header__search-btn-icon")) return;
    btn.innerHTML =
      '<svg class="tasful-market-mall-header__search-btn-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
  }

  function upgradeActionLines() {
    const specs = [
      { sel: ".tasful-market-mall-header__account", html: getActionLinesHtml("ひろ", "マイページ") },
      { sel: ".tasful-market-mall-header__sell", html: getActionLinesHtml("出品する", "出品") },
      { sel: ".tasful-market-mall-header__orders", html: getActionLinesHtml("注文履歴", "注文") },
      { sel: ".tasful-market-mall-header__cart", html: getActionLinesHtml("カート", ">") },
    ];
    for (const { sel, html } of specs) {
      const link = document.querySelector(sel);
      if (!link || link.querySelector(".tasful-market-mall-header__action-lines")) continue;
      link.insertAdjacentHTML("beforeend", html);
    }
  }

  function normalizeMarketLogo() {
    const pcLogo = $(".tasful-header-pc__logo");
    if (pcLogo && !pcLogo.src.includes("tasful-globe-logo.png")) {
      pcLogo.src = MARKET_LOGO_SRC;
      pcLogo.alt = "TASFUL";
    }
    const legacyImg = $(".tasful-market-mall-header__logo-img");
    if (legacyImg && !legacyImg.src.includes("tasful-globe-logo.png")) {
      legacyImg.src = MARKET_LOGO_SRC;
      legacyImg.alt = "TASFUL";
    }
  }

  /** 旧インラインヘッダー（検索が __top 外）を新PCレイアウトへ昇格。390px CSS は flex-wrap のまま */
  function upgradeHeaderLayout() {
    const header = $("[data-tasful-market-header]");
    if (!header || header.dataset.tasfulMarketHeaderUpgraded === "1") return;

    const stack = $(".tasful-market-mall-header__stack", header);
    const top = $(".tasful-market-mall-header__top", header);
    if (!stack || !top) return;

    const logo = $(".tasful-market-mall-header__logo", top);
    if (logo && !logo.querySelector(".tasful-header-pc__brand")) {
      upgradePcBrand(logo);
    }

    normalizeMarketLogo();

    const searchRow = $(".tasful-market-mall-header__search-row", stack);
    if (searchRow && !top.contains(searchRow)) {
      const actions = $(".tasful-market-mall-header__actions", top);
      if (actions) top.insertBefore(searchRow, actions);
      else top.appendChild(searchRow);
    }

    upgradeSearchButton($(".tasful-market-mall-header__search-btn", header));
    upgradeActionLines();
    upgradePcActions(top);
    header.dataset.tasfulMarketHeaderUpgraded = "1";
  }

  function upgradePcBrand(logoEl) {
    const logo = logoEl || $(".tasful-market-mall-header__logo");
    if (!logo || logo.querySelector(".tasful-header-pc__brand")) return;
    logo.insertAdjacentHTML("beforeend", getPcBrandHtml());
  }

  function upgradePcActions(topEl) {
    const top = topEl || $(".tasful-market-mall-header__top");
    if (!top || top.querySelector(".tasful-header-pc__actions")) return;
    top.insertAdjacentHTML("beforeend", getPcActionsHtml());
  }

  function getFooterMarkup() {
    const r = FOOTER_ROUTES;
    const shoppingLinks = [
      footerNavLink("market-top", r.marketTop, "市場TOP"),
      footerNavLink("vendor-list", r.vendorList, "店舗一覧"),
      footerNavLink("order-history", r.orderHistory, "注文履歴"),
      footerNavLink("mypage", r.mypage, "マイページ"),
      footerNavLink("cart", r.cart, "カート"),
    ].join("");
    const sellerLinks = [
      footerNavLink("listing-new", r.listingNew, "出品する"),
      footerNavLink("seller-orders", r.sellerOrders, "出品者注文管理"),
      footerNavLink("seller-guide", r.sellerGuide, "出店ガイド"),
    ].join("");
    const supportLinks = [
      footerNavLink("contact", r.contact, "お問い合わせ"),
      footerNavLink("guide", r.guide, "利用ガイド"),
      footerNavLink("terms", r.terms, "利用規約"),
      footerNavLink("privacy", r.privacy, "プライバシーポリシー"),
    ].join("");

    return `<footer class="tasful-market-footer" aria-label="TASFUL市場フッター"><div class="tasful-market-footer__inner"><div class="tasful-market-footer__brand-block"><a href="${escAttr(r.marketTop)}" class="tasful-market-footer__brand-link" data-tasful-market-footer-link="market-top-brand"><p class="tasful-market-footer__brand">TASFUL市場</p><p class="tasful-market-footer__lead">安心して売買できる</p><p class="tasful-market-footer__sub">TASFULのショッピングマーケット</p></a></div><nav class="tasful-market-footer__block" aria-labelledby="tasful-market-footer-shop"><h2 class="tasful-market-footer__heading" id="tasful-market-footer-shop">ショッピング</h2><ul class="tasful-market-footer__links">${shoppingLinks}</ul></nav><nav class="tasful-market-footer__block" aria-labelledby="tasful-market-footer-seller"><h2 class="tasful-market-footer__heading" id="tasful-market-footer-seller">出品</h2><ul class="tasful-market-footer__links">${sellerLinks}</ul></nav><nav class="tasful-market-footer__block" aria-labelledby="tasful-market-footer-support"><h2 class="tasful-market-footer__heading" id="tasful-market-footer-support">サポート・規約</h2><ul class="tasful-market-footer__links">${supportLinks}</ul></nav><p class="tasful-market-footer__copy">© TASFUL</p></div></footer>`;
  }

  function mountFooter() {
    if (document.querySelector(".tasful-market-footer")) return false;
    const anchor =
      document.querySelector(".tasful-market-shell") ||
      document.querySelector("main.tasful-market-cart-main") ||
      document.querySelector("main.tasful-market-checkout-main") ||
      document.querySelector("main.tasful-market-order-history-main") ||
      document.querySelector("main") ||
      null;
    if (anchor) anchor.insertAdjacentHTML("afterend", getFooterMarkup());
    else document.body.insertAdjacentHTML("beforeend", getFooterMarkup());
    return true;
  }

  function mountHeader() {
    const mount = $("[data-tasful-market-header-mount]");
    if (!mount || $("[data-tasful-market-header]")) return false;
    mount.insertAdjacentHTML("afterbegin", getHeaderMarkup());
    return true;
  }

  function resolveActiveNavId() {
    const path = window.location.pathname.replace(/\\/g, "/");
    if (!path.endsWith("shop-search.html")) {
      return path.endsWith("shop-store.html") ? "all" : "";
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("sale") === "1") return "sale";
    if (params.get("sort") === "reviews") return "rank";
    if (params.get("new") === "1") return "new";
    if (params.get("category") === "food") return "food";
    if (params.get("category") === "handmade") return "handmade";
    if (params.get("category") === "local") return "local";
    if (params.get("condition") === "used") return "used";
    if (params.get("connect") === "1") return "connect";
    if (params.get("shipping") === "1") return "shipping";
    if (params.get("keyword") || params.get("q")) return "";
    return "all";
  }

  function renderNav(activeId) {
    const nav = $("[data-tasful-market-nav]");
    if (!nav) return;
    nav.innerHTML = NAV_ITEMS.map((item) => {
      const active = item.id === activeId ? " is-active" : "";
      return `<a class="tasful-market-mall-header__nav-item${active}" href="${escAttr(item.href)}" data-tasful-market-nav-item="${escAttr(item.id)}">${esc(item.label)}</a>`;
    }).join("");
  }

  function updateCartBadge() {
    const badges = document.querySelectorAll("[data-tasful-market-cart-count]");
    if (!badges.length) return;
    let count = 0;
    try {
      count = Number(localStorage.getItem(CART_KEY)) || 0;
    } catch {
      count = 0;
    }
    badges.forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
    });
  }

  function syncHeaderOffset() {
    const header = $("[data-tasful-market-header]");
    if (!header) return;
    const stack = $(".tasful-market-mall-header__stack", header);
    const nav = $(".tasful-market-mall-header__nav", header);
    const h = Math.max(
      header.offsetHeight || 0,
      (stack?.offsetHeight || 0) + (nav?.offsetHeight || 0),
      Math.round(header.getBoundingClientRect().height)
    );
    if (h > 0) {
      document.documentElement.style.setProperty("--tasful-market-header-total-h", `${h}px`);
    }
  }

  function bindSearchForm() {
    const form = $("[data-tasful-market-search-form]");
    const input = $("[data-tasful-market-search-input]");
    if (!form || form.dataset.tasfulMarketHeaderBound === "1") return;
    form.dataset.tasfulMarketHeaderBound = "1";

    const isSearchPage = document.body.dataset.page === "shop_market_search";
    if (isSearchPage) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const kw = String(input?.value || "").trim();
      const url = new URL("shop-search.html", window.location.href);
      if (kw) url.searchParams.set("keyword", kw);
      window.location.href = url.pathname + url.search;
    });
  }

  function initMarketHeader() {
    mountHeader();
    upgradeHeaderLayout();
    normalizeMarketLogo();
    upgradePcBrand();
    upgradePcActions();
    upgradeActionLines();
    injectSellAction();
    injectOrdersAction();
    const params = new URLSearchParams(window.location.search);
    const initialKeyword = params.get("keyword") || params.get("q") || "";
    const input = $("[data-tasful-market-search-input]");
    if (input && initialKeyword) input.value = initialKeyword;

    renderNav(resolveActiveNavId());
    updateCartBadge();
    bindSearchForm();
    mountFooter();
    syncHeaderOffset();
    window.addEventListener("resize", syncHeaderOffset);
    window.addEventListener("storage", (e) => {
      if (e.key === CART_KEY) updateCartBadge();
    });
    window.addEventListener("tasful-market-cart-updated", updateCartBadge);
  }

  window.TasfulMarketHeader = {
    CART_KEY,
    FOOTER_ROUTES,
    NAV_ITEMS,
    getHeaderMarkup,
    getFooterMarkup,
    mountHeader,
    mountFooter,
    injectSellAction,
    injectOrdersAction,
    normalizeMarketLogo,
    upgradeHeaderLayout,
    upgradePcBrand,
    getPcBrandHtml,
    upgradePcActions,
    getPcActionsHtml,
    upgradeActionLines,
    renderNav,
    updateCartBadge,
    syncHeaderOffset,
    resolveActiveNavId,
    initMarketHeader,
  };

  if (document.body.classList.contains("tasful-market-page")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initMarketHeader);
    } else {
      initMarketHeader();
    }
  }
})();
