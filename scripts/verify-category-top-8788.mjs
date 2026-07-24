#!/usr/bin/env node
/**
 * Category TOP pages verify — http://127.0.0.1:8788
 *   npm run dev
 *   node scripts/verify-category-top-8788.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "category-top-verify");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");

const PAGES = [
  { key: "skill", path: "/skill", html: "skill.html" },
  { key: "product", path: "/product", html: "product.html" },
  { key: "worker", path: "/worker", html: "worker.html" },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];

  for (const p of PAGES) {
    const res = await fetch(`${BASE}${p.path}`);
    report.push({ key: p.key, httpPrecheck: res.status });
  }

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => consoleErrors.push(String(e)));

      for (const p of PAGES) {
        const url = `${BASE}${p.path}`;
        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        await page.waitForTimeout(800);

        const status = response?.status() ?? 0;
        const title = await page.title();
        const countText = (
          (await page.locator("[data-category-count]").textContent()) || ""
        ).trim();
        const emptyVisible = await page
          .locator("[data-category-empty]")
          .isVisible()
          .catch(() => false);
        const listCards = await page
          .locator("[data-category-list] > li")
          .count();
        const rankChips = await page
          .locator(".seller-rank-chip:not([hidden])")
          .count();
        const rankImgs = await page
          .locator('img[src*="/images/rank/"]')
          .count();
        const headerOk = await page.locator(".home-header").isVisible();
        const categoryPage = await page
          .locator("body")
          .getAttribute("data-category-page");

        const shot = path.join(OUT_DIR, `${p.key}-${vp.name}.png`);
        await page.screenshot({ path: shot, fullPage: true });

        if (vp.name === "1280") {
          const entry = report.find((r) => r.key === p.key) || { key: p.key };
          Object.assign(entry, {
            url,
            html: p.html,
            status,
            title,
            dataCategoryPage: categoryPage,
            countText,
            emptyVisible,
            listCards,
            rankChipsVisible: rankChips,
            rankImageCount: rankImgs,
            headerOk,
            consoleErrorCount: consoleErrors.length,
            screenshot: shot.replace(/\\/g, "/"),
          });
          if (!report.includes(entry)) report.push(entry);
        }
      }

      await context.close();
    }
  });

  const outPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
