#!/usr/bin/env node
/**
 * job-0 ベンチ — 550円→承諾通知→B CTA フルフロー E2E（3回連続 PASS 必須）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";
import {
  runBenchJobHireFullFlow,
  resetBenchCategory,
  saveFlowScreenshot,
  HIRED_TITLE,
  BUYER_ID,
} from "./lib/bench-job-hire-e2e.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const OUT = path.join("screenshots", "bench-job-hire-full-flow");
const PASSES_REQUIRED = 3;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await context.newPage();

page.on("dialog", async (d) => {
  await d.accept();
});

const consoleLogs = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[job-hire-flow-diag]") || text.includes("[job-hire-notify]")) {
    consoleLogs.push({ at: new Date().toISOString(), type: msg.type(), text });
  }
});

const report = {
  url: URL,
  passesRequired: PASSES_REQUIRED,
  runs: [],
  ok: false,
};

for (let run = 1; run <= PASSES_REQUIRED; run += 1) {
  const runReport = { run, ok: false, steps: [], failedStep: null, message: null };
  consoleLogs.length = 0;

  try {
    await page.goto(`${URL}&_e2eRun=${run}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    if (run > 1) {
      await resetBenchCategory(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
    }

    const flow = await runBenchJobHireFullFlow(page, { run });
    runReport.steps = flow.steps || [];
    runReport.snapshot = flow.snapshot || null;
    runReport.threadId = flow.threadId || "";
    runReport.ctaMeta = flow.ctaMeta || null;
    runReport.consoleLogs = consoleLogs.slice();

    if (!flow.ok) {
      runReport.failedStep = flow.failedStep || "unknown";
      runReport.message = flow.message || "flow failed";
      runReport.snapshot = flow.snapshot || runReport.snapshot;
      let shot = null;
      try {
        shot = await saveFlowScreenshot(page, OUT, `fail-run${run}-${runReport.failedStep}.png`);
      } catch {
        shot = null;
      }
      runReport.screenshot = shot;
      report.runs.push(runReport);
      break;
    }

    const shot = await saveFlowScreenshot(page, OUT, `pass-run${run}-390.png`);
    runReport.screenshot = shot;
    runReport.ok = true;
    report.runs.push(runReport);
  } catch (err) {
    runReport.failedStep = runReport.failedStep || "exception";
    runReport.message = String(err?.message || err);
    runReport.consoleLogs = consoleLogs.slice();
    try {
      const { collectFlowSnapshot } = await import("./lib/bench-job-hire-e2e.mjs");
      runReport.snapshot = await collectFlowSnapshot(page);
      runReport.screenshot = await saveFlowScreenshot(page, OUT, `fail-run${run}-exception.png`).catch(() => null);
    } catch {
      /* ignore */
    }
    report.runs.push(runReport);
    break;
  }
}

report.ok = report.runs.length === PASSES_REQUIRED && report.runs.every((r) => r.ok);

const summary = {
  ok: report.ok,
  passed: report.runs.filter((r) => r.ok).length,
  required: PASSES_REQUIRED,
  lastFailed: report.runs.find((r) => !r.ok) || null,
};

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify({ ...report, summary }, null, 2));

console.log(JSON.stringify({ summary, runs: report.runs.map((r) => ({
  run: r.run,
  ok: r.ok,
  failedStep: r.failedStep,
  message: r.message,
  threadId: r.threadId,
  storageHired: r.snapshot?.storageHiredCount,
  bCard: r.snapshot?.bNotify?.title,
  screenshot: r.screenshot,
})) }, null, 2));

await browser.close();

if (!report.ok) {
  const fail = report.runs.find((r) => !r.ok);
  console.error(
    `FULL_FLOW_FAIL run=${fail?.run} step=${fail?.failedStep} msg=${fail?.message}`
  );
  if (fail?.snapshot?.feeDiag) {
    console.error("feeDiag:", JSON.stringify(fail.snapshot.feeDiag, null, 2));
  }
  process.exitCode = 1;
} else {
  console.log(`FULL_FLOW_OK (${PASSES_REQUIRED}/${PASSES_REQUIRED} passes)`);
}
