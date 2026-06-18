/**
 * 商品詳細PC — DOM実測（shell / main / hero / buybox）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-product-detail-pc-diagnose");
const VIEWPORTS = [1280, 1440];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const detailPath = "detail-shop-product.html?shopId=demo-shop-tasful-bakery&productId=p-0";

const reports = [];

for (const vw of VIEWPORTS) {
  await page.setViewportSize({ width: vw, height: 900 });
  await page.goto(buildLocalPageUrl(base, detailPath), { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(400);

  const measure = await page.evaluate((viewportWidth) => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        left: Math.round(r.left),
        right: Math.round(r.right),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        computedWidth: s.width,
        maxWidth: s.maxWidth,
        paddingLeft: s.paddingLeft,
        paddingRight: s.paddingRight,
        overflow: s.overflow,
        overflowX: s.overflowX,
        display: s.display,
        gridTemplateColumns: s.gridTemplateColumns || null,
        gap: s.gap || null,
        boxSizing: s.boxSizing,
      };
    };

    const buybox = document.querySelector("[data-tasful-product-buybox]");
    const buyboxRect = buybox?.getBoundingClientRect();
    const layout = document.querySelector(".tasful-market-product-hero__layout");
    const main = document.querySelector("[data-tasful-product-main]");

    return {
      viewportWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      shell: pick(".tasful-market-product-shell"),
      main: pick("[data-tasful-product-main]"),
      hero: pick(".tasful-market-product-hero"),
      layout: pick(".tasful-market-product-hero__layout"),
      buybox: pick("[data-tasful-product-buybox]"),
      buyboxInViewport: buyboxRect ? buyboxRect.right <= viewportWidth + 1 : false,
      buyboxClippedByMain:
        Boolean(main && buyboxRect) &&
        buyboxRect.right > main.getBoundingClientRect().right + 1,
      layoutOverflowsMain:
        Boolean(layout && main) && layout.scrollWidth > main.clientWidth + 1,
      gridSumEstimate: (() => {
        const cols = getComputedStyle(layout || document.body).gridTemplateColumns;
        if (!cols || cols === "none") return null;
        return cols;
      })(),
    };
  }, vw);

  await page.screenshot({
    path: path.join(OUT_DIR, `diagnose-first-view-${vw}.png`),
    fullPage: false,
  });

  reports.push({ viewport: vw, ...measure });
}

await browser.close();

const out = { baseUrl: base, detailPath, reports };
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
