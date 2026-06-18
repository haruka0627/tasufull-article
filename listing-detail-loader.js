/**
 * 詳細ページ: ?id= から Supabase / localStorage の掲載を表示（デモ固定値は使わない）
 */
(function () {
  "use strict";

  function isSkillDetailPage() {
    if (document.body?.dataset?.detailType === "skill") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-skill/i.test(path) || /detail-skill/i.test(href);
  }

  function isBusinessServiceDetailPage() {
    if (window.TasuDetailBusinessServiceLoader?.isBusinessServiceDetailPage) {
      return window.TasuDetailBusinessServiceLoader.isBusinessServiceDetailPage();
    }
    if (document.body?.dataset?.detailType === "field_service") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-business-service/i.test(path) || /detail-business-service/i.test(href);
  }

  function isBusinessDetailPage() {
    if (isShopStoreDetailPage() || isBusinessServiceDetailPage()) return false;
    if (document.body?.dataset?.detailType === "business") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    if (/detail-business-service/i.test(path) || /detail-business-service/i.test(href)) return false;
    return /detail-business/i.test(path) || /detail-business/i.test(href);
  }

  function isShopStoreDetailPage() {
    if (window.TasuDetailShopStoreLoader?.isShopStoreDetailPage) {
      return window.TasuDetailShopStoreLoader.isShopStoreDetailPage();
    }
    if (document.body?.dataset?.detailType === "shop_store") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return (
      /detail-shop-store/i.test(path) ||
      /detail-shop-store/i.test(href) ||
      /detail-shop\.html/i.test(path) ||
      /detail-shop\.html/i.test(href)
    );
  }

  function isWorkerDetailPage() {
    if (document.body?.dataset?.detailType === "worker") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-worker/i.test(path) || /detail-worker/i.test(href);
  }

  function isProductDetailPage() {
    if (document.body?.dataset?.detailType === "product") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-product/i.test(path) || /detail-product/i.test(href);
  }

  function isJobDetailPage() {
    if (document.body?.dataset?.detailType === "job") return true;
    const path = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    return /detail-job/i.test(path) || /detail-job/i.test(href);
  }

  const SHOP_STORE_DETAIL_PAGE = isShopStoreDetailPage();
  const BUSINESS_SERVICE_DETAIL_PAGE = isBusinessServiceDetailPage();
  /** 店舗詳細は detail-shop-store-bottom.js が直接描画（二重 boot / iframe 回避） */
  if (SHOP_STORE_DETAIL_PAGE) {
    const hasDedicatedShopRenderer = Array.from(document.scripts || []).some((s) =>
      /detail-shop-store-bottom\.js/i.test(String(s.src || ""))
    );
    if (hasDedicatedShopRenderer) {
      return;
    }
  }
  /** 業務サービス詳細は detail-business-service-loader.js が直接描画（iframe / 二重 boot 回避） */
  if (BUSINESS_SERVICE_DETAIL_PAGE) {
    return;
  }
  const BUSINESS_PAGE = isBusinessDetailPage();
  /** 法人・業者・業務サービス詳細（TasuBusinessDetail.render 対象） */
  const IS_BIZ_DETAIL_PAGE = BUSINESS_PAGE || BUSINESS_SERVICE_DETAIL_PAGE;
  const SKILL_PAGE = isSkillDetailPage();
  const WORKER_PAGE = isWorkerDetailPage();
  const PRODUCT_PAGE = isProductDetailPage();
  const JOB_PAGE = isJobDetailPage();
  const PREMIUM_DETAIL_PAGE =
    SKILL_PAGE || WORKER_PAGE || PRODUCT_PAGE || JOB_PAGE;

  /** @type {object|null} */
  let activeWorkerListing = null;

  const SKILL_DELIVERY_KEYS = [
    "deliveryTime",
    "delivery_time",
    "deadline",
    "delivery_estimate",
  ];
  const SKILL_SCOPE_KEYS = ["scope", "support_range", "service_range"];
  const SKILL_ACHIEVEMENTS_KEYS = ["achievements", "results", "portfolio_text"];
  const SKILL_SERVICE_NAME_KEYS = ["serviceName", "service_name", "service_title"];

  const WORKER_SERVICES_KEYS = [
    "services",
    "service_types",
    "skills",
    "job_types",
    "categories",
  ];
  const WORKER_AREA_KEYS = [
    "service_area",
    "serviceArea",
    "area",
    "region",
    "location",
  ];
  const WORKER_HOURS_KEYS = [
    "work_hours",
    "workHours",
    "hours",
    "availability_hours",
    "schedule",
  ];
  const WORKER_EXPERIENCE_KEYS = [
    "experience_years",
    "experienceYears",
    "experience",
    "years_experience",
  ];
  const WORKER_CREDENTIALS_KEYS = [
    "qualifications",
    "credentials",
    "certifications",
    "licenses",
  ];

  const PRODUCT_STOCK_KEYS = [
    "stock_count",
    "stock",
    "inventory",
    "stock_quantity",
    "quantity",
    "availability",
  ];
  const PRODUCT_DELIVERY_KEYS = [
    "delivery_days",
    "delivery",
  ];
  const PRODUCT_SPECS_KEYS = [
    "spec",
    "specification",
    "product_spec",
    "specs",
    "specifications",
    "product_specs",
  ];
  const PRODUCT_SHIPPING_KEYS = [
    "delivery_method",
    "shipping_method",
    "delivery_note",
    "shipping",
    "handover",
    "pickup",
  ];
  const PRODUCT_CONDITION_KEYS = ["condition"];
  const PRODUCT_CATEGORY_KEYS = ["category"];
  const PRODUCT_SUBCATEGORY_KEYS = ["subcategory", "subCategory"];

  const PRODUCT_CONDITION_LABELS = {
    new: "新品",
    "like-new": "未使用に近い",
    good: "美品",
    used: "中古",
  };

  function formatCondition(value) {
    const raw = safeStr(value, "");
    if (!raw) return "";
    return PRODUCT_CONDITION_LABELS[raw] || raw;
  }

  function formatDeliveryMethod(value) {
    return safeStr(value, "");
  }

  function formatProductPriceValue(price) {
    if (price == null) return "";
    if (typeof price === "object" && price !== null && "text" in price) {
      return safeStr(price.text, "");
    }
    return safeStr(price, "");
  }

  /** listing.description → form_data（product / job / worker 共通） */
  const LISTING_DESCRIPTION_KEYS = [
    "description",
    "product_description",
    "detail_description",
    "content",
  ];

  const JOB_SALARY_KEYS = [
    "salary",
    "compensation",
    "reward",
    "pay",
    "wage",
    "hourly_rate",
  ];
  const JOB_CONDITIONS_KEYS = [
    "work_conditions",
    "employment_type",
    "contract_type",
    "conditions",
    "employment",
  ];
  const JOB_LOCATION_KEYS = [
    "location",
    "work_location",
    "workplace",
    "area",
    "office_location",
  ];
  const JOB_REQUIREMENTS_KEYS = [
    "requirements",
    "application_requirements",
    "qualifications",
    "apply_requirements",
    "must_have",
  ];
  const JOB_COMPANY_KEYS = [
    "company",
    "company_name",
    "employer",
    "organization",
  ];

  const SKILL_CAPABILITY_TAG_LABELS = new Set([
    "リモートok",
    "お急ぎ対応",
    "見積相談可",
    "商用利用ok",
    "修正無制限",
  ]);

  const SKILL_PUBLISH_STATUS_LABELS = {
    draft: "下書き",
    scheduled: "予約公開",
    public: "受付中",
  };

  function getQueryId() {
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get("id") ||
      params.get("listingId") ||
      params.get("listing_id") ||
      "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  function getQuerySellerUserId() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("userId") || params.get("user_id") || "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  function resolveSellerUserId(listing) {
    const fromUrl = getQuerySellerUserId();
    const fromListingUser = String(
      listing?.user_id || listing?.userId || ""
    ).trim();
    const fromSellerId = String(
      listing?.seller_id || listing?.sellerId || ""
    ).trim();
    const fromMemberId = String(
      listing?.member_id || listing?.memberId || ""
    ).trim();

    if (fromUrl) return fromUrl;
    if (fromListingUser) return fromListingUser;
    if (fromSellerId) return fromSellerId;
    return fromMemberId;
  }

  function getSupabaseClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  const WORKER_LISTING_DETAIL_COLUMNS = [
    "worker_profile",
    "worker_services",
    "worker_area",
    "worker_availability",
    "worker_experience",
    "worker_certifications",
    "worker_display_name",
    "worker_age_group",
    "worker_notes",
    "worker_price_type",
    "worker_price_amount",
    "worker_support_tags",
    "worker_invoice_support",
    "worker_payment_url",
    "worker_bank_info",
  ];

  /** DBカラム名 → form_data / 旧キー fallback */
  const WORKER_FIELD_ALIASES = {
    worker_profile: [
      "worker_profile",
      "workerBio",
      "worker_bio",
      "bio",
      "profile",
    ],
    worker_services: [
      "worker_services",
      "workerScope",
      "worker_scope",
      "services",
      "scope",
    ],
    worker_area: [
      "worker_area",
      "service_area",
      "serviceArea",
      "area",
      "region",
      "location",
    ],
    worker_availability: [
      "worker_availability",
      "workerHours",
      "worker_hours",
      "work_hours",
      "workHours",
      "hours",
      "availability",
      "schedule",
    ],
    worker_experience: [
      "worker_experience",
      "experience_years",
      "experienceYears",
      "experience",
      "years_experience",
    ],
    worker_certifications: [
      "worker_certifications",
      "qualifications",
      "credentials",
      "certifications",
      "licenses",
    ],
    worker_display_name: ["worker_display_name", "workerDisplayName", "display_name"],
    worker_age_group: ["worker_age_group", "workerAgeGroup", "age_group"],
    worker_notes: ["worker_notes", "workerNotes", "notes"],
    worker_price_type: ["worker_price_type", "workerPriceType", "price_type"],
    worker_price_amount: [
      "worker_price_amount",
      "workerPrice",
      "price_amount",
      "price",
    ],
    worker_support_tags: ["worker_support_tags", "support_tags"],
    worker_invoice_support: ["worker_invoice_support", "invoice_support"],
    worker_payment_url: ["worker_payment_url", "payment_url"],
    worker_bank_info: ["worker_bank_info", "bank_transfer_info", "bank_info"],
  };

  const WORKER_LOCAL_STORAGE_KEY = "tasu_listings_v1";

  const JOB_LISTING_DETAIL_COLUMNS = [
    "job_location",
    "work_style",
    "employment_type",
    "working_hours",
    "required_skills",
    "welcome_skills",
    "job_benefits",
    "recruitment_count",
    "application_deadline",
    "application_method",
    "contract_terms",
    "salary_amount",
    "salary_type",
    "company_name",
    "recruiter_name",
    "contact_email",
    "phone",
    "company_description",
  ];

  function copyJobListingColumns(listing, row) {
    if (!listing || !row) return listing;
    const listingType = String(
      row.listing_type || row.type || listing.listing_type || listing.type || ""
    ).trim();
    if (listingType !== "job") return listing;

    JOB_LISTING_DETAIL_COLUMNS.forEach((key) => {
      const value = row[key];
      if (value == null || value === "") return;
      listing[key] = value;
    });
    return listing;
  }

  function copyWorkerListingColumns(listing, row) {
    if (!listing || !row) return listing;
    const listingType = String(
      row.listing_type || row.type || listing.listing_type || listing.type || ""
    ).trim();
    if (listingType !== "worker") return listing;

    WORKER_LISTING_DETAIL_COLUMNS.forEach((key) => {
      const value = row[key];
      if (value == null || value === "") return;
      listing[key] = value;
    });
    return listing;
  }

  /** rowToListing で落ちた worker カラムを _sourceRow / form_data から listing 直下へ復元 */
  function ensureWorkerColumnsOnListing(listing) {
    if (!listing) return listing;
    const row = listing._sourceRow || listing;
    if (WORKER_PAGE) {
      listing.listing_type = listing.listing_type || row.listing_type || row.type || "worker";
      listing.type = listing.type || listing.listing_type;
    }
    const listingType = String(
      listing.listing_type || listing.type || row.listing_type || row.type || ""
    ).trim();
    if (listingType !== "worker" && !WORKER_PAGE) return listing;
    copyWorkerListingColumns(listing, row);
    const hoisted = hoistWorkerFieldsOntoListing(listing);
    if (WORKER_PAGE && window.TasuWorkerListingFields?.normalizeWorkerListing) {
      hoisted.workerNormalized =
        window.TasuWorkerListingFields.normalizeWorkerListing(hoisted);
    }
    return hoisted;
  }

  function loadRawListingRowFromLocal(id) {
    try {
      const raw = localStorage.getItem(WORKER_LOCAL_STORAGE_KEY);
      if (!raw) return null;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return null;
      return list.find((row) => String(row?.id) === String(id)) || null;
    } catch {
      return null;
    }
  }

  /** worker: Supabase / localStorage の生 row を優先（rowToListing で落ちるカラム対策） */
  async function fetchWorkerListingRawRow(id) {
    const lookupIds = collectDetailLookupIds(id);
    const primaryId = lookupIds[0] || String(id || "").trim();
    if (!primaryId) return null;

    for (const detailId of lookupIds) {
      const sb = getSupabaseClient();
      if (sb && isUuid(detailId)) {
        const { data, error } = await sb
          .from("listings")
          .select("*")
          .eq("id", detailId)
          .maybeSingle();

        if (data && !error) {
          return { ...data, _source: data._source || "supabase" };
        }
      }

      const localRow = loadRawListingRowFromLocal(detailId);
      if (localRow) {
        return { ...localRow, _source: localRow._source || "local" };
      }

      if (window.TasuListingDemoCatalog?.getStoreListing) {
        const catalogRow = window.TasuListingDemoCatalog.getStoreListing(detailId);
        if (catalogRow) {
          return { ...catalogRow, _source: "demo-catalog" };
        }
      }

      if (window.TasuListingStore?.fetchListingById) {
        const fromStore = await window.TasuListingStore.fetchListingById(detailId);
        if (fromStore?._sourceRow) return { ...fromStore._sourceRow, _source: fromStore._source || "store" };
        if (fromStore) return { ...fromStore, _source: fromStore._source || "store" };
      }
    }

    return null;
  }

  function getWorkerFormDataObject(listing) {
    if (!listing) return {};
    const raw = listing.form_data;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return parseListingFormData(listing);
  }

  /** listing 直下 → _sourceRow → form_data / data などの fallback */
  function getWorkerValue(listing, key) {
    if (!listing || !key) return "";

    const fd = getWorkerFormDataObject(listing);
    const fdData =
      fd?.data && typeof fd.data === "object" && !Array.isArray(fd.data) ? fd.data : {};
    const sources = [
      listing,
      listing._sourceRow,
      fd,
      fdData,
      fd?.worker_data,
      fd?.worker,
      listing?.data,
      listing?.worker_data,
    ].filter((layer) => layer && typeof layer === "object");

    const keys = WORKER_FIELD_ALIASES[key] || [key];

    if (key === "worker_area") {
      const direct = pickWorkerRawValue(sources, keys);
      if (direct) return direct;
      return composeWorkerAreaFromLayers(sources);
    }

    return pickWorkerRawValue(sources, keys);
  }

  function pickWorkerRawValue(layers, keys) {
    if (!layers?.length || !keys?.length) return "";
    for (let li = 0; li < layers.length; li += 1) {
      const layer = layers[li];
      for (let ki = 0; ki < keys.length; ki += 1) {
        const raw = layer[keys[ki]];
        if (raw == null || raw === "") continue;
        if (typeof raw === "number" && !Number.isNaN(raw)) {
          return String(raw);
        }
        if (typeof raw === "string" && raw.trim()) {
          return raw.trim();
        }
      }
    }
    return "";
  }

  function composeWorkerAreaFromLayers(layers) {
    const direct = pickWorkerRawValue(layers, WORKER_FIELD_ALIASES.worker_area);
    if (direct) return direct;

    const pref = pickWorkerRawValue(layers, [
      "workerPrefecture",
      "prefecture",
      "worker_prefecture",
    ]);
    const city = pickWorkerRawValue(layers, ["workerCity", "city", "worker_city"]);
    const travel = pickWorkerRawValue(layers, ["workerTravel", "travel", "worker_travel"]);
    const parts = [];
    if (pref) parts.push(pref);
    if (city) parts.push(city);
    let text = parts.join(" ");
    if (travel) {
      text = text ? `${text}（${travel}）` : travel;
    }
    return text;
  }

  function readWorkerListingField(listing, key) {
    return getWorkerValue(listing, key);
  }

  function hoistWorkerFieldsOntoListing(listing) {
    if (!listing) return listing;
    if (WORKER_PAGE) {
      listing.listing_type = listing.listing_type || "worker";
    }
    const listingType = String(
      listing.listing_type || listing.type || listing._sourceRow?.listing_type || ""
    ).trim();
    if (listingType !== "worker" && !WORKER_PAGE) return listing;

    WORKER_LISTING_DETAIL_COLUMNS.forEach((key) => {
      const value = getWorkerValue(listing, key);
      if (!value) return;
      listing[key] = value;
    });

    const priceAmount = getWorkerValue(listing, "worker_price_amount");
    if (priceAmount) {
      const num = Number(String(priceAmount).replace(/[^\d]/g, ""));
      if (Number.isFinite(num) && num > 0) {
        listing.worker_price_amount = num;
      }
    }

    return listing;
  }

  function logFullWorkerListing(listing) {
    if (!WORKER_PAGE || !listing) return;
    console.log("FULL WORKER LISTING", listing);
    const fd = parseListingFormData(listing);
    console.log("[detail-worker] nested worker paths", {
      "listing.worker_profile": listing?.worker_profile,
      "listing.form_data.worker_profile": fd?.worker_profile,
      "listing.form_data.data?.worker_profile": fd?.data?.worker_profile,
      "listing.form_data.worker?.worker_profile": fd?.worker?.worker_profile,
      "listing.data?.worker_profile": listing?.data?.worker_profile,
      "listing._sourceRow?.worker_profile": listing?._sourceRow?.worker_profile,
      "listing.form_data.services (legacy)": fd?.services,
      "listing.form_data.work_hours (legacy)": fd?.work_hours,
      "listing._sourceRow?.service_area": listing?._sourceRow?.service_area,
    });
  }

  function logWorkerDetailFields(listing) {
    if (!WORKER_PAGE || !listing) return;
    console.log("[detail-worker] worker fields", {
      worker_profile: readWorkerListingField(listing, "worker_profile"),
      worker_services: readWorkerListingField(listing, "worker_services"),
      worker_area: readWorkerListingField(listing, "worker_area"),
      worker_availability: readWorkerListingField(listing, "worker_availability"),
      worker_experience: readWorkerListingField(listing, "worker_experience"),
      worker_certifications: readWorkerListingField(listing, "worker_certifications"),
      worker_display_name: readWorkerListingField(listing, "worker_display_name"),
      worker_age_group: readWorkerListingField(listing, "worker_age_group"),
      worker_notes: readWorkerListingField(listing, "worker_notes"),
      worker_support_tags: readWorkerListingField(listing, "worker_support_tags"),
      worker_invoice_support: readWorkerListingField(listing, "worker_invoice_support"),
      worker_price_type: readWorkerListingField(listing, "worker_price_type"),
      worker_price_amount: readWorkerListingField(listing, "worker_price_amount"),
    });
  }

  function formatWorkerPriceForDetail(listing) {
    const workerSource = listing;
    const priceType =
      workerSource?.worker_price_type ||
      getWorkerValue(listing, "worker_price_type");
    const amountRaw =
      workerSource?.worker_price_amount ??
      getWorkerValue(listing, "worker_price_amount");
    let amount = null;
    if (window.TasuWorkerListingFields?.parseWorkerPriceAmount) {
      amount = window.TasuWorkerListingFields.parseWorkerPriceAmount(amountRaw);
    } else {
      const n = Number(String(amountRaw ?? "").replace(/[^\d]/g, ""));
      amount = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (amount != null) {
      const formatted = amount.toLocaleString("ja-JP");
      if (priceType) return `${priceType} ${formatted}円`;
      return `${formatted}円`;
    }
    if (priceType) return priceType;
    return "";
  }

  function workerDetailDisplayText(value, emptyLabel) {
    const text = safeStr(value, "");
    return text || emptyLabel || WORKER_DETAIL_EMPTY;
  }

  function parseWorkerSupportTagsList(listing) {
    const raw =
      readWorkerListingField(listing, "worker_support_tags") ||
      safeStr(listing?.tags, "");
    if (!raw) return [];
    return String(raw)
      .split(/[,、\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function renderWorkerHeroTags(listing) {
    if (!WORKER_PAGE) return;

    const host = document.querySelector("[data-listing-hero-tags]");
    if (!host) return;

    const tags = parseWorkerSupportTagsList(listing).slice(0, 6);
    if (!tags.length) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }

    host.innerHTML = tags
      .map((t) => `<span class="worker-tag-pill">${escapeHtml(t)}</span>`)
      .join("");
    host.hidden = false;
  }

  function renderWorkerDetailSupportTags(listing, supportTagsRaw) {
    if (!WORKER_PAGE) return;

    const tags = parseWorkerSupportTagsList({
      ...listing,
      worker_support_tags:
        supportTagsRaw || readWorkerListingField(listing, "worker_support_tags"),
    });

    if (!tags.length) {
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-support-tags-block]",
        "[data-listing-worker-support-tags]",
        ""
      );
      return;
    }

    fillWorkerDetailBlockIfPresent(
      "[data-listing-worker-support-tags-block]",
      "[data-listing-worker-support-tags]",
      tags.join(" "),
      {
        html: tags
          .map(
            (t) =>
              `<span class="worker-detail-tag-pill">${escapeHtml(t)}</span>`
          )
          .join(""),
      }
    );
  }

  function pickFirstWorkerText(...values) {
    for (let i = 0; i < values.length; i += 1) {
      const text = safeStr(values[i], "").trim();
      if (text) return text;
    }
    return "";
  }

  function resolveWorkerDetailFieldValues(listing) {
    const enriched = ensureWorkerColumnsOnListing(listing);
    const normalized =
      enriched?.workerNormalized || getNormalizedWorker(enriched) || {};

    let credentials = pickFirstWorkerText(
      normalized.certifications,
      readWorkerListingField(enriched, "worker_certifications")
    );
    if (enriched?.identity_verified && !credentials) {
      credentials = "本人確認済み";
    } else if (
      enriched?.identity_verified &&
      credentials &&
      !/本人確認/.test(credentials)
    ) {
      credentials = `${credentials}\n本人確認済み`;
    }

    return {
      profile: pickFirstWorkerText(
        normalized.profile,
        readWorkerListingField(enriched, "worker_profile"),
        enriched?.description
      ),
      services: pickFirstWorkerText(
        normalized.services,
        readWorkerListingField(enriched, "worker_services")
      ),
      area: pickFirstWorkerText(
        normalized.area,
        readWorkerListingField(enriched, "worker_area")
      ),
      availability: pickFirstWorkerText(
        normalized.availability,
        readWorkerListingField(enriched, "worker_availability")
      ),
      experience: pickFirstWorkerText(
        normalized.experience,
        readWorkerListingField(enriched, "worker_experience")
      ),
      credentials,
      notes: pickFirstWorkerText(
        normalized.notes,
        readWorkerListingField(enriched, "worker_notes")
      ),
      priceText:
        pickFirstWorkerText(normalized.priceText) ||
        formatWorkerPriceForDetail(enriched),
      supportTags: readWorkerListingField(enriched, "worker_support_tags"),
    };
  }

  function fillWorkerDetailBlockIfPresent(blockSelector, contentSelector, value, options = {}) {
    const text = safeStr(value, "").trim();
    const body = document.getElementById("worker-details-body");
    if (!body) {
      console.warn("[detail-worker] #worker-details-body not found");
      return false;
    }

    const block = body.querySelector(blockSelector);
    if (!block) {
      console.warn("[detail-worker] block not found:", blockSelector);
      return false;
    }

    const el = contentSelector
      ? block.querySelector(contentSelector)
      : block.querySelector(".skill-details-block__content");
    if (!el) {
      console.warn("[detail-worker] content not found:", contentSelector, "in", blockSelector);
      return false;
    }

    if (!text && !options.html) {
      block.hidden = true;
      el.textContent = "";
      el.innerHTML = "";
      return false;
    }

    if (options.html) {
      el.innerHTML = options.html;
    } else {
      el.textContent = text;
    }
    block.hidden = false;
    block.classList.remove("skill-details-block--muted", "skill-info-card--empty");
    return true;
  }

  function normalizeFetchedListing(row) {
    if (!row) return null;
    let listing = null;
    if (window.TasuListingStore?.rowToListing) {
      listing = window.TasuListingStore.rowToListing({
        ...row,
        _source: row._source || "supabase",
      });
    } else if (window.TasuListingRenderer?.normalizeGeneralRow) {
      listing = window.TasuListingRenderer.normalizeGeneralRow({
        ...row,
        _source: row._source || "supabase",
      });
    } else {
      listing = row;
    }
    if (listing && row) {
      listing._sourceRow = row;
      if (row.source) listing.source = row.source;
      if (row._localRecord) listing._localRecord = row._localRecord;
      copyJobListingColumns(listing, row);
      ensureWorkerColumnsOnListing(copyWorkerListingColumns(listing, row));
      const fd = parseListingFormData(listing);
      if (fd && typeof fd === "object" && Object.keys(fd).length) {
        listing.form_data = fd;
      }
      const listingType = String(
        listing.listing_type || listing.type || row.listing_type || ""
      ).trim();
      if (listingType === "product") {
        listing.productNormalized = getNormalizedProduct(listing);
      }
      if (listingType === "job") {
        listing.jobNormalized = getNormalizedJob(listing);
      }
      if (listingType === "worker") {
        listing.workerNormalized = getNormalizedWorker(listing);
      }
    }
    return listing;
  }

  function getListingImageSource(listing) {
    return listing?._sourceRow || listing;
  }

  function getNormalizedProduct(listing) {
    if (!listing || !window.TasuProductListingFields?.normalizeProductListing) {
      return null;
    }
    const listingType = String(
      listing.listing_type || listing.type || ""
    ).trim();
    if (listingType !== "product" && !PRODUCT_PAGE) return null;
    const source = listing._sourceRow || listing;
    return window.TasuProductListingFields.normalizeProductListing({
      ...source,
      ...listing,
      listing_type: listingType || "product",
      form_data: listing.form_data ?? source.form_data,
    });
  }

  function getNormalizedJob(listing) {
    if (!listing || !window.TasuJobListingFields?.normalizeJobListing) {
      return null;
    }
    const listingType = String(
      listing.listing_type || listing.type || ""
    ).trim();
    if (listingType !== "job" && !JOB_PAGE) return null;
    const source = listing._sourceRow || listing;
    return window.TasuJobListingFields.normalizeJobListing({
      ...source,
      ...listing,
      listing_type: listingType || "job",
      form_data: listing.form_data ?? source.form_data,
    });
  }

  function getNormalizedWorker(listing) {
    if (!listing || !window.TasuWorkerListingFields?.normalizeWorkerListing) {
      return null;
    }
    const listingType = String(
      listing.listing_type || listing.type || ""
    ).trim();
    if (listingType !== "worker" && !WORKER_PAGE) return null;
    const workerListing = ensureWorkerColumnsOnListing(listing);
    return window.TasuWorkerListingFields.normalizeWorkerListing(workerListing);
  }

  const WORKER_DETAIL_EMPTY =
    window.TasuWorkerListingFields?.WORKER_DETAIL_EMPTY || "未登録";

  function getMergedImageRow(listing) {
    const source = getListingImageSource(listing);
    const fdSource = parseListingFormData(source);
    const fdListing = parseListingFormData(listing);
    const form_data = { ...fdSource, ...fdListing };

    const listingType =
      listing?.listing_type || listing?.type || source?.listing_type || "";
    const isProduct = listingType === "product";
    const isJob = listingType === "job";
    const product = isProduct ? getNormalizedProduct({ ...listing, ...source, form_data }) : null;
    const job = isJob ? getNormalizedJob({ ...listing, ...source, form_data }) : null;

    const galleryUrls = isProduct
      ? [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))]
      : isJob
        ? [...new Set([job?.image, ...(job?.gallery || [])].filter(Boolean))]
        : listing?.gallery_urls ||
          listing?.galleryUrls ||
          source?.gallery_urls ||
          source?.galleryUrls ||
          [];

    return {
      ...source,
      ...listing,
      form_data,
      listing_type: listingType,
      productNormalized: product || undefined,
      image_url: isProduct
        ? product?.image ||
          listing?.image_url ||
          source?.image_url ||
          form_data.image_url ||
          form_data.main_image_url ||
          null
        : isJob
          ? job?.image ||
            listing?.image_url ||
            source?.image_url ||
            listing?.thumbnail_url ||
            source?.thumbnail_url ||
            (Array.isArray(listing?.gallery_urls) ? listing.gallery_urls[0] : null) ||
            (Array.isArray(source?.gallery_urls) ? source.gallery_urls[0] : null) ||
            (Array.isArray(listing?.images) ? listing.images[0] : null) ||
            form_data.image_url ||
            form_data.thumbnail_url ||
            form_data.main_image_url ||
            (Array.isArray(form_data.gallery_urls) ? form_data.gallery_urls[0] : null) ||
            (Array.isArray(form_data.images) ? form_data.images[0] : null) ||
            null
          : form_data.image_url ||
            form_data.main_image_url ||
            listing?.image_url ||
            source?.image_url ||
            null,
      thumbnail_url: isProduct
        ? product?.thumbnail ||
          listing?.thumbnail_url ||
          source?.thumbnail_url ||
          product?.image ||
          null
        : isJob
          ? job?.thumbnail ||
            listing?.thumbnail_url ||
            source?.thumbnail_url ||
            job?.image ||
            null
          : form_data.thumbnail_url ||
            listing?.thumbnail_url ||
            source?.thumbnail_url ||
            null,
      imageUrl:
        (isProduct && product?.image) ||
        (isJob && job?.image) ||
        listing?.imageUrl ||
        source?.imageUrl ||
        listing?.image_url ||
        source?.image_url ||
        form_data.image_url ||
        form_data.main_image_url ||
        null,
      jobNormalized: job || undefined,
      gallery_urls: galleryUrls,
      galleryUrls,
    };
  }

  function resolveListingDescription(listing) {
    if (!listing) return "";

    const listingType = String(listing.listing_type || listing.type || "").trim();
    if (listingType === "product") {
      const product = getNormalizedProduct(listing);
      if (product?.description) return product.description;
      const formData = parseListingFormData(listing);
      return (
        safeStr(listing.description, "") ||
        safeStr(formData.description, "") ||
        safeStr(formData.product_description, "")
      );
    }

    if (listingType === "job") {
      const job = getNormalizedJob(listing);
      if (job?.description) return job.description;
    }

    const formData = parseListingFormData(listing);

    const fromListing = safeStr(listing.description, "");
    if (fromListing) return fromListing;

    const fromForm = pickFormText(formData, LISTING_DESCRIPTION_KEYS);
    if (fromForm) return fromForm;

    if (formData.product && typeof formData.product === "object" && !Array.isArray(formData.product)) {
      const nested = pickFormText(formData.product, LISTING_DESCRIPTION_KEYS);
      if (nested) return nested;
    }

    return "";
  }

  function resolveListingCardImageUrl(listing) {
    if (!listing) return null;

    const product = getNormalizedProduct(listing);
    if (product?.image) return product.image;

    const job = getNormalizedJob(listing);
    if (job?.image) return job.image;

    const Images = window.TasuListingImages;
    if (!Images?.resolveListingImageSet) return null;

    const merged = getMergedImageRow(listing);
    const set = Images.resolveListingImageSet(merged);
    return set?.primary || null;
  }

  function resolveListingCardThumb(listing, title) {
    const resolved = resolveListingCardImageUrl(listing);
    if (resolved) return resolved;

    const Images = window.TasuListingImages;
    const initial = safeStr(title, "?").charAt(0) || "?";
    return (
      Images?.placeholderUrl?.(initial, "card") ||
      `https://placehold.co/280x160/f3ead4/967622?text=${encodeURIComponent(initial)}`
    );
  }

  function prepareRelatedListingItem(item, listingType) {
    if (!item) return null;
    if (item._sourceRow) return item;

    const source = {
      ...item,
      listing_type: item.listing_type || item.type || listingType || "",
      title: item.title,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      image_url: item.image_url || item.imageUrl || null,
      thumbnail_url: item.thumbnail_url || item.image_url || item.imageUrl || null,
      price_amount: item.price_amount,
      form_data: item.form_data,
    };
    return normalizeFetchedListing({ ...source, _source: item.source || item._source || "published" }) || item;
  }

  function collectDetailLookupIds(id) {
    const R = window.TasuListingRouteResolver;
    if (R?.collectListingIdCandidates) return R.collectListingIdCandidates(id);
    const key = String(id || "").trim();
    return key ? [key] : [];
  }

  function tryLocalStoreListing(detailId) {
    if (!window.TasuListingLocalStore?.fetchById) return null;
    const localRecord = window.TasuListingLocalStore.fetchById(detailId);
    if (!localRecord) return null;
    const localDetail = window.TasuListingLocalStore.toDetailListing?.(localRecord);
    if (!localDetail) return null;
    const listing = normalizeFetchedListing({
      ...localDetail,
      _source: "local-tasful",
    });
    if (!listing) return null;
    listing.source = localRecord.source || localDetail.source || "";
    listing._localRecord = localRecord;
    return listing;
  }

  function tryDemoCatalogListing(detailId) {
    if (!window.TasuListingDemoCatalog?.getStoreListing) return null;
    const catalogRow = window.TasuListingDemoCatalog.getStoreListing(detailId);
    if (!catalogRow) return null;
    return normalizeFetchedListing({
      ...catalogRow,
      listing_type: catalogRow.listing_type || catalogRow.type,
      form_data: catalogRow.form_data,
      _source: "demo-catalog",
    });
  }

  async function tryListingStoreListing(detailId) {
    if (!window.TasuListingStore?.fetchListingById) return null;
    if (
      JOB_PAGE &&
      window.TasuListingRouteResolver?.isDemoListingId?.(detailId)
    ) {
      return null;
    }
    const fromStore = await withAsyncTimeout(
      window.TasuListingStore.fetchListingById(detailId),
      8000,
      `listing store (${detailId})`
    ).catch((err) => {
      console.warn("[listing-detail-loader] listing store fetch skipped:", err);
      return null;
    });
    if (!fromStore) return null;
    return normalizeFetchedListing({
      ...fromStore,
      listing_type: fromStore.listing_type || fromStore.type,
      form_data: fromStore.form_data,
      _source: fromStore.source || fromStore._source || "store",
    });
  }

  function withAsyncTimeout(promise, ms, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label || "request"} timeout (${ms}ms)`)),
        ms
      );
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async function fetchSkillListingFromDb(id) {
    const lookupIds = collectDetailLookupIds(id);
    const primaryId = lookupIds[0] || String(id || "").trim();
    console.log("detail id:", primaryId, lookupIds.length > 1 ? lookupIds : "");

    if (!primaryId) {
      return { listing: null, error: new Error("missing id") };
    }

    for (const detailId of lookupIds) {
      const localListing = tryLocalStoreListing(detailId);
      if (localListing) {
        console.log("[listing-detail-loader] tasful_listings hit:", detailId);
        return { listing: localListing, error: null };
      }
    }

    if (WORKER_PAGE) {
      for (const detailId of lookupIds) {
        const rawWorkerRow = await fetchWorkerListingRawRow(detailId);
        console.log("fetched listing (worker raw):", rawWorkerRow);
        if (rawWorkerRow) {
          return {
            listing: normalizeFetchedListing(rawWorkerRow),
            error: null,
          };
        }
      }
    }

    for (const detailId of lookupIds) {
      const catalogListing = tryDemoCatalogListing(detailId);
      if (catalogListing) {
        console.log("[listing-detail-loader] demo-catalog hit:", detailId);
        return { listing: catalogListing, error: null };
      }
    }

    for (const detailId of lookupIds) {
      const storeListing = await tryListingStoreListing(detailId);
      if (storeListing) {
        console.log("[listing-detail-loader] listing store hit:", detailId);
        return { listing: storeListing, error: null };
      }
    }

    // job: rowToListing は専用カラムを落とすため、Supabase 全カラムを優先
    if (JOB_PAGE) {
      const sb = getSupabaseClient();
      if (sb && isUuid(primaryId)) {
        try {
          const { data, error } = await withAsyncTimeout(
            sb.from("listings").select("*").eq("id", primaryId).single(),
            8000,
            `job supabase (${primaryId})`
          );

          console.log("fetched listing:", data);
          console.log("fetch error:", error);

          if (data && !error) {
            return {
              listing: normalizeFetchedListing({ ...data, _source: "supabase" }),
              error: null,
            };
          }
        } catch (err) {
          console.warn("[listing-detail-loader] job supabase fetch skipped:", err);
        }
      }
    }

    const skipSupabase =
      window.TasuListingRouteResolver?.shouldQuerySupabase?.(primaryId) === false ||
      window.TasuListingRouteResolver?.shouldSkipSupabaseFetch?.(primaryId) === true ||
      !isUuid(primaryId);

    if (skipSupabase) {
      return { listing: null, error: null };
    }

    const sb = getSupabaseClient();
    if (!sb) {
      return { listing: null, error: null };
    }

    try {
      const { data, error } = await withAsyncTimeout(
        sb.from("listings").select("*").eq("id", primaryId).single(),
        8000,
        `supabase (${primaryId})`
      );

      console.log("fetched listing:", data);
      console.log("fetch error:", error);

      if (error) {
        return { listing: null, error };
      }

      const listing = normalizeFetchedListing({ ...data, _source: "supabase" });
      return { listing, error: null };
    } catch (err) {
      console.warn("[listing-detail-loader] supabase fetch skipped:", err);
      return { listing: null, error: err };
    }
  }

  async function fetchWorkerListingFromDb(id) {
    const detailId = String(id || "").trim();
    console.log("[listing-detail] worker detail id:", detailId);

    if (!detailId) {
      return { listing: null, error: new Error("missing id") };
    }

    if (window.TasuListingStore?.fetchListingById) {
      const fromStore = await window.TasuListingStore.fetchListingById(detailId);
      if (fromStore) {
        console.log("fetched listing:", fromStore);
        console.log("fetch error:", null);
        return { listing: fromStore, error: null };
      }
    }

    const sb = getSupabaseClient();
    if (sb && isUuid(detailId)) {
      const { data, error } = await sb
        .from("listings")
        .select("*")
        .eq("id", detailId)
        .single();

      console.log("fetched listing:", data);
      console.log("fetch error:", error);

      if (!error && data) {
        return {
          listing: normalizeFetchedListing({ ...data, _source: "supabase" }),
          error: null,
        };
      }
    }

    return {
      listing: null,
      error: new Error("worker listing not found"),
    };
  }

  function isUuid(id) {
    const R = window.TasuListingRouteResolver;
    if (R?.isUuid) return R.isUuid(id);
    const key = String(id || "").trim();
    if (R?.isDemoListingId?.(key)) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getDisplayTags(listing) {
    if (!listing) return [];
    if (PRODUCT_PAGE) {
      const product = getNormalizedProduct(listing);
      if (product?.tags?.length) return product.tags;
      if (window.TasuListingTags?.collectProductDisplayTags) {
        return window.TasuListingTags.collectProductDisplayTags({
          tags: listing.tags,
          form_data: listing.form_data,
          listing_type: listing.listing_type || listing.type,
        });
      }
      return [];
    }
    if (Array.isArray(listing.displayTags) && listing.displayTags.length) {
      if (PRODUCT_PAGE) {
        return filterProductHeroTags(listing, listing.displayTags);
      }
      return listing.displayTags;
    }
    if (window.TasuListingTags?.collectDisplayTags) {
      const tags = window.TasuListingTags.collectDisplayTags({
        tags: listing.tags,
        form_data: listing.form_data,
      });
      return PRODUCT_PAGE ? filterProductHeroTags(listing, tags) : tags;
    }
    return Array.isArray(listing.tags) ? listing.tags : [];
  }

  function filterProductHeroTags(listing, tags) {
    if (!PRODUCT_PAGE || !Array.isArray(tags)) return tags || [];
    if (window.TasuListingTags?.collectProductDisplayTags) {
      return window.TasuListingTags.collectProductDisplayTags({
        tags: tags,
        form_data: listing?.form_data,
        listing_type: "product",
      });
    }
    return tags;
  }

  function parseListingFormData(listing) {
    let raw = listing?.form_data;
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      let parsed = JSON.parse(raw);
      while (typeof parsed === "string" && parsed.trim()) {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          break;
        }
      }
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  function pickFormText(formData, keys) {
    return pickFormValue(formData, keys);
  }

  function pickFormValue(formData, keys) {
    if (!formData || typeof formData !== "object") return "";
    for (let i = 0; i < keys.length; i += 1) {
      const value = formData[keys[i]];
      if (value == null || value === "") continue;
      if (typeof value === "number" && !Number.isNaN(value)) {
        return String(value);
      }
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  function resolveProductCategoryText(listing) {
    const product = getNormalizedProduct(listing);
    if (product) {
      if (product.category && product.subcategory) {
        return `${product.category} · ${product.subcategory}`;
      }
      return product.category || product.subcategory || "";
    }
    const formData = parseListingFormData(listing);
    let category = safeStr(listing?.category, "");
    let subcategory = safeStr(listing?.subcategory, "");
    if (!category) category = pickFormValue(formData, PRODUCT_CATEGORY_KEYS);
    if (!subcategory) subcategory = pickFormValue(formData, PRODUCT_SUBCATEGORY_KEYS);
    const nested = formData?.category;
    if (!category && nested && typeof nested === "object" && !Array.isArray(nested)) {
      category = safeStr(nested.category || nested.productCategory, "");
      subcategory = safeStr(nested.subCategory || nested.subcategory, subcategory);
    }
    if (category && subcategory) return `${category} · ${subcategory}`;
    if (category) return category;
    if (subcategory) return subcategory;
    return "";
  }

  function resolveProductTitle(listing) {
    const product = getNormalizedProduct(listing);
    if (product?.title) return product.title;
    const formData = parseListingFormData(listing);
    return safeStr(listing?.title, "") || safeStr(formData.product_name, "") || "商品掲載";
  }

  function resolveProductConditionText(listing, formData) {
    const product = getNormalizedProduct(listing);
    if (product?.condition) return formatCondition(product.condition);
    const fd = formData || parseListingFormData(listing);
    const raw = pickFormValue(fd, PRODUCT_CONDITION_KEYS);
    if (!raw) return "";
    return formatCondition(raw);
  }

  function resolveProductStockText(listing) {
    const product = getNormalizedProduct(listing);
    if (!product) return "";
    const parts = [];
    if (product.stockCount) parts.push(`在庫：${product.stockCount}`);
    if (product.deliveryDays) parts.push(`発送目安：${product.deliveryDays}`);
    return parts.join(" / ");
  }

  function resolveProductPriceDisplay(listing) {
    const product = getNormalizedProduct(listing);
    if (product?.price?.text) return product.price.text;
    return resolvePriceText(listing);
  }

  const PRODUCT_DETAIL_EMPTY = "未登録";
  const JOB_DETAIL_EMPTY = "未登録";
  const PRODUCT_HERO_EMPTY_VALUES =
    /^(未登録|未設定|要相談|要確認|—|-)$/i;
  const JOB_CHECK_ICON_SVG = `<svg class="job-hero-feature__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>`;

  function formatProductDetailField(value) {
    if (value == null) return "";
    if (typeof value === "object" && value !== null && "text" in value) {
      return safeStr(value.text, "");
    }
    return safeStr(value, "");
  }

  function safeStr(value, fallback) {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text === "undefined" || text === "null") return fallback;
    return text;
  }

  function getWorkerDetailsRoot() {
    return (
      document.getElementById("section-details") ||
      document.querySelector("section[data-listing-worker-details]")
    );
  }

  function queryWorkerDetailNodes(blockSelector, contentSelector) {
    const root =
      getWorkerDetailsRoot() ||
      document.getElementById("worker-details-body") ||
      document.querySelector("[data-listing-worker-details-body]");

    const block =
      root?.querySelector(blockSelector) ||
      document.querySelector(`#section-details ${blockSelector}`) ||
      document.querySelector(blockSelector);

    const el = contentSelector
      ? root?.querySelector(contentSelector) ||
        document.querySelector(`#section-details ${contentSelector}`) ||
        document.querySelector(contentSelector)
      : block?.querySelector(".skill-details-block__content");

    return { block, el, root };
  }

  function setSkillDetailBlock(section, blockSelector, textSelector, text, options = {}) {
    const useWorkerRoot =
      WORKER_PAGE &&
      (section?.hasAttribute?.("data-listing-worker-details") ||
        section?.id === "worker-details-body" ||
        section?.hasAttribute?.("data-listing-worker-details-body"));

    const workerNodes = useWorkerRoot
      ? queryWorkerDetailNodes(blockSelector, textSelector)
      : null;
    const block = useWorkerRoot
      ? workerNodes.block
      : section.querySelector(blockSelector);
    const el = useWorkerRoot
      ? workerNodes.el
      : textSelector
        ? section.querySelector(textSelector)
        : block?.querySelector(".skill-details-block__content");

    if (WORKER_PAGE && useWorkerRoot) {
      if (!block) {
        console.warn("[detail-worker] block not found:", blockSelector);
      } else if (!el) {
        console.warn("[detail-worker] content not found:", textSelector);
      }
    }
    if (!block || !el) return;
    el.textContent = text;
    block.hidden = false;
    const emptyText = options.emptyText;
    const isPlaceholder = emptyText
      ? text === emptyText
      : Boolean(text && /未設定|要相談|まだ実績|未登録/.test(text));
    block.classList.toggle("skill-details-block--muted", isPlaceholder);
    block.classList.toggle("skill-info-card--empty", isPlaceholder);
  }

  function setProductDetailBlock(block, text, options = {}) {
    if (!block) return;
    const el = block.querySelector(".skill-details-block__content");
    if (!el) {
      console.warn(
        "[renderProductDetails] content node not found in block:",
        block.querySelector(".skill-details-block__title")?.textContent?.trim() ||
          "(unknown)"
      );
      return;
    }
    const emptyText = options.emptyText || PRODUCT_DETAIL_EMPTY;
    const displayText = text || emptyText;
    el.textContent = displayText;
    block.hidden = false;
    const isPlaceholder = displayText === emptyText;
    block.classList.toggle("skill-details-block--muted", isPlaceholder);
    block.classList.toggle("skill-info-card--empty", isPlaceholder);
  }

  function truncateText(text, maxLen) {
    const s = safeStr(text, "");
    if (!s) return "";
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  }

  function hasCapabilityTag(tags, patterns) {
    const normalized = (tags || []).map((t) => String(t).trim().toLowerCase());
    return patterns.some((pattern) =>
      normalized.some((t) => t.includes(pattern) || t === pattern)
    );
  }

  function filterSkillDisplayTags(tags) {
    return (tags || []).filter((tag) => {
      const key = String(tag).trim().toLowerCase();
      return key && !SKILL_CAPABILITY_TAG_LABELS.has(key);
    });
  }

  function resolveSkillPublishStatusLabel(listing) {
    const status = String(listing?.publish_status || "public").trim();
    return (
      SKILL_PUBLISH_STATUS_LABELS[status] ||
      safeStr(listing?.statusLabel, "受付中")
    );
  }

  function resolveSkillCategoryLabel(listing) {
    const formData = parseListingFormData(listing);
    const cat = formData.category;
    if (cat && typeof cat === "object") {
      const skillCat = safeStr(cat.skillCategory, "");
      if (skillCat) return skillCat;
    }
    return safeStr(formData.skillCategory, "スキル・サービス");
  }

  function resolveSkillSubtitle(listing) {
    const formData = parseListingFormData(listing);
    const category = resolveSkillCategoryLabel(listing);
    const desc = safeStr(listing?.description, "");
    const firstLine = desc.split(/\r?\n/)[0]?.trim() || "";
    if (firstLine && firstLine.length > 8) {
      return truncateText(firstLine, 72);
    }
    if (category && category !== "スキル・サービス") {
      return `${category}のスキルサービス`;
    }
    return "サービスの概要をご確認ください";
  }

  function buildSkillHeroMetaItems(listing) {
    const formData = parseListingFormData(listing);
    const allTags = getDisplayTags(listing);
    const delivery =
      pickFormText(formData, SKILL_DELIVERY_KEYS) || "未設定";
    const achievementsRaw = pickFormText(formData, SKILL_ACHIEVEMENTS_KEYS);
    const achievementsSummary = achievementsRaw
      ? truncateText(achievementsRaw.replace(/\s+/g, " "), 28)
      : "未登録";

    const onlineOk = hasCapabilityTag(allTags, [
      "リモート",
      "remote",
      "オンライン",
    ]);
    const rushOk = hasCapabilityTag(allTags, ["お急ぎ", "rush", "急ぎ"]);

    const items = [
      { label: "納期", value: delivery, accent: delivery !== "未設定" },
      {
        label: "対応状況",
        value: resolveSkillPublishStatusLabel(listing),
        accent: listing?.publish_status === "public",
      },
      {
        label: "オンライン",
        value: onlineOk ? "対応可" : "要確認",
        accent: onlineOk,
      },
      { label: "実績", value: achievementsSummary, accent: Boolean(achievementsRaw) },
      {
        label: "お急ぎ",
        value: rushOk ? "対応可" : "—",
        accent: rushOk,
      },
    ];

    return items;
  }

  function resolveWorkerCategoryLabel(listing) {
    const formData = parseListingFormData(listing);
    const cat =
      safeStr(listing?.category, "") ||
      safeStr(formData.workerCategory || formData.category, "");
    if (cat) return cat;
    const tags = filterSkillDisplayTags(getDisplayTags(listing));
    if (tags.length) {
      return `ワーカー · ${tags.slice(0, 2).join(" · ")}`;
    }
    return "ワーカー";
  }

  function resolveWorkerSubtitle(listing) {
    const desc = safeStr(listing?.description, "");
    const descLine = desc.split(/\r?\n/)[0]?.trim() || "";
    if (descLine.length > 8) {
      return truncateText(descLine, 72);
    }
    const services = safeStr(readWorkerListingField(listing, "worker_services"), "");
    const servicesLine = services.split(/\r?\n/)[0]?.trim() || "";
    if (servicesLine.length > 8) {
      return truncateText(servicesLine, 72);
    }
    const area = readWorkerListingField(listing, "worker_area");
    if (area) {
      return `${area}でサポートします`;
    }
    return "ワーカーの概要をご確認ください";
  }

  function resolveWorkerHeroSummaryText(listing) {
    const desc = safeStr(listing?.description, "");
    if (desc) {
      return truncateText(desc.replace(/\s+/g, " "), 160);
    }
    const legacyProfile = safeStr(readWorkerListingField(listing, "worker_profile"), "");
    if (legacyProfile) {
      return truncateText(legacyProfile.replace(/\s+/g, " "), 160);
    }
    const services = safeStr(readWorkerListingField(listing, "worker_services"), "");
    if (services) {
      return truncateText(services.replace(/\s+/g, " "), 160);
    }
    return "";
  }

  function buildWorkerHeroMetaItems(listing) {
    const area = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_area"),
      "要相談"
    );
    const hours = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_availability"),
      "未設定"
    );
    const experience = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_experience"),
      WORKER_DETAIL_EMPTY
    );

    return [
      { label: "対応エリア", value: truncateText(area, 28), accent: area !== "要相談" },
      { label: "稼働時間", value: truncateText(hours, 32), accent: hours !== "未設定" },
      {
        label: "経験年数",
        value: experience,
        accent: experience !== WORKER_DETAIL_EMPTY && experience !== "未登録",
      },
      {
        label: "対応状況",
        value: resolveSkillPublishStatusLabel(listing),
        accent: listing?.publish_status === "public",
      },
    ];
  }

  function renderWorkerHeroMeta(listing) {
    if (!WORKER_PAGE) return;

    const host = document.querySelector("[data-listing-hero-meta]");
    if (!host) return;

    const items = buildWorkerHeroMetaItems(listing);
    host.innerHTML = items
      .map(
        (item) => `
      <li class="skill-hero-meta__item${item.accent ? " skill-hero-meta__item--accent" : ""}">
        <span class="skill-hero-meta__label">${escapeHtml(item.label)}</span>
        <span class="skill-hero-meta__value">${escapeHtml(item.value)}</span>
      </li>`
      )
      .join("");
    host.hidden = false;

    const area = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_area"),
      "要相談"
    );
    const hours = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_availability"),
      "未設定"
    );
    const experience = workerDetailDisplayText(
      readWorkerListingField(listing, "worker_experience"),
      "—"
    );
    const deals =
      listing?.deals_count != null && !Number.isNaN(Number(listing.deals_count))
        ? `${Number(listing.deals_count)}件`
        : "—";

    document.querySelectorAll("[data-worker-hero-area]").forEach((el) => {
      el.textContent = truncateText(area, 28);
    });
    document.querySelectorAll("[data-worker-hero-hours]").forEach((el) => {
      el.textContent = truncateText(hours, 32);
    });
    document.querySelectorAll("[data-worker-hero-experience]").forEach((el) => {
      el.textContent = experience;
    });
    document.querySelectorAll("[data-worker-hero-deals]").forEach((el) => {
      el.textContent = deals;
    });
    document.querySelectorAll("[data-worker-seller-area]").forEach((el) => {
      el.textContent = truncateText(area, 24);
    });
  }

  function renderWorkerPrice(listing) {
    if (!WORKER_PAGE) return;

    const priceText = formatWorkerPriceForDetail(listing);

    document.querySelectorAll("[data-listing-worker-price]").forEach((el) => {
      el.textContent = safeStr(priceText, "");
    });
  }

  function renderWorkerDetails(listing) {
    if (!WORKER_PAGE) return;

    const section = getWorkerDetailsRoot();
    const body = document.getElementById("worker-details-body");
    if (!section || !body) {
      console.warn("[detail-worker] #section-details or #worker-details-body not found");
      return;
    }

    const fields = resolveWorkerDetailFieldValues(listing);

    const visibleCount = [
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-profile-block]",
        "[data-listing-worker-profile]",
        fields.profile
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-services-block]",
        "[data-listing-worker-services]",
        fields.services
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-area-block]",
        "[data-listing-worker-area]",
        fields.area
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-hours-block]",
        "[data-listing-worker-hours]",
        fields.availability
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-experience-block]",
        "[data-listing-worker-experience]",
        fields.experience
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-credentials-block]",
        "[data-listing-worker-credentials]",
        fields.credentials
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-price-block]",
        "[data-listing-worker-price]",
        fields.priceText
      ),
      fillWorkerDetailBlockIfPresent(
        "[data-listing-worker-notes-block]",
        "[data-listing-worker-notes]",
        fields.notes
      ),
    ].filter(Boolean).length;

    renderWorkerDetailSupportTags(listing, fields.supportTags);

    document.querySelectorAll("[data-listing-worker-hours-inline]").forEach((el) => {
      el.textContent = fields.availability;
    });

    const hasVisibleBlock =
      visibleCount > 0 ||
      Boolean(
        body.querySelector("[data-listing-worker-support-tags-block]:not([hidden])")
      );

    const emptyEl = body.querySelector("[data-listing-worker-details-empty]");
    if (emptyEl) {
      emptyEl.hidden = hasVisibleBlock;
    }

    section.hidden = false;
    section.removeAttribute("hidden");
    body.hidden = false;
    section.setAttribute("data-detail-keep", "");

    console.log("[detail-worker] detail blocks rendered", {
      visibleCount,
      fields,
    });
  }

  function resolveProductCategoryLabel(listing) {
    const formData = parseListingFormData(listing);
    const catText = resolveProductCategoryText(listing);
    if (catText) return `商品 · ${catText}`;
    const legacy = safeStr(formData.productCategory, "");
    if (legacy) return `商品 · ${legacy}`;
    return "商品";
  }

  function resolveJobCategoryDisplayText(job) {
    if (!job) return "";
    const sub = safeStr(job.subcategory, "");
    const cat = safeStr(job.category, "");
    if (sub && !/\[object Object\]/i.test(sub)) return sub;
    if (cat && !/\[object Object\]/i.test(cat)) return cat;
    return "";
  }

  function resolveJobCategoryLabel(listing) {
    const text = resolveJobCategoryDisplayText(getNormalizedJob(listing));
    if (text) return `求人・${text}`;
    const formData = parseListingFormData(listing);
    const Fields = window.TasuJobListingFields;
    const cat =
      Fields?.normalizeCategoryValue?.(formData.jobCategory) ||
      Fields?.normalizeCategoryValue?.(formData.category) ||
      "";
    if (cat) return `求人・${cat}`;
    const tags = getDisplayTags(listing);
    if (tags.length) return `求人・${tags[0]}`;
    return "求人";
  }

  const PRODUCT_HERO_FEATURE_RULES = [
    { pattern: /即|当日|翌日|スピード/i, label: "即対応" },
    { pattern: /商用|ビジネス利用/i, label: "商用利用OK" },
    { pattern: /修正|アフター|サポート/i, label: "修正対応" },
    { pattern: /高品質|プレミアム|高品/i, label: "高品質" },
    { pattern: /人気|ベスト|おすすめ/i, label: "人気" },
  ];

  const PRODUCT_CHECK_ICON_SVG = `<svg class="product-hero-feature__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>`;

  function buildProductHeroSummary(listing) {
    const product = getNormalizedProduct(listing);
    const desc = safeStr(product?.description, "");
    if (!desc) return "";

    const lines = [];
    desc
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const cleaned = line.replace(/^[-・*•●]\s*/, "").trim();
        if (cleaned.length >= 4 && cleaned.length <= 52) {
          lines.push(cleaned);
        }
      });

    if (lines.length === 0) {
      desc
        .split(/[。.!?]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 6)
        .slice(0, 3)
        .forEach((part) => lines.push(truncateText(part, 44)));
    }

    if (lines.length === 0) {
      return truncateText(desc.replace(/\s+/g, " "), 110);
    }

    return lines.slice(0, 3).join("\n");
  }

  function resolveProductSubtitle(listing) {
    const summary = buildProductHeroSummary(listing);
    if (summary) return summary;
    return "";
  }

  function buildProductHeroTags(listing) {
    const product = getNormalizedProduct(listing);
    const tags = [];
    const seen = new Set();

    function add(raw) {
      const tag = safeStr(raw, "");
      if (!tag || tag.length > 28) return;
      if (PRODUCT_HERO_EMPTY_VALUES.test(tag)) return;
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      tags.push(tag);
    }

    if (product) {
      add(product.category);
      add(product.subcategory);
      add(formatCondition(product.condition));
      add(formatDeliveryMethod(product.deliveryMethod));
      if (product.stockCount != null && product.stockCount !== "") {
        const stockNum = safeStr(product.stockCount, "");
        if (stockNum) add(`在庫${stockNum}`);
      }
      const publishLabel = resolveSkillPublishStatusLabel(listing);
      if (publishLabel && publishLabel !== "—") add(publishLabel);
    }

    const listingTags = window.TasuListingTags?.collectProductDisplayTags
      ? window.TasuListingTags.collectProductDisplayTags({
          ...listing,
          listing_type: "product",
          available_tags: listing?.available_tags,
        })
      : product?.tags || [];

    listingTags.forEach(add);

    const fd = parseListingFormData(listing);
    if (Array.isArray(fd.available_tags)) {
      fd.available_tags.forEach((t) => add(t));
    }

    return tags.slice(0, 14);
  }

  function buildProductHeroFeatures(listing) {
    const product = getNormalizedProduct(listing);
    const features = [];
    const seen = new Set();
    const tagBlob = buildProductHeroTags(listing).join(" ");

    function add(label) {
      const text = safeStr(label, "");
      if (!text || seen.has(text)) return;
      seen.add(text);
      features.push(text);
    }

    if (product?.deliveryDays && /即|当日|翌日|スピード/i.test(product.deliveryDays)) {
      add("即対応");
    }

    const condition = formatCondition(product?.condition);
    if (condition === "新品") add("高品質");
    if (condition) add(condition);

    const delivery = formatDeliveryMethod(product?.deliveryMethod);
    if (delivery) add(delivery);

    PRODUCT_HERO_FEATURE_RULES.forEach((rule) => {
      if (rule.pattern.test(tagBlob)) add(rule.label);
    });

    if (features.length < 3) {
      add("見積相談OK");
      add("カスタム対応");
      add("即相談可能");
    }

    return features.slice(0, 5);
  }

  function formatProductHeroPriceDisplay(listing) {
    const product = getNormalizedProduct(listing);
    const text =
      formatProductPriceValue(product?.price) || resolvePriceText(listing);
    if (!text || text === "要相談") {
      return { main: text || "要相談", showSuffix: false };
    }
    const main = text.replace(/〜+$/u, "");
    return { main, showSuffix: true };
  }

  function formatJobSalaryDisplay(job) {
    if (!job) return "";
    const text = safeStr(job.price?.text, "");
    if (!text || text === "¥0" || /^¥\s*0([,.]|$)/.test(text)) return "応相談";
    return text;
  }

  function formatJobRecruitmentCount(job) {
    const raw = safeStr(job?.recruitmentCount, "");
    if (!raw) return "";
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      return `${num}名`;
    }
    return raw;
  }

  function buildJobHeroSummary(listing) {
    const job = getNormalizedJob(listing);
    const desc = safeStr(job?.description, "");
    if (!desc) return "";

    const lines = [];
    desc
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const cleaned = line.replace(/^[-・*•●]\s*/, "").trim();
        if (cleaned.length >= 4 && cleaned.length <= 52) {
          lines.push(cleaned);
        }
      });

    if (lines.length === 0) {
      desc
        .split(/[。.!?]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 6)
        .slice(0, 3)
        .forEach((part) => lines.push(truncateText(part, 44)));
    }

    if (lines.length === 0) {
      return truncateText(desc.replace(/\s+/g, " "), 110);
    }

    return lines.slice(0, 3).join("\n");
  }

  function resolveJobHeroSubtitle(listing) {
    const summary = buildJobHeroSummary(listing);
    if (summary) return summary;
    return resolveJobSubtitle(listing);
  }

  function buildJobHeroTags(listing) {
    const job = getNormalizedJob(listing);
    const tags = [];
    const seen = new Set();

    function add(raw) {
      const tag = safeStr(raw, "");
      if (!tag || tag.length > 28) return;
      if (PRODUCT_HERO_EMPTY_VALUES.test(tag)) return;
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      tags.push(tag);
    }

    if (job) {
      add(formatJobWorkStyleDisplay(job.workStyle));
      add(formatJobEmploymentTypeDisplay(job.employmentType));
      if (job.salaryType) add(job.salaryType);
      const publishLabel = resolveSkillPublishStatusLabel(listing);
      if (publishLabel && publishLabel !== "—") add(publishLabel);

      const record = resolveJobListingRecord(listing);
      const deadline = formatJobDeadlineDisplay(
        readJobListingField(record, "application_deadline")
      );
      if (deadline) add(`締切 ${deadline}`);

      const formData = parseListingFormData(listing);
      const workStart = pickFormText(formData, ["work_start", "start_date"]);
      if (workStart) add(workStart);
      const featureLabels = formData.job_feature_labels || formData.jobFeatureLabels;
      if (Array.isArray(featureLabels)) {
        featureLabels.forEach(add);
      }
    }

    (job?.tags || []).forEach(add);
    getDisplayTags(listing).forEach(add);

    return tags.slice(0, 14);
  }

  function buildJobHeroFeatures(listing) {
    const job = getNormalizedJob(listing);
    const features = [];
    const seen = new Set();
    const tagBlob = buildJobHeroTags(listing).join(" ");

    function add(label) {
      const text = safeStr(label, "");
      if (!text || seen.has(text)) return;
      seen.add(text);
      features.push(text);
    }

    const formData = parseListingFormData(listing);
    const customFeatures = formData.job_feature_labels || listing.job_feature_labels;
    if (Array.isArray(customFeatures)) {
      customFeatures.forEach(add);
    }

    const workStyleLabel = formatJobWorkStyleDisplay(job?.workStyle);
    if (workStyleLabel && /リモート|在宅|ハイブリッド/i.test(workStyleLabel)) {
      add("リモート可");
    }
    if (workStyleLabel) add(workStyleLabel);
    const employmentLabel = formatJobEmploymentTypeDisplay(job?.employmentType);
    if (employmentLabel) add(employmentLabel);
    if (job?.location) add(truncateText(job.location, 18));
    if (/未経験|歓迎/i.test(tagBlob)) add("未経験歓迎");
    if (/フレックス|時短/i.test(tagBlob + (job?.workingHours || ""))) {
      add("フレックス");
    }

    if (features.length < 3) {
      add("即応募可能");
      add("質問OK");
      add("成長環境");
    }

    return features.slice(0, 5);
  }

  function renderJobContentFeatures(listing) {
    if (!JOB_PAGE) return;

    const host = document.querySelector("[data-listing-job-content-features]");
    const wrap = document.querySelector("[data-listing-job-content-features-wrap]");
    if (!host) return;

    const features = buildJobHeroFeatures(listing);
    if (!features.length) {
      host.innerHTML = "";
      if (wrap) wrap.hidden = true;
      return;
    }

    host.innerHTML = features
      .map(
        (label) => `
      <li class="job-content-features__item">
        ${JOB_CHECK_ICON_SVG.replace('class="job-hero-feature__icon"', 'class="job-content-features__icon"')}
        <span>${escapeHtml(label)}</span>
      </li>`
      )
      .join("");
    if (wrap) wrap.hidden = false;
  }

  const JOB_METRIC_ICON_SVGS = Object.freeze({
    employment:
      '<svg class="job-top-metric__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"/></svg>',
    salary:
      '<svg class="job-top-metric__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    hours:
      '<svg class="job-top-metric__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    count:
      '<svg class="job-top-metric__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    start:
      '<svg class="job-top-metric__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
  });

  const JOB_METRIC_ICON_KEYS = [
    "employment",
    "salary",
    "hours",
    "count",
    "start",
  ];

  function buildJobMetricIconMarkup(iconKey) {
    const svg =
      JOB_METRIC_ICON_SVGS[iconKey] || JOB_METRIC_ICON_SVGS.employment;
    return `<span class="job-top-metric__icon-wrap" aria-hidden="true">${svg}</span>`;
  }

  function resolveJobStartLabel(listing, record) {
    const tags = buildJobHeroTags(listing).join(" ");
    if (/即日|すぐ|早/i.test(tags)) return "即日開始可";
    const fd = parseListingFormData(listing);
    const raw =
      pickFormText(fd, ["work_start", "start_date", "job_start"]) ||
      safeStr(record?.work_start, "");
    return raw || "相談可";
  }

  function buildJobHeroMetrics(listing) {
    const record = resolveJobListingRecord(listing);
    const job = getNormalizedJob(listing);
    const employment =
      formatJobEmploymentTypeDisplay(
        readJobListingField(record, "employment_type") || job?.employmentType
      ) || "—";
    const salary = resolveJobSalaryDisplayText(listing) || "—";
    const hours =
      readJobListingField(record, "working_hours") ||
      safeStr(job?.workingHours, "") ||
      "—";
    const count = formatJobRecruitmentFromRecord(record) || "—";
    const start = resolveJobStartLabel(listing, record);

    return [
      { label: "雇用形態", value: employment },
      { label: "報酬", value: salary },
      { label: "想定稼働時間", value: hours },
      { label: "募集人数", value: count },
      { label: "勤務開始", value: start },
    ];
  }

  function renderJobHeroMetrics(listing) {
    if (!JOB_PAGE) return;
    const host = document.querySelector("[data-listing-job-hero-metrics]");
    if (!host) return;
    const section = host.closest(".job-top-card__metrics, .job-top-metrics");

    const metrics = buildJobHeroMetrics(listing);
    if (!metrics.length) {
      host.innerHTML = "";
      if (section) {
        section.hidden = true;
        section.setAttribute("hidden", "");
      }
      return;
    }

    host.innerHTML = metrics
      .map(
        (m, index) => `
      <div class="job-top-metric">
        ${buildJobMetricIconMarkup(JOB_METRIC_ICON_KEYS[index] || "employment")}
        <span class="job-top-metric__label">${escapeHtml(m.label)}</span>
        <strong class="job-top-metric__value">${escapeHtml(m.value)}</strong>
      </div>`
      )
      .join("");
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function resolveJobSalaryDisplayText(listing) {
    const record = resolveJobListingRecord(listing);
    const formData = parseListingFormData(listing);
    const salaryFromForm = pickFormText(formData, JOB_SALARY_KEYS);
    if (
      salaryFromForm &&
      salaryFromForm !== "要相談" &&
      !/^¥?\s*0([,.]|$)/.test(salaryFromForm)
    ) {
      return salaryFromForm;
    }

    const fromRecord = formatJobSalaryFromRecord(record);
    if (fromRecord && fromRecord !== "応相談") return fromRecord;

    const job = getNormalizedJob(listing);
    const fromJob = formatJobSalaryDisplay(job);
    if (fromJob && fromJob !== "応相談") return fromJob;

    return "";
  }

  function formatJobHeroPriceDisplay(listing) {
    const text = resolveJobSalaryDisplayText(listing);
    return { main: text || "応相談", showSuffix: false };
  }

  function buildJobHeroFvMiniSellerHtml(
    displayName,
    avatarHtml,
    badgeItems,
    isOnline,
    handleText,
    listingMeta
  ) {
    const name = safeStr(displayName, "");
    if (!name) return "";

    const authBadges = (badgeItems || []).filter((badge) =>
      /本人確認|法人認証/.test(safeStr(badge?.label, ""))
    );
    const badgesHtml = authBadges.length
      ? buildJobCompanyAuthBadgesHtml(authBadges)
      : "";
    const onlineHtml = isOnline
      ? `<p class="job-hero-fv-seller__online"><span class="job-hero-fv-seller__online-dot" aria-hidden="true"></span><span>オンライン</span></p>`
      : "";
    const handleHtml = handleText
      ? `<p class="job-hero-fv-seller__handle">${escapeHtml(handleText)}</p>`
      : "";
    const metaHtml = buildJobCompanyMetaCompactHtml(listingMeta || {});

    return (
      `<div class="job-hero-fv-seller__header">` +
      `<span class="job-hero-fv-seller__logo-wrap">${avatarHtml}</span>` +
      `<div class="job-hero-fv-seller__intro">` +
      `<p class="job-hero-fv-seller__name">${escapeHtml(name)}</p>` +
      badgesHtml +
      `</div></div>` +
      (onlineHtml || handleHtml
        ? `<div class="job-hero-fv-seller__identity">${onlineHtml}${handleHtml}</div>`
        : "") +
      (metaHtml ? `<div class="job-hero-fv-seller__meta">${metaHtml}</div>` : "")
    );
  }

  function renderJobHeroFvMiniSeller(
    displayName,
    avatarHtml,
    badgeItems,
    isOnline,
    handleText,
    listingMeta
  ) {
    if (!JOB_PAGE) return;

    const host = document.querySelector("[data-listing-job-hero-fv-seller]");
    if (!host) return;

    const inner = buildJobHeroFvMiniSellerHtml(
      displayName,
      avatarHtml,
      badgeItems,
      isOnline,
      handleText,
      listingMeta
    );
    if (!inner) {
      host.innerHTML = "";
      host.hidden = true;
      host.setAttribute("aria-hidden", "true");
      return;
    }

    host.className = "job-hero-fv-seller";
    host.href = "#section-seller";
    host.innerHTML = inner;
    host.hidden = false;
    host.removeAttribute("aria-hidden");
  }

  function renderJobHeroFvTags(listing) {
    if (!JOB_PAGE) return;

    const host = document.querySelector("[data-listing-job-hero-fv-tags]");
    const rewardWrap = document.querySelector("[data-listing-job-hero-fv-reward]");
    if (!host) return;

    const tags = buildJobHeroTags(listing).slice(0, 8);
    host.innerHTML = tags
      .map((label) => {
        const pillClass = resolveJobTagPillClass(label);
        return `<span class="${pillClass}">${escapeHtml(label)}</span>`;
      })
      .join("");

    const showMobileFv = tags.length > 0;
    host.hidden = !showMobileFv;
    host.toggleAttribute("aria-hidden", !showMobileFv);
    if (rewardWrap) {
      rewardWrap.hidden = false;
      rewardWrap.removeAttribute("aria-hidden");
    }
  }

  function renderJobHeroPricePanel(listing) {
    if (!JOB_PAGE) return;

    const { main } = formatJobHeroPriceDisplay(listing);
    const priceText = main || "応相談";

    document.querySelectorAll("[data-listing-price]").forEach((el) => {
      el.textContent = priceText;
    });

    document.querySelectorAll("[data-listing-job-fv-price]").forEach((el) => {
      el.textContent = priceText;
    });

    const rewardWrap = document.querySelector("[data-listing-job-hero-fv-reward]");
    if (rewardWrap) {
      rewardWrap.hidden = false;
      rewardWrap.removeAttribute("aria-hidden");
    }

    document
      .querySelectorAll(".job-cta-panel__tax, body[data-detail-type='job'] .skill-cta-panel__tax")
      .forEach((el) => {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      });

    document.querySelectorAll("[data-listing-job-cta-hints]").forEach((host) => {
      const showNegotiable =
        !priceText ||
        priceText === "応相談" ||
        /相談/i.test(priceText);
      if (showNegotiable) {
        host.innerHTML = "<li>相談可</li>";
        host.hidden = false;
        host.removeAttribute("hidden");
      } else {
        host.innerHTML = "";
        host.hidden = true;
      }
    });
  }

  function renderJobHeroStatusChip(listing) {
    if (!JOB_PAGE) return;

    const label = resolveSkillPublishStatusLabel(listing);
    document.querySelectorAll("[data-listing-job-status]").forEach((el) => {
      el.textContent = label;
      el.hidden = !label;
      if (label) {
        el.removeAttribute("hidden");
      }
      el.classList.toggle(
        "job-top-card__status--active",
        String(listing?.publish_status || "public").trim() === "public"
      );
    });
  }

  function buildJobContentSalaryDetail(listing) {
    const salary = resolveJobSalaryDisplayText(listing) || "応相談";
    const formData = parseListingFormData(listing);
    const bodySuffix =
      pickFormText(formData, [
        "salary_detail_suffix",
        "salary_body_suffix",
        "salary_note_suffix",
      ]) || "（スキル・経験・稼働時間に応じて決定）";
    const note =
      pickFormText(formData, [
        "salary_detail_note",
        "salary_supplement",
        "salary_note",
      ]) || "実力次第で単価アップ・ディレクター昇格あり。";

    const body = bodySuffix.startsWith("（")
      ? `${salary}${bodySuffix}`
      : `${salary}（${bodySuffix}）`;

    return { body, note };
  }

  function isJobDetailDesktopView() {
    return window.matchMedia("(min-width: 769px)").matches;
  }

  function syncJobDetailAccordionPresentation() {
    if (!JOB_PAGE) return;

    const isDesktop = isJobDetailDesktopView();
    document.querySelectorAll(".job-details-accordion").forEach((el) => {
      if (el.hidden) return;
      if (isDesktop) {
        el.setAttribute("open", "");
      } else {
        el.removeAttribute("open");
      }
    });
  }

  function renderJobContentSalaryDetail(listing) {
    if (!JOB_PAGE) return;

    const sectionWrap = document.querySelector("[data-listing-job-salary-wrap]");
    const wrap = document.querySelector("[data-listing-job-content-salary]");
    const bodyEl = document.querySelector("[data-listing-job-salary-body]");
    const noteEl = document.querySelector("[data-listing-job-salary-note]");
    if (!wrap || !bodyEl || !noteEl) return;

    const { body, note } = buildJobContentSalaryDetail(listing);
    const salaryAmount = resolveJobSalaryDisplayText(listing) || "応相談";
    if (!body || body === "応相談") {
      wrap.hidden = true;
      if (sectionWrap) sectionWrap.hidden = true;
      bodyEl.textContent = "";
      noteEl.textContent = "";
      return;
    }

    if (body.startsWith(salaryAmount)) {
      const suffix = body.slice(salaryAmount.length);
      bodyEl.innerHTML = `<span class="job-content-salary__amount">${escapeHtml(salaryAmount)}</span>${escapeHtml(suffix)}`;
    } else {
      bodyEl.textContent = body;
    }
    noteEl.textContent = note;
    wrap.hidden = false;
    wrap.removeAttribute("hidden");
    if (sectionWrap) {
      sectionWrap.hidden = false;
      sectionWrap.removeAttribute("hidden");
      sectionWrap.setAttribute("data-detail-keep", "");
    }
  }

  function hideJobPaymentPanel() {
    document.querySelectorAll("[data-listing-payment]").forEach((panel) => {
      panel.innerHTML = "";
      panel.hidden = true;
    });
  }

  function resolveSellerRankLabel(profile) {
    const rankRaw = safeStr(profile?.rankRaw, "");
    const rankKey = safeStr(profile?.rankKey || profile?.memberRank, "new");
    const labels = {
      new: "NEW",
      bronze: "BRONZE",
      silver: "SILVER",
      gold: "GOLD",
      platinum: "PLATINUM",
      legend: "LEGEND",
    };
    if (rankRaw) return rankRaw.toUpperCase();
    return labels[rankKey.toLowerCase()] || rankKey.toUpperCase();
  }

  function resolveSellerRankClass(profile) {
    const rankKey = safeStr(profile?.rankKey || profile?.memberRank, "new")
      .toLowerCase()
      .trim();
    const allowed = ["new", "bronze", "silver", "gold", "platinum", "legend"];
    return allowed.includes(rankKey) ? rankKey : "new";
  }

  function resolveJobSubtitle(listing) {
    const formData = parseListingFormData(listing);
    const loc = pickFormText(formData, JOB_LOCATION_KEYS);
    if (loc) return `${truncateText(loc, 40)}での募集`;
    const desc = resolveListingDescription(listing);
    const firstLine = desc.split(/\r?\n/)[0]?.trim() || "";
    if (firstLine && firstLine.length > 8) return truncateText(firstLine, 72);
    return "募集内容の概要をご確認ください";
  }

  function buildProductHeroMetaItems(listing) {
    const product = getNormalizedProduct(listing);
    const formData = parseListingFormData(listing);
    const stockSummary = resolveProductStockText(listing) || "要確認";
    const delivery =
      product?.deliveryMethod ||
      pickFormValue(formData, PRODUCT_DELIVERY_KEYS) ||
      pickFormValue(formData, SKILL_DELIVERY_KEYS) ||
      "未設定";
    const shipping =
      pickFormValue(formData, PRODUCT_SHIPPING_KEYS) || "未登録";
    const condition = resolveProductConditionText(listing, formData) || "未登録";
    const price = product?.price?.text || resolveProductPriceDisplay(listing);

    return [
      { label: "価格", value: price, accent: price !== "要相談" },
      {
        label: "在庫",
        value: truncateText(stockSummary, 24),
        accent: stockSummary !== "要確認",
      },
      { label: "納期", value: truncateText(delivery, 28), accent: delivery !== "未設定" },
      { label: "配送", value: truncateText(shipping, 28), accent: shipping !== "未登録" },
      {
        label: "状態",
        value: truncateText(condition, 20),
        accent: condition !== "未登録",
      },
      {
        label: "受付",
        value: resolveSkillPublishStatusLabel(listing),
        accent: listing?.publish_status === "public",
      },
    ];
  }

  function isRegisteredProductHeroValue(value) {
    const text = safeStr(value, "");
    if (!text) return false;
    return !PRODUCT_HERO_EMPTY_VALUES.test(text);
  }

  function buildProductHeroMetaChips(listing) {
    const product = getNormalizedProduct(listing);
    if (!product) return [];

    const chips = [];
    const condition = formatCondition(product.condition);
    if (isRegisteredProductHeroValue(condition)) {
      chips.push({ label: "状態", value: condition });
    }

    const delivery = formatDeliveryMethod(product.deliveryMethod);
    if (isRegisteredProductHeroValue(delivery)) {
      chips.push({ label: "配送", value: delivery });
    }

    const stock = safeStr(product.stockCount, "");
    if (isRegisteredProductHeroValue(stock)) {
      chips.push({ label: "在庫", value: stock });
    }

    const deliveryDays = safeStr(product.deliveryDays, "");
    if (isRegisteredProductHeroValue(deliveryDays)) {
      chips.push({ label: "発送目安", value: deliveryDays });
    }

    return chips;
  }

  function renderProductHeroFeatures(listing) {
    if (!PRODUCT_PAGE) return;

    const host = document.querySelector("[data-listing-product-hero-features]");
    if (!host) return;

    const features = buildProductHeroFeatures(listing);
    if (!features.length) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }

    host.innerHTML = features
      .map(
        (label) => `
      <li class="product-hero-feature">
        ${PRODUCT_CHECK_ICON_SVG}
        <span class="product-hero-feature__text">${escapeHtml(label)}</span>
      </li>`
      )
      .join("");
    host.hidden = false;
  }

  function buildJobCompanyAuthBadgesHtml(badgeItems) {
    if (!badgeItems?.length) return "";
    return `<div class="job-top-company__badges" aria-label="認証情報">${badgeItems
      .map(
        (b) =>
          `<span class="job-company-badge job-company-badge--${escapeHtml(b.variant || "verified")}">${escapeHtml(b.label)}</span>`
      )
      .join("")}</div>`;
  }

  async function resolveJobHeroListingCountLabel(profile, sellerUserId) {
    const uid = safeStr(profile?.userId || sellerUserId, "");
    if (Number.isFinite(profile?.jobListingCount) && profile.jobListingCount >= 0) {
      return `${profile.jobListingCount}件`;
    }
    const demo = window.TasuListingSellerProfile?.DEMO_PROFILES?.[uid];
    if (Number.isFinite(demo?.jobListingCount) && demo.jobListingCount >= 0) {
      return `${demo.jobListingCount}件`;
    }
    if (window.TasuListingSellerProfile?.fetchPublicJobListingCount) {
      try {
        const count =
          await window.TasuListingSellerProfile.fetchPublicJobListingCount(uid);
        if (Number.isFinite(count) && count >= 0) return `${count}件`;
      } catch (err) {
        console.warn("[detail-job] job listing count fetch failed:", err);
      }
    }
    return "—";
  }

  const JOB_COMPANY_STAT_ICON_SVGS = Object.freeze({
    listings:
      '<svg class="job-top-company__stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
    response:
      '<svg class="job-top-company__stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    deals:
      '<svg class="job-top-company__stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
  });

  function buildJobCompanyMetaLineHtml(icon, text) {
    const value = safeStr(text, "");
    if (!value || value === "—") return "";
    return `<li class="job-top-company__meta-line">
      <span class="job-top-company__meta-icon" aria-hidden="true">${icon}</span>
      <span class="job-top-company__meta-text">${escapeHtml(value)}</span>
    </li>`;
  }

  function buildJobCompanyOnlineHtml(isOnline) {
    if (!isOnline) return "";

    return `<p class="job-top-company__online job-top-company__online--active">
      <span class="job-top-company__online-dot" aria-hidden="true"></span>
      <span class="job-top-company__online-text">オンライン</span>
    </p>`;
  }

  function buildJobCompanyMetaLinesHtml(meta) {
    const lines = [
      buildJobCompanyMetaLineHtml("📍", meta.location),
      buildJobCompanyMetaLineHtml("🏢", meta.industry),
      buildJobCompanyMetaLineHtml("📄", meta.recruitmentStatus),
    ].filter(Boolean);

    if (!lines.length) return "";
    return `<ul class="job-top-company__meta-lines" aria-label="企業情報">${lines.join("")}</ul>`;
  }

  function buildJobCompanyMetaRowHtml(label, value) {
    const text = safeStr(value, "");
    if (!text || text === "—") return "";
    return `<p class="job-top-company__meta-row">
      <span class="job-top-company__meta-label">${escapeHtml(label)}</span>
      <span class="job-top-company__meta-value">${escapeHtml(text)}</span>
    </p>`;
  }

  function buildJobCompanyMetaCompactHtml(meta) {
    const rows = [
      buildJobCompanyMetaRowHtml("所在地", meta.location),
      buildJobCompanyMetaRowHtml("業種", meta.industry),
      buildJobCompanyMetaRowHtml("募集状況", meta.recruitmentStatus),
    ].filter(Boolean);

    if (!rows.length) return "";
    return `<div class="job-top-company__meta-rows" aria-label="企業情報">${rows.join("")}</div>`;
  }

  function buildJobCompanyStatHtml(label, value) {
    return `<div class="job-top-company__stat">
      <span class="job-top-company__stat-label">${escapeHtml(label)}</span>
      <strong class="job-top-company__stat-value">${escapeHtml(value || "—")}</strong>
    </div>`;
  }

  function buildJobCompanyStatsHtml(listingCount, responseTime, dealsLabel, lastLogin) {
    return `<div class="job-top-company__stats" aria-label="統計">
      ${buildJobCompanyStatHtml("掲載求人数", listingCount)}
      ${buildJobCompanyStatHtml("返信目安", responseTime)}
      ${buildJobCompanyStatHtml("採用実績", dealsLabel)}
      ${buildJobCompanyStatHtml("最終ログイン", lastLogin)}
    </div>`;
  }

  async function renderProductHeroSellerCard(listing, profile) {
    if (!PRODUCT_PAGE && !JOB_PAGE && !WORKER_PAGE && !SKILL_PAGE) return;

    const host = document.querySelector(
      "[data-listing-product-hero-seller], [data-listing-job-hero-seller], [data-listing-worker-hero-seller], [data-listing-skill-hero-seller]"
    );
    if (!host) return;

    const sellerUserId = resolveSellerUserId(listing);
    const displayName =
      safeStr(profile?.displayName, "") ||
      safeStr(profile?.display_name, "") ||
      "";
    const handle =
      safeStr(profile?.handle, "") ||
      safeStr(sellerUserId, "").replace(/^@/, "");
    const avatarUrl =
      safeStr(profile?.avatarUrl, "") ||
      safeStr(profile?.avatar_url, "") ||
      "https://placehold.co/64x64/f3ead4/967622?text=S";

    if (!displayName && !handle && !sellerUserId) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }

    const handleText = handle ? `@${handle.replace(/^@/, "")}` : "";
    const deals =
      profile && window.TasuListingSellerProfile?.formatDealsDisplay
        ? window.TasuListingSellerProfile.formatDealsDisplay(profile)
        : profile
          ? safeStr(profile.dealsLabel, "—")
          : "—";
    const followers = profile ? safeStr(profile.followersLabel, "—") : "—";
    const availability = profile
      ? safeStr(profile.availabilityLabel, "—")
      : "—";

    if (JOB_PAGE) {
      const badgeItems =
        profile && window.TasuListingSellerProfile?.buildJobCompanyBadges
          ? window.TasuListingSellerProfile.buildJobCompanyBadges(profile)
          : [];
      const listingMeta =
        window.TasuListingSellerProfile?.extractJobCompanyListingMeta?.(listing) || {
          location: "—",
          industry: "—",
          recruitmentStatus: "—",
        };
      const statusClass = safeStr(profile?.availabilityStatus, "offline");
      const isOnline = statusClass === "online";
      host.className =
        "job-top-company job-top-company--hero-compact product-hero-seller-card";
      const Renderer = window.TasuJobTopRenderer;
      const companyAvatarHtml = Renderer?.buildCompanyAvatarHtml
        ? Renderer.buildCompanyAvatarHtml({
            companyName: displayName || "募集者",
            thumbnail: avatarUrl,
            sizeClass: "job-company-avatar--hero",
            alt: `${displayName || "募集者"}のロゴ`,
          })
        : `<img class="job-top-company__logo profile-avatar" src="${escapeHtml(avatarUrl)}" alt="" width="72" height="72" loading="lazy" decoding="async">`;
      const authBadgesHtml = buildJobCompanyAuthBadgesHtml(badgeItems);
      const onlineHtml = buildJobCompanyOnlineHtml(isOnline);
      const metaCompactHtml = buildJobCompanyMetaCompactHtml(listingMeta);
      const handleHtml = handleText
        ? `<p class="job-top-company__handle">${escapeHtml(handleText)}</p>`
        : "";
      host.innerHTML = `
        <div class="job-top-company__header">
          <div class="job-top-company__brand">
            <span class="job-top-company__logo-wrap">${companyAvatarHtml}</span>
            ${onlineHtml}
          </div>
          <div class="job-top-company__intro">
            <p class="job-top-company__name">${escapeHtml(displayName || "募集者")}</p>
            ${authBadgesHtml}
            ${handleHtml}
          </div>
        </div>
        ${metaCompactHtml}`;
      host.hidden = false;
      renderJobHeroFvMiniSeller(
        displayName,
        companyAvatarHtml,
        badgeItems,
        isOnline,
        handleText,
        listingMeta
      );
      return;
    }

    const rankKey = profile
      ? safeStr(profile.rankKey || profile.memberRank, "new").toLowerCase()
      : "new";
    const rankClass =
      (profile &&
        window.TasuListingSellerProfile?.resolveRankPlateImageKey?.(rankKey)) ||
      (profile ? resolveSellerRankClass(profile) : "new");
    const rankLabel =
      (profile &&
        window.TasuListingSellerProfile?.resolveRankBadgeLabel?.(
          profile.rankRaw,
          rankKey
        )) ||
      (profile ? resolveSellerRankLabel(profile) : "NEW");
    let ratingValue =
      document.querySelector("[data-seller-rating-value]")?.textContent?.trim() ||
      "—";
    let ratingCount =
      document.querySelector("[data-seller-rating-count]")?.textContent?.trim() ||
      "";
    if (
      WORKER_PAGE &&
      profile?.userId &&
      (!ratingValue || ratingValue === "—")
    ) {
      const rating = await resolveWorkerHeroMemberRating(profile);
      ratingValue = rating.value;
      ratingCount = rating.sub || "";
    }
    const lastLogin = profile
      ? profile.lastLoginLabel && profile.lastLoginLabel !== "—"
        ? profile.lastLoginLabel
        : "—"
      : "—";

    const badgeItems = (
      profile && window.TasuListingSellerProfile?.buildBadges
        ? window.TasuListingSellerProfile.buildBadges(profile)
        : []
    ).filter((b) => b.variant !== "online");
    const badgesHtml = badgeItems.length
      ? badgeItems
          .map(
            (b) =>
              `<span class="skill-seller-badge tag-chip skill-seller-badge--${escapeHtml(b.variant)}">${escapeHtml(b.label)}</span>`
          )
          .join("")
      : "";
    const statusClass = safeStr(profile?.availabilityStatus, "offline");
    const availabilityStatHtml =
      statusClass === "online"
        ? `<span class="product-hero-seller-online product-hero-seller-card__stat-value product-hero-seller-card__stat-value--status" role="status">${escapeHtml(availability)}</span>`
        : `<strong class="product-hero-seller-card__stat-value product-hero-seller-card__stat-value--status is-${escapeHtml(statusClass)}">${escapeHtml(availability)}</strong>`;

    host.dataset.sellerRank = rankKey;
    host.className =
      PRODUCT_PAGE || SKILL_PAGE
        ? "product-hero-seller-card"
        : `product-hero-seller-card rank-${escapeHtml(rankClass)}`;
    host.innerHTML = `
      <div class="product-hero-seller-card__avatar-wrap">
        <img class="product-hero-seller-card__avatar profile-avatar rank-${escapeHtml(rankClass)}" src="${escapeHtml(avatarUrl)}" alt="" width="52" height="52" loading="lazy" decoding="async">
      </div>
      <div class="product-hero-seller-card__main">
        <div class="product-hero-seller-card__head">
          <span class="product-hero-seller-card__rank seller-rank-chip rank-${escapeHtml(rankClass)}">${escapeHtml(rankLabel)}</span>
          ${badgesHtml}
        </div>
        <div class="product-hero-seller-name-wrap">
          <p class="product-hero-seller-card__name product-hero-seller-name seller-name rank-${escapeHtml(rankClass)}">${escapeHtml(displayName || (JOB_PAGE ? "募集者" : WORKER_PAGE ? "ワーカー" : "出品者"))}</p>
        </div>
        ${handleText ? `<p class="product-hero-seller-card__handle">${escapeHtml(handleText)}</p>` : ""}
        <div class="product-hero-seller-card__stats">
          <div class="product-hero-seller-card__stat">
            <span class="product-hero-seller-card__stat-label">実績</span>
            <strong class="product-hero-seller-card__stat-value">${escapeHtml(deals)}</strong>
          </div>
          <div class="product-hero-seller-card__stat">
            <span class="product-hero-seller-card__stat-label">評価</span>
            <strong class="product-hero-seller-card__stat-value">${escapeHtml(ratingValue)}${ratingCount ? `<span class="product-hero-seller-card__stat-sub">${escapeHtml(ratingCount)}</span>` : ""}</strong>
          </div>
          <div class="product-hero-seller-card__stat">
            <span class="product-hero-seller-card__stat-label">フォロワー</span>
            <strong class="product-hero-seller-card__stat-value">${escapeHtml(followers)}</strong>
          </div>
          <div class="product-hero-seller-card__stat">
            <span class="product-hero-seller-card__stat-label">稼働</span>
            ${availabilityStatHtml}
          </div>
        </div>
        <p class="product-hero-seller-card__login">最終ログイン：${escapeHtml(lastLogin)}</p>
      </div>`;
    host.hidden = false;
  }

  function formatWorkerMemberHandle(profile) {
    const SellerProfile = window.TasuListingSellerProfile;
    if (SellerProfile?.formatHandle) {
      return SellerProfile.formatHandle(profile?.handle, profile?.userId);
    }
    const handle = safeStr(profile?.handle, "").replace(/^@/, "");
    return handle ? `@${handle}` : "";
  }

  async function resolveWorkerHeroMemberRating(profile) {
    const userId = safeStr(profile?.userId, "");
    if (!userId || !window.TasuDetailTrustScore?.fetchReviewScore) {
      return { value: "—", sub: "" };
    }
    try {
      const row = await window.TasuDetailTrustScore.fetchReviewScore(userId);
      const display = window.TasuDetailTrustScore.formatTrustDisplay(row);
      if (display?.variant === "rated") {
        return {
          value: safeStr(display.average, "—"),
          sub: display.total ? `(${display.total}件)` : "",
        };
      }
      return { value: safeStr(display?.text, "—"), sub: "" };
    } catch {
      return { value: "—", sub: "" };
    }
  }

  /** 下部 #section-seller をプロフィール表示に固定（worker listing 項目は混ぜない） */
  function syncWorkerSellerSectionFromProfile(profile) {
    if (!WORKER_PAGE || !profile) return;

    const section = document.querySelector(
      "#section-seller[data-listing-seller]"
    );
    if (!section) return;

    const displayName =
      safeStr(profile.displayName, "") ||
      safeStr(profile.display_name, "") ||
      "ワーカー";

    section.querySelectorAll("[data-seller-display-name]").forEach((el) => {
      el.textContent = displayName;
    });

    const handleText = formatWorkerMemberHandle(profile);
    section.querySelectorAll("[data-seller-handle]").forEach((el) => {
      el.textContent = handleText || "@—";
    });

    const avatar = section.querySelector("[data-seller-avatar]");
    if (avatar) {
      avatar.src =
        safeStr(profile.avatarUrl, "") ||
        safeStr(profile.avatar_url, "") ||
        avatar.src;
      avatar.alt = `${displayName}のプロフィール`;
    }

    const lastLogin =
      profile.lastLoginLabel && profile.lastLoginLabel !== "—"
        ? `最終ログイン：${profile.lastLoginLabel}`
        : "最終ログイン：—";
    section.querySelectorAll("[data-seller-last-login]").forEach((el) => {
      el.textContent = lastLogin;
    });

    if (window.TasuListingSellerProfile?.applySellerRankDisplay) {
      window.TasuListingSellerProfile.applySellerRankDisplay(section, profile);
    }
  }

  function bindWorkerSellerSectionActions(listing) {
    if (!WORKER_PAGE) return;

    const section = document.querySelector("#section-seller");
    if (!section) return;

    const consultHref =
      document
        .querySelector("[data-listing-primary-cta]")
        ?.getAttribute("href") || "#";

    section.querySelectorAll(".seller-apply-btn").forEach((el) => {
      el.textContent = "相談する";
      el.setAttribute("href", consultHref);
    });

    section.querySelectorAll(".seller-more-jobs-btn").forEach((el) => {
      el.setAttribute("href", "#otherServices");
      const label = el.querySelector("span");
      if (label) {
        label.textContent = "関連ワーカーを見る";
      }
    });
  }

  function bindJobSellerSectionActions(listing) {
    void listing;
  }

  function bindProductSellerSectionActions(listing) {
    if (!PRODUCT_PAGE) return;

    const section = document.querySelector("#section-seller");
    if (!section) return;

    const consultHref =
      document
        .querySelector("[data-listing-primary-cta]")
        ?.getAttribute("href") || "#";

    section.querySelectorAll(".seller-apply-btn").forEach((el) => {
      el.textContent = "購入・相談する";
      el.setAttribute("href", consultHref);
    });

    section.querySelectorAll(".seller-more-jobs-btn").forEach((el) => {
      el.setAttribute("href", "#otherServices");
      const label = el.querySelector("span");
      if (label) {
        label.textContent = "他の商品を見る";
      }
    });
  }

  async function loadWorkerMemberProfile(listing, existingProfile = null) {
    if (!WORKER_PAGE || !listing) return null;

    const userId = resolveSellerUserId(listing);
    let profile = existingProfile;

    if (!profile && userId && window.TasuListingSellerProfile?.fetchSellerProfile) {
      profile = await window.TasuListingSellerProfile.fetchSellerProfile(
        userId,
        { listing }
      );
    }

    if (!userId && !profile) {
      await renderProductHeroSellerCard(listing, null);
      return null;
    }

    if (
      profile?.userId &&
      !existingProfile &&
      window.TasuDetailTrustScore?.initForUser
    ) {

      try {
        await window.TasuDetailTrustScore.initForUser(profile.userId);
      } catch (err) {
        console.warn("[detail-worker] trust score init failed:", err);
      }
    }

    await renderProductHeroSellerCard(listing, profile);
    return profile;
  }

  function renderProductHeroPricePanel(listing) {
    if (!PRODUCT_PAGE) return;

    const { main, showSuffix } = formatProductHeroPriceDisplay(listing);

    document.querySelectorAll("[data-listing-price]").forEach((el) => {
      el.textContent = main;
    });

    document.querySelectorAll("[data-listing-price-suffix]").forEach((el) => {
      el.hidden = !showSuffix;
    });
  }

  function buildJobHeroMetaItems(listing) {
    const formData = parseListingFormData(listing);
    const salary =
      pickFormText(formData, JOB_SALARY_KEYS) || resolvePriceText(listing);
    const location = pickFormText(formData, JOB_LOCATION_KEYS) || "要相談";
    const conditions =
      pickFormText(formData, JOB_CONDITIONS_KEYS) || "未登録";
    const requirements =
      pickFormText(formData, JOB_REQUIREMENTS_KEYS) || "詳細をご確認ください";

    return [
      { label: "報酬", value: truncateText(salary, 28), accent: salary !== "要相談" },
      { label: "勤務地", value: truncateText(location, 28), accent: location !== "要相談" },
      {
        label: "勤務条件",
        value: truncateText(conditions, 28),
        accent: conditions !== "未登録",
      },
      {
        label: "応募条件",
        value: truncateText(requirements, 28),
        accent: requirements !== "詳細をご確認ください",
      },
      {
        label: "募集状況",
        value: resolveSkillPublishStatusLabel(listing),
        accent: listing?.publish_status === "public",
      },
    ];
  }

  function renderPremiumHeroMeta(listing, items) {
    const host = document.querySelector("[data-listing-hero-meta]");
    if (!host || !items?.length) return;

    host.innerHTML = items
      .map(
        (item) => `
      <li class="skill-hero-meta__item${item.accent ? " skill-hero-meta__item--accent" : ""}">
        <span class="skill-hero-meta__label">${escapeHtml(item.label)}</span>
        <span class="skill-hero-meta__value">${escapeHtml(item.value)}</span>
      </li>`
      )
      .join("");
    host.hidden = false;
  }

  function renderProductDetails(listing) {
    if (!PRODUCT_PAGE) return;

    const section =
      document.getElementById("section-details") ||
      document.querySelector("[data-listing-product-details]");
    if (!section) return;

    const product = listing?.productNormalized || getNormalizedProduct(listing);
    console.log("renderProductDetails input:", product);
    if (!product) return;

    const description = product.description || PRODUCT_DETAIL_EMPTY;
    const categoryText =
      [product.category, product.subcategory].filter(Boolean).join("・") ||
      PRODUCT_DETAIL_EMPTY;
    const conditionText =
      formatCondition(product.condition) || PRODUCT_DETAIL_EMPTY;
    const priceText = formatProductPriceValue(product.price) || PRODUCT_DETAIL_EMPTY;
    const stockText =
      [
        product.stockCount ? `在庫：${product.stockCount}` : "",
        product.deliveryDays ? `発送目安：${product.deliveryDays}` : "",
      ]
        .filter(Boolean)
        .join(" / ") || PRODUCT_DETAIL_EMPTY;
    const deliveryText =
      formatDeliveryMethod(product.deliveryMethod) || PRODUCT_DETAIL_EMPTY;
    const specText = product.spec || PRODUCT_DETAIL_EMPTY;

    const detailBlocks = section.querySelectorAll(
      ".skill-details-premium__body > .skill-details-block"
    );
    const detailValues = [
      description,
      categoryText,
      conditionText,
      priceText,
      stockText,
      specText,
      deliveryText,
    ];

    if (detailBlocks.length < detailValues.length) {
      console.warn(
        "[renderProductDetails] detail block count mismatch:",
        detailBlocks.length,
        "expected",
        detailValues.length
      );
    }

    detailValues.forEach((value, index) => {
      setProductDetailBlock(detailBlocks[index], value, {
        emptyText: PRODUCT_DETAIL_EMPTY,
      });
    });

    section.hidden = false;
    section.setAttribute("data-detail-keep", "");
  }

  function resolveJobListingRecord(listing) {
    const source = listing?._sourceRow || listing || {};
    const record = { ...source, ...listing };
    if (listing?._sourceRow) {
      copyJobListingColumns(record, listing._sourceRow);
    }
    return record;
  }

  function readJobListingField(record, key) {
    const value = record?.[key];
    if (value == null || value === "") return "";
    return String(value).trim();
  }

  const JOB_WORK_STYLE_LABELS = {
    yes: "リモートOK",
    remote: "リモートOK",
    remote_ok: "リモートOK",
    hybrid: "ハイブリッド",
    no: "出社",
    onsite: "出社",
    office: "出社",
  };

  const JOB_EMPLOYMENT_TYPE_LABELS = {
    contract: "業務委託",
    fulltime: "正社員",
    parttime: "アルバイト・パート",
    freelance: "フリーランス",
  };

  function formatJobWorkStyleDisplay(raw) {
    const text = safeStr(raw, "");
    if (!text) return "";
    const key = text.toLowerCase();
    if (JOB_WORK_STYLE_LABELS[key]) return JOB_WORK_STYLE_LABELS[key];
    if (text === "出社必須") return "出社";
    return text;
  }

  function formatJobEmploymentTypeDisplay(raw) {
    const text = safeStr(raw, "");
    if (!text) return "";
    const key = text.toLowerCase();
    if (JOB_EMPLOYMENT_TYPE_LABELS[key]) return JOB_EMPLOYMENT_TYPE_LABELS[key];
    return text;
  }

  function formatJobDeadlineDisplay(value) {
    if (window.TasuJobListingFields?.formatDeadline) {
      return window.TasuJobListingFields.formatDeadline(value) || "";
    }
    return safeStr(value, "");
  }

  function formatJobSalaryFromRecord(record) {
    if (!record) return "";
    const formData = parseListingFormData(record);
    const salaryFromForm = pickFormText(formData, JOB_SALARY_KEYS);
    if (
      salaryFromForm &&
      salaryFromForm !== "要相談" &&
      !/^¥?\s*0([,.]|$)/.test(salaryFromForm)
    ) {
      return salaryFromForm;
    }

    const normalized = getNormalizedJob({
      ...record,
      listing_type: "job",
      _sourceRow: record,
    });
    const text = formatJobSalaryDisplay(normalized);
    if (text && text !== "応相談") return text;

    const amount = record.salary_amount ?? record.price_amount;
    const num = Number(amount);
    if (Number.isFinite(num) && num > 0) {
      const salaryType =
        readJobListingField(record, "salary_type") ||
        pickFormText(formData, ["salary_type", "salaryType", "pay_type"]);
      const formatted =
        window.TasuJobListingFields?.formatJobAmountDisplay?.(num, salaryType);
      if (formatted) return formatted;
      return `¥${num.toLocaleString("ja-JP")}〜`;
    }
    return safeStr(record.salary_type, "");
  }

  function formatJobRecruitmentFromRecord(record) {
    const raw = record?.recruitment_count;
    if (raw == null || raw === "") return "";
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      return `${num}名`;
    }
    return String(raw).trim();
  }

  function isJobDetailValueEmpty(value) {
    const text = safeStr(value, "");
    if (!text) return true;
    return text === JOB_DETAIL_EMPTY || text === "未登録" || text === "—";
  }

  function fillJobDescriptionBody(bodyEl, text) {
    if (!bodyEl) return false;
    if (isJobDetailValueEmpty(text)) {
      bodyEl.textContent = "";
      return false;
    }

    bodyEl.textContent = "";
    const paragraphs = String(text)
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1) {
      const p = document.createElement("p");
      p.textContent = paragraphs[0] || String(text).trim();
      bodyEl.appendChild(p);
    } else {
      paragraphs.forEach((para) => {
        const p = document.createElement("p");
        p.textContent = para;
        bodyEl.appendChild(p);
      });
    }

    return true;
  }

  function fillJobAccordionBlock(wrap, bodyEl, text) {
    if (!wrap || !bodyEl) return false;
    if (isJobDetailValueEmpty(text)) {
      wrap.hidden = true;
      wrap.removeAttribute("open");
      bodyEl.textContent = "";
      return false;
    }

    bodyEl.textContent = String(text).trim();
    wrap.hidden = false;
    wrap.removeAttribute("open");
    return true;
  }

  const JOB_TEXT_ACCORDION_FIELDS = [
    {
      wrap: "[data-listing-job-required-wrap]",
      body: "[data-listing-job-required]",
      key: "required_skills",
    },
    {
      wrap: "[data-listing-job-welcome-wrap]",
      body: "[data-listing-job-welcome]",
      key: "welcome_skills",
    },
    {
      wrap: "[data-listing-job-benefits-wrap]",
      body: "[data-listing-job-benefits]",
      key: "job_benefits",
    },
    {
      wrap: "[data-listing-job-application-wrap]",
      body: "[data-listing-job-application]",
      key: "application_method",
    },
    {
      wrap: "[data-listing-job-contract-wrap]",
      body: "[data-listing-job-contract]",
      key: "contract_terms",
    },
  ];

  function renderJobTextAccordions(record) {
    const container = document.querySelector("[data-listing-job-accordions]");
    const stackWrap = document.querySelector("[data-listing-job-accordions-wrap]");
    if (!container) return false;

    let visibleCount = 0;
    JOB_TEXT_ACCORDION_FIELDS.forEach(({ wrap, body, key }) => {
      const wrapEl = document.querySelector(wrap);
      const bodyEl = document.querySelector(body);
      if (
        fillJobAccordionBlock(wrapEl, bodyEl, readJobListingField(record, key))
      ) {
        visibleCount += 1;
      }
    });

    if (stackWrap) {
      stackWrap.hidden = visibleCount === 0;
      if (visibleCount > 0) {
        stackWrap.setAttribute("data-detail-keep", "");
      }
    }
    syncJobDetailAccordionPresentation();
    return visibleCount > 0;
  }

  function renderJobDetails(listing) {
    if (!JOB_PAGE) return;

    const record = resolveJobListingRecord(listing);

    console.log("[detail-job] listing job fields", {
      job_location: record.job_location,
      work_style: record.work_style,
      employment_type: record.employment_type,
      working_hours: record.working_hours,
      required_skills: record.required_skills,
      welcome_skills: record.welcome_skills,
      job_benefits: record.job_benefits,
      recruitment_count: record.recruitment_count,
      application_deadline: record.application_deadline,
      application_method: record.application_method,
      contract_terms: record.contract_terms,
    });

    const descWrap = document.querySelector("[data-listing-job-description-wrap]");
    const descBody = document.querySelector("[data-listing-job-description]");

    const hasDescription = fillJobDescriptionBody(
      descBody,
      readJobListingField(record, "description")
    );
    if (descWrap) {
      descWrap.hidden = !hasDescription;
      if (hasDescription) {
        descWrap.setAttribute("data-detail-keep", "");
      }
    }

    renderJobTextAccordions(record);
    renderJobContentFeatures(listing);
    renderJobContentSalaryDetail(listing);
  }

  function renderProductHero(listing) {
    if (!PRODUCT_PAGE) return;

    const title = resolveProductTitle(listing);
    const subtitle = resolveProductSubtitle(listing);
    const categoryLabel = resolveProductCategoryLabel(listing);

    document.querySelectorAll("[data-listing-service-name]").forEach((el) => {
      el.textContent = title;
      el.hidden = false;
    });
    setText("[data-listing-title]", title);
    document
      .querySelectorAll("[data-listing-subtitle], [data-listing-product-hero-summary]")
      .forEach((el) => {
        el.textContent = subtitle;
        el.hidden = !subtitle;
      });
    document.querySelectorAll("[data-listing-category-badge]").forEach((el) => {
      el.textContent = categoryLabel;
    });
    document
      .querySelectorAll(".skill-hero-section [data-listing-description]")
      .forEach((el) => {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      });

    renderProductHeroFeatures(listing);
    renderProductHeroPricePanel(listing);

    bindProductFavoriteTarget(listing);
    document.title = `${title} | TasuFull 商品`;
  }

  function renderJobHero(listing) {
    if (!JOB_PAGE) return;

    const job = getNormalizedJob(listing);
    const title = safeStr(job?.title, "") || safeStr(listing.title, "求人掲載");
    const subtitle = resolveJobHeroSubtitle(listing);

    document.querySelectorAll("[data-listing-service-name]").forEach((el) => {
      el.textContent = title;
      el.hidden = false;
    });
    setText("[data-listing-title]", title);
    document
      .querySelectorAll(
        "[data-listing-subtitle], [data-listing-job-hero-summary]"
      )
      .forEach((el) => {
        el.textContent = subtitle;
        el.hidden = !subtitle;
      });
    document.querySelectorAll("[data-listing-category-badge]").forEach((el) => {
      el.textContent = "求人";
      el.hidden = false;
      el.removeAttribute("hidden");
      el.removeAttribute("aria-hidden");
    });
    document
      .querySelectorAll(".skill-hero-section [data-listing-description]")
      .forEach((el) => {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      });

    renderJobHeroPricePanel(listing);
    renderJobHeroFvTags(listing);
    renderJobHeroStatusChip(listing);
    renderJobHeroMetrics(listing);
    bindJobFavoriteTarget(listing);
    document.title = `${title} | TasuFull 求人`;
  }

  function renderSkillHeroMeta(listing) {
    if (!SKILL_PAGE) return;

    const host = document.querySelector("[data-listing-hero-meta]");
    if (!host) return;

    const items = buildSkillHeroMetaItems(listing);
    host.innerHTML = items
      .map(
        (item) => `
      <li class="skill-hero-meta__item${item.accent ? " skill-hero-meta__item--accent" : ""}">
        <span class="skill-hero-meta__label">${escapeHtml(item.label)}</span>
        <span class="skill-hero-meta__value">${escapeHtml(item.value)}</span>
      </li>`
      )
      .join("");
    host.hidden = false;
  }

  function renderSkillDetails(listing) {
    const section = document.querySelector(
      "[data-listing-skill-details], [data-listing-skill-service]"
    );
    if (!section || !SKILL_PAGE) return;

    const formData = parseListingFormData(listing);
    const delivery =
      pickFormText(formData, SKILL_DELIVERY_KEYS) || "未設定";
    const scope = pickFormText(formData, SKILL_SCOPE_KEYS) || "要相談";
    const achievements =
      pickFormText(formData, SKILL_ACHIEVEMENTS_KEYS) ||
      "まだ実績情報はありません";
    const serviceFallback =
      "ご覧いただきありがとうございます。高品質な Live2D モデルを制作いたします。キャラクターデザインのご相談からモデリング、表情差分の追加までトータルで対応可能です。";
    const serviceContent =
      resolveListingDescription(listing) || serviceFallback;

    setSkillDetailBlock(
      section,
      "[data-listing-delivery-block]",
      "[data-listing-delivery]",
      delivery
    );
    setSkillDetailBlock(
      section,
      "[data-listing-scope-block]",
      "[data-listing-scope]",
      scope
    );
    setSkillDetailBlock(
      section,
      "[data-listing-achievements-block]",
      "[data-listing-achievements]",
      achievements
    );

    const serviceEl = section.querySelector(
      "[data-listing-service-content], [data-listing-product-description]"
    );
    if (serviceEl) {
      serviceEl.textContent = serviceContent;
    }
    const serviceBlock = section.querySelector("[data-listing-service-content-block]");
    if (serviceBlock) {
      serviceBlock.hidden = false;
    }

    section.hidden = false;
    section.setAttribute("data-detail-keep", "");
  }

  function ensureOptionsDataElement(options) {
    let dataEl = document.getElementById("listing-options-data");
    if (!dataEl) {
      dataEl = document.createElement("script");
      dataEl.id = "listing-options-data";
      dataEl.type = "application/json";
      document.body.appendChild(dataEl);
    }
    dataEl.textContent = JSON.stringify(options);
    return dataEl;
  }

  function renderPaidOptions(listing) {
    if (!SKILL_PAGE && !PRODUCT_PAGE) return;

    const formData = parseListingFormData(listing);
    let options = extractListingOptions(listing);

    if (
      options.length === 0 &&
      SKILL_PAGE &&
      window.TasuListingOptions?.DEFAULT_SKILL_DETAIL_OPTIONS
    ) {
      options = window.TasuListingOptions.DEFAULT_SKILL_DETAIL_OPTIONS.map((item) => ({
        title: item.title,
        desc: item.desc || "",
        price: item.price,
      }));
    }

    const section = document.getElementById("section-options");
    const navLink = document.querySelector('.section-nav__link[href="#section-options"]');

    if (options.length === 0) {
      if (section) {
        section.hidden = true;
        section.classList.add("detail-page-hidden");
      }
      if (navLink) navLink.hidden = true;
      return;
    }

    console.log("product options fields", {
      listing_id: listing?.id,
      form_data_options: formData.options,
      form_data_paid_options: formData.paid_options,
      parsed_count: options.length,
      options,
    });

    ensureOptionsDataElement(options);

    const baseFromDb = listing.price_amount;
    const baseFromForm = Number(
      formData.basePrice ?? formData.price ?? formData.productPrice
    );
    let basePrice = PRODUCT_PAGE ? 0 : 80000;
    if (baseFromDb != null && !Number.isNaN(Number(baseFromDb))) {
      basePrice = Number(baseFromDb);
    } else if (Number.isFinite(baseFromForm) && baseFromForm > 0) {
      basePrice = baseFromForm;
    }

    if (section) {
      section.hidden = false;
      section.classList.remove("detail-page-hidden");
      section.setAttribute("data-detail-keep", "");
    }
    if (navLink) navLink.hidden = false;

    if (window.TasuListingOptions?.initDetail) {
      window.TasuListingOptions.initDetail({
        basePrice,
        totalApprox: !PRODUCT_PAGE,
        hintText: PRODUCT_PAGE
          ? "オプションを選択して合計を確認"
          : "オプションを選択してください",
        forceShow: true,
      });
    }
  }

  function renderSkillOptions(listing) {
    renderPaidOptions(listing);
  }

  function setSectionVisible(section, navLink, visible) {
    if (section) section.hidden = !visible;
    if (navLink) navLink.hidden = !visible;
  }

  function hideStripControls(section) {
    if (!section) return;
    section
      .querySelectorAll(
        ".skill-portfolio-premium__scroll-btn, .detail-strip-scroll-btn"
      )
      .forEach((btn) => {
        btn.hidden = true;
      });
  }

  function renderSkillPortfolio(listing) {
    if (!PREMIUM_DETAIL_PAGE) return;

    const section = document.getElementById(
      JOB_PAGE ? "section-workplace" : "section-portfolio"
    );
    const strip = document.getElementById("portfolioStrip");
    const navLink = document.querySelector(
      JOB_PAGE
        ? '.section-nav__link[href="#section-workplace"]'
        : '.section-nav__link[href="#section-portfolio"]'
    );
    if (!section || !strip) return;

    const imageSet = resolveSkillImageSet(listing);
    let gallery = imageSet.gallery || [];
    const primary = imageSet.primary;

    if (PRODUCT_PAGE) {
      const extras = gallery.filter((url) => url && url !== primary);
      gallery = extras.length ? extras : [];
    }

    if (JOB_PAGE) {
      const workplaceUrls = [];
      const seenUrls = new Set();
      function pushWorkplaceUrl(url) {
        const normalized = safeStr(url, "");
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);
        workplaceUrls.push(normalized);
      }
      pushWorkplaceUrl(primary);
      (gallery || []).forEach(pushWorkplaceUrl);
      gallery = workplaceUrls.slice(0, 9);
    }

    const label = WORKER_PAGE
      ? safeStr(listing.title, "ワーカー")
      : PRODUCT_PAGE
        ? safeStr(listing.title, "商品")
        : JOB_PAGE
          ? safeStr(listing.title, "求人")
          : resolveSkillServiceName(listing) || safeStr(listing.title, "スキル");

    strip.innerHTML = "";

    const countEl = document.querySelector("[data-listing-portfolio-count]");
    const scrollBtn = section.querySelector(
      ".skill-portfolio-premium__scroll-btn"
    );

    if (!gallery.length) {
      if (PRODUCT_PAGE || JOB_PAGE) {
        setSectionVisible(section, navLink, false);
        hideStripControls(section);
        if (scrollBtn) scrollBtn.hidden = true;
        return;
      }

      const placeholder = document.createElement("div");
      placeholder.className = "listing-portfolio-placeholder skill-portfolio-card";
      placeholder.textContent = "ポートフォリオ画像は未登録です";
      strip.appendChild(placeholder);
      if (countEl) countEl.textContent = "未登録";
      section.hidden = false;
      section.setAttribute("data-detail-keep", "");
      if (navLink) navLink.hidden = false;
      if (scrollBtn) scrollBtn.hidden = true;
      return;
    }

    const itemClass = JOB_PAGE ? "job-workplace-gallery__item" : "skill-portfolio-card";
    const altPrefix = JOB_PAGE ? "職場写真" : "ポートフォリオ";

    gallery.forEach((url, index) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = itemClass;
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${label} — ${altPrefix} ${index + 1}`;
      img.loading = "lazy";
      if (!JOB_PAGE) {
        img.width = 248;
        img.height = 148;
      }
      link.appendChild(img);
      strip.appendChild(link);
    });

    if (countEl) {
      countEl.textContent = `${gallery.length}件`;
    }

    section.hidden = false;
    section.setAttribute("data-detail-keep", "");
    if (navLink) navLink.hidden = false;
    if (JOB_PAGE) {
      hideStripControls(section);
      if (scrollBtn) scrollBtn.hidden = true;
    } else if (scrollBtn) {
      scrollBtn.hidden = gallery.length < 2;
    }
  }

  function renderDetailReviews(listing) {
    if (!PREMIUM_DETAIL_PAGE) return;
    if (JOB_PAGE) return;

    const section = document.getElementById("section-reviews");
    if (!section) return;

    const strip = document.getElementById("reviewsStrip");
    const navLink = document.querySelector('.section-nav__link[href="#section-reviews"]');
    const summary = section.querySelector(".detail-reviews__summary");
    const breakdown = section.querySelector(".detail-reviews__breakdown");
    const cardsWrap = section.querySelector(".detail-reviews__cards-wrap");
    const moreLink = section.querySelector(".detail-bottom-card__more");

    if (strip) {
      strip.querySelectorAll("[data-detail-static]").forEach((el) => el.remove());
    }

    const cards = strip
      ? Array.from(
          strip.querySelectorAll(".detail-review-card, [data-review-item]")
        )
      : [];

    const countFromDom = Number.parseInt(
      section.querySelector("[data-listing-review-count]")?.textContent || "0",
      10
    );
    const reviewCount = Number.isFinite(countFromDom) ? countFromDom : cards.length;
    const hasReviews = reviewCount > 0 && cards.length > 0;

    if (!hasReviews) {
      section.classList.add("detail-reviews--empty");
      if (strip) strip.innerHTML = "";
      if (summary) summary.hidden = true;
      if (breakdown) breakdown.hidden = true;
      if (cardsWrap) cardsWrap.hidden = true;
      if (moreLink) moreLink.hidden = true;

      const body = section.querySelector(".detail-reviews__body");
      if (body) {
        body.innerHTML = `
          <div class="detail-reviews__empty-state" data-reviews-empty>
            <p class="detail-reviews__empty-message">レビューはまだありません</p>
          </div>`;
      }

      setSectionVisible(section, navLink, true);
      section.setAttribute("data-detail-keep", "");
      return;
    }

    section.classList.remove("detail-reviews--empty");
    if (summary) summary.hidden = false;
    if (cardsWrap) cardsWrap.hidden = false;
    if (moreLink) moreLink.hidden = false;
    setSectionVisible(section, navLink, true);
    section.setAttribute("data-detail-keep", "");
  }

  async function fetchProductRelatedDemoListings(currentId) {
    const candidateIds = [
      "product_earbuds_2026",
      "product_charger_2026",
      "product_pr_hero_2026",
    ];
    const items = [];

    for (const id of candidateIds) {
      if (id === currentId) continue;

      let row = tryDemoCatalogListing(id);
      if (!row && window.TasuListingStore?.fetchListingById) {
        try {
          row = await window.TasuListingStore.fetchListingById(id);
        } catch (err) {
          console.warn("[listing-detail] product related demo fetch failed:", id, err);
        }
      }
      if (!row) continue;

      const prepared = prepareRelatedListingItem(
        normalizeFetchedListing({
          ...row,
          listing_type: row.listing_type || row.type || "product",
        }) || row,
        "product"
      );
      if (prepared) items.push(prepared);
    }

    return items;
  }

  async function fetchWorkerRelatedDemoListings(currentId) {
    const candidateIds = [
      "worker_web_partner_001",
      "demo-worker-001",
      "demo-worker-002",
    ];
    const items = [];

    for (const id of candidateIds) {
      if (id === currentId) continue;

      let row = tryDemoCatalogListing(id);
      if (!row && window.TasuListingStore?.fetchListingById) {
        try {
          row = await window.TasuListingStore.fetchListingById(id);
        } catch (err) {
          console.warn("[listing-detail] worker related demo fetch failed:", id, err);
        }
      }
      if (!row) continue;

      const prepared = prepareRelatedListingItem(
        normalizeFetchedListing({
          ...row,
          listing_type: row.listing_type || row.type || "worker",
        }) || row,
        "worker"
      );
      if (prepared) items.push(prepared);
    }

    return items;
  }

  function resolveListingCompanyId(listing) {
    return safeStr(listing?.company_id || listing?.companyId || "", "");
  }

  function matchesRelatedJobListing(item, listing, sellerId, companyId, currentId) {
    const id = safeStr(item?.id, "");
    if (!id || id === currentId) return false;
    const itemCompanyId = resolveListingCompanyId(item);
    if (companyId && itemCompanyId && itemCompanyId === companyId) return true;
    const uid = safeStr(item?.user_id || item?.userId, "");
    const sid = safeStr(item?.seller_id || item?.sellerId, "");
    if (!sellerId) return false;
    return uid === sellerId || sid === sellerId;
  }

  function collectJobRelatedCardTags(item, record) {
    const tags = [];
    const seen = new Set();
    const employment = formatJobEmploymentTypeDisplay(
      readJobListingField(record, "employment_type")
    );
    const workStyle = formatJobWorkStyleDisplay(readJobListingField(record, "work_style"));

    function add(raw) {
      const tag = safeStr(raw, "");
      if (!tag || tag.length > 24) return;
      if (tag === employment || tag === workStyle) return;
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      tags.push(tag);
    }

    const formData = parseListingFormData(item);
    const featureLabels = formData.job_feature_labels || formData.jobFeatureLabels;
    if (Array.isArray(featureLabels)) featureLabels.forEach(add);
    safeStr(item?.tags, "")
      .split(/[,、]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach(add);
    getDisplayTags(item).forEach(add);
    return tags.slice(0, 3);
  }

  async function fetchJobRelatedDemoListings(currentId, sellerId, companyId) {
    const store = window.TasuListingDemoCatalog?.STORE_BY_ID;
    const uid = safeStr(sellerId, "");
    if (!store || (!uid && !companyId)) return [];

    const items = [];
    for (const row of Object.values(store)) {
      if (safeStr(row?.listing_type, "") !== "job") continue;
      if (!matchesRelatedJobListing(row, null, uid, companyId, currentId)) continue;

      const prepared = prepareRelatedListingItem(
        normalizeFetchedListing({
          ...row,
          listing_type: row.listing_type || "job",
        }) || row,
        "job"
      );
      if (prepared) items.push(prepared);
    }

    return items;
  }

  function ensureProductRelatedSectionHead(section) {
    if (!section) return;
    const head = section.querySelector(".detail-bottom-card__head");
    const title = section.querySelector("#detailRelatedTitle");
    if (head) {
      head.hidden = false;
      head.removeAttribute("hidden");
    }
    if (title) {
      title.textContent = "他の商品を見る";
    }
  }

  function ensureJobRelatedSectionHead(section, relatedCount) {
    if (!section || !JOB_PAGE) return;
    const head = section.querySelector(".job-related-panel__head");
    const title = section.querySelector("#detailRelatedTitle");
    const countEl = section.querySelector("[data-job-related-count]");
    if (head) {
      head.hidden = false;
      head.removeAttribute("hidden");
    }
    if (title) {
      title.textContent = "この企業の他の求人";
    }
    if (countEl) {
      const count = Number(relatedCount);
      countEl.textContent =
        Number.isFinite(count) && count > 0 ? `${count}件` : "—";
    }
  }

  function ensureWorkerRelatedSectionHead(section, listingType) {
    if (!section) return;
    const isWorkerRelated = WORKER_PAGE || listingType === "worker";
    if (!isWorkerRelated) return;

    const head = section.querySelector(".detail-bottom-card__head");
    const title = section.querySelector("#detailRelatedTitle");
    if (head) {
      head.hidden = false;
      head.removeAttribute("hidden");
    }
    if (title) {
      title.textContent = "関連ワーカー";
    }
  }

  function resolveRelatedCardCategoryLabel(item, listingType) {
    const isWorkerRelated = WORKER_PAGE || listingType === "worker";
    if (!isWorkerRelated) {
      return safeStr(item.categoryLabel || listingType, "");
    }
    const fd = item?.form_data || {};
    return (
      safeStr(fd.workerCategory, "") ||
      safeStr(fd.worker_category, "") ||
      safeStr(item.categoryLabel, "") ||
      "ワーカー"
    );
  }

  async function renderDetailRelatedListings(listing) {
    if (!PREMIUM_DETAIL_PAGE) return;

    const section = document.getElementById("otherServices");
    const strip = document.getElementById("otherServicesStrip");
    if (!section || !strip) return;

    const navLink = document.querySelector('.section-nav__link[href="#otherServices"]');
    const scrollBtns = section.querySelectorAll(".detail-strip-scroll-btn");

    strip.innerHTML = "";
    scrollBtns.forEach((btn) => {
      btn.hidden = true;
    });

    const listingType = String(
      listing?.listing_type || listing?.type || ""
    ).trim();
    const sellerId = resolveSellerUserId(listing);
    const companyId = resolveListingCompanyId(listing);
    const currentId = safeStr(listing?.id, "");
    const isWorkerRelated = WORKER_PAGE || listingType === "worker";

    let related = [];

    if (window.TasuListingStore?.fetchPublishedListings) {
      try {
        const published = await window.TasuListingStore.fetchPublishedListings({
          listing_type: isWorkerRelated ? "worker" : listingType || undefined,
          limit: 40,
          public_only: true,
        });
        related = (published || [])
          .filter((item) => {
            if (isWorkerRelated) {
              const id = safeStr(item?.id, "");
              return id && id !== currentId;
            }
            return matchesRelatedJobListing(item, listing, sellerId, companyId, currentId);
          })
          .map((item) => prepareRelatedListingItem(item, listingType))
          .filter(Boolean);
      } catch (err) {
        console.warn("[listing-detail] related listings fetch failed:", err);
      }
    }

    if (isWorkerRelated && !related.length) {
      related = await fetchWorkerRelatedDemoListings(currentId);
    }

    if (PRODUCT_PAGE && !related.length) {
      related = await fetchProductRelatedDemoListings(currentId);
    }

    if (JOB_PAGE && !related.length && (sellerId || companyId)) {
      related = await fetchJobRelatedDemoListings(currentId, sellerId, companyId);
    }

    if (!related.length) {
      setSectionVisible(section, navLink, false);
      return;
    }

    ensureWorkerRelatedSectionHead(section, listingType);
    if (PRODUCT_PAGE) {
      ensureProductRelatedSectionHead(section);
    }
    const jobRelatedItems = JOB_PAGE ? related.slice(0, 8) : [];

    if (JOB_PAGE) {
      ensureJobRelatedSectionHead(section, jobRelatedItems.length);
    }

    const R = window.TasuListingRouteResolver;

    (JOB_PAGE ? jobRelatedItems : related.slice(0, 8)).forEach((item) => {
      const itemType = String(item.listing_type || item.type || listingType || "").trim();
      const href = R?.buildDetailUrl
        ? R.buildDetailUrl(itemType || listingType, item.id)
        : `#`;
      const productItem =
        itemType === "product" ? getNormalizedProduct(item) : null;
      const title = productItem?.title || safeStr(item.title, "掲載");
      const price =
        productItem?.price?.text || item.priceText || resolvePriceText(item);
      const thumb = productItem?.image || resolveListingCardThumb(item, title);
      const categoryLabel = resolveRelatedCardCategoryLabel(item, listingType);

      const link = document.createElement("a");
      link.href = href;

      if (JOB_PAGE) {
        const record = resolveJobListingRecord(item);
        const salary =
          formatJobSalaryFromRecord(record) ||
          resolvePriceText(item) ||
          "応相談";
        const location = readJobListingField(record, "job_location") || "—";
        const workStyle = formatJobWorkStyleDisplay(readJobListingField(record, "work_style"));
        const employmentType = formatJobEmploymentTypeDisplay(
          readJobListingField(record, "employment_type")
        );
        const featureTags = collectJobRelatedCardTags(item, record);
        const Renderer = window.TasuJobTopRenderer;
        if (Renderer?.buildRelatedJobCardElement) {
          strip.appendChild(
            Renderer.buildRelatedJobCardElement({
              id: item.id,
              title,
              salaryDisplay: salary,
              location,
              workStyle,
              employmentType,
              featureTags,
              thumbnail: thumb,
            })
          );
          return;
        }
        link.className = "job-related-card";
        link.innerHTML = `
          <img class="job-related-card__thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy">
          <div class="job-related-card__body">
            <p class="job-related-card__title">${escapeHtml(title)}</p>
            <p class="job-related-card__salary">${escapeHtml(salary)}</p>
            <p class="job-related-card__location">${escapeHtml(location)}</p>
          </div>`;
      } else {
        link.className = "detail-seller-service-card";
        link.innerHTML = `
          <img class="detail-seller-service-card__thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy">
          <div class="detail-seller-service-card__body">
            <p class="detail-seller-service-card__category">${escapeHtml(categoryLabel)}</p>
            <p class="detail-seller-service-card__title">${escapeHtml(title)}</p>
            <p class="detail-seller-service-card__price">${escapeHtml(price)}</p>
          </div>`;
      }
      strip.appendChild(link);
    });

    setSectionVisible(section, navLink, true);
    section.setAttribute("data-detail-keep", "");
    scrollBtns.forEach((btn) => {
      btn.hidden = JOB_PAGE || related.length < 2;
    });
  }

  function clearBottomSectionDemos() {
    const reviewsStrip = document.getElementById("reviewsStrip");
    if (reviewsStrip) reviewsStrip.innerHTML = "";

    const otherStrip = document.getElementById("otherServicesStrip");
    if (otherStrip) otherStrip.innerHTML = "";

    if (!JOB_PAGE) {
      document.querySelectorAll("[data-listing-review-count]").forEach((el) => {
        el.textContent = "0";
      });
      document.querySelectorAll("[data-listing-review-average]").forEach((el) => {
        el.textContent = "—";
      });
    }

    const hideSelectors = JOB_PAGE
      ? ["#otherServices", "#section-workplace"]
      : ["#section-reviews", "#otherServices", "#section-portfolio"];
    hideSelectors.forEach((sel) => {
      const section = document.querySelector(sel);
      if (section) section.hidden = true;
    });
  }

  function clearDemoTagMarkup() {
    document.querySelectorAll("[data-detail-static]").forEach((el) => {
      el.innerHTML = "";
      el.hidden = true;
    });
    document.querySelectorAll("[data-listing-tags]").forEach((el) => {
      el.innerHTML = "";
      el.hidden = true;
    });
    document.querySelectorAll("[data-listing-feature-badges]").forEach((el) => {
      el.innerHTML = "";
      el.hidden = true;
    });
    document.querySelectorAll("[data-dynamic-payment-badges]").forEach((el) => el.remove());
  }

  function ensureStatusHost() {
    let el = document.getElementById("listing-detail-status");
    if (el) return el;
    el = document.createElement("div");
    el.id = "listing-detail-status";
    el.className = "listing-detail-status listing-detail-status--loading";
    el.setAttribute("role", "status");
    const anchor =
      document.querySelector(".skill-detail-wrap") ||
      document.querySelector(".worker-detail-wrap") ||
      document.querySelector(".product-detail-wrap") ||
      document.querySelector("main") ||
      document.body;
    anchor.prepend(el);
    return el;
  }

  function setStatus(kind, html) {
    const el = ensureStatusHost();
    el.className = `listing-detail-status listing-detail-status--${kind}`;
    el.innerHTML = html;
    el.hidden = false;
  }

  function clearStatus() {
    const el = document.getElementById("listing-detail-status");
    if (el) el.hidden = true;
  }

  function markDetailPage() {
    document.body.dataset.detailPage = "1";
    const main =
      document.querySelector(".skill-detail-main") ||
      document.querySelector(".product-detail-main") ||
      document.querySelector(".job-detail-main") ||
      document.querySelector(".worker-detail-main") ||
      document.querySelector("main.detail-page-main") ||
      document.querySelector("main.post-page") ||
      document.querySelector("main");
    if (main && !main.classList.contains("detail-page-main")) {
      main.classList.add("detail-page-main");
    }
  }

  function hideDemoSections() {
    if (IS_BIZ_DETAIL_PAGE) return;
    document.querySelectorAll("[data-detail-static]").forEach((el) => {
      el.hidden = true;
    });
    const main = document.querySelector(".detail-page-main");
    if (!main) return;
    main.querySelectorAll("section").forEach((section) => {
      if (section.hidden) return;
      if (section.hasAttribute("data-detail-keep")) return;
      if (
        section.classList.contains("skill-hero-section") ||
        section.classList.contains("product-hero-section") ||
        section.classList.contains("job-hero-section") ||
        section.classList.contains("worker-hero-section") ||
        section.classList.contains("worker-hero")
      ) {
        return;
      }
      if (section.closest("[data-detail-keep]")) return;
      section.setAttribute("data-detail-static", "");
      section.hidden = true;
    });
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((el) => {
      if (text != null && text !== "") el.textContent = text;
    });
  }

  function resolveJobTagPillClass(tag) {
    const text = safeStr(tag, "");
    if (/月\d+万|万円〜|万円|¥/i.test(text)) {
      return "job-tag-pill job-tag-pill--accent";
    }
    if (/フルリモート|リモート可|リモートOK/i.test(text)) {
      return "job-tag-pill job-tag-pill--accent";
    }
    if (/急募|緊急|至急/i.test(text)) {
      return "job-tag-pill job-tag-pill--accent";
    }
    return "job-tag-pill";
  }

  function renderTagPills(tags) {
    const safeTags = (tags || []).map((t) => safeStr(t, "")).filter(Boolean);

    document.querySelectorAll("[data-listing-tags]").forEach((host) => {
      if (!safeTags.length) {
        if (
          (PRODUCT_PAGE && host.classList.contains("product-hero-tags")) ||
          (JOB_PAGE &&
            (host.classList.contains("job-hero-tags") ||
              host.closest(".job-top-card__main, .job-hero-premium__center")))
        ) {
          host.innerHTML = "";
          host.hidden = true;
          return;
        }
        host.innerHTML =
          '<span class="listing-tags-empty">タグ未設定</span>';
        host.hidden = false;
        return;
      }

      if (host.classList.contains("worker-hero__tags")) {
        host.innerHTML = safeTags
          .map((t) => `<span class="worker-hero__tag">${escapeHtml(t)}</span>`)
          .join("");
      } else if (
        host.classList.contains("skill-hero-premium__tags") ||
        host.classList.contains("product-hero-tags") ||
        host.classList.contains("job-hero-tags")
      ) {
        host.innerHTML = safeTags
          .map((t) => {
            const pillClass = PRODUCT_PAGE
              ? "product-tag-pill"
              : JOB_PAGE
                ? resolveJobTagPillClass(t)
                : "skill-tag-pill";
            return `<span class="${pillClass}">${escapeHtml(t)}</span>`;
          })
          .join("");
      } else {
        host.innerHTML = safeTags
          .map(
            (t) =>
              `<span class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">${escapeHtml(t)}</span>`
          )
          .join("");
      }
      host.hidden = false;
    });
  }

  function renderTags(listing) {
    if (WORKER_PAGE) {
      renderWorkerHeroTags(listing);
      return;
    }
    let tags = getDisplayTags(listing);
    if (SKILL_PAGE) {
      tags = filterSkillDisplayTags(tags);
    } else if (PRODUCT_PAGE) {
      tags = buildProductHeroTags(listing);
    } else if (JOB_PAGE) {
      tags = buildJobHeroTags(listing);
    }
    renderTagPills(tags);
  }

  function resolvePriceText(listing) {
    const amount = listing?.price_amount;
    if (amount != null && !Number.isNaN(Number(amount))) {
      return `¥${Number(amount).toLocaleString("ja-JP")}`;
    }
    const fromText = safeStr(listing?.priceText, "");
    if (fromText) return fromText;
    return "要相談";
  }

  function renderPrice(listing) {
    if (WORKER_PAGE) return;

    if (PRODUCT_PAGE) {
      renderProductHeroPricePanel(listing);
      return;
    }

    if (JOB_PAGE) {
      renderJobHeroPricePanel(listing);
      return;
    }

    const text = resolvePriceText(listing);

    document.querySelectorAll("[data-listing-price]").forEach((el) => {
      el.textContent = text;
    });

    const priceCandidates = document.querySelectorAll(
      ".skill-hero-section [class*='text-2xl'][class*='font-bold'], .product-hero-section [class*='text-2xl'][class*='font-bold'], #jobHeroPrice, .worker-hero__price"
    );
    priceCandidates.forEach((el, i) => {
      if (i === 0 || el.hasAttribute("data-listing-price")) el.textContent = text;
    });
  }

  function renderPayment(listing) {
    if (WORKER_PAGE || JOB_PAGE) {
      if (JOB_PAGE) hideJobPaymentPanel();
      return;
    }

    let panel = document.querySelector("[data-listing-payment]");
    if (!panel) {
      panel = document.createElement("div");
      panel.dataset.listingPayment = "1";
      panel.className = "listing-payment-panel";
      const hero =
        document.querySelector(".skill-hero-section") ||
        document.querySelector(".product-hero-section") ||
        document.querySelector(".job-hero-section") ||
        document.querySelector(".worker-hero");
      const target =
        hero?.querySelector("[data-listing-price]")?.parentElement ||
        hero?.querySelector("h1")?.parentElement ||
        hero;
      target?.appendChild(panel);
    }

    const parts = [];
    if (listing.payment_url) {
      const safeUrl = escapeHtml(listing.payment_url);
      parts.push(
        `<p><strong>オンライン決済:</strong> <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">決済ページを開く</a></p>`
      );
    }
    if (listing.bank_transfer_info) {
      parts.push(
        `<p><strong>振込:</strong> ${escapeHtml(String(listing.bank_transfer_info).slice(0, 200))}</p>`
      );
    }
    if (listing.onsite_payment) parts.push("<p>現地払いに対応</p>");
    if (listing.invoice_support === "yes") parts.push("<p>請求書対応可</p>");
    else if (listing.invoice_support === "negotiable") parts.push("<p>請求書対応は要相談</p>");

    panel.innerHTML = parts.join("");
    panel.hidden = parts.length === 0;
  }

  function buildSkillImageRow(listing) {
    return getMergedImageRow(listing);
  }

  function logProductImageFields(listing, imageSet) {
    if (!PRODUCT_PAGE) return;
    const formData = parseListingFormData(listing);
    const merged = getMergedImageRow(listing);

    console.log("product form_data full:", listing?.form_data);
    console.log("product form_data keys:", Object.keys(formData || {}));
    console.log("product image candidates:", {
      fd_image_url: formData?.image_url ?? formData?.imageUrl,
      fd_main_image_url: formData?.main_image_url ?? formData?.mainImageUrl,
      fd_thumbnail_url: formData?.thumbnail_url ?? formData?.thumbnailUrl,
      fd_images: formData?.images,
      fd_gallery_urls: formData?.gallery_urls ?? formData?.galleryUrls,
      listing_image_url: listing?.image_url ?? listing?.imageUrl,
      listing_thumbnail_url: listing?.thumbnail_url ?? listing?.thumbnailUrl,
      listing_imageUrl: listing?.imageUrl,
      merged_form_data: merged?.form_data,
    });
    console.log("product image fields", {
      listing_id: listing?.id,
      resolved_primary: imageSet?.primary ?? null,
      resolved_gallery: imageSet?.gallery ?? [],
      all_urls: imageSet?.allUrls ?? [],
      debug: imageSet?.debug ?? {},
    });

    if (!imageSet?.primary && !imageSet?.allUrls?.length) {
      console.warn(
        "[listing-detail] product: form_data に画像URLがありません。投稿時にメイン画像・ギャラリーが保存されているか post.js / listing-images.js の attachListingImagesToPayload を確認してください。"
      );
    }
  }

  /** options / paid_options / add_options — 配列・JSON文字列・オブジェクト配列に対応 */
  function extractListingOptions(listing) {
    const formData = parseListingFormData(listing);
    const Images = window.TasuListingImages;
    const coerce = Images?.coerceToArray?.bind(Images);

    const rawSources = [
      listing?.options,
      formData.options,
      formData.paid_options,
      formData.paidOptions,
      formData.add_options,
      formData.addOptions,
      listing?.paid_options,
    ];

    const merged = [];
    const seen = new Set();

    function pushOption(item) {
      if (!item || typeof item !== "object") return;
      const title = safeStr(
        item.title || item.name || item.label || item.option_name,
        ""
      );
      const price = Number.parseInt(item.price ?? item.amount ?? item.cost, 10);
      if (!title || !Number.isFinite(price) || price < 0) return;
      const key = `${title}:${price}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        title,
        desc: safeStr(item.desc || item.description || item.detail, ""),
        price,
      });
    }

    rawSources.forEach((raw) => {
      const list = coerce ? coerce(raw) : Array.isArray(raw) ? raw : [];
      list.forEach(pushOption);
      if (!coerce && typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          (Array.isArray(parsed) ? parsed : [parsed]).forEach(pushOption);
        } catch {
          /* ignore */
        }
      }
    });

    return merged;
  }

  function resolveSkillImageSet(listing) {
    const Images = window.TasuListingImages;
    if (!Images || !listing) {
      return { primary: null, gallery: [], allUrls: [], debug: {} };
    }

    const mergedRow = getMergedImageRow(listing);
    const fromSet = Images.resolveListingImageSet?.(mergedRow) || {
      primary: null,
      gallery: [],
      allUrls: [],
    };

    const debug = Images.collectImageFieldDebug
      ? Images.collectImageFieldDebug(mergedRow)
      : {};

    return {
      primary: fromSet.primary || null,
      gallery: fromSet.gallery || [],
      allUrls: fromSet.allUrls || fromSet.gallery || [],
      debug,
    };
  }

  function logSkillImageDebug(listing, imageSet) {
    if (PRODUCT_PAGE) {
      logProductImageFields(listing, imageSet);
      return;
    }
    const Images = window.TasuListingImages;
    const formData = parseListingFormData(listing);
    console.log("[listing-detail] form_data image fields:", {
      image_url: formData.image_url ?? formData.imageUrl ?? null,
      thumbnail_url: formData.thumbnail_url ?? formData.thumbnailUrl ?? null,
      images: formData.images ?? null,
      "images[0]": Array.isArray(formData.images) ? formData.images[0] : null,
      listing_image_url: listing?.image_url ?? listing?.imageUrl ?? null,
      listing_thumbnail_url: listing?.thumbnail_url ?? listing?.thumbnailUrl ?? null,
      ...(imageSet?.debug || {}),
    });
    console.log("main image url:", imageSet?.primary || null);
    console.log("gallery urls:", imageSet?.gallery || []);
  }

  function applyHeroMainImage(mainImg, figure, primaryUrl, label, Images) {
    const placeholderNoImage = Images?.placeholderUrl
      ? Images.placeholderUrl(label, "noimage")
      : `https://placehold.co/640x800/efe9dc/8b7a4a?text=No+Image`;

    if (figure) {
      figure.classList.add("listing-hero__figure");
    }
    if (!mainImg) return;

    const mainImageUrl = primaryUrl ? String(primaryUrl).trim() : "";

    mainImg.onload = null;
    mainImg.onerror = null;
    mainImg.removeAttribute("data-image-fallback");

    if (!mainImageUrl) {
      if (figure) figure.classList.add("is-placeholder");
      mainImg.removeAttribute("src");
      mainImg.alt = `${label} — 画像未設定`;
      mainImg.onerror = () => {
        if (mainImg.dataset.imageFallback === "1") return;
        mainImg.dataset.imageFallback = "1";
        mainImg.setAttribute("src", placeholderNoImage);
      };
      mainImg.setAttribute("src", placeholderNoImage);
      console.log("[listing-detail] hero img: no url, using placeholder");
      return;
    }

    if (figure) figure.classList.remove("is-placeholder");
    mainImg.alt = `${label} — 掲載画像`;
    mainImg.classList.remove("is-loading");

    mainImg.onload = () => {
      if (figure) figure.classList.remove("is-placeholder");
      mainImg.removeAttribute("data-image-fallback");
      mainImg.classList.remove("is-loading");
    };

    mainImg.onerror = () => {
      if (mainImg.dataset.imageFallback === "1") return;
      mainImg.dataset.imageFallback = "1";
      console.warn("[listing-detail] hero img load failed:", mainImageUrl);
      if (figure) figure.classList.add("is-placeholder");
      mainImg.setAttribute("src", placeholderNoImage);
      mainImg.alt = `${label} — 画像を読み込めませんでした`;
    };

    console.log("[listing-detail] hero img src set:", mainImageUrl);
    mainImg.setAttribute("src", mainImageUrl);
  }

  function renderSkillGallery(listing) {
    if (!PREMIUM_DETAIL_PAGE) return;

    const Images = window.TasuListingImages;
    const imageSet = resolveSkillImageSet(listing);
    const { primary, gallery } = imageSet;
    logSkillImageDebug(listing, imageSet);

    const label = WORKER_PAGE
      ? listing.title || listing.description || "W"
      : PRODUCT_PAGE
        ? listing.title || listing.description || "P"
        : JOB_PAGE
          ? listing.title || listing.description || "J"
          : resolveSkillServiceName(listing) ||
            listing.title ||
            listing.description ||
            "S";

    const mainImg =
      document.getElementById("mainImage") ||
      document.querySelector("[data-listing-image]");
    const galleryEl = document.querySelector("[data-listing-gallery]");
    const figure = mainImg?.closest("figure");

    applyHeroMainImage(mainImg, figure, primary, label, Images);

    if (!galleryEl) return;

    galleryEl.innerHTML = "";

    if (!gallery.length) {
      galleryEl.hidden = true;
      if (PRODUCT_PAGE && !primary) {
        if (figure) figure.classList.add("is-placeholder");
      }
      return;
    }

    const activeUrl = primary || gallery[0];

    gallery.forEach((url, index) => {
      const isActive = url === activeUrl || (index === 0 && !primary);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `thumb-btn shrink-0 overflow-hidden rounded-md border-2 skill-hero-premium__thumb ${
        isActive
          ? "border-gold ring-1 ring-gold/40"
          : "border-transparent opacity-70 hover:opacity-100"
      }`;
      btn.dataset.src = url;
      btn.dataset.alt = `${label} — 画像 ${index + 1}`;
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      const thumbImg = document.createElement("img");
      thumbImg.src = url;
      thumbImg.alt = "";
      thumbImg.className = "h-11 w-11 object-cover";
      thumbImg.width = 72;
      thumbImg.height = 72;
      thumbImg.loading = "lazy";
      thumbImg.addEventListener("error", () => {
        thumbImg.src = Images?.placeholderUrl
          ? Images.placeholderUrl(label, "card")
          : `https://placehold.co/72x72/f3ead4/967622?text=${encodeURIComponent(String(label).charAt(0))}`;
      });
      btn.appendChild(thumbImg);
      btn.addEventListener("click", () => {
        if (mainImg) {
          mainImg.removeAttribute("data-image-fallback");
          applyHeroMainImage(mainImg, figure, url, btn.dataset.alt || label, Images);
        }
        galleryEl.querySelectorAll(".thumb-btn").forEach((b, i) => {
          const active = i === index;
          b.classList.toggle("border-gold", active);
          b.classList.toggle("ring-1", active);
          b.classList.toggle("ring-gold/40", active);
          b.classList.toggle("border-transparent", !active);
          b.classList.toggle("opacity-70", !active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });
      });
      galleryEl.appendChild(btn);
    });

    galleryEl.hidden = gallery.length < 2;
  }

  function renderImage(listing) {
    if (PREMIUM_DETAIL_PAGE) {
      renderSkillGallery(listing);
      return;
    }

    const img =
      document.getElementById("mainImage") ||
      document.querySelector("[data-listing-image]");
    if (!img || !listing.imageUrl) return;
    img.src = listing.imageUrl;
    img.alt = listing.title || "掲載画像";
  }

  function resolveSkillServiceName(listing) {
    const formData = parseListingFormData(listing);
    const fromForm = pickFormText(formData, SKILL_SERVICE_NAME_KEYS);
    if (fromForm) return fromForm;
    const listingTitle = String(listing?.title || "").trim();
    return listingTitle;
  }

  function bindSkillFavoriteTarget(listing) {
    const id = safeStr(listing?.id, "");
    document.querySelectorAll("[data-favorite-button][data-target-type='skill']").forEach((btn) => {
      if (id) btn.dataset.targetId = id;
    });
  }

  function bindWorkerFavoriteTarget(listing) {
    const id = safeStr(listing?.id, "");
    document
      .querySelectorAll("[data-favorite-button][data-target-type='worker']")
      .forEach((btn) => {
        if (id) btn.dataset.targetId = id;
      });
  }

  function bindProductFavoriteTarget(listing) {
    const id = safeStr(listing?.id, "");
    document
      .querySelectorAll("[data-favorite-button][data-target-type='product']")
      .forEach((btn) => {
        if (id) btn.dataset.targetId = id;
      });
  }

  function bindJobFavoriteTarget(listing) {
    const id = safeStr(listing?.id, "");
    document
      .querySelectorAll("[data-favorite-button][data-target-type='job']")
      .forEach((btn) => {
        if (id) btn.dataset.targetId = id;
      });
  }

  function renderWorkerHero(listing) {
    if (!WORKER_PAGE) return;

    const title = safeStr(listing.title, "ワーカー掲載");
    const summary = resolveWorkerHeroSummaryText(listing);
    const subtitle = resolveWorkerSubtitle(listing);
    const categoryLabel = resolveWorkerCategoryLabel(listing);

    document.querySelectorAll("[data-listing-service-name]").forEach((el) => {
      el.textContent = title;
      el.hidden = false;
    });
    setText("[data-listing-title]", title);
    setText("#workerHeroTitle", title);

    document.querySelectorAll("[data-listing-subtitle]").forEach((el) => {
      el.textContent = subtitle;
    });

    document.querySelectorAll("[data-listing-category-badge]").forEach((el) => {
      el.textContent = categoryLabel;
    });

    document
      .querySelectorAll(".skill-hero-section [data-listing-description]")
      .forEach((el) => {
        if (summary) {
          el.textContent = summary;
          el.hidden = false;
        } else {
          el.textContent = "";
          el.hidden = true;
        }
      });

    renderWorkerHeroMeta(listing);

    bindWorkerFavoriteTarget(listing);

    document.title = `${title} | TasuFull ワーカー`;
  }

  function renderSkillHero(listing) {
    if (!SKILL_PAGE) return;

    const serviceName = safeStr(
      resolveSkillServiceName(listing),
      safeStr(listing.title, "スキル掲載")
    );
    const desc = safeStr(
      listing.description,
      "説明はまだ登録されていません。"
    );
    const subtitle = resolveSkillSubtitle(listing);
    const categoryLabel = resolveSkillCategoryLabel(listing);

    document.querySelectorAll("[data-listing-service-name]").forEach((el) => {
      el.textContent = serviceName;
      el.hidden = false;
    });

    document.querySelectorAll("[data-listing-subtitle]").forEach((el) => {
      el.textContent = subtitle;
    });

    document.querySelectorAll("[data-listing-category-badge]").forEach((el) => {
      el.textContent = categoryLabel;
    });

    document.querySelectorAll(".skill-hero-section [data-listing-description]").forEach((el) => {
      el.textContent = desc;
      el.hidden = false;
    });

    renderSkillHeroMeta(listing);
    bindSkillFavoriteTarget(listing);

    document.title = `${serviceName} | TasuFull`;
  }

  async function applyListingToPage(listing) {
    if (!listing) return;

    if (WORKER_PAGE) {
      activeWorkerListing = listing;
    }

    if (SHOP_STORE_DETAIL_PAGE) {
      const listingType = String(listing.listing_type || listing.type || "").trim();
      if (listingType && listingType !== "shop_store") {
        console.warn("[invalid shop listing]", listing);
        return;
      }
    }

    const title = listing.title || "掲載詳細";

    const shopRoot = SHOP_STORE_DETAIL_PAGE
      ? document.querySelector("[data-biz-detail-root]")
      : null;
    const shopTitleEl = SHOP_STORE_DETAIL_PAGE
      ? document.querySelector("[data-biz-detail-title]")
      : null;
    const shopImageEl = SHOP_STORE_DETAIL_PAGE
      ? document.querySelector("[data-biz-detail-hero-img]")
      : null;
    console.log("[shop render root]", shopRoot);
    console.log("[shop title el]", shopTitleEl);
    console.log("[shop image el]", shopImageEl);

    if (SKILL_PAGE) {
      renderSkillHero(listing);
    } else if (WORKER_PAGE) {
      renderWorkerHero(listing);
    } else if (PRODUCT_PAGE) {
      renderProductHero(listing);
    } else if (JOB_PAGE) {
      renderJobHero(listing);
    } else {
      document.title = `${title} | TasuFull`;
      setText("[data-listing-title]", title);
      setText("h1", title);
      setText("#jobHeroTitle", title);
      setText("#workerHeroTitle", title);

      const desc = listing.description || "";
      setText("[data-listing-description]", desc);
      document.querySelectorAll(".skill-hero-section p.text-gray-500, .product-hero-section p.text-gray-500").forEach((el, i) => {
        if (i === 0) el.textContent = desc;
      });
    }

    renderTags(listing);
    renderPrice(listing);
    renderPayment(listing);
    renderImage(listing);
    if (SKILL_PAGE) {
      renderSkillDetails(listing);
    }
    if (SKILL_PAGE || PRODUCT_PAGE) {
      renderPaidOptions(listing);
    }
    if (PRODUCT_PAGE) {
      logProductImageFields(listing, resolveSkillImageSet(listing));
    }
    if (WORKER_PAGE) {
      ensureWorkerColumnsOnListing(listing);
      logFullWorkerListing(listing);
      logWorkerDetailFields(listing);
      renderWorkerDetails(listing);
    }
    if (PRODUCT_PAGE) {
      renderProductDetails(listing);
    }
    if (JOB_PAGE) {
      renderJobDetails(listing);
    }
    renderSkillPortfolio(listing);
    renderDetailReviews(listing);

    if (window.TasuListingLocalStore?.renderAiBadge) {
      window.TasuListingLocalStore.renderAiBadge(listing);
    }

    // 店舗・販売（detail-shop.html）は IS_BIZ_DETAIL_PAGE に含まれないため明示的に描画する
    if (IS_BIZ_DETAIL_PAGE || SHOP_STORE_DETAIL_PAGE) {
      if (window.TasuBusinessDetail?.render) {
        await window.TasuBusinessDetail.render(listing);
        if (SHOP_STORE_DETAIL_PAGE && window.TasuBusinessDetail?.renderShopSections) {
          await window.TasuBusinessDetail.renderShopSections(listing);
        }
      } else {
        console.error(
          "[listing-detail-loader] TasuBusinessDetail.render is not available"
        );
        setText("[data-business-company]", listing.company_name || "");
        setText("[data-business-area]", listing.service_area || "");
        setText("[data-business-phone]", listing.phone || "");
        setText("[data-business-status]", listing.statusLabel || "");
        const bizRoot = document.querySelector("[data-biz-detail-root]");
        if (bizRoot) bizRoot.hidden = false;
      }
    }

    // Shop: hidden の解除と最低限のフォールバック描画
    if (SHOP_STORE_DETAIL_PAGE) {
      console.log("[shop sections render start]", listing);
      const menuItems = Array.isArray(listing.products) ? listing.products : [];
      const shopInfo = listing?.category_extra?.shop_store || listing?.form_data?.category_extra?.shop_store || {};
      console.log("[shop menu]", menuItems);
      console.log("[shop info]", shopInfo);

      const root = document.querySelector("[data-biz-detail-root]");
      if (root) {
        root.hidden = false;
        root.removeAttribute("hidden");
        root.classList.remove("is-hidden");
      }
      document.body.classList.add("is-loaded");

      const titleEl = document.querySelector("[data-biz-detail-title]");
      const companyEl = document.querySelector("[data-biz-detail-company]");
      const imgEl = document.querySelector("[data-biz-detail-hero-img]");
      const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
      const ctaHost = document.querySelector("[data-biz-detail-sidebar-actions]");
      if (titleEl && !String(titleEl.textContent || "").trim()) {
        titleEl.textContent = listing.title || "店舗詳細";
      }
      if (companyEl && !String(companyEl.textContent || "").trim()) {
        companyEl.textContent = listing.company_name || listing.title || "";
      }
      if (imgEl && !String(imgEl.getAttribute("src") || "").trim()) {
        const src =
          listing.main_image_url ||
          listing.image_url ||
          listing.thumbnail_url ||
          listing.form_data?.image_url ||
          "";
        if (src) imgEl.setAttribute("src", src);
      }
      if (leadEl) {
        const text = String(listing.description || "").trim();
        if (text) {
          leadEl.textContent = text;
          leadEl.hidden = false;
          leadEl.removeAttribute("hidden");
        }
      }
      if (ctaHost && !ctaHost.querySelector("a,button")) {
        ctaHost.innerHTML = [
          `<a href="#section-products" class="biz-detail-btn biz-detail-btn--primary">見積もりを依頼する</a>`,
          `<a href="#section-strengths" class="biz-detail-btn biz-detail-btn--outline">チャットで問い合わせ</a>`,
        ].join("");
      }
      // sections: 強制表示（CSS/hidden の干渉を排除）
      const sections = [
        "#section-products",
        "#section-shop-bottom",
        "#section-faq",
        "#section-reviews",
      ];
      sections.forEach((selector) => {
        const el = document.querySelector(selector);
        console.log("[shop section exists]", selector, !!el);
        console.log("[shop section html]", selector, el?.innerHTML?.length || 0);
        if (!el) return;

        try {
          const cs = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          console.log("[shop section style]", selector, {
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            position: cs.position,
            overflow: cs.overflow,
            height: cs.height,
            maxHeight: cs.maxHeight,
            rectTop: Math.round(rect.top),
            rectHeight: Math.round(rect.height),
          });
        } catch (e) {
          console.warn("[shop section style] failed:", selector, e);
        }

        el.hidden = false;
        el.removeAttribute("hidden");
        el.style.display = "";
        el.style.visibility = "visible";
        el.style.opacity = "1";
        el.style.height = "";
        el.style.maxHeight = "";
        el.style.overflow = "";
        el.classList.remove("is-hidden");
      });

      console.log("[shop layout]", {
        bodyHeight: document.body.scrollHeight,
        rootHeight: document.documentElement.scrollHeight,
        mainHeight: document.querySelector("main")?.scrollHeight,
      });
      console.log("[shop footer exists]", !!document.querySelector("footer"));

      console.log("[shop sections render completed]");
    }

    document.body.dataset.listingSource = listing.source || "";
    document.body.dataset.listingId = listing.id || "";
    document.body.dataset.targetId = listing.id || "";
    const sellerUserId = resolveSellerUserId(listing);
    if (sellerUserId) {
      document.body.dataset.authorUserId = sellerUserId;
      document.body.dataset.sellerUserId = sellerUserId;
    }
    document.body.dataset.listingLoaded = "true";

    hideDemoSections();
    clearStatus();

    console.log("[listing-detail] applied listing:", {
      id: listing.id,
      title: listing.title,
      listing_type: listing.listing_type || listing.type,
      has_form_data: Boolean(listing.form_data),
    });

    try {
      window.dispatchEvent(new CustomEvent("tasu:listing-applied", { detail: { listing } }));
    } catch {
      // ignore
    }

    /* 上位掲載 UI は load() 内の initDetailFeatured で描画 */
  }

  function showNotFound(id) {
    const backHref = SHOP_STORE_DETAIL_PAGE
      ? "shop-store.html"
      : "business.html";
    const backLabel = SHOP_STORE_DETAIL_PAGE
      ? "店舗・販売一覧へ戻る"
      : "法人・業者一覧へ戻る";
    setStatus(
      "error",
      `掲載が見つかりません（ID: <code>${escapeHtml(id)}</code>）。URL をご確認ください。<a href="${backHref}">${backLabel}</a> または <a href="post.html">新規掲載</a> をご利用ください。`
    );
    document.body.dataset.listingLoaded = "false";
    const bizRoot = document.querySelector("[data-biz-detail-root]");
    if (bizRoot) bizRoot.hidden = true;
    const statusEl = document.querySelector("[data-listing-detail-status]");
    if (statusEl) statusEl.hidden = false;
  }

  function showMissingId() {
    setStatus(
      "error",
      'URL に掲載 ID がありません。一覧のカードから開くか、<code>detail-*.html?id=...</code> の形式でアクセスしてください。<a href="index.html">一覧へ戻る</a>'
    );
    document.body.dataset.listingLoaded = "false";
  }

  function jobDetailLog(step, detail) {
    if (!JOB_PAGE) return;
    if (detail !== undefined) {
      console.log(`[detail-job] ${step}`, detail);
    } else {
      console.log(`[detail-job] ${step}`);
    }
  }

  function dispatchListingLoaded(listing) {
    try {
      window.dispatchEvent(
        new CustomEvent("tasu:listing-loaded", { detail: { listing } })
      );
    } catch {
      /* ignore */
    }
  }

  async function load() {
    if (
      document.body?.dataset?.page === "public-board-detail" &&
      document.body?.dataset?.boardDetailType === "project"
    ) {
      return;
    }
    markDetailPage();
    document.body.dataset.listingLoaded = "false";
    clearDemoTagMarkup();
    clearBottomSectionDemos();

    const id = getQueryId();
    jobDetailLog("load:start", { id });
    if (!id) {
      showMissingId();
      return;
    }

    setStatus("loading", "掲載データを読み込んでいます…");

    let listing = null;
    let fetchError = null;

    try {
    if (SHOP_STORE_DETAIL_PAGE && window.TasuDetailShopStoreLoader?.fetchShopStoreDetailById) {
      try {
        listing = await window.TasuDetailShopStoreLoader.fetchShopStoreDetailById(id);
        console.log("[detail-shop-store] id:", id);
        console.log("[detail-shop-store] listing:", listing);
        console.log("[shop detail lookup]", {
          id,
          listingType: listing?.listing_type || listing?.type,
          category: listing?.business_category || listing?.category,
        });
      } catch (err) {
        fetchError = err;
        console.warn("[detail-shop-store] fetch failed:", err);
      }
    } else if (
      BUSINESS_SERVICE_DETAIL_PAGE &&
      window.TasuDetailBusinessServiceLoader?.fetchFieldServiceDetailById
    ) {
      try {
        listing = await window.TasuDetailBusinessServiceLoader.fetchFieldServiceDetailById(id);
        console.log("[detail-business-service] id:", id);
        console.log("[detail-business-service] listing:", listing);
      } catch (err) {
        fetchError = err;
        console.error("[detail-business-service] fetch failed:", err);
      }
    } else if (BUSINESS_PAGE && window.TasuBusinessListings?.fetchBusinessListingById) {
      try {
        // 取得順: business_listings.id → form_data.demo_id → localStorage → ボードデモ
        listing = await window.TasuBusinessListings.fetchBusinessListingById(id);
        console.log("detail id:", id);
        console.log("fetched listing:", listing);
        console.log("fetch error:", listing ? null : "not found");
      } catch (err) {
        fetchError = err;
        console.log("fetch error:", err);
      }
      if (!listing && /^demo-/i.test(id) && window.TasuBusinessBoardDemo?.getListings) {
        const demos = window.TasuBusinessBoardDemo.getListings();
        listing =
          demos.find((item) => String(item.id) === id) ||
          demos.find((item) => String(item.form_data?.demo_id || "") === id) ||
          null;
      }
    } else if (SKILL_PAGE || WORKER_PAGE || PRODUCT_PAGE || JOB_PAGE) {
      jobDetailLog("fetch:begin");
      const result = await fetchSkillListingFromDb(id);
      listing = result.listing;
      fetchError = result.error;
      jobDetailLog("fetch:done", {
        found: Boolean(listing),
        title: listing?.title || null,
        source: listing?.source || listing?._source || null,
        error: fetchError ? String(fetchError.message || fetchError) : null,
      });
    } else if (window.TasuListingStore?.fetchListingById) {
      try {
        listing = await window.TasuListingStore.fetchListingById(id);
        console.log("detail id:", id);
        console.log("fetched listing:", listing);
        console.log("fetch error:", listing ? null : "not found");
      } catch (err) {
        fetchError = err;
        console.log("fetch error:", err);
      }
    }

    if (!listing) {
      for (const demoKey of collectDetailLookupIds(id)) {
        if (SHOP_STORE_DETAIL_PAGE && window.TasuDetailShopStoreLoader?.fetchShopStoreDetailById) {
          try {
            listing = await window.TasuDetailShopStoreLoader.fetchShopStoreDetailById(demoKey);
          } catch (err) {
            console.warn("[detail-shop-store] demo fallback failed:", err);
          }
        } else if (
          BUSINESS_SERVICE_DETAIL_PAGE &&
          window.TasuDetailBusinessServiceLoader?.fetchFieldServiceDetailById
        ) {
          try {
            listing = await window.TasuDetailBusinessServiceLoader.fetchFieldServiceDetailById(demoKey);
          } catch (err) {
            console.warn("[detail-business-service] demo fallback failed:", err);
          }
        } else {
          listing = tryDemoCatalogListing(demoKey);
        }
        if (listing) break;
      }
    }

    if (!listing) {
      showNotFound(id);
      if (fetchError) {
        console.warn("[listing-detail-loader] load failed:", fetchError);
      }
      return;
    }

    let featuredCheckoutMessage = "";
    let featuredCheckoutError = false;

    const isGeneralDetail =
      !IS_BIZ_DETAIL_PAGE && (SKILL_PAGE || WORKER_PAGE || PRODUCT_PAGE || JOB_PAGE);

    if (
      isGeneralDetail &&
      window.TasuListingFeatured?.hasCheckoutReturnParams?.()
    ) {
      const checkoutResult = await window.TasuListingFeatured.handleCheckoutReturn();
      if (checkoutResult?.ok) {
        featuredCheckoutMessage =
          checkoutResult.message ||
          window.TasuListingFeatured.SUCCESS_MESSAGE ||
          "上位掲載が有効になりました";
        const refetchId = checkoutResult.listing_id || id;
        if (refetchId && window.TasuListingStore?.fetchListingById) {
          const refreshed = await window.TasuListingStore.fetchListingById(refetchId);
          if (refreshed) listing = refreshed;
        }
      } else if (checkoutResult?.cancelled) {
        featuredCheckoutMessage = "決済がキャンセルされました。";
      } else if (checkoutResult?.error) {
        featuredCheckoutMessage = checkoutResult.error;
        featuredCheckoutError = true;
      }
    }

      jobDetailLog("apply:begin", { id: listing.id, title: listing.title });
      await applyListingToPage(listing);
      jobDetailLog("apply:done", {
        listingLoaded: document.body.dataset.listingLoaded,
      });

      if (
        isGeneralDetail &&
        !JOB_PAGE &&
        window.TasuListingFeatured?.initDetailFeatured
      ) {
        await window.TasuListingFeatured.initDetailFeatured(listing, {
          skipCheckoutReturn: true,
          checkoutMessage: featuredCheckoutMessage || undefined,
          checkoutError: featuredCheckoutError,
        });
      }
      if (WORKER_PAGE) {
        let workerProfile = null;
        if (
          document.querySelector("[data-listing-seller]") &&
          window.TasuListingSellerProfile?.render
        ) {
          const sellerUserId = resolveSellerUserId(listing);
          workerProfile = await window.TasuListingSellerProfile.render({
            userId: sellerUserId,
            listing,
          });
          syncWorkerSellerSectionFromProfile(workerProfile);
          bindWorkerSellerSectionActions(listing);
        }
        await loadWorkerMemberProfile(listing, workerProfile);
      } else if (PREMIUM_DETAIL_PAGE && window.TasuListingSellerProfile?.render) {
        jobDetailLog("seller:begin");
        const sellerUserId = resolveSellerUserId(listing);
        const profile = await window.TasuListingSellerProfile.render({
          userId: sellerUserId,
          listing,
        });
        jobDetailLog("seller:done", {
          userId: profile?.userId || sellerUserId,
          name: profile?.displayName || null,
        });
        if (PRODUCT_PAGE || JOB_PAGE || SKILL_PAGE) {
          await renderProductHeroSellerCard(listing, profile);
        }
        if (PRODUCT_PAGE) {
          bindProductSellerSectionActions(listing);
        }
        if (JOB_PAGE) {
          bindJobSellerSectionActions(listing);
        }
      }
      await renderDetailRelatedListings(listing);
      if (PRODUCT_PAGE && window.TasuProductDetailMobile?.refresh) {
        window.TasuProductDetailMobile.refresh();
      }
      dispatchListingLoaded(listing);
      jobDetailLog("load:complete");
    } catch (err) {
      console.error("[listing-detail-loader] load failed:", err);
      jobDetailLog("load:error", err);
      const message =
        err && err.message
          ? `表示中にエラーが発生しました: ${escapeHtml(String(err.message))}`
          : "表示中にエラーが発生しました。ページを再読み込みしてください。";
      setStatus("error", message);
      document.body.dataset.listingLoaded = "error";
      const bizRoot = document.querySelector("[data-biz-detail-root]");
      if (bizRoot && (IS_BIZ_DETAIL_PAGE || SHOP_STORE_DETAIL_PAGE)) {
        bizRoot.hidden = false;
      }
    }
  }

  if (PRODUCT_PAGE || JOB_PAGE || SKILL_PAGE) {
    window.addEventListener("tasu:listing-seller-ready", (event) => {
      const profile = event.detail?.profile;
      const listing = {
        user_id: profile?.userId || resolveSellerUserId({}),
        id: document.body.dataset.listingId || "",
      };
      void renderProductHeroSellerCard(listing, profile);
    });
  }

  if (JOB_PAGE) {
    let jobAccordionResizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(jobAccordionResizeTimer);
      jobAccordionResizeTimer = window.setTimeout(syncJobDetailAccordionPresentation, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void load());
  } else {
    void load();
  }
})();
