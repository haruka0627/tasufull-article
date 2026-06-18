/**
 * TASFUL市場 マイページ拡張 — 390px 検証（localhost 必須）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-mypage-390");
const RECENT_ITEMS_KEY = "tasu_market_recent_items";
const FAVORITES_KEY = "tasu_market_favorites";
const ORDER_HISTORY_KEY = "tasu_market_order_history";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-market-mypage.html" });
const mypageUrl = buildLocalPageUrl(base, "shop-market-mypage.html");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(mypageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);

const mypageReport = await page.evaluate(() => {
  const grid = document.querySelector(".tasful-market-mypage-grid");
  const gridStyle = grid ? getComputedStyle(grid) : null;
  const cards = document.querySelectorAll(".tasful-market-mypage-card");
  const cardStyle = cards[0] ? getComputedStyle(cards[0]) : null;
  const sections = [...document.querySelectorAll(".tasful-market-mypage-section__title")].map((el) => el.textContent?.trim());
  return {
    hasHero: document.body.innerText.includes("アカウントサービス"),
    sectionCount: sections.length,
    sections,
    hasPurchaseSection: sections.some((s) => s.includes("購入")),
    hasAccountSection: sections.some((s) => s.includes("アカウント")),
    hasMarketSection: sections.some((s) => s.includes("市場")),
    hasSupportSection: sections.some((s) => s.includes("サポート")),
    gridTwoCol: gridStyle?.gridTemplateColumns?.includes(" ") || false,
    cardMinHeight: cardStyle ? parseInt(cardStyle.minHeight, 10) >= 80 : false,
    hasOrderHistory: Boolean(document.querySelector('[data-tasful-mypage-order-history][href*="order-history"]')),
    hasFavorites: Boolean(document.querySelector('[data-tasful-mypage-favorites][href*="favorites"]')),
    hasRecent: Boolean(document.querySelector('[data-tasful-mypage-recent][href*="recent"]')),
    cardCount: cards.length,
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "market-mypage-mobile390.png"), fullPage: false });

await page.goto(buildLocalPageUrl(base, "shop-search.html"), { waitUntil: "domcontentloaded" });
await page.evaluate(
  (keys) => {
    localStorage.removeItem(keys.recent);
    localStorage.setItem(keys.fav, "[]");
  },
  { recent: RECENT_ITEMS_KEY, fav: FAVORITES_KEY }
);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });

const productId = await page.evaluate(() => {
  const card = document.querySelector(".tasful-market-search-card");
  return card?.getAttribute("data-product-id") || "";
});

await Promise.all([
  page.waitForURL(/detail-shop-product\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click(".tasful-market-search-card__link"),
]);
await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });

const recentReport = await page.evaluate((key) => {
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    items = [];
  }
  return {
    recentCount: Array.isArray(items) ? items.length : 0,
    hasTitle: Array.isArray(items) && items[0]?.title,
    hasShopId: Array.isArray(items) && items[0]?.shopId,
  };
}, RECENT_ITEMS_KEY);

await page.click("[data-tasful-product-favorite]");
await page.waitForTimeout(200);

const favReport = await page.evaluate((key) => {
  let favs = [];
  try {
    favs = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    favs = [];
  }
  return { favCount: Array.isArray(favs) ? favs.length : 0 };
}, FAVORITES_KEY);

await Promise.all([
  page.waitForURL(/shop-market-checkout\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click("[data-tasful-product-buy-now]"),
]);
await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 15000 });
await page.click("[data-tasful-checkout-submit]");
await page.waitForURL(/shop-market-complete\.html/, { waitUntil: "domcontentloaded", timeout: 15000 });

const orderMeta = await page.evaluate((key) => {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    history = [];
  }
  return {
    shopId: history[0]?.shopId || "",
    orderId: history[0]?.orderId || "",
    productId: history[0]?.productId || "",
    status: history[0]?.status || "",
  };
}, ORDER_HISTORY_KEY);

await page.goto(buildLocalPageUrl(base, "shop-market-favorites.html"), { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-catalog-grid]:not([hidden])", { timeout: 15000 });
const favoritesPageReport = await page.evaluate(() => ({
  cardCount: document.querySelectorAll(".tasful-market-grid-card").length,
  gridTwoCol: getComputedStyle(document.querySelector(".tasful-market-grid")).gridTemplateColumns.includes(" "),
}));
await page.screenshot({ path: path.join(OUT_DIR, "market-favorites-mobile390.png"), fullPage: false });

await page.goto(buildLocalPageUrl(base, "shop-market-recent.html"), { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-catalog-grid]:not([hidden])", { timeout: 15000 });
const recentPageReport = await page.evaluate(() => ({
  cardCount: document.querySelectorAll(".tasful-market-grid-card").length,
}));
await page.screenshot({ path: path.join(OUT_DIR, "market-recent-mobile390.png"), fullPage: false });

await page.goto(
  buildLocalPageUrl(base, `shop-market-seller.html?shopId=${encodeURIComponent(orderMeta.shopId)}`),
  { waitUntil: "domcontentloaded" }
);
await page.waitForSelector("[data-tasful-seller-hero]:not([hidden])", { timeout: 15000 });
const sellerReport = await page.evaluate(() => ({
  hasName: Boolean(document.querySelector("[data-tasful-seller-name]")?.textContent?.trim()),
  hasRating: (document.querySelector("[data-tasful-seller-rating]")?.textContent || "").includes("★"),
  hasReviews: (document.body.innerText || "").includes("レビュー"),
  hasSales: (document.body.innerText || "").includes("販売実績"),
  productCount: document.querySelectorAll(".tasful-market-grid-card").length,
}));
await page.screenshot({ path: path.join(OUT_DIR, "market-seller-mobile390.png"), fullPage: false });

await page.goto(
  buildLocalPageUrl(base, `shop-market-seller-orders.html?shopId=${encodeURIComponent(orderMeta.shopId)}`),
  { waitUntil: "domcontentloaded" }
);
await page.waitForSelector("[data-tasful-seller-orders-list]:not([hidden])", { timeout: 15000 });
await page.click('[data-tasful-seller-status-btn][data-status="発送準備中"]');
await page.waitForTimeout(200);

const syncReport = await page.evaluate(
  ({ historyKey, orderId, productId }) => {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    } catch {
      history = [];
    }
    const entry = history.find((h) => h.orderId === orderId && h.productId === productId);
    const uiStatus = document.querySelector("[data-tasful-seller-order-status]")?.textContent?.trim();
    return {
      uiStatus,
      storedStatus: entry?.status || "",
      synced: entry?.status === "発送準備中" && uiStatus === "発送準備中",
    };
  },
  { historyKey: ORDER_HISTORY_KEY, orderId: orderMeta.orderId, productId: orderMeta.productId }
);

await page.goto(buildLocalPageUrl(base, "shop-market-order-history.html"), { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-tasful-order-card]", { timeout: 15000 });
const buyerSyncReport = await page.evaluate(
  ({ orderId }) => {
    const card = document.querySelector("[data-tasful-order-card]");
    const status = card?.querySelector(".tasful-market-order-history-card__status")?.textContent?.trim();
    const id = card?.querySelector(".tasful-market-order-history-card__order-id")?.textContent || "";
    return { buyerStatus: status, hasOrder: id.includes(orderId) };
  },
  { orderId: orderMeta.orderId }
);

await page.screenshot({ path: path.join(OUT_DIR, "market-seller-orders-mobile390.png"), fullPage: false });
await browser.close();

const pass =
  mypageReport.hasHero &&
  mypageReport.sectionCount >= 4 &&
  mypageReport.hasPurchaseSection &&
  mypageReport.hasAccountSection &&
  mypageReport.hasMarketSection &&
  mypageReport.hasSupportSection &&
  mypageReport.gridTwoCol &&
  mypageReport.cardCount >= 10 &&
  mypageReport.hasOrderHistory &&
  mypageReport.hasFavorites &&
  mypageReport.hasRecent &&
  recentReport.recentCount >= 1 &&
  recentReport.hasTitle &&
  favReport.favCount >= 1 &&
  favoritesPageReport.cardCount >= 1 &&
  favoritesPageReport.gridTwoCol &&
  recentPageReport.cardCount >= 1 &&
  sellerReport.hasName &&
  sellerReport.hasRating &&
  sellerReport.hasReviews &&
  sellerReport.hasSales &&
  sellerReport.productCount >= 1 &&
  syncReport.synced &&
  buyerSyncReport.buyerStatus === "発送準備中";

console.log(
  JSON.stringify(
    {
      baseUrl: base,
      mypageReport,
      recentReport,
      favReport,
      favoritesPageReport,
      recentPageReport,
      sellerReport,
      syncReport,
      buyerSyncReport,
      pass,
    },
    null,
    2
  )
);
process.exit(pass ? 0 : 1);
