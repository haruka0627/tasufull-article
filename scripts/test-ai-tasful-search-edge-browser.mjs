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

    // Phase 2 job + Phase 3 business_service smoke (fallback off)
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
