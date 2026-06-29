#!/usr/bin/env node
/**
 * Builder AI Conditional Search P0 — normalize / query / cache / SearchAssist adapter
 *   node scripts/test-builder-conditional-search-p0.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;

function ok(label, detail = "") {
  pass += 1;
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label, detail = "") {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assert(label, cond, detail = "") {
  if (cond) ok(label, detail);
  else bad(label, detail);
}

function loadStack() {
  const sandbox = { window: {}, globalThis: {}, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const rel of ["builder/builder-ai-search-assist.js", "builder/builder-conditional-search.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return sandbox;
}

const sb = loadStack();
const CS = sb.TasuBuilderConditionalSearch;

assert("exports present", CS && typeof CS.normalizeSearchFilter === "function");
assert("apiReady false", CS.API_READY === false);

// --- normalize ---
const empty = CS.normalizeSearchFilter({});
assert("normalize: default target worker", empty.target === "worker");
assert("normalize: default sort newest", empty.sort === "newest");
assert("normalize: default limit 20", empty.limit === 20);
assert("normalize: default offset 0", empty.offset === 0);
assert("normalize: excludeNg default true", empty.excludeNg === true);

const partner = CS.normalizeSearchFilter({ target: "companies", sort: "rate_asc", limit: 200 });
assert("normalize: companies alias → partner", partner.target === "partner");
assert("normalize: sort whitelist", partner.sort === "rate_asc");
assert("normalize: limit cap 100", partner.limit === 100);

const job = CS.normalizeSearchFilter({ target: "jobs", insurance: true, invoiceSupported: true, verified: true });
assert("normalize: jobs alias → job", job.target === "job");
assert("normalize: job drops insurance", job.insurance === undefined);
assert("normalize: job drops invoiceSupported", job.invoiceSupported === undefined);
assert("normalize: job drops verified", job.verified === undefined);

const workerStrip = CS.normalizeSearchFilter({
  target: "worker",
  insurance: true,
  invoiceSupported: true,
});
assert("normalize: worker drops insurance", workerStrip.insurance === undefined);
assert("normalize: worker drops invoiceSupported", workerStrip.invoiceSupported === undefined);

const cats = CS.normalizeSearchFilter({ categories: "外壁, 屋根 / 設備" });
assert(
  "normalize: categories split",
  cats.categories.length === 3 &&
    cats.categories.includes("外壁") &&
    cats.categories.includes("屋根") &&
    cats.categories.includes("設備"),
);

const dedupe = CS.normalizeSearchFilter({ categories: ["外壁", "外壁", "屋根"] });
assert("normalize: categories dedupe", dedupe.categories.length === 2);

const badSort = CS.normalizeSearchFilter({ sort: "magic_sort" });
assert("normalize: invalid sort → newest", badSort.sort === "newest");

const rangeSwap = CS.normalizeSearchFilter({ priceRange: { min: 50000, max: 10000 } });
assert("normalize: priceRange swap min/max", rangeSwap.priceRange.min === 10000 && rangeSwap.priceRange.max === 50000);

const areaObj = CS.normalizeSearchFilter({
  area: { prefecture: "埼玉県", city: "さいたま市", radiusKm: 9999 },
});
assert("normalize: area radius cap", areaObj.area.radiusKm === 500);

const verified = CS.normalizeSearchFilter({ target: "partner", verified: "確認済" });
assert("normalize: verified boolean parse", verified.verified === true);

// --- buildSearchQuery ---
const qWorker = CS.buildSearchQuery({
  target: "worker",
  keyword: "田中",
  categories: ["内装"],
  area: { prefecture: "東京都" },
  priceRange: { max: 25000 },
  sort: "rate_asc",
  limit: 10,
});
assert("query: worker target", qWorker.target === "worker");
assert("query: worker keyword where", qWorker.where.some((w) => w.column === "keyword" && w.op === "ilike"));
assert("query: worker rate column", qWorker.where.some((w) => w.column === "rate_yen" && w.op === "lte"));
assert("query: worker order rate_asc", qWorker.order[0].column === "rate_yen" && qWorker.order[0].direction === "asc");
assert("query: worker exclude ng", qWorker.where.some((w) => w.column === "ng_flag" && w.value === false));
assert("query: worker limit", qWorker.limit === 10);

const qPartner = CS.buildSearchQuery({
  target: "partner",
  insurance: true,
  invoiceSupported: true,
  sort: "rating",
});
assert("query: partner insurance eq", qPartner.where.some((w) => w.column === "insurance" && w.value === true));
assert("query: partner invoice eq", qPartner.where.some((w) => w.column === "invoice_supported" && w.value === true));
assert("query: partner rating order", qPartner.order[0].column === "rating");

const qJob = CS.buildSearchQuery({
  target: "job",
  priceRange: { min: 100000 },
  sort: "available_first",
});
assert("query: job budget gte", qJob.where.some((w) => w.column === "budget_yen" && w.op === "gte"));
assert("query: job available_first order", qJob.order[0].column === "start_date");

const qNoNg = CS.buildSearchQuery({ excludeNg: false });
assert("query: excludeNg false skips ng where", !qNoNg.where.some((w) => w.column === "ng_flag"));

// --- cache key ---
const f1 = { target: "worker", categories: ["外壁"], sort: "newest", limit: 20, offset: 0, excludeNg: true };
const f2 = { sort: "newest", limit: 20, offset: 0, excludeNg: true, categories: ["外壁"], target: "worker" };
const k1 = CS.createSearchCacheKey(f1);
const k2 = CS.createSearchCacheKey(f2);
assert("cache: same filter same key", k1 === k2);
assert("cache: key prefix", k1.startsWith("builder-search:v1:"));

const k3 = CS.createSearchCacheKey({ target: "partner", sort: "rate_desc" });
const k4 = CS.createSearchCacheKey({ target: "partner", sort: "rate_asc" });
assert("cache: different sort different key", k3 !== k4);

const k5 = CS.createSearchCacheKey({ categories: ["a", "b"] });
const k6 = CS.createSearchCacheKey({ categories: ["b", "a"] });
assert("cache: category order normalized same key", k5 === k6);

// --- SearchAssist adapter ---
const wAdapt = CS.adaptSearchAssist(
  "worker_search_assist",
  "エリア: 東京都\nカテゴリ: 内装\n単価: 20000\n本人確認: 済",
);
assert("adapter: worker ok", wAdapt.ok === true);
assert("adapter: worker apiReady false", wAdapt.apiReady === false);
assert("adapter: worker parsed area", wAdapt.parsed.area === "東京都");
assert("adapter: worker filter categories", wAdapt.filter.categories?.includes("内装"));
assert("adapter: worker priceRange max", wAdapt.filter.priceRange?.max === 20000);
assert("adapter: worker verified", wAdapt.filter.verified === true);
assert("adapter: worker query target", wAdapt.query.target === "worker");
assert("adapter: worker cacheKey string", typeof wAdapt.cacheKey === "string" && wAdapt.cacheKey.length > 20);

const pAdapt = CS.adaptSearchAssist(
  "partner_search_assist",
  "会社名: テスト工務\nインボイス: あり\n保険: 加入\n評価: 4.5",
);
assert("adapter: partner keyword", pAdapt.filter.keyword === "テスト工務");
assert("adapter: partner invoiceSupported", pAdapt.filter.invoiceSupported === true);
assert("adapter: partner insurance", pAdapt.filter.insurance === true);
assert("adapter: partner ratingMin", pAdapt.filter.ratingMin === 4.5);

const jobAdapt = CS.adaptSearchAssistText("job", "カテゴリ: 外壁、予算: 80万、エリア: 埼玉県");
assert("adapter: job categories", jobAdapt.filter.categories?.includes("外壁"));
assert("adapter: job budget max", jobAdapt.filter.priceRange?.max === 800000);
assert("adapter: job area prefecture", jobAdapt.filter.area?.prefecture === "埼玉県");

const parsedOnly = CS.searchAssistParsedToFilter("partner", {
  category: "総合リフォーム",
  license: "建設業許可",
  ng: "除外",
});
assert("parsedToFilter: qualifications", parsedOnly.qualifications?.includes("建設業許可"));
assert("parsedToFilter: excludeNg default", parsedOnly.excludeNg === true);

// --- stableSerialize ---
assert("stableSerialize deterministic", CS.stableSerialize({ b: 1, a: 2 }) === CS.stableSerialize({ a: 2, b: 1 }));

// --- normalizeTarget ---
assert("normalizeTarget invalid → worker", CS.normalizeTarget("unknown") === "worker");
assert("normalizeTarget workers plural", CS.normalizeTarget("workers") === "worker");

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
