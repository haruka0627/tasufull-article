/**
 * Phase 6 — OpenRouter Limited PoC tests（mock / static · live secret 不要）
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_POC_MODELS,
  OPENROUTER_POC_WORKSPACE_IDS,
  OPENROUTER_ERROR_CODES,
  OPENROUTER_POC_TEST_ONLY_RATES,
  classifyOpenRouterHttpStatus,
  evaluateOpenRouterPocGate,
  extractOpenRouterUsageUnits,
  isAllowedOpenRouterSlug,
  resolveOpenRouterPocModel,
  buildOpenRouterUsageMetadata,
} from "./lib/ai-openrouter-poc.mjs";
import { callOpenRouterChat } from "./lib/ai-openrouter-client.mjs";
import {
  estimateEventCost,
  COST_STATUS_UNKNOWN_RATE,
  COST_STATUS_ESTIMATED,
  PROVISIONAL_GEMINI_FLASH_RATES,
} from "./lib/ai-cost-ledger.mjs";
import {
  getPlanPolicy,
  isFeatureAllowedForPolicy,
  featureForEdge,
  CANONICAL_PLAN_IDS,
} from "./lib/ai-plan-policy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err?.message || err);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err?.message || err);
  }
}

// --- Identity ---
check("poc models max 2", () => {
  assert.equal(OPENROUTER_POC_WORKSPACE_IDS.length, 2);
});

check("canonical openrouter slugs", () => {
  assert.equal(
    OPENROUTER_POC_MODELS["or-gemini-flash"].openrouterModelSlug,
    "google/gemini-2.5-flash"
  );
  assert.equal(OPENROUTER_POC_MODELS["or-gpt"].openrouterModelSlug, "openai/gpt-4o-mini");
});

check("unknown slug rejected", () => {
  assert.equal(resolveOpenRouterPocModel("meta/llama-3"), null);
  assert.equal(isAllowedOpenRouterSlug("arbitrary/model"), false);
});

check("direct vs openrouter distinguished", () => {
  const identity = readFileSync(join(root, "ai-model-identity.js"), "utf8");
  assert.match(identity, /routeType: "direct"/);
  assert.match(identity, /routeType: "openrouter"/);
  assert.match(identity, /pocOnly: true/);
  assert.match(identity, /productionEnabled: false/);
});

check("cost ledger id uses openrouter provider", () => {
  const e = OPENROUTER_POC_MODELS["or-gemini-flash"];
  assert.equal(e.costLedgerProvider, "openrouter");
  assert.equal(e.costLedgerModel, "google/gemini-2.5-flash");
  assert.notEqual(e.costLedgerProvider, "gemini");
});

check("general UI identity excludes poc", () => {
  const identity = readFileSync(join(root, "ai-model-identity.js"), "utf8");
  // WORKSPACE_IDS filter excludes poc
  assert.match(identity, /productionEnabled === true/);
  const html = readFileSync(join(root, "ai-workspace.html"), "utf8");
  assert.doesNotMatch(html, /openrouter-chat/);
  assert.doesNotMatch(html, /or-gemini-flash/);
  assert.doesNotMatch(html, /OpenRouter/);
});

// --- Auth / Policy ---
check("poc gate disabled by default", () => {
  const g = evaluateOpenRouterPocGate({
    pocEnabled: "false",
    harnessTokenExpected: "tok",
    harnessTokenProvided: "tok",
    userId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(g.ok, false);
  assert.equal(g.error, "openrouter_poc_disabled");
});

check("poc gate rejects missing harness", () => {
  const g = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "",
    userId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(g.ok, false);
  assert.equal(g.error, "openrouter_poc_forbidden");
});

check("poc gate rejects anonymous", () => {
  const g = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "",
  });
  assert.equal(g.ok, false);
  assert.equal(g.error, "auth_required");
});

check("poc gate rejects client enable flag", () => {
  const g = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "11111111-1111-4111-8111-111111111111",
    clientEnableFlag: true,
  });
  assert.equal(g.ok, false);
  assert.equal(g.error, "openrouter_poc_client_flag_rejected");
});

check("poc gate rejects forged plan / admin override", () => {
  const plan = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "11111111-1111-4111-8111-111111111111",
    clientPlanId: "pro",
  });
  assert.equal(plan.ok, false);
  const admin = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "11111111-1111-4111-8111-111111111111",
    clientAdminOverride: true,
  });
  assert.equal(admin.ok, false);
});

check("poc gate allowlist user", () => {
  const denied = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "11111111-1111-4111-8111-111111111111",
    allowlistCsv: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(denied.ok, false);
  const ok = evaluateOpenRouterPocGate({
    pocEnabled: "true",
    harnessTokenExpected: "secret",
    harnessTokenProvided: "secret",
    userId: "11111111-1111-4111-8111-111111111111",
    allowlistCsv: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(ok.ok, true);
});

check("production plans deny openrouter_chat feature", () => {
  assert.equal(featureForEdge("openrouter-chat"), "openrouter_chat");
  for (const id of CANONICAL_PLAN_IDS) {
    const policy = getPlanPolicy(id);
    assert.equal(
      isFeatureAllowedForPolicy(policy, "openrouter_chat"),
      false,
      `${id} must deny openrouter_chat`
    );
  }
});

// --- Gateway client ---
await checkAsync("secret missing", async () => {
  const r = await callOpenRouterChat({
    apiKey: "",
    modelSlug: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, OPENROUTER_ERROR_CODES.secret_missing);
});

await checkAsync("endpoint injection denied", async () => {
  const r = await callOpenRouterChat({
    apiKey: "sk-test",
    modelSlug: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: "hi" }],
    endpoint: "https://evil.example/v1/chat",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, OPENROUTER_ERROR_CODES.endpoint_injection);
});

await checkAsync("slug injection denied", async () => {
  const r = await callOpenRouterChat({
    apiKey: "sk-test",
    modelSlug: "evil/model",
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, OPENROUTER_ERROR_CODES.slug_injection);
});

async function mockStatus(status, body, contentType = "application/json") {
  return callOpenRouterChat({
    apiKey: "sk-test",
    modelSlug: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "hi" }],
    fetchImpl: async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => contentType },
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

await checkAsync("401 classified", async () => {
  const r = await mockStatus(401, { error: { message: "nope" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.unauthorized);
});

await checkAsync("402 classified", async () => {
  const r = await mockStatus(402, { error: { message: "pay" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.payment_required);
});

await checkAsync("403 classified", async () => {
  const r = await mockStatus(403, { error: { message: "forbid" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.forbidden);
});

await checkAsync("404 classified", async () => {
  const r = await mockStatus(404, { error: { message: "missing" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.not_found);
});

await checkAsync("408 classified", async () => {
  const r = await mockStatus(408, { error: { message: "timeout" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.request_timeout);
});

await checkAsync("429 classified", async () => {
  const r = await mockStatus(429, { error: { message: "rate" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.rate_limited);
});

await checkAsync("5xx classified", async () => {
  const r = await mockStatus(503, { error: { message: "down" } });
  assert.equal(r.error, OPENROUTER_ERROR_CODES.upstream_5xx);
});

await checkAsync("malformed JSON", async () => {
  const r = await mockStatus(200, "{not-json");
  assert.equal(r.error, OPENROUTER_ERROR_CODES.malformed_json);
});

await checkAsync("invalid content-type", async () => {
  const r = await mockStatus(200, "ok", "text/plain");
  assert.equal(r.error, OPENROUTER_ERROR_CODES.invalid_content_type);
});

await checkAsync("oversized response", async () => {
  const big = JSON.stringify({
    choices: [{ message: { content: "x".repeat(600 * 1024) } }],
  });
  const r = await mockStatus(200, big);
  assert.equal(r.error, OPENROUTER_ERROR_CODES.oversized_response);
});

await checkAsync("abort / timeout path", async () => {
  const r = await callOpenRouterChat({
    apiKey: "sk-test",
    modelSlug: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: "hi" }],
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
    timeoutMs: 20,
  });
  assert.equal(r.ok, false);
  assert.ok(
    r.error === OPENROUTER_ERROR_CODES.abort ||
      r.error === OPENROUTER_ERROR_CODES.timeout
  );
});

await checkAsync("success with provider tokens", async () => {
  const r = await mockStatus(200, {
    model: "openai/gpt-4o-mini",
    choices: [{ message: { content: "hello" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.usage.usageSource, "provider_tokens");
  assert.equal(r.usage.inputUnits, 10);
  assert.equal(r.usage.outputUnits, 5);
});

check("usage unavailable does not invent units", () => {
  const u = extractOpenRouterUsageUnits(null);
  assert.equal(u.usageSource, "unavailable");
  assert.equal(u.inputUnits, null);
});

check("fixed endpoint constant", () => {
  assert.equal(OPENROUTER_API_ENDPOINT, "https://openrouter.ai/api/v1/chat/completions");
});

check("http classifier table", () => {
  assert.equal(classifyOpenRouterHttpStatus(429).publicCode, OPENROUTER_ERROR_CODES.rate_limited);
});

// --- Usage log metadata / files ---
check("usage log allows openrouter provider", () => {
  const ts = readFileSync(
    join(root, "supabase/functions/_shared/ai-usage-log.ts"),
    "utf8"
  );
  const mjs = readFileSync(
    join(root, "deploy/cloudflare/functions/_shared/ai-usage-log.mjs"),
    "utf8"
  );
  assert.match(ts, /"openrouter"/);
  assert.match(mjs, /openrouter:\s*true/);
  assert.match(ts, /"route_type"/);
  assert.match(ts, /"upstream_provider"/);
  assert.match(ts, /"openrouter_model"/);
  assert.match(ts, /"usage_source"/);
});

check("usage metadata builder", () => {
  const meta = buildOpenRouterUsageMetadata(OPENROUTER_POC_MODELS["or-gpt"], {
    source: "openrouter-chat",
  });
  assert.equal(meta.route_type, "openrouter");
  assert.equal(meta.upstream_provider, "openai");
  assert.equal(meta.openrouter_model, "openai/gpt-4o-mini");
  assert.ok(!("prompt" in meta));
});

check("edge records provider openrouter", () => {
  const edge = readFileSync(
    join(root, "supabase/functions/openrouter-chat/index.ts"),
    "utf8"
  );
  assert.match(edge, /provider:\s*"openrouter"/);
  assert.match(edge, /OPENROUTER_POC_SURFACE/);
  assert.doesNotMatch(edge, /provider:\s*"openai"/);
});

// --- Cost Ledger ---
check("openrouter rate separated from direct gemini", () => {
  const at = "2026-06-01T00:00:00.000Z";
  const direct = estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUnits: 1000,
      outputUnits: 500,
      createdAt: at,
    },
    PROVISIONAL_GEMINI_FLASH_RATES
  );
  const viaOr = estimateEventCost(
    {
      status: "success",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      inputUnits: 1000,
      outputUnits: 500,
      createdAt: at,
    },
    PROVISIONAL_GEMINI_FLASH_RATES
  );
  assert.equal(direct.costStatus, COST_STATUS_ESTIMATED);
  assert.equal(viaOr.costStatus, COST_STATUS_UNKNOWN_RATE);
});

check("openrouter provisional test-only rate lookup", () => {
  const est = estimateEventCost(
    {
      status: "success",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      inputUnits: 1_000_000,
      outputUnits: 1_000_000,
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    OPENROUTER_POC_TEST_ONLY_RATES
  );
  assert.equal(est.costStatus, COST_STATUS_ESTIMATED);
  assert.equal(est.provisional, true);
  assert.ok(est.estimatedCost > 0);
});

check("unknown openrouter model stays unknown_rate not zero", () => {
  const est = estimateEventCost(
    {
      status: "success",
      provider: "openrouter",
      model: "unknown/slug",
      inputUnits: 100,
      outputUnits: 100,
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    OPENROUTER_POC_TEST_ONLY_RATES
  );
  assert.equal(est.costStatus, COST_STATUS_UNKNOWN_RATE);
});

check("migration adds openrouter provider", () => {
  const mig = readFileSync(
    join(root, "supabase/migrations/20260727010000_ai_usage_openrouter_provider.sql"),
    "utf8"
  );
  assert.match(mig, /'openrouter'/);
  assert.match(mig, /ingest_ai_usage_event/);
  assert.match(mig, /on conflict \(request_id\) do nothing/);
});

check("gateway workspace not wired to openrouter", () => {
  const gw = readFileSync(join(root, "ai-model-gateway.js"), "utf8");
  assert.doesNotMatch(gw, /openrouter-chat/);
  assert.doesNotMatch(gw, /provider === "openrouter"/);
});

check("plan models do not list poc ids", () => {
  for (const id of CANONICAL_PLAN_IDS) {
    const policy = getPlanPolicy(id);
    for (const m of policy.allowedWorkspaceModels) {
      assert.ok(!String(m).startsWith("or-"), `${id} leaked poc model ${m}`);
    }
  }
});

check("poc edge + guard files exist", () => {
  assert.ok(existsSync(join(root, "supabase/functions/openrouter-chat/index.ts")));
  assert.ok(existsSync(join(root, "supabase/functions/_shared/ai-openrouter-client.ts")));
  const guard = readFileSync(
    join(root, "supabase/functions/_shared/ai-usage-guard.ts"),
    "utf8"
  );
  assert.match(guard, /enforceGuardOpenRouterPocEntry/);
  assert.match(guard, /finalizeGuardOpenRouterPocConsume/);
});

console.log(`\nPhase6 OpenRouter PoC: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
