#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results = [];

await page.goto("http://localhost:5502/screenshots/index.html#recent-reviews", {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector(".recent-card__thumb[data-lightbox-src]");

const connectThumb = page.locator('[data-review-folder="connect-final-review"] .recent-card__thumb');
const connectCta = page.locator('[data-review-folder="connect-final-review"] .recent-card__cta');

await connectThumb.click();
await page.waitForSelector("#img-viewer.is-open", { timeout: 5000 });
results.push({
  check: "thumb opens viewer",
  ok: await page.locator("#img-viewer.is-open").isVisible(),
});
results.push({
  check: "viewer has connect image",
  ok: /connect-final-review/.test((await page.locator("#img-viewer-img").getAttribute("src")) || ""),
});

await page.locator("#img-viewer-zoom-in").click();
const zoom = await page.locator("#img-viewer-zoom-pct").textContent();
results.push({ check: "zoom works", ok: zoom !== "100%" });

await page.keyboard.press("Escape");
await page.waitForTimeout(200);
results.push({
  check: "esc closes viewer",
  ok: !(await page.locator("#img-viewer.is-open").isVisible()),
});

await Promise.all([page.waitForURL(/connect-final-review\/index\.html/, { timeout: 15000 }), connectCta.click()]);
results.push({
  check: "cta goes to detail",
  ok: page.url().includes("connect-final-review/index.html"),
});

const back = page.locator(".screenshot-back-nav__link");
results.push({ check: "back link visible", ok: await back.isVisible() });
results.push({
  check: "back link href",
  ok: (await back.getAttribute("href")) === "../index.html#recent-reviews",
});

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ allOk, results }, null, 2));
process.exit(allOk ? 0 : 1);
