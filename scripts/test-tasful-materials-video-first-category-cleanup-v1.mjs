#!/usr/bin/env node
/**
 * TASFUL Materials Video-First Category Cleanup V1 — contract test
 *   node scripts/test-tasful-materials-video-first-category-cleanup-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { TYPE_FILTER_LAYOUT } from "./lib/materials-list-genre-filter-contract.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(root, "reports", "tasful-materials-video-first-category-cleanup-v1");
const results = [];

const EXPECTED_CHIPS = Object.freeze([
  { id: "", label: "すべて" },
  { id: "bgm", label: "BGM" },
  { id: "sfx", label: "効果音/SFX" },
  { id: "image", label: "写真" },
  { id: "illustration", label: "イラスト" },
  { id: "background", label: "背景" },
  { id: "icon", label: "アイコン" },
  { id: "overlay", label: "オーバーレイ" },
  { id: "frame", label: "フレーム・装飾" },
  { id: "telop", label: "テロップ素材" },
  { id: "transition", label: "トランジション" },
]);

const LEGACY_QUERY_IDS = Object.freeze(["template", "web", "code", "text", "tool", "presentation"]);
const EMPTY_VIDEO_FIRST = Object.freeze(["overlay", "frame", "telop", "transition"]);
const OLD_PRIMARY = Object.freeze([
  "sfx",
  "bgm",
  "image",
  "illustration",
  "background",
  "web",
  "code",
  "template",
  "icon",
  "presentation",
  "document",
  "tool",
]);

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

function loadMaterialsData(indexItems) {
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    document: { body: { getAttribute: () => "" }, readyState: "complete" },
    location: { search: "", href: "http://127.0.0.1:8788/materials/list.html" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.TASFUL_MATERIALS_INDEX = {
    version: 1,
    items: indexItems,
  };
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(root, "materials", "materials-data.js"), "utf8");
  vm.runInContext(src, sandbox, { filename: "materials-data.js" });
  const listSrc = fs.readFileSync(path.join(root, "materials", "materials-list-page.js"), "utf8");
  vm.runInContext(listSrc, sandbox, { filename: "materials-list-page.js" });
  return sandbox;
}

const index = JSON.parse(
  fs.readFileSync(path.join(root, "materials", "generated", "materials-index.json"), "utf8")
);
const items = Array.isArray(index.items) ? index.items : [];
const sandbox = loadMaterialsData(items);
const Data = sandbox.TasuMaterialsData;
const List = sandbox.TasuMaterialsListPage;

assert("SSOT loaded", Boolean(Data && List), "TasuMaterialsData + TasuMaterialsListPage");

const chips = Data.LIST_CATEGORY_CHIPS || [];
assert(
  "primary chip count",
  chips.length === EXPECTED_CHIPS.length,
  `${chips.length} === ${EXPECTED_CHIPS.length}`
);
assert(
  "primary chip order + labels",
  JSON.stringify(chips.map((c) => [c.id, c.label])) ===
    JSON.stringify(EXPECTED_CHIPS.map((c) => [c.id, c.label]))
);

for (const legacy of LEGACY_QUERY_IDS) {
  assert(
    `legacy hidden from primary chips: ${legacy}`,
    !chips.some((c) => c.id === legacy)
  );
  assert(`legacy URL still valid: ${legacy}`, List.normalizeCategory(legacy) === legacy);
}

for (const id of EMPTY_VIDEO_FIRST) {
  assert(`video-first URL valid: ${id}`, List.normalizeCategory(id) === id);
  assert(`classic mount keeps ${id}`, List.isClassicListCategory(id) === true);
}

assert("unknown category clears", List.normalizeCategory("not-a-cat") === "");
assert("image chip label is 写真", chips.find((c) => c.id === "image")?.label === "写真");
assert(
  "image CATEGORIES.name stays 画像素材",
  Data.CATEGORIES.find((c) => c.id === "image")?.name === "画像素材"
);
assert("image label map only", Data.LIST_UI_LABELS.image === "写真");

const counts = Data.countPublishedInventoryByCategory();
for (const id of EMPTY_VIDEO_FIRST) {
  assert(`empty inventory ${id} is 0`, Number(counts[id] || 0) === 0, String(counts[id] || 0));
}

const indexCats = {};
let transparentHits = 0;
for (const item of items) {
  const id = item.category_id || "(none)";
  indexCats[id] = (indexCats[id] || 0) + 1;
  const t = item.meta_transparent || item.image_transparent || item.transparent || item.has_alpha;
  if (t != null && String(t).trim() !== "") transparentHits += 1;
}
assert("no index reclassify: image still present", (indexCats.image || 0) === 260, String(indexCats.image || 0));
assert("no overlay assets invented", !indexCats.overlay);
assert("no frame assets invented", !indexCats.frame);
assert("no telop assets invented", !indexCats.telop);
assert("no transition assets invented", !indexCats.transition);
assert("透過 metadata absent on public index", transparentHits === 0, String(transparentHits));

const listHtml = fs.readFileSync(path.join(root, "materials", "list.html"), "utf8");
assert("canonical route list.html", listHtml.includes('data-page="materials_list"'));
assert("list.html has no 透過 filter", !listHtml.includes("透過"));
assert("list.html classic keeps カラー", listHtml.includes('data-materials-all-filter="color"'));
assert("list.html classic keeps 形式", listHtml.includes('data-materials-all-filter="format"'));
for (const chip of EXPECTED_CHIPS) {
  const attr = `data-category="${chip.id}"`;
  const labeled = listHtml.includes(`${attr}>${chip.label}<`) ||
    listHtml.includes(`${attr} aria-current="true">${chip.label}<`);
  assert(`list.html static chip ${chip.label}`, labeled, attr);
}
for (const legacy of ["template", "web", "code", "text", "tool", "presentation"]) {
  assert(
    `list.html primary markup hides ${legacy}`,
    !listHtml.includes(`data-materials-list-chip data-category="${legacy}"`)
  );
}

const presJs = fs.readFileSync(path.join(root, "materials", "materials-presentation-list.js"), "utf8");
assert("presentation UI removed スライド種類", !presJs.includes("スライド種類"));
assert("presentation UI removed 業種 select", !presJs.includes('renderFilterSelect("industry"'));
assert("presentation keeps カラー", presJs.includes('renderFilterSelect("color", "カラー"'));
assert("presentation keeps 形式", presJs.includes('renderFilterSelect("format", "形式"'));

assert(
  "presentation filter layout dropped presentation-only axes",
  JSON.stringify(TYPE_FILTER_LAYOUT.presentation) ===
    JSON.stringify(["ジャンル", "デザイン", "カラー", "形式"])
);

const sidebar = Data.LIST_SIDEBAR_CATEGORIES || [];
assert(
  "sidebar is video-first primary only",
  sidebar.map((c) => c.id).join(",") === Data.LIST_PRIMARY_CATEGORY_IDS.join(","),
  sidebar.map((c) => c.id).join(",")
);
assert(
  "sidebar hides legacy",
  !sidebar.some((c) => Data.LIST_LEGACY_CATEGORY_IDS.includes(c.id))
);
assert("sidebar image label 写真", sidebar.find((c) => c.id === "image")?.label === "写真");

const oldStillInCategories = OLD_PRIMARY.every((id) => Data.CATEGORIES.some((c) => c.id === id));
assert("CATEGORIES keeps old primary ids", oldStillInCategories);
const topCats = await Data.repository.fetchCategories();
assert(
  "TOP fetchCategories excludes empty video-first ids",
  EMPTY_VIDEO_FIRST.every((id) => !topCats.some((c) => c.id === id))
);

const wranglerExists = fs.existsSync(path.join(root, "wrangler.toml"));
const wranglerToml = wranglerExists ? fs.readFileSync(path.join(root, "wrangler.toml"), "utf8") : "";
const cfignore = fs.existsSync(path.join(root, ".cfignore"))
  ? fs.readFileSync(path.join(root, ".cfignore"), "utf8")
  : "";
assert("wrangler.toml present", wranglerExists);
assert(
  "pages_build_output_dir is staged dist",
  /pages_build_output_dir\s*=\s*"deploy\/cloudflare\/dist"/.test(wranglerToml)
);
assert(".cfignore excludes reports/", cfignore.includes("reports/"));
assert(".cfignore excludes **/*.zip", cfignore.includes("**/*.zip"));

const noAuthTouch = [
  "materials/materials-member-access.js",
  "materials/materials-download.js",
].every((rel) => {
  // files still exist; this test does not rewrite them
  return fs.existsSync(path.join(root, rel));
});
assert("download/auth files untouched by this test", noAuthTouch);

fs.mkdirSync(reportDir, { recursive: true });
const summary = {
  ok: results.every((r) => r.ok),
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
  indexCategoryCounts: indexCats,
  chipLabels: chips,
  transparentHits,
  wranglerToml: wranglerExists,
};
fs.writeFileSync(path.join(reportDir, "test-results.json"), JSON.stringify(summary, null, 2));

if (!summary.ok) {
  console.error(`\nFAILED ${summary.failed}/${results.length}`);
  process.exit(1);
}
console.log(`\nOK ${summary.passed}/${results.length}`);
