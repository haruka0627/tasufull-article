#!/usr/bin/env node
/**
 * TLV video_published → follower notification (dev fallback + UI)
 *   node scripts/test-tlv-video-published-notify-dev.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const CREATOR_ID = "u_store";
const FOLLOWER_ID = "u_me";
const NON_FOLLOWER_ID = "u_creator";
const VIDEO_ID = "b2c3d4e5-f6a7-4890-b123-456789abcdef";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-video-published-notify-dev";
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

function isBenignConsoleError(text) {
  return (
    /MIME type.*not executable/.test(text) ||
    /talkDev stub/.test(text) ||
    /Edge functions base URL/.test(text) ||
    /Supabase が未設定/.test(text)
  );
}

function trackConsole(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
      consoleErrors.push(`[${label}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${label}][pageerror] ${err.message}`);
  });
}

async function clickVisibleNotificationLink(page) {
  await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const shells = [
      document.querySelector("[data-tlv-mobile-shell]"),
      document.querySelector("[data-tlv-desktop-shell]"),
      document.body,
    ].filter(Boolean);
    for (const shell of shells) {
      if (!visible(shell)) continue;
      const link = shell.querySelector("[data-tlv-notification-id]");
      if (link && visible(link)) {
        link.click();
        return;
      }
    }
  });
}

const browser = await chromium.launch();
const context = await browser.newContext();

{
  const page = await context.newPage();
  trackConsole(page, "video-published-create");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.removeItem("tlvDevViewerId");
    window.TasuTlvDevAuth?.clearDevNotifyStore?.();
    window.TasuTlvDevAuth?.clearDevFollowStore?.();
  });

  const createCheck = await page.evaluate(
    async ({ videoId, creatorId, followerId, nonFollowerId }) => {
      window.TasuTlvDevAuth.setDevFollowStored(followerId, creatorId, true);

      const result = await window.TasuTlvNotificationService.createVideoPublishedNotification({
        videoId,
        creatorId,
        creatorName: "Premium Store",
        title: "New Upload Test",
      });

      const raw = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
      const followerItems = await window.TasuTlvNotificationService.listNotifications(followerId);
      const creatorItems = await window.TasuTlvNotificationService.listNotifications(creatorId);
      const nonFollowerItems = await window.TasuTlvNotificationService.listNotifications(nonFollowerId);
      const videoRow = raw.find((r) => r.type === "video_published") || {};

      return {
        notifyOk: result?.ok === true,
        fanout: result?.fanout ?? 0,
        rawType: videoRow.type,
        rawTarget: videoRow.targetId,
        rawVideoId: videoRow.videoId,
        followerHasVideo: followerItems.some(
          (i) => i.kind === "video_published" || i.event === "video_published",
        ),
        followerUnread: followerItems.some((i) => i.unread),
        creatorHasVideo: creatorItems.some(
          (i) => i.kind === "video_published" || i.event === "video_published",
        ),
        nonFollowerHasVideo: nonFollowerItems.some(
          (i) => i.kind === "video_published" || i.event === "video_published",
        ),
        idFormat: videoRow.id,
        targetUrl: videoRow.targetUrl,
      };
    },
    {
      videoId: VIDEO_ID,
      creatorId: CREATOR_ID,
      followerId: FOLLOWER_ID,
      nonFollowerId: NON_FOLLOWER_ID,
    },
  );

  results.push({
    step: "video-published-creates-notify",
    ...createCheck,
    pass:
      createCheck.notifyOk &&
      createCheck.fanout >= 1 &&
      createCheck.rawType === "video_published" &&
      createCheck.rawTarget === FOLLOWER_ID &&
      createCheck.rawVideoId === VIDEO_ID &&
      createCheck.followerHasVideo &&
      createCheck.followerUnread &&
      !createCheck.creatorHasVideo &&
      !createCheck.nonFollowerHasVideo &&
      createCheck.idFormat === `live-n-video-published:${VIDEO_ID}:${CREATOR_ID}:${FOLLOWER_ID}` &&
      String(createCheck.targetUrl || "").includes(`watch-video.html?id=${VIDEO_ID}`),
  });

  await page.close();
}

{
  const page = await context.newPage();
  trackConsole(page, "ui-follower");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate((followerId) => localStorage.setItem("tlvDevViewerId", followerId), FOLLOWER_ID);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const shells = [
        document.querySelector("[data-tlv-mobile-shell]"),
        document.querySelector("[data-tlv-desktop-shell]"),
        document.body,
      ].filter(Boolean);
      let rows = [];
      for (const shell of shells) {
        if (!visible(shell)) continue;
        rows = [...shell.querySelectorAll(".tlv-notifications-row")].filter(visible);
        if (rows.length) break;
      }
      const videoRows = rows.filter((el) => el.textContent.includes("新しい動画を公開"));
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        videoCount: videoRows.length,
        unreadCount: rows.filter((el) => el.classList.contains("tlv-notifications-row--unread")).length,
        videoText: videoRows[0]?.textContent?.trim() || null,
      };
    });

    await page.locator('[data-tlv-notifications-filter="video"]').first().click().catch(() => null);
    await page.waitForTimeout(400);
    const videoFilter = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      return {
        filterRows: [...document.querySelectorAll(".tlv-notifications-row")].filter(visible).length,
      };
    });

    await page.screenshot({ path: `${OUT}/notifications-video-${width}.png`, fullPage: false });
    results.push({
      step: `notifications-page-${width}`,
      ...data,
      ...videoFilter,
      pass:
        data.scrollW === data.innerW &&
        data.videoCount >= 1 &&
        data.unreadCount >= 1 &&
        videoFilter.filterRows >= 1,
    });
  }

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const toggleSel = "[data-tlv-notify-menu-toggle]:visible";
    if ((await page.locator(toggleSel).count()) > 0) {
      await page.locator(toggleSel).first().click();
      await page.waitForSelector(".tlv-notify-menu__item, .tlv-notify-menu__empty", { timeout: 15000 });
      await page.waitForTimeout(400);
    }
    const panel = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      items: document.querySelectorAll(".tlv-notify-menu__item").length,
      unreadDots: document.querySelectorAll(".tlv-notify-menu__dot:not(.tlv-notify-menu__dot--read)").length,
      videoText:
        [...document.querySelectorAll(".tlv-notify-menu__text")]
          .map((el) => el.textContent.trim())
          .find((t) => t.includes("新しい動画を公開")) || null,
      ariaLabel: document.querySelector("[data-tlv-notify-menu-toggle]")?.getAttribute("aria-label") || null,
    }));
    await page.screenshot({ path: `${OUT}/notify-panel-video-${width}.png`, fullPage: false });
    results.push({
      step: `header-panel-${width}`,
      ...panel,
      pass:
        panel.scrollW === panel.innerW &&
        panel.items >= 1 &&
        panel.unreadDots >= 1 &&
        panel.videoText?.includes("新しい動画を公開"),
    });
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const hrefBefore = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const link = [...document.querySelectorAll("[data-tlv-notification-id]")].find(visible);
    return link?.getAttribute("href") || null;
  });

  await clickVisibleNotificationLink(page);
  await page.waitForTimeout(800);

  const readCheck = await page.evaluate(
    ({ videoId, href, followerId }) => ({
      hrefOk: String(href || "").includes(`watch-video.html?id=${videoId}`),
      read: (
        JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").find(
          (r) => r.type === "video_published" && r.targetId === followerId,
        ) || {}
      ).read === true,
    }),
    { videoId: VIDEO_ID, href: hrefBefore, followerId: FOLLOWER_ID },
  );

  results.push({
    step: "read-and-navigate",
    hrefBefore,
    ...readCheck,
    pass: readCheck.hrefOk && readCheck.read === true,
  });

  await page.close();
}

{
  const guestContext = await browser.newContext();
  await guestContext.addInitScript(() => localStorage.setItem("tlvDevForceGuest", "1"));
  const page = await guestContext.newPage();
  trackConsole(page, "guest");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/notifications.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const guest = await page.evaluate(() => ({
    hasGuest: Boolean(document.querySelector(".tlv-notifications-guest")),
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  results.push({
    step: "guest-ui",
    ...guest,
    pass: guest.hasGuest && guest.scrollW === guest.innerW,
  });
  await page.close();
  await guestContext.close();
}

await context.close();
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(
  JSON.stringify(
    {
      results,
      failed: failed.map((r) => r.step),
      consoleErrorCount: consoleErrors.length,
      consoleErrors: [...new Set(consoleErrors)],
    },
    null,
    2,
  ),
);
process.exit(failed.length || consoleErrors.length ? 1 : 0);
