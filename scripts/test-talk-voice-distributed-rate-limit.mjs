#!/usr/bin/env node
/**
 * TALK Voice Phase 2 — Distributed rate limit unit tests (no deploy · no DO remote).
 *
 *   node scripts/test-talk-voice-distributed-rate-limit.mjs
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rl = await import("../deploy/cloudflare/functions/_shared/talk-voice-rate-limit.mjs");
const endpoint = await import("../deploy/cloudflare/functions/api/talk-voice-turn-credentials.js");

let passed = 0;
function check(name, fn) {
  const run = async () => {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (err) {
      console.error(`FAIL ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  };
  return run();
}

const HASH = "test-rate-limit-hash-key-32chars-min!";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "22222222-2222-4222-8222-222222222222";

function baseEnv(overrides = {}) {
  return {
    TASFUL_SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    TASFUL_SUPABASE_ANON_KEY: "anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    TALK_VOICE_SELF_HOSTED_TURN_ENABLED: "true",
    TALK_VOICE_TURN_HOST: "turn.staging.tasful.example",
    TALK_VOICE_TURN_SHARED_SECRET: "test-shared-secret-at-least-thirty-two-characters",
    TALK_VOICE_TURN_CREDENTIAL_TTL_SEC: "1200",
    TALK_VOICE_RATE_LIMIT_ENABLED: "true",
    TALK_VOICE_RATE_LIMIT_FAIL_CLOSED: "true",
    TALK_VOICE_RATE_LIMIT_NAMESPACE: "staging",
    TALK_VOICE_RATE_LIMIT_USE_MOCK: "true",
    TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
    TALK_VOICE_RATE_LIMIT_USER_MAX: "3",
    TALK_VOICE_RATE_LIMIT_USER_BURST: "3",
    TALK_VOICE_RATE_LIMIT_IP_MAX: "5",
    TALK_VOICE_RATE_LIMIT_IP_BURST: "5",
    TALK_VOICE_RATE_LIMIT_SESSION_MAX: "4",
    TALK_VOICE_RATE_LIMIT_SESSION_BURST: "4",
    TALK_VOICE_RATE_LIMIT_GLOBAL_MAX: "20",
    TALK_VOICE_RATE_LIMIT_GLOBAL_BURST: "20",
    TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_MAX: "3",
    TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_BURST: "3",
    TALK_VOICE_RATE_LIMIT_WINDOW_SECONDS: "60",
    TALK_VOICE_RATE_LIMIT_AUTH_WINDOW_SECONDS: "300",
    ...overrides,
  };
}

function mockFetchOk() {
  return async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return Response.json({ id: "auth-a", app_metadata: { talk_user_id: "u-a" } });
    }
    if (String(url).includes("/talk_call_sessions?")) {
      return Response.json([
        {
          id: SESSION_ID,
          room_id: ROOM_ID,
          caller_id: "u-a",
          callee_id: "u-b",
          status: "active",
          started_at: new Date().toISOString(),
          session_limit_seconds: 1800,
        },
      ]);
    }
    if (String(url).includes("/transaction_rooms?")) {
      return Response.json([
        {
          id: ROOM_ID,
          buyer_id: "u-a",
          seller_id: "u-b",
          status: "active",
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
      ]);
    }
    if (String(url).includes("/blocked_users?")) return Response.json([]);
    throw new Error(`unexpected fetch ${url}`);
  };
}

async function invoke(env, { token = "valid", body = { sessionId: SESSION_ID }, ip = "203.0.113.10" } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token != null) headers.Authorization = `Bearer ${token}`;
  if (ip) headers["CF-Connecting-IP"] = ip;
  const request = new Request("http://127.0.0.1/api/talk-voice-turn-credentials", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const original = globalThis.fetch;
  globalThis.fetch = mockFetchOk();
  try {
    const res = await endpoint.onRequest({ request, env });
    const json = await res.json();
    return { status: res.status, json, headers: res.headers };
  } finally {
    globalThis.fetch = original;
  }
}

await check("config defaults parse", () => {
  const r = rl.getRateLimitConfig(baseEnv());
  assert.equal(r.ok, true);
  assert.equal(r.config.userMax, 3);
  assert.equal(r.config.failClosed, true);
  assert.equal(r.config.namespace, "staging");
});

await check("Production disabled rejected", () => {
  const r = rl.getRateLimitConfig(
    baseEnv({
      CF_PAGES_ENV: "production",
      TALK_VOICE_RATE_LIMIT_NAMESPACE: "production",
      TALK_VOICE_RATE_LIMIT_ENABLED: "false",
      TALK_VOICE_RATE_LIMIT_USE_MOCK: "false",
      TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
    }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.error, "config_invalid");
});

await check("Production fail-open rejected", () => {
  const r = rl.getRateLimitConfig(
    baseEnv({
      CF_PAGES_ENV: "production",
      TALK_VOICE_RATE_LIMIT_NAMESPACE: "production",
      TALK_VOICE_RATE_LIMIT_FAIL_CLOSED: "false",
      TALK_VOICE_RATE_LIMIT_USE_MOCK: "false",
      TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
    }),
  );
  assert.equal(r.ok, false);
});

await check("Production mock rejected", () => {
  const r = rl.getRateLimitConfig(
    baseEnv({
      CF_PAGES_ENV: "production",
      TALK_VOICE_RATE_LIMIT_NAMESPACE: "production",
      TALK_VOICE_RATE_LIMIT_USE_MOCK: "true",
      TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
    }),
  );
  assert.equal(r.ok, false);
});

await check("unknown environment is production-like", () => {
  assert.equal(rl.isProductionLike("unknown"), true);
  const r = rl.getRateLimitConfig(
    baseEnv({
      CF_PAGES_ENV: "weird",
      TALK_VOICE_RATE_LIMIT_NAMESPACE: "",
      TALK_VOICE_RATE_LIMIT_ENABLED: "false",
      TALK_VOICE_RATE_LIMIT_USE_MOCK: "false",
      TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
    }),
  );
  // unknown pages env + empty namespace → environment unknown → production-like → disabled rejected
  assert.equal(r.ok, false);
});

await check("CF_PAGES_BRANCH alone is not production for rate limit", () => {
  const r = rl.getRateLimitConfig(
    baseEnv({
      CF_PAGES_BRANCH: "cf-pages-deploy",
      CF_PAGES_ENV: "",
      TALK_VOICE_RATE_LIMIT_NAMESPACE: "",
      TALK_VOICE_RATE_LIMIT_ENABLED: "",
      TALK_VOICE_RATE_LIMIT_USE_MOCK: "false",
      TALK_VOICE_RATE_LIMIT_HASH_KEY: "",
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.config.environment, "development");
  assert.equal(r.config.enabled, false);
});

await check("invalid numeric config rejected", () => {
  const r = rl.getRateLimitConfig(baseEnv({ TALK_VOICE_RATE_LIMIT_USER_MAX: "-1" }));
  assert.equal(r.ok, false);
});

await check("NaN numeric config rejected", () => {
  const r = rl.getRateLimitConfig(baseEnv({ TALK_VOICE_RATE_LIMIT_IP_MAX: "abc" }));
  assert.equal(r.ok, false);
});

await check("missing hash key rejected when enabled", () => {
  const r = rl.getRateLimitConfig(
    baseEnv({ TALK_VOICE_RATE_LIMIT_HASH_KEY: "", TALK_VOICE_RATE_LIMIT_USE_MOCK: "false" }),
  );
  assert.equal(r.ok, false);
});

await check("hashIdentifier is deterministic and opaque", async () => {
  const a = await rl.hashIdentifier(HASH, "staging", "ep", "user", "auth-a");
  const b = await rl.hashIdentifier(HASH, "staging", "ep", "user", "auth-a");
  const c = await rl.hashIdentifier(HASH, "staging", "ep", "user", "auth-b");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64);
  assert.doesNotMatch(a, /auth-a/);
});

await check("staging namespace separation differs from production hash", async () => {
  const s = await rl.hashIdentifier(HASH, "staging", "ep", "user", "u1");
  const p = await rl.hashIdentifier(HASH, "production", "ep", "user", "u1");
  assert.notEqual(s, p);
});

await check("consumeBucket allow then deny", () => {
  let state = null;
  const opts = { max: 2, burst: 2, windowMs: 60_000, burstWindowMs: 10_000, now: 1_000 };
  let r = rl.consumeBucket(state, opts);
  assert.equal(r.allowed, true);
  state = r.state;
  r = rl.consumeBucket(state, { ...opts, now: 1_100 });
  assert.equal(r.allowed, true);
  state = r.state;
  r = rl.consumeBucket(state, { ...opts, now: 1_200 });
  assert.equal(r.allowed, false);
  assert.ok(r.retryAfterSec >= 1);
});

await check("consumeBucket window expiry resets", () => {
  let state = null;
  const opts = { max: 1, burst: 1, windowMs: 1_000, burstWindowMs: 1_000, now: 0 };
  let r = rl.consumeBucket(state, opts);
  state = r.state;
  r = rl.consumeBucket(state, { ...opts, now: 500 });
  assert.equal(r.allowed, false);
  r = rl.consumeBucket(state, { ...opts, now: 1_100 });
  assert.equal(r.allowed, true);
});

await check("burst limit denies within window", () => {
  let state = null;
  const opts = { max: 10, burst: 2, windowMs: 60_000, burstWindowMs: 10_000, now: 0 };
  state = rl.consumeBucket(state, opts).state;
  state = rl.consumeBucket(state, { ...opts, now: 10 }).state;
  const r = rl.consumeBucket(state, { ...opts, now: 20 });
  assert.equal(r.allowed, false);
});

await check("public body never leaks axis or hash", () => {
  const body = rl.publicRateLimitBody("rate_limited", 42);
  assert.deepEqual(body, { ok: false, error: "rate_limited", retry_after_seconds: 42 });
  assert.ok(!("reason" in body));
});

await check("first credential allow", async () => {
  const env = baseEnv();
  endpoint._test.resetRateLimits();
  rl._testDrainTelemetry();
  const res = await invoke(env);
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.ok(res.json.iceServers);
});

await check("user limit exceeded returns 429 without axis", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_USER_MAX: "2",
    TALK_VOICE_RATE_LIMIT_USER_BURST: "2",
    TALK_VOICE_RATE_LIMIT_SESSION_MAX: "100",
    TALK_VOICE_RATE_LIMIT_IP_MAX: "100",
  });
  endpoint._test.resetRateLimits();
  delete env.__talkVoiceRateLimitMock;
  let last;
  for (let i = 0; i < 3; i += 1) last = await invoke(env);
  assert.equal(last.status, 429);
  assert.equal(last.json.error, "rate_limited");
  assert.ok(last.headers.get("Retry-After"));
  assert.ok(!JSON.stringify(last.json).includes("user"));
  assert.ok(!JSON.stringify(last.json).includes(HASH));
});

await check("different users are independent", async () => {
  // Enforce via DO helper directly (endpoint always uses auth-a).
  const env = baseEnv({ TALK_VOICE_RATE_LIMIT_USER_MAX: "1", TALK_VOICE_RATE_LIMIT_USER_BURST: "1" });
  const cfg = rl.getRateLimitConfig(env).config;
  const a1 = await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "user-a",
    ip: "203.0.113.1",
    sessionId: SESSION_ID,
  });
  assert.equal(a1.ok, true);
  const a2 = await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "user-a",
    ip: "203.0.113.1",
    sessionId: SESSION_ID,
  });
  assert.equal(a2.ok, false);
  const b1 = await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "user-b",
    ip: "203.0.113.2",
    sessionId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(b1.ok, true);
});

await check("different IPs are independent", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_IP_MAX: "1",
    TALK_VOICE_RATE_LIMIT_IP_BURST: "1",
    TALK_VOICE_RATE_LIMIT_USER_MAX: "100",
    TALK_VOICE_RATE_LIMIT_SESSION_MAX: "100",
  });
  const cfg = rl.getRateLimitConfig(env).config;
  assert.equal(
    (
      await rl.enforceCredentialRateLimits({
        env,
        config: cfg,
        userId: "u1",
        ip: "198.51.100.1",
        sessionId: SESSION_ID,
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await rl.enforceCredentialRateLimits({
        env,
        config: cfg,
        userId: "u1",
        ip: "198.51.100.1",
        sessionId: SESSION_ID,
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await rl.enforceCredentialRateLimits({
        env,
        config: cfg,
        userId: "u1",
        ip: "198.51.100.2",
        sessionId: SESSION_ID,
      })
    ).ok,
    true,
  );
});

await check("session limit exceeded", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_SESSION_MAX: "1",
    TALK_VOICE_RATE_LIMIT_SESSION_BURST: "1",
    TALK_VOICE_RATE_LIMIT_USER_MAX: "100",
    TALK_VOICE_RATE_LIMIT_IP_MAX: "100",
  });
  const cfg = rl.getRateLimitConfig(env).config;
  assert.equal(
    (await rl.enforceCredentialRateLimits({ env, config: cfg, userId: "u", ip: "1.1.1.1", sessionId: SESSION_ID }))
      .ok,
    true,
  );
  const denied = await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "u",
    ip: "1.1.1.1",
    sessionId: SESSION_ID,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "session_limited");
});

await check("global limit exceeded", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_GLOBAL_MAX: "1",
    TALK_VOICE_RATE_LIMIT_GLOBAL_BURST: "1",
    TALK_VOICE_RATE_LIMIT_USER_MAX: "100",
    TALK_VOICE_RATE_LIMIT_IP_MAX: "100",
    TALK_VOICE_RATE_LIMIT_SESSION_MAX: "100",
  });
  const cfg = rl.getRateLimitConfig(env).config;
  assert.equal(
    (await rl.enforceCredentialRateLimits({ env, config: cfg, userId: "u1", ip: "1.1.1.1", sessionId: SESSION_ID }))
      .ok,
    true,
  );
  const denied = await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "u2",
    ip: "1.1.1.2",
    sessionId: "44444444-4444-4444-8444-444444444444",
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "global_limited");
});

await check("auth failure limit exceeded returns rate_limited", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_MAX: "2",
    TALK_VOICE_RATE_LIMIT_AUTH_FAILURE_BURST: "2",
  });
  endpoint._test.resetRateLimits();
  delete env.__talkVoiceRateLimitMock;
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "invalid" }, { status: 401 });
  let last;
  try {
    for (let i = 0; i < 4; i += 1) {
      const request = new Request("http://127.0.0.1/api/talk-voice-turn-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer bad",
          "CF-Connecting-IP": "203.0.113.50",
        },
        body: "{}",
      });
      const res = await endpoint.onRequest({ request, env });
      last = { status: res.status, json: await res.json() };
    }
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(last.status, 429);
  assert.equal(last.json.error, "rate_limited");
  assert.ok(!JSON.stringify(last.json).includes("auth"));
});

await check("DO binding missing fail-closed 503", async () => {
  const env = baseEnv({
    TALK_VOICE_RATE_LIMIT_USE_MOCK: "false",
    TALK_VOICE_RATE_LIMIT_HASH_KEY: HASH,
  });
  // no TALK_VOICE_RATE_LIMITER binding
  endpoint._test.resetRateLimits();
  const res = await invoke(env);
  assert.equal(res.status, 503);
  assert.equal(res.json.error, "service_unavailable");
  assert.ok(res.headers.get("Retry-After"));
  assert.ok(!("reason" in res.json));
});

await check("mock storage keys are opaque hashes", async () => {
  const env = baseEnv();
  const cfg = rl.getRateLimitConfig(env).config;
  await rl.enforceCredentialRateLimits({
    env,
    config: cfg,
    userId: "opaque-user-id",
    ip: "203.0.113.9",
    sessionId: SESSION_ID,
  });
  const dump = env.__talkVoiceRateLimitMock._testDumpKeys();
  assert.equal(dump.keysAreOpaque, true);
  assert.ok(dump.size >= 1);
});

await check("telemetry has no secrets or raw ids", () => {
  rl._testDrainTelemetry();
  rl.emitRateLimitTelemetry({
    decision: "deny",
    reason: "user_limited",
    environment: "staging",
    status: 429,
    retryAfterSec: 12,
  });
  const events = rl._testDrainTelemetry();
  assert.equal(events.length, 1);
  const raw = JSON.stringify(events[0]);
  assert.doesNotMatch(raw, /Bearer /);
  assert.doesNotMatch(raw, /shared-secret/);
  assert.ok(!("userId" in events[0]));
  assert.ok(!("ip" in events[0]));
});

await check("worker DO file exports class", () => {
  const text = fs.readFileSync(
    path.join(root, "deploy/cloudflare/workers/talk-voice-rate-limiter.js"),
    "utf8",
  );
  assert.match(text, /export class TalkVoiceTurnRateLimiter/);
  assert.doesNotMatch(text, /TALK_VOICE_TURN_SHARED_SECRET/);
  assert.doesNotMatch(text, /Bearer /);
  assert.match(text, /Does NOT store:.*Authorization headers/s);
});

await check("wrangler binding names documented", () => {
  const workerToml = fs.readFileSync(
    path.join(root, "deploy/cloudflare/workers/talk-voice-rate-limiter.wrangler.toml"),
    "utf8",
  );
  assert.match(workerToml, /TalkVoiceTurnRateLimiter/);
  assert.match(workerToml, /TALK_VOICE_RATE_LIMITER/);
  const pagesExample = fs.readFileSync(
    path.join(root, "deploy/cloudflare/wrangler.pages.talk-voice-rate-limit.example.toml"),
    "utf8",
  );
  assert.match(pagesExample, /EXAMPLE ONLY/);
  assert.match(pagesExample, /Production bindings unchanged/);
});

if (process.exitCode && process.exitCode !== 0) {
  console.error(`\nFAILED (passed partial=${passed})`);
  process.exit(process.exitCode);
}
console.log(`\nDistributed rate-limit checks passed (${passed})`);
