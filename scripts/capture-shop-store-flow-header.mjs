#!/usr/bin/env node
/**
 * 店舗販売 checkout / complete ヘッダーロゴ検証
 *   node scripts/capture-shop-store-flow-header.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = path.join(root, "screenshots", "shop-store-flow-header");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  {
    key: "checkout",
    path: "shop-store-checkout.html?mode=buyNow&shopId=demo-shop-haru-cafe&productId=p-0&quantity=1",
    titleSel: ".shop-store-flow-main__title, .tasful-market-checkout-main__title",
  },
  {
    key: "complete",
    path: "shop-store-complete.html",
    titleSel: ".shop-store-complete-card__title",
  },
];

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const base = await findDevServerBaseUrl({ probePath: "shop-store-checkout.html" });
await withPlaywrightBrowser(async (browser) => {const report = { generatedAt: new Date().toISOString(), overall: "PASS", results: [] };

for (const pageDef of PAGES) {
  for (const vp of VIEWPORTS) {
    const entry = { page: pageDef.key, viewport: vp.label, verdict: "PASS", issues: [], metrics: {}, shots: [] };
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      await page.goto(buildLocalPageUrl(base, pageDef.path), { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(pageDef.key === "checkout" ? 2500 : 800);

      const metrics = await page.evaluate((titleSel) => {
        const icon = document.querySelector(".tasful-ai-logo-icon");
        const main = document.querySelector(".tasful-ai-logo-text .main");
        const sub = document.querySelector(".tasful-ai-logo-text .sub");
        const title = document.querySelector(titleSel);
        const header = document.querySelector(".shop-market-header__inner");
        const cs = (el) => (el ? getComputedStyle(el) : null);
        return {
          iconPx: Math.round(icon?.getBoundingClientRect().width || 0),
          mainPx: parseFloat(cs(main)?.fontSize || "0"),
          subPx: parseFloat(cs(sub)?.fontSize || "0"),
          titlePx: parseFloat(cs(title)?.fontSize || "0"),
          headerPx: Math.round(header?.getBoundingClientRect().height || 0),
          titleText: title?.textContent?.trim() || "",
        };
      }, pageDef.titleSel);

      entry.metrics = metrics;
      if (metrics.iconPx > 50) entry.issues.push(`logo too large: ${metrics.iconPx}px`);
      if (metrics.iconPx < 44) entry.issues.push(`logo too small: ${metrics.iconPx}px`);
      if (metrics.titlePx <= metrics.mainPx) entry.issues.push(`title not dominant (${metrics.titlePx}px <= ${metrics.mainPx}px)`);

      const file = `${pageDef.key}-${vp.label}-header.png`;
      await page.locator("header.shop-market-header").screenshot({ path: path.join(OUT, file) });
      entry.shots.push(file);

      const filePage = `${pageDef.key}-${vp.label}-first-view.png`;
      await page.screenshot({ path: path.join(OUT, filePage), fullPage: false });
      entry.shots.push(filePage);

      entry.verdict = entry.issues.length ? "FAIL" : "PASS";
      if (entry.verdict === "FAIL") report.overall = "FAIL";
    } catch (err) {
      entry.verdict = "FAIL";
      entry.issues.push(String(err?.message || err));
      report.overall = "FAIL";
    } finally {
      report.results.push(entry);
      await context.close();
    }
  }
}

});
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Saved: ${OUT}`);

await closeAllBrowsers();
