#!/usr/bin/env node
/**
 * AIワークスペース会話UIの余白確認
 *   node scripts/verify-ai-workspace-chat-spacing.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png" };

function startServer(port = 8779) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
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
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function checkViewport(browser, base, outDir, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}/ai-workspace.html?mode=cross-matching`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ai-chat-messages]", { state: "attached", timeout: 15000 });

  await page.evaluate(() => {
    const list = document.querySelector("[data-ai-chat-messages]");
    const msgs = [
      { role: "user", content: "草刈り業者を探したい" },
      {
        role: "assistant",
        html:
          '<div class="ai-chat__bubble ai-chat__bubble--rich"><p>【TASFUL内の候補】草刈りに対応できる業者候補を整理しました。</p></div>',
      },
      { role: "user", content: "外壁塗装の相場を知りたい" },
      {
        role: "assistant",
        html:
          '<div class="ai-chat__bubble ai-chat__bubble--rich"><p>【外壁塗装の相場（参考）】30坪前後: 80万〜150万円程度</p></div>',
      },
    ];
    list.innerHTML = msgs
      .map((m) => {
        const bubble =
          m.role === "assistant"
            ? m.html
            : `<div class="ai-chat__bubble">${m.content}</div>`;
        return `<div class="ai-chat__msg ai-chat__msg--${m.role}" role="article">${bubble}</div>`;
      })
      .join("");
    document.querySelector(".tga-chat-view")?.removeAttribute("hidden");
    document.querySelector("[data-tga-welcome]")?.setAttribute("hidden", "");
  });

  const gaps = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".tga-chat-view .ai-chat__msg")];
    const rect = (el) => el.getBoundingClientRect();
    const gap = (a, b) => Math.round(rect(b).top - rect(a).bottom);
    return {
      userToAssistant1: gap(nodes[0], nodes[1]),
      assistantToUser: gap(nodes[1], nodes[2]),
      userToAssistant2: gap(nodes[2], nodes[3]),
    };
  });

  await page.locator(".tga-chat-view .ai-chat__messages").screenshot({
    path: join(outDir, `chat-spacing-${name}.png`),
  });
  await page.close();
  return gaps;
}

async function main() {
  const server = await startServer();
  const base = "http://127.0.0.1:8779";
  const outDir = join(root, "screenshots", "ai-workspace-chat-spacing");
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  try {
    for (const [name, w, h] of [
      ["pc1280", 1280, 900],
      ["mobile390", 390, 844],
    ]) {
      const gaps = await checkViewport(browser, base, outDir, name, w, h);
      console.log(
        `${name} (${w}px): user→assistant=${gaps.userToAssistant1}px, turn=${gaps.assistantToUser}px, user→assistant2=${gaps.userToAssistant2}px`
      );
      if (gaps.userToAssistant1 < 20 || gaps.userToAssistant1 > 28) {
        errors.push(`${name}: user→assistant gap ${gaps.userToAssistant1}px not in 20-28`);
      }
      if (gaps.userToAssistant2 < 20 || gaps.userToAssistant2 > 28) {
        errors.push(`${name}: user→assistant2 gap ${gaps.userToAssistant2}px not in 20-28`);
      }
      if (gaps.assistantToUser < 28) {
        errors.push(`${name}: turn gap ${gaps.assistantToUser}px < 28`);
      }
    }

    if (errors.length) {
      console.error("FAILED:", errors.join("; "));
      process.exitCode = 1;
    } else {
      console.log("ALL PASSED");
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
