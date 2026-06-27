/**
 * Web search provider unit tests (Brave / Serper parsers + provider resolution)
 *   npx tsx scripts/test-web-search-provider-unit-runner.ts
 */
import {
  executeWebSearch,
  normalizeBraveApiKey,
  parseBraveWebResponse,
  parseSerperResponse,
  resolveWebSearchProvider,
} from "../supabase/functions/_shared/web-search-provider.ts";

const results: { name: string; ok: boolean; detail?: string }[] = [];

function pass(name: string, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name: string, cond: boolean, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

// --- resolveWebSearchProvider ---
assert("explicit brave", resolveWebSearchProvider({ WEB_SEARCH_PROVIDER: "brave" }) === "brave");
assert("explicit serper", resolveWebSearchProvider({ WEB_SEARCH_PROVIDER: "serper" }) === "serper");
assert(
  "default brave when BRAVE key",
  resolveWebSearchProvider({ BRAVE_SEARCH_API_KEY: "k" }) === "brave"
);
assert(
  "default serper when no BRAVE key",
  resolveWebSearchProvider({ SERPER_API_KEY: "k" }) === "serper"
);
assert(
  "explicit serper overrides BRAVE key",
  resolveWebSearchProvider({ WEB_SEARCH_PROVIDER: "serper", BRAVE_SEARCH_API_KEY: "k" }) === "serper"
);

assert("normalizeBraveApiKey trims", normalizeBraveApiKey("  abc  ") === "abc");
assert(
  "normalizeBraveApiKey strips Bearer prefix",
  normalizeBraveApiKey("Bearer BSA-test-key") === "BSA-test-key"
);
assert(
  "normalizeBraveApiKey strips quotes",
  normalizeBraveApiKey('"BSA-test-key"') === "BSA-test-key"
);
assert("normalizeBraveApiKey strips newlines", normalizeBraveApiKey("abc\n") === "abc");

async function runAsyncTests() {
  // --- executeWebSearch mock fetch ---
  {
    const mockBraveBody = {
      web: {
        results: [{ title: "Mock Brave", url: "https://brave.test/", description: "ctx" }],
      },
    };
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.search.brave.com")) {
        const headers = init?.headers as Record<string, string> | undefined;
        assert("brave fetch no Authorization header", !headers?.Authorization && !headers?.authorization);
        assert(
          "brave fetch X-Subscription-Token only",
          headers?.["X-Subscription-Token"] === "test-key"
        );
        assert("brave fetch endpoint", url.startsWith("https://api.search.brave.com/res/v1/web/search?"));
        assert("brave fetch Accept json", headers?.Accept === "application/json");
        assert("brave fetch search_lang jp", url.includes("search_lang=jp"));
        return new Response(JSON.stringify(mockBraveBody), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const out = await executeWebSearch(
      "test query",
      3,
      { WEB_SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "  Bearer test-key\n" },
      mockFetch as typeof fetch
    );
    assert(
      "execute brave mock ok",
      out.ok === true,
      out.ok ? `provider=${out.provider}` : out.message
    );
    if (out.ok) {
      assert("execute brave results shape", out.results[0]?.title === "Mock Brave");
      assert("execute brave provider field", out.provider === "brave");
    }
  }

  {
    const mockSerperBody = {
      organic: [{ title: "Mock Serper", link: "https://serper.test/", snippet: "s" }],
    };
    const mockFetch = async () =>
      new Response(JSON.stringify(mockSerperBody), { status: 200 });

    const out = await executeWebSearch(
      "q",
      2,
      { WEB_SEARCH_PROVIDER: "serper", SERPER_API_KEY: "sk" },
      mockFetch as typeof fetch
    );
    assert("execute serper mock ok", out.ok === true);
    if (out.ok) assert("execute serper provider", out.provider === "serper");
  }

  assert(
    "brave missing key 503",
    (await executeWebSearch("q", 3, { WEB_SEARCH_PROVIDER: "brave" })).ok === false
  );
}

async function main() {
  runSyncTests();
  await runAsyncTests();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) process.exit(1);
}

function runSyncTests() {
  // --- parseBraveWebResponse ---
  {
    const braveFixture = {
      web: {
        results: [
          {
            title: "水漏れ修理 相場",
            url: "https://example.jp/leak",
            description: "一般的な費用目安は部位により異なります。",
          },
          {
            title: "No URL skip",
            description: "skip me",
          },
        ],
      },
    };
    const parsed = parseBraveWebResponse(braveFixture, 5);
    assert("brave parse count", parsed.length === 1, `len=${parsed.length}`);
    assert("brave title/url/snippet", parsed[0]?.title === "水漏れ修理 相場");
    assert("brave link+url alias", parsed[0]?.link === parsed[0]?.url);
    assert("brave snippet from description", parsed[0]?.snippet.includes("費用目安"));
    assert("brave source hostname", parsed[0]?.source === "example.jp");
  }

  // --- parseSerperResponse ---
  {
    const serperFixture = {
      organic: [
        {
          title: "TASFUL",
          link: "https://tasful.example/",
          snippet: "Platform overview",
        },
      ],
    };
    const parsed = parseSerperResponse(serperFixture, 3);
    assert("serper parse count", parsed.length === 1);
    assert("serper compat fields", parsed[0]?.link === "https://tasful.example/");
    assert("serper url alias", parsed[0]?.url === parsed[0]?.link);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
