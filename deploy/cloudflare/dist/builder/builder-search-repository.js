/**
 * Builder — 条件検索 Repository（P1 · demo fallback · optional Supabase · memory cache）
 */
(function (global) {
  "use strict";

  const CACHE_TTL_MS = 60_000;

  const CS = () => global.TasuBuilderConditionalSearch;

  /** @type {Map<string, { expires: number, payload: object }>} */
  const memoryCache = new Map();

  const DEMO_FIND_WORKERS = Object.freeze([
    {
      id: "w1",
      name: "山本 電工",
      trade: "電気",
      category: "電気",
      area: "東京都23区",
      area_prefecture: "東京都",
      experience: "10年以上",
      license: "第一種電気工事士",
      qualifications: ["第一種電気工事士"],
      entity: "法人",
      rating: 4.8,
      rate_yen: 22000,
      availability: "応援可能 出張可能",
      availability_rank: 0,
      tags: ["応援可能", "出張可能"],
      verified: true,
      kyc: true,
      ng_flag: false,
      created_at: "2026-06-20T10:00:00+09:00",
    },
    {
      id: "w2",
      name: "佐藤 クロス",
      trade: "クロス",
      category: "クロス",
      area: "神奈川県",
      area_prefecture: "神奈川県",
      experience: "5〜10年",
      license: "壁装技能士",
      qualifications: ["壁装技能士"],
      entity: "個人",
      rating: 4.6,
      rate_yen: 18000,
      availability: "出張可能",
      availability_rank: 0,
      tags: ["出張可能"],
      verified: true,
      kyc: true,
      ng_flag: false,
      created_at: "2026-06-18T10:00:00+09:00",
    },
    {
      id: "w3",
      name: "鈴木 工務",
      trade: "大工",
      category: "大工",
      area: "埼玉県",
      area_prefecture: "埼玉県",
      experience: "3〜5年",
      license: "—",
      qualifications: [],
      entity: "個人",
      rating: 4.5,
      rate_yen: 16000,
      availability: "応援可能",
      availability_rank: 0,
      tags: ["応援可能"],
      verified: false,
      kyc: false,
      ng_flag: false,
      created_at: "2026-06-15T10:00:00+09:00",
    },
    {
      id: "w4",
      name: "田中 塗装",
      trade: "塗装",
      category: "塗装",
      area: "千葉県",
      area_prefecture: "千葉県",
      experience: "10年以上",
      license: "1級塗装技能士",
      qualifications: ["1級塗装技能士"],
      entity: "法人",
      rating: 4.9,
      rate_yen: 24000,
      availability: "夜間対応 出張可能",
      availability_rank: 0,
      tags: ["夜間対応", "出張可能"],
      verified: true,
      kyc: true,
      ng_flag: false,
      created_at: "2026-06-10T10:00:00+09:00",
    },
    {
      id: "w5",
      name: "伊藤 設備",
      trade: "設備",
      category: "設備",
      area: "東京都",
      area_prefecture: "東京都",
      experience: "1〜3年",
      license: "給排水施工管理技士",
      qualifications: ["給排水施工管理技士"],
      entity: "法人",
      rating: 4.3,
      rate_yen: 15000,
      availability: "応援可能 夜間対応",
      availability_rank: 1,
      tags: ["応援可能", "夜間対応"],
      verified: true,
      kyc: true,
      ng_flag: false,
      created_at: "2026-06-08T10:00:00+09:00",
    },
    {
      id: "w6",
      name: "高橋 清掃",
      trade: "クリーニング",
      category: "クリーニング",
      area: "東京都",
      area_prefecture: "東京都",
      experience: "3〜5年",
      license: "—",
      qualifications: [],
      entity: "個人",
      rating: 4.7,
      rate_yen: 14000,
      availability: "出張可能",
      availability_rank: 0,
      tags: ["出張可能"],
      verified: false,
      kyc: false,
      ng_flag: false,
      created_at: "2026-06-05T10:00:00+09:00",
    },
  ]);

  const DEMO_PARTNERS = Object.freeze([
    {
      id: "demo-partner-001",
      partner_id: "demo-partner-001",
      companyName: "株式会社オレンジ建装",
      display_name: "株式会社オレンジ建装",
      category: "内装",
      trades: ["interior", "carpenter"],
      areas: ["tokyo", "kanagawa"],
      area: "東京",
      area_prefecture: "東京",
      license: "建設業許可",
      qualifications: ["建設業許可"],
      availability: "空きあり",
      availability_rank: 0,
      budget_yen: 1200000,
      rate_yen: 1200000,
      rating: 4.8,
      insurance: true,
      invoice_supported: true,
      invoiceReg: true,
      verified: true,
      kyc: true,
      ng_flag: false,
      headline: "店舗内装・原状回復をスピード対応",
      created_at: "2026-06-01T10:00:00+09:00",
    },
    {
      id: "demo-partner-002",
      partner_id: "demo-partner-002",
      companyName: "足場ワークス（個人）",
      display_name: "足場ワークス（個人）",
      category: "足場",
      trades: ["scaffold"],
      areas: ["tokyo", "saitama", "chiba"],
      area: "東京",
      area_prefecture: "東京",
      license: "足場組立",
      qualifications: ["足場組立"],
      availability: "一部可",
      availability_rank: 1,
      budget_yen: 800000,
      rate_yen: 800000,
      rating: 4.6,
      insurance: true,
      invoice_supported: false,
      invoiceReg: false,
      verified: true,
      kyc: true,
      ng_flag: false,
      headline: "安全第一。小規模〜中規模の足場に対応",
      created_at: "2026-05-28T16:00:00+09:00",
    },
    {
      id: "demo-partner-003",
      partner_id: "demo-partner-003",
      companyName: "株式会社スレート設備",
      display_name: "株式会社スレート設備",
      category: "設備",
      trades: ["plumbing", "electric"],
      areas: ["kanagawa", "chiba"],
      area: "神奈川",
      area_prefecture: "神奈川",
      license: "設備工事",
      qualifications: ["設備工事"],
      availability: "満枠",
      availability_rank: 2,
      budget_yen: 950000,
      rate_yen: 950000,
      rating: 4.2,
      insurance: true,
      invoice_supported: true,
      invoiceReg: true,
      verified: false,
      kyc: false,
      ng_flag: false,
      headline: "設備・電気のまとめ依頼歓迎",
      created_at: "2026-05-20T09:00:00+09:00",
    },
  ]);

  const DEMO_JOBS = Object.freeze([
    {
      id: "job-demo-001",
      project_id: "job-demo-001",
      title: "外壁塗装（戸建）",
      keyword: "外壁塗装（戸建）",
      categories: ["project"],
      board_type: "project",
      trades: ["painting"],
      area_prefecture: "埼玉県",
      budget_yen: 850000,
      rate_yen: 850000,
      rating: 4.5,
      availability: "open",
      availability_rank: 0,
      ng_flag: false,
      created_at: "2026-06-22T09:00:00+09:00",
      start_date: "2026-07-01",
    },
    {
      id: "job-demo-002",
      project_id: "job-demo-002",
      title: "内装クロス張替",
      keyword: "内装クロス張替",
      categories: ["project"],
      board_type: "project",
      trades: ["interior"],
      area_prefecture: "東京都",
      budget_yen: 420000,
      rate_yen: 420000,
      rating: 4.2,
      availability: "open",
      availability_rank: 0,
      ng_flag: false,
      created_at: "2026-06-20T09:00:00+09:00",
      start_date: "2026-06-28",
    },
    {
      id: "job-demo-003",
      project_id: "job-demo-003",
      title: "大工応援（夜間可）",
      keyword: "大工応援（夜間可）",
      categories: ["worker"],
      board_type: "worker",
      trades: ["carpenter"],
      area_prefecture: "神奈川県",
      budget_yen: 28000,
      rate_yen: 28000,
      rating: 4.0,
      availability: "open",
      availability_rank: 0,
      ng_flag: false,
      created_at: "2026-06-18T09:00:00+09:00",
      start_date: "2026-06-25",
    },
  ]);

  function getSupabaseClient() {
    try {
      if (global.TasuSupabaseClient?.getClient) return global.TasuSupabaseClient.getClient();
      if (global.TasuSupabase?.getClient) return global.TasuSupabase.getClient();
      return null;
    } catch {
      return null;
    }
  }

  function isSupabaseConfigured() {
    return Boolean(getSupabaseClient());
  }

  function normalizeFilter(filter) {
    const cs = CS();
    if (!cs?.normalizeSearchFilter) return { target: "worker", sort: "newest", limit: 20, offset: 0 };
    return cs.normalizeSearchFilter(filter);
  }

  function buildQuery(filter) {
    const cs = CS();
    if (!cs?.buildSearchQuery) return { target: "worker", where: [], order: [], limit: 20, offset: 0 };
    return cs.buildSearchQuery(filter);
  }

  function cacheKeyFor(filter) {
    const cs = CS();
    return cs?.createSearchCacheKey ? cs.createSearchCacheKey(filter) : JSON.stringify(filter);
  }

  function readCache(key) {
    const hit = memoryCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
      memoryCache.delete(key);
      return null;
    }
    return hit.payload;
  }

  function writeCache(key, payload) {
    memoryCache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
  }

  function clearSearchCache() {
    memoryCache.clear();
  }

  function textHaystack(row) {
    return [
      row.name,
      row.companyName,
      row.display_name,
      row.title,
      row.keyword,
      row.trade,
      row.category,
      row.area,
      row.area_prefecture,
      row.headline,
      row.license,
      ...(row.tags || []),
      ...(row.trades || []),
      ...(row.categories || []),
      ...(row.qualifications || []),
      ...(row.areas || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function rowValue(row, column) {
    const map = {
      keyword: () => textHaystack(row),
      categories: () => row.categories || (row.category ? [row.category] : row.trade ? [row.trade] : []),
      trades: () => row.trades || (row.trade ? [row.trade] : []),
      area_prefecture: () => row.area_prefecture || row.area || "",
      area_city: () => row.area_city || "",
      rate_yen: () => Number(row.rate_yen ?? row.rateYen ?? 0),
      budget_yen: () => Number(row.budget_yen ?? row.budgetYen ?? row.rate_yen ?? 0),
      rating: () => Number(row.rating ?? 0),
      availability: () => String(row.availability || ""),
      availability_rank: () => Number(row.availability_rank ?? 99),
      qualifications: () => row.qualifications || (row.license ? [row.license] : []),
      verified: () => Boolean(row.verified ?? row.kyc),
      insurance: () => Boolean(row.insurance),
      invoice_supported: () => Boolean(row.invoice_supported ?? row.invoiceReg),
      ng_flag: () => Boolean(row.ng_flag ?? row.ng),
      created_at: () => String(row.created_at || ""),
      start_date: () => String(row.start_date || row.created_at || ""),
      geo_radius_km: () => Number(row.geo_radius_km ?? 0),
    };
    return map[column] ? map[column]() : row[column];
  }

  function matchWhere(row, clause) {
    const val = rowValue(row, clause.column);
    const expected = clause.value;

    switch (clause.op) {
      case "ilike": {
        const needle = String(expected || "").replace(/%/g, "").toLowerCase();
        if (!needle) return true;
        return textHaystack(row).includes(needle) || String(val).toLowerCase().includes(needle);
      }
      case "eq":
        return val === expected;
      case "gte":
        return Number(val) >= Number(expected);
      case "lte":
        return Number(val) <= Number(expected);
      case "overlap": {
        const arr = Array.isArray(val) ? val : [val].filter(Boolean);
        const need = Array.isArray(expected) ? expected : [expected];
        const norm = (s) => String(s).toLowerCase();
        return need.some((n) => arr.some((a) => norm(a).includes(norm(n)) || norm(n).includes(norm(a))));
      }
      default:
        return true;
    }
  }

  function applyQuery(rows, query) {
    let out = rows.filter((row) => (query.where || []).every((w) => matchWhere(row, w)));
    out = sortRows(out, query.order || []);
    const offset = Number(query.offset) || 0;
    const limit = Number(query.limit) || 20;
    return out.slice(offset, offset + limit);
  }

  function sortRows(rows, order) {
    const list = rows.slice();
    list.sort((a, b) => {
      for (const o of order) {
        const av = rowValue(a, o.column);
        const bv = rowValue(b, o.column);
        if (av === bv) continue;
        if (typeof av === "number" && typeof bv === "number") {
          return o.direction === "asc" ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv), "ja");
        if (cmp !== 0) return o.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
    return list;
  }

  function applySupabaseWhere(builder, clause) {
    const col = clause.column;
    const val = clause.value;
    switch (clause.op) {
      case "eq":
        return builder.eq(col, val);
      case "gte":
        return builder.gte(col, val);
      case "lte":
        return builder.lte(col, val);
      case "ilike":
        return builder.ilike(col, val);
      case "overlap":
        return builder.overlaps(col, val);
      default:
        return builder;
    }
  }

  async function trySupabaseSearch(target, query) {
    const client = getSupabaseClient();
    if (!client) return null;
    const tableByTarget = {
      worker: "builder_workers",
      partner: "builder_partners",
      job: "builder_jobs",
    };
    const table = tableByTarget[target];
    if (!table) return null;
    try {
      let req = client.from(table).select("*");
      (query.where || []).forEach((w) => {
        req = applySupabaseWhere(req, w);
      });
      (query.order || []).forEach((o) => {
        req = req.order(o.column, { ascending: o.direction === "asc" });
      });
      const from = Number(query.offset) || 0;
      const to = from + (Number(query.limit) || 20) - 1;
      req = req.range(from, to);
      const { data, error } = await req;
      if (error) throw error;
      if (!Array.isArray(data)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function getDemoWorkers() {
    const sample = global.TasuBuilderAICandidateRecommend?.SAMPLE_WORKERS;
    if (!Array.isArray(sample) || !sample.length) return [...DEMO_FIND_WORKERS];
    const mapped = sample.map((w) => ({
      ...w,
      id: w.id,
      name: w.name,
      category: w.category,
      trade: w.category,
      area: w.area,
      area_prefecture: w.area,
      license: w.license,
      qualifications: w.license && w.license !== "なし" ? [w.license] : [],
      rate_yen: w.rateYen,
      rating: w.rating,
      availability: w.availability,
      availability_rank: /対応可能|空き|available/i.test(w.availability) ? 0 : 1,
      verified: w.kyc,
      kyc: w.kyc,
      ng_flag: w.ng,
      created_at: w.created_at || "2026-06-01T00:00:00+09:00",
    }));
    const byId = new Map();
    [...DEMO_FIND_WORKERS, ...mapped].forEach((row) => byId.set(row.id, row));
    return [...byId.values()];
  }

  function getDemoPartners() {
    const fromBuilder = globalThis.__BUILDER_DEMO_PARTNER_NAMES__;
    if (Array.isArray(fromBuilder) && fromBuilder.length) {
      return fromBuilder.map((p) => ({
        id: p.partner_id,
        partner_id: p.partner_id,
        companyName: p.display_name,
        display_name: p.display_name,
        category: (p.trades || [])[0] || "",
        trades: p.trades || [],
        areas: p.areas || [],
        area: (p.areas || [])[0] || "",
        area_prefecture: (p.areas || [])[0] || "",
        availability:
          p.availability === "available" ? "空きあり" : p.availability === "limited" ? "一部可" : "満枠",
        availability_rank: p.availability === "available" ? 0 : p.availability === "limited" ? 1 : 2,
        budget_yen: Number(p.budget_yen) || 0,
        rate_yen: Number(p.budget_yen) || 0,
        rating: Number(p.rating) || 0,
        insurance: Boolean(p.insurance),
        invoice_supported: Boolean(p.invoice_supported ?? p.invoiceReg),
        verified: Boolean(p.verified ?? p.kyc),
        ng_flag: false,
        headline: p.headline || "",
        created_at: p.updated_at || p.created_at || "",
      }));
    }
    return [...DEMO_PARTNERS];
  }

  function getDemoJobs() {
    return [...DEMO_JOBS];
  }

  /**
   * @param {Record<string, unknown>} filter
   * @param {{ sourceRows?: object[], target?: string }} [opts]
   */
  async function executeSearch(filter, opts = {}) {
    const normalized = normalizeFilter(filter);
    const target = opts.target || normalized.target || "worker";
    const query = buildQuery(normalized);
    const cacheKey = cacheKeyFor(normalized);
    const cached = readCache(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }

    let items = null;
    let source = "demo";
    let fallback = true;
    const apiReady = isSupabaseConfigured();

    if (apiReady) {
      items = await trySupabaseSearch(target, query);
      if (items) {
        source = "supabase";
        fallback = false;
      }
    }

    if (!items) {
      const pool =
        opts.sourceRows ||
        (target === "worker"
          ? getDemoWorkers()
          : target === "partner"
            ? getDemoPartners()
            : getDemoJobs());
      items = applyQuery(pool, query);
      source = "demo";
      fallback = true;
    }

    const payload = {
      ok: true,
      items,
      total: items.length,
      filter: normalized,
      query,
      cacheKey,
      cacheHit: false,
      fallback,
      apiReady,
      source,
    };
    writeCache(cacheKey, payload);
    return payload;
  }

  async function searchWorkers(filter) {
    return executeSearch({ ...filter, target: "worker" }, { target: "worker" });
  }

  async function searchPartners(filter) {
    return executeSearch({ ...filter, target: "partner" }, { target: "partner" });
  }

  /**
   * @param {Record<string, unknown>} filter
   * @param {{ sourceRows?: object[] }} [opts]
   */
  async function searchJobs(filter, opts) {
    return executeSearch({ ...filter, target: "job" }, { target: "job", sourceRows: opts?.sourceRows });
  }

  /**
   * candidate-recommend 連携
   * @param {"worker"|"partner"} kind
   * @param {Record<string, string>} requirements
   */
  async function fetchCandidates(kind, requirements) {
    const ui = global.TasuBuilderSearchUiAdapter;
    const filter = ui?.filterFromRequirements
      ? ui.filterFromRequirements(kind, requirements || {})
      : normalizeFilter({ target: kind === "partner" ? "partner" : "worker", sort: "rating" });

    const fn = kind === "partner" ? searchPartners : searchWorkers;
    const res = await fn({ ...filter, sort: filter.sort || "rating", limit: 10 });
    return res.items || [];
  }

  /**
   * 同期フィルタ（board-projects 等）
   */
  function filterSourceRows(rows, filter, target) {
    const normalized = normalizeFilter({ ...filter, target });
    const query = buildQuery(normalized);
    const cacheKey = cacheKeyFor(normalized);
    const cached = readCache(cacheKey);
    if (cached) return { ...cached, cacheHit: true };
    const items = applyQuery(rows, query);
    const payload = {
      ok: true,
      items,
      total: items.length,
      filter: normalized,
      query,
      cacheKey,
      cacheHit: false,
      fallback: true,
      apiReady: isSupabaseConfigured(),
      source: "demo",
    };
    writeCache(cacheKey, payload);
    return payload;
  }

  global.TasuBuilderSearchRepository = {
    CACHE_TTL_MS,
    searchWorkers,
    searchPartners,
    searchJobs,
    fetchCandidates,
    filterSourceRows,
    executeSearch,
    clearSearchCache,
    getDemoWorkers,
    getDemoPartners,
    getDemoJobs,
    applyQuery,
    buildQuery,
    isSupabaseConfigured,
  };
})(typeof window !== "undefined" ? window : globalThis);
