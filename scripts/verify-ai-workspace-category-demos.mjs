#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

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

const base = `http://127.0.0.1:${server.address().port}`;
await withPlaywrightBrowser(async (browser) => {let fails = 0;

async function checkDemo(demo, profile, suggestion) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/ai-workspace.html?demo=${demo}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ai-compare-card", { timeout: 15000 });
  const cards = await page.locator(".ai-compare-card").count();
  const profileCount = await page.locator(`.ai-compare-card--${profile}`).count();
  const summary = await page.locator(".ai-compare-result:has-text('整理結果')").count();
  const next = await page.locator(`.ai-next-suggestions:has-text('${suggestion}')`).count();
  const banned = await page.locator("text=おすすめ").count();
  const ok = cards >= 2 && profileCount >= 2 && summary >= 1 && next >= 1 && banned === 0;
  console.log(`demo=${demo}`, ok ? "OK" : "FAIL", { cards, profileCount, summary, next, banned });
  if (!ok) fails += 1;
  await page.close();
}

await checkDemo("worker", "worker", "依頼文を作る");
await checkDemo("job", "job", "応募文を作る");
await checkDemo("product", "product", "比較表を作る");
await checkDemo("conversation", "vendor", "問い合わせ文を作る");

});
server.close();
console.log(fails ? `FAILED ${fails}` : "ALL PASSED");
await closeAllBrowsers();
process.exit(fails ? 1 : 0);
