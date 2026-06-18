(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  function esc(s) {
    return Data?.esc?.(s) ?? String(s ?? "");
  }

  async function render() {
    const listEl = document.querySelector("[data-tasful-following-list]");
    const emptyEl = document.querySelector("[data-tasful-following-empty]");
    const countEl = document.querySelector("[data-tasful-following-count]");
    if (!listEl || !emptyEl || !Data) return;

    const pool = await Data.loadProductPool();
    const shops = Data.getFollowedShops(pool);

    if (!shops.length) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      if (countEl) countEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    if (countEl) {
      countEl.hidden = false;
      countEl.textContent = `${shops.length}件`;
    }

    listEl.innerHTML = shops
      .map(
        (shop) => `<a class="tasful-market-following-card" href="${esc(Data.sellerPageHref(shop.shopId))}"><div class="tasful-market-following-card__img"><img src="${esc(shop.sampleImage)}" alt="" loading="lazy"></div><div><p class="tasful-market-following-card__name">${esc(shop.shopName)}</p><p class="tasful-market-following-card__meta">商品 ${shop.productCount}件${shop.connectVerified ? " · Connect認証" : ""}</p></div></a>`
      )
      .join("");
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_following") return;
    await render();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
