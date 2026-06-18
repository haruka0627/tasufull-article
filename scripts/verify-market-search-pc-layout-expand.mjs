/**
 * 市場検索 PC layout 1440px + 1440+5列 — 本番反映後検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "search-pc-layout-expand-ship";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1600", width: 1600, height: 900 },
];

const TARGETS = {
  1280: { cols: 4, cardMin: 200, cardIdeal: 234, marginLo: 16, marginHi: 32 },
  1440: { cols: 5, cardMin: 200, cardIdeal: 216, marginLo: 16, marginHi: 32 },
  1600: { cols: 5, cardMin: 200, cardIdeal: 226, marginLo: 64, marginHi: 96 },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

const report = {
  capturedAt: new Date().toISOString(),
  implementation: "layout max 1440px + 5col @1440px+",
  url: searchUrl,
  results: {},
  overall: "PASS",
  fail: 0,
  pass: 0,
};

async function collectMetrics() {
  return page.evaluate(() => {
    const shell = document.querySelector(".tasful-market-search-shell");
    const layout = document.querySelector(".tasful-market-search-layout");
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const filter = document.querySelector("[data-tasful-market-search-filters-panel]");
    const cards = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].filter(
      (c) => !c.classList.contains("recommend-fill")
    );
    const card = cards[0];
    const img = card?.querySelector(".tasful-market-search-card__img");
    const title = card?.querySelector(".tasful-market-search-card__title");
    const price = card?.querySelector(".tasful-market-search-card__price");
    const connect = card?.querySelector(".tasful-market-search-card__seller-trust--pc, [class*='connect']");
    const cartRail = document.querySelector("[data-tasful-market-search-cart-rail]");
    const cartBtn = card?.querySelector(".tasful-market-search-card__cart");
    const layoutRect = layout?.getBoundingClientRect();
    const imgRect = img?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const layoutCs = layout ? getComputedStyle(layout) : null;
    const rows = [];
    cards.slice(0, 15).forEach((c) => {
      const r = c.getBoundingClientRect();
      const row = rows.find((x) => Math.abs(x.top - r.top) < 8);
      if (row) row.count += 1;
      else rows.push({ top: r.top, count: 1 });
    });
    const vw = window.innerWidth;
    return {
      viewportWidth: vw,
      layoutWidth: Math.round(layoutRect?.width || 0),
      layoutMaxWidth: layoutCs?.maxWidth || "",
      layoutMarginEach: Math.round(layoutRect?.left || 0),
      layoutMarginRight: Math.round(vw - (layoutRect?.right || 0)),
      filterWidth: Math.round(filterRect?.width || 0),
      gridColumns: rows.sort((a, b) => a.top - b.top)[0]?.count || 0,
      cardWidth: Math.round(cardRect?.width || 0),
      cardImgWidth: Math.round(imgRect?.width || 0),
      cardImgHeight: Math.round(imgRect?.height || 0),
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      priceFontSize: price ? getComputedStyle(price).fontSize : "",
      hasCartBtn: !!cartBtn,
      cartRailVisible: cartRail ? getComputedStyle(cartRail).display !== "none" && cartRail.offsetParent !== null : false,
      imgAspectRatio: img ? getComputedStyle(img).aspectRatio : "",
    };
  });
}

function check(vpName, metrics) {
  const t = TARGETS[vpName];
  const fails = [];
  if (!t) return { pass: true, fails: [], metrics };
  if (metrics.gridColumns !== t.cols) fails.push(`columns ${metrics.gridColumns} !== ${t.cols}`);
  if (metrics.cardWidth < t.cardMin) fails.push(`cardWidth ${metrics.cardWidth} < ${t.cardMin}`);
  if (metrics.cardImgWidth < t.cardMin) fails.push(`img ${metrics.cardImgWidth} < ${t.cardMin}`);
  if (metrics.filterWidth < 220 || metrics.filterWidth > 240) fails.push(`filter ${metrics.filterWidth}px`);
  if (metrics.layoutMarginEach < t.marginLo || metrics.layoutMarginEach > t.marginHi) {
    fails.push(`marginL ${metrics.layoutMarginEach} not in ${t.marginLo}-${t.marginHi}`);
  }
  if (metrics.titleFontSize !== "16px") fails.push(`title ${metrics.titleFontSize}`);
  if (metrics.priceFontSize !== "21px") fails.push(`price ${metrics.priceFontSize}`);
  if (metrics.imgAspectRatio !== "1 / 1") fails.push(`aspect ${metrics.imgAspectRatio}`);
  if (metrics.cartRailVisible) fails.push("cart rail visible");
  if (!metrics.hasCartBtn && vpName !== "390") fails.push("no cart btn");
  return { pass: fails.length === 0, fails, metrics };
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const metrics = await collectMetrics();
  const result = check(vp.name, metrics);
  const shotPath = path.join(OUT_DIR, `search-layout-expand-${vp.name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  if (vp.name === "390") {
    const spGrid = await page.evaluate(() => {
      const grid = document.querySelector("[data-tasful-market-search-grid]");
      const cs = grid ? getComputedStyle(grid) : null;
      return cs?.gridTemplateColumns || "";
    });
    result.spUnchanged = spGrid.includes("repeat(2") || spGrid.split(" ").length <= 3;
    if (!result.spUnchanged) result.fails.push("SP grid changed");
    result.pass = result.fails.length === 0;
  }

  report.results[vp.name] = {
    metrics,
    checks: result.fails,
    pass: result.pass,
    screenshot: path.relative(ROOT, shotPath).replace(/\\/g, "/"),
    target: TARGETS[vp.name] || null,
  };

  if (result.pass) report.pass += 1;
  else {
    report.fail += 1;
    report.overall = "FAIL";
  }
  console.log(vp.name, result.pass ? "PASS" : "FAIL", JSON.stringify(metrics), result.fails);
}

const md = `# 市場検索 PC layout 拡張 — 本番反映検証

生成: ${report.capturedAt}

## 実装

- shell \`max-width: calc(1440px + 48px)\`
- layout \`max-width: 1440px\` + \`margin: auto\`
- 1025〜1439px: 4列
- 1440px+: 5列
- フィルター: 240px

## 結果: **${report.overall}**

| viewport | 列 | layout | 余白L | カード | 画像 | 判定 |
|----------|-----|--------|-------|--------|------|------|
${VIEWPORTS.map((vp) => {
  const v = report.results[vp.name];
  const m = v.metrics;
  return `| ${vp.name} | ${m.gridColumns} | ${m.layoutWidth}px | ${m.layoutMarginEach}px | ${m.cardWidth}px | ${m.cardImgWidth}px | ${v.pass ? "PASS" : v.checks.join(", ")} |`;
}).join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場検索 PC layout 拡張 本番反映",
  report,
  targetPage: "shop-search.html",
  viewports: ["390", "1280", "1440", "1600"],
  overall: report.overall,
  pass: report.pass,
  fail: report.fail,
  screenshotCatalog: VIEWPORTS.map((vp) => ({
    file: `search-layout-expand-${vp.name}.png`,
    label: `市場検索 layout拡張 ${vp.name}px`,
    url: "shop-search.html",
    viewport: vp.name,
  })),
});

console.log("\nOVERALL:", report.overall);
});

await closeAllBrowsers();
