(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  const DEMO_SHOP_ID = "demo-shop-haru-cafe";
  const DEMO_PRODUCT_ID = "p-0";
  const DEMO_SHOP_NAME = "HARU CAFE";
  const DEMO_PRODUCT_TITLE = "季節のパンケーキ";
  const DEMO_TOTAL = 1280;

  /** PASS凍結 — 市場/店舗販売 CTA 導線（verify-market-complete-cta-final.mjs 確認済） */
  const CTA_BY_SOURCE = {
    market: {
      primaryLabel: "商品を見る",
      secondaryLabel: "TASFUL市場へ戻る",
      secondaryHref: "shop-store.html",
    },
    store: {
      primaryLabel: "店舗を見る",
      secondaryLabel: "店舗一覧へ",
      secondaryHref: "shop-vendors.html",
    },
  };

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
      id: `TM-${Date.now().toString(36).toUpperCase().slice(0, 7)}`,
      source: "market",
      lines: [
        {
          shopId: DEMO_SHOP_ID,
          productId: DEMO_PRODUCT_ID,
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
              productId: DEMO_PRODUCT_ID,
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
          productId: String(line.productId || "").trim() || DEMO_PRODUCT_ID,
          shopName: String(line.shopName || "").trim() || DEMO_SHOP_NAME,
          title: String(line.title || "").trim() || DEMO_PRODUCT_TITLE,
        };
      }),
      totals: Number.isFinite(total) && total >= 0 ? saved.totals : { total: DEMO_TOTAL },
    };
  }

  function resolveCheckoutSource(order) {
    const params = new URLSearchParams(window.location.search);
    const paramSource = String(params.get("source") || "").trim().toLowerCase();
    if (paramSource === "market" || paramSource === "store") return paramSource;

    const orderSource = String(order?.source || "").trim().toLowerCase();
    if (orderSource === "market" || orderSource === "store") return orderSource;

    if (String(order?.channel || "").trim() === "shop_store") return "store";

    return "market";
  }

  function buildMarketProductHref(line) {
    const shopId = String(line?.shopId || DEMO_SHOP_ID).trim();
    const productId = String(line?.productId || DEMO_PRODUCT_ID).trim();
    if (Data?.productHref) {
      return Data.productHref({ shopId, productId });
    }
    return `detail-shop-product.html?shopId=${encodeURIComponent(shopId)}&productId=${encodeURIComponent(productId)}`;
  }

  function buildStoreShopHref(line) {
    const shopId = String(line?.shopId || DEMO_SHOP_ID).trim();
    const Resolve = window.TasuShopStoreProductResolve;
    if (Resolve?.shopStoreDetailHref) {
      return Resolve.shopStoreDetailHref(shopId);
    }
    return shopId
      ? `detail-shop-store.html?id=${encodeURIComponent(shopId)}`
      : "shop-vendors.html";
  }

  function applyCompleteCtas(order, source) {
    const config = CTA_BY_SOURCE[source] || CTA_BY_SOURCE.market;
    const primaryLink = document.querySelector("[data-tasful-complete-primary-link]");
    const secondaryLink = document.querySelector("[data-tasful-complete-secondary-link]");
    const firstLine = order.lines[0] || {};

    const primaryHref =
      source === "store" ? buildStoreShopHref(firstLine) : buildMarketProductHref(firstLine);

    if (primaryLink) {
      primaryLink.href = primaryHref;
      primaryLink.textContent = config.primaryLabel;
    }
    if (secondaryLink) {
      secondaryLink.href = config.secondaryHref;
      secondaryLink.textContent = config.secondaryLabel;
    }

    document.body.dataset.tasfulCompleteSource = source;
  }

  function init() {
    if (document.body.dataset.page !== "shop_market_complete") return;
    const order = resolveOrder(Data?.getLastOrder?.());
    const source = resolveCheckoutSource(order);
    const shopEl = document.querySelector("[data-tasful-complete-shop]");
    const productEl = document.querySelector("[data-tasful-complete-product]");
    const orderEl = document.querySelector("[data-tasful-complete-order-id]");
    const totalEl = document.querySelector("[data-tasful-complete-total]");

    const firstLine = order.lines[0];
    const shopName = String(firstLine?.shopName || DEMO_SHOP_NAME).trim();
    const productTitle = formatLineTitles(order.lines) || DEMO_PRODUCT_TITLE;
    const orderId = String(order.id || "").trim();
    const total = order.totals?.total;

    if (shopEl) shopEl.textContent = shopName;
    if (productEl) productEl.textContent = productTitle;
    if (orderEl) orderEl.textContent = orderId;
    if (totalEl) {
      totalEl.textContent = Data?.formatYenAmount?.(total) || `¥${DEMO_TOTAL.toLocaleString("ja-JP")}`;
    }

    applyCompleteCtas(order, source);
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
