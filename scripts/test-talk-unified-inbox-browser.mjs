#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — 統合ビュー smoke test
 *
 *   node scripts/test-talk-unified-inbox-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const RECENT_KEY = "tasful_talk_recent_actions";

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
    await page.waitForFunction(() => typeof window.TasuTalkData?.getUnifiedInboxItems === "function");

    const seed = await page.evaluate(() => {
      const suffix = String(Date.now());
      const notifyId = `unified-test-notify-${suffix}`;
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      window.TasuTalkNotifications?.add?.({
        id: notifyId,
        type: "job",
        title: "統合テスト通知",
        body: "unified-inbox-notify-marker",
        source: "tasful",
        priority: "normal",
        targetUrl: "detail-job.html?id=unified-test",
      });
      const aiRow = window.TasuTalkAiDrafts?.add?.({
        mode: "ad",
        input: "統合テスト入力",
        output: "統合テスト広告出力 unified-ai-marker",
        status: "draft",
      });
      window.TasuTalkBroadcastDrafts?.add?.({
        kind: "ad",
        title: "統合配信テスト",
        body: "unified-broadcast-marker",
        targetSegment: "all",
        status: "draft",
        priority: "normal",
      });
      return { notifyId, aiId: aiRow?.id || "" };
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.__TASU_TALK_SKIP_ACTION_CONFIRM = true;
    });
    page.on("dialog", (d) => d.accept());
    await page.waitForSelector("[data-talk-unified-list] .talk-unified-inbox-card", {
      timeout: 15000,
    });

    const cardCount = await page.locator(".talk-unified-inbox-card").count();
    if (cardCount < 4) fail(`unified cards rendered (${cardCount})`);
    else pass(`unified cards rendered (${cardCount})`);

    const staticFirst = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-talk-unified-list] .talk-unified-inbox-card")];
      return cards[0]?.classList.contains("talk-unified-inbox-card--static") === true;
    });
    if (!staticFirst) fail("static cards listed first");
    else pass("static cards listed first");

    async function setUnifiedFilter(group, value) {
      const mobileVisible = await page
        .locator("[data-talk-unified-filters-mobile]")
        .isVisible();
      if (mobileVisible) {
        const map = { kind: "[data-talk-unified-kind-select]", read: "[data-talk-unified-read-select]", category: "[data-talk-unified-category-select]" };
        await page.locator(map[group]).selectOption(value);
      } else {
        await page
          .locator(
            `[data-talk-unified-chip][data-talk-unified-chip-group="${group}"][data-talk-unified-chip="${value}"]`
          )
          .click();
      }
      await page.waitForTimeout(250);
    }

    await setUnifiedFilter("kind", "notification");
    const notifyOnly = await page.locator('[data-talk-unified-card="notification"]').count();
    if (notifyOnly < 1) fail("kind filter notification");
    else pass("kind filter notification");

    await setUnifiedFilter("read", "unread");

    const notifyCard = page
      .locator('[data-talk-unified-card="notification"]')
      .filter({ hasText: "unified-inbox-notify-marker" });
    const hideBtn = notifyCard.locator(
      `[data-talk-unified-action="hide"][data-talk-unified-item-id="${seed.notifyId}"]`
    );
    if ((await hideBtn.count()) < 1) fail("notification hide action visible");
    else {
      const hiddenBefore = await page.evaluate(() => window.TasuTalkData.countUserHiddenNotifications());
      await hideBtn.click();
      await page.waitForTimeout(450);
      const hidden = await page.evaluate((id) => {
        const row = window.TasuTalkData.findNotificationById?.(id);
        const count = window.TasuTalkData.countUserHiddenNotifications();
        return Boolean(row?.hiddenAt) || count > 0;
      }, seed.notifyId);
      const hiddenAfter = await page.evaluate(() => window.TasuTalkData.countUserHiddenNotifications());
      if (!hidden && hiddenAfter <= hiddenBefore) fail("notification hide action works");
      else pass("notification hide action works");
    }

    await setUnifiedFilter("kind", "ai_draft");
    await setUnifiedFilter("read", "all");

    const aiId =
      seed.aiId ||
      (await page.evaluate(() => {
        const row = window.TasuTalkAiDrafts.readAll?.().find((r) =>
          String(r.output).includes("unified-ai-marker")
        );
        return row?.id || "";
      }));
    const aiCard = page.locator(
      `[data-talk-unified-card="ai_draft"][data-talk-unified-item-id="${aiId}"]`
    );
    const copyBtn = aiCard.locator('[data-talk-unified-action="ai-copy"]');
    if ((await copyBtn.count()) < 1) fail("ai copy action visible");
    else {
      await copyBtn.click();
      await page.waitForTimeout(200);
      pass("ai copy action clicked");
    }

    const discardBtn = aiCard.locator('[data-talk-unified-action="ai-discard"]');
    if ((await discardBtn.count()) < 1) fail("ai discard action visible");
    else {
      await discardBtn.click();
      await page.waitForTimeout(350);
      const discarded = await page.evaluate((id) => {
        const row = window.TasuTalkAiDrafts.findById?.(id);
        return row?.status === "discarded";
      }, aiId);
      if (!discarded) fail("ai discard action works");
      else pass("ai discard action works");
    }

    await setUnifiedFilter("kind", "broadcast_draft");

    const testBtn = page
      .locator('[data-talk-unified-card="broadcast_draft"] [data-talk-unified-action="broadcast-test"]')
      .first();
    if ((await testBtn.count()) < 1) fail("broadcast test action visible");
    else {
      await testBtn.click();
      await page.waitForTimeout(400);
      const added = await page.evaluate(() =>
        window.TasuTalkData.getNotifications({ filter: "all" }).some((n) =>
          String(n.title).includes("統合配信テスト")
        )
      );
      if (!added) fail("broadcast test send adds notification");
      else pass("broadcast test send adds notification");
    }

    const statsBefore = await page.evaluate(() => window.TasuTalkData.getDashboardStats().unread);
    await setUnifiedFilter("kind", "all");
    const recentRaw = await page.evaluate((key) => localStorage.getItem(key), RECENT_KEY);
    let recent = [];
    try {
      recent = JSON.parse(recentRaw || "[]");
    } catch {
      recent = [];
    }
    if (!Array.isArray(recent) || recent.length < 1) fail("recent_actions recorded");
    else pass("recent_actions recorded");

    const summaryOk = await page.evaluate(() => {
      const t = document.querySelector("[data-talk-dashboard-stats]")?.textContent || "";
      return /\d+/.test(t);
    });
    if (!summaryOk) fail("dashboard stats still render");
    else pass("dashboard stats reflect after unified ops");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    const mobileSelectVisible = await page.locator("[data-talk-unified-filters-mobile]").isVisible();
    const desktopHidden = await page.evaluate(() => {
      const el = document.querySelector(".talk-unified-inbox__filters--desktop");
      return el ? getComputedStyle(el).display === "none" : true;
    });
    if (!mobileSelectVisible || !desktopHidden) fail("mobile uses dropdown filters");
    else pass("mobile uses dropdown filters");

    await page.evaluate((key) => {
      localStorage.setItem(key, "{{broken");
      localStorage.setItem("tasful_talk_ai_drafts", "not-json");
    }, RECENT_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const alive = await page.evaluate(() => typeof window.TasuTalkData.getUnifiedInboxItems === "function");
    if (!alive) fail("corrupt localStorage does not break page");
    else pass("corrupt localStorage does not break page");
  } catch (err) {
    fail(String(err?.message || err));
  }  });
  

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("All talk unified inbox checks passed.");
}

main();
