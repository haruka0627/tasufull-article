#!/usr/bin/env node
/**
 * マルチAI（Gemini / ChatGPT / Claude）応答確認スクリーンショット
 *   node scripts/capture-ai-workspace-multi-ai.mjs
 */
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
  ".json": "application/json",
};

const MODELS = [
  { id: "gemini-flash", label: "Gemini", file: "gemini-mobile390.png", pcFile: "gemini-pc1280.png" },
  { id: "gpt", label: "ChatGPT", file: "chatgpt-mobile390.png", pcFile: "chatgpt-pc1280.png" },
  { id: "claude", label: "Claude", file: "claude-mobile390.png", pcFile: "claude-pc1280.png" },
];

function startServer(port = 8788) {
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

async function preparePage(page, base) {
  await page.goto(`${base}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-ai-model-bar]", { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.TasuAiChat?.sendMessage), undefined, { timeout: 20000 });
  await page.evaluate(() => {
    window.TasuTgaShell?.setWelcomeVisible?.(false);
    const list = document.querySelector("[data-ai-chat-messages]");
    if (list) list.hidden = false;
    sessionStorage.removeItem("tasu_ai_chat_cross-matching");
  });
  await page.waitForTimeout(500);
}

async function selectModel(page, modelId) {
  await page.evaluate((id) => {
    window.TasuAiPlanModels?.setSelectedModelId?.(id);
    const bar = document.querySelector("[data-ai-model-bar]");
    window.TasuAiModelSelector?.updateBar?.(bar);
  }, modelId);
  await page.waitForSelector(`[data-ai-model-chip="${modelId}"].is-active`, { timeout: 5000 });
}

async function sendGreeting(page, expectedLabel) {
  const userCountBefore = await page.locator(".user-bubble-row").count();
  const input = page.locator("[data-ai-chat-input]");
  await input.fill("こんにちは");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    (before) => document.querySelectorAll(".user-bubble-row").length > before,
    userCountBefore,
    undefined,
    { timeout: 90000 }
  );
  await page.waitForFunction(
    (label) => {
      const badge = document.querySelector(".ai-msg-row:last-child .ai-message__provider-badge");
      return badge && badge.textContent.trim() === label;
    },
    expectedLabel,
    undefined,
    { timeout: 90000 }
  );
  await page.waitForTimeout(400);
}

async function captureViewport(browser, base, outDir, viewport, suffix) {
  const page = await browser.newPage({ viewport });
  await preparePage(page, base);

  for (const model of MODELS) {
    await selectModel(page, model.id);
    await sendGreeting(page, model.label);
    const outFile = suffix === "pc1280" ? model.pcFile : model.file;
    await page.screenshot({ path: join(outDir, outFile), fullPage: true });
    console.log(`saved ${outFile} (${model.label}, ${suffix})`);
  }

  const historyCount = await page.evaluate(() => {
    const raw = sessionStorage.getItem("tasu_ai_chat_cross-matching");
    if (!raw) return 0;
    try {
      return JSON.parse(raw).length;
    } catch {
      return 0;
    }
  });
  await page.close();
  return historyCount;
}

async function main() {
  const server = await startServer();
  const base = "http://127.0.0.1:8788";
  const outDir = join(root, "screenshots", "ai-workspace-multi-ai");
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  try {
    const mobileHistory = await captureViewport(browser, base, outDir, { width: 390, height: 844 }, "mobile390");
    const pcHistory = await captureViewport(browser, base, outDir, { width: 1280, height: 900 }, "pc1280");

    console.log(`shared history (mobile session): ${mobileHistory}`);
    console.log(`shared history (pc session): ${pcHistory}`);
    if (mobileHistory < 6) {
      errors.push(`mobile shared history expected >= 6 messages, got ${mobileHistory}`);
    }
    if (pcHistory < 6) {
      errors.push(`pc shared history expected >= 6 messages, got ${pcHistory}`);
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
  process.exitCode = 1;
});
