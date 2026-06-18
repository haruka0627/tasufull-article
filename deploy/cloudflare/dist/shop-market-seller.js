(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  function esc(s) {
    return Data?.esc?.(s) ?? String(s ?? "");
  }

  function readShopId() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get("shopId") || params.get("shop_id") || "").trim();
    if (fromUrl) return fromUrl;
    return Data?.DEMO_CATALOG?.[0]?.shopId || "demo-shop-haru-cafe";
  }

  function setStatus(message) {
    const el = document.querySelector("[data-tasful-seller-status]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_seller") return;
    if (!Data) {
      setStatus("出品者データの読み込みに失敗しました。");
      return;
    }

    const shopId = readShopId();
    const pool = await Data.loadProductPool(true);
    let products = Data.getProductsByShop(pool, shopId).map(Data.enrichProductImage);

    if (!products.length) {
      const sellerListed = Data.getSellerProductsByShop(shopId)
        .map(Data.sellerListingToProduct)
        .filter(Boolean)
        .map(Data.enrichProductImage);
      if (sellerListed.length) products = sellerListed;
    }

    if (!products.length) {
      const orders = Data.getSellerOrders(shopId);
      const order = orders[0];
      if (order) {
        products = [
          Data.enrichProductImage({
            id: `${order.shopId}::${order.productId}`,
            shopId: order.shopId,
            productId: order.productId,
            title: order.productName,
            price: Data.formatYenAmount(order.price),
            image: order.productImage,
            shopName: order.sellerName,
            connectVerified: order.connectVerified,
            ratingScore: 4.5,
            reviewCount: 0,
          }),
        ];
      }
    }

    const profileSource =
      products[0] ||
      Data.sellerListingToProduct(Data.getSellerProductsByShop(shopId)[0]) ||
      {
        shopId,
        shopName: Data.getSellerProfile()?.shopName || "マイショップ",
        connectVerified: Boolean(Data.getSellerProfile()?.connectVerified),
        ratingScore: 4.5,
        reviewCount: 0,
      };

    document.querySelector("[data-tasful-seller-hero]")?.removeAttribute("hidden");
    document.title = `${profileSource.shopName || profileSource.title || "出品者"} | TASFUL市場`;

    const profile = Data.buildSellerProfile(profileSource);

    const nameEl = document.querySelector("[data-tasful-seller-name]");
    const ratingEl = document.querySelector("[data-tasful-seller-rating]");
    const reviewsEl = document.querySelector("[data-tasful-seller-reviews]");
    const salesEl = document.querySelector("[data-tasful-seller-sales]");
    const connectEl = document.querySelector("[data-tasful-seller-connect]");
    const ordersLink = document.querySelector("[data-tasful-seller-orders-link]");
    const grid = document.querySelector("[data-tasful-seller-products]");

    if (nameEl) nameEl.textContent = profile.name;
    if (ratingEl) ratingEl.textContent = `${Data.formatStarDisplay(profile.rating)} ${Data.formatReviewScore(profile.rating)}`;
    if (reviewsEl) reviewsEl.textContent = `レビュー ${profile.reviewCount}件`;
    if (salesEl) salesEl.textContent = `販売実績 ${profile.salesCount}件`;
    if (connectEl) connectEl.hidden = !profile.connectVerified;
    if (ordersLink) ordersLink.href = `shop-market-seller-orders.html?shopId=${encodeURIComponent(shopId)}`;
    const addLinks = document.querySelectorAll("[data-tasful-seller-add-product-inline]");
    addLinks.forEach((link) => {
      link.href = Data.listingNewHref(shopId);
    });
    if (grid) {
      grid.innerHTML = products.length
        ? products.map((p) => Data.buildGridCardHtml(p)).join("")
        : `<p class="tasful-market-seller-products__empty">まだ出品商品がありません。「商品を追加」から登録できます。</p>`;
    }

    if (!products.length) setStatus("出品商品はまだありません。");

    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
