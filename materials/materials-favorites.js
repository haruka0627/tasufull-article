/**
 * TASFUL Materials — お気に入り（共通ダッシュボード TasuFavoriteStore 連携 · type=material）
 */
(function (global) {
  "use strict";

  const MATERIAL_TYPE = "material";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveThumbnailUrl(item) {
    if (!item || typeof item !== "object") return "";
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    if (images[0]?.src) return String(images[0].src);
    return pickStr(item.thumbnail_url, item.preview_image, item.image);
  }

  function resolveDetailUrl(item) {
    const slug = pickStr(item.slug);
    if (!slug) return "/materials/list.html";
    return `/materials/detail?slug=${encodeURIComponent(slug)}`;
  }

  function resolvePriceType(item) {
    if (item?.is_free === false) return "paid";
    return "free";
  }

  function buildRecord(item) {
    const materialId = pickStr(item.id);
    if (!materialId) return null;
    return {
      id: `fav-mat-${materialId}`,
      listingId: materialId,
      listingType: MATERIAL_TYPE,
      title: pickStr(item.title) || materialId,
      category: pickStr(item.category_name, item.category_id),
      image: resolveThumbnailUrl(item),
      price: resolvePriceType(item) === "free" ? "無料" : "有料",
      detailUrl: resolveDetailUrl(item),
      createdAt: new Date().toISOString(),
      priceType: resolvePriceType(item),
    };
  }

  function toStoreListing(item) {
    const record = buildRecord(item);
    if (!record) return null;
    return {
      id: record.listingId,
      listing_id: record.listingId,
      listing_type: MATERIAL_TYPE,
      listingType: MATERIAL_TYPE,
      title: record.title,
      category: record.category,
      image: record.image,
      detailUrl: record.detailUrl,
      slug: pickStr(item.slug),
    };
  }

  function isFavorited(materialId) {
    const Store = global.TasuFavoriteStore;
    if (!Store) return false;
    if (typeof Store.isMaterialFavorited === "function") {
      return Boolean(Store.isMaterialFavorited(materialId));
    }
    return Boolean(Store.isFavorited?.(materialId));
  }

  function add(item) {
    const Store = global.TasuFavoriteStore;
    if (!Store) return { ok: false, reason: "store_unavailable" };
    if (typeof Store.addMaterial === "function") return Store.addMaterial(item);
    const listing = toStoreListing(item);
    if (!listing) return { ok: false, reason: "invalid_item" };
    return Store.addFromListing?.(listing) || { ok: false, reason: "store_unavailable" };
  }

  function remove(materialId) {
    return global.TasuFavoriteStore?.removeByListingId?.(materialId) || { ok: false };
  }

  function toggle(item) {
    const Store = global.TasuFavoriteStore;
    if (!Store) return { ok: false, reason: "store_unavailable" };
    if (typeof Store.toggleMaterial === "function") return Store.toggleMaterial(item);
    const listing = toStoreListing(item);
    if (!listing) return { ok: false, reason: "invalid_item" };
    return Store.toggleListing?.(listing) || { ok: false, reason: "store_unavailable" };
  }

  function updateButton(btn, item) {
    if (!btn || !item) return;
    const saved = isFavorited(item.id);
    btn.classList.toggle("is-favorited", saved);
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    btn.setAttribute("aria-label", saved ? "お気に入りから削除" : "お気に入りに追加");
    const label = saved ? "お気に入り済み" : "お気に入りに追加";
    const textNode = btn.querySelector("[data-mat-favorite-label]");
    if (textNode) textNode.textContent = label;
    const heart = btn.querySelector(".mat-detail-btn__heart, svg");
    if (heart) heart.setAttribute("fill", saved ? "currentColor" : "none");
  }

  global.TasuMaterialsFavorites = {
    MATERIAL_TYPE,
    buildRecord,
    isFavorited,
    add,
    remove,
    toggle,
    updateButton,
    resolveThumbnailUrl,
    resolveDetailUrl,
    resolvePriceType,
  };
})(typeof window !== "undefined" ? window : globalThis);
