/**
 * tasful_listings — ローカル掲載ストア（AI Agent / 掲載管理 / 詳細ページ共通）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_listings";
  const EVENT_NAME = "tasu:listings-updated";
  const SOURCE_AI = "ai-agent";
  const GENERAL_DEMO_ID = "general-demo-002";
  const SHOP_STORE_OTHER_DEMO_ID = "shop-store-demo-other-001";
  const SHOP_STORE_OTHER_DEMO_IDS = [
    SHOP_STORE_OTHER_DEMO_ID,
    "shop-store-demo-other-002",
    "shop-store-demo-other-003",
  ];

  const CATEGORY_TYPE_MAP = {
    "建築・修理": {
      listingType: "business-service",
      businessType: "field_service",
      scope: "business",
      bizCategory: "construction",
    },
    清掃: {
      listingType: "business-service",
      businessType: "field_service",
      scope: "business",
      bizCategory: "cleaning",
    },
    IT: {
      listingType: "business-service",
      businessType: "field_service",
      scope: "business",
      bizCategory: "it_web",
    },
    スキル: {
      listingType: "skill",
      businessType: "",
      scope: "general",
      bizCategory: "",
    },
  };

  function parseTags(raw) {
    if (Array.isArray(raw)) {
      return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
    }
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function parseImages(raw) {
    if (Array.isArray(raw)) {
      return raw.map((u) => String(u).trim()).filter(Boolean).slice(0, 6);
    }
    return String(raw || "")
      .split(/\r?\n|,/)
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  function normalizeTypeKey(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
  }

  function resolveListingTypeKey(item) {
    const listingType = normalizeTypeKey(item?.listingType || item?.listing_type || item?.type);
    const scope = normalizeTypeKey(item?.scope);
    const businessSub = normalizeTypeKey(item?.businessType || item?.business_type);

    if (listingType === "business_service") return "business_service";
    if (listingType === "shop_store") return "shop_store";
    if (listingType === "skill") return "skill";
    if (listingType === "product" || listingType === "item") return "product";
    if (listingType === "job") return "job";
    if (listingType === "worker") return "worker";
    if (listingType === "business") {
      return businessSub === "shop_store" ? "shop_store" : "business_service";
    }
    if (listingType === "general" || listingType === "other") {
      if (scope === "business") {
        return businessSub === "shop_store" ? "shop_store" : "business_service";
      }
      if (scope === "skill") return "skill";
      if (scope === "job") return "job";
      if (scope === "worker") return "worker";
      if (scope === "product") return "product";
      return "general";
    }
    const rawType = String(item?.listingType || item?.listing_type || item?.type || "").trim();
    if (rawType === "その他") {
      if (businessSub === "shop_store") return "shop_store";
      if (scope === "business") {
        return businessSub === "shop_store" ? "shop_store" : "business_service";
      }
      return "general";
    }
    if (scope === "business") {
      return businessSub === "shop_store" ? "shop_store" : "business_service";
    }
    if (scope === "skill") return "skill";
    if (scope === "job") return "job";
    if (scope === "worker") return "worker";
    if (scope === "product") return "product";
    return listingType || scope || "general";
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function notifyUpdate() {
    try {
      global.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { key: STORAGE_KEY } })
      );
    } catch {
      /* noop */
    }
  }

  function writeAll(list) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      notifyUpdate();
    } catch (err) {
      console.warn("[TasuListingLocalStore] write failed:", err);
    }
  }

  function collectLookupIds(id) {
    if (global.TasuListingRouteResolver?.collectListingIdCandidates) {
      return global.TasuListingRouteResolver.collectListingIdCandidates(id);
    }
    const key = String(id || "").trim();
    return key ? [key] : [];
  }

  function fetchById(id) {
    const keys = collectLookupIds(id);
    if (!keys.length) return null;
    const list = readAll();
    for (const key of keys) {
      const hit = list.find((item) => String(item.id) === key);
      if (hit) return hit;
    }
    if (global.TasuListingDemoCatalog?.getStoreListing) {
      for (const key of keys) {
        const row = global.TasuListingDemoCatalog.getStoreListing(key);
        if (!row) continue;
        return {
          ...row,
          id: row.id || key,
          listingType: row.listing_type || row.listingType || row.type,
          listing_type: row.listing_type || row.listingType || row.type,
          imageUrl: row.image_url || row.imageUrl || row.thumbnail_url,
          priceLabel: row.priceLabel || row.price_label || "",
          source: row.source || "demo-catalog",
        };
      }
    }
    return null;
  }

  function buildGeneralDemoRecord() {
    const now = new Date().toISOString();
    const imageUrl = "https://placehold.co/800x600/2563eb/ffffff?text=Event";
    const description =
      "地域の交流イベントを開催します。\n初心者歓迎です。\nお気軽にご参加ください。";
    return {
      id: GENERAL_DEMO_ID,
      title: "地域交流イベント参加者募集",
      category: "その他",
      listingType: "general",
      scope: "general",
      user_id: "u_general_demo",
      price: 0,
      priceLabel: "無料",
      description,
      images: [imageUrl],
      tags: ["イベント", "地域交流", "初心者歓迎", "TASFUL"],
      status: "active",
      source: "demo",
      imageUrl,
      serviceArea: null,
      service_area: null,
      access: null,
      eventInfo: {
        date: "2026-07-01",
        time: "10:00〜17:00",
        location: "千葉県成田市",
        capacity: "50名",
      },
      organizer: "TASFUL運営",
      ctaPrimary: "参加について相談する",
      ctaSecondary: "お気に入りに追加",
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      views: 0,
      favorites: 0,
      inquiries: 0,
      reviews: [],
      companyInfo: {},
    };
  }

  function refreshGeneralDemo() {
    const demo = buildGeneralDemoRecord();
    try {
      const list = readAll();
      const idx = list.findIndex((item) => String(item.id) === GENERAL_DEMO_ID);
      if (idx >= 0) list[idx] = { ...list[idx], ...demo };
      else list.unshift(demo);
      writeAll(list);
      return demo;
    } catch (err) {
      console.warn("[TasuListingLocalStore] demo refresh skipped:", err);
      return demo;
    }
  }

  function ensureGeneralDemo() {
    const list = readAll();
    const existing = list.find((item) => String(item.id) === GENERAL_DEMO_ID);
    if (existing) return refreshGeneralDemo();
    return refreshGeneralDemo();
  }

  function seedGeneralDemoIfMissing() {
    return ensureGeneralDemo();
  }

  function resolveGeneralDetailId(rawId) {
    const id = String(rawId || "").trim();
    if (id) return { id, explicit: true };
    return { id: GENERAL_DEMO_ID, explicit: false };
  }

  const SHOP_OTHER_DEMO_PRODUCTS = [
    {
      title: "季節のハンドメイド雑貨セット",
      price: "¥2,200（税込）",
      image_url: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400",
    },
    {
      title: "地域限定お土産ボックス",
      price: "¥3,300（税込）",
      image_url: "https://images.unsplash.com/photo-1526045478516-99145907023c?w=400",
    },
    {
      title: "クラフト雑貨ギフト",
      price: "¥1,980（税込）",
      image_url: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=400",
    },
  ];

  const SHOP_OTHER_DEMO_REVIEWS = [
    { author: "利用者A", rating: 5, text: "限定品の相談が丁寧でした。" },
    { author: "利用者B", rating: 4, text: "ハンドメイドの品揃えが魅力的です。" },
  ];

  function buildShopStoreOtherDemoRecord(spec = {}) {
    const now = new Date().toISOString();
    const id = String(spec.id || SHOP_STORE_OTHER_DEMO_ID).trim();
    const imageUrl =
      String(spec.imageUrl || "").trim() ||
      "https://placehold.co/800x600/7c3aed/ffffff?text=Shop+Store";
    const description =
      String(spec.description || "").trim() ||
      "地域のハンドメイド商品、季節商品、限定品などを販売・紹介するサンプル掲載です。\n商品の取り扱いや在庫状況については、お問い合わせください。";
    const tags = parseTags(
      spec.tags || ["店舗・販売", "その他", "地域商品", "ハンドメイド", "TASFUL"]
    );
    const serviceArea = String(spec.serviceArea || "千葉県成田市周辺").trim();
    const shopStoreExtra = {
      address: String(spec.address || "千葉県成田市公津の杜4-8-3").trim(),
      access: String(spec.access || "成田駅からバス15分").trim(),
      closed_day: String(spec.closed_day || "水曜").trim(),
      shop_introduction: String(spec.shop_introduction || description).trim(),
    };
    return {
      id,
      title: String(spec.title || "地域セレクト商品の販売相談").trim(),
      listingType: "shop-store",
      businessType: "shop_store",
      scope: "business",
      category: "その他",
      shop_store_category: "other",
      categoryProfile: "other",
      store_category_key: "other",
      price: 0,
      priceLabel: String(spec.priceLabel || "要相談").trim(),
      description,
      images: parseImages(spec.images || imageUrl),
      tags,
      status: "active",
      source: "demo",
      imageUrl,
      handlingInfo: {
        productsHandled:
          spec.productsHandled || "ハンドメイド雑貨、季節商品、地域限定品",
        salesMethods:
          spec.salesMethods || "店頭販売・予約販売・問い合わせ販売",
        serviceArea,
        consultationMethod: spec.consultationMethod || "問い合わせフォーム",
      },
      products: Array.isArray(spec.products) ? spec.products : SHOP_OTHER_DEMO_PRODUCTS,
      reviews: Array.isArray(spec.reviews) ? spec.reviews : SHOP_OTHER_DEMO_REVIEWS,
      reviewCount: Number(spec.reviewCount ?? 18) || 18,
      review_count: Number(spec.review_count ?? spec.reviewCount ?? 18) || 18,
      rating: Number(spec.rating ?? 4.6) || 4.6,
      business_hours: String(spec.business_hours || "10:00〜18:00").trim(),
      phone: String(spec.phone || "0476-00-0000").trim(),
      category_extra: { shop_store: shopStoreExtra },
      access: spec.access ?? shopStoreExtra.access,
      serviceArea,
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      views: 0,
      favorites: 0,
      inquiries: 0,
    };
  }

  function buildShopStoreOtherDemo002Record() {
    return buildShopStoreOtherDemoRecord({
      id: "shop-store-demo-other-002",
      title: "ハンドメイド作品販売",
      description: "手作り雑貨や一点物アイテムを販売するサンプル掲載です。",
      imageUrl: "https://placehold.co/800x600/8b5cf6/ffffff?text=Handmade",
      tags: ["店舗・販売", "その他", "ハンドメイド", "一点物", "TASFUL"],
      productsHandled: "手作り雑貨、一点物アクセサリー",
    });
  }

  function buildShopStoreOtherDemo003Record() {
    return buildShopStoreOtherDemoRecord({
      id: "shop-store-demo-other-003",
      title: "イベント限定グッズ販売",
      description: "地域イベントや期間限定グッズを販売するサンプル掲載です。",
      imageUrl: "https://placehold.co/800x600/6366f1/ffffff?text=Event+Goods",
      tags: ["店舗・販売", "その他", "限定品", "イベント", "TASFUL"],
      productsHandled: "イベント限定グッズ、期間限定商品",
    });
  }

  function upsertShopStoreOtherDemoRecord(demo) {
    if (!demo?.id) return demo;
    try {
      const list = readAll();
      const idx = list.findIndex((item) => String(item.id) === String(demo.id));
      if (idx >= 0) list[idx] = { ...list[idx], ...demo };
      else list.unshift(demo);
      writeAll(list);
    } catch (err) {
      console.warn("[TasuListingLocalStore] shop other demo refresh skipped:", err);
    }
    return demo;
  }

  function refreshShopStoreOtherDemo() {
    return upsertShopStoreOtherDemoRecord(buildShopStoreOtherDemoRecord());
  }

  function refreshShopStoreOtherDemos() {
    const demos = [
      buildShopStoreOtherDemoRecord(),
      buildShopStoreOtherDemo002Record(),
      buildShopStoreOtherDemo003Record(),
    ];
    demos.forEach((demo) => upsertShopStoreOtherDemoRecord(demo));
    return demos;
  }

  function ensureShopStoreOtherDemo() {
    return refreshShopStoreOtherDemos();
  }

  /** shop-store.html 一覧用 — shop_store 行形式へ変換 */
  function toShopStorePageListing(record) {
    if (!record || typeof record !== "object") return null;
    if (resolveListingTypeKey(record) !== "shop_store") return null;

    const images = parseImages(record.images || record.imageUrl);
    const imageUrl = images[0] || String(record.imageUrl || "").trim();
    const handling = record.handlingInfo || record.handling_info || {};
    const serviceArea = String(
      handling.serviceArea ||
        handling.service_area ||
        record.serviceArea ||
        record.service_area ||
        ""
    ).trim();
    const priceLabel =
      String(record.priceLabel || record.price_label || "").trim() || "要相談";
    const title = String(record.title || "").trim() || String(record.id || "").trim();

    return {
      id: record.id,
      demo_id: record.id,
      listing_type: "shop_store",
      type: "shop_store",
      business_type: "shop_store",
      business_category: "shop_store",
      category: record.category || "その他",
      shop_store_category: "other",
      shop_category: "other",
      categoryProfile: "other",
      store_category_key: "other",
      normalized_store_category: "その他",
      company_name: title,
      title,
      description: record.description || "",
      price: Number(record.price) || 0,
      priceLabel,
      price_label: priceLabel,
      price_range: priceLabel,
      service_area: serviceArea,
      tags: parseTags(record.tags),
      service_tags: parseTags(record.tags),
      image_url: imageUrl,
      thumbnail_url: imageUrl,
      main_image: imageUrl,
      images,
      gallery_urls: images,
      products: Array.isArray(record.products) ? record.products : [],
      verified: true,
      is_verified: true,
      rating: Number(record.rating) || 0,
      review_count: Number(record.review_count) || 0,
      created_at: record.createdAt || record.postedAt,
      updated_at: record.updatedAt || record.createdAt,
      form_data: {
        demo_id: record.id,
        business_type: "shop_store",
        shop_store_category: "other",
        shop_category: "other",
        categoryProfile: "other",
        image_url: imageUrl,
        gallery_urls: images,
      },
      category_extra: {
        shop_store: {
          shop_name: title,
          shop_category: "other",
          store_type: "その他",
          visit_area: serviceArea,
          address: serviceArea,
          shop_description: record.description || "",
          sales_support: "yes",
          show_inquiry: "yes",
          show_ai_consult: "yes",
        },
      },
    };
  }

  function getShopStoreOtherDemosForListPage() {
    refreshShopStoreOtherDemos();
    return SHOP_STORE_OTHER_DEMO_IDS.map((id) => fetchById(id))
      .filter(Boolean)
      .map((record) => toShopStorePageListing(record))
      .filter(Boolean);
  }

  function hasShopHandlingInfo(record) {
    const info = record?.handlingInfo || record?.handling_info;
    if (!info || typeof info !== "object") return false;
    return Boolean(
      String(info.productsHandled || info.products_handled || "").trim() ||
        String(info.salesMethods || info.sales_methods || "").trim() ||
        String(info.serviceArea || info.service_area || "").trim() ||
        String(info.consultationMethod || info.consultation_method || "").trim()
    );
  }

  function resolveShopDetailId(rawId, options = {}) {
    const id = String(rawId || "").trim();
    const demoOther = Boolean(options?.demoOther);
    if (id) return { id, explicit: true };
    if (demoOther) return { id: SHOP_STORE_OTHER_DEMO_ID, explicit: false };
    return { id: SHOP_STORE_OTHER_DEMO_ID, explicit: false };
  }

  function isShopStoreListingRecord(record) {
    return resolveListingTypeKey(record) === "shop_store";
  }

  function hasShopProductData(record) {
    const products = record?.products;
    if (Array.isArray(products) && products.length > 0) return true;
    const fd = record?.form_data;
    const menu =
      fd?.products ||
      fd?.shop_products ||
      fd?.category_extra?.shop_store?.products ||
      [];
    return Array.isArray(menu) && menu.length > 0;
  }

  function hasShopReviewData(record) {
    const reviews = record?.reviews;
    if (Array.isArray(reviews) && reviews.length > 0) return true;
    const count = Number(
      record?.reviewCount || record?.review_count || (typeof reviews === "number" ? reviews : 0) || 0
    );
    return Number.isFinite(count) && count > 0;
  }

  function hasShopAccessData(record) {
    const area = String(record?.serviceArea ?? record?.service_area ?? "").trim();
    if (area) return true;
    const access = record?.access;
    if (access == null || access === "") {
      const extra =
        record?.category_extra?.shop_store ||
        record?.form_data?.category_extra?.shop_store ||
        {};
      const addr = String(extra.address || extra.city || extra.access || "").trim();
      return Boolean(addr);
    }
    if (typeof access === "string") return Boolean(access.trim());
    if (typeof access === "object") return Object.keys(access).length > 0;
    return false;
  }

  function resolveShopPriceLabel(record) {
    const explicit = String(record?.priceLabel || record?.price_label || "").trim();
    if (explicit) return explicit;
    const price = Number(record?.price);
    if (!Number.isFinite(price) || price <= 0) return "要相談";
    return `¥${Math.round(price).toLocaleString("ja-JP")}`;
  }

  function resolveTypesFromForm(form, draft) {
    const category = draft?.category || form.querySelector("#category")?.value?.trim() || "";
    const mapped = CATEGORY_TYPE_MAP[category];
    if (mapped) return { ...mapped, category };

    const scope = form.querySelector("[data-post-scope]")?.value || "general";
    const listingType =
      form.querySelector("[data-listing-type-value]")?.value ||
      form.querySelector("[data-general-category]:checked")?.value ||
      "skill";
    const businessType =
      form.querySelector("[data-business-type-value]")?.value ||
      form.querySelector("[data-business-mode-pick]:checked")?.value ||
      "";

    return {
      listingType: String(listingType).trim(),
      businessType: String(businessType).trim(),
      scope: String(scope).trim(),
      bizCategory: form.querySelector("[data-business-category-pick]:checked")?.value || "",
      category,
    };
  }

  function collectDraftFromForm(form) {
    if (!form) return null;
    return {
      title: form.querySelector("#title")?.value?.trim() ?? "",
      category: form.querySelector("#category")?.value?.trim() ?? "",
      price: Number(form.querySelector("#price")?.value) || 0,
      description: form.querySelector("#description")?.value ?? "",
      images: parseImages(form.querySelector("#images")?.value ?? ""),
      tags: parseTags(form.querySelector("#tags")?.value ?? ""),
    };
  }

  function isAiAgentSource(listing) {
    const source = String(
      listing?.source || listing?.form_data?.source || listing?._localRecord?.source || ""
    ).trim();
    return source === SOURCE_AI;
  }

  function buildDetailPageUrl(record) {
    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrlFromRecord) return R.buildDetailUrlFromRecord(record);
    const rawId = String(record?.id || "").trim();
    if (!rawId) return "#";
    const typeKey = resolveListingTypeKey(record);
    if (R?.buildDetailUrl) return R.buildDetailUrl(typeKey, rawId);
    return "#";
  }

  function toDetailListing(record) {
    if (!record) return null;
    const typeKey = resolveListingTypeKey(record);
    const images = parseImages(record.images || record.draft?.images || record.imageUrl);
    const imageUrl = images[0] || String(record.imageUrl || "").trim();
    const listingType =
      typeKey === "business_service"
        ? "business"
        : typeKey === "shop_store"
          ? "shop_store"
          : typeKey;

    const row = {
      id: record.id,
      title: record.title || "",
      description: record.description || record.draft?.description || "",
      listing_type: listingType,
      type: listingType,
      scope: record.scope || "",
      user_id: String(record.user_id || record.seller_user_id || record.author_user_id || "").trim(),
      category: record.category || "",
      tags: parseTags(record.tags || record.draft?.tags),
      price: Number(record.price) || 0,
      price_amount: Number(record.price) || 0,
      image_url: imageUrl,
      thumbnail_url: imageUrl,
      imageUrl,
      main_image_url: imageUrl,
      gallery_urls: images,
      galleryUrls: images,
      images,
      source: record.source || "",
      status: record.status || "active",
      business_type: record.businessType || record.business_type || "",
      business_category:
        record.bizCategory || record.business_category || record.category || "",
      company_name: record.title || "",
      service_name: record.title || "",
      form_data: {
        title: record.title,
        description: record.description,
        category: record.category,
        tags: parseTags(record.tags),
        images,
        image_url: imageUrl,
        source: record.source,
        price: record.price,
      },
      _source: "local-tasful",
      _localRecord: record,
    };

    if (typeKey === "shop_store") {
      row.listing_type = "shop_store";
      row.type = "shop_store";
      row.business_type = "shop_store";
    }
    if (typeKey === "business_service") {
      row.business_type = "field_service";
    }

    return row;
  }

  function upsertFromForm(form, options = {}) {
    if (!form) return { ok: false, error: "form が未設定です" };

    const editId = String(
      options.editId ||
        form.dataset.editListingId ||
        new URLSearchParams(global.location.search).get("edit") ||
        new URLSearchParams(global.location.search).get("id") ||
        ""
    ).trim();

    const draft = collectDraftFromForm(form);
    const typeInfo = resolveTypesFromForm(form, draft);
    const images = draft.images || [];
    const imageUrl = images[0] || "";
    const list = readAll();
    const now = new Date().toISOString();
    const fromAi =
      options.source === SOURCE_AI ||
      form.dataset.aiAgentSource === "1" ||
      options.fromAiAgent === true;

    let record;
    let mode;

    if (editId) {
      const idx = list.findIndex((item) => String(item.id) === editId);
      const prev = idx >= 0 ? list[idx] : null;
      record = {
        ...(prev || {}),
        id: editId,
        title: draft.title || prev?.title || "（タイトル未設定）",
        category: draft.category || prev?.category || typeInfo.category || "—",
        listingType: prev?.listingType || typeInfo.listingType || "skill",
        businessType: prev?.businessType || typeInfo.businessType || "",
        scope: prev?.scope || typeInfo.scope || "general",
        bizCategory: prev?.bizCategory || typeInfo.bizCategory || "",
        price: draft.price,
        description: draft.description,
        images,
        tags: draft.tags,
        status: options.status || prev?.status || "active",
        source: fromAi ? SOURCE_AI : prev?.source || options.source || "",
        imageUrl: imageUrl || prev?.imageUrl || "",
        postedAt: prev?.postedAt || prev?.createdAt || now,
        createdAt: prev?.createdAt || now,
        updatedAt: now,
        views: prev?.views ?? 0,
        favorites: prev?.favorites ?? 0,
        inquiries: prev?.inquiries ?? 0,
        draft,
      };
      if (idx >= 0) list[idx] = record;
      else list.unshift(record);
      mode = idx >= 0 ? "update" : "create-with-id";
    } else {
      const newId = `lm-${Date.now()}`;
      record = {
        id: newId,
        title: draft.title || "（タイトル未設定）",
        category: draft.category || typeInfo.category || "—",
        listingType: typeInfo.listingType || "skill",
        businessType: typeInfo.businessType || "",
        scope: typeInfo.scope || "general",
        bizCategory: typeInfo.bizCategory || "",
        price: draft.price,
        description: draft.description,
        images,
        tags: draft.tags,
        status: options.status || "active",
        source: fromAi ? SOURCE_AI : options.source || "",
        imageUrl,
        postedAt: now,
        createdAt: now,
        updatedAt: now,
        views: 0,
        favorites: 0,
        inquiries: 0,
        draft,
      };
      list.unshift(record);
      form.dataset.editListingId = newId;
      mode = "create";
    }

    writeAll(list);

    try {
      global.TasuTalkFollowNotify?.onListingChanged?.({ record, mode });
    } catch (err) {
      console.warn("[TasuListingLocalStore] follow notify skipped:", err);
    }

    try {
      const agentKey = "tasful_agent_listing_draft";
      global.localStorage.setItem(
        agentKey,
        JSON.stringify({
          ...draft,
          listingId: record.id,
          source: record.source,
          listingType: record.listingType,
          businessType: record.businessType,
          scope: record.scope,
        })
      );
    } catch {
      /* noop */
    }

    const result = {
      ok: true,
      mode,
      id: record.id,
      record,
      detailUrl: buildDetailPageUrl(record),
    };
    console.log("[TasuListingLocalStore] save result", result);
    return result;
  }

  function renderAiBadge(listing) {
    if (!isAiAgentSource(listing)) return null;

    const existing = document.querySelector("[data-ai-agent-badge]");
    if (existing) return existing;

    const badge = document.createElement("span");
    badge.className = "listing-ai-badge";
    badge.textContent = "AI作成";
    badge.dataset.aiAgentBadge = "1";

    const bizBadges = document.querySelector("[data-biz-detail-title-badges]");
    if (bizBadges) {
      bizBadges.hidden = false;
      bizBadges.removeAttribute("hidden");
      bizBadges.setAttribute("aria-hidden", "false");
      bizBadges.appendChild(badge);
      return badge;
    }

    const anchors = [
      "[data-listing-title]",
      "[data-biz-detail-title]",
      ".skill-hero-premium__title",
      "#jobHeroTitle",
      "#workerHeroTitle",
      "h1",
    ];
    for (let i = 0; i < anchors.length; i += 1) {
      const el = document.querySelector(anchors[i]);
      if (!el || !String(el.textContent || "").trim()) continue;
      el.insertAdjacentElement("afterend", badge);
      return badge;
    }

    document.body.prepend(badge);
    return badge;
  }

  function bindStorageSync(onChange) {
    if (typeof onChange !== "function") return () => {};
    const handler = (event) => {
      if (event?.type === "storage" && event.key && event.key !== STORAGE_KEY) return;
      onChange();
    };
    global.addEventListener("storage", handler);
    global.addEventListener(EVENT_NAME, handler);
    return () => {
      global.removeEventListener("storage", handler);
      global.removeEventListener(EVENT_NAME, handler);
    };
  }

  function isGeneralListingRecord(record) {
    const source = String(record?.source || "").trim();
    const type = String(record?.listingType || record?.listing_type || "")
      .trim()
      .toLowerCase();
    return source === "demo" || type === "general" || type === "other" || type === "その他";
  }

  function hasGeneralReviewData(record) {
    const reviews = record?.reviews;
    if (Array.isArray(reviews) && reviews.length > 0) return true;
    const count = Number(record?.reviewCount || record?.review_count || 0);
    return Number.isFinite(count) && count > 0;
  }

  function hasGeneralAccessData(record) {
    const area = String(record?.serviceArea ?? record?.service_area ?? "").trim();
    if (area) return true;
    const access = record?.access;
    if (access == null || access === "") return false;
    if (typeof access === "string") return Boolean(access.trim());
    if (typeof access === "object") return Object.keys(access).length > 0;
    return false;
  }

  function hasGeneralEventInfo(record) {
    const info = record?.eventInfo || record?.event_info;
    if (!info || typeof info !== "object") return false;
    return Boolean(
      String(info.date || "").trim() ||
        String(info.time || "").trim() ||
        String(info.location || "").trim() ||
        String(info.capacity || "").trim()
    );
  }

  function hasGeneralOrganizerInfo(record) {
    return Boolean(
      String(record?.organizer || record?.companyInfo?.name || record?.company_name || "").trim()
    );
  }

  function resolveGeneralPriceLabel(record) {
    const explicit = String(record?.priceLabel || record?.price_label || "").trim();
    if (explicit) return explicit;
    const price = Number(record?.price);
    if (!Number.isFinite(price) || price <= 0) return "要相談";
    return `¥${Math.round(price).toLocaleString("ja-JP")}`;
  }

  function toFavoriteSnapshot(record) {
    const listing = toDetailListing(record);
    if (!listing) return null;
    return global.TasuFavoriteStore?.buildRecordFromListing?.({
      ...listing,
      _localRecord: record,
    });
  }

  global.TasuListingLocalStore = {
    STORAGE_KEY,
    SOURCE_AI,
    EVENT_NAME,
    GENERAL_DEMO_ID,
    SHOP_STORE_OTHER_DEMO_ID,
    SHOP_STORE_OTHER_DEMO_IDS,
    readAll,
    writeAll,
    fetchById,
    buildGeneralDemoRecord,
    refreshGeneralDemo,
    ensureGeneralDemo,
    seedGeneralDemoIfMissing,
    resolveGeneralDetailId,
    buildShopStoreOtherDemoRecord,
    buildShopStoreOtherDemo002Record,
    buildShopStoreOtherDemo003Record,
    refreshShopStoreOtherDemo,
    refreshShopStoreOtherDemos,
    ensureShopStoreOtherDemo,
    toShopStorePageListing,
    getShopStoreOtherDemosForListPage,
    resolveShopDetailId,
    isGeneralListingRecord,
    isShopStoreListingRecord,
    hasGeneralReviewData,
    hasGeneralAccessData,
    hasGeneralEventInfo,
    hasGeneralOrganizerInfo,
    resolveGeneralPriceLabel,
    hasShopProductData,
    hasShopReviewData,
    hasShopAccessData,
    hasShopHandlingInfo,
    resolveShopPriceLabel,
    collectDraftFromForm,
    resolveListingTypeKey,
    resolveTypesFromForm,
    buildDetailPageUrl,
    toDetailListing,
    toFavoriteSnapshot,
    upsertFromForm,
    isAiAgentSource,
    renderAiBadge,
    bindStorageSync,
    parseTags,
    parseImages,
  };
})(typeof window !== "undefined" ? window : globalThis);
