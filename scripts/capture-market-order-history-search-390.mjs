#!/usr/bin/env node
/**
 * TASFUL市場 — 注文履歴 検索・絞り込み 390px スクリーンショット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { devices } from "playwright";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-order-history-390");
const ORDER_HISTORY_KEY = "tasu_market_order_history";

fs.mkdirSync(OUT_DIR, { recursive: true });

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

const DEMO_ORDERS = [
  {
    orderId: "TM-HIST-D001",
    shopId: "demo-shop-tasful-bakery",
    productId: "p-0",
    productName: "洋書 milk and honey (rupi kaur)",
    sellerName: "TASFUL Bakery",
    status: "配達完了",
    createdAt: daysAgo(5),
    quantity: 1,
    price: 480,
    subtotal: 480,
    paymentMethod: "クレジットカード",
    connectVerified: true,
  },
  {
    orderId: "TM-HIST-D002",
    shopId: "demo-shop-bakery",
    productId: "p-0",
    productName: "クロワッサン",
    sellerName: "麦の香",
    status: "発送済み",
    createdAt: daysAgo(20),
    quantity: 2,
    price: 320,
    subtotal: 640,
    paymentMethod: "クレジットカード",
  },
  {
    orderId: "TM-HIST-D003",
    shopId: "demo-shop-tasful-bakery",
    productId: "p-0",
    productName: "アニメフィギュア 限定版",
    sellerName: "TASFUL Bakery",
    status: "注文受付",
    createdAt: daysAgo(45),
    quantity: 1,
    price: 18800,
    subtotal: 18800,
    paymentMethod: "クレジットカード",
  },
  {
    orderId: "TM-HIST-D004",
    shopId: "demo-shop-cafe",
    productId: "p-1",
    productName: "スペシャルティコーヒー",
    sellerName: "豆と焙煎",
    status: "発送準備中",
    createdAt: daysAgo(400),
    quantity: 1,
    price: 580,
    subtotal: 580,
    paymentMethod: "クレジットカード",
  },
  {
    orderId: "TM-HIST-D005",
    shopId: "demo-shop-haru-cafe",
    productId: "p-0",
    productName: "季節のパンケーキ",
    sellerName: "ハルカフェ",
    status: "キャンセル",
    createdAt: daysAgo(10),
    quantity: 1,
    price: 1280,
    subtotal: 1280,
    paymentMethod: "クレジットカード",
  },
];

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

const errors = [];

try {
  await page.goto(buildLocalPageUrl(base, "shop-market-order-history.html"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await assertPlaywrightLocalhostPage(page);
  await page.evaluate(
    ({ key, orders }) => {
      localStorage.setItem(key, JSON.stringify(orders));
    },
    { key: ORDER_HISTORY_KEY, orders: DEMO_ORDERS }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tasful-order-history-toolbar]:not([hidden])", { timeout: 15000 });
  await page.waitForSelector("[data-tasful-order-card]", { timeout: 15000 });

  const baseAudit = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("[data-tasful-order-card]").length,
    hasSearch: Boolean(document.querySelector("[data-tasful-order-history-search]")),
    searchPlaceholder:
      document.querySelector("[data-tasful-order-history-search]")?.getAttribute("placeholder") || "",
    hasFilterBtn: Boolean(document.querySelector("[data-tasful-order-history-filter-open]")),
  }));

  if (baseAudit.cardCount !== 5) errors.push(`cardCount: expected 5, got ${baseAudit.cardCount}`);
  if (!baseAudit.hasSearch) errors.push("search input missing");
  if (baseAudit.searchPlaceholder !== "注文履歴を検索") {
    errors.push(`placeholder: ${baseAudit.searchPlaceholder}`);
  }
  if (!baseAudit.hasFilterBtn) errors.push("filter button missing");

  await page.screenshot({
    path: path.join(OUT_DIR, "market-order-history-search-toolbar-390.png"),
    fullPage: false,
  });

  await page.click("[data-tasful-order-history-filter-open]");
  await page.waitForSelector("[data-tasful-order-history-sheet]:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT_DIR, "market-order-history-filter-sheet-390.png"),
    fullPage: false,
  });

  await page.click("[data-tasful-order-history-sheet-backdrop]");
  await page.waitForFunction(
    () => document.querySelector("[data-tasful-order-history-sheet]")?.hasAttribute("hidden"),
    null,
    { timeout: 5000 }
  );

  await page.fill("[data-tasful-order-history-search]", "milk");
  await page.waitForTimeout(350);
  const searchAudit = await page.evaluate(() => {
    const form = document.querySelector("[data-tasful-order-history-search-form]");
    const customClear = form?.querySelector("[data-tasful-order-history-search-clear]");
    const customClearVisible =
      Boolean(customClear) &&
      !customClear.hidden &&
      customClear.getBoundingClientRect().width > 0;
    const input = document.querySelector("[data-tasful-order-history-search]");
    const inputStyle = input ? getComputedStyle(input) : null;
    return {
      cardCount: document.querySelectorAll("[data-tasful-order-card]").length,
      countText: document.querySelector("[data-tasful-order-history-count]")?.textContent?.trim() || "",
      titles: [...document.querySelectorAll(".tasful-market-order-history-card__title")].map((el) =>
        el.textContent?.trim()
      ),
      customClearVisible,
      webkitCancelHidden:
        inputStyle?.getPropertyValue("-webkit-appearance") === "none" ||
        inputStyle?.appearance === "none",
      clearButtonCount: form
        ? form.querySelectorAll(
            "[data-tasful-order-history-search-clear], button[aria-label*='クリア'], input::-webkit-search-cancel-button"
          ).length
        : 0,
      visibleClearControls: form
        ? [...form.querySelectorAll("button")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !el.hidden;
          }).length
        : 0,
    };
  });

  if (!searchAudit.customClearVisible) errors.push("custom clear button not visible during input");
  if (searchAudit.visibleClearControls !== 1) {
    errors.push(`clear controls visible: expected 1, got ${searchAudit.visibleClearControls}`);
  }

  if (searchAudit.cardCount !== 1) errors.push(`search results: expected 1, got ${searchAudit.cardCount}`);
  if (!searchAudit.titles.some((t) => /milk and honey/i.test(t || ""))) {
    errors.push("search did not match product name");
  }

  await page.screenshot({
    path: path.join(OUT_DIR, "market-order-history-search-results-390.png"),
    fullPage: false,
  });

  await page.click("[data-tasful-order-history-filter-open]");
  await page.waitForSelector("[data-tasful-order-history-sheet]:not([hidden])");
  await page.click('label.tasful-market-order-history-filter-chip:has(input[value="配達完了"])');
  await page.click('label.tasful-market-order-history-filter-chip:has(input[value="TASFUL Bakery"])');
  await page.click("[data-tasful-order-history-filter-apply]");
  await page.waitForTimeout(350);

  const filterAudit = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("[data-tasful-order-card]").length,
    badge: document.querySelector("[data-tasful-order-history-filter-badge]")?.textContent?.trim() || "",
    filterActive: document
      .querySelector("[data-tasful-order-history-filter-open]")
      ?.classList.contains("is-active"),
  }));

  if (filterAudit.cardCount !== 1) errors.push(`filtered results: expected 1, got ${filterAudit.cardCount}`);
  if (filterAudit.badge !== "2") errors.push(`filter badge: expected 2, got ${filterAudit.badge}`);

  await page.screenshot({
    path: path.join(OUT_DIR, "market-order-history-filtered-results-390.png"),
    fullPage: false,
  });
} catch (err) {
  errors.push(String(err?.message || err));
}
});


const overallPass = errors.length === 0;
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  overallPass,
  errors,
  screenshots: {
    toolbar: "screenshots/market-order-history-390/market-order-history-search-toolbar-390.png",
    filterSheet: "screenshots/market-order-history-390/market-order-history-filter-sheet-390.png",
    searchResults: "screenshots/market-order-history-390/market-order-history-search-results-390.png",
    filteredResults: "screenshots/market-order-history-390/market-order-history-filtered-results-390.png",
  },
};

fs.writeFileSync(path.join(OUT_DIR, "search-filter-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ overallPass, errors, reportPath: path.join(OUT_DIR, "search-filter-report.json") }, null, 2));
await closeAllBrowsers();
process.exit(overallPass ? 0 : 1);
