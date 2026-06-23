#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-trades-fix");
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
    path: path.join(OUT, "trades-cards-1280.png"),
    clip: await trades.boundingBox(),
  });

  const otherCard = page.locator(".iw-ptn-trades-card").nth(3);
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

  const benefits = page.locator(".iw-ptn-benefits");
  await benefits.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await benefits.screenshot({ path: path.join(OUT, "benefits-1280.png") });

  const audit = await page.evaluate(() => ({
    otherSrc: document.querySelector(".iw-ptn-trades-card:nth-child(4) img")?.getAttribute("src"),
    consultHasMedia: !!document.querySelector(".iw-ptn-trades__consult-media"),
    benefitBgs: [...document.querySelectorAll(".iw-ptn-benefit-card__bg")].map((el) => {
      const cs = getComputedStyle(el);
      return {
        opacity: cs.opacity,
        bgImage: cs.backgroundImage !== "none",
      };
    }),
  }));

  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify({ url, audit }, null, 2));
  console.log(JSON.stringify({ url, audit, out: path.relative(ROOT, OUT) }, null, 2));
  await page.close();
});
