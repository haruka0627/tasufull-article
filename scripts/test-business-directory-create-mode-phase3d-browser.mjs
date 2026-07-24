#!/usr/bin/env node
/**
 * Business Directory Phase 3d — save guidance browser E2E (8788)
 *   node scripts/test-business-directory-create-mode-phase3d-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-create-mode-phase3d-browser");
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

function pageUrl() {
  return buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
}

async function fillRequiredFields(page) {
  await page.fill('[name="display_name"]', "Phase3d テスト店");
  await page.fill('[name="contact_name"]', "担当 太郎");
  await page.fill('[name="contact_email"]', "owner@example.com");
  await page.fill('[name="contact_phone"]', "03-1234-5678");
  await page.fill('[name="prefecture"]', "東京都");
  await page.fill('[name="city"]', "渋谷区");
  await page.fill('[name="address_line1"]', "1-2-3");
  await page.fill('[name="service_areas"]', "東京都");
  await page.selectOption('[name="category_id"]', "a1000001-0001-4000-8000-000000000002");
  await page.fill('[name="shop_sales_genre"]', "地元野菜");
}

async function readMockListingCount(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("bd_mock_listings_v1");
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });
}

async function runAiApplyFlow(page) {
  await page.goto(pageUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(() => {
    localStorage.removeItem("bd_mock_listings_v1");
    localStorage.removeItem("bd_mock_pending_v1");
  });
  await page.locator('[data-bd-create-mode="ai"]').click();
  await page.waitForSelector("[data-bd-ai-page-generate]:visible", { timeout: 10000 });
  await fillRequiredFields(page);
  await page.locator("[data-bd-ai-page-generate]").click();
  await page.waitForSelector("[data-bd-ai-page-preview-wrap]:not([hidden])", { timeout: 15000 });
  const countAfterGenerate = await readMockListingCount(page);
  if (countAfterGenerate === 0) pass("Generate alone does not save listing");
  else fail("Generate auto-save", String(countAfterGenerate));
  await page.locator("[data-bd-ai-page-apply]").click();
  await page.waitForSelector("[data-bd-ai-applied-notice]:not([hidden])", { timeout: 5000 });
}

async function main() {
  console.log("\nBusiness Directory Phase 3d — save guidance browser E2E\n");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const res = await fetch(pageUrl());
  if (res.status === 200) pass("HTTP Status", "200");
  else fail("HTTP Status", String(res.status));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    await runAiApplyFlow(page);

    const bannerTitle = await page.locator("[data-bd-ai-applied-notice] .bd-banner__title").textContent();
    if (bannerTitle?.includes("AI生成内容をフォームに反映しました")) pass("Applied banner title");
    else fail("Applied banner title", bannerTitle || "");

    const bannerText = await page.locator("[data-bd-ai-applied-notice] .bd-banner__text").textContent();
    if (bannerText?.includes("下書き保存") && bannerText?.includes("保存・公開はされていません")) {
      pass("Applied banner unsaved hint");
    } else fail("Applied banner unsaved hint", bannerText || "");

    const emphasized = await page.locator("[data-bd-save-draft-wrap].bd-form__actions--emphasis").count();
    if (emphasized >= 1) pass("Save actions emphasized after apply");
    else fail("Save actions emphasized after apply");

    const countAfterApply = await readMockListingCount(page);
    if (countAfterApply === 0) pass("Apply alone does not save listing");
    else fail("Apply auto-save", String(countAfterApply));

    const shortApplied = await page.locator('[name="short_description"]').inputValue();
    if (shortApplied) pass("Apply fills short_description before save");
    else fail("short_description filled after apply");

    await page.locator('[name="photo"]').setInputFiles({
      name: "phase3d.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.locator('[name="terms_accepted"]').check();

    const countBeforeSave = await readMockListingCount(page);
    await Promise.all([
      page.waitForURL(/business-directory\/edit(\.html)?\?id=.*created=1/, { timeout: 20000 }),
      page.locator("[data-bd-save-draft-btn]").click(),
    ]);
    pass("Save navigates to edit.html");

    const countAfterSave = await readMockListingCount(page);
    if (countAfterSave === countBeforeSave + 1) pass("Save creates exactly one mock listing");
    else fail("Save listing count", `before=${countBeforeSave} after=${countAfterSave}`);

    const listingId = new URL(page.url()).searchParams.get("id");
    if (listingId) pass("edit.html has listing id", listingId);
    else fail("edit.html listing id");

    await page.waitForSelector("[data-bd-edit-form]", { timeout: 10000 });
    await page.waitForFunction(
      () => (document.querySelector('[name="short_description"]')?.value || "").length > 0,
      { timeout: 15000 },
    );

    const editShort = await page.locator('[name="short_description"]').inputValue();
    if (editShort === shortApplied) pass("edit.html short_description persisted");
    else fail("edit.html short_description", `new=${shortApplied} edit=${editShort}`);

    const editFull = await page.locator('[name="full_description"]').inputValue();
    const editSeo = await page.locator('[name="seo_title"]').inputValue();
    const editMeta = await page.locator('[name="meta_description"]').inputValue();
    const editUses = await page.locator('[name="recommended_uses_text"]').inputValue();
    if (editFull) pass("edit.html full_description persisted");
    else fail("edit.html full_description");
    if (editSeo) pass("edit.html seo_title persisted");
    else fail("edit.html seo_title");
    if (editMeta) pass("edit.html meta_description persisted");
    else fail("edit.html meta_description");
    if (editUses) pass("edit.html recommended_uses persisted");
    else fail("edit.html recommended_uses");

    const faqCount = await page.locator("[data-bd-faq-row]").count();
    if (faqCount >= 1) pass("edit.html FAQ editor populated");
    else fail("edit.html FAQ editor");

    const statusText = await page.locator("[data-bd-edit-status]").textContent();
    if (statusText?.includes("下書き") && !statusText?.includes("審査")) {
      pass("Saved listing stays draft (not review_requested)");
    } else fail("Post-save status", statusText || "");

    await page.locator('[data-bd-tab="preview"]').click();
    await page.waitForSelector('[data-bd-tab-panel="preview"] .bd-public-lead', { timeout: 10000 });
    const previewLead = await page.locator('[data-bd-tab-panel="preview"] .bd-public-lead').textContent();
    if (previewLead?.includes(editShort.slice(0, 20))) pass("Owner preview shows AI short_description");
    else fail("Owner preview content", previewLead?.slice(0, 40) || "");

    await page.locator('[data-bd-tab="publish"]').click();
    const submitReview = page.locator("[data-bd-submit-review]");
    if ((await submitReview.count()) >= 1 && (await submitReview.isEnabled())) {
      pass("Publish tab available; review requires user action");
    } else fail("Publish tab submit review");

    await page.goto(pageUrl(), { waitUntil: "domcontentloaded" });
    await page.locator('[data-bd-create-mode="manual"]').click();
    await page.waitForSelector("[data-bd-ai-generate]:visible", { timeout: 10000 });
    await fillRequiredFields(page);
    await page.fill('[name="short_description"]', "Manual mode save test");
    await page.locator('[name="photo"]').setInputFiles({
      name: "manual.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.locator('[name="terms_accepted"]').check();
    await Promise.all([
      page.waitForURL(/business-directory\/edit(\.html)?\?id=.*created=1/, { timeout: 20000 }),
      page.locator("[data-bd-save-draft-btn]").click(),
    ]);
    pass("Manual mode save still redirects to edit.html");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(pageUrl(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-bd-create-mode-picker]", { timeout: 10000 });
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
