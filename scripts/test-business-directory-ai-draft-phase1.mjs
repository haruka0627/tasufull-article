#!/usr/bin/env node
/**
 * Business Directory AI draft Phase 1a — static checks
 *   node scripts/test-business-directory-ai-draft-phase1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const BD = "business-directory";
let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

console.log("=== Business Directory AI Draft Phase 1a ===\n");

const files = [
  `${BD}/business-directory-ai-draft.js`,
  `${BD}/new.html`,
  `${BD}/edit.html`,
  `${BD}/business-directory-owner.js`,
  `${BD}/business-directory.css`,
];

for (const rel of files) {
  if (fs.existsSync(path.join(root, rel))) ok(`${rel} exists`);
  else bad(`${rel} exists`);
}

const aiJs = read(`${BD}/business-directory-ai-draft.js`);
const newHtml = read(`${BD}/new.html`);
const editHtml = read(`${BD}/edit.html`);
const ownerJs = read(`${BD}/business-directory-owner.js`);
const css = read(`${BD}/business-directory.css`);

mustInclude(aiJs, "TasuBusinessDirectoryAiDraft", "ai-draft global export");
mustInclude(aiJs, "generateMockDraft", "mock generator");
mustInclude(aiJs, "short_description", "short_description in draft");
mustInclude(aiJs, "seo_title", "seo preview field");
mustInclude(aiJs, "meta_description", "meta preview field");
mustInclude(aiJs, "recommended_uses", "recommended uses preview");
mustInclude(aiJs, "data-bd-ai-apply-short", "apply button hook");
if (!aiJs.includes("Phase 2 で保存予定")) ok("no future-save label (Phase 2a)");
else bad("future-save label removed");

mustInclude(newHtml, "data-bd-ai-draft-host", "new ai draft host");
mustInclude(newHtml, "business-directory-ai-draft.js", "new loads ai-draft js");
mustInclude(newHtml, "common-ai-disclaimer", "new loads disclaimer");

mustInclude(editHtml, "data-bd-ai-draft-host", "edit ai draft host");
mustInclude(editHtml, "business-directory-ai-draft.js", "edit loads ai-draft js");

mustInclude(ownerJs, "mountAiDraftPanel", "owner mounts ai draft");
mustInclude(ownerJs, "_bdAiDraft", "owner syncs lock with ai draft");

mustInclude(css, ".bd-ai-draft", "ai draft styles");

try {
  const vm = await import("node:vm");
  const modPath = path.join(root, BD, "business-directory-ai-draft.js");
  const code = fs.readFileSync(modPath, "utf8");
  const sandbox = {
    window: {},
    document: { querySelector: () => null },
    TasuBusinessDirectoryCommon: { escapeHtml: (s) => String(s) },
    TasuBusinessDirectoryCategories: null,
    TasuCommonAiDisclaimer: null,
    navigator: {},
    setTimeout: (fn) => fn(),
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  const api = sandbox.window.TasuBusinessDirectoryAiDraft;
  if (!api?.generateMockDraft) bad("mock API callable");
  else {
    const draft = api.generateMockDraft({
      listing_type: "shop_retail",
      display_name: "テスト商店",
      category_name: "小売",
      prefecture: "東京都",
      city: "渋谷区",
      service_areas: "東京都",
      shop_sales_genre: "地元野菜",
    });
    if (draft?.short_description && draft.short_description.includes("テスト商店")) {
      ok("mock draft includes display name");
    } else bad("mock draft includes display name");
    if (Array.isArray(draft.faq) && draft.faq.length >= 2) ok("mock faq array");
    else bad("mock faq array");
    if (Array.isArray(draft.recommended_uses) && draft.recommended_uses.length >= 2) {
      ok("mock recommended uses");
    } else bad("mock recommended uses");
  }
} catch (err) {
  bad("mock API callable", err.message);
}

console.log(`\n=== ${pass} passed · ${fail} failed ===`);
process.exit(fail ? 1 : 0);
