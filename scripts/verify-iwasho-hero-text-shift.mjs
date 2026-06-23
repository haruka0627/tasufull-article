#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-hero-align");
const url = "http://127.0.0.1:8788/iwasho/services";
fs.mkdirSync(OUT, { recursive: true });

const widths = [1280, 1440, 1920];
const report = { url, viewports: [] };

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const data = await page.evaluate(() => {
      const l = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().left ?? -999);
      const ml = getComputedStyle(document.querySelector(".iw-svc-hero__content")).marginLeft;
      return {
        logo: l(".iw-site-header__logo"),
        breadcrumb: l(".iw-svc-breadcrumb"),
        title: l(".iw-svc-hero__title"),
        lead: l(".iw-svc-hero__lead"),
        marginLeft: ml,
        shiftFromLogo: l(".iw-svc-breadcrumb") - l(".iw-site-header__logo"),
      };
    });
    await page.screenshot({ path: path.join(OUT, `hero-text-final-${width}.png`) });
    report.viewports.push({ width, ...data });
    await page.close();
  }
});

fs.writeFileSync(path.join(OUT, "hero-text-final.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
