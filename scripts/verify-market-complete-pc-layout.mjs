/**
 * 注文完了ページ PC レイアウト — CTA〜フッター間隔・フッター下余白
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-complete-pc-layout";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 1280, tall: true },
  { name: "1440", width: 1440, height: 1440, tall: true },
  { name: "1600", width: 1600, height: 1600, tall: true },
  { name: "390", width: 390, height: 844 },
];

function rgbToHex(rgb) {
  const m = String(rgb || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "";
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}

function isFooterTone(hex) {
  if (!hex || hex.length !== 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r < 80 && g < 80 && b < 100;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-market-complete.html" });
const pageUrl = buildLocalPageUrl(base, "shop-market-complete.html");
const refFooterUrl = buildLocalPageUrl(base, "shop-market-cart.html");
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

let refFooterH = null;
{
  await page.setViewportSize({ width: 1280, height: 1280 });
  await page.goto(refFooterUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".tasful-market-footer", { timeout: 20000 });
  refFooterH = await page.evaluate(() => Math.round(document.querySelector(".tasful-market-footer")?.getBoundingClientRect().height || 0));
}

const report = {
  capturedAt: new Date().toISOString(),
  url: pageUrl,
  results: {},
  overall: "PASS",
  fail: 0,
  pass: 0,
};

function checkPc(metrics) {
  const fails = [];
  if (metrics.gapActionsFooter < 16 || metrics.gapActionsFooter > 24) {
    fails.push(`cta-footer gap ${metrics.gapActionsFooter}px not in 16-24`);
  }
  if (metrics.gapBelowFooter > 2) fails.push(`below footer ${metrics.gapBelowFooter}px`);
  if (parseFloat(metrics.bodyPadB) > 1) fails.push(`body padding-bottom ${metrics.bodyPadB}`);
  if (metrics.footerFlex && metrics.footerFlex !== "0 1 auto" && metrics.footerFlex !== "0 0 auto") {
    fails.push(`footer flex ${metrics.footerFlex} (stretch removed)`);
  }
  if (metrics.footerDisplay === "flex" && (metrics.footerInnerGap || 0) > 40) {
    fails.push(`footer inner empty ${metrics.footerInnerGap}px`);
  }
  if (metrics.footerH && metrics.refFooterH && Math.abs(metrics.footerH - metrics.refFooterH) > 4) {
    fails.push(`footer height ${metrics.footerH}px != ref ${metrics.refFooterH}px`);
  }
  if (metrics.cardWidth && (metrics.cardWidth < 680 || metrics.cardWidth > 760)) {
    fails.push(`card width ${metrics.cardWidth}px not in ~720 band`);
  }
  if (metrics.mainMaxW && metrics.mainMaxW !== "760px") {
    fails.push(`main max-width ${metrics.mainMaxW} != 760px`);
  }
  if (!metrics.bottomIsFooterTone) fails.push(`viewport bottom bg ${metrics.bottomBgHex} not footer tone`);
  if (!metrics.hasNextSteps) fails.push("next steps section missing");
  if (metrics.cardHeight && metrics.cardHeight < 460) fails.push(`card height ${metrics.cardHeight}px too short`);
  if (metrics.nextStepsCount !== 3) fails.push(`next steps items ${metrics.nextStepsCount}`);
  return { pass: fails.length === 0, fails, metrics };
}

function checkSp(metrics) {
  const fails = [];
  if (metrics.gapBelowFooter > 28) fails.push(`below footer ${metrics.gapBelowFooter}px`);
  if (parseFloat(metrics.bodyPadB) < 20) fails.push(`body padding-bottom ${metrics.bodyPadB} (SP unchanged)`);
  return { pass: fails.length === 0, fails, metrics };
}

const shots = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-complete-main", { timeout: 20000 });
  await page.waitForSelector(".tasful-market-footer", { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const footer = document.querySelector(".tasful-market-footer");
    const actions = document.querySelector(".tasful-market-complete-actions");
    const fr = footer?.getBoundingClientRect();
    const ar = actions?.getBoundingClientRect();
    const bs = getComputedStyle(document.body);
    const hs = getComputedStyle(document.documentElement);
    const fs = footer ? getComputedStyle(footer) : null;
    const fb = fr ? fr.bottom + window.scrollY : 0;
    const sampleY = Math.max(0, window.innerHeight - 8);
    const hit = document.elementFromPoint(window.innerWidth / 2, sampleY);
    const hitCs = hit ? getComputedStyle(hit) : null;
    let bg = hitCs?.backgroundColor || "transparent";
    if (bg === "rgba(0, 0, 0, 0)" && hit) {
      let node = hit;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
          bg = cs.backgroundColor;
          break;
        }
        node = node.parentElement;
      }
      if (bg === "rgba(0, 0, 0, 0)" && hs.backgroundColor !== "rgba(0, 0, 0, 0)") bg = hs.backgroundColor;
      if (bg === "rgba(0, 0, 0, 0)") bg = bs.backgroundColor;
    }
    const inner = footer?.querySelector(".tasful-market-footer__inner");
    const innerR = inner?.getBoundingClientRect();
    const main = document.querySelector(".tasful-market-complete-main");
    const card = document.querySelector(".tasful-market-complete-card");
    const nextList = document.querySelector(".tasful-market-complete-card__next-list");
    const cardR = card?.getBoundingClientRect();
    const mainCs = main ? getComputedStyle(main) : null;
    const cardCs = card ? getComputedStyle(card) : null;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      gapActionsFooter: fr && ar ? Math.round(fr.top - ar.bottom) : null,
      footerMarginTop: fs?.marginTop || "",
      footerDisplay: fs?.display || "",
      footerFlex: fs?.flex || "",
      footerH: fr ? Math.round(fr.height) : null,
      footerInnerGap: fr && innerR ? Math.round(fr.height - innerR.height) : null,
      mainMaxW: mainCs?.maxWidth || "",
      cardWidth: cardR ? Math.round(cardR.width) : null,
      cardHeight: cardR ? Math.round(cardR.height) : null,
      hasNextSteps: !!document.querySelector(".tasful-market-complete-card__next"),
      nextStepsCount: nextList ? nextList.children.length : 0,
      cardPad: cardCs?.padding || "",
      bodyPadB: bs.paddingBottom,
      bodyMinH: bs.minHeight,
      htmlBg: hs.backgroundColor,
      gapBelowFooter: footer ? Math.round(document.body.offsetHeight - fb) : null,
      scrollBelowFooter: footer ? Math.round(document.documentElement.scrollHeight - fb) : null,
      viewportBelowFooter: fr ? Math.round(window.innerHeight - fr.bottom) : null,
      bodyH: document.body.offsetHeight,
      docH: document.documentElement.scrollHeight,
      bottomHitTag: hit?.tagName || "",
      bottomBg: bg,
    };
  });

  metrics.refFooterH = refFooterH;

  metrics.bottomBgHex = rgbToHex(metrics.bottomBg);
  metrics.bottomIsFooterTone = isFooterTone(metrics.bottomBgHex);

  const isPc = vp.width >= 961;
  const result = isPc ? checkPc(metrics) : checkSp(metrics);
  const shotPath = path.join(OUT_DIR, `complete-layout-${vp.name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  report.results[vp.name] = {
    metrics,
    checks: result.fails,
    pass: result.pass,
    screenshot: path.relative(ROOT, shotPath).replace(/\\/g, "/"),
  };

  shots.push({
    file: `complete-layout-${vp.name}.png`,
    label: `注文完了 ${vp.name}px`,
    url: "shop-market-complete.html",
    viewport: vp.name,
  });

  if (result.pass) report.pass += 1;
  else {
    report.fail += 1;
    report.overall = "FAIL";
  }
  console.log(vp.name, result.pass ? "PASS" : "FAIL", JSON.stringify(metrics), result.fails);
}

const md = `# 注文完了 PC レイアウト — 検証

生成: ${report.capturedAt}

## 結果: **${report.overall}**

| viewport | CTA→フッター | フッター下 | viewport下 | 下端色 | 判定 |
|----------|-------------|-----------|-----------|--------|------|
${VIEWPORTS.map((vp) => {
  const v = report.results[vp.name];
  const m = v.metrics;
  return `| ${vp.name} | ${m.gapActionsFooter}px | ${m.gapBelowFooter}px | ${m.viewportBelowFooter}px | ${m.bottomBgHex || m.bottomBg} | ${v.pass ? "PASS" : v.checks.join(", ")} |`;
}).join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "注文完了 PC レイアウト調整",
  report,
  targetPage: "shop-market-complete.html",
  viewports: VIEWPORTS.map((v) => v.name),
  overall: report.overall,
  pass: report.pass,
  fail: report.fail,
  screenshotCatalog: shots,
});

console.log("\nOVERALL:", report.overall);
});

await closeAllBrowsers();
