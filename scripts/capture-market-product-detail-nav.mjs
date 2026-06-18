/**
 * TASFUL市場 商品詳細 — セクションナビ 1280px 提出スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-product-detail-pc");
const DETAIL_PATH = "detail-shop-product.html?shopId=demo-shop-tasful-bakery&productId=p-0";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(buildLocalPageUrl(base, DETAIL_PATH), { waitUntil: "domcontentloaded", timeout: 15000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
await page.waitForTimeout(400);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(OUT_DIR, "market-product-detail-pc-nav-display-1280.png"),
  fullPage: false,
});

async function clickNavAndShot(sectionId, filename, titleSelector) {
  await page.locator(`[data-tasful-section-link="${sectionId}"]`).click();
  await page.waitForTimeout(1400);
  const belowAnchor = await page.evaluate((selector) => {
    const nav = document.querySelector("[data-tasful-product-section-nav]");
    const header = document.querySelector("[data-tasful-market-header]");
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const navBottom = nav?.getBoundingClientRect().bottom || headerBottom;
    const anchorBottom = Math.max(headerBottom, navBottom);
    const title = document.querySelector(selector);
    const rect = title?.getBoundingClientRect();
    return Boolean(rect && rect.top >= anchorBottom - 8);
  }, titleSelector);
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
  return belowAnchor;
}

const descriptionOk = await clickNavAndShot(
  "product-description",
  "market-product-detail-pc-nav-description-1280.png",
  "#product-description .tasful-market-product-description__title"
);
const specsOk = await clickNavAndShot(
  "product-info",
  "market-product-detail-pc-nav-specs-1280.png",
  "#product-info .tasful-market-product-specs__title"
);
const reviewsOk = await clickNavAndShot(
  "product-reviews",
  "market-product-detail-pc-nav-reviews-1280.png",
  "#product-reviews .tasful-market-product-reviews__title"
);

const report = await page.evaluate(() => {
  const nav = document.querySelector("[data-tasful-product-section-nav]");
  const navStyle = nav ? getComputedStyle(nav) : null;
  const links = Array.from(document.querySelectorAll("[data-tasful-section-link]"));
  const visibleLinks = links.filter((el) => !el.closest("li")?.hidden);
  const buybox = document.querySelector("[data-tasful-product-buybox]");
  const buyboxStyle = buybox ? getComputedStyle(buybox) : null;
  const sectionIds = ["product-about", "product-bundle", "product-description", "product-info", "product-reviews", "product-related"];
  const scrollMargins = sectionIds.map((id) => {
    const el = document.getElementById(id);
    return el ? getComputedStyle(el).scrollMarginTop : "";
  });
  const header = document.querySelector("[data-tasful-market-header]");
  const headerBottom = header?.getBoundingClientRect().bottom || 0;
  const navBottom = nav?.getBoundingClientRect().bottom || headerBottom;
  const navRect = nav?.getBoundingClientRect();
  const buyboxRect = buybox?.getBoundingClientRect();
  const overlap =
    Boolean(navRect && buyboxRect) &&
    navRect.right > buyboxRect.left &&
    navRect.top < buyboxRect.bottom &&
    navRect.bottom > buyboxRect.top;
  return {
    navVisible: navStyle?.display !== "none",
    navSticky: navStyle?.position === "sticky",
    linkCount: visibleLinks.length,
    buyboxSticky: buyboxStyle?.position === "sticky",
    scrollMargins,
    navBuyboxOverlap: overlap,
    docScrollOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
});

await browser.close();

const out = {
  baseUrl: base,
  detailPath: DETAIL_PATH,
  report: {
    ...report,
    descriptionBelowHeader: descriptionOk,
    specsBelowHeader: specsOk,
    reviewsBelowHeader: reviewsOk,
  },
  pass:
    report.navVisible &&
    report.navSticky &&
    report.linkCount >= 6 &&
    report.buyboxSticky &&
    descriptionOk &&
    specsOk &&
    reviewsOk &&
    !report.navBuyboxOverlap &&
    !report.docScrollOverflow,
  screenshots: [
    path.join(OUT_DIR, "market-product-detail-pc-nav-display-1280.png"),
    path.join(OUT_DIR, "market-product-detail-pc-nav-description-1280.png"),
    path.join(OUT_DIR, "market-product-detail-pc-nav-specs-1280.png"),
    path.join(OUT_DIR, "market-product-detail-pc-nav-reviews-1280.png"),
  ],
};

fs.writeFileSync(path.join(OUT_DIR, "nav-report.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
