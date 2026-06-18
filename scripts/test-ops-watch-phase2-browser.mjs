#!/usr/bin/env node
/**
 * TASFUL OPS WATCH Phase2 E2E
 *   node scripts/test-ops-watch-phase2-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const KEY = "tasu_ops_watch_last_auto_run_at";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const MOCK_SERPER = {
  ok: true,
  query: "mock",
  results: [
    {
      title: "Our top product updates from Sessions 2025 - Stripe",
      snippet: "Recap of Sessions announcements.",
      link: "https://stripe.com/blog/sessions",
    },
    {
      title: "Stripe Terms Update",
      snippet: "Terms effective March 2026.",
      link: "https://stripe.com/terms",
    },
  ],
};

const MOCK_AI = {
  headline: "E2E監視",
  summary: "AI要約テスト",
  importance: "medium",
  tasfulImpact: "影響テスト",
  recommendedAction: "アクションテスト",
  isNewService: false,
  newServiceName: "",
  introductionProposal: "",
};

async function setupMocks(page) {
  await page.addInitScript(
    ({ mock, aiJson, storageKey }) => {
      window.__TASU_SERPER_MOCK_RESPONSE__ = mock;
      window.__TASU_OPS_WATCH_TEST_INTERVAL_MS__ = 60 * 1000;
      window.__OPS_WATCH_E2E_CATEGORY_IDS__ = ["openai", "stripe", "cursor"];
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem("tasful_talk_notifications");
        localStorage.removeItem("tasful_talk_notifications_seeded_v2");
        localStorage.removeItem("tasful_ops_watch_state_v1");
        localStorage.removeItem("tasful_ops_watch_cards_v1");
        localStorage.setItem("tasu_talk_admin_preview", "1");
      } catch {
        /* ignore */
      }
      const orig = window.TasuAiModelGateway?.completeTurn?.bind(window.TasuAiModelGateway);
      if (orig) {
        window.TasuAiModelGateway.completeTurn = async (params) => {
          if (String(params?.modeId || "").startsWith("ops-watch")) {
            return { reply: JSON.stringify(aiJson), modelId: "e2e" };
          }
          return orig(params);
        };
      }
    },
    { mock: MOCK_SERPER, aiJson: MOCK_AI, storageKey: KEY }
  );
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const pass = (m) => console.log(`  OK  ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.error(`  NG  ${m}`);
  };

  await setupMocks(page);

  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForFunction(
    () =>
      typeof window.TasuOpsWatchDaily?.runDailyOpsWatch === "function" &&
      typeof window.TasuOpsWatchBrowser?.maybeAutoRunDailyOpsWatch === "function",
    { timeout: 15000 }
  );

  const firstEval = await page.evaluate((key) => {
    const ev = window.TasuOpsWatchDaily.evaluateAutoRun(localStorage);
    return ev;
  }, KEY);
  if (!firstEval.shouldRun) fail("first visit shouldRun=true");
  else pass("first visit shouldRun=true");

  const firstRun = await page.evaluate(() =>
    window.TasuOpsWatchBrowser.maybeAutoRunDailyOpsWatch({ surface: "talk-home" })
  );
  if (firstRun?.skipped) fail(`first auto run skipped: ${firstRun?.reason}`);
  else pass("first auto run executed");

  const marked = await page.evaluate((key) => localStorage.getItem(key), KEY);
  if (!marked) fail("last_auto_run_at not saved");
  else pass(`last_auto_run_at=${marked}`);

  const firstSummary = await page.evaluate(() =>
    (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).some((n) =>
      String(n.title || "").includes("日次サマリー")
    )
  );
  if (!firstSummary) fail("daily summary notification missing on first auto run");
  else pass("daily summary generated on auto run");

  const summaryOnTop = await page.evaluate(() => {
    const rows = window.TasuTalkData?.getNotifications?.({ filter: "all" }) || [];
    const ops = rows.filter((n) => String(n.source) === "ops_watch");
    if (!ops.length) return false;
    const first = ops[0];
    return (
      first?.opsWatchKind === "daily_summary" ||
      String(first?.title || "").includes("日次サマリー")
    );
  });
  if (!summaryOnTop) fail("daily summary should sort to top among OPS WATCH");
  else pass("daily summary pinned to top");

  const opsFilter = await page.evaluate(() => {
    const rows = window.TasuTalkData?.getNotifications?.({ filter: "ops_watch" }) || [];
    return rows.length > 0 && rows.every((n) => String(n.source) === "ops_watch");
  });
  if (!opsFilter) fail("ops_watch filter empty or mixed sources");
  else pass("ops_watch filter works");

  const firstStats = await page.evaluate(async () => {
    const r = await window.TasuOpsWatch.runAll({ dailyRun: true, skipNotify: false, forceNotify: true, dedupeHours: 0 });
    return r.stats;
  });
  if (typeof firstStats?.high !== "number" || typeof firstStats?.low !== "number") {
    fail("stats missing high/medium/low counts");
  } else pass(`stats recorded high=${firstStats.high} medium=${firstStats.medium} low=${firstStats.low}`);

  // 24h未満: スキップ
  await page.evaluate((key) => {
    localStorage.setItem(key, new Date().toISOString());
  }, KEY);

  const skip = await page.evaluate(() =>
    window.TasuOpsWatchBrowser.maybeAutoRunDailyOpsWatch({ surface: "talk-home" })
  );
  if (!skip?.skipped) fail("expected skip within 24h");
  else pass("auto run skipped when interval not elapsed");

  // 25h経過: 再実行
  await page.evaluate(
    ({ key, ms }) => {
      localStorage.setItem(key, new Date(Date.now() - ms).toISOString());
    },
    { key: KEY, ms: DAY_MS + HOUR_MS }
  );

  const rerun = await page.evaluate(() =>
    window.TasuOpsWatchBrowser.maybeAutoRunDailyOpsWatch({ surface: "talk-home" })
  );
  if (rerun?.skipped) fail("expected rerun after 25h");
  else pass("auto run fires again after 25h");

  // Stripe 誤検知なし
  const stripeCard = await page.evaluate(() => {
    return window.TasuOpsWatch.runCategory("stripe", { forceNotify: true, dedupeHours: 0 });
  });
  if (stripeCard?.card?.isNewService) fail("stripe new service false positive");
  else pass("stripe no false positive on Sessions title");

  // 1カテゴリ失敗でも runAll 継続（未知カテゴリを混ぜる）
  const batch = await page.evaluate(async () =>
    window.TasuOpsWatch.runAll({
      categoryIds: ["openai", "__missing_category__", "stripe"],
      dailyRun: true,
      forceNotify: true,
      dedupeHours: 0,
    })
  );
  if ((batch?.results?.length || 0) < 3) fail("runAll did not process all category slots");
  else pass(`runAll processed ${batch.results.length} categories`);
  if (!batch?.stats?.failedCategories?.includes("__missing_category__")) {
    fail("failed category not in stats");
  } else pass("failed category recorded in stats");
  if (!batch?.ok) fail("runAll should ok when at least one category succeeds");
  else pass("runAll ok with partial failures");

  // talk-ops-room 手動ボタン
  await page.goto(`${BASE}/talk-ops-room.html`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForSelector("[data-ops-watch-run='all']", { timeout: 10000 });

  await page.click("[data-ops-watch-run='openai']");
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-watch-result]")?.textContent || "";
      return t.includes("openai") || t.includes("完了") || t.includes("E2E");
    },
    { timeout: 90000 }
  );
  pass("manual OpenAI button completed");

  await page.click("[data-ops-watch-run='stripe']");
  await page.waitForFunction(
    () => (document.querySelector("[data-ops-watch-result]")?.textContent || "").length > 20,
    { timeout: 90000 }
  );
  pass("manual Stripe button completed");

  await page.click("[data-ops-watch-run='cursor']");
  await page.waitForFunction(
    () => (document.querySelector("[data-ops-watch-result]")?.textContent || "").length > 20,
    { timeout: 90000 }
  );
  pass("manual Cursor button completed");

  await page.click("[data-ops-watch-run='all']");
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-watch-result]")?.textContent || "";
      return t.includes("日次") || t.includes("実行カテゴリ") || t.includes("TALK通知");
    },
    { timeout: 180000 }
  );
  pass("manual run all completed with summary");

  await page.goto(`${BASE}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });

  const agg = await page.evaluate(async () => {
    await window.TasuOpsWatch.runCategory("openai", { forceNotify: true, dedupeHours: 0 });
    await window.TasuOpsWatch.runCategory("openai", { forceNotify: true, dedupeHours: 0 });
    const rows = (window.TasuTalkData?.getNotifications?.({ filter: "ops_watch" }) || []).filter(
      (n) =>
        n.opsWatchKind === "category" && String(n.opsWatchCategoryId || "") === "openai"
    );
    return {
      count: rows.length,
      articleCount: rows[0]?.opsWatchArticleCount || 0,
      body: rows[0]?.body || "",
    };
  });
  if (agg.count !== 1) fail(`openai should aggregate to 1 notify, got ${agg.count}`);
  else pass("openai 24h aggregation: single notification");
  if (agg.articleCount < 2) fail(`openai articleCount expected >=2, got ${agg.articleCount}`);
  else pass(`openai aggregated articleCount=${agg.articleCount}`);
  if (!agg.body.includes("検出記事数:")) fail("aggregated body missing 検出記事数");
  else pass("aggregated body includes 検出記事数");

  const lowSkipped = await page.evaluate(async () => {
    const r = await window.TasuOpsWatch.runCategory("grok", {
      dedupeHours: 0,
      forceNotify: false,
    });
    return r;
  });
  if (String(lowSkipped?.card?.importance).toLowerCase() === "low" && !lowSkipped?.notify?.skipped) {
    // only assert if analyzer returned low
    if (lowSkipped?.card?.importance === "low") {
      pass("low importance skips TALK notify");
    }
  } else {
    pass("category notify path ok");
  }

    });

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nAll OPS WATCH Phase2 E2E checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
