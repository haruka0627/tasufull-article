#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-categories-banner-btn");
fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator(".iw-categories__banner").scrollIntoViewIfNeeded();
    const info = await page.evaluate(() => {
      const btn = document.querySelector(".iw-categories__banner-btn");
      const heroBtn = document.querySelector(".iw-hero__btn");
      const cs = getComputedStyle(btn);
      const heroCs = heroBtn ? getComputedStyle(heroBtn) : null;
      return {
        categoriesBtn: {
          height: btn.offsetHeight,
          width: btn.offsetWidth,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          minHeight: cs.minHeight,
          computedHeight: cs.height,
        },
        heroBtn: heroBtn
          ? {
              height: heroBtn.offsetHeight,
              minHeight: heroCs.minHeight,
              paddingTop: heroCs.paddingTop,
              paddingBottom: heroCs.paddingBottom,
            }
          : null,
      };
    });
    console.log(width, JSON.stringify(info));
    await page.locator(".iw-categories__banner").screenshot({
      path: path.join(OUT, `banner-btn-${width}.png`),
    });
    await page.close();
  });
}
