/**
 * 法人・業者・店舗 サービス詳細ページ（プレミアム法人UI）
 */
(function () {
  "use strict";

  const INVOICE_LABELS = {
    yes: "インボイス対応可能",
    no: "非対応",
    negotiable: "相談可能",
  };

  const DETAIL_RESERVATION_LABEL = "予約相談";
  const DETAIL_EMERGENCY_LABEL = "緊急相談";
  const DETAIL_ESTIMATE_CONSULT_LABEL = "見積相談";

  function isTaxiBiz(catOrListing) {
    const c =
      typeof catOrListing === "object" ? catOrListing?.business_category : catOrListing;
    return window.TasuBusinessCategories?.isTransportProfile?.(c) ?? c === "taxi";
  }

  function isConstructionBiz(catOrListing) {
    const c =
      typeof catOrListing === "object" ? catOrListing?.business_category : catOrListing;
    return window.TasuBusinessCategories?.isConstructionProfile?.(c) ?? c === "construction";
  }

  function isRepairBiz(catOrListing) {
    const c =
      typeof catOrListing === "object" ? catOrListing?.business_category : catOrListing;
    const profile = window.TasuBusinessCategories?.getDetailProfile?.(c);
    return profile === "repair" || c === "repair" || c === "repair_maintenance";
  }

  function isCleaningBiz(catOrListing) {
    const c =
      typeof catOrListing === "object" ? catOrListing?.business_category : catOrListing;
    return normBizCat(c) === "cleaning";
  }

  function getListingBusinessType(catOrListing) {
    if (window.TasuBusinessCategories?.getBusinessType) {
      return window.TasuBusinessCategories.getBusinessType(catOrListing) || "";
    }
    const c =
      typeof catOrListing === "object" ? catOrListing?.business_category : catOrListing;
    const n = normBizCat(c);
    if (n === "shop_store") return "shop_store";
    if (n === "field_service") return "field_service";
    return "";
  }

  function isShopStoreBiz(catOrListing) {
    return getListingBusinessType(catOrListing) === "shop_store";
  }

  function isFieldServiceBiz(catOrListing) {
    return getListingBusinessType(catOrListing) === "field_service";
  }

  /** 出張・現場対応UI（business_type または 対象カテゴリ） */
  function isFieldServiceUiBiz(catOrListing) {
    if (typeof catOrListing === "object" && catOrListing) {
      const bt = getListingBusinessType(catOrListing);
      if (bt === "field_service") return true;
      if (bt === "shop_store") return false;
    }
    return Boolean(window.TasuBusinessCategories?.isFieldServiceUiCategory?.(catOrListing));
  }

  function isStoreFieldBiz(catOrListing) {
    return isShopStoreBiz(catOrListing) || isFieldServiceBiz(catOrListing);
  }

  /** 店舗・販売（EC風UI）のみ */
  function isShopDetail(listingOrCat) {
    return isShopStoreBiz(listingOrCat);
  }

  /** 店舗・販売詳細（detail-shop.html）ページ */
  function isDetailShopStorePage() {
    return document.body?.dataset?.detailType === "shop_store";
  }

  /** detail-business-service.html / detail-general.html — 同一 LP レイアウト */
  function isDetailBusinessServicePage() {
    if (window.TasuDetailBusinessServiceLoader?.usesBusinessServiceLayout) {
      return window.TasuDetailBusinessServiceLoader.usesBusinessServiceLayout();
    }
    return document.body?.dataset?.detailType === "field_service";
  }

  /** 出張・現場対応 — 専用詳細UI（店舗・販売UIとは分離） */
  function isServiceStyleDetailBiz(catOrListing) {
    return isFieldServiceUiBiz(catOrListing);
  }

  const SERVICE_MENU_SECTION_TITLE = "対応メニュー";
  const SERVICE_MENU_SECTION_LEAD = "対応可能なサービス内容と料金目安です。";
  const SERVICE_MENU_INITIAL_MOBILE = 4;
  const SERVICE_MENU_INITIAL_DESKTOP = 6;
  const SERVICE_MENU_DESKTOP_MQ = "(min-width: 720px)";

  /** 対応メニュー — 全法人カテゴリ共通（service_menu_items） */
  function usesServiceMenuProfile(catOrListing) {
    const c =
      typeof catOrListing === "object"
        ? catOrListing?.business_category
        : catOrListing;
    return Boolean(normBizCat(c) || String(c || "").trim());
  }

  function normBizCat(cat) {
    return window.TasuBusinessCategories?.normalizeCategory?.(cat) || String(cat || "").trim();
  }

  const STRENGTH_PRESETS = [
    { icon: "🏗", title: "豊富な実績", descKey: "achievements" },
    { icon: "🤝", title: "一貫対応", descKey: "coverage" },
    { icon: "⚡", title: "迅速対応", descKey: "speed" },
    { icon: "🛡", title: "安心の許可", descKey: "license" },
    { icon: "👥", title: "協力会社多数", descKey: "partner" },
  ];

  const PROPERTY_TYPES = [
    { key: "office", label: "オフィス", icon: "🏢", keywords: ["オフィス", "事務所", "ビル"] },
    { key: "store", label: "店舗", icon: "🏬", keywords: ["店舗", "テナント", "商業"] },
    { key: "food", label: "飲食店", icon: "🍽", keywords: ["飲食", "レストラン", "厨房"] },
    { key: "factory", label: "工場", icon: "🏭", keywords: ["工場", "製造", "倉庫"] },
    { key: "warehouse", label: "倉庫", icon: "📦", keywords: ["倉庫", "物流"] },
    { key: "house", label: "住宅", icon: "🏠", keywords: ["住宅", "戸建", "マンション", "原状"] },
  ];

  const CATEGORY_EXTRA_SCHEMAS = {
    taxi: [
      { key: "taxi_services", label: "対応内容" },
      { key: "vehicle_types", label: "対応車種" },
      { key: "taxi_area_type", label: "対応エリア" },
      { key: "airport_transfer", label: "空港送迎", format: "support", fieldKey: "taxi_airport_transfer" },
      { key: "support_24h", label: "24時間対応", format: "support", fieldKey: "taxi_24h_available" },
      { key: "reservation_support", label: "予約対応", format: "support", fieldKey: "taxi_reservation_available" },
      { key: "corporate_contract", label: "法人契約", format: "support", fieldKey: "taxi_corporate_contract" },
      { key: "invoice_support_extra", label: "インボイス対応", format: "support", fieldKey: "taxi_invoice_available" },
      { key: "taxi_route_price", label: "ルート別料金" },
      { key: "taxi_capacity", label: "乗車人数" },
      { key: "taxi_language_support", label: "対応言語" },
      { key: "child_seat", label: "チャイルドシート", format: "support", fieldKey: "taxi_child_seat" },
    ],
    construction: [
      { key: "work_types", label: "対応工事種別" },
      { key: "construction_license", label: "建設業許可" },
      { key: "insurance", label: "保険加入", format: "insurance" },
      { key: "night_support", label: "夜間対応", format: "support" },
      { key: "emergency_support", label: "緊急対応", format: "support" },
      { key: "team_capacity", label: "対応可能人数" },
      { key: "partner_registration", label: "建設パートナー登録" },
    ],
    cleaning: [
      { key: "cleaning_types", label: "対応清掃種別" },
      { key: "regular_contract", label: "定期契約対応", format: "support" },
      { key: "spot_support", label: "スポット対応", format: "support" },
      { key: "night_support", label: "夜間対応", format: "support" },
      { key: "corporate_contract", label: "法人契約対応", format: "support" },
    ],
    repair: [
      { key: "repair_types", label: "対応修理種別" },
      { key: "visit_support", label: "出張対応", format: "support" },
      { key: "same_day_support", label: "即日対応", format: "support" },
      { key: "estimate_support", label: "見積もり対応", format: "estimate" },
      { key: "warranty_support", label: "保証対応", format: "warranty" },
    ],
    local_service: [
      { key: "service_types", label: "対応サービス種別" },
      { key: "visit_support", label: "出張対応", format: "support" },
      { key: "regular_support", label: "定期対応", format: "support" },
      { key: "senior_support", label: "高齢者対応", format: "support" },
      { key: "holiday_support", label: "土日祝対応", format: "support" },
    ],
    regional_service: [
      { key: "service_types", label: "対応サービス種別" },
      { key: "visit_support", label: "出張対応", format: "support" },
      { key: "regular_support", label: "定期対応", format: "support" },
      { key: "senior_support", label: "高齢者対応", format: "support" },
      { key: "holiday_support", label: "土日祝対応", format: "support" },
    ],
    store: [
      { key: "store_service_types", label: "対応サービス種別" },
      { key: "store_type", label: "店舗種別" },
      { key: "visit_support", label: "出張対応", format: "support" },
      { key: "regular_contract", label: "定期契約対応", format: "support" },
      { key: "night_support", label: "夜間対応", format: "support" },
      { key: "corporate_contract", label: "法人契約対応", format: "support" },
      { key: "estimate_support", label: "見積もり対応", format: "estimate" },
      { key: "reservation", label: "来店予約", format: "support" },
      { key: "coupon", label: "クーポン掲載", format: "coupon" },
      { key: "corporate_use", label: "法人/団体利用", format: "support" },
      { key: "parking", label: "駐車場", format: "parking" },
    ],
    shop_store: [
      { key: "shop_name", label: "店舗名" },
      { key: "store_type", label: "店舗カテゴリ" },
      { key: "address", label: "住所" },
      { key: "closed_day", label: "定休日" },
      { key: "access", label: "最寄駅" },
      { key: "parking", label: "駐車場", format: "parking" },
      { key: "visit_area", label: "対応エリア" },
      { key: "sales_support", label: "販売対応", format: "support" },
      { key: "buyback_support", label: "買取対応", format: "support" },
      { key: "used_sales", label: "中古販売", format: "support" },
      { key: "new_sales", label: "新品販売", format: "support" },
      { key: "visit_buyback", label: "出張買取", format: "support" },
      { key: "shop_store_free_assessment", label: "査定無料対応", format: "free_assessment" },
      { key: "fast_shipping", label: "即日発送", format: "support" },
      { key: "credit_support", label: "クレジット対応", format: "support" },
      { key: "corporate_contract", label: "法人対応", format: "support" },
    ],
    field_service: [
      { key: "work_content", label: "作業内容" },
      { key: "price_guide", label: "料金目安" },
      { key: "visit_area", label: "出張エリア" },
      { key: "service_hours", label: "対応時間" },
      { key: "travel_fee", label: "出張費" },
      { key: "estimate_support", label: "見積依頼", format: "estimate" },
      { key: "same_day_support", label: "即日対応", format: "support" },
      { key: "chat_consult", label: "チャット相談", format: "support" },
    ],
  };

  const ESTIMATE_LABELS = {
    free: "見積無料",
    paid: "有料見積",
    consult: "要相談",
  };

  const FREE_ASSESSMENT_LABELS = {
    yes: "対応",
    no: "非対応",
    free: "対応",
    paid: "非対応",
  };

  const WARRANTY_LABELS = {
    yes: "保証あり",
    no: "保証なし",
    consult: "要相談",
  };

  const COUPON_LABELS = {
    yes: "掲載希望",
    no: "希望しない",
  };

  const PARKING_LABELS = {
    yes: "あり",
    no: "なし",
    nearby: "近隣あり",
  };

  const DETAIL_ESTIMATE_LABEL = "見積もり相談";

  const SERVICE_ITEM_ICONS = ["🔧", "🏗", "🛠", "📐", "🪛", "💡", "🧱", "🪚"];
  const LICENSE_CARD_ICONS = {
    建設業許可: "📋",
    保険加入: "🛡",
    許可・資格: "✓",
    資格: "✓",
    責任者・体制: "👷",
    default: "📋",
  };
  const PRICE_CARD_ICONS = {
    料金目安: "💴",
    日給: "☀",
    夜勤: "🌙",
    夜間: "🌙",
    軽作業: "☀",
    支払い条件: "💳",
    工期: "📅",
    対応期間: "📅",
    対応可能人数: "👥",
    default: "💴",
  };

  let galleryState = { urls: [], index: 0 };

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

  function textOrDash(value) {
    const s = String(value ?? "").trim();
    return s || "—";
  }

  function truncateText(text, max) {
    const s = String(text ?? "").trim();
    if (!s || s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  /** FVキャッチコピー（2行以内・短文） */
  function pickHeroCatchcopy(listing) {
    const preset = truncateText(
      listing.boardCoverageShort || listing.serviceSummary || "",
      44
    );
    if (preset && !isBoardLongText(preset)) return preset;

    const title = String(listing.title || "").trim();
    if (/[・／/]/.test(title)) {
      const parts = title
        .split(/[・／/]+/)
        .map((p) => truncateText(p.trim(), 22))
        .filter(Boolean)
        .slice(0, 2);
      if (parts.length) return parts.join("\n");
    }
    return truncateText(title, 42);
  }

  function isBoardLongText(text) {
    const s = String(text ?? "").trim();
    return s.length > 52 || /[。！？]/.test(s);
  }

  function extractRegionFromTitle(title) {
    const m = String(title ?? "").match(/[（(]([^）)]+(?:都|道|府|県|市|区|町|村))[）)]/);
    return m ? m[1].trim() : "";
  }

  function pickCaseRegion(listing, title, index) {
    const fromTitle = extractRegionFromTitle(title);
    if (fromTitle) return fromTitle;
    const area = String(listing.service_area || "").trim();
    if (!area) return "";
    const parts = area.split(/[、,]/).map((s) => s.trim()).filter(Boolean);
    return parts[index % Math.max(parts.length, 1)] || parts[0] || "";
  }

  function splitListText(text) {
    return String(text ?? "")
      .split(/[,、・／/\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function formatDisplayText(value, fieldKey) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (window.TasuBusinessWording?.formatDisplayValue) {
      return window.TasuBusinessWording.formatDisplayValue(raw, fieldKey || "");
    }
    const lower = raw.toLowerCase();
    const BOOL = { yes: "対応可能", no: "非対応", true: "対応可能", false: "非対応" };
    return BOOL[lower] || raw;
  }

  function formatExtraValue(value, format, fieldKey) {
    const fk =
      fieldKey ||
      (format === "insurance"
        ? "insurance"
        : format === "estimate"
          ? "estimate_support"
          : format === "free_assessment"
            ? "shop_store_free_assessment"
            : format === "warranty"
            ? "warranty_support"
            : format === "coupon"
              ? "coupon"
              : format === "parking"
                ? "parking"
                : "");
    if (window.TasuBusinessWording?.formatExtraFieldValue && fk) {
      const out = window.TasuBusinessWording.formatExtraFieldValue(fk, value);
      if (out) return out;
    }
    if (window.TasuBusinessWording?.formatDisplayValue && fk) {
      const out = window.TasuBusinessWording.formatDisplayValue(value, fk);
      if (out) return out;
    }
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (format === "estimate") return ESTIMATE_LABELS[raw] || formatDisplayText(raw, "estimate_support");
    if (format === "free_assessment") {
      return (
        FREE_ASSESSMENT_LABELS[raw] ||
        formatDisplayText(raw, "shop_store_free_assessment")
      );
    }
    if (format === "warranty") return WARRANTY_LABELS[raw] || formatDisplayText(raw, "warranty_support");
    if (format === "coupon") return COUPON_LABELS[raw] || formatDisplayText(raw, "coupon");
    if (format === "parking") return PARKING_LABELS[raw] || formatDisplayText(raw, "parking");
    return formatDisplayText(raw, fieldKey);
  }

  function getCategoryExtraProfileKey(cat, listing) {
    if (isTaxiBiz(cat)) return "taxi";
    if (isFieldServiceUiBiz(listing || cat)) return "field_service";
    if (isCleaningBiz(cat)) return "cleaning";
    if (isShopStoreBiz(listing || cat)) return "shop_store";
    if (isFieldServiceBiz(listing || cat)) return "field_service";
    if (normBizCat(cat) === "store_field_service") {
      return isShopStoreBiz(listing) ? "shop_store" : "field_service";
    }
    if (isRepairBiz(cat)) return "repair";
    if (isConstructionBiz(cat)) return "construction";
    return (
      window.TasuBusinessCategories?.getExtraSectionKey?.(cat, listing) ||
      window.TasuBusinessCategories?.getDetailProfile?.(cat) ||
      cat
    );
  }

  function getCategoryExtraBlock(listing) {
    const cat = listing.business_category || "";
    const profileKey = getCategoryExtraProfileKey(cat, listing);
    const extra = listing.category_extra || {};
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const fdExtra = fd.category_extra || {};
    const block =
      extra[profileKey] && typeof extra[profileKey] === "object"
        ? { ...extra[profileKey] }
        : fdExtra[profileKey] && typeof fdExtra[profileKey] === "object"
          ? { ...fdExtra[profileKey] }
          : extra.store && profileKey === "shop_store"
            ? { ...extra.store }
            : extra[cat] && typeof extra[cat] === "object"
              ? { ...extra[cat] }
              : { ...extra };

    if (!isTaxiBiz(cat)) return block;

    const taxiTop = {
      taxi_services: listing.taxi_service_type,
      vehicle_types: listing.taxi_vehicle_type,
      taxi_area_type: listing.taxi_area_type,
      airport_transfer: listing.taxi_airport_transfer,
      support_24h: listing.taxi_24h_available,
      reservation_support: listing.taxi_reservation_available,
      corporate_contract: listing.taxi_corporate_contract,
      invoice_support_extra: listing.taxi_invoice_available,
      taxi_base_fare: listing.taxi_base_fare,
      taxi_night_fare: listing.taxi_night_fare,
      taxi_route_price: listing.taxi_route_price,
      taxi_capacity: listing.taxi_capacity,
      taxi_language_support: listing.taxi_language_support,
      child_seat: listing.taxi_child_seat,
      taxi_payment_methods: listing.taxi_payment_methods,
      booking_types: listing.taxi_booking_types,
    };
    Object.entries(taxiTop).forEach(([key, value]) => {
      if (value != null && String(value).trim() !== "") {
        block[key] = value;
      }
    });
    return block;
  }

  function taxiSupportYes(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "yes" || raw === "true" || raw === "対応可能" || raw === "1";
  }

  function shopStoreFreeAssessmentYes(block) {
    if (!block || typeof block !== "object") return false;
    const raw = String(
      block.shop_store_free_assessment ?? block.estimate_support ?? ""
    )
      .trim()
      .toLowerCase();
    return raw === "yes" || raw === "free" || raw === "true" || raw === "1";
  }

  function getDetailSecondaryCtaLabel(listing) {
    if (isTaxiBiz(listing)) return DETAIL_RESERVATION_LABEL;
    if (isRepairBiz(listing)) return DETAIL_EMERGENCY_LABEL;
    if (isCleaningBiz(listing) || isFieldServiceBiz(listing) || isFieldServiceUiBiz(listing)) {
      return DETAIL_ESTIMATE_CONSULT_LABEL;
    }
    return DETAIL_ESTIMATE_LABEL;
  }

  function getDetailSecondaryCtaAnchor(listing) {
    if (isTaxiBiz(listing)) return "#section-achievements";
    if (isRepairBiz(listing)) return getRepairEmergencyAnchor(listing);
    if (isShopStoreBiz(listing)) return "#section-products";
    if (isCleaningBiz(listing) || isFieldServiceUiBiz(listing)) return "#section-service-menu";
    return "#section-service-menu";
  }

  function getStoreAiConsultAnchor(listing) {
    if (global.TasuAiWorkspaceLinks?.buildListingConsultUrl) {
      return global.TasuAiWorkspaceLinks.buildListingConsultUrl(listing);
    }
    const id = String(listing?.id || "").trim();
    if (id) {
      return `ai-workspace.html?mode=cross-matching&listingId=${encodeURIComponent(id)}`;
    }
    return "ai-workspace.html?mode=cross-matching";
  }

  function getRepairEmergencyAnchor(listing) {
    const phone = String(listing?.phone || "").trim();
    if (phone) {
      const digits = phone.replace(/[^\d+]/g, "");
      if (digits) return `tel:${digits}`;
    }
    return "#section-coverage";
  }

  function getDetailInquiryAnchor(listing) {
    return listing?.business_category === "taxi" ? "#section-strengths" : "#section-strengths";
  }

  function isTaxiCoverageDuplicateTag(label, seen) {
    const text = sanitizeTaxiDisplayText(String(label || "").trim());
    if (!text || seen.has(text)) return true;
    const norm = (s) =>
      String(s || "")
        .replace(/対応$/, "")
        .replace(/送迎$/, "")
        .trim();
    const n = norm(text);
    return [...seen].some((c) => {
      const cn = norm(c);
      return (cn && n && cn === n) || c.includes(text) || text.includes(c);
    });
  }

  function formatTaxiPayments(raw) {
    if (!raw) return "";
    if (Array.isArray(raw)) {
      return raw.map((item) => formatDisplayText(item, "payment_type")).filter(Boolean).join("、");
    }
    return formatDisplayText(raw, "payment_type") || String(raw).trim();
  }

  function getSearchBlob(listing) {
    return [
      listing.title,
      listing.description,
      listing.boardCoverageShort,
      listing.service_area,
      (listing.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
  }

  function buildPlaceholderUrl(name) {
    const n = encodeURIComponent(String(name || "Biz").slice(0, 14));
    return `https://ui-avatars.com/api/?name=${n}&background=f8f4eb&color=967622&size=480&bold=true&format=svg`;
  }

  /** タクシー詳細ヒーロー用ストック画像（送迎・車両・空港系） */
  const TAXI_HERO_STOCK_IMAGES = [
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=960&q=80",
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b8?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1556388156-38ed1903742b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=640&q=80",
  ];

  function isGenericHeroImageUrl(url) {
    const u = String(url || "").toLowerCase();
    return (
      !u ||
      /ui-avatars\.com|placeholder|logo\?|dicebear|robohash|generated|avatar/i.test(u)
    );
  }

  function resolveTaxiHeroImages(listing) {
    const urls = [];
    const main = String(listing.imageUrl || listing.image_url || "").trim();
    const gallery = Array.isArray(listing.galleryUrls)
      ? listing.galleryUrls
      : Array.isArray(listing.gallery_urls)
        ? listing.gallery_urls
        : [];
    if (main && !isGenericHeroImageUrl(main)) urls.push(main);
    gallery.forEach((u) => {
      const s = String(u || "").trim();
      if (s && !isGenericHeroImageUrl(s) && !urls.includes(s)) urls.push(s);
    });
    if (urls.length) return urls.slice(0, 5);
    return TAXI_HERO_STOCK_IMAGES.slice();
  }

  function usesWorkCasesProfile(listing) {
    return (
      isConstructionBiz(listing) ||
      isRepairBiz(listing) ||
      isCleaningBiz(listing) ||
      isStoreFieldBiz(listing) ||
      isFieldServiceUiBiz(listing)
    );
  }

  function pickWorkCasesRaw(listing) {
    if (Array.isArray(listing.work_cases) && listing.work_cases.length) {
      return listing.work_cases;
    }
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    if (Array.isArray(fd.work_cases) && fd.work_cases.length) {
      return fd.work_cases;
    }
    const bsCases = fd.business_service?.work_cases;
    if (Array.isArray(bsCases) && bsCases.length) return bsCases;
    return [];
  }

  function workCasePeriodLabel(listing) {
    if (isRepairBiz(listing) || isServiceStyleDetailBiz(listing)) return "対応日";
    return "工期";
  }

  const WORK_CASE_PHOTOS_MAX = 3;

  function trimImageUrl(item) {
    if (!item) return "";
    if (typeof item === "string") return item.trim();
    if (typeof item === "object") {
      return String(
        item.url || item.image_url || item.imageUrl || item.src || item.href || ""
      ).trim();
    }
    return "";
  }

  function mergeUniqueImageUrls(target, bucket) {
    const arr = Array.isArray(bucket) ? bucket : [];
    arr.forEach((item) => {
      const url = trimImageUrl(item);
      if (url && !target.includes(url)) target.push(url);
    });
  }

  /** 配列 / JSON 文字列 / オブジェクト配列 → URL 配列 */
  function normalizeImages(raw) {
    if (raw == null || raw === "") return [];
    let arr = raw;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          arr = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          arr = [trimmed];
        }
      } else {
        arr = trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(arr)) arr = [arr];
    const out = [];
    arr.forEach((item) => {
      const url = trimImageUrl(item);
      if (url && !out.includes(url)) out.push(url);
    });
    return out;
  }

  /** ヒーロー下サムネ・実績カード共通（business_listings.gallery_urls / images） */
  function resolveSubImages(listing) {
    return normalizeImages(listing.gallery_urls || listing.images).slice(
      0,
      WORK_CASE_PHOTOS_MAX
    );
  }

  function workCaseImageAt(listing, index) {
    return resolveSubImages(listing)[index] || "";
  }

  function normalizeWorkCaseText(item, listing, index) {
    const defaultContent = pickDefaultCaseContent(listing);
    const description = String(
      item.description || item.category || item.content || item.service || ""
    ).trim();
    const outcome = String(item.outcome || item.note || item.notes || "").trim();
    return {
      title: String(item.title || item.name || `事例 ${index + 1}`).trim(),
      content: description || defaultContent,
      outcome,
      period: String(item.period || item.duration || "").trim(),
      cost: String(item.price || item.cost || "").trim(),
      region: String(item.region || item.area || "").trim(),
      note: outcome,
    };
  }

  function mergeWorkCaseItem(item, listing, index) {
    const base = normalizeWorkCaseText(item, listing, index);
    const subs = resolveSubImages(listing);
    const before = trimImageUrl(
      item.before_image_url ||
        item.before_image ||
        item.before_url ||
        subs[index * 2] ||
        ""
    );
    const after = trimImageUrl(
      item.after_image_url ||
        item.after_image ||
        item.after_url ||
        subs[index * 2 + 1] ||
        ""
    );
    const single = trimImageUrl(item.image_url || item.image || subs[index] || "");
    return {
      ...base,
      before_image: before,
      after_image: after,
      image_url: single || before || after || workCaseImageAt(listing, index),
    };
  }

  function resolveGalleryOnlyImages(listing) {
    const main = String(
      listing.imageUrl ||
        listing.image_url ||
        listing.main_image_url ||
        listing.mainImageUrl ||
        ""
    ).trim();

    const subs = normalizeImages(listing.gallery_urls || listing.images);
    let urls = subs.slice();
    if (!urls.length && Array.isArray(listing.galleryUrls)) {
      urls = listing.galleryUrls.filter((u) => !main || u !== main);
    }

    if (main && !urls.includes(main)) urls.unshift(main);
    if (!urls.length && main) urls.push(main);
    return urls.filter(Boolean);
  }

  const STORE_SHOP_IMAGE_PREFER =
    /tool|shop|store|shelf|interior|warehouse|retail|1504328345606|1504148455325|1530124566582/i;
  const STORE_SHOP_IMAGE_AVOID =
    /weld|welding|溶接|spark|factory.?floor|1581092160562|1581578731548|cleaning|清掃/i;

  function scoreStoreShopImageUrl(url) {
    const u = String(url || "").toLowerCase();
    let score = 0;
    if (!u || isGenericHeroImageUrl(url)) return -100;
    if (STORE_SHOP_IMAGE_PREFER.test(u)) score += 10;
    if (STORE_SHOP_IMAGE_AVOID.test(u)) score -= 12;
    return score;
  }

  function resolveStoreShopHeroImages(listing) {
    const main = String(
      listing.imageUrl || listing.image_url || listing.main_image_url || ""
    ).trim();
    const gallery = [
      ...(Array.isArray(listing.gallery_urls) ? listing.gallery_urls : []),
      ...(Array.isArray(listing.galleryUrls) ? listing.galleryUrls : []),
      ...(Array.isArray(listing.images) ? listing.images : []),
    ];
    const seen = new Set();
    const candidates = [];
    [main, ...gallery].forEach((raw) => {
      const u = String(raw || "").trim();
      if (!u || seen.has(u) || isGenericHeroImageUrl(u)) return;
      seen.add(u);
      candidates.push({ url: u, score: scoreStoreShopImageUrl(u) });
    });
    candidates.sort((a, b) => b.score - a.score);
    const urls = candidates.map((c) => c.url);
    if (urls.length) return urls.slice(0, 8);
    return resolveGalleryOnlyImages(listing);
  }

  function resolveImages(listing) {
    if (isTaxiBiz(listing)) {
      return resolveTaxiHeroImages(listing);
    }
    if (isShopDetail(listing)) {
      return resolveStoreShopHeroImages(listing);
    }
    return resolveGalleryOnlyImages(listing);
  }

  function buildStatusBadgeHtml(listing, options = {}) {
    if (window.TasuBusinessBoardRenderer?.buildStatusBadges) {
      return window.TasuBusinessBoardRenderer.buildStatusBadges(listing, {
        maxExtra: 8,
        hidePrFeatured: options.hidePrFeatured === true,
      });
    }
    const label = listing.statusLabel || "受付中";
    const mod = listing.recruitStatusMod || "is-open";
    return `<span class="badge biz-badge biz-badge--recruit ${mod}">${escapeHtml(label)}</span>`;
  }

  /**
   * タクシー受付状態（ヒーロー左・タイトル上）。タグ列とは別表示。
   * state: open | busy | paused
   */
  function resolveTaxiReceptionStatus(listing) {
    const mod = listing.recruitStatusMod || "is-open";
    let state = "open";
    if (mod === "is-busy") state = "busy";
    else if (mod === "is-paused" || mod === "is-closed") state = "paused";

    const block = getCategoryExtraBlock(listing);
    const hours = String(listing.business_hours || "").trim();
    const is24h =
      /24\s*時間|24h|24H/i.test(hours) || taxiSupportYes(block.support_24h);

    const labels = {
      open: is24h ? "24時間受付中" : listing.statusLabel || "受付中",
      busy: "混雑中",
      paused: "予約停止",
    };
    return { state, label: labels[state] || labels.open };
  }

  function renderTaxiReceptionStatus(listing) {
    const wrap = document.querySelector("[data-biz-detail-reception-wrap]");
    const el = document.querySelector("[data-biz-detail-reception]");
    const textEl = document.querySelector("[data-biz-detail-reception-text]");
    if (!wrap || !el || !textEl) return;

    const { state, label } = resolveTaxiReceptionStatus(listing);
    el.className = `biz-detail-reception biz-detail-reception--${state}`;
    textEl.textContent = label;
    wrap.hidden = false;
  }

  const TAXI_HERO_TRUST_TAG_DEFS = [
    { label: "空港送迎", icon: "✈️", match: (b) => taxiSupportYes(b.airport_transfer) },
    {
      label: "24時間対応",
      icon: "🕐",
      match: (b, l) =>
        taxiSupportYes(b.support_24h) || /24\s*時間|24h/i.test(String(l.business_hours || "")),
    },
    { label: "法人契約", icon: "🏢", match: (b) => taxiSupportYes(b.corporate_contract) },
    {
      label: "インボイス対応",
      icon: "🧾",
      match: (b, l) => taxiSupportYes(b.invoice_support_extra) || l.invoice_support === "yes",
    },
    {
      label: "深夜対応",
      icon: "🌙",
      match: (b) => taxiSupportYes(b.support_24h) || Boolean(b.taxi_night_fare),
    },
    {
      label: "予約対応",
      icon: "📅",
      match: (b) => taxiSupportYes(b.reservation_support),
    },
  ];

  /** ヒーロー：特徴タグ（アイコン付き pill） */
  function pickTaxiHeroTrustTags(listing) {
    const block = getCategoryExtraBlock(listing);
    const seen = new Set();
    const tags = [];

    TAXI_HERO_TRUST_TAG_DEFS.forEach((def) => {
      if (!def.match(block, listing) || seen.has(def.label)) return;
      seen.add(def.label);
      tags.push({ label: def.label, icon: def.icon });
    });

    (listing.tags || []).forEach((raw) => {
      const label = sanitizeTaxiDisplayText(String(raw || "").trim());
      if (!label || /^(受付中|PR|PR掲載|タクシー)$/i.test(label) || seen.has(label)) return;
      if (/24時間/.test(label)) return;
      seen.add(label);
      tags.push({ label, icon: "" });
    });

    if (tags.length < 3) {
      splitListText(block.taxi_services || listing.taxi_service_type)
        .slice(0, 6)
        .forEach((s) => {
          const label = sanitizeTaxiDisplayText(s);
          if (!label || /^タクシー$/i.test(label) || seen.has(label)) return;
          seen.add(label);
          tags.push({ label, icon: "" });
        });
    }
    return tags.slice(0, 6);
  }

  function buildTaxiHeroTrustTagHtml(tag) {
    const iconHtml = tag.icon
      ? `<span class="biz-detail-hero__trust-tag-icon" aria-hidden="true">${tag.icon}</span>`
      : "";
    return `<span class="biz-detail-hero__trust-tag">${iconHtml}<span class="biz-detail-hero__trust-tag-label">${escapeHtml(tag.label)}</span></span>`;
  }

  function buildTaxiHeroHeadline(listing) {
    const block = getCategoryExtraBlock(listing);
    const areas = splitListText(String(block.taxi_area_type || listing.service_area || ""));
    const hasNarita = areas.some((a) => /成田/.test(a));
    const hasHaneda = areas.some((a) => /羽田/.test(a));

    let line1 = "";
    if (hasNarita && hasHaneda) line1 = "成田空港・羽田空港対応";
    else if (hasNarita) line1 = "成田空港送迎対応";
    else if (hasHaneda) line1 = "羽田空港送迎対応";
    else if (areas.length) {
      const chunk = areas
        .slice(0, 2)
        .map((a) => (/対応$/.test(a) ? a : /空港/.test(a) ? `${a}対応` : a))
        .join("・");
      line1 = chunk;
    }

    const line2Parts = [];
    if (taxiSupportYes(block.support_24h) || /24\s*時間/.test(String(listing.business_hours || ""))) {
      line2Parts.push("24時間送迎");
    }
    if (taxiSupportYes(block.corporate_contract)) line2Parts.push("法人契約対応");
    const line2 = line2Parts.join(" ");

    const line3 = "タクシーサービス";
    const lines = [line1, line2, line3].filter(Boolean);
    if (lines.length >= 2) return lines.join("\n");

    return formatTaxiHeroHeadlineFallback(listing.title);
  }

  function formatTaxiHeroHeadlineFallback(title) {
    const raw = String(title || "").trim();
    if (!raw) return "送迎・配車サービス\nタクシーサービス";
    if (raw.includes("\n")) return raw;
    const parts = raw
      .split(/[・／/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length <= 2) return `${parts.join("・")}\nタクシーサービス`;
    return `${parts.slice(0, 2).join("・")}\n${parts.slice(2).join(" ")}\nタクシーサービス`;
  }

  function renderTaxiHeroMain(listing) {
    const receptionBlock = document.querySelector("[data-biz-detail-hero-reception-block]");
    const tagRow = document.querySelector("[data-biz-detail-hero-tag-row]");
    const categoryEl = document.querySelector("[data-biz-detail-category]");
    const badgesEl = document.querySelector("[data-biz-detail-hero-badges]");
    const titleEl = document.querySelector("[data-biz-detail-title]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
    const coverageEl = document.querySelector("[data-biz-detail-coverage]");
    const hintEl = document.querySelector("[data-biz-detail-reception-hint]");
    const mainEl = document.querySelector(".biz-detail-fv__main");

    if (mainEl) mainEl.classList.add("biz-detail-fv__main--taxi");
    if (receptionBlock) receptionBlock.hidden = false;
    if (tagRow) tagRow.hidden = false;
    if (categoryEl) {
      categoryEl.hidden = true;
      categoryEl.innerHTML = "";
    }

    const headline = buildTaxiHeroHeadline(listing);
    if (titleEl) {
      titleEl.classList.add("biz-detail-hero__headline");
      const lineCount = headline.split("\n").filter(Boolean).length;
      titleEl.dataset.catchLines = String(Math.min(3, Math.max(1, lineCount)));
      if (headline.includes("\n")) {
        titleEl.innerHTML = headline
          .split("\n")
          .map((line) => escapeHtml(line))
          .join("<br>");
      } else {
        titleEl.textContent = headline;
      }
    }

    const { state } = resolveTaxiReceptionStatus(listing);
    renderTaxiReceptionStatus(listing);
    if (hintEl) {
      hintEl.hidden = state !== "open";
      hintEl.textContent = state === "open" ? "いつでもご予約・ご相談いただけます" : "";
    }

    if (badgesEl) {
      badgesEl.innerHTML = pickTaxiHeroTrustTags(listing).map(buildTaxiHeroTrustTagHtml).join("");
    }

    renderHeroCompanyTitleRow(listing);

    const desc = String(listing.description || "").trim();
    if (leadEl) {
      leadEl.hidden = !desc;
      leadEl.textContent = desc;
    }
    if (coverageEl) coverageEl.hidden = true;
  }

  /* ── 修理・メンテナンス詳細（建設UI派生） ── */

  const REPAIR_STRENGTH_PRESETS = [
    { icon: "⚡", title: "最短30分対応", descKey: "speed" },
    { icon: "🚐", title: "出張修理対応", descKey: "visit" },
    { icon: "🏢", title: "法人契約OK", descKey: "corporate" },
    { icon: "🌙", title: "深夜対応", descKey: "night" },
    { icon: "📋", title: "見積無料", descKey: "estimate" },
    { icon: "📞", title: "24時間受付", descKey: "reception" },
  ];

  const REPAIR_TRUST_TAG_DEFS = [
    { label: "24時間対応", icon: "🕒", match: (b, l) => taxiSupportYes(b.support_24h) || /24\s*時間/.test(String(l.business_hours || "")) },
    { label: "出張修理", icon: "🚐", match: (b) => taxiSupportYes(b.visit_support) },
    { label: "見積無料", icon: "📋", match: (b, l) => taxiSupportYes(b.estimate_support) || /見積無料|無料見積/i.test(getSearchBlob(l)) },
    { label: "法人対応", icon: "🏢", match: (b, l) => taxiSupportYes(b.corporate_contract) || l.isCorporateWelcome },
    { label: "緊急対応", icon: "🚨", match: (b, l) => l.isUrgent || /緊急/i.test(getSearchBlob(l)) },
    { label: "即日対応", icon: "⚡", match: (b, l) => taxiSupportYes(b.same_day_support) || l.isStartSoon || l.isUrgent },
  ];

  const REPAIR_COVERAGE_GROUPS = [
    {
      title: "水道",
      icon: "💧",
      items: ["水漏れ", "詰まり", "トイレ修理", "配管", "蛇口交換"],
    },
    {
      title: "電気",
      icon: "⚡",
      items: ["漏電", "ブレーカー", "コンセント", "照明", "配線"],
    },
    {
      title: "エアコン",
      icon: "❄️",
      items: ["冷えない", "水漏れ", "異音", "清掃", "交換"],
    },
  ];

  const REPAIR_DEMO_REVIEW_SUMMARY = {
    average: 4.8,
    totalCount: 142,
    breakdown: [
      { star: 5, pct: 86, count: 0 },
      { star: 4, pct: 10, count: 0 },
      { star: 3, pct: 3, count: 0 },
      { star: 2, pct: 1, count: 0 },
      { star: 1, pct: 0, count: 0 },
    ],
  };

  const REPAIR_DEMO_REVIEWS = [
    {
      rating: 5,
      tags: ["水漏れ"],
      text: "深夜の水漏れで即日対応いただきました。説明も丁寧で安心できました。",
      date: "2026-04-10",
    },
    {
      rating: 5,
      tags: ["出張修理"],
      text: "オフィスのブレーカー不具合を短時間で復旧。法人向けの対応もスムーズです。",
      date: "2026-03-28",
    },
    {
      rating: 4,
      tags: ["エアコン"],
      text: "エアコンの異音対応。見積の説明が明確で、作業も丁寧でした。",
      date: "2026-03-05",
    },
    {
      rating: 5,
      tags: ["見積無料"],
      text: "見積だけの相談でも快く対応。急ぎの修理も翌日に入れてもらえ助かりました。",
      date: "2026-02-18",
    },
  ];

  function buildRepairHeroHeadline(listing) {
    const block = getCategoryExtraBlock(listing);
    const types = splitListText(block.repair_types || listing.title || "");
    const line1 =
      types.length >= 2
        ? `${types.slice(0, 2).join("・")}修理サービス`
        : types[0]
          ? `${types[0]}修理サービス`
          : "水道・電気・設備修理サービス";

    const line2Parts = [];
    if (taxiSupportYes(block.support_24h) || /24\s*時間/.test(String(listing.business_hours || ""))) {
      line2Parts.push("24時間対応");
    }
    if (taxiSupportYes(block.same_day_support) || listing.isStartSoon || listing.isUrgent) {
      line2Parts.push("緊急修理・出張メンテナンス");
    } else {
      line2Parts.push("出張メンテナンス");
    }

    return [line1, line2Parts.join(" ")].filter(Boolean).join("\n");
  }

  function resolveRepairReceptionStatus(listing) {
    const block = getCategoryExtraBlock(listing);
    const mod = listing.recruitStatusMod || "is-open";
    let state = "open";
    let label = "緊急対応可能";

    if (mod === "is-busy") {
      state = "busy";
      label = "対応中（折返しご連絡）";
    } else if (mod === "is-paused" || mod === "is-closed") {
      state = "paused";
      label = "受付一時停止";
    } else if (taxiSupportYes(block.same_day_support) || listing.isStartSoon) {
      label = "即日対応可能";
    } else if (/最短|30\s*分/i.test(getSearchBlob(listing))) {
      label = "最短30分対応";
    }

    return { state, label };
  }

  function renderRepairReceptionStatus(listing) {
    const wrap = document.querySelector("[data-biz-detail-reception-wrap]");
    const el = document.querySelector("[data-biz-detail-reception]");
    const textEl = document.querySelector("[data-biz-detail-reception-text]");
    if (!wrap || !el) return;

    const { state, label } = resolveRepairReceptionStatus(listing);
    el.className = `biz-detail-reception biz-detail-reception--${state}`;
    if (textEl) textEl.textContent = label;
    wrap.hidden = false;
  }

  function pickRepairHeroTrustTags(listing) {
    const block = getCategoryExtraBlock(listing);
    const picked = [];
    const seen = new Set();
    REPAIR_TRUST_TAG_DEFS.forEach((def) => {
      if (picked.length >= 6) return;
      if (!def.match(block, listing)) return;
      if (seen.has(def.label)) return;
      seen.add(def.label);
      picked.push(def);
    });
    return picked;
  }

  function buildRepairConditionTagHtml(label) {
    return `<span class="biz-detail-hero__condition-tag">${escapeHtml(label)}</span>`;
  }

  function pickRepairHeroConditionTags(listing) {
    const fromTrust = pickRepairHeroTrustTags(listing).map((def) => def.label);
    if (fromTrust.length >= 3) return fromTrust.slice(0, 6);

    const seen = new Set(fromTrust);
    const serviceTags = Array.isArray(listing.service_tags) ? listing.service_tags : [];
    serviceTags.forEach((label) => {
      const text = String(label || "").trim();
      if (text && !seen.has(text) && fromTrust.length < 6) {
        fromTrust.push(text);
        seen.add(text);
      }
    });
    const defaults = ["24時間対応", "出張修理", "見積無料", "法人対応", "緊急対応", "即日対応"];
    defaults.forEach((label) => {
      if (fromTrust.length < 6 && !seen.has(label)) {
        fromTrust.push(label);
        seen.add(label);
      }
    });
    return fromTrust.slice(0, 6);
  }

  function hideLegacyFvFavorite() {
    const legacy = document.querySelector(
      ".biz-detail-fv-card > .biz-detail-favorite[data-biz-detail-favorite]"
    );
    if (!legacy) return;
    legacy.hidden = true;
    legacy.setAttribute("aria-hidden", "true");
  }

  function resolveRepairTargetClients(listing) {
    const fromDb = String(listing.target_users || "").trim();
    if (fromDb) return fromDb;
    const block = getCategoryExtraBlock(listing);
    const blob = getSearchBlob(listing);
    const corporate =
      listing.isCorporateWelcome || taxiSupportYes(block.corporate_contract) || /法人/i.test(blob);
    const individual = /個人/i.test(blob);
    if (corporate && individual) return "法人・個人";
    if (corporate) return "法人・個人";
    return individual ? "個人" : "法人・個人";
  }

  function resolveRepairMinResponseTime(listing) {
    const fromDb = String(listing.response_time || "").trim();
    if (fromDb) return fromDb;
    const block = getCategoryExtraBlock(listing);
    const blob = getSearchBlob(listing);
    if (/30\s*分|最短\s*30/i.test(blob)) return "30分〜（エリアにより異なります）";
    if (taxiSupportYes(block.same_day_support) || listing.isStartSoon || listing.isUrgent) {
      return "即日〜";
    }
    const start = listing.startDateText || "";
    if (start && start !== "—") return start;
    return "要相談";
  }

  const SERVICE_HERO_TITLE_MAX_LINES = 2;
  const SERVICE_HERO_TITLE_MIN_PX = 26;
  const SERVICE_HERO_TITLE_MAX_PX = 42;
  const SERVICE_HERO_TITLE_LINE_HEIGHT = 1.25;

  function fitServiceHeroHeadline(titleEl) {
    if (!titleEl) return;
    titleEl.classList.add("biz-detail-hero__headline--fit");
    titleEl.style.lineHeight = String(SERVICE_HERO_TITLE_LINE_HEIGHT);
    titleEl.style.maxWidth = "100%";
    titleEl.style.overflow = "visible";
    titleEl.style.textOverflow = "unset";
    const maxLines = SERVICE_HERO_TITLE_MAX_LINES;
    const lh = SERVICE_HERO_TITLE_LINE_HEIGHT;
    let fontSize = SERVICE_HERO_TITLE_MAX_PX;
    titleEl.style.fontSize = `${fontSize}px`;

    const maxHeightFor = (size) => size * lh * maxLines + 2;
    while (titleEl.scrollHeight > maxHeightFor(fontSize) && fontSize > SERVICE_HERO_TITLE_MIN_PX) {
      fontSize -= 1;
      titleEl.style.fontSize = `${fontSize}px`;
    }
  }

  function bindServiceHeroTitleResize(titleEl) {
    if (!titleEl || titleEl.dataset.headlineResizeBound === "1") return;
    titleEl.dataset.headlineResizeBound = "1";
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const el = document.querySelector(
          "[data-biz-detail-title].biz-detail-hero__headline--fit"
        );
        if (!el) return;
        if (
          !document.body.classList.contains("biz-detail-page--repair") &&
          !document.body.classList.contains("biz-detail-page--cleaning") &&
          !document.body.classList.contains("biz-detail-page--store") &&
          !document.body.classList.contains("biz-detail-page--field-service")
        ) {
          return;
        }
        el.style.fontSize = `${SERVICE_HERO_TITLE_MAX_PX}px`;
        fitServiceHeroHeadline(el);
      }, 120);
    });
  }

  /** 会社名横バッジ（法人 / PR掲載）— 詳細ヒーローではここだけで描画 */
  function renderHeroCompanyTitleRow(listing) {
    const companyEl = document.querySelector("[data-biz-detail-company]");
    const badgesHost = document.querySelector("[data-biz-detail-title-badges]");
    const row = document.querySelector(".biz-detail-hero__company-row");
    const companyName = listing.company_name || listing.title || "";
    const block = getCategoryExtraBlock(listing);
    const showCorpBadge =
      listing.isCorporateWelcome || taxiSupportYes(block.corporate_contract);

    if (row) row.classList.add("biz-detail-hero__title-row");
    if (companyEl) setTextContent(companyEl, companyName);

    const badges = [];
    const seen = new Set();
    if (showCorpBadge) {
      seen.add("法人");
      badges.push('<span class="biz-detail-hero__corp-badge">法人</span>');
    }
    if (listing.isPr && !seen.has("PR掲載")) {
      seen.add("PR掲載");
      badges.push('<span class="biz-detail-hero__pr biz-detail-hero__pr--inline">PR掲載</span>');
    }
    if (badgesHost) {
      badgesHost.innerHTML = badges.join("");
      badgesHost.hidden = badges.length === 0;
    }
  }

  /** 修理・清掃 共通ヒーロー中央（配列・余白は同一、文言のみ profile で差し替え） */
  function renderServiceHeroMain(listing, profile) {
    const receptionBlock = document.querySelector("[data-biz-detail-hero-reception-block]");
    const tagRow = document.querySelector("[data-biz-detail-hero-tag-row]");
    const categoryEl = document.querySelector("[data-biz-detail-category]");
    const badgesEl = document.querySelector("[data-biz-detail-hero-badges]");
    const conditionTagsEl = document.querySelector("[data-biz-detail-hero-condition-tags]");
    const titleEl = document.querySelector("[data-biz-detail-title]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
    const coverageEl = document.querySelector("[data-biz-detail-coverage]");
    const hintEl = document.querySelector("[data-biz-detail-reception-hint]");
    const mainEl = document.querySelector(".biz-detail-fv__main");

    const isRepair = profile === "repair";
    const isStore = profile === "store";
    const buildHeadline = isRepair
      ? buildRepairHeroHeadline
      : isStore
        ? buildStoreHeroHeadline
        : buildCleaningHeroHeadline;
    const renderReception = isRepair
      ? renderRepairReceptionStatus
      : isStore
        ? renderStoreReceptionStatus
        : renderCleaningReceptionStatus;
    const receptionHint = isRepair
      ? "最短30分で駆けつけ！"
      : isStore
        ? "店舗のご状況に合わせてご相談ください"
        : "まずはお気軽にご相談ください";
    const pickConditionTags = isRepair
      ? pickRepairHeroConditionTags
      : isStore
        ? pickStoreHeroConditionTags
        : pickCleaningHeroConditionTags;

    if (mainEl) {
      mainEl.classList.remove(
        "biz-detail-fv__main--taxi",
        "biz-detail-fv__main--repair",
        "biz-detail-fv__main--cleaning",
        "biz-detail-fv__main--store"
      );
      mainEl.classList.add("biz-detail-fv__main--service", `biz-detail-fv__main--${profile}`);
    }
    if (receptionBlock) receptionBlock.hidden = false;
    if (tagRow) {
      tagRow.hidden = true;
      if (badgesEl) badgesEl.innerHTML = "";
    }
    if (categoryEl) {
      categoryEl.hidden = true;
      categoryEl.innerHTML = "";
    }

    const headline = buildHeadline(listing);
    if (titleEl) {
      titleEl.classList.remove(
        "biz-detail-hero__catch",
        "biz-detail-hero__headline--cleaning",
        "biz-detail-hero__headline--repair",
        "biz-detail-hero__headline--fit"
      );
      titleEl.classList.add("biz-detail-hero__headline", `biz-detail-hero__headline--${profile}`);
      delete titleEl.dataset.catchLines;
      titleEl.innerHTML = headline
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>");
      requestAnimationFrame(() => {
        fitServiceHeroHeadline(titleEl);
        bindServiceHeroTitleResize(titleEl);
      });
    }

    renderReception(listing);
    if (hintEl) {
      hintEl.hidden = false;
      hintEl.textContent = receptionHint;
    }

    renderHeroCompanyTitleRow(listing);

    const areaEl = document.querySelector("[data-biz-detail-area-short]");
    if (areaEl) {
      areaEl.hidden = true;
      areaEl.textContent = "";
    }
    const heroCta = document.querySelector("[data-biz-detail-hero-cta]");
    if (heroCta) {
      heroCta.hidden = true;
      heroCta.innerHTML = "";
    }
    hideLegacyFvFavorite();

    const conditionTags = pickConditionTags(listing);
    if (conditionTagsEl) {
      conditionTagsEl.hidden = conditionTags.length === 0;
      conditionTagsEl.innerHTML = conditionTags.map(buildRepairConditionTagHtml).join("");
    }

    const desc = String(listing.description || "").trim();
    if (leadEl) {
      leadEl.hidden = !desc;
      leadEl.textContent = desc;
    }
    if (coverageEl) coverageEl.hidden = true;
  }

  function renderRepairHeroMain(listing) {
    renderServiceHeroMain(listing, "repair");
  }

  function buildRepairStrengthCards(listing) {
    const block = getCategoryExtraBlock(listing);
    const blob = getSearchBlob(listing);
    const descs = {
      speed:
        taxiSupportYes(block.same_day_support) || listing.isStartSoon || /最短|即日/i.test(blob)
          ? "最短30分〜即日の出張対応"
          : "スケジュールに合わせた迅速対応",
      visit: taxiSupportYes(block.visit_support)
        ? "現地調査・出張修理に対応"
        : "出張修理・現地対応が可能",
      corporate:
        taxiSupportYes(block.corporate_contract) || listing.isCorporateWelcome
          ? "法人・店舗の定期メンテナンス契約可"
          : "店舗・オフィスの修理依頼に対応",
      night:
        taxiSupportYes(block.night_support) || /夜間|深夜/i.test(blob)
          ? "夜間・早朝の緊急対応に対応"
          : "時間帯はお問い合わせください",
      estimate: taxiSupportYes(block.estimate_support)
        ? "見積無料・事前説明あり"
        : /見積無料/i.test(blob)
          ? "見積無料でご相談可能"
          : "作業前に料金のご説明",
      reception:
        taxiSupportYes(block.support_24h) || /24\s*時間/.test(String(listing.business_hours || ""))
          ? "24時間受付・折返し連絡"
          : listing.business_hours || "平日・土日の受付対応",
    };
    return REPAIR_STRENGTH_PRESETS.map((preset) => ({
      icon: preset.icon,
      title: preset.title,
      desc: descs[preset.descKey] || preset.title,
    }));
  }

  function renderRepairCoverageSection(listing) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    if (!section || !host) return;

    if (taxiWrap) taxiWrap.hidden = true;
    if (lead) {
      lead.hidden = false;
      lead.textContent =
        "水道・電気・エアコンなど、日常のトラブルから設備メンテナンスまで幅広く対応します。";
    }

    host.hidden = false;
    host.classList.remove("biz-detail-coverage-tags");
    host.classList.add("biz-detail-repair-coverage");

    const dbGroups = Array.isArray(listing.repair_services) ? listing.repair_services : [];
    let groups;
    if (dbGroups.length) {
      groups = dbGroups.map((group) => ({
        title: group.title || group.name || "対応内容",
        icon: group.icon || "🔧",
        items: Array.isArray(group.items) ? group.items : [],
      }));
    } else {
      const block = getCategoryExtraBlock(listing);
      const customTypes = splitListText(block.repair_types || "");
      groups = REPAIR_COVERAGE_GROUPS.map((group) => {
        const items = [...group.items];
        customTypes.forEach((t) => {
          if (t && !items.some((i) => i.includes(t) || t.includes(i))) items.push(t);
        });
        return { ...group, items: items.slice(0, 8) };
      });
    }

    host.innerHTML = groups
      .map(
        (group) => `<div class="biz-detail-repair-coverage__group">
          <h3 class="biz-detail-repair-coverage__title"><span aria-hidden="true">${group.icon}</span> ${escapeHtml(group.title)}</h3>
          <ul class="biz-detail-repair-coverage__list">${group.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>
        </div>`
      )
      .join("");

    setPanelVisibility(section, true);
  }

  /* ── 清掃・片付け詳細（修理UI派生・清潔感・安心感） ── */

  const CLEANING_STRENGTH_PRESETS = [
    { icon: "📅", title: "即日相談可能", descKey: "sameDay" },
    { icon: "📋", title: "見積無料", descKey: "estimate" },
    { icon: "👩", title: "女性スタッフ相談可", descKey: "female" },
    { icon: "🏢", title: "法人清掃OK", descKey: "corporate" },
    { icon: "🔄", title: "定期契約OK", descKey: "regular" },
    { icon: "🛡", title: "損害保険加入", descKey: "insurance" },
  ];

  const CLEANING_TRUST_TAG_DEFS = [
    { label: "ハウスクリーニング", icon: "🏠", match: (b, l) => /ハウス|クリーニング|清掃/i.test(getSearchBlob(l)) || splitListText(b.cleaning_types).length > 0 },
    { label: "不用品回収", icon: "📦", match: (b, l) => /不用品|回収/i.test(getSearchBlob(l)) },
    { label: "ゴミ片付け", icon: "🗑", match: (b, l) => /ゴミ|片付/i.test(getSearchBlob(l)) },
    { label: "定期清掃", icon: "🔄", match: (b) => taxiSupportYes(b.regular_contract) || taxiSupportYes(b.regular_support) },
    { label: "法人対応", icon: "🏢", match: (b, l) => taxiSupportYes(b.corporate_contract) || l.isCorporateWelcome },
    { label: "見積無料", icon: "📋", match: (b, l) => taxiSupportYes(b.estimate_support) || /見積無料/i.test(getSearchBlob(l)) },
  ];

  const CLEANING_COVERAGE_GROUPS = [
    {
      title: "ハウスクリーニング",
      icon: "✨",
      items: ["キッチン", "浴室", "トイレ", "洗面所", "窓・サッシ"],
    },
    {
      title: "片付け・回収",
      icon: "📦",
      items: ["不用品回収", "ゴミ片付け", "遺品整理", "引越し前後", "倉庫整理"],
    },
    {
      title: "法人・店舗清掃",
      icon: "🏢",
      items: ["オフィス清掃", "店舗清掃", "空室清掃", "定期清掃", "床清掃"],
    },
  ];

  const CLEANING_DEMO_REVIEW_SUMMARY = {
    average: 4.7,
    totalCount: 89,
    breakdown: [
      { star: 5, pct: 82, count: 0 },
      { star: 4, pct: 12, count: 0 },
      { star: 3, pct: 4, count: 0 },
      { star: 2, pct: 1, count: 0 },
      { star: 1, pct: 1, count: 0 },
    ],
  };

  const CLEANING_DEMO_REVIEWS = [
    {
      rating: 5,
      tags: ["ハウスクリーニング"],
      text: "水回りの清掃が丁寧で、仕上がりに満足しています。説明もわかりやすかったです。",
      date: "2026-04-22",
    },
    {
      rating: 5,
      tags: ["不用品回収"],
      text: "不用品回収をお願いしました。分別の説明があり安心して任せられました。",
      date: "2026-04-08",
    },
    {
      rating: 4,
      tags: ["法人清掃"],
      text: "オフィスの定期清掃を依頼。スタッフの対応が丁寧で、継続利用しています。",
      date: "2026-03-15",
    },
    {
      rating: 5,
      tags: ["見積無料"],
      text: "見積相談だけでも快く対応いただき、作業日の調整もスムーズでした。",
      date: "2026-02-28",
    },
  ];

  function buildCleaningHeroHeadline(listing) {
    const block = getCategoryExtraBlock(listing);
    const types = splitListText(block.cleaning_types || "");
    const line1 =
      types.length >= 2
        ? `${types.slice(0, 2).join("・")}サービス`
        : types[0]
          ? `${types[0]}サービス`
          : "ハウスクリーニング・片付けサービス";
    const line2 = "法人清掃・不用品回収対応";
    return [line1, line2].join("\n");
  }

  function resolveCleaningReceptionStatus(listing) {
    const mod = listing.recruitStatusMod || "is-open";
    let state = "open";
    let label = "即日相談可能";

    if (mod === "is-busy") {
      state = "busy";
      label = "対応中（折返しご連絡）";
    } else if (mod === "is-paused" || mod === "is-closed") {
      state = "paused";
      label = "受付一時停止";
    } else if (taxiSupportYes(getCategoryExtraBlock(listing).spot_support) || listing.isStartSoon) {
      label = "即日相談可能";
    }

    return { state, label };
  }

  function renderCleaningReceptionStatus(listing) {
    const wrap = document.querySelector("[data-biz-detail-reception-wrap]");
    const el = document.querySelector("[data-biz-detail-reception]");
    const textEl = document.querySelector("[data-biz-detail-reception-text]");
    if (!wrap || !el) return;

    const { state, label } = resolveCleaningReceptionStatus(listing);
    el.className = `biz-detail-reception biz-detail-reception--${state}`;
    if (textEl) textEl.textContent = label;
    wrap.hidden = false;
  }

  function pickCleaningHeroTrustTags(listing) {
    const block = getCategoryExtraBlock(listing);
    const picked = [];
    const seen = new Set();
    CLEANING_TRUST_TAG_DEFS.forEach((def) => {
      if (picked.length >= 6) return;
      if (!def.match(block, listing)) return;
      if (seen.has(def.label)) return;
      seen.add(def.label);
      picked.push(def);
    });
    return picked;
  }

  function pickCleaningHeroConditionTags(listing) {
    const fromTrust = pickCleaningHeroTrustTags(listing).map((def) => def.label);
    if (fromTrust.length >= 3) return fromTrust.slice(0, 6);

    const seen = new Set(fromTrust);
    const serviceTags = Array.isArray(listing.service_tags) ? listing.service_tags : [];
    serviceTags.forEach((label) => {
      const text = String(label || "").trim();
      if (text && !seen.has(text) && fromTrust.length < 6) {
        fromTrust.push(text);
        seen.add(text);
      }
    });
    const defaults = [
      "ハウスクリーニング",
      "不用品回収",
      "ゴミ片付け",
      "定期清掃",
      "法人対応",
      "見積無料",
    ];
    defaults.forEach((label) => {
      if (fromTrust.length < 6 && !seen.has(label)) {
        fromTrust.push(label);
        seen.add(label);
      }
    });
    return fromTrust.slice(0, 6);
  }

  function renderCleaningHeroMain(listing) {
    renderServiceHeroMain(listing, "cleaning");
  }

  /* ── 業者サービス専用詳細（内部ID: field_service） ── */

  const FIELD_SERVICE_MENU_TITLE = "サービスメニュー";
  const FIELD_SERVICE_MENU_LEAD =
    "提供サービス内容・対応範囲・目安料金をご確認ください。";

  const FIELD_SERVICE_STRENGTH_PRESETS = [
    { icon: "⚡", title: "即日対応", descKey: "sameDay" },
    { icon: "🚐", title: "出張対応", descKey: "visit" },
    { icon: "📋", title: "見積無料", descKey: "estimate" },
    { icon: "🏢", title: "法人対応", descKey: "corporate" },
    { icon: "🛡", title: "資格保有", descKey: "license" },
    { icon: "📞", title: "電話相談", descKey: "phone" },
  ];

  const FIELD_SERVICE_COVERAGE_GROUPS = [
    {
      title: "営業代行",
      icon: "📞",
      items: ["テレアポ", "DM送信", "フォーム営業", "架電代行"],
    },
    {
      title: "営業支援",
      icon: "🤝",
      items: ["インサイドセールス", "資料送付", "リード管理", "CRM入力"],
    },
    {
      title: "その他",
      icon: "📋",
      items: ["営業資料作成", "トーク改善", "リスト作成"],
    },
  ];

  const FIELD_SERVICE_LP_TAGS = [
    {
      label: "法人対応",
      match: (b, l) => taxiSupportYes(b.corporate_contract) || l.isCorporateWelcome,
    },
    {
      label: "BtoB対応",
      match: (b, l) => /btob|b2b|法人|企業/i.test(getSearchBlob(l)),
    },
    {
      label: "全国対応",
      match: (b, l) => /全国/i.test(`${b.visit_area || ""}${l.service_area || ""}`),
    },
    {
      label: "リモート対応",
      match: (b, l) => /リモート|オンライン|zoom|web/i.test(getSearchBlob(l)),
    },
    {
      label: "即日相談",
      match: (b, l) => taxiSupportYes(b.same_day_support) || l.isStartSoon,
    },
    {
      label: "業務委託OK",
      match: (b, l) => /業務委託|準委任|派遣/i.test(getSearchBlob(l)),
    },
  ];

  const FIELD_SERVICE_TRUST_TAG_DEFS = [
    { label: "即日対応", icon: "⚡", match: (b, l) => taxiSupportYes(b.same_day_support) || l.isStartSoon },
    { label: "出張対応", icon: "🚐", match: (b) => taxiSupportYes(b.visit_support) || /出張/i.test(b.work_content || "") },
    { label: "見積無料", icon: "📋", match: (b, l) => taxiSupportYes(b.estimate_support) || /見積無料/i.test(getSearchBlob(l)) },
    { label: "法人対応", icon: "🏢", match: (b, l) => taxiSupportYes(b.corporate_contract) || l.isCorporateWelcome },
    { label: "電話相談", icon: "📞", match: (b, l) => fieldServiceCtaEnabled(b.show_phone, true) && Boolean(String(l.phone || "").trim()) },
    { label: "資格保有", icon: "🛡", match: (b, l) => Boolean(String(l.license_info || l.licenseLine || "").trim()) },
  ];

  const FIELD_SERVICE_DEMO_REVIEW_SUMMARY = {
    average: 4.8,
    totalCount: 42,
    breakdown: [
      { star: 5, pct: 84, count: 0 },
      { star: 4, pct: 10, count: 0 },
      { star: 3, pct: 4, count: 0 },
      { star: 2, pct: 1, count: 0 },
      { star: 1, pct: 1, count: 0 },
    ],
  };

  const FIELD_SERVICE_DEMO_REVIEWS = [
    {
      rating: 5,
      tags: ["水回り修理"],
      text: "当日の出張対応で水漏れを直してもらいました。説明が丁寧で安心できました。",
      date: "2026-04-18",
    },
    {
      rating: 5,
      tags: ["見積無料"],
      text: "見積もりが無料で、作業前に料金の内訳を説明してくれました。また依頼したいです。",
      date: "2026-04-02",
    },
    {
      rating: 4,
      tags: ["エアコン"],
      text: "エアコンの点検・清掃をお願いしました。作業時間も事前に共有があり助かりました。",
      date: "2026-03-20",
    },
    {
      rating: 5,
      tags: ["法人対応"],
      text: "店舗の定期メンテを依頼。法人向けの請求対応もスムーズでした。",
      date: "2026-03-05",
    },
  ];

  function getFieldServiceBlock(listing) {
    if (window.TasuBusinessServiceData?.getBusinessService) {
      const bs = window.TasuBusinessServiceData.getBusinessService(listing);
      const doc = (bs.documents || [])[0] || {};
      return {
        ...getCategoryExtraBlock(listing),
        catch_copy: bs.hero?.catch_copy,
        service_description: bs.hero?.service_description,
        service_hours: bs.hero?.business_hours,
        visit_area: bs.hero?.service_area_summary,
        contact_method: bs.hero?.contact_method,
        hero_badges: bs.badges,
        overview_text: bs.overview?.text,
        overview_features: bs.overview?.features,
        license_items: bs.certifications,
        license_cert_image_url: bs.certification_image_url,
        flow_steps: bs.flow_steps,
        representative: bs.company_info?.representative,
        postal_code: bs.company_info?.postal_code,
        address: bs.company_info?.address,
        established_year: bs.company_info?.established_year,
        business_content: bs.company_info?.business_content,
        website_url: bs.company_info?.website_url,
        invoice_number: bs.company_info?.invoice_number,
        sns_url: bs.company_info?.sns_url,
        primary_service_area: bs.area_info?.primary,
        secondary_service_area: bs.area_info?.secondary,
        online_support: bs.area_info?.online_support,
        visit_support: bs.area_info?.visit_support,
        map_url: bs.area_info?.map_url,
        materials_name: doc.name,
        materials_url: doc.url,
        show_estimate: bs.cta?.show_estimate,
        show_inquiry: bs.cta?.show_inquiry,
        show_phone: bs.cta?.show_phone,
        estimate_enabled: bs.cta?.estimate_enabled,
        inquiry_enabled: bs.cta?.inquiry_enabled,
        phone_enabled: bs.cta?.phone_enabled,
        ai_enabled: bs.cta?.ai_enabled,
        estimate_text: bs.cta?.estimate_text,
        inquiry_text: bs.cta?.inquiry_text,
        _business_service: bs,
      };
    }
    const block = getCategoryExtraBlock(listing);
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing.category_extra || fd.category_extra || {};
    const fs =
      extra.field_service && typeof extra.field_service === "object"
        ? extra.field_service
        : {};
    return { ...block, ...fs };
  }

  function fieldServiceCtaEnabled(value, defaultYes) {
    if (value == null || value === "") return defaultYes;
    const raw = String(value).trim().toLowerCase();
    if (raw === "no" || raw === "false" || raw === "0" || raw === "非表示") return false;
    return raw === "yes" || raw === "true" || raw === "1" || raw === "表示";
  }

  function buildFieldServiceHeroHeadline(listing) {
    const title = String(listing.title || "").trim();
    const category = String(listing.categoryLabel || "").trim();
    if (title) return title;
    if (category) return /サービス|代行|支援/.test(category) ? category : `${category}サービス`;
    return "出張・業務サービス";
  }

  function renderFieldServiceCompanyRow(listing) {
    const companyEl = document.querySelector("[data-biz-detail-company]");
    const badgesHost = document.querySelector("[data-biz-detail-title-badges]");
    const row = document.querySelector(".biz-detail-hero__company-row");
    const companyName = String(listing.company_name || "").trim();
    const block = getFieldServiceBlock(listing);
    const showCorpBadge =
      listing.isCorporateWelcome || taxiSupportYes(block.corporate_contract);

    if (row) {
      row.classList.add("biz-detail-hero__title-row", "field-service-hero__company-row");
    }
    if (companyEl) {
      companyEl.textContent = companyName;
      companyEl.classList.add("field-service-hero__company");
      companyEl.hidden = !companyName;
    }

    const badges = [];
    const seen = new Set();
    if (showCorpBadge) {
      seen.add("法人");
      badges.push('<span class="biz-detail-hero__corp-badge">法人</span>');
    }
    const isBusinessServiceDetail =
      document.body.classList.contains("biz-detail-page--business-service");
    if (listing.isPr && !seen.has("PR掲載") && !isBusinessServiceDetail) {
      badges.push('<span class="biz-detail-hero__pr biz-detail-hero__pr--inline">PR掲載</span>');
    }
    if (badgesHost) {
      badgesHost.innerHTML = badges.join("");
      badgesHost.hidden = badges.length === 0;
      if (isBusinessServiceDetail) {
        badgesHost.setAttribute("aria-hidden", badges.length ? "false" : "true");
      }
    }
  }

  function pickFieldServiceLpTags(listing) {
    const block = getFieldServiceBlock(listing);
    const picked = [];
    const seen = new Set();
    FIELD_SERVICE_LP_TAGS.forEach((def) => {
      if (picked.length >= 8 || seen.has(def.label)) return;
      if (!def.match(block, listing)) return;
      seen.add(def.label);
      picked.push(def.label);
    });
    (listing.service_tags || []).forEach((raw) => {
      const label = String(raw || "").trim();
      if (!label || seen.has(label) || picked.length >= 8 || label.length > 24) return;
      seen.add(label);
      picked.push(label);
    });
    if (picked.length < 4) {
      FIELD_SERVICE_LP_TAGS.forEach((def) => {
        if (picked.length >= 8 || seen.has(def.label)) return;
        seen.add(def.label);
        picked.push(def.label);
      });
    }
    return picked.slice(0, 8);
  }

  function buildFieldServiceInfoCardHtml(row) {
    return `<div class="field-service-info-card">
      <span class="field-service-info-card__icon" aria-hidden="true">${row.icon}</span>
      <div class="field-service-info-card__text">
        <span class="field-service-info-card__label">${escapeHtml(row.label)}</span>
        <span class="field-service-info-card__value">${escapeHtml(row.value)}</span>
      </div>
    </div>`;
  }

  function resolveFieldServiceReceptionStatus(listing) {
    const block = getFieldServiceBlock(listing);
    const mod = listing.recruitStatusMod || "is-open";
    if (mod === "is-busy") {
      return { state: "busy", label: "対応中（折返しご連絡）" };
    }
    if (mod === "is-paused" || mod === "is-closed") {
      return { state: "paused", label: "受付一時停止" };
    }
    if (taxiSupportYes(block.same_day_support) || listing.isStartSoon) {
      return { state: "open", label: "即日対応可能" };
    }
    if (taxiSupportYes(block.estimate_support)) {
      return { state: "open", label: "見積無料・ご相談受付中" };
    }
    return { state: "open", label: "出張対応・ご相談受付中" };
  }

  function renderFieldServiceReceptionStatus(listing) {
    const wrap = document.querySelector("[data-biz-detail-reception-wrap]");
    const el = document.querySelector("[data-biz-detail-reception]");
    const textEl = document.querySelector("[data-biz-detail-reception-text]");
    if (!wrap || !el) return;
    const { state, label } = resolveFieldServiceReceptionStatus(listing);
    el.className = `biz-detail-reception biz-detail-reception--${state}`;
    if (textEl) textEl.textContent = label;
    wrap.hidden = false;
  }

  const FIELD_SERVICE_HERO_BADGE_PRIORITY = ["即日対応", "出張対応", "見積無料"];

  function buildFieldServiceConditionTagHtml(label) {
    const def = FIELD_SERVICE_TRUST_TAG_DEFS.find((d) => d.label === label);
    const isPriority = FIELD_SERVICE_HERO_BADGE_PRIORITY.includes(label);
    const icon = def?.icon
      ? `<span class="field-service-hero-badge__icon" aria-hidden="true">${def.icon}</span>`
      : "";
    const priorityClass = isPriority ? " field-service-hero-badge--priority" : "";
    return `<span class="biz-detail-hero__condition-tag field-service-hero-badge${priorityClass}">${icon}<span class="field-service-hero-badge__label">${escapeHtml(label)}</span></span>`;
  }

  function formatFieldServiceWorkSummary(listing) {
    const block = getFieldServiceBlock(listing);
    const parts = [
      ...splitListText(block.work_content || ""),
      ...splitListText(block.service_types || ""),
    ].filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.slice(0, 4).join(" / ");
  }

  function pickFieldServiceHeroConditionTags(listing) {
    const block = getFieldServiceBlock(listing);
    const picked = [];
    const seen = new Set();

    const pushDef = (def) => {
      if (picked.length >= 6 || seen.has(def.label)) return;
      if (!def.match(block, listing)) return;
      seen.add(def.label);
      picked.push(def.label);
    };

    FIELD_SERVICE_TRUST_TAG_DEFS.filter((d) =>
      FIELD_SERVICE_HERO_BADGE_PRIORITY.includes(d.label)
    ).forEach(pushDef);
    FIELD_SERVICE_TRUST_TAG_DEFS.filter(
      (d) => !FIELD_SERVICE_HERO_BADGE_PRIORITY.includes(d.label)
    ).forEach(pushDef);
    splitListText(block.work_content || "").forEach((label) => {
      if (picked.length >= 6 || !label || seen.has(label)) return;
      seen.add(label);
      picked.push(label);
    });
    return picked.slice(0, 6);
  }

  function pickFieldServiceHeroGenreTags(listing) {
    return pickFieldServiceLpTags(listing);
  }

  async function renderFieldServiceHeroRating(listing) {
    const ratingRow = document.querySelector("[data-biz-detail-hero-rating-row]");
    if (!ratingRow) return;
    const bundle = await loadCompanyReviewBundle(listing, getFieldServiceDemoReviewBundle);
    const average = bundle.demoOnly
      ? FIELD_SERVICE_DEMO_REVIEW_SUMMARY.average
      : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
    const totalCount = bundle.demoOnly
      ? FIELD_SERVICE_DEMO_REVIEW_SUMMARY.totalCount
      : Number(bundle.reviewCount) || bundle.reviews.length;
    if (!totalCount && !average) {
      ratingRow.hidden = true;
      return;
    }
    ratingRow.hidden = false;
    ratingRow.classList.add("field-service-hero-rating");
    const starsEl = document.querySelector("[data-biz-detail-hero-rating-stars]");
    const scoreEl = document.querySelector("[data-biz-detail-hero-rating-score]");
    const countEl = document.querySelector("[data-biz-detail-hero-rating-count]");
    if (starsEl) {
      starsEl.className = "biz-detail-hero__rating-stars detail-gold-stars";
      starsEl.textContent = formatReviewStarGlyphs(average);
    }
    if (scoreEl) scoreEl.textContent = Number(average).toFixed(1);
    if (countEl) {
      countEl.innerHTML = `（<a href="#section-reviews" class="biz-detail-hero__rating-link">${totalCount}件の口コミ</a>）`;
    }
  }

  function renderFieldServiceHeroMain(listing) {
    const receptionBlock = document.querySelector("[data-biz-detail-hero-reception-block]");
    const tagRow = document.querySelector("[data-biz-detail-hero-tag-row]");
    const genreEl = document.querySelector("[data-biz-detail-hero-genre-tags]");
    const categoryEl = document.querySelector("[data-biz-detail-category]");
    const conditionTagsEl = document.querySelector("[data-biz-detail-hero-condition-tags]");
    const titleEl = document.querySelector("[data-biz-detail-title]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
    const coverageEl = document.querySelector("[data-biz-detail-coverage]");
    const hintEl = document.querySelector("[data-biz-detail-reception-hint]");
    const mainEl = document.querySelector(".biz-detail-fv__main");
    const block = getFieldServiceBlock(listing);

    if (mainEl) {
      mainEl.classList.remove(
        "biz-detail-fv__main--taxi",
        "biz-detail-fv__main--repair",
        "biz-detail-fv__main--cleaning",
        "biz-detail-fv__main--store",
        "biz-detail-fv__main--store-shop"
      );
      mainEl.classList.add(
        "biz-detail-fv__main--service",
        "biz-detail-fv__main--field-service",
        "field-service-info"
      );
    }

    if (receptionBlock) receptionBlock.hidden = false;
    if (tagRow) {
      tagRow.hidden = true;
      const badgesEl = document.querySelector("[data-biz-detail-hero-badges]");
      if (badgesEl) badgesEl.innerHTML = "";
    }
    if (categoryEl) {
      categoryEl.hidden = true;
      categoryEl.innerHTML = "";
    }

    const headline = buildFieldServiceHeroHeadline(listing);
    const companyName = String(listing.company_name || "").trim();
    if (titleEl) {
      titleEl.classList.remove(
        "biz-detail-hero__catch",
        "biz-detail-hero__headline--cleaning",
        "biz-detail-hero__headline--repair",
        "biz-detail-hero__headline--store-shop",
        "biz-detail-hero__headline--fit"
      );
      titleEl.classList.add(
        "biz-detail-hero__headline",
        "biz-detail-hero__headline--field-service"
      );
      delete titleEl.dataset.catchLines;
      titleEl.textContent = headline;
    }

    if (receptionBlock) receptionBlock.hidden = true;
    if (hintEl) hintEl.hidden = true;

    renderFieldServiceCompanyRow(listing);
    const companyEl = document.querySelector("[data-biz-detail-company]");
    if (companyEl && companyName && companyName === headline) {
      companyEl.hidden = true;
    }

    const genreTags = pickFieldServiceHeroGenreTags(listing);
    if (genreEl) {
      genreEl.hidden = genreTags.length === 0;
      genreEl.classList.add("field-service-hero-tags", "field-service-lp-tags");
      genreEl.innerHTML = genreTags
        .map((g) => `<span class="biz-detail-hero__genre-tag field-service-hero-tag field-service-lp-tag">${escapeHtml(g)}</span>`)
        .join("");
    }

    const conditionTags = pickFieldServiceHeroConditionTags(listing).filter((label) =>
      FIELD_SERVICE_HERO_BADGE_PRIORITY.includes(label)
    );
    if (conditionTagsEl) {
      conditionTagsEl.hidden = conditionTags.length === 0;
      conditionTagsEl.classList.add("field-service-hero-badges", "field-service-hero-badges--priority");
      conditionTagsEl.innerHTML = conditionTags.map(buildFieldServiceConditionTagHtml).join("");
    }

    const catchCopy = String(block.catch_copy || listing.catch_copy || "").trim();
    const desc =
      catchCopy ||
      String(block.service_description || "").trim() ||
      String(listing.description || "").trim();
    if (leadEl) {
      leadEl.hidden = !desc;
      leadEl.textContent = desc;
      leadEl.classList.add("field-service-hero-desc");
    }
    renderFieldServiceHeroFeatureRow(listing);
    if (coverageEl) coverageEl.hidden = true;

    const areaEl = document.querySelector("[data-biz-detail-area-short]");
    if (areaEl) {
      areaEl.hidden = true;
      areaEl.textContent = "";
    }
    const heroCta = document.querySelector("[data-biz-detail-hero-cta]");
    if (heroCta) {
      heroCta.hidden = true;
      heroCta.innerHTML = "";
    }
    hideLegacyFvFavorite();
    void renderFieldServiceHeroRating(listing);
  }

  function buildFieldServiceStrengthCards(listing) {
    const block = getFieldServiceBlock(listing);
    const blob = getSearchBlob(listing);
    const licenseRaw = String(listing.license_info || listing.licenseLine || "").trim();
    const descs = {
      sameDay:
        taxiSupportYes(block.same_day_support) || listing.isStartSoon || /即日/i.test(blob)
          ? "当日の出張・作業に対応"
          : "スケジュールに合わせてご相談可能",
      visit:
        taxiSupportYes(block.visit_support) || /出張/i.test(blob)
          ? "ご指定の現場へ出張対応"
          : "現地調査・出張作業に対応",
      estimate: taxiSupportYes(block.estimate_support)
        ? "見積無料・事前説明あり"
        : /見積無料/i.test(blob)
          ? "見積無料でご相談可能"
          : "作業前に料金のご説明",
      corporate:
        taxiSupportYes(block.corporate_contract) || listing.isCorporateWelcome
          ? "法人・店舗の継続契約・定期作業に対応"
          : "法人・店舗のご依頼に対応",
      license:
        licenseRaw && !/^(なし|無|—|-)$/i.test(licenseRaw)
          ? truncateText(licenseRaw, 42)
          : "許可・資格を明示した安心体制",
      phone: String(listing.phone || "").trim()
        ? "お電話でのご相談に対応"
        : "チャット・フォームでご相談可能",
    };
    return FIELD_SERVICE_STRENGTH_PRESETS.map((preset) => ({
      icon: preset.icon,
      title: preset.title,
      desc: descs[preset.descKey] || preset.title,
    }));
  }

  function mergeFieldServiceCoverageGroups(listing) {
    const block = getFieldServiceBlock(listing);
    const custom = [
      ...splitListText(block.work_content || ""),
      ...splitListText(block.service_types || ""),
    ];
    const groups = FIELD_SERVICE_COVERAGE_GROUPS.map((g) => ({
      ...g,
      items: [...g.items],
    }));
    custom.forEach((raw) => {
      const item = String(raw || "").trim();
      if (!item) return;
      const exists = groups.some((g) =>
        g.items.some((i) => i === item || i.includes(item) || item.includes(i))
      );
      if (exists) return;
      const target =
        groups.find((g) => /営業代行|テレアポ|架電|dm/i.test(g.title) && /テレアポ|架電|dm|フォーム/i.test(item)) ||
        groups.find((g) => /営業支援|支援/i.test(g.title) && /インサイド|資料|リード|crm/i.test(item)) ||
        groups.find((g) => /その他/i.test(g.title)) ||
        groups[0];
      if (target) target.items.push(item);
    });
    return groups
      .map((g) => ({ ...g, items: g.items.slice(0, 8) }))
      .filter((g) => g.items.length > 0);
  }

  function renderFieldServiceCoverageSection(listing) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    if (!section || !host) return;

    if (taxiWrap) taxiWrap.hidden = true;
    section.classList.add("field-service-coverage-panel");
    if (lead) {
      lead.hidden = false;
      lead.textContent =
        "水回り・電気・エアコンなど、日常のトラブルから設備メンテナンスまで幅広く対応します。";
    }

    host.hidden = false;
    host.classList.remove("biz-detail-coverage-tags", "biz-detail-service-grid");
    host.classList.add("biz-detail-repair-coverage", "field-service-coverage");

    const groups = mergeFieldServiceCoverageGroups(listing);
    const maxItems = Math.max(0, ...groups.map((g) => g.items.length));
    host.innerHTML = groups
      .map((group, index) => {
        const isPrimary = index === 0 || group.items.length >= maxItems;
        const groupClass = isPrimary
          ? " biz-detail-repair-coverage__group--primary field-service-coverage__group--primary"
          : "";
        return `<div class="biz-detail-repair-coverage__group field-service-coverage__group${groupClass}">
          <h3 class="biz-detail-repair-coverage__title"><span aria-hidden="true">${group.icon}</span> ${escapeHtml(group.title)}</h3>
          <ul class="biz-detail-repair-coverage__list field-service-coverage__list">${group.items
            .map((item) => `<li class="field-service-coverage__tag">${escapeHtml(item)}</li>`)
            .join("")}</ul>
        </div>`;
      })
      .join("");

    setPanelVisibility(section, groups.length > 0);
  }

  function getFieldServiceDemoReviewBundle() {
    return {
      reviews: FIELD_SERVICE_DEMO_REVIEWS.slice(0, 4),
      ratingAvg: FIELD_SERVICE_DEMO_REVIEW_SUMMARY.average,
      reviewCount: FIELD_SERVICE_DEMO_REVIEW_SUMMARY.totalCount,
      breakdown: FIELD_SERVICE_DEMO_REVIEW_SUMMARY.breakdown,
      demoOnly: true,
    };
  }

  async function renderFieldServiceReviewsSection(listing) {
    const section = document.getElementById("section-reviews");
    await renderCompanyReviewsSection(listing, getFieldServiceDemoReviewBundle);
    if (section) {
      section.classList.add("field-service-reviews", "biz-detail-panel--field-reviews");
      setPanelVisibility(section, true);
    }
  }

  function buildFieldServiceSidebarCtasHtml(listing, ctas) {
    const block = getFieldServiceBlock(listing);
    const phone = String(listing.phone || "").trim();
    const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
    const goldBtn =
      "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold field-service-cta-btn field-service-cta-btn--gold";
    const outlineBtn =
      "biz-detail-btn biz-detail-btn--outline biz-detail-btn--taxi-outline field-service-cta-btn field-service-cta-btn--outline";
    const parts = [];

    if (fieldServiceCtaEnabled(block.show_ai_consult, true)) {
      parts.push(
        `<a href="${escapeAttr(getStoreAiConsultAnchor(listing))}" class="${goldBtn} biz-detail-btn--field-ai" data-biz-detail-ai-consult><span class="biz-detail-btn__icon" aria-hidden="true">✨</span><span>AIに相談する</span></a>`
      );
    }
    if (fieldServiceCtaEnabled(block.show_estimate, true)) {
      parts.push(
        `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="${goldBtn} biz-detail-btn--field-estimate" data-biz-detail-estimate><span class="biz-detail-btn__icon" aria-hidden="true">📋</span><span>見積もりを依頼する</span></a>`
      );
    }
    if (fieldServiceCtaEnabled(block.show_inquiry, true)) {
      parts.push(
        `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="${goldBtn} biz-detail-btn--inquiry-main biz-detail-btn--field-inquiry" data-biz-detail-inquiry><span class="biz-detail-btn__icon" aria-hidden="true">✉</span><span>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</span></a>`
      );
    }
    if (fieldServiceCtaEnabled(block.show_phone, true) && telHref) {
      parts.push(
        `<a href="${escapeAttr(telHref)}" class="${outlineBtn} biz-detail-btn--field-phone"><span class="biz-detail-btn__icon" aria-hidden="true">📞</span><span>電話で相談する</span></a>`
      );
    }
    parts.push(
      `<button type="button" class="${outlineBtn} biz-detail-btn--taxi-favorite biz-detail-btn--field-favorite" data-biz-detail-favorite aria-label="お気に入りに追加"><span class="biz-detail-btn__icon" aria-hidden="true">♡</span><span>お気に入りに追加</span></button>`
    );
    return parts.join("");
  }

  async function renderFieldServiceSidebar(listing, ctas) {
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const priceRouteEl = document.querySelector("[data-biz-detail-sidebar-price-route]");
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    const priceBlock = priceEl?.closest(".biz-detail-side-price");
    const ratingWrap = document.querySelector("[data-biz-detail-sidebar-rating]");
    const actionsHost = document.querySelector("[data-biz-detail-sidebar-actions]");
    const metaBlock = document.querySelector("[data-biz-detail-sidebar-meta-block]");
    const trustHead = document.querySelector("[data-biz-detail-fv-trust-head]");
    const block = getFieldServiceBlock(listing);

    if (trustHead) trustHead.hidden = true;
    if (priceRouteEl) priceRouteEl.hidden = true;
    if (priceBlock) priceBlock.hidden = false;

    const bundle = await loadCompanyReviewBundle(listing, getFieldServiceDemoReviewBundle);
    if (ratingWrap && bundle.reviewCount > 0) {
      ratingWrap.hidden = false;
      const ratingStars = document.querySelector("[data-biz-detail-sidebar-rating-stars]");
      const ratingScore = document.querySelector("[data-biz-detail-sidebar-rating-score]");
      const ratingCount = document.querySelector("[data-biz-detail-sidebar-rating-count]");
      const average = bundle.demoOnly
        ? FIELD_SERVICE_DEMO_REVIEW_SUMMARY.average
        : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
      const totalCount = bundle.demoOnly
        ? FIELD_SERVICE_DEMO_REVIEW_SUMMARY.totalCount
        : Number(bundle.reviewCount) || bundle.reviews.length;
      if (ratingStars) {
        ratingStars.textContent = formatReviewStarGlyphs(average);
        ratingStars.classList.add("detail-gold-stars");
        ratingStars.classList.remove("detail-navy-stars");
      }
      if (ratingScore) ratingScore.textContent = average.toFixed(1);
      if (ratingCount) ratingCount.textContent = `口コミ${totalCount}件`;
    } else if (ratingWrap) {
      ratingWrap.hidden = true;
    }

    if (priceLabelEl) priceLabelEl.textContent = "料金目安";
    if (priceEl) {
      const guide =
        String(block.price_guide || "").trim() ||
        listing.main_price_text ||
        formatDisplayText(listing.budgetLabel, "budget") ||
        "";
      const firstMenu = parseServiceMenuItems(listing)[0];
      priceEl.textContent = guide || firstMenu?.price || "見積無料〜 / 作業料はメニュー参照";
    }

    const fvCard = document.querySelector(".biz-detail-fv-card");
    if (fvCard) {
      fvCard.classList.add("field-service-cta", "biz-detail-fv-card--field-service");
    }

    if (actionsHost) {
      actionsHost.className =
        "biz-detail-sidebar__cta-group biz-detail-sidebar__cta-group--field-service field-service-cta__actions";
      actionsHost.dataset.businessCategory = ctas.categoryKey || "field_service";
      actionsHost.dataset.ctaScope = "detail";
      actionsHost.innerHTML = buildFieldServiceSidebarCtasHtml(listing, ctas);
    }

    hideLegacyFvFavorite();
    if (metaBlock) metaBlock.hidden = true;
  }

  function renderFieldServiceAreaSection(listing) {
    const section = document.getElementById("section-map");
    const titleEl = section?.querySelector(".biz-detail-panel__title");
    if (titleEl) titleEl.textContent = "対応エリア";
    if (section) section.classList.add("field-service-area");
    renderMap(listing);
    const block = getFieldServiceBlock(listing);
    const wrap = document.querySelector("[data-biz-detail-map-wrap]");
    const areaText = String(block.visit_area || listing.service_area || "").trim();
    if (wrap && areaText) {
      const note = wrap.querySelector(".field-service-area__text");
      if (!note) {
        wrap.insertAdjacentHTML(
          "afterbegin",
          `<div class="field-service-area__text"><p class="field-service-area__label">出張対応エリア</p><p class="field-service-area__value">${escapeHtml(areaText)}</p></div>`
        );
      }
    }
  }

  function buildFieldServiceFaqItems(listing) {
    const fromDb = Array.isArray(listing.faq_items) ? listing.faq_items : [];
    if (fromDb.length) {
      return fromDb
        .map((item) => ({
          q: item.q || item.question || "",
          a: item.a || item.answer || "",
        }))
        .filter((item) => item.q && item.a);
    }
    const block = getFieldServiceBlock(listing);
    const items = [];
    items.push({
      q: "即日の出張・作業は可能ですか？",
      a:
        taxiSupportYes(block.same_day_support) || listing.isStartSoon
          ? "即日対応できる場合があります。まずはお問い合わせください。"
          : "スケジュールによります。お急ぎの場合はお電話・チャットでご相談ください。",
    });
    items.push({
      q: "見積もりは無料ですか？",
      a:
        formatExtraValue(block.estimate_support, "estimate", "estimate_support") ||
        "作業内容によります。無料見積の可否はメニュー・お問い合わせでご確認ください。",
    });
    const travel = String(block.travel_fee || "").trim();
    if (travel) {
      items.push({ q: "出張費はかかりますか？", a: travel });
    }
    const corporate = formatExtraValue(block.corporate_contract, "support", "corporate_contract");
    if (corporate) {
      items.push({ q: "法人・店舗の依頼は可能ですか？", a: corporate });
    }
    items.push({
      q: "対応エリア外でも相談できますか？",
      a: "エリア外は別途ご相談ください。近隣エリアは調整できる場合があります。",
    });
    return items.slice(0, 8);
  }

  function buildFieldServiceServiceMenuCardHtml(item, index, listing) {
    const featured = index === 0 ? " field-service-menu-card--popular" : "";
    const priceText = item.price ? escapeHtml(item.price) : "要見積";
    const block = getFieldServiceBlock(listing);
    const areaFallback = String(block.visit_area || listing.service_area || "全国（ご相談）").trim();
    const metaRows = [
      item.duration ? { label: "対応時間", value: item.duration } : null,
      item.description
        ? { label: "対応内容", value: item.description }
        : null,
      item.location
        ? { label: "対応エリア", value: item.location }
        : { label: "対応エリア", value: areaFallback },
    ].filter(Boolean);
    const metaHtml = metaRows.length
      ? `<dl class="field-service-menu-card__meta">${metaRows
          .map(
            (row) =>
              `<div class="field-service-menu-card__meta-row"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`
          )
          .join("")}</dl>`
      : "";
    const inquiryHref = escapeAttr(getDetailInquiryAnchor(listing));
    const estimateHref = escapeAttr(getDetailSecondaryCtaAnchor(listing));
    const ctaHtml = `<div class="field-service-menu-card__cta">
      <a href="${inquiryHref}" class="field-service-menu-card__cta-btn field-service-menu-card__cta-btn--primary">相談する</a>
      <a href="${estimateHref}" class="field-service-menu-card__cta-btn field-service-menu-card__cta-btn--outline">見積依頼</a>
    </div>`;
    return `<article class="biz-detail-price-card biz-detail-service-menu-card field-service-menu-card${featured}" data-service-menu-card>
      <div class="field-service-menu-card__inner">
        <div class="field-service-menu-card__body">
          <h3 class="biz-detail-service-menu-card__title field-service-menu-card__title">${escapeHtml(item.title)}</h3>
          <p class="field-service-menu-card__price"><span class="field-service-menu-card__price-label">料金目安</span><span class="field-service-menu-card__price-value">${priceText}</span></p>
          ${metaHtml}
          ${ctaHtml}
        </div>
      </div>
    </article>`;
  }

  function buildFieldServiceCaseCardHtml(c, listing, index) {
    const beforeUrl = String(c.before_image || "").trim();
    const afterUrl = String(c.after_image || "").trim();
    const singleUrl = String(c.image_url || "").trim();
    const mediaHtml =
      beforeUrl || afterUrl
        ? `<div class="field-service-case-card__media field-service-case-card__media--compare">
            <figure class="field-service-case-card__shot field-service-case-card__shot--before">
              ${beforeUrl ? `<img src="${escapeAttr(beforeUrl)}" alt="作業前" loading="lazy" decoding="async">` : `<span class="field-service-case-card__placeholder">作業前</span>`}
              <figcaption>Before</figcaption>
            </figure>
            <figure class="field-service-case-card__shot field-service-case-card__shot--after">
              ${afterUrl ? `<img src="${escapeAttr(afterUrl)}" alt="作業後" loading="lazy" decoding="async">` : `<span class="field-service-case-card__placeholder">作業後</span>`}
              <figcaption>After</figcaption>
            </figure>
          </div>`
        : singleUrl
          ? `<div class="field-service-case-card__media"><img src="${escapeAttr(singleUrl)}" alt="" loading="lazy" decoding="async"></div>`
          : `<div class="field-service-case-card__media field-service-case-card__media--empty" aria-hidden="true"></div>`;

    const outcomeHtml = c.outcome
      ? `<p class="field-service-case-card__outcome"><span>成果</span>${escapeHtml(c.outcome)}</p>`
      : "";
    const periodHtml = c.period
      ? `<p class="field-service-case-card__period"><span>工期</span>${escapeHtml(c.period)}</p>`
      : "";
    const costHtml = c.cost
      ? `<p class="field-service-case-card__cost"><span>費用</span>${escapeHtml(c.cost)}</p>`
      : "";
    const regionHtml = c.region
      ? `<p class="field-service-case-card__region"><span>地域</span>${escapeHtml(c.region)}</p>`
      : "";
    const summary = c.content
      ? `<p class="field-service-case-card__summary">${escapeHtml(c.content)}</p>`
      : "";
    return `<article class="biz-detail-case biz-detail-case--work-grid field-service-case-card field-service-case-card--lp">${mediaHtml}<div class="field-service-case-card__body"><h3 class="field-service-case-card__title">${escapeHtml(c.title)}</h3>${summary}${outcomeHtml}${periodHtml}${costHtml}${regionHtml}</div></article>`;
  }

  function buildFieldServiceBottomInfoRows(listing) {
    const block = getFieldServiceBlock(listing);
    return [
      { label: "会社名", value: listing.company_name },
      { label: "電話番号", value: listing.phone },
      { label: "営業時間", value: block.service_hours || listing.business_hours },
      {
        label: "HP",
        value: listing.hp_url,
        html: listing.hp_url
          ? `<a href="${escapeAttr(listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(listing.hp_url)}</a>`
          : "",
      },
      { label: "対応エリア", value: block.visit_area || listing.service_area },
      { label: "お問い合わせ", value: listing.contactMethodDisplayLabel },
    ].filter((row) => row.value && String(row.value).trim() !== "—");
  }

  function ensureFieldServiceBottomAreaColumn(section) {
    const grid = section.querySelector(".biz-detail-shop-bottom-grid");
    if (!grid || grid.querySelector("[data-biz-detail-field-service-area-col]")) return;
    if (isDetailBusinessServicePage() && grid.querySelector("[data-biz-detail-field-service-area]")) {
      return;
    }
    const col = document.createElement("div");
    col.className =
      "biz-detail-shop-bottom-col biz-detail-shop-bottom-col--area field-service-bottom-col--area";
    col.dataset.bizDetailFieldServiceAreaCol = "";
    col.innerHTML =
      '<h2 class="biz-detail-shop-bottom__title">対応エリア</h2><div class="field-service-bottom-area" data-biz-detail-field-service-area></div>';
    const newsCol = grid.querySelector(".biz-detail-shop-bottom-col--news");
    if (newsCol) grid.insertBefore(col, newsCol);
    else grid.appendChild(col);
  }

  function renderFieldServiceBottom(listing) {
    const section = document.getElementById("section-shop-bottom");
    const infoDl = document.querySelector("[data-biz-detail-shop-info-list]");
    const mapWrap = document.querySelector("[data-biz-detail-shop-map-wrap]");
    const areaHost = document.querySelector("[data-biz-detail-field-service-area]");
    if (!section) return;

    section.classList.add("field-service-bottom", "biz-detail-panel--field-bottom");
    if (isDetailBusinessServicePage()) {
      section.classList.add("fs-bottom-block");
    }
    section.hidden = false;
    section.removeAttribute("hidden");

    const infoTitle = section.querySelector(".biz-detail-shop-bottom-col--info .biz-detail-shop-bottom__title");
    if (infoTitle) {
      infoTitle.textContent = isDetailBusinessServicePage() ? "会社・事業者情報" : "会社情報";
    }
    const mapTitle = section.querySelector(".biz-detail-shop-bottom-col--map .biz-detail-shop-bottom__title");
    if (mapTitle) mapTitle.textContent = isDetailBusinessServicePage() ? "地図" : "アクセス・地図";
    const newsTitle = section.querySelector(".biz-detail-shop-bottom-col--news .biz-detail-shop-bottom__title");
    if (newsTitle) newsTitle.textContent = "お知らせ";

    ensureFieldServiceBottomAreaColumn(section);
    if (infoDl) infoDl.innerHTML = buildDlRows(buildFieldServiceBottomInfoRows(listing));
    renderStoreShopMapEmbed(listing, mapWrap);

    const block = getFieldServiceBlock(listing);
    const areaText = String(block.visit_area || listing.service_area || "").trim();
    if (areaHost) {
      areaHost.innerHTML = areaText
        ? `<p class="field-service-bottom-area__value">${escapeHtml(areaText)}</p><p class="field-service-bottom-area__note">エリア外もご相談ください</p>`
        : `<p class="field-service-bottom-area__note">対応エリアはお問い合わせください</p>`;
    }

    if (!isDetailBusinessServicePage()) {
      renderStoreShopNews(listing);
    }
    setPanelVisibility(section, true);
  }

  /* ── TASFUL内店舗（専門ショップUI） ── */

  const STORE_SHOP_STRENGTH_PRESETS = [
    { iconKey: "buyback", title: "地域No.1買取", descKey: "buyback" },
    { iconKey: "stock", title: "豊富な品揃え", descKey: "stock" },
    { iconKey: "staff", title: "専門スタッフ在籍", descKey: "staff" },
    { iconKey: "visit", title: "出張買取OK", descKey: "visit" },
    { iconKey: "corporate", title: "法人対応歓迎", descKey: "corporate" },
  ];

  const STORE_SHOP_STRENGTH_ICONS = {
    buyback: "🏆",
    stock: "📦",
    staff: "👨‍🔧",
    visit: "🚐",
    corporate: "🏢",
  };

  const STORE_SHOP_SERVICE_CARDS = [
    { title: "新品・中古販売", icon: "🛒", desc: "工具・機材・備品の販売" },
    { title: "買取・査定", icon: "💴", desc: "無料査定・その場買取" },
    { title: "出張買取", icon: "🚐", desc: "店舗・倉庫へ訪問買取" },
    { title: "修理・メンテ", icon: "🔧", desc: "点検・修理・メンテナンス" },
    { title: "法人向けサービス", icon: "🏢", desc: "継続取引・大量買取" },
  ];

  const STORE_TRUST_TAG_DEFS = [
    { label: "買取OK", icon: "💴", match: (b, l) => /買取|査定/i.test(getSearchBlob(l)) },
    { label: "中古販売", icon: "♻", match: (b, l) => /中古|新品/i.test(getSearchBlob(l)) },
    { label: "出張対応", icon: "🚐", match: (b) => taxiSupportYes(b.visit_support) },
    { label: "駐車場あり", icon: "🅿", match: (b) => taxiSupportYes(b.parking) || /駐車/i.test(b.access || "") },
    { label: "法人対応", icon: "🏢", match: (b) => taxiSupportYes(b.corporate_contract) },
    {
      label: "査定無料",
      icon: "📋",
      match: (b) =>
        shopStoreFreeAssessmentYes(b) || taxiSupportYes(b.estimate_support),
    },
  ];

  const STORE_DEMO_REVIEW_SUMMARY = {
    average: 4.8,
    totalCount: 35,
    breakdown: [
      { star: 5, pct: 78, count: 0 },
      { star: 4, pct: 14, count: 0 },
      { star: 3, pct: 5, count: 0 },
      { star: 2, pct: 2, count: 0 },
      { star: 1, pct: 1, count: 0 },
    ],
  };

  const STORE_DEMO_REVIEWS = [
    {
      rating: 5,
      tags: ["買取"],
      text: "工具の買取査定が早く、説明も丁寧でした。TASFUL内でやり取りできて安心です。",
      date: "2026-04-15",
    },
    {
      rating: 5,
      tags: ["中古購入"],
      text: "中古のインパクトドライバーを購入。状態の説明が明確で、チャットで質問もできました。",
      date: "2026-03-28",
    },
    {
      rating: 4,
      tags: ["出張買取"],
      text: "倉庫の出張買取をお願いしました。見積の内訳がわかりやすく、また利用したいです。",
      date: "2026-03-10",
    },
  ];

  function getStoreShopBlock(listing) {
    return getCategoryExtraBlock(listing);
  }

  function pickStoreProducts(listing) {
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = getStoreShopBlock(listing);
    let raw = listing?.products || fd.products || extra.products || [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        title: item.title || item.name || "",
        price: item.price || item.amount || "",
        tax_type: item.tax_type || "inclusive",
        condition: item.condition || item.state || "",
        condition_state: item.condition_state || "",
        tag: item.tag || item.label || "",
        category: item.category || item.product_category || "",
        stock:
          item.stock ||
          item.stock_label ||
          [item.stock_status, item.stock_quantity].filter(Boolean).join(" · ") ||
          "",
        stock_status: item.stock_status || "",
        stock_quantity: item.stock_quantity || "",
        fast_ship: item.fast_ship || item.fast_shipping || item.shipping || "",
        image_url: item.product_image_url || item.image_url || item.image || "",
        product_image_url: item.product_image_url || item.image_url || "",
        description: item.description || item.desc || "",
        show_ai_consult: item.show_ai_consult ?? "yes",
        show_inquiry: item.show_inquiry ?? "yes",
      }))
      .filter((item) => item.title && (item.image_url || item.product_image_url));
  }

  function pickStoreNews(listing) {
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = getStoreShopBlock(listing);
    let raw = listing?.shop_news || fd.shop_news || extra.news || extra.shop_news || [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        date: item.date || item.published_at || "",
        title: item.title || item.headline || "",
        body: item.body || item.text || "",
      }))
      .filter((item) => item.title);
  }

  function shopStrengthIconHtml(iconKey) {
    const glyph = STORE_SHOP_STRENGTH_ICONS[iconKey] || "★";
    return `<span class="biz-detail-strength__icon-disc" aria-hidden="true"><span class="biz-detail-strength__icon-glyph">${glyph}</span></span>`;
  }

  function ensureShopDetailHeaderElement() {
    let header = document.querySelector("[data-biz-detail-market-header]");
    if (header) return header;

    header = document.createElement("header");
    header.className = "shop-market-header shop-detail-header";
    header.setAttribute("data-biz-detail-market-header", "");
    header.setAttribute("aria-label", "ショップ検索ヘッダー");
    header.innerHTML = `<div class="shop-market-header__inner shop-detail-header-inner">
      <a href="index.html" class="shop-market-header__logo shop-detail-header__logo" aria-label="TASFULトップ">
        <span class="shop-market-header__logo-mark" aria-hidden="true"></span>
        <span class="shop-market-header__logo-text">TASFUL</span>
      </a>
      <div class="shop-market-header__center shop-detail-header__center">
        <form class="shop-market-header__search shop-detail-header__search" role="search" action="business.html" method="get">
          <span class="shop-market-header__search-icon" aria-hidden="true">🔍</span>
          <input type="search" name="q" class="shop-market-header__search-input" placeholder="ショップ・サービスを検索" aria-label="ショップ・サービスを検索">
        </form>
        <nav class="shop-market-header__nav shop-detail-header__nav" aria-label="メインメニュー">
          <a href="business.html" class="shop-market-header__nav-link">カテゴリから探す</a>
          <a href="business.html" class="shop-market-header__nav-link">エリアから探す</a>
          <a href="index.html" class="shop-market-header__nav-link">特集一覧</a>
          <a href="ai-workspace.html" class="shop-market-header__nav-link shop-market-header__nav-link--ai">AI相談</a>
        </nav>
      </div>
      <div class="shop-market-header__actions shop-detail-header__actions">
        <a href="index.html" class="shop-market-header__action" aria-label="お気に入り"><span class="shop-market-header__action-icon" aria-hidden="true">♡</span><span class="shop-market-header__action-label">お気に入り</span></a>
        <a href="index.html" class="shop-market-header__action" aria-label="通知"><span class="shop-market-header__action-icon" aria-hidden="true">🔔</span><span class="shop-market-header__action-label">通知</span></a>
        <a href="index.html" class="shop-market-header__action shop-market-header__action--primary" aria-label="マイページ"><span class="shop-market-header__action-icon" aria-hidden="true">👤</span><span class="shop-market-header__action-label">マイページ</span></a>
      </div>
    </div>`;

    const banner = document.querySelector("[data-biz-detail-simple-banner]");
    if (banner?.parentNode) {
      banner.parentNode.insertBefore(header, banner.nextSibling);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
    return header;
  }

  function ensureStoreShopBodyClass(listingOrCat) {
    if (!isShopStoreBiz(listingOrCat)) return;
    document.body.classList.add("biz-detail-page--store-shop", "shop-detail-page");
  }

  function renderStoreShopMarketChrome(listing) {
    const category = listing?.business_category ?? "";
    console.log("[shop-header] listing category:", category);
    console.log("[shop-header] render start", { isShopDetail: isShopDetail(listing) });

    ensureStoreShopBodyClass(listing);

    const simpleBanner = document.querySelector("[data-biz-detail-simple-banner]");
    const marketHeader = ensureShopDetailHeaderElement();
    const marketFooter = document.querySelector("[data-biz-detail-market-footer]");

    if (simpleBanner) {
      simpleBanner.hidden = true;
      simpleBanner.style.display = "none";
    }
    if (marketHeader) {
      marketHeader.hidden = false;
      marketHeader.removeAttribute("hidden");
      marketHeader.removeAttribute("aria-hidden");
      marketHeader.classList.add("is-visible");
      marketHeader.style.removeProperty("display");
      marketHeader.style.removeProperty("height");
      marketHeader.style.removeProperty("overflow");
    }
    if (marketFooter) {
      marketFooter.hidden = false;
      marketFooter.removeAttribute("hidden");
    }
    const aiBand = document.querySelector("[data-shop-store-ai-band]");
    if (aiBand && isDetailShopStorePage()) {
      aiBand.hidden = false;
      aiBand.removeAttribute("hidden");
    }

    document.title = document.querySelector("[data-biz-detail-title]")?.textContent
      ? `${document.querySelector("[data-biz-detail-title]").textContent} | TASFUL`
      : "TASFUL内店舗 | TasuFull";

    console.log("[shop-header] header in DOM:", Boolean(marketHeader));
  }

  function configureFieldServicePage(listing) {
    document.body.classList.add(
      "biz-detail-page--field-service",
      "biz-detail-page--service-style"
    );
    document.body.classList.remove("shop-detail-page", "biz-detail-page--store-shop");

    const marketHeader = document.querySelector("[data-biz-detail-market-header]");
    const marketFooter = document.querySelector("[data-biz-detail-market-footer]");
    const simpleBanner = document.querySelector("[data-biz-detail-simple-banner]");
    if (marketHeader) {
      marketHeader.hidden = true;
      marketHeader.classList.remove("is-visible");
    }
    if (marketFooter) marketFooter.hidden = true;
    if (simpleBanner) {
      simpleBanner.hidden = false;
      simpleBanner.style.removeProperty("display");
    }

    const sidebar = document.querySelector(".biz-detail-sidebar");
    if (sidebar) {
      sidebar.classList.remove("biz-detail-sidebar--store-shop-hidden");
      sidebar.classList.add("biz-detail-sidebar--field-service-hidden");
    }

    const layout = document.querySelector(".biz-detail-layout");
    if (layout) {
      layout.classList.remove("biz-detail-layout--store-shop-full");
      layout.classList.add("biz-detail-layout--field-service-full");
    }

    const hideIds = [
      "section-products",
      "section-shop-gallery",
      "section-properties",
      "section-price",
      "section-payment",
      "section-category-extra",
      "section-map",
      "section-company",
    ];
    hideIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) setPanelVisibility(el, false);
    });

    const strengthsTitle = document.querySelector("[data-biz-detail-strengths-title]");
    if (strengthsTitle) strengthsTitle.textContent = "このサービスの特徴";

    const coverageTitle = document.querySelector("#section-coverage .biz-detail-panel__title");
    if (coverageTitle) coverageTitle.textContent = "対応可能内容";

    const achievementsTitle = document.querySelector("#section-achievements .biz-detail-panel__title");
    if (achievementsTitle) achievementsTitle.textContent = "実績・事例";

    const casesLead = document.querySelector("[data-biz-detail-cases-lead]");
    if (casesLead) {
      casesLead.textContent =
        "作業前後の写真と作業内容・料金目安を掲載しています。お見積りは無料でご相談ください。";
    }

    const menuTitle = document.querySelector("[data-biz-detail-service-menu-title]");
    if (menuTitle) menuTitle.textContent = FIELD_SERVICE_MENU_TITLE;

    const menuLead = document.querySelector("[data-biz-detail-service-menu-lead]");
    if (menuLead) menuLead.textContent = FIELD_SERVICE_MENU_LEAD;

    const companyTitle = document.querySelector("[data-biz-detail-company-title]");
    if (companyTitle) companyTitle.textContent = "会社情報";

    const trustHead = document.querySelector("[data-biz-detail-fv-trust-head]");
    if (trustHead) trustHead.hidden = true;

    const fv = document.querySelector(".biz-detail-fv");
    if (fv) {
      fv.classList.add(
        "biz-detail-fv--field-service",
        "field-service-hero",
        "field-service-hero-grid"
      );
      fv.classList.remove("biz-detail-fv--store-shop");
    }

    const media = document.querySelector(".biz-detail-fv__media");
    if (media) media.classList.add("field-service-main-image");

    const main = document.querySelector(".biz-detail-fv__main");
    if (main) main.classList.add("field-service-info");

    const aside = document.querySelector(".biz-detail-fv__aside");
    if (aside) aside.classList.add("field-service-cta-wrap");

    const menuSection = document.getElementById("section-service-menu");
    if (menuSection) menuSection.classList.add("field-service-menu");

    const casesSection = document.getElementById("section-achievements");
    if (casesSection) casesSection.classList.add("field-service-cases");

    const strengthsSection = document.getElementById("section-strengths");
    if (strengthsSection) strengthsSection.classList.add("field-service-features");

    const companySection = document.getElementById("section-company");
    if (companySection) companySection.classList.add("field-service-company");

    document.title = `${buildFieldServiceHeroHeadline(listing)} | TasuFull`;
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  function getBusinessServiceProfile(listing) {
    if (window.TasuDetailBusinessServiceLoader?.resolveServiceProfile) {
      return window.TasuDetailBusinessServiceLoader.resolveServiceProfile(listing);
    }
    return { key: "default", categoryLabel: "業務サービス", flowSteps: [], serviceCards: [], areaTags: [] };
  }

  function applyBusinessServiceProfileUi(profile) {
    if (!profile) return;
    const overviewLead = document.querySelector("[data-bsd-overview-lead]");
    if (overviewLead && profile.overviewLead) overviewLead.textContent = profile.overviewLead;
    const casesLead = document.querySelector("[data-biz-detail-cases-lead]");
    if (casesLead && profile.casesLead) casesLead.textContent = profile.casesLead;
  }

  function renderBusinessServiceHeroCategory(listing, profile) {
    const el = document.querySelector("[data-bsd-hero-category]");
    if (!el) return;
    const label =
      String(listing.categoryLabel || listing.category_label || "").trim() ||
      profile?.categoryLabel ||
      "業務サービス";
    el.textContent = label;
    el.hidden = !label;
  }

  function renderBusinessServiceHeroQuick(listing) {
    const el = document.querySelector("[data-biz-detail-hero-quick]");
    if (!el) return;
    const block = getFieldServiceBlock(listing);
    const bs = block._business_service;
    const rows = [
      {
        icon: "📍",
        label: "対応エリア",
        value:
          bs?.hero?.service_area_summary ||
          block.visit_area ||
          listing.service_area ||
          "",
      },
      {
        icon: "🕐",
        label: "営業時間",
        value: bs?.hero?.business_hours || block.service_hours || listing.business_hours || "",
      },
      {
        icon: "📞",
        label: "電話",
        value: bs?.hero?.phone || listing.phone || "",
      },
    ].filter((r) => r.value && r.value !== "—");
    el.hidden = rows.length === 0;
    el.className = "bsd-hero__quick biz-detail-quick";
    el.innerHTML = rows
      .map(
        (r) =>
          `<li class="bsd-hero__quick-item"><span class="bsd-hero__quick-icon" aria-hidden="true">${r.icon}</span><span><span class="bsd-hero__quick-label">${escapeHtml(r.label)}</span>${escapeHtml(r.value)}</span></li>`
      )
      .join("");
  }

  function renderBusinessServiceHeroTags(listing) {
    const host = document.querySelector("[data-biz-detail-hero-condition-tags]");
    if (!host) return;
    const tags = pickFieldServiceLpTags(listing);
    host.hidden = tags.length === 0;
    host.className = "bsd-hero__tags";
    host.innerHTML = tags
      .map((t) => `<span class="bsd-hero__tag">${escapeHtml(t)}</span>`)
      .join("");
  }

  function renderFieldServiceHeroFeatureRow(listing) {
    const host = document.querySelector("[data-bsd-hero-feature-row]");
    if (!host) return;
    const block = getFieldServiceBlock(listing);
    const badges = Array.isArray(block.hero_badges)
      ? block.hero_badges.map((b) => String(b || "").trim()).filter(Boolean)
      : [];
    const items = badges.map(
      (label) =>
        `<li class="hero-feature-item"><span class="hero-feature-icon" aria-hidden="true">✓</span>${escapeHtml(label)}</li>`
    );
    host.innerHTML = items.join("");
    host.hidden = items.length === 0;
    if (items.length) host.removeAttribute("hidden");
  }

  function renderBusinessServiceOverview(listing, profile) {
    const section = document.getElementById("section-overview");
    const cardsHost = document.querySelector("[data-bsd-overview-cards]");
    const descEl =
      document.querySelector("[data-bsd-overview-description]") ||
      document.querySelector(".business-summary__description");
    const hiddenDesc = document.querySelector("[data-biz-detail-description]");
    const block = getFieldServiceBlock(listing);
    const overviewText =
      String(block.overview_text || "").trim() ||
      String(block.service_description || "").trim() ||
      String(listing.description || "").trim();
    if (hiddenDesc) hiddenDesc.textContent = overviewText;
    if (descEl) descEl.textContent = overviewText;

    const features = Array.isArray(block.overview_features)
      ? block.overview_features.map((f) => String(f || "").trim()).filter(Boolean)
      : [];
    if (cardsHost) {
      cardsHost.innerHTML = features
        .slice(0, 10)
        .map(
          (label) =>
            `<div class="business-summary__check-item"><span class="business-summary__check-mark" aria-hidden="true">✓</span><span class="business-summary__check-label">${escapeHtml(label)}</span></div>`
        )
        .join("");
    }

    const hasBody = overviewText.length > 0 || features.length > 0;
    setPanelVisibility(section, hasBody);
    if (section && hasBody) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function collectBusinessServiceCoverageItems(listing, profile) {
    const block = getFieldServiceBlock(listing);
    const fromData = [
      ...splitListText(block.work_content || ""),
      ...splitListText(block.service_types || ""),
      ...(listing.service_tags || []),
      ...parseServiceMenuItems(listing).map((m) => m.title),
    ];
    const cards = (profile?.serviceCards || []).map((c) => c.label);
    const merged = [...fromData, ...cards];
    const seen = new Set();
    const out = [];
    merged.forEach((raw) => {
      const label = String(raw || "").trim();
      if (!label || seen.has(label) || label.length > 32) return;
      seen.add(label);
      out.push(label);
    });
    return out.slice(0, 12);
  }

  function renderBusinessServiceCoverageGrid(listing, profile) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    if (!section || !host) return;
    const labels = collectBusinessServiceCoverageItems(listing, profile);
    if (document.body.classList.contains("biz-detail-page--business-service")) {
      if (lead) {
        lead.textContent = `${profile?.categoryLabel || "業務"}に関するサービス・対応範囲です。`;
      }
      setPanelVisibility(section, labels.length > 0);
      return;
    }
    const iconMap = Object.fromEntries(
      (profile?.serviceCards || []).map((c) => [c.label, c.icon])
    );
    const defaultIcons = ["📋", "🤝", "🌐", "🚐", "⚡", "🏢", "💻", "🔧"];
    if (lead) {
      lead.textContent = `${profile?.categoryLabel || "業務"}に関するサービス・対応範囲です。`;
    }
    host.innerHTML = labels
      .map((label, i) => {
        const icon = iconMap[label] || defaultIcons[i % defaultIcons.length];
        return `<div class="bsd-service-card"><span class="bsd-service-card__icon" aria-hidden="true">${icon}</span><span class="bsd-service-card__label">${escapeHtml(label)}</span></div>`;
      })
      .join("");
    setPanelVisibility(section, labels.length > 0);
  }

  function renderBusinessServicePricingTable(listing) {
    const section = document.getElementById("section-service-menu");
    const tbody = document.querySelector("[data-bsd-pricing-tbody]");
    const wrap = document.querySelector("[data-bsd-pricing-table-wrap]");
    const fallback = document.querySelector("[data-biz-detail-service-menu]");
    if (!section || !tbody) return;
    const items = parseServiceMenuItems(listing);
    const block = getFieldServiceBlock(listing);
    if (!items.length && block.price_guide) {
      items.push({
        title: "基本プラン",
        description: String(block.work_content || listing.title || "").trim(),
        price: String(block.price_guide || listing.budget || "").trim(),
      });
    }
    if (!items.length) {
      if (wrap) wrap.hidden = true;
      if (fallback) fallback.hidden = true;
      setPanelVisibility(section, false);
      return;
    }
    tbody.innerHTML = items
      .map((item) => {
        const service = item.title || "サービス";
        const detail = [item.description, item.scope, item.location].filter(Boolean).join(" / ");
        const price = item.price || item.amount || "要見積";
        return `<tr><td class="service-name">${escapeHtml(service)}</td><td class="service-menu-detail">${escapeHtml(detail || "—")}</td><td class="service-menu-price">${escapeHtml(price)}</td></tr>`;
      })
      .join("");
    const footnotes =
      section?.querySelector("[data-bsd-pricing-footnotes]") ||
      section?.querySelector(".pricing-plan__footnotes");
    const menuNotes = items.map((item) => String(item.notes || "").trim()).filter(Boolean);
    if (footnotes && menuNotes.length) {
      footnotes.innerHTML = [
        ...menuNotes.map((n) => `<p>${escapeHtml(n)}</p>`),
        `<p>※料金は税別表示です。</p>`,
      ].join("");
    }
    if (wrap) wrap.hidden = false;
    if (fallback) {
      fallback.hidden = true;
      fallback.innerHTML = "";
    }
    setPanelVisibility(section, true);
  }

  function renderBusinessServiceFlow(profile, listing) {
    const host = document.querySelector("[data-bsd-flow-steps]");
    const section = document.getElementById("section-flow");
    if (!host) return;
    const block = listing ? getFieldServiceBlock(listing) : {};
    const fromListing = Array.isArray(block.flow_steps) ? block.flow_steps : [];
    const steps = fromListing.length
      ? fromListing.map((s) => ({
          title: s.title || "",
          desc: s.desc || s.description || "",
        }))
      : isDetailBusinessServicePage()
        ? []
        : profile?.flowSteps?.length
          ? profile.flowSteps
          : getBusinessServiceProfile({}).flowSteps;
    host.innerHTML = (steps || [])
      .map(
        (step, i) =>
          `<li class="bsd-flow__step request-flow__step"><span class="bsd-flow__num">${i + 1}</span><h3 class="bsd-flow__title">${escapeHtml(step.title)}</h3><p class="bsd-flow__desc">${escapeHtml(step.desc)}</p></li>`
      )
      .join("");
    setPanelVisibility(section, steps.length > 0);
    if (section && steps.length) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function renderBusinessServiceLicenseList(listing) {
    const section = document.getElementById("section-license");
    const listHost = document.querySelector("[data-bsd-license-list]");
    const cardHost = document.querySelector("[data-biz-detail-license]");
    const certImg = document.querySelector(".license-credentials__cert-img");
    const block = getFieldServiceBlock(listing);
    const fromBlock = Array.isArray(block.license_items) ? block.license_items : [];
    const labels = fromBlock.length
      ? fromBlock.map((item) => {
          const label = String(item.label || "").trim();
          const value = String(item.value || "").trim();
          return value ? `${label}: ${value}` : label;
        })
      : [];
    if (!labels.length) {
      const rows = parseLicenseRows(listing);
      const licenseRaw = String(listing.license_info || listing.licenseLine || "").trim();
      if (licenseRaw) labels.push(licenseRaw);
      rows.forEach((r) => labels.push(r.value ? `${r.label}: ${r.value}` : r.label));
    }
    if (listHost) {
      listHost.innerHTML = labels.length
        ? labels.map((t) => `<li>${escapeHtml(t)}</li>`).join("")
        : "";
    }
    if (cardHost) cardHost.hidden = true;
    const certUrl = String(block.license_cert_image_url || "").trim();
    if (certImg && certUrl) certImg.src = certUrl;
    setPanelVisibility(section, labels.length > 0 || Boolean(certUrl));
    if (section && (labels.length || certUrl)) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function renderBusinessServiceCompanyTable(listing) {
    const tbody = document.querySelector("[data-bsd-company-table]");
    if (!tbody) return;
    const block = getFieldServiceBlock(listing);
    const c = block._business_service?.company_info || {};
    const rows = [
      { label: "会社名", value: listing.company_name || c.company_name },
      { label: "代表者名", value: c.representative || listing.representative },
      { label: "郵便番号", value: c.postal_code },
      { label: "住所", value: c.address || listing.address },
      { label: "設立年", value: c.established_year || listing.established_year || listing.established },
      { label: "事業内容", value: c.business_content },
      {
        label: "公式サイト",
        value: c.website_url || listing.hp_url,
        html: (c.website_url || listing.hp_url)
          ? `<a href="${escapeAttr(c.website_url || listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.website_url || listing.hp_url)}</a>`
          : "",
      },
      { label: "インボイス登録番号", value: c.invoice_number || listing.invoice_number },
      {
        label: "SNS",
        value: c.sns_url,
        html: c.sns_url
          ? `<a href="${escapeAttr(c.sns_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.sns_url)}</a>`
          : "",
      },
      { label: "電話", value: c.phone || listing.phone },
      { label: "営業時間", value: c.business_hours || block.service_hours || listing.business_hours },
    ].filter((r) => r.value && String(r.value).trim() && r.value !== "—");
    tbody.innerHTML = rows
      .map(
        (r) =>
          `<tr><th scope="row">${escapeHtml(r.label)}</th><td>${escapeHtml(String(r.value))}</td></tr>`
      )
      .join("");
  }

  function renderBusinessServiceAreaBlock(listing, profile) {
    const pillsHost = document.querySelector("[data-bsd-area-icons]");
    const mapWrap = document.querySelector("[data-biz-detail-shop-map-wrap]");
    const block = getFieldServiceBlock(listing);
    const primary = String(block.primary_service_area || block.visit_area || listing.service_area || "").trim();
    const secondary = String(block.secondary_service_area || "").trim();
    const panel = document.querySelector(".area-panel__text");
    if (panel) {
      panel.innerHTML = [
        primary
          ? `<p class="area-panel__label">主な対応エリア</p><p class="area-panel__line">${escapeHtml(primary)}</p>`
          : "",
        secondary
          ? `<p class="area-panel__line area-panel__line--muted">${escapeHtml(secondary)}</p>`
          : "",
      ]
        .filter(Boolean)
        .join("");
    }
    const pills = [];
    if (block.online_support === "yes" || /オンライン|リモート/i.test(primary)) {
      pills.push("オンライン対応");
    }
    if (block.visit_support === "yes" || /出張|訪問/i.test(primary)) {
      pills.push("出張対応");
    }
    if (/全国/i.test(primary)) pills.push("全国対応");
    if (pillsHost) {
      pillsHost.innerHTML = pills
        .map((t) => `<span class="area-panel__pill">${escapeHtml(t)}</span>`)
        .join("");
    }
    renderStoreShopMapEmbed(listing, mapWrap);
    const section = document.getElementById("section-service-area");
    setPanelVisibility(section, Boolean(primary || secondary || listing.google_map_url));
  }

  function buildBusinessServiceSidebarCtasHtml(listing, ctas) {
    const block = getFieldServiceBlock(listing);
    const phone = String(listing.phone || "").trim();
    const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
    const goldBtn =
      "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold";
    const outlineBtn = "biz-detail-btn biz-detail-btn--outline";
    const parts = [];
    const Category = window.TasuPlatformChatCategoryFlow;
    const cat = window.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "business_service";
    const connectEnabled = Category?.isCategoryConnectEnabled?.(listing, cat) === true;
    if (connectEnabled && fieldServiceCtaEnabled(block.show_estimate, true)) {
      parts.push(
        `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="${goldBtn}" data-biz-detail-estimate>見積もりを依頼する</a>`
      );
    }
    if (fieldServiceCtaEnabled(block.show_inquiry, true)) {
      parts.push(
        `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="${outlineBtn}" data-biz-detail-inquiry>${escapeHtml(ctas.primaryLabel || "チャットで問い合わせ")}</a>`
      );
    }
    if (fieldServiceCtaEnabled(block.show_phone, true) && telHref) {
      parts.push(
        `<a href="${escapeAttr(telHref)}" class="${outlineBtn}">電話で相談する</a>`
      );
    }
    return parts.join("");
  }

  function renderBusinessServiceCtaExtras(listing) {
    const block = getFieldServiceBlock(listing);
    const phone = String(listing.phone || "").trim();
    const phoneWrap = document.querySelector("[data-bsd-cta-phone]");
    const phoneNum = document.querySelector("[data-bsd-cta-phone-num]");
    const phoneHours = document.querySelector("[data-bsd-cta-phone-hours]");
    const materials = document.querySelector("[data-bsd-materials-link]");
    const hp = String(listing.hp_url || "").trim();
    if (phoneWrap && phone && fieldServiceCtaEnabled(block.show_phone, true)) {
      phoneWrap.hidden = false;
      if (phoneNum) phoneNum.textContent = phone;
      if (phoneHours) {
        phoneHours.textContent = block.service_hours || listing.business_hours || "平日 9:00〜18:00";
      }
    } else if (phoneWrap) {
      phoneWrap.hidden = true;
    }
    const materialsUrl = String(block.materials_url || hp || "").trim();
    const materialsName = String(block.materials_name || "").trim();
    if (materials && materialsUrl) {
      materials.href = materialsUrl;
      materials.hidden = false;
      const label = document.querySelector(".bsd-cta-materials-card__label");
      const sub = document.querySelector(".bsd-cta-materials-card__sub");
      if (label) label.textContent = materialsName || "資料をダウンロードする";
      if (sub) sub.textContent = materialsName ? "サービス資料（PDF）" : "";
    } else if (materials) {
      materials.hidden = true;
    }
  }

  function renderBusinessServiceStickyBar(listing) {
    const bar = document.querySelector("[data-biz-detail-sticky-bar]");
    const phoneLink = document.querySelector("[data-bsd-sticky-phone]");
    const phoneNum = document.querySelector("[data-bsd-sticky-phone-num]");
    const favBtn = document.querySelector("[data-bsd-sticky-favorite]");
    const phone = String(listing.phone || "").trim();
    const block = getFieldServiceBlock(listing);
    if (phoneLink && phone && fieldServiceCtaEnabled(block.show_phone, true)) {
      phoneLink.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      phoneLink.hidden = false;
      if (phoneNum) phoneNum.textContent = phone;
    } else if (phoneLink) {
      phoneLink.hidden = true;
    }
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        document.querySelector("[data-biz-detail-favorite]")?.click();
      });
    }
    if (bar) {
      bar.hidden = false;
      bar.classList.add("bsd-sticky-bar", "biz-detail-sticky-bar--field-service");
    }
  }

  const BUSINESS_AD_PLAN_LABELS = {
    none: "希望しない",
    considering: "検討中（担当から連絡可）",
    apply: "申し込み希望",
  };

  function buildBusinessAdPlanBlockHtml(title, plan, paymentUrl, bankInfo) {
    const planKey = String(plan || "none").trim();
    const label = BUSINESS_AD_PLAN_LABELS[planKey] || planKey || "—";
    let html =
      '<div class="bsd-ad-plan biz-detail-ad-plan">' +
      `<h3 class="bsd-ad-plan__title biz-detail-ad-plan__title">${escapeHtml(title)}</h3>` +
      `<p class="bsd-ad-plan__row"><span class="bsd-ad-plan__label">希望</span> ${escapeHtml(label)}</p>`;
    if (planKey === "apply") {
      if (paymentUrl) {
        html +=
          '<p class="bsd-ad-plan__row"><span class="bsd-ad-plan__label">決済URL</span> ' +
          `<a href="${escapeAttr(paymentUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paymentUrl)}</a></p>`;
      }
      if (bankInfo) {
        html +=
          '<p class="bsd-ad-plan__row bsd-ad-plan__row--bank"><span class="bsd-ad-plan__label">振込先</span> ' +
          `${escapeHtml(bankInfo).replace(/\n/g, "<br>")}</p>`;
      }
    }
    html += "</div>";
    return html;
  }

  /** 投稿者向け掲載管理（PR/上位）— 閲覧者向け詳細には出さない（my-listings / post のみ） */
  function renderBusinessAdPlansSection(listing) {
    const section = document.querySelector("[data-biz-detail-ad-section]");
    const host = document.querySelector("[data-biz-detail-ad-plans]");
    if (!section || !host) return;
    if (document.querySelector(".business-service-page")) return;

    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const prPlan = String(listing.pr_plan || fd.pr_plan || "none").trim();
    const featuredPlan = String(listing.featured_plan || fd.featured_plan || "none").trim();
    const prPaymentUrl = String(listing.pr_payment_url || fd.pr_payment_url || "").trim();
    const prBankInfo = String(listing.pr_bank_info || fd.pr_bank_info || "").trim();
    const featuredPaymentUrl = String(
      listing.featured_payment_url || fd.featured_payment_url || ""
    ).trim();
    const featuredBankInfo = String(listing.featured_bank_info || fd.featured_bank_info || "").trim();

    const blocks = [];
    if (prPlan !== "none") {
      blocks.push(buildBusinessAdPlanBlockHtml("PR掲載", prPlan, prPaymentUrl, prBankInfo));
    }
    if (featuredPlan !== "none") {
      blocks.push(
        buildBusinessAdPlanBlockHtml(
          "上位掲載",
          featuredPlan,
          featuredPaymentUrl,
          featuredBankInfo
        )
      );
    }

    if (!blocks.length) {
      host.innerHTML = "";
      setPanelVisibility(section, false);
      return;
    }

    host.innerHTML = blocks.join("");
    setPanelVisibility(section, true);
  }

  async function renderBusinessServiceLpPage(listing, images, ctas) {
    const profile = getBusinessServiceProfile(listing);
    document.body.dataset.serviceProfile = profile.key || "default";
    configureBusinessServicePage(listing);
    applyBusinessServiceProfileUi(profile);

    renderBreadcrumb(listing);
    renderFieldServiceHeroMain(listing);
    renderBusinessServiceHeroCategory(listing, profile);
    void renderFieldServiceHeroRating(listing);

    const catchEl = document.querySelector("[data-biz-detail-title]");
    if (catchEl) {
      catchEl.textContent = buildFieldServiceHeroHeadline(listing);
    }

    const heroImg = document.querySelector("[data-biz-detail-hero-img]");
    const heroFigure = document.querySelector("[data-biz-detail-hero-figure]");
    renderHeroMedia(listing, images, heroImg, heroFigure);
    await renderFieldServiceSidebar(listing, ctas);

    if (window.TasuDetailBusinessService?.renderPage) {
      await window.TasuDetailBusinessService.renderPage(listing, {
        images,
        ctas,
        profile,
        deps: {
          renderBusinessServiceCoverageGrid,
          renderCaseStudies,
          renderFieldServiceReviewsSection,
          renderStoreShopMapEmbed,
          getDetailInquiryAnchor,
          getDetailSecondaryCtaAnchor,
        },
      });
    } else {
      renderBusinessServiceHeroQuick(listing);
      renderBusinessServiceHeroTags(listing);
      renderFieldServiceHeroFeatureRow(listing);
      renderBusinessServiceOverview(listing, profile);
      renderBusinessServiceCoverageGrid(listing, profile);
      renderBusinessServicePricingTable(listing);
      renderCaseStudies(listing, images);
      renderBusinessServiceLicenseList(listing);
      renderBusinessServiceFlow(profile, listing);
      await renderFieldServiceReviewsSection(listing);
      renderBusinessServiceCompanyTable(listing);
      renderBusinessServiceAreaBlock(listing, profile);
      renderBusinessServiceCtaExtras(listing);
      renderBusinessServiceStickyBar(listing);
      window.TasuDetailBusinessService?.pruneEmptyBusinessServiceSections?.(listing);
    }

    const verified = document.querySelector("[data-bsd-verified-badge]");
    if (verified) verified.hidden = !listing.isVerified;

    document.title = `${buildFieldServiceHeroHeadline(listing)} | TASFUL`;
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  function configureBusinessServicePage(listing) {
    configureFieldServicePage(listing);
    document.body.classList.add("biz-detail-page--business-service");


    const pricingNote = document.querySelector("[data-fs-pricing-note]");
    if (pricingNote) pricingNote.hidden = false;

    const aiBand = document.querySelector(
      "section.bsd-ai-band[data-fs-ai-band], section.bsd-ai-band[data-bsd-ai-band]"
    );
    if (aiBand) {
      aiBand.hidden = true;
      aiBand.setAttribute("hidden", "");
      aiBand.setAttribute("aria-hidden", "true");
      aiBand.setAttribute("data-legacy-ai-band-hidden", "1");
    }

    const footer = document.querySelector("[data-fs-site-footer]");
    if (footer) {
      footer.hidden = false;
      footer.removeAttribute("hidden");
    }

    const disclaimer = document.querySelector("[data-biz-detail-disclaimer]");
    if (disclaimer) disclaimer.hidden = true;

    const shopBottom = document.getElementById("section-shop-bottom");
    if (shopBottom) shopBottom.hidden = true;

    document.title = `${buildFieldServiceHeroHeadline(listing)} | TASFUL`;
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  function configureStoreShopPage(listing) {
    ensureStoreShopBodyClass(listing);
    renderStoreShopMarketChrome(listing);

    const coverageTitle = document.querySelector("#section-coverage .biz-detail-panel__title");
    if (coverageTitle) coverageTitle.textContent = "対応サービス";

    const reviewsTitle = document.querySelector("#bizDetailReviewsTitle");
    if (reviewsTitle) reviewsTitle.textContent = "口コミ・評価";

    const trustHead = document.querySelector("[data-biz-detail-fv-trust-head]");
    if (trustHead) trustHead.hidden = false;

    const sidebar = document.querySelector(".biz-detail-sidebar");
    if (sidebar) sidebar.classList.add("biz-detail-sidebar--store-shop-hidden");

    const layout = document.querySelector(".biz-detail-layout");
    if (layout) layout.classList.add("biz-detail-layout--store-shop-full");

    const strengthsTitle = document.querySelector("[data-biz-detail-strengths-title]");
    if (strengthsTitle) strengthsTitle.textContent = "このお店の特徴";

    const fv = document.querySelector(".biz-detail-fv");
    if (fv) {
      fv.classList.add(
        "biz-detail-fv--store-shop",
        "biz-detail-fv__grid",
        "shop-detail-hero-card",
        "shop-hero",
        "shop-hero-grid",
        "business-hero-card"
      );
    }
    const fvMedia = document.querySelector(".biz-detail-fv__media");
    if (fvMedia) fvMedia.classList.add("shop-hero-media");
    const fvCard = document.querySelector(".biz-detail-fv-card");
    if (fvCard) {
      fvCard.classList.add(
        "shop-cta-card",
        "store-shop-cta",
        "biz-detail-fv-card--store-shop"
      );
    }
    const fvAside = document.querySelector(".biz-detail-fv__aside");
    if (fvAside) fvAside.classList.add("biz-detail-fv__aside--store-shop", "store-shop-cta");

    const workCasesEl = document.querySelector("[data-biz-detail-hero-work-cases]");
    if (workCasesEl) workCasesEl.hidden = true;

    const legacyTop = document.querySelector("[data-biz-detail-legacy-top]");
    const backLink = document.querySelector("[data-biz-detail-back]");
    if (backLink) backLink.hidden = true;
    if (legacyTop) legacyTop.classList.add("biz-detail-top--store-shop-hidden");

    const breadcrumb = document.querySelector("[data-breadcrumb]");
    if (breadcrumb) breadcrumb.classList.add("biz-detail-breadcrumb--shop");

    [
      "section-service-menu",
      "section-achievements",
      "section-conditions",
      "section-license",
      "section-category-extra",
      "section-overview",
      "section-company",
      "section-map",
      "section-payment",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) setPanelVisibility(el, false);
    });

    const reviewSection = document.querySelector("[data-biz-detail-taxi-review-section]");
    if (reviewSection) reviewSection.classList.add("shop-ec-reviews");
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  function buildStoreHeroHeadline(listing) {
    return listing.company_name || listing.title || "TASFUL内店舗";
  }

  function resolveStoreReceptionStatus(listing) {
    const mod = listing.recruitStatusMod || "is-open";
    let state = "open";
    let label = "相談受付中";

    if (mod === "is-busy") {
      state = "busy";
      label = "対応中（折返しご連絡）";
    } else if (mod === "is-paused" || mod === "is-closed") {
      state = "paused";
      label = "受付一時停止";
    } else if (taxiSupportYes(getCategoryExtraBlock(listing).visit_support)) {
      label = "相談受付中";
    }

    return { state, label };
  }

  function renderStoreReceptionStatus(listing) {
    const wrap = document.querySelector("[data-biz-detail-reception-wrap]");
    const el = document.querySelector("[data-biz-detail-reception]");
    const textEl = document.querySelector("[data-biz-detail-reception-text]");
    if (!wrap || !el) return;

    const { state, label } = resolveStoreReceptionStatus(listing);
    el.className = `biz-detail-reception biz-detail-reception--${state}`;
    if (textEl) textEl.textContent = label;
    wrap.hidden = false;
  }

  function pickStoreHeroConditionTags(listing) {
    const fromTrust = pickStoreHeroTrustTags(listing).map((def) => def.label);
    if (fromTrust.length >= 3) return fromTrust.slice(0, 6);

    const seen = new Set(fromTrust);
    const serviceTags = Array.isArray(listing.service_tags) ? listing.service_tags : [];
    serviceTags.forEach((label) => {
      const text = String(label || "").trim();
      if (text && !seen.has(text) && fromTrust.length < 6) {
        fromTrust.push(text);
        seen.add(text);
      }
    });
    const defaults = [
      "出張買取OK",
      "査定無料",
      "駐車場あり",
      "クレジットOK",
      "法人対応",
      "即日発送",
    ];
    defaults.forEach((label) => {
      if (fromTrust.length < 6 && !seen.has(label)) {
        fromTrust.push(label);
        seen.add(label);
      }
    });
    return fromTrust.slice(0, 6);
  }

  function pickStoreHeroTrustTags(listing) {
    const block = getCategoryExtraBlock(listing);
    const picked = [];
    const seen = new Set();
    STORE_TRUST_TAG_DEFS.forEach((def) => {
      if (picked.length >= 6) return;
      if (!def.match(block, listing)) return;
      if (seen.has(def.label)) return;
      seen.add(def.label);
      picked.push(def);
    });
    return picked;
  }

  function pickStoreHeroGenrePills(listing) {
    const block = getStoreShopBlock(listing);
    const fromStore = splitListText(block.store_type || block.store_service_types || "");
    const tagList = Array.isArray(listing.service_tags) ? listing.service_tags : [];
    const defaults = ["工具・機械", "買取対応", "中古販売"];
    const picked = [];
    const seen = new Set();
    [...fromStore, ...tagList, ...defaults].forEach((raw) => {
      const text = String(raw || "").trim();
      if (!text || seen.has(text) || picked.length >= 3) return;
      seen.add(text);
      picked.push(text);
    });
    if (picked.length < 3) {
      defaults.forEach((d) => {
        if (picked.length >= 3 || seen.has(d)) return;
        seen.add(d);
        picked.push(d);
      });
    }
    return picked.slice(0, 3);
  }

  function reorderStoreShopHeroDom(mainEl) {
    if (!mainEl) return;
    const nodes = [
      mainEl.querySelector("[data-biz-detail-hero-genre-tags]"),
      mainEl.querySelector("[data-biz-detail-store-title-block]") ||
        mainEl.querySelector("[data-biz-detail-title]"),
      mainEl.querySelector("[data-biz-detail-hero-rating-row]"),
      mainEl.querySelector("[data-biz-detail-hero-lead]"),
      mainEl.querySelector("[data-biz-detail-hero-quick]"),
      mainEl.querySelector("[data-biz-detail-hero-condition-tags]"),
    ].filter(Boolean);
    nodes.forEach((node) => mainEl.appendChild(node));
  }

  function renderStoreShopHeroInfo(listing) {
    const el = document.querySelector("[data-biz-detail-hero-quick]");
    if (!el) return;

    const block = getStoreShopBlock(listing);
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const address = block.address || fd.address || "";
    const hours = String(listing.business_hours || "").trim();
    const closed = String(
      block.closed_day || block.regular_holiday || fd.closed_day || ""
    ).trim();
    const hoursLine = [
      hours,
      closed ? `定休日：${closed}` : "",
    ]
      .filter(Boolean)
      .join("　");
    const parking =
      block.parking === "yes" || taxiSupportYes(block.parking)
        ? "駐車場あり"
        : String(block.parking || fd.parking || "").trim();
    const visitArea = String(block.visit_area || listing.service_area || "").trim();
    const visitLine = [
      parking && parking !== "—" ? parking : "",
      visitArea ? `出張買取対応エリア：${visitArea}` : "",
    ]
      .filter(Boolean)
      .join("　");
    const access = String(block.access || fd.access || "").trim();

    const rows = [
      { icon: "📍", text: address },
      { icon: "🕐", text: hoursLine },
      { icon: "🚐", text: visitLine },
      { icon: "🚉", text: access },
    ].filter((r) => r.text && r.text !== "—");

    el.className =
      "biz-detail-store-info shop-info-list biz-detail-info-list biz-detail-quick";
    el.hidden = rows.length === 0;
    el.innerHTML = rows
      .map(
        (r) =>
          `<li class="biz-detail-store-info__row shop-info-item biz-detail-info-item"><span class="biz-detail-store-info__icon" aria-hidden="true">${r.icon}</span><span class="biz-detail-store-info__text">${escapeHtml(r.text)}</span></li>`
      )
      .join("");
  }

  function renderStoreShopHero(listing) {
    const mainEl = document.querySelector(".biz-detail-fv__main");
    const receptionBlock = document.querySelector("[data-biz-detail-hero-reception-block]");
    const tagRow = document.querySelector("[data-biz-detail-hero-tag-row]");
    const genreEl = document.querySelector("[data-biz-detail-hero-genre-tags]");
    const titleEl = document.querySelector("[data-biz-detail-title]");
    const ratingRow = document.querySelector("[data-biz-detail-hero-rating-row]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
    const conditionTagsEl = document.querySelector("[data-biz-detail-hero-condition-tags]");
    const categoryEl = document.querySelector("[data-biz-detail-category]");
    const companyRow = document.querySelector(".biz-detail-hero__company-row");

    if (mainEl) {
      mainEl.classList.add(
        "biz-detail-fv__main--service",
        "biz-detail-fv__main--store-shop",
        "shop-hero-info"
      );
    }
    const mediaEl = document.querySelector(".biz-detail-fv__media");
    if (mediaEl) mediaEl.classList.add("biz-detail-fv__media--store-shop");
    if (receptionBlock) receptionBlock.hidden = true;
    if (tagRow) tagRow.hidden = true;
    if (categoryEl) categoryEl.hidden = true;
    const companyEl = document.querySelector("[data-biz-detail-company]");
    const badgesHost = document.querySelector("[data-biz-detail-title-badges]");
    if (companyRow) {
      companyRow.hidden = false;
      if (companyEl) {
        companyEl.hidden = true;
        companyEl.textContent = "";
      }
      renderHeroCompanyTitleRow(listing);
      if (badgesHost) {
        const showGold =
          listing.isPr || String(listing.pr_plan || listing.prPlan || "").trim() === "apply";
        if (showGold) {
          const gold =
            '<span class="biz-detail-hero__gold-member shop-meta-tag biz-detail-meta-tag">ゴールド会員</span>';
          badgesHost.innerHTML = gold + badgesHost.innerHTML;
          badgesHost.hidden = false;
        }
        badgesHost.classList.add("shop-meta-tags", "biz-detail-meta-tags");
      }
    }

    if (genreEl) {
      const pills = pickStoreHeroGenrePills(listing);
      genreEl.hidden = false;
      genreEl.classList.add("shop-category-tags", "biz-detail-category-tags");
      genreEl.innerHTML = pills
        .map((g) => `<span class="biz-detail-hero__genre-tag">${escapeHtml(g)}</span>`)
        .join("");
    }

    if (titleEl) {
      titleEl.className =
        "biz-detail-hero__title biz-detail-hero__headline biz-detail-hero__headline--store-shop shop-title biz-detail-title";
      titleEl.textContent = buildStoreHeroHeadline(listing);
    }

    if (ratingRow) {
      const avg = Number(listing.company_rating_avg ?? listing.rating) || 0;
      const count = Number(listing.company_review_count ?? listing.review_count) || 0;
      if (avg > 0 || count > 0) {
        ratingRow.hidden = false;
        ratingRow.classList.add("store-shop-hero-rating");
        const starsEl = document.querySelector("[data-biz-detail-hero-rating-stars]");
        const scoreEl = document.querySelector("[data-biz-detail-hero-rating-score]");
        const countEl = document.querySelector("[data-biz-detail-hero-rating-count]");
        if (starsEl) {
          starsEl.className = "biz-detail-hero__rating-stars detail-gold-stars gold-stars";
          starsEl.textContent = formatReviewStarGlyphs(avg || 4.5);
        }
        if (scoreEl) {
          scoreEl.className = "biz-detail-hero__rating-score rating-text";
          scoreEl.textContent = (avg || 4.5).toFixed(1);
        }
        if (countEl) {
          countEl.className = "biz-detail-hero__rating-count rating-text";
          countEl.innerHTML = `（<a href="#section-reviews" class="biz-detail-hero__rating-link">${count || 0}件の口コミ</a>）`;
        }
      } else {
        ratingRow.hidden = true;
      }
    }

    const areaEl = document.querySelector("[data-biz-detail-area-short]");
    const heroCtaEl = document.querySelector("[data-biz-detail-hero-cta]");
    if (areaEl) areaEl.hidden = true;
    if (heroCtaEl) heroCtaEl.hidden = true;

    if (leadEl) {
      leadEl.hidden = false;
      leadEl.classList.add("shop-description", "biz-detail-description");
      leadEl.textContent = truncateText(listing.description || "", 150);
    }

    if (conditionTagsEl) {
      const tags = pickStoreHeroConditionTags(listing);
      conditionTagsEl.hidden = tags.length === 0;
      conditionTagsEl.classList.add("shop-feature-tags");
      conditionTagsEl.innerHTML = tags
        .map(
          (t) =>
            `<span class="biz-detail-hero__condition-tag shop-feature-tag biz-detail-tag">${escapeHtml(t)}</span>`
        )
        .join("");
    }

    if (titleEl && companyRow && !document.querySelector("[data-biz-detail-store-title-block]")) {
      const wrap = document.createElement("div");
      wrap.className = "biz-detail-hero__store-title-block shop-title-block";
      wrap.setAttribute("data-biz-detail-store-title-block", "");
      titleEl.parentNode.insertBefore(wrap, titleEl);
      wrap.append(titleEl, companyRow);
    }

    renderStoreShopHeroInfo(listing);
    reorderStoreShopHeroDom(mainEl);
  }

  function renderStoreHeroMain(listing) {
    renderStoreShopHero(listing);
  }

  // ─────────────────────────────────────────────
  // Shop専用：固定IDへ直接描画（selectorフォールバック禁止）
  // ─────────────────────────────────────────────
  async function renderShopSections(listing) {
    const productsRoot = document.getElementById("section-products");
    const bottomRoot = document.getElementById("section-shop-bottom");
    const reviewsRoot = document.getElementById("section-reviews");
    const faqRoot = document.getElementById("section-faq");

    const ensureShow = (el) => {
      if (!el) return;
      el.hidden = false;
      el.removeAttribute("hidden");
      el.style.display = "block";
      el.style.opacity = "1";
      el.style.visibility = "visible";
    };

    // 商品一覧
    if (productsRoot) {
      const raw = pickStoreProducts(listing);
      const products = raw.filter((p) => p.image_url || p.product_image_url).slice(0, 12);
      const cards = products
        .map((p) => buildStoreProductCardHtml(p, listing))
        .filter(Boolean)
        .join("");
      productsRoot.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">掲載商品</h2></div>
        <p class="shop-sec__lead">TASFUL内でご相談・ご購入いただけます。</p>
        <div class="shop-sec__scroll">${cards || `<p class="shop-sec__lead">商品情報は準備中です。</p>`}</div>`;
      ensureShow(productsRoot);
    }

    // 店舗情報（最低限）
    if (bottomRoot) {
      const infoItems = buildStoreShopInfoRows(listing);
      const infoHtml = `<ul class="shop-store-info-list">${infoItems
        .map(
          (r) =>
            `<li class="shop-store-info-list__item"><span class="shop-store-info-list__icon" aria-hidden="true">•</span><p class="shop-store-info-list__line"><span class="shop-store-info-list__label">${escapeHtml(
              r.label
            )}</span> ${escapeHtml(String(r.value || "").trim())}</p></li>`
        )
        .join("")}</ul>`;
      bottomRoot.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">店舗情報</h2></div>${infoHtml}`;
      ensureShow(bottomRoot);
    }

    // 口コミ（最低限枠だけ確保）
    if (reviewsRoot) {
      reviewsRoot.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">口コミ・評価</h2></div><p class="shop-sec__lead">口コミは準備中です。</p>`;
      ensureShow(reviewsRoot);
    }

    // FAQ
    if (faqRoot) {
      const items = buildStoreFaqItems(listing);
      faqRoot.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">よくある質問</h2></div>
        <div class="biz-detail-faq">${items
          .map(
            (item) =>
              `<details class="biz-detail-faq__item"><summary>${escapeHtml(
                item.q
              )}</summary><div class="biz-detail-faq__answer"><p>${escapeHtml(
                item.a
              )}</p></div></details>`
          )
          .join("")}</div>`;
      ensureShow(faqRoot);
    }

    ["section-products", "section-shop-bottom", "section-reviews", "section-faq"].forEach(
      (id) => ensureShow(document.getElementById(id))
    );
  }

  function buildStoreStrengthCards(listing) {
    const block = getStoreShopBlock(listing);
    const blob = getSearchBlob(listing);
    const descs = {
      buyback: /買取|査定/i.test(blob) ? "地域で高評価の買取査定" : "買取・査定のご相談歓迎",
      stock: "新品・中古を幅広く取り扱い",
      staff: "専門知識のあるスタッフが対応",
      visit: taxiSupportYes(block.visit_support) ? "出張買取・訪問対応可" : "出張エリアはお問い合わせください",
      corporate:
        taxiSupportYes(block.corporate_contract) || listing.isCorporateWelcome
          ? "法人・店舗の継続取引に対応"
          : "法人様のご相談歓迎",
    };
    return STORE_SHOP_STRENGTH_PRESETS.map((preset) => ({
      iconKey: preset.iconKey,
      icon: STORE_SHOP_STRENGTH_ICONS[preset.iconKey] || "★",
      title: preset.title,
      desc: descs[preset.descKey] || preset.title,
    }));
  }

  function mergeStoreCustomTypes(groups, customTypes) {
    if (!customTypes.length) return groups;
    const seen = new Set();
    groups.forEach((g) => {
      g.items.forEach((item) => seen.add(normalizeCleaningCoverageKey(item)));
      seen.add(normalizeCleaningCoverageKey(g.title));
    });

    customTypes.forEach((raw) => {
      const item = String(raw || "").trim();
      if (!item) return;
      const norm = normalizeCleaningCoverageKey(item);
      if (!norm || seen.has(norm)) return;
      if (groups.some((g) => normalizeCleaningCoverageKey(g.title) === norm)) return;

      const target =
        groups.find((g) => /飲食/i.test(g.title) && /飲食|厨房|グリストラップ|床洗浄/i.test(item)) ||
        groups.find((g) => /美容|サロン/i.test(g.title) && /美容|サロン|ガラス|内装/i.test(item)) ||
        groups.find((g) => /オフィス|施設/i.test(g.title) && /オフィス|施設|什器|軽作業|空室/i.test(item)) ||
        groups[0];

      if (target) {
        target.items.push(item);
        seen.add(norm);
      }
    });
    return groups;
  }

  function pickStoreCoverageGroups(listing) {
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    let raw =
      listing?.store_services ||
      fd?.store_services ||
      listing?.repair_services ||
      fd?.repair_services ||
      [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  function pickStoreServiceCards(listing) {
    const dbGroups = pickStoreCoverageGroups(listing);
    if (dbGroups.length) {
      const cards = dbGroups.map((group) => ({
        title: group.title || group.name || "サービス",
        icon: group.icon || "🛠",
        desc: Array.isArray(group.items) ? group.items.slice(0, 2).join("・") : group.description || "",
      }));
      if (cards.some((c) => c.title)) return cards;
    }
    return STORE_SHOP_SERVICE_CARDS;
  }

  function renderStoreCoverageSection(listing) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    if (!section || !host) return;

    if (taxiWrap) taxiWrap.hidden = true;
    if (lead) {
      lead.hidden = false;
      lead.textContent = "TASFUL内で相談・見積・購入まで完結できるサービスです。";
    }

    host.hidden = false;
    host.className = "biz-detail-store-services";

    const cards = pickStoreServiceCards(listing);
    host.innerHTML = cards
      .map(
        (card) => `<article class="biz-detail-store-service-card">
          <span class="biz-detail-store-service-card__icon" aria-hidden="true">${card.icon || "🛠"}</span>
          <h3 class="biz-detail-store-service-card__title">${escapeHtml(card.title)}</h3>
          <p class="biz-detail-store-service-card__desc">${escapeHtml(card.desc || "")}</p>
        </article>`
      )
      .join("");

    setPanelVisibility(section, cards.length > 0);
  }

  function buildStoreProductCardHtml(p, listing) {
    const tag = String(p.tag || "").trim();
    const condRaw = String(p.condition_state || p.condition || "").replace(/^状態：/, "");
    const tagClass =
      /新品|new/i.test(tag) || /新品/.test(condRaw)
        ? "is-new"
        : /中古|used/i.test(tag) || condRaw
          ? "is-used"
          : "";
    const displayTag = tag || (/新品|美品|良好|可|ジャンク/.test(condRaw) ? condRaw : "");
    const imageUrl = p.product_image_url || p.image_url || "";
    const img = imageUrl
      ? `<img class="biz-detail-product-card__img" src="${escapeAttr(imageUrl)}" alt="" loading="lazy" decoding="async">`
      : "";
    if (!img) return "";

    const stockLabel = String(p.stock || "").trim() || "在庫あり";
    const stockClass = /売り切れ|なし|売切|欠品/i.test(stockLabel) ? "is-out" : "is-in";
    const fastShip = taxiSupportYes(p.fast_ship) || /即日|翌日/i.test(String(p.fast_ship || tag));
    const taxLabel = p.tax_type === "exclusive" ? "（税別）" : "（税込）";
    const showAi = String(p.show_ai_consult || "yes").trim() !== "no";
    const showInquiry = String(p.show_inquiry || "yes").trim() !== "no";
    const actions = [];
    if (showAi) {
      actions.push(
        `<a href="${escapeAttr(getStoreAiConsultAnchor(listing))}" class="biz-detail-product-card__ai">AI相談</a>`
      );
    }
    if (showInquiry) {
      actions.push(
        `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="biz-detail-product-card__buy">問い合わせ</a>`
      );
    }
    const actionsHtml =
      actions.length === 2
        ? `<div class="biz-detail-product-card__actions">${actions.join("")}</div>`
        : actions.length === 1
          ? `<div class="biz-detail-product-card__actions biz-detail-product-card__actions--single">${actions[0]}</div>`
          : "";

    const stateText = p.condition || (condRaw ? `状態：${condRaw}` : "");

    return `<article class="biz-detail-product-card biz-detail-product-card--ec" data-product-category="${escapeAttr(p.category || p.product_category || "all")}">
      <div class="biz-detail-product-card__media">
        ${img}
        ${displayTag ? `<span class="biz-detail-product-card__tag ${tagClass}">${escapeHtml(displayTag)}</span>` : ""}
        ${fastShip ? `<span class="biz-detail-product-card__ship">即日発送</span>` : ""}
        <button type="button" class="biz-detail-product-card__fav" aria-label="お気に入り">♡</button>
      </div>
      <div class="biz-detail-product-card__body">
        <h3 class="biz-detail-product-card__title">${escapeHtml(p.title)}</h3>
        <p class="biz-detail-product-card__price">${escapeHtml(p.price || "要相談")}<span class="biz-detail-product-card__tax">${escapeHtml(taxLabel)}</span></p>
        ${stateText ? `<p class="biz-detail-product-card__state">${escapeHtml(stateText)}</p>` : ""}
        <p class="biz-detail-product-card__stock biz-detail-product-card__stock--${stockClass}">${escapeHtml(stockLabel)}</p>
        ${actionsHtml}
      </div>
    </article>`;
  }

  function renderStoreProductTabs(products) {
    const tabsHost = document.querySelector("[data-biz-detail-products-tabs]");
    if (!tabsHost) return;

    const categories = ["すべて"];
    products.forEach((p) => {
      const c = String(p.category || "").trim();
      if (c && !categories.includes(c)) categories.push(c);
    });

    if (categories.length <= 2) {
      tabsHost.hidden = true;
      tabsHost.innerHTML = "";
      return;
    }

    tabsHost.hidden = false;
    tabsHost.innerHTML = categories
      .map(
        (cat, i) =>
          `<button type="button" class="biz-detail-products-tab${i === 0 ? " is-active" : ""}" data-product-tab="${escapeAttr(cat === "すべて" ? "all" : cat)}" role="tab" aria-selected="${i === 0}">${escapeHtml(cat)}</button>`
      )
      .join("");

    tabsHost.querySelectorAll("[data-product-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.productTab || "all";
        tabsHost.querySelectorAll(".biz-detail-products-tab").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });
        const host = document.querySelector("[data-biz-detail-products]");
        if (!host) return;
        host.querySelectorAll(".biz-detail-product-card--ec").forEach((card) => {
          const cat = card.dataset.productCategory || "all";
          const show = filter === "all" || cat === filter;
          card.hidden = !show;
        });
      });
    });
  }

  function renderStoreProducts(listing) {
    const section = document.getElementById("section-products");
    const host = document.querySelector("[data-biz-detail-products]");
    const moreEl = document.querySelector("[data-biz-detail-products-more]");
    if (!section || !host) return;

    const products = pickStoreProducts(listing).filter((p) => p.image_url);
    if (!products.length) {
      host.innerHTML = "";
      if (moreEl) moreEl.hidden = true;
      renderStoreProductTabs([]);
      setPanelVisibility(section, false);
      return;
    }

    host.innerHTML = products.map((p) => buildStoreProductCardHtml(p, listing)).filter(Boolean).join("");
    renderStoreProductTabs(products);

    if (moreEl) moreEl.hidden = products.length < 5;
    setPanelVisibility(section, true);
  }

  function renderStoreShopGallery(listing) {
    const section = document.getElementById("section-shop-gallery");
    const host = document.querySelector("[data-biz-detail-shop-gallery]");
    if (!section || !host) return;

    const urls = resolveStoreShopHeroImages(listing || {});
    const images = Array.isArray(urls) ? urls.filter(Boolean).slice(0, 12) : [];
    if (!images.length) {
      host.innerHTML = "";
      setPanelVisibility(section, false);
      return;
    }

    host.innerHTML = images
      .map(
        (url) =>
          `<figure class="biz-detail-shop-gallery-card"><img src="${escapeAttr(
            url
          )}" alt="" loading="lazy" decoding="async"></figure>`
      )
      .join("");
    setPanelVisibility(section, true);
  }

  function buildStoreShopInfoRows(listing) {
    const block = getStoreShopBlock(listing);
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const address = block.address || fd.address || "";
    return [
      { label: "住所", value: address },
      { label: "営業時間", value: listing.business_hours },
      {
        label: "定休日",
        value: block.closed_day || block.regular_holiday || fd.closed_day || "お問い合わせください",
      },
      { label: "電話番号", value: listing.phone },
      { label: "アクセス", value: block.access || fd.access || "" },
      {
        label: "駐車場",
        value:
          block.parking === "yes" || taxiSupportYes(block.parking)
            ? "あり"
            : block.parking || fd.parking || "お問い合わせください",
      },
      { label: "出張エリア", value: block.visit_area || listing.service_area || "" },
    ].filter((r) => r.value && String(r.value).trim() !== "—");
  }

  const STORE_SHOP_INFO_ICONS = {
    住所: "📍",
    営業時間: "🕐",
    定休日: "📅",
    電話番号: "📞",
    アクセス: "🚉",
    駐車場: "🅿️",
    出張エリア: "🚐",
  };

  function formatShopNewsDate(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    return s.replace(/\//g, ".").replace(/-/g, ".");
  }

  function buildStoreShopInfoListHtml(listing) {
    const rows = buildStoreShopInfoRows(listing);
    const items = rows
      .map((row) => {
        const icon = STORE_SHOP_INFO_ICONS[row.label] || "•";
        let valueHtml = escapeHtml(String(row.value));
        if (row.label === "電話番号" && row.value) {
          valueHtml += `<span class="shop-store-info-list__sub">（TASFUL内通話）</span>`;
        }
        return `<li class="shop-store-info-list__item">
          <span class="shop-store-info-list__icon" aria-hidden="true">${icon}</span>
          <p class="shop-store-info-list__line"><span class="shop-store-info-list__label">${escapeHtml(row.label)}：</span>${valueHtml}</p>
        </li>`;
      })
      .join("");
    return `<ul class="shop-store-info-list">${items}</ul>
      <p class="shop-store-info-note">※やりとりはすべてTASFUL内で行われます</p>`;
  }

  function buildShopStoreMapVisualHtml() {
    return `<div class="shop-store-map-visual" role="img" aria-label="地図概略">
      <span class="shop-store-map-pin" aria-hidden="true"></span>
    </div>`;
  }

  function buildBusinessServiceMapVisualHtml() {
    return `<div class="fs-map-visual" role="img" aria-label="地図概略">
      <span class="fs-map-pin" aria-hidden="true"></span>
    </div>`;
  }

  function renderStoreShopMapEmbed(listing, wrapEl) {
    if (!wrapEl) return;
    const mapUrl = String(listing.google_map_url || "").trim();
    if (!mapUrl) {
      if (isDetailBusinessServicePage()) {
        wrapEl.innerHTML = buildBusinessServiceMapVisualHtml();
        return;
      }
      if (isDetailShopStorePage()) {
        wrapEl.innerHTML = buildShopStoreMapVisualHtml();
        return;
      }
      wrapEl.innerHTML = `<p class="biz-detail-map-placeholder">地図情報は準備中です。お問い合わせください。</p>`;
      return;
    }
    let embedSrc = mapUrl;
    if (/google\.(com|co\.jp).*\/maps/i.test(mapUrl) && !mapUrl.includes("output=embed")) {
      embedSrc = mapUrl.includes("?") ? `${mapUrl}&output=embed` : `${mapUrl}?output=embed`;
    }
    const embed =
      shouldEmbedMapIframe() && /google\.(com|co\.jp).*\/maps/i.test(embedSrc)
        ? `<div class="biz-detail-map-embed"><iframe src="${escapeAttr(embedSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="店舗地図"></iframe></div>`
        : "";
    const mapNote =
      '<p class="biz-detail-map-note">地図は参考表示です。ご来店・ご相談はTASFUL内チャットからお問い合わせください。</p>';
    if (isDetailBusinessServicePage()) {
      wrapEl.innerHTML = embed || buildBusinessServiceMapVisualHtml();
      return;
    }
    if (isDetailShopStorePage()) {
      wrapEl.innerHTML = embed || buildShopStoreMapVisualHtml();
      return;
    }
    wrapEl.innerHTML = embed || `<p class="biz-detail-map-placeholder">地図情報は準備中です</p>`;
    if (embed) {
      wrapEl.innerHTML += mapNote;
    }
  }

  function renderStoreShopNews(listing) {
    const host = document.querySelector("[data-biz-detail-shop-news]");
    const moreEl = document.querySelector("[data-biz-detail-shop-news-more]");
    if (!host) return;

    let items = pickStoreNews(listing);
    if (!items.length) {
      items = isDetailShopStorePage()
        ? [
            {
              date: "2026/05/01",
              title: "工具買取強化キャンペーン実施中",
              body: "キャンペーン期間中、査定額をアップしております。",
            },
            {
              date: "2026/04/20",
              title: "電動工具 新入荷のお知らせ",
              body: "マキタ・日立など人気ブランドの新入荷が入りました。",
            },
            {
              date: "2026/04/10",
              title: "ゴールデンウィークの営業について",
              body: "GW期間中も通常営業（水曜定休）で承ります。",
            },
          ]
        : [
            { date: "2026/05/10", title: "高価買取キャンペーン実施中", body: "" },
            { date: "2026/05/03", title: "電動工具の新入荷", body: "" },
            { date: "2026/04/28", title: "ゴールデンウィークの営業について", body: "" },
          ];
    }

    const useRichNews = isDetailShopStorePage();
    host.innerHTML = items
      .slice(0, 5)
      .map((item) => {
        const date = formatShopNewsDate(item.date);
        const desc = item.body || item.description || item.excerpt || "";
        const itemClass = useRichNews
          ? "shop-store-news-item"
          : "biz-detail-shop-news-item";
        const descHtml =
          useRichNews && desc
            ? `<p class="shop-store-news-item__desc">${escapeHtml(desc)}</p>`
            : "";
        return `<li class="${itemClass}">
          <time class="shop-store-news-item__date biz-detail-shop-news-item__date">${escapeHtml(date)}</time>
          <p class="shop-store-news-item__title biz-detail-shop-news-item__title">${escapeHtml(item.title)}</p>
          ${descHtml}
        </li>`;
      })
      .join("");
    if (moreEl) {
      moreEl.hidden = isDetailShopStorePage() ? false : items.length <= 3;
    }
  }

  function renderStoreShopBottom(listing) {
    const section = document.getElementById("section-shop-bottom");
    const infoDl = document.querySelector("[data-biz-detail-shop-info-list]");
    const mapWrap = document.querySelector("[data-biz-detail-shop-map-wrap]");
    if (!section) return;

    if (infoDl) {
      infoDl.innerHTML = isDetailShopStorePage()
        ? buildStoreShopInfoListHtml(listing)
        : buildDlRows(buildStoreShopInfoRows(listing));
    }
    renderStoreShopMapEmbed(listing, mapWrap);
    renderStoreShopNews(listing);
    setPanelVisibility(section, true);
  }

  function renderStoreShopCompanyInfo(listing) {
    renderStoreShopBottom(listing);
  }

  function buildStoreFaqItems(listing) {
    const fromDb = Array.isArray(listing.faq_items) ? listing.faq_items : [];
    if (fromDb.length) {
      return fromDb
        .map((item) => ({
          q: item.q || item.question || "",
          a: item.a || item.answer || "",
        }))
        .filter((item) => item.q && item.a);
    }

    const block = getCategoryExtraBlock(listing);
    const items = [];

    items.push({
      q: "出張での対応は可能ですか？",
      a:
        formatExtraValue(block.visit_support, "support", "visit_support") ||
        "店舗・施設への出張対応が可能です。エリアはお問い合わせください。",
    });

    items.push({
      q: "査定は無料ですか？",
      a: shopStoreFreeAssessmentYes(block)
        ? "査定無料に対応しています。店頭・出張ともにお気軽にご相談ください。"
        : formatExtraValue(
            block.shop_store_free_assessment || block.estimate_support,
            "free_assessment",
            "shop_store_free_assessment"
          ) || "査定の可否はお問い合わせください。",
    });

    const regular = formatExtraValue(block.regular_contract, "support", "regular_contract");
    if (regular) {
      items.push({ q: "定期メンテナンスの契約はできますか？", a: regular });
    }

    const night = formatExtraValue(block.night_support, "support", "night_support");
    if (night) {
      items.push({ q: "夜間・閉店後の作業は可能ですか？", a: night });
    }

    items.push({
      q: "中古品の状態はどこで確認できますか？",
      a: "掲載商品の説明とチャットで詳細をお伝えします。ご不明点はAI相談・お問い合わせからどうぞ。",
    });

    items.push({
      q: "買取のみの依頼は可能ですか？",
      a: "店頭・出張ともに買取のみのご依頼が可能です。査定は無料です。",
    });

    return items.slice(0, 8);
  }

  function getStoreDemoReviewBundle() {
    return {
      reviews: STORE_DEMO_REVIEWS.slice(0, 4),
      ratingAvg: STORE_DEMO_REVIEW_SUMMARY.average,
      reviewCount: STORE_DEMO_REVIEW_SUMMARY.totalCount,
      breakdown: STORE_DEMO_REVIEW_SUMMARY.breakdown,
      demoOnly: true,
    };
  }

  async function renderStoreReviewsSection(listing) {
    const section = document.getElementById("section-reviews");
    await renderCompanyReviewsSection(listing, getStoreDemoReviewBundle);
    if (section) {
      section.classList.add("shop-ec-reviews-panel");
      setPanelVisibility(section, true);
    }
  }

  function buildStoreShopSidebarCtasHtml(listing, ctas) {
    const phone = String(listing.phone || "").trim();
    const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : getDetailInquiryAnchor(listing);
    return [
      `<a href="${escapeAttr(getStoreAiConsultAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--store-ai cta-btn cta-ai cta-primary" data-biz-detail-ai-consult><span class="biz-detail-btn__icon" aria-hidden="true">✨</span><span>AIに相談する</span><small class="biz-detail-btn__sub cta-subtext">商品のことや在庫・修理などを質問</small></a>`,
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--store-inquiry cta-btn cta-contact" data-biz-detail-inquiry><span class="biz-detail-btn__icon" aria-hidden="true">💬</span><span>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</span><small class="biz-detail-btn__sub cta-subtext">チャットでかんたんに相談</small></a>`,
      `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--store-estimate cta-btn cta-outline cta-estimate" data-biz-detail-estimate><span class="biz-detail-btn__icon" aria-hidden="true">📋</span><span>見積もりを依頼する</span></a>`,
      `<a href="${escapeAttr(telHref)}" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--store-phone cta-btn cta-outline cta-phone" data-biz-detail-phone><span class="biz-detail-btn__icon" aria-hidden="true">📞</span><span>電話で相談する</span>${phone ? `<small class="biz-detail-btn__sub cta-subtext">${escapeHtml(phone)}</small>` : ""}</a>`,
      `<button type="button" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--store-favorite cta-btn cta-outline cta-favorite" data-biz-detail-favorite aria-label="お気に入りに追加"><span class="biz-detail-btn__icon" aria-hidden="true">♡</span><span>お気に入りに追加</span></button>`,
      `<p class="biz-detail-fv-card__platform-note">やりとりはTASFUL内で行われます</p>`,
      `<ul class="biz-detail-fv-trust-badges biz-detail-fv-trust-badges--store trust-list safe-list" aria-label="安心の取引">
        <li><span class="biz-detail-fv-trust-badges__icon" aria-hidden="true">🛡</span><span>本人確認済み</span></li>
        <li><span class="biz-detail-fv-trust-badges__icon" aria-hidden="true">🔒</span><span>プライバシー保護</span></li>
        <li><span class="biz-detail-fv-trust-badges__icon" aria-hidden="true">✓</span><span>取引サポート</span></li>
      </ul>`,
    ].join("");
  }

  function buildStoreSidebarCtasHtml(listing, ctas) {
    return buildStoreShopSidebarCtasHtml(listing, ctas);
  }

  async function renderStoreSidebar(listing, ctas) {
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const priceRouteEl = document.querySelector("[data-biz-detail-sidebar-price-route]");
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    const priceBlock = priceEl?.closest(".biz-detail-side-price");
    const ratingWrap = document.querySelector("[data-biz-detail-sidebar-rating]");
    const actionsHost = document.querySelector("[data-biz-detail-sidebar-actions]");
    const metaBlock = document.querySelector("[data-biz-detail-sidebar-meta-block]");
    const fvCard = document.querySelector(".biz-detail-fv-card");

    if (fvCard) {
      fvCard.classList.add("biz-detail-fv-card--store-shop", "store-shop-cta");
    }
    const legacyFav = fvCard?.querySelector("[data-biz-detail-favorite]:not(.biz-detail-btn--taxi-favorite)");
    if (legacyFav) legacyFav.hidden = true;
    if (priceRouteEl) priceRouteEl.hidden = true;
    if (priceBlock) priceBlock.hidden = true;
    const taxiBadges = document.querySelector("[data-biz-detail-sidebar-taxi-badges]");
    if (taxiBadges) taxiBadges.hidden = true;

    const bundle = await loadCompanyReviewBundle(listing, getStoreDemoReviewBundle);
    const average = bundle.demoOnly
      ? STORE_DEMO_REVIEW_SUMMARY.average
      : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
    const totalCount = bundle.demoOnly
      ? STORE_DEMO_REVIEW_SUMMARY.totalCount
      : Number(bundle.reviewCount) || bundle.reviews.length;

    if (ratingWrap && (bundle.reviewCount > 0 || average > 0)) {
      ratingWrap.hidden = false;
      ratingWrap.className = "biz-detail-fv-taxi-rating rating-box review-box";
      ratingWrap.innerHTML = `
        <p class="biz-detail-fv-taxi-rating__label">口コミ・評価</p>
        <div class="rating-box__row">
          <span class="gold-stars detail-gold-stars" aria-hidden="true">${formatReviewStarGlyphs(average || 4.5)}</span>
          <span class="rating-text">${(average || 4.5).toFixed(1)}（${totalCount || 0}件）</span>
        </div>`;
    } else if (ratingWrap) {
      ratingWrap.hidden = true;
    }

    if (priceLabelEl) {
      priceLabelEl.textContent = listing.main_price_label || "料金目安";
    }
    if (priceEl) {
      const firstMenu = Array.isArray(listing.service_menu_items)
        ? listing.service_menu_items[0]
        : null;
      const menuHint = firstMenu?.price ? String(firstMenu.price).trim() : "";
      priceEl.textContent =
        listing.main_price_text ||
        formatDisplayText(listing.budgetLabel, "budget") ||
        menuHint ||
        "見積要相談";
    }

    if (actionsHost) {
      actionsHost.className =
        "biz-detail-sidebar__cta-group biz-detail-sidebar__cta-group--store cta-group cta-buttons".trim();
      actionsHost.dataset.businessCategory = ctas.categoryKey || "store_field_service";
      actionsHost.dataset.ctaScope = "detail";
      actionsHost.innerHTML = buildStoreSidebarCtasHtml(listing, ctas);
    }

    hideLegacyFvFavorite();
    if (metaBlock) metaBlock.hidden = false;
  }

  function buildCleaningStrengthCards(listing) {
    const block = getCategoryExtraBlock(listing);
    const blob = getSearchBlob(listing);
    const licenseRaw = String(listing.license_info || listing.licenseLine || "").trim();
    const descs = {
      sameDay:
        taxiSupportYes(block.spot_support) || listing.isStartSoon || /即日/i.test(blob)
          ? "当日のご相談・お見積りに対応"
          : "スケジュールに合わせてご相談可能",
      estimate: taxiSupportYes(block.estimate_support)
        ? "見積無料・事前説明あり"
        : /見積無料/i.test(blob)
          ? "見積無料でご相談可能"
          : "作業前に料金のご説明",
      female: /女性|レディース/i.test(blob) ? "女性スタッフでのご相談・作業可" : "ご希望に応じてスタッフを調整",
      corporate:
        taxiSupportYes(block.corporate_contract) || listing.isCorporateWelcome
          ? "オフィス・店舗の清掃・定期契約に対応"
          : "法人・店舗のご依頼に対応",
      regular: taxiSupportYes(block.regular_contract)
        ? "週次・月次の定期清掃プランに対応"
        : "定期契約のご相談が可能",
      insurance:
        taxiSupportYes(block.insurance) || /保険|損害/i.test(licenseRaw + blob)
          ? "損害保険加入で安心の作業体制"
          : "作業内容に応じた安心体制",
    };
    return CLEANING_STRENGTH_PRESETS.map((preset) => ({
      icon: preset.icon,
      title: preset.title,
      desc: descs[preset.descKey] || preset.title,
    }));
  }

  function normalizeCleaningCoverageKey(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function dedupeCleaningCoverageGroups(groups) {
    const globalSeen = new Set();
    const groupTitleKeys = new Set(
      groups.map((g) => normalizeCleaningCoverageKey(g.title || g.name || ""))
    );

    return groups.map((group) => {
      const titleKey = normalizeCleaningCoverageKey(group.title || group.name || "");
      const items = [];
      (Array.isArray(group.items) ? group.items : []).forEach((raw) => {
        const item = String(raw || "").trim();
        if (!item) return;
        const key = normalizeCleaningCoverageKey(item);
        if (!key || key === titleKey) return;
        if (groupTitleKeys.has(key)) return;
        if (globalSeen.has(key)) return;
        globalSeen.add(key);
        items.push(item);
      });
      return { ...group, items };
    });
  }

  function mergeCleaningCustomTypes(groups, customTypes) {
    if (!customTypes.length) return groups;
    const seen = new Set();
    groups.forEach((g) => {
      g.items.forEach((item) => seen.add(normalizeCleaningCoverageKey(item)));
      seen.add(normalizeCleaningCoverageKey(g.title));
    });

    const groupMatchers = [
      { key: "house", match: /ハウス|水回|キッチン|浴室|窓|サッシ|エアコン/i },
      { key: "haul", match: /片付|回収|不用|ゴミ|遺品|引越|倉庫/i },
      { key: "corp", match: /法人|店舗|オフィス|空室|定期|床清掃/i },
    ];

    customTypes.forEach((raw) => {
      const item = String(raw || "").trim();
      if (!item) return;
      const norm = normalizeCleaningCoverageKey(item);
      if (!norm || seen.has(norm)) return;
      if (groups.some((g) => normalizeCleaningCoverageKey(g.title) === norm)) return;

      const matcher =
        groupMatchers.find((m) => m.match.test(item)) || groupMatchers[0];
      const target =
        groups.find((g) => {
          const title = String(g.title || "");
          if (matcher.key === "house") return /ハウス/i.test(title);
          if (matcher.key === "haul") return /片付|回収/i.test(title);
          if (matcher.key === "corp") return /法人|店舗/i.test(title);
          return false;
        }) || groups[0];

      if (target) {
        target.items.push(item);
        seen.add(norm);
      }
    });
    return groups;
  }

  function pickCleaningCoverageGroups(listing) {
    const fd =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    let raw =
      listing?.cleaning_services ||
      fd?.cleaning_services ||
      listing?.repair_services ||
      fd?.repair_services ||
      [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  function renderCleaningCoverageSection(listing) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    if (!section || !host) return;

    if (taxiWrap) taxiWrap.hidden = true;
    if (lead) {
      lead.hidden = false;
      lead.textContent =
        "ご家庭のハウスクリーニングから、片付け・不用品回収、法人・店舗清掃まで幅広く対応します。";
    }

    host.hidden = false;
    host.classList.remove("biz-detail-coverage-tags");
    host.classList.add("biz-detail-repair-coverage", "biz-detail-cleaning-coverage");

    const dbGroups = pickCleaningCoverageGroups(listing);
    let groups;
    if (dbGroups.length) {
      groups = dbGroups.map((group) => ({
        title: group.title || group.name || "対応内容",
        icon: group.icon || "✨",
        items: Array.isArray(group.items) ? group.items : [],
      }));
    } else {
      const block = getCategoryExtraBlock(listing);
      const customTypes = splitListText(block.cleaning_types || "");
      groups = CLEANING_COVERAGE_GROUPS.map((group) => ({
        ...group,
        items: [...group.items],
      }));
      groups = mergeCleaningCustomTypes(groups, customTypes);
    }
    groups = dedupeCleaningCoverageGroups(groups);

    host.innerHTML = groups
      .map(
        (group) => `<div class="biz-detail-repair-coverage__group biz-detail-cleaning-coverage__group">
          <h3 class="biz-detail-repair-coverage__title"><span aria-hidden="true">${group.icon}</span> ${escapeHtml(group.title)}</h3>
          <ul class="biz-detail-cleaning-coverage__list">${group.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>
        </div>`
      )
      .join("");

    setPanelVisibility(section, true);
  }

  function buildCleaningFaqItems(listing) {
    const fromDb = Array.isArray(listing.faq_items) ? listing.faq_items : [];
    if (fromDb.length) {
      return fromDb
        .map((item) => ({
          q: item.q || item.question || "",
          a: item.a || item.answer || "",
        }))
        .filter((item) => item.q && item.a);
    }

    const block = getCategoryExtraBlock(listing);
    const items = [];

    items.push({
      q: "即日の清掃・片付けは可能ですか？",
      a:
        taxiSupportYes(block.spot_support) || listing.isStartSoon
          ? "即日のご相談・作業に対応できる場合があります。まずはお問い合わせください。"
          : "スケジュールによります。お急ぎの場合はお問い合わせください。",
    });

    items.push({
      q: "見積もりは無料ですか？",
      a:
        formatExtraValue(block.estimate_support, "estimate", "estimate_support") ||
        (/見積無料/i.test(getSearchBlob(listing))
          ? "見積無料のプランがあります。詳細はお問い合わせください。"
          : "作業内容によります。お見積りのうえご案内します。"),
    });

    const regular = formatExtraValue(block.regular_contract, "support", "regular_contract");
    if (regular) {
      items.push({ q: "定期清掃の契約はできますか？", a: regular });
    }

    const corporate = formatExtraValue(block.corporate_contract, "support", "corporate_contract");
    if (corporate) {
      items.push({ q: "法人・店舗の清掃は対応できますか？", a: corporate });
    }

    items.push({
      q: "不用品回収のみでも依頼できますか？",
      a: "少量の回収から大型品まで、内容に応じてお見積りいたします。",
    });

    return items.slice(0, 8);
  }

  function getCleaningDemoReviewBundle() {
    return {
      reviews: CLEANING_DEMO_REVIEWS.slice(0, 4),
      ratingAvg: CLEANING_DEMO_REVIEW_SUMMARY.average,
      reviewCount: CLEANING_DEMO_REVIEW_SUMMARY.totalCount,
      breakdown: CLEANING_DEMO_REVIEW_SUMMARY.breakdown,
      demoOnly: true,
    };
  }

  async function renderCleaningReviewsSection(listing) {
    return renderCompanyReviewsSection(listing, getCleaningDemoReviewBundle);
  }

  function buildCleaningSidebarCtasHtml(listing, ctas) {
    return [
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--inquiry-main" data-biz-detail-inquiry><span class="biz-detail-btn__icon" aria-hidden="true">✉</span><span>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</span></a>`,
      `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--cleaning-estimate" data-biz-detail-estimate><span class="biz-detail-btn__icon" aria-hidden="true">📋</span><span>${escapeHtml(DETAIL_ESTIMATE_CONSULT_LABEL)}</span></a>`,
      `<button type="button" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--taxi-outline biz-detail-btn--taxi-favorite" data-biz-detail-favorite aria-label="お気に入りに追加"><span class="biz-detail-btn__icon" aria-hidden="true">♡</span><span>お気に入りに追加</span></button>`,
    ].join("");
  }

  async function renderCleaningSidebar(listing, ctas) {
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const priceRouteEl = document.querySelector("[data-biz-detail-sidebar-price-route]");
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    const priceBlock = priceEl?.closest(".biz-detail-side-price");
    const ratingWrap = document.querySelector("[data-biz-detail-sidebar-rating]");
    const actionsHost = document.querySelector("[data-biz-detail-sidebar-actions]");
    const metaBlock = document.querySelector("[data-biz-detail-sidebar-meta-block]");

    if (priceRouteEl) priceRouteEl.hidden = true;
    if (priceBlock) priceBlock.hidden = false;
    if (ratingWrap) ratingWrap.hidden = true;

    const bundle = await loadCompanyReviewBundle(listing, getCleaningDemoReviewBundle);
    if (ratingWrap && bundle.reviewCount > 0) {
      ratingWrap.hidden = false;
      const ratingStars = document.querySelector("[data-biz-detail-sidebar-rating-stars]");
      const ratingScore = document.querySelector("[data-biz-detail-sidebar-rating-score]");
      const ratingCount = document.querySelector("[data-biz-detail-sidebar-rating-count]");
      const average = bundle.demoOnly
        ? CLEANING_DEMO_REVIEW_SUMMARY.average
        : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
      const totalCount = bundle.demoOnly
        ? CLEANING_DEMO_REVIEW_SUMMARY.totalCount
        : Number(bundle.reviewCount) || bundle.reviews.length;
      if (ratingStars) {
        ratingStars.textContent = formatReviewStarGlyphs(average);
        ratingStars.classList.add("detail-gold-stars");
        ratingStars.classList.remove("detail-navy-stars");
      }
      if (ratingScore) ratingScore.textContent = average.toFixed(1);
      if (ratingCount) ratingCount.textContent = `（${totalCount}件）`;
    }

    if (priceLabelEl) {
      priceLabelEl.textContent = listing.main_price_label || "料金目安";
    }
    if (priceEl) {
      const firstMenu = Array.isArray(listing.service_menu_items)
        ? listing.service_menu_items[0]
        : null;
      const menuHint = firstMenu?.price ? String(firstMenu.price).trim() : "";
      priceEl.textContent =
        listing.main_price_text ||
        formatDisplayText(listing.budgetLabel, "budget") ||
        menuHint ||
        "見積無料〜 / 作業料はメニュー参照";
    }

    if (actionsHost) {
      actionsHost.className =
        "biz-detail-sidebar__cta-group biz-detail-sidebar__cta-group--cleaning".trim();
      actionsHost.dataset.businessCategory = ctas.categoryKey || "cleaning";
      actionsHost.dataset.ctaScope = "detail";
      actionsHost.innerHTML = buildCleaningSidebarCtasHtml(listing, ctas);
    }

    hideLegacyFvFavorite();
    if (metaBlock) metaBlock.hidden = false;
  }

  function parseRepairPriceCards(listing) {
    const guides = Array.isArray(listing.price_guides) ? listing.price_guides : [];
    if (guides.length) {
      return guides
        .map((g) => ({
          label: g.label || g.name || "料金",
          value: g.value || g.price || "",
          note: g.note || "",
        }))
        .filter((g) => g.value)
        .slice(0, 6);
    }

    const block = getCategoryExtraBlock(listing);
    const cards = [];
    const budget = String(listing.budgetLabel || listing.main_price_text || "").trim();
    const defaults = [
      { label: "出張費", value: "3,000円〜", note: "エリアにより異なります" },
      { label: "点検費", value: "無料〜5,000円", note: "内容により変動" },
      { label: "作業料金", value: budget || "要見積", note: "部品代別途" },
    ];

    if (budget && budget.includes("\n")) {
      budget.split(/\n+/).filter(Boolean).forEach((line) => {
        const m = line.match(/^(.+?)[:：]\s*(.+)$/);
        cards.push({
          label: m ? m[1].trim() : "料金",
          value: m ? m[2].trim() : line,
          note: "",
        });
      });
    } else if (budget) {
      defaults[2].value = budget;
      defaults.forEach((d) => cards.push(d));
    } else {
      defaults.forEach((d) => cards.push(d));
    }

    if (taxiSupportYes(block.estimate_support) || /見積無料/i.test(getSearchBlob(listing))) {
      cards.push({ label: "見積", value: "無料", note: "作業前にご説明" });
    }
    const night = formatExtraValue(block.night_support, "support", "night_support");
    if (night && !/非対応|不可/.test(night)) {
      cards.push({ label: "深夜料金", value: "割増あり", note: "時間帯により異なります" });
    }
    return cards.slice(0, 6);
  }

  function buildRepairFaqItems(listing) {
    const fromDb = Array.isArray(listing.faq_items) ? listing.faq_items : [];
    if (fromDb.length) {
      return fromDb
        .map((item) => ({
          q: item.q || item.question || "",
          a: item.a || item.answer || "",
        }))
        .filter((item) => item.q && item.a);
    }

    const block = getCategoryExtraBlock(listing);
    const items = [];

    const night = formatExtraValue(block.night_support, "support", "night_support");
    items.push({
      q: "深夜対応できますか？",
      a: night || (block.support_24h ? formatExtraValue(block.support_24h, "support") : "時間帯により対応可能です。まずはお電話ください。"),
    });

    items.push({
      q: "出張費はいくらですか？",
      a: listing.budgetLabel
        ? `目安：${listing.budgetLabel}。エリア・作業内容により異なります。`
        : "エリア・時間帯により異なります。お問い合わせ時にご案内します。",
    });

    const estimate = formatExtraValue(block.estimate_support, "estimate", "estimate_support");
    items.push({
      q: "見積だけでも可能ですか？",
      a: estimate || "見積のみのご相談も可能です（無料の場合あり）。",
    });

    const corporate = formatExtraValue(block.corporate_contract, "support", "corporate_contract");
    if (corporate) {
      items.push({ q: "法人契約できますか？", a: corporate });
    }

    const sameDay = formatExtraValue(block.same_day_support, "support", "same_day_support");
    items.push({
      q: "即日対応できますか？",
      a:
        sameDay ||
        (listing.isStartSoon
          ? "即日対応可能な案件があります。"
          : "状況によります。お急ぎの場合はお電話ください。"),
    });

    return items.slice(0, 6);
  }

  function getRepairDemoReviewBundle() {
    return {
      reviews: REPAIR_DEMO_REVIEWS.slice(0, 4),
      ratingAvg: REPAIR_DEMO_REVIEW_SUMMARY.average,
      reviewCount: REPAIR_DEMO_REVIEW_SUMMARY.totalCount,
      breakdown: REPAIR_DEMO_REVIEW_SUMMARY.breakdown,
      demoOnly: true,
      fromCompany: false,
    };
  }

  async function loadCompanyReviewBundle(listing, getDemoBundle) {
    const companyId = String(listing.company_id || "").trim();

    if (companyId && window.TasuCompanyReviews?.fetchCompanyReviewsByCompanyId) {
      const data = await window.TasuCompanyReviews.fetchCompanyReviewsByCompanyId(companyId, {
        limit: 4,
      });
      if (data.reviewCount > 0 || data.reviews.length > 0) {
        const reviews = data.reviews.map((r) => ({
          ...r,
          text: r.comment,
        }));
        return {
          reviews: reviews.slice(0, 4),
          ratingAvg: data.ratingAvg,
          reviewCount: data.reviewCount,
          breakdown: data.breakdown,
          demoOnly: false,
          fromCompany: true,
        };
      }
    }

    return typeof getDemoBundle === "function" ? getDemoBundle() : getTaxiDemoReviewBundle();
  }

  async function loadTaxiCompanyReviewBundle(listing) {
    return loadCompanyReviewBundle(listing, getTaxiDemoReviewBundle);
  }

  async function renderCompanyReviewsSection(listing, getDemoBundle) {
    const reviewsSection = document.getElementById("section-reviews");
    const bodyEl = document.querySelector("[data-biz-detail-reviews-body]");
    if (!reviewsSection) return;

    const bundle = await loadCompanyReviewBundle(listing, getDemoBundle);

    reviewsSection.hidden = false;
    setPanelVisibility(reviewsSection, true);
    if (bodyEl) bodyEl.hidden = false;

    const average = bundle.demoOnly
      ? isRepairBiz(listing)
        ? REPAIR_DEMO_REVIEW_SUMMARY.average
        : isCleaningBiz(listing)
          ? CLEANING_DEMO_REVIEW_SUMMARY.average
          : isStoreFieldBiz(listing)
            ? STORE_DEMO_REVIEW_SUMMARY.average
            : TAXI_DEMO_REVIEW_SUMMARY.average
      : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
    const totalCount = bundle.demoOnly
      ? isRepairBiz(listing)
        ? REPAIR_DEMO_REVIEW_SUMMARY.totalCount
        : isCleaningBiz(listing)
          ? CLEANING_DEMO_REVIEW_SUMMARY.totalCount
          : isStoreFieldBiz(listing)
            ? STORE_DEMO_REVIEW_SUMMARY.totalCount
            : TAXI_DEMO_REVIEW_SUMMARY.totalCount
      : Number(bundle.reviewCount) || bundle.reviews.length;

    const avgEl = reviewsSection.querySelector("[data-biz-detail-review-average]");
    const starsEl = reviewsSection.querySelector("[data-biz-detail-review-stars]");
    const countEl = reviewsSection.querySelector("[data-biz-detail-review-count]");
    const breakdownEl = reviewsSection.querySelector("[data-biz-detail-reviews-breakdown]");
    const stripEl = reviewsSection.querySelector("[data-biz-detail-reviews-strip]");

    if (avgEl) avgEl.textContent = average.toFixed(1);
    if (starsEl) {
      starsEl.textContent = formatReviewStarGlyphs(average);
      starsEl.setAttribute("aria-label", `平均評価 ${average.toFixed(1)}、${totalCount}件`);
      starsEl.classList.add("detail-gold-stars");
      starsEl.classList.remove("detail-navy-stars");
    }
    if (countEl) countEl.textContent = String(totalCount);
    if (breakdownEl) {
      breakdownEl.innerHTML = buildCompanyReviewBreakdownHtml(bundle.breakdown);
    }
    if (stripEl) {
      const cards = bundle.reviews.slice(0, 4);
      stripEl.innerHTML = cards.map(buildCompanyReviewCardHtml).join("");
      stripEl.dataset.reviewCount = String(cards.length);
    }
  }

  async function renderTaxiReviewsSection(listing) {
    return renderCompanyReviewsSection(listing, getTaxiDemoReviewBundle);
  }

  async function renderRepairReviewsSection(listing) {
    return renderCompanyReviewsSection(listing, getRepairDemoReviewBundle);
  }

  function buildRepairSidebarCtasHtml(listing, ctas) {
    return [
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--inquiry-main" data-biz-detail-inquiry><span class="biz-detail-btn__icon" aria-hidden="true">✉</span><span>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</span></a>`,
      `<a href="${escapeAttr(getRepairEmergencyAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--repair-emergency" data-biz-detail-estimate><span class="biz-detail-btn__icon" aria-hidden="true">⚡</span><span>${escapeHtml(listing.emergency_label || `${DETAIL_EMERGENCY_LABEL}（24時間受付）`)}</span></a>`,
      `<button type="button" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--taxi-outline biz-detail-btn--taxi-favorite" data-biz-detail-favorite aria-label="お気に入りに追加"><span class="biz-detail-btn__icon" aria-hidden="true">♡</span><span>お気に入りに追加</span></button>`,
    ].join("");
  }

  async function renderRepairSidebar(listing, ctas) {
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const priceRouteEl = document.querySelector("[data-biz-detail-sidebar-price-route]");
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    const ratingWrap = document.querySelector("[data-biz-detail-sidebar-rating]");
    const actionsHost = document.querySelector("[data-biz-detail-sidebar-actions]");
    const metaBlock = document.querySelector("[data-biz-detail-sidebar-meta-block]");

    if (ratingWrap) ratingWrap.hidden = true;
    if (priceRouteEl) priceRouteEl.hidden = true;

    const bundle = await loadCompanyReviewBundle(listing, getRepairDemoReviewBundle);
    if (ratingWrap && bundle.reviewCount > 0) {
      ratingWrap.hidden = false;
      const ratingStars = document.querySelector("[data-biz-detail-sidebar-rating-stars]");
      const ratingScore = document.querySelector("[data-biz-detail-sidebar-rating-score]");
      const ratingCount = document.querySelector("[data-biz-detail-sidebar-rating-count]");
      const average = bundle.demoOnly
        ? REPAIR_DEMO_REVIEW_SUMMARY.average
        : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
      const totalCount = bundle.demoOnly
        ? REPAIR_DEMO_REVIEW_SUMMARY.totalCount
        : Number(bundle.reviewCount) || bundle.reviews.length;
      if (ratingStars) {
        ratingStars.textContent = formatReviewStarGlyphs(average);
        ratingStars.classList.add("detail-gold-stars");
        ratingStars.classList.remove("detail-navy-stars");
      }
      if (ratingScore) ratingScore.textContent = average.toFixed(1);
      if (ratingCount) ratingCount.textContent = `（${totalCount}件）`;
    }

    if (priceLabelEl) {
      priceLabelEl.textContent = listing.main_price_label || "お問い合わせ";
    }
    if (priceEl) {
      priceEl.textContent =
        listing.main_price_text ||
        formatDisplayText(listing.budgetLabel, "budget") ||
        "出張費 3,000円〜 / 作業料 要見積";
    }

    if (actionsHost) {
      actionsHost.className =
        "biz-detail-sidebar__cta-group biz-detail-sidebar__cta-group--repair".trim();
      actionsHost.dataset.businessCategory = ctas.categoryKey || "repair_maintenance";
      actionsHost.dataset.ctaScope = "detail";
      actionsHost.innerHTML = buildRepairSidebarCtasHtml(listing, ctas);
    }

    hideLegacyFvFavorite();
    if (metaBlock) metaBlock.hidden = false;
  }

  function resolveDetailCtas(listing) {
    if (window.TasuBusinessWording?.getDetailCtas) {
      return window.TasuBusinessWording.getDetailCtas(listing);
    }
    return {
      primaryLabel: "問い合わせる",
      subHpLabel: "HPを見る",
      subMapLabel: "GoogleMapを見る",
      estimateLabel: DETAIL_ESTIMATE_LABEL,
      primaryClass: "biz-detail-btn biz-detail-btn--primary",
      actionsMod: "biz-detail-actions--cat-default",
      categoryKey: listing.business_category || "",
    };
  }

  /** 詳細ページCTA（電話ボタンは出さない） */
  function buildActionsHtml(listing, ctas) {
    const hp = String(listing.hp_url || "").trim();
    const map = String(listing.google_map_url || "").trim();
    const parts = [];
    parts.push(
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="${escapeAttr(ctas.primaryClass)} biz-detail-btn--inquiry-main" data-biz-detail-inquiry>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</a>`
    );
    const secondaryLabel = getDetailSecondaryCtaLabel(listing);
    parts.push(
      `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="biz-detail-btn biz-detail-btn--outline" data-biz-detail-estimate>${escapeHtml(secondaryLabel)}</a>`
    );
    if (hp) {
      parts.push(
        `<a href="${escapeAttr(hp)}" class="biz-detail-btn biz-detail-btn--sub" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subHpLabel || "HPを見る")}</a>`
      );
    }
    if (map) {
      parts.push(
        `<a href="${escapeAttr(map)}" class="biz-detail-btn biz-detail-btn--sub" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subMapLabel || "GoogleMapを見る")}</a>`
      );
    }
    return parts.join("");
  }

  function buildDlRows(rows) {
    return rows
      .filter((row) => row.value && row.value !== "—")
      .map(
        (row) =>
          `<div class="biz-detail-dl__row"><dt>${escapeHtml(row.label)}</dt><dd>${row.html || escapeHtml(row.value)}</dd></div>`
      )
      .join("");
  }

  function setPanelVisibility(el, visible) {
    if (!el) return;
    if (visible) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function setTextContent(el, text) {
    if (!el) return;
    const s = String(text ?? "").trim();
    el.textContent = s;
  }

  function pickCoveragePills(listing) {
    const block = getCategoryExtraBlock(listing);
    const pills = new Set();

    splitListText(block.work_types).forEach((p) => {
      const label = formatDisplayText(p, "work_types");
      if (label) pills.add(label);
    });
    splitListText(block.cleaning_types).forEach((p) => {
      const label = formatDisplayText(p, "cleaning_types");
      if (label) pills.add(label);
    });
    splitListText(block.repair_types).forEach((p) => {
      const label = formatDisplayText(p, "repair_types");
      if (label) pills.add(label);
    });
    splitListText(block.service_types).forEach((p) => {
      const label = formatDisplayText(p, "service_types");
      if (label) pills.add(label);
    });
    splitListText(block.taxi_services).forEach((p) => {
      const label = formatDisplayText(p, "taxi_services");
      if (label) pills.add(label);
    });
    splitListText(block.vehicle_types).forEach((p) => {
      const label = formatDisplayText(p, "vehicle_types");
      if (label) pills.add(label);
    });
    splitListText(block.taxi_area_type).forEach((p) => {
      const label = formatDisplayText(p, "taxi_area_type");
      if (label) pills.add(label);
    });
    (listing.tags || []).forEach((t) => {
      const s = formatDisplayText(t, "tags");
      if (s && s.length <= 24 && !/受付|募集|応募/i.test(s)) pills.add(s);
    });

    splitListText(listing.title).forEach((p) => {
      if (p.length >= 2 && p.length <= 16) pills.add(p);
    });

    if (!pills.size) {
      splitListText(listing.boardCoverageShort || listing.serviceSummary || "").forEach((p) =>
        pills.add(p)
      );
    }

    return [...pills].slice(0, 16);
  }

  function pickPropertyTypes(listing) {
    const blob = getSearchBlob(listing);
    const matched = PROPERTY_TYPES.filter((pt) =>
      pt.keywords.some((kw) => blob.includes(kw.toLowerCase()))
    );
    if (matched.length) return matched;
    if (isTaxiBiz(listing)) {
      return [];
    }
    if (isConstructionBiz(listing)) {
      return PROPERTY_TYPES.slice(0, 4);
    }
    return [];
  }

  function pickDefaultCaseContent(listing) {
    const block = getCategoryExtraBlock(listing);
    if (isTaxiBiz(listing)) {
      const services = formatDisplayText(block.taxi_services, "taxi_services");
      if (services) return truncateText(services, 48);
    }
    const work = formatDisplayText(block.work_types, "work_types");
    if (work) return truncateText(work, 48);
    return truncateText(
      listing.boardCoverageShort || listing.serviceSummary || listing.title || "",
      48
    );
  }

  function parseCaseChunk(chunk, listing, index) {
    const line = String(chunk || "").replace(/\n/g, " ").trim();
    if (!line) return null;

    let title = line;
    let period = "";
    let cost = "";
    const defaultContent = pickDefaultCaseContent(listing);

    let region = "";
    const periodInline = line.match(/工期\s*[：:]\s*([^費用地域|｜]+)/);
    const costInline = line.match(/費用\s*[：:]\s*(.+)$/);
    const regionInline = line.match(/地域\s*[：:]\s*([^費用|｜]+)/);
    if (periodInline) period = periodInline[1].trim();
    if (costInline) cost = costInline[1].trim();
    if (regionInline) region = regionInline[1].trim();

    if (/[—\-|｜]/.test(line)) {
      const parts = line.split(/[—\-|｜]/).map((s) => s.trim()).filter(Boolean);
      title = parts[0] || title;
      parts.slice(1).forEach((part) => {
        if (/工期/.test(part)) {
          period = part.replace(/^工期\s*[：:]\s*/, "").trim();
        } else if (/費用|金額/.test(part)) {
          cost = part.replace(/^(費用|金額)\s*[：:]\s*/, "").trim();
        } else if (!period && /週間|日間|ヶ月|日/.test(part)) {
          period = part;
        } else if (/地域/.test(part)) {
          region = part.replace(/^地域\s*[：:]\s*/, "").trim();
        } else if (!cost && /万|円|¥/.test(part)) {
          cost = part;
        }
      });
    }

    title = title
      .replace(/工期\s*[：:].*$/, "")
      .replace(/費用\s*[：:].*$/, "")
      .replace(/地域\s*[：:].*$/, "")
      .trim();
    if (!period) period = listing.contractLabel && listing.contractLabel !== "未設定" ? listing.contractLabel : "";
    if (!cost && listing.budgetLabel && index === 0) {
      cost = listing.budgetLabel;
    }

    const displayTitle = title || `施工事例 ${index + 1}`;

    return {
      title: displayTitle,
      content: defaultContent,
      period: formatDisplayText(period, "contract_period") || period,
      cost: formatDisplayText(cost, "budget") || cost,
      region: region || pickCaseRegion(listing, displayTitle, index),
      image: "",
    };
  }

  function parseWorkCaseStudies(listing) {
    const galleryImages = resolveSubImages(listing);
    const dbCases = pickWorkCasesRaw(listing);
    const defaultContent = pickDefaultCaseContent(listing);

    if (isFieldServiceUiBiz(listing) && dbCases.length) {
      return dbCases
        .slice(0, WORK_CASE_PHOTOS_MAX)
        .map((item, i) => mergeWorkCaseItem(item, listing, i));
    }

    const sampleCases = isRepairBiz(listing)
      ? [
          { title: "オフィス水漏れ緊急対応（港区）", period: "即日", cost: "約28,000円", region: "港区" },
          { title: "店舗ブレーカー復旧（渋谷区）", period: "当日", cost: "約15,000円", region: "渋谷区" },
          { title: "エアコン異音・点検（横浜市）", period: "翌日", cost: "約12,000円", region: "横浜市" },
        ]
      : isConstructionBiz(listing)
        ? [
            { title: "オフィス内装工事（渋谷区）", period: "2週間", cost: "約380万円", region: "渋谷区" },
            { title: "カフェ改装工事（横浜市）", period: "3週間", cost: "約520万円", region: "横浜市" },
            { title: "店舗原状回復（港区）", period: "5日", cost: "約95万円", region: "港区" },
          ]
        : [];

    const textItems = dbCases.length
      ? dbCases
      : sampleCases.map((sample) => ({ ...sample, content: defaultContent }));

    const count = Math.min(
      Math.max(textItems.length, galleryImages.length),
      WORK_CASE_PHOTOS_MAX
    );
    if (!count) return [];

    const out = [];
    for (let i = 0; i < count; i += 1) {
      const item = textItems[i] || { title: `事例 ${i + 1}`, content: defaultContent };
      out.push(mergeWorkCaseItem(item, listing, i));
    }
    return out;
  }

  function parseCaseStudies(listing, images) {
    if (usesWorkCasesProfile(listing)) {
      return parseWorkCaseStudies(listing);
    }

    const raw = String(listing.achievements || "").trim();
    const cases = [];
    const defaultContent = pickDefaultCaseContent(listing);

    if (raw && !/^(yes|no|true|false)$/i.test(raw)) {
      const chunks = raw.split(/\n+/).filter(Boolean);
      chunks.forEach((chunk, i) => {
        const parsed = parseCaseChunk(chunk, listing, i);
        if (!parsed) return;
        parsed.image = images[(i + 1) % Math.max(images.length, 1)] || images[0] || "";
        cases.push(parsed);
      });
    }

    if (isTaxiBiz(listing)) {
      const routes = String(
        getCategoryExtraBlock(listing).taxi_route_price || listing.taxi_route_price || ""
      ).trim();
      if (routes && !/^(yes|no|true|false)$/i.test(routes)) {
        routes.split(/\n+/).filter(Boolean).forEach((chunk, i) => {
          const routeCase = parseTaxiRouteCaseDisplay(chunk);
          if (!routeCase) return;
          cases.push({
            title: routeCase.route || `送迎ルート ${i + 1}`,
            content: "",
            period: "",
            cost: routeCase.price,
            region: "",
            image: images[i % Math.max(images.length, 1)] || images[0] || "",
            isTaxiRoute: true,
          });
        });
      }
      if (cases.length) {
        return cases.slice(0, 6);
      }
    }

    const sampleCases = isRepairBiz(listing)
      ? [
          {
            title: "オフィス水漏れ緊急対応（港区）",
            period: "即日",
            cost: "約28,000円",
            region: "港区",
          },
          {
            title: "店舗ブレーカー復旧（渋谷区）",
            period: "当日",
            cost: "約15,000円",
            region: "渋谷区",
          },
          {
            title: "エアコン異音・点検（横浜市）",
            period: "翌日",
            cost: "約12,000円",
            region: "横浜市",
          },
        ]
      : isConstructionBiz(listing)
        ? [
            {
              title: "オフィス内装工事（渋谷区）",
              period: "2週間",
              cost: "約380万円",
              region: "渋谷区",
            },
            {
              title: "カフェ改装工事（横浜市）",
              period: "3週間",
              cost: "約520万円",
              region: "横浜市",
            },
            {
              title: "店舗原状回復（港区）",
              period: "5日",
              cost: "約95万円",
              region: "港区",
            },
          ]
        : [];

    if (cases.length < 3) {
      for (let i = cases.length; i < 3; i += 1) {
        const sample = sampleCases[i];
        cases.push({
          title: sample?.title || truncateText(listing.title, 32) || `事例 ${i + 1}`,
          content: defaultContent,
          period: sample?.period || (listing.contractLabel !== "未設定" ? listing.contractLabel : "要相談"),
          cost: sample?.cost || (i === 0 ? listing.budgetLabel || "" : ""),
          region: sample?.region || pickCaseRegion(listing, sample?.title, i),
          image: images[i % Math.max(images.length, 1)] || images[0] || "",
        });
      }
    }

    if (!cases.length && (listing.title || images[0])) {
      cases.push({
        title: listing.title || listing.company_name || "施工事例",
        content: defaultContent,
        period: listing.contractLabel || "",
        cost: listing.budgetLabel || "",
        image: images[0] || "",
      });
    }

    return cases.slice(0, 6).map((c, i) => ({
      ...c,
      region: c.region || pickCaseRegion(listing, c.title, i),
      image: c.image || images[i % Math.max(images.length, 1)] || "",
    }));
  }

  function parseTaxiPriceCards(listing) {
    const block = getCategoryExtraBlock(listing);
    const cards = [];
    const base = formatDisplayText(
      block.taxi_base_fare || listing.taxi_base_fare || listing.budgetLabel,
      "taxi_base_fare"
    );
    if (base) cards.push({ label: "基本料金", value: base, note: "" });
    const night = formatDisplayText(block.taxi_night_fare || listing.taxi_night_fare, "taxi_night_fare");
    if (night) cards.push({ label: "深夜料金", value: night, note: "" });
    const routes = String(block.taxi_route_price || listing.taxi_route_price || "").trim();
    if (routes) {
      routes.split(/\n+/).filter(Boolean).forEach((line, i) => {
        const m = line.match(/^(.+?)[:：]\s*(.+)$/);
        cards.push({
          label: m ? m[1].trim() : i === 0 ? "ルート別料金" : "ルート",
          value: m ? m[2].trim() : line,
          note: "",
        });
      });
    }
    const payments = formatTaxiPayments(block.taxi_payment_methods || listing.taxi_payment_methods);
    if (payments) {
      cards.push({ label: "支払い条件", value: payments, note: "" });
    } else if (listing.paymentTypeLabel && listing.paymentTypeLabel !== "—") {
      cards.push({
        label: "支払い条件",
        value: formatDisplayText(listing.paymentTypeLabel, "payment_type"),
        note: "",
      });
    }
    if (!cards.length) {
      cards.push({
        label: "料金目安",
        value: formatDisplayText(listing.budgetLabel, "budget") || "要相談",
        note: "",
      });
    }
    return cards;
  }

  function parsePriceCards(listing) {
    if (isTaxiBiz(listing)) {
      return parseTaxiPriceCards(listing);
    }
    if (isRepairBiz(listing)) {
      return parseRepairPriceCards(listing);
    }
    const budget = String(listing.budgetLabel || "見積要相談").trim();
    const cards = [];
    const lines = budget.split(/\n|／/).map((s) => s.trim()).filter(Boolean);

    if (lines.length >= 2) {
      lines.forEach((line) => {
        const m = line.match(/^(.+?)[:：]\s*(.+)$/);
        cards.push({
          label: m ? m[1] : "料金",
          value: m ? m[2] : line,
          note: "",
        });
      });
    } else {
      const nightMatch = budget.match(/(夜勤|夜間)[^\d]*([\d,¥円〜~]+[^\s]*)/i);
      const dayMatch = budget.match(/(日給|軽作業|常用)[^\d]*([\d,¥円〜~]+[^\s]*)/i);
      if (nightMatch || dayMatch) {
        if (dayMatch) {
          cards.push({ label: dayMatch[1], value: dayMatch[2], note: "" });
        }
        if (nightMatch) {
          cards.push({ label: nightMatch[1], value: nightMatch[2], note: "" });
        }
      } else {
        cards.push({ label: "料金目安", value: budget, note: "" });
      }
    }

    const payment =
      listing.paymentTypeLabel && listing.paymentTypeLabel !== "—"
        ? listing.paymentTypeLabel
        : "";
    if (payment) {
      cards.push({
        label: "支払い条件",
        value: formatDisplayText(payment, "payment_type") || payment,
        note: "",
      });
    }

    const periodLabel =
      isConstructionBiz(listing) ? "工期" : "対応期間";
    if (listing.contractLabel && listing.contractLabel !== "未設定") {
      cards.push({
        label: periodLabel,
        value: listing.contractLabel,
        note: `開始：${listing.startDateText || "要相談"}`,
      });
    }

    if (listing.headcountText && listing.headcountText !== "—") {
      cards.push({
        label: "対応可能人数",
        value: listing.headcountText,
        note: "",
      });
    }

    return cards;
  }

  /** タクシー「サービスの特徴」カード（最大6件・登録データに応じて生成） */
  function buildTaxiFeatureCards(listing) {
    const block = getCategoryExtraBlock(listing);
    const lang = formatDisplayText(block.taxi_language_support, "taxi_language_support");
    const childSeat = formatExtraValue(block.child_seat, "support", "taxi_child_seat");
    const defs = [
      {
        icon: "✈️",
        title: "空港送迎対応",
        desc: "成田・羽田送迎に対応",
        active: () => taxiSupportYes(block.airport_transfer),
      },
      {
        icon: "🌙",
        title: "24時間・深夜対応",
        desc: "早朝便・深夜便も相談可能",
        active: () => taxiSupportYes(block.support_24h) || Boolean(String(block.taxi_night_fare || "").trim()),
      },
      {
        icon: "🏢",
        title: "法人契約対応",
        desc: "請求書・継続利用に対応",
        active: () => taxiSupportYes(block.corporate_contract),
      },
      {
        icon: "🧾",
        title: "インボイス対応",
        desc: "法人利用でも安心",
        active: () =>
          taxiSupportYes(block.invoice_support_extra) || listing.invoice_support === "yes",
      },
      {
        icon: "🚘",
        title: "予約送迎対応",
        desc: "事前予約でスムーズに送迎",
        active: () => taxiSupportYes(block.reservation_support),
      },
      {
        icon: "🗣",
        title: "英語相談可能",
        desc: "英語でのご相談にも対応",
        active: () => lang && /英語|english/i.test(lang),
      },
      {
        icon: "🧸",
        title: "チャイルドシート相談可能",
        desc: "お子様連れのご相談に対応",
        active: () => childSeat && !/^不可|なし|no$/i.test(childSeat),
      },
    ];
    return defs.filter((d) => d.active()).slice(0, 6);
  }

  function buildStrengthCards(listing) {
    if (isTaxiBiz(listing)) {
      return buildTaxiFeatureCards(listing);
    }
    if (isRepairBiz(listing)) {
      return buildRepairStrengthCards(listing);
    }
    if (isCleaningBiz(listing)) {
      return buildCleaningStrengthCards(listing);
    }
    if (isFieldServiceUiBiz(listing)) {
      return buildFieldServiceStrengthCards(listing);
    }
    if (isStoreFieldBiz(listing)) {
      return buildStoreStrengthCards(listing);
    }
    const licenseDisplay = window.TasuBusinessWording?.formatLicenseLine
      ? window.TasuBusinessWording.formatLicenseLine(
          listing.license_info || listing.licenseLine || ""
        )
      : formatDisplayText(listing.license_info || listing.licenseLine, "license_info");
    const descs = {
      achievements: "豊富な施工・導入実績をご紹介",
      coverage:
        truncateText(listing.boardCoverageShort || listing.serviceSummary, 40) ||
        "企画から完工まで一貫対応",
      speed:
        listing.isStartSoon || /即日|迅速|最短/i.test(getSearchBlob(listing))
          ? "最短即日〜3営業日でご連絡"
          : formatDisplayText(listing.startDateText, "start_date") || "柔軟なスケジュール調整",
      license: truncateText(licenseDisplay, 42) || "許可・資格を明示した体制",
      partner: listing.hasPartnerRegistration
        ? "協力会社ネットワークで大規模案件にも対応"
        : "地域密着で安心のパートナー",
    };

    return STRENGTH_PRESETS.map((preset) => ({
      icon: preset.icon,
      title: preset.title,
      desc: descs[preset.descKey] || "",
    })).filter((c) => c.desc);
  }

  function buildTaxiFaqItems(listing) {
    const block = getCategoryExtraBlock(listing);
    const items = [];
    const h24 = formatExtraValue(block.support_24h, "support", "taxi_24h_available");
    if (h24) {
      items.push({ q: "深夜でも対応できますか？", a: h24 });
    } else if (block.taxi_night_fare) {
      items.push({
        q: "深夜でも対応できますか？",
        a: formatDisplayText(block.taxi_night_fare, "taxi_night_fare"),
      });
    }
    const airport = formatExtraValue(
      block.airport_transfer,
      "support",
      "taxi_airport_transfer"
    );
    if (airport) {
      items.push({ q: "空港送迎はできますか？", a: airport });
    }
    const corporate = formatExtraValue(
      block.corporate_contract,
      "support",
      "taxi_corporate_contract"
    );
    if (corporate) {
      items.push({ q: "法人契約できますか？", a: corporate });
    }
    const invoice = formatExtraValue(
      block.invoice_support_extra,
      "support",
      "taxi_invoice_available"
    );
    if (invoice) {
      items.push({ q: "領収書/インボイス対応できますか？", a: invoice });
    }
    const reservation = formatExtraValue(
      block.reservation_support,
      "support",
      "taxi_reservation_available"
    );
    if (reservation) {
      items.push({ q: "予約は必要ですか？", a: reservation });
    }
    if (block.taxi_capacity) {
      items.push({
        q: "大型荷物は積めますか？",
        a: `${formatDisplayText(block.taxi_capacity, "taxi_capacity")}。車種・荷物量によりご相談ください。`,
      });
    }
    const childSeat = formatExtraValue(block.child_seat, "support", "taxi_child_seat");
    if (childSeat) {
      items.push({ q: "チャイルドシートはありますか？", a: childSeat });
    }

    const defaults = [
      {
        q: "深夜でも対応できますか？",
        a: "深夜・早朝の送迎は事前予約をおすすめします。詳細はお問い合わせください。",
      },
      {
        q: "空港送迎はできますか？",
        a: "空港送迎の可否・料金はルートにより異なります。お問い合わせください。",
      },
      {
        q: "予約は必要ですか？",
        a: "事前予約がスムーズです。即時配車の可否は掲載内容をご確認ください。",
      },
    ];
    defaults.forEach((d) => {
      if (!items.some((item) => item.q === d.q)) items.push(d);
    });

    return items;
  }

  function buildFaqItems(listing) {
    if (isTaxiBiz(listing)) {
      const taxiItems = buildTaxiFaqItems(listing);
      if (taxiItems.length) return taxiItems.slice(0, 8);
    }
    if (isRepairBiz(listing)) {
      return buildRepairFaqItems(listing);
    }
    if (isCleaningBiz(listing)) {
      return buildCleaningFaqItems(listing);
    }
    if (isStoreFieldBiz(listing)) {
      return buildStoreFaqItems(listing);
    }
    const block = getCategoryExtraBlock(listing);
    const items = [];

    const night = formatExtraValue(block.night_support, "support", "night_support");
    if (night) {
      items.push({ q: "夜間対応は可能ですか？", a: night });
    }
    const emergency = formatExtraValue(block.emergency_support, "support", "emergency_support");
    if (emergency) {
      items.push({ q: "緊急対応は可能ですか？", a: emergency });
    }
    const estimate = formatExtraValue(block.estimate_support, "estimate", "estimate_support");
    if (estimate) {
      items.push({ q: "見積もりは無料ですか？", a: estimate });
    } else if (/見積無料|無料見積/i.test(getSearchBlob(listing))) {
      items.push({ q: "見積もりは無料ですか？", a: "見積無料の案件があります。詳細はお問い合わせください。" });
    }
    const team = formatDisplayText(block.team_capacity || listing.headcountText, "team_capacity");
    if (team && team !== "—") {
      items.push({ q: "何人まで対応できますか？", a: team });
    }
    const insurance = formatExtraValue(block.insurance, "insurance", "insurance");
    if (insurance) {
      items.push({ q: "保険・労災は加入していますか？", a: insurance });
    }
    if (listing.service_area) {
      items.push({
        q: "対応エリアはどこですか？",
        a: listing.service_area,
      });
    }

    if (!items.length) {
      items.push(
        {
          q: "問い合わせ方法は？",
          a: listing.contactMethodDisplayLabel || "サイト内からお問い合わせください。",
        },
        {
          q: "料金の目安を教えてください。",
          a: listing.budgetLabel || "案件内容により異なります。お見積りください。",
        }
      );
    }

    return items.slice(0, 6);
  }

  function parseLicenseRows(listing) {
    const block = getCategoryExtraBlock(listing);
    const rows = [];

    const licenseExtra = formatExtraValue(
      block.construction_license,
      "",
      "construction_license"
    );
    if (licenseExtra) rows.push({ label: "建設業許可", value: licenseExtra });

    const insurance = formatExtraValue(block.insurance, "insurance", "insurance");
    if (insurance) rows.push({ label: "保険加入", value: insurance });

    const licenseFormatted = window.TasuBusinessWording?.formatLicenseLine
      ? window.TasuBusinessWording.formatLicenseLine(
          listing.license_info || listing.licenseLine || ""
        )
      : "";
    splitListText(licenseFormatted || listing.license_info || listing.licenseLine || "").forEach(
      (part, i) => {
        if (!part) return;
        const m = part.match(/^(.+?)[:：]\s*(.+)$/);
        rows.push({
          label: m ? m[1] : i === 0 ? "許可・資格" : "資格",
          value: m ? formatDisplayText(m[2], "license_info") : formatDisplayText(part, "license_info"),
        });
      }
    );

    if (!rows.length && (listing.license_info || listing.licenseLine)) {
      rows.push({
        label: "許可・資格",
        value: formatDisplayText(listing.license_info || listing.licenseLine, "license_info"),
      });
    }

    if (block.team_capacity) {
      rows.push({
        label: "責任者・体制",
        value: formatDisplayText(block.team_capacity, "team_capacity"),
      });
    }

    return rows;
  }

  function buildTrustChecklist(listing) {
    const block = getCategoryExtraBlock(listing);
    const items = [];
    const license = formatExtraValue(block.construction_license, "", "construction_license");
    if (license) items.push(license);
    const insurance = formatExtraValue(block.insurance, "insurance", "insurance");
    if (insurance) items.push(insurance);
    const licenseLine = window.TasuBusinessWording?.formatLicenseLine
      ? window.TasuBusinessWording.formatLicenseLine(listing.licenseLine || listing.license_info || "")
      : formatDisplayText(listing.licenseLine || listing.license_info, "license_info");
    if (licenseLine) items.push(licenseLine);
    const invoiceLabel = formatDisplayText(listing.invoice_support, "invoice_support");
    if (invoiceLabel) items.push(invoiceLabel);
    return items.slice(0, 5);
  }

  function buildSupportChecklist(listing) {
    const items = [];
    if (isTaxiBiz(listing)) {
      const block = getCategoryExtraBlock(listing);
      const airport = formatExtraValue(
        block.airport_transfer,
        "support",
        "taxi_airport_transfer"
      );
      if (airport) items.push(airport);
      const h24 = formatExtraValue(block.support_24h, "support", "taxi_24h_available");
      if (h24) items.push(h24);
      const reservation = formatExtraValue(
        block.reservation_support,
        "support",
        "taxi_reservation_available"
      );
      if (reservation) items.push(reservation);
      const corporate = formatExtraValue(
        block.corporate_contract,
        "support",
        "taxi_corporate_contract"
      );
      if (corporate) items.push(corporate);
      const payments = formatTaxiPayments(block.taxi_payment_methods);
      if (payments) items.push(`支払い：${payments}`);
      if (listing.service_area) items.push(`対応エリア：${listing.service_area}`);
      return items.slice(0, 5);
    }
    const block = getCategoryExtraBlock(listing);
    const nightLabel = formatExtraValue(block.night_support, "support", "night_support");
    if (nightLabel && !/非対応|不可|未取得/.test(nightLabel)) {
      items.push(nightLabel.includes("夜間") ? nightLabel : `夜間工事${nightLabel}`);
    }
    const emergencyLabel = formatExtraValue(
      block.emergency_support,
      "support",
      "emergency_support"
    );
    if (emergencyLabel && !/非対応|不可|未取得/.test(emergencyLabel)) {
      items.push(emergencyLabel);
    }
    if (listing.hasPartnerRegistration) items.push("協力会社との連携施工");
    if (listing.isCorporateWelcome || /法人/i.test(getSearchBlob(listing))) {
      items.push("法人・団体向け契約に対応");
    }
    if (listing.service_area) items.push(`対応エリア：${listing.service_area}`);
    return items.slice(0, 5);
  }

  function renderDetailBackLink(listing, ctx) {
    const back = document.querySelector("[data-biz-detail-back]");
    if (!back || back.hidden) return;
    if (!window.TasuDetailNav?.resolveBackLink) return;
    const navCtx = ctx || window.TasuDetailNav.parseFromLocation();
    const link = window.TasuDetailNav.resolveBackLink(navCtx, listing);
    back.href = link.href;
    back.textContent = link.label;
  }

  function renderBreadcrumb(listing) {
    const ctx = window.TasuDetailNav?.parseFromLocation?.() || {};
    const company = listing?.company_name || listing?.title || "詳細";
    if (isShopStoreBiz(listing)) {
      const applied = window.TasuCommonBreadcrumb?.applyDetailFallback?.(ctx, listing, {
        theme: "biz-detail",
        extraClass: "biz-detail-breadcrumb--shop",
        shop: true,
      });
      if (applied) return;
      return;
    }
    const applied = window.TasuCommonBreadcrumb?.applyDetailFallback?.(ctx, listing, {
      theme: "biz-detail",
    });
    if (applied) {
      renderDetailBackLink(listing, ctx);
      return;
    }
    renderDetailBackLink(listing, ctx);
    window.TasuCommonBreadcrumb?.setCurrentLabel(company);
  }

  function renderHeroQuick(listing) {
    const el = document.querySelector("[data-biz-detail-hero-quick]");
    if (!el) return;

    if (isShopDetail(listing)) {
      renderStoreShopHeroInfo(listing);
      return;
    }

    if (isTaxiBiz(listing)) {
      el.innerHTML = "";
      return;
    }

    if (isRepairBiz(listing)) {
      const block = getCategoryExtraBlock(listing);
      const rows = [
        {
          icon: "📍",
          label: "対応エリア",
          value: listing.service_area || block.service_area || "",
        },
        { icon: "👥", label: "対応対象", value: resolveRepairTargetClients(listing) },
        {
          icon: "🔧",
          label: "カテゴリ",
          value: listing.categoryLabel || "修理・メンテナンス / 設備修理",
        },
        {
          icon: "⏱",
          label: "最短対応時間",
          value: resolveRepairMinResponseTime(listing),
        },
      ];
      const filtered = rows.filter((r) => r.value && r.value !== "—");
      el.hidden = filtered.length === 0;
      el.innerHTML = filtered
        .map(
          (r) =>
            `<li class="biz-detail-quick__item"><span class="biz-detail-quick__icon" aria-hidden="true">${r.icon}</span><span><span class="biz-detail-quick__label">${escapeHtml(r.label)}</span>${escapeHtml(r.value)}</span></li>`
        )
        .join("");
      return;
    }

    if (isDetailBusinessServicePage()) {
      renderBusinessServiceHeroQuick(listing);
      return;
    }

    if (isFieldServiceUiBiz(listing)) {
      const block = getFieldServiceBlock(listing);
      const phone = String(listing.phone || "").trim();
      const workSummary = formatFieldServiceWorkSummary(listing);
      const estimateValue = taxiSupportYes(block.estimate_support)
        ? "見積無料"
        : formatExtraValue(block.estimate_support, "estimate", "estimate_support") || "";
      const leftRows = [
        { icon: "🔧", label: "対応内容", value: workSummary },
        {
          icon: "🕐",
          label: "営業時間",
          value: block.service_hours || listing.business_hours || "",
        },
        {
          icon: "📞",
          label: "電話番号",
          value:
            fieldServiceCtaEnabled(block.show_phone, true) && phone
              ? phone
              : fieldServiceCtaEnabled(block.show_phone, true)
                ? "お問い合わせからご確認"
                : "",
        },
      ].filter((r) => r.value && r.value !== "—");
      const rightRows = [
        {
          icon: "📍",
          label: "対応エリア",
          value: block.visit_area || listing.service_area || "",
        },
        {
          icon: "⚡",
          label: "即日対応",
          value: taxiSupportYes(block.same_day_support)
            ? "対応可能"
            : listing.isStartSoon
              ? "相談可"
              : "",
        },
        { icon: "📋", label: "見積", value: estimateValue },
      ].filter((r) => r.value && r.value !== "—");
      el.hidden = leftRows.length === 0 && rightRows.length === 0;
      el.classList.add("field-service-hero-quick", "field-service-info-board");
      el.innerHTML = `<li class="field-service-info-board__col">${leftRows.map(buildFieldServiceInfoCardHtml).join("")}</li><li class="field-service-info-board__col">${rightRows.map(buildFieldServiceInfoCardHtml).join("")}</li>`;
      return;
    }

    if (isCleaningBiz(listing)) {
      const block = getCategoryExtraBlock(listing);
      const rows = [
        {
          icon: "📍",
          label: "対応エリア",
          value: listing.service_area || block.service_area || "",
        },
        {
          icon: "👥",
          label: "対応対象",
          value: listing.target_users || "ご家庭・法人・店舗",
        },
        {
          icon: "✨",
          label: "カテゴリ",
          value: listing.categoryLabel || "清掃・片付け",
        },
        {
          icon: "📅",
          label: "対応目安",
          value:
            listing.response_time ||
            (taxiSupportYes(block.spot_support) || listing.isStartSoon
              ? "即日相談可能"
              : "ご相談ください"),
        },
      ];
      const filtered = rows.filter((r) => r.value && r.value !== "—");
      el.hidden = filtered.length === 0;
      el.innerHTML = filtered
        .map(
          (r) =>
            `<li class="biz-detail-quick__item"><span class="biz-detail-quick__icon" aria-hidden="true">${r.icon}</span><span><span class="biz-detail-quick__label">${escapeHtml(r.label)}</span>${escapeHtml(r.value)}</span></li>`
        )
        .join("");
      return;
    }

    const block = getCategoryExtraBlock(listing);
    const isTaxi = isTaxiBiz(listing);
    const target =
      /法人|団体|B2B/i.test(getSearchBlob(listing)) ? "法人・団体" : "法人・個人";
    const rows = isTaxi
      ? [
          {
            icon: "📍",
            label: "対応エリア",
            value: block.taxi_area_type || listing.service_area,
          },
          {
            icon: "🚗",
            label: "対応車種",
            value: formatDisplayText(block.vehicle_types, "vehicle_types"),
          },
          {
            icon: "💴",
            label: "料金目安",
            value:
              formatDisplayText(block.taxi_base_fare || listing.budgetLabel, "taxi_base_fare") ||
              listing.budgetLabel,
          },
          {
            icon: "👥",
            label: "乗車人数",
            value: formatDisplayText(block.taxi_capacity, "taxi_capacity"),
          },
          {
            icon: "📅",
            label: "予約",
            value: formatExtraValue(
              block.reservation_support,
              "support",
              "taxi_reservation_available"
            ),
          },
        ]
      : [
          { icon: "📍", label: "対応地域", value: listing.service_area },
          { icon: "🏢", label: "対象", value: target },
          { icon: "🔧", label: "カテゴリ", value: listing.categoryLabel },
          { icon: "👥", label: "対応人数", value: listing.headcountText },
          {
            icon: "📅",
            label: "最短対応",
            value: listing.startDateText || (listing.isStartSoon ? "即日〜" : "要相談"),
          },
        ];
    const filtered = rows.filter((r) => r.value && r.value !== "—");

    el.innerHTML = filtered
      .map(
        (r) =>
          `<li class="biz-detail-quick__item"><span class="biz-detail-quick__icon" aria-hidden="true">${r.icon}</span><span><span class="biz-detail-quick__label">${escapeHtml(r.label)}</span>${escapeHtml(r.value)}</span></li>`
      )
      .join("");
  }

  function relocateStoreShopGalleryNav() {
    const galleryEl = document.querySelector("[data-biz-detail-gallery]");
    const prevBtn = document.querySelector("[data-biz-detail-gallery-prev]");
    const nextBtn = document.querySelector("[data-biz-detail-gallery-next]");
    const track = galleryEl?.querySelector(".biz-detail-store-gallery__track");
    if (!galleryEl || !track || !prevBtn || !nextBtn) return;

    galleryEl.classList.add("biz-detail-store-gallery");
    galleryEl.insertBefore(prevBtn, track);
    galleryEl.appendChild(nextBtn);
    prevBtn.classList.add("biz-detail-gallery-nav--store-thumb");
    nextBtn.classList.add("biz-detail-gallery-nav--store-thumb");
  }

  function setGalleryIndex(index) {
    const urls = galleryState.urls;
    if (!urls.length) return;
    const i = ((index % urls.length) + urls.length) % urls.length;
    galleryState.index = i;
    const heroImg = document.querySelector("[data-biz-detail-hero-img]");
    const galleryEl = document.querySelector("[data-biz-detail-gallery]");
    if (heroImg) heroImg.src = urls[i];
    if (galleryEl) {
      galleryEl.querySelectorAll("[data-biz-detail-thumb]").forEach((btn) => {
        const idx = Number(btn.dataset.index);
        btn.classList.toggle("is-active", Number.isFinite(idx) && idx === i);
      });
    }
  }

  function buildWorkCaseImageHtml(listing, index) {
    const url = workCaseImageAt(listing, index);
    if (url) {
      return `<div class="biz-detail-case__img"><img class="biz-detail-case-card-image case-card-image" src="${escapeAttr(url)}" alt="" loading="lazy" decoding="async"></div>`;
    }
    return `<div class="biz-detail-case__img biz-detail-case__img--empty" aria-hidden="true"></div>`;
  }

  function buildWorkCaseCardHtml(c, listing, index) {
    const periodLabel = workCasePeriodLabel(listing);
    const imgHtml = buildWorkCaseImageHtml(listing, index);
    const metaParts = [
      c.content
        ? `<p class="biz-detail-case__content"><span class="biz-detail-case__meta-label">対応内容</span>${escapeHtml(c.content)}</p>`
        : "",
      c.region
        ? `<p class="biz-detail-case__meta"><span class="biz-detail-case__meta-label">地域</span>${escapeHtml(c.region)}</p>`
        : "",
      c.period
        ? `<p class="biz-detail-case__meta"><span class="biz-detail-case__meta-label">${escapeHtml(periodLabel)}</span>${escapeHtml(c.period)}</p>`
        : "",
      c.cost
        ? `<p class="biz-detail-case__meta biz-detail-case__meta--price"><span class="biz-detail-case__meta-label">費用</span>${escapeHtml(c.cost)}</p>`
        : "",
    ].filter(Boolean);
    const noteHtml = c.note
      ? `<p class="biz-detail-case__note">${escapeHtml(c.note)}</p>`
      : "";
    return `<article class="biz-detail-case biz-detail-case--work-grid">${imgHtml}<div class="biz-detail-case__body"><h3 class="biz-detail-case__title">${escapeHtml(c.title)}</h3>${metaParts.join("")}${noteHtml}</div></article>`;
  }

  function renderHeroWorkCases(listing, cases, images, heroImg, heroFigure) {
    const mediaEl = document.querySelector(".biz-detail-fv__media");
    const workCasesEl = document.querySelector("[data-biz-detail-hero-work-cases]");
    const emptyEl = document.querySelector("[data-biz-detail-hero-work-cases-empty]");
    const galleryEl = document.querySelector("[data-biz-detail-gallery]");
    const prevBtn = document.querySelector("[data-biz-detail-gallery-prev]");
    const nextBtn = document.querySelector("[data-biz-detail-gallery-next]");

    if (mediaEl) {
      mediaEl.classList.add("biz-detail-fv__media--work-cases");
    }

    if (!cases.length) {
      if (workCasesEl) {
        workCasesEl.hidden = true;
        workCasesEl.innerHTML = "";
      }
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "実績情報は準備中です";
      }
      renderGallery(images, heroImg, heroFigure);
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (galleryEl) {
      galleryEl.hidden = true;
      galleryEl.innerHTML = "";
    }

    const caseImages = cases.map((c) => String(c.image_url || "").trim()).filter(Boolean);
    galleryState = { urls: caseImages, index: 0 };

    const heroSrc = caseImages[0] || "";
    if (heroFigure) {
      heroFigure.classList.toggle("is-placeholder", !heroSrc);
      heroFigure.classList.toggle("is-work-case-empty", !heroSrc);
    }
    if (heroImg) {
      if (heroSrc) {
        heroImg.src = heroSrc;
        heroImg.alt = cases[0]?.title || listing.company_name || "";
      } else {
        heroImg.removeAttribute("src");
        heroImg.alt = "";
      }
    }

    const showNav = galleryState.urls.length > 1;
    if (prevBtn) {
      prevBtn.hidden = !showNav;
      prevBtn.onclick = () => setGalleryIndex(galleryState.index - 1);
    }
    if (nextBtn) {
      nextBtn.hidden = !showNav;
      nextBtn.onclick = () => setGalleryIndex(galleryState.index + 1);
    }

    if (!workCasesEl) return;
    workCasesEl.hidden = false;
    workCasesEl.innerHTML = cases
      .slice(0, 4)
      .map((c, index) => buildWorkCaseCardHtml(c, listing, "hero", index))
      .join("");

    workCasesEl.querySelectorAll("[data-work-case-index]").forEach((card, idx) => {
      card.addEventListener("click", () => {
        const url = card.dataset.imageUrl || galleryState.urls[idx];
        if (!url) return;
        const imageIndex = galleryState.urls.indexOf(url);
        setGalleryIndex(imageIndex >= 0 ? imageIndex : idx);
        workCasesEl.querySelectorAll(".biz-detail-case--hero-work").forEach((el, i) => {
          el.classList.toggle("is-active", i === idx);
        });
      });
      if (idx === 0) card.classList.add("is-active");
    });
  }

  function renderHeroMedia(listing, images, heroImg, heroFigure) {
    const mediaEl = document.querySelector(".biz-detail-fv__media");
    if (mediaEl) mediaEl.classList.remove("biz-detail-fv__media--work-cases");
    const emptyEl = document.querySelector("[data-biz-detail-hero-work-cases-empty]");
    const workCasesEl = document.querySelector("[data-biz-detail-hero-work-cases]");
    if (emptyEl) emptyEl.hidden = true;
    if (workCasesEl) {
      workCasesEl.hidden = true;
      workCasesEl.innerHTML = "";
    }
    renderGallery(images, heroImg, heroFigure, listing);
  }

  function renderGallery(images, heroImg, heroFigure, listing) {
    const galleryEl = document.querySelector("[data-biz-detail-gallery]");
    const prevBtn = document.querySelector("[data-biz-detail-gallery-prev]");
    const nextBtn = document.querySelector("[data-biz-detail-gallery-next]");
    const isStoreShop = listing && isShopDetail(listing);
    const isWork = listing && usesWorkCasesProfile(listing) && !isStoreShop;
    const subImages = isWork ? resolveSubImages(listing) : [];
    const heroUrls = images.length ? images : [];
    const thumbUrls = isWork && subImages.length ? subImages : heroUrls;

    galleryState = { urls: heroUrls, index: 0 };

    if (!heroUrls.length) {
      if (galleryEl) galleryEl.hidden = true;
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      if (heroFigure) heroFigure.classList.add("is-placeholder");
      if (heroImg) {
        heroImg.src = buildPlaceholderUrl(
          document.querySelector("[data-biz-detail-company]")?.textContent
        );
        heroImg.alt = "";
      }
      return;
    }

    if (heroFigure) {
      heroFigure.classList.remove("is-placeholder", "is-work-case-empty");
    }
    if (heroImg) {
      heroImg.src = heroUrls[galleryState.index] || heroUrls[0];
      heroImg.alt = document.querySelector("[data-biz-detail-company]")?.textContent || "";
      if (isStoreShop) heroImg.classList.add("shop-main-image", "main-image", "biz-detail-main-image");
    }

    const showNav = heroUrls.length > 1;
    if (prevBtn) {
      prevBtn.hidden = !showNav;
      prevBtn.onclick = () => setGalleryIndex(galleryState.index - 1);
    }
    if (nextBtn) {
      nextBtn.hidden = !showNav;
      nextBtn.onclick = () => setGalleryIndex(galleryState.index + 1);
    }

    if (!galleryEl) return;

    if (!thumbUrls.length) {
      galleryEl.hidden = true;
      return;
    }

    const maxThumbs = isWork ? WORK_CASE_PHOTOS_MAX : isStoreShop ? 4 : 5;
    const thumbs = thumbUrls
      .filter((url) => url && !isGenericHeroImageUrl(url))
      .slice(0, maxThumbs);
    const more = isStoreShop ? 0 : thumbUrls.length - maxThumbs;

    if (!thumbs.length) {
      galleryEl.hidden = true;
      galleryEl.innerHTML = "";
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      return;
    }

    galleryEl.hidden = false;
    galleryEl.className = isStoreShop
      ? "biz-detail-gallery hero-thumbnails biz-detail-store-gallery shop-gallery-thumbs"
      : "biz-detail-gallery hero-thumbnails";
    galleryEl.innerHTML = `<div class="hero-thumbnails biz-detail-store-gallery__track thumbnail-list">${thumbs
      .map((url, i) => {
        const heroIndex = heroUrls.indexOf(url);
        const active = isWork
          ? heroIndex >= 0 && galleryState.index === heroIndex
          : i === galleryState.index || (heroIndex >= 0 && galleryState.index === heroIndex);
        const thumbClass = isStoreShop
          ? `biz-detail-gallery__thumb thumbnail shop-thumb${active ? " is-active" : ""}`
          : `biz-detail-gallery__thumb${active ? " is-active" : ""}`;
        return `<button type="button" class="${thumbClass}" data-biz-detail-thumb data-url="${escapeAttr(url)}" data-index="${heroIndex >= 0 ? heroIndex : i}"><img src="${escapeAttr(url)}" alt="" loading="lazy" decoding="async" onerror="this.closest('button')?.remove()"></button>`;
      })
      .join("")}${
      more > 0
        ? `<a class="biz-detail-gallery__more" href="#section-achievements">他の画像を見る（${thumbUrls.length}枚）</a>`
        : ""
    }</div>`;

    if (isStoreShop) {
      relocateStoreShopGalleryNav();
      if (prevBtn) prevBtn.hidden = false;
      if (nextBtn) nextBtn.hidden = false;
    }

    galleryEl.querySelectorAll("[data-biz-detail-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        setGalleryIndex(Number.isFinite(idx) && idx >= 0 ? idx : 0);
      });
    });
  }

  function renderStrengths(listing) {
    const section = document.getElementById("section-strengths");
    const host = document.querySelector("[data-biz-detail-strengths]");
    const lead = document.querySelector("[data-biz-detail-strengths-lead]");
    const titleEl = document.querySelector("[data-biz-detail-strengths-title]");
    const cards = buildStrengthCards(listing);
    const isTaxi = isTaxiBiz(listing);
    if (!host || !section) return;

    const isRepair = isRepairBiz(listing);
    const isCleaning = isCleaningBiz(listing);
    const isStore = isStoreFieldBiz(listing);
    const isFieldService = isFieldServiceUiBiz(listing);
    if (titleEl) {
      titleEl.textContent = isTaxi
        ? "サービスの特徴"
        : isFieldService
          ? "このサービスの特徴"
          : isStore
            ? "このお店の特徴"
            : "この事業者の強み";
    }
    if (lead) {
      lead.textContent = isTaxi
        ? "空港送迎・法人送迎など、選ばれる理由をわかりやすくまとめました。"
        : isFieldService
          ? "即日対応・出張作業・見積無料など、選ばれる理由をわかりやすくまとめました。"
          : isRepair
            ? "緊急対応・出張修理など、選ばれる理由をわかりやすくまとめました。"
            : isCleaning
              ? "清潔な仕上がりと丁寧な対応など、選ばれる理由をわかりやすくまとめました。"
              : isStore
                ? "地域の専門ショップとして選ばれる理由をわかりやすくまとめました。"
                : isConstructionBiz(listing)
                  ? "法人向けに選ばれる理由を、わかりやすくまとめました。"
                  : "サービスの特徴をわかりやすくまとめました。";
    }

    section.classList.toggle("biz-detail-panel--taxi-features", isTaxi);
    host.classList.toggle("biz-detail-strengths--taxi", isTaxi);
    host.classList.toggle("biz-detail-strengths--repair", isRepair);
    host.classList.toggle("biz-detail-strengths--cleaning", isCleaning);
    host.classList.toggle("biz-detail-strengths--store", isStore);
    host.classList.toggle("biz-detail-strengths--field-service", isFieldService);
    section.classList.toggle("field-service-features", isFieldService);

    if (isStore && document.body.classList.contains("biz-detail-page--store-shop")) {
      section.classList.add(
        "shop-features-section",
        "store-features-section",
        "biz-features-section"
      );
      if (titleEl) titleEl.classList.add("shop-section-title", "features-title");
      if (lead) lead.classList.add("shop-features-lead");
      host.classList.add("features-grid");
      const scrollWrap = section.querySelector(".biz-detail-strengths-scroll-wrap");
      if (scrollWrap) scrollWrap.classList.add("features-grid-wrap");
      host.innerHTML = cards
        .map(
          (c) =>
            `<article class="biz-detail-strength biz-detail-strength--shop-card">
              ${shopStrengthIconHtml(c.iconKey)}
              <h3 class="biz-detail-strength__title">${escapeHtml(c.title)}</h3>
              <p class="biz-detail-strength__desc">${escapeHtml(c.desc)}</p>
            </article>`
        )
        .join("");
    } else if (isFieldService) {
      host.classList.add("field-service-features__grid");
      host.innerHTML = cards
        .map(
          (c) =>
            `<article class="biz-detail-strength biz-detail-strength--premium biz-detail-strength--field-service"><span class="biz-detail-strength__icon" aria-hidden="true">${c.icon}</span><h3 class="biz-detail-strength__title">${escapeHtml(c.title)}</h3><p class="biz-detail-strength__desc">${escapeHtml(c.desc)}</p></article>`
        )
        .join("");
    } else {
      host.innerHTML = cards
        .map(
          (c) =>
            `<article class="biz-detail-strength biz-detail-strength--premium"><span class="biz-detail-strength__icon" aria-hidden="true">${c.icon}</span><h3 class="biz-detail-strength__title">${escapeHtml(c.title)}</h3><p class="biz-detail-strength__desc">${escapeHtml(c.desc)}</p></article>`
        )
        .join("");
    }
    setPanelVisibility(section, cards.length > 0);
  }

  function renderBookingTypeTags(listing) {
    const wrap = document.querySelector("[data-biz-detail-booking-types]");
    if (!wrap) return;
    if (!isTaxiBiz(listing)) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    const types = pickTaxiBookingTypes(listing);
    if (!types.length) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML = types
      .map(
        (label) =>
          `<span class="biz-detail-booking-tag">${escapeHtml(label)}</span>`
      )
      .join("");
  }

  function normalizeTaxiBookingTypes(raw) {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    const text = String(raw).trim();
    if (!text) return [];
    return text
      .split(/[,、]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  /** 予約タイプ：トップレベル列 → category_extra */
  function pickTaxiBookingTypes(listing) {
    const top = normalizeTaxiBookingTypes(listing?.taxi_booking_types);
    if (top.length) return top;
    const extra = listing?.category_extra?.taxi;
    if (extra && typeof extra === "object") {
      return normalizeTaxiBookingTypes(extra.booking_types);
    }
    return normalizeTaxiBookingTypes(getCategoryExtraBlock(listing).booking_types);
  }

  function pickTaxiAreaTags(listing) {
    const block = getCategoryExtraBlock(listing);
    const areas = new Set();
    splitListText(block.taxi_area_type || listing.taxi_area_type).forEach((a) => {
      const label = formatDisplayText(a, "taxi_area_type");
      if (label) areas.add(label);
    });
    splitListText(listing.service_area).forEach((a) => {
      const label = formatDisplayText(a, "service_area");
      if (label) areas.add(label);
    });
    return [...areas].slice(0, 12);
  }

  function sanitizeTaxiDisplayText(text) {
    let s = String(text ?? "").trim();
    if (!s) return "";
    return s
      .replace(/施工事例/g, "送迎ルート・料金例")
      .replace(/施工/g, "送迎")
      .replace(/工事/g, "送迎")
      .replace(/工期/g, "所要時間")
      .replace(/作業員/g, "ドライバー")
      .replace(/作業/g, "送迎")
      .replace(/応募/g, "問い合わせ")
      .replace(/募集/g, "受付")
      .replace(/対応可能人数/g, "乗車人数");
  }

  const TAXI_CORE_SERVICE_LABELS = ["空港送迎", "法人送迎", "予約送迎", "深夜送迎"];

  function hasTaxiServiceKeyword(listing, block, keyword) {
    const hay = [
      block.taxi_services,
      listing.title,
      listing.description,
      ...(pickTaxiBookingTypes(listing) || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(keyword.toLowerCase());
  }

  /** 対応内容：本文用のサービス一覧 */
  function pickTaxiServiceItems(listing) {
    const block = getCategoryExtraBlock(listing);
    const items = [];
    const seen = new Set();

    function add(label) {
      const text = sanitizeTaxiDisplayText(String(label || "").trim());
      if (!text || seen.has(text)) return;
      seen.add(text);
      items.push(text);
    }

    if (taxiSupportYes(block.airport_transfer) || hasTaxiServiceKeyword(listing, block, "空港")) {
      add("空港送迎");
    }
    if (taxiSupportYes(block.corporate_contract) || hasTaxiServiceKeyword(listing, block, "法人")) {
      add("法人送迎");
    }
    if (taxiSupportYes(block.reservation_support) || hasTaxiServiceKeyword(listing, block, "予約")) {
      add("予約送迎");
    }
    if (
      taxiSupportYes(block.support_24h) ||
      block.taxi_night_fare ||
      hasTaxiServiceKeyword(listing, block, "深夜")
    ) {
      add("深夜送迎");
    }

    splitListText(block.taxi_services).forEach((part) => {
      const label = formatDisplayText(part, "taxi_services");
      if (!label || TAXI_CORE_SERVICE_LABELS.includes(label)) return;
      if (!isTaxiCoverageDuplicateTag(label, seen)) add(label);
    });

    return items;
  }

  function buildTaxiServiceSentence(items) {
    if (!items.length) return "";
    return `${items.join("・")}に対応しています。`;
  }

  function pickTaxiVehicleLabels(listing) {
    const block = getCategoryExtraBlock(listing);
    const labels = [];
    const seen = new Set();
    splitListText(block.vehicle_types).forEach((part) => {
      const label = sanitizeTaxiDisplayText(formatDisplayText(part, "vehicle_types"));
      if (!label || seen.has(label)) return;
      seen.add(label);
      labels.push(label);
    });
    return labels;
  }

  function pickTaxiAreaLabels(listing) {
    return pickTaxiAreaTags(listing);
  }

  /** 対応内容：予約種別など、特徴カードと重複しない補足タグのみ */
  function pickTaxiCoverageExtraTags(listing) {
    const tags = [];
    const seen = new Set();
    const serviceSeen = new Set(pickTaxiServiceItems(listing));
    const featureTitles = new Set(
      buildTaxiFeatureCards(listing).map((c) => c.title.replace(/対応$/, "").trim())
    );

    function add(label) {
      const text = sanitizeTaxiDisplayText(String(label || "").trim());
      if (!text || seen.has(text) || serviceSeen.has(text)) return;
      if (TAXI_CORE_SERVICE_LABELS.includes(text)) return;
      if ([...featureTitles].some((t) => text.includes(t) || t.includes(text))) return;
      if (isTaxiCoverageDuplicateTag(text, seen)) return;
      seen.add(text);
      tags.push(text);
    }

    pickTaxiBookingTypes(listing).forEach((bt) => {
      if (!TAXI_CORE_SERVICE_LABELS.includes(bt)) add(bt);
    });

    return tags.slice(0, 4);
  }

  function collectTaxiCoverageDedupeKeys(listing) {
    return [
      ...pickTaxiServiceItems(listing),
      ...pickTaxiVehicleLabels(listing),
      ...pickTaxiAreaLabels(listing),
      ...pickTaxiCoverageExtraTags(listing),
    ];
  }

  function renderTaxiCoverageSection(listing) {
    const section = document.getElementById("section-coverage");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    const servicesEl = document.querySelector("[data-biz-detail-coverage-services]");
    const vehiclesRow = document.querySelector("[data-biz-detail-coverage-vehicles]");
    const vehiclesVal = document.querySelector("[data-biz-detail-coverage-vehicles-value]");
    const areasRow = document.querySelector("[data-biz-detail-coverage-areas]");
    const areasVal = document.querySelector("[data-biz-detail-coverage-areas-value]");
    const extrasWrap = document.querySelector("[data-biz-detail-coverage-extras-wrap]");
    const extrasHost = document.querySelector("[data-biz-detail-coverage-extra-tags]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const gridHost = document.querySelector("[data-biz-detail-coverage-pills]");

    if (lead) lead.hidden = true;
    if (gridHost) {
      gridHost.hidden = true;
      gridHost.innerHTML = "";
      gridHost.classList.remove("biz-detail-coverage-tags");
    }
    if (taxiWrap) taxiWrap.hidden = false;

    const services = pickTaxiServiceItems(listing);
    const vehicles = pickTaxiVehicleLabels(listing);
    const areas = pickTaxiAreaLabels(listing);
    const extras = pickTaxiCoverageExtraTags(listing);
    const sentence = buildTaxiServiceSentence(services);

    if (servicesEl) {
      if (sentence) {
        servicesEl.hidden = false;
        servicesEl.textContent = sentence;
      } else {
        servicesEl.hidden = true;
        servicesEl.textContent = "";
      }
    }

    if (vehiclesRow && vehiclesVal) {
      if (vehicles.length) {
        vehiclesRow.hidden = false;
        vehiclesVal.textContent = vehicles.join(" / ");
      } else {
        vehiclesRow.hidden = true;
        vehiclesVal.textContent = "";
      }
    }

    if (areasRow && areasVal) {
      if (areas.length) {
        areasRow.hidden = false;
        areasVal.textContent = areas.join(" / ");
      } else {
        areasRow.hidden = true;
        areasVal.textContent = "";
      }
    }

    if (extrasWrap && extrasHost) {
      if (extras.length) {
        extrasWrap.hidden = false;
        extrasHost.innerHTML = extras
          .map((t) => `<span class="biz-detail-coverage-tag">${escapeHtml(t)}</span>`)
          .join("");
      } else {
        extrasWrap.hidden = true;
        extrasHost.innerHTML = "";
      }
    }

    const hasContent =
      Boolean(sentence) || vehicles.length > 0 || areas.length > 0 || extras.length > 0;
    setPanelVisibility(section, hasContent);
  }

  function buildTaxiSidebarBadges(listing) {
    const block = getCategoryExtraBlock(listing);
    const badges = [];
    if (taxiSupportYes(block.airport_transfer)) {
      badges.push({ label: "空港送迎対応", mod: "airport" });
    }
    if (taxiSupportYes(block.reservation_support)) {
      badges.push({ label: "予約対応", mod: "reservation" });
    }
    if (taxiSupportYes(block.support_24h) || block.taxi_night_fare) {
      badges.push({ label: "深夜対応", mod: "night" });
    }
    if (taxiSupportYes(block.corporate_contract)) {
      badges.push({ label: "法人契約対応", mod: "corporate" });
    }
    return badges;
  }

  function pickTaxiSidebarPriceText(listing) {
    const parts = pickTaxiSidebarPriceParts(listing);
    if (parts.route && parts.price) {
      return `${parts.route}　${parts.price}`;
    }
    return parts.price || parts.route || "要相談";
  }

  function pickTaxiSidebarPriceParts(listing) {
    const block = getCategoryExtraBlock(listing);
    const routes = String(block.taxi_route_price || listing.taxi_route_price || "").trim();
    if (routes) {
      const firstLine = routes.split(/\n+/).find(Boolean) || "";
      const parsed = parseTaxiRouteCaseDisplay(firstLine);
      if (parsed?.route && parsed?.price) {
        return { route: parsed.route, price: parsed.price };
      }
      const m = firstLine.match(/^(.+?)[→\-\|｜—－]+(.+?)(?:[:：]\s*|\s+)([\d,¥円〜~]+.*)$/);
      if (m) {
        return {
          route: `${m[1].trim()} → ${m[2].trim()}`,
          price: sanitizeTaxiDisplayText(m[3].trim()),
        };
      }
      return { route: sanitizeTaxiDisplayText(firstLine), price: "" };
    }
    const price =
      formatDisplayText(
        block.taxi_base_fare || listing.taxi_base_fare || listing.budgetLabel,
        "taxi_base_fare"
      ) || "要相談";
    return { route: "", price: sanitizeTaxiDisplayText(price) };
  }

  function buildTaxiSidebarCtasHtml(listing, ctas) {
    const secondary = getDetailSecondaryCtaLabel(listing);
    return [
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--inquiry-main" data-biz-detail-inquiry><span class="biz-detail-btn__icon" aria-hidden="true">📞</span><span>${escapeHtml(ctas.primaryLabel || "お問い合わせる")}</span></a>`,
      `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--taxi-outline" data-biz-detail-estimate><span class="biz-detail-btn__icon" aria-hidden="true">📅</span><span>${escapeHtml(secondary)}</span></a>`,
      `<button type="button" class="biz-detail-btn biz-detail-btn--outline biz-detail-btn--taxi-favorite" data-biz-detail-favorite aria-label="お気に入りに追加"><span class="biz-detail-btn__icon" aria-hidden="true">♡</span><span>お気に入りに追加</span></button>`,
    ].join("");
  }

  function buildTaxiSidebarLinksHtml(listing, ctas) {
    const hp = String(listing.hp_url || "").trim();
    const map = String(listing.google_map_url || "").trim();
    if (!hp && !map) return "";

    const links = [];
    if (hp) {
      links.push(
        `<a href="${escapeAttr(hp)}" class="biz-detail-fv-taxi-link" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subHpLabel || "HPを見る")}</a>`
      );
    }
    if (map) {
      links.push(
        `<a href="${escapeAttr(map)}" class="biz-detail-fv-taxi-link" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subMapLabel || "GoogleMapを見る")}</a>`
      );
    }
    const sep = '<span class="biz-detail-fv-taxi-links__sep" aria-hidden="true">｜</span>';
    return links.join(sep);
  }

  function buildTaxiInfoItemHtml(icon, value) {
    return `<li class="biz-detail-fv-taxi-info__item"><span class="biz-detail-fv-taxi-info__icon" aria-hidden="true">${icon}</span><span class="biz-detail-fv-taxi-info__value">${escapeHtml(value)}</span></li>`;
  }

  function renderTaxiSidebarInfo(listing) {
    const wrap = document.querySelector("[data-biz-detail-sidebar-taxi-info]");
    const leftCol = document.querySelector("[data-biz-detail-sidebar-taxi-info-left]");
    const rightCol = document.querySelector("[data-biz-detail-sidebar-taxi-info-right]");
    if (!wrap || !leftCol || !rightCol) return;

    const block = getCategoryExtraBlock(listing);
    const capacity =
      formatDisplayText(block.taxi_capacity, "taxi_capacity") || "1〜6名";
    const areaRaw = String(block.taxi_area_type || listing.service_area || "").trim();
    const area = sanitizeTaxiDisplayText(
      areaRaw.length > 28 ? areaRaw.replace(/、/g, "・").split("・").slice(0, 3).join("・") : areaRaw
    );
    const hours = sanitizeTaxiDisplayText(
      String(listing.business_hours || "").trim() || "24時間対応"
    );
    const phone = sanitizeTaxiDisplayText(String(listing.phone || "").trim());

    const leftParts = [];
    const rightParts = [];
    if (phone && phone !== "—") leftParts.push(buildTaxiInfoItemHtml("📞", phone));
    if (area && area !== "—") leftParts.push(buildTaxiInfoItemHtml("📍", area));
    if (hours && hours !== "—") rightParts.push(buildTaxiInfoItemHtml("🕐", hours));
    if (capacity && capacity !== "—") rightParts.push(buildTaxiInfoItemHtml("👥", capacity));

    leftCol.innerHTML = leftParts.join("");
    rightCol.innerHTML = rightParts.join("");
    wrap.hidden = !(leftParts.length || rightParts.length);
  }

  function parseTaxiRouteCaseDisplay(chunk) {
    const line = String(chunk || "").replace(/\n/g, " ").trim();
    if (!line) return null;
    let route = line;
    let price = "";
    const arrowMatch = line.match(/^(.+?)\s*[→\-\|｜—－]+\s*(.+?)(?:\s*[:：]\s*|\s+)([\d,¥円〜~]+.*)$/);
    if (arrowMatch) {
      route = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
      price = arrowMatch[3].trim();
    } else {
      const costInline = line.match(/(?:料金|費用)\s*[：:]\s*(.+)$/);
      if (costInline) {
        price = costInline[1].trim();
        route = line.replace(/(?:料金|費用)\s*[：:].*$/, "").trim();
      }
    }
    route = route
      .replace(/費用\s*[：:].*$/, "")
      .replace(/料金\s*[：:].*$/, "")
      .trim();
    return { route: sanitizeTaxiDisplayText(route), price: sanitizeTaxiDisplayText(price) };
  }

  function renderCoveragePills(listing) {
    const section = document.getElementById("section-coverage");
    const host = document.querySelector("[data-biz-detail-coverage-pills]");
    const lead = document.querySelector("[data-biz-detail-coverage-lead]");
    const bookingWrap = document.querySelector("[data-biz-detail-booking-types]");
    const taxiWrap = document.querySelector("[data-biz-detail-coverage-taxi]");
    const isTaxi = isTaxiBiz(listing);

    if (bookingWrap) {
      bookingWrap.hidden = true;
      bookingWrap.innerHTML = "";
    }

    if (isTaxi) {
      renderTaxiCoverageSection(listing);
      return;
    }

    if (isRepairBiz(listing)) {
      renderRepairCoverageSection(listing);
      return;
    }

    if (isFieldServiceUiBiz(listing)) {
      renderFieldServiceCoverageSection(listing);
      return;
    }

    if (isCleaningBiz(listing)) {
      renderCleaningCoverageSection(listing);
      return;
    }

    if (isStoreFieldBiz(listing)) {
      renderStoreCoverageSection(listing);
      return;
    }

    if (taxiWrap) taxiWrap.hidden = true;
    if (lead) lead.hidden = false;

    const pills = pickCoveragePills(listing);
    renderBookingTypeTags(listing);

    if (host) {
      host.hidden = false;
      host.classList.add("biz-detail-service-grid");
      host.classList.remove("biz-detail-coverage-tags");
    }

    if (lead) {
      const summary = truncateText(
        listing.boardCoverageShort || listing.serviceSummary || "",
        72
      );
      lead.textContent = summary
        ? summary
        : "対応可能な工事・サービス内容を一覧でご確認いただけます。";
    }

    if (host) {
      host.innerHTML = pills
        .map((p, i) => {
          const icon = SERVICE_ITEM_ICONS[i % SERVICE_ITEM_ICONS.length];
          return `<div class="biz-detail-service-item"><span class="biz-detail-service-item__icon" aria-hidden="true">${icon}</span><span class="biz-detail-service-item__label">${escapeHtml(p)}</span></div>`;
        })
        .join("");
    }
    setPanelVisibility(section, pills.length > 0);
  }

  function renderProperties(listing) {
    const section = document.getElementById("section-properties");
    const host = document.querySelector("[data-biz-detail-properties]");
    const types = pickPropertyTypes(listing);
    if (!section || !host) return;

    if (!types.length) {
      setPanelVisibility(section, false);
      return;
    }

    const blob = getSearchBlob(listing);
    host.innerHTML = types
      .map((pt) => {
        const active = pt.keywords.some((kw) => blob.includes(kw.toLowerCase()));
        return `<div class="biz-detail-property${active ? " is-active" : ""}"><span class="biz-detail-property__icon" aria-hidden="true">${pt.icon}</span><span class="biz-detail-property__label">${escapeHtml(pt.label)}</span></div>`;
      })
      .join("");
    setPanelVisibility(section, true);
  }

  function renderCaseStudies(listing, images) {
    const section = document.getElementById("section-achievements");
    const host = document.querySelector("[data-biz-detail-cases]");
    const moreEl = document.querySelector("[data-biz-detail-cases-more]");
    const cases = parseCaseStudies(listing, images);
    const titleEl = section?.querySelector(".biz-detail-panel__title");

    if (titleEl) {
      titleEl.textContent = isFieldServiceUiBiz(listing)
        ? "実績・事例"
        : isConstructionBiz(listing)
          ? "施工実績・事例"
          : isTaxiBiz(listing)
            ? "送迎ルート・料金例"
            : isRepairBiz(listing)
              ? "修理実績・事例"
              : isCleaningBiz(listing)
                ? "清掃・片付け実績"
                : isStoreFieldBiz(listing)
                  ? "店舗対応実績"
                  : "実績・事例";
    }

    if (!host) return;

    const lead = document.querySelector("[data-biz-detail-cases-lead]");
    if (lead && isConstructionBiz(listing)) {
      lead.textContent = "法人・店舗向けの施工実績です。規模や工期の目安も掲載しています。";
    } else if (lead && isTaxiBiz(listing)) {
      lead.textContent = "主要ルートの料金目安です。詳細はお問い合わせ・予約相談ください。";
    } else if (lead && isRepairBiz(listing)) {
      lead.textContent = "代表的な修理・メンテナンス事例です。お急ぎの場合はお電話ください。";
    } else if (lead && isFieldServiceUiBiz(listing)) {
      lead.textContent =
        "作業前後の写真と作業内容・料金目安を掲載しています。お見積りは無料でご相談ください。";
    } else if (lead && isCleaningBiz(listing)) {
      lead.textContent = "ハウスクリーニング・片付け・法人清掃の事例です。作業内容と費用の目安を掲載しています。";
    } else if (lead && isStoreFieldBiz(listing)) {
      lead.textContent = "店舗・事務所・施設向けの対応事例です。";
    }

    const isTaxi = isTaxiBiz(listing);
    const isWorkGrid =
      isConstructionBiz(listing) ||
      isRepairBiz(listing) ||
      isServiceStyleDetailBiz(listing);
    host.classList.toggle("biz-detail-cases--taxi-routes", isTaxi);
    host.classList.toggle("biz-detail-cases--work-grid-layout", isWorkGrid);
    host.classList.toggle("biz-detail-cases--repair-grid", isRepairBiz(listing) && !isWorkGrid);
    host.classList.toggle(
      "biz-detail-cases--cleaning-grid",
      isCleaningBiz(listing) && !isWorkGrid
    );
    host.classList.toggle(
      "biz-detail-cases--store-grid",
      isStoreFieldBiz(listing) && !isWorkGrid
    );
    host.classList.toggle(
      "biz-detail-cases--field-service",
      isFieldServiceUiBiz(listing) && isWorkGrid
    );
    host.classList.toggle("field-service-cases__grid", isFieldServiceUiBiz(listing));

    host.innerHTML = cases
      .map((c, index) => {
        if (c.isTaxiRoute || isTaxi) {
          const priceHtml = c.cost
            ? `<p class="biz-detail-route-card__price">${escapeHtml(c.cost)}</p>`
            : `<p class="biz-detail-route-card__price biz-detail-route-card__price--consult">要相談</p>`;
          return `<article class="biz-detail-route-card"><div class="biz-detail-route-card__body"><h3 class="biz-detail-route-card__route">${escapeHtml(c.title)}</h3>${priceHtml}</div></article>`;
        }
        if (isFieldServiceUiBiz(listing)) {
          return buildFieldServiceCaseCardHtml(c, listing, index);
        }
        if (isWorkGrid) {
          return buildWorkCaseCardHtml(c, listing, index);
        }
        return buildWorkCaseCardHtml(c, listing, index);
      })
      .join("");

    if (moreEl) moreEl.hidden = cases.length < 4;
    setPanelVisibility(section, cases.length > 0);
  }

  /**
   * UI確認用デモ口コミ。company_reviews が0件のとき表示。
   * 本番切替: loadTaxiCompanyReviewBundle 内の getTaxiDemoReviewBundle() 呼び出しを外し、空表示へ。
   */
  const TAXI_DEMO_REVIEW_SUMMARY = {
    average: 4.9,
    totalCount: 256,
    breakdown: [
      { star: 5, pct: 90, count: 0 },
      { star: 4, pct: 8, count: 0 },
      { star: 3, pct: 2, count: 0 },
      { star: 2, pct: 0, count: 0 },
      { star: 1, pct: 0, count: 0 },
    ],
  };

  const TAXI_DEMO_REVIEWS = [
    {
      rating: 5,
      tags: ["空港送迎"],
      text: "成田空港送迎を利用しました。予約確認が早く、当日も時間通りで安心できました。",
      region: "千葉県",
      usage_type: "法人利用",
      date: "2026/05/12",
      date_iso: "2026-05-12",
    },
    {
      rating: 5,
      tags: ["法人利用"],
      text: "法人利用でお願いしました。請求書対応もスムーズで、車内も清潔でした。",
      region: "東京都",
      usage_type: "法人利用",
      date: "2026/05/08",
      date_iso: "2026-05-08",
    },
    {
      rating: 5,
      tags: ["深夜送迎"],
      text: "深夜送迎でしたが丁寧に対応してもらえました。荷物が多くても安心でした。",
      region: "東京都",
      usage_type: "個人利用",
      date: "2026/05/01",
      date_iso: "2026-05-01",
    },
    {
      rating: 5,
      tags: ["ゴルフ送迎"],
      text: "ゴルフ送迎で利用しました。複数人でも快適で、また利用したいです。",
      region: "埼玉県",
      usage_type: "個人利用",
      date: "2026/04/28",
      date_iso: "2026-04-28",
    },
  ];

  function getTaxiDemoReviewSamples() {
    return TAXI_DEMO_REVIEWS.map(normalizeTaxiReviewItem).filter(Boolean);
  }

  function getTaxiDemoReviewBundle() {
    return {
      reviews: getTaxiDemoReviewSamples(),
      ratingAvg: TAXI_DEMO_REVIEW_SUMMARY.average,
      reviewCount: TAXI_DEMO_REVIEW_SUMMARY.totalCount,
      breakdown: TAXI_DEMO_REVIEW_SUMMARY.breakdown,
      demoOnly: true,
      fromCompany: false,
    };
  }

  function formatReviewStarGlyphs(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "☆☆☆☆☆";
    const full = Math.min(5, Math.max(0, Math.round(n)));
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  function normalizeTaxiReviewTags(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : splitListText(raw);
    const seen = new Set();
    const out = [];
    list.forEach((item) => {
      let text = sanitizeTaxiDisplayText(String(item || "").trim());
      text = text.replace(/^依頼[：:]\s*/i, "").replace(/Live2D[^、]*/gi, "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    });
    return out.slice(0, 4);
  }

  function normalizeTaxiReviewItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const rating = Number(raw.rating ?? raw.stars ?? raw.score);
    const text = sanitizeTaxiDisplayText(
      String(raw.text || raw.comment || raw.body || "").trim()
    );
    if (!text || !Number.isFinite(rating) || rating < 1 || rating > 5) return null;

    const tags = normalizeTaxiReviewTags(raw.tags || raw.tag || raw.service_tags);
    const region = sanitizeTaxiDisplayText(String(raw.region || raw.area || "").trim());
    const usageType = sanitizeTaxiDisplayText(
      String(raw.usage_type || raw.usageType || raw.customer_type || "").trim()
    );
    const metaParts = [region, usageType].filter(Boolean);
    const meta =
      sanitizeTaxiDisplayText(String(raw.meta || "").trim()) ||
      metaParts.join(" / ");
    const date = sanitizeTaxiDisplayText(
      String(raw.date || raw.date_label || raw.published_at || "").trim()
    );
    const dateIso = String(raw.date_iso || raw.dateIso || "").trim();

    return {
      rating,
      text,
      tags,
      meta,
      date,
      dateIso,
    };
  }

  function pickEmbeddedTaxiReviews(listing) {
    const block = getCategoryExtraBlock(listing);
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const sources = [
      listing.taxi_reviews,
      listing.reviews,
      block.taxi_reviews,
      block.reviews,
      listing.category_extra?.taxi?.reviews,
      fd.taxi_reviews,
      fd.reviews,
    ];
    for (const src of sources) {
      if (!Array.isArray(src) || !src.length) continue;
      const normalized = src.map(normalizeTaxiReviewItem).filter(Boolean);
      if (normalized.length) return normalized;
    }
    return [];
  }

  /**
   * 掲載データに埋め込まれた口コミ（将来の本番フォールバック用。現在は未使用）。
   */
  function resolveTaxiReviewBundle(listing) {
    const embedded = pickEmbeddedTaxiReviews(listing);
    if (!embedded.length) {
      return { reviews: [], demoOnly: false, summary: null };
    }
    return {
      reviews: embedded,
      demoOnly: false,
      summary: null,
    };
  }

  function computeReviewBreakdown(reviews) {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Number(r.rating) || 0));
      if (star >= 1 && star <= 5) counts[star - 1] += 1;
    });
    const total = reviews.length || 1;
    return [5, 4, 3, 2, 1].map((star) => {
      const count = counts[star - 1];
      const pct = Math.round((count / total) * 100);
      return { star, pct, count };
    });
  }

  function computeReviewAverage(reviews) {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }

  function buildCompanyReviewBreakdownHtml(breakdownRows) {
    const rows = breakdownRows?.length
      ? breakdownRows
      : [5, 4, 3, 2, 1].map((star) => ({ star, pct: 0, count: 0 }));
    return rows
      .map(({ star, pct, count }) => {
        const glyphs = formatReviewStarGlyphs(star);
        const countLabel = count > 0 ? ` (${count})` : "";
        return `<div class="taxi-review-section__bar-row">
          <span class="taxi-review-section__bar-label detail-gold-stars detail-gold-stars--sm">${glyphs}</span>
          <span class="taxi-review-section__bar-track"><span class="taxi-review-section__bar-fill" style="width:${pct}%"></span></span>
          <span class="taxi-review-section__bar-pct">${pct}%${escapeHtml(countLabel)}</span>
        </div>`;
      })
      .join("");
  }

  function reviewAvatarInitial(name) {
    const n = String(name || "利").trim();
    return escapeHtml(n.charAt(0) || "利");
  }

  function buildCompanyReviewCardHtml(review) {
    const name = review.reviewer_name || "利用者";
    const tagLabel =
      (review.tags && review.tags[0]) ||
      review.service_type?.split(/[,、]/)[0]?.trim() ||
      review.title ||
      "";
    const tagHtml = tagLabel
      ? `<span class="taxi-review-section__card-tag">${escapeHtml(tagLabel)}</span>`
      : "";
    const text = escapeHtml(review.comment || review.text || "").replace(/\n/g, "<br>");
    const ratingLabel = Number.isFinite(Number(review.rating))
      ? Number(review.rating).toFixed(Number(review.rating) % 1 === 0 ? 0 : 1)
      : "";
    const dateHtml = review.date
      ? `<time class="taxi-review-section__card-date" datetime="${escapeAttr(review.date_iso || review.date)}">${escapeHtml(review.date)}</time>`
      : "";

    return `<article class="taxi-review-section__card">
      <div class="taxi-review-section__card-head">
        <span class="taxi-review-section__card-avatar" aria-hidden="true">${reviewAvatarInitial(name)}</span>
        <div class="taxi-review-section__card-identity">
          <p class="taxi-review-section__card-name">${escapeHtml(name)}</p>
          <div class="taxi-review-section__card-rating-row">
            <span class="taxi-review-section__card-stars detail-gold-stars detail-gold-stars--md">${formatReviewStarGlyphs(review.rating)}</span>
            <span class="taxi-review-section__card-rating-num">${escapeHtml(ratingLabel)}</span>
          </div>
        </div>
      </div>
      ${tagHtml}
      <p class="taxi-review-section__card-text">${text}</p>
      ${dateHtml}
    </article>`;
  }

  function pickTaxiTrackRecordItems(listing) {
    const block = getCategoryExtraBlock(listing);
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const custom = [
      listing.taxi_track_record,
      block.taxi_track_record,
      block.track_record,
      fd.taxi_track_record,
    ].find((v) => Array.isArray(v) && v.length);
    if (custom) {
      return custom
        .map((item) => sanitizeTaxiDisplayText(String(item || "").trim()))
        .filter(Boolean);
    }

    const items = [];
    if (taxiSupportYes(block.airport_transfer) || /空港/.test(String(block.taxi_services || ""))) {
      items.push("空港送迎年間2,000件以上");
    }
    if (taxiSupportYes(block.corporate_contract)) {
      items.push("法人契約30社以上");
    }
    if (taxiSupportYes(block.support_24h) || block.taxi_night_fare) {
      items.push("深夜送迎対応実績あり");
    }
    const achievements = String(listing.achievements || block.taxi_route_price || "").trim();
    if (achievements && items.length < 2) {
      items.push("主要ルートでの送迎実績あり");
    }
    return items.slice(0, 5);
  }

  function priceCardIcon(label) {
    const key = Object.keys(PRICE_CARD_ICONS).find((k) => k !== "default" && label.includes(k));
    return PRICE_CARD_ICONS[key] || PRICE_CARD_ICONS.default;
  }

  function licenseCardIcon(label) {
    return LICENSE_CARD_ICONS[label] || LICENSE_CARD_ICONS.default;
  }

  function renderTaxiPriceSummary(listing) {
    const section = document.getElementById("section-price");
    const titleEl = document.querySelector("[data-biz-detail-price-title]");
    const lead = document.querySelector("[data-biz-detail-price-lead]");
    const cardsHost = document.querySelector("[data-biz-detail-price-block]");
    const summaryHost = document.querySelector("[data-biz-detail-taxi-price-summary]");
    const block = getCategoryExtraBlock(listing);
    if (!section || !summaryHost) return;

    if (titleEl) titleEl.textContent = "料金要約";
    if (lead) {
      lead.textContent =
        "ルート・時間帯・車種により異なります。詳細は「送迎ルート・料金例」をご確認ください。";
    }
    if (cardsHost) {
      cardsHost.hidden = true;
      cardsHost.innerHTML = "";
    }

    const lines = [
      formatDisplayText(block.taxi_base_fare || listing.taxi_base_fare || listing.budgetLabel, "taxi_base_fare"),
      formatDisplayText(block.taxi_night_fare, "taxi_night_fare"),
    ].filter(Boolean);

    if (lines.length) {
      summaryHost.hidden = false;
      summaryHost.innerHTML = lines
        .map((line) => `<p class="biz-detail-taxi-price-summary__line">${escapeHtml(line)}</p>`)
        .join("");
      setPanelVisibility(section, true);
    } else {
      summaryHost.hidden = true;
      summaryHost.innerHTML = "";
      setPanelVisibility(section, false);
    }
  }

  function parseOptionItems(listing) {
    const raw = Array.isArray(listing.option_items) ? listing.option_items : [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.label || item.name || "").trim();
        const description = String(
          item.description || item.desc || item.note || ""
        ).trim();
        if (!title && !description) return null;
        return {
          title: title || "オプション",
          description,
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  function resolveListingFormData(listing) {
    const raw = listing?.form_data;
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function resolveServiceMenuItemsRaw(listing) {
    if (window.TasuListingRenderer?.pickBusinessServiceMenuItems) {
      return window.TasuListingRenderer.pickBusinessServiceMenuItems(
        listing,
        resolveListingFormData(listing)
      );
    }
    const fd = resolveListingFormData(listing);
    const serviceMenuItems =
      listing?.service_menu_items ||
      fd?.service_menu_items ||
      fd?.business_service?.menu_items ||
      [];
    if (typeof serviceMenuItems === "string") {
      try {
        const parsed = JSON.parse(serviceMenuItems);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(serviceMenuItems) ? serviceMenuItems : [];
  }

  function parseServiceMenuItems(listing) {
    const raw = resolveServiceMenuItemsRaw(listing);
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.label || item.name || "").trim();
        const price = String(item.price || item.value || item.amount || "").trim();
        const description = String(
          item.description || item.desc || item.work_content || ""
        ).trim();
        const scope = String(item.scope || item.location || item.service_location || "").trim();
        const notes = String(item.notes || item.note || "").trim();
        const duration = String(item.duration || item.time_required || "").trim();
        const location = String(item.location || item.place || "").trim();
        const image_url = trimImageUrl(
          item.image_url || item.menu_image_url || item.image || ""
        );
        if (!title && !price && !description && !notes) return null;
        return {
          title: title || "メニュー",
          price,
          description,
          scope,
          notes,
          duration,
          location,
          image_url,
        };
      })
      .filter(Boolean);
  }

  function getServiceMenuInitialLimit() {
    return window.matchMedia(SERVICE_MENU_DESKTOP_MQ).matches
      ? SERVICE_MENU_INITIAL_DESKTOP
      : SERVICE_MENU_INITIAL_MOBILE;
  }

  function buildServiceMenuCardHtml(item, index) {
    const featured = index === 0 ? " biz-detail-price-card--featured" : "";
    const priceText = item.price ? escapeHtml(item.price) : "—";
    const descHtml = item.description
      ? `<p class="biz-detail-service-menu-card__desc">${escapeHtml(item.description)}</p>`
      : "";
    return `<article class="biz-detail-price-card biz-detail-service-menu-card${featured}" data-service-menu-card>
      <div class="biz-detail-service-menu-card__inner">
        <h3 class="biz-detail-service-menu-card__title">${escapeHtml(item.title)}</h3>
        <p class="biz-detail-service-menu-card__price">${priceText}</p>
        ${descHtml}
      </div>
    </article>`;
  }

  function applyServiceMenuVisibleCount(section, host, moreWrap) {
    if (!section || !host) return;
    const cards = host.querySelectorAll("[data-service-menu-card]");
    const expanded = section.dataset.serviceMenuExpanded === "true";
    const limit = expanded ? cards.length : getServiceMenuInitialLimit();
    cards.forEach((card, index) => {
      card.hidden = !expanded && index >= limit;
    });
    if (moreWrap) {
      moreWrap.hidden = expanded || cards.length <= getServiceMenuInitialLimit();
    }
  }

  function bindServiceMenuMoreToggle(section, host, moreWrap, moreBtn) {
    if (!section || section.dataset.serviceMenuBound === "1") return;
    section.dataset.serviceMenuBound = "1";

    moreBtn?.addEventListener("click", () => {
      section.dataset.serviceMenuExpanded = "true";
      applyServiceMenuVisibleCount(section, host, moreWrap);
    });

    const mq = window.matchMedia(SERVICE_MENU_DESKTOP_MQ);
    const onMqChange = () => {
      if (section.dataset.serviceMenuExpanded === "true") return;
      applyServiceMenuVisibleCount(section, host, moreWrap);
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onMqChange);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(onMqChange);
    }
  }

  function renderServiceMenuItems(listing) {
    if (isDetailBusinessServicePage()) {
      renderBusinessServicePricingTable(listing);
      return;
    }
    const section = document.getElementById("section-service-menu");
    const host = document.querySelector("[data-biz-detail-service-menu]");
    const lead = document.querySelector("[data-biz-detail-service-menu-lead]");
    const titleEl = document.querySelector("[data-biz-detail-service-menu-title]");
    const moreWrap = document.querySelector("[data-biz-detail-service-menu-more]");
    const moreBtn = document.querySelector("[data-biz-detail-service-menu-more-btn]");
    if (!section || !host) return;

    const items = parseServiceMenuItems(listing);
    if (!items.length) {
      host.innerHTML = "";
      if (moreWrap) moreWrap.hidden = true;
      setPanelVisibility(section, false);
      return;
    }

    const isFieldService = isFieldServiceUiBiz(listing);
    if (titleEl) {
      titleEl.textContent = isFieldService ? FIELD_SERVICE_MENU_TITLE : SERVICE_MENU_SECTION_TITLE;
    }
    if (lead) {
      lead.textContent = isFieldService ? FIELD_SERVICE_MENU_LEAD : SERVICE_MENU_SECTION_LEAD;
    }

    section.dataset.serviceMenuExpanded = "false";
    host.className = isFieldService
      ? "biz-detail-price-cards biz-detail-service-menu-cards field-service-menu__cards"
      : "biz-detail-price-cards biz-detail-service-menu-cards";
    host.innerHTML = items
      .map((item, i) =>
        isFieldService
          ? buildFieldServiceServiceMenuCardHtml(item, i, listing)
          : buildServiceMenuCardHtml(item, i)
      )
      .join("");
    applyServiceMenuVisibleCount(section, host, moreWrap);
    bindServiceMenuMoreToggle(section, host, moreWrap, moreBtn);
    setPanelVisibility(section, true);
  }

  /** 旧 #section-price（固定デモ・option_items）は廃止。対応メニューは renderServiceMenuItems のみ */
  function renderPriceCards() {
    const priceSection = document.getElementById("section-price");
    const host = document.querySelector("[data-biz-detail-price-block]");
    const summaryHost = document.querySelector("[data-biz-detail-taxi-price-summary]");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
    if (summaryHost) {
      summaryHost.hidden = true;
      summaryHost.innerHTML = "";
    }
    if (priceSection) setPanelVisibility(priceSection, false);
  }

  function renderLicenseShowcase(listing) {
    const section = document.getElementById("section-license");
    const host = document.querySelector("[data-biz-detail-license]");
    const lead = document.querySelector("[data-biz-detail-license-lead]");
    const rows = parseLicenseRows(listing);
    if (!host) return;

    if (!rows.length) {
      setPanelVisibility(section, false);
      return;
    }

    if (lead) {
      lead.textContent = "許可・保険・体制について、掲載時点の情報を表示しています。";
    }

    host.innerHTML = rows
      .map((r) => {
        const icon = licenseCardIcon(r.label);
        const val = formatDisplayText(r.value, "license_info") || r.value;
        return `<article class="biz-detail-license-card"><span class="biz-detail-license-card__icon" aria-hidden="true">${icon}</span><div class="biz-detail-license-card__body"><h3 class="biz-detail-license-card__label">${escapeHtml(r.label)}</h3><p class="biz-detail-license-card__value">${escapeHtml(val)}</p></div></article>`;
      })
      .join("");
    setPanelVisibility(section, true);
  }

  function renderFaq(listing) {
    const host = document.querySelector("[data-biz-detail-faq]");
    if (!host) return;
    const items = isShopDetail(listing)
      ? buildStoreFaqItems(listing)
      : isFieldServiceUiBiz(listing)
        ? buildFieldServiceFaqItems(listing)
        : buildFaqItems(listing);
    host.innerHTML = items
      .map(
        (item) =>
          `<details class="biz-detail-faq__item"><summary>${escapeHtml(item.q)}</summary><div class="biz-detail-faq__answer"><p>${escapeHtml(item.a)}</p></div></details>`
      )
      .join("");
  }

  function renderSidebarExtras(listing) {
    const trustWrap = document.querySelector("[data-biz-detail-sidebar-trust-wrap]");
    const trustHost = document.querySelector("[data-biz-detail-sidebar-trust]");
    const supportWrap = document.querySelector("[data-biz-detail-sidebar-support-wrap]");
    const supportHost = document.querySelector("[data-biz-detail-sidebar-support]");

    const trust = buildTrustChecklist(listing);
    if (trustHost && trustWrap) {
      trustHost.innerHTML = trust.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      trustWrap.hidden = !trust.length;
    }

    const support = buildSupportChecklist(listing);
    if (supportHost && supportWrap) {
      supportHost.innerHTML = support.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      supportWrap.hidden = !support.length;
    }
  }

  function renderCategoryExtra(listing) {
    const section = document.getElementById("section-category-extra");
    const dl = document.querySelector("[data-biz-detail-category-extra]");
    const titleEl = document.querySelector("[data-biz-detail-extra-title]");
    const genericWrap = document.querySelector("[data-biz-detail-category-extra-generic]");
    if (!section || !dl) return;

    const cat = listing.business_category || "";
    if (isTaxiBiz(cat)) {
      setPanelVisibility(section, false);
      return;
    }

    if (genericWrap) genericWrap.hidden = false;

    const schemaKey = cat === "regional_service" ? "local_service" : cat;
    const block = getCategoryExtraBlock(listing);
    const schema =
      CATEGORY_EXTRA_SCHEMAS[cat] ||
      CATEGORY_EXTRA_SCHEMAS[schemaKey] ||
      [];
    const rows = schema
      .map((field) => {
        const fk = field.fieldKey || field.key;
        const value = formatExtraValue(block[field.key], field.format, fk);
        return value ? { label: field.label, value } : null;
      })
      .filter(Boolean);

    if (!rows.length) {
      setPanelVisibility(section, false);
      return;
    }

    const catLabel = listing.categoryLabel || cat;
    if (titleEl) titleEl.textContent = `${catLabel}向け情報`;
    dl.innerHTML = buildDlRows(rows);
    setPanelVisibility(section, true);
  }

  async function renderTaxiSidebar(listing, ctas) {
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const priceRouteEl = document.querySelector("[data-biz-detail-sidebar-price-route]");
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    const badgesHost = document.querySelector("[data-biz-detail-sidebar-taxi-badges]");
    const ratingWrap = document.querySelector("[data-biz-detail-sidebar-rating]");
    const ratingStars = document.querySelector("[data-biz-detail-sidebar-rating-stars]");
    const ratingScore = document.querySelector("[data-biz-detail-sidebar-rating-score]");
    const ratingCount = document.querySelector("[data-biz-detail-sidebar-rating-count]");
    const actionsHost = document.querySelector("[data-biz-detail-sidebar-actions]");
    const linksHost = document.querySelector("[data-biz-detail-sidebar-links]");
    const infoHost = document.querySelector("[data-biz-detail-sidebar-taxi-info]");
    const metaBlock = document.querySelector("[data-biz-detail-sidebar-meta-block]");

    const bundle = await loadTaxiCompanyReviewBundle(listing);
    const average = bundle.demoOnly
      ? TAXI_DEMO_REVIEW_SUMMARY.average
      : Number(bundle.ratingAvg) || computeReviewAverage(bundle.reviews);
    const totalCount = bundle.demoOnly
      ? TAXI_DEMO_REVIEW_SUMMARY.totalCount
      : Number(bundle.reviewCount) || bundle.reviews.length;

    if (ratingWrap && ratingStars) {
      ratingWrap.hidden = false;
      ratingStars.textContent = formatReviewStarGlyphs(average);
      if (ratingScore) ratingScore.textContent = average.toFixed(1);
      if (ratingCount) ratingCount.textContent = `口コミ${totalCount}件`;
    }

    const priceParts = pickTaxiSidebarPriceParts(listing);
    if (priceLabelEl) priceLabelEl.textContent = "主要ルート料金";
    if (priceRouteEl) {
      if (priceParts.route) {
        priceRouteEl.hidden = false;
        priceRouteEl.textContent = priceParts.route;
      } else {
        priceRouteEl.hidden = true;
        priceRouteEl.textContent = "";
      }
    }
    if (priceEl) {
      priceEl.textContent = priceParts.price || pickTaxiSidebarPriceText(listing);
    }

    if (badgesHost) {
      badgesHost.hidden = true;
      badgesHost.innerHTML = "";
    }

    if (actionsHost) {
      actionsHost.className = `biz-detail-sidebar__cta-group biz-detail-sidebar__cta-group--taxi ${ctas.actionsMod || ""}`.trim();
      actionsHost.dataset.businessCategory = ctas.categoryKey || "taxi";
      actionsHost.dataset.ctaScope = "detail";
      actionsHost.innerHTML = buildTaxiSidebarCtasHtml(listing, ctas);
    }

    if (linksHost) {
      linksHost.hidden = true;
      linksHost.innerHTML = "";
    }

    if (infoHost) infoHost.hidden = true;

    hideLegacyFvFavorite();

    if (metaBlock) metaBlock.hidden = true;
  }

  function renderMap(listing) {
    const section = document.getElementById("section-map");
    const wrap = document.querySelector("[data-biz-detail-map-wrap]");
    if (!section || !wrap) return;

    const mapUrl = String(listing.google_map_url || "").trim();
    const isTaxi = isTaxiBiz(listing);
    const areaTags = isTaxi ? pickTaxiAreaTags(listing) : [];

    if (!mapUrl && !areaTags.length) {
      setPanelVisibility(section, false);
      return;
    }

    let embedSrc = mapUrl;
    if (/google\.(com|co\.jp).*\/maps/i.test(mapUrl) && !mapUrl.includes("output=embed")) {
      embedSrc = mapUrl.includes("?") ? `${mapUrl}&output=embed` : `${mapUrl}?output=embed`;
    }

    const embed =
      mapUrl && shouldEmbedMapIframe() && /google\.(com|co\.jp).*\/maps/i.test(embedSrc)
        ? `<div class="biz-detail-map-embed"><iframe src="${escapeAttr(embedSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="地図"></iframe></div>`
        : "";

    const areasHtml =
      !isTaxi && areaTags.length > 0
        ? `<div class="biz-detail-map-areas"><p class="biz-detail-map-areas__label">主要対応エリア</p><div class="biz-detail-map-areas__tags">${areaTags
            .map((a) => `<span class="biz-detail-map-area-tag">${escapeHtml(a)}</span>`)
            .join("")}</div></div>`
        : isTaxi && areaTags.length > 0
          ? `<p class="biz-detail-map-areas__hint">対応エリアは上部の「対応内容」をご確認ください。</p>`
          : "";

    const mapLinkHtml =
      mapUrl && !isStoreFieldBiz(listing)
        ? `<a class="biz-detail-map-link" href="${escapeAttr(mapUrl)}" target="_blank" rel="noopener noreferrer">Google Mapで開く</a>`
        : "";

    const storeMapNote = isStoreFieldBiz(listing)
      ? `<p class="biz-detail-map-note">地図は参考表示です。ご来店・ご相談はTASFUL内のチャットからお問い合わせください。</p>`
      : "";

    wrap.innerHTML = `${areasHtml}${embed}${storeMapNote}${mapLinkHtml}`;
    setPanelVisibility(section, true);
  }

  function renderSidebarCtas(listing, ctas) {
    const host = document.querySelector("[data-biz-detail-sidebar-actions]");
    if (!host) return;

    const hp = String(listing.hp_url || "").trim();
    const map = String(listing.google_map_url || "").trim();
    const parts = [];

    parts.push(
      `<a href="${escapeAttr(getDetailInquiryAnchor(listing))}" class="${escapeAttr(ctas.primaryClass)} biz-detail-btn--inquiry-main" data-biz-detail-inquiry>${escapeHtml(ctas.primaryLabel || "問い合わせる")}</a>`
    );
    parts.push(
      `<a href="${escapeAttr(getDetailSecondaryCtaAnchor(listing))}" class="biz-detail-btn biz-detail-btn--outline" data-biz-detail-estimate>${escapeHtml(getDetailSecondaryCtaLabel(listing))}</a>`
    );
    if (hp) {
      parts.push(
        `<a href="${escapeAttr(hp)}" class="biz-detail-btn biz-detail-btn--sub" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subHpLabel || "HPを見る")}</a>`
      );
    }
    if (map) {
      parts.push(
        `<a href="${escapeAttr(map)}" class="biz-detail-btn biz-detail-btn--sub" target="_blank" rel="noopener noreferrer">${escapeHtml(ctas.subMapLabel || "GoogleMapを見る")}</a>`
      );
    }

    host.className = `biz-detail-sidebar__cta-group ${ctas.actionsMod || ""}`.trim();
    host.dataset.businessCategory = ctas.categoryKey || "";
    host.dataset.ctaScope = "detail";
    host.innerHTML = parts.join("");
  }

  function bindStickyBar(listing, ctas) {
    const bar = document.querySelector("[data-biz-detail-sticky-bar]");
    const companyEl = document.querySelector("[data-biz-detail-sticky-company]");
    const inquiryEl = document.querySelector("[data-biz-detail-sticky-inquiry]");
    const estimateEl = document.querySelector("[data-biz-detail-sticky-estimate]");

    if (companyEl) companyEl.textContent = listing.company_name || listing.title || "";
    if (inquiryEl) {
      inquiryEl.textContent = ctas.primaryLabel;
      inquiryEl.href = getDetailInquiryAnchor(listing);
    }
    if (estimateEl) {
      estimateEl.textContent = getDetailSecondaryCtaLabel(listing);
      estimateEl.href = getDetailSecondaryCtaAnchor(listing);
      estimateEl.hidden = false;
      if (isRepairBiz(listing) && inquiryEl) {
        inquiryEl.className =
          "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold";
        estimateEl.className =
          "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--repair-emergency";
      } else if (isCleaningBiz(listing) && inquiryEl) {
        inquiryEl.className =
          "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold";
        estimateEl.className =
          "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--cleaning-estimate";
      } else if (isStoreFieldBiz(listing)) {
        const aiEl = document.querySelector("[data-biz-detail-sticky-ai]");
        const stickyHint = bar?.querySelector(".biz-detail-sticky-bar__company");
        if (stickyHint) {
          stickyHint.textContent = "商品のご相談・買取査定はお気軽にどうぞ";
        }
        if (aiEl) {
          aiEl.hidden = false;
          aiEl.href = getStoreAiConsultAnchor(listing);
          aiEl.className = "biz-detail-btn biz-detail-btn--primary biz-detail-btn--store-ai";
        }
        if (inquiryEl) {
          inquiryEl.className =
            "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold";
          inquiryEl.textContent = "問い合わせる";
        }
        if (estimateEl) estimateEl.hidden = true;
      } else if (isFieldServiceUiBiz(listing)) {
        const aiEl = document.querySelector("[data-biz-detail-sticky-ai]");
        const stickyHint = bar?.querySelector(".biz-detail-sticky-bar__company");
        if (stickyHint) {
          stickyHint.textContent = "法人・業務のご相談はお気軽にどうぞ";
        }
        if (aiEl) {
          aiEl.hidden = false;
          aiEl.href = getStoreAiConsultAnchor(listing);
          aiEl.className =
            "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--field-ai";
        }
        if (inquiryEl) {
          inquiryEl.className =
            "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--field-inquiry";
          inquiryEl.textContent = "問い合わせる";
        }
        if (estimateEl) {
          estimateEl.hidden = false;
          estimateEl.className =
            "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold biz-detail-btn--field-estimate";
          estimateEl.textContent = "見積相談";
        }
      }
    }
    if (bar) {
      bar.hidden = false;
      bar.classList.toggle("biz-detail-sticky-bar--store-shop", isShopStoreBiz(listing));
      bar.classList.toggle("biz-detail-sticky-bar--field-service", isFieldServiceUiBiz(listing));
    }
  }

  function resolveBizDetailRoot() {
    return (
      document.getElementById("business-service-detail-root") ||
      document.querySelector("[data-biz-detail-root]")
    );
  }

  function shouldEmbedMapIframe() {
    if (window.location.protocol === "file:") return false;
    if (isDetailBusinessServicePage()) return false;
    return true;
  }

  async function render(listing) {
    const root = resolveBizDetailRoot();
    if (!root) return;

    try {
      await renderBusinessDetailPage(listing, root);
    } catch (err) {
      console.error("[TasuBusinessDetail] render failed:", err);
      const statusEl = document.querySelector("[data-listing-detail-status]");
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          "表示の準備中に問題が発生しました。ページを再読み込みしてください。";
      }
      root.hidden = false;
      document.body.dataset.listingLoaded = "error";
    }
  }

  async function renderBusinessDetailPage(listing, root) {
    const onShopStoreDetailPage =
      document.body?.dataset?.detailType === "shop_store" ||
      /detail-shop-store/i.test(String(window.location.pathname || ""));

    if (onShopStoreDetailPage && listing) {
      listing.business_type = "shop_store";
      if (!listing.business_category) listing.business_category = "shop_store";
    }

    if (isDetailBusinessServicePage() && listing) {
      listing.business_type = "field_service";
      if (!listing.business_category) listing.business_category = "field_service";
    }

    const cat = listing.business_category || "";
    const isFieldServiceUi = isFieldServiceUiBiz(cat) || isFieldServiceUiBiz(listing);
    document.body.classList.toggle(
      "biz-detail-page--construction",
      !isFieldServiceUi && isConstructionBiz(cat)
    );
    document.body.classList.toggle("biz-detail-page--taxi", !isFieldServiceUi && isTaxiBiz(cat));
    document.body.classList.toggle("biz-detail-page--repair", !isFieldServiceUi && isRepairBiz(cat));
    document.body.classList.toggle(
      "biz-detail-page--cleaning",
      !isFieldServiceUi && isCleaningBiz(cat)
    );
    document.body.classList.toggle(
      "biz-detail-page--field-service",
      isFieldServiceUi
    );
    document.body.classList.toggle("biz-detail-page--store", !isFieldServiceUi && isStoreFieldBiz(cat));
    document.body.classList.toggle("biz-detail-page--store-shop", isShopStoreBiz(cat) || isShopStoreBiz(listing));
    if (isShopStoreBiz(cat) || isShopStoreBiz(listing)) {
      document.body.classList.add("biz-detail-page--store-shop", "shop-detail-page");
    }

    if (isShopDetail(cat) || isShopDetail(listing)) {
      configureStoreShopPage(listing);
    } else if (isFieldServiceUi && !isDetailBusinessServicePage()) {
      configureFieldServicePage(listing);
    } else {
      document.body.classList.remove("shop-detail-page");
      const marketHeader = document.querySelector("[data-biz-detail-market-header]");
      const marketFooter = document.querySelector("[data-biz-detail-market-footer]");
      const simpleBanner = document.querySelector("[data-biz-detail-simple-banner]");
      if (marketHeader) {
        marketHeader.hidden = true;
        marketHeader.classList.remove("is-visible");
      }
      if (marketFooter) marketFooter.hidden = true;
      if (simpleBanner) {
        simpleBanner.hidden = false;
        simpleBanner.style.removeProperty("display");
      }
    }

    const fvCard = document.querySelector(".biz-detail-fv-card");
    if (fvCard) {
      fvCard.classList.toggle("biz-detail-fv-card--construction", !isFieldServiceUi && isConstructionBiz(cat));
      fvCard.classList.toggle("biz-detail-fv-card--taxi", !isFieldServiceUi && isTaxiBiz(cat));
      fvCard.classList.toggle("biz-detail-fv-card--repair", !isFieldServiceUi && isRepairBiz(cat));
      fvCard.classList.toggle("biz-detail-fv-card--cleaning", !isFieldServiceUi && isCleaningBiz(cat));
      fvCard.classList.toggle(
        "biz-detail-fv-card--field-service",
        isFieldServiceUi
      );
      fvCard.classList.toggle("biz-detail-fv-card--store", !isFieldServiceUi && isStoreFieldBiz(cat));
      fvCard.classList.toggle("biz-detail-fv-card--store-shop", isShopStoreBiz(cat) || isShopStoreBiz(listing));
    }

    const ctas = resolveDetailCtas(listing);
    const images = resolveImages(listing);
    const heroImg = document.querySelector("[data-biz-detail-hero-img]");
    const heroFigure = document.querySelector("[data-biz-detail-hero-figure]");

    if (isDetailBusinessServicePage()) {
      await renderBusinessServiceLpPage(listing, images, ctas);
      renderPriceCards(listing);
      root.hidden = false;
      document.body.dataset.listingLoaded = "true";
      document.body.dataset.listingId = listing.id || "";
      document.body.dataset.businessCategory = cat;
      const statusEl = document.querySelector("[data-listing-detail-status]");
      if (statusEl) statusEl.hidden = true;
      return;
    }

    document.title = `${listing.company_name || listing.title || "サービス詳細"} | TasuFull`;

    renderBreadcrumb(listing);

    const catchEl = document.querySelector("[data-biz-detail-title]");
    const catchcopy = isTaxiBiz(cat)
      ? buildTaxiHeroHeadline(listing)
      : isRepairBiz(cat)
        ? buildRepairHeroHeadline(listing)
        : isCleaningBiz(cat)
          ? buildCleaningHeroHeadline(listing)
          : isShopStoreBiz(listing) || isShopStoreBiz(cat)
            ? buildStoreHeroHeadline(listing)
            : isFieldServiceBiz(listing) || isFieldServiceBiz(cat)
              ? buildCleaningHeroHeadline(listing)
              : pickHeroCatchcopy(listing);

    if (!isTaxiBiz(cat) && !isRepairBiz(cat) && !isServiceStyleDetailBiz(cat)) {
      renderHeroCompanyTitleRow(listing);
      if (catchEl) {
        catchEl.dataset.catchLines = catchcopy.includes("\n") ? "2" : "1";
        if (catchcopy.includes("\n")) {
          catchEl.innerHTML = catchcopy
            .split("\n")
            .map((line) => escapeHtml(line))
            .join("<br>");
        } else {
          catchEl.textContent = catchcopy;
        }
      }
    }

    const coverageEl = document.querySelector("[data-biz-detail-coverage]");
    const descShort = truncateText(listing?.description, 100);
    if (coverageEl) {
      if (descShort && descShort !== catchcopy) {
        coverageEl.hidden = false;
        coverageEl.textContent = descShort;
      } else {
        coverageEl.hidden = true;
      }
    }

    const mainEl = document.querySelector(".biz-detail-fv__main");
    const receptionBlock = document.querySelector("[data-biz-detail-hero-reception-block]");
    const tagRow = document.querySelector("[data-biz-detail-hero-tag-row]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");

    if (isShopStoreBiz(cat) || isShopStoreBiz(listing)) {
      renderStoreHeroMain(listing);
    } else if (isFieldServiceUiBiz(cat) || isFieldServiceUiBiz(listing)) {
      renderFieldServiceHeroMain(listing);
    } else {
      if (mainEl) {
        mainEl.classList.remove("biz-detail-fv__main--taxi", "biz-detail-fv__main--repair");
      }
      if (receptionBlock) receptionBlock.hidden = true;
      if (tagRow) tagRow.hidden = false;
      if (leadEl) leadEl.hidden = true;
      if (catchEl) catchEl.classList.remove("biz-detail-hero__headline");
      const categoryEl = document.querySelector("[data-biz-detail-category]");
      if (categoryEl) {
        categoryEl.hidden = false;
        categoryEl.className = "biz-detail-hero__category";
        setTextContent(categoryEl, listing.categoryLabel || listing.business_category);
      }
    }
    const areaShortEl = document.querySelector("[data-biz-detail-area-short]");
    if (isServiceStyleDetailBiz(cat)) {
      if (areaShortEl) {
        areaShortEl.hidden = true;
        areaShortEl.textContent = "";
      }
    } else {
      const areaShort = listing.service_area ? `対応地域：${listing.service_area}` : "";
      if (areaShortEl) {
        areaShortEl.hidden = !areaShort;
        setTextContent(areaShortEl, areaShort);
      }
    }

    const badgesEl = document.querySelector("[data-biz-detail-hero-badges]");
    if (badgesEl && !isServiceStyleDetailBiz(cat)) {
      badgesEl.innerHTML = buildStatusBadgeHtml(listing, { hidePrFeatured: true });
    }

    renderHeroMedia(listing, images, heroImg, heroFigure);
    renderHeroQuick(listing);

    const desc = String(listing.description || "").trim();
    const descEl = document.querySelector("[data-biz-detail-description]");
    const block = getFieldServiceBlock(listing);
    const serviceDesc = String(block.service_description || "").trim();
    const overviewText = serviceDesc || desc;
    const showOverview =
      isDetailBusinessServicePage() ? overviewText.length > 0 : desc.length > 100;
    setPanelVisibility(document.getElementById("section-overview"), showOverview);
    if (descEl) descEl.textContent = overviewText;

    if (isTaxiBiz(cat)) {
      renderStrengths(listing);
      renderCoveragePills(listing);
      renderServiceMenuItems(listing);
      setPanelVisibility(document.getElementById("section-properties"), false);
      setPanelVisibility(document.getElementById("section-conditions"), false);
      setPanelVisibility(document.getElementById("section-category-extra"), false);
      renderCaseStudies(listing, images);
      await renderTaxiReviewsSection(listing);
      renderPriceCards(listing);
      renderLicenseShowcase(listing);
    } else if (isRepairBiz(cat) && !isFieldServiceUiBiz(cat) && !isFieldServiceUiBiz(listing)) {
      renderStrengths(listing);
      renderCoveragePills(listing);
      renderServiceMenuItems(listing);
      setPanelVisibility(document.getElementById("section-properties"), false);
      setPanelVisibility(document.getElementById("section-conditions"), false);
      renderCaseStudies(listing, images);
      await renderRepairReviewsSection(listing);
      renderPriceCards(listing);
      renderLicenseShowcase(listing);
      renderCategoryExtra(listing);
    } else if (
      isFieldServiceUiBiz(cat) ||
      isFieldServiceUiBiz(listing)
    ) {
      configureFieldServicePage(listing);
      renderFieldServiceHeroMain(listing);
      renderStrengths(listing);
      renderCoveragePills(listing);
      renderServiceMenuItems(listing);
      setPanelVisibility(document.getElementById("section-products"), false);
      setPanelVisibility(document.getElementById("section-shop-gallery"), false);
      setPanelVisibility(document.getElementById("section-properties"), false);
      setPanelVisibility(document.getElementById("section-conditions"), false);
      renderCaseStudies(listing, images);
      await renderFieldServiceReviewsSection(listing);
      renderPriceCards(listing);
      renderLicenseShowcase(listing);
      renderFieldServiceBottom(listing);
      setPanelVisibility(document.getElementById("section-map"), false);
      setPanelVisibility(document.getElementById("section-company"), false);
    } else if (isShopDetail(cat) || isShopDetail(listing)) {
      console.log("[store-shop] sections render start", {
        id: listing?.id,
        title: listing?.title,
        hasProducts: Array.isArray(listing?.products) ? listing.products.length : 0,
        hasGallery: Array.isArray(listing?.gallery_urls) ? listing.gallery_urls.length : 0,
      });
      configureStoreShopPage(listing);
      renderStoreHeroMain(listing);
      await renderShopSections(listing);
      console.log("[store-shop] sections render completed");
    } else {
      renderStrengths(listing);
      renderCoveragePills(listing);
      renderServiceMenuItems(listing);
      renderProperties(listing);
      renderCaseStudies(listing, images);
      renderPriceCards(listing);

      const condEl = document.querySelector("[data-biz-detail-condition-badges]");
      const condSection = document.getElementById("section-conditions");
      if (condEl) {
        const extras = window.TasuBusinessWording?.pickDisplayBadges
          ? window.TasuBusinessWording.pickDisplayBadges(listing, 12)
          : listing.conditionBadges || [];
        condEl.innerHTML = extras
          .map(
            ({ label, mod }) =>
              `<span class="badge biz-badge ${mod || "biz-badge--cond"}">${escapeHtml(label)}</span>`
          )
          .join("");
        setPanelVisibility(condSection, extras.length > 0);
      }

      renderLicenseShowcase(listing);
      renderCategoryExtra(listing);
    }
    if (
      !isShopStoreBiz(cat) &&
      !isShopDetail(cat) &&
      !isShopDetail(listing) &&
      !isDetailBusinessServicePage()
    ) {
      renderFaq(listing);
      renderSidebarExtras(listing);
    }

    const invoiceLabel =
      formatDisplayText(listing.invoice_support, "invoice_support") ||
      INVOICE_LABELS[listing.invoice_support] ||
      "—";
    const companyDl = document.querySelector("[data-biz-detail-company-info]");
    if (companyDl && !isShopStoreBiz(cat)) {
      const licenseLineDisplay = window.TasuBusinessWording?.formatLicenseLine
        ? window.TasuBusinessWording.formatLicenseLine(
            listing.license_info || listing.licenseLine || ""
          )
        : formatDisplayText(listing.license_info || listing.licenseLine, "license_info");
      const companyRows =
        isTaxiBiz(cat)
          ? [
              { label: "会社名", value: listing.company_name },
              { label: "電話番号", value: listing.phone },
              { label: "営業時間", value: listing.business_hours },
              {
                label: "HP",
                value: listing.hp_url,
                html: listing.hp_url
                  ? `<a href="${escapeAttr(listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(listing.hp_url)}</a>`
                  : "",
              },
              { label: "許可・資格", value: licenseLineDisplay },
              { label: "請求書対応", value: invoiceLabel },
              { label: "掲載日", value: listing.publishedLabel },
            ]
          : isFieldServiceUiBiz(cat) || isFieldServiceUiBiz(listing)
            ? [
                { label: "会社名", value: listing.company_name },
                { label: "電話番号", value: listing.phone },
                { label: "営業時間", value: listing.business_hours },
                {
                  label: "HP",
                  value: listing.hp_url,
                  html: listing.hp_url
                    ? `<a href="${escapeAttr(listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(listing.hp_url)}</a>`
                    : "",
                },
                {
                  label: "Google Map",
                  value: listing.google_map_url,
                  html: listing.google_map_url
                    ? `<a href="${escapeAttr(listing.google_map_url)}" target="_blank" rel="noopener noreferrer">地図を開く</a>`
                    : "",
                },
                { label: "許可・資格", value: licenseLineDisplay },
                { label: "請求書対応", value: invoiceLabel },
                { label: "掲載日", value: listing.publishedLabel },
              ]
            : [
                { label: "会社名", value: listing.company_name },
                { label: "電話番号", value: listing.phone },
                { label: "営業時間", value: listing.business_hours },
                {
                  label: "HP",
                  value: listing.hp_url,
                  html: listing.hp_url
                    ? `<a href="${escapeAttr(listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(listing.hp_url)}</a>`
                    : "",
                },
                { label: "許可・資格", value: licenseLineDisplay },
                { label: "お問い合わせ", value: listing.contactMethodDisplayLabel },
                { label: "請求書対応", value: invoiceLabel },
                { label: "掲載日", value: listing.publishedLabel },
              ];
      companyDl.innerHTML = buildDlRows(companyRows);
    }

    renderBusinessAdPlansSection(listing);

    if (isTaxiBiz(cat)) {
      setPanelVisibility(document.getElementById("section-payment"), false);
    } else {
      const paymentBlock = document.querySelector("[data-biz-detail-payment-block]");
      const paymentUrl = String(listing.payment_url || "").trim();
      const bankInfo = String(listing.bank_transfer_info || "").trim();
      setPanelVisibility(
        document.getElementById("section-payment"),
        Boolean(paymentUrl || bankInfo)
      );
      if (paymentBlock) {
        paymentBlock.innerHTML = [
          paymentUrl
            ? `<p><a href="${escapeAttr(paymentUrl)}" target="_blank" rel="noopener noreferrer">決済ページを開く</a></p>`
            : "",
          bankInfo ? `<p>${escapeHtml(bankInfo)}</p>` : "",
        ]
          .filter(Boolean)
          .join("");
      }
    }

    if (isShopStoreBiz(cat) || isShopStoreBiz(listing)) {
      // store-shop 側で map / shop-bottom を描画
    } else {
      // 法人・業者は業務サービスUIに統一（mapは下部4カラムへ集約）
      setPanelVisibility(document.getElementById("section-map"), false);
    }

    if (isShopStoreBiz(cat) || isShopStoreBiz(listing)) {
      await renderStoreSidebar(listing, ctas);
    } else {
      await renderFieldServiceSidebar(listing, ctas);
    }

    const heroCta = document.querySelector("[data-biz-detail-hero-cta]");
    if (heroCta) {
      heroCta.hidden = true;
      heroCta.innerHTML = "";
    }

    const sidebarMeta = document.querySelector("[data-biz-detail-sidebar-meta]");
    if (sidebarMeta && !isTaxiBiz(cat)) {
      sidebarMeta.innerHTML = buildDlRows([
        { label: "電話番号", value: listing.phone },
        { label: "営業時間", value: listing.business_hours },
        { label: "対応地域", value: listing.service_area },
        { label: "カテゴリ", value: listing.categoryLabel },
      ]);
    } else if (sidebarMeta && isTaxiBiz(cat)) {
      sidebarMeta.innerHTML = "";
    }

    bindStickyBar(listing, ctas);

    if (isTaxiBiz(cat) || isRepairBiz(cat) || isServiceStyleDetailBiz(cat)) hideLegacyFvFavorite();

    if (
      listing.tags &&
      listing.tags.length &&
      badgesEl &&
      !isTaxiBiz(cat) &&
      !isRepairBiz(cat) &&
      !isServiceStyleDetailBiz(cat)
    ) {
      badgesEl.innerHTML += listing.tags
        .slice(0, 6)
        .map((t) => `<span class="biz-badge biz-badge--cond">${escapeHtml(t)}</span>`)
        .join("");
    }

    root.hidden = false;
    document.body.dataset.listingLoaded = "true";
    document.body.dataset.listingId = listing.id || "";
    document.body.dataset.businessCategory = cat;

    const statusEl = document.querySelector("[data-listing-detail-status]");
    if (statusEl) statusEl.hidden = true;
  }

  window.TasuBusinessDetail = { render, renderBusinessDetailPage, renderShopSections };
})();
