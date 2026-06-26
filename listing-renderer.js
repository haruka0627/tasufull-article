/**
 * 一覧カード描画・並び替え（index / カテゴリ一覧共通）
 */
(function () {
  "use strict";

  const TYPE_LABELS = {
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
    business: "法人・業者",
    article: "無料記事",
  };

  const LIST_CARD_TYPE_BADGE = {
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
    business: "法人・業者",
    article: "無料記事",
  };

  const CTA_BY_TYPE = {
    product: "購入・見積もり相談",
    skill: "依頼する",
    job: "応募する",
    worker: "相談する",
    business: "詳細を見る",
  };

  const PRODUCT_FEATURE_BADGE_HINTS = [
    "本人確認",
    "高評価",
    "即対応",
    "即日対応",
    "公式",
    "送料無料",
  ];

  function bizCatLabel(cat, formData) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const sub = fd.business_subcategory || "";
    if (window.TasuBusinessCategories?.buildCategoryDisplayLabel) {
      const built = window.TasuBusinessCategories.buildCategoryDisplayLabel(cat, sub);
      if (built) return built;
      const main = window.TasuBusinessCategories.getCategoryLabel(cat);
      if (main) return main;
    }
    return BUSINESS_CATEGORY_LABELS[cat] || cat;
  }

  function isTransportCat(cat) {
    return window.TasuBusinessCategories?.isTransportProfile?.(cat) ?? cat === "taxi";
  }

  function isConstructionCat(cat) {
    return window.TasuBusinessCategories?.isConstructionProfile?.(cat) ?? cat === "construction";
  }

  const BUSINESS_CATEGORY_LABELS = {
    transport: "送迎・運搬",
    construction_work: "建設・工事",
    repair_maintenance: "修理・メンテナンス",
    cleaning: "清掃・片付け",
    shop_store: "店舗・販売",
    field_service: "業者サービス",
    store_field_service: "店舗・出張サービス（旧）",
    local_support: "暮らしサポート",
    taxi: "送迎・運搬",
    repair: "修理・メンテナンス",
    construction: "建設・工事",
    local_service: "暮らしサポート",
    store: "店舗・出張サービス",
  };

  const STATUS_LABELS = {
    available: "対応可能",
    busy: "忙しい",
    closed: "休み",
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function parseFormData(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function parseTags(raw) {
    if (window.TasuListingTags?.collectDisplayTags) {
      return window.TasuListingTags.collectDisplayTags({ tags: raw, form_data: {} });
    }
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function resolveDisplayTags(row) {
    const type = String(row?.listing_type || row?.type || "").trim();
    if (type === "product" && window.TasuListingTags?.collectProductDisplayTags) {
      return window.TasuListingTags.collectProductDisplayTags(row);
    }
    if (window.TasuListingTags?.collectDisplayTags) {
      return window.TasuListingTags.collectDisplayTags(row);
    }
    return parseTags(row?.tags);
  }

  function planIsActive(plan) {
    return plan === "apply" || plan === "considering";
  }

  function safeText(value, fallback) {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text === "undefined" || text === "null") return fallback;
    return text;
  }

  /** 一覧カード表示タイトル — listing.title を最優先 */
  function resolveListingCardTitle(listing, productNormalized) {
    const formData =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};

    const title =
      listing?.title ||
      listing?.name ||
      listing?.service_name ||
      listing?.serviceName ||
      listing?.job_title ||
      listing?.jobTitle ||
      listing?.product_name ||
      formData?.service_name ||
      formData?.serviceName ||
      formData?.job_title ||
      formData?.jobTitle ||
      formData?.product_name ||
      productNormalized?.title ||
      "タイトル未設定";

    const resolved = safeText(title, "タイトル未設定");
    console.log("CARD TITLE", listing?.id, resolved);
    return resolved;
  }

  function resolveCardTitle(listing) {
    const isProduct =
      String(listing?.type || listing?.listing_type || "")
        .trim()
        .toLowerCase() === "product";
    const product = isProduct ? resolveProductForCard(listing) : null;
    return resolveListingCardTitle(listing, product);
  }

  function resolveListCardTypeBadgeLabel(type) {
    const key = String(type || "").trim().toLowerCase();
    return LIST_CARD_TYPE_BADGE[key] || TYPE_LABELS[key] || "掲載";
  }

  function stableListingSeed(value) {
    const s = String(value || "");
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  /** 一覧カード右肩 — 閲覧 / お気に入り / レビュー / 実績のいずれか1つ */
  function resolveListCardActivityStat(listing) {
    const formData =
      listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};

    const reviews = Number(
      listing.review_count ?? listing.reviewCount ?? formData.review_count
    );
    if (Number.isFinite(reviews) && reviews > 0) {
      return { icon: "★", text: `レビュー ${reviews}件` };
    }

    const favorites = Number(listing.favorite_count ?? formData.favorite_count);
    if (Number.isFinite(favorites) && favorites > 0) {
      return { icon: "♡", text: `お気に入り ${favorites}` };
    }

    const sales = Number(
      listing.sales_count ??
        listing.deals_count ??
        formData.sales_count ??
        formData.deals_count
    );
    if (Number.isFinite(sales) && sales > 0) {
      return { icon: "◎", text: `実績 ${sales}件` };
    }

    const views = Number(
      listing.view_count ?? listing.views ?? formData.view_count ?? listing.popular
    );
    if (Number.isFinite(views) && views > 0) {
      return { icon: "👁", text: `閲覧 ${views.toLocaleString("ja-JP")}` };
    }

    const achievements = safeText(formData.achievements, "");
    const achievementMatch = achievements.match(/(\d{1,5})\s*件/);
    if (achievementMatch) {
      return { icon: "◎", text: `実績 ${achievementMatch[1]}件` };
    }

    const seed = stableListingSeed(listing.id || listing.title);
    const estimatedViews = 120 + (seed % 4800);
    return { icon: "👁", text: `閲覧 ${estimatedViews.toLocaleString("ja-JP")}` };
  }

  function buildListCardActivityStatHtml(listing) {
    const stat = resolveListCardActivityStat(listing);
    return `<span class="list-card__stat" data-list-card-stat aria-label="${escapeAttr(stat.text)}"><span class="list-card__stat-icon" aria-hidden="true">${escapeHtml(stat.icon)}</span>${escapeHtml(stat.text)}</span>`;
  }

  function resolveCardDescription(listing) {
    const formData = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    if (listing.type === "product") {
      const normalized = window.TasuProductListingFields?.normalizeProductListing?.(listing);
      const desc =
        normalized?.description ||
        safeText(listing.description, "") ||
        safeText(formData.description, "") ||
        safeText(formData.product_description, "");
      return desc || "説明はまだ登録されていません。";
    }
    return safeText(listing.description, "説明はまだ登録されていません。");
  }

  function resolveProductCategoryParts(row, formData) {
    const normalized = window.TasuProductListingFields?.normalizeProductListing?.({
      ...row,
      listing_type: "product",
      form_data: formData,
    });
    if (normalized) {
      return {
        category: normalized.category,
        subcategory: normalized.subcategory,
      };
    }
    if (window.TasuProductListingFields) {
      return {
        category: window.TasuProductListingFields.resolveProductCategory(row, formData),
        subcategory: window.TasuProductListingFields.resolveProductSubcategory(row, formData),
      };
    }
    let category = safeText(row.category, "");
    let subcategory = safeText(row.subcategory, "");
    if (!category && typeof formData.category === "string") {
      category = safeText(formData.category, "");
    }
    if (!category && formData.category && typeof formData.category === "object") {
      category = safeText(formData.category.category, "");
      subcategory =
        subcategory || safeText(formData.category.subCategory || formData.category.subcategory, "");
    }
    if (!subcategory) {
      subcategory = safeText(formData.subcategory || formData.subCategory, "");
    }
    return { category, subcategory };
  }

  function resolveProductCategoryLabel(row, formData) {
    const { category, subcategory } = resolveProductCategoryParts(row, formData);
    if (category && subcategory) return `${category} · ${subcategory}`;
    if (category) return category;
    if (subcategory) return subcategory;
    return TYPE_LABELS.product || "商品";
  }

  function resolveCardPriceText(listing) {
    const amount = listing.price_amount;
    if (amount != null && !Number.isNaN(Number(amount))) {
      return `¥${Number(amount).toLocaleString("ja-JP")}`;
    }
    return safeText(listing.priceText, "要相談");
  }

  function normalizeGeneralRow(row) {
    const formData = parseFormData(row.form_data);
    const type = row.listing_type;
    const isProduct = type === "product";
    const productNormalized = isProduct
      ? window.TasuProductListingFields?.normalizeProductListing?.({
          ...row,
          listing_type: type,
          form_data: formData,
        })
      : null;

    const tags = isProduct
      ? productNormalized?.tags?.length
        ? productNormalized.tags
        : resolveDisplayTags(row)
      : resolveDisplayTags(row);
    const priceAmount = row.price_amount != null ? Number(row.price_amount) : null;

    const title = resolveListingCardTitle(
      {
        ...row,
        listing_type: type,
        type,
        form_data: formData,
        title: row.title,
        name: row.worker_display_name || row.name,
        service_name: formData.service_name || formData.serviceName,
        job_title: row.job_title || formData.job_title || formData.jobTitle,
      },
      productNormalized
    );
    const description = isProduct
      ? productNormalized?.description ||
        safeText(row.description, "") ||
        safeText(formData.description, "") ||
        safeText(formData.product_description, "")
      : safeText(row.description, "");
    const category = isProduct ? productNormalized?.category || "" : "";
    const subcategory = isProduct ? productNormalized?.subcategory || "" : "";

    const imageRow = { ...row, listing_type: type, form_data: formData };
    const imageSet =
      !isProduct && window.TasuListingImages?.resolveListingImageSet
        ? window.TasuListingImages.resolveListingImageSet(imageRow)
        : null;

    const galleryUrls = isProduct
      ? productNormalized?.gallery?.length
        ? [productNormalized.image, ...productNormalized.gallery].filter(Boolean)
        : productNormalized?.image
          ? [productNormalized.image]
          : []
      : imageSet?.gallery?.length
        ? imageSet.gallery
        : window.TasuListingImages?.resolveGalleryUrls
          ? window.TasuListingImages.resolveGalleryUrls(imageRow)
          : [];

    return {
      id: row.id,
      source: row._source || "supabase",
      listing_type: type,
      type,
      targetType: type,
      business_category: null,
      title,
      name: safeText(row.worker_display_name || row.name || formData.name, ""),
      service_name: safeText(formData.service_name || formData.serviceName, ""),
      job_title: safeText(row.job_title || formData.job_title || formData.jobTitle, ""),
      product_name: safeText(formData.product_name || row.product_name, ""),
      description,
      category: isProduct ? category : undefined,
      subcategory: isProduct ? subcategory : undefined,
      ...(isProduct
        ? {
            product_description: row.product_description,
            condition: row.condition,
            delivery_method: row.delivery_method,
            stock_count: row.stock_count,
            delivery_days: row.delivery_days,
            spec: row.spec,
            gallery_urls: row.gallery_urls ?? row.galleryUrls,
            images: row.images,
            available_tags: row.available_tags,
            options: row.options,
          }
        : {}),
      tags,
      displayTags: tags,
      form_data: formData,
      user_id: row.user_id,
      created_at: row.created_at,
      price_amount: priceAmount,
      priceText: isProduct
        ? productNormalized?.price?.text ||
          (priceAmount != null && !Number.isNaN(priceAmount)
            ? `¥${priceAmount.toLocaleString("ja-JP")}`
            : safeText(formData.price, "要相談"))
        : priceAmount != null && !Number.isNaN(priceAmount)
          ? `¥${priceAmount.toLocaleString("ja-JP")}`
          : safeText(formData.worker?.price || formData.price, "要相談"),
      image_url: isProduct
        ? productNormalized?.image ||
          row.image_url ||
          formData.image_url ||
          formData.main_image_url ||
          null
        : row.image_url || formData.image_url || formData.main_image_url || null,
      thumbnail_url: isProduct
        ? productNormalized?.thumbnail ||
          row.thumbnail_url ||
          row.image_url ||
          formData.thumbnail_url ||
          null
        : row.thumbnail_url ||
          row.image_url ||
          formData.thumbnail_url ||
          formData.image_url ||
          null,
      imageUrl: isProduct
        ? productNormalized?.image ||
          window.TasuListingImages?.normalizeImageUrl?.(row.image_url) ||
          window.TasuListingImages?.normalizeImageUrl?.(formData.image_url) ||
          null
        : imageSet?.primary ||
          window.TasuListingImages?.resolvePrimaryImageUrl?.(imageRow) ||
          window.TasuListingImages?.normalizeImageUrl?.(row.image_url) ||
          window.TasuListingImages?.normalizeImageUrl?.(row.thumbnail_url) ||
          window.TasuListingImages?.normalizeImageUrl?.(formData.image_url) ||
          window.TasuListingImages?.normalizeImageUrl?.(formData.main_image_url) ||
          window.TasuListingImages?.normalizeImageUrl?.(formData.thumbnail_url) ||
          null,
      galleryUrls,
      productNormalized: isProduct ? productNormalized : undefined,
      isPr:
        (window.TasuListingFeatured?.isPrActive
          ? window.TasuListingFeatured.isPrActive(row)
          : false) || planIsActive(formData.pr_plan),
      isFeatured: planIsActive(formData.featured_plan),
      is_featured: row.is_featured,
      featured_until: row.featured_until,
      featured_plan: row.featured_plan,
      featured_priority: row.featured_priority,
      isFeaturedSlot: window.TasuListingFeatured?.isFeaturedSlotActive
        ? window.TasuListingFeatured.isFeaturedSlotActive(row)
        : false,
      publish_status: row.publish_status || "public",
      status: row.publish_status === "public" ? "open" : row.publish_status || "open",
      statusLabel:
        row.publish_status === "draft"
          ? "下書き"
          : row.publish_status === "scheduled"
            ? "予約公開"
            : "掲載中",
      categoryLabel: isProduct
        ? resolveProductCategoryLabel(row, formData)
        : TYPE_LABELS[type] || type,
      account: `@${String(row.user_id || "seller").slice(0, 14)}`,
      publishedLabel: formatDate(row.created_at),
      popular:
        row.popular != null
          ? Number(row.popular)
          : Number(formData.popular ?? formData.view_count) || 0,
      review_count: row.review_count != null ? Number(row.review_count) : undefined,
      view_count: row.view_count != null ? Number(row.view_count) : undefined,
      favorite_count:
        row.favorite_count != null ? Number(row.favorite_count) : undefined,
      onsite_payment: Boolean(row.onsite_payment),
      invoice_support: row.invoice_support,
      payment_url: row.payment_url || null,
      bank_transfer_info: row.bank_transfer_info || null,
    };
  }

  const APPLICATION_CONDITION_BADGE_ORDER = [
    "急募",
    "すぐ開始",
    "資格必須",
    "長期歓迎",
    "法人のみ",
    "インボイス必須",
    "経験者歓迎",
    "未経験可",
    "個人事業主可",
  ];

  const APPLICATION_CONDITION_BADGE_CLASS = {
    急募: "biz-badge--urgent",
    すぐ開始: "biz-badge--soon",
    資格必須: "biz-badge--license",
    インボイス必須: "biz-badge--corp",
    長期歓迎: "biz-badge--long",
    経験者歓迎: "biz-badge--verified",
    未経験可: "biz-badge--cond",
    法人のみ: "biz-badge--corp",
    個人事業主可: "biz-badge--cond",
  };

  function normalizeApplicationConditions(raw) {
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    if (raw == null || raw === "") return [];
    if (typeof raw === "string") {
      return raw
        .split(/[,、\n]/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [];
  }

  function buildApplicationConditionBadges(conditions) {
    const unique = [...new Set(conditions)];
    const sorted = unique.sort((a, b) => {
      const ai = APPLICATION_CONDITION_BADGE_ORDER.indexOf(a);
      const bi = APPLICATION_CONDITION_BADGE_ORDER.indexOf(b);
      const ao = ai === -1 ? 999 : ai;
      const bo = bi === -1 ? 999 : bi;
      return ao - bo;
    });
    return sorted.map((label) => ({
      label:
        window.TasuBusinessWording?.formatConditionBadgeLabel?.(label) || label,
      sourceLabel: label,
      mod: APPLICATION_CONDITION_BADGE_CLASS[label] || "biz-badge--cond",
    }));
  }

  const TAXI_EXTRA_KEYS = {
    taxi_service_type: ["taxi_services", "taxi_service_type"],
    taxi_vehicle_type: ["vehicle_types", "taxi_vehicle_type"],
    taxi_area_type: ["taxi_area_type"],
    taxi_airport_transfer: ["airport_transfer", "taxi_airport_transfer"],
    taxi_24h_available: ["support_24h", "taxi_24h_available"],
    taxi_reservation_available: ["reservation_support", "taxi_reservation_available"],
    taxi_corporate_contract: ["corporate_contract", "taxi_corporate_contract"],
    taxi_invoice_available: ["invoice_support_extra", "taxi_invoice_available"],
    taxi_base_fare: ["taxi_base_fare"],
    taxi_night_fare: ["taxi_night_fare"],
    taxi_route_price: ["taxi_route_price"],
    taxi_capacity: ["taxi_capacity"],
    taxi_language_support: ["taxi_language_support", "taxi_language_support"],
    taxi_child_seat: ["child_seat", "taxi_child_seat"],
    taxi_booking_types: ["booking_types", "taxi_booking_types"],
  };

  const TAXI_BOOKING_BADGE_PRIORITY = ["即時配車", "空港送迎", "法人定期契約"];

  function normalizeTaxiBookingTypes(raw) {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[")) {
        try {
          return normalizeTaxiBookingTypes(JSON.parse(trimmed));
        } catch {
          return [trimmed];
        }
      }
      return trimmed
        .split(/[,、]/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [];
  }

  function pickTaxiBookingTypes(row, formData, mergedExtra) {
    const extra = mergedExtra?.taxi;
    const fromExtra = normalizeTaxiBookingTypes(extra?.booking_types);
    if (fromExtra.length) return fromExtra;
    return normalizeTaxiBookingTypes(
      row?.taxi_booking_types ?? formData?.taxi_booking_types
    );
  }

  function buildTaxiBookingBadges(bookingTypes) {
    const types = normalizeTaxiBookingTypes(bookingTypes);
    const ordered = [];
    TAXI_BOOKING_BADGE_PRIORITY.forEach((label) => {
      if (types.includes(label)) {
        ordered.push({ label, mod: "biz-badge--booking" });
      }
    });
    types.forEach((label) => {
      if (!ordered.some((b) => b.label === label)) {
        ordered.push({ label, mod: "biz-badge--booking" });
      }
    });
    return ordered.slice(0, 4);
  }

  function pickTaxiText(row, formData, column) {
    const legacy = TAXI_EXTRA_KEYS[column] || [column];
    return pickBusinessText(row, formData, column, legacy);
  }

  function mergeTaxiCategoryExtra(row, formData, mergedExtra) {
    const extra = mergedExtra && typeof mergedExtra === "object" ? { ...mergedExtra } : {};
    const taxi = extra.taxi && typeof extra.taxi === "object" ? { ...extra.taxi } : {};
    Object.entries(TAXI_EXTRA_KEYS).forEach(([column, keys]) => {
      if (column === "taxi_booking_types") return;
      const value = pickTaxiText(row, formData, column);
      if (!value) return;
      const primaryKey = keys[0];
      if (!taxi[primaryKey]) taxi[primaryKey] = value;
    });
    const bookings = pickTaxiBookingTypes(row, formData, extra);
    if (bookings.length) taxi.booking_types = bookings;
    const payments = row?.taxi_payment_methods ?? formData?.taxi_payment_methods ?? taxi.taxi_payment_methods;
    if (payments != null && payments !== "") {
      taxi.taxi_payment_methods = payments;
    }
    if (!Object.keys(taxi).length) return extra;
    return { ...extra, taxi };
  }

  function taxiFlagIsYes(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "yes" || raw === "true" || raw === "対応可能" || raw === "1";
  }

  function buildTaxiServiceBadges(cat, row, formData) {
    if (!isTransportCat(cat)) return [];
    const badges = [];
    const airport = pickTaxiText(row, formData, "taxi_airport_transfer");
    const h24 = pickTaxiText(row, formData, "taxi_24h_available");
    const reservation = pickTaxiText(row, formData, "taxi_reservation_available");
    const corporate = pickTaxiText(row, formData, "taxi_corporate_contract");
    const invoice = pickTaxiText(row, formData, "taxi_invoice_available");
    const childSeat = pickTaxiText(row, formData, "taxi_child_seat");
    const language = pickTaxiText(row, formData, "taxi_language_support");

    if (taxiFlagIsYes(airport)) {
      badges.push({ label: "空港送迎", mod: "biz-badge--airport" });
    }
    if (taxiFlagIsYes(h24)) {
      badges.push({ label: "24時間対応", mod: "biz-badge--night" });
    }
    if (taxiFlagIsYes(reservation)) {
      badges.push({ label: "予約対応", mod: "biz-badge--reservation" });
    }
    if (taxiFlagIsYes(corporate)) {
      badges.push({ label: "法人契約", mod: "biz-badge--corporate" });
    }
    if (taxiFlagIsYes(invoice) || row?.invoice_support === "yes") {
      badges.push({ label: "インボイス対応", mod: "biz-badge--invoice" });
    }
    if (taxiFlagIsYes(childSeat)) {
      badges.push({ label: "チャイルドシート", mod: "biz-badge--child-seat" });
    }
    if (/英語|english/i.test(language)) {
      badges.push({ label: "英語相談可", mod: "biz-badge--lang" });
    }
    return badges;
  }

  function buildConstructionServiceBadges(cat, formData, hasPartnerRegistration) {
    if (!isConstructionCat(cat)) return [];
    const extra =
      formData?.category_extra?.construction &&
      typeof formData.category_extra.construction === "object"
        ? formData.category_extra.construction
        : {};
    const badges = [];
    if (hasPartnerRegistration) {
      badges.push({ label: "協力会社対応", mod: "biz-badge--partner" });
    }
    badges.push({ label: "施工対応", mod: "biz-badge--construction" });
    if (String(extra.team_capacity || "").trim()) {
      badges.push({ label: "常用対応", mod: "biz-badge--long" });
    }
    if (extra.night_support === "yes") {
      badges.push({ label: "夜間対応", mod: "biz-badge--night" });
    }
    if (extra.emergency_support === "yes") {
      badges.push({ label: "応援対応", mod: "biz-badge--urgent" });
    }
    if (String(extra.team_capacity || "").trim()) {
      badges.push({ label: "常用対応", mod: "biz-badge--long" });
    }
    const insurance = String(extra.insurance || "").trim();
    if (insurance && insurance !== "not_joined" && insurance !== "未加入") {
      badges.push({ label: "保険加入", mod: "biz-badge--insurance" });
    }
    return badges;
  }

  function mergeBusinessDisplayBadges(primary, extra) {
    const seen = new Set();
    const out = [];
    [...primary, ...extra].forEach((badge) => {
      const key = badge.label;
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(badge);
    });
    return out;
  }

  function resolveRecruitStatusMod(recruitStatus, fallbackRowStatus) {
    if (window.TasuBusinessWording?.resolveRecruitStatusMod) {
      return window.TasuBusinessWording.resolveRecruitStatusMod(
        recruitStatus,
        fallbackRowStatus
      );
    }
    const text = safeText(recruitStatus, "");
    if (text === "募集中" || text === "受付中") return "is-open";
    if (text === "一時停止") return "is-paused";
    if (text === "募集終了" || text === "対応不可") return "is-closed";
    if (text === "対応中") return "is-busy";

    const legacy = fallbackRowStatus || "available";
    if (legacy === "available") return "is-open";
    if (legacy === "busy") return "is-busy";
    if (legacy === "closed") return "is-closed";
    return "is-open";
  }

  function hasFieldValue(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return String(value).trim() !== "";
  }

  /** トップレベル列 → form_data → レガシーキー */
  function pickBusinessText(row, formData, key, legacyKeys = []) {
    if (hasFieldValue(row?.[key])) return String(row[key]).trim();
    if (hasFieldValue(formData?.[key])) return String(formData[key]).trim();
    for (let i = 0; i < legacyKeys.length; i += 1) {
      const lk = legacyKeys[i];
      if (hasFieldValue(formData?.[lk])) return String(formData[lk]).trim();
    }
    return "";
  }

  /** DB 列の URL 配列をそのまま正規化（メイン除外・form_data フォールバックなし） */
  function businessRowUrlArray(row, key) {
    const arr = coerceListingImagesArray(row?.[key]);
    const out = [];
    arr.forEach((item) => {
      const url = resolveBusinessImageCandidate(item);
      if (url && !out.includes(url)) out.push(url);
    });
    return out;
  }

  function resolveBusinessImageCandidate(value) {
    if (value == null || value === "") return "";
    if (window.TasuListingImages?.resolveUrlCandidate) {
      const resolved = window.TasuListingImages.resolveUrlCandidate(value);
      if (resolved) return resolved;
    }
    const s = String(value).trim();
    if (!s || s === "null" || s === "undefined") return "";
    const norm = window.TasuListingImages?.normalizeImageUrl?.(s);
    if (norm) return norm;
    if (
      /^https?:\/\//i.test(s) ||
      s.startsWith("data:image/") ||
      s.startsWith("blob:")
    ) {
      return s;
    }
    return "";
  }

  function firstBusinessImageFromArray(raw) {
    const arr = coerceListingImagesArray(raw);
    for (let i = 0; i < arr.length; i += 1) {
      const url = resolveBusinessImageCandidate(arr[i]);
      if (url) return url;
    }
    return "";
  }

  /** 法人案件 — 各キーの生値（デバッグ・保存構造確認用） */
  function inspectBusinessImageSources(row) {
    const formData = parseFormData(row?.form_data);
    const gallery = coerceListingImagesArray(formData.gallery_urls);
    const rowGallery = coerceListingImagesArray(row?.gallery_urls);
    return {
      "row.image_url": row?.image_url ?? null,
      "row.thumbnail_url": row?.thumbnail_url ?? null,
      "row.images[0]": coerceListingImagesArray(row?.images)[0] ?? null,
      "form_data.image_url": formData.image_url ?? null,
      "form_data.thumbnail_url": formData.thumbnail_url ?? null,
      "form_data.images[0]": coerceListingImagesArray(formData.images)[0] ?? null,
      "form_data.main_image": formData.main_image ?? null,
      "form_data.mainImage": formData.mainImage ?? null,
      "form_data.main_image_url": formData.main_image_url ?? null,
      "form_data.gallery_urls[0]": gallery[0] ?? null,
      "row.gallery_urls[0]": rowGallery[0] ?? null,
      "form_data.logo_url": formData.logo_url ?? null,
    };
  }

  /**
   * 法人案件ボード用 — business_listings 行から表示用メイン画像URL
   * 実DB確認: 画像は form_data.image_url 等（スキル掲載と同様）に保存される想定。
   * トップレベル image_url 列は business_listings では未追加の環境あり。
   */
  const DEBUG_PICK_BUSINESS_IMAGE = false;

  function pickBusinessImage(row) {
    if (!row) return null;
    const formData = parseFormData(row.form_data);
    const ordered = [
      formData.logo_url,
      row.logo_url,
      formData.company_logo_url,
      formData.store_image_url,
      formData.shop_image_url,
      formData.store_photo_url,
      formData.work_photo_url,
      formData.service_image_url,
      formData.construction_photo_url,
      row.thumbnail_url,
      formData.thumbnail_url,
      row.image_url,
      formData.image_url,
      formData.main_image_url,
      firstBusinessImageFromArray(formData.images),
      formData.main_image,
      formData.mainImage,
      firstBusinessImageFromArray(formData.gallery_urls),
      firstBusinessImageFromArray(row.images),
      firstBusinessImageFromArray(row.gallery_urls),
    ];
    for (let i = 0; i < ordered.length; i += 1) {
      const url = resolveBusinessImageCandidate(ordered[i]);
      if (url) {
        if (DEBUG_PICK_BUSINESS_IMAGE) {
          console.log("[TasuListingRenderer] pickBusinessImage", row.id, {
            imageUrl: url,
            sources: inspectBusinessImageSources(row),
          });
        }
        return url;
      }
    }

    const viaSet = window.TasuListingImages?.resolvePrimaryImageUrl?.(row);
    if (viaSet) {
      if (DEBUG_PICK_BUSINESS_IMAGE) {
        console.log("[TasuListingRenderer] pickBusinessImage", row.id, {
          imageUrl: viaSet,
          sources: inspectBusinessImageSources(row),
          via: "TasuListingImages.resolvePrimaryImageUrl",
        });
      }
      return viaSet;
    }

    if (DEBUG_PICK_BUSINESS_IMAGE) {
      console.log("[TasuListingRenderer] pickBusinessImage", row.id, {
        imageUrl: null,
        sources: inspectBusinessImageSources(row),
      });
    }
    return null;
  }

  function pickBusinessImageUrl(row) {
    return pickBusinessImage(row);
  }

  function pickApplicationConditions(row, formData) {
    if (row?.application_conditions != null) {
      return normalizeApplicationConditions(row.application_conditions);
    }
    return normalizeApplicationConditions(formData?.application_conditions);
  }

  /** 対応条件 — DB直カラムは使わず application_conditions / form_data.support_conditions */
  function pickBusinessSupportConditions(row, formData) {
    const fromApp = pickApplicationConditions(row, formData);
    if (fromApp.length) return fromApp;
    const fd = formData && typeof formData === "object" ? formData : {};
    return normalizeApplicationConditions(fd.support_conditions);
  }

  function pickFormDataText(row, formData, key) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const fromRow = row?.[key];
    if (fromRow != null && String(fromRow).trim() !== "") return String(fromRow).trim();
    const fromFd = fd[key];
    if (fromFd != null && String(fromFd).trim() !== "") return String(fromFd).trim();
    return "";
  }

  function pickFormDataJsonArray(row, formData, key) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const fromRow = parseJsonArray(row?.[key]);
    if (fromRow.length) return fromRow;
    return parseJsonArray(fd[key]);
  }

  /** 対応内容 — repair_services 列、なければ form_data */
  function pickBusinessRepairServices(row, formData) {
    const fromRow = parseJsonArray(row?.repair_services);
    if (fromRow.length) return fromRow;
    const fd = formData && typeof formData === "object" ? formData : {};
    const fromFd = parseJsonArray(fd.repair_services);
    if (fromFd.length) return fromFd;
    return [];
  }

  function pickCategoryExtra(row, formData) {
    if (
      row?.category_extra != null &&
      typeof row.category_extra === "object" &&
      !Array.isArray(row.category_extra)
    ) {
      return row.category_extra;
    }
    if (
      formData?.category_extra != null &&
      typeof formData.category_extra === "object" &&
      !Array.isArray(formData.category_extra)
    ) {
      return formData.category_extra;
    }
    return {};
  }

  function resolveConstructionPartnerRegistration(formData, category) {
    if (category !== "construction") return "";
    const extra = formData.category_extra;
    if (extra && typeof extra === "object" && extra.construction) {
      return safeText(extra.construction.partner_registration, "");
    }
    return safeText(formData.partner_registration, "");
  }

  function formatContactMethodDisplay(method) {
    const raw = safeText(method, "");
    if (!raw) return "";
    const map = {
      サイト内チャット: "サイト内チャット",
      電話: "電話対応",
      メール: "メール対応",
      外部URL: "外部URL",
      要相談: "要相談",
    };
    return map[raw] || raw;
  }

  /** jsonb / form_data — 配列または JSON 文字列を正規化 */
  function parseJsonArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function pickBusinessServiceMenuItems(row, formData) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const fromRow = parseJsonArray(row?.service_menu_items);
    if (fromRow.length) return fromRow;
    return parseJsonArray(fd.service_menu_items);
  }

  function pickBusinessWorkCases(row, formData) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const fromRow = row?.work_cases;
    if (Array.isArray(fromRow) && fromRow.length) return fromRow;
    const fromFd = fd.work_cases;
    if (Array.isArray(fromFd) && fromFd.length) return fromFd;
    return [];
  }

  function computeBusinessPriorityScore({ isPr, isFeatured, appConditions, statusLabel }) {
    let score = 0;
    if (isPr) score += 100;
    if (isFeatured) score += 50;
    if (appConditions.includes("急募")) score += 15;
    if (appConditions.includes("すぐ開始")) score += 10;
    if (appConditions.includes("資格必須")) score += 8;
    if (appConditions.includes("長期歓迎")) score += 5;
    if (statusLabel === "一時停止") score -= 50;
    if (statusLabel === "募集終了" || statusLabel === "対応不可") score -= 1000;
    return score;
  }

  function normalizeBusinessRow(row) {
    const formData = parseFormData(row?.form_data);
    const cat = row?.business_category || "";
    const tags = resolveDisplayTags(row);
    const tagText = tags.join(" ");
    const appConditions = pickApplicationConditions(row, formData);
    const conditionBadges = buildApplicationConditionBadges(appConditions);
    const isPr = planIsActive(row?.pr_plan) || planIsActive(formData?.pr_plan);
    const isFeatured = planIsActive(row?.featured_plan) || planIsActive(formData?.featured_plan);
    const recruitStatusRaw =
      safeText(row.status_label, "") ||
      pickBusinessText(row, formData, "recruit_status") ||
      businessRecruitLabel(row?.status) ||
      (window.TasuBusinessWording?.defaultRecruitStatus || "受付中");
    const recruitStatus = window.TasuBusinessWording?.formatRecruitStatus
      ? window.TasuBusinessWording.formatRecruitStatus(recruitStatusRaw)
      : recruitStatusRaw;
    const statusLabel = recruitStatus;
    const recruitStatusMod = resolveRecruitStatusMod(recruitStatus, row?.status);
    const taxiBaseFare = isTransportCat(cat) ? pickTaxiText(row, formData, "taxi_base_fare") : "";
    const budgetAmount =
      taxiBaseFare ||
      pickFormDataText(row, formData, "main_price_text") ||
      pickBusinessText(row, formData, "budget_amount", [
        "budget",
        "unit_price",
        "price_text",
      ]);
    const contractPeriod = pickBusinessText(row, formData, "contract_period", ["period"]);
    const contactMethod =
      pickBusinessText(row, formData, "contact_method") || "サイト内チャット";
    const mergedCategoryExtra = mergeTaxiCategoryExtra(
      row,
      formData,
      pickCategoryExtra(row, formData)
    );
    const partnerRegistration = resolveConstructionPartnerRegistration(
      { ...formData, category_extra: mergedCategoryExtra },
      cat
    );
    const hasPartnerRegistration =
      isConstructionCat(cat) &&
      Boolean(partnerRegistration) &&
      partnerRegistration !== "希望しない";

    const priorityScore = computeBusinessPriorityScore({
      isPr,
      isFeatured,
      appConditions,
      statusLabel,
    });

    const budgetLabel = budgetAmount || "見積要相談";
    const contractLabel = contractPeriod || "未設定";
    const contactMethodDisplayLabel = formatContactMethodDisplay(contactMethod) || "—";
    const constructionBadges = buildConstructionServiceBadges(
      cat,
      { ...formData, category_extra: mergedCategoryExtra },
      hasPartnerRegistration
    );
    const taxiBadges = buildTaxiServiceBadges(cat, row, {
      ...formData,
      category_extra: mergedCategoryExtra,
    });
    const taxiBookingTypes = pickTaxiBookingTypes(row, formData, mergedCategoryExtra);
    const taxiBookingBadges = isTransportCat(cat) ? buildTaxiBookingBadges(taxiBookingTypes) : [];
    const displayConditionBadges = mergeBusinessDisplayBadges(
      conditionBadges,
      isTransportCat(cat)
        ? mergeBusinessDisplayBadges(taxiBadges, taxiBookingBadges)
        : constructionBadges
    );
    const licenseLineRaw = safeText(row.license_info, "") || safeText(formData.license_info, "");
    const licenseLine = window.TasuBusinessWording?.formatLicenseLine
      ? window.TasuBusinessWording.formatLicenseLine(licenseLineRaw) || licenseLineRaw
      : licenseLineRaw;
    const coveragePreset =
      pickBusinessText(row, formData, "coverage_short", [
        "board_coverage_short",
        "service_coverage",
      ]) || "";
    const trustPreset =
      pickBusinessText(row, formData, "trust_short", ["board_trust_short"]) || "";
    const taxiServiceType = pickTaxiText(row, formData, "taxi_service_type");
    const taxiAreaType = pickTaxiText(row, formData, "taxi_area_type");
    const boardListingStub = {
      business_category: cat,
      title: row.title || "",
      description: row.description || "",
      licenseLine,
      license_info: row.license_info,
      boardCoverageShort: coveragePreset,
      boardTrustShort: trustPreset,
      taxiServiceType,
      taxiAreaType,
      taxiBaseFare: taxiBaseFare || budgetAmount,
    };
    const boardCoverageShort = window.TasuBusinessWording?.pickBoardCoverageShort
      ? window.TasuBusinessWording.pickBoardCoverageShort(boardListingStub)
      : truncateText(row.title || "", 40);
    const boardTrustShort = window.TasuBusinessWording?.pickBoardTrustShort
      ? window.TasuBusinessWording.pickBoardTrustShort(boardListingStub)
      : truncateText(licenseLine, 52);
    const serviceSummary = boardCoverageShort;

    return {
      id: row.id,
      source: row._source || "supabase",
      listing_type: "business",
      type: "business",
      targetType: "business",
      business_category: cat,
      title: row.title || "",
      description: row.description || "",
      tags,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      company_name: row.company_name,
      company_id: row.company_id || null,
      company_rating_avg:
        row.company_rating_avg != null ? Number(row.company_rating_avg) : null,
      company_review_count:
        row.company_review_count != null ? Number(row.company_review_count) : null,
      service_area:
        isTransportCat(cat) && taxiAreaType
          ? [row.service_area, taxiAreaType].filter(Boolean).join(" / ") || row.service_area
          : row.service_area,
      taxi_service_type: taxiServiceType,
      taxi_vehicle_type: pickTaxiText(row, formData, "taxi_vehicle_type"),
      taxi_area_type: taxiAreaType,
      taxi_airport_transfer: pickTaxiText(row, formData, "taxi_airport_transfer"),
      taxi_24h_available: pickTaxiText(row, formData, "taxi_24h_available"),
      taxi_reservation_available: pickTaxiText(row, formData, "taxi_reservation_available"),
      taxi_corporate_contract: pickTaxiText(row, formData, "taxi_corporate_contract"),
      taxi_invoice_available: pickTaxiText(row, formData, "taxi_invoice_available"),
      taxi_payment_methods:
        row.taxi_payment_methods ?? formData.taxi_payment_methods ?? [],
      taxi_base_fare: taxiBaseFare,
      taxi_night_fare: pickTaxiText(row, formData, "taxi_night_fare"),
      taxi_route_price: pickTaxiText(row, formData, "taxi_route_price"),
      taxi_capacity: pickTaxiText(row, formData, "taxi_capacity"),
      taxi_language_support: pickTaxiText(row, formData, "taxi_language_support"),
      taxi_child_seat: pickTaxiText(row, formData, "taxi_child_seat"),
      taxi_booking_types: taxiBookingTypes,
      phone: row.phone,
      license_info: row.license_info,
      business_hours: row.business_hours,
      price_amount: null,
      priceText: budgetLabel,
      budgetText: budgetLabel,
      budgetLabel,
      paymentType: pickBusinessText(row, formData, "payment_type"),
      paymentTypeLabel: pickBusinessText(row, formData, "payment_type") || "—",
      startDateText: pickBusinessText(row, formData, "start_date"),
      periodText: contractLabel,
      contractPeriod: contractLabel,
      contractLabel,
      qualificationText: safeText(row.license_info, "—") || "—",
      headcountText:
        pickBusinessText(row, formData, "recruit_count", ["headcount"]) || "—",
      recruitStatus,
      recruitStatusMod,
      applicationConditions: appConditions,
      conditionBadges: displayConditionBadges,
      serviceSummary,
      boardCoverageShort,
      boardTrustShort,
      licenseLine,
      contactMethod,
      contactMethodLabel: contactMethod,
      contactMethodDisplayLabel,
      hasPartnerRegistration,
      partnerRegistration,
      priorityScore,
      imageUrl: pickBusinessImage(row),
      isPr,
      isFeatured,
      isFeaturedSlot: isFeatured,
      status: row.status || "available",
      statusLabel,
      recruitLabel: statusLabel,
      categoryLabel:
        safeText(formData.category_label, "") || bizCatLabel(cat, formData) || cat,
      shopBreadcrumbGenre:
        window.TasuBusinessCategories?.getBusinessType?.({
          business_category: cat,
          form_data: formData,
          products: row.products,
          category_extra: mergedCategoryExtra,
        }) === "shop_store" && window.TasuBusinessWording?.pickStoreShopBreadcrumbGenre
          ? window.TasuBusinessWording.pickStoreShopBreadcrumbGenre({
              category_extra: mergedCategoryExtra,
              form_data: formData,
              service_tags: row.service_tags || [],
              categoryLabel:
                safeText(formData.category_label, "") || bizCatLabel(cat, formData) || cat,
            })
          : undefined,
      business_subcategory:
        safeText(row.business_subcategory, "") || safeText(formData.business_subcategory, "") || "",
      service_tags: row.service_tags || [],
      service_features: row.service_features || [],
      repair_services: pickBusinessRepairServices(row, formData),
      work_cases: pickBusinessWorkCases(row, formData),
      price_guides: row.price_guides || [],
      option_items: Array.isArray(row.option_items)
        ? row.option_items
        : Array.isArray(formData.option_items)
          ? formData.option_items
          : [],
      service_menu_items: pickBusinessServiceMenuItems(row, formData),
      products: pickFormDataJsonArray(row, formData, "products").length
        ? pickFormDataJsonArray(row, formData, "products")
        : Array.isArray(row.products)
          ? row.products
          : [],
      shop_news: pickFormDataJsonArray(row, formData, "shop_news").length
        ? pickFormDataJsonArray(row, formData, "shop_news")
        : [],
      cleaning_services: (() => {
        const fd = formData && typeof formData === "object" ? formData : {};
        const fromFdClean = parseJsonArray(fd.cleaning_services);
        if (fromFdClean.length) return fromFdClean;
        return pickBusinessRepairServices(row, formData);
      })(),
      support_conditions: pickBusinessSupportConditions(row, formData),
      license_items: pickFormDataJsonArray(row, formData, "license_items"),
      faq_items: pickFormDataJsonArray(row, formData, "faq_items"),
      main_price_label: pickFormDataText(row, formData, "main_price_label"),
      main_price_text: pickFormDataText(row, formData, "main_price_text"),
      emergency_label: pickFormDataText(row, formData, "emergency_label"),
      response_time: pickFormDataText(row, formData, "response_time"),
      target_users: pickFormDataText(row, formData, "target_users"),
      status_label:
        safeText(row.status_label, "") || pickFormDataText(row, formData, "status_label"),
      pr_plan: pickFormDataText(row, formData, "pr_plan") || row.pr_plan || "none",
      featured_plan:
        pickFormDataText(row, formData, "featured_plan") || row.featured_plan || "none",
      account: row.company_name || "",
      company_name: row.company_name,
      publishedLabel: formatDate(row.created_at),
      updatedLabel: formatDate(row.updated_at || row.created_at),
      invoice_support: row.invoice_support,
      isUrgent: appConditions.includes("急募") || /急募|至急|urgent/i.test(tagText),
      isStartSoon:
        appConditions.includes("すぐ開始") || /すぐ|即日|start.?soon/i.test(tagText),
      needsLicense:
        appConditions.includes("資格必須") ||
        Boolean(row.license_info && String(row.license_info).trim()),
      isLongTerm: appConditions.includes("長期歓迎") || /長期|継続/i.test(tagText),
      isCorporateWelcome: /法人歓迎|法人対応/i.test(tagText),
      isVerified: /審査済|認証済|verified/i.test(tagText),
      hp_url: safeText(row.hp_url, "") || safeText(formData.hp_url, ""),
      google_map_url:
        safeText(row.google_map_url, "") || safeText(formData.google_map_url, ""),
      achievements: pickFormDataText(row, formData, "achievements"),
      payment_url: safeText(row.payment_url, ""),
      bank_transfer_info: safeText(row.bank_transfer_info, ""),
      pr_payment_url:
        safeText(row.pr_payment_url, "") || safeText(formData.pr_payment_url, ""),
      pr_bank_info: safeText(row.pr_bank_info, "") || safeText(formData.pr_bank_info, ""),
      featured_payment_url:
        safeText(row.featured_payment_url, "") ||
        safeText(formData.featured_payment_url, ""),
      featured_bank_info:
        safeText(row.featured_bank_info, "") || safeText(formData.featured_bank_info, ""),
      form_data: formData,
      business_type:
        safeText(row.business_type, "") ||
        safeText(formData.business_type, "") ||
        (window.TasuBusinessCategories?.getBusinessType?.({
          business_category: cat,
          form_data: formData,
          products: row.products,
          category_extra: mergedCategoryExtra,
        }) ||
          ""),
      category_extra: mergedCategoryExtra,
      galleryUrls: collectBusinessGalleryUrls(row, formData),
      gallery_urls: (() => {
        const fromGallery = businessRowUrlArray(row, "gallery_urls");
        return fromGallery.length ? fromGallery : businessRowUrlArray(row, "images");
      })(),
      images: (() => {
        const fromImages = businessRowUrlArray(row, "images");
        return fromImages.length ? fromImages : businessRowUrlArray(row, "gallery_urls");
      })(),
      image_url: pickBusinessImage(row) || row.image_url || null,
      thumbnail_url: row.thumbnail_url || null,
      main_image_url: row.main_image_url || row.image_url || null,
    };
  }

  function collectBusinessGalleryImages(row, formData) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const buckets = [
      row?.gallery_images,
      fd.gallery_images,
      row?.sub_images,
      fd.sub_images,
    ];
    const seen = new Set();
    const out = [];
    buckets.forEach((bucket) => {
      const arr = coerceListingImagesArray(bucket);
      arr.forEach((item) => {
        const url = resolveBusinessImageCandidate(item);
        if (!url || seen.has(url)) return;
        seen.add(url);
        out.push(url);
      });
    });
    if (out.length) return out;

    const primary = pickBusinessImage(row);
    const legacyBuckets = [
      row?.gallery_urls,
      fd.gallery_urls,
      row?.images,
      fd.images,
    ];
    legacyBuckets.forEach((bucket) => {
      const arr = coerceListingImagesArray(bucket);
      arr.forEach((item) => {
        const url = resolveBusinessImageCandidate(item);
        if (!url || seen.has(url) || (primary && url === primary)) return;
        seen.add(url);
        out.push(url);
      });
    });
    return out;
  }

  function collectBusinessGalleryUrls(row, formData) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const buckets = [
      row?.gallery_urls,
      fd.gallery_urls,
      row?.images,
      fd.images,
    ];
    const seen = new Set();
    const out = [];
    buckets.forEach((bucket) => {
      const arr = coerceListingImagesArray(bucket);
      arr.forEach((item) => {
        const url = resolveBusinessImageCandidate(item);
        if (!url || seen.has(url)) return;
        seen.add(url);
        out.push(url);
      });
    });
    const primary = pickBusinessImage(row);
    if (primary && !seen.has(primary)) {
      out.unshift(primary);
    } else if (primary) {
      const idx = out.indexOf(primary);
      if (idx > 0) {
        out.splice(idx, 1);
        out.unshift(primary);
      }
    }
    return out;
  }

  function businessRecruitLabel(status) {
    const open = window.TasuBusinessWording?.RECRUIT_STATUS?.OPEN || "受付中";
    const unavailable =
      window.TasuBusinessWording?.RECRUIT_STATUS?.UNAVAILABLE || "対応不可";
    if (status === "available") return open;
    if (status === "busy") return "対応中";
    if (status === "closed") return unavailable;
    return open;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  function getDetailUrl(listing) {
    const id = String(listing?.id || listing?.target_id || listing?.targetId || "").trim();
    if (!id) {
      console.warn("[TasuListingRenderer] detail link: missing listing.id", listing);
      return "#";
    }

    if (window.TasuSearch?.getDetailUrl) {
      const type = String(listing.type || listing.listing_type || listing.targetType || "").trim();
      const businessType =
        String(listing.business_type || listing.form_data?.business_type || "").trim() ||
        (type === "business" && window.TasuBusinessCategories?.getBusinessType
          ? window.TasuBusinessCategories.getBusinessType(listing)
          : "");
      return window.TasuSearch.getDetailUrl({
        type: type || listing.type,
        target_type: listing.targetType || listing.target_type || type,
        target_id: id,
        id,
        business_type: businessType,
        form_data: listing.form_data,
      });
    }
    const map = {
      product: `detail-product.html?id=${encodeURIComponent(id)}`,
      skill: `detail-skill.html?id=${encodeURIComponent(id)}`,
      job: `detail-job.html?id=${encodeURIComponent(id)}`,
      worker: `detail-worker.html?id=${encodeURIComponent(id)}`,
      business: (() => {
        const bt =
          String(listing.business_type || listing.form_data?.business_type || "").trim() ||
          (window.TasuBusinessCategories?.getBusinessType?.(listing) || "");
        const enc = encodeURIComponent(id);
        if (bt === "shop_store") return `detail-shop.html?id=${enc}`;
        return `detail-business-service.html?id=${enc}`;
      })(),
    };
    return map[listing.type] || "#";
  }

  function truncateText(text, maxLen) {
    const s = safeText(text, "");
    if (!s || s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  }

  function resolveProductForCard(listing) {
    if (listing?.productNormalized) return listing.productNormalized;
    if (!window.TasuProductListingFields?.normalizeProductListing) return null;
    return window.TasuProductListingFields.normalizeProductListing({
      id: listing.id,
      listing_type: "product",
      type: "product",
      title: listing.title,
      description: listing.description,
      tags: listing.tags,
      category: listing.category,
      subcategory: listing.subcategory,
      price_amount: listing.price_amount,
      image_url: listing.image_url,
      thumbnail_url: listing.thumbnail_url,
      form_data: listing.form_data,
    });
  }

  function coerceListingImagesArray(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /** 一覧商品カード画像 — image_url → thumbnail_url → images[0] */
  function resolveProductListCardImage(listing, title) {
    const normalize =
      window.TasuListingImages?.normalizeImageUrl?.bind(window.TasuListingImages) ||
      ((raw) => safeText(raw, ""));

    const pick = (raw) => {
      const url = normalize(raw);
      return url || "";
    };

    const fromRow =
      pick(listing?.image_url) ||
      pick(listing?.thumbnail_url) ||
      pick(coerceListingImagesArray(listing?.images)[0]);

    const product = resolveProductForCard(listing);
    const fromProduct =
      pick(product?.image) ||
      pick(product?.thumbnail) ||
      pick(coerceListingImagesArray(product?.gallery)[0]);

    const main = fromRow || fromProduct;
    const placeholder =
      window.TasuListingImages?.placeholderUrl?.(title, "card") ||
      `https://placehold.co/480x320/f3ead4/967622?text=${encodeURIComponent(
        String(title || "商品").slice(0, 1)
      )}`;

    if (!main) {
      return { main: placeholder, isPlaceholder: true };
    }
    return { main, isPlaceholder: false };
  }

  function getProductDetailUrl(listing) {
    const id = safeText(listing?.id, "");
    if (!id) return "#";
    if (window.TasuSearch?.getDetailUrl) {
      return window.TasuSearch.getDetailUrl({
        type: "product",
        target_type: "product",
        target_id: id,
        id,
      });
    }
    return `detail-product.html?id=${encodeURIComponent(id)}`;
  }

  function formatProductCardPrice(product, listing) {
    const raw =
      product?.price?.text ||
      (listing.price_amount != null && !Number.isNaN(Number(listing.price_amount))
        ? `¥${Number(listing.price_amount).toLocaleString("ja-JP")}`
        : safeText(listing.priceText, ""));
    if (!raw || raw === "要相談") return "相談可";
    if (
      Array.isArray(product?.options) &&
      product.options.length > 0 &&
      !/[〜~]/.test(raw)
    ) {
      return `${raw}〜`;
    }
    return raw;
  }

  function buildProductFeatureItems(product, listing) {
    const items = [];
    const push = (icon, label) => {
      const text = safeText(label, "");
      if (!text) return;
      items.push({ icon, label: text });
    };

    push("◆", product?.condition);
    push("◇", product?.deliveryMethod);
    if (product?.stockCount) {
      push("▣", `在庫 ${product.stockCount}`);
    }

    const fd =
      listing?.form_data && typeof listing.form_data === "object"
        ? listing.form_data
        : {};
    const badges = Array.isArray(fd.badges) ? fd.badges : [];
    badges.forEach((badge) => {
      const label = safeText(badge, "");
      if (!label) return;
      if (
        PRODUCT_FEATURE_BADGE_HINTS.some(
          (hint) => label.includes(hint) || hint.includes(label)
        )
      ) {
        push("✓", label);
      }
    });

    return items.slice(0, 6);
  }

  function resolveSellerUserId(listing) {
    return (
      safeText(listing.user_id, "") ||
      safeText(listing.userId, "") ||
      safeText(listing.seller_id, "") ||
      ""
    );
  }

  function buildPremiumSellerPlaceholderHtml(userId, listing) {
    const Seller = window.TasuListingSellerProfile;
    const uid = safeText(userId, "");
    const demo = uid && Seller?.resolveDemoProfile ? Seller.resolveDemoProfile(uid) : null;
    const avatarSrc =
      demo?.avatarUrl ||
      (Seller?.formatHandle
        ? `https://placehold.co/88x88/f3ead4/967622?text=${encodeURIComponent(
            String(demo?.displayName || "出品").slice(0, 1)
          )}`
        : "https://placehold.co/88x88/f3ead4/967622?text=+");
    const displayName = safeText(demo?.displayName, "出品者");
    const handleText = Seller?.formatHandle
      ? Seller.formatHandle(demo?.handle, uid)
      : uid
        ? `@${uid.slice(0, 14)}`
        : "@seller";

    return `
      <div class="premium-listing-seller" data-listing-seller data-premium-seller-host data-seller-user-id="${escapeAttr(uid)}" aria-label="出品者">
        <div class="premium-listing-seller__row">
          <div class="premium-listing-seller__avatar-wrap">
            <img class="profile-avatar rank-new" data-seller-avatar src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(displayName)}のプロフィール" width="44" height="44" loading="lazy" decoding="async">
          </div>
          <div class="premium-listing-seller__identity">
            <p class="seller-name rank-new" data-seller-display-name>${escapeHtml(displayName)}</p>
            <p class="premium-listing-seller__handle" data-seller-handle>${escapeHtml(handleText)}</p>
            <span class="seller-rank-chip rank-new" data-seller-rank-chip hidden>NEW</span>
          </div>
          <div class="premium-listing-seller__presence">
            <span class="skill-seller-premium__status-dot skill-seller-premium__status-dot--offline" data-seller-status-dot aria-hidden="true"></span>
            <span class="premium-listing-seller__status-label is-offline" data-seller-status-label>—</span>
          </div>
        </div>
        <div class="premium-listing-seller__metrics" data-premium-seller-metrics hidden></div>
      </div>`;
  }

  const LIST_CARD_RANK_CLASSES = [
    "list-card--rank-new",
    "list-card--rank-bronze",
    "list-card--rank-silver",
    "list-card--rank-gold",
    "list-card--rank-platinum",
    "list-card--rank-legend",
  ];

  function resolveListCardAvailability(listing, profile) {
    const status = String(profile?.availabilityStatus || "").trim().toLowerCase();
    if (status === "online") {
      return { label: "対応可能", tone: "online" };
    }
    if (status === "busy") {
      return { label: "対応中", tone: "busy" };
    }
    if (status === "away") {
      return { label: "離席中", tone: "away" };
    }

    const listingStatus = String(
      listing?.status || listing?.publish_status || ""
    )
      .trim()
      .toLowerCase();
    if (
      listingStatus === "open" ||
      listingStatus === "available" ||
      listingStatus === "recruiting" ||
      listingStatus === "public"
    ) {
      return { label: "対応可能", tone: "online" };
    }

    return null;
  }

  /** 一覧評価 — ★4.8 (52) 形式（件数のみ・短表記） */
  function buildListCardRatingHtml(average, reviewCount) {
    const score = safeText(average, "");
    if (!score) return "";

    const countNum = Number(reviewCount);
    const countHtml =
      Number.isFinite(countNum) && countNum > 0
        ? `<span class="list-card-seller__rating-count" data-seller-rating-count>(${escapeHtml(
            String(Math.floor(countNum))
          )})</span>`
        : "";

    return `<span class="list-card-seller__rating-score" data-seller-rating-score>★${escapeHtml(
      score
    )}</span>${countHtml}`;
  }

  function buildListCardRatingUiFixedHtml() {
    return buildListCardRatingHtml("4.8", 52);
  }

  function setListCardRatingElement(el, average, reviewCount) {
    if (!el) return false;
    const html = buildListCardRatingHtml(average, reviewCount);
    if (!html) {
      el.innerHTML = "";
      el.hidden = true;
      el.removeAttribute("aria-label");
      return false;
    }
    el.innerHTML = html;
    el.hidden = false;
    const countNum = Number(reviewCount);
    const label =
      Number.isFinite(countNum) && countNum > 0
        ? `評価 ${average}、${Math.floor(countNum)}件`
        : `評価 ${average}`;
    el.setAttribute("aria-label", label);
    return true;
  }

  function applyListCardRankAccent(card, rankClass) {
    if (!card) return;
    const rank = safeText(rankClass, "new");
    LIST_CARD_RANK_CLASSES.forEach((cls) => card.classList.remove(cls));
    card.classList.add(`list-card--rank-${rank}`);
    card.dataset.sellerRank = rank;
  }

  function applyListCardSellerMeta(host, listing, profile, trust) {
    if (!host) return;

    const ratingEl = host.querySelector(
      "[data-seller-rating]:not([data-list-card-rating-ui])"
    );
    const ratingUiFixed = host.querySelector("[data-list-card-rating-ui]");
    const availabilityEl = host.querySelector("[data-seller-availability]");
    const availabilityLabelEl = host.querySelector("[data-seller-availability-label]");

    let hasLiveRating = false;
    if (ratingEl && trust?.variant === "rated" && trust.average) {
      hasLiveRating = setListCardRatingElement(
        ratingEl,
        trust.average,
        trust.total
      );
      if (hasLiveRating && ratingUiFixed) {
        ratingUiFixed.hidden = true;
      }
    } else if (ratingEl) {
      ratingEl.innerHTML = "";
      ratingEl.hidden = true;
      ratingEl.removeAttribute("aria-label");
    }
    if (ratingUiFixed && !hasLiveRating) {
      ratingUiFixed.hidden = false;
    }

    const availability = resolveListCardAvailability(listing, profile);
    if (availabilityEl && availabilityLabelEl) {
      if (availability) {
        availabilityEl.hidden = false;
        availabilityEl.classList.remove(
          "is-online",
          "is-busy",
          "is-away"
        );
        availabilityEl.classList.add(`is-${availability.tone}`);
        availabilityLabelEl.textContent = availability.label;
        availabilityEl.setAttribute("aria-label", availability.label);
      } else {
        availabilityEl.hidden = true;
        availabilityLabelEl.textContent = "";
      }
    }
  }

  /** 一覧カード共通 — 画像下・横並び出品者（ランク色は seller-rank-plate.css） */
  function buildListCardSellerBlockHtml(listing, sellerUserId) {
    const uid = safeText(sellerUserId, "");
    const Seller = window.TasuListingSellerProfile;
    const demo = uid && Seller?.resolveDemoProfile ? Seller.resolveDemoProfile(uid) : null;
    const displayName = safeText(demo?.displayName, "出品者");
    const handleText = Seller?.formatHandle
      ? Seller.formatHandle(demo?.handle, uid)
      : uid
        ? `@${uid.replace(/^@/, "").slice(0, 20)}`
        : "@—";
    const avatarSrc =
      demo?.avatarUrl ||
      (Seller?.formatHandle
        ? `https://placehold.co/88x88/f3ead4/967622?text=${encodeURIComponent(
            String(displayName).slice(0, 1)
          )}`
        : "https://placehold.co/88x88/f3ead4/967622?text=+");

    const previewAvailability = resolveListCardAvailability(listing, demo);
    const ratingUiHtml = buildListCardRatingUiFixedHtml();

    return `
      <div class="card__profile list-card-seller product-list-seller" data-premium-seller-host data-seller-user-id="${escapeAttr(uid)}" aria-label="出品者">
        <div class="list-card-seller__row">
          <div class="list-card-seller__avatar-wrap">
            <img class="profile-avatar rank-new list-card-seller__avatar" data-seller-avatar src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(displayName)}のプロフィール" width="44" height="44" loading="lazy" decoding="async">
          </div>
          <div class="list-card-seller__identity">
            <div class="list-card-seller__name-line">
              <span class="seller-rank-chip rank-new" data-seller-rank-chip>NEW</span>
              <p class="list-card-seller__name seller-name rank-new" data-seller-display-name>${escapeHtml(displayName)}</p>
            </div>
            <p class="list-card-seller__handle" data-seller-handle>${escapeHtml(handleText)}</p>
            <div class="list-card-seller__meta">
              <p class="list-card-seller__rating list-card-seller__rating--ui-fixed" data-list-card-rating-ui data-seller-rating aria-label="評価 4.8、52件">${ratingUiHtml}</p>
              <p class="list-card-seller__availability${previewAvailability ? ` is-${previewAvailability.tone}` : ""}" data-seller-availability${previewAvailability ? "" : " hidden"}">
                <span class="list-card-seller__status-dot" aria-hidden="true"></span>
                <span data-seller-availability-label>${escapeHtml(previewAvailability?.label || "")}</span>
              </p>
            </div>
          </div>
        </div>
      </div>`;
  }

  function buildProductListSellerBlockHtml(listing, sellerUserId) {
    return buildListCardSellerBlockHtml(listing, sellerUserId);
  }

  async function hydrateProductListCardSellerHost(host, listingContext) {
    if (!host || host.dataset.sellerHydrated === "1") return null;

    const userId = safeText(host.dataset.sellerUserId, "");
    if (!userId || !window.TasuListingSellerProfile?.fetchSellerProfile) {
      return null;
    }

    const card = host.closest(".list-card");
    const listing =
      listingContext ||
      (card
        ? {
            status: card.dataset.status,
            publish_status: card.dataset.publishStatus,
          }
        : {});

    host.dataset.sellerHydrated = "1";
    const profile = await window.TasuListingSellerProfile.fetchSellerProfile(userId, {});

    if (window.TasuListingSellerProfile.applySellerRankDisplay) {
      window.TasuListingSellerProfile.applySellerRankDisplay(host, profile);
    }

    const rankClass = window.TasuListingSellerProfile.resolveRankPlateImageKey
      ? window.TasuListingSellerProfile.resolveRankPlateImageKey(
          profile.rankKey || profile.memberRank
        )
      : "new";

    if (card) {
      applyListCardRankAccent(card, rankClass);
    }

    let trust = null;
    if (window.TasuDetailTrustScore?.fetchReviewScore) {
      const row = await window.TasuDetailTrustScore.fetchReviewScore(userId);
      trust = window.TasuDetailTrustScore.formatTrustDisplay(row);
    }

    applyListCardSellerMeta(host, listing, profile, trust);

    const nameEl = host.querySelector("[data-seller-display-name]");
    if (nameEl) {
      nameEl.textContent = safeText(profile.displayName, "出品者");
    }

    const handleEl = host.querySelector("[data-seller-handle]");
    if (handleEl && window.TasuListingSellerProfile.formatHandle) {
      handleEl.textContent = window.TasuListingSellerProfile.formatHandle(
        profile.handle,
        profile.userId
      );
    }

    const avatarEl = host.querySelector("[data-seller-avatar]");
    if (avatarEl && profile.avatarUrl) {
      avatarEl.src = profile.avatarUrl;
      avatarEl.alt = `${safeText(profile.displayName, "出品者")}のプロフィール`;
    }

    const statEl = card?.querySelector("[data-list-card-stat]");
    const dealsNum = Number(profile.dealsCount);
    if (statEl && Number.isFinite(dealsNum) && dealsNum > 0) {
      statEl.innerHTML = `<span class="list-card__stat-icon" aria-hidden="true">◎</span>実績 ${dealsNum.toLocaleString("ja-JP")}件`;
      statEl.setAttribute("aria-label", `実績 ${dealsNum}件`);
    }

    return profile;
  }

  async function hydrateListCardSellers(root = document) {
    const hosts = root.querySelectorAll(
      ".list-card-seller[data-premium-seller-host]:not([data-seller-hydrated])"
    );
    if (!hosts.length) return;

    await Promise.all([...hosts].map((host) => hydrateProductListCardSellerHost(host)));
  }

  async function hydrateProductListCardSellers(root = document) {
    return hydrateListCardSellers(root);
  }

  async function hydratePremiumProductCardSellers(root = document) {
    await hydrateListCardSellers(root);
    if (window.TasuListingSellerProfile?.hydratePremiumProductCardSellers) {
      return window.TasuListingSellerProfile.hydratePremiumProductCardSellers(root);
    }
    return undefined;
  }

  /** 一覧カード — 本体クリックで詳細へ（CTA・お気に入りは除外） */
  function bindListCardNavigation(cardRoot) {
    const article =
      cardRoot?.classList?.contains("list-card") || cardRoot?.classList?.contains("product-list-card")
        ? cardRoot
        : cardRoot?.closest?.(".list-card, .product-list-card");
    if (!article || article.dataset.listCardNavBound === "1") return;

    const href = safeText(
      article.dataset.listCardHref ||
        article.dataset.productListHref ||
        article.dataset.listingListHref,
      ""
    );
    if (!href || href === "#") return;

    article.dataset.listCardNavBound = "1";
    article.dataset.productListNavBound = "1";
    article.classList.add("list-card--navigable", "product-list-card--navigable");

    const goDetail = () => {
      window.location.assign(href);
    };

    article.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (
        event.target.closest(
          ".card__footer .card__button, .list-card__cta, .product-list-card__cta, [data-favorite-button], [data-tasu-favorite], button"
        )
      ) {
        return;
      }
      if (event.target.closest("a")) {
        return;
      }
      goDetail();
    });

    article.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (
        event.target.closest(
          ".card__footer .card__button, .list-card__cta, .product-list-card__cta, [data-favorite-button], [data-tasu-favorite], button, a"
        )
      ) {
        return;
      }
      event.preventDefault();
      goDetail();
    });
  }

  function bindListCardActions(cardRoot) {
    if (!cardRoot) return;
    cardRoot
      .querySelectorAll(".card__footer .card__button, .list-card__cta, .product-list-card__cta")
      .forEach((link) => {
        if (link.dataset.listCardActionBound === "1") return;
        link.dataset.listCardActionBound = "1";
        link.dataset.productListActionBound = "1";
        link.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      });
  }

  function bindProductListCardNavigation(cardRoot) {
    return bindListCardNavigation(cardRoot);
  }

  function bindProductListCardActions(cardRoot) {
    return bindListCardActions(cardRoot);
  }

  /** 一覧カード共通（商品・スキル・求人・ワーカー・無料記事） */
  function renderPlatformBadgesHtml(listing, ctx) {
    const badges = window.TasuPlatformBadges;
    if (!badges?.renderBadgesHtml) return "";
    const searchCtx = ctx || window.TasuPlatformSearchHub?.getSearchContext?.() || {};
    return badges.renderBadgesHtml(listing, searchCtx);
  }

  function syncPlatformListingBadges(root, listings) {
    if (Array.isArray(listings) && listings.length && window.TasuPlatformSearchHub?.setListingPool) {
      window.TasuPlatformSearchHub.setListingPool(listings);
    }
    const host = root || document;
    window.TasuPlatformBadges?.bindRecommendPopovers?.(host);
  }

  function buildUnifiedListCardElement(listing) {
    const li = document.createElement("li");
    li.className = "card-list__item";
    li.dataset.filterable = "";

    const type = String(listing.type || listing.listing_type || "")
      .trim()
      .toLowerCase();
    const isProduct = type === "product";
    const product = isProduct ? resolveProductForCard(listing) : null;
    const id = listing.id;
    const detailUrl = isProduct ? getProductDetailUrl(listing) : getDetailUrl(listing);
    const isFeaturedSlot = Boolean(
      listing.isFeaturedSlot ??
        (window.TasuListingFeatured?.isFeaturedSlotActive
          ? window.TasuListingFeatured.isFeaturedSlotActive(listing)
          : window.TasuListingFeatured?.isActive?.(listing))
    );
    const isPr = listing.isPr;
    const isPaid = isFeaturedSlot || isPr;
    const cardClass = isPr ? "card card--premium" : "card card--free";
    const cardExtraClass = `list-card list-card--horizontal${isProduct ? " product-list-card" : ""}${
      isFeaturedSlot ? " is-featured" : ""
    }`;
    const cardTitleText = resolveListingCardTitle(listing, product);
    const cardPriceText = isProduct
      ? formatProductCardPrice(product, listing)
      : resolveCardPriceText(listing);
    const cta = CTA_BY_TYPE[type] || "詳細を見る";

    let imageSrc;
    let imageClass;
    let imagePreserveAttr = "";
    if (isProduct) {
      const image = resolveProductListCardImage(listing, cardTitleText);
      imageSrc = image.main;
      imageClass = image.isPlaceholder
        ? "card__image card__image--placeholder"
        : "card__image";
      imagePreserveAttr = image.isPlaceholder ? "" : ' data-preserve-image="1"';
    } else {
      const hasImage = Boolean(listing.imageUrl);
      imageSrc = hasImage
        ? listing.imageUrl
        : window.TasuListingImages?.placeholderUrl
          ? window.TasuListingImages.placeholderUrl(cardTitleText, "card")
          : `https://placehold.co/480x320/f3ead4/967622?text=${encodeURIComponent(
              String(cardTitleText).charAt(0)
            )}`;
      imageClass = hasImage ? "card__image" : "card__image card__image--placeholder";
    }

    const displayTags = (
      isProduct
        ? product?.tags || listing.displayTags || listing.tags || []
        : listing.displayTags || listing.tags || []
    )
      .filter(Boolean)
      .slice(0, 6);

    const dateNum = listing.created_at
      ? Number(String(listing.created_at).replace(/\D/g, "").slice(0, 8)) || 20260101
      : 20260101;
    const priceNum = listing.price_amount != null ? Number(listing.price_amount) : 0;

    const tagHtml = displayTags.length
      ? displayTags.map((t) => `<li class="card__tag">${escapeHtml(safeText(t, ""))}</li>`).join("")
      : '<li class="card__tag card__tag--empty">タグ未設定</li>';

    const platformBadgesHtml = renderPlatformBadgesHtml(listing);

    const decorParts = [];
    if (isFeaturedSlot) {
      decorParts.push('<span class="list-card-featured-badge">上位掲載</span>');
    }
    if (isPr) {
      decorParts.push('<span class="featured-card__pr-badge">PR</span>');
    }
    const decor = decorParts.length
      ? `<div class="card__decor" aria-hidden="true">${decorParts.join("")}</div>`
      : "";

    const sellerUserId = resolveSellerUserId(listing);
    const sellerHtml = buildListCardSellerBlockHtml(listing, sellerUserId);
    const buttonClass =
      isFeaturedSlot || isPr
        ? "card__button list-card__cta product-list-card__cta"
        : "card__button card__button--outline list-card__cta product-list-card__cta";
    const mediaWrapClass = isProduct
      ? "card__media-wrap product-list-media list-card-media"
      : "card__media-wrap list-card-media";
    const mediaLinkClass = isProduct
      ? "card__media product-list-card__media-link list-card__media-link"
      : "card__media list-card__media-link";

    const articleAttrs = `
        data-listing-id="${escapeAttr(id)}"
        data-list-card-href="${escapeAttr(detailUrl)}"
        data-product-list-href="${escapeAttr(detailUrl)}"
        data-premium="${isPaid ? "true" : "false"}"
        data-listing-title="${escapeAttr(cardTitleText)}"
        data-job-title="${escapeAttr(listing.job_title || "")}"
        data-service-name="${escapeAttr(listing.service_name || "")}"
        data-product-name="${escapeAttr(listing.name || "")}"
        data-category="${escapeAttr(type)}"
        data-type="${escapeAttr(type)}"
        data-target-type="${escapeAttr(listing.targetType || type)}"
        data-target-id="${escapeAttr(id)}"
        data-rank="${isFeaturedSlot ? "premium" : isPr ? "pr" : "free"}"
        data-status="${escapeAttr(listing.status || "open")}"
        data-price="${priceNum}"
        data-date="${dateNum}"
        data-popular="${Number(listing.popular) || 0}"
        data-condition="${escapeAttr(product?.condition || listing.condition || "")}"
        tabindex="0"
        role="link"
        aria-label="${escapeAttr(`${cardTitleText}の詳細を見る`)}"`;

    li.innerHTML = `
      <article class="${cardClass} ${cardExtraClass}"
        ${articleAttrs}>
        ${decor}
        <div class="list-card-horizontal__media">
          <div class="${mediaWrapClass}">
            <a class="${mediaLinkClass}" href="${escapeAttr(detailUrl)}">
              <img class="${imageClass}" src="${escapeAttr(imageSrc)}" alt="${escapeAttr(`${cardTitleText}の画像`)}" width="480" height="320" loading="lazy" decoding="async"${imagePreserveAttr}>
            </a>
          </div>
        </div>
        <div class="list-card-horizontal__content card__main list-card__main">
          ${sellerHtml}
          <h3 class="listing-card-title">${escapeHtml(cardTitleText)}</h3>
          ${platformBadgesHtml}
          <p class="card__price list-card__price">${escapeHtml(cardPriceText)}</p>
          <ul class="card__tags list-card__tags" aria-label="タグ">${tagHtml}</ul>
        </div>
        <footer class="list-card-horizontal__cta card__footer list-card__footer">
          <a class="${buttonClass}" href="${escapeAttr(detailUrl)}">${escapeHtml(cta)}</a>
        </footer>
      </article>`;

    const card = li.querySelector(".list-card");
    bindListCardNavigation(card);
    bindListCardActions(card);
    window.TasuPlatformBadges?.bindRecommendPopovers?.(card);
    if (sellerUserId) {
      queueMicrotask(() => {
        const host = card.querySelector("[data-premium-seller-host]");
        if (!host) return;
        const Seller = window.TasuListingSellerProfile;
        const demo = Seller?.resolveDemoProfile?.(sellerUserId) || null;
        if (demo && Seller?.applySellerRankDisplay) {
          Seller.applySellerRankDisplay(host, demo);
          if (Seller.resolveRankPlateImageKey) {
            applyListCardRankAccent(
              card,
              Seller.resolveRankPlateImageKey(demo.rankKey || demo.memberRank)
            );
          }
          applyListCardSellerMeta(host, listing, demo, null);
        }
        void hydrateProductListCardSellerHost(host, listing);
      });
    }
    return li;
  }

  function buildProductListCardElement(listing) {
    return buildUnifiedListCardElement(listing);
  }

  function buildProductPremiumCardElement(listing) {
    return buildUnifiedListCardElement(listing);
  }

  function sortListings(list, sortKey) {
    const items = [...list];
    const byDate = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);

    const byPriorityThenDate = (a, b) => {
      const scoreDiff = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return byDate(a, b);
    };

    if (sortKey === "pr") {
      return items.sort((a, b) => {
        if (b.isPr !== a.isPr) return Number(b.isPr) - Number(a.isPr);
        if (b.isFeatured !== a.isFeatured) return Number(b.isFeatured) - Number(a.isFeatured);
        return byPriorityThenDate(a, b);
      });
    }

    if (sortKey === "featured") {
      return items.sort((a, b) => {
        if (b.isFeatured !== a.isFeatured) return Number(b.isFeatured) - Number(a.isFeatured);
        if (b.isPr !== a.isPr) return Number(b.isPr) - Number(a.isPr);
        return byPriorityThenDate(a, b);
      });
    }

    return items.sort((a, b) => {
      const scoreDiff = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return byDate(a, b);
    });
  }

  function buildCardElement(listing) {
    return buildUnifiedListCardElement(listing);
  }

  window.TasuListingRenderer = {
    normalizeGeneralRow,
    normalizeBusinessRow,
    normalizeApplicationConditions,
    pickBusinessText,
    pickBusinessImage,
    pickBusinessServiceMenuItems,
    parseJsonArray,
    pickBusinessImageUrl,
    inspectBusinessImageSources,
    pickApplicationConditions,
    pickCategoryExtra,
    sortListings,
    buildCardElement,
    buildUnifiedListCardElement,
    buildProductListCardElement,
    buildProductPremiumCardElement,
    bindListCardNavigation,
    bindListCardActions,
    bindProductListCardNavigation,
    bindProductListCardActions,
    buildListCardSellerBlockHtml,
    buildProductListSellerBlockHtml,
    hydrateProductListCardSellerHost,
    hydrateListCardSellers,
    hydrateProductListCardSellers,
    getProductDetailUrl,
    hydratePremiumProductCardSellers,
    getDetailUrl,
    formatDate,
    resolveListingCardTitle,
    renderPlatformBadgesHtml,
    syncPlatformListingBadges,
    TYPE_LABELS,
    BUSINESS_CATEGORY_LABELS,
    CTA_BY_TYPE,
  };
})();
