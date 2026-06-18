#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — フォロー通知フィルタ・バッジ smoke test
 *
 *   node scripts/test-talk-follow-filter-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const FOLLOW_KEY = "tasful_talk_notify_follow_only";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkData?.getNotifications === "function");

    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      window.TasuTalkNotifications?.add?.({
        id: "talk-follow-filter-job",
        type: "job",
        title: "フォローテスト求人",
        body: "follow-filter-marker-job",
        source: "follow",
        priority: "important",
        targetUrl: "detail-job.html?id=follow-filter-job",
      });
      window.TasuTalkNotifications?.add?.({
        id: "talk-follow-filter-system",
        type: "system",
        title: "通常運営通知",
        body: "follow-filter-marker-system",
        source: "tasful",
        priority: "normal",
        targetUrl: "dashboard.html",
      });
    }, FOLLOW_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    const allRows = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({ filter: "all", followOnly: false })
    );
    const hasFollow = allRows.some((n) => n.source === "follow" && n.body?.includes("follow-filter-marker-job"));
    const hasOther = allRows.some((n) => n.body?.includes("follow-filter-marker-system"));
    if (!hasFollow || !hasOther) fail("all mode shows follow and non-follow");
    else pass("all mode shows follow and non-follow");

    await page.locator("[data-talk-notify-follow-btn]").click();
    const followOnly = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({ filter: "all", followOnly: true })
    );
    if (!followOnly.every((n) => n.source === "follow")) fail("followOnly filters to follow source");
    else pass("followOnly filters to follow source");
    if (followOnly.some((n) => n.body?.includes("follow-filter-marker-system"))) {
      fail("followOnly excludes non-follow");
    } else pass("followOnly excludes non-follow");

    const badge = await page.locator(".talk-notify-follow-badge").count();
    if (badge < 1) fail("follow badge visible on cards");
    else pass("follow badge visible on cards");

    const urgentOk = await page.evaluate(() => {
      const row = window.TasuTalkData.getNotifications({ filter: "all", followOnly: true }).find((n) =>
        String(n.body).includes("follow-filter-marker-job")
      );
      return row?.priority === "important" && row?.unread === true;
    });
    if (!urgentOk) fail("follow notification priority/unread");
    else pass("follow notification priority/unread");

    await page.locator("[data-talk-notify-follow-btn]").click();
    const restored = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({ filter: "all", followOnly: false }).some((n) =>
        String(n.body).includes("follow-filter-marker-system")
      )
    );
    if (!restored) fail("follow filter OFF restores all");
    else pass("follow filter OFF restores all");

    const dash = await page.evaluate(() => window.TasuTalkData.getDashboardStats());
    if (typeof dash.followUnread !== "number") fail("dashboard followUnread stat");
    else pass("dashboard followUnread stat");

    const corrupt = await page.evaluate((key) => {
      localStorage.setItem(key, "{{bad");
      return typeof window.TasuTalkData.getNotifications({ followOnly: true }) === "object";
    }, FOLLOW_KEY);
    if (!corrupt) fail("corrupt follow filter pref safe");
    else pass("corrupt follow filter pref safe");

    await page.setViewportSize({ width: 390, height: 800 });
    const selectVisible = await page.locator("[data-talk-notify-follow-select]").isVisible();
    if (!selectVisible) fail("mobile follow select visible");
    else pass("mobile follow select visible");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll talk-follow-filter checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }  });
  
}

main();
