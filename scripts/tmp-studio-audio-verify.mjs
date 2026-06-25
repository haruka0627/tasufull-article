#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { w: 1280, tag: "1280", page: "studio-audio-library.html" },
  { w: 390, tag: "390", page: "studio-audio-library.html" },
  { w: 1280, tag: "1280-customization", page: "studio-customization.html" },
];

await withPlaywrightSession(async ({ browser }) => {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.w, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[${c.w}/${c.page}] ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:8788/live/${c.page}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);

    if (c.page === "studio-audio-library.html") {
      await page.evaluate(() => {
        document.querySelector("[data-tlv-audio-action='play']")?.click();
        document.querySelector("[data-tlv-audio-action='favorite']")?.click();
        document.querySelector("[data-tlv-audio-action='use']")?.click();
      });
    }

    const m = await page.evaluate(() => ({
      isAudio: !!document.querySelector('[data-tlv-studio-placeholder-page="audio"]'),
      kpiCards: document.querySelectorAll(".tlv-studio-audio__kpis .tlv-studio-placeholder__stat").length,
      filterSelects: document.querySelectorAll("[data-tlv-audio-filter]").length,
      trackRows: document.querySelectorAll(".tlv-studio-audio__track-row").length,
      trackBadges: document.querySelectorAll(".tlv-studio-audio__track-badge").length,
      actionBtns: document.querySelectorAll(".tlv-studio-audio__action-btn").length,
      sideLists: document.querySelectorAll(".tlv-studio-audio__side-item").length,
      playlistItems: document.querySelectorAll(".tlv-studio-audio__playlist-item").length,
      audioElems: document.querySelectorAll("[class*='tlv-studio-audio']").length,
      customizationElems: document.querySelectorAll("[class*='tlv-studio-customization']").length,
      layoutCols: document.querySelector(".tlv-studio-audio__layout")
        ? getComputedStyle(document.querySelector(".tlv-studio-audio__layout")).gridTemplateColumns
        : null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    const shot =
      c.page === "studio-audio-library.html"
        ? path.join(OUT, `studio-audio-actions-${c.tag}.png`)
        : null;
    if (shot) await page.screenshot({ path: shot, fullPage: false });

    console.log(JSON.stringify({ viewport: c.w, page: c.page, ...m, screenshot: shot }, null, 2));
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
