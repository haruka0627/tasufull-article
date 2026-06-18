#!/usr/bin/env node
/**
 * TASFUL TALK — 通知UX / 安否リアルタイム / 統合ビュー smoke test
 *
 *   node scripts/test-talk-notify-ux-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  
    await page.goto(`${BASE}/talk-home.html`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkData?.getDashboardStats === "function");
    await page.evaluate(() => {
      window.__TASU_TALK_SKIP_ACTION_CONFIRM = true;
    });
    page.on("dialog", (d) => d.accept());

    const baseline = await page.evaluate(() => {
      const s = window.TasuTalkData.getDashboardStats();
      return { unread: s.unread, anpiUnread: s.anpiUnread, urgent: s.urgent };
    });

    const anpiId = `ux-anpi-${Date.now()}`;
    await page.evaluate(
      ({ id }) => {
        localStorage.removeItem("tasful_talk_notifications_seeded_v2");
        window.TasuTalkNotifications?.add?.({
          id,
          type: "anpi",
          title: "安否UXテスト",
          body: "ux-anpi-realtime-marker",
          source: "anpi",
          priority: "urgent",
          targetUrl: "anpi-dashboard.html",
        });
      },
      { id: anpiId }
    );

    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-talk-stat-key="anpiUnread"] .talk-dashboard-stat__value');
        return el && Number(el.textContent) > 0;
      },
      { timeout: 8000 }
    );

    const afterAnpi = await page.evaluate(() => {
      const s = window.TasuTalkData.getDashboardStats();
      const pulse = document.querySelector('[data-talk-stat-key="anpiUnread"].talk-dashboard-stat--pulse');
      const firstNotify = document.querySelector("[data-talk-notify-list] .talk-notify-card");
      return {
        anpiUnread: s.anpiUnread,
        urgent: s.urgent,
        hasPulse: Boolean(pulse),
        listHasAnpi: Boolean(
          document.querySelector(".talk-unified-inbox-card--anpi, .talk-notify-card--anpi")
        ),
      };
    });

    if (afterAnpi.anpiUnread <= baseline.anpiUnread) fail("anpi unread stat increased");
    else pass(`anpi unread stat (${afterAnpi.anpiUnread})`);

    const statIncreased = afterAnpi.anpiUnread > baseline.anpiUnread;
    if (!afterAnpi.hasPulse && !statIncreased) fail("dashboard stat pulse or anpi increase");
    else if (afterAnpi.hasPulse) pass("dashboard stat pulse on increase");
    else pass(`anpi stat increased (${baseline.anpiUnread} → ${afterAnpi.anpiUnread})`);

    await page.click('[data-talk-tab="notify"]');
    await page.waitForTimeout(200);

    const notifyTop = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-talk-notify-list] .talk-notify-card")];
      const idx = cards.findIndex((c) => c.textContent.includes("ux-anpi-realtime-marker"));
      const hasUrgentClass = cards.some((c) => c.classList.contains("talk-notify-card--urgent"));
      return { idx, hasUrgentClass, count: cards.length };
    });

    if (notifyTop.idx < 0) fail("anpi notification visible in notify tab");
    else if (notifyTop.idx > 2) fail(`anpi not near top (index ${notifyTop.idx})`);
    else pass(`anpi near top of notify list (index ${notifyTop.idx})`);

    if (!notifyTop.hasUrgentClass) fail("notify card urgent emphasis class");
    else pass("notify card urgent emphasis class");

    await page.click("[data-talk-notify-anpi-only]");
    await page.waitForTimeout(250);
    const anpiFilter = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-talk-notify-list] .talk-notify-card")];
      const allAnpi = cards.every((c) => c.classList.contains("talk-notify-card--anpi"));
      const summary = document.querySelector("[data-talk-notify-summary]")?.textContent || "";
      return { count: cards.length, allAnpi, summary };
    });
    if (anpiFilter.count < 1 || !anpiFilter.allAnpi) fail("anpi-only notify filter");
    else pass("anpi-only notify filter");
    if (!anpiFilter.summary.includes("安否のみ")) fail("notify summary shows quick filter");
    else pass("notify summary shows quick filter");

    await page.click("[data-talk-notify-anpi-only]");
    await page.click("[data-talk-notify-urgent-only]");
    await page.waitForTimeout(250);
    const urgentOnly = await page.locator("[data-talk-notify-list] .talk-notify-card").count();
    if (urgentOnly < 1) fail("urgent-only notify filter");
    else pass(`urgent-only notify filter (${urgentOnly} cards)`);

    await page.click('[data-talk-tab="chat"]');
    await page.waitForTimeout(150);
    await page.click("[data-talk-unified-anpi-only]");
    await page.waitForTimeout(300);
    const unifiedAnpi = await page.locator(".talk-unified-inbox-card--anpi").count();
    if (unifiedAnpi < 1) fail("unified anpi-only filter");
    else pass("unified anpi-only filter");

    const markReadOk = await page.evaluate((id) => {
      window.TasuTalkNotifications?.markRead?.(id);
      const row = window.TasuTalkData.findNotificationById(id);
      return !window.TasuTalkNotifications.isUnread(row);
    }, anpiId);
    if (!markReadOk) fail("mark read action");
    else pass("mark read action");

    const corruptOk = await page.evaluate(() => {
      localStorage.setItem("tasful_talk_notifications", "{{not-json");
      try {
        const stats = window.TasuTalkData.getDashboardStats();
        return typeof stats.unread === "number";
      } catch {
        return false;
      }
    });
    if (!corruptOk) fail("corrupt localStorage does not crash");
    else pass("corrupt localStorage does not crash");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForFunction(() => typeof window.TasuTalkNotifyDetail?.open === "function");
    await mobile.evaluate(() => {
      window.__TASU_TALK_SKIP_ACTION_CONFIRM = true;
    });
    mobile.on("dialog", (d) => d.accept());
    await mobile.waitForTimeout(400);

    const spActionsVisible = await mobile.evaluate(() => {
      const actions = document.querySelector(".talk-notify-card__actions");
      if (!actions) return false;
      const style = getComputedStyle(actions);
      return parseFloat(style.opacity) >= 0.99;
    });
    if (!spActionsVisible) fail("SP notify actions always visible");
    else pass("SP notify actions always visible");

    const spQuick = await mobile.locator("[data-talk-notify-quick-filters]").isVisible();
    if (!spQuick) fail("SP notify quick filters visible");
    else pass("SP notify quick filters visible");

    const listPad = await mobile.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      if (!list) return null;
      const pb = getComputedStyle(list).paddingBottom;
      return parseFloat(pb) >= 80;
    });
    if (!listPad) fail("SP notify list padding-bottom for tab bar");
    else pass("SP notify list padding-bottom for tab bar");

    const firstCard = mobile.locator("[data-talk-notify-list] .talk-notify-card").first();
    if ((await firstCard.count()) < 1) fail("SP notify list has cards");
    else {
      await firstCard.click();
      await mobile.waitForTimeout(200);
      const detailOpen = await mobile.evaluate(() => {
        const sheet = document.querySelector("[data-talk-notify-detail]");
        return sheet && !sheet.hidden && sheet.classList.contains("talk-notify-detail--sheet");
      });
      if (!detailOpen) fail("SP notify card opens bottom sheet detail");
      else pass("SP notify card opens bottom sheet detail");

      const hasBody = await mobile.locator("[data-talk-notify-detail-body] .talk-notify-detail__text").count();
      if (hasBody < 1) fail("SP notify detail shows body");
      else pass("SP notify detail shows body");

      await mobile.click("button.talk-notify-detail__close");
      await mobile.waitForTimeout(150);
      const detailClosed = await mobile.evaluate(() => {
        const sheet = document.querySelector("[data-talk-notify-detail]");
        return sheet?.hidden === true;
      });
      if (!detailClosed) fail("SP notify detail closes");
      else pass("SP notify detail closes");

      await firstCard.click();
      await mobile.waitForTimeout(150);
      const markReadBtn = mobile
        .locator("[data-talk-notify-detail] [data-talk-notify-detail-action='mark-read']")
        .first();
      if ((await markReadBtn.count()) < 1) {
        pass("SP notify detail mark-read (already read or N/A)");
      } else {
        await markReadBtn.click();
        await mobile.waitForTimeout(200);
        const stillOneSheet = await mobile.evaluate(() => {
          const open = document.querySelectorAll("[data-talk-notify-detail]:not([hidden])").length;
          return open === 1;
        });
        if (!stillOneSheet) fail("SP detail action does not open duplicate sheets");
        else pass("SP detail action does not open duplicate sheets");
        await mobile.click("button.talk-notify-detail__close");
      }

      const actionBtn = mobile
        .locator("[data-talk-notify-list] .talk-notify-card")
        .first()
        .locator("[data-talk-notify-action]")
        .first();
      if ((await actionBtn.count()) >= 1) {
        await actionBtn.click({ force: true });
        await mobile.waitForTimeout(200);
        const detailHiddenAfterBtn = await mobile.evaluate(() =>
          Boolean(document.querySelector("[data-talk-notify-detail][hidden]"))
        );
        if (!detailHiddenAfterBtn) fail("SP card action should not leave detail sheet open from card tap");
        else pass("SP card inline action without duplicate detail");
      }

      const lastCardInView = await mobile.evaluate(async () => {
        const cards = [...document.querySelectorAll("[data-talk-notify-list] .talk-notify-card")];
        const last = cards[cards.length - 1];
        if (!last) return false;
        last.scrollIntoView({ block: "end" });
        await new Promise((r) => setTimeout(r, 120));
        const rect = last.getBoundingClientRect();
        const tab = document.querySelector("[data-talk-mobile-tabbar]");
        const tabTop = tab ? tab.getBoundingClientRect().top : window.innerHeight;
        return rect.bottom <= tabTop + 4;
      });
      if (!lastCardInView) fail("SP last notify card not hidden under tab bar");
      else pass("SP last notify card readable above tab bar");
    }

    await mobile.close();

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length}):`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All notify UX checks passed.");
    }
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
