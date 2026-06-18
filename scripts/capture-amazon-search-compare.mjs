/**
 * TASFUL市場 検索ページ — Amazon JP PC レイアウト検証（1280px + 390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "amazon-search-compare");
const VIEWPORT_PC = { width: 1280, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };
const CART_ITEMS_KEY = "tasu_market_cart_items";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

await withPlaywrightBrowser(async (browser) => {const demoCart = [
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

const page = await browser.newPage({ viewport: VIEWPORT_PC });
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.evaluate(
  ({ key, items }) => localStorage.setItem(key, JSON.stringify(items)),
  { key: CART_ITEMS_KEY, items: demoCart }
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
await page.waitForSelector("[data-tasful-market-search-filters-panel] .tasful-market-search-filter-panel", {
  timeout: 15000,
});
await page.waitForTimeout(800);

function collectPcMetrics() {
  return page.evaluate(() => {
    const layout = document.querySelector(".tasful-market-search-layout");
    const leftRail = document.querySelector("[data-tasful-market-search-filters-panel]");
    const rightRail = document.querySelector("[data-tasful-market-search-cart-rail]");
    const center = document.querySelector(".tasful-market-search-center");
    const grid = document.querySelector(".tasful-market-search-grid");
    const footer = document.querySelector(".tasful-market-footer--search");
    const shell = document.querySelector(".tasful-market-search-shell");
    const cards = Array.from(document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")).filter(
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
    const gridStyle = grid ? getComputedStyle(grid) : null;
    const gapParts = (gridStyle?.gap || "0").split(" ");
    const colGap = parseFloat(gapParts.length > 1 ? gapParts[1] : gapParts[0]) || 0;
    const rowGap = parseFloat(gapParts[0]) || 0;
    const layoutStyle = layout ? getComputedStyle(layout) : null;
    const scrollShelves = [...document.querySelectorAll(".tasful-market-search-shelf__scroll")];
    const visibleScrollShelves = scrollShelves.filter((el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    });
    const horizontalScrollEls = [...document.querySelectorAll(".tasful-market-search-main *")].filter((el) => {
      const cs = getComputedStyle(el);
      const ox = cs.overflowX;
      if (ox !== "auto" && ox !== "scroll") return false;
      return el.scrollWidth > el.clientWidth + 2;
    });
    const mobileOnlyShelves = [...document.querySelectorAll(".tasful-market-search-shelf--mobile-only")].filter(
      (el) => getComputedStyle(el).display !== "none"
    );
    const pcBottom = document.querySelector("[data-tasful-market-search-pc-bottom]");
    const pcBottomDisplay = pcBottom ? getComputedStyle(pcBottom).display : "none";
    const centerRect = center?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const footerInShell = shell?.contains(footer);
    const header = document.querySelector("[data-tasful-market-header]");
    const headerRect = header?.getBoundingClientRect();
    const leftRailRect = leftRail?.getBoundingClientRect();
    const rightRailRect = rightRail?.getBoundingClientRect();
    const headerBottom = headerRect?.bottom || 0;
    const stickyClearance =
      leftRailRect && headerBottom
        ? Math.min(leftRailRect.top - headerBottom, (rightRailRect?.top || 0) - headerBottom)
        : 0;
    const filterInputs = [...document.querySelectorAll(".tasful-market-search-filter-panel input")];
    const filterCheckboxCount = filterInputs.filter((el) => el.type === "checkbox").length;
    const filterRadioCount = filterInputs.filter((el) => el.type === "radio").length;
    const cartBtn = document.querySelector(".tasful-market-search-card__cart");
    const cartBtnStyle = cartBtn ? getComputedStyle(cartBtn) : null;
    const priceEl = document.querySelector(".tasful-market-search-card__price");
    const priceStyle = priceEl ? getComputedStyle(priceEl) : null;
    const titleEls = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card__title")].slice(
      0,
      5
    );
    const priceEls = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card__price")].slice(
      0,
      5
    );
    const cartEls = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card__cart")].slice(
      0,
      5
    );
    const titleTops = titleEls.map((el) => el.getBoundingClientRect().top);
    const priceTops = priceEls.map((el) => el.getBoundingClientRect().top);
    const cartTops = cartEls.map((el) => el.getBoundingClientRect().top);
    const titleTopSpread = titleTops.length ? Math.max(...titleTops) - Math.min(...titleTops) : 0;
    const priceTopSpread = priceTops.length ? Math.max(...priceTops) - Math.min(...priceTops) : 0;
    const cartTopSpread = cartTops.length ? Math.max(...cartTops) - Math.min(...cartTops) : 0;
    return {
      layoutCols: layoutStyle?.gridTemplateColumns || "",
      leftRailWidth: Math.round(leftRail?.getBoundingClientRect().width || 0),
      rightRailWidth: Math.round(rightRail?.getBoundingClientRect().width || 0),
      centerWidth: Math.round(centerRect?.width || 0),
      firstRowColumnCount: firstRowCols,
      gridColumnGap: colGap,
      gridRowGap: rowGap,
      gridOverflowX: gridStyle?.overflowX || "",
      visibleScrollShelfCount: visibleScrollShelves.length,
      horizontalScrollElementCount: horizontalScrollEls.length,
      mobileOnlyShelfVisibleCount: mobileOnlyShelves.length,
      pcBottomDisplay,
      brandCardCount: document.querySelectorAll(".tasful-market-search-brand-card").length,
      historyThumbCount: document.querySelectorAll(".tasful-market-search-history-thumb").length,
      footerWidth: Math.round(footerRect?.width || 0),
      viewportWidth: window.innerWidth,
      footerInShell,
      centerVsShellWidthRatio: shellRect?.width ? (centerRect?.width || 0) / shellRect.width : 0,
      scrollWidth: document.documentElement.scrollWidth,
      headerBottom: Math.round(headerBottom),
      stickyClearancePx: Math.round(stickyClearance),
      filterCheckboxCount,
      filterRadioCount,
      cartButtonBackground: cartBtnStyle?.backgroundColor || "",
      priceColor: priceStyle?.color || "",
      priceFontWeight: priceStyle?.fontWeight || "",
      titleTopSpreadPx: Math.round(titleTopSpread),
      priceTopSpreadPx: Math.round(priceTopSpread),
      cartTopSpreadPx: Math.round(cartTopSpread),
    };
  });
}

const pcMetrics = await collectPcMetrics();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(OUT_DIR, "01-pc-first-view.png"), fullPage: false });

await page.evaluate(() => {
  const grid = document.querySelector(".tasful-market-search-grid");
  if (grid) grid.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(400);
const pcMidMetrics = await collectPcMetrics();
await page.screenshot({ path: path.join(OUT_DIR, "02-pc-mid.png"), fullPage: false });

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT_DIR, "03-pc-bottom.png"), fullPage: false });
const pcBottomMetrics = await collectPcMetrics();

const mobilePage = await browser.newPage({ viewport: VIEWPORT_MOBILE });
await mobilePage.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(mobilePage);
await mobilePage.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
await mobilePage.waitForTimeout(600);
const mobileMetrics = await mobilePage.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  leftRailHidden: (() => {
    const el = document.querySelector("[data-tasful-market-search-filters-panel]");
    return el ? getComputedStyle(el).display === "none" : true;
  })(),
  rightRailHidden: (() => {
    const el = document.querySelector("[data-tasful-market-search-cart-rail]");
    return el ? getComputedStyle(el).display === "none" : true;
  })(),
  pcBottomHidden: (() => {
    const el = document.querySelector("[data-tasful-market-search-pc-bottom]");
    return el ? getComputedStyle(el).display === "none" : true;
  })(),
  chipFiltersVisible: (() => {
    const chips = document.querySelector("[data-tasful-market-search-filters]");
    return chips ? getComputedStyle(chips).display !== "none" : false;
  })(),
  mobileShelfVisible: (() => {
    const shelves = [...document.querySelectorAll(".tasful-market-search-shelf--mobile-only")];
    return shelves.some((el) => getComputedStyle(el).display !== "none");
  })(),
  gridCols: getComputedStyle(document.querySelector(".tasful-market-search-grid")).gridTemplateColumns,
}));
await mobilePage.screenshot({ path: path.join(OUT_DIR, "04-mobile-390.png"), fullPage: false });

});

const targets = {
  fiveGridColumns: pcMetrics.firstRowColumnCount >= 5,
  noVisibleScrollShelves: pcMetrics.visibleScrollShelfCount === 0,
  noHorizontalScrollInMain: pcMetrics.horizontalScrollElementCount === 0,
  mobileShelvesHiddenOnPc: pcMetrics.mobileOnlyShelfVisibleCount === 0,
  pcBottomVisible: pcMetrics.pcBottomDisplay === "block",
  leftRail240: pcMetrics.leftRailWidth >= 230 && pcMetrics.leftRailWidth <= 250,
  rightRailNarrow: pcMetrics.rightRailWidth >= 160 && pcMetrics.rightRailWidth <= 185,
  centerWideEnough: pcMetrics.centerWidth >= 620,
  gridColGap18: pcMetrics.gridColumnGap >= 16 && pcMetrics.gridColumnGap <= 20,
  stickyNoHeaderOverlap: pcMidMetrics.stickyClearancePx >= 0,
  filterUsesCheckbox: pcMetrics.filterCheckboxCount >= 10 && pcMetrics.filterRadioCount === 0,
  cardPriceAligned: pcMetrics.priceTopSpreadPx <= 4,
  cardCartAligned: pcMetrics.cartTopSpreadPx <= 4,
  subduedCartButton: /rgb\(255,\s*247,\s*204\)|#fff7cc/i.test(pcMetrics.cartButtonBackground),
  footerFullWidth: pcMetrics.footerWidth >= pcMetrics.viewportWidth - 2,
  footerOutsideShell: !pcMetrics.footerInShell,
  mobileScrollWidth390: mobileMetrics.scrollWidth === 390,
  mobileRailsHidden: mobileMetrics.leftRailHidden && mobileMetrics.rightRailHidden,
  mobilePcBottomHidden: mobileMetrics.pcBottomHidden,
  mobileShelvesVisible: mobileMetrics.mobileShelfVisible,
};

const pass = Object.values(targets).every(Boolean);

const report = {
  capturedAt: new Date().toISOString(),
  searchUrl,
  viewport: VIEWPORT_PC,
  screenshots: {
    firstView: "screenshots/amazon-search-compare/01-pc-first-view.png",
    mid: "screenshots/amazon-search-compare/02-pc-mid.png",
    bottom: "screenshots/amazon-search-compare/03-pc-bottom.png",
    mobile390: "screenshots/amazon-search-compare/04-mobile-390.png",
  },
  pc: pcMetrics,
  pcMidScroll: pcMidMetrics,
  pcBottomScroll: pcBottomMetrics,
  mobile: mobileMetrics,
  targets,
  pass,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
