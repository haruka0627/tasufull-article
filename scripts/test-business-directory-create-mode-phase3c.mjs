#!/usr/bin/env node
/**
 * Business Directory Phase 3c — AI page preview + apply static checks
 *   node scripts/test-business-directory-create-mode-phase3c.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadModule(rel, sandboxExtra) {
  const sandbox = {
    window: {},
    globalThis: {},
    document: { querySelector: () => null },
    TasuBusinessDirectoryCommon: {
      escapeHtml: (s) => String(s ?? ""),
      toast: () => {},
      typeLabel: (t) => (t === "shop_retail" ? "店舗・販売" : "業務サービス"),
    },
    TasuBusinessDirectoryCategories: { findById: () => null },
    TasuBusinessDirectoryPlan: { effectivePlanCode: (l) => String(l?.plan_code || "free") },
    ...sandboxExtra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read(rel), sandbox, { filename: rel });
  return sandbox;
}

console.log("=== Business Directory Phase 3c — AI page preview ===\n");

const newHtml = read("business-directory/new.html");
const aiPageJs = read("business-directory/business-directory-ai-page.js");
const ownerJs = read("business-directory/business-directory-owner.js");
const aiDraftJs = read("business-directory/business-directory-ai-draft.js");

mustInclude(newHtml, "data-bd-ai-page-host", "AI page host");
mustInclude(newHtml, "business-directory-ai-page.js", "ai-page script");
mustInclude(newHtml, "business-directory-page-renderer.js", "renderer on new.html");
mustInclude(newHtml, "name=\"faq_items_json\"", "hidden faq store");
mustInclude(newHtml, "data-bd-ai-applied-notice", "applied notice banner");

mustInclude(aiPageJs, "TasuBusinessDirectoryAiPage", "ai-page export");
mustInclude(aiPageJs, "data-bd-ai-page-generate", "generate button");
mustInclude(aiPageJs, "data-bd-ai-page-apply", "apply button");
mustInclude(aiPageJs, 'mode: "ai-preview"', "renderer ai-preview mode");
mustInclude(aiPageJs, "applyDraftToForm", "apply to form");
mustInclude(aiPageJs, "AiDraft.fetchDraft", "uses existing fetchDraft");

mustInclude(ownerJs, "TasuBusinessDirectoryAiPage", "owner wires ai-page");
mustInclude(ownerJs, "aiPageController", "ai page lifecycle");
mustInclude(aiDraftJs, "fetchDraft", "fetchDraft exported");

const rendererSandbox = loadModule("business-directory/business-directory-page-renderer.js");
const aiDraftSandbox = loadModule("business-directory/business-directory-ai-draft.js", {
  TasuBusinessDirectoryAiDraft: undefined,
});
const aiPageSandbox = loadModule("business-directory/business-directory-ai-page.js", {
  TasuBusinessDirectoryPageRenderer: rendererSandbox.TasuBusinessDirectoryPageRenderer,
  TasuBusinessDirectoryAiDraft: aiDraftSandbox.TasuBusinessDirectoryAiDraft,
  TasuBusinessDirectoryOwner: {
    formatRecommendedUsesText: (uses) => (uses || []).join("\n"),
  },
  TasuCommonAiDisclaimer: { mountBanners: () => {} },
});

const AiPage = aiPageSandbox.TasuBusinessDirectoryAiPage;
const draft = {
  short_description: "短文テスト",
  full_description: "詳細テスト",
  seo_title: "SEO",
  meta_description: "meta",
  faq: [{ q: "Q", a: "A" }],
  recommended_uses: ["用途1"],
};
const ctx = {
  listing_type: "shop_retail",
  display_name: "テスト店",
  prefecture: "東京都",
  city: "渋谷区",
  service_areas: "東京都",
  plan_code: "free",
};
const detail = AiPage.buildPreviewDetail(
  {
    querySelector: (sel) => {
      if (sel === '[name="photo"]') return { files: [] };
      return null;
    },
  },
  draft,
  ctx,
);
const freeHtml = rendererSandbox.TasuBusinessDirectoryPageRenderer.renderBusinessDirectoryPage(detail, {
  mode: "ai-preview",
  preview: true,
  planGate: true,
}).html;
if (
  !freeHtml.includes("data-bd-public-full-description") &&
  freeHtml.includes('data-bd-plan-preview-note="full_description"') &&
  freeHtml.includes("data-bd-page-hero")
) {
  ok("Free plan gate in ai-preview with placeholders");
} else bad("Free plan gate in ai-preview with placeholders");

const stdDetail = AiPage.buildPreviewDetail(
  {
    querySelector: () => null,
  },
  draft,
  { ...ctx, plan_code: "standard" },
);
stdDetail.listing.plan_code = "standard";
const stdHtml = rendererSandbox.TasuBusinessDirectoryPageRenderer.renderBusinessDirectoryPage(stdDetail, {
  mode: "ai-preview",
  preview: true,
  planGate: true,
}).html;
if (stdHtml.includes("data-bd-public-full-description") && stdHtml.includes("data-bd-public-faq")) {
  ok("Standard+ rich sections in ai-preview");
} else bad("Standard+ rich sections in ai-preview");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
