#!/usr/bin/env node
/**
 * AI 横断マッチング E2E
 *
 *   node scripts/test-ai-cross-search-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-ai-cross-search-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

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
    t.includes("supabase") ||
    t.includes("Supabase")
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
      if (assistants.length <= ac) return false;
      const last = assistants[assistants.length - 1];
      if (!last) return false;
      const bubble = last.querySelector(".ai-chat__bubble");
      return bubble && (bubble.textContent || "").trim().length > 40;
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

async function classifyOnPage(page, text) {
  return page.evaluate((t) => window.TasuAiIntentRouter?.classifyIntent(t), text);
}

async function runCase(page, { label, input, expectIntent, expectInHtml = [], expectAnyHtml = [] }) {
  console.log(`\n--- ${label} ---`);
  const errors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) errors.push(msg.text());
  });

  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Boolean(window.TasuAiIntentRouter && window.TasuAiCrossSearch),
    { timeout: 10000 }
  );

  const classified = await classifyOnPage(page, input);
  if (classified?.intent !== expectIntent) {
    fail(`${label} intent`, `expected ${expectIntent}, got ${classified?.intent}`);
  } else {
    pass(`${label} intent`, expectIntent);
  }

  await sendChat(page, input);

  const html = await getLastAssistantHtml(page);
  const mustAll = expectInHtml.every((needle) => html.includes(needle));
  const mustAny = expectAnyHtml.length
    ? expectAnyHtml.some((needle) => html.includes(needle))
  : true;

  if (!html.includes("ai-cross") && !html.includes("ai-chat__bubble--rich")) {
    fail(`${label} rich reply`, "missing ai-cross markup");
  } else {
    pass(`${label} rich reply`);
  }

  if (!mustAll) {
    for (const needle of expectInHtml) {
      if (!html.includes(needle)) fail(`${label} html contains`, needle);
      else pass(`${label} contains`, needle);
    }
  } else {
    for (const needle of expectInHtml) pass(`${label} contains`, needle);
  }

  if (expectAnyHtml.length && !mustAny) {
    fail(`${label} html any-of`, expectAnyHtml.join(" | "));
  } else if (expectAnyHtml.length) {
    pass(`${label} html any-of`, expectAnyHtml.find((n) => html.includes(n)));
  }

  if (errors.length) {
    fail(`${label} console`, errors.slice(0, 3).join(" | "));
  } else {
    pass(`${label} console clean`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const contexts = [
    { name: "PC", width: 1280, height: 800 },
    { name: "SP390", width: 390, height: 844 },
  ];

  for (const vp of contexts) {
    console.log(`\n======== ${vp.name} ========`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await runCase(page, {
      label: "repair",
      input: "水漏れ直してほしい",
      expectIntent: "repair_request",
      expectAnyHtml: ["detail-business-service.html", "ai-cross-empty", "見積相談へ進む"],
    });

    await runCase(page, {
      label: "delivery",
      input: "デリバリー頼みたい",
      expectIntent: "delivery_request",
      expectAnyHtml: ["依頼相談へ進む", "商品を見る", "detail-business-service.html", "ai-cross-empty"],
    });

    await runCase(page, {
      label: "product",
      input: "こういう商品ある？ 古着 ジャケット",
      expectIntent: "product_search",
      expectAnyHtml: ["商品を見る", "detail-product.html", "detail-shop-product.html", "ai-cross-empty"],
    });

    await runCase(page, {
      label: "signup",
      input: "会員登録したい",
      expectIntent: "site_navigation",
      expectInHtml: ["signup.html"],
    });

    await runCase(page, {
      label: "billing",
      input: "請求を見たい",
      expectIntent: "site_navigation",
      expectInHtml: ["sales-fees.html"],
    });

    await runCase(page, {
      label: "ac",
      input: "エアコン掃除できる業者ある？",
      expectIntent: "service_request",
      expectAnyHtml: ["detail-business-service.html", "ai-cross-empty"],
    });

    await runCase(page, {
      label: "job",
      input: "求人探したい 動画編集",
      expectIntent: "job_search",
      expectAnyHtml: ["detail-job.html", "応募へ進む", "ai-cross-empty"],
    });

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
