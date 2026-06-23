#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "trades-construction.jpg",
  "trades-equipment.jpg",
  "trades-cleaning.jpg",
  "trades-other.jpg",
];

const bases = ["http://127.0.0.1:3456", "http://127.0.0.1:8788"];
let base = null;
for (const candidate of bases) {
  try {
    const res = await fetch(`${candidate}/iwasho/partners.html`, { method: "GET" });
    if (res.ok) {
      base = candidate;
      break;
    }
  } catch {
    /* next */
  }
}
if (!base) throw new Error("No local server on 3456 or 8788");

const fileAudit = [];
for (const name of FILES) {
  const filePath = path.join(ROOT, "iwasho/images/partner", name);
  const meta = await sharp(filePath).metadata();
  const stat = fs.statSync(filePath);
  fileAudit.push({
    file: name,
    pixels: { width: meta.width, height: meta.height },
    fileSizeKB: Math.round((stat.size / 1024) * 10) / 10,
    chromaSubsampling: meta.chromaSubsampling,
  });
}

let browserRows = [];
await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/iwasho/partners.html?audit=${Date.now()}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.locator(".iw-ptn-trades-card__media img").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  browserRows = await page.evaluate(() =>
    [...document.querySelectorAll(".iw-ptn-trades-card__media img")].slice(0, 4).map((img) => {
      const card = img.closest(".iw-ptn-trades-card");
      const r = img.getBoundingClientRect();
      return {
        title: card?.querySelector(".iw-ptn-trades-card__title")?.textContent?.trim(),
        src: (img.currentSrc || img.src).split("/").pop(),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayedWidth: Math.round(r.width * 10) / 10,
        displayedHeight: Math.round(r.height * 10) / 10,
      };
    }),
  );
});

await closeAllBrowsers();

console.log(
  JSON.stringify(
    {
      server: base,
      files: fileAudit,
      browser: browserRows,
    },
    null,
    2,
  ),
);
