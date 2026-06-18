#!/usr/bin/env node
/**
 * 指定 URL で board-thread 完了報告画面を 390px キャプチャ
 * builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing");
const TARGET_PATH =
  "/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion";

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
logScreenshotUrl("board-thread-completion-390.png", TARGET_PATH);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// Service Worker 登録（実機と同条件）
await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "load" });
await page.evaluate(async () => {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    await navigator.serviceWorker.ready;
  }
});

// 実機と同じ URL（カスタムシードなし）
await page.goto(`${BASE}${TARGET_PATH}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.getElementById("completion")?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(400);

const meta = await page.evaluate(() => {
  const script = [...document.querySelectorAll("script[src]")].find((s) =>
    String(s.src).includes("builder.js")
  );
  return {
    href: location.href,
    hash: String(location.hash || "").replace(/^#/, ""),
    role: new URLSearchParams(location.search).get("role"),
    from: new URLSearchParams(location.search).get("from"),
    builderScriptSrc: script?.getAttribute("src") || "",
    hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
    hasSummary: Boolean(document.querySelector(".mvp-thread-completion__summary")),
    hasCompletionPhotos: document.body.textContent.includes("完了写真"),
    hasInvoice: document.body.textContent.includes("請求書"),
    emptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
    photosPanelVisible: !document.getElementById("photos")?.hidden,
    reportsPanelVisible: !document.getElementById("files")?.hidden,
    msgBodyVisible: !document.querySelector(".mvp-slack-thread__body")?.hidden,
    msgComposeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
    swControlled: Boolean(navigator.serviceWorker?.controller),
  };
});

const out = path.join(OUT_DIR, "board-thread-completion-390.png");
await page.screenshot({ path: out, fullPage: true });
console.log("URL:", `${BASE}${TARGET_PATH}`);
console.log("meta:", meta);
console.log("errors:", errors.length ? errors : "none");
console.log("saved:", out);

await browser.close();

if (
  meta.emptySiteGroups > 0 ||
  meta.msgComposeVisible ||
  meta.msgBodyVisible ||
  !meta.hasApprove ||
  !meta.hasSummary
) {
  process.exit(1);
}
