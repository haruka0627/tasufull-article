#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { w: 1280, tag: "1280", page: "studio-copyright.html" },
  { w: 390, tag: "390", page: "studio-copyright.html" },
  { w: 1280, tag: "1280-subtitles", page: "studio-subtitles.html" },
  { w: 1280, tag: "1280-community", page: "studio-community.html" },
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

    if (c.page === "studio-copyright.html") {
      await page.evaluate(() => {
        const btn = document.querySelector(
          ".tlv-studio-copyright__action-btn[data-tlv-copyright-action]",
        );
        btn?.click();
      });
    }

    const m = await page.evaluate(() => ({
      isCopyright: !!document.querySelector('[data-tlv-studio-placeholder-page="content-id"]'),
      kpiCards: document.querySelectorAll(".tlv-studio-copyright__kpi").length,
      weekStats: document.querySelectorAll(".tlv-studio-copyright__week-stat").length,
      matchItems: document.querySelectorAll(".tlv-studio-copyright__match-item").length,
      policyRows: document.querySelectorAll(".tlv-studio-copyright__policy-row").length,
      queueItems: document.querySelectorAll(".tlv-studio-copyright__queue-item").length,
      ruleItems: document.querySelectorAll(".tlv-studio-copyright__rule-item").length,
      actionBtns: document.querySelectorAll(".tlv-studio-copyright__action-btn").length,
      copyrightElems: document.querySelectorAll("[class*='tlv-studio-copyright']").length,
      subtitlesElems: document.querySelectorAll("[class*='tlv-studio-subtitles']").length,
      communityElems: document.querySelectorAll("[class*='tlv-studio-community']").length,
      layoutCols: document.querySelector(".tlv-studio-copyright__layout")
        ? getComputedStyle(document.querySelector(".tlv-studio-copyright__layout")).gridTemplateColumns
        : null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    const shot =
      c.page === "studio-copyright.html"
        ? path.join(OUT, `studio-copyright-rules-${c.tag}.png`)
        : null;
    if (shot) await page.screenshot({ path: shot, fullPage: false });

    console.log(
      JSON.stringify({ viewport: c.w, page: c.page, ...m, screenshot: shot }, null, 2),
    );
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
