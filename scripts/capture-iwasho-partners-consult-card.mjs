#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-consult-card");
const sub = process.argv[2] === "after" ? "after" : "before";
const DIR = path.join(OUT, sub);
fs.mkdirSync(DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "iwasho/partners.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.goto(`${base}/iwasho/partners.html`, { waitUntil: "networkidle", timeout: 120000 });

    await page.locator(".iw-ptn-trades__consult").scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const card = document.querySelector(".iw-ptn-trades__consult");
      const main = document.querySelector(".iw-ptn-trades__consult-main");
      const media = document.querySelector(".iw-ptn-trades__consult-media");
      const img = media?.querySelector("img");
      const cardCs = getComputedStyle(card);
      const mainCs = main ? getComputedStyle(main) : null;
      const mediaCs = media ? getComputedStyle(media) : null;
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardH: Math.round(card.getBoundingClientRect().height),
        cardOverflow: cardCs.overflow,
        cardRadius: cardCs.borderRadius,
        cardBorder: `${cardCs.borderTopWidth} ${cardCs.borderTopStyle} ${cardCs.borderTopColor}`,
        cardShadow: cardCs.boxShadow,
        mainPad: mainCs?.padding,
        mediaH: media ? Math.round(media.getBoundingClientRect().height) : null,
        mediaMaxH: mediaCs?.maxHeight,
        imgH: img ? Math.round(img.getBoundingClientRect().height) : null,
      };
    });

    console.log(sub, width, JSON.stringify(metrics));

    await page.locator(".iw-ptn-trades__consult").screenshot({
      path: path.join(DIR, `consult-${width}.png`),
    });

    const clip = await page.evaluate(() => {
      const card = document.querySelector(".iw-ptn-trades__consult");
      const r = card.getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, r.top - 24),
        width: innerWidth,
        height: Math.min(innerHeight, Math.ceil(r.height + 48)),
      };
    });

    await page.screenshot({
      path: path.join(DIR, `context-${width}.png`),
      clip,
    });

    await page.close();
  });
}

