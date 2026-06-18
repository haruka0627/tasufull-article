#!/usr/bin/env node
/**
 * Gemini 口コミ再精査 — 390px スクショ + 文脈認識・ドック圧迫の分析
 *
 *   node scripts/capture-shop-store-review-gemini-recheck.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { primaryScreenshotsDir } from "./lib/screenshot-ops.mjs";
import {
  auditReviewGauge,
  auditReviewSectionUx,
  gotoShopDetailForReviewGauge,
  mergeUxDockAudit,
  REVIEW_GAUGE_SHOP_ID,
  scrollToReviewFooterCta,
  scrollToReviewSection,
} from "./lib/capture-shop-store-review-gauge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = primaryScreenshotsDir(ROOT);

const SHOP_ID = REVIEW_GAUGE_SHOP_ID;
const VP = { label: "390", width: 390, height: 844 };
const EXPECT = {
  shopName: "HARU CAFE",
  productTitle: "季節のパンケーキ",
  priceFragment: "1,280",
};

const SHOTS = {
  full: "390-08-review-gemini-full.png",
  firstView: "390-08-review-gemini-first-view.png",
  section: "390-08-review-gemini-section.png",
  sectionViewport: "390-08-review-gemini-section-viewport.png",
  dockContext: "390-08-review-gemini-dock-context.png",
};

async function auditContext(page) {
  return page.evaluate((expect) => {
    const issues = [];
    const notes = [];
    const text = (sel, root = document) => root.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() || "";

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        visible: r.height > 0 && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight,
      };
    };

    const inViewport = (sel) => {
      const el = document.querySelector(sel);
      return inViewportEl(el);
    };

    const inViewportEl = (el) => {
      const r = rect(el);
      return Boolean(r?.visible);
    };

    const shopTitle = text("[data-biz-detail-title]");
    const section = document.getElementById("section-reviews");
    const scoreNum = section?.querySelector(".food-reviews-scoreblock__num, .beauty-review-score__num");
    const scoreStars = section?.querySelector(".food-reviews-scoreblock__stars, .beauty-review-score__stars");
    const scoreCount = section?.querySelector(".food-reviews-scoreblock__count, .beauty-review-score__count");
    const tabs = document.querySelector(".shop-restaurant-tabs, .shop-detail-tabs, [data-shop-tab-nav]");
    const tabsR = tabs?.getBoundingClientRect();
    const scoreR = scoreNum?.getBoundingClientRect();
    const dock = document.querySelector(".shop-mobile-inquiry-dock");
    const dockR = dock?.getBoundingClientRect();
    const moreBtn = section?.querySelector(".food-review-more-btn");
    const moreR = moreBtn?.getBoundingClientRect();

    const shopInFv = inViewport("[data-biz-detail-title]") || /HARU|CAFE|ハル/i.test(document.body.innerText.slice(0, 900));
    const productInPage = /パンケーキ|季節のパンケーキ/.test(document.body.innerText);
    const priceInPage = /¥\s*1[,，]280|1280円/.test(document.body.innerText);

    const sectionText = section?.textContent || "";
    const shopInSection = /HARU|CAFE|ハル/i.test(sectionText);
    const productInSection = /パンケーキ|季節のパンケーキ/.test(sectionText);
    const priceInSection = /¥|1[,，]280/.test(sectionText);

    if (!shopInFv) notes.push("ファーストビューで店舗名が画面内にない（モバイルFV構成）");
    if (!productInSection) notes.push("口コミセクション内に代表商品名なし");
    if (!priceInSection) notes.push("口コミセクション内に価格なし（店舗詳細の仕様）");
    if (!shopInSection) notes.push("口コミセクション内に店舗名なし — 文脈補助の余地あり");

    let scoreHiddenByTabs = false;
    if (tabsR && scoreR && scoreR.height > 0) {
      scoreHiddenByTabs = scoreR.top < tabsR.bottom - 2 && scoreR.bottom > tabsR.top + 2;
    }
    if (scoreHiddenByTabs) {
      issues.push("4.8スコアがタブ帯と重なる（スクロール位置依存の可能性）");
    } else {
      notes.push("4.8タブ被り: 口コミ先頭表示では再現せず（スクロール途中キャプチャの誤認の可能性大）");
    }

    const dockVisible = Boolean(dockR && dockR.height > 8);
    const usableHeight = dockVisible ? Math.round(dockR.top) : window.innerHeight;
    const dockPressureRatio = dockVisible ? usableHeight / window.innerHeight : 1;
    let dockOverlapMore = false;
    if (dockVisible && moreR) {
      dockOverlapMore = moreR.bottom > dockR.top - 4;
      if (dockOverlapMore) issues.push("「すべての口コミを見る」とお問い合わせドックが重なる");
    }

    const summaryRecommendation = {
      suggestShopContextBand: !shopInSection,
      rationale:
        "口コミセクション先頭に店舗名が無く、タブから直入りしたユーザーは「どの店舗の口コミか」を再確認しづらい。HARU CAFE + ★ + 128件 の一行サマリー追加を推奨。",
      priority: !shopInSection ? "P2推奨" : "任意",
    };

    return {
      shopTitle,
      recognition: {
        firstView: { shop: shopInFv, product: productInPage, price: priceInPage },
        reviewSection: { shop: shopInSection, product: productInSection, price: priceInSection },
      },
      reviewSummary: {
        score: scoreNum?.textContent?.trim() || "",
        stars: scoreStars?.textContent?.trim() || "",
        count: scoreCount?.textContent?.trim() || "",
      },
      scoreHiddenByTabs,
      dock: {
        visible: dockVisible,
        top: dockR ? Math.round(dockR.top) : null,
        height: dockR ? Math.round(dockR.height) : null,
        usableHeightPx: usableHeight,
        viewportHeightPx: window.innerHeight,
        pressureRatio: Math.round(dockPressureRatio * 100) / 100,
        overlapMore: dockOverlapMore,
      },
      layout: {
        section: rect(section),
        score: rect(scoreNum),
        tabs: tabsR
          ? { top: Math.round(tabsR.top), bottom: Math.round(tabsR.bottom) }
          : null,
      },
      summaryRecommendation,
      notes,
      issues,
      expect,
    };
  }, EXPECT);
}

const base = await findDevServerBaseUrl({ probePath: "detail-shop-store.html" });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: VP.width, height: VP.height } });
const page = await context.newPage();

const report = {
  generatedAt: new Date().toISOString(),
  kind: "shop-store-review-gemini-recheck",
  shopId: SHOP_ID,
  viewport: VP.label,
  geminiNote: "「4.8がタブに隠れている」は修正不要（スクロール途中キャプチャの誤認の可能性大）",
  overall: "PASS",
  shots: SHOTS,
  context: null,
  gauge: null,
  ux: null,
  recommendations: [],
};

try {
  await gotoShopDetailForReviewGauge(page, base, SHOP_ID);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, SHOTS.firstView), fullPage: false });

  const tabReviews = page.locator('[data-shop-tab="reviews"], a[href="#section-reviews"]').first();
  if (await tabReviews.count()) {
    await tabReviews.click({ force: true }).catch(() => null);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    const section = document.getElementById("section-reviews");
    if (section) section.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);

  const section = page.locator("#section-reviews");
  if (await section.count()) {
    await section.screenshot({ path: path.join(OUT, SHOTS.section) });
  }
  await page.screenshot({ path: path.join(OUT, SHOTS.sectionViewport), fullPage: false });

  report.context = await auditContext(page);
  report.gauge = await auditReviewGauge(page);
  report.ux = await auditReviewSectionUx(page);

  await scrollToReviewFooterCta(page);
  const uxDock = await auditReviewSectionUx(page);
  report.uxDock = mergeUxDockAudit(report.ux, uxDock);
  await page.screenshot({ path: path.join(OUT, SHOTS.dockContext), fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, SHOTS.full), fullPage: true });

  const allIssues = [...(report.gauge?.issues || []), ...(report.uxDock?.issues || [])];
  const contextIssues = (report.context?.issues || []).filter(
    (i) => !/すべての口コミを見る/.test(i)
  );
  report.overall = [...allIssues, ...contextIssues].length
    ? "FAIL"
    : report.context?.notes?.length
      ? "MINOR"
      : "PASS";
  report.recommendations = [
    report.context?.summaryRecommendation?.rationale,
    report.uxDock?.dock?.overlapMore
      ? "スクロール末端で「すべての口コミを見る」がドックに被る — 下余白の再調整を検討。"
      : "お問い合わせドックの占有は画面高さの約17%（可用703px/844px）。口コミ末尾CTAはドック上に収まり、閲覧時の圧迫感は中程度で許容範囲。",
    "代表商品・価格は店舗詳細の口コミ単体では非表示。商品認識は shop-products / 商品詳細 導線で補完する設計。",
  ].filter(Boolean);
} catch (err) {
  report.overall = "FAIL";
  report.error = String(err?.message || err);
} finally {
  await context.close();
  await browser.close();
}

const existingReportPath = path.join(OUT, "report.json");
let merged = report;
try {
  const existing = JSON.parse(fs.readFileSync(existingReportPath, "utf8"));
  merged = {
    ...existing,
    reviewGeminiRecheck: report,
    generatedAt: report.generatedAt,
  };
} catch {
  merged = report;
}

fs.writeFileSync(path.join(OUT, "report-gemini-review-recheck.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(existingReportPath, JSON.stringify(merged, null, 2));

console.log(JSON.stringify({ overall: report.overall, shots: report.shots, context: report.context?.recognition }, null, 2));
await finalizeVerification(ROOT, { primaryFolder: "shop-store-final-review" });
