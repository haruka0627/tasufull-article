/**
 * 店舗販売 — 注文確認
 */
(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;
  const Resolve = window.TasuShopStoreProductResolve;

  const DEMO_ADDRESS = {
    name: "山田 太郎",
    phone: "090-1234-5678",
    zip: "〒150-0001",
    address: "東京都渋谷区神宮前1-2-3 TASFULマンション 501",
  };

  const state = { lines: [], totals: null, mode: "" };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    return Data?.esc?.(s) ?? String(s ?? "");
  }

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      mode: String(params.get("mode") || "cart").trim(),
      shopId: String(params.get("shopId") || params.get("shop_id") || "").trim(),
      productId: String(params.get("productId") || params.get("product_id") || "").trim(),
      quantity: Math.max(1, parseInt(params.get("quantity") || "1", 10) || 1),
    };
  }

  function setMobileBarPadding(active) {
    document.body.classList.toggle("content-bottom-padding", Boolean(active));
  }

  function setStatus(message, isError) {
    const el = $("[data-shop-store-checkout-status]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.style.color = isError ? "#b91c1c" : "#6b7280";
    $("[data-shop-store-checkout-body]")?.setAttribute("hidden", "");
    $("[data-shop-store-checkout-layout]")?.setAttribute("hidden", "");
    document.querySelectorAll("[data-shop-store-checkout-bar], [data-shop-store-checkout-bar-mobile]").forEach((node) => {
      node.setAttribute("hidden", "");
    });
    setMobileBarPadding(false);
  }

  function showCheckout() {
    $("[data-shop-store-checkout-status]")?.setAttribute("hidden", "");
    $("[data-shop-store-checkout-layout]")?.removeAttribute("hidden");
    $("[data-shop-store-checkout-body]")?.removeAttribute("hidden");
    document.querySelectorAll("[data-shop-store-checkout-bar], [data-shop-store-checkout-bar-mobile]").forEach((node) => {
      node.removeAttribute("hidden");
    });
    setMobileBarPadding(true);
  }

  function renderAddress() {
    const el = $("[data-shop-store-checkout-address]");
    if (!el) return;
    el.innerHTML = `${esc(DEMO_ADDRESS.name)}<br>${esc(DEMO_ADDRESS.phone)}<br>${esc(DEMO_ADDRESS.zip)}<br>${esc(DEMO_ADDRESS.address)}`;
  }

  function renderItems() {
    const wrap = $("[data-shop-store-checkout-items]");
    if (!wrap) return;
    wrap.innerHTML = state.lines
      .map(({ product, qty }) => {
        const unit = Data.resolveLineUnitPrice(product);
        const subtotal = unit * qty;
        const shopHref = Resolve?.shopStoreDetailHref?.(product.shopId) || "#";
        const seller = `<p class="tasful-market-checkout-item__seller shop-store-checkout-item__shop"><a href="${esc(shopHref)}">${esc(product.shopName || "店舗")}</a> · 店舗販売</p>`;
        return `<article class="tasful-market-checkout-item"><div class="tasful-market-checkout-item__img"><img src="${Data.escAttr(Data.resolvePrimaryImage(product))}" alt="" width="72" height="72" decoding="async"${Data.productImageOnErrorAttr()}></div><div class="tasful-market-checkout-item__body"><span class="tasful-market-checkout-item__condition">${esc(product.conditionLabel || "新品")}</span><h3 class="tasful-market-checkout-item__title">${esc(product.title)}</h3><p class="tasful-market-checkout-item__meta">数量: ${qty} · 単価 ${esc(Data.formatYenAmount(unit))}</p><p class="tasful-market-checkout-item__price">小計 ${esc(Data.formatYenAmount(subtotal))}</p>${seller}</div></article>`;
      })
      .join("");
  }

  function renderTotals() {
    const el = $("[data-shop-store-checkout-totals]");
    if (!el || !state.totals) return;
    const t = state.totals;
    el.innerHTML = `<div><dt>商品代金</dt><dd>${esc(Data.formatYenAmount(t.subtotal))}</dd></div><div><dt>送料</dt><dd>${esc(Data.formatYenAmount(t.shipping))}</dd></div><div><dt>手数料</dt><dd>${esc(Data.formatYenAmount(t.fee))}</dd></div><div class="is-total"><dt>合計金額</dt><dd>${esc(Data.formatYenAmount(t.total))}</dd></div>`;
    const text = `注文合計：${Data.formatYenAmount(t.total)}（税込）`;
    document.querySelectorAll("[data-shop-store-checkout-bar-summary]").forEach((node) => {
      node.textContent = text;
    });
  }

  function renderDeliveryInfo() {
    const wrap = $("[data-shop-store-checkout-delivery]");
    const Delivery = window.TasuShopStoreDeliveryInfo;
    if (!wrap || !Delivery?.renderCheckoutBlockHtml) return;

    const blocks = state.lines
      .map(({ product, qty }) => {
        const title = qty > 1 ? `${product.title}（数量 ${qty}）` : product.title;
        return Delivery.renderCheckoutBlockHtml(title, product);
      })
      .filter(Boolean);

    wrap.innerHTML = blocks.length
      ? blocks.join("")
      : `<p class="shop-store-delivery__empty">配送情報は商品ページでご確認ください。</p>`;
  }

  function getSelectedPayment() {
    const checked = document.querySelector('[data-shop-store-checkout-payment] input[name="payment"]:checked');
    return checked?.value || "card";
  }

  function confirmOrder() {
    if (!state.lines.length || !state.totals) return;
    const orderId = `TS-${Date.now().toString(36).toUpperCase()}`;
    Data.saveLastOrder({
      id: orderId,
      mode: state.mode,
      source: "store",
      channel: "shop_store",
      lines: state.lines.map(({ product, qty }) => ({
        shopId: product.shopId,
        productId: product.productId,
        title: product.title,
        qty,
        unitPrice: Data.resolveLineUnitPrice(product),
        image: product.image,
        shopName: product.shopName,
        connectVerified: product.connectVerified,
      })),
      totals: state.totals,
      payment: getSelectedPayment(),
      address: DEMO_ADDRESS,
      createdAt: new Date().toISOString(),
    });
    const historyEntries = Data.appendOrderHistory(Data.getLastOrder());
    try {
      window.TasuMarketEventStore?.recordCheckout?.(Data.getLastOrder(), historyEntries);
    } catch (err) {
      console.warn("[TasuShopStoreCheckout] market event skipped:", err);
    }
    try {
      window.TasfulMarketNotify?.onPurchaseEntries?.(historyEntries);
    } catch (err) {
      console.warn("[TasuShopStoreCheckout] notify skipped:", err);
    }
    Data.clearCart();
    window.location.href = "shop-store-complete.html";
  }

  function bindEvents() {
    document.querySelectorAll("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]").forEach((btn) => {
      btn.addEventListener("click", confirmOrder);
    });
    $("[data-shop-store-checkout-address-change]")?.addEventListener("click", () => {
      alert("お届け先の変更はデモ版では未対応です。");
    });
  }

  async function buildLines(pool, params) {
    if (params.mode === "buyNow") {
      if (!params.shopId || !params.productId) return [];
      if (Resolve?.buildCheckoutLinesBuyNow) {
        return Resolve.buildCheckoutLinesBuyNow(pool, params.shopId, params.productId, params.quantity);
      }
      return Data.buildCheckoutLinesBuyNow(pool, params.shopId, params.productId, params.quantity);
    }
    let lines = Resolve?.buildCheckoutLinesFromCart
      ? await Resolve.buildCheckoutLinesFromCart(pool)
      : Data.buildCheckoutLinesFromCart(pool);
    if (lines.length) return lines;

    const items = Data?.getCartItems?.() || [];
    const out = [];
    for (const item of items) {
      let product = Data.findProduct(pool, item.shopId, item.productId);
      if (!product && item.title) product = Resolve?.productFromCartSnapshot?.(item);
      if (!product && Resolve?.resolveShopStoreProduct) {
        product = await Resolve.resolveShopStoreProduct(item.shopId, item.productId);
      }
      if (!product) continue;
      if (Resolve?.mergeDeliveryOntoProduct) {
        product = await Resolve.mergeDeliveryOntoProduct(product, item.shopId, item.productId);
      } else {
        product = Data.enrichProductImage(product);
      }
      out.push({ product, qty: item.qty });
    }
    return out;
  }

  async function init() {
    if (document.body.dataset.page !== "shop_store_checkout") return;
    if (!Data) {
      setStatus("注文データの読み込みに失敗しました。", true);
      return;
    }

    bindEvents();
    renderAddress();

    const params = readParams();
    state.mode = params.mode;
    const pool = await Data.loadProductPool();
    state.lines = await buildLines(pool, params);

    if (!state.lines.length) {
      setStatus("注文する商品がありません。カートに商品を追加してください。", true);
      return;
    }

    state.totals = Data.calculateCheckoutTotals(state.lines);
    renderItems();
    renderDeliveryInfo();
    renderTotals();
    showCheckout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
