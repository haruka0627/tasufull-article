/**
 * TASFUL 内検索 Intent Schema（Zod 非依存 · IIFE）
 * AI Provider を呼ばず、クライアント側で検証・正規化する。
 */
(function (global) {
  "use strict";

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
  const PLATFORM_TYPES = new Set(["job", "business_service"]);
  const MAX_EMPLOYMENT = 40;
  const MAX_WORK_STYLE = 40;
  const MAX_CATEGORY = 64;

  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MAX_QUERY = 300;
  const MAX_LOCATION = 100;
  const MAX_MISSING = 5;

  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    if (Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function copyOwnSafe(input) {
    if (!isPlainObject(input)) return null;
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

  function normalizeAction(raw) {
    const v = String(raw || "")
      .trim()
      .toLowerCase();
    if (ACTIONS.has(v)) return v;
    return "none";
  }

  function normalizeVertical(raw) {
    if (raw == null || raw === "") return null;
    const v = String(raw).trim().toLowerCase();
    if (VERTICALS.has(v)) return v;
    return null;
  }

  function normalizeSort(raw) {
    const v = String(raw || "")
      .trim()
      .toLowerCase();
    if (v === "rating_desc") return "rating";
    if (v === "nearby" || v === "distance") return "relevance";
    if (SORTS.has(v)) return v;
    return "relevance";
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
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) {
      return null;
    }
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  function normalizeMissing(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const key = item.trim().slice(0, 64);
      if (!key || FORBIDDEN_KEYS.has(key)) continue;
      if (!out.includes(key)) out.push(key);
      if (out.length >= MAX_MISSING) break;
    }
    return out;
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

  function normalizePlatformType(raw) {
    if (raw == null || raw === "") return null;
    const v = String(raw).trim().toLowerCase();
    if (v === "job") return "job";
    if (v === "business_service") return "business_service";
    return null;
  }

  function intentToType(intent) {
    const i = String(intent || "");
    if (i === "job_search") return "job";
    // Phase 3 wave 1: service_request only (not repair/delivery)
    if (i === "service_request") return "business_service";
    return null;
  }

  /**
   * @returns {{ ok: true, value: object } | { ok: false, error: string, value?: object }}
   */
  function validate(input) {
    if (input == null) {
      return { ok: false, error: "invalid_input" };
    }
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return { ok: false, error: "invalid_input_type" };
    }
    if (Array.isArray(input)) {
      return { ok: false, error: "invalid_input_type" };
    }
    const src = copyOwnSafe(input);
    if (!src) {
      return { ok: false, error: "invalid_input_type" };
    }

    let priceMin = normalizePrice(src.priceMin);
    let priceMax = normalizePrice(src.priceMax);
    if (priceMin != null && priceMax != null && priceMin > priceMax) {
      const tmp = priceMin;
      priceMin = priceMax;
      priceMax = tmp;
    }

    let vertical = normalizeVertical(src.vertical);
    let type = normalizePlatformType(src.type);

    if (vertical === "marketplace") {
      type = null;
    }
    if (vertical === "platform") {
      if (type !== "job" && type !== "business_service") {
        if (src.type != null && String(src.type).trim()) {
          vertical = null;
          type = null;
        } else {
          vertical = null;
          type = null;
        }
      }
    }

    const value = {
      action: normalizeAction(src.action),
      vertical,
      type: vertical === "platform" ? type : null,
      query: trimStr(src.query, MAX_QUERY),
      location: (() => {
        const loc = trimStr(src.location, MAX_LOCATION);
        return loc || null;
      })(),
      category:
        vertical === "platform" && type === "business_service"
          ? trimStr(src.category, MAX_CATEGORY) || null
          : null,
      dateFrom: normalizeDate(src.dateFrom),
      dateTo: normalizeDate(src.dateTo),
      priceMin,
      priceMax,
      employmentType: trimStr(src.employmentType, MAX_EMPLOYMENT) || null,
      workStyle: normalizeWorkStyle(src.workStyle),
      sort: normalizeSort(src.sort),
      missingRequiredFields: normalizeMissing(src.missingRequiredFields),
    };

    if (value.type !== "job") {
      value.employmentType = null;
      value.workStyle = null;
    }
    if (value.type !== "business_service") {
      value.category = null;
    }

    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      const a = value.dateFrom;
      value.dateFrom = value.dateTo;
      value.dateTo = a;
    }

    return { ok: true, value };
  }

  function intentToVertical(intent) {
    const i = String(intent || "");
    if (i === "product_search" || i === "shop_search") return "marketplace";
    if (
      i === "service_request" ||
      i === "worker_request" ||
      i === "skill_request" ||
      i === "job_search" ||
      i === "delivery_request" ||
      i === "repair_request"
    ) {
      return "platform";
    }
    return null;
  }

  function intentToAction(intent, hints) {
    const i = String(intent || "");
    if (i === "none" || i === "unknown" || !i) return "none";
    if (i === "site_navigation" || i === "listing_support") return "none";
    if (hints?.compareMode || /compare/i.test(String(hints?.mode || ""))) return "compare";
    if (hints?.historyLookup) return "history_lookup";
    return "search";
  }

  /**
   * 自然文 + intent から Schema 入力候補を組み立て、validate する。
   */
  function fromUserText(userText, options) {
    const opts = options && typeof options === "object" ? options : {};
    const text = trimStr(userText, MAX_QUERY);
    const intent = String(opts.intent || "").trim();
    const hints = opts.hints && typeof opts.hints === "object" ? opts.hints : {};

    const parsed =
      global.TasuAiWorkspaceSearchIntent?.parseWorkspaceSearchQuery?.(text) || null;

    const keyword = trimStr(parsed?.keyword || text, MAX_QUERY);
    const location =
      trimStr(parsed?.prefecture || parsed?.area || hints.location || "", MAX_LOCATION) ||
      null;

    let priceMin = normalizePrice(opts.priceMin ?? hints.priceMin ?? parsed?.priceMin);
    let priceMax = normalizePrice(opts.priceMax ?? hints.priceMax ?? parsed?.priceMax);
    if (priceMax == null && parsed?.priceRange) {
      const yen = String(parsed.priceRange).match(/(\d[\d,]*)\s*円/);
      const man = String(parsed.priceRange).match(/(\d+)\s*万/);
      if (yen) priceMax = normalizePrice(yen[1].replace(/,/g, ""));
      else if (man) priceMax = normalizePrice(Number(man[1]) * 10000);
    }
    if (/以下|まで|以内/.test(text) && priceMin != null && priceMax == null) {
      priceMax = priceMin;
      priceMin = null;
    }

    const vertical =
      normalizeVertical(opts.vertical) ||
      intentToVertical(intent) ||
      (parsed?.type === "product" ? "marketplace" : null);

    const type =
      normalizePlatformType(opts.type) ||
      intentToType(intent) ||
      (intent === "job_search" ? "job" : null) ||
      (intent === "service_request" ? "business_service" : null);

    const action = intentToAction(intent, {
      ...hints,
      compareMode: hints.compareMode || parsed?.compareMode,
    });

    let employmentType =
      trimStr(opts.employmentType || hints.employmentType || "", MAX_EMPLOYMENT) || null;
    let workStyle = normalizeWorkStyle(opts.workStyle || hints.workStyle || null);
    if (!employmentType && text) {
      if (/正社員/.test(text)) employmentType = "正社員";
      else if (/アルバイト|バイト/.test(text)) employmentType = "アルバイト";
      else if (/パート/.test(text)) employmentType = "パート";
      else if (/業務委託|フリーランス/.test(text)) employmentType = "業務委託";
      else if (/派遣/.test(text)) employmentType = "派遣";
      else if (/契約社員|契約/.test(text)) employmentType = "契約";
    }
    if (!workStyle && text) {
      if (/リモート|在宅|テレワーク/.test(text)) workStyle = "remote";
      else if (/ハイブリッド/.test(text)) workStyle = "hybrid";
      else if (/出社|オフィス/.test(text)) workStyle = "onsite";
    }

    const category =
      trimStr(opts.category || hints.category || parsed?.category || "", MAX_CATEGORY) || null;

    const missingRequiredFields = [];
    if (action === "search" && vertical === "marketplace") {
      const stripped = keyword
        .replace(/商品|買いたい|購入|探して|教えて|ほしい|欲しい|ある\?|ない\?/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (stripped.length < 2) {
        missingRequiredFields.push("query");
      }
    }

    return validate({
      action,
      vertical,
      type: type || null,
      query: keyword,
      location,
      category,
      dateFrom: opts.dateFrom ?? hints.dateFrom ?? null,
      dateTo: opts.dateTo ?? hints.dateTo ?? null,
      priceMin,
      priceMax,
      employmentType: type === "job" ? employmentType : null,
      workStyle: type === "job" ? workStyle : null,
      sort: parsed?.sort || opts.sort || "relevance",
      missingRequiredFields,
    });
  }

  function emptyResult() {
    return validate({
      action: "none",
      vertical: null,
      type: null,
      query: "",
      location: null,
      category: null,
      dateFrom: null,
      dateTo: null,
      priceMin: null,
      priceMax: null,
      employmentType: null,
      workStyle: null,
      sort: "relevance",
      missingRequiredFields: [],
    });
  }

  global.TasuAiTasfulSearchSchema = {
    ACTIONS: Array.from(ACTIONS),
    VERTICALS: Array.from(VERTICALS),
    SORTS: Array.from(SORTS),
    PLATFORM_TYPES: Array.from(PLATFORM_TYPES),
    MAX_QUERY,
    validate,
    fromUserText,
    emptyResult,
    normalizeAction,
    normalizeVertical,
    normalizeSort,
    normalizePrice,
    normalizeDate,
    intentToVertical,
    intentToType,
  };
})(typeof window !== "undefined" ? window : globalThis);
