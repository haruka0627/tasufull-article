#!/usr/bin/env node
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/iwasho/services";
const widths = [1100, 1200, 1201, 1366, 1536, 1600, 1920, 2560];

await withPlaywrightBrowser(async (browser) => {
  const rows = [];
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const m = await page.evaluate(() => {
      const l = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().left ?? -1);
      const heroPad = getComputedStyle(document.querySelector(".iw-svc-hero__inner")).paddingLeft;
      const headerPad = getComputedStyle(document.querySelector(".iw-site-header__inner")).paddingLeft;
      return {
        logo: l(".iw-site-header__logo"),
        breadcrumb: l(".iw-svc-breadcrumb"),
        title: l(".iw-svc-hero__title"),
        heroPad,
        headerPad,
        delta: l(".iw-svc-breadcrumb") - l(".iw-site-header__logo"),
      };
    });
    rows.push({ width, ...m });
    await page.close();
  }
  console.log(JSON.stringify(rows, null, 2));
});
