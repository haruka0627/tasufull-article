/**
 * お気に入り — localStorage (tasful_favorites)
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_favorites";
  const EVENT_NAME = "tasful-favorites-changed";

  const LISTING_TYPE_LABELS = {
    general: "その他",
    "business-service": "業務サービス",
    business_service: "業務サービス",
    "shop-store": "店舗・販売",
    shop_store: "店舗・販売",
    store: "店舗・販売",
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
  };

  const TYPE_KEY_TO_DETAIL_PAGE = {
    general: "detail-general.html",
    "business-service": "detail-business-service.html",
    business_service: "detail-business-service.html",
    "shop-store": "detail-shop.html",
    shop_store: "detail-shop.html",
    store: "detail-shop.html",
    skill: "detail-skill.html",
    product: "detail-product.html",
    job: "detail-job.html",
    worker: "detail-worker.html",
  };

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function pickImageUrl(listing) {
    if (!listing || typeof listing !== "object") return "";
    const images = Array.isArray(listing.images)
      ? listing.images
      : Array.isArray(listing.gallery_urls)
        ? listing.gallery_urls
        : Array.isArray(listing.galleryUrls)
          ? listing.galleryUrls
          : [];
    return pickStr(
      listing.image,
      listing.imageUrl,
      listing.image_url,
      listing.thumbnail_url,
      listing.main_image_url,
      images[0]
    );
  }

  function formatPriceValue(listing) {
    const label = pickStr(listing?.priceLabel, listing?.price_label);
    if (label) return label;
    const raw = listing?.price ?? listing?.price_amount;
    if (raw === 0 || raw === "0") return "無料";
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return `¥${num.toLocaleString("ja-JP")}`;
    }
    return pickStr(listing?.price_text, listing?.priceText) || "要相談";
  }

  function resolveListingTypeKey(listing) {
    const store = global.TasuListingLocalStore;
    if (store?.resolveListingTypeKey) {
      const key = store.resolveListingTypeKey(listing._localRecord || listing);
      const map = {
        business_service: "business-service",
        shop_store: "shop-store",
        general: "general",
        skill: "skill",
        product: "product",
        job: "job",
        worker: "worker",
      };
      if (map[key]) return map[key];
      if (key) return key;
    }

    const detailType = pickStr(global.document?.body?.dataset?.detailType).toLowerCase();
    if (detailType === "field_service") return "business-service";
    if (detailType) {
      const map = {
        general: "general",
        skill: "skill",
        product: "product",
        job: "job",
        worker: "worker",
        shop_store: "shop-store",
      };
      if (map[detailType]) return map[detailType];
    }

    const lt = pickStr(
      listing?.listingType,
      listing?.listing_type,
      listing?.type,
      listing?.business_type
    )
      .toLowerCase()
      .replace(/_/g, "-");

    if (lt === "business" || lt === "field-service" || lt === "business-service") {
      return "business-service";
    }
    if (lt === "shop-store" || lt === "shop_store" || lt === "store") return "shop-store";
    if (LISTING_TYPE_LABELS[lt] || TYPE_KEY_TO_DETAIL_PAGE[lt]) return lt;
    return "general";
  }

  function buildDetailUrl(listing, listingType, listingId) {
    const store = global.TasuListingLocalStore;
    const record = listing?._localRecord || listing;
    const fromStore = store?.buildDetailPageUrl?.(record);
    if (fromStore && fromStore !== "#") return fromStore;

    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrl) {
      const typeMap = {
        "business-service": "business_service",
        business_service: "business_service",
        "shop-store": "shop",
        shop_store: "shop",
        store: "shop",
        general: "general",
        skill: "skill",
        product: "product",
        job: "job",
        worker: "worker",
      };
      const routeType = typeMap[listingType] || listingType;
      return R.buildDetailUrl(routeType, listingId);
    }
    return "#";
  }

  function newFavoriteId() {
    return `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const safe = Array.isArray(list) ? list : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      dispatchChanged({ list: safe });
    } catch (err) {
      console.warn("[TasuFavoriteStore] save failed:", err);
    }
    return safe;
  }

  function dispatchChanged(detail) {
    try {
      global.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: detail || {},
        })
      );
    } catch {
      /* ignore */
    }
  }

  function findByListingId(listingId) {
    const key = String(listingId || "").trim();
    if (!key) return null;
    return readAll().find((row) => String(row?.listingId || "") === key) || null;
  }

  function isFavorited(listingId) {
    return Boolean(findByListingId(listingId));
  }

  function getAllListingIds() {
    return [...new Set(readAll().map((row) => String(row?.listingId || "").trim()).filter(Boolean))];
  }

  /**
   * @param {object} listing
   * @returns {object|null}
   */
  function buildRecordFromListing(listing) {
    if (!listing || typeof listing !== "object") return null;
    const listingId = pickStr(listing.id, listing.listing_id, listing.demo_id);
    if (!listingId) return null;

    const listingType = resolveListingTypeKey(listing);
    const category = pickStr(
      listing.category,
      listing.categoryLabel,
      listing.business_subcategory,
      listing.normalized_store_category,
      LISTING_TYPE_LABELS[listingType]
    );

    return {
      id: newFavoriteId(),
      listingId,
      listingType,
      title: pickStr(listing.title, listing.name, listing.company_name, listing.service_name) || listingId,
      category: category || LISTING_TYPE_LABELS[listingType] || "",
      image: pickImageUrl(listing),
      price: formatPriceValue(listing),
      detailUrl: buildDetailUrl(listing, listingType, listingId),
      createdAt: new Date().toISOString(),
    };
  }

  function addFromListing(listing) {
    const record = buildRecordFromListing(listing);
    if (!record) return { ok: false, reason: "invalid_listing" };

    const list = readAll();
    if (findByListingId(record.listingId)) {
      return { ok: true, saved: true, duplicate: true, record: findByListingId(record.listingId) };
    }

    list.unshift(record);
    writeAll(list);
    syncLegacyFavoriteIds(record.listingId, true);
    return { ok: true, saved: true, duplicate: false, record };
  }

  function removeByListingId(listingId) {
    const key = String(listingId || "").trim();
    if (!key) return { ok: false, reason: "empty_id" };
    const next = readAll().filter((row) => String(row?.listingId || "") !== key);
    writeAll(next);
    syncLegacyFavoriteIds(key, false);
    return { ok: true, saved: false };
  }

  function toggleListing(listing) {
    const listingId = pickStr(listing?.id, listing?.listing_id);
    if (!listingId) return { ok: false, reason: "empty_id" };
    if (isFavorited(listingId)) {
      removeByListingId(listingId);
      return { ok: true, saved: false };
    }
    return addFromListing(listing);
  }

  /** favorites-list.html 互換（ID のみ） */
  function syncLegacyFavoriteIds(listingId, add) {
    const LEGACY_KEY = "tasful_favorite_listings";
    try {
      const raw = global.localStorage.getItem(LEGACY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const key = String(listingId || "").trim();
      if (!key) return;
      let next = ids;
      if (add) {
        if (!ids.includes(key)) next = [...ids, key];
      } else {
        next = ids.filter((id) => id !== key);
      }
      global.localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  global.TasuFavoriteStore = {
    STORAGE_KEY,
    EVENT_NAME,
    readAll,
    writeAll,
    findByListingId,
    isFavorited,
    getAllListingIds,
    buildRecordFromListing,
    addFromListing,
    removeByListingId,
    toggleListing,
    resolveListingTypeKey,
    formatPriceValue,
    pickImageUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
