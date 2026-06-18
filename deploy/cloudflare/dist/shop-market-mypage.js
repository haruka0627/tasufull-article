(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  window.__tasfulMarketGridImgError = function (img) {
    if (!img || img.dataset.tasfulFallbackApplied === "1") return;
    img.dataset.tasfulFallbackApplied = "1";
    img.src = Data?.getFallbackImageUrl?.() || "";
  };

  function setMeta(sel, text) {
    const el = document.querySelector(sel);
    if (!el || !text) return;
    el.textContent = text;
  }

  async function renderRecentPreview() {
    const section = document.querySelector("[data-tasful-mypage-recent-preview]");
    const grid = document.querySelector("[data-tasful-mypage-recent-grid]");
    if (!section || !grid || !Data) return;

    const pool = await Data.loadProductPool();
    const products = Data.getRecentItemProducts(pool).slice(0, 4);
    if (!products.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = products.map((p) => Data.buildGridCardHtml(p)).join("");
  }

  async function renderListedPreview() {
    const section = document.querySelector("[data-tasful-mypage-listed-preview]");
    const grid = document.querySelector("[data-tasful-mypage-listed-grid]");
    const more = document.querySelector("[data-tasful-mypage-listed-more]");
    if (!section || !grid || !Data) return;

    const shopId = Data.getDefaultSellerShopId();
    const listed = Data.getSellerProductsByShop(shopId)
      .map(Data.sellerListingToProduct)
      .filter(Boolean)
      .slice(0, 4);

    if (more) more.href = Data.sellerProductsPageHref?.(shopId) || `shop-market-seller-products.html?shopId=${encodeURIComponent(shopId)}`;
    if (!listed.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = listed.map((p) => Data.buildGridCardHtml(Data.enrichProductImage(p))).join("");
  }

  function renderCounts() {
    if (!Data) return;
    const orders = Data.getOrderHistory?.() || [];
    const favs = Data.getFavorites?.() || [];
    const recent = Data.getRecentItems?.() || [];
    const follows = Data.getFollowedShopIds?.() || [];
    const shopId = Data.getDefaultSellerShopId();
    const listed = Data.getSellerProductsByShop(shopId);

    if (orders.length) setMeta("[data-tasful-mypage-order-count]", `${orders.length}件`);
    if (favs.length) setMeta("[data-tasful-mypage-fav-count]", `${favs.length}件`);
    if (recent.length) setMeta("[data-tasful-mypage-recent-count]", `${recent.length}件`);
    if (follows.length) setMeta("[data-tasful-mypage-follow-count]", `${follows.length}件`);
    if (listed.length) setMeta("[data-tasful-mypage-listed-count]", `${listed.length}件`);

    const listedLink = document.querySelector("[data-tasful-mypage-listed]");
    const listingNewLink = document.querySelector("[data-tasful-mypage-listing-new]");
    const sellerOrdersLink = document.querySelector("[data-tasful-mypage-seller-orders]");
    if (listedLink) {
      listedLink.href =
        Data.sellerProductsPageHref?.(shopId) || `shop-market-seller-products.html?shopId=${encodeURIComponent(shopId)}`;
    }
    if (listingNewLink) listingNewLink.href = Data.listingNewHref(shopId);
    if (sellerOrdersLink) sellerOrdersLink.href = `shop-market-seller-orders.html?shopId=${encodeURIComponent(shopId)}`;
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_mypage") return;
    renderCounts();
    await renderListedPreview();
    await renderRecentPreview();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
