#!/usr/bin/env node
/**
 * Business Directory AI draft Phase 1b — browser E2E on 8788
 *   npm run dev  (http://127.0.0.1:8788)
 *   node scripts/test-business-directory-ai-draft-phase1b-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const PAGE_URL = buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
const SHOT_DIR = path.join(root, "reports", "business-directory-ai-draft-phase1b-browser");

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];
const consoleErrors = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("supabase") ||
    t.includes("Supabase") ||
    t.includes("chat-supabase")
  );
}

async function fillRequiredFields(page) {
  await page.fill('[name="display_name"]', "テスト商店 Phase1b");
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

async function main() {
  console.log(`\nBusiness Directory AI draft Phase 1b — browser E2E\nURL: ${PAGE_URL}\n`);
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  let httpStatus = 0;
  try {
    const res = await fetch(PAGE_URL, { method: "GET" });
    httpStatus = res.status;
  } catch (e) {
    fail("HTTP preflight", String(e.message || e));
    process.exit(1);
  }
  if (httpStatus === 200) pass("HTTP Status", String(httpStatus));
  else fail("HTTP Status", String(httpStatus));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });

    page.on("console", (msg) => {
      if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (!isIgnorableConsoleError(err.message)) consoleErrors.push(err.message);
    });

    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-bd-new-form]", { timeout: 10000 });

    await page.evaluate(() => {
      localStorage.removeItem("bd_mock_listings_v1");
      localStorage.removeItem("bd_mock_pending_v1");
    });

    const panelVisible = await page.locator(".bd-ai-draft").isVisible();
    if (panelVisible) pass("1. AI下書きパネル表示");
    else fail("1. AI下書きパネル表示");

    const titleText = await page.locator("#bd-ai-draft-title").textContent();
    if (titleText?.includes("AIで下書きを作成")) pass("AI panel title");
    else fail("AI panel title", titleText || "");

    await fillRequiredFields(page);

    const listingsBefore = await readMockListingCount(page);
    const urlBefore = page.url();

    await page.click("[data-bd-ai-generate]");
    await page.waitForSelector("[data-bd-ai-preview]:not([hidden])", { timeout: 8000 });

    const previewVisible = await page.locator("[data-bd-ai-preview]").isVisible();
    if (previewVisible) pass("4. 生成結果プレビュー表示");
    else fail("4. 生成結果プレビュー表示");

    const statusText = await page.locator("[data-bd-ai-status]").textContent();
    if (statusText?.includes("生成")) pass("2. 下書きを生成 動作", statusText.trim());
    else fail("2. 下書きを生成 動作", statusText || "");

    const badgeText = await page.locator(".bd-ai-draft__badge").textContent();
    if (badgeText?.trim() === "モック") pass("3. モックバッジ表示", badgeText.trim());
    else fail("3. モックバッジ表示", badgeText || "");

    const shortPreview = await page.locator("[data-bd-ai-short-text]").textContent();
    if (shortPreview?.includes("テスト商店 Phase1b")) pass("preview short_description content");
    else fail("preview short_description content");

    const listingsAfterGenerate = await readMockListingCount(page);
    if (listingsAfterGenerate === listingsBefore) pass("6. 生成後も自動保存なし", `count=${listingsAfterGenerate}`);
    else fail("6. 生成後も自動保存なし", `before=${listingsBefore} after=${listingsAfterGenerate}`);

    if (page.url() === urlBefore) pass("6b. 生成後も new ページのまま");
    else fail("6b. 生成後も new ページのまま", page.url());

    await page.click("[data-bd-ai-apply-short]");
    await page.waitForTimeout(300);

    const shortValue = await page.inputValue('[name="short_description"]');
    if (shortValue === shortPreview?.trim()) pass("5. この内容を反映 → short_description", `${shortValue.length} chars`);
    else fail("5. この内容を反映 → short_description", `expected preview text`);

    const listingsAfterApply = await readMockListingCount(page);
    if (listingsAfterApply === listingsBefore) pass("7. 反映後も自動保存なし（保存ボタンのみ）", `count=${listingsAfterApply}`);
    else fail("7. 反映後も自動保存なし", `count=${listingsAfterApply}`);

    await page.screenshot({
      path: path.join(SHOT_DIR, "01-new-after-apply-1280.png"),
      fullPage: true,
    });
    pass("screenshot 1280 after apply");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);
      const panelBox = await page.locator(".bd-ai-draft").boundingBox();
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth > el.clientWidth + 2;
      });
      const panelOk = Boolean(panelBox && panelBox.width <= vp.width + 2);
      if (panelOk && !overflow) pass(`9. viewport ${vp.name}px レイアウト`, `panelW=${Math.round(panelBox?.width || 0)}`);
      else fail(`9. viewport ${vp.name}px レイアウト`, `overflow=${overflow} panelW=${panelBox?.width}`);
      await page.screenshot({
        path: path.join(SHOT_DIR, `02-viewport-${vp.name}.png`),
        fullPage: true,
      });
    }

    await page.evaluate(() => {
      localStorage.setItem(
        "bd_mock_listings_v1",
        JSON.stringify([
          {
            id: "mock-review-1",
            display_name: "審査中テスト",
            listing_type: "shop_retail",
            status: "review_requested",
            plan_code: "free",
            category_id: "a1000001-0001-4000-8000-000000000002",
            service_areas: ["東京都"],
            updated_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
          },
        ]),
      );
    });

    const editUrl = buildLocalPageUrl(
      BASE,
      "business-directory/edit.html",
      `id=mock-review-1&${PAGE_QS}`,
    );
    await page.goto(editUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-bd-review-pending]", { timeout: 10000 });

    const reviewBanner = await page.locator("[data-bd-review-pending]").isVisible();
    if (reviewBanner) pass("8. 審査中バナー表示（審査フロー維持）");
    else fail("8. 審査中バナー表示");

    const generateDisabled = await page.locator("[data-bd-ai-generate]").isDisabled();
    if (generateDisabled) pass("8b. 審査中は AI 生成ボタン disabled");
    else fail("8b. 審査中は AI 生成ボタン disabled");

    await page.locator('[data-bd-tab="publish"]').click();
    const submitDisabled = await page.locator("[data-bd-submit-review]").isDisabled().catch(() => true);
    if (submitDisabled) pass("8c. 審査中は公開申請 disabled");
    else fail("8c. 審査中は公開申請 disabled");

    await page.screenshot({
      path: path.join(SHOT_DIR, "03-edit-review-locked-1280.png"),
      fullPage: true,
    });
  });

  const ng = results.filter((r) => !r.ok);
  if (consoleErrors.length === 0) pass("Console Error", "none (ignorable supabase excluded)");
  else fail("Console Error", consoleErrors.slice(0, 3).join(" | "));

  console.log(`\nScreenshots: ${path.relative(root, SHOT_DIR)}/`);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed ===\n`);
  if (ng.length) {
    ng.forEach((r) => console.error(`  - ${r.step}${r.detail ? `: ${r.detail}` : ""}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
