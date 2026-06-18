#!/usr/bin/env node
/**
 * 実機と同じ URL の証拠スクショ（URL情報を画面上に表示してから撮影）
 * 対象: builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion
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

const CAPTURE_META = {
  urlPath: TARGET_PATH,
  thread_id: "thread-demo-001",
  role: "owner",
  from: "talk",
  hash: "completion",
  viewportWidth: 390,
  viewportHeight: 844,
};

function injectEvidenceOverlay() {
  const existing = document.getElementById("playwright-capture-evidence");
  if (existing) existing.remove();

  const params = new URLSearchParams(location.search);
  const lines = [
    "[Playwright capture evidence]",
    `window.location.href = ${location.href}`,
    `location.hash = ${location.hash || "(empty)"}`,
    `thread_id = ${params.get("thread_id") || "(null)"}`,
    `role = ${params.get("role") || "(null)"}`,
    `from = ${params.get("from") || "(null)"}`,
    `viewport = ${window.innerWidth}x${window.innerHeight}`,
    `data-page = ${document.body?.dataset?.page || "(none)"}`,
    `capturedAt = ${new Date().toISOString()}`,
  ];

  const box = document.createElement("div");
  box.id = "playwright-capture-evidence";
  box.setAttribute("data-playwright-capture-evidence", "1");
  box.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "right:0",
    "z-index:99999",
    "margin:0",
    "padding:10px 12px",
    "background:#111827",
    "color:#f9fafb",
    "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    "border-bottom:3px solid #f97316",
    "white-space:pre-wrap",
    "word-break:break-all",
    "box-shadow:0 4px 16px rgba(0,0,0,.35)",
  ].join(";");
  box.textContent = lines.join("\n");
  document.body.prepend(box);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await requireDevServer();
const FULL_URL = logScreenshotUrl("board-thread-completion-evidence-390.png", TARGET_PATH);
console.log(`[dev] BASE_URL=${BASE}`);

console.log("=== Capture metadata (declared) ===");
console.log(JSON.stringify({ ...CAPTURE_META, fullUrl: FULL_URL }, null, 2));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: CAPTURE_META.viewportWidth, height: CAPTURE_META.viewportHeight },
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// 指定 URL を直接開く（カスタムシード・別画面への遷移なし）
await page.goto(FULL_URL, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1200);

const runtime = await page.evaluate(() => {
  const params = new URLSearchParams(location.search);
  return {
    href: location.href,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    thread_id: params.get("thread_id"),
    role: params.get("role"),
    from: params.get("from"),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    dataPage: document.body?.dataset?.page || null,
  };
});

console.log("=== Runtime location (after load) ===");
console.log(JSON.stringify(runtime, null, 2));

await page.evaluate(injectEvidenceOverlay);
await page.waitForTimeout(300);

const out = path.join(OUT_DIR, "board-thread-completion-390-evidence.png");
await page.screenshot({ path: out, fullPage: true });

const overlayVisible = await page.evaluate(() =>
  Boolean(document.querySelector("[data-playwright-capture-evidence]"))
);

console.log("=== Screenshot ===");
console.log("file:", out);
console.log("overlayVisible:", overlayVisible);
console.log("consoleErrors:", errors.length ? errors : "none");

await browser.close();
