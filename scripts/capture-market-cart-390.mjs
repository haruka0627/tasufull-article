#!/usr/bin/env node
/**
 * TASFUL市場 — カート画面 390px（おすすめセクション余白検証）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { devices } from "playwright";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-cart-390");
const REPORT_PATH = path.join(OUT_DIR, "cart-layout-report.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

let overallPass = false;

try {
  await page.goto(buildLocalPageUrl(base, "shop-search.html"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-market-add-cart]", { timeout: 20000 });
  await page.click("[data-tasful-market-add-cart]");

  await page.goto(buildLocalPageUrl(base, "shop-market-cart.html"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-tasful-market-cart-cross-sell]:not([hidden])", {
    timeout: 20000,
  });

  // 3件表示シナリオ（余白検証用）
  await page.evaluate(() => {
    const scroll = document.querySelector("[data-tasful-market-cart-cross-sell-scroll]");
    if (!scroll) return;
    const cards = [...scroll.querySelectorAll(".tasful-market-search-mini")];
    cards.slice(3).forEach((el) => el.remove());
  });
  await page.waitForTimeout(200);

  const diag = await page.evaluate(() => {
    const cross = document.querySelector("[data-tasful-market-cart-cross-sell]");
    const scroll = document.querySelector("[data-tasful-market-cart-cross-sell-scroll]");
    const main = document.querySelector(".tasful-market-cart-main");
    const body = document.body;
    const html = document.documentElement;
    const crossRect = cross?.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const bodyCs = getComputedStyle(body);
    const scrollCs = scroll ? getComputedStyle(scroll) : null;
    const miniCount = scroll?.querySelectorAll(".tasful-market-search-mini").length || 0;
    const footer = document.querySelector(".tasful-market-footer");
    const contentEnd = footer ? footer.offsetTop : body.scrollHeight;
    const gapBelowCrossInBody = Math.round(contentEnd - (cross.offsetTop + cross.offsetHeight));
    const gapBelowCrossInViewport = Math.round(window.innerHeight - (crossRect?.bottom || 0));
    const gapBelowMainInBody = Math.round(body.scrollHeight - (main.offsetTop + main.offsetHeight));
    return {
      miniCount,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scrollHeight: body.scrollHeight,
      bodyHeight: body.offsetHeight,
      body: {
        minHeight: bodyCs.minHeight,
        paddingBottom: bodyCs.paddingBottom,
        paddingTop: bodyCs.paddingTop,
      },
      scrollContainer: scrollCs
        ? {
            minHeight: scrollCs.minHeight,
            height: scrollCs.height,
            paddingBottom: scrollCs.paddingBottom,
            overflowX: scrollCs.overflowX,
          }
        : null,
      crossSection: {
        minHeight: cross ? getComputedStyle(cross).minHeight : null,
        marginBottom: cross ? getComputedStyle(cross).marginBottom : null,
        paddingBottom: cross ? getComputedStyle(cross).paddingBottom : null,
        height: Math.round(crossRect?.height || 0),
      },
      main: {
        paddingBottom: main ? getComputedStyle(main).paddingBottom : null,
        height: Math.round(mainRect?.height || 0),
      },
      gapBelowCrossInBody,
      gapBelowCrossInViewport,
      gapBelowMainInBody,
    };
  });

  await page.screenshot({
    path: path.join(OUT_DIR, "market-cart-cross-sell-390.png"),
    fullPage: false,
  });
  await page.screenshot({
    path: path.join(OUT_DIR, "market-cart-cross-sell-full-390.png"),
    fullPage: true,
  });
  await page.locator("[data-tasful-market-cart-cross-sell]").screenshot({
    path: path.join(OUT_DIR, "market-cart-cross-sell-section-390.png"),
  });

  const errors = [];
  if (diag.miniCount !== 3) errors.push(`cross-sell count: expected 3, got ${diag.miniCount}`);
  if (diag.gapBelowCrossInBody > 12) {
    errors.push(`gap below cross-sell in document: ${diag.gapBelowCrossInBody}px (max 12)`);
  }
  if (parseFloat(diag.body.paddingBottom) > 34) {
    errors.push(`body padding-bottom excessive: ${diag.body.paddingBottom}`);
  }
  if (parseFloat(diag.main?.paddingBottom || "0") > 0) {
    errors.push(`main padding-bottom should be 0: ${diag.main.paddingBottom}`);
  }

  overallPass = errors.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: base,
    viewport: { width: 390, height: 844 },
    overallPass,
    rootCause: {
      removed: [
        "body.tasful-market-page padding-bottom 80px (tabbar — カートに tabbar なし)",
        "style.css body min-height 100vh (コンテンツよりページを伸ばす)",
        "main padding-bottom 16px (cross-sell 下に二重余白)",
      ],
      retained: {
        "padding-top on body": "固定ヘッダー被り回避（実画面で必要）",
        "env(safe-area-inset-bottom) on body": "iPhone ホームインジケータ回避のみ",
        "min-height on CTA buttons": "タップ領域 44px（ボタン内のみ）",
      },
      notUsed: ["scroll container min-height", "cross-sell fixed height", "margin-bottom on cross-sell"],
    },
    diag,
    errors,
    screenshots: {
      fullPage: "screenshots/market-cart-390/market-cart-cross-sell-390.png",
      section: "screenshots/market-cart-390/market-cart-cross-sell-section-390.png",
    },
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ overallPass, reportPath: REPORT_PATH, diag, errors }, null, 2));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}

process.exit(overallPass ? 0 : 1);
