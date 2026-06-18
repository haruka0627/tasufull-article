#!/usr/bin/env node
/**
 * shop-products.html 横スクロール検証（1280 / 1440 / 390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { finalizeVerification } from "./lib/finalize-verification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-products-hscroll-fix");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-products.html" });
const URL = `shop-products.html?id=demo-shop-haru-cafe`;

const report = {
  generatedAt: new Date().toISOString(),
  base,
  url: URL,
  overall: "PASS",
  cases: [],
};

const browser = await chromium.launch({ headless: true });

for (const vp of [
  { label: "1280", width: 1280, height: 900 },
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(buildLocalPageUrl(base, URL), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const grid = document.querySelector("[data-shop-products-grid]");
    const gridCs = grid ? getComputedStyle(grid) : null;
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      gridScrollWidth: grid?.scrollWidth || 0,
      gridClientWidth: grid?.clientWidth || 0,
      gridTemplateColumns: gridCs?.gridTemplateColumns || "",
    };
  });

  const pass =
    metrics.docScrollWidth === metrics.innerWidth &&
    metrics.bodyScrollWidth <= metrics.innerWidth &&
    metrics.gridScrollWidth <= metrics.gridClientWidth + 1;

  const row = { viewport: vp.label, pass: pass ? "PASS" : "FAIL", ...metrics };
  report.cases.push(row);
  if (!pass) report.overall = "FAIL";

  await page.screenshot({ path: path.join(OUT, `shop-products-${vp.label}-full.png`), fullPage: true });
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ overall: report.overall, cases: report.cases }, null, 2));
await finalizeVerification(path.join(__dirname, ".."), { primaryFolder: "shop-products-hscroll-fix" });
