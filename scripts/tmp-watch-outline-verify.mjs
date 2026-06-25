#!/usr/bin/env node
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";
import fs from "node:fs";

const URL =
  "http://127.0.0.1:8788/live/watch-video.html?id=4d7e3650-b441-4598-9723-475a956cf68a";

await withPlaywrightSession(
  async ({ page }) => {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(4000);
    const data = await page.evaluate(() => {
      const wrap = document.querySelector(".live-watch__player-wrap");
      const cs = wrap ? getComputedStyle(wrap) : {};
      return {
        cssHref: [...document.querySelectorAll('link[rel="stylesheet"]')]
          .map((l) => l.href)
          .filter((h) => h.includes("live.css")),
        outline: cs.outline,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        backgroundColor: cs.backgroundColor,
        width: cs.width,
      };
    });
    const shot = "scripts/tmp-watch-outline-test.png";
    await page.screenshot({ path: shot, fullPage: false });
    console.log(JSON.stringify({ ...data, screenshot: shot, exists: fs.existsSync(shot) }, null, 2));
  },
  { viewport: { width: 1280, height: 900 } }
);
