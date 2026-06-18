#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK Phase10 — ダッシュボード
 *
 *   node scripts/test-talk-dashboard-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const SETTINGS_KEY = "tasful_talk_notification_settings";

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
    await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(900);

    if (!(await page.locator("[data-talk-dashboard]").isVisible())) {
      fail("dashboard section missing");
    } else pass("dashboard visible");

    const stats = await page.evaluate(() => window.TasuTalkData?.getDashboardStats?.());
    if (typeof stats?.unread !== "number") fail("unread stat missing");
    else pass(`unread count: ${stats.unread}`);
    if (typeof stats?.urgent !== "number" || typeof stats?.important !== "number") {
      fail("urgent/important stats missing");
    } else pass(`urgent=${stats.urgent} important=${stats.important}`);

    const alertCount = await page.locator("[data-talk-dashboard-important] .talk-dashboard-alert").count();
    if (alertCount < 1 || alertCount > 3) fail(`important alerts: ${alertCount}`);
    else pass(`important alerts: ${alertCount} (max 3)`);

    await page.evaluate(() => {
      const s = window.TasuTalkNotificationSettings.read();
      s.types.job = false;
      window.TasuTalkNotificationSettings.write(s);
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const jobInStats = await page.evaluate(() => {
      const inbox = window.TasuTalkData.getInboxNotifications();
      const jobUnread = inbox.filter((n) => n.type === "job" && n.unread).length;
      const stats = window.TasuTalkData.getDashboardStats();
      const allStored = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const storedJob = allStored.filter((n) => n.type === "job").length;
      return { jobUnread, statsUnread: stats.unread, storedJob };
    });

    if (jobInStats.storedJob < 1) fail("seed job notification missing");
    else pass("job notification still stored");
    if (jobInStats.jobUnread > 0) fail("job still in inbox after OFF");
    else pass("job excluded from inbox stats");

    await page.locator('[data-talk-quick-action="createNotice"]').click();
    await page.waitForTimeout(200);
    const aiMode = await page.locator('[data-talk-ai-mode="notice"].is-active').count();
    if (aiMode < 1) fail("quick action createNotice did not select notice mode");
    else pass("quick action createNotice switches AI mode");

    const unsent = await page.evaluate(() => window.TasuTalkData.getBroadcastDraftSummary().unsent);
    const statUnsent = await page.evaluate(() => window.TasuTalkData.getDashboardStats().broadcastUnsent);
    if (Number(statUnsent) !== Number(unsent)) {
      fail(`broadcast stat mismatch: stat=${statUnsent} summary=${unsent}`);
    } else pass(`broadcast unsent count: ${unsent}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const dashBox = await page.locator("[data-talk-dashboard]").boundingBox();
    const statsBox = await page.locator("[data-talk-dashboard-stats]").boundingBox();
    if (!dashBox || !statsBox || statsBox.width > dashBox.width + 4) {
      fail("mobile layout overflow");
    } else pass("mobile layout ok");

    await page.evaluate((key) => localStorage.setItem(key, "{{"), SETTINGS_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const corruptOk = await page.locator("[data-talk-dashboard-stats] .talk-dashboard-stat").count();
    if (corruptOk < 5) fail("dashboard broken after corrupt settings");
    else pass("corrupt settings safe");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }  });
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nOK: TASFUL TALK Phase10 dashboard");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
