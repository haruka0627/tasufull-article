#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-about-tasful-fix");
fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/about.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 2000 } });
    await page.goto(`${base}/iwasho/about.html`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator(".card-tasful").scrollIntoViewIfNeeded();
    const info = await page.evaluate(() => {
      const card = document.querySelector(".card-tasful");
      const img = document.querySelector(".tasful-img");
      const csCard = getComputedStyle(card);
      const csImg = getComputedStyle(img);
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        copyright: document.querySelector(".copyright")?.textContent.trim(),
        card: { h: card.offsetHeight, height: csCard.height, overflow: csCard.overflow, minH: csCard.minHeight },
        img: {
          h: img.offsetHeight,
          height: csImg.height,
          overflow: csImg.overflow,
          bgSize: csImg.backgroundSize,
          bgPos: csImg.backgroundPosition,
          pb: csImg.paddingBottom,
        },
        reasonLh: getComputedStyle(document.querySelector(".iw-about-reason-card__desc")).lineHeight,
      };
    });
    console.log(width, JSON.stringify(info));
    await page.locator(".card-tasful").screenshot({ path: path.join(OUT, `tasful-card-${width}.png`) });
    await page.locator(".iw-about-reasons").screenshot({ path: path.join(OUT, `reasons-${width}.png`) });
    await page.locator(".copyright").screenshot({ path: path.join(OUT, `copyright-${width}.png`) });
    await page.close();
  });
}
