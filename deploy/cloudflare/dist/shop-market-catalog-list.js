(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  window.__tasfulMarketGridImgError = function (img) {
    if (!img || img.dataset.tasfulFallbackApplied === "1") return;
    img.dataset.tasfulFallbackApplied = "1";
    img.src = Data?.getFallbackImageUrl?.() || "";
  };

  const PAGE_CONFIG = {
    shop_market_favorites: {
      getProducts: (pool) => Data.getFavoriteProducts(pool),
      emptyText: "お気に入りはまだありません",
    },
    shop_market_recent: {
      getProducts: (pool) => Data.getRecentItemProducts(pool),
      emptyText: "最近見た商品はありません",
    },
  };

  async function render() {
    const page = document.body.dataset.page;
    const config = PAGE_CONFIG[page];
    if (!config || !Data) return;

    const listEl = document.querySelector("[data-tasful-catalog-grid]");
    const emptyEl = document.querySelector("[data-tasful-catalog-empty]");
    const countEl = document.querySelector("[data-tasful-catalog-count]");
    if (!listEl || !emptyEl) return;

    const pool = await Data.loadProductPool();
    const products = config.getProducts(pool);

    if (!products.length) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      if (countEl) countEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    if (countEl) {
      countEl.hidden = false;
      countEl.textContent = `${products.length}件`;
    }
    listEl.innerHTML = products.map((p) => Data.buildGridCardHtml(p)).join("");
  }

  async function init() {
    if (!PAGE_CONFIG[document.body.dataset.page]) return;
    await render();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
