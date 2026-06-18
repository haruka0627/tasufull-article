#!/usr/bin/env node
/**
 * 店舗詳細 口コミ評価ゲージ — 単体デバッグ用（主判定は shop-store-final-review）
 *
 *   node scripts/capture-shop-store-review-gauge.mjs
 *
 * ユーザー確認用:
 *   node scripts/capture-shop-store-final-review.mjs --page review-gauge
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { debugScreenshotsDir } from "./lib/screenshot-ops.mjs";
import {
  auditReviewGauge,
  auditReviewSectionUx,
  captureReviewGaugeShots,
  gotoShopDetailForReviewGauge,
  judgeReviewGauge,
  judgeReviewSection,
  REVIEW_GAUGE_SHOP_ID,
  REVIEW_GAUGE_VIEWPORTS,
  scrollToReviewFooterCta,
  scrollToReviewSection,
  mergeUxDockAudit,
} from "./lib/capture-shop-store-review-gauge.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = debugScreenshotsDir(root, "shop-store-review-gauge");

const base = await findDevServerBaseUrl({ probePath: "detail-shop-store.html" });

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  kind: "debug",
  primaryFolder: "shop-store-final-review",
  note: "単体検証。index.html には掲載されません。主判定へ反映するには capture-shop-store-final-review.mjs --page review-gauge を実行してください。",
  overall: "PASS",
  viewports: [],
};

for (const vp of REVIEW_GAUGE_VIEWPORTS) {
  const vpReport = { label: vp.label, verdict: "PASS", issues: [], bars: [], shots: [] };
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await gotoShopDetailForReviewGauge(page, base, REVIEW_GAUGE_SHOP_ID);
    await page.evaluate(() => {
      document.getElementById("section-reviews")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(500);

    const audit = await auditReviewGauge(page);
    const ux = await auditReviewSectionUx(page);
    if (vp.label === "390") {
      await scrollToReviewFooterCta(page);
      const uxDock = await auditReviewSectionUx(page);
      Object.assign(ux, mergeUxDockAudit(ux, uxDock));
    }
    vpReport.bars = audit.rows;
    vpReport.issues = [...audit.issues, ...ux.issues];
    vpReport.ux = ux;
    vpReport.verdict = judgeReviewSection(audit.issues, ux.issues);

    const shots = await captureReviewGaugeShots(page, OUT, vp.label, {
      filePrefix: `${vp.label}-review-gauge`,
    });
    vpReport.shots.push(shots.viewportFile, shots.sectionFile);

    if (vpReport.verdict === "FAIL") report.overall = "FAIL";
  } catch (err) {
    vpReport.verdict = "FAIL";
    vpReport.issues.push(String(err?.message || err));
    report.overall = "FAIL";
  } finally {
    report.viewports.push(vpReport);
    await context.close();
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n[debug] Saved: ${OUT}`);
console.log("[primary] node scripts/capture-shop-store-final-review.mjs --page review-gauge");
process.exit(report.overall === "PASS" ? 0 : 1);
