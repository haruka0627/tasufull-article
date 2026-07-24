#!/usr/bin/env node
/**
 * Business Directory Phase 3f — AI preview Free plan placeholders
 *   node scripts/test-business-directory-page-renderer-phase3f.mjs
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

function loadRenderer() {
  const sandbox = {
    window: {},
    globalThis: {},
    TasuBusinessDirectoryCommon: {
      typeLabel: (t) => (t === "shop_retail" ? "店舗・販売" : "業務サービス"),
      hpModePublicLabel: () => "TASFULページを使う",
    },
    TasuBusinessDirectoryCategories: { findById: () => ({ name: "テスト" }) },
    TasuBusinessDirectoryPlan: {
      effectivePlanCode: (l) => String(l?.plan_code || "free").toLowerCase(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("business-directory/business-directory-page-renderer.js"), sandbox, {
    filename: "business-directory-page-renderer.js",
  });
  return sandbox.TasuBusinessDirectoryPageRenderer;
}

console.log("=== Business Directory Phase 3f — AI preview plan placeholders ===\n");

const rendererJs = read("business-directory/business-directory-page-renderer.js");
const pubCss = read("business-directory/public/business-directory-public.css");

mustInclude(rendererJs, "renderAiPreviewPlanPlaceholders", "placeholder renderer");
mustInclude(rendererJs, 'mode === "ai-preview"', "ai-preview branch");
mustInclude(rendererJs, "bd-plan-preview-note", "placeholder class");
mustInclude(rendererJs, "Standard 以上で公開されます", "placeholder copy");
mustInclude(pubCss, "bd-plan-preview-note", "placeholder css");

const R = loadRenderer();
const richDetail = {
  listing: {
    listing_type: "shop_retail",
    plan_code: "free",
    category_id: "x",
    display_name: "テスト店",
    service_areas: ["東京都"],
    hp_mode: "full_page",
  },
  profile: {
    company_name: "テスト店",
    prefecture: "東京都",
    city: "渋谷区",
    address_line1: "1-1",
    short_description: "短文",
    full_description: "詳細",
    faq_items: [{ q: "Q", a: "A" }],
    recommended_uses: ["用途1"],
    shop_sales_genre: "食品",
  },
  photos: [],
  business_hours: [],
};

const freeAi = R.renderBusinessDirectoryPage(richDetail, {
  mode: "ai-preview",
  preview: true,
  planGate: true,
}).html;

if (
  !freeAi.includes("data-bd-public-full-description") &&
  freeAi.includes('data-bd-plan-preview-note="full_description"') &&
  freeAi.includes('data-bd-plan-preview-note="faq"') &&
  freeAi.includes('data-bd-plan-preview-note="recommended_uses"')
) {
  ok("Free ai-preview shows rich placeholders");
} else bad("Free ai-preview shows rich placeholders");

const stdAi = R.renderBusinessDirectoryPage(
  {
    ...richDetail,
    listing: { ...richDetail.listing, plan_code: "standard" },
  },
  { mode: "ai-preview", preview: true, planGate: true },
).html;

if (
  stdAi.includes("data-bd-public-full-description") &&
  stdAi.includes("data-bd-public-faq") &&
  !stdAi.includes("data-bd-plan-preview-note")
) {
  ok("Standard ai-preview shows rich content without placeholders");
} else bad("Standard ai-preview rich content");

const freePublic = R.renderBusinessDirectoryPage(richDetail, {
  mode: "public",
  planGate: true,
}).html;
if (!freePublic.includes("data-bd-plan-preview-note") && !freePublic.includes("data-bd-public-full-description")) {
  ok("public Free unchanged (no placeholders, no rich)");
} else bad("public Free unchanged");

const freeOwner = R.renderBusinessDirectoryPage(richDetail, {
  mode: "owner-preview",
  preview: true,
  planGate: true,
}).html;
if (!freeOwner.includes("data-bd-plan-preview-note") && !freeOwner.includes("data-bd-public-full-description")) {
  ok("owner-preview Free unchanged");
} else bad("owner-preview Free unchanged");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
