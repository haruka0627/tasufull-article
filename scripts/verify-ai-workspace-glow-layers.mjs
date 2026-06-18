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
const outDir = join(root, "screenshots", "ai-workspace-glow-layers");
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
}

for (const [tag, w, h] of [
  ["pc1280", 1280, 900],
  ["mobile390", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });

  await resetSession(page);
  await page.waitForSelector(".welcome-guide-panel", { timeout: 15000 });
  await page.screenshot({ path: join(outDir, `glow-welcome-${tag}.png`) });
  console.log(`OK glow-welcome-${tag}`);

  await page.goto(`${base}/ai-workspace.html?demo=conversation`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ai-cross-card", { timeout: 15000 });
  await page.evaluate(() => {
    const scroller = document.getElementById("chat-scroller");
    if (scroller) scroller.scrollTop = Math.floor(scroller.scrollHeight * 0.22);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `glow-ai-answer-${tag}.png`) });
  const cards = await page.locator(".ai-cross-card").count();
  const rows = await page.locator(".ai-msg-row").count();
  console.log(`OK glow-ai-answer-${tag}`, { cards, rows });
  if (!cards || !rows) fails += 1;

  for (const [kind, query] of [
    ["document", "新規サービス紹介用の提案資料を作って"],
    ["image", "ハウスクリーニング業者の広告画像を作って"],
    ["code", "お問い合わせフォームのHTMLとCSSを作って"],
  ]) {
    await resetSession(page);
    await page.locator("[data-ai-chat-input]").fill(query);
    await page.locator("[data-ai-chat-send]").click();
    await page.waitForSelector(`.ai-generate-panel[data-ai-generate-kind="${kind}"]`, { timeout: 15000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, `generate-${kind}-${tag}.png`) });
    console.log(`OK generate-${kind}-${tag}`);
  }

  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `FAILED ${fails}` : "ALL PASSED");
process.exit(fails ? 1 : 0);
