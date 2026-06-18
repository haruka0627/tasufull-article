(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;
  let pool = null;

  function cartLineCount(lines) {
    return lines.reduce((sum, { qty }) => sum + Math.max(1, Number(qty) || 1), 0);
  }

  function buildCartItemHtml({ product, qty }) {
    const unit = Data.resolveLineUnitPrice(product);
    const shopId = Data.escAttr(product.shopId);
    const productId = Data.escAttr(product.productId);
    const href = Data.escAttr(Data.productHref(product));
    return `<article class="tasful-market-cart-item" data-tasful-market-cart-item><a class="tasful-market-cart-item__img tasful-market-cart-item__img-link" href="${href}"><img src="${Data.escAttr(product.image)}" alt="${Data.escAttr(product.title)}" width="64" height="64" decoding="async"${Data.productImageOnErrorAttr()}></a><div class="tasful-market-cart-item__body"><p class="tasful-market-cart-item__title"><a class="tasful-market-cart-item__title-link" href="${href}">${Data.esc(product.title)}</a></p><div class="tasful-market-cart-item__foot"><p class="tasful-market-cart-item__meta">数量 ${qty} · ${Data.esc(Data.formatYenAmount(unit))}</p><button type="button" class="tasful-market-cart-item__remove" data-tasful-market-cart-remove data-shop-id="${shopId}" data-product-id="${productId}">削除</button></div></div></article>`;
  }

  function renderCrossSell(cartLines) {
    const section = document.querySelector("[data-tasful-market-cart-cross-sell]");
    const scroll = document.querySelector("[data-tasful-market-cart-cross-sell-scroll]");
    if (!section || !scroll || !Data?.getCartCrossSellProducts) return;

    const excludeIds = cartLines.map(({ product }) => product.id);
    const products = Data.getCartCrossSellProducts(pool, excludeIds, 6);
    if (!products.length) {
      section.hidden = true;
      scroll.innerHTML = "";
      return;
    }

    section.hidden = false;
    scroll.innerHTML = products.map((p) => Data.buildMiniCardHtml(p)).join("");
  }

  function renderCart() {
    const summary = document.querySelector("[data-tasful-market-cart-summary]");
    const emptyEl = document.querySelector("[data-tasful-market-cart-empty]");
    const itemsEl = document.querySelector("[data-tasful-market-cart-items]");
    const checkoutBtn = document.querySelector("[data-tasful-market-cart-checkout]");
    const aside = document.querySelector("[data-tasful-market-cart-aside]");
    const asideCheckout = document.querySelector("[data-tasful-market-cart-checkout-aside]");
    const subtotalEl = document.querySelector("[data-tasful-cart-subtotal]");
    const totalEl = document.querySelector("[data-tasful-cart-total]");
    const lineCountEl = document.querySelector("[data-tasful-cart-line-count]");
    const mobileActions = document.querySelector(".tasful-market-cart-main__actions--mobile");

    if (!Data || !pool) return;

    Data.materializeLegacyCartItems?.(pool);
    const lines = Data.buildCheckoutLinesFromCart(pool);
    const count = cartLineCount(lines);

    if (!lines.length) {
      if (summary) summary.textContent = "カートに商品がありません";
      if (emptyEl) emptyEl.hidden = false;
      if (itemsEl) {
        itemsEl.hidden = true;
        itemsEl.innerHTML = "";
      }
      if (checkoutBtn) checkoutBtn.hidden = true;
      if (aside) aside.hidden = true;
      if (asideCheckout) asideCheckout.hidden = true;
      if (mobileActions) mobileActions.hidden = true;
      renderCrossSell([]);
      window.TasfulMarketHeader?.updateCartBadge?.();
      window.TasfulMarketHeader?.syncHeaderOffset?.();
      return;
    }

    if (summary) summary.textContent = `カート内 ${count} 点の商品があります`;
    if (emptyEl) emptyEl.hidden = true;
    if (itemsEl) {
      itemsEl.hidden = false;
      itemsEl.innerHTML = lines.map(buildCartItemHtml).join("");
    }
    if (mobileActions) mobileActions.hidden = false;

    const subtotal = lines.reduce((sum, { product, qty }) => sum + Data.resolveLineUnitPrice(product) * qty, 0);
    const formatted = Data.formatYenAmount(subtotal);
    if (subtotalEl) subtotalEl.textContent = formatted;
    if (totalEl) totalEl.textContent = formatted;
    if (lineCountEl) lineCountEl.textContent = `${count}点`;
    if (aside) aside.hidden = false;
    if (checkoutBtn) checkoutBtn.hidden = false;
    if (asideCheckout) asideCheckout.hidden = false;

    renderCrossSell(lines);
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  function bindEvents() {
    document.querySelector("[data-tasful-market-cart-items]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tasful-market-cart-remove]");
      if (!btn || !Data?.removeCartLineItem) return;
      const shopId = btn.getAttribute("data-shop-id");
      const productId = btn.getAttribute("data-product-id");
      if (!shopId || !productId) return;
      if (Data.removeCartLineItem(shopId, productId)) renderCart();
    });
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_cart") return;
    if (!Data) return;

    bindEvents();
    pool = await Data.loadProductPool();
    renderCart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
