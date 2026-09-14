#!/usr/bin/env node
/**
 * TASFUL Materials video-first category SSOT + repository + chip wiring
 *
 *   node scripts/test-materials-video-first-categories.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
}

function assert(cond, msg) {
  if (cond) pass(msg);
  else fail(msg);
}

function loadModules(locationSearch = "") {
  const window = {
    location: { search: locationSearch, pathname: "/materials/", hash: "" },
    history: { replaceState(state, _t, url) {
      window.__url = url;
      window.__state = state;
    } },
  };
  const ctx = { window, globalThis: window, console };
  vm.createContext(ctx);
  for (const rel of [
    "materials/materials-categories.js",
    "materials/materials-repository.js",
    "materials/materials-ui.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return window;
}

const PRIMARY_LABELS = [
  "すべて",
  "BGM",
  "効果音/SFX",
  "写真",
  "イラスト",
  "背景",
  "アイコン",
  "オーバーレイ",
  "フレーム・装飾",
  "テロップ素材",
  "トランジション",
];

const HIDDEN = ["テンプレート", "Web素材", "コード", "文例・文章テンプレート", "ツール", "プレゼン"];

console.log("TASFUL Materials video-first category cleanup V1");

const w = loadModules();
const C = w.TasuMaterialsCategories;
const R = w.TasuMaterialsRepository;
const U = w.TasuMaterialsUi;

assert(C && R && U, "SSOT / repository / UI globals exist");

const chipLabels = C.getPrimaryChips().map((c) => c.label);
assert(chipLabels.join("|") === PRIMARY_LABELS.join("|"), `primary order: ${chipLabels.join(" / ")}`);

HIDDEN.forEach((label) => {
  assert(!chipLabels.includes(label), `primary hides ${label}`);
});

assert(C.isLegacyCategory("template"), "template is legacy");
assert(C.isLegacyCategory("テンプレート"), "テンプレート alias → legacy");
assert(C.isLegacyCategory("presentation"), "presentation is legacy");
assert(C.isLegacyCategory("image"), "image stays legacy / URL-compat");
assert(C.resolveCategoryId("画像素材") === "image", "画像素材 does not become photo");
assert(C.remapImageToPhoto().remapped === false, "no speculative image→photo remap");
assert(C.resolveCategoryId("透過素材") === "all", "透過素材 is not a category");
assert(C.shouldShowTransparencyFilter() === false, "transparency filter DEFERRED");
assert(C.isFindingOnly("サムネイル"), "thumbnail is finding-only");
assert(!C.isPrimaryChip("thumbnail"), "thumbnail is not a primary chip");

assert(C.shouldShowPresentationFilters("presentation") === true, "presentation filters on when category=presentation");
assert(C.shouldShowPresentationFilters("photo") === false, "presentation filters off for 写真");
assert(
  C.getVisibleFilters("photo").every((f) => f.kind !== "presentation_only") &&
    C.getVisibleFilters("photo").some((f) => f.id === "color") &&
    C.getVisibleFilters("photo").some((f) => f.id === "format"),
  "写真 keeps カラー/形式 only"
);
assert(
  C.getVisibleFilters("presentation").every((f) => f.kind === "presentation_only"),
  "プレゼン shows presentation-only filters"
);
assert(
  C.getVisibleFilters("bgm").length === 0,
  "BGM has no presentation or image-only filters"
);

const empty = R.search({ category: "overlay" }, []);
assert(empty.total === 0 && empty.empty === true, "empty overlay = real 0, no fake count");
assert(R.search({ category: "photo" }, []).counts.photo === 0, "empty photo count is 0");

const catalog = [
  { id: "a", title: "Piano loop", category: "bgm" },
  { id: "b", title: "Impact hit", category: "sfx", tags: ["impact"] },
  { id: "c", title: "River still", category: "image", tags: ["自然"] },
  { id: "d", title: "Deck", category: "presentation", slide_size: "16:9" },
  { id: "e", title: "Thumb A", category: "thumbnail" },
  { id: "f", title: "Thumb B", category: "thumbnail", purpose: "sns" },
  { id: "g", title: "Web hero", category: "web" },
];

assert(R.search({ category: "bgm" }, catalog).total === 1, "chip filter uses repository");
assert(R.search({ q: "impact" }, catalog).items[0]?.id === "b", "keyword search kept");
assert(R.search({ category: "template" }, catalog).total === 0, "legacy template URL still filters (empty here)");
assert(R.search({ category: "web" }, catalog).items[0]?.id === "g", "legacy web URL-compat");
assert(R.search({ category: "image" }, catalog).items[0]?.id === "c", "legacy image stays image, not photo");
assert(R.search({ category: "photo" }, catalog).total === 0, "写真 does not swallow image");
assert(R.search({ category: "presentation", slide_size: "16:9" }, catalog).total === 1, "presentation filter works on presentation");
assert(R.getFindingItems(catalog).map((x) => x.id).join(",") === "e", "Finding thumbnail only when no 用途 tags");

const html = fs.readFileSync(path.join(root, "materials/index.html"), "utf8");
assert(html.includes("data-materials-chips"), "index hosts chips");
assert(html.includes("data-materials-empty"), "index has real empty state");
assert(!html.includes("data-materials-chip=\"template\""), "index does not hardcode legacy chips");

const wrangler = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");
assert(wrangler.includes('pages_build_output_dir = "deploy/cloudflare/dist"'), "wrangler pages_build_output_dir kept");

const uiHost = {
  querySelector(sel) {
    return this[sel] || null;
  },
};
const chipHost = { innerHTML: "" };
const filterHost = { hidden: true, innerHTML: "" };
uiHost["[data-materials-chips]"] = chipHost;
uiHost["[data-materials-filters]"] = filterHost;
U.renderChips(chipHost, { category: "all" });
assert(
  PRIMARY_LABELS.every((label) => chipHost.innerHTML.includes(label)) &&
    HIDDEN.every((label) => !chipHost.innerHTML.includes(label)),
  "rendered chips match primary set only"
);
U.renderFilters(filterHost, { category: "illustration" });
assert(filterHost.innerHTML.includes("カラー") && filterHost.innerHTML.includes("形式") && !filterHost.innerHTML.includes("スライドサイズ"), "illustration filters = color/format");
U.renderFilters(filterHost, { category: "bgm" });
assert(filterHost.hidden === true && filterHost.innerHTML === "", "bgm hides extra filters");
U.renderFilters(filterHost, { category: "presentation" });
assert(filterHost.innerHTML.includes("スライドサイズ") && filterHost.innerHTML.includes("テーマ"), "legacy presentation URL still shows presentation filters");

if (failures.length) {
  console.error(`\nFAIL ${failures.length}\n${failures.map((m) => `- ${m}`).join("\n")}`);
  process.exit(1);
}
console.log("\nPASS");
