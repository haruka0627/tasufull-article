#!/usr/bin/env node
/**
 * IWASHO TOP vertical balance verification
 *   node scripts/capture-iwasho-balance.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-balance");

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
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(400);

      const audit = await page.evaluate((vpId) => {
        const rect = (s) => {
          const el = document.querySelector(s);
          const r = el?.getBoundingClientRect();
          return r
            ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
            : null;
        };
        const gap = (a, b) => (a && b ? Math.round(b.top - a.bottom) : null);
        const hero = rect(".iw-hero");
        const categories = rect(".iw-categories");
        const partner = rect(".section-container");
        const footer = rect(".footer-wrapper");
        const catTitleTop = Math.round(document.querySelector(".iw-categories__title")?.getBoundingClientRect().top ?? 0);
        const heroRatio = hero ? +(hero.height / window.innerHeight).toFixed(2) : null;

        return {
          vh: window.innerHeight,
          hero,
          heroRatio,
          catTitleTop,
          catVisibleOnLoad: catTitleTop > 0 && catTitleTop < window.innerHeight,
          gapHeroToCategories: gap(hero, categories),
          gapCategoriesToPartner: gap(categories, partner),
          gapPartnerToFooter: gap(partner, footer),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          pcHeroNotFullViewport: vpId !== "390" && vpId !== "768" ? heroRatio !== null && heroRatio < 0.72 : true,
        };
      }, vp.id);

      const shot = path.join(OUT, `balance-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      results.push({ viewport: vp.id, consoleErrors, audit, screenshot: path.relative(ROOT, shot).replace(/\\/g, "/") });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();

const report = { base, results, pass: true, issues: [] };
for (const r of results) {
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors`);
  }
  if (r.audit.overflowX) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (["1280", "1440", "1920"].includes(r.viewport)) {
    if (!r.audit.pcHeroNotFullViewport) {
      report.pass = false;
      report.issues.push(`${r.viewport}: hero still full viewport (${r.audit.heroRatio})`);
    }
    if (r.audit.heroRatio > 0.68) {
      report.pass = false;
      report.issues.push(`${r.viewport}: hero too tall ratio ${r.audit.heroRatio}`);
    }
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
