#!/usr/bin/env node
/**
 * TASFUL OPS WATCH Phase1 E2E
 *   node scripts/test-ops-watch-phase1-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const MOCK_OPENAI_SERPER = {
  ok: true,
  query: "mock-openai",
  results: [
    {
      title: "API Pricing - OpenAI",
      snippet: "Explore OpenAI API pricing for GPT models.",
      link: "https://openai.com/api/pricing/",
    },
    {
      title: "OpenAI News",
      snippet: "NovaForge AI launched a new model for developers with workflow tools.",
      link: "https://example.com/novaforge",
    },
  ],
};

const MOCK_STRIPE_SERPER = {
  ok: true,
  query: "mock-stripe",
  results: [
    {
      title: "Our top product updates from Sessions 2025 - Stripe",
      snippet:
        "This post recaps the top announcements from Sessions 2025. See the changelog for details.",
      link: "https://stripe.com/blog/top-product-updates-sessions-2025",
    },
    {
      title: "Stripe User Terms Update - November 18, 2025",
      snippet: "Updated terms take effect March 1, 2026 for most users.",
      link: "https://support.stripe.com/questions/stripe-user-terms-update",
    },
    {
      title: "Pricing & Fees - Stripe",
      snippet: "Find Stripe processing fees for cards and pay-as-you-go pricing.",
      link: "https://stripe.com/pricing",
    },
  ],
};

const MOCK_AI_JSON = {
  headline: "【E2E】監視サマリー",
  summary: "AI分析によるテスト要約です。",
  importance: "medium",
  tasfulImpact: "TASFULへの影響（テスト）",
  recommendedAction: "推奨アクション（テスト）",
  isNewService: false,
  newServiceName: "",
  introductionProposal: "",
};

const ALLOWED_ACTIONS = new Set([
  "対応不要",
  "監視継続",
  "規約確認",
  "コスト確認",
  "システム改修検討",
  "FAQ更新",
  "運営周知",
  "Connect設定確認",
]);

function pickField(v) {
  return String(v || "").trim().length > 0;
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const errors = [];
  const pass = (msg) => console.log(`  OK  ${msg}`);
  const fail = (msg) => {
    errors.push(msg);
    console.error(`  NG  ${msg}`);
  };

  await page.goto(`${BASE}/talk-home.html`, {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });
  await page.waitForFunction(() => typeof window.TasuOpsWatch?.runCategory === "function", {
    timeout: 15000,
  });

  await page.evaluate(() => {
    window.TasuOpsWatchStore?.clearForTests?.();
    localStorage.removeItem("tasful_talk_notifications");
    localStorage.removeItem("tasful_talk_notifications_seeded_v2");
  });

  // --- Stripe: 記事タイトル誤検知しない + AI優先 ---
  await page.evaluate(
    ({ stripeMock, aiJson }) => {
      window.__TASU_SERPER_MOCK_RESPONSE__ = stripeMock;
      const orig = window.TasuAiModelGateway.completeTurn.bind(window.TasuAiModelGateway);
      window.__OPS_WATCH_TEST_AI_RESTORE__ = orig;
      window.TasuAiModelGateway.completeTurn = async (params) => {
        if (String(params?.modeId || "").startsWith("ops-watch")) {
          return { reply: JSON.stringify(aiJson), modelId: "test", fallback_used: false };
        }
        return orig(params);
      };
    },
    { stripeMock: MOCK_STRIPE_SERPER, aiJson: MOCK_AI_JSON }
  );

  const stripeRun = await page.evaluate(() =>
    window.TasuOpsWatch.runCategory("stripe", { forceNotify: true })
  );

  if (!stripeRun?.ok) fail(`stripe run: ${stripeRun?.reason}`);
  else pass("stripe run ok");

  if (stripeRun?.card?.isNewService) {
    fail(`stripe false positive new service: ${stripeRun.card.newServiceName}`);
  } else pass("stripe: no new service false positive");

  if (String(stripeRun?.card?.analysisSource).toLowerCase() !== "ai") {
    fail(`stripe analysisSource expected ai, got ${stripeRun?.card?.analysisSource}`);
  } else pass("stripe analysisSource=ai");

  const stripeNotify = await page.evaluate((id) => {
    const all = window.TasuTalkNotifications?.getAll?.() || [];
    return all.find((row) => row.id === id) || null;
  }, stripeRun?.notify?.notification?.id);
  const stripeBody = stripeNotify?.body || "";

  if (!stripeBody.includes("【OPS WATCH】")) fail("stripe notify missing compact header");
  else pass("stripe notify compact header");

  if (!stripeBody.includes("詳細は別画面またはモーダル")) {
    fail("stripe notify missing detail hint");
  } else pass("stripe notify detail hint");

  const stripeAnalysis = String(stripeNotify?.opsWatchDetail?.analysisSource || "");
  if (!stripeAnalysis.toLowerCase().includes("ai")) fail("stripe detail missing analysis AI");
  else pass("stripe opsWatchDetail analysis AI");

  if (stripeRun?.card?.introductionProposal) {
    fail(`stripe intro proposal should be empty: ${stripeRun.card.introductionProposal.slice(0, 60)}`);
  } else pass("stripe: no introduction proposal");

  if (stripeBody.includes("■導入提案")) {
    fail("stripe notify should not include 導入提案 section");
  } else pass("stripe notify no 導入提案 section");

  if (stripeBody.includes("（なし）") || stripeBody.includes("(なし)")) {
    fail("stripe notify must not contain (なし)");
  } else pass("stripe notify has no empty placeholders");

  const stripeCard = stripeRun?.card || {};
  if (!pickField(stripeCard.summary)) fail("stripe card summary empty");
  else pass("stripe card summary required");
  if (!pickField(stripeCard.tasfulImpact)) fail("stripe card tasfulImpact empty");
  else pass("stripe card tasfulImpact required");
  if (!pickField(stripeCard.recommendedAction)) fail("stripe card recommendedAction empty");
  else pass("stripe card recommendedAction required");

  // --- AI が空フィールドを返してもフォールバックで埋める ---
  await page.evaluate(() => {
    window.TasuOpsWatchStore?.clearForTests?.();
    localStorage.removeItem("tasful_talk_notifications");
  });
  await page.evaluate(
    ({ stripeMock }) => {
      window.__TASU_SERPER_MOCK_RESPONSE__ = stripeMock;
      window.TasuAiModelGateway.completeTurn = async (params) => {
        if (String(params?.modeId || "").startsWith("ops-watch")) {
          return {
            reply: JSON.stringify({
              headline: "空フィールドテスト",
              summary: "",
              importance: "medium",
              tasfulImpact: "",
              recommendedAction: "",
              isNewService: false,
              newServiceName: "",
              introductionProposal: "",
            }),
          };
        }
        return { reply: "" };
      };
    },
    { stripeMock: MOCK_STRIPE_SERPER }
  );
  const emptyAiRun = await page.evaluate(() =>
    window.TasuOpsWatch.runCategory("stripe", { forceNotify: true })
  );
  const emptyCard = emptyAiRun?.card || {};
  if (!pickField(emptyCard.summary) || String(emptyCard.summary).includes("なし")) {
    fail(`empty AI summary fallback: ${emptyCard.summary}`);
  } else pass("empty AI summary fallback");
  if (
    !pickField(emptyCard.tasfulImpact) ||
    !String(emptyCard.tasfulImpact).includes("TASFUL")
  ) {
    fail(`empty AI tasfulImpact fallback: ${emptyCard.tasfulImpact}`);
  } else pass("empty AI tasfulImpact fallback");
  if (
    emptyCard.recommendedAction !== "監視継続" &&
    !ALLOWED_ACTIONS.has(emptyCard.recommendedAction)
  ) {
    fail(`empty AI action fallback: ${emptyCard.recommendedAction}`);
  } else pass("empty AI recommendedAction fallback");

  // --- AI失敗時のみ template fallback ---
  await page.evaluate(() => {
    window.TasuAiModelGateway.completeTurn = async () => ({ reply: "", fallback_used: true });
  });

  const templateRun = await page.evaluate(() => {
    window.__TASU_SERPER_MOCK_RESPONSE__ = {
      ok: true,
      query: "mock",
      results: [
        {
          title: "API Pricing - OpenAI",
          snippet: "Pricing page update.",
          link: "https://openai.com/pricing",
        },
      ],
    };
    return window.TasuOpsWatch.runCategory("openai", { forceNotify: true });
  });

  if (String(templateRun?.card?.analysisSource).toLowerCase() !== "template") {
    fail(`openai template fallback expected template, got ${templateRun?.card?.analysisSource}`);
  } else pass("AI failure uses template fallback");

  const templateNotify = await page.evaluate((id) => {
    const all = window.TasuTalkNotifications?.getAll?.() || [];
    return all.find((n) => n.id === id) || null;
  }, templateRun?.notify?.notification?.id);
  const templateBody = templateNotify?.body || "";
  if (!templateBody.includes("【OPS WATCH】")) fail("template notify missing compact header");
  else pass("template notify compact header");

  const templateAnalysis = String(templateNotify?.opsWatchDetail?.analysisSource || "");
  if (!templateAnalysis.toLowerCase().includes("template")) {
    fail("template detail missing template fallback");
  } else pass("template opsWatchDetail template fallback");

  // --- 検索失敗でも TALK 通知継続 ---
  await page.evaluate(() => {
    if (window.__OPS_WATCH_TEST_AI_RESTORE__) {
      window.TasuAiModelGateway.completeTurn = window.__OPS_WATCH_TEST_AI_RESTORE__;
    }
  });

  const runFail = await page.evaluate(async (aiJson) => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input || "").includes("/functions/v1/serper-search")) {
        throw new TypeError("Failed to fetch");
      }
      return realFetch(input, init);
    };
    delete window.__TASU_SERPER_MOCK_RESPONSE__;
    window.TasuAiModelGateway.completeTurn = async (params) => {
      if (String(params?.modeId || "").startsWith("ops-watch")) {
        return { reply: JSON.stringify(aiJson) };
      }
      return { reply: "" };
    };
    return window.TasuOpsWatch.runCategory("supabase", { forceNotify: true });
  }, MOCK_AI_JSON);

  if (!runFail?.ok) fail(`search-fail run: ${runFail?.reason}`);
  else pass("search failure still ok=true");

  if (!runFail?.notify?.notification?.id && runFail?.notify?.skipped) {
    fail(`search-fail notify skipped: ${runFail.notify?.reason}`);
  } else pass("search-fail TALK notification delivered");

  const failNotify = await page.evaluate((id) => {
    const all = window.TasuTalkNotifications?.getAll?.() || [];
    return all.find((n) => n.id === id) || null;
  }, runFail?.notify?.notification?.id);
  if (!String(failNotify?.body || "").includes("【OPS WATCH】")) {
    fail("search-fail notify missing compact header");
  } else pass("search-fail notify compact header");

  // --- validateNewServiceHeuristic unit in page ---
  const headlineBlocked = await page.evaluate(() => {
    const A = window.TasuOpsWatchAnalyzer;
    const cat = window.TasuOpsWatchCategories.getCategory("stripe");
    const results = [
      {
        title: "Our top product updates from Sessions 2025 - Stripe",
        snippet: "Sessions recap.",
        url: "https://stripe.com/blog",
      },
      {
        title: "Stripe Pricing",
        snippet: "Fees overview.",
        url: "https://stripe.com/pricing",
      },
    ];
    return A.validateNewServiceName("Our top product updates from Sessions 2025", cat, results);
  });
  if (headlineBlocked?.ok) fail("validateNewServiceName should block article title");
  else pass(`headline blocked: ${headlineBlocked?.reason}`);

    });

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nAll OPS WATCH Phase1 E2E checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
