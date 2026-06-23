#!/usr/bin/env node
/**
 * ホームページ スマホ最終調整 — 390 / 430 / 768 スクショ
 *   node scripts/capture-iwasho-home-mobile-final.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-home-mobile-final");
const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "430", width: 430, height: 932 },
  { id: "768", width: 768, height: 1024 },
];

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/" });

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.screenshot({ path: path.join(OUT, `home-full-${vp.id}.png`), fullPage: true });
    await page.locator(".info-twin-cols").scrollIntoViewIfNeeded();
    await page.locator(".info-twin-cols").screenshot({ path: path.join(OUT, `home-cards-${vp.id}.png`) });
    await page.locator(".gallery-section").scrollIntoViewIfNeeded();
    await page.locator(".gallery-section").screenshot({ path: path.join(OUT, `home-gallery-${vp.id}.png`) });
    await page.close();
  }
});

console.log("saved to", OUT);
