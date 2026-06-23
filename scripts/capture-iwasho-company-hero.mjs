#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-company-hero");
const base = await findDevServerBaseUrl({ probePath: "iwasho/company.html" });

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/iwasho/company.html`, { waitUntil: "networkidle", timeout: 90000 });
  const hero = page.locator(".iwasho-about");
  await hero.screenshot({ path: path.join(OUT, "hero-1280.png") });
  await page.screenshot({ path: path.join(OUT, "page-1280.png"), fullPage: true });
  await page.close();
});

console.log("saved hero and page screenshots to", OUT);
