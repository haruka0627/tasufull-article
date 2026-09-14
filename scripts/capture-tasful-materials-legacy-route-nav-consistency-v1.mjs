#!/usr/bin/env node
/**
 * Full-page screenshots for Legacy Route Navigation Consistency V1 gate.
 * Requires: http://127.0.0.1:8788 (npm run dev)
 *
 *   node scripts/capture-tasful-materials-legacy-route-nav-consistency-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "reports", "tasful-materials-legacy-route-nav-consistency-v1", "screenshots");
const base = (process.env.PAGES_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

const ROUTES = [
  { name: "list-all", path: "/materials/list.html" },
  { name: "list-image", path: "/materials/list.html?category=image" },
  { name: "list-sfx", path: "/materials/list.html?category=sfx" },
  { name: "list-presentation", path: "/materials/list.html?category=presentation" },
  { name: "list-overlay", path: "/materials/list.html?category=overlay" },
  { name: "list-transition", path: "/materials/list.html?category=transition" },
  { name: "list-presentation-clean-url", path: "/materials/list?category=presentation" },
];

const VIEWPORTS = [
  { tag: "desktop-1440", width: 1440, height: 900 },
  { tag: "mobile-390", width: 390, height: 844 },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || "/usr/local/bin/google-chrome",
  });
  const errors = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (err) => errors.push(`${vp.tag}: ${err.message}`));

    for (const route of ROUTES) {
      const url = `${base}${route.path}`;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const status = res?.status() ?? 0;
      if (status >= 400) {
        errors.push(`${vp.tag} ${route.name} HTTP ${status}`);
      }
      await page.waitForTimeout(800);
      const file = path.join(outDir, `${route.name}--${vp.tag}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${path.relative(root, file)} (${status})`);
    }
    await context.close();
  }

  await browser.close();

  if (errors.length) {
    console.error("Capture errors:", errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
