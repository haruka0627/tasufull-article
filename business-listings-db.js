/**
 * 法人・業者掲載ストア（public.business_listings）— Supabase 優先 / localStorage フォールバック
 *
 * 案件条件列は business_listings テーブルへ保存します。
 * （public.listings 用 SQL は一般掲載テーブル向け。法人は business_listings_business_job_conditions_columns.sql を実行）
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasu_business_listings_v1";
  function getValidCategories() {
    const ids = window.TasuBusinessCategories?.allValidStorageIds?.();
    return new Set(
      ids || [
        "transport",
        "construction_work",
        "repair_maintenance",
        "cleaning",
        "shop_store",
        "field_service",
        "store_field_service",
        "local_support",
        "taxi",
        "repair",
        "construction",
        "local_service",
        "store",
      ]
    );
  }

  function normalizeBusinessCategory(raw) {
    if (window.TasuBusinessCategories?.normalizeCategory) {
      return window.TasuBusinessCategories.normalizeCategory(raw);
    }
    return String(raw || "").trim();
  }

  function categoryLabel(raw) {
    if (window.TasuBusinessCategories?.getCategoryLabel) {
      return window.TasuBusinessCategories.getCategoryLabel(raw) || "";
    }
    const key = String(raw || "").trim();
    return CATEGORY_LABELS[key] || "";
  }

  const VALID_CATEGORIES = getValidCategories();
  const VALID_STATUS = new Set(["available", "busy", "closed"]);
  const VALID_PLANS = new Set(["none", "considering", "apply"]);
  const VALID_INVOICE = new Set(["yes", "no", "negotiable"]);
  const VALID_PUBLISH = new Set(["draft", "public", "scheduled"]);
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const CATEGORY_LABELS = {
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

  function isConfigured() {
    return window.TasuSupabase?.isConfigured?.() || false;
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function isUuid(id) {
    return UUID_RE.test(String(id || "").trim());
  }

  function textOrNull(value) {
    const s = String(value ?? "").trim();
    return s || null;
  }

  function normalizeApplicationConditions(raw) {
    if (window.TasuListingRenderer?.normalizeApplicationConditions) {
      return window.TasuListingRenderer.normalizeApplicationConditions(raw);
    }
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

  function normalizeCategoryExtra(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }
    const out = { ...raw };
    if (out.construction && typeof out.construction === "object") {
      out.construction = { ...out.construction };
    }
    if (out.taxi && typeof out.taxi === "object") {
      out.taxi = { ...out.taxi };
    }
    return out;
  }

  const TAXI_EXTRA_TO_COLUMN = {
    taxi_services: "taxi_service_type",
    vehicle_types: "taxi_vehicle_type",
    taxi_area_type: "taxi_area_type",
    airport_transfer: "taxi_airport_transfer",
    support_24h: "taxi_24h_available",
    reservation_support: "taxi_reservation_available",
    corporate_contract: "taxi_corporate_contract",
    invoice_support_extra: "taxi_invoice_available",
    taxi_base_fare: "taxi_base_fare",
    taxi_night_fare: "taxi_night_fare",
    taxi_route_price: "taxi_route_price",
    taxi_capacity: "taxi_capacity",
    taxi_language_support: "taxi_language_support",
    child_seat: "taxi_child_seat",
    booking_types: "taxi_booking_types",
  };

  const TAXI_COLUMN_KEYS = [
    ...new Set(Object.values(TAXI_EXTRA_TO_COLUMN)),
    "taxi_payment_methods",
    "taxi_booking_types",
  ];

  function normalizeTaxiPaymentMethods(raw) {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[")) {
        try {
          return normalizeTaxiPaymentMethods(JSON.parse(trimmed));
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

  /** タクシー項目 → トップレベル列 + form_data + category_extra.taxi */
  function mapTaxiFields(input, formDataBase, categoryExtraIn) {
    const fd = formDataBase && typeof formDataBase === "object" ? { ...formDataBase } : {};
    const category = normalizeBusinessCategory(input?.business_category);
    const category_extra = normalizeCategoryExtra(categoryExtraIn || input?.category_extra || fd.category_extra);
    const extraTaxi =
      category_extra.taxi && typeof category_extra.taxi === "object"
        ? { ...category_extra.taxi }
        : {};

    const taxiExtra = { ...extraTaxi };
    const columns = {};
    let hasTaxi =
      window.TasuBusinessCategories?.isTransportProfile?.(category) ?? category === "taxi";

    Object.entries(TAXI_EXTRA_TO_COLUMN).forEach(([extraKey, col]) => {
      const raw =
        input?.[col] ??
        fd[col] ??
        extraTaxi[extraKey] ??
        extraTaxi[col] ??
        null;
      const value = textOrNull(raw);
      if (value) {
        hasTaxi = true;
        columns[col] = value;
        fd[col] = value;
        taxiExtra[extraKey] = value;
      }
    });

    const payments = normalizeTaxiPaymentMethods(
      input?.taxi_payment_methods ?? fd.taxi_payment_methods ?? extraTaxi.taxi_payment_methods
    );
    if (payments.length) {
      hasTaxi = true;
      columns.taxi_payment_methods = payments;
      fd.taxi_payment_methods = payments;
      taxiExtra.taxi_payment_methods = payments;
    }

    const bookings = normalizeTaxiPaymentMethods(
      input?.taxi_booking_types ?? fd.taxi_booking_types ?? extraTaxi.booking_types
    );
    if (bookings.length) {
      hasTaxi = true;
      columns.taxi_booking_types = bookings;
      fd.taxi_booking_types = bookings;
      taxiExtra.booking_types = bookings;
    }

    if (!hasTaxi) {
      return { form_data: fd, category_extra };
    }

    const mergedExtra = { ...category_extra, taxi: taxiExtra };
    fd.category_extra = mergedExtra;

    return {
      ...columns,
      category_extra: mergedExtra,
      form_data: fd,
    };
  }

  function normalizeUrlJsonArray(raw) {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (item == null) return "";
          if (typeof item === "object") {
            return String(item.url || item.src || item.image_url || "").trim();
          }
          return String(item).trim();
        })
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          return normalizeUrlJsonArray(JSON.parse(trimmed));
        } catch {
          return [trimmed];
        }
      }
      return [trimmed];
    }
    return [];
  }

  /** 投稿画像フィールド — トップレベルと form_data の両方から集約 */
  function mapBusinessImageFields(input, formDataBase) {
    const fd = formDataBase && typeof formDataBase === "object" ? formDataBase : {};
    const image_url = textOrNull(
      input.image_url ?? fd.image_url ?? fd.main_image_url ?? fd.main_image
    );
    const thumbnail_url = textOrNull(input.thumbnail_url ?? fd.thumbnail_url ?? image_url);
    const main_image_url = textOrNull(
      input.main_image_url ?? fd.main_image_url ?? image_url
    );
    let gallery_urls = normalizeUrlJsonArray(input.gallery_urls ?? fd.gallery_urls);
    let images = normalizeUrlJsonArray(input.images ?? fd.images);
    const syncedGallery = gallery_urls.length ? gallery_urls : images;
    if (!gallery_urls.length && images.length) gallery_urls = images.slice();
    if (!images.length && gallery_urls.length) images = gallery_urls.slice();

    const form_data = { ...fd };
    if (image_url) {
      form_data.image_url = image_url;
      form_data.thumbnail_url = thumbnail_url || image_url;
      form_data.main_image_url = main_image_url || image_url;
    }
    if (syncedGallery.length) {
      form_data.gallery_urls = syncedGallery;
      form_data.images = syncedGallery;
    }

    return {
      image_url,
      thumbnail_url,
      main_image_url,
      images,
      gallery_urls,
      form_data,
    };
  }

  function logBusinessImagePayload(phase, payload) {
    const fd = payload?.form_data && typeof payload.form_data === "object" ? payload.form_data : {};
    console.log(`[TasuBusinessListings] ${phase}`, {
      image_url: payload?.image_url ?? fd.image_url ?? null,
      thumbnail_url: payload?.thumbnail_url ?? fd.thumbnail_url ?? null,
      images: payload?.images ?? fd.images ?? [],
      gallery_urls: payload?.gallery_urls ?? fd.gallery_urls ?? [],
      main_image_url: payload?.main_image_url ?? fd.main_image_url ?? null,
    });
  }

  function normalizeServiceMenuJson(raw) {
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        const price = String(item.price || item.value || item.amount || "").trim();
        const description = String(
          item.description || item.desc || item.note || ""
        ).trim();
        const duration = String(item.duration || "").trim();
        const location = String(item.location || "").trim();
        const image_url = String(item.image_url || item.image || "").trim();
        if (!title && !price && !description) return null;
        return {
          title: title || `サービス ${index + 1}`,
          price,
          description,
          duration,
          location,
          image_url,
        };
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  function normalizeWorkCasesJson(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        const content = String(
          item.content || item.category || item.service || item.description || ""
        ).trim();
        const region = String(item.region || item.area || "").trim();
        const period = String(item.period || item.duration || "").trim();
        const cost = String(item.cost || item.price || "").trim();
        const note = String(
          item.note || item.notes || item.supplement || ""
        ).trim();
        const description = String(
          item.description || item.note || item.notes || ""
        ).trim();
        const image_url = String(item.image_url || item.image || "").trim();
        if (!title && !content && !region && !period && !cost && !description) {
          return null;
        }
        return {
          title: title || `事例 ${index + 1}`,
          category: content,
          area: region,
          period,
          price: cost,
          description,
          image_url,
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }

  /** form_data / トップレベル入力 → DB列 + 同期済み form_data */
  function mapJobConditionFields(input) {
    const fd =
      input?.form_data && typeof input.form_data === "object"
        ? { ...input.form_data }
        : {};

    const budget_amount = textOrNull(input.budget_amount ?? fd.budget_amount);
    const payment_type = textOrNull(input.payment_type ?? fd.payment_type);
    const start_date = textOrNull(input.start_date ?? fd.start_date);
    const contract_period = textOrNull(input.contract_period ?? fd.contract_period);
    const recruit_count = textOrNull(input.recruit_count ?? fd.recruit_count);
    const recruit_status =
      (window.TasuBusinessWording?.normalizeRecruitStatusForSave
        ? window.TasuBusinessWording.normalizeRecruitStatusForSave(
            input.recruit_status ?? fd.recruit_status
          )
        : textOrNull(input.recruit_status ?? fd.recruit_status)) ||
      window.TasuBusinessWording?.defaultRecruitStatus ||
      "受付中";
    const contact_method =
      textOrNull(input.contact_method ?? fd.contact_method) || "サイト内チャット";
    const application_conditions = normalizeApplicationConditions(
      input.application_conditions ?? fd.application_conditions
    );
    const category_extra = normalizeCategoryExtra(
      input.category_extra ?? fd.category_extra
    );
    const category = normalizeBusinessCategory(input.business_category);
    const work_cases = normalizeWorkCasesJson(input.work_cases ?? fd.work_cases);
    const service_menu_items = normalizeServiceMenuJson(
      input.service_menu_items ?? fd.service_menu_items
    );

    const form_data = {
      ...fd,
      budget_amount: budget_amount || "",
      payment_type: payment_type || "",
      start_date: start_date || "",
      contract_period: contract_period || "",
      recruit_count: recruit_count || "",
      recruit_status,
      application_conditions,
      contact_method,
      category_extra,
    };
    if (fd.business_service && typeof fd.business_service === "object") {
      form_data.business_service = fd.business_service;
    }
    if (work_cases.length) form_data.work_cases = work_cases;
    if (service_menu_items.length) form_data.service_menu_items = service_menu_items;

    const images = mapBusinessImageFields(input, form_data);
    const taxi = mapTaxiFields(input, images.form_data, category_extra);

    return {
      budget_amount,
      payment_type,
      start_date,
      contract_period,
      recruit_count,
      recruit_status,
      application_conditions,
      contact_method,
      category_extra: taxi.category_extra,
      image_url: images.image_url,
      thumbnail_url: images.thumbnail_url,
      main_image_url: images.main_image_url,
      images: images.images,
      gallery_urls: images.gallery_urls,
      work_cases,
      service_menu_items,
      form_data: taxi.form_data,
      ...Object.fromEntries(
        TAXI_COLUMN_KEYS.filter((key) => taxi[key] != null).map((key) => [key, taxi[key]])
      ),
    };
  }

  function resolveBusinessDescription(input) {
    const direct = String(input?.description || "").trim();
    if (direct) return direct;
    const fd =
      input?.form_data && typeof input.form_data === "object" ? input.form_data : {};
    const extra = fd.category_extra && typeof fd.category_extra === "object" ? fd.category_extra : {};
    const fromBusinessService = String(fd.business_service?.hero?.service_description || "").trim();
    if (fromBusinessService) return fromBusinessService;
    const fromFieldService = String(extra.field_service?.service_description || "").trim();
    if (fromFieldService) return fromFieldService;
    const fromConstruction = String(extra.construction?.service_description || "").trim();
    if (fromConstruction) return fromConstruction;
    return "";
  }

  const BUSINESS_REQUIRED_LABELS = {
    user_id: "ユーザーID",
    business_category: "カテゴリ",
    company_name: "会社名",
    title: "サービス名",
    description: "サービス説明",
    phone: "電話番号",
    service_area: "対応エリア要約",
  };

  function listBusinessRequiredMissing(row) {
    const missing = [];
    const pushKey = (key) => {
      missing.push({
        key,
        label: BUSINESS_REQUIRED_LABELS[key] || key,
        name: BUSINESS_REQUIRED_LABELS[key] || key,
      });
    };
    if (!String(row.user_id || "").trim()) pushKey("user_id");
    if (!String(row.business_category || "").trim()) pushKey("business_category");
    if (!String(row.company_name || "").trim()) pushKey("company_name");
    if (!String(row.title || "").trim()) pushKey("title");
    if (!String(row.description || "").trim()) pushKey("description");
    if (!String(row.phone || "").trim()) pushKey("phone");
    if (!String(row.service_area || "").trim()) pushKey("service_area");
    return missing;
  }

  function formatBusinessMissingError(missing) {
    if (!missing.length) return "必須項目が不足しています";
    const lines = missing.map((m) => `・${m.label || m.key || m.name || m}`);
    return `必要項目が不足しています：\n${lines.join("\n")}`;
  }

  function normalizePayload(input) {
    const category = normalizeBusinessCategory(input.business_category);
    const status = String(input.status || "").trim();
    const publishStatus = String(input.publish_status || "public").trim();
    const job = mapJobConditionFields(input);
    const description = resolveBusinessDescription(input);

    const subcategory = textOrNull(
      input.business_subcategory ?? input.form_data?.business_subcategory
    );

    const products = Array.isArray(input.products) ? input.products : [];
    const businessType = textOrNull(
      input.business_type ?? input.form_data?.business_type
    );
    const form_data = { ...job.form_data };
    if (businessType) form_data.business_type = businessType;
    if (products.length) form_data.products = products;
    const prPlan = VALID_PLANS.has(String(input.pr_plan)) ? input.pr_plan : "none";
    const featuredPlan = VALID_PLANS.has(String(input.featured_plan)) ? input.featured_plan : "none";
    form_data.pr_plan = prPlan;
    form_data.featured_plan = featuredPlan;
    if (String(input.pr_payment_url || "").trim()) {
      form_data.pr_payment_url = String(input.pr_payment_url).trim();
    }
    if (String(input.pr_bank_info || "").trim()) {
      form_data.pr_bank_info = String(input.pr_bank_info).trim();
    }
    if (String(input.featured_payment_url || "").trim()) {
      form_data.featured_payment_url = String(input.featured_payment_url).trim();
    }
    if (String(input.featured_bank_info || "").trim()) {
      form_data.featured_bank_info = String(input.featured_bank_info).trim();
    }

    return {
      user_id: String(input.user_id || "").trim(),
      business_category: category && VALID_CATEGORIES.has(category) ? category : "",
      business_subcategory: subcategory,
      company_name: String(input.company_name || "").trim(),
      title: String(input.title || "").trim(),
      description,
      hp_url: String(input.hp_url || "").trim() || null,
      google_map_url: String(input.google_map_url || "").trim() || null,
      phone: String(input.phone || "").trim(),
      business_hours: String(input.business_hours || "").trim() || null,
      service_area: String(input.service_area || "").trim(),
      achievements: String(input.achievements || "").trim() || null,
      status: VALID_STATUS.has(status) ? status : "available",
      license_info: String(input.license_info || "").trim() || null,
      pr_plan: VALID_PLANS.has(String(input.pr_plan)) ? input.pr_plan : "none",
      featured_plan: VALID_PLANS.has(String(input.featured_plan)) ? input.featured_plan : "none",
      pr_payment_url: String(input.pr_payment_url || "").trim() || null,
      pr_bank_info: String(input.pr_bank_info || "").trim() || null,
      featured_payment_url: String(input.featured_payment_url || "").trim() || null,
      featured_bank_info: String(input.featured_bank_info || "").trim() || null,
      payment_url: String(input.payment_url || "").trim() || null,
      bank_transfer_info: String(input.bank_transfer_info || "").trim() || null,
      invoice_support: VALID_INVOICE.has(String(input.invoice_support))
        ? input.invoice_support
        : "negotiable",
      publish_status: VALID_PUBLISH.has(publishStatus) ? publishStatus : "public",
      tags: String(input.tags || "").trim(),
      budget_amount: job.budget_amount,
      payment_type: job.payment_type,
      start_date: job.start_date,
      contract_period: job.contract_period,
      recruit_count: job.recruit_count,
      recruit_status: job.recruit_status,
      application_conditions: job.application_conditions,
      contact_method: job.contact_method,
      category_extra: job.category_extra,
      image_url: job.image_url,
      thumbnail_url: job.thumbnail_url,
      main_image_url: job.main_image_url,
      images: job.images,
      gallery_urls: job.gallery_urls,
      work_cases: job.work_cases?.length ? job.work_cases : [],
      service_menu_items: job.service_menu_items?.length ? job.service_menu_items : [],
      form_data,
      ...((window.TasuBusinessCategories?.isTransportProfile?.(category) ?? category === "taxi") ||
      job.taxi_service_type
        ? {
            taxi_service_type: job.taxi_service_type ?? null,
            taxi_vehicle_type: job.taxi_vehicle_type ?? null,
            taxi_area_type: job.taxi_area_type ?? null,
            taxi_airport_transfer: job.taxi_airport_transfer ?? null,
            taxi_24h_available: job.taxi_24h_available ?? null,
            taxi_reservation_available: job.taxi_reservation_available ?? null,
            taxi_corporate_contract: job.taxi_corporate_contract ?? null,
            taxi_invoice_available: job.taxi_invoice_available ?? null,
            taxi_payment_methods: job.taxi_payment_methods ?? [],
            taxi_base_fare: job.taxi_base_fare ?? null,
            taxi_night_fare: job.taxi_night_fare ?? null,
            taxi_route_price: job.taxi_route_price ?? null,
            taxi_capacity: job.taxi_capacity ?? null,
            taxi_language_support: job.taxi_language_support ?? null,
            taxi_child_seat: job.taxi_child_seat ?? null,
            taxi_booking_types: job.taxi_booking_types ?? [],
          }
        : {}),
      rating: 0,
      review_count: 0,
      reply_rate: 0,
    };
  }

  function buildSupabaseUpdateRow(normalized) {
    const {
      rating: _rating,
      review_count: _reviewCount,
      reply_rate: _replyRate,
      ...updateRow
    } = normalized;
    return updateRow;
  }

  function rowToListing(row) {
    if (!row) return null;
    const normalized = { ...row, _source: row._source || "supabase" };
    if (window.TasuListingRenderer?.normalizeBusinessRow) {
      return window.TasuListingRenderer.normalizeBusinessRow(normalized);
    }
    const cat = row.business_category;
    return {
      id: row.id,
      source: normalized._source,
      business_category: cat,
      type: "business",
      targetType: "business",
      title: row.title,
      description: row.description,
      created_at: row.created_at,
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[TasuBusinessListings] localStorage save failed:", err);
    }
  }

  function updateLocalBusinessListing(id, row) {
    const key = String(id || "").trim();
    if (!key) return { ok: false, error: "id が未設定です" };
    const list = loadLocal();
    const idx = list.findIndex((r) => String(r.id || "") === key);
    if (idx < 0) return { ok: false, error: "掲載が見つかりません" };
    const prev = list[idx];
    const { shop_store_products: shopProducts, ...rest } = row;
    const record = {
      ...prev,
      ...rest,
      id: key,
      shop_store_products: shopProducts ?? prev.shop_store_products,
      products: row.products ?? prev.products,
      updated_at: new Date().toISOString(),
    };
    list[idx] = record;
    saveLocal(list);
    if (shopProducts?.length && window.TasuShopStoreProductsDb?.insertShopStoreProducts) {
      window.TasuShopStoreProductsDb.insertShopStoreProducts(key, shopProducts);
    }
    return {
      ok: true,
      id: key,
      record: rowToListing({ ...record, _source: "local" }),
      via: "local",
    };
  }

  function insertLocal(row) {
    const list = loadLocal();
    const { shop_store_products: shopProducts, ...rest } = row;
    const record = {
      id: `local_biz_${Date.now()}`,
      ...rest,
      shop_store_products: shopProducts,
      products: row.products,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(record);
    saveLocal(list);
    if (shopProducts?.length && window.TasuShopStoreProductsDb?.insertShopStoreProducts) {
      window.TasuShopStoreProductsDb.insertShopStoreProducts(record.id, shopProducts);
    }
    return {
      ok: true,
      id: record.id,
      record: rowToListing({ ...record, _source: "local" }),
      via: "local",
    };
  }

  async function insertSupabaseListing(row) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase が未設定です" };

    logBusinessImagePayload("insertSupabaseListing (before insert)", row);

    const { data, error } = await sb
      .from("business_listings")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.warn("[TasuBusinessListings] insert failed:", error);
      return { ok: false, error: error.message || String(error) };
    }

    return {
      ok: true,
      id: data?.id,
      record: rowToListing({ ...data, _source: "supabase" }),
      via: "supabase",
    };
  }

  /** @deprecated insertSupabaseListing を使用 */
  async function insertSupabase(row) {
    return insertSupabaseListing(row);
  }

  async function updateSupabaseListing(id, input) {
    const key = String(id || "").trim();
    if (!key) return { ok: false, error: "id が未設定です" };
    if (!isUuid(key)) {
      return { ok: false, error: "UUID 形式の id が必要です" };
    }

    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase が未設定です" };

    const row = normalizePayload(input);
    const { data, error } = await sb
      .from("business_listings")
      .update(buildSupabaseUpdateRow(row))
      .eq("id", key)
      .select("*")
      .single();

    if (error) {
      console.warn("[TasuBusinessListings] update failed:", error);
      return { ok: false, error: error.message || String(error) };
    }

    return {
      ok: true,
      id: data?.id,
      record: rowToListing({ ...data, _source: "supabase" }),
      via: "supabase",
    };
  }

  async function saveBusinessListing(input, editId) {
    const key = String(editId || input?.id || "").trim();
    if (key && key.startsWith("local_biz_")) {
      return updateLocalBusinessListing(key, input);
    }
    if (key && isUuid(key) && updateSupabaseListing) {
      return updateSupabaseListing(key, input);
    }
    return insertBusinessListing(input);
  }

  async function insertBusinessListing(input) {
    logBusinessImagePayload("insertBusinessListing (raw input)", input);
    const shopProducts = input?.shop_store_products;
    const row = normalizePayload(input);
    logBusinessImagePayload("insertBusinessListing (normalized)", row);
    console.log("[business save payload]", {
      id: row?.id,
      type: row?.type || row?.listing_type,
      scope: "business",
      status: row?.status,
      publish_status: row?.publish_status,
      published_at: row?.published_at,
      created_at: row?.created_at,
    });
    if (!row.user_id) return { ok: false, error: "user_id が未設定です" };
    if (!row.business_category) return { ok: false, error: "business_category が未設定です" };
    const isDraft = String(row.publish_status || "").trim() === "draft";
    if (!isDraft) {
      const missing = listBusinessRequiredMissing(row);
      if (missing.length) {
        console.warn("[business missing required fields]", missing);
        return { ok: false, error: formatBusinessMissingError(missing), missingFields: missing };
      }
    }

    const sb = getClient();
    if (sb) {
      const result = await insertSupabaseListing(row);
      if (result.ok && shopProducts?.length && window.TasuShopStoreProductsDb?.insertShopStoreProducts) {
        const prodResult = await window.TasuShopStoreProductsDb.insertShopStoreProducts(
          result.id,
          shopProducts
        );
        if (!prodResult.ok) {
          console.warn("[TasuBusinessListings] shop_store_products insert:", prodResult.error);
        }
      }
      if (result.ok) return result;
      console.warn("[TasuBusinessListings] fallback to local:", result.error);
    }

    return insertLocal({ ...row, shop_store_products: shopProducts, products: input?.products });
  }

  async function mapFetchedBusinessRow(data) {
    if (!data) return null;
    const row = { ...data };
    console.log("[TasuBusinessListings] fetched image columns", {
      image_url: row.image_url,
      thumbnail_url: row.thumbnail_url,
      main_image_url: row.main_image_url,
      gallery_urls: row.gallery_urls,
      images: row.images,
      work_cases: row.work_cases,
      service_menu_items: row.service_menu_items,
    });
    let listing = rowToListing({
      ...row,
      company_rating_avg: row.rating ?? row.company_rating_avg ?? null,
      company_review_count: row.review_count ?? row.company_review_count ?? null,
      _source: "supabase",
    });
    if (listing && window.TasuShopStoreProductsDb?.attachProductsToListing) {
      listing = await window.TasuShopStoreProductsDb.attachProductsToListing(listing);
    }
    return listing;
  }

  function parseLocalFormData(record) {
    const raw = record?.form_data;
    if (raw && typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return {};
  }

  function findLocalListing(key) {
    const list = loadLocal();
    return (
      list.find((r) => {
        if (String(r.id) === key) return true;
        const fd = parseLocalFormData(r);
        return String(fd.demo_id || "") === key;
      }) || null
    );
  }

  async function fetchBusinessListingByDemoId(key) {
    const sb = getClient();
    if (!sb) return null;

    const { data, error } = await sb
      .from("business_listings")
      .select(BUSINESS_LISTING_FETCH_SELECT)
      .filter("form_data->>demo_id", "eq", key)
      .maybeSingle();

    if (error) {
      console.warn("[TasuBusinessListings] fetchByDemoId failed:", error);
      return null;
    }
    return data ? await mapFetchedBusinessRow(data) : null;
  }

  async function fetchBusinessListingFromListingsTable(key) {
    const sb = getClient();
    if (!sb || !isUuid(key)) return null;

    const { data, error } = await sb
      .from("listings")
      .select(LISTINGS_TABLE_IMAGE_SELECT)
      .eq("id", key)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn("[TasuBusinessListings] listings table fetch failed:", error);
      return null;
    }

    const fd =
      data.form_data && typeof data.form_data === "object"
        ? data.form_data
        : typeof data.form_data === "string"
          ? (() => {
              try {
                return JSON.parse(data.form_data);
              } catch {
                return {};
              }
            })()
          : {};

    console.log("[TasuBusinessListings] listings table image columns", {
      image_url: data.image_url,
      gallery_urls: data.gallery_urls,
      images: data.images,
      work_cases: data.work_cases,
    });

    return rowToListing({
      ...data,
      business_category:
        data.business_category || fd.business_category || "repair_maintenance",
      listing_type: data.listing_type || "business",
      _source: "supabase-listings",
    });
  }

  /**
   * 詳細ページ用 select — business_listings の実在カラムのみ（存在しない列は入れない）
   * 表示専用項目は form_data / category_extra から listing-renderer が補完
   */
  const BUSINESS_LISTING_FETCH_SELECT = [
    "id",
    "user_id",
    "company_id",
    "company_name",
    "business_category",
    "business_subcategory",
    "title",
    "description",
    "phone",
    "business_hours",
    "service_area",
    "status",
    "status_label",
    "license_info",
    "service_tags",
    "service_features",
    "repair_services",
    "work_cases",
    "service_menu_items",
    "option_items",
    "price_guides",
    "form_data",
    "image_url",
    "thumbnail_url",
    "main_image_url",
    "gallery_urls",
    "images",
    "hp_url",
    "google_map_url",
    "pr_plan",
    "featured_plan",
    "pr_payment_url",
    "pr_bank_info",
    "featured_payment_url",
    "featured_bank_info",
    "payment_url",
    "bank_transfer_info",
    "invoice_support",
    "rating",
    "review_count",
    "reply_rate",
    "publish_status",
    "tags",
    "created_at",
    "updated_at",
    "budget_amount",
    "payment_type",
    "start_date",
    "contract_period",
    "recruit_count",
    "recruit_status",
    "application_conditions",
    "contact_method",
    "category_extra",
  ].join(", ");

  const LISTINGS_TABLE_IMAGE_SELECT = [
    "id",
    "listing_type",
    "business_category",
    "company_name",
    "title",
    "description",
    "form_data",
    "image_url",
    "thumbnail_url",
    "main_image_url",
    "gallery_urls",
    "images",
    "work_cases",
  ].join(", ");

  async function fetchBusinessListingById(id) {
    const key = String(id || "").trim();
    if (!key) return null;

    // local_* は Supabase を叩かず localStorage 優先
    if (key.startsWith("local_")) {
      const local = findLocalListing(key);
      if (local) {
        let listing = rowToListing({ ...local, _source: "local" });
        if (Array.isArray(local.products) && local.products.length) {
          listing.products = local.products;
        }
        if (listing && window.TasuShopStoreProductsDb?.attachProductsToListing) {
          listing = await window.TasuShopStoreProductsDb.attachProductsToListing(listing);
        }
        return listing;
      }
      return null;
    }

    const sb = getClient();
    if (sb) {
      const runFetchByColumn = async (column, value) => {
        const { data, error } = await sb
          .from("business_listings")
          .select(BUSINESS_LISTING_FETCH_SELECT)
          .eq(column, value)
          .maybeSingle();
        if (error) {
          console.warn(`[TasuBusinessListings] fetchById (${column}) failed:`, error);
          return null;
        }
        return data ? await mapFetchedBusinessRow(data) : null;
      };

      // 1) business_listings.id
      let listing = null;
      if (isUuid(key)) {
        listing = await runFetchByColumn("id", key);
        if (listing) return listing;
      }

      if (isUuid(key)) {
        const fromListings = await fetchBusinessListingFromListingsTable(key);
        if (fromListings) return fromListings;
      }

      // 2) form_data.demo_id
      listing = await fetchBusinessListingByDemoId(key);
      if (listing) return listing;
    }

    // 3) localStorage（id または form_data.demo_id）
    const local = findLocalListing(key);
    if (local) {
      let listing = rowToListing({ ...local, _source: "local" });
      if (Array.isArray(local.products) && local.products.length) {
        listing.products = local.products;
      }
      if (listing && window.TasuShopStoreProductsDb?.attachProductsToListing) {
        listing = await window.TasuShopStoreProductsDb.attachProductsToListing(listing);
      }
      return listing;
    }

    return null;
  }

  function matchesListingUserId(row, userId) {
    const uid = String(userId || "").trim();
    if (!uid) return false;
    const owner = String(
      row?.user_id || row?.userId || row?.owner_id || row?.seller_id || row?.created_by || ""
    ).trim();
    return owner === uid;
  }

  function isDemoListingId(id) {
    const key = String(id || "").trim().toLowerCase();
    if (!key) return true;
    if (window.TasuDashboardData?.isDemoIdentifier?.(key)) return true;
    if (/^demo[-_]/.test(key) || key.startsWith("demo_")) return true;
    return false;
  }

  function mergeUserListingRows(remote, local, userId) {
    const uid = String(userId || "").trim();
    const seen = new Set();
    const merged = [];

    const push = (row) => {
      if (!row) return;
      const id = String(row.id || "").trim();
      if (!id || seen.has(id) || isDemoListingId(id)) return;
      if (!matchesListingUserId(row, uid)) return;
      seen.add(id);
      merged.push(row);
    };

    (remote || []).forEach(push);
    (local || []).forEach((raw) => {
      push({ ...raw, _source: raw._source || "local" });
    });

    merged.sort((a, b) => {
      const ta = String(a.updated_at || a.created_at || "");
      const tb = String(b.updated_at || b.created_at || "");
      return tb.localeCompare(ta);
    });

    return merged;
  }

  async function fetchBusinessListingsByUser(userId, options = {}) {
    const uid = String(userId || "").trim();
    if (!uid) return [];

    const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);
    let remote = [];

    if (getClient() && window.location.protocol !== "file:") {
      const { data, error } = await getClient()
        .from("business_listings")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        remote = data.map((r) => ({ ...r, _source: "supabase" }));
      } else if (error) {
        console.warn("[TasuBusinessListings] fetchByUser failed:", error);
      }
    }

    const local = loadLocal()
      .filter((r) => matchesListingUserId(r, uid))
      .slice(0, limit);

    return mergeUserListingRows(remote, local, uid).slice(0, limit);
  }

  async function updateBusinessPublishStatus(id, userId, publishStatus) {
    const key = String(id || "").trim();
    const uid = String(userId || "").trim();
    const status = String(publishStatus || "").trim();
    if (!key || !uid) return { ok: false, error: "id または user_id が未設定です" };
    if (!VALID_PUBLISH.has(status)) {
      return { ok: false, error: "公開状態が不正です" };
    }

    if (key.startsWith("local_biz_")) {
      const list = loadLocal();
      const idx = list.findIndex((r) => String(r.id || "") === key);
      if (idx < 0) return { ok: false, error: "掲載が見つかりません" };
      if (!matchesListingUserId(list[idx], uid)) {
        return { ok: false, error: "この掲載を変更する権限がありません" };
      }
      list[idx] = {
        ...list[idx],
        publish_status: status,
        updated_at: new Date().toISOString(),
      };
      saveLocal(list);
      return { ok: true, id: key, via: "local" };
    }

    const sb = getClient();
    if (!sb || !isUuid(key)) {
      return { ok: false, error: "Supabase で更新できない id です" };
    }

    const { data, error } = await sb
      .from("business_listings")
      .update({
        publish_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", key)
      .eq("user_id", uid)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[TasuBusinessListings] updatePublishStatus failed:", error);
      return { ok: false, error: error.message || String(error) };
    }
    if (!data?.id) {
      return { ok: false, error: "掲載が見つからないか、権限がありません" };
    }

    return { ok: true, id: data.id, via: "supabase" };
  }

  async function fetchPublishedBusinessListings(options = {}) {
    const limit = Math.min(Number(options.limit) || 40, 100);
    const businessCategory = options.business_category
      ? String(options.business_category).trim()
      : "";
    const publicOnly = options.public_only === true;
    const localFallback = options.localFallback !== false;
    let remote = [];

    if (getClient() && window.location.protocol !== "file:") {
      const runQuery = (withPublishFilter) => {
        let query = getClient()
          .from("business_listings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (withPublishFilter && publicOnly) {
          query = query.eq("publish_status", "public");
        }
        if (businessCategory) {
          const filterValues =
            window.TasuBusinessCategories?.getCategoryFilterValues?.(businessCategory) || [
              normalizeBusinessCategory(businessCategory),
            ].filter(Boolean);
          if (filterValues.length === 1) {
            query = query.eq("business_category", filterValues[0]);
          } else if (filterValues.length > 1) {
            query = query.in("business_category", filterValues);
          }
        }
        return query;
      };

      let { data, error } = await runQuery(true);
      if (error) ({ data, error } = await runQuery(false));
      if (!error && Array.isArray(data)) {
        remote = data.map((r) => rowToListing({ ...r, _source: "supabase" }));
      } else if (error) {
        console.warn("[TasuBusinessListings] fetch list failed:", error);
      }

      if (!localFallback && remote.length) return remote.slice(0, limit);
    }

    const local = loadLocal()
      .filter(
        (r) =>
          !businessCategory ||
          (window.TasuBusinessCategories?.categoryMatches
            ? window.TasuBusinessCategories.categoryMatches(
                r.business_category,
                businessCategory
              )
            : r.business_category === businessCategory)
      )
      .filter((r) => !publicOnly || r.publish_status === "public" || !r.publish_status)
      .slice(0, limit)
      .map((r) => rowToListing({ ...r, _source: "local" }));

    const seen = new Set();
    const merged = [];
    [...remote, ...local].forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      merged.push(item);
    });

    let result = merged.slice(0, limit);
    if (
      businessCategory &&
      window.TasuBusinessCategories?.filterListingsForBoard &&
      window.TasuBusinessCategories?.isBoardListingTypeFilter?.(businessCategory)
    ) {
      result = window.TasuBusinessCategories.filterListingsForBoard(result, businessCategory);
    }
    return result;
  }

  function buildBusinessCardElement(listing) {
    if (document.body?.classList?.contains("business-board-page")) {
      return null;
    }
    if (window.TasuBusinessBoardRenderer?.buildMobileCardElement) {
      return window.TasuBusinessBoardRenderer.buildMobileCardElement(listing);
    }
    if (window.TasuListingRenderer?.buildCardElement) {
      return window.TasuListingRenderer.buildCardElement(listing);
    }
    const li = document.createElement("li");
    li.className = "card-list__item";
    return li;
  }

  window.TasuBusinessListings = {
    insertBusinessListing,
    saveBusinessListing,
    updateLocalBusinessListing,
    insertSupabaseListing,
    updateSupabaseListing,
    fetchBusinessListingById,
    fetchBusinessListingsByUser,
    fetchPublishedBusinessListings,
    updateBusinessPublishStatus,
    matchesListingUserId,
    buildBusinessCardElement,
    normalizePayload,
    mapJobConditionFields,
    rowToListing,
    isConfigured,
    isUuid,
    loadLocal: listLocalBusinessListings,
    listLocalBusinessListings,
    CATEGORY_LABELS,
    STATUS_LABELS,
  };

  function listLocalBusinessListings() {
    return loadLocal();
  }
})();
