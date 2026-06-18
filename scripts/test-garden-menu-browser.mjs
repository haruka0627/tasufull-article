#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };

function startServer(port = 8769) {
  return new Promise((resolve) => {
    createServer(async (req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      try {
        const data = await readFile(join(root, p.replace(/^\//, "")));
        res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    }).listen(port, "127.0.0.1", () => resolve());
  });
}

async function main() {
  await startServer();
  const BASE = "http://127.0.0.1:8769";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const ids = [
    "demo-biz-tasful-garden-1",
    "demo-biz-lawn-1",
    "demo-biz-lawn-2",
    "demo-biz-lawn-3",
  ];
  let failed = 0;
  for (const id of ids) {
    await page.goto(`${BASE}/detail-business-service.html?id=${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () => document.body.dataset.listingLoaded === "true",
      { timeout: 20000 }
    );
    const result = await page.evaluate(() => {
      const rows = document.querySelectorAll("[data-bsd-pricing-tbody] tr");
      return {
        rowCount: rows.length,
        firstRow: rows[0]?.textContent?.trim() || "",
      };
    });
    const ok = result.rowCount >= 5 && /草刈り/.test(result.firstRow);
    console.log(`${ok ? "OK" : "NG"} ${id}: rows=${result.rowCount} first=${result.firstRow.slice(0, 40)}`);
    if (!ok) failed += 1;
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main();
