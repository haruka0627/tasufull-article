/**
 * 店舗・販売（shop_store）専用カード一覧ページ
 */
(function () {
  "use strict";

  const PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ];

  const FAVORITES_KEY = "tasu_shop_store_favorites";

  /** image_3 ショーケース表示順 */
  const SHOWCASE_ORDER = [
    "demo-shop-haru-cafe",
    "demo-shop-reworks",
    "demo-shop-marche-vert",
    "demo-shop-bloom",
    "shop-store-demo-other-001",
  ];

  /** 店舗・販売一覧に載せない（業務サービス系プロファイル） */
  const SERVICE_SHOP_PROFILE_KEYS = new Set([
    "beauty_salon",
    "relaxation",
    "repair_maintenance",
    "construction",
    "school",
    "life",
    "local_service",
  ]);

  const LIST_PAGE_SIZE = 12;
  let listVisibleLimit = LIST_PAGE_SIZE;

  /** 一覧トップのカテゴリカード（店舗・販売＝商品販売系のみ） */
  const PLATFORM_CATEGORIES = [
    { id: "", label: "すべて", iconKey: "all" },
    { id: "restaurant", label: "飲食・カフェ", iconKey: "restaurant" },
    { id: "retail", label: "小売・物販", iconKey: "retail" },
    { id: "vintage_brand", label: "古着・ブランド", iconKey: "vintage" },
    { id: "goods_interior", label: "雑貨・インテリア", iconKey: "goods" },
    { id: "food_retail", label: "食品販売", iconKey: "food" },
    { id: "hobby_anime", label: "ホビー・アニメ・トレカ", iconKey: "hobby" },
    { id: "pet", label: "ペット用品", iconKey: "pet" },
    { id: "tools_equipment", label: "工具・機材・買取", iconKey: "tools" },
    { id: "other", label: "その他", iconKey: "other" },
  ];

  const PLATFORM_CATEGORY_MATCH = {
    restaurant: ["restaurant"],
    retail: ["retail"],
    vintage_brand: ["vintage_brand"],
    goods_interior: ["goods_interior"],
    food_retail: ["food_retail"],
    hobby_anime: ["hobby_anime"],
    pet: ["pet"],
    tools_equipment: ["tools_equipment"],
    other: ["other", "other_shop", "entertainment", "default"],
  };

  const SHOP_LIST_CATEGORY_KEYS = new Set([
    "restaurant",
    "retail",
    "vintage_brand",
    "goods_interior",
    "food_retail",
    "hobby_anime",
    "pet",
    "tools_equipment",
    "other",
  ]);

  function platformCatIconSvg(iconKey) {
    const s =
      'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"';
    const icons = {
      all: `<svg ${s}><path d="M16 5l1.8 5.5h5.7l-4.6 3.4 1.8 5.5-4.7-3.5-4.7 3.5 1.8-5.5-4.6-3.4h5.7z"/><path d="M9 24.5h2.2l1.3 3.5 1.3-3.5h2.2"/></svg>`,
      restaurant: `<svg ${s}><path d="M12 7v17"/><path d="M12 7c0-2.2 1.8-3.5 3.5-3.5S19 4.8 19 7v3.5c0 2-1.6 3.2-3.5 3.2S12 12.5 12 10.5V7z"/><path d="M22 9v15"/><path d="M22 9c0-1.6 1.3-2.8 2.8-2.8S27.5 7.4 27.5 9v2c0 1.6-1.3 2.8-2.8 2.8S22 12.6 22 11V9z"/></svg>`,
      retail: `<svg ${s}><path d="M10 12V9a6 6 0 0112 0v3"/><path d="M8 12h16l-1.2 14H9.2L8 12z"/><path d="M13 16v6M19 16v6"/></svg>`,
      vintage: `<svg ${s}><path d="M9 8h14l-2 16H11L9 8z"/><path d="M12 8V6a4 4 0 018 0v2"/></svg>`,
      goods: `<svg ${s}><path d="M8 12h16v12H8z"/><path d="M10 12V8a6 6 0 0112 0v4"/><path d="M13 18h6"/></svg>`,
      food: `<svg ${s}><path d="M10 10c0-3 2-5 6-5s6 2 6 5v12H10V10z"/><path d="M13 8V6M19 8V6"/></svg>`,
      hobby: `<svg ${s}><rect x="7" y="9" width="18" height="14" rx="2"/><path d="M11 9V7a5 5 0 0110 0v2"/></svg>`,
      pet: `<svg ${s}><circle cx="11" cy="12" r="2.5"/><circle cx="21" cy="11" r="2"/><path d="M7 22c1.5-3 3.5-4.5 6.5-4.5S19 19 21 22"/></svg>`,
      tools: `<svg ${s}><path d="M8 22l12-12"/><path d="M14 6l4 4"/><path d="M6 14l4 4"/><path d="M19 9l-2 2"/></svg>`,
      other: `<svg ${s}><circle cx="10" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="22" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    };
    return icons[iconKey] || icons.other;
  }

  /** カテゴリ別デフォルト画像（一覧カード用）— 404にならないURLのみ */
  const STORE_IMAGE_SAFE_FALLBACK = "images/tasful-logo.webp";

  /** 過去監査で404確認済み — 初期src/fallback候補から除外 */
  const KNOWN_BROKEN_IMAGE_RE = [
    /photo-1555529669-e69e7a0ba4b6/i,
    /photo-1554118811-1e0d58220f8b/i,
    /photo-1509041957926-efce04ca5458/i,
    /photo-1442512595331-e89fb7384f48/i,
    /photo-1528697203043-733bfd65a4ec/i,
    /photo-1612036782180-6f0b6cd3e2e4/i,
    /photo-1614680376573-df3480f0b6d4/i,
    /photo-1583511655857-d189b9a8b0e0/i,
    /photo-1516734212184-a967f81ad1d6/i,
  ];

  const PLATFORM_HERO_FALLBACKS = {
    "shop-platform-hero__shot--main": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    "shop-platform-hero__shot--coffee": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
    "shop-platform-hero__shot--salon": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    "shop-platform-hero__shot--tools": "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80",
    "shop-platform-hero__shot--flowers": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80",
    "shop-platform-hero__shot--lounge": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&q=80",
  };

  const CATEGORY_IMAGE_DEFAULTS = {
    restaurant: {
      main: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=400&q=80",
      ],
    },
    retail: {
      main: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
      ],
    },
    vintage_brand: {
      main: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
      ],
    },
    goods_interior: {
      main: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
      ],
    },
    food_retail: {
      main: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1490479768151-ba697f524b0b?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80",
      ],
    },
    hobby_anime: {
      main: "https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=400&q=80",
      ],
    },
    tools_equipment: {
      main: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=400&q=80",
      ],
    },
    pet: {
      main: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=960&q=80",
      thumbs: [
        "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=400&q=80",
      ],
    },
    other: {
      main: "https://placehold.co/800x600/7c3aed/ffffff?text=Shop+Store",
      thumbs: [
        "https://placehold.co/400x300/8b5cf6/ffffff?text=Handmade",
        "https://placehold.co/400x300/6366f1/ffffff?text=Event",
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
      ],
    },
    default: {
      main: "images/hero-bg.webp",
      thumbs: [
        "images/tasful-logo.webp",
        "images/pr-banner.webp",
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
      ],
    },
  };

  function getCategoryImagePack(listing) {
    const key = getListingCategoryKey(listing);
    return CATEGORY_IMAGE_DEFAULTS[key] || CATEGORY_IMAGE_DEFAULTS.default;
  }

  function normalizeImageSrc(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    if (/ui-avatars\.com/i.test(s)) return "";
    return s;
  }

  function isKnownBrokenImageUrl(url) {
    const s = normalizeImageSrc(url);
    if (!s) return true;
    return KNOWN_BROKEN_IMAGE_RE.some((re) => re.test(s));
  }

  function pickDistinctImageUrl(primary, candidate, ultimate = STORE_IMAGE_SAFE_FALLBACK) {
    const p = normalizeImageSrc(primary);
    const c = normalizeImageSrc(candidate);
    if (c && c !== p && !isKnownBrokenImageUrl(c)) return c;
    const u = normalizeImageSrc(ultimate);
    if (u && u !== p) return u;
    return STORE_IMAGE_SAFE_FALLBACK;
  }

  function pickFirstImageUrl(candidates) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    for (const c of list) {
      const s = normalizeImageSrc(c);
      if (s) return s;
    }
    return "";
  }

  function getStoreFallbackMainUrl(listing) {
    const main = normalizeImageSrc(getCategoryImagePack(listing).main);
    return main || STORE_IMAGE_SAFE_FALLBACK;
  }

  function getStoreFallbackThumbUrl(listing, index = 0, excludeSrc = "") {
    const pack = getCategoryImagePack(listing);
    const thumbs = Array.isArray(pack.thumbs) ? pack.thumbs : [];
    const exclude = normalizeImageSrc(excludeSrc);
    const candidates = [
      thumbs[index],
      ...thumbs,
      pack.main,
      CATEGORY_IMAGE_DEFAULTS.default.main,
      STORE_IMAGE_SAFE_FALLBACK,
    ];
    const seen = new Set();
    for (const raw of candidates) {
      const s = normalizeImageSrc(raw);
      if (!s || seen.has(s) || s === exclude || isKnownBrokenImageUrl(s)) continue;
      seen.add(s);
      return s;
    }
    return exclude === STORE_IMAGE_SAFE_FALLBACK ? STORE_IMAGE_SAFE_FALLBACK : pickDistinctImageUrl(exclude, STORE_IMAGE_SAFE_FALLBACK);
  }

  function collectListingMainImageCandidates(listing) {
    const extra = pickShopExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const images = Array.isArray(listing?.images) ? listing.images : [];
    const productImages = Array.isArray(listing?.product_images) ? listing.product_images : [];
    const fdProductImages = Array.isArray(fd?.product_images) ? fd.product_images : [];
    return [
      listing?.main_image,
      listing?.mainImage,
      listing?.image_url,
      listing?.imageUrl,
      listing?.thumbnail_url,
      listing?.thumbnailUrl,
      images[0],
      productImages[0],
      fdProductImages[0],
      extra?.main_image,
      extra?.image_url,
      fd?.main_image,
      fd?.image_url,
      listing?.gallery_urls?.[0],
      fd?.gallery_urls?.[0],
      listing?.gallery_images?.[0],
      fd?.gallery_images?.[0],
    ];
  }

  function collectProductImageUrls(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const urls = [];
    const push = (raw) => {
      const s = normalizeImageSrc(raw);
      if (!s || urls.includes(s)) return;
      urls.push(s);
    };
    (listing?.product_images || fd?.product_images || []).forEach((u) => push(u));
    (listing?.products || fd?.products || []).forEach((p) => {
      if (!p || typeof p !== "object") return;
      push(p.image_url);
      push(p.image);
      push(p.img);
      push(p.product_image_url);
      push(p.imageUrl);
    });
    return urls;
  }

  function buildListingImgTag(src, listing, options = {}) {
    const className = String(options.className || "").trim();
    const thumbIndex = Number(options.thumbIndex);
    const idx = Number.isFinite(thumbIndex) ? thumbIndex : 0;
    let safeSrc = normalizeImageSrc(src);
    if (!safeSrc || isKnownBrokenImageUrl(safeSrc)) {
      safeSrc = getStoreFallbackThumbUrl(listing, idx, safeSrc);
    }
    const safeFallback = pickDistinctImageUrl(safeSrc, getStoreFallbackThumbUrl(listing, idx, safeSrc));
    return `<img class="${escapeAttr(className)}" src="${escapeAttr(safeSrc)}" data-shop-img-fallback="${escapeAttr(
      safeFallback
    )}" data-shop-img-safe="${escapeAttr(STORE_IMAGE_SAFE_FALLBACK)}" alt="" loading="lazy" decoding="async">`;
  }

  function bindListingCardImages(root) {
    const scope = root || document;
    scope.querySelectorAll("img[data-shop-img-fallback]").forEach((img) => {
      if (img.dataset.shopImgBound === "1") return;
      img.dataset.shopImgBound = "1";
      img.addEventListener("error", () => {
        const fb = String(img.getAttribute("data-shop-img-fallback") || "").trim();
        const safe = String(img.getAttribute("data-shop-img-safe") || STORE_IMAGE_SAFE_FALLBACK).trim();
        const cur = normalizeImageSrc(img.src);
        if (!img.dataset.shopImgTriedFallback && fb && fb !== cur && fb !== safe && !isKnownBrokenImageUrl(fb)) {
          img.dataset.shopImgTriedFallback = "1";
          img.src = fb;
          return;
        }
        img.dataset.shopImgTriedFallback = "1";
        if (!img.dataset.shopImgTriedSafe && safe && safe !== cur) {
          img.dataset.shopImgTriedSafe = "1";
          img.onerror = null;
          img.src = safe;
        }
      });
    });
  }

  function bindPlatformHeroImages() {
    const hero = document.querySelector(".shop-platform-hero");
    if (!hero) return;
    hero.querySelectorAll(".shop-platform-hero__shot").forEach((shot) => {
      const img = shot.querySelector("img");
      if (!img) return;
      const mod = [...shot.classList].find(
        (c) => c.startsWith("shop-platform-hero__shot--") && c !== "shop-platform-hero__shot"
      );
      const defaultFb = PLATFORM_HERO_FALLBACKS[mod] || STORE_IMAGE_SAFE_FALLBACK;
      let src = normalizeImageSrc(img.getAttribute("src"));
      if (!src || isKnownBrokenImageUrl(src)) src = defaultFb;
      img.src = src;
      const fbAttr = normalizeImageSrc(img.getAttribute("data-shop-img-fallback"));
      const safeAttr = normalizeImageSrc(img.getAttribute("data-shop-img-safe")) || STORE_IMAGE_SAFE_FALLBACK;
      img.setAttribute("data-shop-img-fallback", pickDistinctImageUrl(src, fbAttr || defaultFb));
      img.setAttribute("data-shop-img-safe", safeAttr);
    });
    bindListingCardImages(hero);
  }

  function applyStoreCategoryFields(listing) {
    if (window.TasuShopDetailCategory?.applyStoreCategoryToListing) {
      return window.TasuShopDetailCategory.applyStoreCategoryToListing(listing);
    }
    const label =
      window.TasuShopDetailCategory?.getNormalizedStoreCategoryLabel?.(listing) || "店舗・販売";
    listing.normalized_store_category = label;
    return listing;
  }

  function getListingStoreCategoryLabel(listing) {
    applyStoreCategoryFields(listing);
    return String(listing?.normalized_store_category || "").trim() || "その他";
  }

  function getListingCategoryKey(listing) {
    applyStoreCategoryFields(listing);
    return String(listing?.store_category_key || "").trim() || "other";
  }

  function isRetailShopListing(listing) {
    const key = resolveListingCategoryKey(listing);
    if (key === "other") return true;
    if (String(listing?.category || "").trim() === "その他") return true;
    if (SERVICE_SHOP_PROFILE_KEYS.has(key)) return false;
    if (SHOP_LIST_CATEGORY_KEYS.has(key)) return true;
    const hay = listingHaystackForCategory(listing);
    const serviceLike =
      /美容|サロン|エステ|ネイル|まつげ|リラク|マッサージ|整体|もみほぐし|修理|メンテ|修繕|リフォーム|建築|工事|スクール|教室|生活サービス|便利屋|出張修理/i.test(
        hay
      );
    const retailLike =
      /飲食|カフェ|小売|物販|古着|ブランド|雑貨|インテリア|食品|グルメ|ホビー|アニメ|トレカ|ペット|工具|機材|ショップ|販売|EC|商品|買取|中古/i.test(
        hay
      );
    if (serviceLike && !retailLike) return false;
    return retailLike;
  }

  function resolveListingHeroImage(listing) {
    applyStoreCategoryFields(listing);
    const found = pickFirstImageUrl(collectListingMainImageCandidates(listing));
    if (found) return found;
    const fromProducts = collectProductImageUrls(listing)[0];
    if (fromProducts) return fromProducts;
    return getStoreFallbackMainUrl(listing);
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function safeText(value, fallback = "") {
    const s = String(value ?? "").trim();
    return s && s !== "undefined" && s !== "null" ? s : fallback;
  }

  function normalizeBusinessType(listing) {
    const bt = String(listing?.business_type || listing?.form_data?.business_type || "").trim();
    if (bt === "shop_store" || bt === "field_service") return bt;
    if (window.TasuBusinessCategories?.getBusinessType) {
      const inferred = window.TasuBusinessCategories.getBusinessType(listing);
      if (inferred === "shop_store" || inferred === "field_service") return inferred;
    }
    return "";
  }

  function buildStars(score) {
    const v = Number(score) || 0;
    const full = Math.max(0, Math.min(5, Math.round(v)));
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  function pickShopExtra(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing?.category_extra || fd.category_extra || {};
    return extra.shop_store || extra.store || extra.store_field_service || {};
  }

  function tagBlob(listing) {
    const extra = pickShopExtra(listing);
    return [
      ...(listing.tags || []),
      ...(listing.service_tags || []),
      extra.store_type,
      extra.shop_description,
    ]
      .join(" ")
      .toLowerCase();
  }

  function shopSupportYes(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return false;
    return raw === "yes" || raw === "true" || raw === "1" || raw === "対応" || raw === "可" || raw === "あり";
  }

  function tagIncludes(listing, pattern) {
    return pattern.test(tagBlob(listing));
  }

  function anyFastShip(listing) {
    const extra = pickShopExtra(listing);
    if (shopSupportYes(extra.fast_shipping)) return true;
    return (listing.products || []).some((p) => String(p?.fast_ship || "").trim().toLowerCase() === "yes");
  }

  function hasInStock(listing) {
    return (listing.products || []).some((p) => {
      const s = String(p?.stock || "").trim();
      return s && !/なし|売切|欠品/i.test(s);
    });
  }

  function parsePriceNum(priceStr) {
    const n = parseInt(String(priceStr || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function priceRangeFromListing(listing) {
    const priceLabel = safeText(listing?.priceLabel || listing?.price_label, "");
    if (priceLabel) return priceLabel;
    const fixed = safeText(listing?.price_range || listing?.form_data?.price_range, "");
    if (fixed) return fixed;
    const products = listing?.products || [];
    const nums = products.map((p) => parsePriceNum(p?.price)).filter((n) => n != null);
    if (!nums.length) return "価格はお問い合わせ";
    const min = Math.min(...nums);
    return `¥${min.toLocaleString("ja-JP")}〜`;
  }

  function repCategory(listing) {
    const products = listing.products || [];
    const counts = {};
    products.forEach((p) => {
      const c = safeText(p.category, "");
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) return top[0];
    return safeText(pickShopExtra(listing).store_type, "店舗・販売");
  }

  function locationLine(listing) {
    const extra = pickShopExtra(listing);
    const addr = safeText(extra.address, "");
    if (addr) {
      const m = addr.match(/^(..+?[都道府県])\s*(.+?[市区町村])?/);
      if (m) return [m[1], m[2]].filter(Boolean).join(" ");
      return addr.length > 28 ? `${addr.slice(0, 28)}…` : addr;
    }
    const area = safeText(extra.visit_area || listing.service_area, "—");
    return area.length > 32 ? `${area.slice(0, 32)}…` : area;
  }

  function isVerified(listing) {
    if (listing.verified || listing.is_verified) return true;
    if (String(listing.pr_plan || "").trim() === "apply") return true;
    if (String(listing.id || "").startsWith("demo-")) return true;
    return false;
  }

  function getFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }

  function toggleFavorite(id) {
    const key = String(id || "").trim();
    if (!key) return getFavorites();
    const set = new Set(getFavorites());
    if (set.has(key)) set.delete(key);
    else set.add(key);
    const next = [...set];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }

  function isFavorite(id) {
    return getFavorites().includes(String(id || "").trim());
  }

  function buildDisplayTags(listing) {
    const extra = pickShopExtra(listing);
    const tags = [];
    if (shopSupportYes(extra.used_sales) || tagIncludes(listing, /中古/)) tags.push("中古販売");
    if (shopSupportYes(extra.buyback_support) || tagIncludes(listing, /買取/)) tags.push("買取対応");
    if (shopSupportYes(extra.corporate_contract) || listing.isCorporateWelcome || tagIncludes(listing, /法人/))
      tags.push("法人対応");
    if (tagIncludes(listing, /店舗受取|店頭受取|店頭受け取り/)) tags.push("店舗受取OK");
    return [...new Set(tags)].slice(0, 4);
  }

  function buildStatusBadges(listing) {
    const extra = pickShopExtra(listing);
    const badges = [];
    if (shopSupportYes(extra.sales_support) || (listing.products || []).length)
      badges.push({ label: "販売中", kind: "sale" });
    if (shopSupportYes(extra.buyback_support) || tagIncludes(listing, /買取/))
      badges.push({ label: "買取対応", kind: "buyback" });
    if (anyFastShip(listing)) badges.push({ label: "即日発送", kind: "ship" });
    if (shopSupportYes(extra.credit_support) || tagIncludes(listing, /クレジット|カード/))
      badges.push({ label: "クレジットOK", kind: "neutral" });
    if (shopSupportYes(extra.corporate_contract) || tagIncludes(listing, /法人/))
      badges.push({ label: "法人対応", kind: "neutral" });
    return badges.slice(0, 5);
  }

  function resolveListingCategoryKey(listing) {
    if (window.TasuShopDetailCategory?.resolveShopCategoryKey) {
      return window.TasuShopDetailCategory.resolveShopCategoryKey(listing);
    }
    return "default";
  }

  function collectPreviewImages(listing, limit = 3) {
    applyStoreCategoryFields(listing);
    const extra = pickShopExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const main = resolveListingHeroImage(listing);
    const urls = [];
    const push = (u) => {
      const s = normalizeImageSrc(u);
      if (!s || s === main || urls.includes(s)) return;
      urls.push(s);
    };

    collectProductImageUrls(listing).forEach((u) => push(u));
    (listing?.gallery_urls || fd?.gallery_urls || []).forEach((u) => push(u));
    (listing?.gallery_images || fd?.gallery_images || []).forEach((g) => {
      if (typeof g === "string") push(g);
      else push(g?.url || g?.image_url || g?.image);
    });
    (Array.isArray(listing?.images) ? listing.images : []).forEach((u) => push(u));
    const cases = listing.work_cases || fd.work_cases || extra.work_cases || [];
    (Array.isArray(cases) ? cases : []).forEach((c) => push(c?.image_url || c?.image));

    if (urls.length < limit) {
      getCategoryImagePack(listing).thumbs.forEach((u) => push(u));
    }

    const pack = getCategoryImagePack(listing);
    while (urls.length < limit) {
      const fb = pack.thumbs[urls.length] || pack.thumbs[0] || pack.main;
      if (!fb || urls.includes(fb)) break;
      urls.push(fb);
    }

    return urls.slice(0, limit);
  }

  function buildHeroOverlayThumbsHtml(listing, detailHref) {
    const thumbs = collectPreviewImages(listing, 3);
    if (!thumbs.length) return "";
    return `<div class="shop-store-card__hero-thumbs" aria-hidden="true">
      <div class="shop-store-card__hero-thumbs-inner">
      ${thumbs
        .map(
          (src, i) =>
            `<a class="shop-store-card__hero-thumb" href="${escapeAttr(detailHref)}">${buildListingImgTag(src, listing, {
              className: "",
              thumbIndex: i,
            })}</a>`
        )
        .join("")}
      </div>
    </div>`;
  }

  function matchesPlatformCategory(listing, platformCat) {
    if (!platformCat) return true;
    const key = getListingCategoryKey(listing);
    const allowed = PLATFORM_CATEGORY_MATCH[platformCat];
    return Boolean(allowed && allowed.includes(key));
  }

  function listingHaystackForCategory(listing) {
    const extra = pickShopExtra(listing);
    return [
      listing?.title,
      listing?.description,
      extra.store_type,
      extra.shop_description,
      listing?.form_data?.shop_store_category,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function resolveCanonicalShopDetailId(listing) {
    const primary = String(listing?.id || "").trim();
    const demoRef = String(
      listing?.demo_id || listing?.form_data?.demo_id || listing?.form_data?.demoId || ""
    ).trim();
    const loader = window.TasuDetailShopStoreLoader;
    const resolvedPrimary = loader?.resolveShopListingId?.(primary) || primary;

    if (window.TasuShopStoreDemo?.getById?.(resolvedPrimary)) {
      return resolvedPrimary;
    }
    const resolvedDemo = loader?.resolveShopListingId?.(demoRef) || demoRef;
    if (resolvedDemo && window.TasuShopStoreDemo?.getById?.(resolvedDemo)) {
      return resolvedDemo;
    }
    return resolvedPrimary || resolvedDemo;
  }

  function getDetailIdForUrl(listing) {
    return resolveCanonicalShopDetailId(listing);
  }

  function getDetailUrl(listing) {
    const rawId = getDetailIdForUrl(listing);
    if (!rawId) {
      console.warn("[shop-store] missing listing.id", listing);
      return "";
    }
    const id = encodeURIComponent(rawId);
    return `detail-shop-store.html?id=${id}`;
  }

  function getProductsUrl(listing) {
    const rawId = getDetailIdForUrl(listing);
    if (!rawId) return "";
    return `shop-products.html?id=${encodeURIComponent(rawId)}`;
  }

  function primaryCtaLabel() {
    return "商品を見る";
  }

  function secondaryCtaLabel(listing) {
    const key = getListingCategoryKey(listing);
    const hasProducts = (listing?.products || []).length > 0;
    if (key === "other" && !hasProducts) return "詳細を見る";
    return "ショップを見る";
  }

  function primaryCtaForListing(listing) {
    const detailHref = getDetailUrl(listing);
    const productsHref = getProductsUrl(listing);
    const hasProducts = (listing?.products || []).length > 0;
    if (!hasProducts && getListingCategoryKey(listing) === "other") {
      return { href: detailHref, label: "詳細を見る" };
    }
    return { href: productsHref || detailHref, label: primaryCtaLabel() };
  }

  function productCountLine(listing) {
    const n = (listing?.products || []).length;
    if (!n) return "";
    return `商品${n}点`;
  }

  function buildEcHeroBadges(listing) {
    const badges = [];
    const created = new Date(listing?.created_at || listing?.updated_at || 0).getTime();
    if (created && (Date.now() - created) / 86400000 < 21) {
      badges.push({ label: "NEW", kind: "new" });
    }
    const products = listing?.products || [];
    const hasSale = products.some((p) => /sale|セール|％|off/i.test(String(p?.tag || p?.price || "")));
    if (hasSale || /セール|SALE/i.test(tagBlob(listing))) {
      badges.push({ label: "SALE", kind: "sale" });
    }
    const status = buildStatusBadges(listing)[0];
    if (status && !badges.length) badges.push(status);
    return badges.slice(0, 2);
  }

  function pillModifierClass(pill) {
    const p = safeText(pill, "");
    if (!p) return "";
    if (/職人|技/.test(p)) return " shop-store-card__pill--craft";
    if (/おすすめ|人気サロン|人気の/.test(p)) return " shop-store-card__pill--featured";
    if (/販売/.test(p)) return " shop-store-card__pill--sale";
    if (/サロン/.test(p)) return " shop-store-card__pill--salon";
    return "";
  }

  function buildCardHtml(listing) {
    applyStoreCategoryFields(listing);
    const extra = pickShopExtra(listing);
    const id = String(listing?.id || "").trim();
    const imageUrl = resolveListingHeroImage(listing);
    const heroFallback = getStoreFallbackMainUrl(listing);
    const storeName = safeText(extra.shop_name || listing.company_name || listing.title, "店舗");
    const storeType = getListingStoreCategoryLabel(listing);
    const rating = Number(listing.rating || listing.reviewAvg || 0) || 0;
    const reviewCount = Number(listing.review_count || listing.reviewCount || 0) || 0;
    const detailHref = getDetailUrl(listing);
    const primaryCta = primaryCtaForListing(listing);
    const detailDisabled = !detailHref;
    const favOn = isFavorite(id);
    const priceLine = priceRangeFromListing(listing);
    const profileKey = resolveListingCategoryKey(listing);
    const productCount = productCountLine(listing);
    const desc = safeText(listing.description || extra.shop_description, "");
    const descShort = desc.length > 96 ? `${desc.slice(0, 96)}…` : desc;
    const listingTags = [...new Set([...(listing.tags || []), ...(listing.service_tags || [])])].slice(
      0,
      5
    );
    const ecBadges = buildEcHeroBadges(listing);
    const badgesHtml = ecBadges
      .map((b) => `<span class="shop-store-card__ec-badge shop-store-card__ec-badge--${escapeAttr(b.kind)}">${escapeHtml(b.label)}</span>`)
      .join("");

    return `<article class="shop-store-card shop-store-card--vertical shop-store-card--ec" data-id="${escapeAttr(id)}" data-shop-profile="${escapeAttr(profileKey)}">
      <div class="shop-store-card__hero">
        <a class="shop-store-card__hero-media shop-card-image store-card-image retail-card-image${detailDisabled ? " is-disabled" : ""}" href="${escapeAttr(
          detailHref || "#"
        )}" data-breadcrumb-label="店舗詳細" ${detailDisabled ? 'aria-disabled="true" tabindex="-1"' : ""}>
          ${buildListingImgTag(imageUrl, listing, {
            className: "shop-store-card__hero-img",
            fallback: heroFallback,
            thumbIndex: 0,
          })}
        </a>
        ${badgesHtml ? `<div class="shop-store-card__ec-badges">${badgesHtml}</div>` : ""}
        <button type="button" class="shop-store-card__fav${favOn ? " is-active" : ""}" data-shop-fav="${escapeAttr(id)}" aria-label="お気に入り">${favOn ? "♥" : "♡"}</button>
        ${detailDisabled ? "" : buildHeroOverlayThumbsHtml(listing, detailHref)}
      </div>
      <div class="shop-store-card__content">
        <span class="shop-store-card__tag">${escapeHtml(storeType)}</span>
        <h2 class="shop-store-card__name"><a href="${escapeAttr(detailHref || "#")}" data-breadcrumb-label="店舗詳細" ${
          detailDisabled ? 'aria-disabled="true" tabindex="-1"' : ""
        }>${escapeHtml(storeName)}</a></h2>
        <div class="shop-store-card__ec-meta">
          <span class="shop-store-card__rating">
            <span class="shop-store-card__stars" aria-hidden="true">${escapeHtml(buildStars(rating))}</span>
            <strong>${escapeHtml(rating ? rating.toFixed(1) : "—")}</strong>
            <span class="shop-store-card__reviews">(${escapeHtml(String(reviewCount))})</span>
          </span>
          ${productCount ? `<span class="shop-store-card__product-count">${escapeHtml(productCount)}</span>` : ""}
        </div>
        ${descShort ? `<p class="shop-store-card__desc">${escapeHtml(descShort)}</p>` : ""}
        <p class="shop-store-card__price shop-store-card__price--ec">${escapeHtml(priceLine)}</p>
        <p class="shop-store-card__location shop-store-card__location--ec"><span class="shop-store-card__location-icon" aria-hidden="true">📍</span>${escapeHtml(locationLine(listing))}</p>
        ${
          listingTags.length
            ? `<div class="shop-store-card__chips" aria-label="タグ">${listingTags
                .map((t) => `<span class="shop-store-card__chip">${escapeHtml(t)}</span>`)
                .join("")}</div>`
            : ""
        }
        <div class="shop-store-card__actions shop-store-card__actions--ec${
          primaryCta.label === secondaryCtaLabel(listing) && !productCount ? " shop-store-card__actions--single" : ""
        }">
          <a class="shop-store-btn shop-store-btn--gold shop-store-btn--shop" href="${escapeAttr(primaryCta.href || "#")}" data-breadcrumb-label="商品一覧" ${detailDisabled ? 'aria-disabled="true" tabindex="-1"' : ""}><span class="shop-store-btn__icon" aria-hidden="true">🛍</span>${escapeHtml(primaryCta.label)}</a>
          ${
            primaryCta.label === secondaryCtaLabel(listing) && !productCount
              ? ""
              : `<a class="shop-store-btn shop-store-btn--outline shop-store-btn--detail${detailDisabled ? " is-disabled" : ""}" href="${escapeAttr(
                  detailHref || "#"
                )}" ${detailDisabled ? 'aria-disabled="true" tabindex="-1"' : ""}>${escapeHtml(secondaryCtaLabel(listing))}</a>`
          }
        </div>
      </div>
    </article>`;
  }

  function renderCategoryStrip() {
    const track = $("[data-shop-platform-categories]");
    if (!track) return;
    const active = document.body.dataset.shopPlatformCategory || "";
    track.innerHTML = PLATFORM_CATEGORIES.map((cat) => {
      const isActive = cat.id === active;
      return `<button type="button" class="shop-platform-cat${isActive ? " is-active" : ""}" data-shop-platform-cat="${escapeAttr(cat.id)}" aria-pressed="${isActive}">
        <span class="shop-platform-cat__icon" aria-hidden="true">${platformCatIconSvg(cat.iconKey)}</span>
        <span class="shop-platform-cat__label">${escapeHtml(cat.label)}</span>
      </button>`;
    }).join("");
  }

  function buildSubcategoryOptions() {
    const subs = PLATFORM_CATEGORIES.filter((c) => c.id);
    $all("[data-shop-store-subcategory]").forEach((select) => {
      const current = select.value;
      while (select.options.length > 1) select.remove(1);
      subs.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = String(c.id || "").trim();
        opt.textContent = String(c.label || c.id || "").trim();
        select.appendChild(opt);
      });
      if (current) select.value = current;
    });
  }

  function buildPrefectureOptions() {
    const select = $("[data-shop-store-area-pref]");
    if (!select) return;
    PREFECTURES.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
  }

  function readFilterState() {
    const top = $("[data-shop-store-filter-form]");
    const side = $("[data-shop-store-sidebar-form]");
    const topData = top ? new FormData(top) : new FormData();
    const sideData = side ? new FormData(side) : new FormData();

    const checks = {};
    $all("[data-shop-store-check]").forEach((el) => {
      const key = el.getAttribute("data-shop-store-check");
      if (key) checks[key] = el.checked;
    });

    return {
      keyword: String(topData.get("keyword") || "").trim(),
      platformCategory: String(document.body.dataset.shopPlatformCategory || "").trim(),
      subcategory: String(topData.get("subcategory") || sideData.get("subcategory") || "").trim(),
      area: String(topData.get("area") || "").trim(),
      areaPref: String(sideData.get("area_pref") || "").trim(),
      areaCity: String(sideData.get("area_city") || "").trim(),
      salesType: String(topData.get("sales_type") || "").trim(),
      checks,
      quickTag: document.body.dataset.shopQuickTag || "",
    };
  }

  function syncTopFromSidebar() {
    const side = $("[data-shop-store-sidebar-form]");
    const top = $("[data-shop-store-filter-form]");
    if (!side || !top) return;
    const sub = side.querySelector("[name='subcategory']");
    const topSub = top.querySelector("[name='subcategory']");
    if (sub && topSub) topSub.value = sub.value;
    const pref = side.querySelector("[name='area_pref']");
    const city = side.querySelector("[name='area_city']");
    const areaInput = top.querySelector("[name='area']");
    if (areaInput) {
      const parts = [pref?.value, city?.value].filter(Boolean);
      if (parts.length) areaInput.value = parts.join(" ");
    }
  }

  function syncSidebarFromTop() {
    const side = $("[data-shop-store-sidebar-form]");
    const top = $("[data-shop-store-filter-form]");
    if (!side || !top) return;
    const topData = new FormData(top);
    const sub = topData.get("subcategory");
    const sideSub = side.querySelector("[name='subcategory']");
    if (sideSub && sub != null) sideSub.value = String(sub);
    const area = String(topData.get("area") || "").trim();
    if (area) {
      const pref = PREFECTURES.find((p) => area.includes(p));
      const prefEl = side.querySelector("[name='area_pref']");
      const cityEl = side.querySelector("[name='area_city']");
      if (prefEl && pref) {
        prefEl.value = pref;
        if (cityEl) cityEl.value = area.replace(pref, "").trim();
      } else if (cityEl) cityEl.value = area;
    }
  }

  function applyQuickTag(tag) {
    document.body.dataset.shopQuickTag = tag || "";
    $all(".shop-store-quicktag").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-shop-quicktag") === tag);
    });
    const map = {
      中古販売: "used_sales",
      法人対応: "corporate",
      即日発送: "same_day",
      店舗受取OK: "store_pickup",
      クレジット対応: "credit",
      オンライン相談: "online",
    };
    const key = map[tag];
    if (!key) return;
    const el = $(`[data-shop-store-check='${key}']`);
    if (el) el.checked = true;
  }

  async function fetchShopStoreItems() {
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
      if (/^demo-biz-store-/i.test(id)) return false;
      const demoRef = String(it?.demo_id || it?.form_data?.demo_id || "").trim();
      if (demoRef && shopDemoIds.has(demoRef)) return false;
      if (demoRef && window.TasuShopStoreDemo?.getById?.(demoRef)) return false;
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

  function bindFavoriteButtons(root, items) {
    $all("[data-shop-fav]", root).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(btn.getAttribute("data-shop-fav"));
        render(items);
      });
    });
  }

  function matchesKeyword(listing, kw) {
    if (!kw) return true;
    const extra = pickShopExtra(listing);
    const hay = [
      listing.company_name,
      listing.title,
      listing.description,
      extra.shop_name,
      extra.store_type,
      extra.address,
      extra.visit_area,
      listing.service_area,
      (listing.tags || []).join(" "),
      (listing.service_tags || []).join(" "),
      (listing.products || []).map((p) => p?.title).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(String(kw).toLowerCase());
  }

  function matchesArea(listing, area, pref, city) {
    const extra = pickShopExtra(listing);
    const text = `${extra.visit_area || ""} ${listing.service_area || ""} ${extra.address || ""}`;
    if (area && !text.includes(area)) return false;
    if (pref && !text.includes(pref)) return false;
    if (city && !text.includes(city)) return false;
    return true;
  }

  function matchesQuickTag(listing, tag) {
    if (!tag) return true;
    const extra = pickShopExtra(listing);
    switch (tag) {
      case "中古販売":
        return shopSupportYes(extra.used_sales) || tagIncludes(listing, /中古/);
      case "買取対応":
        return shopSupportYes(extra.buyback_support) || tagIncludes(listing, /買取/);
      case "法人対応":
        return shopSupportYes(extra.corporate_contract) || tagIncludes(listing, /法人/);
      case "即日発送":
        return anyFastShip(listing);
      case "店舗受取OK":
        return tagIncludes(listing, /店舗受取|店頭受取/);
      case "クレジット対応":
        return shopSupportYes(extra.credit_support) || tagIncludes(listing, /クレジット|カード/);
      case "オンライン相談":
        return shopSupportYes(extra.show_ai_consult) || tagIncludes(listing, /オンライン|ai/i);
      default:
        return true;
    }
  }

  function filterItems(items) {
    const f = readFilterState();
    const { checks } = f;

    return items.filter((listing) => {
      const extra = pickShopExtra(listing);
      if (!matchesPlatformCategory(listing, f.platformCategory)) return false;
      if (!matchesKeyword(listing, f.keyword)) return false;
      if (!matchesQuickTag(listing, f.quickTag)) return false;
      if (f.subcategory) {
        if (getListingCategoryKey(listing) !== f.subcategory) return false;
      }
      if (!matchesArea(listing, f.area, f.areaPref, f.areaCity)) return false;
      if (f.salesType === "sales" && !shopSupportYes(extra.sales_support)) return false;
      if (f.salesType === "buyback" && !shopSupportYes(extra.buyback_support)) return false;

      if (checks.used_sales && !shopSupportYes(extra.used_sales) && !tagIncludes(listing, /中古/)) return false;
      if (checks.new_sales && !shopSupportYes(extra.new_sales) && !tagIncludes(listing, /新品/)) return false;
      if (checks.in_stock && !hasInStock(listing)) return false;

      if (checks.buyback_instore && !(shopSupportYes(extra.buyback_support) && !shopSupportYes(extra.visit_buyback)))
        return false;
      if (checks.buyback_visit && !shopSupportYes(extra.visit_buyback) && !tagIncludes(listing, /出張買取/))
        return false;
      if (checks.buyback_delivery && !tagIncludes(listing, /宅配/)) return false;

      if (checks.corporate && !(shopSupportYes(extra.corporate_contract) || tagIncludes(listing, /法人/)))
        return false;
      if (checks.same_day && !anyFastShip(listing)) return false;
      if (checks.store_pickup && !tagIncludes(listing, /店舗受取|店頭受取/)) return false;
      if (checks.credit && !shopSupportYes(extra.credit_support) && !tagIncludes(listing, /クレジット|カード/))
        return false;
      if (checks.online && !shopSupportYes(extra.show_ai_consult) && !tagIncludes(listing, /オンライン|ai/i))
        return false;

      return true;
    });
  }

  function sortItems(items) {
    const orderMap = new Map(SHOWCASE_ORDER.map((id, i) => [id, i]));
    const out = [...items];
    out.sort((a, b) => {
      const idA = String(a?.id || "").trim();
      const idB = String(b?.id || "").trim();
      const rankA = orderMap.has(idA) ? orderMap.get(idA) : 1000;
      const rankB = orderMap.has(idB) ? orderMap.get(idB) : 1000;
      if (rankA !== rankB) return rankA - rankB;
      const ta = new Date(a.created_at || a.updated_at || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || 0).getTime();
      return tb - ta;
    });
    return out;
  }

  function render(items) {
    const grid = $("[data-shop-store-grid]");
    const empty = $("[data-shop-store-empty]");
    const count = $("[data-shop-store-count]");
    const loadMore = $("[data-shop-load-more]");
    if (!grid) return;

    const filtered = sortItems(filterItems(items));
    if (count) count.textContent = String(filtered.length);

    if (!filtered.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      if (loadMore) loadMore.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;

    const visible = filtered.slice(0, listVisibleLimit);
    grid.innerHTML = visible.map(buildCardHtml).join("");
    bindListingCardImages(grid);
    bindFavoriteButtons(grid, items);

    if (loadMore) {
      loadMore.hidden = visible.length >= filtered.length;
    }
  }

  function resetFilters() {
    $("[data-shop-store-filter-form]")?.reset();
    $("[data-shop-store-sidebar-form]")?.reset();
    delete document.body.dataset.shopQuickTag;
    delete document.body.dataset.shopPlatformCategory;
    listVisibleLimit = LIST_PAGE_SIZE;
    $all(".shop-store-quicktag").forEach((b) => b.classList.remove("is-active"));
    renderCategoryStrip();
  }

  function applyUrlKeywordToForms() {
    const params = new URLSearchParams(window.location.search);
    const kw = String(params.get("keyword") || params.get("q") || "").trim();
    if (!kw) return;
    const topInput = $("[data-shop-store-filter-form] [name='keyword']");
    const headerInput = $(".shop-market-header__search-input");
    if (topInput) topInput.value = kw;
    if (headerInput) headerInput.value = kw;
  }

  function syncHeaderKeywordFromTop() {
    const topInput = $("[data-shop-store-filter-form] [name='keyword']");
    const headerInput = $(".shop-market-header__search-input");
    if (topInput && headerInput) headerInput.value = topInput.value;
  }

  function initMobileFilterToggle() {
    const toggle = $("[data-shop-store-filter-toggle]");
    const panel = $("[data-shop-store-filter-panel]");
    if (!toggle || !panel) return;

    const mq = window.matchMedia("(max-width: 960px)");

    const setClosed = () => {
      panel.classList.remove("is-open");
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
    };

    const setDesktop = () => {
      panel.classList.remove("is-open");
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "true");
    };

    const syncViewport = () => {
      if (mq.matches) setClosed();
      else setDesktop();
    };

    toggle.addEventListener("click", () => {
      if (!mq.matches) return;
      const open = panel.classList.toggle("is-open");
      toggle.classList.toggle("is-active", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    mq.addEventListener("change", syncViewport);
    syncViewport();
  }

  async function init() {
    if (document.body.dataset.page !== "shop_store_list") return;
    bindPlatformHeroImages();
    buildSubcategoryOptions();
    buildPrefectureOptions();
    applyUrlKeywordToForms();
    renderCategoryStrip();
    initMobileFilterToggle();

    const items = await fetchShopStoreItems();

    const topForm = $("[data-shop-store-filter-form]");
    const sideForm = $("[data-shop-store-sidebar-form]");

    topForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      syncSidebarFromTop();
      syncHeaderKeywordFromTop();
      render(items);
    });

    $(".shop-market-header__search")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const headerInput = $(".shop-market-header__search-input");
      const topInput = $("[data-shop-store-filter-form] [name='keyword']");
      if (headerInput && topInput) topInput.value = headerInput.value;
      render(items);
      document.getElementById("shop-store-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("[data-shop-platform-categories]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-shop-platform-cat]");
      if (!btn) return;
      const id = btn.getAttribute("data-shop-platform-cat") || "";
      const current = document.body.dataset.shopPlatformCategory || "";
      document.body.dataset.shopPlatformCategory = current === id ? "" : id;
      renderCategoryStrip();
      render(items);
      document.getElementById("shop-store-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    sideForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      syncTopFromSidebar();
      render(items);
      const panel = $("[data-shop-store-filter-panel]");
      const toggle = $("[data-shop-store-filter-toggle]");
      if (window.matchMedia("(max-width: 960px)").matches && panel && toggle) {
        panel.classList.remove("is-open");
        toggle.classList.remove("is-active");
        toggle.setAttribute("aria-expanded", "false");
        document.getElementById("shop-store-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    $("[data-shop-store-filter-clear]")?.addEventListener("click", () => {
      resetFilters();
      render(items);
    });

    $all("[data-shop-store-check]").forEach((el) => {
      el.addEventListener("change", () => render(items));
    });

    $all(".shop-store-quicktag").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-shop-quicktag") || "";
        const active = btn.classList.contains("is-active");
        resetFilters();
        if (!active) applyQuickTag(tag);
        render(items);
      });
    });

    $("[data-shop-load-more]")?.addEventListener("click", () => {
      listVisibleLimit += LIST_PAGE_SIZE;
      render(items);
    });

    render(items);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
