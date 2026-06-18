#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI検索結果の sessionStorage 復元 smoke test
 *   node scripts/test-ai-search-state-browser.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";


const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startServer(port = 8765) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      if (p === "/") p = "/talk-home.html";
      try {
        const file = join(root, p.replace(/^\//, ""));
        const data = await readFile(file);
        res.writeHead(200, {
          "Content-Type": MIME[extname(file)] || "application/octet-stream",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const mockHtml =
  '<div class="ai-cross-results">' +
  '<article class="ai-cross-card" data-ai-cross-card>' +
  '<p class="ai-cross-card__rank">1. <strong>候補A</strong></p>' +
  '<div class="ai-cross-card__ctas"><a class="ai-cross-cta" href="detail-business.html?id=demo-a">詳細を見る</a></div>' +
  "</article>" +
  '<article class="ai-cross-card" data-ai-cross-card>' +
  '<p class="ai-cross-card__rank">2. <strong>候補B</strong></p>' +
  '<div class="ai-cross-card__ctas"><a class="ai-cross-cta" href="detail-business.html?id=demo-b">詳細を見る</a></div>' +
  "</article></div>";

async function main() {
  const server = await startServer();
  const BASE = "http://127.0.0.1:8765";
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=ai`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(() => Boolean(window.TasuAiSearchState?.read), {
      timeout: 15000,
    });

    await page.evaluate((html) => {
      sessionStorage.setItem(
        "tasuAiSearchState",
        JSON.stringify({
          surface: "talk",
          modeId: "qa",
          input: "草刈り 業者",
          outputPlain: "候補です",
          outputHtml: html,
          isSearch: true,
          scrollTop: 0,
          returnHref: "/talk-home.html?tab=ai",
        })
      );
    }, mockHtml);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelectorAll(".ai-cross-card").length >= 2,
      { timeout: 15000 }
    );

    const afterReload = await page.evaluate(() => ({
      cards: document.querySelectorAll(".ai-cross-card").length,
      input: document.querySelector("[data-talk-ai-input]")?.value || "",
      composerVisible: !document.querySelector("[data-talk-ai-composer]")?.hidden,
      resultVisible: !document.querySelector("[data-talk-ai-result]")?.hidden,
    }));

    if (afterReload.cards >= 2) pass(`reload restore: ${afterReload.cards} cards`);
    else fail(`reload restore cards=${afterReload.cards}`);
    if (afterReload.input.includes("草刈り")) pass("reload restore: input preserved");
    else fail(`reload restore input=${afterReload.input}`);
    if (afterReload.composerVisible && afterReload.resultVisible) {
      pass("reload restore: composer+result visible");
    } else {
      fail(
        `reload restore UI composer=${afterReload.composerVisible} result=${afterReload.resultVisible}`
      );
    }

    const link1 = page.locator('a.ai-cross-cta[href*="demo-a"]');
    if (await link1.count()) {
      await link1.first().click();
      await page.waitForURL(/detail-business/, { timeout: 10000 });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const afterBack1 = await page.evaluate(
        () => document.querySelectorAll(".ai-cross-card").length
      );
      if (afterBack1 >= 2) pass(`back from candidate1: ${afterBack1} cards`);
      else fail(`back from candidate1 cards=${afterBack1}`);
    } else {
      fail("candidate1 link missing");
    }

    const link2 = page.locator('a.ai-cross-cta[href*="demo-b"]');
    if (await link2.count()) {
      await link2.first().click();
      await page.waitForURL(/detail-business/, { timeout: 10000 });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const afterBack2 = await page.evaluate(
        () => document.querySelectorAll(".ai-cross-card").length
      );
      if (afterBack2 >= 2) pass(`back from candidate2: ${afterBack2} cards`);
      else fail(`back from candidate2 cards=${afterBack2}`);
    } else {
      fail("candidate2 link missing");
    }
  } catch (err) {
    fail(String(err));
  }  });
  server.close();

  if (errors.length) {
    console.error(`\n${errors.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll AI search state tests passed");
}

main();
