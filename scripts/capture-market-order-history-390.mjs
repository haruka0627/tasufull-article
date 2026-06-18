/**
 * TASFUL市場 注文履歴 — 390px 検証（localhost 必須）
 * 市場TOP → 商品詳細 → 注文確認 → 注文完了 → 注文履歴
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-order-history-390");
const ORDER_HISTORY_KEY = "tasu_market_order_history";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const storeUrl = buildLocalPageUrl(base, "shop-store.html");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(storeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.evaluate((key) => localStorage.removeItem(key), ORDER_HISTORY_KEY);

const productLink = await page.waitForSelector(
  'a[href*="detail-shop-product.html"], .tasful-market-top-shelf__card a, .tasful-market-product-card a',
  { timeout: 15000 }
);
await Promise.all([
  page.waitForURL(/detail-shop-product\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  productLink.click(),
]);
await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });

await Promise.all([
  page.waitForURL(/shop-market-checkout\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click("[data-tasful-product-buy-now]"),
]);
await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 15000 });
await page.click("[data-tasful-checkout-submit]");
await page.waitForURL(/shop-market-complete\.html/, { waitUntil: "domcontentloaded", timeout: 15000 });

const completeReport = await page.evaluate((key) => {
  const historyBtn = document.querySelector('a[href="shop-market-order-history.html"]');
  const historyBtnStyle = historyBtn ? getComputedStyle(historyBtn) : null;
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    history = [];
  }
  return {
    hasHistoryCta: Boolean(historyBtn?.textContent?.includes("注文履歴を見る")),
    historyCtaYellow:
      historyBtnStyle?.backgroundColor === "rgb(255, 216, 20)" ||
      (historyBtnStyle?.backgroundColor || "").includes("255, 216"),
    historyCount: Array.isArray(history) ? history.length : 0,
    firstStatus: Array.isArray(history) && history[0] ? history[0].status : "",
    hasOrderId: Boolean(document.querySelector("[data-tasful-complete-order-id]")?.textContent?.includes("TM-")),
  };
}, ORDER_HISTORY_KEY);

await page.screenshot({ path: path.join(OUT_DIR, "market-order-complete-mobile390.png"), fullPage: false });

await Promise.all([
  page.waitForURL(/shop-market-order-history\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click('a[href="shop-market-order-history.html"]'),
]);
await page.waitForSelector("[data-tasful-order-history-list]:not([hidden])", { timeout: 15000 });

const historyReport = await page.evaluate(() => {
  const card = document.querySelector("[data-tasful-order-card]");
  const img = card?.querySelector(".tasful-market-order-history-card__img img");
  const imgBox = card?.querySelector(".tasful-market-order-history-card__img");
  const imgStyle = imgBox ? getComputedStyle(imgBox) : null;
  const orderIdEl = card?.querySelector(".tasful-market-order-history-card__order-id");
  const statusEl = card?.querySelector(".tasful-market-order-history-card__status");
  return {
    cardCount: document.querySelectorAll("[data-tasful-order-card]").length,
    hasProductName: Boolean(card?.querySelector(".tasful-market-order-history-card__title")?.textContent?.trim()),
    hasOrderId: Boolean(orderIdEl?.textContent?.includes("TM-")),
    orderIdWrap: orderIdEl ? getComputedStyle(orderIdEl).wordBreak === "break-all" : false,
    img72: imgStyle ? parseInt(imgStyle.width, 10) === 72 && parseInt(imgStyle.height, 10) === 72 : false,
    hasImage: Boolean(img?.getAttribute("src")),
    hasStatus: statusEl?.textContent === "注文受付",
    hasSearchToolbar: Boolean(document.querySelector("[data-tasful-order-history-toolbar]:not([hidden])")),
    hasSearchInput: Boolean(document.querySelector("[data-tasful-order-history-search]")),
    emptyHidden: document.querySelector("[data-tasful-order-history-empty]")?.hidden === true,
  };
});

await page.click("[data-tasful-order-toggle]");
await page.waitForSelector("[data-tasful-order-detail]:not([hidden])", { timeout: 5000 });

const detailReport = await page.evaluate(() => {
  const detail = document.querySelector("[data-tasful-order-detail]:not([hidden])");
  const text = detail?.innerText || "";
  return {
    expanded: Boolean(detail && !detail.hidden),
    hasPayment: text.includes("支払い方法"),
    hasAddress: text.includes("配送先"),
    hasSeller: text.includes("出品者"),
    hasConnect: text.includes("Connect"),
    hasTotal: text.includes("合計金額"),
    hasDate: text.includes("注文日時"),
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "market-order-history-mobile390.png"), fullPage: false });

await page.goto(buildLocalPageUrl(base, "shop-market-mypage.html"), { waitUntil: "domcontentloaded" });
const mypageReport = await page.evaluate(() => {
  const link = document.querySelector("[data-tasful-mypage-order-history]");
  return {
    hasPurchaseHistoryLink: Boolean(link?.textContent?.includes("注文履歴")),
    hrefOk: link?.getAttribute("href") === "shop-market-order-history.html",
  };
});

await page.screenshot({ path: path.join(OUT_DIR, "market-mypage-mobile390.png"), fullPage: false });
await browser.close();

const pass =
  completeReport.hasHistoryCta &&
  completeReport.historyCtaYellow &&
  completeReport.historyCount >= 1 &&
  completeReport.firstStatus === "注文受付" &&
  completeReport.hasOrderId &&
  historyReport.cardCount >= 1 &&
  historyReport.hasProductName &&
  historyReport.hasOrderId &&
  historyReport.img72 &&
  historyReport.hasStatus &&
  historyReport.hasSearchToolbar &&
  historyReport.hasSearchInput &&
  historyReport.emptyHidden &&
  detailReport.expanded &&
  detailReport.hasPayment &&
  detailReport.hasAddress &&
  detailReport.hasSeller &&
  detailReport.hasConnect &&
  detailReport.hasTotal &&
  detailReport.hasDate &&
  mypageReport.hasPurchaseHistoryLink &&
  mypageReport.hrefOk;

console.log(
  JSON.stringify(
    {
      baseUrl: base,
      completeReport,
      historyReport,
      detailReport,
      mypageReport,
      pass,
    },
    null,
    2
  )
);
process.exit(pass ? 0 : 1);
