/**
 * 掲載詳細 URL / デモ ID の一元管理
 * 通知・ホーム・おすすめ・一覧・詳細ローダーはこのモジュールのみを参照すること
 */
(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /** エイリアス → 正規デモ ID */
  const ID_ALIASES = Object.freeze({
    "demo-business-001": "demo-business-service-001",
    "demo-bs-001": "demo-business-service-001",
    "demo-shop-store": "demo-shop-001",
    "demo-shop": "demo-shop-001",
    "demo-shop-flower": "demo-shop-001",
    "demo-product": "demo-product-001",
    "demo-job": "demo-job-001",
    "demo-skill": "demo-skill-001",
    "demo-worker": "demo-worker-001",
    "general-demo-002": "demo-general-001",
    "demo_skill_001": "demo-skill-001",
    "demo_skill_002": "demo-skill-002",
    "demo_product_001": "demo-product-001",
    "demo_worker_001": "demo-worker-001",
    "demo_worker_002": "demo-worker-002",
    "demo_job_001": "demo-job-001",
    "job_demo_full": "job_demo_full_001",
    "skill_demo_001": "demo-skill-001",
    "local_skill_001": "demo-skill-001",
  });

  /** 種別 → 詳細ページ + id なし時の fallback */
  const TYPE_ROUTES = Object.freeze({
    job: { path: "detail-job.html", fallbackId: "demo-job-001" },
    product: { path: "detail-product.html", fallbackId: "demo-product-001" },
    business_service: { path: "detail-business-service.html", fallbackId: "demo-business-service-001" },
    business: { path: "detail-business-service.html", fallbackId: "demo-business-service-001" },
    field_service: { path: "detail-business-service.html", fallbackId: "demo-business-service-001" },
    shop: { path: "detail-shop-store.html", fallbackId: "demo-shop-001" },
    shop_store: { path: "detail-shop-store.html", fallbackId: "demo-shop-001" },
    "shop-store": { path: "detail-shop-store.html", fallbackId: "demo-shop-001" },
    general: { path: "detail-general.html", fallbackId: "demo-general-001" },
    progress: { path: "demo-progress.html", fallbackId: "demo-progress-001" },
    deal: { path: "deal-detail.html", fallbackId: "builder_demo_001" },
    project: { path: "deal-detail.html", fallbackId: "builder_demo_001" },
    builder: { path: "deal-detail.html", fallbackId: "builder_demo_001" },
    skill: { path: "detail-skill.html", fallbackId: "demo-skill-001" },
    worker: { path: "detail-worker.html", fallbackId: "demo-worker-001" },
    anpi: { path: "anpi-dashboard.html", fallbackId: null },
    system: { path: "admin-operations-dashboard.html#ops-ai-secretary", fallbackId: null },
  });

  const FORBIDDEN_DETAIL_PATHS = Object.freeze(["detail-business.html"]);

  const TYPE_ALIASES = Object.freeze({
    "business-service": "business_service",
    shop_store: "shop",
    "shop-store": "shop",
    field_service: "business_service",
    "field-service": "business_service",
  });

  function normalizeTypeKey(type) {
    const raw = String(type || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (!raw) return "";
    return TYPE_ALIASES[raw] || TYPE_ALIASES[String(type || "").trim().toLowerCase()] || raw;
  }

  function resolveListingId(id) {
    const key = String(id || "").trim();
    if (!key) return "";
    if (ID_ALIASES[key]) return ID_ALIASES[key];
    const m = key.match(/^demo_([a-z]+)_(\d+)$/i);
    if (m) return `demo-${m[1]}-${m[2]}`;
    return key;
  }

  /** 詳細ローダー用：URL id の表記ゆれをすべて試す */
  function collectListingIdCandidates(id) {
    const key = String(id || "").trim();
    if (!key) return [];
    const out = new Set();
    const add = (v) => {
      const s = String(v || "").trim();
      if (s) out.add(s);
    };
    add(key);
    add(resolveListingId(key));
    if (key.includes("_")) add(key.replace(/_/g, "-"));
    if (key.includes("-")) add(key.replace(/-/g, "_"));
    const m = key.match(/^demo[_-](skill|worker|product|job)[_-](\d+)$/i);
    if (m) {
      add(`demo-${m[1]}-${m[2]}`);
      add(`demo_${m[1]}_${m[2]}`);
    }
    return [...out];
  }

  function getFallbackId(type) {
    const route = TYPE_ROUTES[normalizeTypeKey(type)];
    return route?.fallbackId || "";
  }

  function getRoute(type) {
    return TYPE_ROUTES[normalizeTypeKey(type)] || null;
  }

  /**
   * @param {string} type 掲載種別
   * @param {string} [id] 掲載 ID（省略時は種別の fallback）
   * @returns {string} 必ず id 付き（anpi / system など id 不要種別を除く）
   */
  function buildDetailUrl(type, id) {
    const route = getRoute(type);
    if (!route) return "#";
    if (!route.fallbackId && !id) return route.path;
    const resolved = resolveListingId(id) || route.fallbackId;
    if (!resolved) return route.path;
    return `${route.path}?id=${encodeURIComponent(resolved)}`;
  }

  function buildDetailUrlFromRecord(record) {
    if (!record || typeof record !== "object") return "#";
    const id = String(record.id || record.listing_id || "").trim();
    if (/^demo-biz-/i.test(id)) {
      return buildDetailUrl("business_service", id);
    }
    const bt = String(
      record.business_type ||
        record.businessType ||
        record.form_data?.business_type ||
        ""
    ).trim();
    if (bt === "shop_store" || root.TasuBusinessCategories?.isShopStoreListing?.(record)) {
      return buildDetailUrl("shop", id);
    }
    if (
      bt === "field_service" ||
      root.TasuBusinessCategories?.isFieldServiceListing?.(record)
    ) {
      return buildDetailUrl("business_service", id);
    }
    const typeKey =
      normalizeTypeKey(
        record.listing_type || record.listingType || record.type || bt
      ) || "";
    if (typeKey) return buildDetailUrl(typeKey, id);
    return buildDetailUrl("general", id);
  }

  function legacyBusinessRedirectUrl(id) {
    return buildDetailUrl("business_service", id);
  }

  function isDemoListingId(id) {
    const key = resolveListingId(id);
    if (!key) return false;
    if (/^demo[-_]/i.test(key)) return true;
    if (Object.prototype.hasOwnProperty.call(ID_ALIASES, key)) return true;
    if (key === "worker_hiro_001" || key === "worker_web_partner_001") return true;
    const allFallbacks = Object.values(TYPE_ROUTES)
      .map((r) => r.fallbackId)
      .filter(Boolean);
    return allFallbacks.includes(key);
  }

  function isUuid(id) {
    const key = resolveListingId(id);
    if (!key) return false;
    if (isDemoListingId(key)) return false;
    return UUID_RE.test(key);
  }

  /** Supabase listings 取得を試みてよいか */
  function shouldQuerySupabase(id) {
    return isUuid(id);
  }

  function shouldSkipSupabaseFetch(id) {
    return !shouldQuerySupabase(id);
  }

  function pickIdFromUrl(url) {
    const raw = String(url || "").trim();
    if (!raw || raw === "#") return "";
    try {
      const base = root.location?.href || "http://localhost/";
      const u = new URL(raw, base);
      return String(
        u.searchParams.get("id") ||
          u.searchParams.get("shopId") ||
          u.searchParams.get("projectId") ||
          ""
      ).trim();
    } catch {
      const m = raw.match(/[?&](?:id|shopId|projectId)=([^&]+)/i);
      return m ? decodeURIComponent(m[1]).trim() : "";
    }
  }

  function inferTypeFromUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const path = raw.split("?")[0].split("#")[0];
    if (/detail-job/i.test(path)) return "job";
    if (/detail-product/i.test(path)) return "product";
    if (/detail-business-service/i.test(path)) return "business_service";
    if (/detail-shop/i.test(path)) return "shop";
    if (/detail-general/i.test(path)) return "general";
    if (/detail-skill/i.test(path)) return "skill";
    if (/detail-worker/i.test(path)) return "worker";
    if (/deal-detail/i.test(path)) return "deal";
    if (/demo-progress/i.test(path)) return "progress";
    if (/anpi-dashboard/i.test(path)) return "anpi";
    return "";
  }

  function normalizeDetailHref(url) {
    const raw = String(url || "").trim();
    if (!raw || raw === "#") return raw;
    if (FORBIDDEN_DETAIL_PATHS.some((p) => raw.includes(p))) {
      const id = pickIdFromUrl(raw);
      return legacyBusinessRedirectUrl(id);
    }
    const pathOnly = raw.split("?")[0];
    const hasId = /[?&]id=/.test(raw);
    const type = inferTypeFromUrl(raw);
    if (type && !hasId && getRoute(type)?.fallbackId) {
      return buildDetailUrl(type, pickIdFromUrl(raw));
    }
    if (type && hasId) {
      const id = pickIdFromUrl(raw);
      return buildDetailUrl(type, id);
    }
    return raw;
  }

  root.TasuListingRouteResolver = {
    ID_ALIASES,
    TYPE_ROUTES,
    FORBIDDEN_DETAIL_PATHS,
    normalizeTypeKey,
    resolveListingId,
    collectListingIdCandidates,
    getFallbackId,
    getRoute,
    buildDetailUrl,
    buildDetailUrlFromRecord,
    legacyBusinessRedirectUrl,
    isDemoListingId,
    isUuid,
    shouldQuerySupabase,
    shouldSkipSupabaseFetch,
    pickIdFromUrl,
    inferTypeFromUrl,
    normalizeDetailHref,
  };
})();
