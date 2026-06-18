#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK Phase20 — 導線・タブ・破損localStorage・レスポンシブ smoke
 *
 *   node scripts/test-talk-phase20-routes-browser.mjs
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

/** @type {{ page: string; label: string; selector?: string; attr?: string; expect?: RegExp }[]} */
const ROUTE_CHECKS = [
  {
    page: "dashboard.html",
    selector: 'a[href*="talk-home"]',
    attr: "href",
    expect: /talk-home\.html/,
    label: "dashboard → talk-home",
  },
  {
    page: "chat-list.html",
    selector: "[data-chat-back-dashboard]",
    attr: "href",
    expect: /talk-home\.html/,
    label: "chat-list → talk-home",
  },
  { page: "detail-job.html", label: "detail-job reachable" },
  { page: "detail-skill.html", label: "detail-skill reachable" },
  { page: "detail-worker.html", label: "detail-worker reachable" },
  { page: "detail-business-service.html", label: "detail-business-service reachable" },
  { page: "detail-shop.html", label: "detail-shop reachable" },
  { page: "detail-product.html", label: "detail-product reachable" },
  { page: "anpi-dashboard.html", label: "anpi-dashboard reachable" },
  { page: "anpi-notifications.html", label: "anpi-notifications reachable" },
  { page: "builder/index.html", label: "builder index reachable" },
];

const CORRUPT_KEYS = [
  "tasful_talk_notifications",
  "tasful_talk_ai_drafts",
  "tasful_talk_broadcast_drafts",
  "tasful_talk_follow_store",
  "tasful_talk_notification_settings",
  "tasful_talk_recent_actions",
];

const VIEWPORTS = [
  { w: 390, h: 844, label: "390px SP" },
  { w: 768, h: 900, label: "768px tablet" },
  { w: 1280, h: 900, label: "1280px PC" },
];

async function main() {
  await withPlaywrightBrowser(async (browser) => {const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    const routePage = await browser.newPage();
    for (const check of ROUTE_CHECKS) {
      const url = `${BASE}/${check.page}`;
      try {
        const res = await routePage.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        if (!res || res.status() >= 400) {
          fail(`${check.label} HTTP ${res?.status()}`);
          continue;
        }
        if (check.selector && check.attr && check.expect) {
          const href = await routePage.locator(check.selector).first().getAttribute(check.attr).catch(() => null);
          if (!href || !check.expect.test(href)) fail(`${check.label} (${href || "missing"})`);
          else pass(check.label);
        } else {
          pass(check.label);
        }
      } catch (err) {
        fail(`${check.label}: ${err.message}`);
      }
    }
    await routePage.close();

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForSelector("[data-talk-root]", { timeout: 10000 });
      await page.waitForFunction(
        () => document.querySelectorAll("[data-talk-dashboard-stats] .talk-dashboard-stat").length >= 5,
        { timeout: 15000 }
      );

      const tabsOk = (await page.locator("[data-talk-tab]").count()) === 3;
      if (!tabsOk) fail(`${vp.label}: 3 tabs`);
      else pass(`${vp.label}: tabs`);

      const statCount = await page.locator("[data-talk-dashboard-stats] .talk-dashboard-stat").count();
      if (statCount < 5) fail(`${vp.label}: dashboard stats (${statCount})`);
      else pass(`${vp.label}: dashboard stats (${statCount})`);

      const unifiedHost = page.locator("[data-talk-unified-list]");
      if ((await unifiedHost.count()) < 1) fail(`${vp.label}: unified inbox host`);
      else pass(`${vp.label}: unified inbox`);

      await page.click('[data-talk-tab="notify"]');
      await page.waitForTimeout(200);
      const notifyList = await page.locator("[data-talk-notify-list]").isVisible();
      if (!notifyList) fail(`${vp.label}: notify panel`);
      else pass(`${vp.label}: notify panel`);

      await page.click('[data-talk-tab="ai"]');
      await page.waitForTimeout(200);
      const aiModes = await page.locator("[data-talk-ai-mode]").count();
      if (aiModes !== 5) fail(`${vp.label}: 5 AI modes (${aiModes})`);
      else pass(`${vp.label}: AI modes`);

      await page.click('[data-talk-tab="chat"]');
      await page.waitForTimeout(150);
      const chatHub = await page.locator("[data-talk-chat-search], [data-talk-channel-filters]").count();
      if (chatHub < 1) fail(`${vp.label}: chat hub controls`);
      else pass(`${vp.label}: chat hub`);

      const quick = await page.locator("[data-talk-quick-actions]").isVisible();
      if (!quick) fail(`${vp.label}: quick actions`);
      else pass(`${vp.label}: quick actions`);

      await page.close();
    }

    const resilience = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await resilience.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await resilience.waitForFunction(() => window.TasuTalkData?.getDashboardStats, { timeout: 10000 });

    for (const key of CORRUPT_KEYS) {
      const ok = await resilience.evaluate((storageKey) => {
        localStorage.setItem(storageKey, "{{not-json");
        try {
          window.TasuTalkHomeUi?.refreshTalkSurfaces?.();
          const stats = window.TasuTalkData.getDashboardStats();
          const notify = window.TasuTalkData.getNotifications({ filter: "all", applySettings: false });
          const drafts = window.TasuTalkAiDrafts?.readAll?.() || [];
          const bc = window.TasuTalkBroadcastDrafts?.readAll?.() || [];
          const recent = window.TasuTalkData.readRecentActions?.() || [];
          return (
            typeof stats.unread === "number" &&
            Array.isArray(notify) &&
            Array.isArray(drafts) &&
            Array.isArray(bc) &&
            Array.isArray(recent)
          );
        } catch {
          return false;
        }
      }, key);
      if (!ok) fail(`corrupt ${key}`);
      else pass(`corrupt ${key} resilient`);
    }

    const notifyTypes = await resilience.evaluate(() => {
      const types = window.TasuTalkData?.NOTIFICATION_TYPES || {};
      const required = ["skill", "worker", "job", "product", "shop", "business", "builder", "anpi", "system"];
      return required.every((t) => Boolean(types[t]));
    });
    if (!notifyTypes) fail("NOTIFICATION_TYPES covers phase20 types");
    else pass("NOTIFICATION_TYPES covers phase20 types");

    const recentSection = await resilience.evaluate(() => {
      window.TasuTalkData?.pushRecentAction?.("notify");
      window.TasuTalkHomeUi?.refreshTalkSurfaces?.();
      return !document.querySelector("[data-talk-recent-section]")?.hidden;
    });
    if (!recentSection) fail("recent actions section after push");
    else pass("recent actions section");

    await resilience.close();

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length}):`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("Phase20 routes/responsive/resilience checks passed.");
    }
  } catch (err) {
    fail(String(err?.message || err));
  }
});
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
