/**
 * キャプチャ / 検証スクリプト共通 — スクショ保存後の index 更新
 * 必ず screenshots/index.html とフォルダ index.html を再生成する
 */
import { join, relative, sep } from "node:path";
import { writeReviewIndexArtifacts, normalizeReviewReport } from "./review-index-artifacts.mjs";
import { printReviewBanner, reviewIndexUrl, openBrowser } from "./finalize-verification.mjs";

/**
 * @param {string} root リポジトリルート
 * @param {string} dirOrPath OUT_DIR など screenshots/ 配下のパス
 */
export function inferScreenshotFolderId(root, dirOrPath) {
  const screenshotsRoot = join(root, "screenshots");
  const rel = relative(screenshotsRoot, dirOrPath);
  if (!rel || rel.startsWith("..") || rel.includes("..")) {
    throw new Error(`[screenshot-index] path is not under screenshots/: ${dirOrPath}`);
  }
  const folderId = rel.split(sep)[0].split("/")[0];
  if (!folderId) throw new Error(`[screenshot-index] could not infer folder id from ${dirOrPath}`);
  return folderId;
}

/**
 * OUT_DIR から folderId を推定して index を更新
 * @param {string} root
 * @param {string} outDir
 * @param {Parameters<typeof finalizeScreenshotRun>[2]} [opts]
 */
export async function finalizeFromOutDir(root, outDir, opts = {}) {
  const folderId = opts.folderId || inferScreenshotFolderId(root, outDir);
  return finalizeScreenshotRun(root, folderId, { ...opts, folderId });
}

/**
 * @param {string} root リポジトリルート
 * @param {string} folderId screenshots/ 直下フォルダ名
 * @param {{
 *   title?: string,
 *   report?: Record<string, unknown>,
 *   targetPage?: string,
 *   targetPages?: string[],
 *   viewports?: string[],
 *   cases?: Array<Record<string, unknown>>,
 *   pass?: number,
 *   fail?: number,
 *   overall?: string,
 *   primaryFolder?: string,
 *   openBrowser?: boolean,
 *   screenshotCatalog?: Array<{ file: string, label?: string, url?: string, viewport?: string }>,
 * }} [opts]
 */
export async function finalizeScreenshotRun(root, folderId, opts = {}) {
  const generatedAt = new Date().toISOString();
  let report = opts.report ? { ...opts.report } : null;

  if (!report && Array.isArray(opts.cases)) {
    const cases = opts.cases.map((row) => {
      const pass = row.ok !== false && row.pass !== false && row.pass !== "FAIL";
      return {
        caseId: String(row.id || row.caseId || "case"),
        pass,
        label: String(row.message || row.step || row.label || row.id || "check"),
        actual: String(row.actual || row.detail || ""),
        expected: String(row.expected || ""),
      };
    });
    const failCount =
      typeof opts.fail === "number" ? opts.fail : cases.filter((c) => c.pass === false).length;
    const passCount =
      typeof opts.pass === "number" ? opts.pass : cases.filter((c) => c.pass !== false).length;
    const overall =
      opts.overall || (failCount > 0 ? "FAIL" : passCount > 0 ? "PASS" : "PASS");
    report = {
      generatedAt,
      folderId,
      title: opts.title || folderId,
      overall,
      summary: { overall, failCount, passCount, minorCount: 0, total: cases.length },
      cases,
      source: "finalize-screenshot-run",
    };
  }

  if (report) {
    if (opts.title) report.title = opts.title;
    if (opts.targetPage) report.targetPage = opts.targetPage;
    if (opts.targetPages?.length) report.targetPages = opts.targetPages;
    if (opts.viewports?.length) report.viewportsListed = opts.viewports;
    if (opts.screenshotCatalog?.length) report.screenshotCatalog = opts.screenshotCatalog;
    report = normalizeReviewReport(report, { folderId, title: opts.title, generatedAt }) || report;
    report.generatedAt = report.generatedAt || generatedAt;
  }

  const artifacts = await writeReviewIndexArtifacts(root, folderId, {
    title: opts.title,
    report: report || undefined,
    primaryFolder: opts.primaryFolder ?? folderId,
  });

  const reviewUrl = reviewIndexUrl();
  const folderReviewUrl = reviewIndexUrl(`/screenshots/${folderId}/index.html`);
  const hash = `#run-${folderId}`;

  printReviewBanner();
  console.log(`Folder review : ${folderReviewUrl}`);
  console.log(`Latest runs  : ${reviewUrl}${hash}`);

  if (opts.openBrowser === true || process.env.SCREENSHOT_INDEX_OPEN === "1") {
    openBrowser(`${reviewUrl}${hash}`);
  }

  return {
    ...artifacts,
    reviewUrl,
    folderReviewUrl,
    folderId,
  };
}
