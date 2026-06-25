#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { w: 1280, tag: "1280", page: "studio-subtitles.html" },
  { w: 390, tag: "390", page: "studio-subtitles.html" },
];

await withPlaywrightSession(async ({ browser }) => {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.w, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[${c.w}] ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:8788/live/${c.page}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({
      isSubtitles: !!document.querySelector('[data-tlv-studio-placeholder-page="subtitles"]'),
      workflowItems: document.querySelectorAll(".tlv-studio-subtitles__workflow-item").length,
      overviewStats: document.querySelectorAll(".tlv-studio-subtitles__overview-stat").length,
      queueItems: document.querySelectorAll(".tlv-studio-subtitles__queue-item").length,
      langChips: document.querySelectorAll(".tlv-studio-subtitles__lang-chip").length,
      communityElems: document.querySelectorAll("[class*='tlv-studio-community']").length,
      analyticsChart: !!document.querySelector("[data-tlv-analytics-trend-chart]"),
      layoutCols: document.querySelector(".tlv-studio-subtitles__layout")
        ? getComputedStyle(document.querySelector(".tlv-studio-subtitles__layout")).gridTemplateColumns
        : null,
      actionBtns: document.querySelectorAll(".tlv-studio-subtitles__action-btn").length,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const shot = path.join(OUT, `studio-subtitles-actions-${c.tag}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    console.log(JSON.stringify({ viewport: c.w, page: c.page, ...m, screenshot: shot }, null, 2));
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
