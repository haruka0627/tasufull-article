#!/usr/bin/env node
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788/live/watch-video?id=4d7e3650-b441-4598-9723-475a956cf68a";
const CANDIDATES = [
  "minmax(0, 620px) 600px",
  "minmax(0, 600px) 620px",
  "minmax(0, 640px) 580px",
];

await withPlaywrightSession(
  async ({ browser }) => {
    for (const cols of CANDIDATES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector(".tlv-watch-layout");
      const m = await page.evaluate((gridCols) => {
        const layout = document.querySelector(".tlv-watch-layout");
        layout.style.setProperty("grid-template-columns", gridCols, "important");
        const lr = layout.getBoundingClientRect();
        const player = document.querySelector(".live-watch__player-wrap")?.getBoundingClientRect();
        const sidebar = document.querySelector(".tlv-watch-sidebar")?.getBoundingClientRect();
        const scrollW = document.documentElement.scrollWidth;
        const vw = window.innerWidth;
        return {
          gridCols,
          computed: getComputedStyle(layout).gridTemplateColumns,
          layoutW: Math.round(lr.width),
          playerW: Math.round(player?.width || 0),
          sidebarW: Math.round(sidebar?.width || 0),
          horizontalScroll: scrollW > vw,
          scrollW,
          vw,
        };
      }, cols);
      console.log(JSON.stringify(m));
      await page.close();
    }
  },
  { viewport: { width: 1280, height: 900 } }
);
