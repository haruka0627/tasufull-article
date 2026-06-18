#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = path.join(root, "screenshots", "shop-store-checkout-390-padding");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-store-checkout.html" });
const url = buildLocalPageUrl(
  base,
  "shop-store-checkout.html?mode=buyNow&shopId=demo-shop-haru-cafe&productId=p-0&quantity=1"
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("[data-shop-store-checkout-payment]", { timeout: 30000 });

await page.evaluate(() => {
  const payment = document.querySelector("[data-shop-store-checkout-payment]");
  const bar = document.querySelector("[data-shop-store-checkout-bar-mobile]");
  const barH = bar?.getBoundingClientRect().height || 120;
  const target = payment.getBoundingClientRect().bottom + window.scrollY - (window.innerHeight - barH) + 12;
  window.scrollTo(0, Math.max(0, target));
});
await page.waitForTimeout(400);

const metrics = await page.evaluate(() => {
  const bar = document.querySelector("[data-shop-store-checkout-bar-mobile]");
  const bank = document.querySelector('[data-shop-store-checkout-payment] input[value="bank"]')?.closest("label");
  const submit = document.querySelector("[data-shop-store-checkout-submit]");
  const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  const hasClass = document.body.classList.contains("content-bottom-padding");
  const br = (el) => (el ? el.getBoundingClientRect() : null);
  const barR = br(bar);
  const bankR = br(bank);
  const submitR = br(submit);
  const overlap = (a, b) => a && b && a.top < b.bottom && b.top < a.bottom;
  return {
    hasClass,
    bodyPaddingBottom: bodyPad,
    barTop: barR?.top,
    bankBottom: bankR?.bottom,
    bankTop: bankR?.top,
    submitTop: submitR?.top,
    gapBankToBar: barR && bankR ? Math.round(barR.top - bankR.bottom) : null,
    bankOverlapsBar: overlap(barR, bankR),
    submitOverlapsBank: overlap(submitR, bankR),
    pass: Boolean(barR && bankR && bankR.bottom <= barR.top + 1),
  };
});

await page.screenshot({ path: path.join(OUT, "checkout-390-payment-bar.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT, "checkout-390-full.png"), fullPage: true });
await browser.close();

const report = { url, viewport: "390", ...metrics, overall: metrics.pass ? "PASS" : "FAIL" };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
