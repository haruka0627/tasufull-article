/**
 * Builder AI — 条件検索 P0（SearchFilter · query builder · cache key · SearchAssist adapter）
 * DB 実行 · LLM · Gateway 接続なし — Repository 渡し用 query object のみ生成。
 */
(function (global) {
  "use strict";

  const API_VERSION = "v1";
  const API_READY = false;

  /** @typedef {"worker"|"partner"|"job"} SearchTarget */

  const SEARCH_TARGETS = Object.freeze(["worker", "partner", "job"]);

  const TARGET_ALIASES = Object.freeze({
    worker: "worker",
    workers: "worker",
    partner: "partner",
    partners: "partner",
    company: "partner",
    companies: "partner",
    job: "job",
    jobs: "job",
  });

  const SORT_WHITELIST = Object.freeze([
    "newest",
    "rate_desc",
    "rate_asc",
    "rating",
    "available_first",
  ]);

  const DEFAULT_SORT = "newest";
  const DEFAULT_LIMIT = 20;
  const MAX_LIMIT = 100;
  const MAX_OFFSET = 10000;
  const MAX_RADIUS_KM = 500;

  const SORT_COLUMN_MAP = Object.freeze({
    worker: Object.freeze({
      newest: [{ column: "created_at", direction: "desc" }],
      rate_desc: [{ column: "rate_yen", direction: "desc" }],
      rate_asc: [{ column: "rate_yen", direction: "asc" }],
      rating: [{ column: "rating", direction: "desc" }, { column: "created_at", direction: "desc" }],
      available_first: [
        { column: "availability_rank", direction: "asc" },
        { column: "created_at", direction: "desc" },
      ],
    }),
    partner: Object.freeze({
      newest: [{ column: "created_at", direction: "desc" }],
      rate_desc: [{ column: "budget_yen", direction: "desc" }],
      rate_asc: [{ column: "budget_yen", direction: "asc" }],
      rating: [{ column: "rating", direction: "desc" }, { column: "created_at", direction: "desc" }],
      available_first: [
        { column: "availability_rank", direction: "asc" },
        { column: "created_at", direction: "desc" },
      ],
    }),
    job: Object.freeze({
      newest: [{ column: "created_at", direction: "desc" }],
      rate_desc: [{ column: "budget_yen", direction: "desc" }],
      rate_asc: [{ column: "budget_yen", direction: "asc" }],
      rating: [{ column: "rating", direction: "desc" }, { column: "created_at", direction: "desc" }],
      available_first: [
        { column: "start_date", direction: "asc" },
        { column: "created_at", direction: "desc" },
      ],
    }),
  });

  const TARGET_ALLOWED_FIELDS = Object.freeze({
    worker: Object.freeze([
      "target",
      "keyword",
      "categories",
      "trades",
      "area",
      "priceRange",
      "availability",
      "qualifications",
      "verified",
      "ratingMin",
      "excludeNg",
      "sort",
      "limit",
      "offset",
    ]),
    partner: Object.freeze([
      "target",
      "keyword",
      "categories",
      "trades",
      "area",
      "priceRange",
      "availability",
      "qualifications",
      "insurance",
      "invoiceSupported",
      "verified",
      "ratingMin",
      "excludeNg",
      "sort",
      "limit",
      "offset",
    ]),
    job: Object.freeze([
      "target",
      "keyword",
      "categories",
      "trades",
      "area",
      "priceRange",
      "availability",
      "qualifications",
      "ratingMin",
      "excludeNg",
      "sort",
      "limit",
      "offset",
    ]),
  });

  /** @returns {import('./builder-ai-search-assist.js')|null} */
  function SearchAssist() {
    return global.TasuBuilderAISearchAssist || null;
  }

  function isPlainObject(v) {
    return v != null && typeof v === "object" && !Array.isArray(v);
  }

  function normalizeTarget(raw) {
    const key = String(raw || "worker").trim().toLowerCase();
    return TARGET_ALIASES[key] || (SEARCH_TARGETS.includes(key) ? key : "worker");
  }

  function toStringArray(raw) {
    if (raw == null || raw === "") return [];
    const list = Array.isArray(raw) ? raw : [raw];
    const out = [];
    list.forEach((item) => {
      String(item)
        .split(/[,、/／|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          if (!out.includes(s)) out.push(s);
        });
    });
    out.sort((a, b) => a.localeCompare(b, "ja"));
    return out;
  }

  function parseYen(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
    const t = String(raw).replace(/[,，]/g, "").trim();
    const man = t.match(/([\d.]+)\s*万/);
    if (man) return Math.round(Number(man[1]) * 10000);
    const num = t.match(/(\d+)/);
    return num ? Number(num[1]) : null;
  }

  function normalizePriceRange(raw) {
    if (!isPlainObject(raw)) return null;
    let min = parseYen(raw.min);
    let max = parseYen(raw.max);
    if (min == null && max == null) return null;
    if (min != null && max != null && min > max) {
      const tmp = min;
      min = max;
      max = tmp;
    }
    const out = {};
    if (min != null) out.min = min;
    if (max != null) out.max = max;
    return Object.keys(out).length ? out : null;
  }

  function parsePrefectureCity(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    const m = text.match(/^(.+?[都道府県])(.*)$/);
    if (m) {
      const city = m[2].trim() || null;
      return { prefecture: m[1].trim(), city, radiusKm: null };
    }
    return { prefecture: text, city: null, radiusKm: null };
  }

  function normalizeArea(raw) {
    if (raw == null || raw === "") return null;
    if (isPlainObject(raw)) {
      const prefecture = raw.prefecture != null ? String(raw.prefecture).trim() : "";
      const city = raw.city != null ? String(raw.city).trim() : "";
      let radiusKm = raw.radiusKm != null ? Number(raw.radiusKm) : null;
      if (radiusKm != null && (!Number.isFinite(radiusKm) || radiusKm <= 0)) radiusKm = null;
      if (radiusKm != null && radiusKm > MAX_RADIUS_KM) radiusKm = MAX_RADIUS_KM;
      if (!prefecture && !city && radiusKm == null) return null;
      const out = {};
      if (prefecture) out.prefecture = prefecture;
      if (city) out.city = city;
      if (radiusKm != null) out.radiusKm = radiusKm;
      return out;
    }
    return parsePrefectureCity(raw);
  }

  function parseBooleanFlag(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "boolean") return raw;
    const t = String(raw).trim();
    if (/^(1|true|yes|y|ok)$/i.test(t)) return true;
    if (/^(0|false|no|n)$/i.test(t)) return false;
    if (/^(済|あり|有|加入|登録済|確認済)$/i.test(t)) return true;
    if (/^(未|なし|無|未登録|未加入)$/i.test(t)) return false;
    if (/済|あり|有|加入|登録済|確認済/i.test(t) && !/未|なし|無/i.test(t)) return true;
    if (/未|なし|無|未登録|未加入/i.test(t)) return false;
    return null;
  }

  function parseRatingMin(raw) {
    if (raw == null || raw === "") return null;
    const n = Number(String(raw).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 5) return null;
    return Math.round(n * 10) / 10;
  }

  function pickAllowedFields(target, obj) {
    const allowed = new Set(TARGET_ALLOWED_FIELDS[target] || TARGET_ALLOWED_FIELDS.worker);
    /** @type {Record<string, unknown>} */
    const out = {};
    allowed.forEach((key) => {
      if (obj[key] !== undefined) out[key] = obj[key];
    });
    return out;
  }

  /**
   * @param {Record<string, unknown>} [filter]
   * @returns {Record<string, unknown>}
   */
  function normalizeSearchFilter(filter) {
    const src = isPlainObject(filter) ? filter : {};
    const target = normalizeTarget(src.target);

    const categories = toStringArray(src.categories);
    const trades = toStringArray(src.trades);
    const qualifications = toStringArray(src.qualifications);

    const keyword = src.keyword != null ? String(src.keyword).trim() : "";
    const availability = src.availability != null ? String(src.availability).trim() : "";
    const sortRaw = src.sort != null ? String(src.sort).trim() : DEFAULT_SORT;
    const sort = SORT_WHITELIST.includes(sortRaw) ? sortRaw : DEFAULT_SORT;

    let limit = src.limit != null ? Number(src.limit) : DEFAULT_LIMIT;
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    limit = Math.floor(limit);

    let offset = src.offset != null ? Number(src.offset) : 0;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    if (offset > MAX_OFFSET) offset = MAX_OFFSET;
    offset = Math.floor(offset);

    const area = normalizeArea(src.area);
    const priceRange = normalizePriceRange(src.priceRange);
    const ratingMin = parseRatingMin(src.ratingMin);
    const verified = parseBooleanFlag(src.verified);
    const insurance = parseBooleanFlag(src.insurance);
    const invoiceSupported = parseBooleanFlag(src.invoiceSupported);
    const excludeNg = src.excludeNg === false ? false : true;

    /** @type {Record<string, unknown>} */
    const draft = { target, sort, limit, offset, excludeNg };
    if (keyword) draft.keyword = keyword;
    if (categories.length) draft.categories = categories;
    if (trades.length) draft.trades = trades;
    if (area) draft.area = area;
    if (priceRange) draft.priceRange = priceRange;
    if (availability) draft.availability = availability;
    if (qualifications.length) draft.qualifications = qualifications;
    if (ratingMin != null) draft.ratingMin = ratingMin;
    if (verified != null) draft.verified = verified;
    if (insurance != null) draft.insurance = insurance;
    if (invoiceSupported != null) draft.invoiceSupported = invoiceSupported;

    return pickAllowedFields(target, draft);
  }

  function stableSerialize(value) {
    if (value === null) return "null";
    const t = typeof value;
    if (t === "number" || t === "boolean") return JSON.stringify(value);
    if (t === "string") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((v) => stableSerialize(v)).join(",")}]`;
    }
    if (t === "object") {
      const keys = Object.keys(value).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(String(value));
  }

  /**
   * @param {Record<string, unknown>} [filter]
   * @returns {string}
   */
  function createSearchCacheKey(filter) {
    const normalized = normalizeSearchFilter(filter);
    return `builder-search:${API_VERSION}:${stableSerialize(normalized)}`;
  }

  function pushWhere(where, clause) {
    if (clause && clause.column && clause.op) where.push(clause);
  }

  function priceColumnForTarget(target) {
    return target === "job" ? "budget_yen" : target === "partner" ? "budget_yen" : "rate_yen";
  }

  /**
   * @param {Record<string, unknown>} [filter]
   * @returns {{ target: SearchTarget, where: object[], order: object[], limit: number, offset: number }}
   */
  function buildSearchQuery(filter) {
    const normalized = normalizeSearchFilter(filter);
    const target = /** @type {SearchTarget} */ (normalized.target);
    /** @type {object[]} */
    const where = [];

    if (normalized.keyword) {
      pushWhere(where, { column: "keyword", op: "ilike", value: `%${normalized.keyword}%` });
    }

    if (Array.isArray(normalized.categories) && normalized.categories.length) {
      pushWhere(where, { column: "categories", op: "overlap", value: normalized.categories });
    }

    if (Array.isArray(normalized.trades) && normalized.trades.length) {
      pushWhere(where, { column: "trades", op: "overlap", value: normalized.trades });
    }

    if (isPlainObject(normalized.area)) {
      if (normalized.area.prefecture) {
        pushWhere(where, {
          column: "area_prefecture",
          op: "ilike",
          value: `%${normalized.area.prefecture}%`,
        });
      }
      if (normalized.area.city) {
        pushWhere(where, { column: "area_city", op: "ilike", value: `%${normalized.area.city}%` });
      }
      if (normalized.area.radiusKm != null) {
        pushWhere(where, {
          column: "geo_radius_km",
          op: "lte",
          value: normalized.area.radiusKm,
        });
      }
    }

    if (isPlainObject(normalized.priceRange)) {
      const col = priceColumnForTarget(target);
      if (normalized.priceRange.min != null) {
        pushWhere(where, { column: col, op: "gte", value: normalized.priceRange.min });
      }
      if (normalized.priceRange.max != null) {
        pushWhere(where, { column: col, op: "lte", value: normalized.priceRange.max });
      }
    }

    if (normalized.availability) {
      pushWhere(where, {
        column: "availability",
        op: "ilike",
        value: `%${normalized.availability}%`,
      });
    }

    if (Array.isArray(normalized.qualifications) && normalized.qualifications.length) {
      pushWhere(where, {
        column: "qualifications",
        op: "overlap",
        value: normalized.qualifications,
      });
    }

    if (normalized.ratingMin != null) {
      pushWhere(where, { column: "rating", op: "gte", value: normalized.ratingMin });
    }

    if (normalized.verified === true) {
      pushWhere(where, { column: "verified", op: "eq", value: true });
    } else if (normalized.verified === false) {
      pushWhere(where, { column: "verified", op: "eq", value: false });
    }

    if (normalized.insurance === true) {
      pushWhere(where, { column: "insurance", op: "eq", value: true });
    } else if (normalized.insurance === false) {
      pushWhere(where, { column: "insurance", op: "eq", value: false });
    }

    if (normalized.invoiceSupported === true) {
      pushWhere(where, { column: "invoice_supported", op: "eq", value: true });
    } else if (normalized.invoiceSupported === false) {
      pushWhere(where, { column: "invoice_supported", op: "eq", value: false });
    }

    if (normalized.excludeNg !== false) {
      pushWhere(where, { column: "ng_flag", op: "eq", value: false });
    }

    const sort = String(normalized.sort || DEFAULT_SORT);
    const order = SORT_COLUMN_MAP[target]?.[sort] || SORT_COLUMN_MAP[target].newest;

    return {
      target,
      where,
      order: order.map((o) => ({ ...o })),
      limit: /** @type {number} */ (normalized.limit),
      offset: /** @type {number} */ (normalized.offset),
    };
  }

  /**
   * SearchAssist の extractFields 結果 → SearchFilter
   * @param {SearchTarget|string} target
   * @param {Record<string, string>} parsed
   * @returns {Record<string, unknown>}
   */
  function searchAssistParsedToFilter(target, parsed) {
    const t = normalizeTarget(target);
    const p = isPlainObject(parsed) ? parsed : {};

    /** @type {Record<string, unknown>} */
    const filter = { target: t };

    const keyword = p.name || p.company || p.tradeName || "";
    if (keyword) filter.keyword = String(keyword).trim();

    if (p.category) filter.categories = toStringArray(p.category);

    if (p.area) filter.area = parsePrefectureCity(p.area);

    if (p.license) filter.qualifications = toStringArray(p.license);

    if (p.availability) filter.availability = String(p.availability).trim();

    const rateYen = parseYen(p.rate || p.budget);
    if (rateYen != null) filter.priceRange = { max: rateYen };

    const ratingMin = parseRatingMin(p.rating);
    if (ratingMin != null) filter.ratingMin = ratingMin;

    const verified = parseBooleanFlag(p.verified);
    if (verified != null) filter.verified = verified;

    const insurance = parseBooleanFlag(p.insurance);
    if (insurance != null) filter.insurance = insurance;

    const invoiceSupported = parseBooleanFlag(p.invoiceReg);
    if (invoiceSupported != null) filter.invoiceSupported = invoiceSupported;

    if (/NG|ng|除外/.test(String(p.ng || ""))) {
      filter.excludeNg = true;
    }

    return normalizeSearchFilter(filter);
  }

  /**
   * @param {string} actionId worker_search_assist | partner_search_assist
   * @param {string} userText
   * @param {{ contextText?: string, sort?: string, limit?: number, offset?: number }} [opts]
   */
  function adaptSearchAssist(actionId, userText, opts) {
    const assist = SearchAssist();
    const kind = actionId === "partner_search_assist" ? "partner" : "worker";
    const fields = kind === "worker" ? assist?.WORKER_FIELDS : assist?.PARTNER_FIELDS;
    const parsed = fields && assist?.extractFields
      ? assist.extractFields(userText, fields)
      : {};

    /** @type {Record<string, unknown>} */
    const merged = searchAssistParsedToFilter(kind, parsed);
    if (opts?.sort) merged.sort = opts.sort;
    if (opts?.limit != null) merged.limit = opts.limit;
    if (opts?.offset != null) merged.offset = opts.offset;

    const filter = normalizeSearchFilter(merged);
    const query = buildSearchQuery(filter);

    return {
      ok: true,
      apiReady: API_READY,
      target: filter.target,
      parsed,
      filter,
      query,
      cacheKey: createSearchCacheKey(filter),
    };
  }

  /**
   * @param {SearchTarget|string} target
   * @param {string} userText
   * @param {{ sort?: string, limit?: number, offset?: number }} [opts]
   */
  function adaptSearchAssistText(target, userText, opts) {
    const t = normalizeTarget(target);
    const assist = SearchAssist();
    let parsed = {};

    if (t === "worker" && assist?.WORKER_FIELDS && assist.extractFields) {
      parsed = assist.extractFields(userText, assist.WORKER_FIELDS);
    } else if (t === "partner" && assist?.PARTNER_FIELDS && assist.extractFields) {
      parsed = assist.extractFields(userText, assist.PARTNER_FIELDS);
    } else if (t === "job") {
      parsed = extractJobFieldsFromText(userText);
    }

    /** @type {Record<string, unknown>} */
    const merged = searchAssistParsedToFilter(t, parsed);
    if (opts?.sort) merged.sort = opts.sort;
    if (opts?.limit != null) merged.limit = opts.limit;
    if (opts?.offset != null) merged.offset = opts.offset;

    const filter = normalizeSearchFilter(merged);
    return {
      ok: true,
      apiReady: API_READY,
      target: filter.target,
      parsed,
      filter,
      query: buildSearchQuery(filter),
      cacheKey: createSearchCacheKey(filter),
    };
  }

  function extractJobFieldsFromText(text) {
    const t = String(text || "");
    /** @type {Record<string, string>} */
    const out = {};
    const patterns = [
      { key: "category", re: /(?:カテゴリ|工種|作業)[:：\s]*([^\n,、]+)/i },
      { key: "area", re: /(?:エリア|地域|施工(?:場所|エリア))[:：\s]*([^\n,、]+)/i },
      { key: "budget", re: /(?:予算|単価|金額)[:：\s]*([^\n,、]+)/i },
      { key: "availability", re: /(?:工期|納期|開始)[:：\s]*([^\n,、]+)/i },
      { key: "license", re: /(?:資格|要件)[:：\s]*([^\n,、]+)/i },
    ];
    patterns.forEach(({ key, re }) => {
      const m = t.match(re);
      if (m?.[1]) out[key] = m[1].trim();
    });
    return out;
  }

  global.TasuBuilderConditionalSearch = {
    API_VERSION,
    API_READY,
    SEARCH_TARGETS,
    SORT_WHITELIST,
    DEFAULT_SORT,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    normalizeTarget,
    normalizeSearchFilter,
    buildSearchQuery,
    createSearchCacheKey,
    searchAssistParsedToFilter,
    adaptSearchAssist,
    adaptSearchAssistText,
    stableSerialize,
  };
})(typeof window !== "undefined" ? window : globalThis);
