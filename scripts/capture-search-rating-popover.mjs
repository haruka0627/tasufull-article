/**
 * TASFUL市場 検索ページ — 信用ポップオーバー検証（1280px + 390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "search-rating-popover");
const VIEWPORT_PC = { width: 1280, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

function collectLayoutMetrics() {
  return page.evaluate(() => {
    const header = document.querySelector("[data-tasful-market-header], .tasful-market-mall-header");
    const headerRect = header?.getBoundingClientRect();
    const headerBottom = headerRect?.bottom || 0;
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
    const firstCardTop = cards[0]?.getBoundingClientRect().top || 0;
    const visibleCards = cards
      .map((card, index) => {
        const rect = card.getBoundingClientRect();
        const hiddenUnderHeader = rect.top < headerBottom - 1;
        const connectBadge = card.querySelector(".tasful-market-search-card__badge-connect--inline");
        return {
          index,
          top: rect.top,
          hiddenUnderHeader,
          connectVisible: connectBadge ? getComputedStyle(connectBadge).display !== "none" : false,
        };
      })
      .filter((item) => item.top < window.innerHeight && item.top > -40);
    const popover = document.querySelector(".tasful-rating-popover");
    const popoverStyle = popover ? getComputedStyle(popover) : null;
    const popoverRect = popover?.getBoundingClientRect();
    const edgePopover = document.querySelector(".tasful-rating.is-edge .tasful-rating-popover");
    const edgeRect = edgePopover?.getBoundingClientRect();
    const bodyStyle = getComputedStyle(document.body);
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
    const legacyRatingVisible = [...document.querySelectorAll(".tasful-market-search-card__rating--legacy")].some(
      (el) => getComputedStyle(el).display !== "none"
    );
    const pcRatingRowVisible = [...document.querySelectorAll(".tasful-market-search-card__rating-row--pc")].some(
      (el) => getComputedStyle(el).display !== "none"
    );
    const popoverHidden = popover ? getComputedStyle(popover).visibility === "hidden" : true;
    const ratingRow = document.querySelector(".tasful-market-search-card__rating-row--pc");
    const title = document.querySelector(".tasful-market-search-card__title");
    const priceBlock = document.querySelector(".tasful-market-search-card__price-block");
    const leftRail = document.querySelector("[data-tasful-market-search-filters-panel]");
    const rightRail = document.querySelector("[data-tasful-market-search-cart-rail]");
    const leftRailTop = leftRail?.getBoundingClientRect().top || 0;
    const rightRailTop = rightRail?.getBoundingClientRect().top || 0;
    const connectBadge = document.querySelector(".tasful-market-search-card__badge-connect--inline");
    const connectBadgeFontSize = connectBadge ? getComputedStyle(connectBadge).fontSize : "";
    let cardGaps = null;
    if (ratingRow && title && priceBlock) {
      const ratingBottom = ratingRow.getBoundingClientRect().bottom;
      const titleTop = title.getBoundingClientRect().top;
      const titleBottom = title.getBoundingClientRect().bottom;
      const priceTop = priceBlock.getBoundingClientRect().top;
      cardGaps = {
        ratingToTitle: Math.round((titleTop - ratingBottom) * 10) / 10,
        titleToPrice: Math.round((priceTop - titleBottom) * 10) / 10,
      };
    }
    return {
      scrollY: window.scrollY,
      headerBottom,
      firstCardTop,
      firstCardClearOfHeader: firstCardTop >= headerBottom - 1,
      hiddenUnderHeaderCount: visibleCards.filter((c) => c.hiddenUnderHeader).length,
      connectBadgeVisibleCount: cards.filter((card) => {
        const badge = card.querySelector(".tasful-market-search-card__badge-connect--inline");
        return badge && getComputedStyle(badge).display !== "none";
      }).length,
      gridColumns: firstRowCols,
      popoverWidth: popoverRect?.width || 0,
      popoverZIndex: popoverStyle?.zIndex || "",
      edgePopoverRight: edgeRect?.right || 0,
      edgePopoverLeft: edgeRect?.left || 0,
      viewportWidth: window.innerWidth,
      edgeNotClipped: edgeRect ? edgeRect.right <= window.innerWidth + 1 && edgeRect.left >= 0 : null,
      horizontalScrollShelfCount: scrollShelves.length,
      horizontalOverflowCount: horizontalScrollEls.length,
      legacyRatingVisible,
      pcRatingRowVisible,
      popoverHiddenAtRest: popoverHidden,
      popoverDisplay: popoverStyle?.display || "",
      hasEdgeClass: Boolean(document.querySelector(".tasful-rating.is-edge")),
      bodyPaddingTop: bodyStyle.paddingTop,
      bodyScrollPaddingTop: bodyStyle.scrollPaddingTop,
      cardGaps,
      leftRailClearOfHeader: leftRailTop >= headerBottom - 1,
      rightRailClearOfHeader: rightRailTop >= headerBottom - 1,
      leftRailTop,
      rightRailTop,
      connectBadgeFontSize,
    };
  });
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: VIEWPORT_PC });
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const pcTopMetrics = await collectLayoutMetrics();
await page.screenshot({ path: path.join(OUT_DIR, "01-pc-first-view.png"), fullPage: false });

const firstRating = page.locator(".tasful-market-search-grid .tasful-rating").first();
await firstRating.hover();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT_DIR, "02-pc-popover-hover.png"), fullPage: false });

const edgeRating = page.locator(".tasful-market-search-grid .tasful-rating.is-edge").first();
const edgeCount = await edgeRating.count();
if (edgeCount > 0) {
  await edgeRating.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "03-pc-popover-edge.png"), fullPage: false });
} else {
  const lastRowRating = page.locator(".tasful-market-search-grid .tasful-rating").nth(4);
  await lastRowRating.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "03-pc-popover-edge.png"), fullPage: false });
}

await page.mouse.move(0, 0);
await page.evaluate(() => window.scrollTo(0, 520));
await page.waitForTimeout(500);
const pcScrollMetrics = await collectLayoutMetrics();
await page.screenshot({ path: path.join(OUT_DIR, "04-pc-scroll-mid.png"), fullPage: false });

await page.setViewportSize(VIEWPORT_MOBILE);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);

const mobileMetrics = await page.evaluate(() => {
  const popover = document.querySelector(".tasful-rating-popover");
  const popoverDisplay = popover ? getComputedStyle(popover).display : "none";
  const pcRow = document.querySelector(".tasful-market-search-card__rating-row--pc");
  const pcRowDisplay = pcRow ? getComputedStyle(pcRow).display : "none";
  const legacy = document.querySelector(".tasful-market-search-card__rating--legacy");
  const legacyDisplay = legacy ? getComputedStyle(legacy).display : "none";
  const grid = document.querySelector(".tasful-market-search-grid");
  const gridCols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
  return {
    popoverDisplay,
    pcRowDisplay,
    legacyDisplay,
    gridColumns: gridCols,
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "05-mobile-390-unchanged.png"), fullPage: false });

const report = {
  capturedAt: new Date().toISOString(),
  url: searchUrl,
  pc: {
    top: pcTopMetrics,
    scroll: pcScrollMetrics,
  },
  mobile: mobileMetrics,
  changedFiles: ["shop-market-search.css"],
  status: "pc-search-complete",
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

});

await closeAllBrowsers();
