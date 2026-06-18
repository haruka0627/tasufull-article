/**
 * TASFUL市場 商品詳細 — PC CVR / 390 検証 + 提出スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PC = path.join(__dirname, "..", "screenshots", "market-product-detail-pc");
const OUT_390 = path.join(__dirname, "..", "screenshots", "market-product-detail-390");
const DETAIL_PATH = "detail-shop-product.html?shopId=demo-shop-tasful-bakery&productId=p-0";
const CART_KEY = "tasu_market_cart_count";

fs.mkdirSync(OUT_PC, { recursive: true });
fs.mkdirSync(OUT_390, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const browser = await chromium.launch({ headless: true });

async function capturePcCvr(viewportWidth = 1280) {
  const suffix = String(viewportWidth);
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: 900 } });
  await page.goto(buildLocalPageUrl(base, DETAIL_PATH), { waitUntil: "domcontentloaded", timeout: 15000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
  await page.evaluate((key) => localStorage.setItem(key, "0"), CART_KEY);
  await page.waitForTimeout(400);

  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-first-view-${suffix}.png`),
    fullPage: false,
  });

  const bundleSection = page.locator("[data-tasful-product-frequently-bought]");
  await bundleSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-bundle-${suffix}.png`),
    fullPage: false,
  });

  const totalBefore = await page.locator("[data-tasful-product-bundle-total]").textContent();
  const optionalCheck = page.locator(".tasful-market-product-bundle__check:not([disabled])").first();
  await optionalCheck.uncheck();
  await page.waitForTimeout(150);
  const totalAfterUncheck = await page.locator("[data-tasful-product-bundle-total]").textContent();
  await optionalCheck.check();
  await page.waitForTimeout(150);
  const totalAfterRecheck = await page.locator("[data-tasful-product-bundle-total]").textContent();

  const cartBefore = await page.evaluate((key) => Number(localStorage.getItem(key)) || 0, CART_KEY);
  await optionalCheck.uncheck();
  await page.click("[data-tasful-product-bundle-add]");
  await page.waitForTimeout(400);
  const cartAfterPartial = await page.evaluate((key) => Number(localStorage.getItem(key)) || 0, CART_KEY);
  const cartDeltaPartial = cartAfterPartial - cartBefore;

  const helpBtn = page.locator("[data-tasful-trust-help='connect']").first();
  await page.locator("[data-tasful-product-trust]").scrollIntoViewIfNeeded();
  await helpBtn.hover();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-trust-tooltip-${suffix}.png`),
    fullPage: false,
  });

  const tooltipVisible = await page.evaluate(() => {
    const group = document.querySelector("[data-tasful-trust-help='connect']")?.closest(".tasful-market-product-trust__badge-group");
    const tip = group?.querySelector(".tasful-market-product-trust__tooltip");
    if (!tip) return false;
    const style = getComputedStyle(tip);
    return style.visibility === "visible" && Number(style.opacity) > 0.5;
  });

  await page.locator("#product-reviews").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-review-${suffix}.png`),
    fullPage: false,
  });

  await page.locator("[data-tasful-product-description]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-description-${suffix}.png`),
    fullPage: false,
  });

  await page.evaluate(() => window.scrollTo(0, document.getElementById("product-reviews")?.offsetTop || 1200));
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(OUT_PC, `market-product-detail-pc-sticky-buybox-${suffix}.png`),
    fullPage: false,
  });

  const stickyReport = await page.evaluate(() => {
    const header = document.querySelector("[data-tasful-market-header]");
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const buybox = document.querySelector("[data-tasful-product-buybox]");
    const buyboxStyle = buybox ? getComputedStyle(buybox) : null;
    const buyboxRect = buybox?.getBoundingClientRect();
    const docScrollOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const stickyTop = parseFloat(buyboxStyle?.top || "0") || 0;
    const activeThumb = document.querySelector(".tasful-market-product-thumbs__btn.is-active");
    const inactiveThumb = document.querySelector(".tasful-market-product-thumbs__btn:not(.is-active)");
    const activeThumbStyle = activeThumb ? getComputedStyle(activeThumb) : null;
    const inactiveThumbStyle = inactiveThumb ? getComputedStyle(inactiveThumb) : null;
    const aboutList = document.querySelector("[data-tasful-product-about-inline-list]");
    const aboutText = aboutList?.textContent || "";
    const bundlePicker = document.querySelector(".tasful-market-product-bundle__picker");
    const bundlePickerStyle = bundlePicker ? getComputedStyle(bundlePicker) : null;
    const helpBtn = document.querySelector("[data-tasful-trust-help='connect']");
    const helpStyle = helpBtn ? getComputedStyle(helpBtn) : null;
    return {
      buyboxPosition: buyboxStyle?.position || "",
      buyboxTop: buyboxStyle?.top || "",
      buyboxTopPx: Math.round(buyboxRect?.top || 0),
      headerBottomPx: Math.round(headerBottom),
      buyboxBelowHeader: buyboxRect ? buyboxRect.top + 2 >= headerBottom : false,
      buyboxInViewport: buyboxRect ? buyboxRect.top >= headerBottom - 4 && buyboxRect.bottom <= window.innerHeight + 1 : false,
      buyboxVisible: buyboxStyle?.display !== "none",
      stickyTopPx: stickyTop,
      docScrollOverflow,
      bundlePickerCount: document.querySelectorAll(".tasful-market-product-bundle__picker-row").length,
      bundlePickerFlex: bundlePickerStyle?.display === "flex",
      bundlePlusCount: document.querySelectorAll(".tasful-market-product-bundle__picker-plus").length,
      bundleChecks: document.querySelectorAll(".tasful-market-product-bundle__check").length,
      trustHelpCount: document.querySelectorAll(".tasful-market-product-trust__help").length,
      trustHelpSize: Math.round(parseFloat(helpStyle?.width || "0")),
      activeThumbBorder: activeThumbStyle?.borderWidth || "",
      activeThumbOpacity: activeThumbStyle?.opacity || "",
      inactiveThumbOpacity: inactiveThumbStyle?.opacity || "",
      aboutHasAuthor: /著者：/.test(aboutText),
      aboutHasTrustOnly: /丁寧な梱包|Connect認証済み出品者/.test(aboutText),
    };
  });

  await page.close();

  const totalChanged =
    totalBefore &&
    totalAfterUncheck &&
    totalAfterRecheck &&
    totalBefore !== totalAfterUncheck &&
    totalAfterRecheck === totalBefore;

  return {
    viewport: suffix,
    totalBefore: (totalBefore || "").trim(),
    totalAfterUncheck: (totalAfterUncheck || "").trim(),
    totalAfterRecheck: (totalAfterRecheck || "").trim(),
    totalChanged,
    cartDeltaPartial,
    cartPartialOnly: cartDeltaPartial === 2,
    tooltipVisible,
    ...stickyReport,
    pass:
      stickyReport.buyboxPosition === "sticky" &&
      stickyReport.buyboxBelowHeader &&
      stickyReport.buyboxInViewport &&
      stickyReport.buyboxVisible &&
      !stickyReport.docScrollOverflow &&
      stickyReport.bundlePickerCount >= 3 &&
      stickyReport.bundleChecks >= 3 &&
      stickyReport.bundlePickerFlex &&
      stickyReport.bundlePlusCount >= 2 &&
      stickyReport.trustHelpCount >= 2 &&
      stickyReport.trustHelpSize >= 22 &&
      stickyReport.aboutHasAuthor &&
      !stickyReport.aboutHasTrustOnly &&
      totalChanged &&
      cartDeltaPartial === 2 &&
      tooltipVisible,
  };
}

async function capture390() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(buildLocalPageUrl(base, DETAIL_PATH), { waitUntil: "domcontentloaded", timeout: 15000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(300);

  const report = await page.evaluate(() => {
    const buybox = document.querySelector("[data-tasful-product-buybox]");
    const buyboxStyle = buybox ? getComputedStyle(buybox) : null;
    const picker = document.querySelector(".tasful-market-product-bundle__picker");
    const pickerStyle = picker ? getComputedStyle(picker) : null;
    const legacy = document.querySelector(".tasful-market-product-bundle__items--legacy");
    const legacyStyle = legacy ? getComputedStyle(legacy) : null;
    const help = document.querySelector(".tasful-market-product-trust__help");
    const helpStyle = help ? getComputedStyle(help) : null;
    return {
      docScrollOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      buyboxHidden: buyboxStyle?.display === "none",
      pickerHidden: pickerStyle?.display === "none",
      legacyVisible: legacyStyle?.display !== "none",
      helpHidden: !help || helpStyle?.display === "none",
      mobileCommerceVisible: getComputedStyle(document.querySelector("[data-tasful-product-mobile-commerce]") || document.body).display !== "none",
    };
  });

  await page.screenshot({
    path: path.join(OUT_390, "market-product-detail-mobile390.png"),
    fullPage: false,
  });

  await page.close();

  return {
    ...report,
    pass:
      !report.docScrollOverflow &&
      report.buyboxHidden &&
      report.pickerHidden &&
      report.legacyVisible &&
      report.helpHidden &&
      report.mobileCommerceVisible,
  };
}

const pcReport1280 = await capturePcCvr(1280);
const pcReport1440 = await capturePcCvr(1440);
const mobileReport = await capture390();
await browser.close();

const out = {
  baseUrl: base,
  detailPath: DETAIL_PATH,
  pcReport: pcReport1280,
  pcReport1440,
  mobileReport,
  pass: pcReport1280.pass && pcReport1440.pass && mobileReport.pass,
  screenshots: {
    pcFirstView1280: path.join(OUT_PC, "market-product-detail-pc-first-view-1280.png"),
    pcBundle1280: path.join(OUT_PC, "market-product-detail-pc-bundle-1280.png"),
    pcReviews1280: path.join(OUT_PC, "market-product-detail-pc-review-1280.png"),
    pcDescription1280: path.join(OUT_PC, "market-product-detail-pc-description-1280.png"),
    pcTrustTooltip1280: path.join(OUT_PC, "market-product-detail-pc-trust-tooltip-1280.png"),
    pcStickyBuybox1280: path.join(OUT_PC, "market-product-detail-pc-sticky-buybox-1280.png"),
    pcFirstView1440: path.join(OUT_PC, "market-product-detail-pc-first-view-1440.png"),
    mobile390: path.join(OUT_390, "market-product-detail-mobile390.png"),
  },
};

fs.writeFileSync(path.join(OUT_PC, "cvr-report.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
