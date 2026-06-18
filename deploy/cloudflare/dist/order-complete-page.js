/**
 * 店舗商品 order-complete.html
 */
(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function setStatus(msg, isError) {
    const el = $("[data-order-complete-status]");
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? "#b91c1c" : "#64748b";
    }
  }

  function showOrder(data) {
    $("[data-order-complete-card]")?.removeAttribute("hidden");
    if (data.order_id) $("[data-order-id]").textContent = data.order_id;
    if (data.product_name) $("[data-order-product-name]").textContent = data.product_name;
    if (data.quantity != null) $("[data-order-quantity]").textContent = String(data.quantity);
    const total = data.amount_total ?? data.total_amount_jpy;
    if (total != null) {
      $("[data-order-total]").textContent = window.TasuShopCheckout.formatYen(total);
    }
    if (data.seller_amount != null) {
      $("[data-order-seller-amount]").textContent = window.TasuShopCheckout.formatYen(
        data.seller_amount
      );
    }
    if (data.platform_fee_amount != null) {
      $("[data-order-platform-fee]").textContent = window.TasuShopCheckout.formatYen(
        data.platform_fee_amount
      );
    }
    const shopLink = $("[data-order-shop-link]");
    if (shopLink && data.shop_id) {
      shopLink.href = `detail-shop.html?id=${encodeURIComponent(data.shop_id)}`;
    }
    setStatus("お支払いが完了しました。ありがとうございます。", false);
  }

  function notifyTalkShopOrder(data, source) {
    try {
      window.TasuTalkPlatformNotify?.notifyShopOrder?.({
        order: {
          id: data.order_id,
          shop_id: data.shop_id,
          product_id: data.product_id,
          product_name: data.product_name,
          quantity: data.quantity,
          amount_total: data.amount_total ?? data.total_amount_jpy,
          source: source || "stripe",
        },
        shopId: data.shop_id,
        productId: data.product_id,
      });
    } catch (err) {
      console.warn("[order-complete] TALK notify skipped:", err);
    }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id")?.trim() || "";
    const isDemo = params.get("demo") === "1";

    if (isDemo) {
      const orderId = params.get("order_id") || "";
      const orders = window.TasuShopCheckout.loadLocalOrders();
      const order = orders.find((o) => o.id === orderId) || null;
      showOrder({
        order_id: orderId || "（デモ）",
        shop_id: params.get("shopId") || order?.shop_id || order?.shop_listing_id,
        product_id: params.get("productId") || order?.product_id,
        product_name: order?.product_name || "商品",
        quantity: order?.quantity ?? 1,
        amount_total: order?.amount_total ?? order?.total_amount_jpy ?? 0,
        seller_amount: order?.seller_amount,
        platform_fee_amount: order?.platform_fee_amount,
      });
      return;
    }

    if (params.get("shop_checkout") !== "success" || !sessionId) {
      setStatus("注文情報を確認できませんでした。", true);
      return;
    }

    try {
      setStatus("決済を確認しています…", false);
      const data = await window.TasuShopCheckout.confirmCheckoutSession(sessionId);
      const orderView = {
        order_id: data.order_id,
        shop_id: data.shop_id,
        product_id: data.product_id,
        product_name: data.product_name,
        quantity: data.quantity,
        amount_total: data.total_amount_jpy ?? data.amount_total,
        total_amount_jpy: data.total_amount_jpy,
      };
      showOrder(orderView);
      notifyTalkShopOrder(orderView, "stripe");

      const clean = new URL(window.location.href);
      clean.searchParams.delete("session_id");
      window.history.replaceState({}, "", clean.pathname + clean.search);
    } catch (err) {
      console.error("[order-complete]", err);
      setStatus(err.message || "注文の確認に失敗しました", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
