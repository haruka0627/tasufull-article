#!/usr/bin/env node
/**
 * AI Workspace TASFUL内検索 検証スクリーンショット
 *   node scripts/capture-ai-workspace-search.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "ai-workspace-search");
const reportDir = join(root, "reports");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };

const CASES = [
  {
    id: "vendor",
    file: "vendor-search.png",
    prompt: "埼玉で屋根修理業者を探して",
    expectCard: true,
    expectIntent: "service_request",
  },
  {
    id: "vendor-compare",
    file: null,
    prompt: "評価4以上の草刈り業者を比較して",
    expectCard: true,
    expectCompare: true,
  },
  {
    id: "worker",
    file: "worker-search.png",
    prompt: "Connect対応のワーカーを探して",
    expectCard: true,
    expectConnect: true,
  },
  {
    id: "product",
    file: "product-search.png",
    prompt: "近くの商品を探して",
    expectCard: true,
  },
];

function startServer(port = 8793) {
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

async function runCase(page, base, testCase) {
  await page.goto(`${base}/ai-workspace.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("[data-ai-model-bar]", { timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.TasuAiChat?.sendMessage), { timeout: 30000 });
  await page.evaluate(() => {
    window.TasuTgaShell?.setWelcomeVisible?.(false);
    const root = document.querySelector("[data-ai-workspace-chat]");
    window.TasuAiChat?.resetChatSession?.("cross-matching");
    const list = document.querySelector("[data-ai-chat-messages]");
    if (list) {
      list.hidden = false;
      list.innerHTML = "";
    }
    const tasfulInput = document.querySelector('input[data-ai-search-target-input][value="tasful"]');
    if (tasfulInput) {
      tasfulInput.checked = true;
      tasfulInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, "tasful");
  });

  await page.locator("[data-ai-chat-send]").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("[data-ai-chat-input]").fill(testCase.prompt);
  await page.evaluate(() => {
    const root = document.querySelector("[data-ai-workspace-chat]");
    void window.TasuAiChat.sendMessage(root, { searchTarget: "tasful" });
  });
  await page.waitForSelector(".user-bubble-row", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll(".ai-msg-row");
      const row = rows[rows.length - 1];
      return row && (row.querySelector(".ai-cross-card") || /該当する候補|見つかりませんでした/.test(row.textContent || ""));
    },
    { timeout: 120000 }
  );
  await page.waitForTimeout(900);

  const state = await page.evaluate(() => {
    const row = document.querySelector(".ai-msg-row:last-child");
    const text = row?.textContent?.replace(/\s+/g, " ").trim() || "";
    return {
      cardCount: document.querySelectorAll(".ai-cross-card").length,
      hasCompareSummary: Boolean(document.querySelector(".ai-compare-result")),
      hasCriteria: Boolean(document.querySelector(".ai-cross-criteria")),
      hasApiError: /APIエラー/.test(text),
      hasCompareBtn: Boolean(document.querySelector("[data-ai-compare-add]")),
      hasInquiryBtn: Boolean(document.querySelector("[data-ai-inquiry-from-card]")),
      hasNextCtaButtons: document.querySelectorAll(".ai-next-suggestions__btn").length >= 3,
      hasDraftCta: Boolean(document.querySelector("[data-ai-draft-generate]")),
      hasRecommendPick: Boolean(document.querySelector(".ai-compare-recommend")),
      hasDraftAccordion: Boolean(document.querySelector(".ai-cross-draft-panel")),
      hasTestProductLabel: /テスト商品|テスト文言|E2Eテスト/.test(text),
      hasObjectObject: /\[object Object\]/.test(text),
      text: text.slice(0, 800),
    };
  });

  if (testCase.file) {
    await page.screenshot({ path: join(outDir, testCase.file), fullPage: true });
  }

  const passed =
    !state.hasApiError &&
    !state.hasObjectObject &&
    !state.hasDraftAccordion &&
    !state.hasTestProductLabel &&
    state.hasDraftCta &&
    (!testCase.expectCard || state.cardCount > 0) &&
    (!testCase.expectCompare || state.hasCompareSummary || state.cardCount >= 2) &&
    (!testCase.expectCompare || state.hasNextCtaButtons) &&
    (!testCase.expectCompare || state.hasRecommendPick) &&
    (!testCase.expectConnect || /Connect/.test(state.text));

  return { ...testCase, state, passed };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const server = await startServer();
  const base = "http://127.0.0.1:8793";
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    for (const testCase of CASES) {
      const result = await runCase(page, base, testCase);
      results.push(result);
      console.log(testCase.id, result.passed ? "PASS" : "FAIL", testCase.file || "(no shot)");
    }

    const report = {
      capturedAt: new Date().toISOString(),
      note: "TASFUL内検索はAI APIを使用しません（tasu-cross-search）",
      results,
      passed: results.every((r) => r.passed),
    };

    await writeFile(join(reportDir, "ai-workspace-search-integration.json"), JSON.stringify(report, null, 2));

    const md = [
      "# AI Workspace × TASFUL内検索 連携レポート",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## 方針",
      "",
      "- 通常検索: **TASFUL内データ**（`TasuAiCrossSearch` / `TasuAiSearch`）",
      "- AI API使用: **問い合わせ文作成・高度相談のみ**（`TasuAiGenerateUi` / Gateway）",
      "- 共通履歴 / 応答元バッジ / モデル切替 / Gateway構造: **維持**",
      "",
      "## 検証結果",
      "",
      ...results.map((r) => {
        return (
          `### ${r.prompt}\n\n` +
          `- 結果: **${r.passed ? "PASS" : "FAIL"}**\n` +
          `- カード数: ${r.state.cardCount}\n` +
          `- 比較サマリー: ${r.state.hasCompareSummary}\n` +
          `- 検索条件表示: ${r.state.hasCriteria}\n` +
          `- 比較に追加ボタン: ${r.state.hasCompareBtn}\n` +
          `- 問い合わせ文ボタン: ${r.state.hasInquiryBtn}\n` +
          `- [object Object]なし: ${!r.state.hasObjectObject}\n` +
          (r.file ? `- スクショ: \`screenshots/ai-workspace-search/${r.file}\`\n` : "") +
          `\n`
        );
      }),
      "",
      "## 提出スクリーンショット",
      "",
      "- `screenshots/ai-workspace-search/vendor-search.png`",
      "- `screenshots/ai-workspace-search/worker-search.png`",
      "- `screenshots/ai-workspace-search/product-search.png`",
      "",
    ].join("\n");

    await writeFile(join(reportDir, "ai-workspace-search-integration.md"), md);
    console.log("report:", join(reportDir, "ai-workspace-search-integration.md"));

    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
