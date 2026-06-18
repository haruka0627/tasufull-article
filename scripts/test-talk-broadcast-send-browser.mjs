#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — 配信下書き 本番一斉送信
 *
 *   node scripts/test-talk-broadcast-send-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const MARKER = "bcast-prod-send-e2e";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate((marker) => {
      localStorage.removeItem("tasful_talk_broadcast_drafts");
      localStorage.removeItem("tasful_talk_notify_fanout");
      localStorage.removeItem("tasful_talk_broadcast_send_queue");
    }, MARKER);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    await page.locator('[data-talk-ai-mode="notice"]').click();
    await page.locator("[data-talk-ai-input]").fill(MARKER);
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    await page.locator("[data-talk-ai-save-broadcast]").click();
    await page.fill("[data-talk-broadcast-title]", `本番配信 ${MARKER}`);
    await page.selectOption("[data-talk-broadcast-segment]", "construction");
    await page.selectOption("[data-talk-broadcast-priority]", "urgent");
    await page.locator("[data-talk-broadcast-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(400);

    await page.locator("[data-talk-broadcast-send]").first().click();
    await page.waitForSelector("[data-talk-broadcast-send-modal]:not([hidden])");
    await page.locator("[data-talk-broadcast-send-confirm]").click();
    await page.waitForTimeout(1200);

    const statsCols = await page.evaluate(() => {
      const el = document.querySelector("[data-talk-dashboard-stats]");
      if (!el) return 0;
      return window.getComputedStyle(el).gridTemplateColumns.split(" ").length;
    });
    if (statsCols > 3) fail(`mobile stats columns: ${statsCols}`);
    else pass("mobile stats stack ok");

    const sendBtn = await page.locator("[data-talk-broadcast-send]").count();
    if (sendBtn > 0) fail("send button visible after sent");
    else pass("send button hidden after sent");

    const corrupt = await page.evaluate(() => {
      localStorage.setItem("tasful_talk_broadcast_drafts", "{{");
      return typeof window.TasuTalkBroadcastDrafts?.sendBroadcastDraft === "function";
    });
    if (!corrupt) fail("corrupt storage broke store");
    else pass("corrupt storage safe");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }  });
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nOK: broadcast production send");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
