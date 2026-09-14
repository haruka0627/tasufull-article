#!/usr/bin/env node
/**
 * TASFUL Materials — Legacy Route Navigation Consistency V1
 *   node scripts/test-tasful-materials-legacy-route-nav-consistency-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(root, "reports", "tasful-materials-legacy-route-nav-consistency-v1");
const results = [];

const LEGACY_PRIMARY_LABELS = [
  "テンプレート",
  "Web素材",
  "コード",
  "文例・文章テンプレート",
  "ツール",
  "プレゼン",
];

const EXPECTED_CHIP_IDS = [
  "",
  "bgm",
  "sfx",
  "image",
  "illustration",
  "background",
  "icon",
  "overlay",
  "frame",
  "telop",
  "transition",
];

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

function loadSandbox(indexItems) {
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    URL,
    URLSearchParams,
    document: { body: { getAttribute: () => "" }, readyState: "complete" },
    location: { search: "?category=presentation", href: "http://127.0.0.1:8788/materials/list.html?category=presentation" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.TASFUL_MATERIALS_INDEX = { version: 1, items: indexItems };
  vm.createContext(sandbox);
  const files = [
    "materials-data.js",
    "materials-list-sidebar.js",
    "materials-presentation-list.js",
    "materials-list-page.js",
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, "materials", f), "utf8");
    vm.runInContext(src, sandbox, { filename: f });
  }
  return sandbox;
}

const index = JSON.parse(
  fs.readFileSync(path.join(root, "materials", "generated", "materials-index.json"), "utf8")
);
const items = Array.isArray(index.items) ? index.items : [];
const sandbox = loadSandbox(items);
const Data = sandbox.TasuMaterialsData;
const Sidebar = sandbox.TasuMaterialsListSidebar;
const List = sandbox.TasuMaterialsListPage;

assert("materials modules loaded", Boolean(Data && Sidebar && List));

const chips = Data.LIST_CATEGORY_CHIPS || [];
assert(
  "primary chip ids match video-first SSOT",
  chips.map((c) => c.id).join(",") === EXPECTED_CHIP_IDS.join(",")
);
for (const legacy of LEGACY_PRIMARY_LABELS) {
  assert(`primary chips exclude label: ${legacy}`, !chips.some((c) => c.label === legacy));
}

const sidebar = Data.LIST_SIDEBAR_CATEGORIES || [];
assert(
  "sidebar ids match LIST_PRIMARY_CATEGORY_IDS",
  sidebar.map((c) => c.id).join(",") === Data.LIST_PRIMARY_CATEGORY_IDS.join(",")
);
for (const legacy of LEGACY_PRIMARY_LABELS) {
  assert(`sidebar excludes label: ${legacy}`, !sidebar.some((c) => c.label === legacy));
}

const presJs = fs.readFileSync(path.join(root, "materials", "materials-presentation-list.js"), "utf8");
assert("presentation uses listCategoryChips helper", presJs.includes("function listCategoryChips"));
assert("presentation binds LIST_CATEGORY_CHIPS", presJs.includes("LIST_CATEGORY_CHIPS"));
assert("presentation sidebar uses TasuMaterialsListSidebar", presJs.includes("TasuMaterialsListSidebar?.renderNav"));
for (const legacy of LEGACY_PRIMARY_LABELS) {
  assert(`presentation-list.js has no hardcoded primary chip: ${legacy}`, !presJs.includes(`label: "${legacy}"`));
}

const listPageJs = fs.readFileSync(path.join(root, "materials", "materials-list-page.js"), "utf8");
assert("list-page hides classic for specialty routes", listPageJs.includes("setClassicListMountVisible"));
assert("list-page includes presentation in specialty set", listPageJs.includes('"presentation"'));

const specialtyListFiles = [
  "materials-sfx-list.js",
  "materials-bgm-list.js",
  "materials-image-list.js",
  "materials-illustration-list.js",
  "materials-background-list.js",
  "materials-icon-list.js",
  "materials-web-list.js",
  "materials-code-list.js",
  "materials-document-list.js",
  "materials-presentation-list.js",
  "materials-template-list.js",
];
for (const rel of specialtyListFiles) {
  const src = fs.readFileSync(path.join(root, "materials", rel), "utf8");
  assert(`${rel} uses LIST_CATEGORY_CHIPS`, src.includes("LIST_CATEGORY_CHIPS"));
}

const navHtml = Sidebar.renderNav({ activeId: "presentation" });
for (const legacy of LEGACY_PRIMARY_LABELS) {
  assert(`renderNav HTML excludes ${legacy}`, !navHtml.includes(legacy));
}
assert("renderNav includes オーバーレイ", navHtml.includes("オーバーレイ"));
assert("renderNav includes トランジション", navHtml.includes("トランジション"));

assert("legacy URL presentation still valid", List.normalizeCategory("presentation") === "presentation");
const presItems = await Data.repository.fetchItemsByCategory("presentation");
assert("presentation inventory accessible", presItems.length > 0, String(presItems.length));

const imageJs = fs.readFileSync(path.join(root, "materials", "materials-image-list.js"), "utf8");
assert("image list primary nav label helper", imageJs.includes("primaryNavImageLabel"));
assert("image list active filter not 画像素材", !imageJs.includes('mat-img-chip-active">画像素材'));

const bgJs = fs.readFileSync(path.join(root, "materials", "materials-background-list.js"), "utf8");
assert("background list primary nav label helper", bgJs.includes("primaryNavBackgroundLabel"));

fs.mkdirSync(reportDir, { recursive: true });
const summary = {
  ok: results.every((r) => r.ok),
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
};
fs.writeFileSync(path.join(reportDir, "test-results.json"), JSON.stringify(summary, null, 2));

if (!summary.ok) {
  console.error(`\nFAILED ${summary.failed}/${results.length}`);
  process.exit(1);
}
console.log(`\nOK ${summary.passed}/${results.length}`);
