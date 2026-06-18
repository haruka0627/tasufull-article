/**
 * detail-shop.html — ネイティブスマホUI（960px以下）
 * 店舗・販売詳細は clone テンプレではなくページ本体を表示する
 */
(function () {
  "use strict";

  const MQ = "(max-width: 960px)";
  let lastCfg = null;

  function isMobile() {
    try {
      return window.matchMedia(MQ).matches;
    } catch {
      return false;
    }
  }

  function fixStickyNavLayout() {
    const nav = document.querySelector("[data-shop-sticky-action-nav]");
    if (!nav) return;
    nav.classList.add("shop-mobile-sticky-nav");
    nav.style.bottom = "auto";
    nav.style.height = "auto";
    nav.style.minHeight = "0";
    const tabs = nav.querySelector("[data-shop-sticky-action-tabs]");
    if (tabs) tabs.classList.add("shop-mobile-sticky-nav__list");
    nav.querySelectorAll(".shop-sticky-action-nav__tab").forEach((tab) => {
      tab.classList.add("shop-mobile-sticky-nav__item");
    });
    const actions = nav.querySelector("[data-shop-sticky-action-actions]");
    if (actions) {
      actions.hidden = true;
      actions.setAttribute("hidden", "");
    }
  }

  function setMobileVisibilityFlags(cfg) {
    const Cat = window.TasuShopDetailCategory;
    const vis = Cat?.getShopMobileVisibleSections?.(cfg) || {};
    const body = document.body;
    const map = {
      products: "shopMvisProducts",
      cases: "shopMvisCases",
      highlights: "shopMvisHighlights",
      info: "shopMvisInfo",
      reviews: "shopMvisReviews",
      faq: "shopMvisFaq",
    };
    Object.entries(map).forEach(([key, datasetKey]) => {
      body.dataset[datasetKey] = vis[key] === false ? "0" : "1";
    });
  }

  function applyNativeMobileState(cfg) {
    const Cat = window.TasuShopDetailCategory;
    const categoryKey = String(cfg?.categoryKey || "").trim();
    const native = Cat?.usesNativeShopDetailMobile?.(categoryKey);
    const mobile = isMobile();

    document.body.classList.toggle("shop-detail-page--native-mobile", Boolean(native && mobile));
    document.body.classList.toggle("shop-detail-page--buyback-mobile", Boolean(
      native && mobile && Cat?.isShopBuybackMobileCategory?.(categoryKey)
    ));

    const bottom = window.TasuDetailShopStoreBottom;
    if (bottom?.syncShopMobileChrome) bottom.syncShopMobileChrome(cfg);

    if (!native || !mobile) {
      document.body.removeAttribute("data-shop-mvis-products");
      document.body.removeAttribute("data-shop-mvis-cases");
      document.body.removeAttribute("data-shop-mvis-highlights");
      document.body.removeAttribute("data-shop-mvis-info");
      document.body.removeAttribute("data-shop-mvis-reviews");
      document.body.removeAttribute("data-shop-mvis-faq");
      return;
    }

    document.body.dataset.shopCategoryMobile = categoryKey;
    setMobileVisibilityFlags(cfg);
    fixStickyNavLayout();
    if (bottom?.renderShopStickyActionNav && window.__lastShopListing && cfg) {
      const tabsHost = document.querySelector("[data-shop-sticky-action-tabs]");
      if (tabsHost) delete tabsHost.dataset.shopStickyScrollBound;
      bottom.renderShopStickyActionNav(window.__lastShopListing, cfg);
      bottom.setupShopStickyActionNavScroll?.(cfg);
    }
  }

  function refresh(cfg) {
    if (cfg) lastCfg = cfg;
    if (!lastCfg) return;
    applyNativeMobileState(lastCfg);
  }

  function onViewportChange() {
    if (isMobile()) {
      window.TasuMobileDetailTemplate?.restorePcDetailState?.();
      window.TasuMobileDetailTemplate?.teardown?.();
    }
    refresh(lastCfg);
  }

  window.TasuShopDetailMobile = {
    apply(cfg) {
      lastCfg = cfg || lastCfg;
      applyNativeMobileState(lastCfg);
    },
    refresh,
    isMobile,
  };

  function boot() {
    try {
      const mq = window.matchMedia(MQ);
      const handler = () => onViewportChange();
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);
    } catch {
      window.addEventListener("resize", onViewportChange);
    }
    window.addEventListener("tasu:listing-applied", () => {
      requestAnimationFrame(() => refresh(lastCfg));
    });
    onViewportChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
