#!/usr/bin/env node
/**
 * 実機と同じ URL で board-thread 完了報告画面を検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing");
const TARGET_URL =
  "/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion";

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
logScreenshotUrl("verify-board-thread-completion", TARGET_URL);
const browser = await chromium.launch({ headless: true });

async function diagnose(label, setupPage) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
  await setupPage(page);

  const builderJsRes = await page.goto(`${BASE}/builder/builder.js`, { waitUntil: "domcontentloaded" });
  const builderJsText = await builderJsRes.text();
  const hasFixMarkers = {
    focusCompletionHide: builderJsText.includes("if (msgBody) msgBody.hidden = focusCompletion"),
    hideEmptyStages: builderJsText.includes("hideEmptyStages"),
    renderBoardThreadCompletionPanel: builderJsText.includes("function renderBoardThreadCompletionPanel"),
    seedEarlyReturn: builderJsText.includes("if (ensureBoardThreadCompletionReviewSeed(api, threadId)) return"),
  };

  await page.goto(`${BASE}${TARGET_URL}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const diag = await page.evaluate(() => {
    const hash = String(location.hash || "").replace(/^#/, "").trim().toLowerCase();
    const params = new URLSearchParams(location.search);
    return {
      href: location.href,
      hash,
      role: params.get("role"),
      from: params.get("from"),
      threadId: params.get("thread_id"),
      completionHostHtml: document.querySelector("[data-builder-thread-completion-host]")?.innerHTML?.trim()?.slice(0, 200) || "",
      hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
      hasSummary: Boolean(document.querySelector(".mvp-thread-completion__summary")),
      emptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
      photosPanelVisible: !document.getElementById("photos")?.hidden,
      reportsPanelVisible: !document.getElementById("files")?.hidden,
      msgBodyVisible: !document.querySelector(".mvp-slack-thread__body")?.hidden,
      msgComposeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
      completionPanelExists: Boolean(document.getElementById("completion")),
      swControlled: Boolean(navigator.serviceWorker?.controller),
    };
  });

  const out = path.join(OUT_DIR, `board-thread-completion-390-${label}.png`);
  await page.screenshot({ path: out, fullPage: true });

  console.log(`\n=== ${label} ===`);
  console.log("builder.js markers:", hasFixMarkers);
  console.log("page diag:", diag);
  console.log("console errors:", errors.length ? errors : "none");
  console.log("screenshot:", out);

  await page.close();
  return { hasFixMarkers, diag, errors };
}

// 1) デフォルト localStorage（実機に近い初回状態）
await diagnose("default-state", async () => {});

// 2) 古い状態: completion なし + siteData 写真あり（灰色枠再現パターン）
await diagnose("stale-no-completion", async (page) => {
  await page.evaluate(() => {
    const key = "tasful:builder:mvp:v1";
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const tid = "thread-demo-001";
    const pid = "demo-project-001";
    if (state.threads?.[tid]) {
      delete state.threads[tid].completion_submission;
      state.threads[tid].status = "in_progress";
      state.threads[tid].siteData = {
        photos: [
          { id: "p1", name: "着工前.jpg", stage: "before", ts: new Date().toISOString() },
        ],
        completed: false,
      };
    }
    const pidx = (state.projects || []).findIndex((p) => p.project_id === pid);
    if (pidx >= 0) {
      state.projects[pidx].selected_partner_ids = ["demo-partner-001"];
    }
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem("tasful:builder:mvp:role", "owner");
  });
});

// 3) Service Worker 登録後（キャッシュ影響）
const swPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await swPage.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "load" });
await swPage.evaluate(async () => {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    await navigator.serviceWorker.ready;
  }
});
await swPage.goto(`${BASE}${TARGET_URL}`, { waitUntil: "domcontentloaded" });
await swPage.waitForTimeout(1500);
const swDiag = await swPage.evaluate(() => ({
  swControlled: Boolean(navigator.serviceWorker?.controller),
  hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
  emptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
  msgComposeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
}));
const swOut = path.join(OUT_DIR, "board-thread-completion-390-sw.png");
await swPage.screenshot({ path: swOut, fullPage: true });
console.log("\n=== service-worker ===");
console.log("diag:", swDiag);
console.log("screenshot:", swOut);
await swPage.close();

await browser.close();
