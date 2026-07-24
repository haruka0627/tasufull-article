#!/usr/bin/env node
/**
 * Business Directory Phase 3e — post-create edit guide browser E2E (8788)
 *   node scripts/test-business-directory-create-mode-phase3e-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-create-mode-phase3e-browser");
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function newPageUrl() {
  return buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
}

function editPageUrl(id, extra = "") {
  const qs = [`id=${encodeURIComponent(id)}`, PAGE_QS];
  if (extra) qs.push(extra);
  return buildLocalPageUrl(BASE, "business-directory/edit.html", qs.join("&"));
}

async function fillRequiredFields(page) {
  await page.fill('[name="display_name"]', "Phase3e テスト店");
  await page.fill('[name="contact_name"]', "担当 太郎");
  await page.fill('[name="contact_email"]', "owner@example.com");
  await page.fill('[name="contact_phone"]', "03-1234-5678");
  await page.fill('[name="prefecture"]', "東京都");
  await page.fill('[name="city"]', "渋谷区");
  await page.fill('[name="address_line1"]', "1-2-3");
  await page.fill('[name="service_areas"]', "東京都");
  await page.selectOption('[name="category_id"]', "a1000001-0001-4000-8000-000000000002");
  await page.fill('[name="shop_sales_genre"]', "地元野菜");
  await page.fill('[name="short_description"]', "Phase3e 短文紹介");
}

async function saveNewDraft(page) {
  await page.goto(newPageUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(() => {
    localStorage.removeItem("bd_mock_listings_v1");
    localStorage.removeItem("bd_mock_pending_v1");
    sessionStorage.clear();
  });
  await page.locator('[data-bd-create-mode="manual"]').click();
  await page.waitForSelector("[data-bd-new-form]:visible", { timeout: 10000 });
  await fillRequiredFields(page);
  await page.locator('[name="photo"]').setInputFiles({
    name: "phase3e.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await page.locator('[name="terms_accepted"]').check();
  await Promise.all([
    page.waitForURL(/created=1/, { timeout: 20000 }),
    page.locator("[data-bd-save-draft-btn]").click(),
  ]);
  return new URL(page.url()).searchParams.get("id");
}

async function main() {
  console.log("\nBusiness Directory Phase 3e — post-create edit guide browser E2E\n");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const res = await fetch(newPageUrl());
  if (res.status === 200) pass("HTTP Status", "200");
  else fail("HTTP Status", String(res.status));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    const listingId = await saveNewDraft(page);
    if (listingId && page.url().includes("created=1")) pass("Save redirect includes created=1");
    else fail("Save redirect includes created=1", page.url());

    await page.waitForSelector("[data-bd-post-create-guide]:visible", { timeout: 10000 });
    pass("Post-create guide visible on edit arrival");

    await page.goto(editPageUrl(listingId), { waitUntil: "domcontentloaded" });
    const guideHiddenNormal = await page.locator("[data-bd-post-create-guide]").isHidden();
    if (guideHiddenNormal) pass("Normal edit URL hides post-create guide");
    else fail("Normal edit URL hides post-create guide");

    await page.goto(editPageUrl(listingId, "created=1"), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-post-create-guide]:visible", { timeout: 10000 });

    await page.locator("[data-bd-post-create-guide-preview]").click();
    await page.waitForSelector('[data-bd-tab-panel="preview"]:not([hidden])', { timeout: 5000 });
    const previewVisible = await page.locator('[data-bd-tab-panel="preview"] .bd-public-detail').count();
    if (previewVisible >= 1) pass("Preview CTA opens preview tab with renderer");
    else fail("Preview CTA opens preview tab");

    await page.locator("[data-bd-post-create-guide-publish]").click();
    await page.waitForSelector('[data-bd-tab-panel="publish"]:not([hidden])', { timeout: 5000 });
    const publishPanelVisible = await page.locator('[data-bd-tab-panel="publish"] [data-bd-submit-review]').isVisible();
    const emphasized = await page.locator("[data-bd-submit-review].bd-submit-review--emphasis").count();
    if (publishPanelVisible) pass("Publish CTA opens publish tab");
    else fail("Publish CTA opens publish tab");
    if (emphasized >= 1) pass("Publish CTA emphasizes submit button");
    else fail("Publish CTA emphasizes submit button");

    await page.locator("[data-bd-post-create-guide-close]").click();
    await page.waitForSelector("[data-bd-post-create-guide]", { state: "hidden", timeout: 5000 });
    pass("Close hides post-create guide");

    await page.goto(editPageUrl(listingId, "created=1"), { waitUntil: "domcontentloaded" });
    const guideAfterDismiss = await page.locator("[data-bd-post-create-guide]").isHidden();
    if (guideAfterDismiss) pass("Dismissed guide stays hidden in same session");
    else fail("Dismissed guide stays hidden in same session");

    await page.evaluate(() => {
      localStorage.setItem(
        "bd_mock_listings_v1",
        JSON.stringify([
          {
            id: "mock-review-phase3e",
            display_name: "審査中テスト",
            listing_type: "shop_retail",
            status: "review_requested",
            plan_code: "free",
            category_id: "a1000001-0001-4000-8000-000000000002",
            service_areas: ["東京都"],
            updated_at: new Date().toISOString(),
            published_at: null,
          },
        ]),
      );
    });
    await page.goto(editPageUrl("mock-review-phase3e", "created=1"), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-review-pending]:visible", { timeout: 10000 });
    const guideReview = await page.locator("[data-bd-post-create-guide]").isHidden();
    if (guideReview) pass("review_requested suppresses post-create guide");
    else fail("review_requested suppresses post-create guide");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(editPageUrl(listingId), { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-bd-edit-form]", { timeout: 10000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      );
      if (!overflow) pass(`viewport ${vp.name}px no horizontal overflow`);
      else fail(`viewport ${vp.name}px layout overflow`);
    }

    if (!consoleErrors.length) pass("Console errors", "none");
    else fail("Console errors", consoleErrors.slice(0, 3).join(" | "));
  });

  const ng = results.filter((r) => !r.ok);
  console.log(`\nScreenshots dir: ${path.relative(root, SHOT_DIR)}/`);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed ===\n`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
