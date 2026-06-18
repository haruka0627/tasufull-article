/**
 * TASFUL市場 — 出品商品管理 390px スクリーンショット
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-seller-products-390");
const VIEWPORT = { width: 390, height: 844 };

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-market-seller-products.html", ports: [5500, 5173, 5174] });
const pageUrl = buildLocalPageUrl(base, "shop-market-seller-products.html");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });
const consoleErrors = [];
const failedRequests = [];

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("requestfailed", (req) => {
  failedRequests.push(`${req.failure()?.errorText || "failed"} ${req.url()}`);
});
page.on("response", (res) => {
  if (res.status() === 404) failedRequests.push(`404 ${res.url()}`);
});

await page.addInitScript(() => {
  try {
    localStorage.removeItem("tasu_market_seller_products");
  } catch {
    /* ignore */
  }
});

await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-seller-products-empty]", { state: "visible", timeout: 15000 });

const checks = await page.evaluate(() => ({
  okHeader: Boolean(document.querySelector("[data-tasful-market-header]")),
  okTitle: (document.querySelector(".tasful-market-seller-products-main__title")?.textContent || "").includes("出品商品管理"),
  okEmpty: Boolean(document.querySelector("[data-tasful-seller-products-empty]") && !document.querySelector("[data-tasful-seller-products-empty]")?.hidden),
  okCta: Boolean(document.querySelector("[data-tasful-seller-products-empty-cta]")),
  scrollWidth: document.documentElement.scrollWidth,
}));

await page.screenshot({ path: path.join(OUT_DIR, "seller-products-empty-390.png"), fullPage: false });

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  pageUrl,
  viewport: VIEWPORT,
  screenshot: "screenshots/market-seller-products-390/seller-products-empty-390.png",
  checks,
  consoleErrors,
  failedRequests: [...new Set(failedRequests)],
  pass:
    checks.okHeader &&
    checks.okTitle &&
    checks.okEmpty &&
    checks.okCta &&
    checks.scrollWidth <= 391 &&
    consoleErrors.length === 0 &&
    failedRequests.filter((u) => !u.includes("favicon")).length === 0,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
