/**
 * TASFUL市場 検索ページ — 390px 検証（localhost 必須）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-search-390");
const FAVORITES_KEY = "tasu_market_favorites";
const CART_KEY = "tasu_market_cart_count";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const listUrl = buildLocalPageUrl(base, "shop-search.html");
const filterUrl = buildLocalPageUrl(base, "shop-search.html", "keyword=コーヒー&connect=1&rating4=1");

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });
await page.waitForTimeout(600);

const report = await page.evaluate(() => {
  const bodyText = document.body.innerText || "";
  const forbidden = ["求人", "スキル", "一般案件", "業務サービス"];
  const hitText = document.querySelector("[data-tasful-market-search-hit-count]")?.textContent || "";
  const cartBtn = document.querySelector("[data-tasful-market-add-cart]");
  const cartCard = cartBtn?.closest(".tasful-market-search-card");
  const cartStyle = cartBtn ? getComputedStyle(cartBtn) : null;
  const cartRect = cartBtn?.getBoundingClientRect();
  const cartCardRect = cartCard?.getBoundingClientRect();
  const miniTitle = document.querySelector(".tasful-market-search-mini__title");
  const miniTitleAlign = miniTitle ? getComputedStyle(miniTitle).textAlign : "";
  const sel = document.querySelector(".tasful-market-search-sort__select");
  const toolbar = sel?.closest(".tasful-market-search-toolbar")?.getBoundingClientRect();
  const selRect = sel?.getBoundingClientRect();
  const gridTop = document.querySelector(".tasful-market-search-grid")?.getBoundingClientRect().top ?? 0;
  const header = document.querySelector("[data-tasful-market-header]");
  const stack = document.querySelector(".tasful-market-mall-header__stack");
  const nav = document.querySelector(".tasful-market-mall-header__nav");
  const headerHeight = Math.max(
    header?.offsetHeight || 0,
    (stack?.offsetHeight || 0) + (nav?.offsetHeight || 0)
  );
  const cards = Array.from(document.querySelectorAll(".tasful-market-search-card"));
  const visibleCards = cards.filter((card) => {
    const rect = card.getBoundingClientRect();
    return rect.top >= gridTop && rect.bottom <= 844;
  }).length;
  const firstCard = document.querySelector(".tasful-market-search-card");
  const favBtn = firstCard?.querySelector("[data-tasful-market-favorite]");
  const favRect = favBtn?.getBoundingClientRect();
  const imgRect = firstCard?.querySelector(".tasful-market-search-card__img")?.getBoundingClientRect();
  const mini = document.querySelector(".tasful-market-search-mini");
  const miniStyle = mini ? getComputedStyle(mini) : null;
  const seller = document.querySelector(".tasful-market-search-seller");
  const sellerStyle = seller ? getComputedStyle(seller) : null;
  const connectBadge = document.querySelector(".tasful-market-search-card__badge-connect");
  const priceBlock = firstCard?.querySelector(".tasful-market-search-card__price-block");
  const condition = firstCard?.querySelector(".tasful-market-search-card__condition");
  const title = firstCard?.querySelector(".tasful-market-search-card__title");
  const productCards = cards.filter((card) => !card.classList.contains("recommend-fill"));
  const rowGroups = [];
  productCards
    .map((card) => ({ card, rect: card.getBoundingClientRect() }))
    .sort((a, b) => a.rect.top - b.rect.top)
    .forEach((item) => {
      const row = rowGroups.find((group) => Math.abs(group.top - item.rect.top) < 8);
      if (row) row.items.push(item);
      else rowGroups.push({ top: item.rect.top, items: [item] });
    });
  let cardHeightsAligned = true;
  let ctaTopsAligned = true;
  const ctaRowDetails = rowGroups
    .filter((group) => group.items.length >= 2)
    .map((group) => {
      const heights = group.items.map((item) => item.rect.height);
      const cartTops = group.items
        .map((item) => item.card.querySelector("[data-tasful-market-add-cart]")?.getBoundingClientRect().top)
        .filter((value) => Number.isFinite(value));
      const heightDelta = Math.max(...heights) - Math.min(...heights);
      const ctaDelta = cartTops.length >= 2 ? Math.max(...cartTops) - Math.min(...cartTops) : 0;
      if (heightDelta > 2) cardHeightsAligned = false;
      if (ctaDelta > 2) ctaTopsAligned = false;
      return { count: group.items.length, heightDelta, ctaDelta };
    });
  const titleStyle = title ? getComputedStyle(title) : null;
  return {
    pageUrl: window.location.href,
    isLocalhost: /^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.href),
    hasHitCount: /検索結果.*\d+件/.test(hitText),
    hitText,
    noDuplicateRange: !document.querySelector("[data-tasful-market-search-range]"),
    cartPillShape: cartStyle?.borderRadius === "999px" || cartStyle?.borderRadius === "9999px",
    cartHeightOk: Boolean(cartRect && cartRect.height >= 34 && cartRect.height <= 38),
    cartPinnedBottom: Boolean(
      cartBtn &&
        cartCardRect &&
        cartRect &&
        Math.abs(cartCardRect.bottom - cartRect.bottom - (parseFloat(cartStyle?.marginBottom) || 0)) <= 4
    ),
    shelfTextLeft: miniTitleAlign === "left",
    sortFullWidth: Boolean(toolbar && selRect && selRect.width >= toolbar.width - 40),
    chipCount: document.querySelectorAll("[data-tasful-market-filter-chip]").length,
    hasCartBtn: Boolean(document.querySelector("[data-tasful-market-add-cart]")),
    hasHeartBtn: Boolean(document.querySelector("[data-tasful-market-favorite]")),
    heartSizeOk: Boolean(
      favRect &&
        favRect.width >= 28 &&
        favRect.width <= 32 &&
        favRect.height >= 28 &&
        favRect.height <= 32
    ),
    heartTopRight: Boolean(
      favRect &&
        imgRect &&
        favRect.top >= imgRect.top &&
        favRect.right <= imgRect.right + 1 &&
        favRect.top - imgRect.top <= 12
    ),
    hasConditionLabel: Boolean(document.querySelector(".tasful-market-search-card__condition")),
    conditionAboveTitle: Boolean(
      condition &&
        title &&
        condition.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
    hasPriceBlock: Boolean(document.querySelector(".tasful-market-search-card__price-block")),
    shipNearPrice: Boolean(priceBlock?.querySelector(".tasful-market-search-card__ship")),
    hasShipFreeText: Boolean(document.querySelector(".tasful-market-search-card__ship-free")),
    connectHasCheckmark: (connectBadge?.textContent || "").includes("✓"),
    connectBadgeText: connectBadge?.textContent || "",
    hasPagination: Boolean(document.querySelector("[data-tasful-market-search-pagination]:not([hidden])")),
    hasBrowsedShelf: Boolean(document.querySelector("[data-tasful-market-search-browsed] .tasful-market-search-mini")),
    hasRecentShelf: Boolean(document.querySelector("[data-tasful-market-search-recent] .tasful-market-search-mini")),
    miniHasRating: Boolean(document.querySelector(".tasful-market-search-mini__rating")),
    miniBorderRadius: miniStyle?.borderRadius,
    miniBorderColor: miniStyle?.borderColor,
    sellerBorderRadius: sellerStyle?.borderRadius,
    sellerBorderColor: sellerStyle?.borderColor,
    sellerConnectCheck: Boolean(document.querySelector(".tasful-market-search-seller__mark")?.textContent?.includes("✓")),
    hasSellers: Boolean(document.querySelector("[data-tasful-market-search-sellers] .tasful-market-search-seller")),
    hasFooter: Boolean(document.querySelector(".tasful-market-footer")),
    gridCols: getComputedStyle(document.querySelector(".tasful-market-search-grid")).gridTemplateColumns,
    imgAspectRatio: getComputedStyle(document.querySelector(".tasful-market-search-card__img")).aspectRatio,
    cardCount: cards.length,
    visibleCardsInViewport: visibleCards,
    hasMallHeader: Boolean(document.querySelector("[data-tasful-market-header]")),
    headerHeight,
    headerNotCollapsed: Boolean(header && parseFloat(getComputedStyle(header).height || "0") > 50),
    headerOverflowVisible: header ? getComputedStyle(header).overflow !== "hidden" : false,
    hasHeaderLogo: Boolean(document.querySelector(".tasful-market-mall-header__logo")),
    hasHeaderSearch: Boolean(document.querySelector(".tasful-market-mall-header__search")),
    mainStartsBelowHeader: Boolean(headerHeight > 0 && gridTop >= headerHeight - 24),
    hasNavNavy: getComputedStyle(document.querySelector(".tasful-market-mall-header__nav")).backgroundColor === "rgb(35, 47, 62)",
    navItemCount: document.querySelectorAll("[data-tasful-market-nav-item]").length,
    hasForbidden: forbidden.filter((w) => bodyText.includes(w)),
    cardHeightsAligned,
    ctaTopsAligned,
    ctaRowDetails,
    titleLineClamp2: titleStyle?.webkitLineClamp === "2",
    titleMinHeightOk: Boolean(titleStyle?.minHeight && titleStyle.minHeight !== "0px" && titleStyle.minHeight !== "auto"),
    metaSlotOnAllCards: productCards.every((card) => Boolean(card.querySelector(".tasful-market-search-card__meta"))),
  };
});

await page.evaluate((key) => localStorage.removeItem(key), FAVORITES_KEY);
const cartBefore = await page.evaluate((key) => Number(localStorage.getItem(key)) || 0, CART_KEY);
const firstProductId = await page.evaluate(() => {
  const btn = document.querySelector(".tasful-market-search-grid [data-tasful-market-favorite]");
  return btn?.getAttribute("data-tasful-market-favorite") || "";
});

await page.click(".tasful-market-search-grid [data-tasful-market-favorite]");
await page.waitForTimeout(400);

const favReport = await page.evaluate(
  ({ key, productId }) => {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      saved = [];
    }
    const btn = document.querySelector(`[data-tasful-market-favorite="${productId}"]`);
    return {
      stayedOnSearch: /shop-search\.html/.test(window.location.href),
      favoriteSaved: Array.isArray(saved) && saved.includes(productId),
      heartActive: btn?.classList.contains("is-active") === true,
      heartIcon: btn?.querySelector(".tasful-market-search-card__fav-icon")?.textContent || "",
    };
  },
  { key: FAVORITES_KEY, productId: firstProductId }
);

await page.click("[data-tasful-market-add-cart]");
await page.waitForTimeout(200);

const cartReport = await page.evaluate(
  ({ key, before }) => {
    const after = Number(localStorage.getItem(key)) || 0;
    return {
      stayedOnSearch: /shop-search\.html/.test(window.location.href),
      cartIncremented: after === before + 1,
      cartCount: after,
    };
  },
  { key: CART_KEY, before: cartBefore }
);

const cardLink = await page.$(".tasful-market-search-card__link");
const detailNav = cardLink
  ? await Promise.all([
      page.waitForURL(/detail-shop-product\.html/, { timeout: 10000 }),
      cardLink.click({ position: { x: 20, y: 40 } }),
    ])
      .then(() => true)
      .catch(() => false)
  : false;

await page.goto(filterUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });
await page.waitForTimeout(400);

const filterReport = await page.evaluate(() => ({
  hasKeyword: (document.querySelector("[data-tasful-market-search-hit-count]")?.textContent || "").includes("コーヒー"),
  connectChipActive: document.querySelector('[data-tasful-market-filter-chip="connect"]')?.classList.contains("is-active"),
  rating4ChipActive: document.querySelector('[data-tasful-market-filter-chip="rating4"]')?.classList.contains("is-active"),
}));

await page.screenshot({
  path: path.join(OUT_DIR, "market-search-mobile390.png"),
  fullPage: false,
  clip: { x: 0, y: 0, width: 390, height: 844 },
});

const gridClip = await page.evaluate(() => {
  const grid = document.querySelector(".tasful-market-search-grid");
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  return {
    x: 0,
    y: Math.max(0, Math.floor(rect.top)),
    width: 390,
    height: Math.min(844 - Math.max(0, Math.floor(rect.top)), Math.ceil(rect.height)),
  };
});
if (gridClip && gridClip.height > 80) {
  await page.screenshot({
    path: path.join(OUT_DIR, "market-search-card-cta-align-390.png"),
    fullPage: false,
    clip: gridClip,
  });
}

await page.screenshot({
  path: path.join(OUT_DIR, "market-search-full-page.png"),
  fullPage: true,
});

const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
const topUrl = buildLocalPageUrl(base, "shop-store.html");
await page2.goto(topUrl, { waitUntil: "domcontentloaded" });
await assertPlaywrightLocalhostPage(page2);
await page2.waitForSelector("[data-tasful-market-search-input]", { timeout: 15000 });
await page2.waitForSelector("[data-tasful-market-nav-item]", { timeout: 15000 });
await page2.fill("[data-tasful-market-search-input]", "パン");
await Promise.all([
  page2.waitForURL(/shop-search\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page2.evaluate(() => document.querySelector("[data-tasful-market-search-form]")?.requestSubmit()),
]);
const topNavOk = page2.url().includes("shop-search.html") && page2.url().includes("keyword");

async function probeHeaderOnPort(port) {
  const altBase = `http://localhost:${port}`;
  try {
    const res = await fetch(`${altBase}/shop-search.html`, { method: "GET" });
    if (!res.ok) return { port, ok: false, reason: "fetch-fail" };
    const probePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await probePage.goto(buildLocalPageUrl(altBase, "shop-search.html"), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const probe = await probePage.evaluate(() => {
      const header = document.querySelector("[data-tasful-market-header]");
      const stack = document.querySelector(".tasful-market-mall-header__stack");
      const nav = document.querySelector(".tasful-market-mall-header__nav");
      const headerHeight = Math.max(
        header?.offsetHeight || 0,
        (stack?.offsetHeight || 0) + (nav?.offsetHeight || 0)
      );
      return {
        headerHeight,
        headerNotCollapsed: Boolean(header && parseFloat(getComputedStyle(header).height || "0") > 50),
        navCount: document.querySelectorAll("[data-tasful-market-nav-item]").length,
        hasLogo: Boolean(document.querySelector(".tasful-market-mall-header__logo")),
      };
    });
    await probePage.close();
    return {
      port,
      ok: probe.headerNotCollapsed && probe.headerHeight >= 120 && probe.navCount >= 10 && probe.hasLogo,
      ...probe,
    };
  } catch (e) {
    return { port, ok: false, reason: String(e.message || e) };
  }
}

const port5173 = await probeHeaderOnPort(5173);
const port5500 = await probeHeaderOnPort(5500);

});

const pass =
  report.isLocalhost &&
  report.hasHitCount &&
  report.noDuplicateRange &&
  report.cartPillShape &&
  report.cartHeightOk &&
  report.cartPinnedBottom &&
  report.shelfTextLeft &&
  report.sortFullWidth &&
  report.chipCount >= 7 &&
  report.hasCartBtn &&
  report.hasHeartBtn &&
  report.heartSizeOk &&
  report.heartTopRight &&
  report.hasConditionLabel &&
  report.conditionAboveTitle &&
  report.hasPriceBlock &&
  report.shipNearPrice &&
  report.hasShipFreeText &&
  report.connectHasCheckmark &&
  report.hasPagination &&
  report.hasBrowsedShelf &&
  report.hasRecentShelf &&
  report.miniHasRating &&
  report.miniBorderRadius === "10px" &&
  report.sellerBorderRadius === "10px" &&
  report.sellerConnectCheck &&
  report.hasSellers &&
  report.hasFooter &&
  report.cardCount >= 2 &&
  report.gridCols.includes(" ") &&
  report.imgAspectRatio === "1 / 1" &&
  report.hasMallHeader &&
  report.headerHeight >= 120 &&
  report.headerNotCollapsed &&
  report.headerOverflowVisible &&
  report.hasHeaderLogo &&
  report.hasHeaderSearch &&
  report.mainStartsBelowHeader &&
  report.hasNavNavy &&
  report.navItemCount >= 10 &&
  port5173.ok &&
  (port5500.ok || port5500.reason === "fetch-fail") &&
  report.hasForbidden.length === 0 &&
  report.cardHeightsAligned &&
  report.ctaTopsAligned &&
  report.titleLineClamp2 &&
  report.titleMinHeightOk &&
  report.metaSlotOnAllCards &&
  favReport.stayedOnSearch &&
  favReport.favoriteSaved &&
  favReport.heartActive &&
  favReport.heartIcon === "♥" &&
  cartReport.stayedOnSearch &&
  cartReport.cartIncremented &&
  detailNav === true &&
  filterReport.hasKeyword &&
  filterReport.connectChipActive &&
  filterReport.rating4ChipActive &&
  topNavOk;

console.log(
  JSON.stringify(
    {
      baseUrl: base,
      listUrl,
      filterUrl,
      topUrl,
      report,
      favReport,
      cartReport,
      detailNav,
      filterReport,
      topNavOk,
      port5173,
      port5500,
      pass,
    },
    null,
    2
  )
);
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
