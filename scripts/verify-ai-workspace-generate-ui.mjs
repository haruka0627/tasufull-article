#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
    try {
      const file = join(root, p.replace(/^\//, ""));
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const outDir = join(root, "screenshots", "ai-workspace-generate-ui");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
let fails = 0;

async function resetSession(page) {
  await page.goto(`${base}/ai-workspace.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("tasu_ai_chat_")) sessionStorage.removeItem(key);
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-ai-chat-input]", { timeout: 15000 });
}

async function captureGenerate(page, kind, query, tag) {
  await resetSession(page);
  await page.locator("[data-ai-chat-input]").fill(query);
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForSelector(`.ai-generate-panel[data-ai-generate-kind="${kind}"]`, { timeout: 15000 });
  await page.waitForTimeout(400);
  const path = join(outDir, `generate-${kind}-${tag}.png`);
  await page.screenshot({ path, fullPage: false });
  const count = await page.locator(`.ai-generate-panel[data-ai-generate-kind="${kind}"]`).count();
  console.log(`${tag} generate-${kind}`, count === 1 ? "OK" : "FAIL", path);
  if (count !== 1) fails += 1;
  return count === 1;
}

async function captureConversation(page, tag) {
  await page.goto(`${base}/ai-workspace.html?demo=conversation`, { waitUntil: "networkidle" });
  await page.waitForSelector(".user-bubble-row", { timeout: 15000 });
  await page.waitForSelector(".ai-search-summary", { timeout: 15000 });
  await page.evaluate(() => {
    const scroller = document.getElementById("chat-scroller");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(500);
  const userCount = await page.locator(".user-bubble-row").count();
  const hasWorkDate = await page.locator(".ai-search-summary:has-text('作業日確定')").count();
  const hasCompare = await page.locator(".ai-compare-result:has-text('整理結果')").count();
  const hasCompletion = await page.locator(".ai-completion-summary:has-text('TASFUL AIが支援した内容')").count();
  const path = join(outDir, `conversation-history-${tag}.png`);
  await page.screenshot({ path, fullPage: false });
  const ok = userCount >= 13 && hasWorkDate >= 1 && hasCompare >= 1 && hasCompletion >= 1;
  console.log(`${tag} conversation-history`, ok ? `OK (${userCount} turns)` : `FAIL (${userCount})`, path);
  if (!ok) fails += 1;
  return ok;
}

for (const [tag, w, h] of [
  ["pc1280", 1280, 900],
  ["mobile390", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });

  await captureGenerate(page, "image", "ハウスクリーニング業者の広告画像を作って", tag);
  const broken = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll(".ai-generate-panel--image .ai-image-preview__demo")];
    return imgs.filter((img) => img.complete && img.naturalWidth === 0).length;
  });
  const demoCount = await page.locator(".ai-generate-panel--image .ai-image-demo-card").count();
  const resultImgs = await page.locator("[data-ai-image-result]").count();
  if (broken > 0 || resultImgs > 0 || demoCount !== 3) {
    console.log(`${tag} generate-image broken-check FAIL`, { broken, resultImgs, demoCount });
    fails += 1;
  } else {
    console.log(`${tag} generate-image broken-check OK`);
  }

  await captureGenerate(page, "code", "お問い合わせフォームのHTMLとCSSを作って", tag);
  await captureConversation(page, tag);
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `FAILED ${fails}` : "ALL PASSED");
if (fails === 0) {
  const { spawn } = await import("node:child_process");
  spawn(process.execPath, [join(root, "scripts/open-latest-screenshots.mjs")], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  }).unref();
}
process.exit(fails ? 1 : 0);
