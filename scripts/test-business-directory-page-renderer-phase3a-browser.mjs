#!/usr/bin/env node
/**
 * Business Directory Phase 3a — shared renderer browser E2E (8788)
 *   node scripts/test-business-directory-page-renderer-phase3a-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const MOCK_QS = "bdPublicMock=1&bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-page-renderer-phase3a-browser");
const MOCK_LISTING_ID = "mock-renderer-preview";
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function standardPublicUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=tanaka-shop&type=shop_retail&${MOCK_QS}`,
  );
}

function freePublicUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=free-plan-shop&type=shop_retail&${MOCK_QS}`,
  );
}

function redirectPublicUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=yamada-koumuten&type=business_service&${MOCK_QS}`,
  );
}

function ownerPreviewUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/edit.html",
    `id=${MOCK_LISTING_ID}&tab=preview&${MOCK_QS}`,
  );
}

async function seedOwnerMock(page) {
  await page.evaluate(({ id }) => {
    localStorage.setItem(
      "bd_mock_listings_v1",
      JSON.stringify([
        {
          id,
          display_name: "田中商店",
          listing_type: "shop_retail",
          status: "draft",
          plan_code: "standard",
          category_id: "a1000001-0001-4000-8000-000000000001",
          service_areas: ["東京都", "神奈川県"],
          hp_mode: "full_page",
          website_url: "https://example.com/tanaka",
          updated_at: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem(
      `bd_local_v1_${id}`,
      JSON.stringify({
        profile: {
          company_name: "田中商店",
          contact_email: "info@tanaka.example",
          prefecture: "東京都",
          city: "渋谷区",
          address_line1: "1-2-3",
          short_description: "地元の新鮮野菜と加工食品を扱う小売店です。",
          full_description: "田中商店は東京都渋谷区で地元野菜と加工食品を扱う小売店です。",
          faq_items: [{ q: "取り扱い商品は何ですか？", a: "地元野菜と加工食品です。" }],
          recommended_uses: ["地元の食材を探している方"],
          shop_sales_genre: "食品・加工品",
        },
        photos: [{ url: "https://placehold.co/800x500/e2e8f0/64748b?text=Shop", sort_order: 0 }],
        hours: [{ label: "平日", value: "10:00-19:00" }],
      }),
    );
  }, { id: MOCK_LISTING_ID });
}

async function sectionOrder(page, hostSel) {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel);
    if (!host) return [];
    const tokens = [
      "[data-bd-page-hero]",
      ".bd-public-lead",
      "[data-bd-public-full-description]",
      "[data-bd-public-recommended-uses]",
      "[data-bd-public-faq]",
    ];
    const positions = tokens
      .map((t) => {
        const el = host.querySelector(t);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { token: t, top: rect.top };
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top)
      .map((x) => x.token);
    return positions;
  }, hostSel);
}

async function main() {
  console.log("\nBusiness Directory Phase 3a — shared renderer browser E2E\n");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const res = await fetch(standardPublicUrl());
  if (res.status === 200) pass("HTTP Status (public)", "200");
  else fail("HTTP Status (public)", String(res.status));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });

    await page.goto(standardPublicUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem("bd_public_mock_v1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });

    if (await page.locator('[data-bd-page-hero="image"]').count()) {
      pass("Standard image hero");
    } else fail("Standard image hero");

    const publicOrder = await sectionOrder(page, "[data-bd-public-detail]");
    const expectedOrder = [
      "[data-bd-page-hero]",
      ".bd-public-lead",
      "[data-bd-public-full-description]",
      "[data-bd-public-recommended-uses]",
      "[data-bd-public-faq]",
    ];
    if (JSON.stringify(publicOrder) === JSON.stringify(expectedOrder)) {
      pass("Public section order matches renderer");
    } else fail("Public section order", `${publicOrder.join(" | ")}`);

    await page.goto(freePublicUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });

    if (await page.locator('[data-bd-page-hero="text"]').count()) pass("Free text hero");
    else fail("Free text hero");

    const freeRich =
      (await page.locator("[data-bd-public-full-description]").count()) +
      (await page.locator("[data-bd-public-faq]").count()) +
      (await page.locator("[data-bd-public-recommended-uses]").count());
    if (freeRich === 0) pass("Free hides rich sections");
    else fail("Free hides rich sections", String(freeRich));

    await page.goto(redirectPublicUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });
    const redirectText = await page.locator("[data-bd-public-detail]").innerText();
    if (redirectText.includes("送客") && !(await page.locator("[data-bd-public-faq]").count())) {
      pass("external_redirect layout");
    } else fail("external_redirect layout");

    await page.goto(ownerPreviewUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await seedOwnerMock(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".bd-preview--shared", { timeout: 15000 });
    await page.click('[data-bd-tab="preview"]');
    await page.waitForSelector(".bd-preview--shared [data-bd-page-hero]", { timeout: 10000 });

    const ownerOrder = await sectionOrder(page, ".bd-preview--shared .bd-public-detail");
    if (JSON.stringify(ownerOrder) === JSON.stringify(expectedOrder)) {
      pass("Owner preview section order matches public");
    } else fail("Owner preview section order", `${ownerOrder.join(" | ")}`);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(standardPublicUrl(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      );
      if (!overflow) pass(`viewport ${vp.name}px no horizontal overflow`);
      else fail(`viewport ${vp.name}px layout overflow`);
      await page.screenshot({
        path: path.join(SHOT_DIR, `public-standard-${vp.name}.png`),
        fullPage: true,
      });
    }
  });

  const ng = results.filter((r) => !r.ok);
  console.log(`\nScreenshots: ${path.relative(root, SHOT_DIR)}/`);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed ===\n`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
