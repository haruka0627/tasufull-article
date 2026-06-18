/**
 * detail-shop.html — shop_store 以外は描画停止
 */
(function () {
  "use strict";

  function isShopStoreDetailPage() {
    return document.body?.dataset?.detailType === "shop_store";
  }

  function guardShopListingType() {
    if (!isShopStoreDetailPage()) return;
    document.addEventListener("tasu:listing-applied", (e) => {
      const listing = e?.detail?.listing;
      const type = String(listing?.listing_type || listing?.type || "").trim();
      if (type && type !== "shop_store") {
        console.warn("[invalid shop listing]", listing);
        const root = document.querySelector("[data-biz-detail-root]");
        if (root) {
          root.hidden = true;
          root.setAttribute("hidden", "");
        }
        const statusEl = document.querySelector("[data-listing-detail-status]");
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "店舗・販売の掲載ではありません。URL をご確認ください。";
        }
      }
    });
  }

  guardShopListingType();
})();

