#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-phone-bg");
fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

for (const width of [390, 1280]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator(".iw-svc-wix-alt").scrollIntoViewIfNeeded();
    const info = await page.evaluate(() => {
      const box = document.querySelector(".app-section-box");
      const left = document.querySelector(".phone-col-left");
      const right = document.querySelector(".phone-col-right");
      const boxCs = getComputedStyle(box);
      const leftCs = getComputedStyle(left);
      return {
        sectionBg: boxCs.backgroundColor,
        leftBg: leftCs.backgroundColor,
        rightBg: getComputedStyle(right).backgroundColor,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    console.log(width, JSON.stringify(info));
    await page.locator(".iw-svc-wix-alt .app-section-box").screenshot({
      path: path.join(OUT, `wix-alt-${width}.png`),
    });
    await page.close();
  });
}
