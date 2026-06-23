#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-team-hero");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "iwasho/team.html" });

for (const width of [1280, 390]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/iwasho/team.html`, { waitUntil: "networkidle", timeout: 120000 });

    const metrics = await page.evaluate(() => {
      const hero = document.querySelector(".iw-team-hero");
      const grid = document.querySelector(".iw-team-hero__grid");
      const content = document.querySelector(".iw-team-hero__content");
      const visual = document.querySelector(".iw-team-hero__visual");
      const img = document.querySelector(".iw-team-hero__visual img");
      const group = document.querySelector(".iw-team-group");
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hero: hero ? getComputedStyle(hero).paddingTop : null,
        grid: grid
          ? {
              display: getComputedStyle(grid).display,
              height: getComputedStyle(grid).height,
              maxWidth: getComputedStyle(grid).maxWidth,
              background: getComputedStyle(grid).backgroundImage || getComputedStyle(grid).backgroundColor,
            }
          : null,
        content: content
          ? {
              width: getComputedStyle(content).width,
              paddingLeft: getComputedStyle(content).paddingLeft,
              color: getComputedStyle(document.querySelector(".iw-team-hero__title")).color,
            }
          : null,
        visual: visual
          ? {
              width: getComputedStyle(visual).width,
              height: getComputedStyle(visual).height,
              position: getComputedStyle(visual).position,
            }
          : null,
        img: img
          ? {
              width: getComputedStyle(img).width,
              height: getComputedStyle(img).height,
              objectFit: getComputedStyle(img).objectFit,
              objectPosition: getComputedStyle(img).objectPosition,
              boxShadow: getComputedStyle(img).boxShadow,
              borderRadius: getComputedStyle(img).borderRadius,
            }
          : null,
        nextSectionTop: group ? group.getBoundingClientRect().top : null,
      };
    });
    console.log(width, JSON.stringify(metrics, null, 2));

    const clip = await page.evaluate(() => {
      const header = document.querySelector(".iw-site-header");
      const hero = document.querySelector(".iw-team-hero");
      const group = document.querySelector(".iw-team-group");
      const top = header.getBoundingClientRect().bottom;
      const bottom = group.getBoundingClientRect().top;
      return {
        x: 0,
        y: Math.max(0, top - 8),
        width: innerWidth,
        height: Math.min(innerHeight, Math.ceil(bottom - top + 16)),
      };
    });

    await page.screenshot({ path: path.join(OUT, `hero-${width}.png`), clip });
    await page.close();
  });
}

console.log("Saved to", OUT);
