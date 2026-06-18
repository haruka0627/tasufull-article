#!/usr/bin/env node
/**
 * Phase 2-F: console smoke on main pages after cleanup.
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5188";
const PAGES = [
  "/index-top.html",
  "/index.html",
  "/business.html",
  "/job-top.html",
  "/shop-store.html",
  "/detail-business-service.html?id=demo-field-service",
  "/checkout.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0&productName=test&price=100&quantity=1",
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const path of PAGES) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  const url = `${BASE}${path}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const ufffd = ((await page.content()) || "").match(/\uFFFD/g)?.length || 0;
    results.push({ path, url, errors, ufffd, ok: errors.length === 0 && ufffd === 0 });
  } catch (e) {
    results.push({ path, url, errors: [String(e)], ok: false });
  }
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
const allOk = results.every((r) => r.ok);
process.exit(allOk ? 0 : 1);
