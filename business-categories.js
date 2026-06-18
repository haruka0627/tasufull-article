/**
 * 法人・業者 — 業務ジャンル（大カテゴリ）とサブカテゴリの単一定義
 *
 * - business_category: 大カテゴリ（DB・フィルター）
 * - business_subcategory: サブカテゴリ（form_data / 将来列）
 * - title: サービス名（掲載タイトル）
 */
(function () {
  "use strict";

  /** @type {{ id: string, label: string, subcategories: { id: string, label: string }[] }[]} */
  const CATEGORIES = [
    {
      id: "transport",
      label: "送迎・運搬",
      subcategories: [
        { id: "taxi", label: "タクシー" },
        { id: "airport_shuttle", label: "空港送迎" },
        { id: "hire_car", label: "ハイヤー" },
        { id: "light_cargo", label: "軽貨物" },
        { id: "delivery", label: "配送" },
      ],
    },
    {
      id: "construction",
      label: "建設・工事",
      subcategories: [
        { id: "construction", label: "建設" },
        { id: "renovation", label: "リフォーム" },
        { id: "demolition", label: "解体" },
        { id: "exterior", label: "外構" },
      ],
    },
    {
      id: "repair_maintenance",
      label: "修理・メンテナンス",
      subcategories: [
        { id: "plumbing", label: "水道修理" },
        { id: "electrical", label: "電気修理" },
        { id: "pc_repair", label: "PC修理" },
        { id: "air_conditioning", label: "エアコン" },
      ],
    },
    {
      id: "cleaning",
      label: "清掃・片付け",
      subcategories: [
        { id: "cleaning", label: "清掃" },
        { id: "junk_removal", label: "不用品回収" },
        { id: "lawn_care", label: "草刈り" },
        { id: "trash_cleanup", label: "ゴミ片付け" },
      ],
    },
    {
      id: "beauty_wellness",
      label: "美容・リラク",
      subcategories: [
        { id: "beauty_salon", label: "美容・サロン" },
        { id: "relaxation", label: "リラクゼーション・マッサージ" },
      ],
    },
    {
      id: "education",
      label: "スクール・教室",
      subcategories: [],
    },
    {
      id: "onsite_service",
      label: "出張サービス",
      subcategories: [],
    },
    {
      id: "life_support",
      label: "暮らしサポート",
      subcategories: [
        { id: "handyman", label: "便利屋" },
        { id: "senior_support", label: "高齢者支援" },
        { id: "watch_over", label: "見守り" },
        { id: "shopping_proxy", label: "買い物代行" },
      ],
    },
    {
      id: "it_web",
      label: "IT・Web制作",
      subcategories: [],
    },
    {
      id: "sales_agency",
      label: "営業・代行",
      subcategories: [],
    },
    {
      id: "corporate_support",
      label: "法人サポート",
      subcategories: [],
    },
    {
      id: "other_business",
      label: "その他業務",
      subcategories: [],
    },
    /* 店舗・販売は業務フォームから除外するが、互換のためカテゴリ定義は残す */
    {
      id: "shop_store",
      label: "店舗・販売",
      subcategories: [
        { id: "restaurant", label: "飲食・カフェ" },
        { id: "retail", label: "小売・物販" },
        { id: "vintage_brand", label: "古着・ブランド" },
        { id: "goods_interior", label: "雑貨・インテリア" },
        { id: "food_retail", label: "食品販売" },
        { id: "hobby_anime", label: "ホビー・アニメ・トレカ" },
        { id: "pet", label: "ペット用品" },
        { id: "other_shop", label: "その他" },
      ],
    },
  ];

  const LEGACY_TO_CANONICAL = {
    taxi: "transport",
    construction: "construction",
    repair: "repair_maintenance",
    cleaning: "cleaning",
    local_service: "life_support",
    local_support: "life_support",
    construction_work: "construction",
    field_service: "other_business",
    store: "shop_store",
    store_field_service: "shop_store",
  };

  /** 旧統合カテゴリ（読み取り・移行用） */
  const LEGACY_STORE_COMBINED = "store_field_service";

  /** 詳細UI・掲載フォーム追加項目のプロファイルキー */
  const CANONICAL_TO_PROFILE = {
    transport: "taxi",
    construction: "construction",
    repair_maintenance: "repair",
    cleaning: "cleaning",
    beauty_wellness: "field_service",
    education: "field_service",
    shop_store: "shop_store",
    onsite_service: "field_service",
    life_support: "local_service",
    it_web: "field_service",
    sales_agency: "field_service",
    corporate_support: "field_service",
    other_business: "field_service",
  };

  const BUSINESS_TYPE_BY_CATEGORY = {
    shop_store: "shop_store",
  };

  /**
   * 法人・業者詳細UIは2種類のみ:
   * - shop_store: 店舗・販売UI
   * - field_service: 業務サービスUI（カテゴリは分類用途）
   *
   * そのため、shop_store 以外は field_service UI として扱う。
   */
  const FIELD_SERVICE_UI_CATEGORIES = new Set(
    CATEGORIES.map((c) => c.id).filter((id) => id !== "shop_store")
  );

  /** 一覧ナビ用（business.html の data-biz-cat）— DBカテゴリIDとは別 */
  const BOARD_FILTER_FIELD_SERVICE = "field_service";
  const BOARD_FILTER_SHOP_STORE = "shop_store";

  /**
   * 店舗・販売系プロファイル（shop_store_category / categoryProfile 等）
   * 業務サービス一覧から除外する対象
   */
  const SHOP_STORE_PROFILE_KEYS = new Set([
    "shop_store",
    "retail",
    "goods",
    "goods_interior",
    "vintage_brand",
    "vintage",
    "food",
    "food_retail",
    "interior",
    "restaurant",
    "hobby_anime",
    "pet",
    "tools_equipment",
    "other_shop",
  ]);

  const VALID_CANONICAL = new Set(CATEGORIES.map((c) => c.id));
  const VALID_LEGACY = new Set(Object.keys(LEGACY_TO_CANONICAL));

  const LABEL_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
  LABEL_BY_ID[LEGACY_STORE_COMBINED] = "店舗・出張サービス（旧）";

  const SUB_BY_MAIN = Object.fromEntries(
    CATEGORIES.map((c) => [
      c.id,
      Object.fromEntries(c.subcategories.map((s) => [s.id, s.label])),
    ])
  );

  function normalizeCategory(raw) {
    const key = String(raw || "").trim();
    if (!key) return "";
    if (VALID_CANONICAL.has(key)) return key;
    if (key === LEGACY_STORE_COMBINED) return key;
    if (LEGACY_TO_CANONICAL[key]) return LEGACY_TO_CANONICAL[key];
    return "";
  }

  function getDetailProfile(raw) {
    const canonical = normalizeCategory(raw);
    if (canonical === LEGACY_STORE_COMBINED) return "field_service";
    return CANONICAL_TO_PROFILE[canonical] || "";
  }

  function getExtraSectionKey(raw, listing) {
    const bt = listing ? getBusinessType(listing) : "";
    if (bt === "shop_store") return "shop_store";
    if (bt === "field_service") return "field_service";
    return getDetailProfile(raw) || "";
  }

  function isCanonicalCategory(raw) {
    return VALID_CANONICAL.has(normalizeCategory(raw));
  }

  function categoryMatches(itemCategory, filterCategory) {
    if (!filterCategory) return true;
    const item = normalizeCategory(itemCategory);
    const filter = normalizeCategory(filterCategory);
    if (!filter) return true;
    return item === filter;
  }

  function getCategoryLabel(raw) {
    const canonical = normalizeCategory(raw);
    return LABEL_BY_ID[canonical] || "";
  }

  function getSubcategoryLabel(mainRaw, subRaw) {
    const main = normalizeCategory(mainRaw);
    const sub = String(subRaw || "").trim();
    if (!main || !sub) return "";
    return SUB_BY_MAIN[main]?.[sub] || "";
  }

  function buildCategoryDisplayLabel(mainRaw, subRaw) {
    const mainLabel = getCategoryLabel(mainRaw);
    const subLabel = getSubcategoryLabel(mainRaw, subRaw);
    if (mainLabel && subLabel) return `${mainLabel} / ${subLabel}`;
    return mainLabel || subLabel || "";
  }

  function getCategoryById(id) {
    const canonical = normalizeCategory(id);
    return CATEGORIES.find((c) => c.id === canonical) || null;
  }

  function getSubcategories(mainRaw) {
    const cat = getCategoryById(mainRaw);
    return cat ? [...cat.subcategories] : [];
  }

  function isTransportProfile(raw) {
    return getDetailProfile(raw) === "taxi";
  }

  function isConstructionProfile(raw) {
    return getDetailProfile(raw) === "construction";
  }

  function isStoreProfile(raw) {
    return getDetailProfile(raw) === "shop_store";
  }

  function listingHasShopProducts(listing) {
    if (!listing || typeof listing !== "object") return false;
    const fd =
      listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing.category_extra || fd.category_extra || {};
    const block =
      extra.shop_store ||
      extra.store ||
      extra[LEGACY_STORE_COMBINED] ||
      {};
    const raw = listing.products || fd.products || block.products;
    return Array.isArray(raw) ? raw.length > 0 : false;
  }

  function getListingType(listing) {
    return getBusinessType(listing);
  }

  function getShopStoreProfileKey(listing) {
    if (!listing || typeof listing !== "object") return "";
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    return String(
      fd.shop_store_category ||
        fd.shop_category ||
        fd.categoryProfile ||
        fd.category_profile ||
        fd.profileKey ||
        fd.profile_key ||
        listing.business_subcategory ||
        ""
    ).trim();
  }

  function getCategoryProfile(listing) {
    return getShopStoreProfileKey(listing) || getDetailProfile(listing?.business_category) || "";
  }

  /** 店舗・販売・小売系掲載か（業務サービス一覧から除外） */
  function isShopStoreListing(listing) {
    if (!listing || typeof listing !== "object") return false;

    const listingType = String(
      listing.listingType || listing.listing_type || listing.form_data?.listingType || ""
    ).trim();
    if (listingType === BOARD_FILTER_SHOP_STORE) return true;

    const bt = getBusinessType(listing);
    if (bt === BOARD_FILTER_SHOP_STORE) return true;
    if (bt === BOARD_FILTER_FIELD_SERVICE) return false;

    const cat = normalizeCategory(listing.business_category);
    if (cat === BOARD_FILTER_SHOP_STORE) return true;

    const profile = getShopStoreProfileKey(listing);
    if (profile && SHOP_STORE_PROFILE_KEYS.has(profile)) return true;

    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing.category_extra || fd.category_extra || {};
    if (extra.shop_store && typeof extra.shop_store === "object" && Object.keys(extra.shop_store).length) {
      return true;
    }

    if (listingHasShopProducts(listing)) {
      const hasField =
        (extra.field_service && typeof extra.field_service === "object") ||
        (fd.field_service && typeof fd.field_service === "object");
      if (!hasField) return true;
    }

    const hay = [
      listing.title,
      listing.description,
      (listing.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    if (/中古販売|買取・?査定|店舗受取|古物商|物販|小売|ec販売|飲食店|カフェ店/.test(hay)) {
      if (!extra.field_service && !fd.field_service) return true;
    }

    return false;
  }

  /** サービス依頼型の業務掲載か */
  function isFieldServiceListing(listing) {
    return !isShopStoreListing(listing);
  }

  function normalizeBoardFilter(raw) {
    const key = String(raw || "").trim();
    if (key === BOARD_FILTER_FIELD_SERVICE || key === BOARD_FILTER_SHOP_STORE) return key;
    return normalizeCategory(key);
  }

  function isBoardListingTypeFilter(raw) {
    const key = String(raw || "").trim();
    return key === BOARD_FILTER_FIELD_SERVICE || key === BOARD_FILTER_SHOP_STORE;
  }

  /**
   * 法人・業者一覧の大カテゴリナビ用フィルター
   * @param {object[]} items
   * @param {string} boardFilter — field_service | shop_store | 業種カテゴリID
   */
  function filterListingsForBoard(items, boardFilter) {
    const list = Array.isArray(items) ? items : [];
    const filter = String(boardFilter || "").trim();

    if (filter === BOARD_FILTER_SHOP_STORE) {
      return list.filter((item) => isShopStoreListing(item));
    }

    if (filter === BOARD_FILTER_FIELD_SERVICE) {
      return list.filter((item) => isFieldServiceListing(item));
    }

    if (!filter) {
      return list;
    }

    const canon = normalizeCategory(filter);
    if (canon && canon !== BOARD_FILTER_SHOP_STORE) {
      return list.filter(
        (item) => isFieldServiceListing(item) && categoryMatches(item.business_category, canon)
      );
    }

    return list.filter((item) => isFieldServiceListing(item));
  }

  /** @returns {"shop_store"|"field_service"|""} */
  function getBusinessType(catOrListing) {
    if (catOrListing && typeof catOrListing === "object") {
      const explicit =
        String(catOrListing.business_type || catOrListing.form_data?.business_type || "").trim();
      if (explicit === "shop_store" || explicit === "field_service") return explicit;
      const cat = normalizeCategory(catOrListing.business_category);
      if (cat === "shop_store" || cat === "field_service") return BUSINESS_TYPE_BY_CATEGORY[cat];
      if (cat === LEGACY_STORE_COMBINED) {
        return listingHasShopProducts(catOrListing) ? "shop_store" : "field_service";
      }
      return "";
    }
    const cat = normalizeCategory(catOrListing);
    if (cat === "shop_store") return "shop_store";
    if (FIELD_SERVICE_UI_CATEGORIES.has(cat)) return "field_service";
    if (cat === LEGACY_STORE_COMBINED) return "field_service";
    return "";
  }

  function isFieldServiceUiCategory(catOrListing) {
    if (typeof catOrListing === "object" && catOrListing) {
      const bt = getBusinessType(catOrListing);
      if (bt === "field_service") return true;
      if (bt === "shop_store") return false;
      const cat = normalizeCategory(catOrListing.business_category);
      return FIELD_SERVICE_UI_CATEGORIES.has(cat);
    }
    const cat = normalizeCategory(catOrListing);
    return FIELD_SERVICE_UI_CATEGORIES.has(cat);
  }

  function isShopStoreType(catOrListing) {
    return getBusinessType(catOrListing) === "shop_store";
  }

  function isFieldServiceType(catOrListing) {
    return getBusinessType(catOrListing) === "field_service";
  }

  function isFieldServiceUiType(catOrListing) {
    return isFieldServiceUiCategory(catOrListing);
  }

  function isLegacyStoreFieldCategory(raw) {
    const cat = normalizeCategory(
      typeof raw === "object" ? raw?.business_category : raw
    );
    return cat === LEGACY_STORE_COMBINED;
  }

  function businessTypeForCategory(category) {
    const cat = normalizeCategory(category);
    if (cat === "shop_store") return "shop_store";
    if (FIELD_SERVICE_UI_CATEGORIES.has(cat)) return "field_service";
    return "";
  }

  function isRepairProfile(raw) {
    return getDetailProfile(raw) === "repair";
  }

  function allCategories() {
    return CATEGORIES.map((c) => ({ id: c.id, label: c.label }));
  }

  function allCategoryIds() {
    return CATEGORIES.map((c) => c.id);
  }

  function legacyCategoryIds() {
    return Object.keys(LEGACY_TO_CANONICAL);
  }

  function allValidStorageIds() {
    return [...allCategoryIds(), ...legacyCategoryIds(), LEGACY_STORE_COMBINED];
  }

  /** Supabase / ローカル絞り込み用（正規ID + 旧ID） */
  function getCategoryFilterValues(filterRaw) {
    const raw = String(filterRaw || "").trim();
    if (raw === BOARD_FILTER_FIELD_SERVICE) {
      return [...FIELD_SERVICE_UI_CATEGORIES];
    }
    if (raw === BOARD_FILTER_SHOP_STORE) {
      const values = new Set([BOARD_FILTER_SHOP_STORE]);
      values.add(LEGACY_STORE_COMBINED);
      return [...values];
    }

    const canonical = normalizeCategory(filterRaw);
    if (!canonical) return [];
    const values = new Set([canonical]);
    Object.entries(LEGACY_TO_CANONICAL).forEach(([legacy, canon]) => {
      if (canon === canonical) values.add(legacy);
    });
    if (canonical === BOARD_FILTER_SHOP_STORE) values.add(LEGACY_STORE_COMBINED);
    return [...values];
  }

  window.TasuBusinessCategories = {
    CATEGORIES,
    LEGACY_TO_CANONICAL,
    CANONICAL_TO_PROFILE,
    VALID_CANONICAL,
    normalizeCategory,
    getDetailProfile,
    getExtraSectionKey,
    isCanonicalCategory,
    categoryMatches,
    getCategoryLabel,
    getSubcategoryLabel,
    buildCategoryDisplayLabel,
    getCategoryById,
    getSubcategories,
    isTransportProfile,
    isConstructionProfile,
    isStoreProfile,
    isShopStoreType,
    isFieldServiceType,
    isFieldServiceUiCategory,
    isFieldServiceUiType,
    FIELD_SERVICE_UI_CATEGORIES,
    getBusinessType,
    businessTypeForCategory,
    isLegacyStoreFieldCategory,
    LEGACY_STORE_COMBINED,
    isRepairProfile,
    allCategories,
    allCategoryIds,
    legacyCategoryIds,
    allValidStorageIds,
    getCategoryFilterValues,
    BOARD_FILTER_FIELD_SERVICE,
    BOARD_FILTER_SHOP_STORE,
    SHOP_STORE_PROFILE_KEYS,
    getListingType,
    getShopStoreProfileKey,
    getCategoryProfile,
    isShopStoreListing,
    isFieldServiceListing,
    normalizeBoardFilter,
    isBoardListingTypeFilter,
    filterListingsForBoard,
  };
})();
