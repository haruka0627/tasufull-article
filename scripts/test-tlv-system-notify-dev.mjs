#!/usr/bin/env node
/**
 * TLV system → target user notification (dev fallback + UI)
 *   node scripts/test-tlv-system-notify-dev.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const TARGET_ID = "u_me";
const OTHER_ID = "u_store";
const NON_TARGET_ID = "u_creator";
const TARGET_URL = "settings.html";
const SYSTEM_TITLE = "メンテナンスのお知らせ";
const SYSTEM_BODY = "6/25 02:00–04:00 にメンテナンスを実施します。";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-system-notify-dev";
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
  trackConsole(page, "system-create");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    localStorage.removeItem("tlvDevViewerId");
    window.TasuTlvDevAuth?.clearDevNotifyStore?.();
  });

  const createCheck = await page.evaluate(
    async ({ targetUserId, otherId, nonTargetId, title, body, targetUrl }) => {
      const result = await window.TasuTlvNotificationService.createSystemNotification({
        targetUserId,
        title,
        body,
        priority: "high",
        targetUrl,
      });

      const raw = JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]");
      const targetItems = await window.TasuTlvNotificationService.listNotifications(targetUserId);
      const otherItems = await window.TasuTlvNotificationService.listNotifications(otherId);
      const nonTargetItems = await window.TasuTlvNotificationService.listNotifications(nonTargetId);
      const systemRow = raw.find((r) => r.type === "system") || {};

      return {
        notifyOk: result?.ok === true,
        rawType: systemRow.type,
        rawTarget: systemRow.targetId,
        rawTitle: systemRow.systemTitle || systemRow.title,
        rawTargetUrl: systemRow.targetUrl,
        idFormat: systemRow.id,
        targetHasSystem: targetItems.some((i) => i.kind === "system" || i.event === "system"),
        targetUnread: targetItems.some((i) => i.unread),
        otherHasSystem: otherItems.some((i) => i.kind === "system" || i.event === "system"),
        nonTargetHasSystem: nonTargetItems.some((i) => i.kind === "system" || i.event === "system"),
      };
    },
    {
      targetUserId: TARGET_ID,
      otherId: OTHER_ID,
      nonTargetId: NON_TARGET_ID,
      title: SYSTEM_TITLE,
      body: SYSTEM_BODY,
      targetUrl: TARGET_URL,
    },
  );

  results.push({
    step: "system-creates-notify",
    ...createCheck,
    pass:
      createCheck.notifyOk &&
      createCheck.rawType === "system" &&
      createCheck.rawTarget === TARGET_ID &&
      createCheck.rawTitle === SYSTEM_TITLE &&
      String(createCheck.rawTargetUrl || "").includes(TARGET_URL) &&
      /^live-n-system:u_me:\d+$/.test(String(createCheck.idFormat || "")) &&
      createCheck.targetHasSystem &&
      createCheck.targetUnread &&
      !createCheck.otherHasSystem &&
      !createCheck.nonTargetHasSystem,
  });

  await page.close();
}

{
  const page = await context.newPage();
  trackConsole(page, "ui-target");
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate((targetUserId) => localStorage.setItem("tlvDevViewerId", targetUserId), TARGET_ID);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/notifications.html?talkDev=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(({ title, body }) => {
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
      const systemRows = rows.filter((el) => el.textContent.includes(title));
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        systemCount: systemRows.length,
        unreadCount: rows.filter((el) => el.classList.contains("tlv-notifications-row--unread")).length,
        systemText: systemRows[0]?.textContent?.trim() || null,
        hasBody: systemRows[0]?.textContent?.includes(body) || false,
        hasImportant: systemRows[0]?.textContent?.includes("重要") || false,
      };
    }, { title: SYSTEM_TITLE, body: SYSTEM_BODY });

    await page.locator('[data-tlv-notifications-filter="system"]').first().click().catch(() => null);
    await page.waitForTimeout(400);
    const systemFilter = await page.evaluate((title) => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const rows = [...document.querySelectorAll(".tlv-notifications-row")].filter(visible);
      return {
        filterRows: rows.length,
        filterHasTitle: rows.some((el) => el.textContent.includes(title)),
      };
    }, SYSTEM_TITLE);

    await page.screenshot({ path: `${OUT}/notifications-system-${width}.png`, fullPage: false });
    results.push({
      step: `notifications-page-${width}`,
      ...data,
      ...systemFilter,
      pass:
        data.scrollW === data.innerW &&
        data.systemCount >= 1 &&
        data.unreadCount >= 1 &&
        data.hasBody &&
        data.hasImportant &&
        systemFilter.filterRows >= 1 &&
        systemFilter.filterHasTitle,
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
    const panel = await page.evaluate((title) => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      items: document.querySelectorAll(".tlv-notify-menu__item").length,
      unreadDots: document.querySelectorAll(".tlv-notify-menu__dot:not(.tlv-notify-menu__dot--read)").length,
      systemText:
        [...document.querySelectorAll(".tlv-notify-menu__text")]
          .map((el) => el.textContent.trim())
          .find((t) => t.includes(title)) || null,
    }), SYSTEM_TITLE);
    await page.screenshot({ path: `${OUT}/notify-panel-system-${width}.png`, fullPage: false });
    results.push({
      step: `header-panel-${width}`,
      ...panel,
      pass:
        panel.scrollW === panel.innerW &&
        panel.items >= 1 &&
        panel.unreadDots >= 1 &&
        panel.systemText?.includes(SYSTEM_TITLE),
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
    ({ targetUserId, href }) => ({
      hrefOk: String(href || "").includes("settings.html"),
      read: (
        JSON.parse(localStorage.getItem("tlvDevNotifications") || "[]").find(
          (r) => r.type === "system" && r.targetId === targetUserId,
        ) || {}
      ).read === true,
    }),
    { targetUserId: TARGET_ID, href: hrefBefore },
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
