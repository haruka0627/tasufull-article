(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;
  const Resolve = window.TasuShopStoreProductResolve;

  const DEMO_SHOP_ID = "demo-shop-haru-cafe";
  const DEMO_SHOP_NAME = "HARU CAFE";
  const DEMO_PRODUCT_TITLE = "季節のパンケーキ";
  const DEMO_TOTAL = 1280;

  function formatLineTitles(lines) {
    const items = (lines || [])
      .map((line) => {
        const title = String(line?.title || "").trim();
        const qty = Math.max(1, Number(line?.qty) || 1);
        if (!title) return "";
        return qty > 1 ? `${title} ×${qty}` : title;
      })
      .filter(Boolean);
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    return items.join("、");
  }

  function buildDemoOrder() {
    return {
      id: `TS-${Date.now().toString(36).toUpperCase().slice(0, 7)}`,
      lines: [
        {
          shopId: DEMO_SHOP_ID,
          shopName: DEMO_SHOP_NAME,
          title: DEMO_PRODUCT_TITLE,
          qty: 1,
        },
      ],
      totals: { total: DEMO_TOTAL },
    };
  }

  function resolveOrder(saved) {
    const demo = buildDemoOrder();
    if (!saved || typeof saved !== "object") return demo;

    const lines = Array.isArray(saved.lines) ? saved.lines : [];
    const firstLine = lines[0] || {};
    const mergedLines =
      lines.length > 0
        ? lines
        : [
            {
              shopId: DEMO_SHOP_ID,
              shopName: DEMO_SHOP_NAME,
              title: DEMO_PRODUCT_TITLE,
              qty: 1,
            },
          ];

    const total = Number(saved.totals?.total);
    return {
      ...saved,
      id: String(saved.id || "").trim() || demo.id,
      lines: mergedLines.map((line, index) => {
        if (index !== 0) return line;
        return {
          ...line,
          shopId: String(line.shopId || "").trim() || DEMO_SHOP_ID,
          shopName: String(line.shopName || "").trim() || DEMO_SHOP_NAME,
          title: String(line.title || "").trim() || DEMO_PRODUCT_TITLE,
        };
      }),
      totals: Number.isFinite(total) && total >= 0 ? saved.totals : { total: DEMO_TOTAL },
    };
  }

  function init() {
    if (document.body.dataset.page !== "shop_store_complete") return;
    const order = resolveOrder(Data?.getLastOrder?.());
    const summary = document.querySelector("[data-shop-store-complete-summary]");
    const shopEl = document.querySelector("[data-shop-store-complete-shop]");
    const productEl = document.querySelector("[data-shop-store-complete-product]");
    const orderEl = document.querySelector("[data-shop-store-complete-order-id]");
    const totalEl = document.querySelector("[data-shop-store-complete-total]");
    const shopLink = document.querySelector("[data-shop-store-complete-shop-link]");

    const firstLine = order.lines[0];
    const shopName = String(firstLine?.shopName || DEMO_SHOP_NAME).trim();
    const productTitle = formatLineTitles(order.lines) || DEMO_PRODUCT_TITLE;
    const orderId = String(order.id || "").trim();
    const total = order.totals?.total;

    if (shopEl) shopEl.textContent = shopName;
    if (productEl) productEl.textContent = productTitle;
    if (orderEl) orderEl.textContent = orderId;
    if (totalEl) totalEl.textContent = Data?.formatYenAmount?.(total) || `¥${DEMO_TOTAL.toLocaleString("ja-JP")}`;
    if (summary) {
      summary.hidden = false;
      summary.removeAttribute("hidden");
    }

    const shopId = String(firstLine?.shopId || DEMO_SHOP_ID).trim();
    if (shopLink) {
      shopLink.href =
        Resolve?.shopStoreDetailHref?.(shopId) || `detail-shop-store.html?id=${encodeURIComponent(shopId)}`;
      shopLink.hidden = false;
      shopLink.removeAttribute("hidden");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
