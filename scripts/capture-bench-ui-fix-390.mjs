#!/usr/bin/env node
/**
 * ベンチ UI 修正確認 — 390px スクショ（ステップタグ・チャットプレビュー・診断）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";
import {
  runBenchJobHireFullFlow,
  saveFlowScreenshot,
  collectFlowSnapshot,
} from "./lib/bench-job-hire-e2e.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const OUT = path.join("screenshots", "bench-ui-fix-390");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 1400 } });
page.on("dialog", async (d) => d.accept());

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

const flow = await runBenchJobHireFullFlow(page);
const snapshot = await collectFlowSnapshot(page);

const stepState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#benchSteps .step-chip, #benchSteps .bench-step-pill")].map((el) => ({
    text: el.textContent?.trim(),
    className: el.className,
  }));
  const chatHeights = ["frame-a-chat", "frame-b-chat"].map((id) => {
    const wrap = document.getElementById(id)?.parentElement;
    const rect = wrap?.getBoundingClientRect?.();
    return { id, height: Math.round(rect?.height || 0) };
  });
  return { chips, chatHeights };
});

await page.evaluate(() => {
  document.getElementById("benchVerdictFold")?.setAttribute("open", "open");
  document.querySelectorAll(".bench-chat-fold").forEach((el) => el.setAttribute("open", "open"));
});

const shot = await saveFlowScreenshot(page, OUT, "bench-ui-fix-390.png");

const report = {
  url: URL,
  flowOk: flow.ok,
  failedStep: flow.failedStep || null,
  stepChips: stepState.chips,
  chatPreviewHeights: stepState.chatHeights,
  storageHired: snapshot.storageHiredCount,
  bNotifyTitle: snapshot.bNotify?.title || "",
  screenshot: shot,
};

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
process.exitCode = flow.ok ? 0 : 1;
