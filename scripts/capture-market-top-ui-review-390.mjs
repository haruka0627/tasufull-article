/**
 * TASFUL市場 TOP — UIレビュー用 390px 端末画面キャプチャ
 * ビューポート 390px のみ。必ず http://localhost 経由（file:// 禁止）。
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-top-390");
const VIEWPORT = { width: 390, height: 844 };

async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
}

async function scrollToSelector(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const stack = document.querySelector(".tasful-market-header-stack");
    const nav = document.querySelector(".tasful-market-header__nav");
    const offset = (stack?.offsetHeight || 0) + (nav?.offsetHeight || 0) + 4;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo(0, Math.max(0, top));
  }, selector);
  await page.waitForTimeout(350);
}

/** 端末ビューポートのみ（390×844） */
async function shotViewport(page, filePath) {
  await page.screenshot({
    path: filePath,
    fullPage: false,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });
}

/** 要素全体を390px幅でキャプチャ（縦は要素高さ） */
async function shotElement(page, selector, filePath) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 10000 });
  await el.screenshot({ path: filePath });
}

/** ヘッダー上端〜タイムセールセクション下端（390px幅） */
async function shotTopHeaderRegion(page, filePath) {
  const clip = await page.evaluate(() => {
    const stack = document.querySelector(".tasful-market-header-stack");
    const timesale = document.querySelector("#tasful-market-timesale-section");
    if (!stack || !timesale) return null;
    const startTop = stack.getBoundingClientRect().top + window.scrollY;
    const bottom = timesale.getBoundingClientRect().bottom + window.scrollY;
    const height = Math.ceil(bottom - startTop + 12);
    return {
      x: 0,
      y: Math.max(0, Math.floor(startTop)),
      width: 390,
      height: Math.min(Math.max(height, 480), 1300),
    };
  });
  if (!clip) throw new Error("top-header clip region not found");
  await page.screenshot({ path: filePath, clip });
}

/** タイムセール〜人気ランキング（390px幅） */
async function shotTimesaleRankingRegion(page, filePath) {
  const clip = await page.evaluate(() => {
    const timesale = document.querySelector("#tasful-market-timesale-section");
    const ranking = document.querySelector("#tasful-market-rank-section");
    if (!timesale || !ranking) return null;
    const startTop = timesale.getBoundingClientRect().top + window.scrollY;
    const bottom = ranking.getBoundingClientRect().bottom + window.scrollY;
    const height = Math.ceil(bottom - startTop + 12);
    return {
      x: 0,
      y: Math.max(0, Math.floor(startTop)),
      width: 390,
      height: Math.min(Math.max(height, 320), 1600),
    };
  });
  if (!clip) throw new Error("time-sale-ranking clip region not found");
  await page.screenshot({ path: filePath, clip });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const pageUrl = buildLocalPageUrl(base, "shop-store.html");

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: VIEWPORT });

await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-card", { timeout: 15000 });
await page.waitForSelector("[data-tasful-market-nav-item]", { timeout: 15000 });
await page.waitForTimeout(600);

const files = {
  topHeader: path.join(OUT_DIR, "01-top-header.png"),
  timeSaleRanking: path.join(OUT_DIR, "02-time-sale-ranking.png"),
  newItemsGrid: path.join(OUT_DIR, "04-new-items-grid.png"),
  fullPage: path.join(OUT_DIR, "05-full-page.png"),
  legacy: path.join(OUT_DIR, "market-home-mobile390.png"),
};

// 01: 検索バー〜タイムセール
await scrollToTop(page);
await shotTopHeaderRegion(page, files.topHeader);

// 02: タイムセール + 人気ランキング
await scrollToTop(page);
await shotTimesaleRankingRegion(page, files.timeSaleRanking);

// 04: 新着商品グリッド + もっと見るリンク
await scrollToSelector(page, "#tasful-market-new-section");
await shotElement(page, "#tasful-market-new-section", files.newItemsGrid);

// 05: ページ全体（幅390pxのみ）
await scrollToTop(page);
await page.screenshot({ path: files.fullPage, fullPage: true });

// 互換: ファーストビュー viewport のみ
await scrollToTop(page);
await shotViewport(page, files.legacy);

const report = await page.evaluate(() => {
  const countdown = document.querySelector("#tasful-market-timesale-section .tasful-market-section__countdown");
  const timesaleWas = document.querySelector("[data-tasful-market-timesale] .tasful-market-card__price-was");
  const timesaleSale = document.querySelector("[data-tasful-market-timesale] .tasful-market-card__price-sale");
  const newGrid = document.querySelector("[data-tasful-market-new] .tasful-market-grid");
  const newCards = document.querySelectorAll("[data-tasful-market-new] .tasful-market-card");
  const newMore = document.querySelector("[data-tasful-market-new-more] .tasful-market-section__more-link");
  const metaLines = Array.from(document.querySelectorAll(".tasful-market-card__meta"));
  const metaBottomSpace = metaLines.length
    ? metaLines.every((el) => {
        const mb = parseFloat(getComputedStyle(el).marginBottom) || 0;
        return mb >= 4;
      })
    : false;

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    hasCountdown: Boolean(countdown && (countdown.textContent || "").includes("残り2時間")),
    hasTimesaleWasPrice: Boolean(timesaleWas),
    hasTimesaleSalePrice: Boolean(timesaleSale),
    hasNewGrid: Boolean(newGrid),
    newCardCount: newCards.length,
    newGridColumns: newGrid ? getComputedStyle(newGrid).gridTemplateColumns : null,
    newMoreText: (newMore?.textContent || "").trim(),
    metaBottomSpace,
    taxDuplicate: Array.from(document.querySelectorAll(".tasful-market-card__price")).some((el) => {
      const t = el.textContent || "";
      return (t.match(/\(税込\)/g) || []).length > 1;
    }),
  };
});

});

const pass =
  report.hasCountdown &&
  report.hasTimesaleWasPrice &&
  report.hasTimesaleSalePrice &&
  report.hasNewGrid &&
  report.newCardCount >= 1 &&
  report.newCardCount <= 6 &&
  report.newMoreText === "新着商品をすべて見る ＞" &&
  report.metaBottomSpace &&
  !report.taxDuplicate;

console.log(JSON.stringify({ baseUrl: base, pageUrl, outDir: OUT_DIR, files, report, pass }, null, 2));
console.log("DONE: UI review screenshots at 390px viewport");
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
