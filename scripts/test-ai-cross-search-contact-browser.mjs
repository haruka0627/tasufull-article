#!/usr/bin/env node
/**
 * AI 横断マッチング — 連絡導線 E2E
 *
 *   node scripts/test-ai-cross-search-contact-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-ai-cross-search-contact-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

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
  const countsBefore = await page.evaluate(() => ({
    users: document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--user").length,
    assistants: document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant")
      .length,
  }));
  await page.locator("[data-ai-chat-input]").fill(message);
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
      return last && (last.textContent || "").trim().length > 40;
    },
    { uc: countsBefore.users, ac: countsBefore.assistants },
    { timeout: 25000 }
  );
}

async function lastAssistantHtml(page) {
  return page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last ? last.innerHTML : "";
  });
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) errors.push(msg.text());
  });

  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => Boolean(window.TasuAiCrossSearch && window.TasuAiContactInfo),
    { timeout: 10000 }
  );

  await sendChat(page, "水漏れ直してほしい");
  let html = await lastAssistantHtml(page);
  if (html.includes("ai-result-contact") || html.includes("data-ai-result-contact")) {
    pass(`${vp.name} repair contact block`);
  } else {
    fail(`${vp.name} repair contact block`);
  }
  if (html.includes("ai-cross-safety") || html.includes("確定しません")) {
    pass(`${vp.name} repair safety note`);
  } else {
    fail(`${vp.name} repair safety note`);
  }
  if (
    !/依頼を確定しました|購入を完了しました|応募を送信しました|決済が完了/.test(html)
  ) {
    pass(`${vp.name} no auto-commit action`);
  } else {
    fail(`${vp.name} no auto-commit action`);
  }

  await sendChat(page, "デリバリー頼みたい");
  html = await lastAssistantHtml(page);
  if (html.includes("ai-cross-safety") || html.includes("ご本人またはご家族")) {
    pass(`${vp.name} delivery safety`);
  } else {
    fail(`${vp.name} delivery safety`);
  }

  await sendChat(page, "電話したい");
  html = await lastAssistantHtml(page);
  const nav = await page.evaluate(() => window.TasuAiIntentRouter.classifyIntent("電話したい"));
  if (nav.intent === "site_navigation" && nav.navKey === "contact_phone") {
    pass(`${vp.name} phone nav intent`);
  } else {
    fail(`${vp.name} phone nav intent`, `${nav.intent}/${nav.navKey}`);
  }
  if (html.includes("chat-list.html") && (html.includes("/contact") || html.includes("contact"))) {
    pass(`${vp.name} contact nav links`);
  } else {
    fail(`${vp.name} contact nav links`);
  }

  const phoneRules = await page.evaluate(() => {
    const eligible = window.TasuAiContactInfo.extractContactInfo({
      id: "demo-biz-repair-1",
      phone: "03-5555-0199",
      phone_public: true,
      phone_option_active: true,
    });
    const noOption = window.TasuAiContactInfo.extractContactInfo({
      id: "prod-listing-999",
      phone: "03-5555-9999",
      phone_public: true,
    });
    return { eligible: eligible.phoneCallEligible, noOption: noOption.phoneCallEligible };
  });
  if (phoneRules.eligible && !phoneRules.noOption) {
    pass(`${vp.name} subscription + public rules`);
  } else {
    fail(`${vp.name} subscription + public rules`, JSON.stringify(phoneRules));
  }

  await sendChat(page, "エアコン掃除できる業者ある？");
  html = await lastAssistantHtml(page);
  if (html.includes("見積相談") || html.includes("詳細を見る")) {
    pass(`${vp.name} service CTAs`);
  } else {
    fail(`${vp.name} service CTAs`);
  }

  if (errors.length) {
    fail(`${vp.name} console`, errors.slice(0, 2).join(" | "));
  } else {
    pass(`${vp.name} console clean`);
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  await runViewport(browser, { name: "PC1280", width: 1280, height: 800 });
  await runViewport(browser, { name: "SP390", width: 390, height: 844 });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
