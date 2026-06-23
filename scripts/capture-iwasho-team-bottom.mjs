#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-team-bottom");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "iwasho/team.html" });

for (const width of [1280, 390]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1600 } });
    await page.goto(`${base}/iwasho/team.html`, { waitUntil: "networkidle", timeout: 120000 });

    await page.locator(".iw-team-bottom").scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const inner = document.querySelector(".iw-team-bottom__inner");
      const panel = document.querySelector(".iw-team-initiatives__panel");
      const initiative = document.querySelector(".iw-team-initiative");
      const ctaMain = document.querySelector(".iw-team-cta__main");
      const ctaBar = document.querySelector(".iw-team-cta__bar");
      const img = document.querySelector(".iw-team-cta__visual img");
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        innerWidth: inner.getBoundingClientRect().width,
        innerMaxWidth: getComputedStyle(inner).maxWidth,
        panelDisplay: getComputedStyle(panel).display,
        panelFlexDirection: getComputedStyle(panel).flexDirection,
        initiativeFlexDirection: getComputedStyle(initiative).flexDirection,
        initiativeBorderLeft: getComputedStyle(document.querySelector(".iw-team-initiative + .iw-team-initiative")).borderLeftWidth,
        ctaMainWidth: ctaMain.getBoundingClientRect().width,
        ctaBarWidth: ctaBar.getBoundingClientRect().width,
        ctaBarRadius: getComputedStyle(ctaBar).borderRadius,
        imgSrc: img.getAttribute("src"),
        imgObjectFit: getComputedStyle(img).objectFit,
      };
    });
    console.log(width, JSON.stringify(metrics, null, 2));

    const clip = await page.evaluate(() => {
      const start = document.querySelector(".iw-team-bottom").getBoundingClientRect();
      const footer = document.querySelector(".footer-wrapper").getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, start.top - 12),
        width: innerWidth,
        height: Math.min(innerHeight, Math.ceil(footer.top - start.top + 8)),
      };
    });

    await page.screenshot({ path: path.join(OUT, `bottom-${width}.png`), clip });
    await page.close();
  });
}

console.log("Saved to", OUT);
