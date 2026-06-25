#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { w: 1280, tag: "1280", page: "studio-customization.html" },
  { w: 390, tag: "390", page: "studio-customization.html" },
  { w: 1280, tag: "1280-monetization", page: "studio-monetization.html" },
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

    if (c.page === "studio-customization.html") {
      await page.evaluate(() => {
        document.querySelector("[data-tlv-customization-action='save']")?.click();
        document.querySelector("[data-tlv-customization-toggle]")?.click();
      });
    }

    const m = await page.evaluate(() => ({
      isCustomization: !!document.querySelector('[data-tlv-studio-placeholder-page="customization"]'),
      kpiStats: document.querySelectorAll(".tlv-studio-placeholder__stats .tlv-studio-placeholder__stat").length,
      toolbarBtns: document.querySelectorAll(".tlv-studio-customization__toolbar-btn").length,
      brandBlocks: document.querySelectorAll(".tlv-studio-customization__brand-block").length,
      formFields: document.querySelectorAll(".tlv-studio-customization__input, .tlv-studio-customization__textarea").length,
      linkCards: document.querySelectorAll(".tlv-studio-customization__link-card").length,
      layoutToggles: document.querySelectorAll("[data-tlv-customization-toggle]").length,
      previewCard: !!document.querySelector(".tlv-studio-customization__preview-card"),
      visibilityItems: document.querySelectorAll(".tlv-studio-customization__visibility-item").length,
      customizationElems: document.querySelectorAll("[class*='tlv-studio-customization']").length,
      monetizationElems: document.querySelectorAll("[class*='tlv-studio-monetization']").length,
      layoutCols: document.querySelector(".tlv-studio-customization__layout")
        ? getComputedStyle(document.querySelector(".tlv-studio-customization__layout")).gridTemplateColumns
        : null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    const shot =
      c.page === "studio-customization.html"
        ? path.join(OUT, `studio-customization-visibility-${c.tag}.png`)
        : null;
    if (shot) await page.screenshot({ path: shot, fullPage: false });

    console.log(JSON.stringify({ viewport: c.w, page: c.page, ...m, screenshot: shot }, null, 2));
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
