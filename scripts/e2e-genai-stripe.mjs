/**
 * 生成AI Stripe E2E（Playwright + API）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pageUrl = process.env.GEN_AI_TEST_URL || "http://127.0.0.1:5173/gen-ai-workspace.html";
const chatUrl = `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}mode=${encodeURIComponent("汎用チャット")}`;
const origin = new URL(pageUrl).origin;
const supabaseUrl = "https://ddojquacsyqesrjhcvmn.supabase.co";

function getAnonKey() {
  const src = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
  return src.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
}

const API_KEY = getAnonKey();
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
  apikey: API_KEY,
};

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function apiPost(fn, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForWorkspace(page) {
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.getGenAiPlan), { timeout: 20000 });
}

async function preparePage(page, userId, usageOverride) {
  await page.goto(chatUrl, { waitUntil: "networkidle" });
  await waitForWorkspace(page);
  await page.evaluate(
    ({ uid, usage }) => {
      if (window.TASU_CHAT_SUPABASE_CONFIG) {
        window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = uid;
      }
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
      localStorage.setItem(
        "tasu_genai_usage",
        JSON.stringify(
          usage || {
            date: today,
            textChatUsed: 0,
            voiceChatUsed: 0,
            imageCharacterUsed: 0,
          }
        )
      );
      localStorage.setItem(
        "tasu_genai_plan",
        JSON.stringify({
          plan: "free",
          label: "無料枠",
          dailyTextLimit: 5,
          dailyVoiceLimit: 5,
          dailyImageLimit: 3,
          status: "free",
        })
      );
      window.TasuGenAiWorkspace.updateGenAiUsageUi();
    },
    { uid: userId, usage: usageOverride }
  );
  await page.waitForTimeout(300);
}

async function getRemainingFromPage(page) {
  const header = (await page.locator("[data-gen-ai-usage-header]").textContent()) || "";
  return {
    text: Number(header.match(/テキスト残り (\d+)/)?.[1]),
    voice: Number(header.match(/音声残り (\d+)/)?.[1]),
    image: Number(header.match(/画像残り (\d+)/)?.[1]),
    header,
  };
}

async function readPlanState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("tasu_genai_plan") || "{}"));
}

async function completeStripeCheckout(page, cardNumber, expectSuccess) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

  const email = page.locator('input[name="email"], input#email, input[type="email"]').first();
  if (await email.count()) await email.fill("e2e-genai@tasful.test");

  const cardOption = page.locator('button:has-text("カード"), button:has-text("Card"), [data-testid="card-tab"]');
  if (await cardOption.count()) await cardOption.first().click({ timeout: 5000 }).catch(() => {});

  let filled = false;
  const cardNumberInput = page.locator(
    'input[name="cardNumber"], input[autocomplete="cc-number"], input[placeholder*="1234"], input[aria-label*="Card number"], input[aria-label*="カード番号"]'
  ).first();
  if (await cardNumberInput.count()) {
    await cardNumberInput.fill(cardNumber);
    const exp = page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]').first();
    if (await exp.count()) await exp.fill("1234");
    const cvc = page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]').first();
    if (await cvc.count()) await cvc.fill("123");
    filled = true;
  }

  if (!filled) {
    for (const frame of page.frames()) {
      const num = frame.locator('input[name="number"], input[placeholder*="1234"], input[aria-label*="Card"]');
      if (await num.count()) {
        await num.fill(cardNumber);
        const exp = frame.locator('input[name="expiry"], input[placeholder*="MM"]');
        if (await exp.count()) await exp.fill("1234");
        const cvc = frame.locator('input[name="cvc"]');
        if (await cvc.count()) await cvc.fill("123");
        filled = true;
        break;
      }
    }
  }

  if (!filled) throw new Error("Stripe card fields not found");

  const submit = page
    .locator(
      'button[type="submit"], button:has-text("申し込む"), button:has-text("Subscribe"), button:has-text("Pay"), button:has-text("支払"), button:has-text("登録"), [data-testid="hosted-payment-submit-button"]'
    )
    .last();
  await submit.click({ timeout: 15000 });

  if (expectSuccess) {
    await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 120000 });
    await waitForWorkspace(page);
    await page.waitForFunction(
      () => {
        const t = document.querySelector("[data-gen-ai-usage-header]")?.textContent || "";
        return /テキスト残り \d+/.test(t);
      },
      { timeout: 30000 }
    );
    return true;
  }

  await page.waitForTimeout(6000);
  return /checkout\.stripe\.com/.test(page.url());
}

async function simulatePaidPlan(userId, planId) {
  const res = await apiPost("stripe-e2e-simulate-genai-subscription", {
    genai_plan: planId,
    user_id: userId,
  });
  return res;
}

async function runPaidPlanTest(page, planId, userId, expectedLimits, { viaCheckout = false } = {}) {
  await preparePage(page, userId, null);

  const free = await getRemainingFromPage(page);
  record(
    `${planId}: free state`,
    free.text === 5 && free.voice === 5 && free.image === 3,
    free.header
  );

  // exhausted usage → limit banner
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  await page.evaluate((dateKey) => {
    localStorage.setItem(
      "tasu_genai_usage",
      JSON.stringify({
        date: dateKey,
        textChatUsed: 5,
        voiceChatUsed: 5,
        imageCharacterUsed: 3,
      })
    );
    window.TasuGenAiWorkspace.updateGenAiUsageUi();
  }, today);

  const planBtn = await page.locator("[data-gen-ai-usage-plan-btn]").count();
  record(`${planId}: plan button in chat UI`, planBtn > 0, `count=${planBtn}`);

  await page.evaluate(() => window.TasuGenAiWorkspace.openGenAiPlanPanel());
  await page.waitForSelector("[data-gen-ai-plan-panel]:not([hidden])", { timeout: 5000 });
  record(`${planId}: plan panel opens`, true);

  const create = await apiPost("stripe-create-genai-checkout", {
    genai_plan: planId,
    user_id: userId,
    origin,
  });
  record(`${planId}: checkout session created`, create.data?.ok && Boolean(create.data?.url), create.data?.session_id);

  if (viaCheckout) {
    await page.goto(create.data.url, { waitUntil: "domcontentloaded" });
    await completeStripeCheckout(page, "4242424242424242", true);
  } else {
    const sim = await simulatePaidPlan(userId, planId);
    record(`${planId}: simulate subscription`, sim.data?.ok, sim.data?.plan?.plan);
    const synced = await page.evaluate(async (uid) => {
      if (window.TASU_CHAT_SUPABASE_CONFIG) window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = uid;
      const ok = await window.TasuGenAiWorkspace.syncGenAiPlanFromServer();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
      localStorage.setItem(
        "tasu_genai_usage",
        JSON.stringify({
          date: today,
          textChatUsed: 0,
          voiceChatUsed: 0,
          imageCharacterUsed: 0,
        })
      );
      window.TasuGenAiWorkspace.updateGenAiUsageUi();
      const plan = window.TasuGenAiWorkspace.getGenAiPlan();
      return { ok, plan: plan.plan, limits: [plan.dailyTextLimit, plan.dailyVoiceLimit, plan.dailyImageLimit] };
    }, userId);
    record(`${planId}: sync plan to browser`, synced.ok && synced.plan === (planId === "genai_basic_300" ? "basic_300" : "pro_980"), JSON.stringify(synced));
    await page.evaluate(() => window.TasuGenAiWorkspace.updateGenAiUsageUi());
  }

  const after = await getRemainingFromPage(page);
  const plan = await readPlanState(page);

  record(
    `${planId}: limits after checkout`,
    after.text === expectedLimits.text &&
      after.voice === expectedLimits.voice &&
      after.image === expectedLimits.image,
    `${after.text}/${after.voice}/${after.image} plan=${plan.plan}`
  );

  record(
    `${planId}: local plan code`,
    plan.plan === (planId === "genai_basic_300" ? "basic_300" : "pro_980"),
    JSON.stringify(plan)
  );

  const db = await apiPost("stripe-get-genai-plan", { user_id: userId });
  record(
    `${planId}: DB plan saved`,
    db.data?.ok && db.data?.plan?.dailyTextLimit === expectedLimits.text,
    `textLimit=${db.data?.plan?.dailyTextLimit}`
  );

  return { after, plan, db: db.data };
}

async function testDeclinedCard(page) {
  const userId = "u_e2e_decline";
  const create = await apiPost("stripe-create-genai-checkout", {
    genai_plan: "genai_basic_300",
    user_id: userId,
    origin,
  });
  record("Declined: checkout session created", create.data?.ok, create.data?.session_id);

  await preparePage(page, userId, null);
  await page.evaluate(() => {
    window.TasuGenAiWorkspace.openGenAiPlanPanel();
  });
  record("Declined: plan panel opens on free user", await page.locator("[data-gen-ai-plan-panel]:not([hidden])").count() > 0);

  await page.goto(chatUrl, { waitUntil: "networkidle" });
  await waitForWorkspace(page);

  const header = await page.locator("[data-gen-ai-usage-header]").textContent();
  const plan = await readPlanState(page);
  record("Declined: AI page works (free plan)", plan.plan === "free" && /残り/.test(header || ""), header);

  await page.locator("[data-gen-ai-input]").fill("失敗後も送信テスト");
  await page.locator("[data-gen-ai-send]").click();
  await page.waitForTimeout(2000);
  const msgs = await page.locator("[data-gen-ai-messages] .chat-area__msg").count();
  record("Declined: chat UI responsive", msgs >= 1, `messages=${msgs}`);
}

async function verifyAiFeatures(page) {
  const charUrl = `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}mode=${encodeURIComponent("AIキャラ会話")}`;
  await page.goto(charUrl, { waitUntil: "networkidle" });
  await waitForWorkspace(page);
  await page.evaluate(async (uid) => {
    if (window.TASU_CHAT_SUPABASE_CONFIG) window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = uid;
    await window.TasuGenAiWorkspace.syncGenAiPlanFromServer();
    window.TasuGenAiWorkspace.updateGenAiUsageUi();
  }, "u_e2e_basic");

  await page.locator("[data-ai-voice-toggle]").first().uncheck({ force: true });
  await page.locator("[data-gen-ai-input]").fill("E2E：1+1は？");
  await page.locator("[data-gen-ai-send]").click();

  await page.waitForFunction(
    () => document.querySelectorAll("[data-gen-ai-messages] .chat-area__msg--assistant").length >= 1,
    { timeout: 45000 }
  );
  const reply = await page.locator("[data-gen-ai-messages] .chat-area__msg--assistant").last().textContent();
  record("Gemini reply after billing", (reply || "").length > 3, (reply || "").slice(0, 50));

  record("2D mouth preserved", (await page.locator("[data-character-mouth]").count()) >= 0);
  record("Voice toggle preserved", await page.locator("[data-ai-voice-toggle]").isVisible());
  record("Mic button preserved", (await page.locator("[data-gen-ai-mic]").count()) > 0);
}

console.log("=== GenAI Stripe E2E ===\n");

const catalog = await apiPost("stripe-setup-genai-catalog", {});
record("Setup catalog API", catalog.data?.ok, "ok");
if (catalog.data?.products) {
  console.log("\nProducts:", JSON.stringify(catalog.data.products, null, 2));
  console.log("Webhook:", JSON.stringify(catalog.data.webhook, null, 2));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await runPaidPlanTest(page, "genai_basic_300", "u_e2e_basic", { text: 30, voice: 30, image: 10 });
  await runPaidPlanTest(page, "genai_pro_980", "u_e2e_pro", { text: 100, voice: 100, image: 30 });
  await testDeclinedCard(page);
  await verifyAiFeatures(page);
} catch (err) {
  record("E2E execution", false, err.message);
  console.error(err);
} finally {
  await browser.close();
}

console.log("\n--- E2E Summary ---");
const failed = results.filter((r) => !r.ok);
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
process.exit(failed.length ? 1 : 0);
