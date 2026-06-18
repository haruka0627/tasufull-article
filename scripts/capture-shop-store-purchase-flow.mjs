#!/usr/bin/env node
/**
 * 店舗販売購入フロー検証 — shop-store-cart/checkout/complete
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-purchase-flow");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const report = { base, cases: [], ok: true };

function fail(msg) {
  report.ok = false;
  return msg;
}

async function clearCart(page) {
  await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_cart_count");
  });
}

async function runFlow(page, vp, fc, mode) {
  const caseId = `${fc.label}-${mode}-${vp.label}`;
  const result = { caseId, productId: fc.productId, mode, viewport: vp.label, steps: [] };
  const detailUrl = `detail-shop-store-product.html?shopId=${encodeURIComponent(fc.shopId)}&productId=${encodeURIComponent(fc.productId)}`;

  await clearCart(page);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(buildLocalPageUrl(base, detailUrl), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const detailOk = await page.evaluate(() => ({
    path: location.pathname,
    title: document.querySelector("[data-shop-product-title]")?.textContent?.trim() || "",
    hidden: document.querySelector("[data-shop-product-layout]")?.hidden ?? true,
  }));
  if (detailOk.path !== "/detail-shop-store-product.html" || detailOk.hidden || !detailOk.title) {
    result.steps.push({ step: "detail", pass: false, detail: JSON.stringify(detailOk) });
    report.cases.push(result);
    return result;
  }
  result.steps.push({ step: "detail", pass: true, detail: detailOk.title });
  await page.screenshot({ path: path.join(OUT, `${caseId}-01-detail.png`), fullPage: false });

  if (mode === "cart") {
    const cartBtn = page.locator("[data-shop-product-add-cart]");
    if (!(await cartBtn.isEnabled().catch(() => false))) {
      result.steps.push({ step: "add-cart", pass: false, detail: "cart button disabled" });
      report.cases.push(result);
      return result;
    }
    await cartBtn.click({ force: true });
    await page.waitForTimeout(600);
    await page.goto(buildLocalPageUrl(base, "shop-store-cart.html"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  } else {
    const buyBtn = page.locator("[data-shop-product-buy-now]");
    if (!(await buyBtn.isEnabled().catch(() => false))) {
      result.steps.push({ step: "buy-now", pass: false, detail: "buy button disabled" });
      report.cases.push(result);
      return result;
    }
    await buyBtn.click({ force: true });
    await page.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const afterAction = await page.evaluate(() => ({
    path: location.pathname,
    href: location.href,
    hasMarket: /shop-market-(cart|checkout|complete)/.test(location.pathname),
  }));
  const expectPath = mode === "cart" ? "/shop-store-cart.html" : "/shop-store-checkout.html";
  if (afterAction.path !== expectPath || afterAction.hasMarket) {
    result.steps.push({ step: mode, pass: false, detail: JSON.stringify(afterAction) });
    report.cases.push(result);
    return result;
  }
  result.steps.push({ step: mode, pass: true, detail: afterAction.path });
  await page.screenshot({ path: path.join(OUT, `${caseId}-02-${mode === "cart" ? "cart" : "checkout"}.png`), fullPage: false });

  if (mode === "cart") {
    await page.goto(buildLocalPageUrl(base, "shop-store-checkout.html?mode=cart"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  }

  const checkoutState = await page.evaluate(() => ({
    path: location.pathname,
    status: document.querySelector("[data-shop-store-checkout-status]")?.textContent?.trim() || "",
    bodyHidden: document.querySelector("[data-shop-store-checkout-body]")?.hidden ?? true,
    items: document.querySelectorAll(".tasful-market-checkout-item").length,
    hasMarketHeader: Boolean(document.querySelector(".tasful-market-mall-header")),
  }));
  if (checkoutState.path !== "/shop-store-checkout.html" || checkoutState.bodyHidden || checkoutState.items < 1) {
    result.steps.push({ step: "checkout", pass: false, detail: JSON.stringify(checkoutState) });
    report.cases.push(result);
    return result;
  }
  if (checkoutState.hasMarketHeader) {
    result.steps.push({ step: "checkout-header", pass: false, detail: "market header present" });
    report.cases.push(result);
    return result;
  }
  result.steps.push({ step: "checkout", pass: true, detail: `items=${checkoutState.items}` });
  await page.screenshot({ path: path.join(OUT, `${caseId}-03-checkout.png`), fullPage: false });

  const submitBtn = page.locator("[data-shop-store-checkout-submit]:visible, [data-shop-store-checkout-submit-aside]:visible").first();
  if (await submitBtn.count()) {
    await submitBtn.click({ force: true });
  } else {
    await page.evaluate(() => {
      document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click();
    });
  }
  await page.waitForTimeout(1200);

  const completeState = await page.evaluate(() => ({
    path: location.pathname,
    order: document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || "",
    shopLink: document.querySelector("[data-shop-store-complete-shop-link]")?.getAttribute("href") || "",
  }));
  if (completeState.path !== "/shop-store-complete.html" || !completeState.order) {
    result.steps.push({ step: "complete", pass: false, detail: JSON.stringify(completeState) });
    report.cases.push(result);
    return result;
  }
  if (!/detail-shop-store\.html\?id=/.test(completeState.shopLink)) {
    result.steps.push({ step: "complete-shop-link", pass: false, detail: completeState.shopLink });
    report.cases.push(result);
    return result;
  }
  result.steps.push({ step: "complete", pass: true, detail: completeState.order });
  await page.screenshot({ path: path.join(OUT, `${caseId}-04-complete.png`), fullPage: false });

  report.cases.push(result);
  return result;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const products = [
  { shopId: "demo-shop-haru-cafe", productId: "demo-restaurant-0", label: "demo" },
  { shopId: "demo-shop-haru-cafe", productId: "p-0", label: "p-index" },
];

for (const vp of [
  { label: "pc1280", width: 1280, height: 900 },
  { label: "mobile390", width: 390, height: 844 },
]) {
  for (const fc of products) {
    for (const mode of ["cart", "buyNow"]) {
      const r = await runFlow(page, vp, fc, mode);
      const allPass = r.steps.every((s) => s.pass);
      if (!allPass) report.ok = false;
    }
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, cases: report.cases.length, failed: report.cases.filter((c) => c.steps.some((s) => !s.pass)).map((c) => c.caseId) }, null, 2));
process.exit(report.ok ? 0 : 1);
