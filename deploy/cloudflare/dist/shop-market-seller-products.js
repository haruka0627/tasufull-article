(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  window.__tasfulMarketGridImgError = function (img) {
    if (!img || img.dataset.tasfulFallbackApplied === "1") return;
    img.dataset.tasfulFallbackApplied = "1";
    img.src = Data?.getFallbackImageUrl?.() || "";
  };

  function readShopId() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get("shopId") || params.get("shop_id") || "").trim();
    if (fromUrl) return fromUrl;
    return Data?.getDefaultSellerShopId?.() || "tasu-market-seller-me";
  }

  function setListingLinks(shopId) {
    const href = Data?.listingNewHref?.(shopId) || `shop-market-listing-new.html?shopId=${encodeURIComponent(shopId)}`;
    document.querySelectorAll("[data-tasful-seller-products-new], [data-tasful-seller-products-empty-cta]").forEach((el) => {
      el.href = href;
    });
  }

  function renderListedProducts(shopId) {
    const emptyEl = document.querySelector("[data-tasful-seller-products-empty]");
    const gridEl = document.querySelector("[data-tasful-seller-products-grid]");
    const countEl = document.querySelector("[data-tasful-seller-products-count]");
    if (!emptyEl || !gridEl) return;

    let products = [];
    try {
      products = (Data?.getSellerProductsByShop?.(shopId) || [])
        .map((entry) => Data?.sellerListingToProduct?.(entry))
        .filter(Boolean)
        .map((p) => Data?.enrichProductImage?.(p) || p);
    } catch {
      products = [];
    }

    if (countEl) {
      countEl.textContent = `出品商品: ${products.length}件`;
    }

    if (!products.length) {
      gridEl.hidden = true;
      gridEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    gridEl.hidden = false;
    gridEl.innerHTML = products.map((p) => Data.buildGridCardHtml(p)).join("");
  }

  function init() {
    if (document.body.dataset.page !== "shop_market_seller_products") return;

    const shopId = readShopId();
    setListingLinks(shopId);

    if (!Data) {
      return;
    }

    renderListedProducts(shopId);
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
