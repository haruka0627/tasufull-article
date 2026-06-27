/**
 * Business Directory — categories (Phase 1 seed mirror)
 */
(function (global) {
  "use strict";

  const CATEGORIES = [
    { id: "a1000001-0001-4000-8000-000000000001", listing_type: "shop_retail", code: "shop_food", name: "飲食・食品" },
    { id: "a1000001-0001-4000-8000-000000000002", listing_type: "shop_retail", code: "shop_retail_general", name: "小売・雑貨" },
    { id: "a1000001-0001-4000-8000-000000000003", listing_type: "shop_retail", code: "shop_beauty", name: "美容・健康" },
    { id: "a1000001-0001-4000-8000-000000000004", listing_type: "shop_retail", code: "shop_other", name: "その他店舗" },
    { id: "b2000002-0002-4000-8000-000000000001", listing_type: "business_service", code: "biz_construction", name: "建設・リフォーム" },
    { id: "b2000002-0002-4000-8000-000000000002", listing_type: "business_service", code: "biz_cleaning", name: "清掃・メンテナンス" },
    { id: "b2000002-0002-4000-8000-000000000003", listing_type: "business_service", code: "biz_it", name: "IT・Web" },
    { id: "b2000002-0002-4000-8000-000000000004", listing_type: "business_service", code: "biz_other", name: "その他業務サービス" },
  ];

  function forType(listingType) {
    return CATEGORIES.filter((c) => c.listing_type === listingType);
  }

  function findById(id) {
    return CATEGORIES.find((c) => c.id === id) || null;
  }

  global.TasuBusinessDirectoryCategories = { CATEGORIES, forType, findById };
})(typeof window !== "undefined" ? window : globalThis);
