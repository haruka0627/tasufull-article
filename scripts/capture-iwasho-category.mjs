#!/usr/bin/env node
/**
 * IWASHO categories section captures
 *   node scripts/capture-iwasho-category.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-category");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
  { id: "1440", width: 1440, height: 900 },
  { id: "1920", width: 1920, height: 900 },
];

const base = await findDevServerBaseUrl({ probePath: "iwasho/index.html" });
fs.mkdirSync(OUT, { recursive: true });
const results = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator(".iw-categories").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const audit = await page.evaluate(() => {
        const section = document.querySelector(".iw-categories");
        const title = document.querySelector(".iw-categories__title");
        const grid = document.querySelector(".iw-categories__grid");
        const card = document.querySelector(".iw-category-card");
        const banner = document.querySelector(".iw-categories__banner");
        const sr = section?.getBoundingClientRect();
        const cr = card?.getBoundingClientRect();
        const gridStyle = grid ? getComputedStyle(grid) : null;
        return {
          sectionHeight: sr ? Math.round(sr.height) : null,
          titleFontSize: title ? getComputedStyle(title).fontSize : null,
          gridColumns: gridStyle?.gridTemplateColumns ?? null,
          gridGap: gridStyle?.gap ?? null,
          cardWidth: cr ? Math.round(cr.width) : null,
          cardHeight: cr ? Math.round(cr.height) : null,
          bannerHeight: banner ? Math.round(banner.getBoundingClientRect().height) : null,
        };
      });

      const box = await page.locator(".iw-categories").boundingBox();
      const shot = path.join(OUT, `page-category-${vp.id}.png`);
      if (box) {
        await page.screenshot({
          path: shot,
          fullPage: false,
          clip: {
            x: 0,
            y: Math.max(0, Math.floor(box.y)),
            width: vp.width,
            height: Math.ceil(box.height),
          },
        });
      }

      results.push({
        viewport: vp.id,
        audit,
        screenshot: path.relative(ROOT, shot).replace(/\\/g, "/"),
      });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();

const report = { base, results };
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
