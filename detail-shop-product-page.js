/**
 * 店舗商品詳細 — 購入する / 問い合わせる
 */
(function () {
  "use strict";

  const state = { shop: null, product: null, shopId: "", productId: "", purchase: null };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const SHOP_ID_ALIASES = {
    "demo-shop-kichi-dining": "demo-shop-kiichi-dining",
  };

  function resolveShopId(raw) {
    const id = String(raw || "").trim();
    return SHOP_ID_ALIASES[id] || id;
  }

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      shopId: resolveShopId(params.get("shopId") || params.get("shop_id") || ""),
      productId: String(params.get("productId") || params.get("product_id") || "").trim(),
    };
  }

  function parsePriceYen(raw) {
    return window.TasuShopCheckout?.parsePriceYen?.(raw) ?? 0;
  }

  function normalizeProduct(raw, index, shop) {
    if (window.TasuShopProductsPage?.normalizeProduct) {
      return window.TasuShopProductsPage.normalizeProduct(raw, index, "retail", shop);
    }
    const title = String(raw?.title || raw?.product_name || "").trim();
    if (!title) return null;
    const priceStr = String(raw?.price || "").trim();
    return {
      id: String(raw?.id || raw?.product_id || `p-${index}`),
      title,
      description: String(raw?.description || raw?.product_description || "").trim(),
      price: priceStr,
      priceNum: parsePriceYen(priceStr),
      category: String(raw?.category || raw?.product_category || "").trim(),
      image: String(raw?.image_url || raw?.product_image_url || raw?.image || "").trim(),
      stock: String(raw?.stock || raw?.stock_status || "").trim(),
      condition: String(raw?.condition || raw?.condition_state || "").trim(),
      soldOut: /売切|sold\s*out|在庫なし/i.test(String(raw?.stock || "")),
    };
  }

  function collectProducts(shop) {
    const buckets = [
      shop?.products,
      shop?.form_data?.products,
      shop?.category_extra?.shop_store?.products,
    ];
    const raw = [];
    buckets.forEach((list) => {
      if (Array.isArray(list)) raw.push(...list);
    });
    const categoryKey =
      shop?.business_subcategory ||
      shop?.form_data?.shop_store_category ||
      "retail";
    const fromShop = raw.map((r, i) => normalizeProduct(r, i, shop)).filter(Boolean);

    const demo =
      window.TasuShopProductsConfig?.getDemoProducts?.(categoryKey, state.shopId) || [];
    const fromDemo = demo.map((r, i) => normalizeProduct(r, i + fromShop.length, shop)).filter(Boolean);

    const seen = new Set();
    return [...fromShop, ...fromDemo].filter((p) => {
      const key = `${p.id}::${p.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function findProduct(products, productId) {
    const key = String(productId || "").trim();
    if (!key) return null;
    const byId = products.find((p) => String(p.id) === key);
    if (byId) return byId;
    const m = /^p-(\d+)$/.exec(key);
    if (m) return products[Number(m[1])] || null;
    return null;
  }

  async function loadShop(shopId) {
    if (window.TasuDetailShopStoreLoader?.fetchShopStoreDetailById) {
      return window.TasuDetailShopStoreLoader.fetchShopStoreDetailById(shopId);
    }
    if (window.TasuShopStoreDemo?.getById) {
      return window.TasuShopStoreDemo.getById(shopId);
    }
    return null;
  }

  function shopDisplayName(shop) {
    const extra = shop?.category_extra?.shop_store || shop?.form_data || {};
    return (
      String(extra.shop_name || shop?.company_name || shop?.title || "店舗").trim() || "店舗"
    );
  }

  function getQuantity() {
    return window.TasuShopCheckout?.clampQuantity?.($("[data-shop-product-qty]")?.value) ?? 1;
  }

  function setStatus(message, isError) {
    const el = $("[data-shop-product-status]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.style.color = isError ? "#b91c1c" : "#64748b";
  }

  function renderBreadcrumb(shop) {
    const shopId = state.shopId;
    const name = shopDisplayName(shop);
    const productsHref = shopId
      ? `shop-products.html?id=${encodeURIComponent(shopId)}`
      : "shop-store.html";
    const shopHref = shopId
      ? `detail-shop.html?id=${encodeURIComponent(shopId)}`
      : "shop-store.html";
    window.TasuCommonBreadcrumb?.setParentChain?.([
      { label: name, href: shopHref },
      { label: "商品一覧", href: productsHref },
    ]);
    window.TasuCommonBreadcrumb?.setCurrentLabel(state.product?.title || "商品");
  }

  function renderProduct() {
    const p = state.product;
    const shop = state.shop;
    if (!p) return;

    $("[data-shop-product-layout]")?.removeAttribute("hidden");
    $("[data-shop-product-status]")?.setAttribute("hidden", "");

    const img = $("[data-shop-product-image]");
    if (img) {
      img.src = p.image || "";
      img.alt = p.title;
    }

    const shopNameEl = $("[data-shop-product-shop-name]");
    if (shopNameEl) shopNameEl.textContent = shopDisplayName(shop);

    const titleEl = $("[data-shop-product-title]");
    if (titleEl) titleEl.textContent = p.title;

    const catEl = $("[data-shop-product-category]");
    if (catEl) {
      if (p.category) {
        catEl.textContent = p.category;
        catEl.hidden = false;
      } else {
        catEl.hidden = true;
      }
    }

    const priceEl = $("[data-shop-product-price]");
    if (priceEl) {
      const unit = p.priceNum > 0 ? window.TasuShopCheckout.formatYen(p.priceNum) : p.price || "要相談";
      priceEl.textContent = `${unit}（税込）`;
    }

    const meta = $("[data-shop-product-meta]");
    if (meta) {
      const chips = [];
      if (p.condition) chips.push(`<span class="shop-product-detail__chip">${esc(p.condition)}</span>`);
      if (p.stock) chips.push(`<span class="shop-product-detail__chip">${esc(p.stock)}</span>`);
      if (p.soldOut) chips.push(`<span class="shop-product-detail__chip">売り切れ</span>`);
      meta.innerHTML = chips.join("");
    }

    const descWrap = $("[data-shop-product-desc-wrap]");
    const descEl = $("[data-shop-product-description]");
    if (p.description && descEl) {
      descEl.textContent = p.description;
      descWrap?.removeAttribute("hidden");
    } else {
      descWrap?.setAttribute("hidden", "");
    }

    const inquiry = $("[data-shop-product-inquiry]");
    if (inquiry && window.TasuShopCheckout?.buildInquiryUrl) {
      inquiry.href = window.TasuShopCheckout.buildInquiryUrl(
        state.shopId,
        state.productId,
        p.title
      );
    }

    state.purchase = window.TasuShopPayout?.evaluatePurchase?.(shop) || { ok: false };

    const buyBtn = $("[data-shop-product-buy]");
    const payoutNote = $("[data-shop-product-payout-note]");
    if (buyBtn) {
      if (p.soldOut) {
        buyBtn.hidden = false;
        buyBtn.disabled = true;
        buyBtn.textContent = "売り切れ";
      } else if (!state.purchase.ok) {
        buyBtn.hidden = true;
        buyBtn.disabled = true;
      } else {
        buyBtn.hidden = false;
        buyBtn.disabled = false;
        buyBtn.textContent = "購入する";
      }
    }
    if (payoutNote) {
      if (!p.soldOut && !state.purchase.ok && state.purchase.reason) {
        payoutNote.hidden = false;
        payoutNote.textContent = state.purchase.reason;
      } else {
        payoutNote.hidden = true;
        payoutNote.textContent = "";
      }
    }

    renderBreadcrumb(shop);
    document.title = `${p.title} | ${shopDisplayName(shop)} | TASFUL`;
  }

  function goCheckout() {
    const p = state.product;
    if (!p || p.soldOut) return;

    if (!state.purchase?.ok) {
      alert(
        state.purchase?.reason ||
          window.TasuShopPayout?.PAYOUT_NOT_READY_MSG ||
          "この店舗は現在オンライン決済の準備中です。お問い合わせからご確認ください。"
      );
      return;
    }

    const qty = getQuantity();
    const price = p.priceNum > 0 ? p.priceNum : parsePriceYen(p.price);
    if (price < 1) {
      alert("この商品は価格未設定のため、お問い合わせからご相談ください。");
      return;
    }
    const url = window.TasuShopCheckout.buildCheckoutUrl({
      shopId: state.shopId,
      productId: state.productId,
      productName: p.title,
      price,
      quantity: qty,
    });
    window.location.href = url;
  }

  function mountContactActions() {
    const shop = state.shop;
    if (!shop) return;
    document.body.dataset.detailType = "shop_store";
    document.body.dataset.listingId = String(state.shopId || shop.id || "").trim();
    window.TasuContactActions?.mountForListing?.(shop);
  }

  function bindEvents() {
    $("[data-shop-product-buy]")?.addEventListener("click", () => goCheckout());

    $("[data-qty-minus]")?.addEventListener("click", () => {
      const input = $("[data-shop-product-qty]");
      if (!input) return;
      input.value = String(Math.max(1, getQuantity() - 1));
    });

    $("[data-qty-plus]")?.addEventListener("click", () => {
      const input = $("[data-shop-product-qty]");
      if (!input) return;
      input.value = String(Math.min(99, getQuantity() + 1));
    });
  }

  async function init() {
    const { shopId, productId } = readParams();
    state.shopId = shopId;
    state.productId = productId;

    if (!shopId || !productId) {
      setStatus("店舗または商品が指定されていません。", true);
      return;
    }

    setStatus("読み込み中…", false);
    bindEvents();

    const shop = await loadShop(shopId);
    if (!shop) {
      setStatus("店舗が見つかりませんでした。", true);
      return;
    }
    state.shop = shop;

    const products = collectProducts(shop);
    const product = findProduct(products, productId);
    if (!product) {
      setStatus("商品が見つかりませんでした。", true);
      return;
    }
    state.product = product;
    renderProduct();
    mountContactActions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
