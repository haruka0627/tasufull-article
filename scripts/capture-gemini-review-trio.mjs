#!/usr/bin/env node
/**
 * Connect / Builder / TALK通知 — Geminiレビュー用実機キャプチャ＋レポート統合
 *   node scripts/capture-gemini-review-trio.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import {
  buildGeminiReview,
  renderGeminiReviewIndex,
  syncGeminiReviewShots,
} from "./lib/gemini-review-trio.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const BATCH = [
  {
    id: "connect-final-review",
    title: "Connect 最終UX",
    script: "capture-connect-final-review.mjs",
  },
  {
    id: "builder-final-review",
    title: "Builder通知・取引チャット 最終UX",
    script: "capture-builder-final-review.mjs",
  },
  {
    id: "talk-notification-final-review",
    title: "TALK通知センター 最終UX",
    script: "capture-talk-notification-final-review.mjs",
  },
];

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`\n>> Running ${scriptName} ...`);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SCREENSHOT_INDEX_NO_OPEN: "1" },
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });
}

const augmentOnly = process.argv.includes("--augment-only");

/** @type {Record<string, object>} */
const geminiReviews = {};

for (const item of BATCH) {
  if (!augmentOnly) {
    await runNodeScript(item.script);
  }

  const folderPath = path.join(root, "screenshots", item.id);
  const reportPath = path.join(folderPath, "report.json");
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing report: ${reportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const { copied } = syncGeminiReviewShots(folderPath, item.id);
  const geminiReview = buildGeminiReview(item.id, report, copied);

  report.geminiReview = geminiReview;
  report.geminiReviewBatch = {
    capturedAt: new Date().toISOString(),
    folder: item.id,
    geminiReviewDir: "gemini-review/",
    viewports: ["390", "1280"],
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(folderPath, "gemini-review", "index.html"),
    renderGeminiReviewIndex(item.title, geminiReview)
  );

  geminiReviews[item.id] = geminiReview;
  console.log(
    `${item.title}: geminiReview ${geminiReview.overall} (FAIL ${geminiReview.failCount}, MINOR ${geminiReview.minorCount})`
  );
}

const batchSummary = {
  generatedAt: new Date().toISOString(),
  folders: BATCH.map((b) => ({
    id: b.id,
    title: b.title,
    overall: geminiReviews[b.id]?.overall,
    productionReady: geminiReviews[b.id]?.productionReady,
    geminiReviewDir: `${b.id}/gemini-review/`,
  })),
};

fs.writeFileSync(
  path.join(root, "screenshots", "gemini-review-trio-summary.json"),
  JSON.stringify(batchSummary, null, 2)
);

const reviewUrl = await finalizeVerification(root, {
  primaryFolder: "connect-final-review",
  openBrowser: false,
});

console.log("\n=== Gemini Review Trio 完了 ===");
for (const row of batchSummary.folders) {
  console.log(`- ${row.title}: ${row.overall} · ${row.productionReady}`);
}
console.log(`Summary: screenshots/gemini-review-trio-summary.json`);
console.log(`Index: ${typeof reviewUrl === "string" ? reviewUrl : reviewUrl?.url || reviewUrl}`);
