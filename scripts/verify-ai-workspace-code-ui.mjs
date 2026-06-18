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

for (const [tag, w, h] of [
  ["pc1280", 1280, 900],
  ["mobile390", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/ai-workspace.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("tasu_ai_chat_")) sessionStorage.removeItem(key);
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ai-chat-input]").fill("お問い合わせフォームのHTMLとCSSを作って");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForSelector(".ai-generate-panel--code", { timeout: 15000 });
  await page.waitForTimeout(500);

  const blocks = await page.locator(".ai-code-block").count();
  const path = join(outDir, `generate-code-${tag}.png`);
  await page.screenshot({ path, fullPage: false });
  const ok = blocks >= 3;
  console.log(`${tag} generate-code`, ok ? `OK (${blocks} blocks)` : `FAIL`, path);
  if (!ok) fails += 1;
  await page.close();
}

await browser.close();
server.close();
process.exit(fails ? 1 : 0);
