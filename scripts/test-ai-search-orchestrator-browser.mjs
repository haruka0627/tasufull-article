#!/usr/bin/env node
/**
 * TASFUL AI 共通検索レイヤー E2E（意図判定・オーケストレータ・ログ・UIバッジ）
 *
 *   node scripts/test-ai-search-orchestrator-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-ai-search-orchestrator-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const MOCK_SERPER = {
  ok: true,
  query: "mock",
  results: [
    {
      title: "モック: 水漏れ修理の相場ガイド",
      snippet: "一般的な水漏れ修理の費用目安は部位により異なります。",
      link: "https://example.com/mock-market-price",
    },
  ],
};

const INTENT_CASES = [
  { input: "こんにちは", needed: false },
  { input: "今日のニュースは？", needed: true },
  { input: "2+2", needed: false },
  { input: "補助金を調べて", needed: true },
  { input: "https://example.com の内容は？", needed: true },
];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function sendChat(page, message) {
  const input = page.locator("[data-ai-chat-input]");
  await input.waitFor({ state: "visible", timeout: 10000 });
  const countsBefore = await page.evaluate(() => ({
    users: document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--user").length,
    assistants: document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant")
      .length,
  }));
  await input.fill(message);
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    ({ uc, ac }) => {
      const users = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--user");
      if (users.length <= uc) return false;
      const assistants = document.querySelectorAll(
        "[data-ai-chat-messages] .ai-chat__msg--assistant"
      );
      return assistants.length > ac;
    },
    { uc: countsBefore.users, ac: countsBefore.assistants },
    { timeout: 25000 }
  );
}

async function setupPage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.addInitScript((mock) => {
    window.__TASU_SERPER_MOCK_RESPONSE__ = mock;
  }, MOCK_SERPER);

  await page.route("**/functions/v1/serper-search**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
      return;
    }
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ...MOCK_SERPER, query: body.query || MOCK_SERPER.query }),
    });
  });

  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("[data-ai-chat-input]", { timeout: 10000 });
  await page.waitForFunction(
    () =>
      window.TasuSearchIntentDetector &&
      window.TasuSerperSearchService &&
      window.TasuAiSearchOrchestrator &&
      window.TasuAiInteractionLog &&
      window.TasuAiPlanModels &&
      window.TasuAiModelGateway
  );

  return { page, errors };
}

async function testGlobals(page) {
  console.log("\n--- globals loaded ---");
  const ok = await page.evaluate(
    () =>
      Boolean(
        window.TasuSearchIntentDetector?.detectSearchIntent &&
          window.TasuSerperSearchService?.search &&
          window.TasuAiSearchOrchestrator?.prepare &&
          window.TasuAiInteractionLog?.appendInteractionLog
      )
  );
  if (ok) pass("search modules on window");
  else fail("search modules on window");
}

async function testIntentDetector(page) {
  console.log("\n--- intent detector ---");
  for (const { input, needed } of INTENT_CASES) {
    const got = await page.evaluate(
      (text) => window.TasuSearchIntentDetector.detectSearchIntent(text, { modeId: "cross-matching" }),
      input
    );
    if (Boolean(got?.needed) !== needed) {
      fail(`intent ${input}`, `expected ${needed}, got ${got?.needed} (${got?.reason})`);
    } else {
      pass(`intent ${needed ? "search" : "skip"}`, input);
    }
  }
}

async function testOrchestratorPrepare(page) {
  console.log("\n--- orchestrator prepare ---");
  const prep = await page.evaluate(async () => {
    const out = await window.TasuAiSearchOrchestrator.prepare({
      userText: "水漏れ修理の相場はいくら？",
      modeId: "cross-matching",
      skipLog: true,
    });
    return {
      searchUsed: out.searchUsed,
      resultCount: out.searchResultCount,
      hasContext: Boolean(out.contextForAi),
    };
  });
  if (!prep.searchUsed) fail("prepare searchUsed");
  else pass("prepare searchUsed");
  if (prep.resultCount < 1) fail("prepare result count");
  else pass("prepare results", String(prep.resultCount));
  if (!prep.hasContext) fail("prepare contextForAi");
  else pass("prepare contextForAi");
}

async function testChatBadge(page) {
  console.log("\n--- chat UI badge ---");
  await page.evaluate(() => localStorage.removeItem("tasu_ai_interaction_logs_v1"));
  await sendChat(page, "水漏れ修理の相場はいくら？");
  const html = await page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last ? last.innerHTML : "";
  });
  if (html.includes("ai-search-used-badge")) fail("legacy web search badge should not appear");
  else pass("no legacy web search badge");
  if (html.includes("Web検索を利用しました")) fail("legacy web badge text should not appear");
  else pass("no legacy web badge text");
  if (html.includes("ai-web-results")) fail("chat should not use legacy web-only block");
  else pass("chat no legacy web-only block");

  const log = await page.evaluate(() => window.TasuAiInteractionLog.readLogs()[0]);
  if (!log?.search_used) fail("chat log search_used");
  else pass("chat log search_used");
  if (!log?.selected_model) fail("chat log selected_model");
  else pass("chat log selected_model", log.selected_model);
  if (!log?.user_plan) fail("chat log user_plan");
  else pass("chat log user_plan", log.user_plan);
}

async function testCasualNoBadge(page) {
  console.log("\n--- casual chat no badge ---");
  await sendChat(page, "こんにちは");
  const html = await page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last ? last.innerHTML : "";
  });
  if (html.includes("ai-search-used-badge")) fail("casual should not show badge");
  else pass("casual no badge");
}

async function applyPlan(page, plan) {
  await page.evaluate((p) => {
    window.TasuAiPlanModels?.setPlanOverrideForBeta?.(p);
    const bar = document.querySelector("[data-ai-model-bar]");
    if (bar) window.TasuAiModelSelector?.updateBar?.(bar);
  }, plan);
}

async function testPlanSelector(page) {
  console.log("\n--- plan selector ---");
  await applyPlan(page, "free");
  let opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-ai-model-select] option")).map((o) => ({
      value: o.value,
      disabled: o.disabled,
    }))
  );
  if (!opts.some((o) => o.value === "gemini-flash" && !o.disabled)) fail("free gemini");
  else pass("free gemini");
  if (opts.filter((o) => !o.disabled).length !== 1) fail("free option count");
  else pass("free option count");

  await applyPlan(page, "light");
  opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-ai-model-select] option")).map((o) => ({
      text: o.textContent,
      disabled: o.disabled,
    }))
  );
  if (!opts.some((o) => o.text.includes("GPT") && o.disabled)) fail("light gpt disabled");
  else pass("light gpt disabled");

  await applyPlan(page, "standard");
  const enabled = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-ai-model-select] option"))
      .filter((o) => !o.disabled)
      .map((o) => o.value)
  );
  for (const id of ["gemini-flash", "gpt", "claude"]) {
    if (!enabled.includes(id)) fail(`standard ${id}`);
    else pass(`standard ${id}`);
  }

  await applyPlan(page, "premium");
  const grokDisabled = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-ai-model-select] option")).some(
      (o) => o.textContent.includes("Grok") && o.disabled
    )
  );
  if (!grokDisabled) fail("premium grok slot");
  else pass("premium grok slot");

  const log = await page.evaluate(() => window.TasuAiInteractionLog.readLogs()[0]);
  if (log?.selected_model) pass("log has selected_model", log.selected_model);
  else fail("log selected_model (run chat badge test first)");
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, errors } = await setupPage(context);

  await testGlobals(page);
  await testIntentDetector(page);
  await testOrchestratorPrepare(page);
  await testChatBadge(page);
  await testPlanSelector(page);
  await testCasualNoBadge(page);

  const ignorable = errors.filter(
    (e) =>
      !e.includes("Failed to load resource") &&
      !e.includes("favicon") &&
      !(e.includes("serper-search") && e.includes("503"))
  );
  if (ignorable.length) fail("console", ignorable.slice(0, 2).join(" | "));
  else pass("console clean");

  await context.close();
    });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((f) => console.error(`FAIL: ${f.step} ${f.detail || ""}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
