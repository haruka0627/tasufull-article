#!/usr/bin/env node
/**
 * Phase 2-D smoke: detail-business-service.html demo listing.
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const LISTING_ID = process.env.BSD_LISTING_ID || "demo-field-service";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const errors = collectErrors(page);

try {
  const url = `${BASE}/detail-business-service.html?id=${encodeURIComponent(LISTING_ID)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 20000 }
  );

  const title = (await page.locator("[data-biz-detail-title]").textContent())?.trim();
  const company = (await page.locator("[data-biz-detail-company]").textContent())?.trim();
  const leadEl = page.locator("[data-biz-detail-hero-lead]");
  const lead =
    (await leadEl.count()) > 0 ? (await leadEl.textContent())?.trim() || "" : "";
  const menuTitle = (await page.locator("[data-biz-detail-service-menu-title]").textContent())?.trim();
  const estimateBtn = await page.locator("[data-business-service-estimate]").first();
  const consultBtn = await page.locator("[data-business-service-consult]").first();
  const hasEstimate = (await estimateBtn.count()) > 0;
  const hasConsult = (await consultBtn.count()) > 0;
  const estimateText = hasEstimate ? (await estimateBtn.textContent())?.trim() : "";
  const paymentSection = page.locator("#section-business-payment");
  const paymentHidden = await paymentSection.getAttribute("hidden");
  const feeLink = page.locator('a[href*="service-fee-pay.html"]');
  const feeLinkCount = await feeLink.count();

  const html = await page.content();
  const ufffd = (html.match(/\uFFFD/g) || []).length;
  const eCorrupt = (html.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) || []).length;

  const result = {
    url,
    listingLoaded: await page.evaluate(() => document.body.dataset.listingLoaded),
    title,
    company,
    leadVisible: Boolean(lead?.trim()),
    menuTitle,
    estimateText,
    hasEstimate,
    hasConsult,
    paymentSectionHidden: paymentHidden !== null,
    feeLinkCount,
    ufffdInDom: ufffd,
    eCorruptInDom: eCorrupt,
    errors: [...errors],
    ok:
      title &&
      company &&
      menuTitle?.includes("メニュー") &&
      hasEstimate &&
      hasConsult &&
      errors.length === 0 &&
      ufffd === 0 &&
      eCorrupt === 0,
  };

  console.log(JSON.stringify(result, null, 2));
  await closeAllBrowsers();
  process.exit(result.ok ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e), errors }, null, 2));
  await closeAllBrowsers();
  process.exit(1);
}});

