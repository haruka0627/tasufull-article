/**
 * TASFUL市場 — 検索結果（shop-search.html）
 */
(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const CART_KEY = "tasu_market_cart_count";
  const FAVORITES_KEY = "tasu_market_favorites";
  const RECENT_KEY = "tasu_market_recent_products";

  const CONDITION_TYPES = {
    new: "新品",
    used: "中古",
    likeNew: "未使用に近い",
    handmade: "ハンドメイド",
    local: "地域限定",
  };

  const CATEGORY_FILTERS = {
    food: /食品|食料|グルメ|スイーツ|food|gourmet|菓子|惣菜|お取り寄せ/i,
    daily: /日用品|生活用品|洗剤|ティッシュ|掃除|daily|life/i,
    goods: /雑貨|インテリア|goods|interior|ライフスタイル|北欧/i,
    appliance: /家電|電化|appliance|electronics|電動|工具/i,
    handmade: /ハンドメイド|手作り|handmade|craft|限定品/i,
    local: /地域限定|local|産地|ご当地|地元|地域商品/i,
  };

  const FILTER_CHIPS = [
    { id: "category", label: "カテゴリ", type: "menu" },
    { id: "price", label: "価格帯", type: "menu" },
    { id: "rating4", label: "評価4以上", type: "toggle" },
    { id: "connect", label: "Connect認証済み", type: "toggle" },
    { id: "shipping", label: "送料無料", type: "toggle" },
    { id: "newArrival", label: "新着", type: "toggle" },
    { id: "sale", label: "セール", type: "toggle" },
  ];

  const CATEGORY_OPTIONS = [
    { id: "", label: "すべて" },
    { id: "food", label: "食品" },
    { id: "daily", label: "日用品" },
    { id: "goods", label: "雑貨" },
    { id: "appliance", label: "家電" },
    { id: "handmade", label: "ハンドメイド" },
    { id: "local", label: "地域商品" },
  ];

  const PRICE_OPTIONS = [
    { id: "", label: "すべて" },
    { id: "under1000", label: "〜¥1,000" },
    { id: "1000-3000", label: "¥1,000〜3,000" },
    { id: "over3000", label: "¥3,000〜" },
  ];

  const SERVICE_SHOP_PROFILE_KEYS = new Set([
    "beauty_salon",
    "relaxation",
    "repair_maintenance",
    "construction",
    "school",
    "life",
    "local_service",
  ]);

  const DUMMY_REVIEW_COUNTS = [18, 42, 89, 128, 214];

  const TRUST_DEFAULTS = {
    ratingAverage: 4.8,
    ratingCount: 321,
    ratingBreakdown: { 5: 78, 4: 15, 3: 4, 2: 2, 1: 1 },
    connectVerified: true,
    identityVerified: true,
    completedDeals: 198,
    repeatRate: 42,
    averageReplyMinutes: 18,
  };

  const DEMO_CATALOG = [
    {
      shopId: "demo-shop-haru-cafe",
      shopName: "ハルカフェ",
      productId: "p-0",
      title: "季節のパンケーキ",
      price: "¥1,280",
      image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7440?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 128,
      connectVerified: true,
      isSale: true,
      categoryBlob: "スイーツ 食品",
    },
    {
      shopId: "demo-shop-sushi",
      shopName: "鮨 さくら",
      productId: "p-0",
      title: "季節の刺身盛り",
      price: "¥2,200",
      image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 89,
      connectVerified: true,
      categoryBlob: "食品 グルメ",
    },
    {
      shopId: "demo-shop-bakery",
      shopName: "麦の香",
      productId: "p-0",
      title: "クロワッサン",
      price: "¥320",
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 214,
      connectVerified: false,
      categoryBlob: "食品 スイーツ",
    },
    {
      shopId: "demo-shop-cafe",
      shopName: "豆と焙煎",
      productId: "p-1",
      title: "スペシャルティコーヒー",
      price: "¥580",
      image: "https://images.unsplash.com/photo-1461023058943-07fcbeecadfb?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.9,
      reviewCount: 312,
      connectVerified: true,
      isSale: true,
      categoryBlob: "食品 ドリンク コーヒー",
    },
    {
      shopId: "demo-shop-sweets",
      shopName: "菓子工房リーフ",
      productId: "p-0",
      title: "焼き菓子ギフト",
      price: "¥1,680",
      image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.5,
      reviewCount: 42,
      connectVerified: false,
      categoryBlob: "食品 スイーツ",
    },
    {
      shopId: "demo-shop-craft",
      shopName: "クラフトルーム",
      productId: "p-0",
      title: "ハンドメイドトート",
      price: "¥3,980",
      image: "https://images.unsplash.com/photo-1590874103328-eacfd0ef4358?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 18,
      connectVerified: true,
      categoryBlob: "ハンドメイド 雑貨",
    },
    {
      shopId: "demo-shop-local",
      shopName: "地域マルシェ",
      productId: "p-0",
      title: "地域限定お土産ボックス",
      price: "¥2,480",
      image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.4,
      reviewCount: 56,
      connectVerified: false,
      categoryBlob: "食品 お取り寄せ",
    },
    {
      shopId: "demo-shop-home",
      shopName: "北欧ライフ",
      productId: "p-0",
      title: "北欧風マグカップ",
      price: "¥1,980",
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.3,
      reviewCount: 73,
      connectVerified: true,
      categoryBlob: "雑貨 インテリア",
    },
    {
      shopId: "demo-shop-tool",
      shopName: "工具堂",
      productId: "p-0",
      title: "電動ドライバーセット",
      price: "¥4,980",
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 95,
      connectVerified: true,
      isSale: true,
      categoryBlob: "家電 工具",
    },
    {
      shopId: "demo-shop-season",
      shopName: "フラワーギフト",
      productId: "p-0",
      title: "春のフラワーギフト",
      price: "¥2,680",
      image: "https://images.unsplash.com/photo-1490750967868-88d448d64e7e?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 64,
      connectVerified: false,
      categoryBlob: "雑貨 ギフト",
    },
  ];

  const state = {
    products: [],
    filtered: [],
    page: 1,
    filters: {
      keyword: "",
      sort: "recommended",
      categories: [],
      prices: [],
      connect: false,
      shipping: false,
      rating4: false,
      newArrival: false,
      sale: false,
      condition: "",
    },
  };

  window.__tasfulMarketSearchImgError = function (img) {
    const card = img?.closest?.(".tasful-market-search-card, .tasful-market-search-mini");
    if (card) card.remove();
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

  function parsePriceYen(priceStr) {
    const digits = String(priceStr || "").replace(/[^\d]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function formatPriceDisplay(priceStr) {
    const base = normalizePriceBase(priceStr);
    if (!base || base === "¥—") return "¥—";
    return `${base} <span class="tasful-market-search-card__price-tax">(税込)</span>`;
  }

  function formatMiniPrice(priceStr) {
    const base = normalizePriceBase(priceStr);
    return base || "¥—";
  }

  function formatRating(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "★4.5";
    return `★${n.toFixed(1)}`;
  }

  function resolveRatingBreakdown(source) {
    const raw = source?.ratingBreakdown || source?.rating_breakdown;
    if (raw && typeof raw === "object") {
      const breakdown = {
        5: Number(raw[5] ?? raw.star5 ?? 0),
        4: Number(raw[4] ?? raw.star4 ?? 0),
        3: Number(raw[3] ?? raw.star3 ?? 0),
        2: Number(raw[2] ?? raw.star2 ?? 0),
        1: Number(raw[1] ?? raw.star1 ?? 0),
      };
      const total = breakdown[5] + breakdown[4] + breakdown[3] + breakdown[2] + breakdown[1];
      if (total > 0) return breakdown;
    }
    const seed = String(source?.id || source?.shopId || "tasful")
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const base = { ...TRUST_DEFAULTS.ratingBreakdown };
    const shift = seed % 5;
    if (shift) {
      base[5] = Math.max(55, base[5] - shift);
      base[4] = Math.min(30, base[4] + Math.floor(shift / 2));
      base[3] = Math.min(10, base[3] + (shift % 2));
    }
    return base;
  }

  function resolveTrustData(product, shop) {
    const ratingAverage = Number(
      product?.ratingAverage ?? product?.ratingScore ?? shop?.rating ?? shop?.review_score
    );
    const ratingCount = Number(
      product?.ratingCount ?? product?.reviewCount ?? product?.review_count ?? shop?.review_count
    );
    return {
      ratingAverage:
        Number.isFinite(ratingAverage) && ratingAverage > 0
          ? ratingAverage
          : TRUST_DEFAULTS.ratingAverage,
      ratingCount:
        Number.isFinite(ratingCount) && ratingCount > 0 ? ratingCount : TRUST_DEFAULTS.ratingCount,
      ratingBreakdown: resolveRatingBreakdown(product || shop),
      connectVerified:
        product?.connectVerified != null
          ? Boolean(product.connectVerified)
          : TRUST_DEFAULTS.connectVerified,
      identityVerified: Boolean(
        product?.identityVerified ??
          product?.identity_verified ??
          shop?.identityVerified ??
          shop?.identity_verified ??
          TRUST_DEFAULTS.identityVerified
      ),
      completedDeals: Number(
        product?.completedDeals ?? product?.completed_deals ?? shop?.completedDeals ?? shop?.completed_deals
      ) || TRUST_DEFAULTS.completedDeals,
      repeatRate: Number(product?.repeatRate ?? product?.repeat_rate ?? shop?.repeatRate ?? shop?.repeat_rate) ||
        TRUST_DEFAULTS.repeatRate,
      averageReplyMinutes:
        Number(
          product?.averageReplyMinutes ??
            product?.average_reply_minutes ??
            shop?.averageReplyMinutes ??
            shop?.average_reply_minutes
        ) || TRUST_DEFAULTS.averageReplyMinutes,
    };
  }

  function formatPopoverStars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(n);
    const half = n - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return `${"★".repeat(full)}${half ? "⯨" : ""}${"☆".repeat(empty)}`.replace(/⯨/g, "★");
  }

  function buildRatingBreakdownHtml(breakdown) {
    return [5, 4, 3, 2, 1]
      .map((star) => {
        const pct = Math.max(0, Math.min(100, Number(breakdown[star]) || 0));
        return `<div class="tasful-rating-popover__bar-row"><span class="tasful-rating-popover__bar-label">星${star}</span><span class="tasful-rating-popover__bar-track" aria-hidden="true"><span class="tasful-rating-popover__bar-fill" style="width:${pct}%"></span></span><span class="tasful-rating-popover__bar-pct">${pct}%</span></div>`;
      })
      .join("");
  }

  function buildRatingPopoverHtml(product, trust, href) {
    const avg = trust.ratingAverage.toFixed(1);
    const count = trust.ratingCount;
    const trustLines = [];
    if (trust.connectVerified) {
      trustLines.push('<li class="tasful-rating-popover__trust-item is-verified">✓ Connect認証済み</li>');
    }
    if (trust.identityVerified) {
      trustLines.push('<li class="tasful-rating-popover__trust-item is-verified">✓ 本人確認済み</li>');
    }
    trustLines.push(`<li class="tasful-rating-popover__trust-item">取引完了 ${esc(trust.completedDeals)}件</li>`);
    trustLines.push(`<li class="tasful-rating-popover__trust-item">リピーター率 ${esc(trust.repeatRate)}%</li>`);
    trustLines.push(
      `<li class="tasful-rating-popover__trust-item">平均返信 ${esc(trust.averageReplyMinutes)}分</li>`
    );
    return `<div class="tasful-rating-popover" role="tooltip" id="${escAttr(`tasful-rating-popover-${product.id}`)}"><div class="tasful-rating-popover__head"><p class="tasful-rating-popover__score-line"><span class="tasful-rating-popover__stars" aria-hidden="true">${formatPopoverStars(trust.ratingAverage)}</span> <span class="tasful-rating-popover__score">${esc(avg)}/5</span></p><p class="tasful-rating-popover__count">評価 ${esc(count)}件</p></div><div class="tasful-rating-popover__breakdown">${buildRatingBreakdownHtml(trust.ratingBreakdown)}</div><hr class="tasful-rating-popover__divider" aria-hidden="true"><div class="tasful-rating-popover__trust"><p class="tasful-rating-popover__trust-heading">TASFUL信用情報</p><ul class="tasful-rating-popover__trust-list">${trustLines.join("")}</ul></div><a class="tasful-rating-popover__reviews-link" href="${escAttr(`${href}#reviews`)}">レビューを見る &gt;</a></div>`;
  }

  function buildPcRatingRowHtml(product, href) {
    const trust = resolveTrustData(product);
    const avgText = trust.ratingAverage.toFixed(1);
    return `<div class="tasful-market-search-card__rating-row tasful-market-search-card__rating-row--pc"><div class="tasful-rating" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="${escAttr(`tasful-rating-popover-${product.id}`)}" aria-label="評価 ${esc(avgText)}、${esc(trust.ratingCount)}件のレビュー"><span class="tasful-rating__trigger"><span class="tasful-rating__star" aria-hidden="true">★</span><span class="tasful-rating__score">${esc(avgText)}</span><span class="tasful-rating__count">(${esc(trust.ratingCount)})</span></span>${buildRatingPopoverHtml(product, trust, href)}</div></div>`;
  }

  function buildPcSellerTrustHtml(product) {
    const trust = resolveTrustData(product);
    const lines = [];
    if (trust.connectVerified) {
      lines.push(
        `<p class="tasful-market-search-card__seller-trust-connect">✓ Connect認証済み</p>`
      );
    }
    lines.push(`<p class="tasful-market-search-card__seller-trust-deals">取引${esc(trust.completedDeals)}件</p>`);
    return `<div class="tasful-market-search-card__seller-trust tasful-market-search-card__seller-trust--pc">${lines.join("")}</div>`;
  }

  function buildPcCardDetailHtml(product, href) {
    return `<div class="tasful-market-search-card__pc-detail">${buildPcRatingRowHtml(product, href)}${buildPcSellerTrustHtml(product)}${buildPriceBlock(product)}</div>`;
  }

  function shipDaysLabel(product, index) {
    const blob = `${product?.stock || ""} ${product?.tag || ""} ${product?.ship_days || product?.shipping || ""}`;
    if (/即日|当日|same.?day|today/i.test(blob)) return "当日発送";
    if (/1.?2|翌日|fast|quick|1日|2日/i.test(blob)) return "1〜2日以内発送";
    if (/3.?5|3日|4日|5日/i.test(blob)) return "3〜5日以内発送";
    const defaults = ["当日発送", "1〜2日以内発送", "3〜5日以内発送"];
    return defaults[(Number(index) || 0) % defaults.length];
  }

  function resolveConditionType(product, rawProduct, index) {
    const blob = [
      product?.title,
      product?.categoryBlob,
      rawProduct?.condition,
      rawProduct?.product_condition,
      rawProduct?.tag,
      rawProduct?.description,
    ]
      .filter(Boolean)
      .join(" ");
    if (/中古|used|リユース|再生品/i.test(blob)) return "used";
    if (/未使用に近い|like.?new|美品|未使用/i.test(blob)) return "likeNew";
    if (/ハンドメイド|handmade|手作り|craft|一点/i.test(blob)) return "handmade";
    if (/地域限定|local|産地直送|ご当地|地元/i.test(blob)) return "local";
    if (product?.isNew) return "new";
    const cycle = ["new", "handmade", "local", "likeNew", "new"];
    return cycle[(Number(index) || 0) % cycle.length];
  }

  function resolveConditionLabel(type) {
    return CONDITION_TYPES[type] || CONDITION_TYPES.new;
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

  function resolveShopName(shop) {
    return String(shop?.shop_name || shop?.company_name || shop?.title || "").trim() || "出品者";
  }

  function resolveConnectVerified(shop) {
    return Boolean(
      shop?.stripe_connect_account_id ||
        shop?.connect_verified ||
        shop?.pr_plan === "apply" ||
        shop?.featured
    );
  }

  function isNewProduct(createdAt) {
    const t = new Date(createdAt || 0).getTime();
    if (!t) return false;
    return Date.now() - t < 14 * 86400000;
  }

  function isSaleProduct(product, shop, index) {
    const tag = String(product?.tag || "").trim();
    if (/sale|セール|off|タイム/i.test(tag)) return true;
    return Boolean(index % 4 === 0);
  }

  function flattenProducts(listings) {
    const out = [];
    listings.forEach((shop) => {
      const shopId = resolveShopId(shop);
      const products = shop?.products || shop?.form_data?.products || [];
      const createdAt = shop?.created_at || shop?.updated_at || "";
      const shopName = resolveShopName(shop);
      const connectVerified = resolveConnectVerified(shop);
      products.forEach((p, index) => {
        const title = String(p?.title || p?.product_name || "").trim();
        if (!title) return;
        const { image, hasImage } = resolveProductImageFields(p);
        if (!hasImage) return;
        const ratingScore = Number(shop?.rating || shop?.review_score || 4.5);
        const reviewCount = resolveReviewCount(p, shop, shopId, index);
        const trust = resolveTrustData(
          {
            id: `${shopId}::p-${index}`,
            ratingScore,
            reviewCount,
            connectVerified,
            ratingBreakdown: p?.ratingBreakdown || p?.rating_breakdown || shop?.ratingBreakdown || shop?.rating_breakdown,
            identityVerified: p?.identity_verified ?? shop?.identity_verified,
            completedDeals: p?.completed_deals ?? shop?.completed_deals,
            repeatRate: p?.repeat_rate ?? shop?.repeat_rate,
            averageReplyMinutes: p?.average_reply_minutes ?? shop?.average_reply_minutes,
          },
          shop
        );
        const priceYen = parsePriceYen(p?.price);
        const created = p?.created_at || createdAt;
        const categoryBlob = productCategoryBlob(p, shop, title);
        const conditionType = resolveConditionType({ title, categoryBlob, isNew: isNewProduct(created) }, p, index);
        out.push({
          id: `${shopId}::p-${index}`,
          shopId,
          productId: `p-${index}`,
          title,
          price: String(p?.price || "").trim() || "¥—",
          priceYen,
          image,
          hasImage,
          shopName,
          connectVerified,
          freeShipping: true,
          isNew: isNewProduct(created),
          isSale: isSaleProduct(p, shop, index),
          shipDays: shipDaysLabel(p, index),
          conditionType,
          conditionLabel: resolveConditionLabel(conditionType),
          categoryBlob,
          ratingScore: trust.ratingAverage,
          reviewCount: trust.ratingCount,
          ratingBreakdown: trust.ratingBreakdown,
          identityVerified: trust.identityVerified,
          completedDeals: trust.completedDeals,
          repeatRate: trust.repeatRate,
          averageReplyMinutes: trust.averageReplyMinutes,
          createdAt: created,
          featured: Boolean(shop?.featured),
        });
      });
    });
    return out;
  }

  function demoToProduct(item, index) {
    const createdAt = new Date(Date.now() - index * 86400000).toISOString();
    const categoryBlob = item.categoryBlob || item.title;
    const conditionType = resolveConditionType(
      { title: item.title, categoryBlob, isNew: index < 4 },
      item,
      index
    );
    const trust = resolveTrustData({
      id: `demo-${index}`,
      ratingScore: Number(item.ratingScore) || 4.5,
      reviewCount: Number(item.reviewCount) || DUMMY_REVIEW_COUNTS[index % DUMMY_REVIEW_COUNTS.length],
      connectVerified: Boolean(item.connectVerified),
      ratingBreakdown: item.ratingBreakdown,
      identityVerified: item.identityVerified,
      completedDeals: item.completedDeals,
      repeatRate: item.repeatRate,
      averageReplyMinutes: item.averageReplyMinutes,
    });
    return {
      id: `demo-${index}`,
      shopId: item.shopId,
      productId: item.productId,
      title: item.title,
      price: item.price,
      priceYen: parsePriceYen(item.price),
      image: item.image,
      hasImage: true,
      shopName: item.shopName,
      connectVerified: trust.connectVerified,
      freeShipping: true,
      isNew: index < 4,
      isSale: Boolean(item.isSale),
      shipDays: shipDaysLabel(item, index),
      conditionType,
      conditionLabel: resolveConditionLabel(conditionType),
      categoryBlob,
      ratingScore: trust.ratingAverage,
      reviewCount: trust.ratingCount,
      ratingBreakdown: trust.ratingBreakdown,
      identityVerified: trust.identityVerified,
      completedDeals: trust.completedDeals,
      repeatRate: trust.repeatRate,
      averageReplyMinutes: trust.averageReplyMinutes,
      createdAt,
      featured: index < 3,
    };
  }

  function buildProductPool(baseProducts) {
    const pool = baseProducts.filter((p) => p.hasImage && String(p.image || "").trim());
    if (!pool.length) {
      DEMO_CATALOG.forEach((item, i) => pool.push(demoToProduct(item, i)));
    }
    let i = 0;
    while (pool.length < 36) {
      const src = pool[i % pool.length];
      pool.push({ ...src, id: `${src.id || src.shopId}::dup-${pool.length}` });
      i += 1;
    }
    return pool;
  }

  function productHref(product) {
    return `detail-shop-product.html?shopId=${encodeURIComponent(product.shopId)}&productId=${encodeURIComponent(product.productId)}`;
  }

  function matchesCategory(product, categoryIds) {
    const ids = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : [];
    if (!ids.length) return true;
    return ids.some((categoryId) => {
      const pattern = CATEGORY_FILTERS[categoryId];
      if (!pattern) return true;
      return pattern.test(product.categoryBlob || "");
    });
  }

  function matchesPrice(product, priceIds) {
    const ids = Array.isArray(priceIds) ? priceIds.filter(Boolean) : [];
    if (!ids.length) return true;
    const yen = product.priceYen;
    if (!yen) return true;
    return ids.some((priceId) => {
      if (priceId === "under1000") return yen < 1000;
      if (priceId === "1000-3000") return yen >= 1000 && yen <= 3000;
      if (priceId === "over3000") return yen > 3000;
      return true;
    });
  }

  function filterProducts(products) {
    const { keyword, categories, prices, connect, shipping, rating4, newArrival, sale, condition } =
      state.filters;
    const q = String(keyword || "").trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !p.shopName.toLowerCase().includes(q)) {
        return false;
      }
      if (!matchesCategory(p, categories)) return false;
      if (condition === "used" && p.conditionType !== "used") return false;
      if (!matchesPrice(p, prices)) return false;
      if (rating4 && (Number(p.ratingScore) || 0) < 4) return false;
      if (connect && !p.connectVerified) return false;
      if (shipping && !p.freeShipping) return false;
      if (newArrival && !p.isNew) return false;
      if (sale && !p.isSale) return false;
      return true;
    });
  }

  function sortProducts(products) {
    const list = [...products];
    switch (state.filters.sort) {
      case "new":
        return list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      case "price_asc":
        return list.sort((a, b) => (a.priceYen || 999999) - (b.priceYen || 999999));
      case "reviews":
        return list.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      case "recommended":
      default:
        return list.sort((a, b) => {
          const fa = a.featured ? 1 : 0;
          const fb = b.featured ? 1 : 0;
          if (fb !== fa) return fb - fa;
          const ra = Number(a.ratingScore) || 0;
          const rb = Number(b.ratingScore) || 0;
          if (rb !== ra) return rb - ra;
          return (b.reviewCount || 0) - (a.reviewCount || 0);
        });
    }
  }

  function paginateSlice(products) {
    const total = products.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    return {
      items: products.slice(start, end),
      total,
      totalPages,
      start: total ? start + 1 : 0,
      end,
    };
  }

  function getFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      return [];
    }
  }

  function isFavorite(productId) {
    return getFavorites().includes(String(productId || "").trim());
  }

  function toggleFavorite(productId) {
    const key = String(productId || "").trim();
    if (!key) return false;
    const product = state.products.find((p) => p.id === key);
    const Data = window.TasfulMarketProductData;
    if (Data?.toggleFavorite) return Data.toggleFavorite(key, product);
    const set = new Set(getFavorites());
    const saved = set.has(key);
    if (saved) set.delete(key);
    else set.add(key);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
    return !saved;
  }

  function buildFavoriteHeart(product) {
    const saved = isFavorite(product.id);
    return `<button type="button" class="tasful-market-search-card__fav${saved ? " is-active" : ""}" data-tasful-market-favorite="${escAttr(product.id)}" aria-label="お気に入り" aria-pressed="${saved ? "true" : "false"}"><span class="tasful-market-search-card__fav-icon" aria-hidden="true">${saved ? "♥" : "♡"}</span></button>`;
  }

  function buildCardMeta(product) {
    const parts = [];
    if (product.freeShipping) {
      parts.push('<span class="tasful-market-search-card__ship-free">送料無料</span>');
    }
    if (product.connectVerified) {
      parts.push('<span class="tasful-market-search-card__badge-connect">✓ Connect認証済み</span>');
    }
    return `<div class="tasful-market-search-card__meta"${parts.length ? "" : ' aria-hidden="true"'}>${parts.join("")}</div>`;
  }

  function buildConditionHtml(product, prefix = "tasful-market-search-card") {
    const type = product.conditionType || "new";
    const label = product.conditionLabel || resolveConditionLabel(type);
    return `<span class="${prefix}__condition ${prefix}__condition--${escAttr(type)}">${esc(label)}</span>`;
  }

  function buildPriceBlock(product) {
    return `<div class="tasful-market-search-card__price-block"><p class="tasful-market-search-card__price">${formatPriceDisplay(product.price)}</p><p class="tasful-market-search-card__ship">${esc(product.shipDays)}</p></div>`;
  }

  function formatSubtotalYen(total) {
    const n = Number(total) || 0;
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function buildCardHtml(product) {
    const Data = window.TasfulMarketProductData;
    const href = escAttr(productHref(product));
    const hrefPlain = productHref(product);
    const src = Data?.resolvePrimaryImage?.(product) || product.image;
    const onErr = Data?.productImageOnErrorAttr?.() || "";
    const legacyRating = `<p class="tasful-market-search-card__rating tasful-market-search-card__rating--legacy">${esc(formatRating(product.ratingScore))} (${esc(product.reviewCount)})</p>`;
    const pcCardDetail = buildPcCardDetailHtml(product, hrefPlain);
    return `<article class="tasful-market-search-card" data-product-id="${escAttr(product.id)}"><div class="tasful-market-search-card__img"><a class="tasful-market-search-card__img-link" href="${href}"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="300" height="300"${onErr}></a>${buildFavoriteHeart(product)}</div><div class="tasful-market-search-card__body"><a class="tasful-market-search-card__link" href="${href}">${buildConditionHtml(product)}<h3 class="tasful-market-search-card__title">${esc(product.title)}</h3>${legacyRating}${buildPriceBlock(product)}${buildCardMeta(product)}</a>${pcCardDetail}<button type="button" class="tasful-market-search-card__cart" data-tasful-market-add-cart="${escAttr(product.id)}">カートに入れる</button></div></article>`;
  }

  function buildMiniCardHtml(product) {
    const Data = window.TasfulMarketProductData;
    const src = Data?.resolvePrimaryImage?.(product) || product.image;
    const onErr = Data?.productImageOnErrorAttr?.() || "";
    return `<a class="tasful-market-search-mini" href="${escAttr(productHref(product))}"><div class="tasful-market-search-mini__img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="120" height="120"${onErr}></div><div class="tasful-market-search-mini__body">${buildConditionHtml(product, "tasful-market-search-mini")}<p class="tasful-market-search-mini__title">${esc(product.title)}</p><p class="tasful-market-search-mini__rating">${esc(formatRating(product.ratingScore))} (${esc(product.reviewCount)})</p><p class="tasful-market-search-mini__price">${esc(formatMiniPrice(product.price))}</p></div></a>`;
  }

  function syncFavoriteButton(btn, saved) {
    if (!btn) return;
    btn.classList.toggle("is-active", saved);
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    const icon = btn.querySelector(".tasful-market-search-card__fav-icon");
    if (icon) icon.textContent = saved ? "♥" : "♡";
  }

  function categoryLabel(id) {
    return CATEGORY_OPTIONS.find((o) => o.id === id)?.label || "";
  }

  function priceLabel(id) {
    return PRICE_OPTIONS.find((o) => o.id === id)?.label || "";
  }

  function renderFilters() {
    const container = $("[data-tasful-market-search-filters]");
    if (!container) return;
    container.innerHTML = FILTER_CHIPS.map((chip) => {
      let active = false;
      let label = chip.label;
      if (chip.id === "category" && state.filters.categories.length) {
        active = true;
        label =
          state.filters.categories.length === 1
            ? categoryLabel(state.filters.categories[0]) || chip.label
            : `${chip.label}(${state.filters.categories.length})`;
      } else if (chip.id === "price" && state.filters.prices.length) {
        active = true;
        label =
          state.filters.prices.length === 1
            ? priceLabel(state.filters.prices[0]) || chip.label
            : `${chip.label}(${state.filters.prices.length})`;
      } else if (chip.id === "connect") active = state.filters.connect;
      else if (chip.id === "rating4") active = state.filters.rating4;
      else if (chip.id === "shipping") active = state.filters.shipping;
      else if (chip.id === "newArrival") active = state.filters.newArrival;
      else if (chip.id === "sale") active = state.filters.sale;
      return `<button type="button" class="tasful-market-search-chip${active ? " is-active" : ""}" data-tasful-market-filter-chip="${escAttr(chip.id)}">${esc(label)}</button>`;
    }).join("");
  }

  function isPcAmazonLayout() {
    return window.matchMedia("(min-width: 1025px)").matches;
  }

  function renderSummary(meta) {
    const hitEl = $("[data-tasful-market-search-hit-count]");
    const kw = String(state.filters.keyword || "").trim();
    if (!hitEl) return;
    if (!meta.total) {
      hitEl.textContent = kw
        ? isPcAmazonLayout()
          ? `「${kw}」に一致する商品は見つかりませんでした`
          : `「${kw}」の検索結果: 0件`
        : isPcAmazonLayout()
          ? "0件"
          : "検索結果: 0件の商品";
      return;
    }
    if (isPcAmazonLayout()) {
      const range =
        meta.totalPages > 1
          ? `${meta.start}–${meta.end}件 / 全${meta.total}件`
          : `${meta.total}件`;
      hitEl.textContent = kw ? `「${kw}」の検索結果 — ${range}` : range;
      return;
    }
    hitEl.textContent = kw
      ? `「${kw}」の検索結果: ${meta.total}件`
      : `検索結果: ${meta.total}件の商品`;
  }

  function buildPcCheckboxOptions(options, selectedIds, inputName) {
    const selected = new Set((selectedIds || []).map(String));
    const allChecked = !selected.size;
    return options
      .map((opt) => {
        const isAll = !opt.id;
        const checked = isAll ? allChecked : selected.has(opt.id);
        const attrs = isAll ? ' data-pc-filter-all="1"' : "";
        return `<label class="tasful-market-search-filter-panel__check"><input type="checkbox" name="${escAttr(inputName)}" value="${escAttr(opt.id)}"${checked ? " checked" : ""}${attrs}><span>${esc(opt.label)}</span></label>`;
      })
      .join("");
  }

  function renderFilterPanel() {
    const panel = $("[data-tasful-market-search-filters-panel]");
    if (!panel) return;
    const toggleChips = FILTER_CHIPS.filter((chip) => chip.type === "toggle");
    panel.innerHTML = `<div class="tasful-market-search-filter-panel">
      <section class="tasful-market-search-filter-panel__group">
        <h2 class="tasful-market-search-filter-panel__heading">カテゴリ</h2>
        <div class="tasful-market-search-filter-panel__list">
          ${buildPcCheckboxOptions(CATEGORY_OPTIONS, state.filters.categories, "pc-category")}
        </div>
      </section>
      <section class="tasful-market-search-filter-panel__group">
        <h2 class="tasful-market-search-filter-panel__heading">価格帯</h2>
        <div class="tasful-market-search-filter-panel__list">
          ${buildPcCheckboxOptions(PRICE_OPTIONS, state.filters.prices, "pc-price")}
        </div>
      </section>
      <section class="tasful-market-search-filter-panel__group">
        <h2 class="tasful-market-search-filter-panel__heading">絞り込み</h2>
        <div class="tasful-market-search-filter-panel__list">
          ${toggleChips
            .map((chip) => {
              const checked = Boolean(state.filters[chip.id]);
              return `<label class="tasful-market-search-filter-panel__check"><input type="checkbox" name="pc-toggle" value="${escAttr(chip.id)}"${checked ? " checked" : ""}><span>${esc(chip.label)}</span></label>`;
            })
            .join("")}
        </div>
      </section>
    </div>`;
  }

  function renderCartRail() {
    const rail = $("[data-tasful-market-search-cart-rail]");
    if (!rail) return;
    const Data = window.TasfulMarketProductData;
    const items = Data?.getCartItems?.() || [];
    const subtotal = items.reduce((sum, item) => {
      const yen = parsePriceYen(item.price);
      const qty = Math.max(1, Number(item.qty) || 1);
      return sum + (yen || 0) * qty;
    }, 0);
    const itemCount = items.reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0);
    const miniItems = items.slice(0, 4);
    const miniHtml = miniItems.length
      ? miniItems
          .map((item) => {
            const src =
              Data?.resolvePrimaryImage?.({
                shopId: item.shopId,
                productId: item.productId,
                title: item.title,
                image: item.image,
              }) || item.image;
            const href = escAttr(
              `detail-shop-product.html?shopId=${encodeURIComponent(item.shopId)}&productId=${encodeURIComponent(item.productId)}`
            );
            return `<a class="tasful-market-search-cart-rail__item" href="${href}"><span class="tasful-market-search-cart-rail__item-img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="48" height="48"></span><span class="tasful-market-search-cart-rail__item-body"><span class="tasful-market-search-cart-rail__item-title">${esc(item.title || "商品")}</span><span class="tasful-market-search-cart-rail__item-price">${esc(formatMiniPrice(item.price))}${item.qty > 1 ? ` ×${item.qty}` : ""}</span></span></a>`;
          })
          .join("")
      : `<p class="tasful-market-search-cart-rail__empty">カートに商品がありません</p>`;
    rail.innerHTML = `<div class="tasful-market-search-cart-rail__box">
      <h2 class="tasful-market-search-cart-rail__title">カートの小計</h2>
      <p class="tasful-market-search-cart-rail__subtotal"><span class="tasful-market-search-cart-rail__subtotal-label">小計（${itemCount}点）:</span> <strong>${esc(formatSubtotalYen(subtotal))}</strong></p>
      <a class="tasful-market-search-cart-rail__checkout" href="shop-market-cart.html">レジに進む</a>
      <div class="tasful-market-search-cart-rail__items">${miniHtml}</div>
      <a class="tasful-market-search-cart-rail__view" href="shop-market-cart.html">カートを見る</a>
    </div>`;
  }

  function buildRecommendFillCard(product) {
    const Data = window.TasfulMarketProductData;
    const href = escAttr(productHref(product));
    const src = Data?.resolvePrimaryImage?.(product) || product.image;
    const onErr = Data?.productImageOnErrorAttr?.() || "";
    return `<article class="tasful-market-search-card recommend-fill" data-product-id="${escAttr(product.id)}"><p class="tasful-market-search-card__recommend-label">こちらもおすすめ</p><a class="tasful-market-search-card__link" href="${href}"><div class="tasful-market-search-card__img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="300" height="300"${onErr}></div><div class="tasful-market-search-card__body"><h3 class="tasful-market-search-card__title">${esc(product.title)}</h3><p class="tasful-market-search-card__price recommend-fill__price">${formatPriceDisplay(product.price)}</p></div></a></article>`;
  }

  function shouldFillOddSearchGrid(count) {
    if (count < 1 || count % 2 !== 1) return false;
    return window.matchMedia("(max-width: 960px)").matches;
  }

  function syncRatingPopoverEdge() {
    if (!window.matchMedia("(min-width: 1025px)").matches) return;
    const grid = $("[data-tasful-market-search-grid]");
    if (!grid) return;
    const cards = [...grid.querySelectorAll(".tasful-market-search-card")].filter(
      (card) => !card.classList.contains("recommend-fill")
    );
    cards.forEach((card) => {
      card.querySelectorAll(".tasful-rating.is-edge").forEach((el) => el.classList.remove("is-edge"));
    });
    const rowMap = new Map();
    cards.forEach((card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      const key = [...rowMap.keys()].find((k) => Math.abs(k - top) < 8);
      const rowKey = key != null ? key : top;
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
      rowMap.get(rowKey).push(card);
    });
    rowMap.forEach((rowCards) => {
      const last = rowCards[rowCards.length - 1];
      const rating = last?.querySelector(".tasful-rating");
      if (rating) rating.classList.add("is-edge");
    });
  }

  function renderGrid(items) {
    const grid = $("[data-tasful-market-search-grid]");
    const empty = $("[data-tasful-market-search-empty]");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    const Data = window.TasfulMarketProductData;
    let html = items.map((p) => buildCardHtml(p)).join("");
    if (shouldFillOddSearchGrid(items.length) && Data?.pickRecommendFillProduct) {
      const excludeIds = items.map((p) => p.id);
      const fill = Data.pickRecommendFillProduct(state.products, excludeIds);
      if (fill) html += buildRecommendFillCard(fill);
    }
    grid.innerHTML = html;
    syncRatingPopoverEdge();
  }

  function renderPagination(totalPages) {
    const nav = $("[data-tasful-market-search-pagination]");
    if (!nav) return;
    if (totalPages <= 1) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }
    nav.hidden = false;
    const pages = [];
    const startPage = Math.max(1, state.page - 1);
    const endPage = Math.min(totalPages, startPage + 2);
    for (let p = startPage; p <= endPage; p += 1) {
      pages.push(
        `<button type="button" class="tasful-market-search-pagination__page${p === state.page ? " is-active" : ""}" data-tasful-market-page="${p}">${p}</button>`
      );
    }
    nav.innerHTML = `<button type="button" class="tasful-market-search-pagination__btn" data-tasful-market-page="prev"${state.page <= 1 ? " disabled" : ""}>‹ 前へ</button>${pages.join("")}<button type="button" class="tasful-market-search-pagination__btn" data-tasful-market-page="next"${state.page >= totalPages ? " disabled" : ""}>次へ ›</button>`;
  }

  function pickShelfProducts(pool, offset, count) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(pool[(offset + i) % pool.length]);
    }
    return out;
  }

  function renderShelf(containerSel, products) {
    const el = $(containerSel);
    if (!el) return;
    el.innerHTML = products.map((p) => buildMiniCardHtml(p)).join("");
  }

  function renderSellers(products) {
    const el = $("[data-tasful-market-search-sellers]");
    if (!el) return;
    const seen = new Set();
    const sellers = [];
    products.forEach((p) => {
      const key = p.shopId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      sellers.push(p);
    });
    el.innerHTML = sellers
      .slice(0, 8)
      .map(
        (p) =>
          `<a class="tasful-market-search-seller" href="${escAttr(`shop-search.html?keyword=${encodeURIComponent(p.shopName)}`)}"><span class="tasful-market-search-seller__name">${esc(p.shopName)}</span>${p.connectVerified ? '<span class="tasful-market-search-seller__mark">✓ Connect認証済み</span>' : ""}</a>`
      )
      .join("");
  }

  function renderPcBrands(products) {
    const el = $("[data-tasful-market-search-brands-pc]");
    if (!el) return;
    const seen = new Set();
    const sellers = [];
    products.forEach((p) => {
      const key = p.shopId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      sellers.push(p);
    });
    const Data = window.TasfulMarketProductData;
    el.innerHTML = sellers
      .slice(0, 3)
      .map((p) => {
        const href = escAttr(`shop-search.html?keyword=${encodeURIComponent(p.shopName)}`);
        const src = escAttr(Data?.resolvePrimaryImage?.(p) || p.image);
        const onErr = Data?.productImageOnErrorAttr?.() || "";
        return `<a class="tasful-market-search-brand-card" href="${href}"><span class="tasful-market-search-brand-card__img"><img src="${src}" alt="" loading="lazy" decoding="async" width="120" height="120"${onErr}></span><span class="tasful-market-search-brand-card__body"><span class="tasful-market-search-brand-card__name">${esc(p.shopName)}</span><span class="tasful-market-search-brand-card__link">今すぐチェック</span></span></a>`;
      })
      .join("");
  }

  function renderPcHistory(products) {
    const el = $("[data-tasful-market-search-history-pc]");
    if (!el) return;
    const Data = window.TasfulMarketProductData;
    el.innerHTML = products
      .slice(0, 8)
      .map((p) => {
        const href = escAttr(productHref(p));
        const src = escAttr(Data?.resolvePrimaryImage?.(p) || p.image);
        const onErr = Data?.productImageOnErrorAttr?.() || "";
        return `<a class="tasful-market-search-history-thumb" href="${href}" title="${escAttr(p.title)}"><img src="${src}" alt="" loading="lazy" decoding="async" width="88" height="88"${onErr}></a>`;
      })
      .join("");
  }

  function getRecentProducts(allProducts) {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  function renderRelatedShelves(allFiltered) {
    const pool = allFiltered.length ? allFiltered : state.products;
    const popular = sortProducts([...pool]).slice(0, 8);
    const recent = getRecentProducts(state.products);
    const recentItems = recent.length ? recent : pickShelfProducts(pool, 2, 8);
    renderShelf("[data-tasful-market-search-browsed]", popular);
    renderShelf("[data-tasful-market-search-recent]", recentItems);
    renderSellers(pool);
    renderPcBrands(pool);
    renderPcHistory(recentItems);
  }

  function addToCart(productId, btn) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    if (window.TasfulMarketProductData?.incrementCartCount) {
      window.TasfulMarketProductData.incrementCartCount(1, {
        shopId: product.shopId,
        productId: product.productId,
        title: product.title,
        price: product.price,
        image: product.image,
        shopName: product.shopName,
        conditionLabel: product.conditionLabel,
        connectVerified: product.connectVerified,
        freeShipping: product.freeShipping,
      });
    } else {
      try {
        const cur = Number(localStorage.getItem(CART_KEY)) || 0;
        localStorage.setItem(CART_KEY, String(cur + 1));
      } catch {
        /* ignore */
      }
      window.TasfulMarketHeader?.updateCartBadge?.();
      window.dispatchEvent(new Event("tasful-market-cart-updated"));
    }
    renderCartRail();
    if (btn) {
      btn.textContent = "追加しました";
      btn.disabled = true;
      window.setTimeout(() => {
        btn.textContent = "カートに入れる";
        btn.disabled = false;
      }, 1200);
    }
  }

  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      const f = state.filters;
      if (f.keyword) url.searchParams.set("keyword", f.keyword);
      else url.searchParams.delete("keyword");
      if (f.sort && f.sort !== "recommended") url.searchParams.set("sort", f.sort);
      else url.searchParams.delete("sort");
      if (f.categories.length) url.searchParams.set("category", f.categories.join(","));
      else url.searchParams.delete("category");
      if (f.prices.length) url.searchParams.set("price", f.prices.join(","));
      else url.searchParams.delete("price");
      if (f.connect) url.searchParams.set("connect", "1");
      else url.searchParams.delete("connect");
      if (f.shipping) url.searchParams.set("shipping", "1");
      else url.searchParams.delete("shipping");
      if (f.rating4) url.searchParams.set("rating4", "1");
      else url.searchParams.delete("rating4");
      if (f.newArrival) url.searchParams.set("new", "1");
      else url.searchParams.delete("new");
      if (f.sale) url.searchParams.set("sale", "1");
      else url.searchParams.delete("sale");
      if (f.condition) url.searchParams.set("condition", f.condition);
      else url.searchParams.delete("condition");
      if (state.page > 1) url.searchParams.set("page", String(state.page));
      else url.searchParams.delete("page");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
  }

  function applyFilters(resetPage) {
    if (resetPage) state.page = 1;
    state.filtered = sortProducts(filterProducts(state.products));
    const meta = paginateSlice(state.filtered);
    renderSummary(meta);
    renderFilters();
    renderFilterPanel();
    renderCartRail();
    renderGrid(meta.items);
    renderPagination(meta.totalPages);
    renderRelatedShelves(state.filtered);
    window.TasfulMarketHeader?.renderNav?.(window.TasfulMarketHeader?.resolveActiveNavId?.() ?? "");
    syncUrl();
  }

  function cycleMenuOption(options, currentId) {
    const idx = options.findIndex((o) => o.id === currentId);
    return options[(idx + 1) % options.length].id;
  }

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    state.filters.keyword = params.get("keyword") || params.get("q") || "";
    const sort = params.get("sort") || "recommended";
    state.filters.sort = ["recommended", "new", "price_asc", "reviews"].includes(sort) ? sort : "recommended";
    const categoryParam = params.get("category") || params.get("nav") || "";
    state.filters.categories =
      categoryParam && !["all", "new", "rank"].includes(categoryParam)
        ? categoryParam.split(",").map((v) => v.trim()).filter(Boolean)
        : [];
    const priceParam = params.get("price") || "";
    state.filters.prices = priceParam ? priceParam.split(",").map((v) => v.trim()).filter(Boolean) : [];
    state.filters.connect = params.get("connect") === "1";
    state.filters.shipping = params.get("shipping") === "1";
    state.filters.rating4 = params.get("rating4") === "1";
    state.filters.newArrival = params.get("new") === "1";
    state.filters.sale = params.get("sale") === "1";
    state.filters.condition = params.get("condition") || "";
    state.page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);

    const searchInput = $("[data-tasful-market-search-input]");
    if (searchInput) searchInput.value = state.filters.keyword;
    const sortSelect = $("[data-tasful-market-search-sort]");
    if (sortSelect) sortSelect.value = state.filters.sort;
  }

  function bindEvents() {
    $("[data-tasful-market-search-sort]")?.addEventListener("change", (e) => {
      state.filters.sort = e.target.value || "recommended";
      applyFilters(true);
    });

    $("[data-tasful-market-search-filters]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tasful-market-filter-chip]");
      if (!btn) return;
      const id = btn.getAttribute("data-tasful-market-filter-chip");
      if (id === "category") {
        const current = state.filters.categories[0] || "";
        const next = cycleMenuOption(CATEGORY_OPTIONS, current);
        state.filters.categories = next ? [next] : [];
      } else if (id === "price") {
        const current = state.filters.prices[0] || "";
        const next = cycleMenuOption(PRICE_OPTIONS, current);
        state.filters.prices = next ? [next] : [];
      }
      else if (id === "connect") state.filters.connect = !state.filters.connect;
      else if (id === "rating4") state.filters.rating4 = !state.filters.rating4;
      else if (id === "shipping") state.filters.shipping = !state.filters.shipping;
      else if (id === "newArrival") state.filters.newArrival = !state.filters.newArrival;
      else if (id === "sale") state.filters.sale = !state.filters.sale;
      applyFilters(true);
    });

    $("[data-tasful-market-search-pagination]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tasful-market-page]");
      if (!btn || btn.disabled) return;
      const val = btn.getAttribute("data-tasful-market-page");
      const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
      if (val === "prev") state.page = Math.max(1, state.page - 1);
      else if (val === "next") state.page = Math.min(totalPages, state.page + 1);
      else state.page = parseInt(val, 10) || 1;
      applyFilters(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("[data-tasful-market-search-grid]")?.addEventListener("click", (e) => {
      const favBtn = e.target.closest("[data-tasful-market-favorite]");
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        syncFavoriteButton(favBtn, toggleFavorite(favBtn.getAttribute("data-tasful-market-favorite")));
        return;
      }
      const cartBtn = e.target.closest("[data-tasful-market-add-cart]");
      if (!cartBtn) return;
      e.preventDefault();
      e.stopPropagation();
      addToCart(cartBtn.getAttribute("data-tasful-market-add-cart"), cartBtn);
    });

    $("[data-tasful-market-search-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.filters.keyword = $("[data-tasful-market-search-input]")?.value || "";
      applyFilters(true);
    });

    function handlePcCheckboxGroup(panel, input, inputName, stateKey) {
      const inputs = [...panel.querySelectorAll(`input[name="${inputName}"]`)];
      const allInput = inputs.find((el) => el.dataset.pcFilterAll === "1");
      const valueInputs = inputs.filter((el) => el.dataset.pcFilterAll !== "1");
      if (input.dataset.pcFilterAll === "1") {
        if (input.checked) {
          valueInputs.forEach((el) => {
            el.checked = false;
          });
          state.filters[stateKey] = [];
        } else if (!valueInputs.some((el) => el.checked)) {
          input.checked = true;
        }
        return;
      }
      if (input.checked && allInput) allInput.checked = false;
      const selected = valueInputs.filter((el) => el.checked).map((el) => el.value).filter(Boolean);
      if (!selected.length && allInput) allInput.checked = true;
      state.filters[stateKey] = selected;
    }

    $("[data-tasful-market-search-filters-panel]")?.addEventListener("change", (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      const panel = input.closest("[data-tasful-market-search-filters-panel]");
      if (!panel) return;
      if (input.name === "pc-category") {
        handlePcCheckboxGroup(panel, input, "pc-category", "categories");
        applyFilters(true);
        return;
      }
      if (input.name === "pc-price") {
        handlePcCheckboxGroup(panel, input, "pc-price", "prices");
        applyFilters(true);
        return;
      }
      if (input.name === "pc-toggle") {
        const id = input.value;
        if (Object.prototype.hasOwnProperty.call(state.filters, id)) {
          state.filters[id] = input.checked;
          applyFilters(true);
        }
      }
    });

    window.addEventListener("tasful-market-cart-updated", () => {
      renderCartRail();
    });

    window.addEventListener("resize", () => {
      syncRatingPopoverEdge();
    });
  }

  async function init() {
    if (document.body.dataset.page !== "shop_market_search") return;
    readParams();
    bindEvents();
    const Data = window.TasfulMarketProductData;
    if (Data?.loadProductPool) {
      state.products = await Data.loadProductPool();
    } else {
      const listings = await fetchShopListings();
      state.products = buildProductPool(flattenProducts(listings));
    }
    applyFilters(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
