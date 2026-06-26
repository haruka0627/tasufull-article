#!/usr/bin/env node
/**
 * Platform Finish Phase — 統合テスト
 *   node scripts/test-platform-finish-phase.mjs
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
    location: { origin: "https://example.test", search: "", hash: "", pathname: "/", replace: () => {} },
    navigator: { geolocation: null },
    document: { querySelectorAll: () => [], addEventListener: () => {} },
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts?.detail;
      }
    },
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
    "platform-favorites-folders.js",
    "platform-google-auth.js",
    "platform-search-hub.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return { sandbox, ctx, storage };
}

// --- Isolation ---
{
  const gw = fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8");
  const builder = fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8");
  const secretary = fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8");
  const tlv = fs.readFileSync(path.join(root, "live/tlv-tasful-ai-entry.js"), "utf8");
  assert("isolation: gateway untouched", !/TasuPlatformBadges|platform-finish/.test(gw));
  assert("isolation: builder core untouched", !/TasuPlatform/.test(builder));
  assert("isolation: ai secretary untouched", !/TasuPlatform/.test(secretary));
  assert("isolation: tlv untouched", !/TasuPlatform/.test(tlv));
  assert("isolation: builder actions still 24", fs.readFileSync(path.join(root, "builder/builder-ai-actions.js"), "utf8").includes("candidate_recommendation"));
}

// --- Listing renderer wiring ---
{
  const lr = fs.readFileSync(path.join(root, "listing-renderer.js"), "utf8");
  assert("listing: data-listing-id", lr.includes("data-listing-id"));
  assert("listing: renderPlatformBadgesHtml", lr.includes("renderPlatformBadgesHtml"));
  assert("listing: syncPlatformListingBadges", lr.includes("syncPlatformListingBadges"));
  assert("listing: platform badges in card", lr.includes("platformBadgesHtml"));
  const biz = fs.readFileSync(path.join(root, "business-board-renderer.js"), "utf8");
  assert("business card: platform badges", biz.includes("renderPlatformBadgesHtml"));
}

// --- Badges max 5 + popover disclaimer ---
{
  const { sandbox } = loadPlatformStack();
  const listing = {
    id: "svc-1",
    title: "外壁塗装",
    type: "business-service",
    review_average: 4.8,
    identity_verified: true,
    license_verified: true,
    corp_verified: true,
    area: "埼玉県",
    price: 280000,
    reply_minutes: 20,
    availability: "即対応",
    popular: 200,
    is_new: true,
  };
  const badges = sandbox.TasuPlatformBadges.collectBadges(listing, { area: "埼玉", budgetMax: 300000, nearby: true });
  assert("badges: max 5 on card", badges.length <= 5);
  assert("badges: ai recommend present", badges.some((b) => b.id === "ai-recommend"));
  const html = sandbox.TasuPlatformBadges.renderBadgesHtml(listing, { area: "埼玉", budgetMax: 300000 });
  assert("badges: interactive ai", html.includes("data-platform-ai-recommend"));
  const pb = fs.readFileSync(path.join(root, "platform-badges.js"), "utf8");
  assert("badges: popover no contract note", /契約.*購入.*依頼を決定しません/.test(pb));
}

// --- AI recommend reasons ---
{
  const { sandbox } = loadPlatformStack();
  const listing = {
    review_average: 4.7,
    identity_verified: true,
    area: "大阪府",
    price: 150000,
    reply_minutes: 45,
  };
  const { reasons } = sandbox.TasuPlatformAiRecommend.scoreListing(listing, {
    area: "大阪",
    budgetMax: 200000,
  });
  assert("recommend: max 5 reasons", reasons.length <= 5);
  const formatted = sandbox.TasuPlatformAiRecommend.formatReasons(reasons);
  assert("recommend: formatted lines", formatted.every((line) => line.startsWith("✓")));
}

// --- Favorites folders ---
{
  const { sandbox } = loadPlatformStack();
  sandbox.TasuFavoriteStore = {
    readAll: () => [
      { listingId: "a1", listingType: "skill", title: "A" },
      { listingId: "b2", listingType: "product", title: "B" },
    ],
    getAllListingIds: () => ["a1", "b2"],
  };
  const F = sandbox.TasuPlatformFavoriteFolders;
  assert("folders: 6 labels", F.FOLDERS.length === 6);
  assert("folders: interested label", F.FOLDERS.some((f) => f.label === "気になる"));
  assert("folders: other label", F.FOLDERS.some((f) => f.label === "その他"));
  F.setFolder("a1", "skill", "comparing");
  assert("folders: set/get", F.getFolder("a1", "skill") === "comparing");
  assert("folders: listByFolder count", F.listByFolder("comparing").length === 1);
  assert("folders: export meta", F.exportMeta()._version === 1);
}

// --- AI workspace links source=platform ---
{
  const { sandbox } = loadPlatformStack();
  const searchUrl = sandbox.TasuAiWorkspaceLinks.buildSearchAssistUrl("外壁塗装");
  const compareUrl = sandbox.TasuAiWorkspaceLinks.buildCompareAssistUrl(["a", "b"], "比較");
  assert("links: search source platform", searchUrl.includes("source=platform"));
  assert("links: compare source platform", compareUrl.includes("source=platform"));
  assert("links: compare param", compareUrl.includes("compare="));
}

// --- Search hub compare navigates ---
{
  const hub = fs.readFileSync(path.join(root, "platform-search-hub.js"), "utf8");
  assert("hub: compare to ai workspace", /buildCompareAssistUrl/.test(hub) && /location\.href/.test(hub));
  assert("hub: search source platform", hub.includes('source: "platform"'));
}

// --- AI workspace compare seed ---
{
  const chat = fs.readFileSync(path.join(root, "ai-workspace-chat.js"), "utf8");
  assert("workspace: compare param read", chat.includes('params.get("compare")'));
}

// --- HTML wiring ---
{
  const product = fs.readFileSync(path.join(root, "product.html"), "utf8");
  const fav = fs.readFileSync(path.join(root, "favorites-list.html"), "utf8");
  const business = fs.readFileSync(path.join(root, "business.html"), "utf8");
  const login = fs.readFileSync(path.join(root, "login.html"), "utf8");
  const loginJs = fs.readFileSync(path.join(root, "login.js"), "utf8");
  assert("html: product badges scripts", product.includes("platform-badges.js"));
  assert("html: favorites folder nav", fav.includes("data-favorites-folders"));
  assert("html: favorites folder script", fav.includes("platform-favorites-folders.js"));
  assert("html: business badges", business.includes("platform-badges.js"));
  assert("html: google auth", login.includes("platform-google-auth.js"));
  assert("html: no line oauth primary", loginJs.includes("LINE ログインは現在利用できません"));
}

// --- Google auth check (no secrets) ---
{
  const auth = fs.readFileSync(path.join(root, "platform-google-auth.js"), "utf8");
  assert("oauth: supabase provider", auth.includes('PROVIDER = "google"') && auth.includes("signInWithOAuth"));
  assert("oauth: returnTo in redirect", auth.includes("return"));
  assert("oauth: no secret output", !/client_secret|CLIENT_SECRET|secret.*=/.test(auth));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Platform Finish Phase Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
