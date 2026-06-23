#!/usr/bin/env node
/** Legal pages 390px screenshots — node scripts/capture-legal-mobile-390.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/legal-mobile-390");

const PAGES = [
  { id: "terms", path: "/company/legal/terms.html" },
  { id: "privacy", path: "/company/legal/privacy.html" },
  { id: "tokushoho", path: "/company/legal/tokushoho.html" },
];

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "company/legal/terms.html" });
const results = [];

await withPlaywrightBrowser(async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    await page.goto(`${base}${p.path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const h2 = document.querySelector("h2");
      const strong = document.querySelector("strong");
      const h2Style = h2 ? getComputedStyle(h2) : null;
      const strongStyle = strong ? getComputedStyle(strong) : null;
      const p = document.querySelector(".terms-body p, .policy-body p");
      return {
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        h2Color: h2Style?.color,
        h2TextShadow: h2Style?.textShadow,
        strongColor: strongStyle?.color,
        pLineHeight: p ? getComputedStyle(p).lineHeight : null,
        tableRows: document.querySelectorAll(".info-table .row").length,
      };
    });
    const shot = `${p.id}-390.png`;
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
    results.push({ ...p, shot, metrics });
    await page.close();
  }
  await ctx.close();
});

await closeAllBrowsers();
console.log("Saved to", OUT);
for (const r of results) {
  const ox = r.metrics.overflowX ? "SCROLL" : "OK";
  console.log(`${r.id}: ${ox} scrollW=${r.metrics.scrollWidth} h2=${r.metrics.h2Color} lh=${r.metrics.pLineHeight}`);
}
