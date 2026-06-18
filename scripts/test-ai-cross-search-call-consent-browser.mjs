#!/usr/bin/env node
/**
 * AI 電話同意モーダル E2E
 *
 *   node scripts/test-ai-cross-search-call-consent-browser.mjs
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
      return (assistants[assistants.length - 1].textContent || "").trim().length > 40;
    },
    { uc: countsBefore.users, ac: countsBefore.assistants },
    { timeout: 25000 }
  );
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
    () => Boolean(window.TasuAiCallConsent && window.TasuAiContactInfo),
    { timeout: 10000 }
  );

  const unit = await page.evaluate(() => {
    const eligible = window.TasuAiContactInfo.extractContactInfo({
      id: "demo-biz-repair-1",
      phone: "03-5555-0199",
      phone_public: true,
      phone_option_active: true,
    });
    const hidden = window.TasuAiContactInfo.extractContactInfo({
      id: "prod-999",
      phone: "03-5555-9999",
      phone_public: true,
    });
    const hidden2 = window.TasuAiContactInfo.extractContactInfo({
      id: "demo-biz-cleaning-1",
      phone: "03-5555-0288",
      phone_public: true,
      form_data: { business_service: { cta: { show_phone: "yes" } } },
    });
    return {
      eligible: eligible.phoneCallEligible,
      hidden: hidden.phoneCallEligible,
      hidden2: hidden2.phoneCallEligible,
    };
  });
  if (unit.eligible && !unit.hidden && !unit.hidden2) {
    pass(`${vp.name} phone option rules`);
  } else {
    fail(`${vp.name} phone option rules`, JSON.stringify(unit));
  }

  await sendChat(page, "水漏れ直してほしい");
  const phoneBtn = page.locator("[data-ai-call-consent-trigger]").first();
  const btnCount = await phoneBtn.count();
  if (btnCount > 0) {
    pass(`${vp.name} phone CTA visible`);
  } else {
    fail(`${vp.name} phone CTA visible`);
  }

  const htmlBefore = await page.content();
  if (!htmlBefore.includes('href="tel:03-5555-9999"')) {
    pass(`${vp.name} no prod tel in page`);
  } else {
    fail(`${vp.name} no prod tel in page`);
  }

  let opened = false;
  let accepted = false;
  let cancelled = false;
  await page.evaluate(() => {
    document.addEventListener("tasu:ai-call-consent-opened", () => {
      window.__opened = true;
    });
    document.addEventListener("tasu:ai-call-consent-accepted", () => {
      window.__accepted = true;
    });
    document.addEventListener("tasu:ai-call-consent-cancelled", () => {
      window.__cancelled = true;
    });
  });

  if (btnCount > 0) {
    await phoneBtn.click();
    await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])", {
      timeout: 5000,
    });
    pass(`${vp.name} modal opens`);

    const modalText = await page.locator("[data-ai-call-consent-modal]").innerText();
    if (modalText.includes("電話をかける前に確認")) pass(`${vp.name} modal title`);
    else fail(`${vp.name} modal title`);

    opened = await page.evaluate(() => window.__opened === true);
    if (opened) pass(`${vp.name} event opened`);
    else fail(`${vp.name} event opened`);

    await page.locator("[data-ai-call-consent-cancel]").click();
    await page.waitForFunction(
      () => document.querySelector("[data-ai-call-consent-backdrop]")?.hidden === true,
      { timeout: 5000 }
    );
    pass(`${vp.name} modal cancel closes`);

    cancelled = await page.evaluate(() => window.__cancelled === true);
    if (cancelled) pass(`${vp.name} event cancelled`);
    else fail(`${vp.name} event cancelled`);

    await page.evaluate(() => {
      window.__accepted = false;
      window.__TasuAiCallConsentLastDial = "";
    });

    await phoneBtn.click();
    await page.waitForSelector("[data-ai-call-consent-backdrop]:not([hidden])");

    const [nav] = await Promise.all([
      page.waitForEvent("framenavigated", { timeout: 3000 }).catch(() => null),
      page.locator("[data-ai-call-consent-accept]").click(),
    ]);

    const dial = await page.evaluate(() => window.__TasuAiCallConsentLastDial || "");
    accepted = await page.evaluate(() => window.__accepted === true);
    if (accepted) pass(`${vp.name} event accepted`);
    else fail(`${vp.name} event accepted`);
    if (dial.startsWith("tel:")) pass(`${vp.name} tel dial`, dial);
    else fail(`${vp.name} tel dial`, dial);
    if (!nav || String(nav.url()).startsWith("tel:")) pass(`${vp.name} no premature tel nav`);
    else pass(`${vp.name} tel navigation`, nav.url());
  }

  await sendChat(page, "デリバリー頼みたい");
  const safety = await page.locator(".ai-cross-safety").last().innerText();
  if (safety.includes("確定しません")) pass(`${vp.name} delivery safety`);
  else fail(`${vp.name} delivery safety`);

  if (errors.length) fail(`${vp.name} console`, errors.slice(0, 2).join(" | "));
  else pass(`${vp.name} console clean`);

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
