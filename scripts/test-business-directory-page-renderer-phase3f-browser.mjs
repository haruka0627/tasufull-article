#!/usr/bin/env node
/**
 * Business Directory Phase 3f — AI preview plan placeholders browser E2E (8788)
 *   node scripts/test-business-directory-page-renderer-phase3f-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-page-renderer-phase3f-browser");
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

function newPageUrl() {
  return buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
}

async function main() {
  console.log("\nBusiness Directory Phase 3f — AI preview plan placeholders browser E2E\n");
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

    await page.goto(newPageUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator('[data-bd-create-mode="ai"]').click();
    await page.waitForSelector("[data-bd-ai-page-generate]:visible", { timeout: 10000 });
    await page.fill('[name="display_name"]', "Phase3f テスト店");
    await page.locator("[data-bd-ai-page-generate]").click();
    await page.waitForSelector("[data-bd-ai-page-preview-wrap]:not([hidden])", { timeout: 15000 });

    const preview = page.locator("[data-bd-ai-page-preview]");
    const fullPh = await preview.locator('[data-bd-plan-preview-note="full_description"]').count();
    const faqPh = await preview.locator('[data-bd-plan-preview-note="faq"]').count();
    const usesPh = await preview.locator('[data-bd-plan-preview-note="recommended_uses"]').count();
    const rich = await preview.locator("[data-bd-public-full-description]").count();

    if (fullPh >= 1 && faqPh >= 1 && usesPh >= 1 && rich === 0) {
      pass("Free ai-preview shows three plan placeholders");
    } else fail("Free ai-preview placeholders", `full=${fullPh} faq=${faqPh} uses=${usesPh} rich=${rich}`);

    await page.locator('input[name="plan_code"]').evaluate((el) => {
      el.value = "standard";
    });
    await page.locator("[data-bd-ai-page-regenerate]").click();
    await page.waitForSelector("[data-bd-ai-page-preview] [data-bd-public-full-description]", {
      timeout: 15000,
    });
    const placeholdersAfterStd = await preview.locator("[data-bd-plan-preview-note]").count();
    if (placeholdersAfterStd === 0) pass("Standard ai-preview hides placeholders");
    else fail("Standard ai-preview hides placeholders", String(placeholdersAfterStd));

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(newPageUrl(), { waitUntil: "domcontentloaded" });
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
