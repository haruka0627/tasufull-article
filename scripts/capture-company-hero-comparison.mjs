#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/company-hero-ref");
const REF = path.join(
  ROOT,
  "..",
  ".cursor",
  "projects",
  "c-Users-rubih-tasufull-article",
  "assets",
  "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_ChatGPT_Image_2026_6_21__02_20_43-bc8280cd-586b-4395-be82-c847d9c10587.png"
);
const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/company/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".tasful-hero", { timeout: 15000 });

const heroPath = path.join(OUT, "company-hero-1280.png");
await page.locator(".tasful-hero").screenshot({ path: heroPath });

const metrics = await page.evaluate(() => {
  const hero = document.querySelector(".tasful-hero");
  const heroRect = hero.getBoundingClientRect();
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top - heroRect.top), bottom: Math.round(r.bottom - heroRect.top), h: Math.round(r.height), w: Math.round(r.width) };
  };
  return { sub: pick(".hero-container"), btn: pick(".neon-btn"), card: pick(".hero-card--construction .neon-card") };
});
console.log("metrics:", JSON.stringify(metrics));

await browser.close();

if (fs.existsSync(REF)) {
  const refBuf = await sharp(REF).resize(1280, 900, { fit: "cover", position: "top" }).png().toBuffer();
  const implBuf = await sharp(heroPath).resize(1280, 900).png().toBuffer();
  const gap = 8;
  const labelH = 36;
  const totalW = 1280 * 2 + gap;
  const totalH = 900 + labelH;

  const left = await sharp(refBuf).extend({ top: labelH, background: { r: 15, g: 23, b: 42 } }).toBuffer();
  const right = await sharp(implBuf).extend({ top: labelH, background: { r: 15, g: 23, b: 42 } }).toBuffer();

  await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 15, g: 23, b: 42 } },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 1280 + gap, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT, "company-hero-comparison-1280.png"));

  console.log("comparison:", path.join(OUT, "company-hero-comparison-1280.png"));
} else {
  console.warn("reference image not found:", REF);
}

console.log("hero:", heroPath);
