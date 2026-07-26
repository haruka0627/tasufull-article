#!/usr/bin/env node
/**
 * Browser smoke: Marketplace Edge wiring
 *   BASE_URL=http://127.0.0.1:8788 node scripts/test-ai-tasful-search-edge-browser.mjs
 *
 * Staging Edge (no client fallback):
 *   AI_TASFUL_SEARCH_STAGING_E2E=1 BASE_URL=http://127.0.0.1:8788 node scripts/test-ai-tasful-search-edge-browser.mjs
 *
 * Staging credentials come from .env.staging (never logged).
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  checkStagingNotProductionLinked,
  getProductionRef,
  getStagingRef,
  loadStagingDotEnv,
} from "./lib/supabase-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const STAGING_E2E =
  process.env.AI_TASFUL_SEARCH_STAGING_E2E === "1" ||
  process.env.AI_TASFUL_SEARCH_STAGING_E2E === "true";
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadStagingCreds() {
  loadStagingDotEnv();
  const guard = checkStagingNotProductionLinked();
  if (!guard.ok) return { error: guard.message };
  const stagingRef = getStagingRef();
  const productionRef = getProductionRef();
  const url = String(process.env.SUPABASE_URL || process.env.TASFUL_SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.TASFUL_SUPABASE_ANON_KEY || ""
  ).trim();
  if (!url || !anonKey) return { error: "missing staging URL/anon" };
  if (url.includes(productionRef)) return { error: "refused Production URL" };
  if (!url.includes(stagingRef)) return { error: "URL is not Staging" };
  return { url, anonKey, stagingRef };
}

async function main() {
  let staging = null;
  if (STAGING_E2E) {
    staging = loadStagingCreds();
    if (staging.error) {
      fail("staging credentials", staging.error);
      console.log(`\n${results.filter((r) => r.ok).length}/${results.length} PASS`);
      process.exitCode = 1;
      return;
    }
    pass("staging credentials loaded", `ref=${staging.stagingRef.slice(0, 4)}…`);
  }

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () => Boolean(window.TasuAiSearch?.queryProductItems && window.TasuAiModelGateway),
      { timeout: 15000 }
    );

    if (staging) {
      await page.evaluate(
        ({ url, anonKey }) => {
          const gw = window.TasuAiModelGateway;
          const orig = gw.getSupabaseEndpoint.bind(gw);
          gw.getSupabaseEndpoint = (name) => {
            if (name === "ai-tasful-search") {
              return {
                url: `${url}/functions/v1/ai-tasful-search`,
                anonKey,
              };
            }
            return orig(name);
          };
          // Staging E2E: never enable client fallback
          window.__TASU_AI_TASFUL_SEARCH_CLIENT_FALLBACK__ = false;
        },
        { url: staging.url, anonKey: staging.anonKey }
      );
    }

    const wiring = await page.evaluate(async (stagingMode) => {
      const hasFetch = typeof window.TasuAiSearch.fetchMarketplaceViaEdge === "function";
      const endpoint = window.TasuAiModelGateway.getSupabaseEndpoint?.("ai-tasful-search");

      let withFallbackSource = "";
      let withFallbackError = "";
      let withFallbackCount = 0;
      if (!stagingMode) {
        window.__TASU_AI_TASFUL_SEARCH_CLIENT_FALLBACK__ = true;
        const withFallback = await window.TasuAiSearch.queryProductItems({
          userText: "こういう商品ある？ 古着 ジャケット",
          messages: [],
          intentHints: {},
        });
        withFallbackSource = withFallback?.source || "";
        withFallbackError = withFallback?.error || "";
        withFallbackCount = (withFallback?.items || []).length;
      }

      window.__TASU_AI_TASFUL_SEARCH_CLIENT_FALLBACK__ = false;
      const fallbackFlag = window.__TASU_AI_TASFUL_SEARCH_CLIENT_FALLBACK__;

      let listingRestCalls = 0;
      const origFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const u = String(typeof input === "string" ? input : input?.url || "");
        if (/\/rest\/v1\/(listings|shop_store_products|business_listings)/.test(u)) {
          listingRestCalls += 1;
        }
        return origFetch(input, init);
      };

      const withoutFallback = await window.TasuAiSearch.queryProductItems({
        userText: "こういう商品ある？ 古着 ジャケット",
        messages: [],
        intentHints: {},
      });

      window.fetch = origFetch;

      return {
        hasFetch,
        endpointUrl: endpoint?.url || "",
        withFallbackSource,
        withFallbackError,
        withFallbackCount,
        withoutFallbackError: withoutFallback?.error || "",
        withoutFallbackSource: withoutFallback?.source || "",
        withoutFallbackCount: (withoutFallback?.items || []).length,
        fallbackFlag,
        listingRestCalls,
        meta: withoutFallback?.meta || null,
      };
    }, Boolean(staging));

    if (wiring.hasFetch) pass("fetchMarketplaceViaEdge exported");
    else fail("fetchMarketplaceViaEdge exported");

    const hasJobFetch = await page.evaluate(
      () => typeof window.TasuAiSearch?.fetchJobsViaEdge === "function"
    );
    if (hasJobFetch) pass("fetchJobsViaEdge exported");
    else fail("fetchJobsViaEdge exported");

    const hasBizFetch = await page.evaluate(
      () => typeof window.TasuAiSearch?.fetchBusinessServicesViaEdge === "function"
    );
    if (hasBizFetch) pass("fetchBusinessServicesViaEdge exported");
    else fail("fetchBusinessServicesViaEdge exported");

    const hasSkillFetch = await page.evaluate(
      () => typeof window.TasuAiSearch?.fetchSkillsViaEdge === "function"
    );
    if (hasSkillFetch) pass("fetchSkillsViaEdge exported");
    else fail("fetchSkillsViaEdge exported");

    const hasWorkerFetch = await page.evaluate(
      () => typeof window.TasuAiSearch?.fetchWorkersViaEdge === "function"
    );
    if (hasWorkerFetch) pass("fetchWorkersViaEdge exported");
    else fail("fetchWorkersViaEdge exported");

    const workerRouting = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      const gateway = window.TasuAiModelGateway;
      const originalEndpoint = gateway.getSupabaseEndpoint.bind(gateway);
      const store = window.TasuListingStore;
      const originalPublished = store.fetchPublishedListings.bind(store);
      const originalCatalog = window.TasuListingDemoCatalog;
      let edgeCalls = 0;
      let clientCalls = 0;
      let demoCalls = 0;
      const payloads = [];

      gateway.getSupabaseEndpoint = (name) =>
        name === "ai-tasful-search"
          ? {
              url: "https://phase5-worker.test/functions/v1/ai-tasful-search",
              anonKey: "test-anon-key",
            }
          : originalEndpoint(name);
      window.fetch = async (input, init) => {
        const url = String(typeof input === "string" ? input : input?.url || "");
        if (url.includes("/functions/v1/ai-tasful-search")) {
          edgeCalls += 1;
          payloads.push(JSON.parse(String(init?.body || "{}")));
          return new Response(
            JSON.stringify({
              ok: true,
              results: [
                {
                  id: "worker-edge-001",
                  vertical: "platform",
                  type: "worker",
                  kind: "worker",
                  title: "清掃サポート",
                  summary: "清掃と軽作業に対応",
                  priceLabel: "時給 ¥2,000",
                  locationLabel: "東京都",
                  availabilityLabel: "平日",
                  detailUrl: "detail-worker.html?id=worker-edge-001&from=ai",
                  primaryActionLabel: "プロフィールを見る",
                  badges: ["清掃"],
                },
              ],
              meta: { count: 1, truncated: false },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input, init);
      };
      store.fetchPublishedListings = async () => {
        clientCalls += 1;
        return [];
      };
      window.TasuListingDemoCatalog = {
        ...(originalCatalog || {}),
        getStoreListing: (id) => {
            demoCalls += 1;
            if (!["demo-worker-connect-001", "demo-worker-connect-002"].includes(id)) {
              return originalCatalog?.getStoreListing?.(id) || null;
          }
          return {
            id,
            listing_type: "worker",
            publish_status: "public",
            title: `Connect demo ${id}`,
            description: "Connect対応ワーカー",
            tags: ["Connect", "軽作業"],
            worker_display_name: "Connectワーカー",
            worker_services: "軽作業",
            worker_area: "東京都",
            worker_price_type: "時給",
            worker_price_amount: 2000,
            form_data: { connect_enabled: true },
          };
        },
      };

      const standalone = await window.TasuAiSearch.queryWorkerItems({
        userText: "東京で清掃を頼めるワーカー探して",
        messages: [],
        intentHints: {},
        searchIntentSchema: {
          action: "search",
          vertical: "platform",
          type: "worker",
          query: "東京で清掃を頼めるワーカー探して",
          location: "東京",
          category: "cleaning",
          sort: "relevance",
        },
      });
      const standaloneEdgeCalls = edgeCalls;
      const standaloneClientCalls = clientCalls;

      // Phase 5 wave 2: compound-plan worker branches (skill/repair/delivery)
      // are invoked with { workerPlanBranch: true }, mirroring runSearchPlan.
      const skillWorker = await window.TasuAiSearch.queryWorkerItems(
        {
          userText: "動画編集できる人探して",
          messages: [],
          intentHints: {},
          searchIntentSchema: {
            action: "search",
            vertical: "platform",
            type: "skill",
            query: "動画編集できる人探して",
            sort: "relevance",
          },
        },
        { workerPlanBranch: true }
      );
      const repairWorker = await window.TasuAiSearch.queryWorkerItems(
        {
          userText: "水漏れを直せる人を探して",
          messages: [],
          intentHints: { categoryId: "repair_maintenance" },
        },
        { workerPlanBranch: true }
      );
      const deliveryWorker = await window.TasuAiSearch.queryWorkerItems(
        {
          userText: "荷物を配達できる人を探して",
          messages: [],
          intentHints: { delivery: true },
        },
        { workerPlanBranch: true }
      );
      const compoundEdgeCalls = edgeCalls - standaloneEdgeCalls;

      // connectOnly must stay client even when invoked as a plan branch.
      const connectPlanBranch = await window.TasuAiSearch.queryWorkerItems(
        {
          userText: "Connect対応ワーカーを探して",
          messages: [],
          intentHints: { connectOnly: true },
        },
        { workerPlanBranch: true }
      );
      const connectOnly = await window.TasuAiSearch.queryWorkerItems({
        userText: "Connect対応ワーカーを探して",
        messages: [],
        intentHints: { connectOnly: true },
        searchIntentSchema: {
          action: "search",
          vertical: "platform",
          type: "worker",
          query: "Connect対応ワーカーを探して",
          sort: "relevance",
        },
      });

      window.fetch = originalFetch;
      gateway.getSupabaseEndpoint = originalEndpoint;
      store.fetchPublishedListings = originalPublished;
      if (originalCatalog) window.TasuListingDemoCatalog = originalCatalog;
      else delete window.TasuListingDemoCatalog;

      return {
        edgeCalls,
        clientCalls,
        payloads,
        standaloneEdgeCalls,
        standaloneClientCalls,
        standaloneSource: standalone?.source || "",
        standaloneCount: (standalone?.items || []).length,
        standaloneUrl: standalone?.items?.[0]?.detailUrl || "",
        standaloneCta: standalone?.items?.[0]?.primaryActionLabel || "",
        compoundEdgeCalls,
        skillWorkerSource: skillWorker?.source || "",
        skillWorkerUrl: skillWorker?.items?.[0]?.detailUrl || "",
        skillWorkerCta: skillWorker?.items?.[0]?.primaryActionLabel || "",
        skillWorkerType: skillWorker?.items?.[0]?.type || "",
        skillWorkerKind: skillWorker?.items?.[0]?.kind || "",
        repairWorkerSource: repairWorker?.source || "",
        deliveryWorkerSource: deliveryWorker?.source || "",
        connectPlanBranchSource: connectPlanBranch?.source || "",
        connectPlanBranchCount: (connectPlanBranch?.items || []).length,
        connectCount: (connectOnly?.items || []).length,
        connectSource: connectOnly?.source || "",
        demoCalls,
      };
    });
    if (
      workerRouting.standaloneEdgeCalls === 1 &&
      workerRouting.standaloneClientCalls === 0 &&
      workerRouting.standaloneSource === "edge" &&
      workerRouting.standaloneCount === 1
    ) {
      pass("standalone worker_request uses Edge only");
    } else {
      fail("standalone worker_request uses Edge only", JSON.stringify(workerRouting));
    }
    if (
      workerRouting.payloads.length === 4 &&
      workerRouting.payloads.every(
        (p) => p.vertical === "platform" && p.type === "worker"
      )
    ) {
      pass("worker Edge payload type (standalone + compound)");
    } else {
      fail("worker Edge payload type (standalone + compound)", JSON.stringify(workerRouting.payloads));
    }
    if (
      /^detail-worker\.html\?id=[^&]+&from=ai$/.test(workerRouting.standaloneUrl) &&
      workerRouting.standaloneCta === "プロフィールを見る"
    ) {
      pass("worker Edge detail URL and CTA");
    } else {
      fail("worker Edge detail URL and CTA", JSON.stringify(workerRouting));
    }
    // Phase 5 wave 2: compound-plan worker branches route to Edge.
    if (
      workerRouting.skillWorkerSource === "edge" &&
      /^detail-worker\.html\?id=[^&]+&from=ai$/.test(workerRouting.skillWorkerUrl) &&
      workerRouting.skillWorkerCta === "プロフィールを見る" &&
      workerRouting.skillWorkerType === "worker" &&
      workerRouting.skillWorkerKind === "worker"
    ) {
      pass("skill_request worker branch → Edge (detail-worker + CTA)");
    } else {
      fail("skill_request worker branch → Edge (detail-worker + CTA)", JSON.stringify(workerRouting));
    }
    if (workerRouting.repairWorkerSource === "edge") {
      pass("repair_request worker branch → Edge");
    } else {
      fail("repair_request worker branch → Edge", JSON.stringify(workerRouting));
    }
    if (workerRouting.deliveryWorkerSource === "edge") {
      pass("delivery_request worker branch → Edge");
    } else {
      fail("delivery_request worker branch → Edge", JSON.stringify(workerRouting));
    }
    // 3 compound worker branches (skill/repair/delivery) each hit Edge once.
    if (workerRouting.compoundEdgeCalls === 3) {
      pass("compound worker branches use Edge (x3)");
    } else {
      fail("compound worker branches use Edge (x3)", JSON.stringify(workerRouting));
    }
    // connectOnly=true stays client even when invoked as a plan branch.
    if (workerRouting.connectPlanBranchSource !== "edge") {
      pass("connectOnly plan branch stays client");
    } else {
      fail("connectOnly plan branch stays client", JSON.stringify(workerRouting));
    }
    // Total Edge calls: 1 standalone + 3 compound = 4; connect (x2) stay client.
    if (workerRouting.edgeCalls === 4 && workerRouting.clientCalls === 2) {
      pass("connectOnly (standalone + plan branch) stay client");
    } else {
      fail("connectOnly (standalone + plan branch) stay client", JSON.stringify(workerRouting));
    }
    if (workerRouting.connectCount > 0 && workerRouting.demoCalls >= 2) {
      pass("Connect demo merge preserved");
    }
    else fail("Connect demo merge preserved", JSON.stringify(workerRouting));

    // Phase 2 job + Phase 3 business_service + Phase 4 skill smoke (fallback off)
    const platformSmoke = await page.evaluate(async () => {
      window.__TASU_AI_TASFUL_SEARCH_CLIENT_FALLBACK__ = false;
      const job = await window.TasuAiSearch.queryJobItems({
        userText: "求人探したい 動画編集",
        messages: [],
        intentHints: {},
      });
      const biz = await window.TasuAiSearch.queryBusinessItems({
        userText: "東京の清掃業者",
        messages: [],
        intentHints: { categoryId: "cleaning" },
        searchIntentSchema: {
          action: "search",
          vertical: "platform",
          type: "business_service",
          query: "東京の清掃業者",
          location: "東京",
          category: "cleaning",
          sort: "relevance",
        },
      });
      const skill = await window.TasuAiSearch.querySkillItems({
        userText: "動画編集サービス",
        messages: [],
        intentHints: {},
        searchIntentSchema: {
          action: "search",
          vertical: "platform",
          type: "skill",
          query: "動画編集サービス",
          category: "video_editing",
          location: "東京",
          priceMin: 3000,
          priceMax: 30000,
          sort: "relevance",
        },
      });
      return {
        jobSource: job?.source || "",
        jobError: job?.error || "",
        jobCount: (job?.items || []).length,
        bizSource: biz?.source || "",
        bizError: biz?.error || "",
        bizCount: (biz?.items || []).length,
        bizShopMix: (biz?.items || []).some(
          (i) =>
            String(i.detailUrl || "").includes("detail-shop-store") ||
            i.type === "shop_store" ||
            i.kind === "shop_store"
        ),
        skillSource: skill?.source || "",
        skillError: skill?.error || "",
        skillCount: (skill?.items || []).length,
        skillWorkerMix: (skill?.items || []).some(
          (i) =>
            String(i.detailUrl || "").includes("detail-worker") ||
            i.type === "worker" ||
            i.kind === "worker"
        ),
      };
    });

    if (
      platformSmoke.jobSource === "edge" ||
      platformSmoke.jobError === "search_unavailable" ||
      platformSmoke.jobError === "invalid_search"
    ) {
      pass(
        "job edge path (no silent client)",
        `source=${platformSmoke.jobSource || "err:" + platformSmoke.jobError}`
      );
    } else {
      fail("job edge path (no silent client)", JSON.stringify(platformSmoke));
    }

    if (
      platformSmoke.bizSource === "edge" ||
      platformSmoke.bizError === "search_unavailable" ||
      platformSmoke.bizError === "invalid_search"
    ) {
      pass(
        "business_service edge path (no silent client)",
        `source=${platformSmoke.bizSource || "err:" + platformSmoke.bizError} count=${platformSmoke.bizCount}`
      );
    } else {
      fail("business_service edge path (no silent client)", JSON.stringify(platformSmoke));
    }

    if (!platformSmoke.bizShopMix) pass("business_service no shop_store mix");
    else fail("business_service no shop_store mix");

    if (
      platformSmoke.skillSource === "edge" ||
      platformSmoke.skillError === "search_unavailable" ||
      platformSmoke.skillError === "invalid_search"
    ) {
      pass(
        "skill edge path (no silent client)",
        `source=${platformSmoke.skillSource || "err:" + platformSmoke.skillError} count=${platformSmoke.skillCount}`
      );
    } else {
      fail("skill edge path (no silent client)", JSON.stringify(platformSmoke));
    }

    if (!platformSmoke.skillWorkerMix) pass("skill no worker mix");
    else fail("skill no worker mix");

    if (wiring.endpointUrl.includes("/functions/v1/ai-tasful-search")) {
      pass("endpoint resolves", wiring.endpointUrl.replace(/https?:\/\/[^/]+/, "<host>"));
    } else {
      fail("endpoint resolves", wiring.endpointUrl);
    }

    if (staging) {
      if (wiring.fallbackFlag === false) pass("fallback flag false");
      else fail("fallback flag false", String(wiring.fallbackFlag));

      if (wiring.withoutFallbackSource === "edge" && !wiring.withoutFallbackError) {
        pass("edge success without fallback", `count=${wiring.withoutFallbackCount}`);
        if (wiring.listingRestCalls === 0) {
          pass("no duplicate DB rest on edge success", `rest=${wiring.listingRestCalls}`);
        } else {
          fail("no duplicate DB rest on edge success", `rest=${wiring.listingRestCalls}`);
        }
      } else if (wiring.withoutFallbackError === "search_unavailable") {
        fail("edge success without fallback", "search_unavailable (Edge down?)");
      } else {
        fail(
          "edge success without fallback",
          JSON.stringify({
            source: wiring.withoutFallbackSource,
            error: wiring.withoutFallbackError,
          })
        );
      }
    } else {
      if (wiring.withFallbackSource === "client_fallback" || wiring.withFallbackSource === "edge") {
        pass("fallback path works", `source=${wiring.withFallbackSource}`);
      } else if (wiring.withFallbackError) {
        pass("query with flag completed", wiring.withFallbackError);
      } else {
        pass("query with flag completed", `count=${wiring.withFallbackCount}`);
      }

      if (
        wiring.withoutFallbackSource === "edge" ||
        wiring.withoutFallbackError === "search_unavailable" ||
        wiring.withoutFallbackError === "invalid_search"
      ) {
        pass(
          "no silent client fallback",
          `source=${wiring.withoutFallbackSource || "err:" + wiring.withoutFallbackError}`
        );
      } else {
        fail(
          "no silent client fallback",
          JSON.stringify({
            source: wiring.withoutFallbackSource,
            error: wiring.withoutFallbackError,
          })
        );
      }
    }
  });

  await closeAllBrowsers();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
