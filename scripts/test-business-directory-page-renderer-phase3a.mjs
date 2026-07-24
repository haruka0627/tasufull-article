#!/usr/bin/env node
/**
 * Business Directory Phase 3a — shared page renderer static + logic checks
 *   node scripts/test-business-directory-page-renderer-phase3a.mjs
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
      hpModePublicLabel: (m) => (m === "external_redirect" ? "公式サイトへ送客" : "TASFULページを使う"),
    },
    TasuBusinessDirectoryCategories: {
      findById: (id) => {
        const map = {
          "a1000001-0001-4000-8000-000000000001": { name: "飲食・食品" },
          "b2000002-0002-4000-8000-000000000001": { name: "建設・リフォーム" },
        };
        return map[id] || null;
      },
    },
    TasuBusinessDirectoryPlan: {
      effectivePlanCode: (l) => String(l?.plan_code || "free").toLowerCase(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const code = read("business-directory/business-directory-page-renderer.js");
  vm.runInNewContext(code, sandbox, { filename: "business-directory-page-renderer.js" });
  return sandbox.TasuBusinessDirectoryPageRenderer;
}

console.log("=== Business Directory Phase 3a — shared page renderer ===\n");

const rendererJs = read("business-directory/business-directory-page-renderer.js");
const pubJs = read("business-directory/public/business-directory-public.js");
const ownerJs = read("business-directory/business-directory-owner.js");
const detailHtml = read("business-directory/public/detail.html");
const editHtml = read("business-directory/edit.html");
const pubCss = read("business-directory/public/business-directory-public.css");

mustInclude(rendererJs, "renderBusinessDirectoryPage", "renderer exports renderBusinessDirectoryPage");
mustInclude(rendererJs, "data-bd-public-full-description", "renderer full_description hook");
mustInclude(rendererJs, "data-bd-public-faq", "renderer faq hook");
mustInclude(rendererJs, "data-bd-public-recommended-uses", "renderer recommended uses hook");
mustInclude(rendererJs, "bd-public-hero--text", "text hero markup");
mustInclude(rendererJs, "data-bd-page-hero", "hero data hook");
mustInclude(rendererJs, "external_redirect", "redirect branch");
mustInclude(rendererJs, "planGate", "planGate option");

mustInclude(pubJs, "TasuBusinessDirectoryPageRenderer", "public.js delegates to renderer");
mustInclude(pubJs, "renderBusinessDirectoryPage", "public renderDetail uses renderer");
mustInclude(ownerJs, "TasuBusinessDirectoryPageRenderer", "owner preview uses renderer");
mustInclude(ownerJs, "bd-preview--shared", "owner shared preview wrapper");

mustInclude(detailHtml, "business-directory-page-renderer.js", "detail.html loads renderer");
mustInclude(editHtml, "business-directory-page-renderer.js", "edit.html loads renderer");
mustInclude(editHtml, "business-directory-public.css", "edit.html loads public css for preview");

mustInclude(pubCss, ".bd-public-hero--text", "text hero css");

const R = loadRenderer();
if (!R?.renderBusinessDirectoryPage) {
  bad("renderer loads in vm");
} else {
  ok("renderer loads in vm");

  const standardDetail = {
    listing: {
      listing_type: "shop_retail",
      plan_code: "standard",
      category_id: "a1000001-0001-4000-8000-000000000001",
      display_name: "田中商店",
      service_areas: ["東京都"],
      hp_mode: "full_page",
      website_url: "https://example.com",
    },
    profile: {
      company_name: "田中商店",
      contact_email: "a@example.com",
      prefecture: "東京都",
      city: "渋谷区",
      address_line1: "1-2-3",
      short_description: "短文",
      full_description: "詳細本文",
      faq_items: [{ q: "Q1", a: "A1" }],
      recommended_uses: ["用途1"],
      shop_sales_genre: "食品",
    },
    photos: [{ url: "https://example.com/photo.jpg" }],
    business_hours: [{ label: "平日", value: "10:00-18:00" }],
  };

  const standardHtml = R.renderBusinessDirectoryPage(standardDetail, {
    mode: "public",
    planGate: true,
  }).html;

  const sectionOrder = [
    "data-bd-page-hero",
    "bd-public-lead",
    "data-bd-public-full-description",
    "data-bd-public-recommended-uses",
    "data-bd-public-faq",
    "基本情報",
    "問い合わせ",
  ];
  let lastIdx = -1;
  let orderOk = true;
  for (const token of sectionOrder) {
    const idx = standardHtml.indexOf(token);
    if (idx < 0 || idx < lastIdx) {
      orderOk = false;
      break;
    }
    lastIdx = idx;
  }
  if (orderOk) ok("Standard+ section order");
  else bad("Standard+ section order");

  if (standardHtml.includes('data-bd-page-hero="image"')) ok("image hero when photo present");
  else bad("image hero when photo present");

  const freeDetail = {
    ...standardDetail,
    listing: { ...standardDetail.listing, plan_code: "free" },
    photos: [],
  };
  const freeHtml = R.renderBusinessDirectoryPage(freeDetail, { mode: "public", planGate: true }).html;
  if (
    !freeHtml.includes("data-bd-public-full-description") &&
    !freeHtml.includes("data-bd-public-faq") &&
    !freeHtml.includes("data-bd-public-recommended-uses")
  ) {
    ok("Free plan hides rich sections");
  } else bad("Free plan hides rich sections");

  if (freeHtml.includes('data-bd-page-hero="text"')) ok("text hero when no photo");
  else bad("text hero when no photo");

  const redirectHtml = R.renderBusinessDirectoryPage(
    {
      listing: {
        ...standardDetail.listing,
        hp_mode: "external_redirect",
      },
      profile: standardDetail.profile,
      photos: standardDetail.photos,
      business_hours: [],
    },
    { mode: "public", planGate: true },
  ).html;

  if (
    redirectHtml.includes("送客") &&
    !redirectHtml.includes("data-bd-public-faq") &&
    !redirectHtml.includes("data-bd-page-hero")
  ) {
    ok("external_redirect minimal layout");
  } else bad("external_redirect minimal layout");

  const ownerHtml = R.renderBusinessDirectoryPage(standardDetail, {
    mode: "owner-preview",
    preview: true,
    planGate: true,
  }).html;
  if (ownerHtml.includes("bd-preview__watermark")) ok("owner preview watermark");
  else bad("owner preview watermark");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
