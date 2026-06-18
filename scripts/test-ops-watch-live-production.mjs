#!/usr/bin/env node
/**
 * OPS WATCH 本番 Edge 実動作 + 通知サンプル生成
 *   node scripts/test-ops-watch-live-production.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { writeFileSync } from "fs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const CATEGORIES = ["openai", "stripe", "cursor"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const report = { deployed: true, runs: [], samples: [], errors: [] };

  await page.goto(`${BASE}/talk-home.html`, {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });
  await page.waitForFunction(() => typeof window.TasuOpsWatch?.runCategory === "function", {
    timeout: 15000,
  });

  await page.evaluate(() => {
    if (window.__TASU_SERPER_MOCK_RESPONSE__) delete window.__TASU_SERPER_MOCK_RESPONSE__;
    window.TasuOpsWatchStore?.clearForTests?.();
  });

  for (const cat of CATEGORIES) {
    const result = await page.evaluate(
      async (categoryId) => {
        return window.TasuOpsWatch.runCategory(categoryId, { forceNotify: true });
      },
      cat
    );
    report.runs.push({
      category: cat,
      ok: result?.ok,
      search: result?.search,
      notify: {
        skipped: result?.notify?.skipped,
        reason: result?.notify?.reason,
        notificationId: result?.notify?.notification?.id || result?.card?.notificationId,
        created: Boolean(result?.notify?.notification?.id || result?.card?.notificationId),
      },
      card: result?.card,
    });
  }

  const openaiRun = report.runs.find((r) => r.category === "openai");
  report.openaiVerify = {
    searchFailed: openaiRun?.search?.failed,
    searchUsed: openaiRun?.search?.used,
    notificationCreated: openaiRun?.notify?.created,
    notificationId: openaiRun?.notify?.notificationId,
  };

  report.samples = await page.evaluate((cats) => {
    const cards = window.TasuOpsWatch.listCards().slice(0, 10);
    const notifs = window.TasuTalkData?.getNotifications?.({ filter: "all" }) || [];
    const ops = notifs.filter((n) => String(n.source) === "ops_watch");
    return cats.map((cat) => {
      const card = cards.find((c) => c.categoryId === cat);
      const n = ops.find((row) => String(row.title || "").toLowerCase().includes(cat) || String(row.body || "").toLowerCase().includes(cat)) ||
        ops.find((row) => card && row.id === card.notificationId);
      const notify = notifs.find((row) => row.id === card?.notificationId) || n;
      return {
        category: cat,
        card,
        notification: notify
          ? {
              id: notify.id,
              title: notify.title,
              body: notify.body,
              priority: notify.priority,
            }
          : null,
      };
    });
  }, CATEGORIES);

  await browser.close();

  const outPath = "scripts/ops-watch-live-report.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  const v = report.openaiVerify;
  if (v.searchFailed !== false || v.searchUsed !== true || !v.notificationCreated) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
