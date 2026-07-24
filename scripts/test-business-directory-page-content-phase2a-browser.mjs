#!/usr/bin/env node
/**
 * Business Directory page content Phase 2a — browser E2E (edit.html · 8788)
 *   node scripts/test-business-directory-page-content-phase2a-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const LISTING_ID = "mock-phase2a-edit";
const PAGE_URL = buildLocalPageUrl(
  BASE,
  "business-directory/edit.html",
  `id=${LISTING_ID}&bdMock=1&devSkipAuth=1`,
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

async function main() {
  console.log(`\nBusiness Directory Phase 2a — browser E2E\nURL: ${PAGE_URL}\n`);

  const res = await fetch(PAGE_URL);
  if (res.status === 200) pass("HTTP Status", "200");
  else fail("HTTP Status", String(res.status));

  fs.mkdirSync(path.join(root, "reports", "business-directory-page-content-phase2a-browser"), {
    recursive: true,
  });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(
      ({ id }) => {
        localStorage.setItem(
          "bd_mock_listings_v1",
          JSON.stringify([
            {
              id,
              display_name: "Phase2a テスト店",
              listing_type: "shop_retail",
              status: "draft",
              plan_code: "free",
              category_id: "a1000001-0001-4000-8000-000000000002",
              service_areas: ["東京都"],
              hp_mode: "full_page",
              updated_at: new Date().toISOString(),
            },
          ]),
        );
        localStorage.setItem(
          `bd_local_v1_${id}`,
          JSON.stringify({
            profile: {
              company_name: "Phase2a テスト店",
              contact_name: "担当",
              contact_email: "a@example.com",
              contact_phone: "03-1111-2222",
              prefecture: "東京都",
              city: "渋谷区",
              address_line1: "1-1",
              short_description: "短文テスト",
            },
            photos: [],
            hours: [],
          }),
        );
      },
      { id: LISTING_ID },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-edit-form]", { timeout: 10000 });

    const seoVisible = await page.locator('[name="seo_title"]').isVisible();
    if (seoVisible) pass("edit page content fields visible");
    else fail("edit page content fields visible");

    const fullDisabled = await page.locator('[name="full_description"]').isDisabled();
    if (fullDisabled) pass("Free plan full_description locked");
    else fail("Free plan full_description locked");

    await page.fill('[name="display_name"]', "Phase2a テスト店");
    await page.fill('[name="shop_sales_genre"]', "地元野菜");
    await page.click("[data-bd-ai-generate]");
    await page.waitForSelector("[data-bd-ai-preview]:not([hidden])", { timeout: 8000 });

    await page.click("[data-bd-ai-apply-all]");
    await page.waitForTimeout(300);

    const seoVal = await page.inputValue('[name="seo_title"]');
    if (seoVal.length > 0) pass("AI apply seo_title", `${seoVal.length} chars`);
    else fail("AI apply seo_title");

    const usesVal = await page.inputValue('[name="recommended_uses_text"]');
    if (usesVal.includes("地元") || usesVal.length > 5) pass("AI apply recommended_uses");
    else fail("AI apply recommended_uses");

    const faqJson = await page.inputValue('[name="faq_items_json"]');
    let faqCount = 0;
    try {
      faqCount = JSON.parse(faqJson).length;
    } catch {
      faqCount = 0;
    }
    if (faqCount >= 1) pass("AI apply faq_items", `count=${faqCount}`);
    else fail("AI apply faq_items");

    const pendingBefore = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("bd_mock_pending_v1") || "{}");
      } catch {
        return {};
      }
    });
    if (Object.keys(pendingBefore).length === 0) pass("AI apply does not auto-save pending");
    else fail("AI apply does not auto-save pending");

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const stored = await page.evaluate(
      ({ id }) => {
        const raw = localStorage.getItem(`bd_local_v1_${id}`);
        return raw ? JSON.parse(raw) : null;
      },
      { id: LISTING_ID },
    );
    if (stored?.profile?.seo_title) pass("save persists seo_title via mock local store");
    else fail("save persists seo_title");
    if (stored?.profile?.faq_items?.length >= 1) pass("save persists faq_items");
    else fail("save persists faq_items");

    await page.screenshot({
      path: path.join(root, "reports", "business-directory-page-content-phase2a-browser", "edit-after-save.png"),
      fullPage: true,
    });
  });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed ===\n`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
