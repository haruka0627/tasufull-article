#!/usr/bin/env node
/**
 * ヒーロー3カラム復元確認用スクショ
 *   BASE_URL=http://127.0.0.1:5174 node scripts/capture-detail-shop-hero-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "detail-shop-hero-restore");

const TARGETS = [
  { id: "demo-shop-lumiere", label: "lumiere" },
  { id: "demo-shop-haru-cafe", label: "haru-cafe" },
  { id: "demo-shop-reworks", label: "reworks" },
  { id: "demo-shop-marche-vert", label: "marche-vert" },
];

async function waitLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 20000 }
  );
}

async function measureHero(page) {
  return page.evaluate(() => {
    const hero = document.querySelector(".biz-detail-fv");
    const media = document.querySelector(".biz-detail-fv__media");
    const main = document.querySelector(".biz-detail-fv__main, .shop-detail-main-info");
    const points = document.querySelector(
      ".shop-hero-right [data-shop-restaurant-points]:not([hidden]) .retail-points, .shop-hero-right .shop-restaurant-points:not([hidden]), .shop-hero-right .retail-points"
    );
    if (!hero) return { error: "no hero" };
    const h = hero.getBoundingClientRect();
    const m = media?.getBoundingClientRect();
    const i = main?.getBoundingClientRect();
    const p = points && !points.hidden ? points.getBoundingClientRect() : null;
    const cols = getComputedStyle(hero).gridTemplateColumns;
    return {
      gridTemplateColumns: cols,
      pointsMarginTop: points ? getComputedStyle(points).marginTop : null,
      heroWidth: Math.round(h.width),
      mediaRight: m ? Math.round(m.right) : null,
      mainLeft: i ? Math.round(i.left) : null,
      mainRight: i ? Math.round(i.right) : null,
      pointsLeft: p ? Math.round(p.left) : null,
      pointsTop: p ? Math.round(p.top) : null,
      pointsRight: p ? Math.round(p.right) : null,
      heroRight: Math.round(h.right),
      overflowPx: p ? Math.max(Math.round(p.right - h.right), 0) : null,
      threeColumn:
        m && i && p
          ? m.right <= i.left + 2 && i.right <= p.left + 2 && Math.abs(p.top - m.top) < 100
          : null,
    };
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log(`\nHero layout capture — ${BASE}\nOutput: ${OUT}\n`);

  for (const { id, label } of TARGETS) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/detail-shop.html?id=${id}`, { waitUntil: "domcontentloaded" });
    await waitLoaded(page);
    await page.waitForTimeout(500);
    const m = await measureHero(page);
    console.log(`${label} (PC 1280):`, JSON.stringify(m, null, 2));
    await page.screenshot({
      path: path.join(OUT, `${label}-pc1280.png`),
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT, `${label}-sp390.png`),
      clip: { x: 0, y: 0, width: 390, height: 700 },
    });
  }

  await browser.close();
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
