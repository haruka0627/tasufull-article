/**
 * TASFUL市場 — 注文確認
 */
(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

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
    const el = $("[data-tasful-checkout-status]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.style.color = isError ? "#b91c1c" : "#6b7280";
    $("[data-tasful-checkout-body]")?.setAttribute("hidden", "");
    $("[data-tasful-checkout-layout]")?.setAttribute("hidden", "");
    document.querySelectorAll("[data-tasful-checkout-bar], [data-tasful-checkout-bar-mobile]").forEach((el) => {
      el.setAttribute("hidden", "");
    });
    setMobileBarPadding(false);
  }

  function showCheckout() {
    $("[data-tasful-checkout-status]")?.setAttribute("hidden", "");
    $("[data-tasful-checkout-layout]")?.removeAttribute("hidden");
    $("[data-tasful-checkout-body]")?.removeAttribute("hidden");
    document.querySelectorAll("[data-tasful-checkout-bar], [data-tasful-checkout-bar-mobile]").forEach((el) => {
      el.removeAttribute("hidden");
    });
    setMobileBarPadding(true);
  }

  function renderAddress() {
    const el = $("[data-tasful-checkout-address]");
    if (!el) return;
    el.innerHTML = `${esc(DEMO_ADDRESS.name)}<br>${esc(DEMO_ADDRESS.phone)}<br>${esc(DEMO_ADDRESS.zip)}<br>${esc(DEMO_ADDRESS.address)}`;
  }

  function renderItems() {
    const wrap = $("[data-tasful-checkout-items]");
    if (!wrap) return;
    wrap.innerHTML = state.lines
      .map(({ product, qty }) => {
        const unit = Data.resolveLineUnitPrice(product);
        const subtotal = unit * qty;
        const connect = product.connectVerified
          ? `<p class="tasful-market-checkout-item__seller">${esc(product.shopName)} · ✓ Connect認証済み</p>`
          : `<p class="tasful-market-checkout-item__seller">${esc(product.shopName)}</p>`;
        return `<article class="tasful-market-checkout-item"><div class="tasful-market-checkout-item__img"><img src="${Data.escAttr(Data.resolvePrimaryImage(product))}" alt="" width="72" height="72" decoding="async"${Data.productImageOnErrorAttr()}></div><div class="tasful-market-checkout-item__body"><span class="tasful-market-checkout-item__condition">${esc(product.conditionLabel || "新品")}</span><h3 class="tasful-market-checkout-item__title">${esc(product.title)}</h3><p class="tasful-market-checkout-item__meta">数量: ${qty} · 単価 ${esc(Data.formatYenAmount(unit))}</p><p class="tasful-market-checkout-item__price">小計 ${esc(Data.formatYenAmount(subtotal))}</p>${connect}</div></article>`;
      })
      .join("");
    renderAsideSummary();
  }

  function renderAsideSummary() {
    const wrap = $("[data-tasful-checkout-aside-summary]");
    if (!wrap) return;
    wrap.innerHTML = state.lines
      .map(({ product, qty }) => {
        const unit = Data.resolveLineUnitPrice(product);
        const subtotal = unit * qty;
        return `<article class="tasful-market-checkout-aside-item"><div class="tasful-market-checkout-aside-item__img"><img src="${Data.escAttr(Data.resolvePrimaryImage(product))}" alt="" width="56" height="56" decoding="async"${Data.productImageOnErrorAttr()}></div><div class="tasful-market-checkout-aside-item__body"><p class="tasful-market-checkout-aside-item__shop">${esc(product.shopName || "店舗")}</p><h3 class="tasful-market-checkout-aside-item__title">${esc(product.title)}</h3><p class="tasful-market-checkout-aside-item__meta">数量 ${qty} · ${esc(Data.formatYenAmount(subtotal))}</p></div></article>`;
      })
      .join("");
  }

  function renderTotals() {
    const el = $("[data-tasful-checkout-totals]");
    if (!el || !state.totals) return;
    const t = state.totals;
    el.innerHTML = `<div><dt>商品代金</dt><dd>${esc(Data.formatYenAmount(t.subtotal))}</dd></div><div><dt>送料</dt><dd>${esc(Data.formatYenAmount(t.shipping))}</dd></div><div><dt>手数料</dt><dd>${esc(Data.formatYenAmount(t.fee))}</dd></div><div class="is-total"><dt>合計金額</dt><dd>${esc(Data.formatYenAmount(t.total))}</dd></div>`;
    renderBarSummary();
  }

  function renderBarSummary() {
    if (!state.totals) return;
    const text = `注文合計：${Data.formatYenAmount(state.totals.total)}（税込）`;
    document.querySelectorAll("[data-tasful-checkout-bar-summary]").forEach((el) => {
      el.textContent = text;
    });
  }

  function getSelectedPayment() {
    const checked = document.querySelector('[data-tasful-checkout-payment] input[name="payment"]:checked');
    return checked?.value || "card";
  }

  function confirmOrder() {
    if (!state.lines.length || !state.totals) return;
    const orderId = `TM-${Date.now().toString(36).toUpperCase()}`;
    Data.saveLastOrder({
      id: orderId,
      mode: state.mode,
      source: "market",
      channel: "shop_market",
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
      console.warn("[TasfulMarketCheckout] market event skipped:", err);
    }
    try {
      window.TasfulMarketNotify?.onPurchaseEntries?.(historyEntries);
    } catch (err) {
      console.warn("[TasfulMarketCheckout] notify skipped:", err);
    }
    Data.clearCart();
    window.location.href = "shop-market-complete.html";
  }

  function bindEvents() {
    document.querySelectorAll("[data-tasful-checkout-submit], [data-tasful-checkout-submit-aside]").forEach((btn) => {
      btn.addEventListener("click", confirmOrder);
    });
    $("[data-tasful-checkout-address-change]")?.addEventListener("click", () => {
      alert("お届け先の変更はデモ版では未対応です。");
    });
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_checkout") return;
    if (!Data) {
      setStatus("注文データの読み込みに失敗しました。", true);
      return;
    }

    bindEvents();
    renderAddress();

    const params = readParams();
    state.mode = params.mode;
    const pool = await Data.loadProductPool();

    if (params.mode === "buyNow") {
      if (!params.shopId || !params.productId) {
        setStatus("商品情報が不足しています。", true);
        return;
      }
      state.lines = Data.buildCheckoutLinesBuyNow(pool, params.shopId, params.productId, params.quantity);
    } else {
      state.lines = Data.buildCheckoutLinesFromCart(pool);
    }

    if (!state.lines.length) {
      setStatus("注文する商品がありません。カートに商品を追加してください。", true);
      return;
    }

    state.totals = Data.calculateCheckoutTotals(state.lines);
    renderItems();
    renderTotals();
    showCheckout();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
