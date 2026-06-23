/**
 * 建設ツール一覧・人工計算 — UI整理レビュー用スクショ（HTTP）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "reports", "screenshots", "builder-ct-review");
const BASE = "http://127.0.0.1:8788/builder";

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
];

const PAGES = [
  {
    slug: "construction-tools",
    url: `${BASE}/construction-tools`,
    wait: ".builder-ct-groups",
    label: "construction-tools",
  },
  {
    slug: "tool-manpower-calculator",
    url: `${BASE}/tool-manpower-calculator`,
    wait: "[data-breadcrumb]",
    label: "manpower-calculator",
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  for (const pageDef of PAGES) {
    for (const vp of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));

      await page.goto(pageDef.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector(pageDef.wait, { timeout: 10000 });
      await page.waitForSelector("[data-breadcrumb] .tasu-common-breadcrumb__current", { timeout: 10000 });
      await page.waitForTimeout(400);

      const tag = `${pageDef.label}-${vp.width}`;
      const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const breadcrumbText = await page.locator("[data-breadcrumb]").innerText();

      await page.screenshot({
        path: path.join(OUT_DIR, `${tag}.png`),
        fullPage: true,
      });

      console.log(`Saved: ${tag}.png`);
      console.log(`  breadcrumb: ${breadcrumbText.replace(/\s+/g, " ").trim()}`);
      console.log(`  horizontal scroll: ${hasHScroll ? "YES" : "no"}`);
      if (errors.length) console.log(`  console errors: ${errors.join(" | ")}`);

      await page.close();
    }
  }
});

await closeAllBrowsers();
console.log(`Done. Output: ${OUT_DIR}`);
