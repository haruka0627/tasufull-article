/**
 * UI レビュー用 Playwright スクリーンショット — 共通ユーティリティ
 *
 * 保存先: reports/ui-review/{feature}/
 * 命名: {NNN}-{slug}-{viewport}.png  （例: 001-home-1280.png）
 *
 *   import { createUiReviewSession, UI_REVIEW_VIEWPORTS } from "./lib/ui-review-capture.mjs";
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BUILDER_QA_VIEWPORTS } from "./playwright-viewport.mjs";

/** @typedef {{ id: string, width: number, height: number, label: string }} UiReviewViewport */

export const UI_REVIEW_VIEWPORTS = BUILDER_QA_VIEWPORTS;

const DEFAULT_VIEWPORT_IDS = Object.freeze(["1280", "768", "390"]);

/** Repo-root-relative path with `/` separators (for report.json only). */
function toRepoRelativePath(filepath) {
  return relative(process.cwd(), filepath).replaceAll("\\", "/");
}

/**
 * @param {string} featureName
 */
export function uiReviewOutputDir(featureName) {
  const safe = String(featureName || "ui")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return join(process.cwd(), "reports", "ui-review", safe || "ui");
}

/**
 * @param {import('playwright').Page} page
 */
export function attachUiReviewConsole(page) {
  /** @type {string[]} */
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(String(err?.message || err));
  });
  return errors;
}

/**
 * @param {string} featureName
 * @param {{ viewports?: string[], baseUrl?: string }} [opts]
 */
export function createUiReviewSession(featureName, opts = {}) {
  const outDir = uiReviewOutputDir(featureName);
  mkdirSync(outDir, { recursive: true });

  /** @type {number} */
  let stepCounter = 0;

  /** @type {Array<Record<string, unknown>>} */
  const steps = [];

  /** @type {string[]} */
  const allConsoleErrors = [];

  const defaultViewportIds = opts.viewports || DEFAULT_VIEWPORT_IDS;

  const viewportMap = new Map(UI_REVIEW_VIEWPORTS.map((vp) => [vp.id, vp]));

  /**
   * @param {import('playwright').Page} page
   * @param {import('playwright').Browser} browser
   * @param {{
   *   slug: string,
   *   label?: string,
   *   url: string,
   *   viewports?: string[],
   *   prepare?: (page: import('playwright').Page) => Promise<void>,
   *   beforeGoto?: (page: import('playwright').Page) => Promise<void>,
   *   waitFor?: string,
   *   fullPage?: boolean,
   *   skipGoto?: boolean,
   * }} step
   */
  async function captureStep(page, browser, step) {
    stepCounter += 1;
    const stepNum = String(stepCounter).padStart(3, "0");
    const vpIds = step.viewports || defaultViewportIds;
    /** @type {string[]} */
    const files = [];
    /** @type {string[]} */
    const stepErrors = [];

    for (const vpId of vpIds) {
      const vp = viewportMap.get(vpId);
      if (!vp) continue;

      const shotPage =
        vpId === vpIds[0] ? page : await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

      const consoleErrors = attachUiReviewConsole(shotPage);
      stepErrors.push(...consoleErrors);
      allConsoleErrors.push(...consoleErrors);

      if (step.beforeGoto) {
        await step.beforeGoto(shotPage);
      }

      let httpStatus = 0;
      try {
        if (!step.skipGoto) {
          const res = await shotPage.goto(step.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          httpStatus = res?.status() || 0;
        } else {
          httpStatus = 200;
        }
      } catch (err) {
        stepErrors.push(`goto failed (${vpId}): ${String(err?.message || err)}`);
      }

      if (step.waitFor) {
        await shotPage.locator(step.waitFor).waitFor({ state: "visible", timeout: 20000 }).catch(() => null);
      }

      if (step.prepare) {
        await step.prepare(shotPage);
      }

      await shotPage.waitForTimeout(400);

      const filename = `${stepNum}-${step.slug}-${vpId}.png`;
      const filepath = join(outDir, filename);
      await shotPage.screenshot({ path: filepath, fullPage: step.fullPage === true });

      files.push({
        viewport: vpId,
        path: toRepoRelativePath(filepath),
        httpStatus,
        consoleErrors: [...consoleErrors],
      });

      if (shotPage !== page) await shotPage.close();
    }

    const entry = {
      step: stepCounter,
      slug: step.slug,
      label: step.label || step.slug,
      url: step.url,
      files,
      consoleErrorCount: stepErrors.length,
    };
    steps.push(entry);

    console.log(
      `  [ui-review] STEP ${stepNum} ${step.slug} — ${files.length} shot(s) · console errors: ${stepErrors.length}`
    );

    return entry;
  }

  /**
   * @param {{ feature?: string, baseUrl?: string, extra?: Record<string, unknown> }} [meta]
   */
  function writeReport(meta = {}) {
    const uniqueErrors = [...new Set(allConsoleErrors.filter(Boolean))];
    const report = {
      feature: featureName,
      capturedAt: new Date().toISOString(),
      outDir: toRepoRelativePath(outDir),
      stepCount: stepCounter,
      consoleErrorCount: uniqueErrors.length,
      consoleErrors: uniqueErrors,
      steps,
      ...meta,
    };
    const reportPath = join(outDir, "report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\n[ui-review] report: ${reportPath}`);
    console.log(`[ui-review] console errors: ${uniqueErrors.length}`);
    return { report, reportPath, ok: uniqueErrors.length === 0 };
  }

  return {
    outDir,
    captureStep,
    writeReport,
    get consoleErrors() {
      return allConsoleErrors;
    },
  };
}
