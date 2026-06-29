#!/usr/bin/env node
/**
 * TLV live_started → follower notification (dev fallback + UI)
 *   node scripts/test-tlv-live-started-notify-dev.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const CREATOR_ID = "u_store";
const FOLLOWER_ID = "u_me";
const NON_FOLLOWER_ID = "u_creator";
const BROADCAST_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-live-started-notify-dev";
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

function isBenignConsoleError(text) {
  return (
    /MIME type.*not executable/.test(text) ||
    /talkDev stub/.test(text) ||
    /Edge functions base URL/.test(text) ||
    /Supabase が未設定/.test(text) ||
    /\[TasuLiveBroadcasts\] watch/.test(text)
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
  trackConsole(page, "live-started-create");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.removeItem("tlvDevViewerId");
    window.TasuTlvDevAuth?.clearDevNotifyStore?.();
    window.TasuTlvDevAuth?.clearDevFollowStore?.();
  });

  const createCheck = await page.evaluate(
    async ({ broadcastId, creatorId, followerId, nonFollowerId }) => {
      window.TasuTlvDevAuth.setDevFollowStored(followerId, creatorId, true);

      const result = await window.TasuTlvNotificationService.createLiveStartedNotification({
        broadcastId,
        creatorId,
        creatorName: "Premium Store",
      });

      const raw = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
      const followerItems = await window.TasuTlvNotificationService.listNotifications(followerId);
      const creatorItems = await window.TasuTlvNotificationService.listNotifications(creatorId);
      const nonFollowerItems = await window.TasuTlvNotificationService.listNotifications(nonFollowerId);
      const liveRow = raw.find((r) => r.type === "live_started") || {};

      return {
        notifyOk: result?.ok === true,
        fanout: result?.fanout ?? 0,
        rawType: liveRow.type,
        rawTarget: liveRow.targetId,
        rawBroadcastId: liveRow.broadcastId,
        followerHasLive: followerItems.some((i) => i.kind === "live_started" || i.event === "live_started"),
        followerUnread: followerItems.some((i) => i.unread),
        creatorHasLive: creatorItems.some((i) => i.kind === "live_started" || i.event === "live_started"),
        nonFollowerHasLive: nonFollowerItems.some(
          (i) => i.kind === "live_started" || i.event === "live_started",
        ),
        idFormat: liveRow.id,
      };
    },
    {
      broadcastId: BROADCAST_ID,
      creatorId: CREATOR_ID,
      followerId: FOLLOWER_ID,
      nonFollowerId: NON_FOLLOWER_ID,
    },
  );

  results.push({
    step: "live-started-creates-notify",
    ...createCheck,
    pass:
      createCheck.notifyOk &&
      createCheck.fanout >= 1 &&
      createCheck.rawType === "live_started" &&
      createCheck.rawTarget === FOLLOWER_ID &&
      createCheck.rawBroadcastId === BROADCAST_ID &&
      createCheck.followerHasLive &&
      createCheck.followerUnread &&
      !createCheck.creatorHasLive &&
      !createCheck.nonFollowerHasLive &&
      createCheck.idFormat === `live-n-live-started:${BROADCAST_ID}:${CREATOR_ID}:${FOLLOWER_ID}`,
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
      const liveRows = rows.filter((el) => el.textContent.includes("ライブ配信を開始"));
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        liveCount: liveRows.length,
        unreadCount: rows.filter((el) => el.classList.contains("tlv-notifications-row--unread")).length,
        liveText: liveRows[0]?.textContent?.trim() || null,
      };
    });

    await page.locator('[data-tlv-notifications-filter="live"]').first().click().catch(() => null);
    await page.waitForTimeout(400);
    const liveFilter = await page.evaluate(() => {
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

    await page.screenshot({ path: `${OUT}/notifications-live-${width}.png`, fullPage: false });
    results.push({
      step: `notifications-page-${width}`,
      ...data,
      ...liveFilter,
      pass:
        data.scrollW === data.innerW &&
        data.liveCount >= 1 &&
        data.unreadCount >= 1 &&
        liveFilter.filterRows >= 1,
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
      liveText:
        [...document.querySelectorAll(".tlv-notify-menu__text")]
          .map((el) => el.textContent.trim())
          .find((t) => t.includes("ライブ配信を開始")) || null,
      ariaLabel: document.querySelector("[data-tlv-notify-menu-toggle]")?.getAttribute("aria-label") || null,
    }));
    await page.screenshot({ path: `${OUT}/notify-panel-live-${width}.png`, fullPage: false });
    results.push({
      step: `header-panel-${width}`,
      ...panel,
      pass:
        panel.scrollW === panel.innerW &&
        panel.items >= 1 &&
        panel.unreadDots >= 1 &&
        panel.liveText?.includes("ライブ配信を開始"),
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
    ({ broadcastId, href, followerId }) => ({
      hrefOk:
        String(href || "").includes(`watch.html?broadcast_id=${broadcastId}`) ||
        String(href || "").includes(`broadcast_id=${encodeURIComponent(broadcastId)}`),
      read: (
        JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").find(
          (r) => r.type === "live_started" && r.targetId === followerId,
        ) || {}
      ).read === true,
    }),
    { broadcastId: BROADCAST_ID, href: hrefBefore, followerId: FOLLOWER_ID },
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
