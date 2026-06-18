#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };

function startServer(port = 8766) {
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
  const BASE = "http://127.0.0.1:8766";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  }

  await check("AI detail breadcrumb/back", async () => {
    await page.goto(
      `${BASE}/detail-business-service.html?id=demo-biz-cleaning-1&from=ai&returnTo=ai-workspace.html%3Fmode%3Dcross-matching&q=草刈り`,
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await page.waitForFunction(
      () => Boolean(document.querySelector("[data-biz-detail-breadcrumb] a")),
      { timeout: 15000 }
    );
    const nav = await page.evaluate(() => ({
      bc: document.querySelector("[data-biz-detail-breadcrumb]")?.innerHTML || "",
      back: document.querySelector("[data-biz-detail-back]")?.textContent || "",
      backHref: document.querySelector("[data-biz-detail-back]")?.getAttribute("href") || "",
    }));
    if (!/TASFUL AI/.test(nav.bc)) throw new Error("breadcrumb missing TASFUL AI");
    if (!/検索結果/.test(nav.bc)) throw new Error("breadcrumb missing 検索結果");
    if (!/AI検索結果に戻る/.test(nav.back)) throw new Error(`back label: ${nav.back}`);
    if (!/ai-workspace\.html/.test(nav.backHref)) throw new Error(`back href: ${nav.backHref}`);
  });

  await check("List detail breadcrumb/back", async () => {
    await page.goto(
      `${BASE}/detail-business-service.html?id=demo-biz-cleaning-1&from=list&returnTo=business.html`,
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await page.waitForFunction(
      () => Boolean(document.querySelector("[data-biz-detail-breadcrumb] a")),
      { timeout: 15000 }
    );
    const nav = await page.evaluate(() => ({
      bc: document.querySelector("[data-biz-detail-breadcrumb]")?.innerHTML || "",
      back: document.querySelector("[data-biz-detail-back]")?.textContent || "",
      backHref: document.querySelector("[data-biz-detail-back]")?.getAttribute("href") || "",
    }));
    if (!/法人・業者一覧/.test(nav.bc)) throw new Error("breadcrumb missing list");
    if (!/法人・業者一覧に戻る/.test(nav.back)) throw new Error(`back label: ${nav.back}`);
    if (nav.backHref !== "business.html") throw new Error(`back href: ${nav.backHref}`);
  });

  await check("AI card detail link params", async () => {
    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-chat-input]", { timeout: 15000 });
    await page.fill("[data-ai-chat-input]", "草刈り業者探したい");
    await page.click("[data-ai-chat-send]");
    await page.waitForSelector(".ai-cross-card a.ai-cross-cta", { timeout: 20000 });
    const href = await page.locator(".ai-cross-card a.ai-cross-cta").first().getAttribute("href");
    if (!/[?&]from=ai/.test(href || "")) throw new Error(`missing from=ai: ${href}`);
    if (!/[?&]returnTo=/.test(href || "")) throw new Error(`missing returnTo: ${href}`);
  });

  await browser.close();
  if (errors.length) {
    console.error(`\n${errors.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll detail nav tests passed");
}

main();
