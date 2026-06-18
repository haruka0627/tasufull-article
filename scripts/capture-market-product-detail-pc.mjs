/**
 * TASFUL市場 商品詳細 — PC 1280 / 1440 検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-product-detail-pc");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });

const detailPath = await page.evaluate(() => {
  const link = document.querySelector(".tasful-market-search-card__link")?.getAttribute("href") || "";
  return link.replace(/^\//, "");
});

if (!detailPath) {
  console.log(JSON.stringify({ pass: false, reason: "no-detail-link" }, null, 2));
  await closeAllBrowsers();
  process.exit(1);
}

const reports = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(buildLocalPageUrl(base, detailPath), { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(400);

  const report = await page.evaluate((viewportName) => {
    const main = document.querySelector("[data-tasful-product-main]");
    const mainRect = main?.getBoundingClientRect();
    const mainStyle = main ? getComputedStyle(main) : null;
    const layout = document.querySelector(".tasful-market-product-hero__layout");
    const layoutStyle = layout ? getComputedStyle(layout) : null;
    const media = document.querySelector("[data-tasful-product-gallery]");
    const info = document.querySelector(".tasful-market-product-hero__info");
    const buybox = document.querySelector("[data-tasful-product-buybox]");
    const buyboxStyle = buybox ? getComputedStyle(buybox) : null;
    const mediaRect = media?.getBoundingClientRect();
    const infoRect = info?.getBoundingClientRect();
    const buyboxRect = buybox?.getBoundingClientRect();
    const mainImg = document.querySelector("[data-tasful-product-image]");
    const title = document.querySelector("[data-tasful-product-title]");
    const titleRect = title?.getBoundingClientRect();
    const titleStyle = title ? getComputedStyle(title) : null;
    const titleText = title?.textContent?.trim() || "";
    const trust = document.querySelector("[data-tasful-product-trust]");
    const trustRect = trust?.getBoundingClientRect();
    const trustBadges = document.querySelectorAll("[data-tasful-product-trust] .tasful-market-product-trust__badge");
    const visibleTrustBadges = Array.from(trustBadges).filter((el) => getComputedStyle(el).display !== "none");
    const trustLineRects = visibleTrustBadges.map((el) => el.getBoundingClientRect());
    const trustHasConnect = /Connect認証済み/.test(trust?.textContent || "");
    const trustHasIdentity = /本人確認済み/.test(trust?.textContent || "");
    const centerPrice = document.querySelector("[data-tasful-product-price]")?.textContent || "";
    const buyboxPrice = document.querySelector("[data-tasful-product-buybox-price]")?.textContent || "";
    const mobileCommerce = document.querySelector("[data-tasful-product-mobile-commerce]");
    const specsTable = document.querySelectorAll("[data-tasful-product-specs] table tr").length;
    const bundle = document.querySelector("[data-tasful-product-frequently-bought]");
    const related = document.querySelectorAll("[data-tasful-product-shelf-related] .tasful-market-search-mini").length;
    const descriptionSections = document.querySelectorAll("[data-tasful-product-description-sections] .tasful-market-product-description__section").length;
    const reviewPhotos = document.querySelectorAll("[data-tasful-product-reviews-media] .tasful-market-product-reviews__photo-slot img").length;
    const reviewDist = document.querySelectorAll(".tasful-market-product-reviews__dist-row").length;
    const docScrollOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const titleCharPerLineCollapse =
      titleText.length > 8 && titleRect && titleRect.width > 0 && titleRect.width / Math.max(1, titleText.length) < 6;
    const trustWritingMode = trust ? getComputedStyle(trust).writingMode : "horizontal-tb";
    const trustLineWidths = trustLineRects.map((rect) => Math.round(rect.width));
    const trustCharCollapse = visibleTrustBadges.some((el, i) => {
      const text = el.textContent?.trim() || "";
      const w = Math.round(trustLineRects[i]?.width || 0);
      return text.length > 4 && w < 28;
    });
    const trustVerticalStack =
      trustLineRects.length >= 2 &&
      trustLineRects.every((rect, i, arr) => i === 0 || rect.top > arr[i - 1].top + rect.height * 0.5);
    const layoutOverflowsMain = Boolean(layout && main) && layout.scrollWidth > main.clientWidth + 1;
    const buyboxInViewport = buyboxRect
      ? buyboxRect.right <= window.innerWidth + 1 && buyboxRect.left >= 0
      : false;
    return {
      viewport: viewportName,
      gridColumns: layoutStyle?.gridTemplateColumns || "",
      isThreeColumn:
        Boolean(mediaRect && infoRect && buyboxRect) &&
        mediaRect.left < infoRect.left &&
        infoRect.left < buyboxRect.left &&
        buyboxStyle?.display !== "none",
      mainWidth: Math.round(mainRect?.width || 0),
      mainMaxWidth: mainStyle?.maxWidth || "",
      infoWidth: Math.round(infoRect?.width || 0),
      buyboxWidth: Math.round(buyboxRect?.width || 0),
      mainImageWidth: Math.round(mainImg?.getBoundingClientRect().width || 0),
      buyboxVisible: buyboxStyle?.display !== "none",
      mobileCommerceHidden: mobileCommerce ? getComputedStyle(mobileCommerce).display === "none" : true,
      trustLines: trustLineRects.length,
      trustWidth: Math.round(trustRect?.width || 0),
      trustHasConnect,
      trustHasIdentity,
      trustWritingMode,
      trustLineWidths,
      trustCharCollapse,
      trustVerticalStack,
      hasCenterPrice: /¥/.test(centerPrice),
      hasBuyboxPrice: /¥/.test(buyboxPrice),
      specsTableRows: specsTable,
      bundleVisible: bundle ? !bundle.hidden : false,
      relatedCount: related,
      descriptionSections,
      reviewPhotos,
      reviewDistRows: reviewDist,
      sellerMobileHidden: getComputedStyle(document.querySelector(".tasful-market-product-seller--mobile") || document.body).display === "none",
      docScrollOverflow,
      titleCharPerLineCollapse,
      titleWidth: Math.round(titleRect?.width || 0),
      titleLineHeight: parseFloat(titleStyle?.lineHeight || "0"),
      layoutScrollWidth: layout?.scrollWidth || 0,
      layoutClientWidth: layout?.clientWidth || 0,
      mainOverflowX: mainStyle?.overflowX || "",
      layoutOverflowsMain,
      buyboxInViewport,
      buyboxRight: Math.round(buyboxRect?.right || 0),
    };
  }, vp.name);

  await page.screenshot({
    path: path.join(OUT_DIR, `market-product-detail-pc-first-view-${vp.name}.png`),
    fullPage: false,
  });
  await page.screenshot({
    path: path.join(OUT_DIR, `market-product-detail-pc-full-${vp.name}.png`),
    fullPage: true,
  });

  const minImage = 480;
  const minMain = 1220;
  const minCenter = 340;
  report.pass =
    report.isThreeColumn &&
    report.mainWidth >= minMain &&
    report.buyboxVisible &&
    report.buyboxInViewport &&
    !report.layoutOverflowsMain &&
    report.mainOverflowX === "visible" &&
    report.buyboxWidth >= 270 &&
    report.buyboxWidth <= 290 &&
    report.infoWidth >= minCenter &&
    report.mobileCommerceHidden &&
    report.mainImageWidth >= minImage &&
    report.trustLines >= 2 &&
    report.trustHasConnect &&
    report.trustHasIdentity &&
    !report.trustCharCollapse &&
    report.trustWritingMode === "horizontal-tb" &&
    report.hasCenterPrice &&
    report.hasBuyboxPrice &&
    report.specsTableRows >= 5 &&
    report.relatedCount >= 3 &&
    report.descriptionSections >= 3 &&
    report.reviewPhotos >= 1 &&
    report.reviewDistRows === 5 &&
    report.sellerMobileHidden &&
    !report.docScrollOverflow &&
    !report.titleCharPerLineCollapse;

  reports.push(report);
}

});

const pass = reports.every((r) => r.pass);
const out = { baseUrl: base, detailPath, reports, pass };
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
