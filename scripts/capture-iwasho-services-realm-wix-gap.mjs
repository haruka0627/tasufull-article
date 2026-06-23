#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-realm-wix-gap");
const sub = process.argv[2] === "after" ? "after" : "before";
const DIR = path.join(OUT, sub);
fs.mkdirSync(DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 2400 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });

    const metrics = await page.evaluate(() => {
      const lastCard = document.querySelector(".iw-about-service-card:last-child");
      const title = document.querySelector("#iw-svc-alt-title");
      const about = document.querySelector(".iw-about-services");
      const wix = document.querySelector(".iw-svc-wix-alt");
      const lr = lastCard.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardToTitle: Math.round(tr.top - lr.bottom),
        aboutPadBottom: getComputedStyle(about).paddingBottom,
        wixPadTop: getComputedStyle(wix).paddingTop,
      };
    });
    console.log(sub, width, JSON.stringify(metrics));

    await page.locator(".iw-about-service-card:last-child").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const card = document.querySelector(".iw-about-service-card:last-child");
      const title = document.querySelector("#iw-svc-alt-title");
      const top = card.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo(0, Math.max(0, top));
    });

    const clip = await page.evaluate(() => {
      const card = document.querySelector(".iw-about-service-card:last-child");
      const title = document.querySelector("#iw-svc-alt-title");
      const cardRect = card.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, cardRect.top - 16),
        width: document.documentElement.clientWidth,
        height: Math.min(titleRect.bottom - cardRect.top + 32, 900),
      };
    });

    await page.screenshot({ path: path.join(DIR, `gap-${width}.png`), clip });
    await page.close();
  });
}
