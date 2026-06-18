#!/usr/bin/env node
/**
 * 店舗販売導線 — detail-shop-store-product 分離検証（PC1280 / 390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-product-flow");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = { base, steps: [], ok: true };

function step(name, pass, detail, extra = {}) {
  report.steps.push({ name, pass, detail, ...extra });
  if (!pass) report.ok = false;
}

await withPlaywrightBrowser(async (browser) => {async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

for (const vp of [
  { label: "pc1280", width: 1280, height: 900 },
  { label: "mobile390", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

  // ① shop-vendors
  await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await shot(page, `01-shop-vendors-${vp.label}.png`);

  // ② detail-shop-store
  await page.goto(buildLocalPageUrl(base, "detail-shop-store.html?id=demo-shop-reworks"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(
    () => document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
    { timeout: 25000 }
  );
  await page.waitForTimeout(800);
  await shot(page, `02-detail-shop-store-${vp.label}.png`);

  // ③ shop-products
  await page.goto(buildLocalPageUrl(base, "shop-products.html?id=demo-shop-reworks"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  const firstCardHref = await page.evaluate(() => {
    const a = document.querySelector(".shop-products-card__link");
    return a?.getAttribute("href") || "";
  });
  const usesStoreProduct = /detail-shop-store-product\.html/.test(firstCardHref);
  step(
    `shop-products card href (${vp.label})`,
    usesStoreProduct,
    firstCardHref || "no card link",
    { viewport: vp.label }
  );
  await shot(page, `03-shop-products-${vp.label}.png`);

  if (!firstCardHref) {
    await page.close();
    continue;
  }

  // ④ detail-shop-store-product
  await page.goto(buildLocalPageUrl(base, firstCardHref.replace(/^\//, "")), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  const productPage = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector("[data-shop-product-title]")?.textContent?.trim() || "",
    layoutHidden: document.querySelector("[data-shop-product-layout]")?.hidden ?? true,
    hasMarketHeader: Boolean(document.querySelector(".tasful-market-mall-header")),
    hasShopHeader: Boolean(document.querySelector("[data-shop-store-market-header]")),
    shopLink: document.querySelector("[data-shop-product-shop-link]")?.getAttribute("href") || "",
    cartBtn: document.querySelector("[data-shop-product-add-cart]")?.textContent?.trim() || "",
    buyBtn: document.querySelector("[data-shop-product-buy-now]")?.textContent?.trim() || "",
    isStoreProductUrl: /detail-shop-store-product\.html/.test(location.pathname),
  }));
  step(
    `store product detail UI (${vp.label})`,
    productPage.isStoreProductUrl && !productPage.layoutHidden && productPage.title && productPage.hasShopHeader && !productPage.hasMarketHeader,
    JSON.stringify(productPage),
    { viewport: vp.label }
  );
  step(
    `seller link → detail-shop-store (${vp.label})`,
    /detail-shop-store\.html\?id=demo-shop-reworks/.test(productPage.shopLink),
    productPage.shopLink,
    { viewport: vp.label }
  );
  await shot(page, `04-detail-shop-store-product-${vp.label}.png`);

  // ⑤ cart add
  const cartBtn = page.locator("[data-shop-product-add-cart]");
  if (await cartBtn.isEnabled().catch(() => false)) {
    await cartBtn.click({ force: true });
    await page.waitForTimeout(800);
  }
  await page.goto(buildLocalPageUrl(base, "shop-store-cart.html"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const cartState = await page.evaluate(() => ({
    title: document.title,
    hasItems: document.querySelectorAll(".tasful-market-cart-item, [data-tasful-cart-item], .shop-market-cart-item").length,
  }));
  step(
    `cart page reachable (${vp.label})`,
    !/エラー|not found/i.test(cartState.title),
    `items=${cartState.hasItems}`,
    { viewport: vp.label }
  );
  await shot(page, `05-shop-market-cart-${vp.label}.png`);

  await page.close();
}

});

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(report.ok ? 0 : 1);
