#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-trades-other-consult");
const base = await findDevServerBaseUrl({ probePath: "iwasho/partners.html" });
const url = `${base}/iwasho/partners.html`;

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

  const trades = page.locator(".iw-ptn-trades");
  await trades.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  await page.screenshot({
    path: path.join(OUT, "trades-section-1280.png"),
    fullPage: false,
    clip: await trades.boundingBox(),
  });

  const otherCard = page.locator(".iw-ptn-trades-card").nth(3);
  await otherCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const otherBox = await otherCard.boundingBox();
  if (otherBox) {
    await page.screenshot({
      path: path.join(OUT, "other-card-zoom-1280.png"),
      clip: {
        x: Math.max(0, otherBox.x - 24),
        y: Math.max(0, otherBox.y - 24),
        width: Math.min(1280, otherBox.width + 48),
        height: otherBox.height + 48,
      },
    });
  }

  const consult = page.locator(".iw-ptn-trades__consult");
  await consult.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const consultBox = await consult.boundingBox();
  if (consultBox) {
    await page.screenshot({
      path: path.join(OUT, "consult-box-zoom-1280.png"),
      clip: {
        x: Math.max(0, consultBox.x - 32),
        y: Math.max(0, consultBox.y - 24),
        width: Math.min(1280, consultBox.width + 64),
        height: consultBox.height + 48,
      },
    });
  }

  const audit = await page.evaluate(() => {
    const otherImg = document.querySelector(".iw-ptn-trades-card:nth-child(4) img");
    const consultMedia = document.querySelector(".iw-ptn-trades__consult-media");
    const consultMain = document.querySelector(".iw-ptn-trades__consult-main");
    const grid = document.querySelector(".iw-ptn-trades__grid");
    return {
      otherSrc: otherImg?.getAttribute("src"),
      otherAlt: otherImg?.getAttribute("alt"),
      consultHasMedia: !!consultMedia,
      consultPadding: consultMain ? getComputedStyle(consultMain).padding : null,
      gridMarginBottom: grid ? getComputedStyle(grid).marginBottom : null,
    };
  });

  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify({ url, audit }, null, 2));
  console.log(JSON.stringify({ url, audit, out: path.relative(ROOT, OUT) }, null, 2));
  await page.close();
});
