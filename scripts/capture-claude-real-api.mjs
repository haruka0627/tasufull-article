#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * Claude 実API検証のみ
 *   node scripts/capture-claude-real-api.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";


const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT = "草刈り業者への問い合わせ文を作って";
const MODE_ID = "cross-matching";
const STORAGE_KEY = `tasu_ai_chat_${MODE_ID}`;
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

async function loadSupabase() {
  const text = await readFile(join(root, "chat-supabase-config.js"), "utf8");
  return {
    url: text.match(/url:\s*"(.*?)"/)?.[1] || "",
    anonKey: text.match(/anonKey:\s*"(.*?)"/)?.[1] || "",
  };
}

function startServer(port = 8792) {
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

async function probeEdge(supabase) {
  const endpoint = `${supabase.url.replace(/\/$/, "")}/functions/v1/claude-chat`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabase.anonKey}`,
      apikey: supabase.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: PROMPT,
      history: [],
      mode: MODE_ID,
      intent: "work",
      systemPrompt:
        "あなたはTASFULのAIアシスタントです。ユーザー依頼に沿って問い合わせ文を日本語で作成してください。",
    }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json().catch(() => ({}));
  return {
    httpStatus: res.status,
    ok: Boolean(data?.reply),
    error: data?.error || "",
    reply: String(data?.reply || ""),
    model: data?.model || "",
    usedClaude: data?.usedClaude,
  };
}

async function main() {
  const outDir = join(root, "screenshots", "ai-workspace-multi-ai");
  const reportDir = join(root, "reports");
  await mkdir(outDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const supabase = await loadSupabase();
  const probe = await probeEdge(supabase);
  console.log("Edge probe HTTP", probe.httpStatus, "ok=", probe.ok);
  if (probe.reply) console.log("Reply preview:", probe.reply.slice(0, 200));

  const server = await startServer();
  const base = "http://127.0.0.1:8792";
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(`${base}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-ai-model-bar]", { timeout: 15000 });
    await page.waitForFunction(() => Boolean(window.TasuAiChat?.sendMessage), undefined, { timeout: 20000 });
    await page.evaluate((storageKey) => {
      window.TasuTgaShell?.setWelcomeVisible?.(false);
      const list = document.querySelector("[data-ai-chat-messages]");
      if (list) list.hidden = false;
      sessionStorage.removeItem(storageKey);
    }, STORAGE_KEY);

    await page.evaluate(() => {
      window.TasuAiPlanModels?.setSelectedModelId?.("claude");
      window.TasuAiModelSelector?.updateBar?.(document.querySelector("[data-ai-model-bar]"));
    });
    await page.waitForSelector('[data-ai-model-chip="claude"].is-active', { timeout: 5000 });

    const userBefore = await page.locator(".user-bubble-row").count();
    await page.locator("[data-ai-chat-input]").fill(PROMPT);
    await page.locator("[data-ai-chat-send]").click();
    await page.waitForFunction(
      (before) => document.querySelectorAll(".user-bubble-row").length > before,
      userBefore,
      undefined,
      { timeout: 120000 }
    );
    await page.waitForFunction(
      () => {
        const badge = document.querySelector(".ai-msg-row:last-child .ai-message__provider-badge");
        return badge && badge.textContent.trim() === "Claude";
      },
      undefined,
      { timeout: 120000 }
    );
    await page.waitForTimeout(800);

    const ui = await page.evaluate(() => {
      const row = document.querySelector(".ai-msg-row:last-child");
      const badge = row?.querySelector(".ai-message__provider-badge")?.textContent?.trim() || "";
      const text = row?.textContent?.replace(/\s+/g, " ").trim() || "";
      return { badge, text: text.slice(0, 1500), isApiError: /APIエラー/.test(text) };
    });

    const shot = join(outDir, "claude-real-api.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log("saved", shot);

    const report = {
      capturedAt: new Date().toISOString(),
      prompt: PROMPT,
      edgeProbe: probe,
      uiCapture: ui,
      screenshot: "screenshots/ai-workspace-multi-ai/claude-real-api.png",
      passed: probe.ok && !ui.isApiError && ui.badge === "Claude",
    };

    await writeFile(join(reportDir, "claude-real-api-verification.json"), JSON.stringify(report, null, 2));

    if (!report.passed) {
      console.error("FAILED", report);
      process.exitCode = 1;
    } else {
      console.log("PASSED");
    }
    });
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
