import assert from "node:assert/strict";
import crypto from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

const endpoint = await import(
  "../deploy/cloudflare/functions/api/talk-voice-turn-credentials.js"
);
const turn = await import("../deploy/cloudflare/functions/_shared/talk-voice-turn.mjs");

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "22222222-2222-4222-8222-222222222222";
const ENV = {
  TASFUL_SUPABASE_URL: "https://staging.example.supabase.co",
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
  TALK_VOICE_RATE_LIMIT_HASH_KEY: "test-rate-limit-hash-key-32chars-min!",
  TALK_VOICE_RATE_LIMIT_USER_MAX: "100",
  TALK_VOICE_RATE_LIMIT_SESSION_MAX: "100",
  TALK_VOICE_RATE_LIMIT_IP_MAX: "100",
  TALK_VOICE_RATE_LIMIT_GLOBAL_MAX: "1000",
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch({ authStatus = 200, talkUserId = "u-a", session, room, blocked = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/auth/v1/user")) {
      return response(
        authStatus === 200
          ? { id: "auth-a", app_metadata: { talk_user_id: talkUserId } }
          : { error: "invalid" },
        authStatus,
      );
    }
    if (String(url).includes("/talk_call_sessions?")) {
      return response(
        session === null
          ? []
          : [
              session || {
                id: SESSION_ID,
                room_id: ROOM_ID,
                caller_id: "u-a",
                callee_id: "u-b",
                status: "active",
                started_at: new Date().toISOString(),
                session_limit_seconds: 1800,
              },
            ],
      );
    }
    if (String(url).includes("/transaction_rooms?")) {
      return response(
        room === null
          ? []
          : [
              room || {
                id: ROOM_ID,
                buyer_id: "u-a",
                seller_id: "u-b",
                status: "active",
                expires_at: new Date(Date.now() + 3_600_000).toISOString(),
              },
            ],
      );
    }
    if (String(url).includes("/blocked_users?")) return response(blocked ? [{ id: "block-1" }] : []);
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetchImpl, calls };
}

async function invoke({ token = "valid-token", body = { sessionId: SESSION_ID }, mock, env = ENV } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token != null) headers.Authorization = `Bearer ${token}`;
  const request = new Request("http://127.0.0.1/api/talk-voice-turn-credentials", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetchImpl;
  try {
    const res = await endpoint.onRequest({ request, env });
    return { status: res.status, json: await res.json() };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const mock = mockFetch();
  const result = await invoke({ token: null, mock });
  assert.equal(result.status, 401);
  assert.equal(result.json.error, "auth_required");
  assert.equal(mock.calls.length, 0, "anonymous request must not access auth or database");
}

{
  const mock = mockFetch({ authStatus: 401 });
  const result = await invoke({ mock });
  assert.equal(result.status, 401);
  assert.equal(result.json.error, "invalid_token");
  assert.equal(mock.calls.length, 1, "invalid JWT must stop before database access");
}

{
  const mock = mockFetch({ talkUserId: "u-third-party" });
  const result = await invoke({ mock });
  assert.equal(result.status, 403);
  assert.equal(result.json.error, "session_forbidden");
  assert.equal(mock.calls.length, 2, "non-participant must stop before thread access");
}

{
  const mock = mockFetch({
    session: {
      id: SESSION_ID,
      room_id: ROOM_ID,
      caller_id: "u-a",
      callee_id: "u-b",
      status: "ended",
    },
  });
  const result = await invoke({ mock });
  assert.equal(result.status, 409);
  assert.equal(result.json.error, "session_inactive");
}

{
  const mock = mockFetch({ blocked: true });
  const result = await invoke({ mock });
  assert.equal(result.status, 403);
  assert.equal(result.json.error, "participant_blocked");
}

{
  const mock = mockFetch({
    session: {
      id: SESSION_ID,
      room_id: ROOM_ID,
      caller_id: "u-a",
      callee_id: "u-b",
      status: "active",
      started_at: new Date(Date.now() - 120_000).toISOString(),
      session_limit_seconds: 60,
    },
  });
  const result = await invoke({ mock });
  assert.equal(result.status, 409);
  assert.equal(result.json.error, "session_limit_exceeded");
}

{
  const mock = mockFetch({
    room: {
      id: ROOM_ID,
      buyer_id: "u-a",
      seller_id: "u-b",
      status: "active",
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    },
  });
  const result = await invoke({ mock });
  assert.equal(result.status, 410);
  assert.equal(result.json.error, "thread_expired");
}

{
  endpoint._test.resetRateLimits();
  if (ENV.__talkVoiceRateLimitMock?._testReset) ENV.__talkVoiceRateLimitMock._testReset();
  const mock = mockFetch();
  const result = await invoke({ mock });
  assert.equal(result.status, 200);
  assert.equal(result.json.sessionId, SESSION_ID);
  assert.equal(result.json.iceServers.length, 4);
  assert.match(result.json.iceServers[1].username, /^\d+:[0-9a-f-]+:u-a$/);
  assert.ok(result.json.iceServers[1].credential);
  assert.ok(!JSON.stringify(result.json).includes(ENV.TALK_VOICE_TURN_SHARED_SECRET));
  const ttl = (Date.parse(result.json.expiresAt) - Date.now()) / 1000;
  assert.ok(ttl > 1190 && ttl <= 1200);
  assert.deepEqual(
    result.json.iceServers.map((item) => item.urls),
    [
      "stun:turn.staging.tasful.example:3478",
      "turn:turn.staging.tasful.example:3478?transport=udp",
      "turn:turn.staging.tasful.example:3478?transport=tcp",
      "turns:turn.staging.tasful.example:443?transport=tcp",
    ],
  );
}

{
  endpoint._test.resetRateLimits();
  if (ENV.__talkVoiceRateLimitMock?._testReset) ENV.__talkVoiceRateLimitMock._testReset();
  let last;
  for (let i = 0; i < 7; i += 1) {
    last = await invoke({ mock: mockFetch() });
  }
  assert.equal(last.status, 429);
  assert.equal(last.json.error, "rate_limited");
  assert.ok(Number(last.json.retry_after_seconds) >= 1);
  assert.ok(!("reason" in last.json));
  assert.ok(!JSON.stringify(last.json).includes("user_limited"));
}

{
  const a = await turn.createTurnRestCredential({
    sharedSecret: ENV.TALK_VOICE_TURN_SHARED_SECRET,
    sessionId: SESSION_ID,
    talkUserId: "u-a",
    nowMs: 1_700_000_000_000,
    ttlSec: 1200,
  });
  const b = await turn.createTurnRestCredential({
    sharedSecret: ENV.TALK_VOICE_TURN_SHARED_SECRET,
    sessionId: SESSION_ID,
    talkUserId: "u-a",
    nowMs: 1_700_000_000_000,
    ttlSec: 1200,
  });
  assert.equal(a.credential, b.credential, "HMAC must be deterministic");
  assert.equal(a.ttlSec, 1200);
}

assert.equal(
  turn.getTurnConfig({ ...ENV, CF_PAGES_ENV: "production" }).featureEnabled,
  false,
  "Production must force TURN issuance off",
);

console.log("TALK Voice TURN credential tests: PASS (JWT, participant, TTL, HMAC, rate limit, secret)");
