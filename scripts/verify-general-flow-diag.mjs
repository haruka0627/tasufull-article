#!/usr/bin/env node
/**
 * 一般案件 — 共通フロー診断パネル スモーク E2E
 * （フロー未到達時は notification_missing を正しく出すことも PASS 条件）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedGeneralBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedGeneralBenchUrl(BASE);
const OUT = path.join("screenshots", "general-flow-diag");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const issues = [];

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);

await page.evaluate(() => {
  document.getElementById("benchVerdictFold")?.setAttribute("open", "open");
  window.TasuPlatformChatBenchFlowDiag?.refreshChatFrameDebug?.();
});
await page.waitForTimeout(1500);

const diag = await page.evaluate(() => {
  const v = window.__tasuBenchFlowDiag?.verdict;
  const stages = window.__tasuBenchFlowDiag?.stages;
  const panel = document.getElementById("benchRootCausePanel");
  const text = panel?.textContent || "";
  return {
    verdict: v
      ? {
          category: v.category,
          categoryLabel: v.categoryLabel,
          stage: v.stage,
          finalNg: v.finalNg,
          code: v.code,
          fixFiles: v.fixFiles,
          ok: v.ok,
          aBtn: v.aBtn,
          bBtn: v.bBtn,
        }
      : null,
    hasStages: Boolean(stages?.notification && stages?.cta && stages?.chat && stages?.completion && stages?.review),
    panelHasCommonVerdict: Boolean(panel?.querySelector('[aria-label="共通フロー判定"]')),
    panelHasNotification: text.includes("notification"),
    panelHasCompletion: text.includes("completion"),
    panelHasReview: text.includes("review"),
    configKey: window.TasuPlatformChatCategoryFlowConfig?.resolveConfigKey?.("general"),
  };
});

if (!diag.verdict) issues.push("__tasuBenchFlowDiag.verdict が未生成");
if (diag.verdict?.category !== "general") issues.push(`category should be general: ${diag.verdict?.category}`);
if (diag.configKey !== "general") issues.push(`configKey should be general: ${diag.configKey}`);
if (!diag.panelHasCommonVerdict) issues.push("診断パネルに「共通フロー判定」セクションがない");
if (!diag.hasStages) issues.push("stages (notification/cta/chat/completion/review) が未構築");
if (!diag.panelHasNotification || !diag.panelHasCompletion || !diag.panelHasReview) {
  issues.push("診断パネルに全ステージセクションが表示されていない");
}

// 一般案件 active: A=none, B=完了申請 — B 非表示は未到達なら notification_missing が先に出るのが正常
if (diag.verdict?.aBtn?.expected !== "none") {
  issues.push(`A expectedButton should be none in general active: ${diag.verdict?.aBtn?.expected}`);
}
if (diag.verdict?.bBtn?.expected !== "完了申請する") {
  issues.push(`B expectedButton should be 完了申請する: ${diag.verdict?.bBtn?.expected}`);
}

await page.screenshot({ path: path.join(OUT, "01-general-diag-panel-390.png"), fullPage: false });

const report = { ok: issues.length === 0, issues, url: URL, diag };
console.log(JSON.stringify(report, null, 2));
});
await closeAllBrowsers();
process.exit(issues.length ? 1 : 0);
