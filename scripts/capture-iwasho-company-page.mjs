#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-company-page");
const widths = [390, 768, 1280];

const base = await findDevServerBaseUrl({ probePath: "iwasho/company.html" });
fs.mkdirSync(OUT, { recursive: true });

const report = { base, url: `${base}/iwasho/company.html`, capturedAt: new Date().toISOString(), viewports: [] };

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await page.goto(`${base}/iwasho/company.html`, { waitUntil: "networkidle", timeout: 90000 });

    const audit = await page.evaluate(() => ({
      hero: !!document.querySelector(".iw-co-hero"),
      info: !!document.querySelector(".iw-co-info"),
      history: !!document.querySelector(".iw-co-history"),
      philosophy: !!document.querySelector(".iw-co-philosophy"),
      cta: !!document.querySelector(".iw-co-cta"),
      timelineItems: document.querySelectorAll(".iw-co-timeline__item").length,
      tableRows: document.querySelectorAll(".iw-co-table tr").length,
      bizItems: document.querySelectorAll(".iw-co-biz-card__list li").length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));

    await page.screenshot({ path: path.join(OUT, `company-${width}.png`), fullPage: true });
    report.viewports.push({ width, audit });
    await page.close();
  }
});

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
