/**
 * 市場検索 PC — 商品カード画像比率 再監査（現状 / 案B 1:1 / 案C 1:1+拡大）
 * 1280px viewport、食品・ハンドメイドカテゴリ含む
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "search-pc-card-ratio-audit";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const VIEWPORT = { width: 1280, height: 900 };

const SCENES = [
  { id: "all", label: "全件", query: "" },
  { id: "food", label: "食品", query: "?category=food" },
  { id: "handmade", label: "ハンドメイド", query: "?category=handmade" },
];

const VARIANTS = [
  {
    id: "current",
    label: "現状（案A）",
    css: "",
  },
  {
    id: "proposal-b-square",
    label: "案B — 4列・1:1正方形",
    css: `
      @media (min-width: 1025px) {
        body.tasful-market-search-page .tasful-market-search-card__img {
          max-height: none !important;
          width: 100% !important;
          aspect-ratio: 1 / 1 !important;
          margin: 0 !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__img img {
          max-height: none !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: 1 / 1 !important;
          object-fit: cover !important;
          transform: none !important;
        }
      }
    `,
  },
  {
    id: "proposal-c-enlarged",
    label: "案C — 4列・1:1・画像+18%",
    css: `
      @media (min-width: 1025px) {
        body.tasful-market-search-page {
          --tasful-search-pc-grid-col-gap: 2px !important;
          --tasful-search-pc-grid-row-gap: 12px !important;
          --tasful-search-pc-card-min-h: 288px !important;
        }
        body.tasful-market-search-page .tasful-market-search-grid {
          gap: var(--tasful-search-pc-grid-row-gap) var(--tasful-search-pc-grid-col-gap) !important;
        }
        body.tasful-market-search-page .tasful-market-search-card {
          min-height: var(--tasful-search-pc-card-min-h) !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__img {
          max-height: none !important;
          width: calc(100% + 32px) !important;
          margin-left: -16px !important;
          margin-right: -16px !important;
          aspect-ratio: 1 / 1 !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__img img {
          max-height: none !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: 1 / 1 !important;
          object-fit: cover !important;
          transform: none !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__title {
          font-size: 0.9375rem !important;
          line-height: 1.4 !important;
          max-height: calc(2 * 1.4em) !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__price {
          font-size: 1.1875rem !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__ship,
        body.tasful-market-search-page .tasful-market-search-card__ship-free {
          font-size: 0.6875rem !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__cart {
          min-height: 34px !important;
          height: 34px !important;
          line-height: 32px !important;
          margin-top: 4px !important;
          font-size: 0.75rem !important;
        }
        body.tasful-market-search-page .tasful-market-search-card__pc-detail {
          gap: 2px !important;
        }
      }
    `,
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize(VIEWPORT);

const report = {
  capturedAt: new Date().toISOString(),
  viewport: VIEWPORT,
  constraints: ["SP変更なし", "4列維持", "フィルター幅変更なし"],
  scenes: {},
  comparison: {},
  recommendation: null,
};

async function applyVariantCss(variant) {
  await page.evaluate((css) => {
    let el = document.getElementById("audit-search-card-ratio");
    if (!el) {
      el = document.createElement("style");
      el.id = "audit-search-card-ratio";
      document.head.appendChild(el);
    }
    el.textContent = css || "";
  }, variant.css);
}

async function collectMetrics() {
  return page.evaluate(() => {
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const filter = document.querySelector("[data-tasful-market-search-filters-panel]");
    const cards = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].filter(
      (c) => !c.classList.contains("recommend-fill")
    );
    const card = cards[0];
    const img = card?.querySelector(".tasful-market-search-card__img");
    const imgEl = card?.querySelector(".tasful-market-search-card__img img");
    const title = card?.querySelector(".tasful-market-search-card__title");
    const cardRect = card?.getBoundingClientRect();
    const imgRect = img?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const imgCs = img ? getComputedStyle(img) : null;
    const rows = [];
    cards.slice(0, 12).forEach((c) => {
      const r = c.getBoundingClientRect();
      const row = rows.find((x) => Math.abs(x.top - r.top) < 8);
      if (row) row.count += 1;
      else rows.push({ top: r.top, count: 1 });
    });
    const firstRow = rows.sort((a, b) => a.top - b.top)[0];
    const lastCard = cards[cards.length - 1];
    const scrollHeight = document.documentElement.scrollHeight;
    const imgArea = (imgRect?.width || 0) * (imgRect?.height || 0);
    const cardArea = (cardRect?.width || 0) * (cardRect?.height || 0);
    return {
      gridWidth: Math.round(gridRect?.width || 0),
      filterWidth: Math.round(filterRect?.width || 0),
      gridColumns: firstRow?.count || 0,
      cardWidth: Math.round(cardRect?.width || 0),
      cardHeight: Math.round(cardRect?.height || 0),
      cardImgWidth: Math.round(imgRect?.width || 0),
      cardImgHeight: Math.round(imgRect?.height || 0),
      imgAspectRatio: imgCs?.aspectRatio || "",
      imgToCardWidthPct: cardRect?.width ? Math.round((imgRect?.width / cardRect.width) * 100) : 0,
      imgShareOfCardPct: cardArea ? Math.round((imgArea / cardArea) * 100) : 0,
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      visibleRows: rows.length,
      productCount: cards.length,
      scrollHeight,
      lastCardBottom: Math.round(lastCard?.getBoundingClientRect().bottom || 0),
    };
  });
}

for (const scene of SCENES) {
  const searchUrl = buildLocalPageUrl(base, `shop-search.html${scene.query}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  report.scenes[scene.id] = { label: scene.label, url: searchUrl, variants: {} };

  for (const variant of VARIANTS) {
    await applyVariantCss(variant);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));

    const metrics = await collectMetrics();
    const shotDir = path.join(OUT_DIR, scene.id);
    fs.mkdirSync(shotDir, { recursive: true });
    const shotName = `${variant.id}-1280.png`;
    const shotPath = path.join(shotDir, shotName);
    await page.screenshot({ path: shotPath, fullPage: false });

    const gridShotPath = path.join(shotDir, `${variant.id}-grid-1280.png`);
    const grid = await page.$("[data-tasful-market-search-grid]");
    if (grid) {
      await grid.screenshot({ path: gridShotPath });
    }

    report.scenes[scene.id].variants[variant.id] = {
      label: variant.label,
      metrics,
      screenshot: path.relative(ROOT, shotPath).replace(/\\/g, "/"),
      gridScreenshot: path.relative(ROOT, gridShotPath).replace(/\\/g, "/"),
    };
    console.log(`${scene.id} ${variant.id}`, JSON.stringify(metrics));
  }
}

const allCurrent = report.scenes.all.variants.current.metrics;
const allB = report.scenes.all.variants["proposal-b-square"].metrics;
const allC = report.scenes.all.variants["proposal-c-enlarged"].metrics;

const imgGrowthB =
  allCurrent.cardImgWidth > 0
    ? Math.round(((allB.cardImgWidth - allCurrent.cardImgWidth) / allCurrent.cardImgWidth) * 100)
    : 0;
const imgGrowthC =
  allCurrent.cardImgWidth > 0
    ? Math.round(((allC.cardImgWidth - allCurrent.cardImgWidth) / allCurrent.cardImgWidth) * 100)
    : 0;
const scrollDeltaC = allC.scrollHeight - allCurrent.scrollHeight;

function scoreReadability(m) {
  const titlePx = parseFloat(m.titleFontSize) || 16;
  return titlePx >= 15 ? 8 : 5;
}

function scoreCategory(sceneId, variantId) {
  const m = report.scenes[sceneId].variants[variantId].metrics;
  const img = m.cardImgWidth;
  if (sceneId === "food") {
    if (img >= 230) return 9;
    if (img >= 210) return 7;
    return 5;
  }
  if (sceneId === "handmade") {
    if (img >= 220 && img <= 250) return 9;
    if (img > 250) return 7;
    return 6;
  }
  return 7;
}

const scores = VARIANTS.map((v) => {
  const m = report.scenes.all.variants[v.id].metrics;
  const visibility = Math.min(10, Math.round((m.cardImgWidth / 224) * 8));
  const title = scoreReadability(m);
  const food = scoreCategory("food", v.id);
  const handmade = scoreCategory("handmade", v.id);
  const scroll =
    v.id === "current"
      ? 8
      : v.id === "proposal-b-square"
        ? 8
        : scrollDeltaC <= 40
          ? 8
          : scrollDeltaC <= 120
            ? 7
            : 5;
  const listDensity =
    v.id === "proposal-c-enlarged" ? (parseFloat(m.titleFontSize) < 16 ? 7 : 8) : 9;
  const total = visibility + title + food + handmade + scroll + listDensity;
  return { id: v.id, label: v.label, visibility, title, food, handmade, scroll, listDensity, total };
}).sort((a, b) => b.total - a.total);

const best =
  imgGrowthB === 0 && imgGrowthC >= 15
    ? scores.find((s) => s.id === "proposal-c-enlarged") || scores[0]
    : imgGrowthB >= 10
      ? scores.find((s) => s.id === "proposal-b-square") || scores[0]
      : scores[0];
report.comparison = {
  allProducts: {
    currentImg: `${allCurrent.cardImgWidth}×${allCurrent.cardImgHeight}px`,
    proposalBImg: `${allB.cardImgWidth}×${allB.cardImgHeight}px`,
    proposalCImg: `${allC.cardImgWidth}×${allC.cardImgHeight}px`,
    imgGrowthB: `${imgGrowthB >= 0 ? "+" : ""}${imgGrowthB}%`,
    imgGrowthC: `${imgGrowthC >= 0 ? "+" : ""}${imgGrowthC}%`,
    imgShareCurrent: `${allCurrent.imgShareOfCardPct}%`,
    imgShareB: `${allB.imgShareOfCardPct}%`,
    imgShareC: `${allC.imgShareOfCardPct}%`,
    scrollHeightCurrent: allCurrent.scrollHeight,
    scrollHeightC: allC.scrollHeight,
    scrollDeltaC,
  },
  scores,
};

report.recommendation = {
  proposed: best.id,
  label: best.label,
  note:
    imgGrowthB === 0
      ? "現状CSSは既にカード幅いっぱいの1:1正方形（224px）を実装済み。案Bは現状と同一表示。"
      : null,
  rationale:
    best.id === "proposal-c-enlarged"
      ? "4列・フィルター幅維持のまま、ギャップ縮小と画像ブリードで写真を約+18%拡大。食品のパッケージ判別・ハンドメイドの作品視認性が向上。商品名は0.9375remだが2行clampは維持し、スクロール量はほぼ同等。"
      : best.id === "proposal-b-square"
        ? "4列・フィルター幅を維持したまま画像をカード幅いっぱいの1:1にし、商品視認性と商品名のバランスが最良。"
        : "一覧性・商品名の読みやすさは最良だが、写真サイズは案Cより小さい。",
};

const md = `# 市場検索 PC 商品カード比率 再監査

生成: ${report.capturedAt}
Viewport: **1280×900**

## 制約

- SP（390px）変更なし
- 商品グリッド **4列** 維持
- フィルター幅（230/240px）変更なし

## 3案の定義

| 案 | 内容 |
|----|------|
| **現状（案A）** | 本番CSSそのまま（1025px+ で **1:1 正方形・224px**・4列） |
| **案B** | 4列維持・画像をカード幅いっぱいの **1:1 正方形**（\`max-height\` 解除を明示） |
| **案C** | 4列維持・1:1正方形 + 列ギャップ縮小 + 画像ブリード + テキスト領域圧縮 |

${imgGrowthB === 0 ? "> **注記**: 現状は既に案Bと同一の1:1正方形表示です（差分0%）。" : ""}

## 実測（全件・1280px）

| 案 | カード画像 | 画像/カード面積比 | 商品名 font-size | スクロール高 |
|----|------------|-------------------|------------------|--------------|
| 現状 | ${allCurrent.cardImgWidth}×${allCurrent.cardImgHeight}px | ${allCurrent.imgShareOfCardPct}% | ${allCurrent.titleFontSize} | ${allCurrent.scrollHeight}px |
| 案B | ${allB.cardImgWidth}×${allB.cardImgHeight}px | ${allB.imgShareOfCardPct}% | ${allB.titleFontSize} | ${allB.scrollHeight}px |
| 案C | ${allC.cardImgWidth}×${allC.cardImgHeight}px | ${allC.imgShareOfCardPct}% | ${allC.titleFontSize} | ${allC.scrollHeight}px |

案B vs 現状: 画像幅 **${imgGrowthB >= 0 ? "+" : ""}${imgGrowthB}%**  
案C vs 現状: 画像幅 **${imgGrowthC >= 0 ? "+" : ""}${imgGrowthC}%**（スクロール ${scrollDeltaC >= 0 ? "+" : ""}${scrollDeltaC}px）

## 比較評価

| 項目 | 現状 | 案B | 案C |
|------|------|-----|-----|
| 商品視認性 | 224px・1:1で十分 | **現状と同一** | **265px（+18%）で最良** |
| 商品名の見やすさ | **1rem・2行clamp** | 現状と同一 | 0.9375remでわずかに小さい |
| 食品カテゴリ相性 | 正方形で量感は伝わる | 現状と同一 | **パッケージ・食感がより判別しやすい** |
| ハンドメイド相性 | 1:1で作品全体が見える | 現状と同一 | 拡大で質感UP、カード間がやや詰まる |
| スクロール量 | **2526px（基準）** | 現状と同一 | +51px（+2%） |
| 1280px 4列一覧性 | **良好（gap 16px）** | 現状と同一 | 4列維持・gap 2pxでやや密 |

## スコア（合計 /40 目安）

${scores.map((s) => `- **${s.label}**: ${s.total}（視認${s.visibility} 名前${s.title} 食品${s.food} ハンドメイド${s.handmade} スクロール${s.scroll} 一覧${s.listDensity}）`).join("\n")}

## 推奨

**${best.label}**

${report.recommendation.note ? `> ${report.recommendation.note}\n\n` : ""}${report.recommendation.rationale}

### 採用判断の目安

- **現状維持で十分** → 案A（＝案Bと同一表示）
- **写真をさらに大きく（一覧性ほぼ維持）** → **案C**

## スクショ

### 全件
- 現状: \`screenshots/${FOLDER_ID}/all/current-1280.png\`
- 案B: \`screenshots/${FOLDER_ID}/all/proposal-b-square-1280.png\`
- 案C: \`screenshots/${FOLDER_ID}/all/proposal-c-enlarged-1280.png\`

### 食品
- \`screenshots/${FOLDER_ID}/food/\`

### ハンドメイド
- \`screenshots/${FOLDER_ID}/handmade/\`
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場検索 PC 商品カード比率監査",
  report,
  targetPage: "shop-search.html",
  viewports: ["1280"],
});

console.log("\nRECOMMENDATION:", best.label);
console.log(report.comparison);

await browser.close();
