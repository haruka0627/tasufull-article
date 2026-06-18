/**
 * TASFUL市場 商品詳細 — 最終微調整 1280px 提出スクショ
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

const shots = [
  { name: "market-product-detail-pc-final-first-view-1280.png", action: async () => page.evaluate(() => window.scrollTo(0, 0)) },
  {
    name: "market-product-detail-pc-final-description-1280.png",
    action: async () => page.locator("[data-tasful-product-description]").scrollIntoViewIfNeeded(),
  },
  {
    name: "market-product-detail-pc-final-specs-1280.png",
    action: async () => page.locator(".tasful-market-product-specs").scrollIntoViewIfNeeded(),
  },
  {
    name: "market-product-detail-pc-final-review-1280.png",
    action: async () => page.locator("#product-reviews").scrollIntoViewIfNeeded(),
  },
  {
    name: "market-product-detail-pc-final-related-1280.png",
    action: async () => page.locator(".tasful-market-product-related").scrollIntoViewIfNeeded(),
  },
];

for (const shot of shots) {
  await shot.action();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, shot.name), fullPage: false });
}

const report = await page.evaluate(() => {
  const specsMini = document.querySelector("[data-tasful-product-specs-mini]");
  const specsMiniStyle = specsMini ? getComputedStyle(specsMini) : null;
  const descSections = Array.from(
    document.querySelectorAll("[data-tasful-product-description-sections] .tasful-market-product-description__section img")
  ).map((img) => img.getAttribute("src") || "");
  const uniqueDescImages = new Set(descSections);
  const related = document.querySelectorAll("[data-tasful-product-shelf-related] .tasful-market-search-mini").length;
  const specsRows = document.querySelectorAll("[data-tasful-product-specs] table tr").length;
  return {
    specsMiniHidden: specsMiniStyle?.display === "none",
    descriptionSectionCount: descSections.length,
    uniqueDescriptionImages: uniqueDescImages.size,
    noDuplicateDescriptionImages: uniqueDescImages.size === descSections.length,
    relatedCount: related,
    specsRows,
  };
});

await browser.close();

const out = {
  baseUrl: base,
  detailPath: DETAIL_PATH,
  report,
  pass:
    report.specsMiniHidden &&
    report.descriptionSectionCount >= 5 &&
    report.noDuplicateDescriptionImages &&
    report.relatedCount === 4 &&
    report.specsRows >= 5,
  screenshots: shots.map((shot) => path.join(OUT_DIR, shot.name)),
};

fs.writeFileSync(path.join(OUT_DIR, "final-report.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
