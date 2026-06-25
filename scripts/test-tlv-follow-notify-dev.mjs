#!/usr/bin/env node
/**
 * TLV follow → notification (dev fallback + UI + read)
 *   node scripts/test-tlv-follow-notify-dev.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-follow-notify-dev";
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

function isBenignConsoleError(text) {
  return /MIME type.*not executable/.test(text);
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

const browser = await chromium.launch();
const context = await browser.newContext();

// ① A (u_me) follows B (u_store) → ② notification for B
{
  const page = await context.newPage();
  trackConsole(page, "follow-ab");
  await page.goto(`${BASE}/profile.html?userId=u_store&talkDev=1`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.removeItem("tlvDevViewerId");
    window.TasuTlvDevAuth?.clearDevFollowStore?.();
    window.TasuTlvDevAuth?.clearDevNotifyStore?.();
  });
  await page.waitForTimeout(800);

  const followBtn = page.locator('[data-live-follow-btn][data-following="0"]').first();
  if ((await followBtn.count()) > 0) {
    await followBtn.click();
    await page.waitForTimeout(600);
  } else {
    await page.evaluate(async () => {
      await window.TasuLiveFollow?.follow?.("u_store");
    });
  }

  const abCheck = await page.evaluate(async () => {
    const store = window.TasuTlvDevAuth?.getDevNotificationsForUser?.("u_store") || [];
    const rawStore = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
    const items = await window.TasuTlvNotificationService?.listNotifications?.("u_store");
    const first = rawStore[0] || {};
    return {
      storeCount: store.length,
      rawFormat: first.type === "follow" && first.actorId === "u_me" && first.targetId === "u_store",
      typeFollow: first.type === "follow",
      actorId: first.actorId,
      targetUserId: first.targetId,
      itemsFollow: (items || []).some((i) => i.type === "follow" || i.kind === "follow"),
      unread: (items || []).some((i) => i.unread),
    };
  });

  results.push({
    step: "a-follows-b-notify",
    ...abCheck,
    pass:
      abCheck.storeCount >= 1 &&
      abCheck.rawFormat &&
      abCheck.typeFollow &&
      abCheck.actorId === "u_me" &&
      abCheck.targetUserId === "u_store" &&
      abCheck.itemsFollow &&
      abCheck.unread,
  });
  await page.close();
}

// ③④⑤ View as B — header + notifications page (unread)
{
  const page = await context.newPage();
  trackConsole(page, "ui-b-viewer");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.setItem("tlvDevViewerId", "u_store");
  });

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".tlv-notifications-row")];
      const followRows = rows.filter((el) => el.textContent.includes("フォロー"));
      const unreadRows = rows.filter((el) => el.classList.contains("tlv-notifications-row--unread"));
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        guest: Boolean(document.querySelector(".tlv-notifications-guest")),
        rowCount: rows.length,
        followCount: followRows.length,
        unreadCount: unreadRows.length,
        followText: followRows[0]?.textContent?.trim() || null,
      };
    });

    await page.locator('[data-tlv-notifications-filter="follow"]').first().click().catch(() => null);
    await page.waitForTimeout(400);
    const followFilter = await page.evaluate(() => ({
      followFilterRows: document.querySelectorAll(".tlv-notifications-row").length,
    }));

    await page.screenshot({ path: `${OUT}/notifications-follow-${width}.png`, fullPage: false });

    results.push({
      step: `notifications-page-${width}`,
      ...data,
      ...followFilter,
      pass:
        !data.guest &&
        data.scrollW === data.innerW &&
        data.followCount >= 1 &&
        data.unreadCount >= 1 &&
        followFilter.followFilterRows >= 1,
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
      followText:
        [...document.querySelectorAll(".tlv-notify-menu__text")]
          .map((el) => el.textContent.trim())
          .find((t) => t.includes("フォロー")) || null,
      ariaLabel:
        document.querySelector("[data-tlv-notify-menu-toggle]")?.getAttribute("aria-label") || null,
    }));

    await page.screenshot({ path: `${OUT}/notify-panel-${width}.png`, fullPage: false });
    results.push({
      step: `header-panel-${width}`,
      ...panel,
      pass:
        panel.scrollW === panel.innerW &&
        panel.items >= 1 &&
        panel.unreadDots >= 1 &&
        panel.followText?.includes("フォロー") &&
        panel.ariaLabel?.includes("未読"),
    });
  }

  // ⑥ mark read on notifications page
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const unreadBefore = await page.locator(".tlv-notifications-row--unread:visible").count();
  const link = page.locator("[data-tlv-notification-id]:visible").first();
  if ((await link.count()) > 0) {
    await link.click({ force: true });
    await page.waitForTimeout(800);
  }
  await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const readAfter = await page.evaluate(() => ({
    unreadRows: document.querySelectorAll(".tlv-notifications-row--unread").length,
    storeRead: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
        return raw.filter((r) => String(r.targetId || "") === "u_store").every((r) => r.read === true);
      } catch {
        return false;
      }
    })(),
  }));
  results.push({
    step: "mark-read-on-open",
    unreadBefore,
    ...readAfter,
    pass: unreadBefore >= 1 && readAfter.unreadRows === 0 && readAfter.storeRead,
  });

  await page.close();
}

// Guest notifications.html (localhost dev guest)
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
    title: document.querySelector(".tlv-notifications-guest__title")?.textContent?.trim() || null,
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  results.push({
    step: "guest-ui",
    ...guest,
    pass: guest.hasGuest && guest.title?.includes("ログイン") && guest.scrollW === guest.innerW,
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
