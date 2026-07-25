/**
 * Node mirror of supabase/functions/ai-tasful-search/schema.ts (keep in sync).
 */
export const MAX_QUERY = 300;
export const MAX_LOCATION = 100;
export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_LIMIT = 5;
export const MAX_EMPLOYMENT = 40;
export const MAX_WORK_STYLE = 40;
export const MAX_CATEGORY = 64;

const ACTIONS = new Set(["search", "compare", "history_lookup", "none"]);
const VERTICALS = new Set(["marketplace", "platform", "builder", "all"]);
const SORTS = new Set([
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "availability",
  "recent",
]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPlainObject(value) {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function copyOwnSafe(input) {
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string") continue;
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (key.startsWith("__")) continue;
    out[key] = input[key];
  }
  return out;
}

function trimStr(value, max) {
  if (value == null) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function normalizePrice(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && !String(raw).trim()) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function normalizeDate(raw) {
  if (raw == null || raw === "") return null;
  const text = String(raw).trim();
  const m = text.match(DATE_RE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function normalizeSort(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (!v) return "relevance";
  if (v === "rating_desc") return "rating";
  if (v === "nearby" || v === "distance") return "relevance";
  if (SORTS.has(v)) return v;
  return null;
}

function normalizeAction(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (ACTIONS.has(v)) return v;
  return null;
}

function normalizeVertical(raw) {
  if (raw == null || raw === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (VERTICALS.has(v)) {
    if (v === "marketplace" || v === "platform") return v;
    return "invalid";
  }
  return "invalid";
}

function normalizePlatformType(raw) {
  if (raw == null || raw === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "job") return "job";
  if (v === "business_service") return "business_service";
  if (v === "skill") return "skill";
  return "invalid";
}

function normalizeWorkStyle(raw) {
  const text = trimStr(raw, MAX_WORK_STYLE);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === "remote" || lower === "リモート" || lower === "在宅") return "remote";
  if (lower === "hybrid" || lower === "ハイブリッド") return "hybrid";
  if (lower === "onsite" || lower === "出社" || lower === "オフィス") return "onsite";
  return text.slice(0, MAX_WORK_STYLE);
}

export function validateSearchBody(input) {
  if (input == null) {
    return { ok: false, code: "invalid_input", message: "Request body is required" };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid_input_type", message: "JSON object body required" };
  }
  if (!isPlainObject(input)) {
    return { ok: false, code: "invalid_input_type", message: "JSON object body required" };
  }

  const src = copyOwnSafe(input);
  const action = normalizeAction(src.action);
  if (!action) return { ok: false, code: "invalid_action", message: "Unsupported action" };

  const verticalRaw = normalizeVertical(src.vertical);
  if (verticalRaw === "invalid" || verticalRaw == null) {
    return { ok: false, code: "invalid_vertical", message: "Unsupported vertical" };
  }

  const sort = normalizeSort(src.sort);
  if (!sort) return { ok: false, code: "invalid_sort", message: "Unsupported sort" };

  const query = trimStr(src.query, MAX_QUERY);
  if (typeof src.query === "string" && src.query.trim().length > MAX_QUERY) {
    return { ok: false, code: "query_too_long", message: "query exceeds max length" };
  }

  let priceMin = normalizePrice(src.priceMin);
  let priceMax = normalizePrice(src.priceMax);
  if (src.priceMin != null && src.priceMin !== "" && priceMin == null) {
    return { ok: false, code: "invalid_price", message: "Invalid priceMin" };
  }
  if (src.priceMax != null && src.priceMax !== "" && priceMax == null) {
    return { ok: false, code: "invalid_price", message: "Invalid priceMax" };
  }
  if (
    (typeof src.priceMin === "number" && src.priceMin < 0) ||
    (typeof src.priceMax === "number" && src.priceMax < 0)
  ) {
    return { ok: false, code: "invalid_price", message: "Negative price is not allowed" };
  }
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, code: "invalid_price_range", message: "priceMin must be <= priceMax" };
  }

  let dateFrom = null;
  let dateTo = null;
  if (src.dateFrom != null && src.dateFrom !== "") {
    dateFrom = normalizeDate(src.dateFrom);
    if (!dateFrom) return { ok: false, code: "invalid_date", message: "Invalid dateFrom" };
  }
  if (src.dateTo != null && src.dateTo !== "") {
    dateTo = normalizeDate(src.dateTo);
    if (!dateTo) return { ok: false, code: "invalid_date", message: "Invalid dateTo" };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { ok: false, code: "invalid_date_range", message: "dateFrom must be <= dateTo" };
  }

  let limit = MAX_LIMIT;
  if (src.limit != null && src.limit !== "") {
    const n = typeof src.limit === "number" ? src.limit : Number(src.limit);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return { ok: false, code: "invalid_limit", message: "Invalid limit" };
    }
    if (n > MAX_LIMIT) {
      return { ok: false, code: "limit_exceeded", message: `limit must be <= ${MAX_LIMIT}` };
    }
    limit = n;
  }

  const location = trimStr(src.location, MAX_LOCATION) || null;
  const category = trimStr(src.category, MAX_CATEGORY) || null;
  const employmentType = trimStr(src.employmentType, MAX_EMPLOYMENT) || null;
  const workStyle = normalizeWorkStyle(src.workStyle);

  if (action !== "search" && action !== "compare") {
    return {
      ok: false,
      code: "unsupported_action",
      message: "Only search/compare are supported",
    };
  }

  if (verticalRaw === "marketplace") {
    return {
      ok: true,
      value: {
        action,
        vertical: "marketplace",
        type: null,
        query,
        location,
        category: null,
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
        employmentType: null,
        workStyle: null,
        sort,
        limit,
      },
    };
  }

  const typeRaw = normalizePlatformType(src.type);
  if (typeRaw === "invalid") {
    return { ok: false, code: "invalid_type", message: "Unsupported platform type" };
  }
  if (typeRaw !== "job" && typeRaw !== "business_service" && typeRaw !== "skill") {
    return {
      ok: false,
      code: "unsupported_type",
      message: "Only type=job|business_service|skill is supported for platform",
    };
  }

  return {
    ok: true,
    value: {
      action,
      vertical: "platform",
      type: typeRaw,
      query,
      location,
      category:
        typeRaw === "business_service" || typeRaw === "skill" ? category : null,
      dateFrom,
      dateTo,
      priceMin,
      priceMax,
      employmentType: typeRaw === "job" ? employmentType : null,
      workStyle: typeRaw === "job" ? workStyle : null,
      sort,
      limit,
    },
  };
}

export function assertSafeDetailUrl(url) {
  const u = String(url || "");
  if (!u) return false;
  if (/^https?:/i.test(u) || u.startsWith("//") || /^javascript:/i.test(u)) return false;
  if (u.includes("..")) return false;
  return /^(detail-product\.html|detail-shop-product\.html|detail-job\.html|detail-business-service\.html|detail-skill\.html)(\?|$)/i.test(
    u
  );
}
