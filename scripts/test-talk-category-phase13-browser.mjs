#!/usr/bin/env node
/**
 * TASFUL TALK Phase13 — カテゴリ正規化 smoke test
 *
 *   node scripts/test-talk-category-phase13-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const CATEGORIES = [
  ["skill", "スキル"],
  ["worker", "ワーカー"],
  ["job", "求人"],
  ["product", "商品"],
  ["shop", "店舗・販売"],
  ["business", "業務サービス"],
  ["builder", "Builder"],
  ["anpi", "安否"],
  ["system", "運営"],
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkCategory?.normalizeTalkNotificationType === "function");

    const norm = await page.evaluate(() => ({
      project: window.TasuTalkCategory.normalizeTalkNotificationType("project"),
      shopProduct: window.TasuTalkCategory.normalizeTalkNotificationType("shop", {
        targetUrl: "detail-product.html?id=x",
        listing_type: "product",
      }),
      shopStore: window.TasuTalkCategory.normalizeTalkNotificationType("shop", {
        targetUrl: "detail-shop.html?id=x",
        listing_type: "shop_store",
      }),
      ad: window.TasuTalkCategory.normalizeTalkNotificationType("ad"),
      followBuilder: window.TasuTalkCategory.normalizeFollowType("project", {
        targetUrl: "builder/mvp-project-detail.html?id=p1",
      }),
      listingSkill: window.TasuTalkCategory.resolveListingCategoryType({
        listingType: "skill",
      }),
      corrupt: (() => {
        localStorage.setItem("tasful_talk_follow_store", "{bad");
        return window.TasuTalkFollowStore.readAll().length === 0;
      })(),
    }));

    if (norm.project !== "skill") fail("project → skill");
    else pass("project → skill");
    if (norm.shopProduct !== "product") fail("shop+product context → product");
    else pass("shop+product context → product");
    if (norm.shopStore !== "shop") fail("shop store context → shop");
    else pass("shop store context → shop");
    if (norm.ad !== "system") fail("ad → system");
    else pass("ad → system");
    if (norm.followBuilder !== "builder") fail("follow project+builder url → builder");
    else pass("follow project+builder url → builder");
    if (norm.listingSkill !== "skill") fail("listing skill → skill");
    else pass("listing skill → skill");
    if (!norm.corrupt) fail("corrupt follow store safe");
    else pass("corrupt follow store safe");

    const filters = await page.evaluate(() => window.TasuTalkData.NOTIFICATION_FILTERS.map((f) => f.id));
    for (const id of ["skill", "worker", "job", "product", "shop", "business", "builder", "anpi", "system"]) {
      if (!filters.includes(id)) fail(`filter missing: ${id}`);
      else pass(`filter: ${id}`);
    }
    if (filters.includes("project")) fail("legacy project filter removed");
    else pass("legacy project filter removed");

    for (const [type, label] of CATEGORIES) {
      const count = await page.evaluate(
        (t) => (window.TasuTalkData.getNotifications({ filter: t }) || []).length,
        type
      );
      if (count < 1) fail(`${label} notifications visible (${type})`);
      else pass(`${label} notifications visible`);
    }

    const migrated = await page.evaluate(() => {
      localStorage.setItem(
        "tasful_talk_notification_settings",
        JSON.stringify({
          enabled: true,
          types: { project: false, job: true },
          priorities: { normal: true, important: true, urgent: true },
          segments: { all: true },
        })
      );
      const s = window.TasuTalkNotificationSettings.read();
      return { skillOff: s.types.skill === false, jobOn: s.types.job === true };
    });
    if (!migrated.skillOff || !migrated.jobOn) fail("settings project→skill migration");
    else pass("settings project→skill migration");

    const aiSkill = await page.evaluate(() => {
      const r = window.TasuTalkAiDrafts.pushAsNotification({
        mode: "project",
        output: "phase13-ai-skill-marker",
      });
      return r?.notification?.type;
    });
    if (aiSkill !== "skill") fail("AI project mode notifies as skill");
    else pass("AI project mode notifies as skill");

    const bcastSystem = await page.evaluate(() => {
      const row = window.TasuTalkBroadcastDrafts.add({
        kind: "ad",
        body: "phase13-bcast-ad",
        title: "広告テスト",
      });
      return window.TasuTalkCategory.broadcastKindToNotifyType(row?.kind, row);
    });
    if (bcastSystem !== "system") fail("broadcast ad → system notify type");
    else pass("broadcast ad → system notify type");

    const dashOk = await page.evaluate(() => {
      const stats = window.TasuTalkData.getDashboardStats?.();
      return typeof stats?.unread === "number" && stats.unread >= 0;
    });
    if (!dashOk) fail("dashboard stats");
    else pass("dashboard stats");

    if (errors.length) {
      console.log(`\nFailed: ${errors.length}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll Phase13 category checks passed.");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
