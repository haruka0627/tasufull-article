#!/usr/bin/env node
/**
 * Business Directory page content Phase 2b — public detail browser E2E (8788)
 *   node scripts/test-business-directory-page-content-phase2b-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const MOCK_QS = "bdPublicMock=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-page-content-phase2b-browser");
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

function standardUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=tanaka-shop&type=shop_retail&${MOCK_QS}`,
  );
}

function freeUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=free-plan-shop&type=shop_retail&${MOCK_QS}`,
  );
}

function redirectUrl() {
  return buildLocalPageUrl(
    BASE,
    "business-directory/public/detail.html",
    `slug=yamada-koumuten&type=business_service&${MOCK_QS}`,
  );
}

async function main() {
  console.log("\nBusiness Directory Phase 2b — public detail browser E2E\n");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const res = await fetch(standardUrl());
  if (res.status === 200) pass("HTTP Status", "200");
  else fail("HTTP Status", String(res.status));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });

    await page.goto(standardUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem("bd_public_mock_v1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });

    const title = await page.title();
    if (title.includes("田中商店")) pass("SEO document.title (Standard)", title);
    else fail("SEO document.title (Standard)", title);

    const meta = await page.locator('meta[name="description"]').getAttribute("content");
    if (meta && meta.includes("地元")) pass("SEO meta description (Standard)");
    else fail("SEO meta description (Standard)", meta || "");

    if (await page.locator("[data-bd-public-full-description]").isVisible()) {
      pass("Standard+ full_description section");
    } else fail("Standard+ full_description section");

    if (await page.locator("[data-bd-public-faq]").isVisible()) pass("Standard+ FAQ section");
    else fail("Standard+ FAQ section");

    if (await page.locator("[data-bd-public-recommended-uses]").isVisible()) {
      pass("Standard+ recommended uses section");
    } else fail("Standard+ recommended uses section");

    const faqCount = await page.locator("[data-bd-public-faq-item]").count();
    if (faqCount >= 1 && faqCount <= 5) pass("FAQ item count", String(faqCount));
    else fail("FAQ item count", String(faqCount));

    await page.goto(freeUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });

    const freeTitle = await page.title();
    if (freeTitle.includes("無料プラン店")) pass("SEO document.title (Free)", freeTitle);
    else fail("SEO document.title (Free)", freeTitle);

    const freeFullHidden = !(await page.locator("[data-bd-public-full-description]").count());
    const freeFaqHidden = !(await page.locator("[data-bd-public-faq]").count());
    const freeUsesHidden = !(await page.locator("[data-bd-public-recommended-uses]").count());
    if (freeFullHidden && freeFaqHidden && freeUsesHidden) {
      pass("Free plan hides rich sections");
    } else {
      fail("Free plan hides rich sections", `full=${!freeFullHidden} faq=${!freeFaqHidden} uses=${!freeUsesHidden}`);
    }

    await page.goto(redirectUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });

    const redirectTitle = await page.title();
    if (redirectTitle.includes("山田工務店")) pass("SEO document.title (redirect)", redirectTitle);
    else fail("SEO document.title (redirect)", redirectTitle);

    const redirectFaq = await page.locator("[data-bd-public-faq]").count();
    const redirectText = await page.locator("[data-bd-public-detail]").innerText();
    if (redirectFaq === 0 && redirectText.includes("送客")) {
      pass("external_redirect CTA without rich sections");
    } else fail("external_redirect layout");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(standardUrl(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-bd-public-detail]", { timeout: 10000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      if (!overflow) pass(`viewport ${vp.name}px no horizontal overflow`);
      else fail(`viewport ${vp.name}px layout overflow`);
      await page.screenshot({
        path: path.join(SHOT_DIR, `detail-standard-${vp.name}.png`),
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
