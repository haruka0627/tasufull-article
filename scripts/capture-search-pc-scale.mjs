/**
 * TASFUL市場 検索ページ — PC大型化検証（1280 / 1440 / 1920 + 390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "search-pc-scale");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 900 },
];
const VIEWPORT_MOBILE = { width: 390, height: 844 };
const CART_ITEMS_KEY = "tasu_market_cart_items";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

const demoCart = [
  {
    shopId: "demo-shop-cafe",
    productId: "p-1",
    qty: 1,
    title: "スペシャルティコーヒー",
    price: "¥580",
    image: "https://images.unsplash.com/photo-1461023058943-07fcbeecadfb?auto=format&fit=crop&w=120&q=80",
    shopName: "豆と焙煎",
    conditionLabel: "新品",
    connectVerified: true,
    freeShipping: true,
  },
  {
    shopId: "demo-shop-bakery",
    productId: "p-0",
    qty: 2,
    title: "クロワッサン",
    price: "¥320",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=120&q=80",
    shopName: "麦の香",
    conditionLabel: "新品",
    connectVerified: false,
    freeShipping: true,
  },
];

function collectMetrics() {
  return page.evaluate(() => {
    const header = document.querySelector("[data-tasful-market-header], .tasful-market-mall-header");
    const headerRect = header?.getBoundingClientRect();
    const headerBottom = headerRect?.bottom || 0;
    const leftRail = document.querySelector("[data-tasful-market-search-filters-panel]");
    const rightRail = document.querySelector("[data-tasful-market-search-cart-rail]");
    const leftRailRect = leftRail?.getBoundingClientRect();
    const rightRailRect = rightRail?.getBoundingClientRect();
    const filterPanel = document.querySelector(".tasful-market-search-filter-panel");
    const cartBox = document.querySelector(".tasful-market-search-cart-rail__box");
    const cards = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].filter(
      (c) => !c.classList.contains("recommend-fill")
    );
    const cardRects = cards.slice(0, 10).map((c) => c.getBoundingClientRect());
    const rowGroups = [];
    cardRects.forEach((rect) => {
      const row = rowGroups.find((g) => Math.abs(g.top - rect.top) < 8);
      if (row) row.count += 1;
      else rowGroups.push({ top: rect.top, count: 1 });
    });
    const firstRowCols = rowGroups.sort((a, b) => a.top - b.top)[0]?.count || 0;
    const firstImg = document.querySelector(".tasful-market-search-grid .tasful-market-search-card__img");
    const imgRect = firstImg?.getBoundingClientRect();
    const filterHeading = document.querySelector(".tasful-market-search-filter-panel__heading");
    const cartTitle = document.querySelector(".tasful-market-search-cart-rail__title");
    const checkout = document.querySelector(".tasful-market-search-cart-rail__checkout");
    const scrollShelves = [...document.querySelectorAll(".tasful-market-search-shelf__scroll")].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && el.offsetParent !== null;
    });
    const horizontalScrollEls = [...document.querySelectorAll(".tasful-market-search-main *")].filter((el) => {
      const cs = getComputedStyle(el);
      const ox = cs.overflowX;
      if (ox !== "auto" && ox !== "scroll") return false;
      return el.scrollWidth > el.clientWidth + 2;
    });
    const edgePopover = document.querySelector(".tasful-rating.is-edge .tasful-rating-popover");
    const edgeRect = edgePopover?.getBoundingClientRect();
    const layout = document.querySelector(".tasful-market-search-layout");
    const layoutStyle = layout ? getComputedStyle(layout) : null;
    return {
      viewportWidth: window.innerWidth,
      gridColumns: firstRowCols,
      productImageSize: Math.round(imgRect?.width || 0),
      productImageHeight: Math.round(imgRect?.height || 0),
      filterPanelWidth: Math.round(filterPanel?.getBoundingClientRect().width || 0),
      cartBoxWidth: Math.round(cartBox?.getBoundingClientRect().width || 0),
      filterHeadingFontSize: filterHeading ? getComputedStyle(filterHeading).fontSize : "",
      cartTitleFontSize: cartTitle ? getComputedStyle(cartTitle).fontSize : "",
      checkoutFontSize: checkout ? getComputedStyle(checkout).fontSize : "",
      leftRailClearOfHeader: (leftRailRect?.top || 0) >= headerBottom - 1,
      rightRailClearOfHeader: (rightRailRect?.top || 0) >= headerBottom - 1,
      leftRailTop: leftRailRect?.top || 0,
      rightRailTop: rightRailRect?.top || 0,
      horizontalScrollShelfCount: scrollShelves.length,
      horizontalOverflowCount: horizontalScrollEls.length,
      layoutColumns: layoutStyle?.gridTemplateColumns || "",
      edgeNotClipped: edgeRect ? edgeRect.right <= window.innerWidth + 1 && edgeRect.left >= 0 : null,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.evaluate(
  ({ key, items }) => localStorage.setItem(key, JSON.stringify(items)),
  { key: CART_ITEMS_KEY, items: demoCart }
);

const viewportReports = {};

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);

  const metrics = await collectMetrics();
  viewportReports[vp.name] = metrics;
  await page.screenshot({ path: path.join(OUT_DIR, `pc-first-view-${vp.name}.png`), fullPage: false });

  const firstRating = page.locator(".tasful-market-search-grid .tasful-rating").first();
  await firstRating.hover();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT_DIR, `pc-popover-${vp.name}.png`), fullPage: false });

  const edgeRating = page.locator(".tasful-market-search-grid .tasful-rating.is-edge").first();
  if ((await edgeRating.count()) > 0) {
    await edgeRating.hover();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT_DIR, `pc-popover-edge-${vp.name}.png`), fullPage: false });
  }

  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 560));
  await page.waitForTimeout(450);
  viewportReports[`${vp.name}_scroll`] = await collectMetrics();
  await page.screenshot({ path: path.join(OUT_DIR, `pc-scroll-${vp.name}.png`), fullPage: false });
}

await page.setViewportSize(VIEWPORT_MOBILE);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);

const mobileMetrics = await page.evaluate(() => {
  const popover = document.querySelector(".tasful-rating-popover");
  const pcRow = document.querySelector(".tasful-market-search-card__rating-row--pc");
  const legacy = document.querySelector(".tasful-market-search-card__rating--legacy");
  const grid = document.querySelector(".tasful-market-search-grid");
  return {
    popoverDisplay: popover ? getComputedStyle(popover).display : "none",
    pcRowDisplay: pcRow ? getComputedStyle(pcRow).display : "none",
    legacyDisplay: legacy ? getComputedStyle(legacy).display : "none",
    gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "mobile-390-unchanged.png"), fullPage: false });

const report = {
  capturedAt: new Date().toISOString(),
  url: searchUrl,
  viewports: viewportReports,
  mobile: mobileMetrics,
  changedFiles: ["shop-market-search.css", "shop-market-pc.css"],
  status: "pc-search-scale-complete",
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
