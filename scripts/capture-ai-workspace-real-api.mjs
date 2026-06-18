#!/usr/bin/env node
/**
 * 実API検証（ChatGPT / Claude）: 「草刈り業者への問い合わせ文を作って」
 *   node scripts/capture-ai-workspace-real-api.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT = "草刈り業者への問い合わせ文を作って";
const MODE_ID = "cross-matching";
const STORAGE_KEY = `tasu_ai_chat_${MODE_ID}`;
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const MODELS = [
  { id: "gpt", label: "ChatGPT", edge: "openai-chat", file: "chatgpt-real-api.png" },
  { id: "claude", label: "Claude", edge: "claude-chat", file: "claude-real-api.png" },
];

function loadSupabaseConfig() {
  const configPath = join(root, "chat-supabase-config.js");
  return readFile(configPath, "utf8").then((text) => {
    const url = text.match(/url:\s*"(.*?)"/)?.[1] || "";
    const anonKey = text.match(/anonKey:\s*"(.*?)"/)?.[1] || "";
    return { url, anonKey };
  });
}

function startServer(port = 8790) {
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

async function probeEdge({ url, anonKey }, edge, message) {
  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/${edge}`;
  const started = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
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
      edge,
      httpStatus: res.status,
      ok: Boolean(data?.reply),
      error: data?.error || "",
      replyPreview: String(data?.reply || "").slice(0, 280),
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      edge,
      httpStatus: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      replyPreview: "",
      elapsedMs: Date.now() - started,
    };
  }
}

async function preparePage(page, base) {
  await page.goto(`${base}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-ai-model-bar]", { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.TasuAiChat?.sendMessage), undefined, { timeout: 20000 });
  await page.evaluate((storageKey) => {
    window.TasuTgaShell?.setWelcomeVisible?.(false);
    const list = document.querySelector("[data-ai-chat-messages]");
    if (list) list.hidden = false;
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem("tasu_ai_chat_epoch_cross-matching");
  }, STORAGE_KEY);
}

async function selectModel(page, modelId) {
  await page.evaluate((id) => {
    window.TasuAiPlanModels?.setSelectedModelId?.(id);
    window.TasuAiModelSelector?.updateBar?.(document.querySelector("[data-ai-model-bar]"));
  }, modelId);
  await page.waitForSelector(`[data-ai-model-chip="${modelId}"].is-active`, { timeout: 5000 });
}

async function sendPrompt(page, expectedLabel) {
  const userCountBefore = await page.locator(".user-bubble-row").count();
  await page.locator("[data-ai-chat-input]").fill(PROMPT);
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    (before) => document.querySelectorAll(".user-bubble-row").length > before,
    userCountBefore,
    undefined,
    { timeout: 120000 }
  );
  await page.waitForFunction(
    (label) => {
      const badge = document.querySelector(".ai-msg-row:last-child .ai-message__provider-badge");
      return badge && badge.textContent.trim() === label;
    },
    expectedLabel,
    undefined,
    { timeout: 120000 }
  );
  await page.waitForTimeout(800);
}

async function extractLastAssistant(page) {
  return page.evaluate(() => {
    const row = document.querySelector(".ai-msg-row:last-child");
    const badge = row?.querySelector(".ai-message__provider-badge")?.textContent?.trim() || "";
    const text = row?.textContent?.replace(/\s+/g, " ").trim() || "";
    const isApiError = /APIエラー/.test(text);
    return {
      badge,
      text: text.slice(0, 1200),
      isApiError,
      hasCopy: Boolean(row?.querySelector("[data-ai-message-copy]")),
      hasNextActions: Boolean(row?.querySelector(".ai-message-next-actions")),
      hasNextActionsLabel: /次にできること/.test(
        row?.querySelector(".ai-message-next-actions")?.textContent || ""
      ),
      hasContextCta: Boolean(row?.querySelector("[data-ai-context-cta]")),
      contextCtaLabels: [...row.querySelectorAll("[data-ai-context-cta]")].map((el) =>
        el.textContent.trim()
      ),
      hasMarkdownArtifacts: /\*\*|^#{1,6}\s/m.test(
        row?.querySelector(".ai-message")?.innerText || ""
      ),
      domUserName: document.querySelector(".user-info__name")?.textContent?.trim() || "",
      hasNamePlaceholder: /\[あなたの名前\]|\[氏名\]|\[お名前\]/.test(text),
      hasContactPlaceholder: /\[あなたの連絡先\]/.test(text),
      placeholdersOk: (() => {
        const domName = document.querySelector(".user-info__name")?.textContent?.trim() || "";
        const body = (() => {
          const msg = row?.querySelector(".ai-message");
          if (!msg) return "";
          const clone = msg.cloneNode(true);
          clone
            .querySelectorAll(".ai-message__toolbar, .ai-message-next-actions, button")
            .forEach((el) => el.remove());
          return clone.innerText || "";
        })();
        const nameLeft = /\[あなたの名前\]|\[氏名\]|\[お名前\]/.test(body);
        if (domName && nameLeft) return false;
        return true;
      })(),
      modelBarVisible: Boolean(document.querySelector("[data-ai-model-bar]")),
    };
  });
}

async function readStorageState(page) {
  return page.evaluate((storageKey) => {
    let messages = [];
    try {
      messages = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    } catch {
      messages = [];
    }
    return {
      count: messages.length,
      modelLabels: messages
        .filter((m) => m.role === "assistant")
        .map((m) => m.model_label || "")
        .filter(Boolean),
      hasUserPrompt: messages.some(
        (m) => m.role === "user" && String(m.content || "").includes("草刈り")
      ),
    };
  }, STORAGE_KEY);
}

async function readDomState(page) {
  return page.evaluate(() => {
    const badges = [...document.querySelectorAll(".ai-message__provider-badge")].map((el) =>
      el.textContent.trim()
    );
    return {
      userBubbles: document.querySelectorAll(".user-bubble-row").length,
      assistantRows: document.querySelectorAll(".ai-msg-row").length,
      badges,
      activeModel: document.querySelector("[data-ai-model-chip].is-active")?.getAttribute("data-ai-model-chip") || "",
    };
  });
}

function normalizeForCompare(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/【.*?】/g, "")
    .slice(0, 400);
}

async function main() {
  const outDir = join(root, "screenshots", "ai-workspace-multi-ai");
  const reportDir = join(root, "reports");
  await mkdir(outDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const supabase = await loadSupabaseConfig();
  const probes = [];
  for (const model of MODELS) {
    probes.push(await probeEdge(supabase, model.edge, PROMPT));
  }

  const server = await startServer();
  const base = "http://127.0.0.1:8790";
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  const errors = [];
  const checks = {};

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await preparePage(page, base);

    for (const model of MODELS) {
      await selectModel(page, model.id);
      const domBefore = await readDomState(page);
      if (domBefore.activeModel !== model.id) {
        errors.push(`model switch failed before ${model.label}: active=${domBefore.activeModel}`);
      }
      await sendPrompt(page, model.label);
      const assistant = await extractLastAssistant(page);
      await page.screenshot({ path: join(outDir, model.file), fullPage: true });
      captures.push({ model: model.label, modelId: model.id, file: model.file, ...assistant });
      console.log(`saved ${model.file}`);
      if (assistant.isApiError) {
        errors.push(`${model.label}: API error in UI — ${assistant.text.slice(0, 160)}`);
      }
      if (!assistant.hasCopy) {
        errors.push(`${model.label}: copy button missing`);
      }
      if (!assistant.hasNextActions || !assistant.hasNextActionsLabel) {
        errors.push(`${model.label}: 「次にできること」CTA missing`);
      }
      if (
        !assistant.contextCtaLabels?.length ||
        !assistant.contextCtaLabels.some((l) => /TASFUL TALK/.test(l))
      ) {
        errors.push(
          `${model.label}: context CTA missing (${(assistant.contextCtaLabels || []).join(", ") || "none"})`
        );
      }
      if (!assistant.modelBarVisible) {
        errors.push(`${model.label}: model switch bar hidden`);
      }
      if (assistant.hasMarkdownArtifacts) {
        errors.push(`${model.label}: markdown artifacts in reply`);
      }
      if (!assistant.placeholdersOk) {
        errors.push(`${model.label}: name placeholder not replaced (dom=${assistant.domUserName || "—"})`);
      }
      const probe = probes.find((p) => p.edge === model.edge);
      if (!probe?.ok) {
        errors.push(`${model.label}: edge probe failed HTTP ${probe?.httpStatus} ${probe?.error || ""}`);
      }
    }

    const storageAfter = await readStorageState(page);
    checks.historySaved =
      storageAfter.count >= 4 && storageAfter.hasUserPrompt && storageAfter.modelLabels.length >= 2;
    if (!checks.historySaved) {
      errors.push(
        `history not saved (count=${storageAfter.count}, labels=${storageAfter.modelLabels.join(",")})`
      );
    }

    const domBeforeReload = await readDomState(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-ai-chat-messages]", { timeout: 15000 });
    await page.waitForTimeout(1500);

    const storageAfterReload = await readStorageState(page);
    const domAfterReload = await readDomState(page);
    checks.historyPersistsAfterReload =
      storageAfterReload.count >= storageAfter.count &&
      domAfterReload.userBubbles >= domBeforeReload.userBubbles &&
      domAfterReload.badges.includes("ChatGPT") &&
      domAfterReload.badges.includes("Claude");
    if (!checks.historyPersistsAfterReload) {
      errors.push(
        `reload persistence failed (storage=${storageAfterReload.count}, badges=${domAfterReload.badges.join(",")})`
      );
    }

    checks.badgesPresent = domAfterReload.badges.includes("ChatGPT") && domAfterReload.badges.includes("Claude");
    checks.modelSwitch = MODELS.every((m) => domBeforeReload.badges.includes(m.label) || domAfterReload.badges.includes(m.label));

    const texts = captures.map((c) => normalizeForCompare(c.text));
    const uniqueTexts = new Set(texts.filter((t) => t && !captures.find((c) => normalizeForCompare(c.text) === t && c.isApiError)));
    checks.responsesDifferent =
      captures.length === 2 &&
      captures.every((c) => !c.isApiError) &&
      new Set(texts.filter(Boolean)).size === 2;

    const allPassed = errors.length === 0 && Object.values(checks).every(Boolean);

    const report = {
      prompt: PROMPT,
      scope: "ChatGPT + Claude only (Gemini paused)",
      capturedAt: new Date().toISOString(),
      edgeProbes: probes,
      uiCaptures: captures,
      checks,
      storageAfter,
      storageAfterReload,
      domAfterReload,
      errors,
      passed: allPassed,
    };

    await writeFile(join(reportDir, "ai-real-api-verification.json"), JSON.stringify(report, null, 2));

    const answerCtaMd = [
      "# AI Workspace 回答カード CTA 検証",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## プロンプト",
      "",
      `\`${PROMPT}\``,
      "",
      "## 方針",
      "",
      "- 回答直下に **次にできること** CTA（問い合わせ文生成 → TASFUL TALKへ送る）",
      "- 回答カード右上に **コピー**",
      "- Markdown / AI補足の後処理",
      "- プレースホルダーはログイン情報で自動補完（不可時は下書き時に入力）",
      "- **自動送信なし** / モデル切替UIは維持",
      "",
      "## 結果",
      "",
      `- 総合: **${allPassed ? "PASS" : "FAIL"}**`,
      "",
      ...captures.map((c) => {
        return (
          `### ${c.model}\n\n` +
          `- スクショ: \`screenshots/ai-workspace-multi-ai/${c.file}\`\n` +
          `- 応答元バッジ: ${c.badge}\n` +
          `- コピー: ${c.hasCopy}\n` +
          `- 次にできること: ${c.hasNextActions && c.hasNextActionsLabel}\n` +
          `- CTA: ${(c.contextCtaLabels || []).join(" / ") || "—"}\n` +
          `- Markdown残骸なし: ${!c.hasMarkdownArtifacts}\n` +
          `- プレースホルダー（名前）: ${c.placeholdersOk ? "OK" : "要確認"}\n` +
          `- 連絡先プレースホルダー残存: ${c.hasContactPlaceholder ? "あり（下書き時入力可）" : "なし"}\n` +
          `- モデル切替表示: ${c.modelBarVisible}\n`
        );
      }),
      "",
      "## QA Center",
      "",
      "- Viewer: `screenshots-viewer.html?search=ChatGPT`",
      "- Viewer: `screenshots-viewer.html?search=Claude`",
      "- 登録済み: ChatGPT / Claude 実API 各1枚",
      "",
    ].join("\n");

    await writeFile(join(reportDir, "ai-workspace-answer-cta.md"), answerCtaMd);
    console.log("report:", join(reportDir, "ai-workspace-answer-cta.md"));

    const md = [
      "# AI Real API Verification",
      "",
      `Prompt: \`${PROMPT}\``,
      "",
      "Scope: **ChatGPT + Claude**（Gemini 調査は一時停止）",
      "",
      "## Edge probe",
      "",
      ...probes.map(
        (p) =>
          `- **${p.edge}**: HTTP ${p.httpStatus}, ok=${p.ok}` +
          (p.error ? `, error=\`${p.error}\`` : "") +
          (p.replyPreview ? `\n  - preview: ${p.replyPreview.replace(/\n/g, " ").slice(0, 200)}` : "")
      ),
      "",
      "## UI capture",
      "",
      ...captures.map(
        (c) =>
          `- **${c.model}** (\`${c.file}\`): badge=\`${c.badge}\`, apiError=${c.isApiError}\n  - ${c.text.slice(0, 240).replace(/\n/g, " ")}`
      ),
      "",
      "## Checks",
      "",
      `- 実応答: ${checks.responsesDifferent ? "PASS" : "FAIL"}`,
      `- 履歴保存: ${checks.historySaved ? "PASS" : "FAIL"} (sessionStorage ${storageAfter.count}件)`,
      `- 再読込後履歴: ${checks.historyPersistsAfterReload ? "PASS" : "FAIL"}`,
      `- 応答元バッジ: ${checks.badgesPresent ? "PASS" : "FAIL"} (${domAfterReload.badges.join(", ")})`,
      `- モデル切替: ${checks.modelSwitch ? "PASS" : "FAIL"}`,
      "",
      "## Result",
      "",
      allPassed ? "- **PASS**: ChatGPT / Claude 実API検証完了" : `- **FAIL**: ${errors.join("; ") || "検証未完了"}`,
      "",
      "Edge Function ログは Supabase Dashboard → Edge Functions → openai-chat / claude-chat → Logs で確認してください。",
      "",
    ].join("\n");

    await writeFile(join(reportDir, "ai-real-api-verification.md"), md);
    console.log("report:", join(reportDir, "ai-real-api-verification.md"));

    if (!allPassed) {
      console.error("FAILED:", errors.join("; ") || "verification incomplete");
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
