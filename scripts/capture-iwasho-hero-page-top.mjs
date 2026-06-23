#!/usr/bin/env node
/**
 * IWASHO header + hero page-top captures
 *   node scripts/capture-iwasho-hero-page-top.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-hero-page-top");

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
      await page.evaluate(() => window.scrollTo(0, 0));

      const audit = await page.evaluate(() => {
        const header = document.querySelector(".iw-site-header");
        const hero = document.querySelector(".iw-hero");
        const bg = document.querySelector(".iw-hero-bg");
        const panel = document.querySelector(".iw-hero__panel");
        const left = document.querySelector(".iw-hero__left");
        const hdr = header?.getBoundingClientRect();
        const hr = hero?.getBoundingClientRect();
        const pr = panel?.getBoundingClientRect();
        const bgStyle = bg ? getComputedStyle(bg) : null;
        return {
          pageUrl: location.href,
          bgImage: bgStyle?.backgroundImage ?? null,
          bgSize: bgStyle?.backgroundSize ?? null,
          bgPosition: bgStyle?.backgroundPosition ?? null,
          heroHeight: hr ? Math.round(hr.height) : null,
          headerHeight: hdr ? Math.round(hdr.height) : null,
          clipHeight: hdr && hr ? Math.round(hdr.height + hr.height) : null,
          panelWidth: pr ? Math.round(pr.width) : null,
          leftWidth: left ? Math.round(left.getBoundingClientRect().width) : null,
        };
      });

      const clipH = audit.clipHeight ?? 740;
      const shot = path.join(OUT, `page-top-${vp.id}.png`);
      await page.screenshot({
        path: shot,
        fullPage: false,
        clip: { x: 0, y: 0, width: vp.width, height: clipH },
      });

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

const pass = results.every((r) => {
  return r.audit.headerHeight === 88
    && r.audit.bgImage?.includes("hero-bg-wix.png")
    && r.audit.bgSize === "cover";
});

const report = { base, pass, results };
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
