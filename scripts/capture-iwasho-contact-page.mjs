#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-contact-page");
const widths = [390, 1280];
const base = await findDevServerBaseUrl({ probePath: "iwasho/contact.html" });

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await page.goto(`${base}/iwasho/contact.html`, { waitUntil: "networkidle", timeout: 90000 });
    await page.screenshot({ path: path.join(OUT, `contact-${width}.png`), fullPage: true });
    await page.close();
  }
});

console.log("saved contact screenshots to", OUT);
