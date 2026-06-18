/**
 * TASFUL市場 TOP — 商品中心の一覧（shop-store.html）
 */
(function () {
  "use strict";

  const CATEGORY_FILTERS = {
    food: /食品|食料|グルメ|スイーツ|food|gourmet|菓子|惣菜|お取り寄せ/i,
    daily: /日用品|生活用品|洗剤|ティッシュ|掃除|daily|life/i,
    goods: /雑貨|インテリア|goods|interior|ライフスタイル|北欧/i,
    appliance: /家電|電化|appliance|electronics|電動|工具/i,
    handmade: /ハンドメイド|手作り|handmade|craft|限定品/i,
  };

  const SERVICE_SHOP_PROFILE_KEYS = new Set([
    "beauty_salon",
    "relaxation",
    "repair_maintenance",
    "construction",
    "school",
    "life",
    "local_service",
  ]);

  const NEW_PRODUCT_LIMIT = 6;
  const SHELF_ITEM_COUNT_MOBILE = 10;
  const PC_STRIP_COUNT = 24;
  const PC_SHELF_VISIBLE = 7;
  const PC_FOR_YOU_COUNT = 6;
  const PC_RANKING_COUNT = 5;
  const PC_CONNECT_SHELF_COUNT = 7;
  const PC_QUAD_THUMB_COUNT = 4;
  const PC_HERO_PRODUCT_COUNT = 4;
  const PC_SHELF_MIN_VISIBLE = 7;
  const PC_MINI_RECENT_COUNT = 12;

  const PC_SPOTLIGHT_ITEMS = [
    {
      id: "season",
      label: "季節限定",
      sub: "今だけのおすすめ",
      href: "shop-search.html?sale=1",
      tone: "season",
      imageOffset: 0,
    },
    {
      id: "category",
      label: "人気カテゴリ",
      sub: "売れ筋をチェック",
      href: "shop-search.html",
      tone: "category",
      imageOffset: 4,
    },
    {
      id: "newshop",
      label: "新規出店",
      sub: "はじめての店舗",
      href: "shop-search.html?sort=new",
      tone: "new",
      imageOffset: 8,
    },
  ];
  const DUMMY_REVIEW_COUNTS = [18, 42, 89, 128, 214];
  const SALE_BADGES = ["10%OFF", "15%OFF", "20%OFF", "TIME SALE"];
  const DISCOUNT_BADGES = ["値下げ", "SALE", "特価"];

  const DEMO_CATALOG = [
    {
      shopId: "demo-shop-haru-cafe",
      productId: "p-0",
      title: "季節のパンケーキ",
      price: "¥1,280",
      image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7440?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 128,
    },
    {
      shopId: "demo-shop-sushi",
      productId: "p-0",
      title: "季節の刺身盛り",
      price: "¥2,200",
      image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 89,
    },
    {
      shopId: "demo-shop-bakery",
      productId: "p-0",
      title: "クロワッサン",
      price: "¥320",
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 214,
    },
    {
      shopId: "demo-shop-cafe",
      productId: "p-1",
      title: "スペシャルティコーヒー",
      price: "¥580",
      image: "https://images.unsplash.com/photo-1461023058943-07fcbeecadfb?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.9,
      reviewCount: 312,
    },
    {
      shopId: "demo-shop-sweets",
      productId: "p-0",
      title: "焼き菓子ギフト",
      price: "¥1,680",
      image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.5,
      reviewCount: 42,
    },
    {
      shopId: "demo-shop-craft",
      productId: "p-0",
      title: "ハンドメイドトート",
      price: "¥3,980",
      image: "https://images.unsplash.com/photo-1590874103328-eacfd0ef4358?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 18,
    },
    {
      shopId: "demo-shop-local",
      productId: "p-0",
      title: "地域限定お土産ボックス",
      price: "¥2,480",
      image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.4,
      reviewCount: 56,
    },
    {
      shopId: "demo-shop-home",
      productId: "p-0",
      title: "北欧風マグカップ",
      price: "¥1,980",
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.3,
      reviewCount: 73,
    },
    {
      shopId: "demo-shop-tool",
      productId: "p-0",
      title: "電動ドライバーセット",
      price: "¥4,980",
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 95,
    },
    {
      shopId: "demo-shop-season",
      productId: "p-0",
      title: "春のフラワーギフト",
      price: "¥2,680",
      image: "https://images.unsplash.com/photo-1490750967868-88d448d64e7e?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 64,
    },
  ];

  window.__tasfulMarketImgError = function (img) {
    const card = img?.closest?.(".tasful-market-card");
    if (card) card.remove();
  };

  window.__tasfulMarketThumbImgError = function (img) {
    const thumb = img?.closest?.(
      ".tasful-market-pc-mini-thumb, .tasful-market-pc-quad__thumb, .sub-product-card, .hero-feature"
    );
    if (thumb) {
      const card = thumb.closest(".tasful-market-pc-quad__card, .tasful-market-pc-hero-full");
      thumb.remove();
      if (card?.classList.contains("tasful-market-pc-quad__card")) {
        if (card.querySelectorAll(".tasful-market-pc-quad__thumb").length < 4) card.hidden = true;
      }
      return;
    }
    const shelfCard = img?.closest?.(".tasful-market-pc-shelf-card");
    if (shelfCard) shelfCard.remove();
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function normalizeBusinessType(listing) {
    return String(
      listing?.business_type || listing?.business_category || listing?.listing_type || listing?.type || ""
    ).trim();
  }

  function getListingCategoryKey(listing) {
    return String(
      listing?.business_subcategory ||
        listing?.shop_category ||
        listing?.shop_store_category ||
        listing?.form_data?.shop_store_category ||
        listing?.categoryProfile ||
        ""
    ).trim();
  }

  function isRetailShopListing(listing) {
    const key = getListingCategoryKey(listing);
    if (SERVICE_SHOP_PROFILE_KEYS.has(key)) return false;
    if (key === "construction") return false;
    return true;
  }

  function applyStoreCategoryFields(listing) {
    const copy = { ...listing };
    const key = getListingCategoryKey(copy);
    copy.business_subcategory = key || copy.business_subcategory;
    return copy;
  }

  async function fetchShopListings() {
    const store = window.TasuBusinessListings;
    let items = [];
    if (store?.fetchPublishedBusinessListings) {
      items = await store.fetchPublishedBusinessListings({
        limit: 200,
        business_category: "",
        public_only: false,
        localFallback: true,
      });
    }
    const shopDemo = window.TasuShopStoreDemo?.getListings?.() || [];
    const otherDemos = window.TasuListingLocalStore?.getShopStoreOtherDemosForListPage?.() || [];
    const shopDemoIds = new Set([
      ...shopDemo.map((d) => String(d.id)),
      ...otherDemos.map((d) => String(d.id)),
    ]);
    const boardDemo = (window.TasuBusinessBoardDemo?.getListings?.("") || []).filter((it) => {
      if (normalizeBusinessType(it) !== "shop_store") return false;
      const id = String(it?.id || "").trim();
      if (!id || shopDemoIds.has(id)) return false;
      return true;
    });
    const merged = [...otherDemos, ...shopDemo, ...boardDemo, ...items];
    const seen = new Set();
    return merged
      .filter((it) => {
        const id = String(it?.id || "").trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        if (normalizeBusinessType(it) !== "shop_store") return false;
        return isRetailShopListing(it);
      })
      .map((it) => applyStoreCategoryFields(it));
  }

  function resolveShopId(listing) {
    const primary = String(listing?.id || "").trim();
    const demoRef = String(listing?.demo_id || listing?.form_data?.demo_id || "").trim();
    const loader = window.TasuDetailShopStoreLoader;
    const resolvedPrimary = loader?.resolveShopListingId?.(primary) || primary;
    if (window.TasuShopStoreDemo?.getById?.(resolvedPrimary)) return resolvedPrimary;
    const resolvedDemo = loader?.resolveShopListingId?.(demoRef) || demoRef;
    if (resolvedDemo && window.TasuShopStoreDemo?.getById?.(resolvedDemo)) return resolvedDemo;
    return resolvedPrimary || resolvedDemo;
  }

  function shippingLabel() {
    return "送料無料";
  }

  function normalizePriceBase(priceStr) {
    let base = String(priceStr || "").trim();
    if (!base || base === "¥—") return base;
    let prev = "";
    while (prev !== base) {
      prev = base;
      base = base
        .replace(/\s*[（(]\s*税込\s*[）)]\s*/gi, "")
        .replace(/\s*税込\s*/gi, "")
        .trim();
    }
    return base;
  }

  function formatPriceDisplay(priceStr) {
    const base = normalizePriceBase(priceStr);
    if (!base || base === "¥—") return "¥—";
    return `${base} <span class="tasful-market-card__price-tax">(税込)</span>`;
  }

  function parsePriceYen(priceStr) {
    const digits = String(priceStr || "").replace(/[^\d]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function formatYen(amount) {
    return `¥${amount.toLocaleString("ja-JP")}`;
  }

  function computeWasPriceYen(saleYen) {
    return Math.round(saleYen / 0.9);
  }

  function formatTimesalePriceDisplay(priceStr) {
    const saleYen = parsePriceYen(priceStr);
    if (!saleYen) return formatPriceDisplay(priceStr);
    const wasYen = computeWasPriceYen(saleYen);
    return `<span class="tasful-market-card__price-was">${formatYen(wasYen)}</span> <span class="tasful-market-card__price-sale">${formatYen(saleYen)} <span class="tasful-market-card__price-tax">(税込)</span></span>`;
  }

  function shipDaysLabel(product) {
    const blob = `${product?.stock || ""} ${product?.tag || ""} ${product?.fast_ship || ""}`;
    if (/即日|当日|fast/i.test(blob)) return "即日〜1日で発送";
    return "1〜3日以内に発送";
  }

  function formatRating(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "★4.5";
    return `★${n.toFixed(1)}`;
  }

  function resolveReviewCount(product, shop, shopId, index) {
    const count = Number(
      product?.review_count || product?.reviews || shop?.review_count || shop?.reviews || 0
    );
    if (Number.isFinite(count) && count > 0) return count;
    const seed = String(`${shopId}::p-${index}`)
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return DUMMY_REVIEW_COUNTS[seed % DUMMY_REVIEW_COUNTS.length];
  }

  function formatRatingLabel(rating, reviewCount) {
    return `${formatRating(rating)} (${reviewCount})`;
  }

  function resolveProductImageFields(product) {
    const image = String(product?.image || product?.image_url || product?.img || "").trim();
    const thumbnail = String(product?.thumbnail || product?.thumb || product?.thumbnail_url || "").trim();
    const mainImage = String(
      product?.mainImage || product?.main_image || product?.product_image_url || ""
    ).trim();
    const url = image || thumbnail || mainImage;
    return { image: url, hasImage: Boolean(url) };
  }

  function productCategoryBlob(product, shop, title) {
    const catLabel =
      window.TasuShopDetailCategory?.resolveCategoryLabel?.(shop) ||
      window.TasuShopDetailCategory?.getCategoryLabel?.(shop) ||
      "";
    return [
      product?.product_category,
      product?.category,
      getListingCategoryKey(shop),
      catLabel,
      shop?.title,
      shop?.shop_name,
      title,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function matchesCategory(product, categoryId) {
    if (!categoryId || categoryId === "all") return true;
    const pattern = CATEGORY_FILTERS[categoryId];
    if (!pattern) return true;
    return pattern.test(product.categoryBlob || "");
  }

  function flattenProducts(listings) {
    const out = [];
    listings.forEach((shop) => {
      const shopId = resolveShopId(shop);
      const products = shop?.products || shop?.form_data?.products || [];
      const createdAt = shop?.created_at || shop?.updated_at || "";
      products.forEach((p, index) => {
        const title = String(p?.title || p?.product_name || "").trim();
        if (!title) return;
        const { image, hasImage } = resolveProductImageFields(p);
        if (!hasImage) return;
        const ratingScore = Number(shop?.rating || shop?.review_score || 4.5);
        const reviewCount = resolveReviewCount(p, shop, shopId, index);
        out.push({
          id: `${shopId}::p-${index}`,
          shopId,
          productId: `p-${index}`,
          title,
          price: String(p?.price || "").trim() || "¥—",
          image,
          hasImage,
          categoryBlob: productCategoryBlob(p, shop, title),
          shipping: shippingLabel(),
          ratingScore,
          ratingLabel: formatRatingLabel(ratingScore, reviewCount),
          shipDays: shipDaysLabel(p),
          createdAt,
          featured: Boolean(shop?.featured),
          connectVerified: Boolean(shop?.connect_verified || shop?.connectVerified || shop?.featured),
          reviewCount,
        });
      });
    });
    return out;
  }

  function productHref(product) {
    return `detail-shop-product.html?shopId=${encodeURIComponent(product.shopId)}&productId=${encodeURIComponent(product.productId)}`;
  }

  function rankBadgeHtml(rank) {
    if (!rank) return "";
    const cls =
      rank === 1 ? "tasful-market-card__rank--1" : rank === 2 ? "tasful-market-card__rank--2" : rank === 3 ? "tasful-market-card__rank--3" : "";
    return `<span class="tasful-market-card__rank ${cls}">${rank}</span>`;
  }

  function imageBlockHtml(productOrUrl) {
    const Data = window.TasfulMarketProductData;
    const src =
      typeof productOrUrl === "object"
        ? Data?.resolvePrimaryImage?.(productOrUrl) || productOrUrl?.image
        : productOrUrl;
    const url = String(src || "").trim();
    const onErr = Data?.productImageOnErrorAttr?.() || ' onerror="window.__tasfulMarketImgError?.(this)"';
    return `<div class="tasful-market-card__img"><img src="${escAttr(url)}" alt="" loading="lazy" decoding="async" width="300" height="300"${onErr}></div>`;
  }

  function tagBadgeHtml(tag) {
    if (!tag) return "";
    const cls =
      tag.type === "sale"
        ? "tasful-market-card__tag--sale"
        : tag.type === "connect"
          ? "tasful-market-card__tag--connect"
          : "tasful-market-card__tag--discount";
    return `<span class="tasful-market-card__tag ${cls}">${esc(tag.label)}</span>`;
  }

  function buildCardHtml(product, options) {
    const rank = options?.rank || null;
    const tag = options?.tag || null;
    const timesalePrice = Boolean(options?.timesalePrice);
    const rankHtml = rankBadgeHtml(rank);
    const tagHtml = tagBadgeHtml(tag);
    const priceHtml = timesalePrice ? formatTimesalePriceDisplay(product.price) : formatPriceDisplay(product.price);
    const priceCls = timesalePrice ? " tasful-market-card__price--timesale" : "";
    return `<a class="tasful-market-card" href="${escAttr(productHref(product))}">${rankHtml}${tagHtml}${imageBlockHtml(product)}<div class="tasful-market-card__body"><h3 class="tasful-market-card__title">${esc(product.title)}</h3><p class="tasful-market-card__price${priceCls}">${priceHtml}</p><p class="tasful-market-card__shipping">${esc(product.shipping)}</p><p class="tasful-market-card__meta"><span>${esc(product.ratingLabel)}</span><span class="tasful-market-card__meta-sep" aria-hidden="true">｜</span><span>${esc(product.shipDays)}</span></p></div></a>`;
  }

  function sortByDate(products) {
    return [...products].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  function sortByPopularity(products) {
    return [...products].sort((a, b) => {
      const ra = Number(a.ratingScore) || 0;
      const rb = Number(b.ratingScore) || 0;
      if (rb !== ra) return rb - ra;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    });
  }

  function demoToProduct(item, index) {
    const ratingScore = Number(item.ratingScore) || 4.5;
    const reviewCount = Number(item.reviewCount) || DUMMY_REVIEW_COUNTS[index % DUMMY_REVIEW_COUNTS.length];
    return {
      id: `demo-${index}`,
      shopId: item.shopId,
      productId: item.productId,
      title: item.title,
      price: item.price,
      image: item.image,
      hasImage: true,
      categoryBlob: item.title,
      shipping: shippingLabel(),
      ratingScore,
      ratingLabel: formatRatingLabel(ratingScore, reviewCount),
      shipDays: "1〜3日以内に発送",
      createdAt: new Date().toISOString(),
      featured: index < 3,
      connectVerified: index < 6,
      reviewCount,
    };
  }

  function buildDemoPool(baseProducts) {
    const pool = onlyWithImages(baseProducts).map((p) => ({ ...p }));
    if (!pool.length) {
      DEMO_CATALOG.forEach((item, i) => pool.push(demoToProduct(item, i)));
    }
    let i = 0;
    while (pool.length < 30) {
      const src = pool[i % pool.length];
      pool.push({ ...src, id: `${src.id || src.shopId}::dup-${pool.length}` });
      i += 1;
    }
    return pool;
  }

  function pickShelfProducts(pool, offset, count) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(pool[(offset + i) % pool.length]);
    }
    return out;
  }

  function onlyWithImages(products) {
    return products.filter((p) => p.hasImage && String(p.image || "").trim());
  }

  const PC_MINI_IMAGE_URLS = [
    "images/demo-ranking/popular-01.jpg",
    "images/demo-ranking/popular-02.jpg",
    "images/demo-ranking/popular-03.jpg",
    "images/demo-ranking/popular-04.jpg",
    "images/demo-ranking/popular-05.jpg",
    "images/demo-ranking/product-01.jpg",
    "images/demo-ranking/product-02.jpg",
    "images/demo-ranking/product-03.jpg",
    "images/demo-ranking/product-04.jpg",
    "images/demo-ranking/product-05.jpg",
    "images/demo-ranking/new-01.jpg",
    "images/demo-ranking/new-02.jpg",
    "images/demo-ranking/new-03.jpg",
    "images/demo-ranking/new-04.jpg",
    "images/demo-ranking/new-05.jpg",
    "images/demo-ranking/rank-01.jpg",
    "images/demo-ranking/rank-02.jpg",
    "images/demo-ranking/rank-03.jpg",
    "images/demo-ranking/rank-04.jpg",
    "images/demo-ranking/rank-05.jpg",
    "images/demo-ranking/skill-01.jpg",
    "images/demo-ranking/skill-02.jpg",
    "images/demo-ranking/skill-03.jpg",
    "images/demo-ranking/skill-04.jpg",
    "images/demo-ranking/skill-05.jpg",
  ];

  function demoImagePoolForMini() {
    return PC_MINI_IMAGE_URLS.map((image, index) => {
      const base = DEMO_CATALOG[index % DEMO_CATALOG.length];
      const product = demoToProduct(base, index);
      return { ...product, image, hasImage: true };
    });
  }

  function pcImageCandidates(pool, offset, count) {
    const local = demoImagePoolForMini();
    const rotated = [...local.slice(offset % local.length), ...local.slice(0, offset % local.length)];
    return rotated.slice(0, Math.max(count * 3, local.length));
  }

  function quadThumbHtml(product) {
    const price = formatPriceDisplay(product.price);
    const ship = esc(product.shipping || shippingLabel());
    const rating = esc(product.ratingLabel || "");
    const meta = rating ? `${ship} · ${rating}` : ship;
    return `<span class="tasful-market-pc-quad__thumb"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="140" height="140" onerror="window.__tasfulMarketThumbImgError?.(this)"><span class="tasful-market-pc-quad__thumb-label">${esc(product.title)}</span><span class="tasful-market-pc-quad__thumb-price">${price}</span><span class="tasful-market-pc-quad__thumb-meta">${meta}</span></span>`;
  }

  function testImageLoad(url) {
    return new Promise((resolve) => {
      const src = String(url || "").trim();
      if (!src) {
        resolve(false);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  async function filterLoadableProducts(products, count) {
    const unique = [];
    const seen = new Set();
    for (const product of products) {
      const url = String(product?.image || "").trim();
      if (!product?.hasImage || !url || /undefined|null/i.test(url) || seen.has(url)) continue;
      if (await testImageLoad(url)) {
        seen.add(url);
        unique.push(product);
      }
    }
    if (!unique.length || !count) return [];
    const out = [];
    for (let i = 0; i < count; i++) {
      const base = unique[i % unique.length];
      out.push(i < unique.length ? base : { ...base, id: `${base.id || base.title}-dup-${i}` });
    }
    return out;
  }

  function renderSection(container, products, layout, options) {
    if (!container) return;
    const cls =
      layout === "grid"
        ? "tasful-market-grid"
        : layout === "compact-grid"
          ? "tasful-market-pc-compact-grid"
          : layout === "compact-wide"
            ? "tasful-market-pc-compact-grid tasful-market-pc-compact-grid--wide"
            : "tasful-market-scroll";
    const list = onlyWithImages(
      products.length
        ? products
        : pickShelfProducts(
            DEMO_CATALOG.map((item, i) => demoToProduct(item, i)),
            0,
            6
          )
    );
    const withRank = Boolean(options?.withRank);
    const tagType = options?.tagType || null;
    container.innerHTML = `<div class="${cls}">${list
      .map((product, index) => {
        const cardOptions = { rank: withRank ? index + 1 : null };
        if (options?.timesalePrice) cardOptions.timesalePrice = true;
        if (tagType === "sale") {
          cardOptions.tag = { type: "sale", label: SALE_BADGES[index % SALE_BADGES.length] };
        } else if (tagType === "connect") {
          cardOptions.tag = { type: "connect", label: "Connect認証" };
        } else if (tagType === "discount") {
          cardOptions.tag = { type: "discount", label: DISCOUNT_BADGES[index % DISCOUNT_BADGES.length] };
        }
        return buildCardHtml(product, cardOptions);
      })
      .join("")}</div>`;
  }

  async function renderPcHeroFull(container, candidates) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-hero-full");
    const list = await filterLoadableProducts(candidates, PC_HERO_PRODUCT_COUNT);
    if (list.length < PC_HERO_PRODUCT_COUNT) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    const main = list[0];
    const subs = list.slice(1, 4);
    const priceHtml = formatTimesalePriceDisplay(main.price);
    container.innerHTML = `<a class="hero-feature" href="${escAttr(productHref(main))}">
        <span class="hero-feature__img"><img src="${escAttr(main.image)}" alt="" loading="lazy" decoding="async" width="480" height="320" onerror="window.__tasfulMarketThumbImgError?.(this)"></span>
        <span class="hero-feature__body">
          <span class="hero-feature__text-scrim">
            <span class="hero-feature__title">${esc(main.title)}</span>
            <span class="hero-feature__price">${priceHtml}</span>
          </span>
        </span>
      </a>
      <div class="hero-sub-row">${subs
        .map(
          (product) =>
            `<a class="sub-product-card" href="${escAttr(productHref(product))}"><span class="sub-product-card__media"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="160" height="120" onerror="window.__tasfulMarketThumbImgError?.(this)"><span class="sub-product-card__scrim" aria-hidden="true"></span><span class="sub-product-card__copy"><span>${esc(product.title)}</span><strong>${formatPriceDisplay(product.price)}</strong></span></span></a>`
        )
        .join("")}</div>`;
  }

  async function renderPcQuadCard(thumbsEl, candidates) {
    if (!thumbsEl) return;
    const card = thumbsEl.closest(".tasful-market-pc-quad__card");
    const list = await filterLoadableProducts(candidates, PC_QUAD_THUMB_COUNT);
    if (list.length < PC_QUAD_THUMB_COUNT) {
      if (card) card.hidden = true;
      thumbsEl.innerHTML = "";
      return;
    }
    if (card) card.hidden = false;
    thumbsEl.innerHTML = list.map((product) => quadThumbHtml(product)).join("");
  }

  function pcShelfCardHtml(product, options) {
    const rank = options?.rank || null;
    const connectBadge = options?.connectBadge ? pcConnectBadgeHtml() : "";
    const rankHtml = rank ? pcShelfRankBadgeHtml(rank) : "";
    return `<a class="tasful-market-pc-shelf-card${rank ? " tasful-market-pc-shelf-card--ranked" : ""}${options?.connectBadge ? " tasful-market-pc-shelf-card--connect" : ""}" href="${escAttr(productHref(product))}">${rankHtml}${connectBadge}<span class="tasful-market-pc-shelf-card__img"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="180" height="180" onerror="window.__tasfulMarketThumbImgError?.(this)"></span><span class="tasful-market-pc-shelf-card__body"><span class="tasful-market-pc-shelf-card__title">${esc(product.title)}</span><span class="tasful-market-pc-shelf-card__price">${formatPriceDisplay(product.price)}</span><span class="tasful-market-pc-shelf-card__ship">${esc(product.shipping || "")}</span><span class="tasful-market-pc-shelf-card__rating">${esc(product.ratingLabel || "")}</span></span></a>`;
  }

  function pcHeroShelfCardHtml(product) {
    return `<a class="tasful-market-pc-hero-shelf-card" href="${escAttr(productHref(product))}"><span class="tasful-market-pc-hero-shelf-card__img"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="220" height="260" onerror="window.__tasfulMarketThumbImgError?.(this)"></span><span class="tasful-market-pc-hero-shelf-card__body"><span class="tasful-market-pc-hero-shelf-card__title">${esc(product.title)}</span><span class="tasful-market-pc-hero-shelf-card__price">${formatPriceDisplay(product.price)}</span><span class="tasful-market-pc-hero-shelf-card__rating">${esc(product.ratingLabel || "")}</span></span></a>`;
  }

  function pcShelfRankBadgeHtml(rank) {
    const cls =
      rank === 1
        ? "tasful-market-pc-shelf-card__rank--1"
        : rank === 2
          ? "tasful-market-pc-shelf-card__rank--2"
          : rank === 3
            ? "tasful-market-pc-shelf-card__rank--3"
            : "";
    return `<span class="tasful-market-pc-shelf-card__rank ${cls}">${rank}位</span>`;
  }

  function pcConnectBadgeHtml() {
    return `<span class="tasful-market-pc-shelf-card__connect-badge">✓ Connect</span>`;
  }

  async function renderShelfStrip(container, products) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    const list = await filterLoadableProducts(
      pcImageCandidates(products.length ? products : [], 0, PC_STRIP_COUNT),
      PC_STRIP_COUNT
    );
    if (list.length < PC_SHELF_MIN_VISIBLE) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-shelf-scroll">${list
      .map((product) => pcShelfCardHtml(product))
      .join("")}</div>`;
  }

  async function renderForYouHeroShelf(container, products) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    const list = await filterLoadableProducts(
      pcImageCandidates(products.length ? products : [], 0, PC_FOR_YOU_COUNT + 2),
      PC_FOR_YOU_COUNT
    );
    if (list.length < 4) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-hero-shelf">${list
      .slice(0, PC_FOR_YOU_COUNT)
      .map((product) => pcHeroShelfCardHtml(product))
      .join("")}</div>`;
  }

  async function renderSpotlightStrip(container, pool) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    const images = await filterLoadableProducts(pcImageCandidates(pool, 0, 12), 3);
    if (images.length < 3) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-spotlight">${PC_SPOTLIGHT_ITEMS.map((item, index) => {
      const img = images[index]?.image || images[0].image;
      return `<a class="tasful-market-pc-spotlight-card tasful-market-pc-spotlight-card--${escAttr(item.tone)}" href="${escAttr(item.href)}"><span class="tasful-market-pc-spotlight-card__img"><img src="${escAttr(img)}" alt="" loading="lazy" decoding="async" width="400" height="240"></span><span class="tasful-market-pc-spotlight-card__overlay"></span><span class="tasful-market-pc-spotlight-card__copy"><span class="tasful-market-pc-spotlight-card__label">${esc(item.label)}</span><span class="tasful-market-pc-spotlight-card__sub">${esc(item.sub)}</span></span></a>`;
    }).join("")}</div>`;
  }

  function pcRankingCardHtml(product, rank) {
    const isFirst = rank === 1;
    const rankTone =
      rank === 1 ? "tasful-market-pc-ranking-card__rank--1" : rank === 2 ? "tasful-market-pc-ranking-card__rank--2" : rank === 3 ? "tasful-market-pc-ranking-card__rank--3" : "";
    const rankCls = isFirst ? " tasful-market-pc-ranking-card--rank-1 ranking-card--rank-1" : "";
    return `<a class="tasful-market-pc-ranking-card ranking-card${rankCls}" href="${escAttr(productHref(product))}"><span class="tasful-market-pc-ranking-card__rank ${rankTone}">${rank}位</span><span class="tasful-market-pc-ranking-card__img"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="180" height="${isFirst ? 210 : 180}" onerror="window.__tasfulMarketThumbImgError?.(this)"></span><span class="tasful-market-pc-ranking-card__body"><span class="tasful-market-pc-ranking-card__title">${esc(product.title)}</span><span class="tasful-market-pc-ranking-card__price">${formatPriceDisplay(product.price)}</span><span class="tasful-market-pc-ranking-card__ship">${esc(product.shipping || "")}</span><span class="tasful-market-pc-ranking-card__rating">${esc(product.ratingLabel || "")}</span></span></a>`;
  }

  async function renderRankingShelf(container, products) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    const list = await filterLoadableProducts(
      pcImageCandidates(products.length ? products : [], 0, PC_RANKING_COUNT + 2),
      PC_RANKING_COUNT
    );
    if (list.length < 3) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-ranking-grid ranking-grid">${list
      .slice(0, PC_RANKING_COUNT)
      .map((product, index) => pcRankingCardHtml(product, index + 1))
      .join("")}</div>`;
  }

  function wireConnectScrollStage(container) {
    const stage = container?.querySelector?.("[data-tasful-connect-scroll-stage]");
    const scroll = stage?.querySelector(".tasful-market-pc-shelf-scroll--connect");
    const prev = stage?.querySelector(".tasful-market-pc-connect-scroll-btn--prev");
    const next = stage?.querySelector(".tasful-market-pc-connect-scroll-btn--next");
    if (!scroll || !prev || !next) return;

    const step = () => {
      const card = scroll.querySelector(".tasful-market-pc-shelf-card");
      if (!card) return Math.max(196, Math.round(scroll.clientWidth * 0.85));
      const gap = parseFloat(getComputedStyle(scroll).columnGap || getComputedStyle(scroll).gap || "16") || 16;
      return card.getBoundingClientRect().width + gap;
    };

    const sync = () => {
      const atStart = scroll.scrollLeft <= 4;
      const atEnd = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 6;
      prev.hidden = atStart;
      next.hidden = atEnd;
      stage.classList.toggle("tasful-market-pc-connect-scroll-stage--at-start", atStart);
      stage.classList.toggle("tasful-market-pc-connect-scroll-stage--at-end", atEnd);
    };

    prev.addEventListener("click", () => {
      scroll.scrollBy({ left: -step(), behavior: "smooth" });
    });
    next.addEventListener("click", () => {
      scroll.scrollBy({ left: step(), behavior: "smooth" });
    });
    scroll.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    sync();
  }

  async function renderConnectTrustShelf(container, products) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    /* Connect ヘッダーは shop-store.html 側の3行構成（title+link / lead / intro） */
    const connectFirst = [...products].sort((a, b) => Number(b.connectVerified) - Number(a.connectVerified));
    const list = await filterLoadableProducts(
      pcImageCandidates(connectFirst.length ? connectFirst : [], 0, PC_CONNECT_SHELF_COUNT + 4),
      PC_CONNECT_SHELF_COUNT
    );
    if (list.length < 4) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-connect-scroll-stage" data-tasful-connect-scroll-stage>
      <button type="button" class="tasful-market-pc-connect-scroll-btn tasful-market-pc-connect-scroll-btn--prev" aria-label="前のConnect商品"><span class="tasful-market-pc-connect-scroll-btn__icon" aria-hidden="true"><svg class="tasful-market-pc-connect-scroll-btn__svg" viewBox="0 0 18 18" width="18" height="18" focusable="false"><path d="M11 4.5 6.5 9 11 13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <div class="tasful-market-pc-connect-scroll-viewport">
        <div class="tasful-market-pc-shelf-scroll tasful-market-pc-shelf-scroll--connect">${list
      .slice(0, PC_CONNECT_SHELF_COUNT)
      .map((product) => pcShelfCardHtml(product, { connectBadge: true }))
      .join("")}</div>
      </div>
      <button type="button" class="tasful-market-pc-connect-scroll-btn tasful-market-pc-connect-scroll-btn--next" aria-label="次のConnect商品"><span class="tasful-market-pc-connect-scroll-btn__icon" aria-hidden="true"><svg class="tasful-market-pc-connect-scroll-btn__svg" viewBox="0 0 18 18" width="18" height="18" focusable="false"><path d="M7 4.5 11.5 9 7 13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
    </div>`;
    wireConnectScrollStage(container);
  }

  function renderQuadThumbs(container, products) {
    if (!container) return;
    const list = onlyWithImages(
      products.length
        ? products
        : pickShelfProducts(
            DEMO_CATALOG.map((item, i) => demoToProduct(item, i)),
            0,
            PC_QUAD_THUMB_COUNT
          )
    ).slice(0, PC_QUAD_THUMB_COUNT);
    container.innerHTML = list
      .map(
        (product) =>
          `<span class="tasful-market-pc-quad__thumb"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="120" height="120" onerror="window.__tasfulMarketThumbImgError?.(this)"><span class="tasful-market-pc-quad__thumb-label">${esc(product.title)}</span></span>`
      )
      .join("");
  }

  async function renderMiniStrip(container, products) {
    if (!container) return;
    const section = container.closest(".tasful-market-pc-shelf");
    const candidates = onlyWithImages(
      products.length
        ? products
        : pickShelfProducts(
            DEMO_CATALOG.map((item, i) => demoToProduct(item, i)),
            0,
            PC_MINI_RECENT_COUNT * 2
          )
    );
    const list = await filterLoadableProducts(candidates, PC_MINI_RECENT_COUNT);
    if (list.length < 6) {
      if (section) section.hidden = true;
      container.innerHTML = "";
      return;
    }
    if (section) section.hidden = false;
    container.innerHTML = `<div class="tasful-market-pc-mini-strip">${list
      .map(
        (product) =>
          `<a class="tasful-market-pc-mini-thumb" href="${escAttr(productHref(product))}" title="${escAttr(product.title)}"><img src="${escAttr(product.image)}" alt="" loading="lazy" decoding="async" width="88" height="88" onerror="window.__tasfulMarketThumbImgError?.(this)"></a>`
      )
      .join("")}</div>`;
  }

  async function renderPcTop(pool, sortedNew, popular) {
    await renderPcHeroFull($("[data-tasful-pc-hero-full]"), pcImageCandidates(pool, 0, PC_HERO_PRODUCT_COUNT));

    await renderPcQuadCard($("[data-tasful-market-pc-quad-continue]"), pcImageCandidates(pool, 15, PC_QUAD_THUMB_COUNT));
    await renderPcQuadCard($("[data-tasful-market-pc-quad-sale]"), pcImageCandidates(pool, 0, PC_QUAD_THUMB_COUNT));
    await renderPcQuadCard($("[data-tasful-market-pc-quad-connect]"), pcImageCandidates(pool, 6, PC_QUAD_THUMB_COUNT));
    await renderPcQuadCard($("[data-tasful-market-pc-quad-new]"), pcImageCandidates(sortedNew, 0, PC_QUAD_THUMB_COUNT));

    await renderForYouHeroShelf($("[data-tasful-market-pc-strip-for-you]"), pickShelfProducts(pool, 3, PC_FOR_YOU_COUNT + 4));
    await renderSpotlightStrip($("[data-tasful-market-pc-strip-also]"), pool);
    await renderRankingShelf(
      $("[data-tasful-market-pc-strip-popular]"),
      popular.length ? popular : pickShelfProducts(pool, 0, PC_RANKING_COUNT + 2)
    );
    await renderConnectTrustShelf($("[data-tasful-market-pc-strip-connect]"), pickShelfProducts(pool, 6, PC_CONNECT_SHELF_COUNT + 4));

    await renderMiniStrip($("[data-tasful-market-pc-recent-mini]"), demoImagePoolForMini());
  }

  function renderMobileTop(pool, sortedNew, popular) {
    const count = SHELF_ITEM_COUNT_MOBILE;
    renderSection($("[data-tasful-market-timesale]"), pickShelfProducts(pool, 0, count), "scroll", {
      tagType: "sale",
      timesalePrice: true,
    });
    renderSection($("[data-tasful-market-popular]"), popular.slice(0, count), "scroll", { withRank: true });
    renderSection($("[data-tasful-market-for-you]"), pickShelfProducts(pool, 3, count), "scroll");
    renderSection($("[data-tasful-market-connect]"), pickShelfProducts(pool, 6, count), "scroll", {
      tagType: "connect",
    });
    renderSection($("[data-tasful-market-new]"), sortedNew.slice(0, NEW_PRODUCT_LIMIT), "grid");
    renderSection($("[data-tasful-market-handmade]"), pickShelfProducts(pool, 9, count), "scroll");
    renderSection($("[data-tasful-market-local]"), pickShelfProducts(pool, 12, count), "scroll");
    renderSection($("[data-tasful-market-recent]"), pickShelfProducts(pool, 15, count), "scroll");
    renderSection($("[data-tasful-market-favorite-rise]"), pickShelfProducts(pool, 18, count), "scroll");
    renderSection($("[data-tasful-market-discount]"), pickShelfProducts(pool, 21, count), "scroll", {
      tagType: "discount",
    });
    renderSection($("[data-tasful-market-season]"), pickShelfProducts(pool, 24, count), "scroll");
  }

  function filterByKeyword(products, keyword) {
    const q = String(keyword || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }

  function filterProducts(products, keyword, categoryId) {
    return filterByKeyword(products, keyword).filter((p) => matchesCategory(p, categoryId));
  }

  function renderAll(products, keyword, categoryId) {
    const filtered = filterProducts(products, keyword, categoryId);
    const pool = buildDemoPool(filtered);
    const sortedNew = sortByDate(pool);
    const popular = sortByPopularity(pool);

    renderMobileTop(pool, sortedNew, popular);
    return renderPcTop(pool, sortedNew, popular).then(() => {
      const pcTop = document.querySelector("[data-tasful-market-pc-top]");
      if (pcTop) pcTop.removeAttribute("hidden");
    });
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_home") return;

    const Data = window.TasfulMarketProductData;
    if (Data?.loadProductPool) {
      const pool = await Data.loadProductPool();
      const products = pool.filter((p) => !String(p.id).includes("::dup-"));
      await renderAll(products, "", "all");
      return;
    }

    const listings = await fetchShopListings();
    const products = flattenProducts(listings);
    await renderAll(products, "", "all");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
