#!/usr/bin/env node
/**
 * fixtures/real-device-localStorage.json を Playwright に注入してスクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "..", "fixtures", "real-device-localStorage.json");
const OUT = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing", "board-thread-completion-390-real-device.png");
const TARGET = "/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion";

if (!fs.existsSync(FIXTURE)) {
  console.error("Missing:", FIXTURE);
  console.error("実機で scripts/export-real-device-localStorage-console.js を Console に貼り付けてエクスポートしてください。");
  await closeAllBrowsers();
  process.exit(1);
}

const imported = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
logScreenshotUrl(path.basename(OUT), TARGET);
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
await page.evaluate((storage) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
}, imported);

await page.goto(`${BASE}${TARGET}`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1500);

const meta = await page.evaluate(() => {
  const params = new URLSearchParams(location.search);
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const t = mvp.threads?.["thread-demo-001"];
  return {
    href: location.href,
    hash: location.hash,
    thread_id: params.get("thread_id"),
    role: params.get("role"),
    from: params.get("from"),
    messageCount: (t?.messages || []).length,
    eventCount: (t?.events || []).length,
    hasCompletion: Boolean(t?.completion_submission),
    completionStatus: t?.completion_submission?.status || null,
    hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
    emptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
    msgComposeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
  };
});

await page.evaluate(() => {
  const params = new URLSearchParams(location.search);
  const box = document.createElement("div");
  box.id = "playwright-capture-evidence";
  box.setAttribute("data-playwright-capture-evidence", "real-device");
  box.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 12px;background:#111827;color:#f9fafb;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;border-bottom:3px solid #22c55e;box-shadow:0 4px 16px rgba(0,0,0,.35)";
  box.textContent = [
    "[REAL DEVICE localStorage import]",
    `window.location.href = ${location.href}`,
    `location.hash = ${location.hash || "(empty)"}`,
    `thread_id = ${params.get("thread_id") || "(null)"}`,
    `role = ${params.get("role") || "(null)"}`,
    `from = ${params.get("from") || "(null)"}`,
    `viewport = ${window.innerWidth}x${window.innerHeight}`,
    `data-page = ${document.body?.dataset?.page || "(none)"}`,
    `fixture = fixtures/real-device-localStorage.json`,
    `capturedAt = ${new Date().toISOString()}`,
  ].join("\n");
  document.body.prepend(box);
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, fullPage: true });
console.log(JSON.stringify(meta, null, 2));
console.log("saved:", OUT);
});
