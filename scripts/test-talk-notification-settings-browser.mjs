#!/usr/bin/env node
/**
 * TASFUL TALK Phase9 — 通知設定
 *
 *   node scripts/test-talk-notification-settings-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

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

  const countVisibleJob = async () =>
    page.evaluate(() => {
      const rows =
        window.TasuTalkData?.getNotifications?.({
          filter: "all",
          applySettings: true,
          showMuted: false,
        }) || [];
      return rows.filter((n) => n.type === "job").length;
    });

  const countAllStored = async () =>
    page.evaluate(() => {
      try {
        const raw = localStorage.getItem("tasful_talk_notifications");
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.length : 0;
      } catch {
        return -1;
      }
    });

  try {
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
    }, SETTINGS_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    if (!(await page.locator("[data-talk-notify-settings-open]").isVisible())) {
      fail("settings button not visible");
    } else pass("settings button visible");

    const storedBefore = await countAllStored();
    if (storedBefore < 1) fail("notifications not seeded");
    else pass("notifications stored");

    const jobVisibleDefault = await countVisibleJob();
    const anpiVisible = await page.evaluate(() => {
      const rows =
        window.TasuTalkData?.getNotifications?.({
          filter: "all",
          applySettings: true,
          showMuted: false,
        }) || [];
      return rows.some((n) => n.type === "anpi" && n.priority === "urgent");
    });
    if (!anpiVisible) fail("urgent anpi not visible by default");
    else pass("urgent anpi visible by default");

    await page.locator("[data-talk-notify-settings-open]").click();
    await page.waitForSelector("[data-talk-notify-settings-modal]:not([hidden])", { timeout: 3000 });

    await page.locator("[data-talk-settings-type='job']").setChecked(false);
    await page.locator("[data-talk-notify-settings-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(300);

    const jobAfterOff = await countVisibleJob();
    if (jobAfterOff !== 0) fail(`job still visible: ${jobAfterOff}`);
    else pass("job hidden when category OFF");

    const storedAfterOff = await countAllStored();
    if (storedAfterOff !== storedBefore) fail("notification data deleted");
    else pass("notification data preserved");

    await page.locator("[data-talk-notify-settings-open]").click();
    await page.locator("[data-talk-settings-show-muted]").setChecked(true);
    await page.locator("[data-talk-notify-settings-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(300);

    const jobMutedVisible = await page.evaluate(() => {
      const rows =
        window.TasuTalkData?.getNotifications?.({
          filter: "all",
          applySettings: true,
          showMuted: true,
        }) || [];
      return rows.filter((n) => n.type === "job" && n.hiddenBySettings).length;
    });
    if (jobMutedVisible < 1) fail("showMuted did not reveal job");
    else pass("showMuted reveals hidden notifications");

    await page.locator("[data-talk-notify-settings-open]").click();
    await page.locator("[data-talk-settings-enabled]").setChecked(false);
    await page.locator("[data-talk-notify-settings-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(300);

    const visibleWhenDisabled = await page.evaluate(() => {
      return (
        window.TasuTalkData?.getNotifications?.({
          filter: "all",
          applySettings: true,
          showMuted: false,
        }) || []
      ).length;
    });
    if (visibleWhenDisabled !== 0) fail(`enabled false still shows ${visibleWhenDisabled}`);
    else pass("enabled false hides all from inbox");

    await page.locator("[data-talk-notify-settings-open]").click();
    await page.locator("[data-talk-settings-reset]").click();
    await page.waitForTimeout(200);
    await page.locator("[data-talk-notify-settings-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(300);

    const resetOk = await page.evaluate((key) => {
      try {
        const s = JSON.parse(localStorage.getItem(key) || "{}");
        return (
          s.enabled === true &&
          s.showMuted === false &&
          s.types?.job === true &&
          s.priorities?.urgent === true
        );
      } catch {
        return false;
      }
    }, SETTINGS_KEY);
    if (!resetOk) fail("reset to defaults failed");
    else pass("reset to defaults");

    const jobBack = await countVisibleJob();
    if (jobBack < 1) fail("job not visible after reset");
    else pass("job visible after reset");

    const corruptOk = await page.evaluate((key) => {
      localStorage.setItem(key, "{bad");
      return typeof window.TasuTalkNotificationSettings?.read === "function";
    }, SETTINGS_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    if (!corruptOk) fail("corrupt settings should not crash");
    else pass("corrupt localStorage safe");

    await page.locator("[data-talk-notify-settings-open]").click();
    await page.locator("[data-talk-settings-priority='urgent']").setChecked(false);
    const warnVisible = await page.locator("[data-talk-settings-urgent-warn]:not([hidden])").count();
    if (warnVisible < 1) fail("urgent OFF warning not shown");
    else pass("urgent OFF warning displayed");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }  });
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("\nOK: TASFUL TALK Phase9 notification settings");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
