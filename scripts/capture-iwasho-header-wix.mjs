#!/usr/bin/env node
/**
 * IWASHO header — Wix版比較キャプチャ
 *   node scripts/capture-iwasho-header-wix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-header-wix");

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
        const inner = document.querySelector(".iw-site-header__inner");
        const brand = document.querySelector(".iw-site-header__brand");
        const logo = document.querySelector(".iw-site-header__logo");
        const tagline = document.querySelector(".iw-site-header__tagline");
        const navAndBtn = document.querySelector(".iw-site-header__nav-and-btn");
        const nav = document.querySelector(".iw-site-header__nav");
        const btn = document.querySelector(".iw-site-header__btn--primary");
        const hr = header?.getBoundingClientRect();
        const br = brand?.getBoundingClientRect();
        const nr = navAndBtn?.getBoundingClientRect();
        const logoStyle = logo ? getComputedStyle(logo) : null;
        const navStyle = nav ? getComputedStyle(nav) : null;
        const navAndBtnStyle = navAndBtn ? getComputedStyle(navAndBtn) : null;
        const btnStyle = btn ? getComputedStyle(btn) : null;
        return {
          headerHeight: hr ? Math.round(hr.height) : null,
          innerPaddingLeft: inner ? getComputedStyle(inner).paddingLeft : null,
          innerMaxWidth: inner ? getComputedStyle(inner).maxWidth : null,
          brandLeft: br ? Math.round(br.left) : null,
          navAndBtnRight: nr ? Math.round(nr.right) : null,
          logoFontSize: logoStyle?.fontSize ?? null,
          logoFontWeight: logoStyle?.fontWeight ?? null,
          logoColor: logoStyle?.color ?? null,
          taglineFontSize: tagline ? getComputedStyle(tagline).fontSize : null,
          navGap: navStyle?.gap ?? null,
          navAndBtnGap: navAndBtnStyle?.gap ?? null,
          navFontSize: nav?.querySelector("a") ? getComputedStyle(nav.querySelector("a")).fontSize : null,
          btnText: btn?.querySelector("span")?.textContent?.trim() ?? null,
          btnPadding: btnStyle?.padding ?? null,
          btnRadius: btnStyle?.borderRadius ?? null,
          btnFontSize: btnStyle?.fontSize ?? null,
          btnBg: btnStyle?.backgroundColor ?? null,
          navVisible: navAndBtnStyle?.display !== "none",
        };
      });

      const clipH = audit.headerHeight ?? 88;
      const shot = path.join(OUT, `header-${vp.id}.png`);
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

const report = { base, results };
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
