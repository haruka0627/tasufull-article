#!/usr/bin/env node
/**
 * 口コミセクション UX — 修正前後スクショ + report.json
 *
 *   node scripts/capture-shop-store-reviews-ux.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { primaryScreenshotsDir } from "./lib/screenshot-ops.mjs";
import {
  auditReviewGauge,
  auditReviewSectionUx,
  captureReviewGaugeShots,
  gotoShopDetailForReviewGauge,
  judgeReviewSection,
  REVIEW_GAUGE_SHOP_ID,
  REVIEW_GAUGE_VIEWPORTS,
  scrollToReviewFooterCta,
  scrollToReviewSection,
  mergeUxDockAudit,
} from "./lib/capture-shop-store-review-gauge.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "screenshots", "shop-store-reviews-ux");
const BEFORE = path.join(OUT, "before");
const AFTER = path.join(OUT, "after");
const PRIMARY = primaryScreenshotsDir(ROOT);

const UX_FILES = ["detail-shop-store-bottom.js", "detail-shop-restaurant.css"];

function readHeadFile(rel) {
  try {
    return execSync(`git show HEAD:${rel}`, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

function backupAndRestoreHead() {
  const backups = new Map();
  for (const rel of UX_FILES) {
    const abs = path.join(ROOT, rel);
    backups.set(rel, fs.readFileSync(abs, "utf8"));
    const head = readHeadFile(rel);
    if (head) fs.writeFileSync(abs, head, "utf8");
  }
  return backups;
}

function restoreBackups(backups) {
  for (const [rel, content] of backups) {
    fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
  }
}

async function capturePhase(browser, base, phaseDir, phaseLabel) {
  const phaseReport = { phase: phaseLabel, viewports: [] };
  for (const vp of REVIEW_GAUGE_VIEWPORTS) {
    const vpReport = { label: vp.label, verdict: "PASS", issues: [], data: {}, shots: [] };
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      await gotoShopDetailForReviewGauge(page, base, REVIEW_GAUGE_SHOP_ID);
      await scrollToReviewSection(page);
      const gauge = await auditReviewGauge(page);
      const ux = await auditReviewSectionUx(page);
      if (vp.label === "390") {
        await scrollToReviewFooterCta(page);
        const uxDock = await auditReviewSectionUx(page);
        Object.assign(ux, mergeUxDockAudit(ux, uxDock));
      }
      const issues = [...gauge.issues, ...ux.issues];
      vpReport.issues = issues;
      vpReport.verdict = judgeReviewSection(gauge.issues, ux.issues);
      vpReport.data = { gauge, ux };

      const prefix = `${vp.label}-reviews-ux-${phaseLabel}`;
      const shots = await captureReviewGaugeShots(page, phaseDir, vp.label, { filePrefix: prefix });
      vpReport.shots.push(shots.viewportFile, shots.sectionFile);

      if (vp.label === "390") {
        await scrollToReviewFooterCta(page);
        const footerFile = `${prefix}-footer-cta.png`;
        await page.screenshot({ path: path.join(phaseDir, footerFile), fullPage: false });
        vpReport.shots.push(footerFile);
      }
    } catch (err) {
      vpReport.verdict = "FAIL";
      vpReport.issues.push(String(err?.message || err));
    } finally {
      phaseReport.viewports.push(vpReport);
      await context.close();
    }
  }
  return phaseReport;
}

fs.mkdirSync(BEFORE, { recursive: true });
fs.mkdirSync(AFTER, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "detail-shop-store.html" });
const browser = await chromium.launch({ headless: true });

const backups = backupAndRestoreHead();
console.log("[reviews-ux] capturing BEFORE (git HEAD markup/css)...");
const beforeReport = await capturePhase(browser, base, BEFORE, "before");
restoreBackups(backups);
console.log("[reviews-ux] capturing AFTER (working tree)...");
const afterReport = await capturePhase(browser, base, AFTER, "after");

for (const vp of afterReport.viewports) {
  const srcPrefix = `${vp.label}-reviews-ux-after`;
  const primaryPrefix = `${vp.label}-08-review-gauge`;
  for (const name of [`${srcPrefix}-viewport.png`, `${srcPrefix}-section.png`]) {
    const src = path.join(AFTER, name);
    if (fs.existsSync(src)) {
      const destName = name.replace(srcPrefix, primaryPrefix);
      fs.copyFileSync(src, path.join(PRIMARY, destName));
    }
  }
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  kind: "shop-store-reviews-ux",
  task: "口コミセクションUX改善 P1/P2",
  shopId: REVIEW_GAUGE_SHOP_ID,
  viewports: ["390", "1280"],
  overall: {
    before: beforeReport.viewports.every((v) => v.verdict === "PASS") ? "PASS" : "FAIL",
    after: afterReport.viewports.every((v) => v.verdict === "PASS") ? "PASS" : "FAIL",
  },
  geminiRecheck: {
    spSummaryAboveGauge: afterReport.viewports.find((v) => v.label === "390")?.data?.ux?.layout?.orderOk ?? false,
    dockNotOverlappingMore: !(afterReport.viewports.find((v) => v.label === "390")?.data?.ux?.dock?.overlapMore),
    pcVerticalFlow: afterReport.viewports.find((v) => v.label === "1280")?.data?.ux?.layout?.orderOk ?? false,
    gaugeBars: afterReport.viewports.every((v) => !v.data?.gauge?.issues?.length),
  },
  before: beforeReport,
  after: afterReport,
  folders: {
    before: "screenshots/shop-store-reviews-ux/before",
    after: "screenshots/shop-store-reviews-ux/after",
    primary: "screenshots/shop-store-final-review",
  },
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(PRIMARY, "report-reviews-ux.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report.overall, null, 2));
console.log(JSON.stringify(report.geminiRecheck, null, 2));
console.log(`\nSaved: ${OUT}`);
await finalizeVerification(ROOT, { primaryFolder: "shop-store-final-review" });
process.exit(report.overall.after === "PASS" ? 0 : 1);
