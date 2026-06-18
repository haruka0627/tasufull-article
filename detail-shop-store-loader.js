/**
 * 店舗・販売詳細（detail-shop.html）— データ取得
 * - demo-shop-* は UI 確認用デモ
 * - それ以外は Supabase / localStorage の実データ
 */
(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
  const IS_FILE_PROTOCOL = String(root.location?.protocol || "") === "file:";

  const DEMO_SHOP_STORE_ID = "demo-shop-store";
  const SHOP_STORE_OTHER_DEMO_ID = "shop-store-demo-other-001";
  const SHOP_STORE_OTHER_DEMO_IDS = new Set([
    SHOP_STORE_OTHER_DEMO_ID,
    "shop-store-demo-other-002",
    "shop-store-demo-other-003",
  ]);
  const DEMO_SHOP_STORE_ALIASES = new Set(["demo-shop-store", "demo-shop"]);
  const DEMO_SHOP_ID_ALIASES = {
    "demo-shop-kichi-dining": "demo-shop-kiichi-dining",
    "demo-shop-flower": "demo-shop-001",
    /** business-board-demo の店舗行 → shop-store-demo の正規 ID */
    "demo-biz-store-1": "demo-shop-reworks",
  };

  function resolveShopListingId(id) {
    const key = String(id || "").trim();
    const fromRoute = root.TasuListingRouteResolver?.resolveListingId?.(key);
    return fromRoute || DEMO_SHOP_ID_ALIASES[key] || key;
  }

  function fetchShopStoreDemoListingByKey(key) {
    const resolved = resolveShopListingId(String(key || "").trim());
    if (!resolved) return null;
    if (window.TasuListingDemoCatalog?.getShopStoreListing) {
      const catalogRow = window.TasuListingDemoCatalog.getShopStoreListing(resolved);
      if (catalogRow) return normalizeShopStoreListing(catalogRow, "demo-catalog");
    }
    const fromShop = window.TasuShopStoreDemo?.getById?.(resolved);
    if (fromShop) return normalizeShopStoreListing(fromShop, "demo");
    return null;
  }

  function fetchBoardShopStoreDemoListingByKey(key) {
    const resolved = resolveShopListingId(String(key || "").trim());
    if (!resolved) return null;
    const demos = window.TasuBusinessBoardDemo?.getListings?.("") || [];
    const found =
      demos.find((item) => String(item?.id || "").trim() === resolved) ||
      demos.find(
        (item) => String(item?.form_data?.demo_id || item?.demo_id || "").trim() === resolved
      ) ||
      null;
    if (!found) return null;
    const bt = String(found.business_type || found.form_data?.business_type || "").trim();
    if (bt && bt !== "shop_store") return null;
    return normalizeShopStoreListing(found, "demo-board");
  }

  function shouldPreferDemoDatasetBeforeLocal(key) {
    const k = resolveShopListingId(String(key || "").trim());
    if (!k) return false;
    if (isShopStoreOtherDemoId(k)) return true;
    if (DEMO_SHOP_STORE_ALIASES.has(k)) return true;
    if (window.TasuShopStoreDemo?.getById?.(k)) return true;
    if (/^demo-biz-store-/i.test(k)) return true;
    return isDemoShopStoreId(k);
  }

  /** listing-local-store.js 未読込時も file:// で表示できるインラインデモ */
  function buildShopStoreOtherDemoInline(overrides = {}) {
    const demoId = String(overrides.id || SHOP_STORE_OTHER_DEMO_ID).trim() || SHOP_STORE_OTHER_DEMO_ID;
    return normalizeShopStoreListing(
      {
        id: demoId,
        title: "地域セレクト商品の販売相談",
        listingType: "shop-store",
        businessType: "shop_store",
        listing_type: "shop_store",
        type: "shop_store",
        category: "その他",
        shop_store_category: "other",
        categoryProfile: "other",
        price: 0,
        priceLabel: "要相談",
        description:
          "地域のハンドメイド商品、季節商品、限定品などを販売・紹介するサンプル掲載です。\n商品の取り扱いや在庫状況については、お問い合わせください。",
        images: ["https://placehold.co/800x600/7c3aed/ffffff?text=Shop+Store"],
        tags: ["店舗・販売", "その他", "地域商品", "ハンドメイド", "TASFUL"],
        status: "active",
        source: "demo",
        handlingInfo: {
          productsHandled: "ハンドメイド雑貨、季節商品、地域限定品",
          salesMethods: "店頭販売・予約販売・問い合わせ販売",
          serviceArea: "千葉県成田市周辺",
          consultationMethod: "問い合わせフォーム",
        },
        products: [
          { title: "季節のハンドメイド雑貨セット", price: "¥2,200（税込）" },
          { title: "地域限定お土産ボックス", price: "¥3,300（税込）" },
        ],
        reviews: [{ author: "利用者A", rating: 5, text: "限定品の相談が丁寧でした。" }],
        reviewCount: 18,
        review_count: 18,
        rating: 4.6,
        business_hours: "10:00〜18:00",
        phone: "0476-00-0000",
        category_extra: {
          shop_store: {
            address: "千葉県成田市公津の杜4-8-3",
            access: "成田駅からバス15分",
            closed_day: "水曜",
          },
        },
        access: "成田駅からバス15分",
        serviceArea: "千葉県成田市周辺",
        ...overrides,
        id: demoId,
      },
      "demo-inline"
    );
  }

  function getFallbackShopListing(id) {
    const key = resolveShopListingId(id);
    if (!key || isShopStoreOtherDemoId(key)) {
      return loadLocalShopRecord(key || SHOP_STORE_OTHER_DEMO_ID) || buildShopStoreOtherDemoInline({ id: key || SHOP_STORE_OTHER_DEMO_ID });
    }
    return null;
  }

  function ensureShopListingCategory(listing) {
    if (window.TasuShopDetailCategory?.ensureListingCategoryField) {
      return window.TasuShopDetailCategory.ensureListingCategoryField(listing);
    }
    return listing;
  }

  function isShopStoreOtherDemoId(id) {
    return SHOP_STORE_OTHER_DEMO_IDS.has(String(id || "").trim());
  }

  function isDemoShopStoreId(id) {
    const key = String(id || "").trim();
    if (isShopStoreOtherDemoId(key)) return true;
    if (DEMO_SHOP_STORE_ALIASES.has(key)) return true;
    if (window.TasuShopStoreDemo?.isShopStoreDemoId?.(key)) return true;
    return key.startsWith("demo-shop-");
  }

  function resolveShopLoadTarget() {
    try {
      const params = new URLSearchParams(window.location.search);
      const rawId = String(
        params.get("id") || params.get("listingId") || params.get("listing_id") || ""
      ).trim();
      const demoOther = params.get("demo") === "other";
      if (window.TasuListingLocalStore?.resolveShopDetailId) {
        return window.TasuListingLocalStore.resolveShopDetailId(rawId, { demoOther });
      }
      if (rawId) return { id: rawId, explicit: true };
      return { id: SHOP_STORE_OTHER_DEMO_ID, explicit: false };
    } catch {
      return { id: SHOP_STORE_OTHER_DEMO_ID, explicit: false };
    }
  }

  function loadLocalShopRecord(id) {
    const store = root.TasuListingLocalStore;
    const demoId = store?.SHOP_STORE_OTHER_DEMO_ID || SHOP_STORE_OTHER_DEMO_ID;
    if (!store) {
      if (id === demoId || !String(id || "").trim()) {
        return buildShopStoreOtherDemoInline({ id: demoId });
      }
      return null;
    }
    if (isShopStoreOtherDemoId(id)) {
      const otherId = String(id || demoId).trim() || demoId;
      if (otherId === demoId) {
        return normalizeShopStoreListing(
          store.refreshShopStoreOtherDemo?.() || store.buildShopStoreOtherDemoRecord?.(),
          "demo"
        );
      }
      const fromStore = store.fetchById?.(otherId);
      if (fromStore && store.resolveListingTypeKey?.(fromStore) === "shop_store") {
        return normalizeShopStoreListing(store.toDetailListing?.(fromStore) || fromStore, "demo");
      }
      return buildShopStoreOtherDemoInline({ id: otherId });
    }
    const record = store.fetchById?.(id);
    if (record && store.resolveListingTypeKey?.(record) === "shop_store") {
      const detail = store.toDetailListing?.(record) || record;
      return normalizeShopStoreListing(
        {
          ...detail,
          handlingInfo: record.handlingInfo || record.handling_info || detail.handlingInfo,
          priceLabel: record.priceLabel || record.price_label || detail.priceLabel,
        },
        "local-tasful"
      );
    }
    return null;
  }

  function normalizeShopStoreListing(listing, source) {
    if (!listing || typeof listing !== "object") return null;
    const out = ensureShopListingCategory({ ...listing });
    out.listing_type = "shop_store";
    out.type = out.type || out.listing_type;
    out.business_type = "shop_store";
    if (!out.business_category || out.business_category === "store_field_service") {
      out.business_category = "shop_store";
    }
    if (source) out._detail_source = source;
    return out;
  }

  /**
   * UI確認用デモ（business-board-demo.js）
   * @returns {Promise<object|null>}
   */
  async function fetchDemoShopStoreListing(id) {
    const key = resolveShopListingId(String(id || DEMO_SHOP_STORE_ID).trim());
    const fromShop = fetchShopStoreDemoListingByKey(key);
    if (fromShop) return fromShop;
    return fetchBoardShopStoreDemoListingByKey(key);
  }

  /**
   * 本番データ（Supabase → localStorage）
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async function fetchProductionShopStoreListing(id) {
    const key = String(id || "").trim();
    if (!key || isDemoShopStoreId(key)) return null;

    let listing = null;
    if (window.TasuBusinessListings?.fetchBusinessListingById) {
      listing = await window.TasuBusinessListings.fetchBusinessListingById(key);
    }

    if (!listing) return null;

    const bt =
      window.TasuBusinessCategories?.getBusinessType?.(listing) ||
      String(listing.business_type || listing.form_data?.business_type || "").trim();

    if (bt && bt !== "shop_store") {
      console.warn("[TasuDetailShopStoreLoader] 店舗・販売以外の掲載です:", bt, key);
      return null;
    }

    listing = normalizeShopStoreListing(listing, listing.source || listing._source || "production");

    if (window.TasuShopStoreProductsDb?.attachProductsToListing) {
      listing = await window.TasuShopStoreProductsDb.attachProductsToListing(listing);
    }

    return listing;
  }

  /**
   * @param {string} id URL の ?id=
   * @returns {Promise<object|null>}
   */
  async function fetchShopStoreDetailById(id) {
    const key = resolveShopListingId(String(id || "").trim());
    const store = root.TasuListingLocalStore;
    const otherDemoId = store?.SHOP_STORE_OTHER_DEMO_ID || SHOP_STORE_OTHER_DEMO_ID;

    try {
      if (IS_FILE_PROTOCOL) {
        const fileKey = key || otherDemoId;
        if (fileKey && shouldPreferDemoDatasetBeforeLocal(fileKey)) {
          const demoFirst = await fetchDemoShopStoreListing(fileKey);
          if (demoFirst) return demoFirst;
        }
        const local = loadLocalShopRecord(fileKey);
        if (local) {
          console.warn("[detail-shop loader] file:// local:", local.id);
          return local;
        }
        if (!key || isShopStoreOtherDemoId(fileKey)) {
          return getFallbackShopListing(fileKey || otherDemoId);
        }
        return null;
      }

      if (!key) {
        const local = loadLocalShopRecord(otherDemoId);
        if (local) {
          console.log("[detail-shop loader] no-id demo:", local.id);
          return local;
        }
        return getFallbackShopListing(otherDemoId);
      }

      if (shouldPreferDemoDatasetBeforeLocal(key)) {
        const demoFirst = await fetchDemoShopStoreListing(key);
        if (demoFirst) {
          console.log("[detail-shop loader] id:", key, "matched:shop-store-demo");
          return demoFirst;
        }
      }

      const localListing = loadLocalShopRecord(key);
      if (localListing) {
        console.log("[detail-shop loader] tasful_listings hit:", localListing.id);
        return localListing;
      }

      if (isDemoShopStoreId(key) || /^demo-biz-store-/i.test(key)) {
        const listing = await fetchDemoShopStoreListing(key);
        console.log("[detail-shop loader] id:", key, "matched:demo", listing);
        return listing || null;
      }

      // local_* は localStorage から（Supabase検索しない）
      if (key.startsWith("local_")) {
        const listing = await fetchProductionShopStoreListing(key);
        console.log("[detail-shop loader] id:", key, "matched:local", listing);
        return listing;
      }

      // UUID形式のみ Supabase（business_listings_db 側がUUIDチェック済み）
      if (root.TasuBusinessListings?.isUuid?.(key)) {
        const listing = await fetchProductionShopStoreListing(key);
        console.log("[detail-shop loader] id:", key, "matched:uuid", listing);
        return listing;
      }

      console.warn("[detail-shop loader] listing not found:", key);
      return null;
    } catch (err) {
      console.warn("[detail-shop loader] fetch failed:", err?.message || err);
      if (!key || isShopStoreOtherDemoId(key)) {
        return getFallbackShopListing(key || otherDemoId);
      }
      return null;
    }
  }

  function isShopStoreDetailPage() {
    if (document.body?.dataset?.detailType === "shop_store") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return (
      /detail-shop(?:-store)?\.html/i.test(path) ||
      /detail-shop(?:-store)?\.html/i.test(href)
    );
  }

  root.TasuDetailShopStoreLoader = {
    DEMO_SHOP_STORE_ID,
    SHOP_STORE_OTHER_DEMO_ID,
    DEMO_SHOP_STORE_ALIASES,
    IS_FILE_PROTOCOL,
    isDemoShopStoreId,
    isShopStoreOtherDemoId,
    SHOP_STORE_OTHER_DEMO_IDS,
    isShopStoreDetailPage,
    resolveShopListingId,
    DEMO_SHOP_ID_ALIASES,
    fetchShopStoreDemoListingByKey,
    fetchBoardShopStoreDemoListingByKey,
    shouldPreferDemoDatasetBeforeLocal,
    resolveShopLoadTarget,
    loadLocalShopRecord,
    ensureShopListingCategory,
    buildShopStoreOtherDemoInline,
    getFallbackShopListing,
    fetchDemoShopStoreListing,
    fetchProductionShopStoreListing,
    fetchShopStoreDetailById,
  };
})();
