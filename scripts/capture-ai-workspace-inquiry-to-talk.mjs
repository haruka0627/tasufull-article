#!/usr/bin/env node
/**
 * AI Workspace 問い合わせ文 → TALK下書き 検証
 *   node scripts/capture-ai-workspace-inquiry-to-talk.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import {
  assertQaCenterReady,
  formatPassReportQaSection,
  FLOW_SEARCH,
} from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const QA_SEARCH_KEYWORD = FLOW_SEARCH.find((f) => f.id === "inquiry-to-talk")?.viewerSearch || "問い合わせ";
const outDir = join(root, "screenshots", "ai-workspace-action");
const reportDir = join(root, "reports");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };

const SEARCH_PROMPT = "埼玉で屋根修理業者を探して";

function startServer(port = 8794) {
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

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const server = await startServer();
  const base = "http://127.0.0.1:8794";
  const browser = await chromium.launch({ headless: true });
  const report = {
    capturedAt: new Date().toISOString(),
    steps: [],
    passed: false,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(`${base}/ai-workspace.html`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("[data-ai-model-bar]", { timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.TasuAiChat?.sendMessage), { timeout: 30000 });

    await page.evaluate(() => {
      if (window.TasuAiPlanModels?.setSelectedModelId) {
        window.TasuAiPlanModels.setSelectedModelId("gpt");
      }
      window.TasuAiModelSelector?.updateBar?.(document.querySelector("[data-ai-model-bar]"));
    });
    await page.waitForSelector('[data-ai-model-chip="gpt"].is-active', { timeout: 8000 }).catch(() => {});

    await page.evaluate(() => {
      window.TasuAiChat?.resetChatSession?.("cross-matching");
      const list = document.querySelector("[data-ai-chat-messages]");
      if (list) list.innerHTML = "";
      const tasfulInput = document.querySelector('input[data-ai-search-target-input][value="tasful"]');
      if (tasfulInput) tasfulInput.checked = true;
    });

    await page.locator("[data-ai-chat-input]").fill(SEARCH_PROMPT);
    await page.evaluate(() => {
      const root = document.querySelector("[data-ai-workspace-chat]");
      void window.TasuAiChat.sendMessage(root, { searchTarget: "tasful" });
    });
    await page.waitForSelector(".ai-cross-card", { timeout: 120000 });
    await page.waitForTimeout(600);

    const inquiryBtn = page.locator("[data-ai-inquiry-from-card]").first();
    await inquiryBtn.waitFor({ state: "visible", timeout: 10000 });
    await inquiryBtn.click();

    await page.waitForSelector("[data-ai-inquiry-panel]", { timeout: 120000 });
    await page.waitForFunction(
      () => {
        const panel = document.querySelector("[data-ai-inquiry-panel]");
        const subject = panel?.querySelector("[data-ai-inquiry-subject]")?.textContent?.trim();
        const body = panel?.querySelector("[data-ai-inquiry-body]")?.textContent?.trim();
        return Boolean(subject && body && body.length > 20);
      },
      { timeout: 120000 }
    );
    await page.waitForTimeout(500);

    const inquiryState = await page.evaluate(() => {
      const panel = document.querySelector("[data-ai-inquiry-panel]");
      const badge = document.querySelector(".ai-msg-row:last-child .ai-message__provider-badge");
      return {
        hasSubject: Boolean(panel?.querySelector("[data-ai-inquiry-subject]")?.textContent?.trim()),
        hasBody: Boolean(panel?.querySelector("[data-ai-inquiry-body]")?.textContent?.trim()),
        hasCopy: Boolean(panel?.querySelector("[data-ai-inquiry-copy]")),
        hasTalk: Boolean(panel?.querySelector("[data-ai-inquiry-talk]")),
        hasEdit: Boolean(panel?.querySelector("[data-ai-inquiry-edit]")),
        modelBadge: badge?.textContent?.trim() || "",
        draftId: panel?.getAttribute("data-ai-inquiry-draft-id") || "",
      };
    });

    await page.screenshot({ path: join(outDir, "inquiry-generated.png"), fullPage: true });
    report.steps.push({ id: "inquiry-generated", ...inquiryState, pass: inquiryState.hasSubject && inquiryState.hasBody && inquiryState.hasTalk });

    await page.locator("[data-ai-inquiry-talk]").click();
    await page.waitForURL(/talk-inquiry-draft\.html/, { timeout: 30000 });
    await page.waitForSelector("[data-talk-inquiry-draft-card]", { timeout: 15000 });
    await page.waitForTimeout(400);

    const talkState = await page.evaluate(() => {
      const card = document.querySelector("[data-talk-inquiry-draft-card]");
      return {
        hasCard: Boolean(card),
        hasSubject: Boolean(document.querySelector("[data-talk-draft-subject]")?.value?.trim()),
        hasBody: Boolean(document.querySelector("[data-talk-draft-body]")?.value?.trim()),
        hasEdit: Boolean(document.querySelector("[data-talk-draft-edit]")),
        hasApply: Boolean(document.querySelector("[data-talk-draft-apply]")),
        applyLabel: document.querySelector("[data-talk-draft-apply]")?.textContent?.trim() || "",
        hasBack: Boolean(document.querySelector("[data-talk-draft-back]")),
      };
    });

    await page.screenshot({ path: join(outDir, "talk-draft-card.png"), fullPage: true });
    report.steps.push({
      id: "talk-draft-card",
      ...talkState,
      pass:
        talkState.hasCard &&
        talkState.hasApply &&
        talkState.applyLabel === "チャットへ反映" &&
        !talkState.hasBack,
    });

    const draftBody = await page.evaluate(() => {
      return document.querySelector("[data-talk-draft-body]")?.value?.trim() || "";
    });

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.locator("[data-talk-draft-apply]").click();
    await page.waitForURL(/chat-detail\.html/, { timeout: 60000 });
    await page.waitForFunction(
      () => document.body?.dataset?.chatDetailReady === "true",
      { timeout: 90000 }
    );
    await page.waitForTimeout(800);

    const chatPrefillState = await page.evaluate((expectedBody) => {
      const input = document.getElementById("chatInput");
      const inputValue = String(input?.value || "").trim();
      const banner = document.querySelector("[data-chat-pending-draft-banner]");
      const pending = window.sessionStorage.getItem("pendingDraftMessage");
      const params = new URLSearchParams(location.search);
      const threadId = params.get("thread") || params.get("roomId") || "";
      let messageCount = document.querySelectorAll("#chatMessages .chat-msg").length;
      if (threadId && window.TasuChatThreadStore?.getMessages) {
        messageCount = (window.TasuChatThreadStore.getMessages(threadId) || []).length;
      }
      return {
        hasThread: Boolean(threadId),
        threadId,
        inputPrefilled: inputValue.length > 20,
        inputMatchesDraft: expectedBody.length > 0 && inputValue === expectedBody,
        hasBanner: Boolean(banner && !banner.hidden),
        bannerWarnsNotSent: /まだ送信はされていません/.test(banner?.textContent || ""),
        bannerMentionsSendButton: /送信ボタン/.test(banner?.textContent || ""),
        pendingCleared: !pending,
        messageCount,
        composerEnabled: input ? !input.disabled : false,
      };
    }, draftBody);

    await page.screenshot({ path: join(outDir, "chat-input-prefilled.png"), fullPage: true });
    const prefillPass =
      chatPrefillState.inputPrefilled &&
      chatPrefillState.hasBanner &&
      chatPrefillState.bannerWarnsNotSent &&
      chatPrefillState.bannerMentionsSendButton &&
      chatPrefillState.pendingCleared &&
      chatPrefillState.composerEnabled;
    report.steps.push({
      id: "chat-input-prefilled",
      ...chatPrefillState,
      pass: prefillPass,
    });

    const messageCountBeforeSend = chatPrefillState.messageCount;

    await page.locator("#chatSend").click();
    await page.waitForTimeout(1200);

    const sendState = await page.evaluate((beforeCount) => {
      const params = new URLSearchParams(location.search);
      const threadId = params.get("thread") || params.get("roomId") || "";
      let messageCount = document.querySelectorAll("#chatMessages .chat-msg").length;
      if (threadId && window.TasuChatThreadStore?.getMessages) {
        messageCount = (window.TasuChatThreadStore.getMessages(threadId) || []).length;
      }
      const inputEmpty = !String(document.getElementById("chatInput")?.value || "").trim();
      return {
        messageCountBefore: beforeCount,
        messageCountAfter: messageCount,
        messageSent: messageCount > beforeCount,
        inputCleared: inputEmpty,
      };
    }, messageCountBeforeSend);

    report.steps.push({
      id: "manual-send",
      ...sendState,
      pass: sendState.messageSent && sendState.inputCleared,
    });

    report.stepsPass = report.steps.every((s) => s.pass);
    report.modelBadge = inquiryState.modelBadge;

    const { manifest } = await writeScreenshotsManifest(root);
    const qaSection = formatPassReportQaSection({
      searchKeyword: QA_SEARCH_KEYWORD,
      baseUrl: base,
      manifest,
    });
    const qaGate = assertQaCenterReady(manifest);

    report.qa = {
      searchKeyword: QA_SEARCH_KEYWORD,
      viewerPath: qaSection.viewerPath,
      viewerUrl: qaSection.viewerUrl,
      registeredMatchCount: qaSection.registeredMatchCount,
      registeredTotal: qaSection.registeredTotal,
      unregisteredCount: qaSection.unregisteredCount,
      qaGatePass: qaGate.ok,
    };

    report.passed = report.stepsPass && qaGate.ok;

    const md = [
      "# AI Workspace 問い合わせ文 → TASFUL TALK下書き 連携レポート",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## 方針",
      "",
      "- 検索カード「問い合わせ文を作る」→ ChatGPT / Claude で文案生成（`preferRemote: true`）",
      "- 生成結果: 件名 / 本文 / コピー / TALKで送る / 修正する",
      "- TALK側: 下書きカード表示（**自動送信なし**）",
      "- 通常検索は AI API 不使用（変更なし）",
      "",
      "## 検証フロー",
      "",
      `1. 「${SEARCH_PROMPT}」で検索`,
      "2. 検索カードから「問い合わせ文を作る」",
      "3. 問い合わせ文パネル表示",
      "4. 「TASFUL TALKで送る」",
      "5. TALK下書きカード表示",
      "6. 「チャットへ反映」→ chat-detail 入力欄へ反映（自動送信なし）",
      "7. 入力欄に下書き本文を反映",
      "8. ユーザーが送信ボタンで手動送信",
      "",
      "## 結果",
      "",
      `- 総合: **${report.passed ? "PASS" : "FAIL"}**`,
      `- 応答元バッジ: ${inquiryState.modelBadge || "（なし）"}`,
      "",
      "### 問い合わせ文生成",
      "",
      `- 件名: ${inquiryState.hasSubject}`,
      `- 本文: ${inquiryState.hasBody}`,
      `- コピー: ${inquiryState.hasCopy}`,
      `- TALKで送る: ${inquiryState.hasTalk}`,
      `- 修正する: ${inquiryState.hasEdit}`,
      `- スクショ: \`screenshots/ai-workspace-action/inquiry-generated.png\``,
      "",
      "### TALK下書きカード",
      "",
      `- カード: ${talkState.hasCard}`,
      `- 編集する: ${talkState.hasEdit}`,
      `- チャットへ反映: ${talkState.hasApply}（${talkState.applyLabel || "—"}）`,
      `- 下部戻るなし: ${!talkState.hasBack}`,
      `- スクショ: \`screenshots/ai-workspace-action/talk-draft-card.png\``,
      "",
      "### chat-detail 入力欄反映",
      "",
      `- スレッド解決: ${chatPrefillState.hasThread}`,
      `- 入力欄反映: ${chatPrefillState.inputPrefilled}`,
      `- 下書き一致: ${chatPrefillState.inputMatchesDraft}`,
      `- 案内バナー: ${chatPrefillState.hasBanner}`,
      `- 未送信の明示: ${chatPrefillState.bannerWarnsNotSent}`,
      `- 送信ボタン案内: ${chatPrefillState.bannerMentionsSendButton}`,
      `- pendingDraftMessage 削除: ${chatPrefillState.pendingCleared}`,
      `- 自動送信なし（反映時メッセージ数）: ${chatPrefillState.messageCount}`,
      `- スクショ: \`screenshots/ai-workspace-action/chat-input-prefilled.png\``,
      "",
      "### 手動送信",
      "",
      `- 送信前: ${sendState.messageCountBefore} 件`,
      `- 送信後: ${sendState.messageCountAfter} 件`,
      `- 送信成功: ${sendState.messageSent}`,
      `- 入力欄クリア: ${sendState.inputCleared}`,
      "",
      qaSection.markdown,
      qaGate.ok
        ? ""
        : `### QA ゲート\n\n- **FAIL**: ${qaGate.message}\n`,
    ].join("\n");

    await writeFile(join(reportDir, "ai-workspace-inquiry-to-talk.md"), md);
    await writeFile(join(reportDir, "ai-workspace-inquiry-to-talk.json"), JSON.stringify(report, null, 2));

    for (const step of report.steps) {
      console.log(step.id, step.pass ? "PASS" : "FAIL");
    }
    for (const line of qaSection.consoleLines) {
      console.log(line);
    }
    if (!qaGate.ok) {
      console.log("QA GATE FAIL:", qaGate.message);
    }
    console.log("report:", join(reportDir, "ai-workspace-inquiry-to-talk.md"));

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
