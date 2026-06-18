#!/usr/bin/env node
/**
 * 安否通知ログ E2E（localStorage / 電話同意連携）
 *
 *   node scripts/test-ai-anpi-notification-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const ANPI_CONTEXT = {
  user_id: "anpi_user_e2e",
  user_name: "山田太郎",
  is_anpi_user: true,
  contract_holder_id: "holder_e2e",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "call_only",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

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
      return (
        document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant").length > ac
      );
    },
    { uc: countsBefore.users, ac: countsBefore.assistants },
    { timeout: 25000 }
  );
}

async function getLogCount(page) {
  return page.evaluate(() => (window.TasuAnpiNotifications?.getLogs?.() || []).length);
}

async function getLogs(page) {
  return page.evaluate(() => window.TasuAnpiNotifications?.getLogs?.() || []);
}

async function setAnpiContext(page, ctx) {
  await page.evaluate((c) => {
    if (c) window.TasuAnpiUserContext?.setAnpiUserContext?.(c);
    else window.TasuAnpiUserContext?.clearAnpiUserContext?.();
    window.TasuAnpiNotifications?.clearLogs?.();
  }, ctx);
}

async function openWorkspace(page) {
  await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiNotifications &&
          window.TasuAiCallConsent &&
          window.TasuAiCrossSearch
      ),
    { timeout: 10000 }
  );
}

async function runCallConsentFlow(page) {
  await sendChat(page, "水漏れ直してほしい");
  await page.waitForSelector("[data-ai-call-consent-trigger]", { timeout: 15000 });
  await page.locator("[data-ai-call-consent-trigger]").first().click();
  await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])", {
    timeout: 5000,
  });
  await page.locator("[data-ai-call-consent-cancel]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-ai-call-consent-backdrop]")?.hidden === true,
    { timeout: 5000 }
  );

  await page.locator("[data-ai-call-consent-trigger]").first().click();
  await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])");
  await page.locator("[data-ai-call-consent-accept]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-ai-call-consent-backdrop]")?.hidden === true,
    { timeout: 8000 }
  );
}

async function testNormalUser(page, vpName) {
  console.log(`\n--- normal user (${vpName}) ---`);
  await setAnpiContext(page, null);
  await openWorkspace(page);
  const before = await getLogCount(page);
  await sendChat(page, "水漏れ直してほしい");
  const afterSearch = await getLogCount(page);
  if (afterSearch !== before) fail(`${vpName} normal no logs after search`, `${afterSearch}`);
  else pass(`${vpName} normal no logs after search`);

  const hasPhone = await page.locator("[data-ai-call-consent-trigger]").count();
  if (hasPhone > 0) {
    await page.locator("[data-ai-call-consent-trigger]").first().click();
    await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])");
    await page.locator("[data-ai-call-consent-cancel]").click();
    const afterCall = await getLogCount(page);
    if (afterCall !== before) fail(`${vpName} normal no logs after call`);
    else pass(`${vpName} normal no logs after call`);
  } else {
    pass(`${vpName} normal call skip`, "no phone CTA");
  }
}

async function testAnpiCallEvents(page, vpName) {
  console.log(`\n--- anpi call events (${vpName}) ---`);
  await setAnpiContext(page, { ...ANPI_CONTEXT, notification_level: "call_only" });
  await openWorkspace(page);
  await runCallConsentFlow(page);
  const logs = await getLogs(page);
  const types = logs.map((l) => l.event_type);
  for (const t of ["call_consent_opened", "call_consent_accepted", "call_consent_cancelled"]) {
    if (!types.includes(t)) fail(`${vpName} log ${t}`);
    else pass(`${vpName} log ${t}`);
  }
  const accepted = logs.find((l) => l.event_type === "call_consent_accepted");
  if (!accepted?.message?.includes("電話しようとしています")) {
    fail(`${vpName} accepted message`);
  } else {
    pass(`${vpName} accepted message`);
  }
  if (accepted?.phone_masked && /03-5555-0199|0355550199/.test(JSON.stringify(logs))) {
    fail(`${vpName} full phone in logs`);
  } else {
    pass(`${vpName} phone masked only`, accepted?.phone_masked);
  }
}

async function testAllAiActions(page, vpName) {
  console.log(`\n--- all_ai_actions (${vpName}) ---`);
  await setAnpiContext(page, {
    ...ANPI_CONTEXT,
    notification_level: "all_ai_actions",
  });
  await openWorkspace(page);
  await sendChat(page, "買い物代行を頼みたい");
  const logs = await getLogs(page);
  if (!logs.some((l) => l.event_type === "ai_search")) {
    fail(`${vpName} ai_search log`);
  } else {
    pass(`${vpName} ai_search log`);
  }
}

async function testCallOnlyNoAiSearch(page, vpName) {
  console.log(`\n--- call_only (${vpName}) ---`);
  await setAnpiContext(page, { ...ANPI_CONTEXT, notification_level: "call_only" });
  await openWorkspace(page);
  await sendChat(page, "デリバリー頼みたい");
  const afterSearch = await getLogs(page);
  if (afterSearch.some((l) => l.event_type === "ai_search")) {
    fail(`${vpName} no ai_search on call_only`);
  } else {
    pass(`${vpName} no ai_search on call_only`);
  }
  const hasPhone = await page.locator("[data-ai-call-consent-trigger]").count();
  if (hasPhone > 0) {
    await page.locator("[data-ai-call-consent-trigger]").first().click();
    await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])");
    await page.locator("[data-ai-call-consent-cancel]").click();
    const logs = await getLogs(page);
    if (!logs.some((l) => l.event_type === "call_consent_cancelled")) {
      fail(`${vpName} call log on call_only`);
    } else {
      pass(`${vpName} call log on call_only`);
    }
  }
}

async function testUrgent(page, vpName) {
  console.log(`\n--- urgent (${vpName}) ---`);
  await setAnpiContext(page, { ...ANPI_CONTEXT, notification_level: "call_only" });
  await openWorkspace(page);
  await sendChat(page, "息苦しいです");
  const logs = await getLogs(page);
  if (!logs.some((l) => l.event_type === "urgent_keyword_detected")) {
    fail(`${vpName} urgent log`);
  } else {
    pass(`${vpName} urgent log`);
  }
  const html = await page.evaluate(() => {
    const msgs = document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant");
    const last = msgs[msgs.length - 1];
    return last ? last.innerHTML : "";
  });
  if (!html.includes("ai-anpi-urgent-note") || !html.includes("119番")) {
    fail(`${vpName} urgent UI note`);
  } else {
    pass(`${vpName} urgent UI note`);
  }
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const viewports = [
    { name: "PC1280", width: 1280, height: 900 },
    { name: "SP390", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    console.log(`\n======== ${vp.name} ========`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
        errors.push(msg.text());
      }
    });

    await testNormalUser(page, vp.name);
    await testAnpiCallEvents(page, vp.name);
    await testAllAiActions(page, vp.name);
    await testCallOnlyNoAiSearch(page, vp.name);
    await testUrgent(page, vp.name);

    if (errors.length) fail(`${vp.name} console`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name} console clean`);

    await context.close();
  }

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
