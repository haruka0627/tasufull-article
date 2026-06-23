#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-team-cards");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "iwasho/team.html" });

for (const width of [1280, 390]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1600 } });
    await page.goto(`${base}/iwasho/team.html`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator(".iw-team-group").first().scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const container = document.querySelector(".iw-team-group .iw-team-container");
      const cards = document.querySelector(".iw-team-cards");
      const card = document.querySelector(".iw-team-card");
      const portrait = document.querySelector(".iw-team-card__portrait");
      const heading = document.querySelector(".iw-team-heading");
      const initiatives = document.querySelector(".iw-team-initiatives");
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        containerMaxWidth: getComputedStyle(container).maxWidth,
        cardsCols: getComputedStyle(cards).gridTemplateColumns,
        cardGap: getComputedStyle(cards).gap,
        cardPadding: getComputedStyle(card).padding,
        portraitSize: `${getComputedStyle(portrait).width} x ${getComputedStyle(portrait).height}`,
        headingMarginBottom: getComputedStyle(heading).marginBottom,
        initiativesTop: initiatives.getBoundingClientRect().top,
      };
    });
    console.log(width, JSON.stringify(metrics, null, 2));

    const clip = await page.evaluate(() => {
      const start = document.querySelector(".iw-team-group").getBoundingClientRect();
      const end = document.querySelector(".iw-team-initiatives").getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, start.top - 12),
        width: innerWidth,
        height: Math.min(innerHeight, Math.ceil(end.top - start.top + 48)),
      };
    });

    await page.screenshot({ path: path.join(OUT, `cards-${width}.png`), clip });
    await page.close();
  });
}

console.log("Saved to", OUT);
