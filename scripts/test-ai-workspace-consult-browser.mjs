#!/usr/bin/env node
/**
 * ai-workspace AI相談 smoke test
 *   node scripts/test-ai-workspace-consult-browser.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

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

async function sendConsult(page, text) {
  await page.fill("[data-ai-chat-input]", text);
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    (q) => {
      const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
      const last = msgs[msgs.length - 1];
      return last && last.textContent && last.textContent.length > 20 && !last.textContent.includes("生成中");
    },
    text,
    { timeout: 20000 }
  );
  await page.waitForTimeout(400);
}

async function main() {
  const server = await startServer();
  const BASE = "http://127.0.0.1:8765";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(() => Boolean(window.TasuAiConsultBridge?.runConsultTurn), {
      timeout: 15000,
    });
    await page.waitForSelector("[data-ai-chat-input]", { timeout: 15000 });

    await sendConsult(page, "草刈り業者探したい");
    const grass = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".ai-cross-card"));
      return {
        cards: cards.length,
        titles: cards.map((c) => c.textContent || "").slice(0, 5),
        hasHouseCleaning: cards.some((c) => /ハウスクリーニング|不用品回収|片付け/.test(c.textContent || "")),
        hasLawn: cards.some((c) => /草刈|除草|剪定|庭木|伐採|庭管理/.test(c.textContent || "")),
      };
    });
    if (grass.cards >= 1 && grass.hasLawn && !grass.hasHouseCleaning) {
      pass(`grass search: ${grass.cards} garden-focused card(s)`);
    } else if (grass.hasLawn && !/^1\.\s*TASFULハウスケア/.test(grass.titles[0] || "")) {
      pass(`grass search: lawn vendors shown (${grass.cards} cards)`);
    } else {
      fail(`grass search: lawn missing / cleaning first titles=${grass.titles.join(" | ")}`);
    }
    if (/TASFUL庭まわりサポート|草刈り・庭木剪定/.test(grass.titles.join(" "))) {
      pass("grass search: TASFUL庭まわりサポート included");
    }

    for (const query of ["除草", "剪定", "庭木", "伐採"]) {
      await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector("[data-ai-chat-input]", { timeout: 15000 });
      await sendConsult(page, `${query} 業者を探したい`);
      const result = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".ai-cross-card"));
        return {
          count: cards.length,
          hasLawn: cards.some((c) => /草刈|除草|剪定|庭木|伐採|庭管理|芝生/.test(c.textContent || "")),
          hasHouseCleaning: cards.some((c) => /ハウスクリーニング|不用品回収/.test(c.textContent || "")),
        };
      });
      if (result.hasLawn && !result.hasHouseCleaning) pass(`${query} search: garden vendors prioritized`);
      else if (result.hasLawn) pass(`${query} search: garden vendors included`);
      else fail(`${query} search: expected garden vendors`);
    }

    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-chat-input]", { timeout: 15000 });

    await sendConsult(page, "料金の仕組みを教えて");
    const fee = await page.evaluate(() => ({
      hasFaq:
        document.querySelector("[data-ai-faq-hit]") != null ||
        /手数料|料金|成約/.test(document.querySelector("[data-ai-chat-messages]")?.textContent || ""),
      text: document.querySelector("[data-ai-chat-messages]")?.textContent?.slice(0, 200) || "",
    }));
    if (fee.hasFaq) pass("fee FAQ answer rendered");
    else fail(`fee FAQ missing: ${fee.text}`);

    // state restore after detail navigation
    const mockHtml =
      '<article class="ai-cross-card" data-ai-cross-card><p>候補A</p>' +
      '<a class="ai-cross-cta" href="detail-business.html?id=demo-a">詳細</a></article>' +
      '<article class="ai-cross-card" data-ai-cross-card><p>候補B</p>' +
      '<a class="ai-cross-cta" href="detail-business.html?id=demo-b">詳細</a></article>';
    await page.evaluate((html) => {
      sessionStorage.setItem(
        "tasuAiSearchState",
        JSON.stringify({
          surface: "workspace",
          modeId: "cross-matching",
          input: "草刈り業者探したい",
          outputPlain: "候補",
          outputHtml: html,
          isSearch: true,
          scrollTop: 0,
          returnHref: "/ai-workspace.html?mode=cross-matching",
        })
      );
      sessionStorage.setItem(
        "tasu_ai_chat_cross-matching",
        JSON.stringify([
          { role: "assistant", content: "こんにちは" },
          { role: "user", content: "草刈り業者探したい" },
          {
            role: "assistant",
            content: "候補",
            html,
            search_used: true,
          },
        ])
      );
    }, mockHtml);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".ai-cross-card").length >= 2, {
      timeout: 15000,
    });

    await page.locator('a.ai-cross-cta[href*="demo-a"]').first().click();
    await page.waitForURL(/detail-business/, { timeout: 10000 });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const afterBack = await page.evaluate(() => document.querySelectorAll(".ai-cross-card").length);
    if (afterBack >= 2) pass(`state restore after back: ${afterBack} cards`);
    else fail(`state restore after back cards=${afterBack}`);
  } catch (err) {
    fail(String(err));
  } finally {
    await browser.close();
    server.close();
  }

  if (errors.length) {
    console.error(`\n${errors.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll ai-workspace consult tests passed");
}

main();
