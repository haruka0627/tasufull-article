/**
 * 市場検索 PC — コンテンツ max-width 再監査（1240現状 vs 1360/1440/1520）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "search-pc-max-width-audit");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1600", width: 1600, height: 900 },
];
const VARIANTS = [
  { id: "current-1240", label: "現状 1240px", maxWidth: 1240 },
  { id: "proposal-1360", label: "案A 1360px", maxWidth: 1360 },
  { id: "proposal-1440", label: "案B 1440px", maxWidth: 1440 },
  { id: "proposal-1520", label: "案C 1520px", maxWidth: 1520 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const report = {
  capturedAt: new Date().toISOString(),
  url: searchUrl,
  currentCssMaxWidth: "1240px (shop-market-search.css @media 1025px+)",
  viewports: {},
  recommendation: null,
};

async function applyMaxWidth(px) {
  await page.evaluate((maxWidth) => {
    let el = document.getElementById("audit-search-max-width");
    if (!el) {
      el = document.createElement("style");
      el.id = "audit-search-max-width";
      document.head.appendChild(el);
    }
    el.textContent = `
      @media (min-width: 961px) {
        body.tasful-market-search-page .tasful-market-search-shell,
        .tasful-market-search-shell {
          max-width: ${maxWidth}px !important;
        }
      }
    `;
  }, px);
}

async function collectMetrics() {
  return page.evaluate(() => {
    const shell = document.querySelector(".tasful-market-search-shell");
    const center = document.querySelector(".tasful-market-search-center");
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const filter = document.querySelector("[data-tasful-market-search-filters-panel]");
    const card = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].find(
      (c) => !c.classList.contains("recommend-fill")
    );
    const img = card?.querySelector(".tasful-market-search-card__img");
    const shellRect = shell?.getBoundingClientRect();
    const centerRect = center?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const imgRect = img?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const shellCs = shell ? getComputedStyle(shell) : null;
    const rects = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")]
      .filter((c) => !c.classList.contains("recommend-fill"))
      .slice(0, 8)
      .map((c) => c.getBoundingClientRect());
    const rows = [];
    rects.forEach((r) => {
      const row = rows.find((x) => Math.abs(x.top - r.top) < 8);
      if (row) row.count += 1;
      else rows.push({ top: r.top, count: 1 });
    });
    const vw = window.innerWidth;
    const shellW = Math.round(shellRect?.width || 0);
    const sideMargin = Math.round((vw - shellW) / 2);
    return {
      viewportWidth: vw,
      shellMaxWidth: shellCs?.maxWidth || "",
      shellWidth: shellW,
      shellPaddingInline: shellCs ? parseFloat(shellCs.paddingLeft) + parseFloat(shellCs.paddingRight) : 0,
      sideMarginEach: sideMargin,
      contentWidth: shellW ? Math.round(shellW - (parseFloat(shellCs?.paddingLeft || 0) + parseFloat(shellCs?.paddingRight || 0))) : 0,
      centerWidth: Math.round(centerRect?.width || 0),
      gridWidth: Math.round(gridRect?.width || 0),
      filterWidth: Math.round(filterRect?.width || 0),
      gridColumns: rows.sort((a, b) => a.top - b.top)[0]?.count || 0,
      cardImgWidth: Math.round(imgRect?.width || 0),
      cardImgHeight: Math.round(imgRect?.height || 0),
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  report.viewports[vp.name] = { variants: {} };

  for (const variant of VARIANTS) {
    await applyMaxWidth(variant.maxWidth);
    await page.waitForTimeout(450);
    await page.evaluate(() => window.scrollTo(0, 0));

    const metrics = await collectMetrics();
    const shotDir = path.join(OUT_DIR, vp.name);
    fs.mkdirSync(shotDir, { recursive: true });
    const shotPath = path.join(shotDir, `${variant.id}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    report.viewports[vp.name].variants[variant.id] = {
      label: variant.label,
      maxWidth: variant.maxWidth,
      metrics,
      screenshot: path.relative(path.join(__dirname, ".."), shotPath).replace(/\\/g, "/"),
    };
    console.log(`${vp.name} ${variant.id}`, JSON.stringify(metrics));
  }
}

function scoreVariant(id) {
  const m1440 = report.viewports["1440"]?.variants[id]?.metrics;
  const m1600 = report.viewports["1600"]?.variants[id]?.metrics;
  const m1280 = report.viewports["1280"]?.variants[id]?.metrics;
  if (!m1440 || !m1600 || !m1280) return -999;
  const baseImg = report.viewports["1280"].variants["current-1240"]?.metrics?.cardImgWidth || 224;
  const imgDrift1440 = Math.abs(m1440.cardImgWidth - baseImg);
  const imgDrift1600 = Math.abs(m1600.cardImgWidth - baseImg);
  const margin1440 = m1440.sideMarginEach;
  const margin1600 = m1600.sideMarginEach;
  // 余白: 40〜100px を理想帯、カード幅変化は小さいほど良い
  const marginScore =
    (margin1440 >= 32 && margin1440 <= 96 ? 10 : Math.max(0, 10 - Math.abs(margin1440 - 64) / 8)) +
    (margin1600 >= 48 && margin1600 <= 120 ? 10 : Math.max(0, 10 - Math.abs(margin1600 - 80) / 10));
  const cardScore = Math.max(0, 20 - imgDrift1440 / 4 - imgDrift1600 / 6);
  return marginScore + cardScore;
}

const scores = VARIANTS.map((v) => ({ id: v.id, label: v.label, score: scoreVariant(v.id) })).sort(
  (a, b) => b.score - a.score
);
const best = scores[0];
report.recommendation = {
  proposed: best.id,
  label: best.label,
  scores,
  rationale:
    "1280px基準のカード画像幅を維持しつつ、1440/1600pxでの左右余白とカード伸びのバランスでスコアリング",
};

const md = `# 市場検索 PC max-width 再監査

生成: ${report.capturedAt}

## 現状

- CSS \`max-width\`: **1240px**（\`shop-market-search.css\` 1025px+）
- 商品グリッド: **4列**（変更なし）

## 実測（現状 1240px）

| viewport | shell幅 | 左右余白(各) | 商品一覧幅 | カード画像 |
|----------|---------|--------------|------------|------------|
| 1280 | ${report.viewports["1280"]?.variants["current-1240"]?.metrics.shellWidth}px | ${report.viewports["1280"]?.variants["current-1240"]?.metrics.sideMarginEach}px | ${report.viewports["1280"]?.variants["current-1240"]?.metrics.gridWidth}px | ${report.viewports["1280"]?.variants["current-1240"]?.metrics.cardImgWidth}px |
| 1440 | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.shellWidth}px | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.sideMarginEach}px | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.gridWidth}px | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.cardImgWidth}px |
| 1600 | ${report.viewports["1600"]?.variants["current-1240"]?.metrics.shellWidth}px | ${report.viewports["1600"]?.variants["current-1240"]?.metrics.sideMarginEach}px | ${report.viewports["1600"]?.variants["current-1240"]?.metrics.gridWidth}px | ${report.viewports["1600"]?.variants["current-1240"]?.metrics.cardImgWidth}px |

## 3案比較（1440px viewport）

| 案 | max-width | 左右余白(各) | 商品一覧幅 | カード画像 |
|----|-----------|--------------|------------|------------|
| 現状 | 1240 | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.sideMarginEach}px | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.gridWidth}px | ${report.viewports["1440"]?.variants["current-1240"]?.metrics.cardImgWidth}px |
| 1360 | 1360 | ${report.viewports["1440"]?.variants["proposal-1360"]?.metrics.sideMarginEach}px | ${report.viewports["1440"]?.variants["proposal-1360"]?.metrics.gridWidth}px | ${report.viewports["1440"]?.variants["proposal-1360"]?.metrics.cardImgWidth}px |
| 1440 | 1440 | ${report.viewports["1440"]?.variants["proposal-1440"]?.metrics.sideMarginEach}px | ${report.viewports["1440"]?.variants["proposal-1440"]?.metrics.gridWidth}px | ${report.viewports["1440"]?.variants["proposal-1440"]?.metrics.cardImgWidth}px |
| 1520 | 1520 | ${report.viewports["1440"]?.variants["proposal-1520"]?.metrics.sideMarginEach}px | ${report.viewports["1440"]?.variants["proposal-1520"]?.metrics.gridWidth}px | ${report.viewports["1440"]?.variants["proposal-1520"]?.metrics.cardImgWidth}px |

## 提案

**${best.label}**（スコア ${best.score.toFixed(1)}）

${scores.map((s) => `- ${s.label}: ${s.score.toFixed(1)}`).join("\n")}

## スクショ

- \`screenshots/search-pc-max-width-audit/1280/\`
- \`screenshots/search-pc-max-width-audit/1440/\`
- \`screenshots/search-pc-max-width-audit/1600/\`
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);
console.log("\nRECOMMENDATION:", best.label);
console.log(JSON.stringify(report.recommendation, null, 2));

await browser.close();
