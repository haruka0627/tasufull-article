#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — browser smoke test (Phase1–4)
 *
 *   node scripts/test-talk-home-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PAGE = `${BASE}/talk-home.html`;
const STORAGE_KEY = "tasful_talk_notifications";
const AI_DRAFTS_KEY = "tasful_talk_ai_drafts";
const PHASE4_MARKER = "phase4-ai-e2e-notice";

async function main() {
  const errors = [];
  await withPlaywrightBrowser(async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const pass = (msg) => console.log(`  ✓ ${msg}`);
  const fail = (msg) => {
    errors.push(msg);
    console.log(`  ✗ ${msg}`);
  };

  try {
    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      localStorage.removeItem("tasful:talk:notifications:read:v1");
      localStorage.removeItem("tasful_talk_ai_drafts");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-root]", { timeout: 10000 });

    const tabs = await page.locator("[data-talk-tab]").count();
    if (tabs !== 3) fail(`expected 3 tabs, got ${tabs}`);
    else pass("3 tabs");

    await page.locator('[data-talk-tab="notify"]').click();
    await page.waitForSelector("[data-talk-notify-filters]", { timeout: 5000 });
    const filterCount = await page.locator("[data-talk-notify-filter]").count();
    if (filterCount < 9) fail(`notify filters ${filterCount}`);
    else pass("notify filters");

    const cardCount = await page.locator("[data-talk-notify-list] .talk-notify-card").count();
    if (cardCount < 6) fail(`seed notifications ${cardCount}`);
    else pass("seed notifications");

    await page.locator('[data-talk-tab="ai"]').click();
    await page.waitForSelector(".talk-ai-modes [data-talk-ai-mode]", { timeout: 8000 });

    const modeCount = await page.locator("[data-talk-ai-mode]").count();
    if (modeCount !== 5) fail(`expected 5 AI modes, got ${modeCount}`);
    else pass("5 AI modes");

    const modes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-talk-ai-mode]")).map((b) =>
        b.getAttribute("data-talk-ai-mode")
      )
    );
    for (const m of ["qa", "ad", "notice", "project", "job"]) {
      if (!modes.includes(m)) fail(`missing AI mode: ${m}`);
    }
    if (modes.length === 5) pass("AI mode ids (qa/ad/notice/project/job)");

    await page.locator('[data-talk-ai-mode="notice"]').click();
    await page.locator("[data-talk-ai-input]").fill(PHASE4_MARKER);
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });

    const out = await page.locator("[data-talk-ai-output]").textContent();
    if (!out?.includes("モック")) fail("AI mock output missing");
    else pass("AI generation output");

    const actionCount = await page.locator("[data-talk-ai-result-actions] button").count();
    if (actionCount < 5) fail(`expected >=5 result actions, got ${actionCount}`);
    else pass("result action buttons");

    const copyBtn = page.locator("[data-talk-ai-copy]");
    if ((await copyBtn.count()) < 1) fail("copy button missing");
    else pass("copy button exists");

    const notifyBtn = page.locator("[data-talk-ai-to-notify]");
    if (await notifyBtn.isHidden()) fail("notify button should show for notice mode");
    else pass("notify-as-notification button visible");

    await page.locator("[data-talk-ai-save]").click();
    await page.waitForTimeout(300);
    const savedCards = await page.locator("[data-talk-ai-drafts-list] .talk-ai-draft-card").count();
    if (savedCards < 1) fail("saved drafts list empty");
    else pass("saved drafts list");

    await page.locator("[data-talk-ai-to-notify]").click();
    await page.waitForTimeout(300);

    await page.locator('[data-talk-tab="notify"]').click();
    await page.waitForTimeout(300);
    const aiNotify = await page.evaluate((marker) => {
      const list = window.TasuTalkData?.getNotifications?.({ filter: "all" }) || [];
      return list.some(
        (n) =>
          String(n.source || "").includes("talk-ai") &&
          (String(n.body || "").includes(marker) || String(n.title || "").length > 0)
      );
    }, PHASE4_MARKER);
    if (!aiNotify) fail("AI notification not in notify tab");
    else pass("AI notification in notify tab");

    await page.locator('[data-talk-tab="ai"]').click();
    await page.locator("[data-talk-ai-discard]").click();
    await page.waitForTimeout(200);

    const discarded = await page.evaluate(
      (key) => {
        try {
          const raw = localStorage.getItem(key);
          const list = raw ? JSON.parse(raw) : [];
          return list.some((d) => d.status === "discarded");
        } catch {
          return false;
        }
      },
      AI_DRAFTS_KEY
    );
    if (!discarded) fail("discard did not set status discarded");
    else pass("discard → status discarded");

    const providerOk = await page.evaluate(() => {
      const before = window.TasuTalkAi?.getTalkAiProvider?.();
      window.TasuTalkAi?.registerTalkAiProvider?.("e2e-test", async (mode, input) => ({
        text: `e2e:${mode}`,
        meta: {},
      }));
      window.TasuTalkAi?.setTalkAiProvider?.("e2e-test");
      const after = window.TasuTalkAi?.getTalkAiProvider?.();
      window.TasuTalkAi?.setTalkAiProvider?.(before || "mock");
      return after === "e2e-test";
    });
    if (!providerOk) fail("provider register/set broken");
    else pass("provider API intact");

    const draftFn = await page.evaluate(() => typeof window.TasuTalkAi?.generateTalkAiDraft === "function");
    if (!draftFn) fail("generateTalkAiDraft missing");
    else pass("generateTalkAiDraft exposed");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }  });
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nOK: TASFUL TALK chat, notify, AI Phase4 (drafts/notify/actions)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
