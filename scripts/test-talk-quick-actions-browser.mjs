#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK Phase17 — クイック操作 smoke test
 *
 *   node scripts/test-talk-quick-actions-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const RECENT_KEY = "tasful_talk_recent_actions";

async function activeAiMode(page) {
  return page.evaluate(() => {
    const btn = document.querySelector(".talk-ai-modes__btn.is-active");
    return btn?.getAttribute("data-talk-ai-mode") || "";
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => window.TasuTalkData?.QUICK_ACTIONS?.length >= 8);

    const btnCount = await page.locator("[data-talk-quick-action]").count();
    if (btnCount !== 8) fail(`quick action buttons count (${btnCount})`);
    else pass("8 quick action buttons visible");

    await page.locator('[data-talk-quick-action="chatSearch"]').click();
    await page.waitForTimeout(350);
    const chatTab = await page.locator('[data-talk-panel="chat"]').isVisible();
    const searchFocused = await page.evaluate(
      () => document.activeElement?.matches?.("[data-talk-chat-search]") === true
    );
    if (!chatTab || !searchFocused) fail("chatSearch opens chat tab and focuses search");
    else pass("chatSearch opens chat tab and focuses search");

    await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-quick-action]");

    for (const [action, mode] of [
      ["createJob", "job"],
      ["createProject", "project"],
      ["createAd", "ad"],
      ["createNotice", "notice"],
    ]) {
      await page.locator(`[data-talk-quick-action="${action}"]`).click();
      await page.waitForTimeout(300);
      const aiVisible = await page.locator('[data-talk-panel="ai"]').isVisible();
      const active = await activeAiMode(page);
      if (!aiVisible || active !== mode) fail(`${action} switches AI mode to ${mode} (got ${active})`);
      else pass(`${action} switches AI mode to ${mode}`);
      await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-quick-action]");
    }

    await page.locator('[data-talk-quick-action="broadcastDrafts"]').click();
    await page.waitForTimeout(400);
    const broadcastVisible = await page.evaluate(() => {
      const el = document.getElementById("talkBroadcastSection");
      if (!el) return false;
      const panel = document.querySelector('[data-talk-panel="ai"]');
      return !panel?.hidden;
    });
    if (!broadcastVisible) fail("broadcastDrafts opens AI tab with broadcast section");
    else pass("broadcastDrafts opens AI tab with broadcast section");

    await page.goto(`${BASE}/talk-home.html?action=notify`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const notifyFromUrl = await page.locator('[data-talk-panel="notify"]').isVisible();
    const actionCleared = await page.evaluate(
      () => !new URL(window.location.href).searchParams.has("action")
    );
    if (!notifyFromUrl || !actionCleared) fail("URL action=notify opens notify and clears action");
    else pass("URL action=notify opens notify and clears action");

    await page.evaluate((key) => {
      localStorage.removeItem(key);
      window.TasuTalkData.pushRecentAction("createJob");
      window.TasuTalkData.pushRecentAction("chatSearch");
    }, RECENT_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const recentVisible = await page.locator("[data-talk-recent-section]").isVisible();
    const recentCount = await page.locator("[data-talk-recent-rerun]").count();
    if (!recentVisible || recentCount < 2) fail("recent actions saved and displayed");
    else pass("recent actions saved and displayed");

    await page.locator("[data-talk-recent-rerun]").first().click();
    await page.waitForTimeout(350);
    const rerunFocused = await page.evaluate(
      () => document.activeElement?.matches?.("[data-talk-chat-search]") === true
    );
    if (!rerunFocused) fail("recent action rerun executes chatSearch");
    else pass("recent action rerun executes chatSearch");

    await page.evaluate((key) => {
      localStorage.setItem(key, "[[broken");
    }, RECENT_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const stillOk = await page.evaluate(
      () => typeof window.TasuTalkData.readRecentActions === "function"
    );
    if (!stillOk) fail("corrupt recent-actions localStorage breaks page");
    else pass("corrupt recent-actions localStorage does not break page");
  } catch (err) {
    fail(String(err?.message || err));
  }  });
  

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("All talk quick action checks passed.");
}

main();
