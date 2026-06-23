#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-mobile-final");
fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1600 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });
    const info = await page.evaluate(() => {
      const fade = document.querySelector(".iw-svc-hero__fade");
      const note = document.querySelector(".iw-svc-section-note");
      const btn = document.querySelector(".app-btn.btn-tasful");
      const btnCs = btn ? getComputedStyle(btn) : null;
      const arrow = btn?.querySelector("span:last-child");
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fadeBg: fade ? getComputedStyle(fade).backgroundImage.slice(0, 80) : null,
        noteLh: note ? getComputedStyle(note).lineHeight : null,
        btnGap: btnCs?.gap,
        arrowMl: arrow ? getComputedStyle(arrow).marginLeft : null,
      };
    });
    console.log(width, JSON.stringify(info));
    await page.locator(".iw-svc-hero").screenshot({ path: path.join(OUT, `hero-${width}.png`) });
    await page.locator(".iw-svc-wix-alt .btn-tasful").scrollIntoViewIfNeeded();
    await page.locator(".app-btn.btn-tasful").screenshot({ path: path.join(OUT, `tasful-btn-${width}.png`) });
    await page.locator(".iw-svc-topics").scrollIntoViewIfNeeded();
    await page.locator(".iw-svc-section-note").screenshot({ path: path.join(OUT, `topics-note-${width}.png`) });
    await page.close();
  });
}
