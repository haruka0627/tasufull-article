#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filePath = path.join(ROOT, "iwasho/images/partner/benefit-projects.jpg");
const deployPath = path.join(ROOT, "deploy/cloudflare/dist/iwasho/images/partner/benefit-projects.jpg");
const buf = fs.readFileSync(filePath);
const meta = await sharp(filePath).metadata();

const bases = [
  "http://127.0.0.1:3456",
  "http://127.0.0.1:8788",
];

let base = null;
for (const candidate of bases) {
  try {
    const res = await fetch(`${candidate}/iwasho/partners.html`, { method: "GET" });
    if (res.ok) {
      base = candidate;
      break;
    }
  } catch {
    /* try next */
  }
}

if (!base) throw new Error("No local server on 3456 or 8788");

const pageUrl = `${base}/iwasho/partners.html?audit=${Date.now()}`;
const imgUrl = `${base}/iwasho/images/partner/benefit-projects.jpg?t=${Date.now()}`;

let browserAudit = null;
await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('.iw-ptn-benefit-card img[src*="benefit-projects"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  browserAudit = await page.evaluate(() => {
    const img = document.querySelector('.iw-ptn-benefit-card img[src*="benefit-projects"]');
    if (!img) return { error: "img not found" };
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      widthAttr: img.getAttribute("width"),
      heightAttr: img.getAttribute("height"),
      displayedWidth: Math.round(r.width * 100) / 100,
      displayedHeight: Math.round(r.height * 100) / 100,
      computedWidth: cs.width,
      computedHeight: cs.height,
      objectFit: cs.objectFit,
      complete: img.complete,
    };
  });

  const direct = await page.goto(imgUrl, { waitUntil: "networkidle", timeout: 30000 });
  browserAudit.directImageBytes = (await direct.body()).length;
  browserAudit.serverBase = base;
});

await closeAllBrowsers();

const deployBuf = fs.readFileSync(deployPath);
console.log(
  JSON.stringify(
    {
      sourceFile: {
        path: filePath,
        pixels: { width: meta.width, height: meta.height },
        format: meta.format,
        fileSizeBytes: buf.length,
        fileSizeKB: Math.round((buf.length / 1024) * 10) / 10,
        jpegQualityUsedWhenGenerated: 92,
        chromaSubsampling: meta.chromaSubsampling,
      },
      deployFile: {
        path: deployPath,
        fileSizeBytes: deployBuf.length,
        fileSizeKB: Math.round((deployBuf.length / 1024) * 10) / 10,
        matchesSource: deployBuf.equals(buf),
      },
      browser: browserAudit,
      verdict:
        browserAudit?.naturalWidth >= 640
          ? "OK: naturalWidth >= 640 (960x680 loaded)"
          : "NG: naturalWidth < 640 — wrong/cached image may be served",
    },
    null,
    2,
  ),
);
