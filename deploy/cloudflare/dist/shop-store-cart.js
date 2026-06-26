(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;
  const Resolve = window.TasuShopStoreProductResolve;
  let pool = null;

  function cartLineCount(lines) {
    return lines.reduce((sum, { qty }) => sum + Math.max(1, Number(qty) || 1), 0);
  }

  async function buildCartLines() {
    Data.materializeLegacyCartItems?.(pool);
    let lines = Resolve?.buildCheckoutLinesFromCart
      ? Resolve.buildCheckoutLinesFromCart(pool)
      : Data.buildCheckoutLinesFromCart(pool);
    if (lines.length) return lines;

    const items = Data?.getCartItems?.() || [];
    const out = [];
    for (const item of items) {
      let product = pool && Data?.findProduct ? Data.findProduct(pool, item.shopId, item.productId) : null;
      if (!product && item.title && Resolve?.productFromCartSnapshot) product = Resolve.productFromCartSnapshot(item);
      if (!product && Resolve?.resolveShopStoreProduct) {
        product = await Resolve.resolveShopStoreProduct(item.shopId, item.productId);
      }
      if (!product) continue;
      out.push({ product: Data.enrichProductImage(product), qty: item.qty });
    }
    return out;
  }

  function buildCartItemHtml({ product, qty }) {
    const unit = Data.resolveLineUnitPrice(product);
    const shopHref = Resolve?.shopStoreDetailHref?.(product.shopId) || "#";
    const shopId = Data.escAttr(product.shopId);
    const productId = Data.escAttr(product.productId);
    const href = Data.escAttr(Data.productHref(product));
    return `<article class="tasful-market-cart-item" data-tasful-market-cart-item><a class="tasful-market-cart-item__img tasful-market-cart-item__img-link" href="${href}"><img src="${Data.escAttr(Data.resolvePrimaryImage(product))}" alt="${Data.escAttr(product.title)}" width="64" height="64" decoding="async"${Data.productImageOnErrorAttr()}></a><div class="tasful-market-cart-item__body"><p class="tasful-market-cart-item__title"><a class="tasful-market-cart-item__title-link" href="${href}">${Data.esc(product.title)}</a></p><div class="tasful-market-cart-item__foot"><p class="tasful-market-cart-item__meta">数量 ${qty} · ${Data.esc(Data.formatYenAmount(unit))}</p><button type="button" class="tasful-market-cart-item__remove" data-shop-store-cart-remove data-shop-id="${shopId}" data-product-id="${productId}">削除</button></div><p class="shop-store-checkout-item__shop"><a href="${Data.escAttr(shopHref)}">${Data.esc(product.shopName || "店舗")}</a></p></div></article>`;
  }

  async function renderCart() {
    const summary = document.querySelector("[data-shop-store-cart-summary]");
    const emptyEl = document.querySelector("[data-shop-store-cart-empty]");
    const itemsEl = document.querySelector("[data-shop-store-cart-items]");
    const checkoutBtn = document.querySelector("[data-shop-store-cart-checkout]");
    const aside = document.querySelector("[data-shop-store-cart-aside]");
    const asideCheckout = document.querySelector("[data-shop-store-cart-checkout-aside]");
    const subtotalEl = document.querySelector("[data-shop-store-cart-subtotal]");
    const totalEl = document.querySelector("[data-shop-store-cart-total]");
    const lineCountEl = document.querySelector("[data-shop-store-cart-line-count]");
    const mobileActions = document.querySelector(".tasful-market-cart-main__actions--mobile");

    if (!Data || !pool) return;

    const lines = await buildCartLines();
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
  }

  function bindEvents() {
    document.querySelector("[data-shop-store-cart-items]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-shop-store-cart-remove]");
      if (!btn || !Data?.removeCartLineItem) return;
      const shopId = btn.getAttribute("data-shop-id");
      const productId = btn.getAttribute("data-product-id");
      if (!shopId || !productId) return;
      if (Data.removeCartLineItem(shopId, productId)) void renderCart();
    });
  }

  async function init() {
    if (document.body.dataset.page !== "shop_store_cart") return;
    if (!Data) return;

    bindEvents();
    pool = await Data.loadProductPool();
    await renderCart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
