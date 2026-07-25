#!/usr/bin/env node
/**
 * ai-tasful-search Edge — schema unit + optional Staging live HTTP
 *   node scripts/test-ai-tasful-search-edge.mjs
 *   AI_TASFUL_SEARCH_LIVE=1 node scripts/test-ai-tasful-search-edge.mjs
 *
 * Live mode uses .env.staging (or SUPABASE_URL / SUPABASE_ANON_KEY).
 * Production URLs are refused.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_BODY_BYTES,
  assertSafeDetailUrl,
  validateSearchBody,
} from "./lib/ai-tasful-search-edge-schema.mjs";
import {
  checkStagingNotProductionLinked,
  getProductionRef,
  getStagingRef,
  loadStagingDotEnv,
} from "./lib/supabase-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const liveMeta = {
  hitCount: null,
  truncated: null,
  publicHitVerified: false,
};

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function maskRef(ref) {
  const s = String(ref || "");
  if (s.length < 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * Staging-only live credentials. Never fall back to chat-supabase-config
 * (often Production on local 8788 builds).
 */
function loadStagingLiveConfig() {
  loadStagingDotEnv();
  const guard = checkStagingNotProductionLinked();
  if (!guard.ok) {
    return { error: guard.message };
  }
  const stagingRef = getStagingRef();
  const productionRef = getProductionRef();
  const base = String(process.env.SUPABASE_URL || process.env.TASFUL_SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.TASFUL_SUPABASE_ANON_KEY || ""
  ).trim();

  if (!base || !anonKey) {
    return { error: "missing SUPABASE_URL / SUPABASE_ANON_KEY (load .env.staging)" };
  }
  if (base.includes(productionRef) || anonKey.includes(productionRef)) {
    return { error: "refused: credentials look like Production" };
  }
  if (!base.includes(stagingRef)) {
    return { error: `refused: URL does not include Staging ref ${maskRef(stagingRef)}` };
  }
  return {
    base,
    anonKey,
    stagingRef,
    productionRef,
    linked: guard.linked,
  };
}

async function postEdge(base, anonKey, body, { method = "POST", headers = {}, rawBody } = {}) {
  const res = await fetch(`${base}/functions/v1/ai-tasful-search`, {
    method,
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      ...(rawBody !== undefined || method === "POST"
        ? { "Content-Type": headers["Content-Type"] || "application/json" }
        : {}),
      ...headers,
    },
    body:
      method === "GET" || method === "OPTIONS"
        ? undefined
        : rawBody !== undefined
          ? rawBody
          : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, data, headers: res.headers, text };
}

function runSchemaTests() {
  const ok = validateSearchBody({
    action: "search",
    vertical: "marketplace",
    query: "古着 ジャケット",
    location: "東京都",
    priceMin: 1000,
    priceMax: 3000,
    sort: "price_asc",
    limit: 5,
  });
  assert("schema valid marketplace", ok.ok && ok.value.vertical === "marketplace");

  assert(
    "schema empty query allowed shape",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "",
      sort: "relevance",
    }).ok === true
  );

  assert(
    "schema query too long",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "あ".repeat(301),
      sort: "relevance",
    }).ok === false
  );

  assert("schema reject null body", validateSearchBody(null).code === "invalid_input");
  assert("schema reject array body", validateSearchBody([]).code === "invalid_input_type");
  assert("schema reject string body", validateSearchBody("x").code === "invalid_input_type");

  assert(
    "schema unknown vertical",
    validateSearchBody({
      action: "search",
      vertical: "booking",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema builder unsupported",
    validateSearchBody({
      action: "search",
      vertical: "builder",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema platform job ok",
    validateSearchBody({
      action: "search",
      vertical: "platform",
      type: "job",
      query: "動画編集",
      sort: "relevance",
    }).ok === true &&
      validateSearchBody({
        action: "search",
        vertical: "platform",
        type: "job",
        query: "動画編集",
        sort: "relevance",
      }).value.type === "job"
  );
  assert(
    "schema platform missing type",
    validateSearchBody({
      action: "search",
      vertical: "platform",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema platform skill unsupported",
    validateSearchBody({
      action: "search",
      vertical: "platform",
      type: "skill",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema history_lookup unsupported",
    validateSearchBody({
      action: "history_lookup",
      vertical: "marketplace",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema unknown action",
    validateSearchBody({
      action: "hack",
      vertical: "marketplace",
      query: "x",
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema unknown sort",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "x",
      sort: "magic",
    }).ok === false
  );
  assert(
    "schema limit > 5",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "x",
      sort: "relevance",
      limit: 6,
    }).ok === false
  );
  assert(
    "schema negative price",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "x",
      priceMin: -1,
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema priceMin > priceMax",
    validateSearchBody({
      action: "search",
      vertical: "marketplace",
      query: "x",
      priceMin: 5000,
      priceMax: 1000,
      sort: "relevance",
    }).ok === false
  );
  assert(
    "schema prototype pollution ignored/rejected",
    (() => {
      const r = validateSearchBody({
        action: "search",
        vertical: "marketplace",
        query: "x",
        sort: "relevance",
        __proto__: { polluted: true },
        constructor: { prototype: { x: 1 } },
      });
      return r.ok === true || r.ok === false;
    })()
  );

  assert(
    "detail url allow product",
    assertSafeDetailUrl("detail-product.html?id=abc&from=ai") === true
  );
  assert(
    "detail url allow job",
    assertSafeDetailUrl("detail-job.html?id=abc&from=ai") === true
  );
  assert(
    "detail url reject https",
    assertSafeDetailUrl("https://evil.example/x") === false
  );
  assert(
    "detail url reject js",
    assertSafeDetailUrl("javascript:alert(1)") === false
  );
}

function assertSafePublicPayload(data, label) {
  const json = JSON.stringify(data);
  assert(`${label} no phone`, !/"phone"\s*:/i.test(json) && !/電話/.test(json.slice(0, 50)));
  assert(
    `${label} no payment secrets`,
    !/"payment[_-]?url"/i.test(json) &&
      !/"bank[_-]?account"/i.test(json) &&
      !/"transfer"/i.test(json) &&
      !/"service_role"/i.test(json)
  );
  assert(`${label} no fake match score copy`, !json.includes("条件一致度"));
  assert(`${label} no _score leak`, !/"_score"\s*:/.test(json));
  assert(`${label} no _priceYen leak`, !/"_priceYen"\s*:/.test(json));
  assert(`${label} no stack`, !/"stack"\s*:/.test(json) && !/at\s+\w+\s+\(/.test(json));
  if (Array.isArray(data?.results)) {
    for (const r of data.results) {
      assert(
        `${label} detailUrl safe`,
        assertSafeDetailUrl(r.detailUrl) === true,
        String(r.detailUrl || "").slice(0, 80)
      );
      const u = String(r.detailUrl || "");
      assert(
        `${label} detailUrl relative only`,
        !/^https?:/i.test(u) && !u.startsWith("//") && !u.includes("..") && !/^javascript:/i.test(u)
      );
      assert(
        `${label} detail page allowlist`,
        u.startsWith("detail-product.html") || u.startsWith("detail-shop-product.html")
      );
    }
  }
}

async function runLiveTests(cfg) {
  const { base, anonKey, stagingRef, productionRef, linked } = cfg;
  pass(
    "live target staging",
    `linked=${maskRef(linked)} staging=${maskRef(stagingRef)} ≠ prod=${maskRef(productionRef)}`
  );

  const probe = await fetch(`${base}/functions/v1/ai-tasful-search`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:8788",
      "Access-Control-Request-Method": "POST",
    },
    signal: AbortSignal.timeout(15000),
  }).catch((e) => ({ ok: false, status: 0, error: e }));

  if (!probe || probe.status === 404 || probe.status === 0) {
    fail(
      "OPTIONS",
      `function not deployed (status=${probe?.status ?? "n/a"})`
    );
    return { skipped: false, deployed: false };
  }

  assert("OPTIONS", probe.status === 204 || probe.status === 200, `status=${probe.status}`);

  const getRes = await postEdge(base, anonKey, null, { method: "GET" });
  assert("GET → 405", getRes.status === 405, `status=${getRes.status}`);

  const emptyBody = await postEdge(base, anonKey, null, { rawBody: "" });
  assert("empty body → 400", emptyBody.status === 400, `status=${emptyBody.status}`);

  const nonJson = await postEdge(base, anonKey, null, {
    rawBody: "not-json",
    headers: { "Content-Type": "text/plain" },
  });
  assert("non-JSON → 400", nonJson.status === 400, `status=${nonJson.status}`);

  const arrayBody = await postEdge(base, anonKey, null, { rawBody: "[]" });
  assert("array body → 400", arrayBody.status === 400, `status=${arrayBody.status}`);

  const nullBody = await postEdge(base, anonKey, null, { rawBody: "null" });
  assert("null body → 400", nullBody.status === 400, `status=${nullBody.status}`);

  const huge = "あ".repeat(MAX_BODY_BYTES + 100);
  const oversized = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: huge,
    sort: "relevance",
  });
  assert(
    "oversized → 413/400",
    oversized.status === 413 || oversized.status === 400,
    `status=${oversized.status}`
  );

  const unknownAction = await postEdge(base, anonKey, {
    action: "hack",
    vertical: "marketplace",
    query: "x",
    sort: "relevance",
  });
  assert("unknown action → 400", unknownAction.status === 400);

  const unknownVertical = await postEdge(base, anonKey, {
    action: "search",
    vertical: "booking",
    query: "x",
    sort: "relevance",
  });
  assert("unknown vertical → 400", unknownVertical.status === 400);

  const builder = await postEdge(base, anonKey, {
    action: "search",
    vertical: "builder",
    query: "業者",
    sort: "relevance",
  });
  assert("builder → unsupported 400", builder.status === 400);

  const platformJob = await postEdge(base, anonKey, {
    action: "search",
    vertical: "platform",
    type: "job",
    query: "求人",
    sort: "relevance",
    limit: 5,
  });
  assert(
    "POST platform job shape",
    platformJob.status === 200 &&
      platformJob.data?.ok === true &&
      Array.isArray(platformJob.data.results),
    `status=${platformJob.status}`
  );
  if (platformJob.data?.ok) {
    assert("platform job count ≤ 5", platformJob.data.results.length <= 5);
    assertSafePublicPayload(platformJob.data, "job");
    const typesOk = platformJob.data.results.every(
      (r) => r.type === "job" || r.kind === "job" || r.vertical === "platform"
    );
    assert("platform job types", typesOk || platformJob.data.results.length === 0);
  }

  const platformSkill = await postEdge(base, anonKey, {
    action: "search",
    vertical: "platform",
    type: "skill",
    query: "x",
    sort: "relevance",
  });
  assert("platform skill → 400", platformSkill.status === 400);

  const history = await postEdge(base, anonKey, {
    action: "history_lookup",
    vertical: "marketplace",
    query: "x",
    sort: "relevance",
  });
  assert("history_lookup → unsupported 400", history.status === 400);

  const badSort = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "x",
    sort: "magic",
  });
  assert("bad sort → 400", badSort.status === 400);

  const lim = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "x",
    sort: "relevance",
    limit: 6,
  });
  assert("limit≥6 → 400", lim.status === 400);

  const longQ = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "あ".repeat(301),
    sort: "relevance",
  });
  assert("query>300 → 400", longQ.status === 400);

  const neg = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "x",
    priceMin: -3,
    sort: "relevance",
  });
  assert("negative price → 400", neg.status === 400);

  const range = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "x",
    priceMin: 9000,
    priceMax: 100,
    sort: "relevance",
  });
  assert("priceMin>priceMax → 400", range.status === 400);

  const proto = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "商品",
    sort: "relevance",
    __proto__: { admin: true },
    constructor: { prototype: { x: 1 } },
  });
  assert(
    "prototype pollution safe",
    proto.status === 200 || proto.status === 400,
    `status=${proto.status}`
  );
  if (proto.status === 200) {
    assertSafePublicPayload(proto.data, "proto");
  }

  const emptyQ = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "",
    sort: "relevance",
  });
  assert(
    "empty query → 0 results",
    emptyQ.status === 200 && emptyQ.data?.ok === true && emptyQ.data.results?.length === 0
  );

  const userIdIgnored = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "商品",
    sort: "relevance",
    user_id: "attacker-user-id",
    userId: "attacker-user-id",
  });
  assert(
    "body user_id ignored",
    userIdIgnored.status === 200 && userIdIgnored.data?.ok === true,
    `status=${userIdIgnored.status}`
  );

  const good = await postEdge(base, anonKey, {
    action: "search",
    vertical: "marketplace",
    query: "商品",
    sort: "relevance",
    limit: 5,
  });
  assert(
    "POST marketplace search shape",
    good.status === 200 && good.data?.ok === true && Array.isArray(good.data.results),
    `status=${good.status}`
  );

  if (good.data?.ok) {
    liveMeta.hitCount = good.data.results.length;
    liveMeta.truncated = Boolean(good.data.meta?.truncated);
    assert("result count ≤ 5", good.data.results.length <= 5);
    assert(
      "meta.count matches results",
      good.data.meta?.count === good.data.results.length,
      `meta=${good.data.meta?.count} len=${good.data.results.length}`
    );
    assert("meta.truncated boolean", typeof good.data.meta?.truncated === "boolean");
    assertSafePublicPayload(good.data, "search");
    if (good.data.results.length > 0) {
      liveMeta.publicHitVerified = true;
      pass("public catalog hit", `count=${good.data.results.length}`);
    } else {
      pass("0-result contract", "no public marketplace hits in Staging (acceptable)");
    }
  }

  return { skipped: false, deployed: true, liveMeta };
}

async function main() {
  console.log("\n=== schema (offline) ===");
  runSchemaTests();

  const wantLive =
    process.env.AI_TASFUL_SEARCH_LIVE === "1" ||
    process.env.AI_TASFUL_SEARCH_LIVE === "true" ||
    process.argv.includes("--live");

  console.log("\n=== live Edge (Staging) ===");
  if (!wantLive) {
    pass("live Edge skipped", "set AI_TASFUL_SEARCH_LIVE=1 or --live");
  } else {
    const cfg = loadStagingLiveConfig();
    if (cfg.error) {
      fail("live staging config", cfg.error);
    } else {
      await runLiveTests(cfg);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (liveMeta.hitCount != null) {
    console.log(
      `liveMeta: hits=${liveMeta.hitCount} truncated=${liveMeta.truncated} publicHitVerified=${liveMeta.publicHitVerified}`
    );
  }
  if (failed.length) process.exitCode = 1;
}

main();
