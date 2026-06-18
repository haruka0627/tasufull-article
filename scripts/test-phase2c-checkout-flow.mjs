#!/usr/bin/env node
/**
 * Phase 2-C smoke: checkout → demo order complete + service-fee-pay card.
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const SHOP_ID = "demo-shop-haru-cafe";
const PRODUCT_ID = "demo-restaurant-0";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const results = [];


  const checkoutUrl = `${BASE}/checkout.html?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}&productName=${encodeURIComponent("テスト商品")}&price=1200&quantity=2`;
  const checkoutErrors = collectErrors(page);
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.waitForSelector("[data-checkout-card]:not([hidden])", { timeout: 15000 });

  const shopName = (await page.locator("[data-checkout-shop-name]").textContent())?.trim();
  const qty = (await page.locator("[data-checkout-quantity]").textContent())?.trim();
  const product = (await page.locator("[data-checkout-product-name]").textContent())?.trim();
  const payText = (await page.locator("[data-checkout-pay]").textContent())?.trim();

  results.push({
    step: "checkout",
    url: checkoutUrl,
    shopName,
    product,
    quantity: qty,
    payButton: payText,
    errors: checkoutErrors.length ? [...checkoutErrors] : [],
    ok: Boolean(shopName) && qty === "2" && checkoutErrors.length === 0,
  });

  page.once("dialog", (d) => d.dismiss().catch(() => {}));
  await page.locator("[data-checkout-pay]").click();
  await page.waitForURL(/order-complete\.html/, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const completeErrors = [];
  page.on("pageerror", (e) => completeErrors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") completeErrors.push(msg.text());
  });

  await page.waitForSelector("[data-order-complete-card]:not([hidden])", { timeout: 10000 });
  const orderId = await page.locator("[data-order-id]").textContent();
  const orderQty = await page.locator("[data-order-quantity]").textContent();
  const status = await page.locator("[data-order-complete-status]").textContent();

  results.push({
    step: "order-complete",
    url: page.url(),
    orderId: orderId?.trim(),
    quantity: orderQty?.trim(),
    status: status?.trim(),
    errors: completeErrors,
    ok: Boolean(orderId?.trim()) && orderQty === "2" && completeErrors.length === 0,
  });

  await page.goto(`${BASE}/service-fee-pay.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const deal = {
      id: "local-deal-test-phase2c",
      status: "fee_pending",
      agreed_amount: 100000,
      platform_fee_rate: 0.05,
      platform_fee_amount: 5000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _source: "local",
    };
    localStorage.setItem("tasu_service_deals", JSON.stringify([deal]));
  });
  const feeErrors = [];
  page.on("pageerror", (e) => feeErrors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") feeErrors.push(msg.text());
  });
  await page.goto(`${BASE}/service-fee-pay.html?deal=local-deal-test-phase2c`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);
  await page.waitForSelector("[data-fee-card]:not([hidden])", { timeout: 10000 });
  const feeStatus = await page.locator("[data-fee-status]").textContent();
  const dealId = await page.locator("[data-fee-deal-id]").textContent();
  const feeAmount = await page.locator("[data-fee-amount]").textContent();
  const hasStripeBtn = (await page.locator("[data-fee-stripe-pay]").count()) > 0;
  const hasBank = (await page.locator("[data-fee-bank]").count()) > 0;

  results.push({
    step: "service-fee-pay",
    feeStatus: feeStatus?.trim(),
    dealId: dealId?.trim(),
    feeAmount: feeAmount?.trim(),
    hasStripeBtn,
    hasBank,
    errors: feeErrors,
    ok:
      hasStripeBtn &&
      hasBank &&
      dealId?.includes("local-deal-test-phase2c") &&
      feeErrors.length === 0,
  });
});


console.log(JSON.stringify(results, null, 2));
await closeAllBrowsers();
process.exit(results.every((r) => r.ok) ? 0 : 1);
