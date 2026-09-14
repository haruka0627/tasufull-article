/**
 * TASFUL Materials — search / chip filter repository
 *
 * Consumes an existing catalog if one is injected.
 * Does not invent demo assets, counts, or transparency metadata.
 */
(function (global) {
  "use strict";

  function cats() {
    return global.TasuMaterialsCategories;
  }

  function asList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "function") {
      try {
        return asList(value());
      } catch (_err) {
        return [];
      }
    }
    if (Array.isArray(value.items)) return value.items;
    if (typeof value.list === "function") return asList(value.list());
    return [];
  }

  function readCatalog() {
    if (typeof global.TasuMaterialsGetCatalog === "function") {
      return asList(global.TasuMaterialsGetCatalog());
    }
    return asList(global.TasuMaterialsCatalog);
  }

  function itemText(item) {
    const tags = Array.isArray(item?.tags) ? item.tags.join(" ") : String(item?.tags || "");
    return [
      item?.title,
      item?.name,
      item?.description,
      item?.label,
      tags,
      item?.category,
      item?.category_id,
      item?.asset_type,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function itemCategory(item) {
    const C = cats();
    return C.resolveCategoryId(item?.category_id || item?.category || item?.asset_type || "");
  }

  function hasPurposeTags(item) {
    if (item?.purpose || item?.yoto || item?.用途) return true;
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    return tags.some((t) => {
      const s = String(t || "").trim();
      return s.startsWith("用途:") || s.startsWith("yoto:") || s.startsWith("purpose:");
    });
  }

  function isThumbnailItem(item) {
    const C = cats();
    const id = itemCategory(item);
    if (id === "thumbnail") return true;
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    return tags.some((t) => C.normalizeKey(t) === "thumbnail" || String(t) === "サムネイル");
  }

  function matchesFilterValue(item, key, wanted) {
    if (!wanted || wanted === "all") return true;
    const raw = item?.[key] ?? item?.filters?.[key] ?? item?.attrs?.[key];
    if (raw == null || raw === "") return true;
    return String(raw).toLowerCase() === String(wanted).toLowerCase();
  }

  function filterItems(items, query) {
    const C = cats();
    const q = query || {};
    const categoryId = C.resolveCategoryId(q.category || q.category_id || "all") || "all";
    const keyword = String(q.q || q.query || q.keyword || "")
      .trim()
      .toLowerCase();
    const color = String(q.color || "").trim();
    const format = String(q.format || "").trim();
    const slideSize = String(q.slide_size || "").trim();
    const slideTheme = String(q.slide_theme || "").trim();

    return (items || []).filter((item) => {
      const itemCat = itemCategory(item);
      if (categoryId && categoryId !== "all") {
        if (itemCat !== categoryId) return false;
      }
      if (keyword && !itemText(item).includes(keyword)) return false;
      if (color && !matchesFilterValue(item, "color", color)) return false;
      if (format && !matchesFilterValue(item, "format", format)) return false;
      if (categoryId === "presentation") {
        if (slideSize && !matchesFilterValue(item, "slide_size", slideSize)) return false;
        if (slideTheme && !matchesFilterValue(item, "slide_theme", slideTheme)) return false;
      }
      return true;
    });
  }

  function countByCategory(items) {
    const C = cats();
    const counts = Object.create(null);
    C.getPrimaryChips().forEach((chip) => {
      counts[chip.id] = 0;
    });
    C.getLegacyCategories().forEach((chip) => {
      counts[chip.id] = 0;
    });
    (items || []).forEach((item) => {
      const id = itemCategory(item);
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    counts.all = (items || []).length;
    return counts;
  }

  function search(query, catalog) {
    const items = Array.isArray(catalog) ? catalog : readCatalog();
    const filtered = filterItems(items, query);
    return Object.freeze({
      items: filtered,
      total: filtered.length,
      empty: filtered.length === 0,
      counts: countByCategory(items),
      category: cats().resolveCategoryId(query?.category || "all") || "all",
      query: String(query?.q || query?.query || "").trim(),
    });
  }

  function getFindingItems(catalog) {
    const items = Array.isArray(catalog) ? catalog : readCatalog();
    return items.filter((item) => isThumbnailItem(item) && !hasPurposeTags(item));
  }

  const api = Object.freeze({
    readCatalog,
    filterItems,
    countByCategory,
    search,
    getFindingItems,
    itemCategory,
    hasPurposeTags,
    isThumbnailItem,
  });

  global.TasuMaterialsRepository = api;
})(typeof window !== "undefined" ? window : globalThis);
