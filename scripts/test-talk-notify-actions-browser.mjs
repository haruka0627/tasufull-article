#!/usr/bin/env node
/**
 * TASFUL TALK Phase15 — 通知カードアクション smoke test
 *
 *   node scripts/test-talk-notify-actions-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
    await page.waitForFunction(
      () =>
        typeof window.TasuTalkNotifyActions?.buildNotificationActions === "function" &&
        typeof window.TasuTalkNotifications?.hideNotification === "function"
    );

    await page.evaluate(() => {
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      const add = window.TasuTalkNotifications.add.bind(window.TasuTalkNotifications);
      add({
        id: "phase15-follow-action",
        type: "job",
        title: "フォロー求人アクション",
        body: "phase15-follow-marker",
        source: "follow",
        followTargetId: "phase15-job-target",
        followTargetType: "job",
        targetUrl: "detail-job.html?id=phase15-job-target",
        priority: "important",
      });
      add({
        id: "phase15-bcast-action",
        type: "system",
        title: "配信履歴テスト",
        body: "phase15-bcast-marker",
        source: "talk-broadcast-draft-send",
        broadcastDraftId: "talk-bcast-phase15-test",
        targetUrl: "talk-home.html?tab=notify",
      });
      add({
        id: "phase15-builder-action",
        type: "builder",
        title: "Builder通知",
        body: "phase15-builder-marker",
        source: "builder",
        priority: "urgent",
        targetUrl: "builder/mvp-threads.html",
      });
      window.TasuTalkFollowStore?.follow?.({
        id: "phase15-job-target",
        type: "job",
        userId: "u_me",
      });
      window.TasuTalkBroadcastDrafts?.add?.({
        id: "talk-bcast-phase15-test",
        kind: "ad",
        title: "Phase15配信テスト",
        body: "test",
        status: "sent",
      });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const actionCount = await page.locator("[data-talk-notify-action]").count();
    if (actionCount < 3) fail("notification action buttons rendered");
    else pass("notification action buttons rendered");

    const followActions = await page.evaluate(() => {
      const row = window.TasuTalkData.findNotificationById("phase15-follow-action");
      return window.TasuTalkNotifyActions.buildNotificationActions(row).map((a) => a.id);
    });
    if (!followActions.includes("follow-unfollow") || !followActions.includes("follow-notify-off")) {
      fail("follow source actions");
    } else pass("follow source actions");

    const jobActions = await page.evaluate(() => {
      const row = window.TasuTalkData.findNotificationById("phase15-follow-action");
      return window.TasuTalkNotifyActions.buildNotificationActions(row).some((a) => a.id === "view-job");
    });
    if (!jobActions) fail("job type actions");
    else pass("job type actions");

    await page.evaluate(() => window.TasuTalkData.markNotificationRead("phase15-follow-action"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const unreadBtn = page.locator('[data-talk-notify-id="phase15-follow-action"] [data-talk-notify-action="mark-unread"]');
    if (!(await unreadBtn.count())) fail("mark-unread button after read");
    else {
      await unreadBtn.click();
      const unread = await page.evaluate(() => {
        const row = window.TasuTalkData.findNotificationById("phase15-follow-action");
        return !row.readAt;
      });
      if (!unread) fail("mark unread works");
      else pass("mark unread works");
    }

    await page.evaluate(() => window.TasuTalkData.hideNotification("phase15-builder-action"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const hiddenVisible = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({ filter: "all" }).some((n) => n.id === "phase15-builder-action")
    );
    if (hiddenVisible) fail("hide removes from default list");
    else pass("hide removes from default list");

    await page.evaluate(() => {
      const s = window.TasuTalkNotificationSettings.read();
      s.showMuted = true;
      window.TasuTalkNotificationSettings.write(s);
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    const hiddenShown = await page.evaluate(() => {
      const settings = window.TasuTalkNotificationSettings.read();
      return window.TasuTalkData.getNotifications({
        filter: "all",
        showMuted: settings.showMuted === true,
      }).some((n) => n.id === "phase15-builder-action" && n.hiddenAt);
    });
    if (!hiddenShown) fail("showMuted shows user-hidden");
    else pass("showMuted shows user-hidden");

    await page.evaluate(() => window.TasuTalkFollowStore.unfollow("phase15-job-target", "job", "u_me"));

    const unfollowed = await page.evaluate(() =>
      !window.TasuTalkFollowStore.isFollowing("phase15-job-target", "job", "u_me")
    );
    if (!unfollowed) fail("follow unfollow updates store");
    else pass("follow unfollow updates store");

    await page.locator('[data-talk-notify-id="phase15-bcast-action"] [data-talk-notify-action="broadcast-history"]').click();
    await page.waitForTimeout(400);
    const onAi = await page.evaluate(() => {
      const tab = document.querySelector('[data-talk-tab="ai"]')?.classList.contains("is-active");
      const section = document.getElementById("talkBroadcastSection");
      return tab && section;
    });
    if (!onAi) fail("broadcast history navigates to AI tab");
    else pass("broadcast history navigates to AI tab");

    const corrupt = await page.evaluate(() => {
      localStorage.setItem("tasful_talk_notifications", "{{bad");
      return Array.isArray(window.TasuTalkNotifications.getAll());
    });
    if (!corrupt) fail("corrupt notifications safe");
    else pass("corrupt notifications safe");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll Phase15 notify action checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
