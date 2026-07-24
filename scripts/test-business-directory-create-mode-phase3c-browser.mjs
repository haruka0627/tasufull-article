#!/usr/bin/env node
/**
 * Business Directory Phase 3c — AI page preview browser E2E (8788)
 *   node scripts/test-business-directory-create-mode-phase3c-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-create-mode-phase3c-browser");
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

function pageUrl() {
  return buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
}

async function main() {
  console.log("\nBusiness Directory Phase 3c — AI page preview browser E2E\n");
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

    await page.goto(pageUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator('[data-bd-create-mode="ai"]').click();
    await page.waitForSelector("[data-bd-ai-page-generate]:visible", { timeout: 10000 });
    pass("AI mode shows generate button");

    await page.locator('[name="display_name"]').fill("Phase3c テスト店");
    await page.locator('[name="prefecture"]').fill("東京都");
    await page.locator('[name="city"]').fill("渋谷区");
    await page.locator('[name="address_line1"]').fill("1-1-1");
    await page.locator('[name="service_areas"]').fill("東京都");
    await page.locator('[name="contact_name"]').fill("担当");
    await page.locator('[name="contact_email"]').fill("test@example.com");
    await page.locator('[name="contact_phone"]').fill("03-0000-0000");

    await page.locator("[data-bd-ai-page-generate]").click();
    await page.waitForSelector("[data-bd-ai-page-preview-wrap]:not([hidden])", { timeout: 15000 });
    await page.waitForSelector("[data-bd-ai-page-preview] .bd-public-lead", { timeout: 10000 });

    const freeRich =
      (await page.locator("[data-bd-ai-page-preview] [data-bd-public-full-description]").count()) +
      (await page.locator("[data-bd-ai-page-preview] [data-bd-public-faq]").count());
    const freePlaceholders = await page.locator("[data-bd-ai-page-preview] [data-bd-plan-preview-note]").count();
    if (freeRich === 0 && freePlaceholders >= 3) pass("Free plan shows placeholders in ai-preview");
    else fail("Free plan gate in preview", `rich=${freeRich} placeholders=${freePlaceholders}`);

    await page.locator('input[name="plan_code"]').evaluate((el) => {
      el.value = "standard";
    });
    await page.locator("[data-bd-ai-page-regenerate]").click();
    await page.waitForSelector("[data-bd-ai-page-preview] [data-bd-public-full-description]", {
      timeout: 15000,
    });
    pass("Standard+ shows rich sections after plan override + regenerate");

    const beforeApply = await page.locator('[name="short_description"]').inputValue();
    await page.locator("[data-bd-ai-page-apply]").click();
    await page.waitForSelector("[data-bd-ai-applied-notice]:not([hidden])", { timeout: 5000 });
    const afterApply = await page.locator('[name="short_description"]').inputValue();
    if (afterApply && afterApply !== beforeApply) pass("Apply fills short_description");
    else fail("Apply to form", `before=${beforeApply} after=${afterApply}`);

    const faqJson = await page.locator('[name="faq_items_json"]').inputValue();
    if (faqJson && faqJson.includes("[")) pass("Apply fills hidden faq_items_json");
    else fail("Apply hidden faq");

    const listingsBefore = await page.evaluate(() => localStorage.getItem("bd_mock_listings_v1"));
    if (!listingsBefore || listingsBefore === "[]") pass("Apply does not auto-save listing");
    else fail("Auto-save detected", listingsBefore);

    await page.locator("[data-bd-create-mode-back]").click();
    await page.locator('[data-bd-create-mode="manual"]').click();
    await page.waitForSelector("[data-bd-ai-generate]:visible", { timeout: 10000 });
    pass("Manual mode keeps legacy AI draft panel");

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
