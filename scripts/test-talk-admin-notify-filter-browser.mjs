#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — 運営通知フィルター E2E（OPS WATCH / 運営連絡 / 安否 / 通報）
 *
 *   node scripts/test-talk-admin-notify-filter-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const SEED_KEY = "tasful_talk_notifications_seeded_v2";

async function seedAdminFilterFixtures(page) {
  await page.evaluate((seedKey) => {
    localStorage.removeItem(seedKey);
    localStorage.removeItem("tasful_talk_notifications");
    const add = (row) => window.TasuTalkNotifications?.add?.(row);

    add({
      id: "e2e-admin-filter-job",
      type: "job",
      title: "求人マーカー",
      body: "e2e-admin-filter-job-body",
      source: "detail-job",
      priority: "normal",
      readAt: new Date().toISOString(),
    });

    add({
      id: "e2e-admin-filter-ops-contact",
      type: "system",
      title: "重要なお知らせテスト",
      body: "e2e-admin-filter-ops-marker",
      source: "admin",
      priority: "normal",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-operation-cat",
      type: "system",
      title: "運営オペレーション",
      body: "e2e-operation-category-marker",
      source: "tasful",
      category: "operation",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-anpi-cat",
      type: "system",
      title: "安否カテゴリ",
      body: "e2e-anpi-category-marker",
      source: "anpi-dashboard",
      category: "anpi",
      priority: "urgent",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-report",
      type: "system",
      title: "通報受付",
      body: "e2e-report-marker",
      source: "support",
      category: "abuse",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-watch-high",
      type: "system",
      title: "OpenAI 監視レポート",
      body: "【OPS WATCH】\n\n高\n\n■要約\nhigh marker",
      source: "ops_watch",
      priority: "important",
      opsWatchImportance: "high",
      opsWatchCategoryId: "openai",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-watch-medium",
      type: "system",
      title: "Stripe 監視レポート",
      body: "【OPS WATCH】\n\n中",
      source: "ops_watch",
      priority: "important",
      opsWatchImportance: "medium",
      opsWatchCategoryId: "stripe",
      readAt: null,
    });

    add({
      id: "e2e-admin-filter-watch-low",
      type: "system",
      title: "Cloudflare 監視レポート",
      body: "【OPS WATCH】\n\n低",
      source: "ops_watch",
      priority: "normal",
      opsWatchImportance: "low",
      opsWatchCategoryId: "cloudflare",
      readAt: null,
    });
  }, SEED_KEY);
}

async function openNotifyFilterPanel(page) {
  await page.locator("[data-talk-notify-filter-toggle]").click();
  await page.waitForSelector("[data-talk-notify-filter-panel]:not([hidden])", {
    timeout: 5000,
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=notify&talkAdmin=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkData?.getNotifications === "function");
    await seedAdminFilterFixtures(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    await openNotifyFilterPanel(page);

    const panelText = await page.locator("[data-talk-notify-filter-sections]").innerText();
    for (const label of ["OPS WATCH", "運営連絡", "安否", "通報"]) {
      if (!panelText.includes(label)) fail(`admin top row missing ${label}`);
      else pass(`admin top row has ${label}`);
    }
    if (panelText.includes("毎日の情報")) fail("removed 毎日の情報 label");
    else pass("removed 毎日の情報 label");

    const systemChip = page
      .locator("[data-talk-notify-filter-sections]")
      .locator('[data-talk-filter-section="tag"][data-talk-filter-option="system"]');
    if ((await systemChip.count()) > 0) fail("運営(system) chip hidden from notify category row");
    else pass("運営(system) chip hidden from notify category row");

    const counts = await page.evaluate(() => window.TasuTalkData.countNotificationsForFilters({}));
    const admin = counts.admin || {};
    if ((admin.ops_watch || 0) < 3) fail(`ops_watch count expected >=3 got ${admin.ops_watch}`);
    else pass(`ops_watch count (${admin.ops_watch})`);
    if ((admin.ops_contact || 0) < 2) fail(`ops_contact count expected >=2 got ${admin.ops_contact}`);
    else pass(`ops_contact count (${admin.ops_contact})`);

    const watchOnly = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({
        filter: "all",
        adminSpecial: ["ops_watch"],
      })
    );
    if (!watchOnly.every((n) => String(n.source).toLowerCase() === "ops_watch")) {
      fail("ops_watch filter only ops_watch source");
    } else pass("ops_watch filter only ops_watch source");
    if (watchOnly.some((n) => n.body?.includes("e2e-admin-filter-ops-marker"))) {
      fail("ops_watch excludes ops contact");
    } else pass("ops_watch excludes ops contact");

    const contactOnly = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({
        filter: "all",
        adminSpecial: ["ops_contact"],
      })
    );
    if (!contactOnly.some((n) => n.body?.includes("e2e-admin-filter-ops-marker"))) {
      fail("ops_contact includes admin source");
    } else pass("ops_contact includes admin source");
    if (!contactOnly.some((n) => n.body?.includes("e2e-operation-category-marker"))) {
      fail("ops_contact includes category operation");
    } else pass("ops_contact includes category operation");
    if (contactOnly.some((n) => String(n.source).toLowerCase() === "ops_watch")) {
      fail("ops_contact excludes ops_watch");
    } else pass("ops_contact excludes ops_watch");

    const anpiOnly = await page.evaluate(() => {
      const rows = window.TasuTalkData.getNotifications({
        filter: "all",
        adminSpecial: ["anpi"],
      });
      return rows.every((n) => window.TasuTalkData.isAdminAnpiCategoryNotification(n));
    });
    if (!anpiOnly) fail("anpi filter matches anpi category");
    else pass("anpi filter matches anpi category");

    const reportOnly = await page.evaluate(() =>
      window.TasuTalkData.getNotifications({
        filter: "all",
        adminSpecial: ["report"],
      })
    );
    if (!reportOnly.some((n) => n.body?.includes("e2e-report-marker"))) {
      fail("report filter matches abuse category");
    } else pass("report filter matches abuse category");

    const notifyFilterHost = page.locator("[data-talk-notify-filter-sections]");
    const watchTagChip = notifyFilterHost.locator(
      '[data-talk-filter-section="tag"][data-talk-filter-option="ops_watch"]'
    );
    if ((await watchTagChip.count()) < 1) fail("ops_watch missing from notify category row");
    else pass("ops_watch in notify category row");

    const typeOnlyOk = await page.evaluate(() => {
      const rows = window.TasuTalkData.getNotifications({
        filter: "all",
        types: ["ops_watch"],
      });
      return rows.every((n) => window.TasuTalkData.isOpsWatchNotification(n));
    });
    if (!typeOnlyOk) fail("types ops_watch filter uses isOpsWatchNotification");
    else pass("types ops_watch filter matches source/category/type");

    await watchTagChip.first().click();
    await page.waitForTimeout(200);
    const listText = await page.locator("[data-talk-notify-list]").innerText();
    if (!listText.includes("OpenAI") && !listText.includes("OPS WATCH")) {
      fail("UI ops_watch category chip filters list");
    } else pass("UI ops_watch category chip filters list");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll talk-admin-notify-filter checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }  });
  
}

main();
