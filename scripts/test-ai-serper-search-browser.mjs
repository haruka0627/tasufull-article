#!/usr/bin/env node
/**
 * AI 検索ルーター + Serper（モック）E2E
 *
 *   node scripts/test-ai-serper-search-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-ai-serper-search-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const MOCK_SERPER = {
  ok: true,
  query: "mock",
  results: [
    {
      title: "モック: 水漏れ修理の相場ガイド",
      snippet: "一般的な水漏れ修理の費用目安は部位により異なります。",
      link: "https://example.com/mock-market-price",
      source: "example.com",
    },
    {
      title: "モック: 補助金・助成金情報",
      snippet: "自治体の公式サイトで最新情報を確認してください。",
      link: "https://example.com/mock-subsidy",
      source: "example.com",
    },
  ],
};

const ROUTE_CASES = [
  { input: "水漏れ直してほしい", route: "site_search" },
  { input: "水漏れ修理の相場はいくら？", route: "web_search" },
  { input: "水漏れ業者と相場教えて", route: "hybrid_search" },
  { input: "会員登録したい", route: "site_search" },
  { input: "今日のニュースは？", route: "web_search" },
  { input: "こんにちは", route: "normal_chat" },
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

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    (t.includes("serper-search") && t.includes("503"))
  );
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

async function getLastAssistantHtml(page) {
  return page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last ? last.innerHTML : "";
  });
}

async function setupPage(context, viewport) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push(msg.text());
    }
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
      body: JSON.stringify({
        ...MOCK_SERPER,
        query: body.query || MOCK_SERPER.query,
      }),
    });
  });

  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("[data-ai-chat-input]", { timeout: 10000 });
  await page.waitForFunction(() => Boolean(window.TasuAiSearchRouter && window.TasuAiSearchOrchestrator));

  return { page, errors };
}

async function testRouteClassification(page, vpName) {
  console.log(`\n--- route classification (${vpName}) ---`);
  for (const { input, route } of ROUTE_CASES) {
    const got = await page.evaluate(
      (text) => window.TasuAiSearchRouter?.classifySearchRoute(text, { modeId: "cross-matching" }),
      input
    );
    if (!got || got.route !== route) {
      fail(`route ${input}`, `expected ${route}, got ${got?.route} (${got?.reason})`);
    } else {
      pass(`route ${route}`, input);
    }
  }
}

async function testWebSearchUi(page, vpName) {
  console.log(`\n--- web_search UI (${vpName}) ---`);
  await sendChat(page, "水漏れ修理の相場はいくら？");
  const html = await getLastAssistantHtml(page);
  if (html.includes("ai-search-used-badge")) fail("web search legacy badge should not appear");
  else pass("no legacy web search badge");
  if (html.includes("Web検索を利用しました")) fail("legacy web badge text should not appear");
  else pass("no legacy web badge text");
  if (html.includes("ai-web-results")) fail("legacy web-only block should not appear");
  else pass("no legacy web-only block");
  const bubbleText = await page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last?.textContent?.trim() || "";
  });
  if (!bubbleText.length) fail("assistant reply text");
  else pass("assistant reply text", bubbleText.slice(0, 40));
}

async function testHybridUi(page, vpName) {
  console.log(`\n--- hybrid_search UI (${vpName}) ---`);
  await sendChat(page, "水漏れ業者と相場教えて");
  const html = await getLastAssistantHtml(page);
  if (!html.includes("TASFUL内の候補")) fail("hybrid tasful heading");
  else pass("hybrid tasful heading");
  if (!html.includes("Web検索結果")) fail("hybrid web result heading");
  else pass("hybrid web result heading");
  if (html.includes("ai-search-used-badge") || html.includes("Web検索を利用しました")) {
    fail("hybrid legacy web badge");
  } else {
    pass("hybrid no legacy web badge");
  }
  if (html.includes("ai-web-results")) fail("hybrid legacy web-only block");
  else pass("hybrid no legacy web-only block");
  if (!html.includes("ai-cross-card") && !html.includes("ai-cross-empty")) {
    fail("hybrid site cards or empty");
  } else {
    pass("hybrid site section content");
  }
}

async function testSiteSearch(page, vpName) {
  console.log(`\n--- site_search (${vpName}) ---`);
  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("[data-ai-chat-input]", { timeout: 10000 });
  await sendChat(page, "水漏れ直してほしい");
  const html = await getLastAssistantHtml(page);
  if (!html.includes("ai-cross-") && !html.includes("修理")) fail("site cross content", html.slice(0, 120));
  else pass("site cross content");
  if (html.includes("ai-web-results")) fail("site should not show web-only block");
  else pass("site no web-only block");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: "PC1280", width: 1280, height: 800 },
    { name: "SP390", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    console.log(`\n======== ${vp.name} ========`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const { page, errors } = await setupPage(context, vp);

    await testRouteClassification(page, vp.name);
    await testSiteSearch(page, vp.name);

    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-chat-input]", { timeout: 10000 });
    await testWebSearchUi(page, vp.name);
    await testHybridUi(page, vp.name);

    if (errors.length) fail(`${vp.name} console`, errors.slice(0, 3).join(" | "));
    else pass(`${vp.name} console clean`);

    await context.close();
  }

  await browser.close();

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
