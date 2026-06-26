#!/usr/bin/env node
/**
 * Platform Next Phase — 統合テスト
 *   node scripts/test-platform-next-phase.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function loadPlatformStack(extra = {}) {
  const storage = new Map();
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    sessionStorage: {
      getItem: (k) => (storage.has(`s:${k}`) ? storage.get(`s:${k}`) : null),
      setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    },
    location: { origin: "https://example.test", search: "", hash: "", pathname: "/login.html", replace: () => {} },
    navigator: { geolocation: null },
    document: { querySelectorAll: () => [], addEventListener: () => {} },
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts?.detail;
      }
    },
    TasuMemberAuth: { getReturnUrl: () => "dashboard.html", establishSupabaseSession: async () => ({}) },
    TasuSupabase: extra.TasuSupabase || { isConfigured: () => false, getClient: () => null },
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const rel of [
    "search.js",
    "ai-workspace-links.js",
    "platform-ai-recommend.js",
    "platform-badges.js",
    "platform-search-assist.js",
    "platform-compare-assist.js",
    "platform-location-search.js",
    "platform-category-kyc.js",
    "platform-favorites-folders.js",
    "platform-google-auth.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return { sandbox, ctx, storage };
}

// --- Isolation ---
{
  const gw = fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8");
  assert("isolation: gateway untouched", !/platform_search_assist|TasuPlatformSearchAssist/.test(gw));
  assert("isolation: builder ai separate", fs.existsSync(path.join(root, "builder/builder-ai-core.js")));
  assert("isolation: builder ai no platform modules", !fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8").includes("TasuPlatform"));
  assert("isolation: admin secretary untouched", !fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8").includes("TasuPlatform"));
  assert("isolation: tlv entry untouched", !fs.readFileSync(path.join(root, "live/tlv-tasful-ai-entry.js"), "utf8").includes("TasuPlatform"));
}

// --- Google auth ---
{
  const { sandbox } = loadPlatformStack({
    TasuSupabase: {
      isConfigured: () => true,
      getClient: () => ({
        auth: {
          signInWithOAuth: async (opts) => {
            sandbox._oauthOpts = opts;
            return { data: { url: "https://oauth.test" }, error: null };
          },
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      }),
    },
  });
  const Google = sandbox.TasuPlatformGoogleAuth;
  assert("google: redirect includes return", Google.buildRedirectUrl("dashboard.html").includes("return="));
  assert("google: provider google only", Google.PROVIDER === "google");
  const r = await Google.signInWithGoogle({ returnTo: "index-top.html" });
  assert("google: oauth called", r.ok && sandbox._oauthOpts?.provider === "google");
  assert("google: staging origin redirect", String(sandbox._oauthOpts?.options?.redirectTo).includes("example.test"));
}

// --- AI recommend + badges ---
{
  const { sandbox } = loadPlatformStack();
  const listing = {
    title: "外壁塗装",
    review_average: 4.8,
    identity_verified: true,
    area: "埼玉県",
    price: 280000,
    reply_minutes: 30,
    popular: 120,
  };
  const scored = sandbox.TasuPlatformAiRecommend.scoreListing(listing, { area: "埼玉", budgetMax: 300000 });
  assert("recommend: high score", scored.score >= 35);
  assert("recommend: short reasons", scored.reasons.every((r) => r.text.length <= 20));
  const badges = sandbox.TasuPlatformBadges.collectBadges(listing, { area: "埼玉", budgetMax: 300000 });
  assert("badges: max 5", badges.length <= 5);
  assert("badges: ai recommend", badges.some((b) => b.id === "ai-recommend"));
  const html = sandbox.TasuPlatformBadges.renderBadgesHtml(listing, { area: "埼玉" });
  assert("badges: ai label", /AIおすすめ/.test(html));
}

// --- search assist ---
{
  const { sandbox } = loadPlatformStack();
  const r = sandbox.TasuPlatformSearchAssist.run("埼玉 30万円以内 外壁塗装 女性スタッフ 即対応", {
    listings: [
      { id: "a", title: "A塗装", area: "埼玉県", price: 250000, review_average: 4.6, identity_verified: true },
      { id: "b", title: "B塗装", area: "大阪府", price: 200000, review_average: 4.0 },
    ],
  });
  assert("search assist: ok", r.ok);
  assert("search assist: conditions", r.conditions.area && r.conditions.category);
  assert("search assist: tasful ai link", /ai-workspace\.html/.test(r.aiUrl));
  assert("search assist: no contract", /確定/.test(r.body) && /ユーザー/.test(r.body));
}

// --- compare assist ---
{
  const { sandbox } = loadPlatformStack();
  const items = [
    { id: "1", title: "外壁A", area: "埼玉", price: 280000, review_average: 4.7 },
    { id: "2", title: "外壁B", area: "埼玉", price: 320000, review_average: 4.5 },
    { id: "3", title: "外壁C", area: "埼玉", price: 260000, review_average: 4.2 },
  ];
  const r = sandbox.TasuPlatformCompareAssist.run(items);
  assert("compare: ok", r.ok);
  assert("compare: table", /\|/.test(r.body));
  assert("compare: no contract decide", /契約.*決定しません/.test(r.body));
  assert("compare: need two guard", sandbox.TasuPlatformCompareAssist.run([items[0]]).ok === false);
}

// --- popular + suggest ---
{
  const { sandbox } = loadPlatformStack();
  const popular = sandbox.TasuSearch.POPULAR_SEARCH_WORDS;
  assert("popular: 外壁塗装", popular.includes("外壁塗装"));
  assert("popular: エアコン", popular.includes("エアコン"));
  const sug = sandbox.TasuSearch.getSearchSuggestions("動画", [], 8);
  assert("suggest: 動画編集", sug.includes("動画編集"));
  assert("suggest: 動画制作", sug.includes("動画制作"));
}

// --- location ---
{
  const { sandbox } = loadPlatformStack();
  const rows = sandbox.TasuPlatformLocationSearch.filterAndSortByDistance(
    [
      { id: "a", area: "埼玉県", lat: 35.86, lng: 139.65 },
      { id: "b", area: "大阪府", lat: 34.69, lng: 135.52 },
    ],
    { pref: "埼玉", radiusKm: 80 }
  );
  assert("location: nearby first", rows[0]?.listing?.id === "a");
}

// --- favorites folders ---
{
  const { sandbox, storage } = loadPlatformStack();
  sandbox.TasuFavoriteStore = {
    readAll: () => [{ listingId: "x1", listingType: "skill", title: "テスト" }],
    getAllListingIds: () => ["x1"],
  };
  sandbox.TasuPlatformFavoriteFolders.setFolder("x1", "skill", "comparing");
  assert("favorites: folder set", sandbox.TasuPlatformFavoriteFolders.getFolder("x1", "skill") === "comparing");
  assert("favorites: 6 folders", sandbox.TasuPlatformFavoriteFolders.FOLDERS.length === 6);
}

// --- category KYC ---
{
  const { sandbox } = loadPlatformStack();
  const rule = sandbox.TasuPlatformCategoryKyc.getRule("construction");
  assert("kyc: construction on", rule.kycRequired === true);
  const check = sandbox.TasuPlatformCategoryKyc.checkListing({ title: "外壁塗装工事", price: 600000 });
  assert("kyc: warnings", check.warnings.length >= 1);
}

// --- workspace links ---
{
  const { sandbox } = loadPlatformStack();
  const searchUrl = sandbox.TasuAiWorkspaceLinks.buildSearchAssistUrl("外壁塗装");
  const compareUrl = sandbox.TasuAiWorkspaceLinks.buildCompareAssistUrl(["a", "b"], "比較");
  assert("links: search assist", searchUrl.includes("mode=cross-matching") && searchUrl.includes("q="));
  assert("links: compare assist", compareUrl.includes("compare=a%2Cb") || compareUrl.includes("compare=a,b"));
  assert("links: source platform", searchUrl.includes("source=platform"));
}

// --- HTML wiring ---
{
  const top = fs.readFileSync(path.join(root, "index-top.html"), "utf8");
  assert("html: search hub", top.includes("data-platform-search-hub"));
  assert("html: platform scripts", top.includes("platform-search-hub.js"));
  const login = fs.readFileSync(path.join(root, "login.html"), "utf8");
  assert("html: google auth script", login.includes("platform-google-auth.js"));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Platform Next Phase Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
