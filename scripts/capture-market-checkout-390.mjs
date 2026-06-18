/**
 * TASFUL市場 注文確認 — 390px 検証（localhost 必須）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-checkout-390");
const CART_KEY = "tasu_market_cart_count";
const CART_ITEMS_KEY = "tasu_market_cart_items";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });

const cardMeta = await page.evaluate(() => {
  const card = document.querySelector(".tasful-market-search-card");
  return {
    title: card?.querySelector(".tasful-market-search-card__title")?.textContent?.trim() || "",
    link: card?.querySelector(".tasful-market-search-card__link")?.getAttribute("href") || "",
  };
});

await Promise.all([
  page.waitForURL(/detail-shop-product\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click(".tasful-market-search-card__link"),
]);
await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });

const detailTitle = await page.evaluate(
  () => document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || ""
);

await Promise.all([
  page.waitForURL(/shop-market-checkout\.html/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page.click("[data-tasful-product-buy-now]"),
]);
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 15000 });
await page.waitForTimeout(300);

const buyNowReport = await page.evaluate((expectedTitle) => {
  const paymentCard = document.querySelector('[data-tasful-checkout-payment] input[value="card"]');
  const submitBtn = document.querySelector("[data-tasful-checkout-submit]");
  const submitStyle = submitBtn ? getComputedStyle(submitBtn) : null;
  const itemTitle = document.querySelector(".tasful-market-checkout-item__title")?.textContent?.trim() || "";
  const totalText = document.querySelector(".tasful-market-checkout-totals .is-total dd")?.textContent || "";
  return {
    url: window.location.href,
    hasAddress: Boolean(document.querySelector("[data-tasful-checkout-address]")?.textContent?.includes("山田")),
    hasPaymentCard: Boolean(paymentCard?.checked),
    itemCount: document.querySelectorAll(".tasful-market-checkout-item").length,
    itemTitle,
    titleMatches: itemTitle === expectedTitle,
    hasTrust: document.body.innerText.includes("TASFUL安心決済"),
    hasTotals: /¥/.test(totalText),
    totalText,
    hasSubmit: Boolean(submitBtn),
    submitYellow:
      submitStyle?.backgroundColor === "rgb(255, 216, 20)" ||
      (submitStyle?.backgroundColor || "").includes("255, 216"),
    hasNote: document.body.innerText.includes("利用規約"),
  };
}, detailTitle);

await page.screenshot({ path: path.join(OUT_DIR, "market-checkout-buyNow-mobile390.png"), fullPage: false });

await page.click("[data-tasful-checkout-submit]");
await page.waitForURL(/shop-market-complete\.html/, { waitUntil: "domcontentloaded", timeout: 15000 });
const completeOk = page.url().includes("shop-market-complete.html");
const completeReport = await page.evaluate(() => ({
  hasOrderId: Boolean(document.querySelector("[data-tasful-complete-order-id]")?.textContent?.includes("TM-")),
  hasTotal: /¥/.test(document.querySelector("[data-tasful-complete-total]")?.textContent || ""),
  cartCount: Number(localStorage.getItem("tasu_market_cart_count")) || 0,
}));

await page.screenshot({ path: path.join(OUT_DIR, "market-checkout-complete-mobile390.png"), fullPage: false });

const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page2.goto(searchUrl, { waitUntil: "domcontentloaded" });
await page2.evaluate(
  (keys) => {
    localStorage.setItem(keys.cart, "0");
    localStorage.setItem(keys.items, "[]");
  },
  { cart: CART_KEY, items: CART_ITEMS_KEY }
);
await page2.waitForSelector("[data-tasful-market-add-cart]", { timeout: 15000 });
await page2.click("[data-tasful-market-add-cart]");
await page2.waitForTimeout(400);
await page2.goto(buildLocalPageUrl(base, "shop-market-cart.html"), { waitUntil: "domcontentloaded" });
await page2.waitForSelector("[data-tasful-market-cart-checkout]:not([hidden])", { timeout: 15000 });
await Promise.all([
  page2.waitForURL(/shop-market-checkout\.html.*mode=cart/, { waitUntil: "domcontentloaded", timeout: 15000 }),
  page2.click("[data-tasful-market-cart-checkout]"),
]);
await page2.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 15000 });
await page2.waitForSelector(".tasful-market-checkout-item", { timeout: 15000 });
const cartFlowOk = page2.url().includes("mode=cart");
const cartCheckoutReport = await page2.evaluate(() => ({
  itemCount: document.querySelectorAll(".tasful-market-checkout-item").length,
  hasSubmit: Boolean(document.querySelector("[data-tasful-checkout-submit]")),
}));

await page2.screenshot({ path: path.join(OUT_DIR, "market-checkout-cart-mobile390.png"), fullPage: false });
});

const pass =
  buyNowReport.url.includes("shop-market-checkout.html") &&
  buyNowReport.url.includes("mode=buyNow") &&
  buyNowReport.hasAddress &&
  buyNowReport.hasPaymentCard &&
  buyNowReport.itemCount === 1 &&
  buyNowReport.titleMatches &&
  buyNowReport.hasTrust &&
  buyNowReport.hasTotals &&
  buyNowReport.hasSubmit &&
  buyNowReport.submitYellow &&
  buyNowReport.hasNote &&
  completeOk &&
  completeReport.hasOrderId &&
  completeReport.hasTotal &&
  completeReport.cartCount === 0 &&
  cartFlowOk &&
  cartCheckoutReport.itemCount >= 1 &&
  cartCheckoutReport.hasSubmit;

console.log(
  JSON.stringify(
    {
      baseUrl: base,
      cardMeta,
      detailTitle,
      buyNowReport,
      completeReport,
      cartCheckoutReport,
      cartFlowOk,
      completeOk,
      pass,
    },
    null,
    2
  )
);
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
