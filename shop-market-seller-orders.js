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

  function renderOrderCard(order, shopId) {
    const statuses = Data.ORDER_STATUSES || [];
    const buttons = statuses
      .map(
        (status) =>
          `<button type="button" class="tasful-market-seller-order-card__btn${order.status === status ? " is-active" : ""}" data-tasful-seller-status-btn data-order-id="${esc(order.orderId)}" data-product-id="${esc(order.productId)}" data-status="${esc(status)}">${esc(status)}</button>`
      )
      .join("");

    return `<article class="tasful-market-seller-order-card" data-tasful-seller-order-card data-order-id="${esc(order.orderId)}" data-product-id="${esc(order.productId)}">
      <div class="tasful-market-seller-order-card__head">
        <span class="tasful-market-seller-order-card__id">注文番号: ${esc(order.orderId)}</span>
        <span class="tasful-market-seller-order-card__status" data-tasful-seller-order-status data-order-id="${esc(order.orderId)}" data-product-id="${esc(order.productId)}">${esc(order.status)}</span>
      </div>
      <p class="tasful-market-seller-order-card__product">${esc(order.productName)} × ${order.quantity}</p>
      <p class="tasful-market-seller-order-card__meta">${esc(Data.formatOrderDateTime(order.createdAt))}<br>${esc(Data.formatYenAmount(order.subtotal || order.price * order.quantity))}</p>
      <div class="tasful-market-seller-order-card__actions">${buttons}</div>
    </article>`;
  }

  function bindEvents(shopId) {
    document.querySelectorAll("[data-tasful-seller-status-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-order-id");
        const productId = btn.getAttribute("data-product-id");
        const status = btn.getAttribute("data-status");
        if (!orderId || !status) return;
        const ok = Data.updateOrderStatus(orderId, productId, status);
        if (!ok) return;
        try {
          window.TasfulMarketNotify?.onSellerStatusAction?.(orderId, productId, status);
        } catch (err) {
          console.warn("[TasfulMarketSellerOrders] notify skipped:", err);
        }
        const card = btn.closest("[data-tasful-seller-order-card]");
        card?.querySelector("[data-tasful-seller-order-status]")?.replaceChildren(document.createTextNode(status));
        card?.querySelectorAll("[data-tasful-seller-status-btn]").forEach((b) => {
          b.classList.toggle("is-active", b.getAttribute("data-status") === status);
        });
      });
    });

    const back = document.querySelector("[data-tasful-seller-back]");
    if (back) back.href = Data.sellerPageHref(shopId);
  }

  function render(shopId, shopName) {
    const listEl = document.querySelector("[data-tasful-seller-orders-list]");
    const emptyEl = document.querySelector("[data-tasful-seller-orders-empty]");
    const leadEl = document.querySelector("[data-tasful-seller-orders-lead]");
    if (!listEl || !emptyEl) return;

    const orders = Data.getSellerOrders(shopId);
    if (leadEl) leadEl.textContent = `${shopName} の注文を管理できます。状態は購入者の注文履歴と同期します。`;

    if (!orders.length) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = orders.map((order) => renderOrderCard(order, shopId)).join("");
    bindEvents(shopId);
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_seller_orders") return;
    if (!Data) return;

    const shopId = readShopId();
    let shopName = Data.getSellerProfile?.()?.shopName || "出品ショップ";
    render(shopId, shopName);

    try {
      const pool = await Data.loadProductPool();
      const products = Data.getProductsByShop(pool, shopId);
      if (products[0]?.shopName) shopName = products[0].shopName;
      document.title = `注文管理 — ${shopName} | TASFUL市場`;
      const leadEl = document.querySelector("[data-tasful-seller-orders-lead]");
      if (leadEl) leadEl.textContent = `${shopName} の注文を管理できます。状態は購入者の注文履歴と同期します。`;
    } catch {
      document.title = `注文管理 — ${shopName} | TASFUL市場`;
    }

    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
