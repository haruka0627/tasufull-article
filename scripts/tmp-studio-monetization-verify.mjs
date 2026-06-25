#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { w: 1280, tag: "1280", page: "studio-monetization.html" },
  { w: 390, tag: "390", page: "studio-monetization.html" },
  { w: 1280, tag: "1280-copyright", page: "studio-copyright.html" },
  { w: 1280, tag: "1280-subtitles", page: "studio-subtitles.html" },
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

    const m = await page.evaluate(() => ({
      isMonetization: !!document.querySelector('[data-tlv-studio-placeholder-page="monetization"]'),
      kpiCards: document.querySelectorAll(".tlv-studio-monetization__kpi").length,
      summaryStats: document.querySelectorAll(".tlv-studio-monetization__summary-stat").length,
      breakdownRows: document.querySelectorAll(".tlv-studio-monetization__breakdown-row").length,
      breakdownBars: document.querySelectorAll(".tlv-studio-monetization__breakdown-fill").length,
      paymentRows: document.querySelectorAll(".tlv-studio-monetization__payment .tlv-studio-monetization__info-row").length,
      statusRows: document.querySelectorAll(".tlv-studio-monetization__status .tlv-studio-monetization__info-row").length,
      noticeItems: document.querySelectorAll(".tlv-studio-monetization__notice-item").length,
      eventItems: document.querySelectorAll(".tlv-studio-monetization__event-item").length,
      monetizationElems: document.querySelectorAll("[class*='tlv-studio-monetization']").length,
      copyrightElems: document.querySelectorAll("[class*='tlv-studio-copyright']").length,
      subtitlesElems: document.querySelectorAll("[class*='tlv-studio-subtitles']").length,
      layoutCols: document.querySelector(".tlv-studio-monetization__layout")
        ? getComputedStyle(document.querySelector(".tlv-studio-monetization__layout")).gridTemplateColumns
        : null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    const shot =
      c.page === "studio-monetization.html"
        ? path.join(OUT, `studio-monetization-${c.tag}.png`)
        : null;
    if (shot) await page.screenshot({ path: shot, fullPage: false });

    console.log(JSON.stringify({ viewport: c.w, page: c.page, ...m, screenshot: shot }, null, 2));
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
