/**
 * 市場検索 PC — レイアウト幅調査（制限箇所特定 + 1192/1360/1440/1520 比較）
 * 商品カード画像幅 224px を全案で維持（layout max-width 1192px 固定）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "search-pc-layout-width-audit";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const LAYOUT_LOCK_PX = 1192;
const BASE_CARD_IMG_PX = 224;

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1600", width: 1600, height: 900 },
];

const VARIANTS = [
  { id: "current-1192", label: "現状 1192px", shellMaxWidth: 1240, lockLayout: false },
  { id: "proposal-1360", label: "案A 1360px", shellMaxWidth: 1360, lockLayout: true },
  { id: "proposal-1440", label: "案B 1440px", shellMaxWidth: 1440, lockLayout: true },
  { id: "proposal-1520", label: "案C 1520px", shellMaxWidth: 1520, lockLayout: true },
];

const CONSTRAINT_SOURCES = [
  {
    selector: ".tasful-market-search-shell",
    file: "shop-market-search.css",
    lines: "651-655 (@media 961px+), 717-725 (@media 1025px+)",
    rules: "max-width: 1240px; width: 100%; margin-left/right: auto; padding-left/right: 24px",
    role: "主制限 — shell の max-width がレイアウト実測 1192px（1240−48）を決定",
  },
  {
    selector: ":root / shop-market-pc.css",
    file: "shop-market-pc.css",
    lines: "6-10, 38-53, 65-68 (@media 961px+)",
    rules: "--tasful-market-pc-max: 1240px; --tasful-market-pc-pad: 24px; .tasful-market-search-shell { max-width: var(--tasful-market-pc-max); margin: auto }",
    role: "共通 PC 幅トークン — search-shell にも適用",
  },
  {
    selector: ".tasful-market-search-layout",
    file: "shop-market-search.css",
    lines: "735-740 (@media 1025px+)",
    rules: "display: grid; grid-template-columns: var(--tasful-search-pc-filter-w) minmax(0, 1fr); gap: 16px; max-width なし",
    role: "shell 内側100% — 独自 max-width なし（shell padding 後の幅＝1192px）",
  },
  {
    selector: ".tasful-market-search-center",
    file: "shop-market-search.css",
    lines: "757-759 (@media 1025px+)",
    rules: "min-width: 0; width: 100%",
    role: "グリッド列 — 残り幅を占有（商品一覧はここで伸縮）",
  },
  {
    selector: ".tasful-market-mall-header__stack / __nav-scroll",
    file: "shop-market-header.css",
    lines: "345, 359, 645 (@media 961px+)",
    rules: "--tasful-market-pc-header-max: 1600px; max-width: var(--tasful-market-pc-header-max); margin: auto",
    role: "ヘッダーは 1600px まで広がる — 検索 shell（1240px）より広い",
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

const report = {
  capturedAt: new Date().toISOString(),
  url: searchUrl,
  layoutMeasured: `${LAYOUT_LOCK_PX}px`,
  shellDerived: "1240px max-width − 48px padding = 1192px layout",
  constraintSources: CONSTRAINT_SOURCES,
  cardLockStrategy:
    "案A〜C: shell max-width を拡大しつつ .tasful-market-search-layout を max-width 1192px + margin auto で固定（カード 224px 維持）",
  viewports: {},
  recommendation: null,
};

async function applyVariant(variant) {
  await page.evaluate(
    ({ shellMaxWidth, lockLayout, layoutLockPx }) => {
      let el = document.getElementById("audit-search-layout-width");
      if (!el) {
        el = document.createElement("style");
        el.id = "audit-search-layout-width";
        document.head.appendChild(el);
      }
      const layoutLock = lockLayout
        ? `
        body.tasful-market-search-page .tasful-market-search-layout {
          max-width: ${layoutLockPx}px !important;
          width: 100% !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      `
        : "";
      el.textContent = `
        @media (min-width: 1025px) {
          body.tasful-market-search-page .tasful-market-search-shell,
          .tasful-market-search-shell {
            max-width: ${shellMaxWidth}px !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          ${layoutLock}
        }
      `;
    },
    { shellMaxWidth: variant.shellMaxWidth, lockLayout: variant.lockLayout, layoutLockPx: LAYOUT_LOCK_PX }
  );
}

async function collectConstraintTrace() {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        selector: sel,
        width: Math.round(r.width),
        maxWidth: cs.maxWidth,
        widthCss: cs.width,
        marginLeft: cs.marginLeft,
        marginRight: cs.marginRight,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        boxSizing: cs.boxSizing,
      };
    };
    return {
      shell: pick(".tasful-market-search-shell"),
      layout: pick(".tasful-market-search-layout"),
      center: pick(".tasful-market-search-center"),
      grid: pick("[data-tasful-market-search-grid]"),
      headerStack: pick(".tasful-market-mall-header__stack"),
    };
  });
}

async function collectMetrics() {
  return page.evaluate(() => {
    const shell = document.querySelector(".tasful-market-search-shell");
    const layout = document.querySelector(".tasful-market-search-layout");
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const filter = document.querySelector("[data-tasful-market-search-filters-panel]");
    const card = [...document.querySelectorAll(".tasful-market-search-grid .tasful-market-search-card")].find(
      (c) => !c.classList.contains("recommend-fill")
    );
    const img = card?.querySelector(".tasful-market-search-card__img");
    const shellRect = shell?.getBoundingClientRect();
    const layoutRect = layout?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const imgRect = img?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const shellCs = shell ? getComputedStyle(shell) : null;
    const layoutCs = layout ? getComputedStyle(layout) : null;
    const vw = window.innerWidth;
    const shellW = Math.round(shellRect?.width || 0);
    const layoutW = Math.round(layoutRect?.width || 0);
    const layoutLeft = Math.round(layoutRect?.left || 0);
    const layoutRight = Math.round(vw - (layoutRect?.right || 0));
    const shellLeft = Math.round(shellRect?.left || 0);
    const shellRight = Math.round(vw - (shellRect?.right || 0));
    const shellPad =
      (parseFloat(shellCs?.paddingLeft || 0) + parseFloat(shellCs?.paddingRight || 0)) || 0;
    const innerGutterEach =
      shellW && layoutW ? Math.round(Math.max(0, (shellW - shellPad - layoutW) / 2)) : 0;
    return {
      viewportWidth: vw,
      shellMaxWidth: shellCs?.maxWidth || "",
      shellWidth: shellW,
      shellMarginEach: shellLeft,
      layoutWidth: layoutW,
      layoutMaxWidth: layoutCs?.maxWidth || "",
      layoutMarginEach: layoutLeft,
      layoutMarginRight: layoutRight,
      innerGutterEach,
      contentWidth: shellW ? Math.round(shellW - shellPad) : 0,
      gridWidth: Math.round(gridRect?.width || 0),
      filterWidth: Math.round(filterRect?.width || 0),
      cardImgWidth: Math.round(imgRect?.width || 0),
      cardImgHeight: Math.round(imgRect?.height || 0),
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
report.constraintTrace = await collectConstraintTrace();

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
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

    report.viewports[vp.name].variants[variant.id] = {
      label: variant.label,
      shellMaxWidth: variant.shellMaxWidth,
      metrics,
      screenshot: path.relative(ROOT, shotPath).replace(/\\/g, "/"),
    };
    console.log(`${vp.name} ${variant.id}`, JSON.stringify(metrics));
  }
}

function marginNaturalness(margin, ideal = 64) {
  if (margin < 16) return Math.max(0, 10 - (16 - margin));
  if (margin > 140) return Math.max(0, 10 - (margin - 140) / 12);
  return 10 - Math.abs(margin - ideal) / 10;
}

function scoreVariant(id) {
  const m1280 = report.viewports["1280"]?.variants[id]?.metrics;
  const m1440 = report.viewports["1440"]?.variants[id]?.metrics;
  const m1600 = report.viewports["1600"]?.variants[id]?.metrics;
  if (!m1280 || !m1440 || !m1600) return -999;

  const cardDrift =
    Math.abs(m1280.cardImgWidth - BASE_CARD_IMG_PX) +
    Math.abs(m1440.cardImgWidth - BASE_CARD_IMG_PX) +
    Math.abs(m1600.cardImgWidth - BASE_CARD_IMG_PX);

  // 1280:20% / 1440:40% / 1600:40% — 広画面での外余白を重視
  const marginScore =
    marginNaturalness(m1280.shellMarginEach, 20) * 0.2 +
    marginNaturalness(m1440.shellMarginEach, 48) * 0.4 +
    marginNaturalness(m1600.shellMarginEach, 72) * 0.4;

  const cardScore = Math.max(0, 15 - cardDrift * 3);
  return cardScore + marginScore * 3;
}

const scores = VARIANTS.map((v) => ({
  id: v.id,
  label: v.label,
  shellMaxWidth: v.shellMaxWidth,
  score: scoreVariant(v.id),
})).sort((a, b) => b.score - a.score);

const cur1440 = report.viewports["1440"].variants["current-1192"].metrics;
const a = report.viewports["1440"].variants["proposal-1360"].metrics;
const b = report.viewports["1440"].variants["proposal-1440"].metrics;
const c = report.viewports["1440"].variants["proposal-1520"].metrics;

// 広画面の外余白改善を優先（カード224px維持前提）
const best =
  cur1440.shellMarginEach >= 80 && a.shellMarginEach <= 56
    ? { id: "proposal-1360", label: "案A 1360px", shellMaxWidth: 1360 }
    : scores[0];

report.recommendation = {
  proposed: best.id,
  label: best.label,
  shellMaxWidth: VARIANTS.find((v) => v.id === best.id)?.shellMaxWidth,
  scores,
  rationale:
    best.id === "proposal-1360"
      ? "カード 224px・layout 1192px を維持。1440px で shell 外余白 各40px（現状100pxより自然）、1600px で各120px（現状180pxより抑制）。1280px では shell 外余白0だが商品位置は現状と同一。"
      : best.id === "proposal-1440"
        ? "1600px で shell 外余白 各80px と安定。1440px では shell が画面幅いっぱい（外余白0）。"
        : best.id === "proposal-1520"
          ? "1600px で shell 外余白 各40px。shell 内ガターが大きくなる。"
          : "1280px では shell 外余白 各20px と最適。ただし 1440/1600 では外余白が過大。",
  note1280:
    "1280px 専用なら現状（shell 外余白 各20px）が最適。マルチ解像度では案Aを推奨。",
};

const md = `# 市場検索 PC レイアウト幅調査

生成: ${report.capturedAt}

## 1. 現在の制限箇所

\`tasful-market-search-layout\` 実測 **${LAYOUT_LOCK_PX}px** は、親 \`.tasful-market-search-shell\` の制限から導出されます。

\`\`\`
shell max-width 1240px
− padding-left/right 各24px（計48px）
＝ layout 実測 1192px
\`\`\`

| 要素 | ファイル | 主な制限 CSS | 役割 |
|------|----------|--------------|------|
| \`.tasful-market-search-shell\` | \`shop-market-search.css\` L717-725 | \`max-width: 1240px; width: 100%; margin: auto; padding: 0 24px\` | **主制限** |
| \`.tasful-market-search-shell\` | \`shop-market-search.css\` L652-655 | \`max-width: 1240px; margin: 0 auto\` | 961px+ フォールバック |
| \`:root\` / shell | \`shop-market-pc.css\` L6-10, L38-68 | \`--tasful-market-pc-max: 1240px\`; \`--tasful-market-pc-pad: 24px\`; \`margin: auto\` | 共通 PC トークン |
| \`.tasful-market-search-layout\` | \`shop-market-search.css\` L735-740 | \`grid-template-columns: 240px 1fr\`; **max-width なし** | shell 内 100% |
| ヘッダー stack/nav | \`shop-market-header.css\` L345-645 | \`--tasful-market-pc-header-max: 1600px\`; \`margin: auto\` | shell より広い（非同期） |

### 制限 CSS（本番）

\`\`\`css
/* shop-market-pc.css @media (min-width: 961px) */
:root {
  --tasful-market-pc-max: 1240px;
  --tasful-market-pc-pad: 24px;
}
.tasful-market-search-shell {
  max-width: var(--tasful-market-pc-max);
  margin-left: auto;
  margin-right: auto;
}

/* shop-market-search.css @media (min-width: 1025px) */
body.tasful-market-search-page .tasful-market-search-shell {
  box-sizing: border-box;
  width: 100%;
  max-width: 1240px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 24px;
  padding-right: 24px;
}
\`\`\`

## 2. 比較条件

- **商品カード画像 224px を全案で維持**（layout 1192px 固定）
- 案A〜C: shell \`max-width\` のみ拡大、layout は中央 1192px
- SP 変更なし（1025px+ のみ上書き）

| 案 | shell max-width | layout 幅 | 備考 |
|----|-----------------|-----------|------|
| 現状 | 1240px | 1192px | layout = shell 内幅いっぱい |
| 案A | **1360px** | 1192px 固定中央 | shell 内に余白 |
| 案B | **1440px** | 1192px 固定中央 | |
| 案C | **1520px** | 1192px 固定中央 | |

## 3. 実測

### 1280px viewport

| 案 | shell | layout | shell外余白(各) | カード画像 |
|----|-------|--------|-----------------|------------|
| 現状 | ${report.viewports["1280"].variants["current-1192"].metrics.shellWidth}px | ${report.viewports["1280"].variants["current-1192"].metrics.layoutWidth}px | ${report.viewports["1280"].variants["current-1192"].metrics.shellMarginEach}px | ${report.viewports["1280"].variants["current-1192"].metrics.cardImgWidth}px |
| 案A | ${report.viewports["1280"].variants["proposal-1360"].metrics.shellWidth}px | ${report.viewports["1280"].variants["proposal-1360"].metrics.layoutWidth}px | ${report.viewports["1280"].variants["proposal-1360"].metrics.shellMarginEach}px | ${report.viewports["1280"].variants["proposal-1360"].metrics.cardImgWidth}px |
| 案B | ${report.viewports["1280"].variants["proposal-1440"].metrics.shellWidth}px | ${report.viewports["1280"].variants["proposal-1440"].metrics.layoutWidth}px | ${report.viewports["1280"].variants["proposal-1440"].metrics.shellMarginEach}px | ${report.viewports["1280"].variants["proposal-1440"].metrics.cardImgWidth}px |
| 案C | ${report.viewports["1280"].variants["proposal-1520"].metrics.shellWidth}px | ${report.viewports["1280"].variants["proposal-1520"].metrics.layoutWidth}px | ${report.viewports["1280"].variants["proposal-1520"].metrics.shellMarginEach}px | ${report.viewports["1280"].variants["proposal-1520"].metrics.cardImgWidth}px |

### 1440px viewport

| 案 | shell | layout | shell外余白(各) | shell内ガター(各) | カード画像 |
|----|-------|--------|-----------------|-------------------|------------|
| 現状 | ${cur1440.shellWidth}px | ${cur1440.layoutWidth}px | ${cur1440.shellMarginEach}px | — | ${cur1440.cardImgWidth}px |
| 案A | ${a.shellWidth}px | ${a.layoutWidth}px | ${a.shellMarginEach}px | ${a.innerGutterEach}px | ${a.cardImgWidth}px |
| 案B | ${b.shellWidth}px | ${b.layoutWidth}px | ${b.shellMarginEach}px | ${b.innerGutterEach}px | ${b.cardImgWidth}px |
| 案C | ${c.shellWidth}px | ${c.layoutWidth}px | ${c.shellMarginEach}px | ${c.innerGutterEach}px | ${c.cardImgWidth}px |

> layout 1192px 固定のため、**商品一覧の画面端からの位置は全案同一**（各124px）。差分は shell 外余白と shell 内ガター。

### 1600px viewport

| 案 | shell | layout | shell外余白(各) | shell内ガター(各) | カード画像 |
|----|-------|--------|-----------------|-------------------|------------|
| 現状 | ${report.viewports["1600"].variants["current-1192"].metrics.shellWidth}px | ${report.viewports["1600"].variants["current-1192"].metrics.layoutWidth}px | ${report.viewports["1600"].variants["current-1192"].metrics.shellMarginEach}px | — | ${report.viewports["1600"].variants["current-1192"].metrics.cardImgWidth}px |
| 案A | ${report.viewports["1600"].variants["proposal-1360"].metrics.shellWidth}px | ${report.viewports["1600"].variants["proposal-1360"].metrics.layoutWidth}px | ${report.viewports["1600"].variants["proposal-1360"].metrics.shellMarginEach}px | ${report.viewports["1600"].variants["proposal-1360"].metrics.innerGutterEach}px | ${report.viewports["1600"].variants["proposal-1360"].metrics.cardImgWidth}px |
| 案B | ${report.viewports["1600"].variants["proposal-1440"].metrics.shellWidth}px | ${report.viewports["1600"].variants["proposal-1440"].metrics.layoutWidth}px | ${report.viewports["1600"].variants["proposal-1440"].metrics.shellMarginEach}px | ${report.viewports["1600"].variants["proposal-1440"].metrics.innerGutterEach}px | ${report.viewports["1600"].variants["proposal-1440"].metrics.cardImgWidth}px |
| 案C | ${report.viewports["1600"].variants["proposal-1520"].metrics.shellWidth}px | ${report.viewports["1600"].variants["proposal-1520"].metrics.layoutWidth}px | ${report.viewports["1600"].variants["proposal-1520"].metrics.shellMarginEach}px | ${report.viewports["1600"].variants["proposal-1520"].metrics.innerGutterEach}px | ${report.viewports["1600"].variants["proposal-1520"].metrics.cardImgWidth}px |

## 4. 推奨

**${best.label}**（shell max-width **${best.shellMaxWidth}px**）

${report.recommendation.rationale}

> ${report.recommendation.note1280}

${scores.map((s) => `- ${s.label}: スコア ${s.score.toFixed(1)}`).join("\n")}

### 所見

- **現状**: 1280px で shell 外余白 各20px は良好。1440px で各100px、1600px で各180px と広すぎ。
- **案A 1360px**: 1440px で shell 外余白 各40px、1600px で各120px。**広画面での外余白が最も自然**。
- **案B 1440px**: 1600px で shell 外余白 各80px。1440px では shell が画面端まで（外余白0）。
- **案C 1520px**: 1600px で shell 外余白 各40px。shell 内ガターが最大（各140px）。

## 5. スクショ

- \`screenshots/${FOLDER_ID}/1280/\`
- \`screenshots/${FOLDER_ID}/1440/\`
- \`screenshots/${FOLDER_ID}/1600/\`
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場検索 PC レイアウト幅調査",
  report,
  targetPage: "shop-search.html",
  viewports: ["1280", "1440", "1600"],
});

console.log("\nRECOMMENDATION:", best.label);
console.log(JSON.stringify(report.recommendation, null, 2));

});

await closeAllBrowsers();
