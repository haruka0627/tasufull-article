#!/usr/bin/env node
/**
 * TLV comment → notification (dev fallback + UI)
 *   node scripts/test-tlv-comment-notify-dev.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const CREATOR_ID = "u_store";
const ACTOR_ID = "u_me";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-comment-notify-dev";
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
  trackConsole(page, "comment-create");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.removeItem("tlvDevViewerId");
    window.TasuTlvDevAuth?.clearDevNotifyStore?.();
  });

  const createCheck = await page.evaluate(
    async ({ videoId, creatorId, actorId }) => {
      const result = await window.TasuLiveVideoComments.postComment({
        videoId,
        creatorId,
        body: "Playwright test comment",
      });
      const raw = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
      const items = await window.TasuTlvNotificationService.listNotifications(creatorId);
      const first = raw.find((r) => r.type === "comment") || {};
      return {
        postOk: result?.ok === true,
        rawType: first.type,
        rawActor: first.actorId,
        rawTarget: first.targetId || first.user_id,
        rawVideoId: first.videoId,
        itemsComment: items.some((i) => i.type === "comment" || i.kind === "comment"),
        unread: items.some((i) => i.unread),
        actorMatch: first.actorId === actorId,
      };
    },
    { videoId: VIDEO_ID, creatorId: CREATOR_ID, actorId: ACTOR_ID },
  );

  results.push({
    step: "comment-creates-notify",
    ...createCheck,
    pass:
      createCheck.postOk &&
      createCheck.rawType === "comment" &&
      createCheck.actorMatch &&
      createCheck.rawTarget === CREATOR_ID &&
      createCheck.rawVideoId === VIDEO_ID &&
      createCheck.itemsComment &&
      createCheck.unread,
  });

  const selfCheck = await page.evaluate(
    async ({ videoId, creatorId }) => {
      localStorage.setItem("tlvDevViewerId", creatorId);
      const before = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").length;
      const result = await window.TasuLiveVideoComments.postComment({
        videoId,
        creatorId,
        body: "Self comment should skip",
      });
      const after = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").length;
      return {
        skipped: result?.skipped === true || result?.reason === "self_comment",
        countSame: after === before,
      };
    },
    { videoId: VIDEO_ID, creatorId: CREATOR_ID },
  );

  results.push({
    step: "self-comment-skipped",
    ...selfCheck,
    pass: selfCheck.skipped && selfCheck.countSame,
  });

  await page.close();
}

{
  const page = await context.newPage();
  trackConsole(page, "ui-creator");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate((creatorId) => localStorage.setItem("tlvDevViewerId", creatorId), CREATOR_ID);

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
      const commentRows = rows.filter((el) => el.textContent.includes("コメント"));
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        commentCount: commentRows.length,
        unreadCount: rows.filter((el) => el.classList.contains("tlv-notifications-row--unread")).length,
        commentText: commentRows[0]?.textContent?.trim() || null,
      };
    });

    await page.locator('[data-tlv-notifications-filter="comment"]').first().click().catch(() => null);
    await page.waitForTimeout(400);
    const commentFilter = await page.evaluate(() => {
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

    await page.screenshot({ path: `${OUT}/notifications-comment-${width}.png`, fullPage: false });
    results.push({
      step: `notifications-page-${width}`,
      ...data,
      ...commentFilter,
      pass:
        data.scrollW === data.innerW &&
        data.commentCount >= 1 &&
        data.unreadCount >= 1 &&
        commentFilter.filterRows >= 1,
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
      commentText:
        [...document.querySelectorAll(".tlv-notify-menu__text")]
          .map((el) => el.textContent.trim())
          .find((t) => t.includes("コメント")) || null,
      ariaLabel: document.querySelector("[data-tlv-notify-menu-toggle]")?.getAttribute("aria-label") || null,
    }));
    await page.screenshot({ path: `${OUT}/notify-panel-comment-${width}.png`, fullPage: false });
    results.push({
      step: `header-panel-${width}`,
      ...panel,
      pass:
        panel.scrollW === panel.innerW &&
        panel.items >= 1 &&
        panel.unreadDots >= 1 &&
        panel.commentText?.includes("コメント"),
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
    ({ videoId, href }) => ({
      hrefOk: String(href || "").includes(`watch-video.html?id=${videoId}`),
      read: (JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").find((r) => r.type === "comment") || {})
        .read === true,
    }),
    { videoId: VIDEO_ID, href: hrefBefore },
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
