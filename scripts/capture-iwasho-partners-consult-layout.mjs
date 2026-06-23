#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-consult-layout");
const sub = process.argv[2] === "after" ? "after" : "before";
const DIR = path.join(OUT, sub);
fs.mkdirSync(DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "iwasho/partners.html" });

const REVERT_CSS = [
  "@media (max-width: 768px) {",
  "  .iwasho-partners-page .iw-ptn-trades__panel { display: block !important; }",
  "  .iwasho-partners-page .iw-ptn-trades__header { margin-bottom: 44px !important; }",
  "  .iwasho-partners-page .iw-ptn-trades__grid { margin-bottom: 32px !important; }",
  "  .iwasho-partners-page .iw-ptn-trades__consult { grid-template-columns: 1fr !important; max-height: none !important; }",
  "  .iwasho-partners-page .iw-ptn-trades__consult-main { align-items: flex-start !important; }",
  "  .iwasho-partners-page .iw-ptn-trades__consult-media { max-height: 140px !important; min-height: 120px !important; }",
  "}",
].join("\n");

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.goto(`${base}/iwasho/partners.html`, { waitUntil: "networkidle", timeout: 120000 });
    if (sub === "before") await page.addStyleTag({ content: REVERT_CSS });

    await page.locator(".iw-ptn-trades__panel").scrollIntoViewIfNeeded();

    const m = await page.evaluate(() => {
      const panel = document.querySelector(".iw-ptn-trades__panel");
      const grid = document.querySelector(".iw-ptn-trades__grid");
      const consult = document.querySelector(".iw-ptn-trades__consult");
      const consultCs = getComputedStyle(consult);
      const panelCs = getComputedStyle(panel);
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelDisplay: panelCs.display,
        panelCols: panelCs.gridTemplateColumns,
        panelGap: panelCs.gap,
        gridCols: getComputedStyle(grid).gridTemplateColumns,
        consultCols: consultCs.gridTemplateColumns,
        consultH: Math.round(consult.getBoundingClientRect().height),
        consultRadius: consultCs.borderRadius,
      };
    });

    console.log(sub, width, JSON.stringify(m));

    await page.locator(".iw-ptn-trades__panel").screenshot({
      path: path.join(DIR, `panel-${width}.png`),
    });

    await page.locator(".iw-ptn-trades__consult").screenshot({
      path: path.join(DIR, `consult-${width}.png`),
    });

    await page.close();
  });
}

