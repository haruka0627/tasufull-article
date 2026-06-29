#!/usr/bin/env node
/**
 * Builder AI Conditional Search P1 — repository · UI adapter · fetchCandidates · cache
 *   node scripts/test-builder-conditional-search-p1.mjs
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

function loadStack(extra = {}) {
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const rel of [
    "builder/builder-ai-search-assist.js",
    "builder/builder-conditional-search.js",
    "builder/builder-search-ui-adapter.js",
    "builder/builder-ai-candidate-recommend.js",
    "builder/builder-search-repository.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return sandbox;
}

const sb = loadStack();
const Repo = sb.TasuBuilderSearchRepository;
const UI = sb.TasuBuilderSearchUiAdapter;
const CS = sb.TasuBuilderConditionalSearch;
const Rec = sb.TasuBuilderAICandidateRecommend;

assert("repository exports", Repo && typeof Repo.searchWorkers === "function");
assert("ui adapter exports", UI && typeof UI.filterFromFindWorkersForm === "function");

// --- fallback / apiReady ---
Repo.clearSearchCache();
const w0 = await Repo.searchWorkers({ sort: "newest" });
assert("searchWorkers fallback", w0.ok && w0.fallback === true);
assert("searchWorkers apiReady false without client", w0.apiReady === false);
assert("searchWorkers demo source", w0.source === "demo");
assert("searchWorkers returns items", Array.isArray(w0.items) && w0.items.length >= 6);

// --- query filter worker trade ---
const wPaint = await Repo.searchWorkers({ trades: ["塗装"], sort: "newest" });
assert("worker trade filter", wPaint.items.every((r) => /塗装/.test(String(r.trade || r.category))));

const wArea = await Repo.searchWorkers({ area: { prefecture: "埼玉" } });
assert("worker area filter", wArea.items.some((r) => /埼玉/.test(String(r.area))));

// --- partners ---
const pAll = await Repo.searchPartners({ sort: "newest" });
assert("searchPartners items", pAll.items.length >= 3);

const pTrade = await Repo.searchPartners({ trades: ["scaffold"] });
assert("partner trade scaffold", pTrade.items.some((r) => (r.trades || []).includes("scaffold")));

const pAvail = await Repo.searchPartners({ availability: "空きあり" });
assert("partner availability", pAvail.items.every((r) => /空き/.test(String(r.availability))));

// --- jobs ---
const jAll = await Repo.searchJobs({ sort: "newest" });
assert("searchJobs demo", jAll.items.length >= 3);

const jProject = await Repo.searchJobs({ categories: ["project"] });
assert("searchJobs project tab", jProject.items.every((r) => r.board_type === "project"));

// --- UI adapters ---
const fwFilter = UI.filterFromPartnerQuery({ q: "オレンジ", trade: "interior", area: "tokyo" });
assert("ui partner query keyword", fwFilter.keyword === "オレンジ");
assert("ui partner query trade", fwFilter.trades?.includes("interior"));

const tabFilter = UI.filterFromBoardTab("worker");
assert("ui board tab worker", tabFilter.categories?.includes("worker"));

const boardRow = UI.mapBoardProjectRow(
  { project_id: "p1", title: "テスト案件", created_at: "2026-06-01" },
  { area: { label: "東京都" }, budget: { amount: 500000 }, trade_tags: ["interior"] },
);
assert("ui mapBoardProjectRow id", boardRow.project_id === "p1");
assert("ui mapBoardProjectRow budget", boardRow.budget_yen === 500000);

// --- filterSourceRows (board sync) ---
const mapped = jAll.items.slice();
const sync = Repo.filterSourceRows(mapped, { categories: ["project"] }, "job");
assert("filterSourceRows sync", sync.items.every((r) => r.board_type === "project"));

// --- cache ---
Repo.clearSearchCache();
const c1 = await Repo.searchWorkers({ trades: ["電気"], sort: "newest" });
assert("cache miss first", c1.cacheHit === false);
const c2 = await Repo.searchWorkers({ trades: ["電気"], sort: "newest" });
assert("cache hit second", c2.cacheHit === true);
assert("cache same key", c1.cacheKey === c2.cacheKey);
assert("cache same items length", c1.items.length === c2.items.length);

// --- cache key uses CS ---
assert("cache key prefix", c1.cacheKey.startsWith("builder-search:v1:"));

// --- fetchCandidates integration ---
Repo.clearSearchCache();
const fc = await Rec.fetchCandidates("worker", { category: "内装", area: "東京都" });
assert("fetchCandidates returns array", Array.isArray(fc) && fc.length > 0);
assert("fetchCandidates worker shape", fc[0].name || fc[0].category);

const fcPartner = await Rec.fetchCandidates("partner", { category: "総合リフォーム", area: "神奈川県" });
assert("fetchCandidates partner", Array.isArray(fcPartner) && fcPartner.length > 0);

// --- supabase mock error fallback ---
const sbSb = loadStack({
  TasuSupabaseClient: {
    getClient() {
      return {
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            gte() {
              return this;
            },
            lte() {
              return this;
            },
            ilike() {
              return this;
            },
            overlaps() {
              return this;
            },
            order() {
              return this;
            },
            range() {
              return Promise.resolve({ data: null, error: { message: "table missing" } });
            },
          };
        },
      };
    },
  },
});
sbSb.TasuBuilderSearchRepository.clearSearchCache();
const sbRes = await sbSb.TasuBuilderSearchRepository.searchWorkers({ sort: "newest" });
assert("supabase error fallback", sbRes.fallback === true && sbRes.items.length > 0);
assert("supabase configured apiReady", sbRes.apiReady === true);

// --- applyQuery mapping ---
const query = CS.buildSearchQuery({ target: "worker", keyword: "塗装", sort: "rate_desc", limit: 5 });
const applied = Repo.applyQuery(Repo.getDemoWorkers(), query);
assert("applyQuery keyword 塗装", applied.some((r) => /塗装/.test(r.name)));
assert("applyQuery limit", applied.length <= 5);

// --- buildQuery in repository ---
const built = Repo.buildQuery({ target: "partner", insurance: true });
assert("buildQuery partner insurance where", built.where.some((w) => w.column === "insurance"));

// --- normalize unchanged from P0 ---
const norm = CS.normalizeSearchFilter({ target: "companies", limit: 999 });
assert("P0 normalize still works", norm.target === "partner" && norm.limit === 100);

// --- find workers form adapter ---
const formMock = {
  querySelector(sel) {
    const map = {
      "[data-builder-fw-trade]": { value: "painting" },
      "[data-builder-fw-area]": { value: "千葉" },
      "[data-builder-fw-license]": { value: "" },
      "[data-builder-fw-support]": { checked: false },
      "[data-builder-fw-travel]": { checked: true },
      "[data-builder-fw-night]": { checked: false },
    };
    return map[sel] || { value: "", checked: false };
  },
};
const fw = UI.filterFromFindWorkersForm(formMock);
assert("findWorkers form trade", fw.trades?.includes("塗装"));
assert("findWorkers form area", fw.area?.prefecture === "千葉" || fw.area === "千葉" || fw.area?.prefecture?.includes("千葉"));

// --- error tolerance executeSearch ---
Repo.clearSearchCache();
const errRes = await Repo.executeSearch({ target: "worker", keyword: "___none___" });
assert("empty search ok", errRes.ok === true && Array.isArray(errRes.items));

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
