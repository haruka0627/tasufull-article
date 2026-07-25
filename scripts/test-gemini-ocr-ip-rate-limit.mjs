#!/usr/bin/env node
/**
 * Gemini OCR IP rate limit regression (F6)
 *   node scripts/test-gemini-ocr-ip-rate-limit.mjs
 *
 * In-memory DB mirrors SQL:
 *   INSERT ... ON CONFLICT DO UPDATE SET hit_count = hit_count + 1
 *   WHERE hit_count < p_limit RETURNING
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "https://tasufull-article.pages.dev";
const LOCAL = "http://127.0.0.1:8788";
const SECRET = "test-ocr-ip-hmac-secret-32b";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const results = [];
const logSink = [];

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  (condition ? console.log : console.error)(
    `${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`
  );
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function env(extra = {}) {
  return {
    GEMINI_API_KEY: "test-gemini-key",
    SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    OCR_IP_RATE_HMAC_SECRET: SECRET,
    ...extra,
  };
}

function body(extra = {}) {
  return { mimeType: "image/png", base64: PNG, surface: "chat", feature: "ocr_turn", ...extra };
}

function request({
  origin = PROD,
  ip = "203.0.113.10",
  token = "token-user-a",
  headers = {},
  method = "POST",
  requestBody = body(),
  omitCfIp = false,
} = {}) {
  const h = {
    Origin: origin,
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...headers,
  };
  if (!omitCfIp && ip !== undefined && ip !== null) h["CF-Connecting-IP"] = ip;
  return new Request(`${origin}/api/gemini-ocr`, {
    method,
    headers: h,
    body: method === "POST" ? JSON.stringify(requestBody) : undefined,
  });
}

/** SQL 条件付き increment の同期実装 */
function createRateDb() {
  const buckets = new Map();
  let increments = 0;
  return {
    buckets,
    stats: () => ({ increments }),
    consume(bucketKey, windowKind, limit, windowStart, expiresAt) {
      const row = buckets.get(bucketKey);
      if (!row) {
        buckets.set(bucketKey, {
          bucket_key: bucketKey,
          window_kind: windowKind,
          hit_count: 1,
          window_start: windowStart,
          expires_at: expiresAt,
        });
        increments += 1;
        return { ok: true, window_kind: windowKind, count: 1, limit, remaining: limit - 1 };
      }
      if (row.hit_count < limit) {
        row.hit_count += 1;
        increments += 1;
        return {
          ok: true,
          window_kind: windowKind,
          count: row.hit_count,
          limit,
          remaining: Math.max(0, limit - row.hit_count),
        };
      }
      return {
        ok: false,
        error: "rate_limited",
        window_kind: windowKind,
        count: row.hit_count,
        limit,
        remaining: 0,
      };
    },
  };
}

function installFetchMock(db, options = {}) {
  const calls = { auth: [], rate: [], check: [], reserve: [], commit: [], release: [], gemini: [] };
  const original = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    const payload = init.body ? JSON.parse(String(init.body)) : {};

    if (value.includes("/auth/v1/user")) {
      calls.auth.push({ url: value, init });
      const token = String(init.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
      return { ok: true, status: 200, json: async () => ({ id: token.replace(/^token-/, "") }) };
    }
    if (value.includes("gen_ai_subscriptions")) {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (value.includes("/rpc/consume_ocr_ip_rate_limit")) {
      calls.rate.push({ url: value, init, payload });
      if (options.rateHttpError) return { ok: false, status: 500, json: async () => ({}) };
      if (options.rateNetworkError) throw new TypeError("raw rate SECRET");
      if (options.rateMalformed !== undefined) {
        return { ok: true, status: 200, json: async () => options.rateMalformed };
      }
      // 同期ブロック = conditional UPDATE の不可分性
      const row = db.consume(
        payload.p_bucket_key,
        payload.p_window_kind,
        payload.p_limit,
        payload.p_window_start,
        payload.p_expires_at
      );
      return { ok: true, status: 200, json: async () => row };
    }
    if (value.includes("/rpc/check_ai_workspace_quota")) {
      calls.check.push({ url: value, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, used: 0 }) };
    }
    if (value.includes("/rpc/reserve_ai_workspace_quota")) {
      calls.reserve.push({ url: value, init, payload });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          used: 1,
          reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      };
    }
    if (value.includes("/rpc/commit_ai_workspace_quota_reservation")) {
      calls.commit.push({ url: value, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "committed" }) };
    }
    if (value.includes("/rpc/release_ai_workspace_quota_reservation")) {
      calls.release.push({ url: value, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "released" }) };
    }
    if (value.includes("generativelanguage.googleapis.com")) {
      calls.gemini.push({ url: value, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "ocr" }] } }] }),
      };
    }
    throw new Error(`unexpected fetch: ${value}`);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function installLogCapture() {
  const original = { error: console.error, warn: console.warn, info: console.info };
  const capture = (...args) => {
    logSink.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  console.warn = capture;
  console.info = capture;
  console.error = (...args) => {
    capture(...args);
    if (typeof args[0] === "string" && args[0].startsWith("FAIL:")) original.error(...args);
  };
  return () => {
    console.error = original.error;
    console.warn = original.warn;
    console.info = original.info;
  };
}

async function loadFn() {
  const href = pathToFileURL(path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")).href;
  return import(`${href}?iprl=${Date.now()}-${Math.random()}`);
}

async function loadHelper() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-ip-rate-limit.mjs")
  ).href;
  return import(`${href}?iprl=${Date.now()}-${Math.random()}`);
}

async function invokeOnce(req, db, options = {}) {
  const mock = installFetchMock(db, options);
  const restoreLogs = installLogCapture();
  try {
    const mod = await loadFn();
    const response = await mod.onRequest({ request: req, env: env(options.envExtra) });
    const json = await response.json().catch(() => null);
    return { status: response.status, headers: response.headers, json, calls: mock.calls };
  } finally {
    restoreLogs();
    mock.restore();
  }
}

async function invokeParallel(reqs, db, options = {}) {
  const mock = installFetchMock(db, options);
  const restoreLogs = installLogCapture();
  try {
    const mod = await loadFn();
    const settled = await Promise.all(
      reqs.map(async (req) => {
        const response = await mod.onRequest({ request: req, env: env(options.envExtra) });
        const json = await response.json().catch(() => null);
        return { status: response.status, json };
      })
    );
    return { settled, calls: mock.calls };
  } finally {
    restoreLogs();
    mock.restore();
  }
}

// ---------------------------------------------------------------------------
// Normalize unit tests
// ---------------------------------------------------------------------------
{
  const helper = await loadHelper();
  assert("16 ipv4 ok", helper.normalizeClientIp("203.0.113.10") === "203.0.113.10");
  assert("16 ipv4 leading zero reject", helper.normalizeClientIp("203.0.113.010") === "");
  assert("17 ipv6 canonicalize", helper.normalizeClientIp("2001:db8::1") === "2001:0db8:0000:0000:0000:0000:0000:0001");
  assert("18 mapped to ipv4", helper.normalizeClientIp("::ffff:203.0.113.10") === "203.0.113.10");
  assert("19 comma reject", helper.normalizeClientIp("203.0.113.10, 1.2.3.4") === "");
  assert("19 whitespace reject", helper.normalizeClientIp("203.0.113.10 ") === "203.0.113.10");
  assert("19 internal space reject", helper.normalizeClientIp("203.0.113. 10") === "");
  assert("20 port reject", helper.normalizeClientIp("203.0.113.10:443") === "");
  assert("20 bracket port reject", helper.normalizeClientIp("[2001:db8::1]:443") === "");
  assert("malformed empty", helper.normalizeClientIp("") === "");
  assert("malformed junk", helper.normalizeClientIp("not-an-ip") === "");
}

// ---------------------------------------------------------------------------
// Burst / sustained
// ---------------------------------------------------------------------------
{
  const helper = await loadHelper();
  const db = createRateDb();
  const ip = "198.51.100.1";
  let allowed = 0;
  let blocked = 0;
  for (let i = 0; i < helper.OCR_IP_BURST_LIMIT; i += 1) {
    const out = await invokeOnce(request({ ip }), db);
    if (out.status === 200) allowed += 1;
  }
  const over = await invokeOnce(request({ ip }), db);
  if (over.status === 429) blocked += 1;
  assert("01 burst allows limit", allowed === helper.OCR_IP_BURST_LIMIT);
  assert("02 burst+1 is 429", blocked === 1 && over.json?.error === "rate_limited");
  assert("24 429 no gemini", over.calls.gemini.length === 0);
  assert("25 429 no reserve", over.calls.reserve.length === 0);
  assert("28 Retry-After present", Number(over.headers.get("Retry-After")) > 0);
}

{
  // sustained: force burst window to be huge by consuming via DB primitive directly
  const helper = await loadHelper();
  const db = createRateDb();
  const ip = "198.51.100.2";
  // Pre-fill sustained bucket to limit-1 via direct consume with same key material
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Math.floor(nowSec / helper.OCR_IP_SUSTAINED_WINDOW_SEC) * helper.OCR_IP_SUSTAINED_WINDOW_SEC;
  const key = createHmac("sha256", SECRET)
    .update(`ocr-ip-v1|sustained|${start}|${ip}`)
    .digest("hex");
  for (let i = 0; i < helper.OCR_IP_SUSTAINED_LIMIT; i += 1) {
    db.consume(key, "sustained", helper.OCR_IP_SUSTAINED_LIMIT, new Date(start * 1000).toISOString(), new Date((start + 3600) * 1000).toISOString());
  }
  const over = await invokeOnce(request({ ip }), db);
  assert("03 sustained prefill at limit", db.buckets.get(key).hit_count === helper.OCR_IP_SUSTAINED_LIMIT);
  assert("04 sustained+1 is 429", over.status === 429 && over.json?.error === "rate_limited");
}

{
  // window elapsed → new bucket key → allow
  const db = createRateDb();
  const helper = await loadHelper();
  const ip = "198.51.100.3";
  for (let i = 0; i < helper.OCR_IP_BURST_LIMIT; i += 1) await invokeOnce(request({ ip }), db);
  // Simulate next window by clearing buckets (new window_start → new HMAC key)
  db.buckets.clear();
  const again = await invokeOnce(request({ ip }), db);
  assert("05 window reset allows", again.status === 200);
}

// ---------------------------------------------------------------------------
// Parallel atomic
// ---------------------------------------------------------------------------
{
  const helper = await loadHelper();
  const db = createRateDb();
  const ip = "198.51.100.4";
  const { settled, calls } = await invokeParallel(
    Array.from({ length: helper.OCR_IP_BURST_LIMIT + 8 }, () => request({ ip })),
    db
  );
  const ok = settled.filter((r) => r.status === 200).length;
  const limited = settled.filter((r) => r.status === 429).length;
  assert("06 parallel success exactly burst", ok === helper.OCR_IP_BURST_LIMIT, `ok=${ok}`);
  assert("06 parallel 429 rest", limited === 8, `429=${limited}`);
  assert("06 gemini not over burst", calls.gemini.length === helper.OCR_IP_BURST_LIMIT);
}

{
  // DB primitive alone: N parallel consume → exactly limit increments
  const db = createRateDb();
  const key = "parallel-primitive-key";
  const settled = await Promise.all(
    Array.from({ length: 40 }, () =>
      Promise.resolve().then(() => db.consume(key, "burst", 10, "t0", "t1"))
    )
  );
  assert(
    "06b primitive success 10",
    settled.filter((r) => r.ok).length === 10
  );
  assert("06b primitive increments 10", db.stats().increments === 10);
}

// ---------------------------------------------------------------------------
// Isolation / spoof
// ---------------------------------------------------------------------------
{
  const db = createRateDb();
  const a = await invokeOnce(request({ ip: "203.0.113.50" }), db);
  const b = await invokeOnce(request({ ip: "203.0.113.51" }), db);
  assert("07 different IPs isolated", a.status === 200 && b.status === 200);
  assert("07 two burst buckets", [...db.buckets.values()].filter((r) => r.window_kind === "burst").length === 2);
}

{
  const db = createRateDb();
  const sameUserDiffIp = await invokeParallel(
    [
      request({ ip: "203.0.113.60", token: "token-user-a" }),
      request({ ip: "203.0.113.61", token: "token-user-a" }),
    ],
    db
  );
  assert("08 same user different IP ok", sameUserDiffIp.settled.every((r) => r.status === 200));
}

{
  const helper = await loadHelper();
  const db = createRateDb();
  const ip = "203.0.113.70";
  for (let i = 0; i < helper.OCR_IP_BURST_LIMIT; i += 1) {
    await invokeOnce(request({ ip, token: `token-user-${i}` }), db);
  }
  const over = await invokeOnce(request({ ip, token: "token-user-z" }), db);
  assert("09 same IP shared across users", over.status === 429);
}

{
  const db = createRateDb();
  const out = await invokeOnce(
    request({
      ip: "203.0.113.80",
      requestBody: body({ client_ip: "1.2.3.4", ip: "1.2.3.4" }),
      headers: { "X-Forwarded-For": "8.8.8.8", "X-Real-IP": "9.9.9.9" },
    }),
    db
  );
  assert("10-12 spoof headers ignored status", out.status === 200);
  // Only one burst bucket for the CF IP
  const burstKeys = [...db.buckets.entries()].filter(([, r]) => r.window_kind === "burst");
  assert("10-12 single CF IP bucket", burstKeys.length === 1);
  // Ensure spoofed IPs are not used as raw keys
  assert(
    "10-12 no raw spoof keys",
    ![...db.buckets.keys()].some((k) => k.includes("8.8.8.8") || k.includes("1.2.3.4"))
  );
}

// ---------------------------------------------------------------------------
// Missing / malformed CF-Connecting-IP
// ---------------------------------------------------------------------------
{
  const db = createRateDb();
  const bad = await invokeOnce(request({ ip: "not-an-ip" }), db);
  assert("13 malformed CF-IP fail-closed", bad.status === 503 && bad.json?.error === "rate_limit_unavailable");
  assert("13 no auth after bad ip", bad.calls.auth.length === 0);
  assert("13 no gemini", bad.calls.gemini.length === 0);
}

{
  const db = createRateDb();
  const missing = await invokeOnce(request({ origin: PROD, omitCfIp: true }), db);
  assert(
    "14 missing CF-IP production fail-closed",
    missing.status === 503 && missing.json?.error === "rate_limit_unavailable"
  );
  assert("14 no rate rpc", missing.calls.rate.length === 0);
}

{
  const db = createRateDb();
  const local = await invokeOnce(request({ origin: LOCAL, omitCfIp: true }), db);
  assert("15 localhost missing CF-IP allowed", local.status === 200);
  assert("15 local fallback rate rpc called", local.calls.rate.length >= 1);
}

{
  const db = createRateDb();
  // Production origin must not get localhost fallback even if somehow missing
  const prod = await invokeOnce(request({ origin: PROD, omitCfIp: true }), db);
  assert("15 localhost exception not on prod origin", prod.status === 503);
}

// ---------------------------------------------------------------------------
// Backend failures
// ---------------------------------------------------------------------------
{
  const db = createRateDb();
  const out = await invokeOnce(request({}), db, { rateHttpError: true });
  assert("21 backend http 503", out.status === 503 && out.json?.error === "rate_limit_unavailable");
  assert("21 no gemini", out.calls.gemini.length === 0);
}
{
  const db = createRateDb();
  const out = await invokeOnce(request({}), db, { rateNetworkError: true });
  assert("21b network 503", out.status === 503 && out.json?.error === "rate_limit_unavailable");
}
{
  const db = createRateDb();
  const out = await invokeOnce(request({}), db, { rateMalformed: { count: 1 } });
  assert("22 malformed 503", out.status === 503 && out.json?.error === "rate_limit_unavailable");
}
{
  const db = createRateDb();
  const out = await invokeOnce(request({}), db, { envExtra: { OCR_IP_RATE_HMAC_SECRET: "" } });
  assert("23 secret missing 503", out.status === 503 && out.json?.error === "rate_limit_unavailable");
  assert("23 no rate rpc without secret", out.calls.rate.length === 0);
}

// ---------------------------------------------------------------------------
// Origin / OPTIONS
// ---------------------------------------------------------------------------
{
  const db = createRateDb();
  const mock = installFetchMock(db);
  const restoreLogs = installLogCapture();
  try {
    const mod = await loadFn();
    const response = await mod.onRequest({
      request: new Request(`${PROD}/api/gemini-ocr`, {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.10",
          Authorization: "Bearer x",
        },
        body: JSON.stringify(body()),
      }),
      env: env(),
    });
    assert("26 invalid origin 403", response.status === 403);
    assert("26 no rate backend", mock.calls.rate.length === 0);
  } finally {
    restoreLogs();
    mock.restore();
  }
}
{
  const db = createRateDb();
  const mock = installFetchMock(db);
  const restoreLogs = installLogCapture();
  try {
    const mod = await loadFn();
    const response = await mod.onRequest({
      request: new Request(`${PROD}/api/gemini-ocr`, {
        method: "OPTIONS",
        headers: { Origin: PROD, "CF-Connecting-IP": "203.0.113.10" },
      }),
      env: env(),
    });
    assert("27 OPTIONS 204", response.status === 204);
    assert("27 OPTIONS no rate", mock.calls.rate.length === 0);
    assert("27 OPTIONS ACAO", response.headers.get("Access-Control-Allow-Origin") === PROD);
  } finally {
    restoreLogs();
    mock.restore();
  }
}

// ---------------------------------------------------------------------------
// Privacy / static
// ---------------------------------------------------------------------------
{
  const joined = logSink.join("\n");
  assert("29 no raw ip in logs", !joined.includes("203.0.113.") && !joined.includes("198.51.100."));
  assert("29 no secret in logs", !joined.includes(SECRET));
  assert("29 no token in logs", !joined.includes("token-user"));
}

{
  const sql = read("sql/ai-ocr-ip-rate-limit-migration.sql");
  assert("sql: table", sql.includes("ai_ocr_ip_rate_buckets"));
  assert("sql: conditional where", /where b\.hit_count < p_limit/i.test(sql));
  assert("sql: expires_at", sql.includes("expires_at"));
  assert("sql: no raw ip column", !/raw_ip|client_ip|ip_address/i.test(sql));

  const helperSrc = read("deploy/cloudflare/functions/_shared/ocr-ip-rate-limit.mjs");
  assert("helper: CF-Connecting-IP only", helperSrc.includes("CF-Connecting-IP"));
  assert(
    "helper: ignores XFF",
    !/headers\.get\(\s*["']X-Forwarded-For["']\s*\)/.test(helperSrc) &&
      !/headers\.get\(\s*["']X-Real-IP["']\s*\)/.test(helperSrc)
  );
  assert("helper: HMAC", helperSrc.includes("HMAC"));
  assert("helper: no hardcoded secret", !/OCR_IP_RATE_HMAC_SECRET\s*=\s*["'][^"']+["']/.test(helperSrc));

  const fn = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  assert(
    "fn: rate before auth",
    /enforceOcrIpRateLimit[\s\S]*requireAuthenticatedUser/.test(fn)
  );
  assert(
    "fn: rate before guard",
    /enforceOcrIpRateLimit[\s\S]*enforceCfOcrGuard/.test(fn)
  );
}

// ---------------------------------------------------------------------------
// Existing suites
// ---------------------------------------------------------------------------
for (const suite of [
  "test-gemini-ocr-function-auth.mjs",
  "test-gemini-ocr-usage-limits.mjs",
  "test-gemini-ocr-payload-security.mjs",
  "test-gemini-ocr-edge-security.mjs",
  "test-gemini-ocr-atomic-quota.mjs",
]) {
  const run = spawnSync(process.execPath, [path.join(root, "scripts", suite)], { encoding: "utf8" });
  assert(`30 ${suite} PASS`, run.status === 0, `exit=${run.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
