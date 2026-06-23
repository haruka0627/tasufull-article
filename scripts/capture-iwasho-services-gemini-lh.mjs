#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-gemini-lh");
const sub = process.argv[2] === "after" ? "after" : "before";
const DIR = path.join(OUT, sub);
fs.mkdirSync(DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1600 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });

    const metrics = await page.evaluate(() => {
      const desc = document.querySelector(".iw-svc-flow__desc");
      const note = document.querySelector(".iw-svc-section-note");
      const descCs = desc ? getComputedStyle(desc) : null;
      const noteCs = note ? getComputedStyle(note) : null;
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        descLh: descCs?.lineHeight,
        descFont: descCs?.fontSize,
        noteLh: noteCs?.lineHeight,
        noteFont: noteCs?.fontSize,
      };
    });
    console.log(sub, width, JSON.stringify(metrics));

    await page.locator(".iw-svc-flow").scrollIntoViewIfNeeded();
    await page.locator(".iw-svc-flow").screenshot({ path: path.join(DIR, `flow-${width}.png`) });

    await page.locator(".iw-svc-topics").scrollIntoViewIfNeeded();
    await page.locator(".iw-svc-section-note").screenshot({ path: path.join(DIR, `topics-note-${width}.png`) });

    await page.close();
  });
}
