/**
 * 市場検索 PC — layout 最大幅拡張 再検証
 * shell + layout 同時拡張、4列 / 1440px+ 5列、1280/1440/1600 スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "search-pc-layout-expand-audit";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const SHELL_PAD = 48;
const MIN_CARD_PX = 200;
const BASE_CARD_1280 = 224;

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1600", width: 1600, height: 900 },
];

const VARIANTS = [
  { id: "current-1192", label: "現状 1192px", layoutMax: null, shellMax: null, cols4: true, cols5From: null },
  { id: "layout-1280-4col", label: "layout 1280px（4列）", layoutMax: 1280, shellMax: 1280 + SHELL_PAD, cols4: true, cols5From: null },
  { id: "layout-1360-4col", label: "layout 1360px（4列）", layoutMax: 1360, shellMax: 1360 + SHELL_PAD, cols4: true, cols5From: null },
  { id: "layout-1440-4col", label: "layout 1440px（4列）", layoutMax: 1440, shellMax: 1440 + SHELL_PAD, cols4: true, cols5From: null },
  {
    id: "layout-1360-5col-1440",
    label: "layout 1360px + 1440px以上5列",
    layoutMax: 1360,
    shellMax: 1360 + SHELL_PAD,
    cols4: true,
    cols5From: 1440,
  },
  {
    id: "layout-1440-5col-1440",
    label: "layout 1440px + 1440px以上5列",
    layoutMax: 1440,
    shellMax: 1440 + SHELL_PAD,
    cols4: true,
    cols5From: 1440,
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const report = {
  capturedAt: new Date().toISOString(),
  url: searchUrl,
  note: "前回は shell のみ拡大＋layout 1192px 固定で商品位置不変。今回は layout max-width を拡張。",
  viewports: {},
  recommendation: null,
};

function squareImgCss() {
  return `
    body.tasful-market-search-page .tasful-market-search-card__img,
    body.tasful-market-search-page .tasful-market-search-card__img img {
      aspect-ratio: 1 / 1 !important;
      max-height: none !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }
  `;
}

async function applyVariant(variant) {
  await page.evaluate(
    ({ layoutMax, shellMax, cols5From }) => {
      let el = document.getElementById("audit-search-layout-expand");
      if (!el) {
        el = document.createElement("style");
        el.id = "audit-search-layout-expand";
        document.head.appendChild(el);
      }
      if (!layoutMax) {
        el.textContent = "";
        return;
      }
      const fiveCol =
        cols5From != null
          ? `
        @media (min-width: ${cols5From}px) {
          body.tasful-market-search-page .tasful-market-search-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }
      `
          : "";
      el.textContent = `
        @media (min-width: 1025px) {
          body.tasful-market-search-page {
            --tasful-search-pc-filter-w: 240px !important;
          }
          body.tasful-market-search-page .tasful-market-search-shell {
            max-width: ${shellMax}px !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            box-sizing: border-box !important;
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          body.tasful-market-search-page .tasful-market-search-layout {
            max-width: ${layoutMax}px !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          body.tasful-market-search-page .tasful-market-search-card__img {
            max-height: none !important;
            aspect-ratio: 1 / 1 !important;
          }
          body.tasful-market-search-page .tasful-market-search-card__img img {
            max-height: none !important;
            aspect-ratio: 1 / 1 !important;
            object-fit: cover !important;
          }
          ${fiveCol}
        }
      `;
    },
    {
      layoutMax: variant.layoutMax,
      shellMax: variant.shellMax,
      cols5From: variant.cols5From,
    }
  );
}

async function collectMetrics() {
  return page.evaluate(() => {
    const shell = document.querySelector(".tasful-market-search-shell");
    const layout = document.querySelector(".tasful-market-search-layout");
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const filter = document.querySelector("[data-tasful-market-search-filters-panel]");
    const center = document.querySelector(".tasful-market-search-center");
    const cards = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].filter(
      (c) => !c.classList.contains("recommend-fill")
    );
    const card = cards[0];
    const img = card?.querySelector(".tasful-market-search-card__img");
    const title = card?.querySelector(".tasful-market-search-card__title");
    const price = card?.querySelector(".tasful-market-search-card__price");
    const shellRect = shell?.getBoundingClientRect();
    const layoutRect = layout?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const centerRect = center?.getBoundingClientRect();
    const imgRect = img?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const shellCs = shell ? getComputedStyle(shell) : null;
    const layoutCs = layout ? getComputedStyle(layout) : null;
    const gridCs = grid ? getComputedStyle(grid) : null;
    const vw = window.innerWidth;
    const rows = [];
    cards.slice(0, 15).forEach((c) => {
      const r = c.getBoundingClientRect();
      const row = rows.find((x) => Math.abs(x.top - r.top) < 8);
      if (row) row.count += 1;
      else rows.push({ top: r.top, count: 1 });
    });
    const firstRow = rows.sort((a, b) => a.top - b.top)[0];
    const colCount = firstRow?.count || 0;
    const template = gridCs?.gridTemplateColumns || "";
    return {
      viewportWidth: vw,
      shellWidth: Math.round(shellRect?.width || 0),
      shellMaxWidth: shellCs?.maxWidth || "",
      shellMarginEach: Math.round(shellRect?.left || 0),
      layoutWidth: Math.round(layoutRect?.width || 0),
      layoutMaxWidth: layoutCs?.maxWidth || "",
      layoutMarginEach: Math.round(layoutRect?.left || 0),
      layoutMarginRight: Math.round(vw - (layoutRect?.right || 0)),
      centerWidth: Math.round(centerRect?.width || 0),
      gridWidth: Math.round(gridRect?.width || 0),
      filterWidth: Math.round(filterRect?.width || 0),
      gridColumns: colCount,
      gridTemplate: template.slice(0, 120),
      cardWidth: Math.round(cardRect?.width || 0),
      cardImgWidth: Math.round(imgRect?.width || 0),
      cardImgHeight: Math.round(imgRect?.height || 0),
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      priceFontSize: price ? getComputedStyle(price).fontSize : "",
      titleText: title?.textContent?.trim().slice(0, 40) || "",
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  report.viewports[vp.name] = { variants: {} };

  for (const variant of VARIANTS) {
    await applyVariant(variant);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));

    const metrics = await collectMetrics();
    const shotDir = path.join(OUT_DIR, vp.name);
    fs.mkdirSync(shotDir, { recursive: true });
    const shotPath = path.join(shotDir, `${variant.id}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    const fails = [];
    if (metrics.cardWidth > 0 && metrics.cardWidth < MIN_CARD_PX) fails.push(`cardWidth ${metrics.cardWidth}<${MIN_CARD_PX}`);
    if (metrics.cardImgWidth > 0 && metrics.cardImgWidth < MIN_CARD_PX) fails.push(`img ${metrics.cardImgWidth}<${MIN_CARD_PX}`);
    if (metrics.filterWidth > 0 && (metrics.filterWidth < 220 || metrics.filterWidth > 240)) {
      fails.push(`filter ${metrics.filterWidth}px`);
    }

    report.viewports[vp.name].variants[variant.id] = {
      label: variant.label,
      layoutMax: variant.layoutMax,
      metrics,
      constraints: fails,
      pass: fails.length === 0,
      screenshot: path.relative(ROOT, shotPath).replace(/\\/g, "/"),
    };
    console.log(`${vp.name} ${variant.id}`, JSON.stringify(metrics), fails.length ? fails : "PASS");
  }
}

function scoreVariant(id) {
  const m1280 = report.viewports["1280"].variants[id].metrics;
  const m1440 = report.viewports["1440"].variants[id].metrics;
  const m1600 = report.viewports["1600"].variants[id].metrics;
  const c1280 = report.viewports["1280"].variants[id].constraints;
  const c1440 = report.viewports["1440"].variants[id].constraints;
  const c1600 = report.viewports["1600"].variants[id].constraints;
  if (c1280.length || c1440.length || c1600.length) return -999;

  const cardDrift1280 = Math.abs(m1280.cardImgWidth - BASE_CARD_1280);
  const cardOk =
    m1280.cardImgWidth >= MIN_CARD_PX &&
    m1440.cardImgWidth >= MIN_CARD_PX &&
    m1600.cardImgWidth >= MIN_CARD_PX;

  if (!cardOk) return -500;

  const marginScore = (m) => {
    const ideal = m.viewportWidth <= 1320 ? 20 : m.viewportWidth <= 1480 ? 40 : 56;
    const mEach = m.layoutMarginEach;
    if (mEach < 8) return 4;
    if (mEach > 200) return Math.max(0, 8 - (mEach - 200) / 20);
    return 10 - Math.abs(mEach - ideal) / 12;
  };

  const useScore =
    (m1440.layoutWidth > 1192 ? 8 : 4) +
    (m1600.layoutWidth > m1440.layoutWidth || m1600.layoutWidth >= 1360 ? 6 : 3) +
    (m1440.gridColumns === 5 && m1440.cardWidth >= 205 ? 6 : m1440.gridColumns === 4 && m1440.cardWidth >= 240 ? 5 : 4);

  const cardScore = Math.max(0, 12 - cardDrift1280 / 6);
  return cardScore + marginScore(m1280) + marginScore(m1440) * 1.2 + marginScore(m1600) + useScore;
}

const scores = VARIANTS.map((v) => ({
  id: v.id,
  label: v.label,
  score: scoreVariant(v.id),
})).sort((a, b) => b.score - a.score);

const viable = scores.filter((s) => s.score > 0);
let best = viable[0] || scores[0];

report.recommendation = {
  proposed: best.id,
  label: best.label,
  scores: viable,
  rationale: "",
};

const pick = (id) => report.viewports["1440"].variants[id]?.metrics;
const pick16 = (id) => report.viewports["1600"].variants[id]?.metrics;
const pick12 = (id) => report.viewports["1280"].variants[id]?.metrics;

if (best.id === "layout-1440-5col-1440") {
  const m14 = pick("layout-1440-5col-1440");
  const m16 = pick16("layout-1440-5col-1440");
  const m12 = pick12("layout-1440-5col-1440");
  report.recommendation.rationale =
    `layout max 1440px + 1440px以上5列。1280: layout ${m12.layoutWidth}px・4列・カード${m12.cardWidth}px。1440: layout ${m14.layoutWidth}px・余白各${m14.layoutMarginEach}px・5列・カード${m14.cardWidth}px。1600: layout ${m16.layoutWidth}px・余白各${m16.layoutMarginEach}px・カード${m16.cardWidth}px。中央寄せ過多を解消しつつカード200px以上・1:1画像を維持。`;
} else if (best.id === "layout-1360-5col-1440") {
  const m14 = pick("layout-1360-5col-1440");
  report.recommendation.rationale =
    `layout 1360px + 1440px以上5列。1440でカード${m14.cardWidth}px・余白各${m14.layoutMarginEach}px。`;
} else if (best.id === "layout-1280-4col") {
  const m14 = pick("layout-1280-4col");
  const m12 = pick12("layout-1280-4col");
  report.recommendation.rationale =
    `layout 1280px・4列維持。1280でカード${m12.cardWidth}px、1440で余白各${m14.layoutMarginEach}px・カード${m14.cardWidth}px。変更は控えめだが安全。`;
} else if (best.id === "layout-1360-4col") {
  report.recommendation.rationale = "layout 1360px 4列。広画面でカード約266pxとやや大きめ。";
} else {
  report.recommendation.rationale = "現状維持。広画面では左右余白が過大（1440で各124px、1600で各204px）。";
}

const md = `# 市場検索 PC layout 幅拡張 再検証

生成: ${report.capturedAt}

## 背景

前回: shell のみ拡大 + layout 1192px 固定 → **商品位置・商品エリア幅は不変**  
今回: **layout max-width を拡張**（shell = layout + 48px padding）

## 比較案

| ID | 内容 |
|----|------|
| current-1192 | 現状（layout 実測 1192px） |
| layout-1280-4col | layout max 1280px・4列・1:1画像 |
| layout-1360-4col | layout max 1360px・4列 |
| layout-1440-4col | layout max 1440px・4列 |
| layout-1360-5col-1440 | layout 1360px・**1440px+ で5列** |
| layout-1440-5col-1440 | layout 1440px・**1440px+ で5列** |

フィルター幅: 240px（220〜240px 範囲内）

## 実測 — 1280px

| 案 | layout | 左右余白 | 一覧幅 | 列 | カード | 画像 |
|----|--------|----------|--------|-----|--------|------|
${VARIANTS.map((v) => {
  const m = report.viewports["1280"].variants[v.id].metrics;
  return `| ${v.label} | ${m.layoutWidth}px | ${m.layoutMarginEach}px | ${m.gridWidth}px | ${m.gridColumns} | ${m.cardWidth}px | ${m.cardImgWidth}px |`;
}).join("\n")}

## 実測 — 1440px

| 案 | layout | 左右余白 | 一覧幅 | 列 | カード | 画像 |
|----|--------|----------|--------|-----|--------|------|
${VARIANTS.map((v) => {
  const m = report.viewports["1440"].variants[v.id].metrics;
  return `| ${v.label} | ${m.layoutWidth}px | ${m.layoutMarginEach}px | ${m.gridWidth}px | ${m.gridColumns} | ${m.cardWidth}px | ${m.cardImgWidth}px |`;
}).join("\n")}

## 実測 — 1600px

| 案 | layout | 左右余白 | 一覧幅 | 列 | カード | 画像 |
|----|--------|----------|--------|-----|--------|------|
${VARIANTS.map((v) => {
  const m = report.viewports["1600"].variants[v.id].metrics;
  return `| ${v.label} | ${m.layoutWidth}px | ${m.layoutMarginEach}px | ${m.gridWidth}px | ${m.gridColumns} | ${m.cardWidth}px | ${m.cardImgWidth}px |`;
}).join("\n")}

## 推奨

**${report.recommendation.label}**

${report.recommendation.rationale}

### 代替（シンプル重視）

**layout 1280px（4列）** — 5列化なし。1280でカード${report.viewports["1280"].variants["layout-1280-4col"].metrics.cardWidth}px、1440で余白各${report.viewports["1440"].variants["layout-1280-4col"].metrics.layoutMarginEach}px。

## スクショ

\`screenshots/${FOLDER_ID}/{1280,1440,1600}/\`
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場検索 PC layout 幅拡張 再検証",
  report,
  targetPage: "shop-search.html",
  viewports: ["1280", "1440", "1600"],
});

console.log("\nRECOMMENDATION:", report.recommendation.label);
console.log(JSON.stringify(report.recommendation, null, 2));

await browser.close();
