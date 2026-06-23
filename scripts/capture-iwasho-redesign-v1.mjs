#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-redesign-v1");
const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const base = await findDevServerBaseUrl({ probePath: "iwasho/index.html" });
fs.mkdirSync(OUT, { recursive: true });
const results = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));
    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      const shot = path.join(OUT, `top-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const audit = await page.evaluate((vpId) => {
        const doc = document.documentElement;
        const hero = document.querySelector(".iw-hero");
        const header = document.querySelector(".iw-site-header");
        const panel = document.querySelector(".iw-hero__panel");
        const icon = document.querySelector(".iw-hero__feature-icon svg");
        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
          heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
          heroGridCols: vpId === "1280" && hero ? getComputedStyle(document.querySelector(".iw-hero__inner")).gridTemplateColumns : null,
          hasPanel: !!panel,
          hasSeparateCards: document.querySelectorAll(".iw-feature-card").length,
          iconSize: icon ? Math.round(icon.getBoundingClientRect().width) : null,
          pageBg: getComputedStyle(document.querySelector(".iwasho-home-page")).backgroundColor,
        };
      }, vp.id);
      results.push({ viewport: vp.id, consoleErrors, audit, screenshot: path.relative(ROOT, shot).replace(/\\/g, "/") });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();
const pass = results.every((r) => {
  if (r.audit.overflowX || r.consoleErrors.length) return false;
  if (r.viewport === "1280") {
    return r.audit.headerHeight === 80
      && r.audit.heroHeight >= 520 && r.audit.heroHeight <= 560
      && r.audit.hasPanel
      && r.audit.hasSeparateCards === 0
      && r.audit.iconSize <= 26;
  }
  return true;
});
console.log(JSON.stringify({ pass, results }, null, 2));
process.exit(pass ? 0 : 1);
