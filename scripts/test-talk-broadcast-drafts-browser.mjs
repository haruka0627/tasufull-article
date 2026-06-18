#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK Phase6 — 配信下書き
 *
 *   node scripts/test-talk-broadcast-drafts-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BROADCAST_KEY = "tasful_talk_broadcast_drafts";
const NOTIFY_KEY = "tasful_talk_notifications";
const MARKER = "phase6-broadcast-e2e";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem("tasful_talk_broadcast_drafts");
      localStorage.removeItem("tasful_talk_ai_drafts");
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.locator('[data-talk-ai-mode="ad"]').click();
    await page.locator("[data-talk-ai-input]").fill(MARKER);
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });

    if (await page.locator("[data-talk-ai-save-broadcast]").isHidden()) {
      fail("broadcast button hidden for ad");
    } else pass("broadcast button visible for ad");

    await page.locator('[data-talk-ai-mode="qa"]').click();
    await page.waitForTimeout(150);
    if (!(await page.locator("[data-talk-ai-save-broadcast]").isHidden())) {
      fail("broadcast button should hide for qa");
    } else pass("broadcast button hidden for qa");

    await page.locator('[data-talk-ai-mode="project"]').click();
    await page.waitForTimeout(150);
    if (!(await page.locator("[data-talk-ai-save-broadcast]").isHidden())) {
      fail("broadcast button hidden for project");
    } else pass("broadcast button hidden for project");

    await page.locator('[data-talk-ai-mode="job"]').click();
    await page.waitForTimeout(150);
    if (!(await page.locator("[data-talk-ai-save-broadcast]").isHidden())) {
      fail("broadcast button hidden for job");
    } else pass("broadcast button hidden for job");

    await page.locator('[data-talk-ai-mode="notice"]').click();
    await page.locator("[data-talk-ai-input]").fill(`${MARKER}-notice`);
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    if (await page.locator("[data-talk-ai-save-broadcast]").isHidden()) {
      fail("broadcast button hidden for notice");
    } else pass("broadcast button visible for notice");

    await page.locator('[data-talk-ai-mode="ad"]').click();
    await page.waitForTimeout(150);
    await page.locator("[data-talk-ai-save-broadcast]").click();
    await page.waitForSelector("[data-talk-broadcast-modal]:not([hidden])", { timeout: 3000 });

    await page.fill("[data-talk-broadcast-title]", `配信テスト ${MARKER}`);
    await page.selectOption("[data-talk-broadcast-segment]", "construction");
    await page.selectOption("[data-talk-broadcast-priority]", "important");
    await page.locator("[data-talk-broadcast-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(400);

    const saved = await page.evaluate(
      ({ key, marker }) => {
        try {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          return list.find((r) => String(r.title || "").includes(marker));
        } catch {
          return null;
        }
      },
      { key: BROADCAST_KEY, marker: MARKER }
    );
    if (!saved?.id) fail("broadcast draft not in localStorage");
    else {
      pass("saved to tasful_talk_broadcast_drafts");
      if (saved.targetSegment !== "construction") fail(`segment: ${saved.targetSegment}`);
      else pass("targetSegment saved");
      if (saved.priority !== "important") fail(`priority: ${saved.priority}`);
      else pass("priority saved");
      if (!saved.sourceDraftId) fail("missing sourceDraftId");
      else pass("sourceDraftId linked");
    }

    const listCards = await page.locator("[data-talk-broadcast-list] .talk-broadcast-card").count();
    if (listCards < 1) fail("broadcast list empty");
    else pass("broadcast list rendered");

    await page.locator("[data-talk-broadcast-send]").first().click();
    await page.waitForSelector("[data-talk-broadcast-send-modal]:not([hidden])", { timeout: 3000 });
    await page.locator("[data-talk-broadcast-send-confirm]").click();
    await page.waitForTimeout(500);

    const afterSend = await page.evaluate(
      ({ key, marker }) => {
        try {
          const draft = JSON.parse(localStorage.getItem(key) || "[]").find((r) =>
            String(r.title || "").includes(marker)
          );
          const list = window.TasuTalkData?.getNotifications?.({ filter: "all" }) || [];
          const notify = list.find(
            (n) =>
              n.source === "talk-broadcast-draft-send" &&
              (String(n.title || "").includes(marker) || String(n.body || "").includes(marker))
          );
          const fanout = JSON.parse(localStorage.getItem("tasful_talk_notify_fanout") || "{}");
          const storeHas = (fanout.u_store || []).some(
            (n) => n.source === "talk-broadcast-draft-send" && String(n.body || "").includes("建設")
          );
          return {
            status: draft?.status,
            priority: draft?.priority,
            segment: draft?.targetSegment,
            notifyPriority: notify?.priority,
            bodyHasSegment: String(notify?.body || "").includes("建設"),
            bodyHasBroadcast: String(notify?.body || "").includes("一斉配信"),
            historyLen: Array.isArray(draft?.sendHistory) ? draft.sendHistory.length : 0,
            storeHas,
          };
        } catch {
          return null;
        }
      },
      { key: BROADCAST_KEY, marker: MARKER }
    );
    if (afterSend?.status !== "sent") fail(`status after send: ${afterSend?.status}`);
    else pass("status updated to sent");
    if (afterSend?.priority !== "important") fail(`draft priority: ${afterSend?.priority}`);
    else pass("priority preserved on draft");
    if (!afterSend?.bodyHasSegment) fail("notify body missing segment");
    else pass("targetSegment in notification body");
    if (afterSend?.notifyPriority !== "important") fail(`notify priority: ${afterSend?.notifyPriority}`);
    else pass("priority reflected in notification");
    if (!afterSend?.bodyHasBroadcast) fail("missing broadcast label in body");
    else pass("production broadcast notification");
    if (afterSend?.historyLen < 1) fail("send history missing");
    else pass("send history recorded");
    if (!afterSend?.storeHas) fail("recipient u_store did not receive fanout");
    else pass("multi-user delivery (fanout)");

    const bannerVisible = await page.locator("[data-talk-broadcast-banner]:not([hidden])").count();
    if (bannerVisible < 1) fail("success banner not shown");
    else pass("success banner displayed");
    const bannerText = await page.locator("[data-talk-broadcast-banner]").textContent();
    if (!String(bannerText || "").includes("送信しました")) fail(`banner text: ${bannerText}`);
    else pass("success banner message");

    await page.locator('[data-talk-tab="notify"]').click();
    await page.waitForTimeout(200);
    const notifyCards = await page.locator("[data-talk-notify-list] .talk-notify-card").count();
    if (notifyCards < 1) fail("notify tab empty after test add");
    else pass("notify tab shows cards");

    await page.locator('[data-talk-tab="ai"]').click();
    await page.waitForTimeout(200);
    const sendBtnGone = await page.locator("[data-talk-broadcast-send]").count();
    if (sendBtnGone > 0) fail("本番送信 button should hide after sent");
    else pass("本番送信 hidden after sent");

    await page.locator("[data-talk-broadcast-delete]").first().click();
    await page.waitForTimeout(200);

    const afterDelete = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]").length;
      } catch {
        return -1;
      }
    }, BROADCAST_KEY);
    if (afterDelete !== 0) fail(`after delete count: ${afterDelete}`);
    else pass("delete works");

    const corruptOk = await page.evaluate((key) => {
      localStorage.setItem(key, "{not-json");
      return typeof window.TasuTalkBroadcastDrafts?.listRecent === "function";
    }, BROADCAST_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    const listSafe = await page.locator("[data-talk-broadcast-list] .talk-empty, [data-talk-broadcast-list] .talk-broadcast-card").count();
    if (!corruptOk || listSafe < 1) fail("corrupt localStorage should not crash");
    else pass("corrupt localStorage safe");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }  });
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nOK: TASFUL TALK Phase6 broadcast drafts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
