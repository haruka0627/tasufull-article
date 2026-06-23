#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-company-page-density");
const base = await findDevServerBaseUrl({ probePath: "iwasho/company.html" });

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/iwasho/company.html`, { waitUntil: "networkidle", timeout: 90000 });
  await page.screenshot({ path: path.join(OUT, "company-1280-after.png"), fullPage: true });
  await page.close();
});

console.log("saved", path.join(OUT, "company-1280-after.png"));
