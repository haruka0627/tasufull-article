#!/usr/bin/env node
/**
 * HP-MIGRATION-6D — Wix embed 直接移植 検証
 *   node scripts/capture-iwasho-wix-direct-port-6d.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/hp-migration-6d-wix-direct-port");

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
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    try {
      await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);

      const headerShot = path.join(OUT, `header-${vp.id}.png`);
      await page.screenshot({ path: headerShot, fullPage: false });

      const audit = await page.evaluate(() => {
        const doc = document.documentElement;
        const header = document.querySelector(".custom-header");
        const nav = document.querySelector(".header-nav");
        const logo = document.querySelector(".logo");
        const hr = header?.getBoundingClientRect();
        const logoStyle = logo ? getComputedStyle(logo) : null;
        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          bodyOverflow: getComputedStyle(document.body).overflow,
          htmlOverflow: getComputedStyle(document.documentElement).overflow,
          headerHeight: hr?.height ?? null,
          navLinkCount: nav?.querySelectorAll("a").length ?? 0,
          hasActiveNav: !!nav?.querySelector("a.active"),
          logoFontSize: logoStyle?.fontSize ?? null,
          logoAnimation: logoStyle?.animationName ?? null,
          logoTextTransform: logoStyle?.textTransform ?? null,
          scrollHeight: doc.scrollHeight,
          scrollable: doc.scrollHeight > doc.clientHeight + 10,
        };
      });

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        headerShot: path.relative(ROOT, headerShot).replace(/\\/g, "/"),
      });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();

const report = { base, results, pass: true, issues: [] };
for (const r of results) {
  if (r.audit.overflowX) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors`);
  }
  if (r.audit.bodyOverflow === "hidden" || r.audit.htmlOverflow === "hidden") {
    report.pass = false;
    report.issues.push(`${r.viewport}: body/html overflow hidden`);
  }
  if (r.audit.navLinkCount !== 5) {
    report.pass = false;
    report.issues.push(`${r.viewport}: nav link count ${r.audit.navLinkCount}`);
  }
  if (r.audit.logoAnimation !== "shine-rainbow") {
    report.pass = false;
    report.issues.push(`${r.viewport}: logo animation ${r.audit.logoAnimation}`);
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
