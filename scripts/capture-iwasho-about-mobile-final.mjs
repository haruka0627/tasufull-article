#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-about-mobile-final");
fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/about.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 2400 } });
    await page.goto(`${base}/iwasho/about.html`, { waitUntil: "networkidle", timeout: 120000 });
    const info = await page.evaluate(() => {
      const btnSel = [".iw-about-cta__btn", ".footer-wrapper .contact-btn"];
      const btns = btnSel.map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { sel, text: el.textContent.trim().slice(0, 30), h: el.offsetHeight, minH: cs.minHeight, pt: cs.paddingTop, pb: cs.paddingBottom };
      }).filter(Boolean);
      const noteSel = [".card-iwasho .biz-desc", ".card-iwasho .feature-text", ".iw-about-cta__lead"];
      const notes = noteSel.map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { sel, text: el.textContent.trim().slice(0, 50), fs: cs.fontSize, lh: cs.lineHeight };
      }).filter(Boolean);
      return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, btns, notes };
    });
    console.log(width, JSON.stringify(info));
    await page.locator(".card-iwasho").screenshot({ path: path.join(OUT, `navy-card-${width}.png`) });
    await page.locator(".iw-about-cta").screenshot({ path: path.join(OUT, `cta-${width}.png`) });
    await page.locator(".footer-wrapper").screenshot({ path: path.join(OUT, `footer-${width}.png`) });
    await page.close();
  });
}
