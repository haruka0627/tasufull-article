/**
 * 店舗販売 — 商品解決（checkout / cart 用）
 * demo-* / p-* 両対応。TasfulMarketProductData のプール未登録時も店舗データから解決。
 */
(function () {
  "use strict";

  const SHOP_ID_ALIASES = {
    "demo-shop-kichi-dining": "demo-shop-kiichi-dining",
  };

  function resolveShopId(raw) {
    const id = String(raw || "").trim();
    return SHOP_ID_ALIASES[id] || id;
  }

  function parsePriceYen(raw) {
    return window.TasuShopCheckout?.parsePriceYen?.(raw) ?? window.TasfulMarketProductData?.parsePriceYen?.(raw) ?? 0;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function firstImageFromArray(val) {
    if (!Array.isArray(val) || !val.length) return "";
    const first = val[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") {
      return pickStr(first.url, first.src, first.image, first.image_url, first.product_image_url);
    }
    return "";
  }

  /** 商品画像URL — フィールド名の揺れを吸収 */
  function pickProductImageUrl(raw) {
    if (!raw || typeof raw !== "object") return "";
    const direct = pickStr(
      raw.product_image_url,
      raw.image_url,
      raw.image,
      raw.img,
      raw.main_image,
      raw.mainImage,
      raw.thumbnail_url,
      raw.thumbnail,
      raw.productImage
    );
    if (direct) return direct;
    return pickStr(
      firstImageFromArray(raw.product_image_urls),
      firstImageFromArray(raw.images),
      firstImageFromArray(raw.product_images),
      firstImageFromArray(raw.gallery)
    );
  }

  function categoryFallbackImage(shop) {
    const Config = window.TasuShopProductsConfig;
    const categoryKey =
      shop?.business_subcategory || shop?.form_data?.shop_store_category || shop?.shop_store_category || "retail";
    return Config?.getCategoryFallbackImage?.(categoryKey) || Config?.getBrandPlaceholderUri?.() || "";
  }

  function resolveShopStoreProductImage(raw, shop, ids) {
    const picked = pickProductImageUrl(raw);
    const Data = window.TasfulMarketProductData;
    const payload = {
      ...(raw && typeof raw === "object" ? raw : {}),
      shopId: ids?.shopId || raw?.shopId || "",
      productId: ids?.productId || raw?.productId || raw?.id || "",
      image: picked,
      image_url: picked || raw?.image_url || "",
      product_image_url: picked || raw?.product_image_url || "",
      img: picked || raw?.img || "",
    };
    if (Data?.enrichProductImage) {
      return Data.enrichProductImage(payload).image || categoryFallbackImage(shop);
    }
    if (Data?.resolvePrimaryImage) {
      return Data.resolvePrimaryImage(payload) || categoryFallbackImage(shop);
    }
    return picked || categoryFallbackImage(shop);
  }

  function normalizeShopProduct(raw, index, shop) {
    const title = String(raw?.title || raw?.product_name || "").trim();
    if (!title) return null;
    const priceStr = String(raw?.price || "").trim();
    const priceNum = parsePriceYen(priceStr);
    return {
      id: String(raw?.id || raw?.product_id || `p-${index}`),
      title,
      description: String(raw?.description || raw?.product_description || "").trim(),
      price: priceStr || (priceNum > 0 ? `¥${priceNum.toLocaleString("ja-JP")}` : "¥—"),
      priceNum,
      category: String(raw?.category || raw?.product_category || "").trim(),
      image: resolveShopStoreProductImage(raw, shop, {
        shopId: shop?.id,
        productId: raw?.id || raw?.product_id || `p-${index}`,
      }),
      stock: String(raw?.stock || raw?.stock_status || "").trim(),
      condition: String(raw?.condition || raw?.condition_state || "").trim(),
      delivery_method: String(raw?.delivery_method || "").trim(),
      shipping_estimate: String(raw?.shipping_estimate || "").trim(),
      shipping_fee: String(raw?.shipping_fee || "").trim(),
      handoff_method: String(raw?.handoff_method || "").trim(),
      return_policy: String(raw?.return_policy || "").trim(),
    };
  }

  function collectShopProducts(shop, shopId) {
    const buckets = [shop?.products, shop?.form_data?.products, shop?.category_extra?.shop_store?.products];
    const raw = [];
    buckets.forEach((list) => {
      if (Array.isArray(list)) raw.push(...list);
    });
    const categoryKey = shop?.business_subcategory || shop?.form_data?.shop_store_category || "retail";
    const fromShop = raw.map((r, i) => normalizeShopProduct(r, i, shop)).filter(Boolean);

    const demo = window.TasuShopProductsConfig?.getDemoProducts?.(categoryKey, shopId) || [];
    const fromDemo = demo.map((r, i) => normalizeShopProduct(r, i + fromShop.length, shop)).filter(Boolean);

    const seen = new Set();
    return [...fromShop, ...fromDemo].filter((p) => {
      const key = `${p.id}::${p.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function findShopProduct(products, productId) {
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
    return String(extra.shop_name || shop?.company_name || shop?.title || "店舗").trim() || "店舗";
  }

  function toCheckoutProduct(shopProduct, shop, shopId) {
    const Data = window.TasfulMarketProductData;
    const sid = resolveShopId(shopId);
    const pid = String(shopProduct.id || "").trim();
    const priceYen = shopProduct.priceNum > 0 ? shopProduct.priceNum : parsePriceYen(shopProduct.price);
    const base = {
      id: `${sid}::${pid}`,
      shopId: sid,
      productId: pid,
      title: shopProduct.title,
      price: shopProduct.price,
      priceYen,
      image: shopProduct.image,
      shopName: shopDisplayName(shop),
      conditionLabel: shopProduct.condition || "新品",
      connectVerified: Boolean(window.TasuShopPayout?.evaluatePurchase?.(shop)?.ok),
      freeShipping: true,
      hasImage: Boolean(shopProduct.image),
      delivery_method: shopProduct.delivery_method || "",
      shipping_estimate: shopProduct.shipping_estimate || "",
      shipping_fee: shopProduct.shipping_fee || "",
      handoff_method: shopProduct.handoff_method || "",
      return_policy: shopProduct.return_policy || "",
    };
    return Data?.enrichProductImage ? Data.enrichProductImage(base) : base;
  }

  function productFromCartSnapshot(item) {
    const Data = window.TasfulMarketProductData;
    const sid = resolveShopId(item?.shopId);
    const pid = String(item?.productId || "").trim();
    const base = {
      id: `${sid}::${pid}`,
      shopId: sid,
      productId: pid,
      title: item?.title || "商品",
      price: item?.price || "¥—",
      priceYen: parsePriceYen(item?.price),
      image: item?.image,
      shopName: item?.shopName || "店舗",
      conditionLabel: item?.conditionLabel || "新品",
      connectVerified: Boolean(item?.connectVerified),
      freeShipping: item?.freeShipping !== false,
      delivery_method: item?.delivery_method || "",
      shipping_estimate: item?.shipping_estimate || "",
      shipping_fee: item?.shipping_fee || "",
      handoff_method: item?.handoff_method || "",
      return_policy: item?.return_policy || "",
    };
    return Data?.enrichProductImage ? Data.enrichProductImage(base) : base;
  }

  async function resolveShopStoreProduct(shopId, productId) {
    const Data = window.TasfulMarketProductData;
    const sid = resolveShopId(shopId);
    const pid = String(productId || "").trim();
    if (!sid || !pid) return null;

    let product = null;
    if (Data?.loadProductPool) {
      const pool = await Data.loadProductPool();
      const fromPool = Data.findProduct(pool, sid, pid);
      if (fromPool) product = Data.enrichProductImage(fromPool);
    }

    const shop = await loadShop(sid);
    if (!shop && !product) return null;
    const products = shop ? collectShopProducts(shop, sid) : [];
    const hit = findShopProduct(products, pid);
    const shopProduct = hit ? toCheckoutProduct(hit, shop, sid) : null;

    if (product && shopProduct) {
      return { ...product, ...pickDeliveryFields(shopProduct) };
    }
    return product || shopProduct;
  }

  async function buildCheckoutLinesBuyNow(pool, shopId, productId, quantity) {
    const Data = window.TasfulMarketProductData;
    const sid = resolveShopId(shopId);
    const pid = String(productId || "").trim();
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1));

    let product = pool && Data?.findProduct ? Data.findProduct(pool, sid, pid) : null;
    if (!product) product = await resolveShopStoreProduct(sid, pid);
    else product = await mergeDeliveryOntoProduct(product, sid, pid);
    if (!product) return [];

    return [{ product: Data?.enrichProductImage ? Data.enrichProductImage(product) : product, qty }];
  }

  async function buildCheckoutLinesFromCart(pool) {
    const Data = window.TasfulMarketProductData;
    if (!Data?.buildCheckoutLinesFromCart) return [];
    const lines = Data.buildCheckoutLinesFromCart(pool);
    return enrichCheckoutLines(lines);
  }

  function shopStoreDetailHref(shopId) {
    const id = resolveShopId(shopId);
    return id ? `detail-shop-store.html?id=${encodeURIComponent(id)}` : "shop-vendors.html";
  }

  function pickDeliveryFields(product) {
    if (!product) return {};
    return {
      delivery_method: product.delivery_method || "",
      shipping_estimate: product.shipping_estimate || "",
      shipping_fee: product.shipping_fee || "",
      handoff_method: product.handoff_method || "",
      return_policy: product.return_policy || "",
    };
  }

  async function mergeDeliveryOntoProduct(product, shopId, productId) {
    const Data = window.TasfulMarketProductData;
    if (!product) return product;
    const resolved = await resolveShopStoreProduct(shopId, productId);
    if (!resolved) return product;
    const merged = { ...product, ...pickDeliveryFields(resolved) };
    return Data?.enrichProductImage ? Data.enrichProductImage(merged) : merged;
  }

  async function enrichCheckoutLines(lines) {
    const out = [];
    for (const line of lines || []) {
      const sid = line?.product?.shopId;
      const pid = line?.product?.productId;
      const product = await mergeDeliveryOntoProduct(line.product, sid, pid);
      out.push({ product, qty: line.qty });
    }
    return out;
  }

  window.TasuShopStoreProductResolve = {
    resolveShopId,
    pickProductImageUrl,
    resolveShopStoreProductImage,
    resolveShopStoreProduct,
    buildCheckoutLinesBuyNow,
    buildCheckoutLinesFromCart,
    shopStoreDetailHref,
    shopDisplayName,
    productFromCartSnapshot,
    mergeDeliveryOntoProduct,
    enrichCheckoutLines,
  };
})();
