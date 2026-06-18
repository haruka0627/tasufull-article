/**
 * 商品詳細 UX改善 — Store Info / レビュータブ / 購入BOX信頼情報 検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "product-detail-ux-ship";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);

const SHOP_ID = "demo-shop-bakery";
const PRODUCT_ID = "p-0";
const PRODUCT_QUERY = `shopId=${SHOP_ID}&productId=${PRODUCT_ID}`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "detail-shop-product.html" });
const productUrl = buildLocalPageUrl(base, `detail-shop-product.html?${PRODUCT_QUERY}`);
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

const report = {
  capturedAt: new Date().toISOString(),
  implementation: "product detail UX: store info, review tab, buybox trust",
  url: productUrl,
  productQuery: PRODUCT_QUERY,
  results: {},
  overall: "PASS",
  fail: 0,
  pass: 0,
};

async function waitForProduct() {
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 25000 });
  await page.waitForTimeout(400);
}

async function collectUxMetrics() {
  return page.evaluate(() => {
    const buybox = document.querySelector("[data-tasful-product-buybox]");
    const buyboxCs = buybox ? getComputedStyle(buybox) : null;
    const store = document.querySelector("[data-tasful-product-buybox-store]");
    const trust = document.querySelector("[data-tasful-product-buybox-trust]");
    const overview = document.querySelector("[data-tasful-product-reviews-overview]");
    const scoreBlock = overview?.querySelector("[data-tasful-product-reviews-score]");
    const distribution = overview?.querySelector(".tasful-market-product-reviews__distribution");
    const tags = overview?.querySelectorAll(".tasful-market-product-reviews__tag");
    const media = overview?.querySelector(".tasful-market-product-reviews__media-section");
    const reviewList = document.querySelector("[data-tasful-product-reviews-list]");
    const moreBtn = document.querySelector("[data-tasful-product-reviews-more]");
    const sellerCard = document.querySelector("[data-tasful-product-seller-card]");
    const sellerCs = sellerCard ? getComputedStyle(sellerCard) : null;

    const storeLinks = store
      ? [...store.querySelectorAll("a")].map((a) => ({
          text: (a.textContent || "").trim(),
          href: a.getAttribute("href") || "",
        }))
      : [];
    const storeFollow = store?.querySelector("[data-tasful-product-buybox-follow]");

    const trustText = (trust?.textContent || "").replace(/\s+/g, " ").trim();
    const docScroll = document.documentElement.scrollWidth;
    const vw = window.innerWidth;

    const reviewsLayout = document.querySelector(".tasful-market-product-reviews__layout");
    const mainCol = reviewsLayout?.querySelector(".tasful-market-product-reviews__main");
    const sidebarCol = reviewsLayout?.querySelector(".tasful-market-product-reviews__sidebar");
    const mainRect = mainCol?.getBoundingClientRect();
    const sidebarRect = sidebarCol?.getBoundingClientRect();

    return {
      viewportWidth: vw,
      horizontalOverflow: docScroll > vw + 2,
      buyboxVisible: buyboxCs?.display !== "none" && buybox?.offsetParent !== null,
      storeVisible: store && store.children.length > 0 && store.offsetParent !== null,
      storeLinkCount: storeLinks.length,
      storeLinks,
      hasStoreFollow: !!storeFollow,
      trustHasConnect: /Connect認証済み/.test(trustText),
      trustHasIdentity: /本人確認済み/.test(trustText),
      trustHasReviewLabel: /レビュー\d+件/.test(trustText),
      trustHasDealsLabel: /取引\d+件/.test(trustText),
      trustHasStars: /★/.test(trustText),
      overviewHasScore: !!scoreBlock,
      overviewHasDistribution: !!distribution,
      overviewTagCount: tags?.length || 0,
      overviewHasMedia: !!media,
      reviewItemCount: reviewList?.children.length || 0,
      hasMoreReviewsBtn: !!moreBtn && moreBtn.offsetParent !== null,
      sellerCardVisible: sellerCs?.display !== "none" && sellerCard?.offsetParent !== null,
      reviewsMainLeft: mainRect && sidebarRect ? mainRect.left < sidebarRect.left : null,
      reviewsMainWider: mainRect && sidebarRect ? mainRect.width > sidebarRect.width : null,
    };
  });
}

function checkPc(metrics) {
  const fails = [];
  if (!metrics.buyboxVisible) fails.push("buybox not visible");
  if (!metrics.storeVisible) fails.push("store info missing");
  if (metrics.storeLinkCount < 3) fails.push(`store links ${metrics.storeLinkCount} < 3`);
  if (!metrics.hasStoreFollow) fails.push("store follow btn missing");
  if (!metrics.trustHasConnect && !metrics.trustHasIdentity) fails.push("buybox trust badges missing");
  if (!metrics.trustHasReviewLabel) fails.push("buybox trust review label missing");
  if (!metrics.trustHasDealsLabel) fails.push("buybox trust deals label missing");
  if (!metrics.trustHasStars) fails.push("buybox trust stars missing");
  if (!metrics.overviewHasScore) fails.push("overview score missing");
  if (!metrics.overviewHasDistribution) fails.push("overview distribution missing");
  if (metrics.overviewTagCount < 4) fails.push(`overview tags ${metrics.overviewTagCount} < 4`);
  if (metrics.reviewItemCount < 1) fails.push("review list empty");
  if (!metrics.hasMoreReviewsBtn) fails.push("more reviews btn missing");
  if (metrics.horizontalOverflow) fails.push("horizontal overflow");
  return { pass: fails.length === 0, fails, metrics };
}

function checkSp(metrics) {
  const fails = [];
  if (metrics.buyboxVisible) fails.push("buybox visible on SP");
  if (!metrics.sellerCardVisible) fails.push("seller card missing on SP");
  if (!metrics.overviewHasScore) fails.push("overview score missing");
  if (!metrics.overviewHasDistribution) fails.push("overview distribution missing");
  if (metrics.overviewTagCount < 4) fails.push(`overview tags ${metrics.overviewTagCount} < 4`);
  if (metrics.horizontalOverflow) fails.push("horizontal overflow");
  const sellerLinks = metrics.storeLinks?.length || 0;
  if (sellerLinks > 0 && metrics.buyboxVisible) fails.push("unexpected buybox store links on SP");
  return { pass: fails.length === 0, fails, metrics };
}

async function openReviewsTab() {
  const tab = page.locator('[data-tasful-section-link="product-reviews"]');
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => {
    const el = document.getElementById("product-reviews");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(300);
}

async function captureBuyboxCrop(outPath) {
  const box = page.locator("[data-tasful-product-buybox]");
  if (await box.count()) {
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await box.screenshot({ path: outPath });
    return true;
  }
  return false;
}

const shots = [];

// 1280 — 商品詳細
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await waitForProduct();
await page.evaluate(() => window.scrollTo(0, 0));
const detail1280 = path.join(OUT_DIR, "product-detail-1280.png");
await page.screenshot({ path: detail1280, fullPage: false });
shots.push({ file: "product-detail-1280.png", label: "商品詳細 1280px", url: `detail-shop-product.html?${PRODUCT_QUERY}`, viewport: "1280" });

// 1280 — レビュータブ
await openReviewsTab();
const reviews1280 = path.join(OUT_DIR, "product-detail-reviews-1280.png");
await page.screenshot({ path: reviews1280, fullPage: false });
shots.push({ file: "product-detail-reviews-1280.png", label: "レビュータブ 1280px", url: `detail-shop-product.html?${PRODUCT_QUERY}#product-reviews`, viewport: "1280" });

const metrics1280Reviews = await collectUxMetrics();
const check1280Reviews = checkPc(metrics1280Reviews);
report.results["1280-reviews"] = {
  metrics: metrics1280Reviews,
  checks: check1280Reviews.fails,
  pass: check1280Reviews.pass,
  screenshot: path.relative(ROOT, reviews1280).replace(/\\/g, "/"),
};

// 1280 — 購入BOX / Store Info
await page.evaluate(() => window.scrollTo(0, 0));
const buybox1280 = path.join(OUT_DIR, "product-detail-buybox-1280.png");
await captureBuyboxCrop(buybox1280);
shots.push({ file: "product-detail-buybox-1280.png", label: "購入BOX・Store Info 1280px", url: `detail-shop-product.html?${PRODUCT_QUERY}`, viewport: "1280" });

const metrics1280 = await collectUxMetrics();
const check1280 = checkPc(metrics1280);
report.results["1280"] = {
  metrics: metrics1280,
  checks: check1280.fails,
  pass: check1280.pass,
  screenshot: path.relative(ROOT, detail1280).replace(/\\/g, "/"),
};

if (check1280.pass) report.pass += 1;
else {
  report.fail += 1;
  report.overall = "FAIL";
}
if (check1280Reviews.pass) report.pass += 1;
else {
  report.fail += 1;
  report.overall = "FAIL";
}

// 390 — 商品詳細
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await waitForProduct();
await page.evaluate(() => window.scrollTo(0, 0));
const detail390 = path.join(OUT_DIR, "product-detail-390.png");
await page.screenshot({ path: detail390, fullPage: false });
shots.push({ file: "product-detail-390.png", label: "商品詳細 390px", url: `detail-shop-product.html?${PRODUCT_QUERY}`, viewport: "390" });

// 390 — レビュータブ
await openReviewsTab();
const reviews390 = path.join(OUT_DIR, "product-detail-reviews-390.png");
await page.screenshot({ path: reviews390, fullPage: false });
shots.push({ file: "product-detail-reviews-390.png", label: "レビュータブ 390px", url: `detail-shop-product.html?${PRODUCT_QUERY}#product-reviews`, viewport: "390" });

const metrics390 = await collectUxMetrics();
const check390 = checkSp(metrics390);
report.results["390"] = {
  metrics: metrics390,
  checks: check390.fails,
  pass: check390.pass,
  screenshot: path.relative(ROOT, detail390).replace(/\\/g, "/"),
};
report.results["390-reviews"] = {
  metrics: metrics390,
  checks: check390.fails,
  pass: check390.pass,
  screenshot: path.relative(ROOT, reviews390).replace(/\\/g, "/"),
};

if (check390.pass) report.pass += 1;
else {
  report.fail += 1;
  report.overall = "FAIL";
}

const md = `# 商品詳細 UX改善 — 検証

生成: ${report.capturedAt}

## 実装

- 購入BOX下 Store Info（店舗TOP / 商品一覧 / 店舗レビュー / フォロー）
- 購入BOX内コンパクト信頼情報
- レビュータブ統合（総合評価 → 分布 → タグ → 写真 → 個別 → もっと見る）
- 評価・レビュー・取引のラベル表記

## 結果: **${report.overall}**

| チェック | 判定 | 備考 |
|----------|------|------|
| 1280 購入BOX/Store | ${check1280.pass ? "PASS" : check1280.fails.join(", ")} | store links ${metrics1280.storeLinkCount} |
| 1280 レビュータブ | ${check1280Reviews.pass ? "PASS" : check1280Reviews.fails.join(", ")} | tags ${metrics1280Reviews.overviewTagCount} |
| 390 SP | ${check390.pass ? "PASS" : check390.fails.join(", ")} | overflow ${metrics390.horizontalOverflow} |
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "商品詳細 UX改善（Store Info・レビュータブ・信頼情報）",
  report,
  targetPage: "detail-shop-product.html",
  viewports: ["390", "1280"],
  overall: report.overall,
  pass: report.pass,
  fail: report.fail,
  screenshotCatalog: shots,
});

console.log("1280", check1280.pass ? "PASS" : "FAIL", check1280.fails);
console.log("1280-reviews", check1280Reviews.pass ? "PASS" : "FAIL", check1280Reviews.fails);
console.log("390", check390.pass ? "PASS" : "FAIL", check390.fails);
console.log("\nOVERALL:", report.overall);

});

await closeAllBrowsers();
