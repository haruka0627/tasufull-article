#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — フォロー → 更新通知 smoke test
 *
 *   node scripts/test-talk-follow-notify-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const MARKER = "talk-follow-notify-test";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];

  const pass = (msg) => console.log(`  ✓ ${msg}`);
  const fail = (msg) => {
    errors.push(msg);
    console.log(`  ✗ ${msg}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(
      () =>
        typeof window.TasuTalkFollowStore?.follow === "function" &&
        typeof window.TasuTalkFollowNotify?.notifyFollowers === "function"
    );

    await page.evaluate(() => {
      localStorage.removeItem("tasful_talk_follow_store");
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      localStorage.removeItem("tasful_talk_notify_fanout");
    });

    const followOk = await page.evaluate(
      ({ marker }) => {
        const row = window.TasuTalkFollowStore.follow({
          id: "test-job-follow-001",
          type: "job",
          title: "テスト求人フォロー",
          targetUrl: "detail-job.html?id=test-job-follow-001",
          userId: "u_me",
        });
        return Boolean(row?.ok && window.TasuTalkFollowStore.isFollowing("test-job-follow-001", "job", "u_me"));
      },
      { marker: MARKER }
    );
    if (!followOk) fail("follow registration");
    else pass("follow registration");

    const delivered = await page.evaluate(
      ({ marker }) =>
        window.TasuTalkFollowNotify.notifyFollowers({
          targetId: "test-job-follow-001",
          type: "job",
          event: "update",
          targetUrl: "detail-job.html?id=test-job-follow-001",
          body: `${marker}-body`,
          title: `${marker}-title`,
        }),
      { marker: MARKER }
    );
    if (!delivered?.ok) fail("notifyFollowers deliver");
    else pass("notifyFollowers deliver");

    const found = await page.evaluate(
      ({ marker }) => {
        const list = window.TasuTalkData?.getNotifications?.({ filter: "job" }) || [];
        return list.some(
          (n) =>
            n.source === "follow" &&
            String(n.body || "").includes(marker) &&
            n.priority === "important"
        );
      },
      { marker: MARKER }
    );
    if (!found) fail("notification visible in job filter");
    else pass("notification visible in job filter");

    const unfollowOk = await page.evaluate(() => {
      window.TasuTalkFollowStore.unfollow("test-job-follow-001", "job", "u_me");
      return !window.TasuTalkFollowStore.isFollowing("test-job-follow-001", "job", "u_me");
    });
    if (!unfollowOk) fail("unfollow disables follow");
    else pass("unfollow disables follow");

    const noSecond = await page.evaluate(
      ({ marker }) =>
        window.TasuTalkFollowNotify
          .notifyFollowers({
            targetId: "test-job-follow-001",
            type: "job",
            body: `${marker}-after-unfollow`,
          })
          .then((r) => r?.delivered === 0 || r?.reason === "no_followers"),
      { marker: MARKER }
    );
    if (!noSecond) fail("no notify after unfollow");
    else pass("no notify after unfollow");

    const corruptOk = await page.evaluate(() => {
      localStorage.setItem("tasful_talk_follow_store", "{{not-json");
      const list = window.TasuTalkFollowStore.readAll();
      return Array.isArray(list) && list.length === 0;
    });
    if (!corruptOk) fail("corrupt localStorage safe read");
    else pass("corrupt localStorage safe read");

    await page.goto(`${BASE}/detail-job.html?id=demo-job-001`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuFavoriteStore?.toggleListing === "function");

    await page.evaluate(() => {
      if (window.TasuFavoriteStore.isFavorited("test-job-fav-sync-002")) {
        window.TasuFavoriteStore.removeByListingId("test-job-fav-sync-002");
      }
      window.TasuFavoriteActions.toggleFavorite({
        id: "test-job-fav-sync-002",
        title: "お気に入り連携テスト",
        listing_type: "job",
      });
    });
    const favSync = await page.evaluate(() =>
      window.TasuTalkFollowStore.isFollowing("test-job-fav-sync-002", "job", "u_me")
    );
    if (!favSync) fail("favorite toggle syncs talk follow");
    else pass("favorite toggle syncs talk follow");

    await page.evaluate(() => {
      window.TasuFavoriteActions.toggleFavorite({
        id: "test-job-fav-sync-002",
        title: "お気に入り連携テスト",
        listing_type: "job",
      });
    });
    const favUnsync = await page.evaluate(() =>
      !window.TasuTalkFollowStore.isFollowing("test-job-fav-sync-002", "job", "u_me")
    );
    if (!favUnsync) fail("favorite remove clears talk follow");
    else pass("favorite remove clears talk follow");

    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const hiddenRespects = await page.evaluate(
      ({ marker }) => {
        window.TasuTalkFollowStore.follow({
          id: "test-job-settings-003",
          type: "job",
          userId: "u_me",
        });
        window.TasuTalkFollowNotify.notifyFollowers({
          targetId: "test-job-settings-003",
          type: "job",
          body: `${marker}-settings`,
        });
        const settings = window.TasuTalkNotificationSettings.read();
        settings.types.job = false;
        window.TasuTalkNotificationSettings.write(settings);
        const visible = window.TasuTalkData.getNotifications({ filter: "job" });
        const hidden = window.TasuTalkData.countHiddenBySettings?.() ?? 0;
        return {
          visibleCount: visible.filter((n) => String(n.body || "").includes(`${marker}-settings`))
            .length,
          hiddenAtLeast: hidden >= 1,
        };
      },
      { marker: MARKER }
    );
    if (!hiddenRespects.hiddenAtLeast) fail("Phase9 settings hide follow notifications");
    else pass("Phase9 settings hide follow notifications");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll talk-follow-notify checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }  });
  
}

main();
