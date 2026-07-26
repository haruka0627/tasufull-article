#!/usr/bin/env node
/**
 * Phase 3-A — API auth guards (secretary · tlv-zego-token · gemini-live-proxy)
 *
 * Real DeepSeek / ZEGO / Supabase Auth are never called with production secrets.
 * Auth and provider fetches are mocked.
 *
 *   node scripts/test-phase3a-api-auth-guards.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

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

function envBase(extra = {}) {
  return {
    TASFUL_SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    TASFUL_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    DEEPSEEK_API_KEY: "sk-test-deepseek",
    ZEGO_APP_ID: "1234567890",
    ZEGO_SERVER_SECRET: "0123456789abcdef0123456789abcdef",
    GEMINI_API_KEY: "should-never-be-read",
    ...extra,
  };
}

function makeFetchRouter(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, init });
    for (const route of routes) {
      if (route.match(u, init)) {
        return route.handler(u, init, calls);
      }
    }
    return new Response(JSON.stringify({ error: "unexpected_fetch", url: u }), { status: 500 });
  };
  return { fetchImpl, calls };
}

async function loadHandler(rel) {
  const abs = path.join(root, rel);
  const mod = await import(pathToFileURL(abs).href + `?t=${Date.now()}`);
  return mod.onRequest;
}

async function invoke(onRequest, { method = "POST", headers = {}, body, env, fetchImpl }) {
  const prev = globalThis.fetch;
  if (fetchImpl) globalThis.fetch = fetchImpl;
  try {
    const init = { method, headers: { ...(headers || {}) } };
    if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
      if (!init.headers["Content-Type"]) init.headers["Content-Type"] = "application/json";
    }
    const request = new Request("https://example.pages.dev/api/test", init);
    const res = await onRequest({ request, env: envBase(env) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  } finally {
    globalThis.fetch = prev;
  }
}

function authUserOk(userId = "user-aaa-111") {
  return {
    match: (u) => u.includes("/auth/v1/user"),
    handler: async () =>
      new Response(JSON.stringify({ id: userId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  };
}

function authUserFail(status = 401) {
  return {
    match: (u) => u.includes("/auth/v1/user"),
    handler: async () =>
      new Response(JSON.stringify({ msg: "invalid" }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  };
}

function deepseekOk() {
  return {
    match: (u) => u.includes("api.deepseek.com"),
    handler: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok-reply" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  };
}

console.log("=== Phase 3-A API auth guards ===\n");

// --- Shared helper unit ---
{
  const mod = await import(
    pathToFileURL(path.join(root, "deploy/cloudflare/functions/_shared/supabase-jwt-auth.mjs")).href +
      `?t=${Date.now()}`
  );
  const noAuth = mod.extractBearerToken(new Request("https://x", { method: "POST" }));
  assert("helper: no Authorization → auth_required", noAuth.error === "auth_required");

  const empty = mod.extractBearerToken(
    new Request("https://x", { headers: { Authorization: "Bearer " } }),
  );
  assert("helper: empty Bearer → auth_required", empty.error === "auth_required");

  const { fetchImpl, calls } = makeFetchRouter([authUserOk("u1")]);
  const ok = await mod.requireSupabaseUser(
    new Request("https://x", { headers: { Authorization: "Bearer good.jwt" } }),
    envBase(),
    { fetchImpl },
  );
  assert("helper: valid JWT", ok.ok === true && ok.userId === "u1" && calls.length === 1);

  const mismatch = await mod.requireSupabaseUser(
    new Request("https://x", { headers: { Authorization: "Bearer good.jwt" } }),
    envBase(),
    { claimedUserId: "other", fetchImpl },
  );
  assert("helper: user_mismatch", mismatch.error === "user_mismatch" && mismatch.http === 403);

  const { fetchImpl: f503 } = makeFetchRouter([authUserFail(503)]);
  const unavail = await mod.requireSupabaseUser(
    new Request("https://x", { headers: { Authorization: "Bearer x" } }),
    envBase(),
    { fetchImpl: f503 },
  );
  assert("helper: auth_unavailable", unavail.error === "auth_unavailable" && unavail.http === 503);

  const { fetchImpl: f401 } = makeFetchRouter([authUserFail(401)]);
  const invalid = await mod.requireSupabaseUser(
    new Request("https://x", { headers: { Authorization: "Bearer bad" } }),
    envBase(),
    { fetchImpl: f401 },
  );
  assert("helper: invalid_token", invalid.error === "invalid_token" && invalid.http === 401);
}

// --- Secretary ---
{
  const onRequest = await loadHandler("deploy/cloudflare/functions/api/secretary-deepseek-chat.js");

  const { fetchImpl, calls } = makeFetchRouter([authUserOk(), deepseekOk()]);
  const noJwt = await invoke(onRequest, {
    body: { message: "hi", surface: "ops_secretary" },
    fetchImpl,
  });
  assert(
    "secretary: JWTなし → 401 auth_required",
    noJwt.status === 401 && noJwt.json?.error === "auth_required",
  );
  assert(
    "secretary: JWTなしは Provider 未呼出",
    !calls.some((c) => c.url.includes("api.deepseek.com")),
  );

  const emptyBearer = await invoke(onRequest, {
    headers: { Authorization: "Bearer " },
    body: { message: "hi", surface: "ops_secretary" },
    fetchImpl,
  });
  assert("secretary: 空 Bearer → 401", emptyBearer.status === 401);

  const { fetchImpl: fBad, calls: callsBad } = makeFetchRouter([authUserFail(401), deepseekOk()]);
  const badJwt = await invoke(onRequest, {
    headers: { Authorization: "Bearer bad.jwt" },
    body: { message: "hi", surface: "ops_secretary" },
    fetchImpl: fBad,
  });
  assert(
    "secretary: invalid JWT → 401",
    badJwt.status === 401 && badJwt.json?.error === "invalid_token",
  );
  assert(
    "secretary: invalid JWT は Provider 未呼出",
    !callsBad.some((c) => c.url.includes("api.deepseek.com")),
  );

  const { fetchImpl: f503, calls: calls503 } = makeFetchRouter([authUserFail(503), deepseekOk()]);
  const authDown = await invoke(onRequest, {
    headers: { Authorization: "Bearer x" },
    body: { message: "hi", surface: "ops_secretary" },
    fetchImpl: f503,
  });
  assert(
    "secretary: Auth障害 → 503",
    authDown.status === 503 && authDown.json?.error === "auth_unavailable",
  );
  assert(
    "secretary: Auth障害は Provider 未呼出",
    !calls503.some((c) => c.url.includes("api.deepseek.com")),
  );

  const { fetchImpl: fOk, calls: callsOk } = makeFetchRouter([
    authUserOk("user-aaa-111"),
    deepseekOk(),
  ]);
  const ok = await invoke(onRequest, {
    headers: { Authorization: "Bearer good.jwt" },
    body: { message: "hello", surface: "ops_secretary" },
    fetchImpl: fOk,
  });
  assert(
    "secretary: 有効 JWT → 認証通過 + reply",
    ok.status === 200 && ok.json?.usedDeepSeek === true && ok.json?.reply === "ok-reply",
  );
  assert(
    "secretary: 有効 JWT 後に Provider 呼出",
    callsOk.some((c) => c.url.includes("api.deepseek.com")),
  );

  const mismatch = await invoke(onRequest, {
    headers: { Authorization: "Bearer good.jwt" },
    body: { message: "hi", surface: "ops_secretary", userId: "other-user" },
    fetchImpl: fOk,
  });
  assert(
    "secretary: user mismatch → 403",
    mismatch.status === 403 && mismatch.json?.error === "user_mismatch",
  );

  const modelReject = await invoke(onRequest, {
    headers: { Authorization: "Bearer good.jwt" },
    body: { message: "hi", surface: "ops_secretary", model: "evil-model" },
    fetchImpl: fOk,
  });
  assert(
    "secretary: client model 拒否",
    modelReject.status === 400 && modelReject.json?.error === "model_not_allowed",
  );

  const opt = await invoke(onRequest, { method: "OPTIONS", fetchImpl: fOk });
  assert("secretary: OPTIONS → 204 · Provider なし", opt.status === 204);

  const huge = "x".repeat(70 * 1024);
  const big = await invoke(onRequest, {
    headers: { Authorization: "Bearer good.jwt", "Content-Length": String(huge.length + 40) },
    body: { message: huge, surface: "ops_secretary" },
    fetchImpl: fOk,
  });
  assert("secretary: 巨大 payload → 413", big.status === 413);

  assert(
    "secretary: secret 非露出",
    !JSON.stringify(ok.json).includes("sk-test-deepseek") &&
      !JSON.stringify(noJwt.json).includes("sk-test-deepseek"),
  );
}

// --- ZEGO token ---
{
  const onRequest = await loadHandler("deploy/cloudflare/functions/api/tlv-zego-token.js");
  const userId = "11111111-1111-4111-8111-111111111111";
  const ownedRoom = `room-${userId.replace(/-/g, "_").slice(0, 20)}-demo`;

  const { fetchImpl, calls } = makeFetchRouter([authUserOk(userId)]);
  const noJwt = await invoke(onRequest, {
    body: { roomId: ownedRoom, userId, role: "host" },
    fetchImpl,
  });
  assert(
    "zego: JWTなし → 401",
    noJwt.status === 401 && noJwt.json?.error === "auth_required",
  );
  assert("zego: JWTなしは署名前遮断（credentials未使用でも認証失敗）", noJwt.status === 401);

  const { fetchImpl: fBad } = makeFetchRouter([authUserFail(401)]);
  const bad = await invoke(onRequest, {
    headers: { Authorization: "Bearer bad" },
    body: { roomId: ownedRoom, userId, role: "host" },
    fetchImpl: fBad,
  });
  assert("zego: invalid JWT → 401", bad.status === 401 && bad.json?.error === "invalid_token");

  const { fetchImpl: f503 } = makeFetchRouter([authUserFail(503)]);
  const down = await invoke(onRequest, {
    headers: { Authorization: "Bearer x" },
    body: { roomId: ownedRoom, userId, role: "host" },
    fetchImpl: f503,
  });
  assert(
    "zego: Auth障害 → 503 · tokenなし",
    down.status === 503 && down.json?.error === "auth_unavailable" && !down.json?.token,
  );

  const { fetchImpl: fOk } = makeFetchRouter([authUserOk(userId)]);
  const spoof = await invoke(onRequest, {
    headers: { Authorization: "Bearer good" },
    body: { roomId: ownedRoom, userId: "other-user-id", role: "host" },
    fetchImpl: fOk,
  });
  assert(
    "zego: user ID 偽装 → 403",
    spoof.status === 403 && spoof.json?.error === "user_mismatch",
  );

  const forbidden = await invoke(onRequest, {
    headers: { Authorization: "Bearer good" },
    body: { roomId: "someone-elses-room-xyz", userId, role: "host" },
    fetchImpl: fOk,
  });
  assert(
    "zego: 未参加/任意 room → 403",
    forbidden.status === 403 && forbidden.json?.error === "room_forbidden",
  );

  const fixture = await invoke(onRequest, {
    headers: { Authorization: "Bearer good" },
    body: { roomId: "tlv-e2e-room-1", userId, role: "host", effectiveSeconds: 99999 },
    fetchImpl: fOk,
  });
  assert(
    "zego: fixture 参加者 → token 発行",
    fixture.status === 200 && typeof fixture.json?.token === "string" && fixture.json.token.length > 10,
  );
  assert(
    "zego: TTL 上限以内",
    fixture.json?.expiresIn <= 3600 && fixture.json?.expiresIn >= 60,
  );
  assert(
    "zego: response userId は JWT 由来",
    fixture.json?.userId === userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
  );
  assert(
    "zego: secret 非露出",
    !JSON.stringify(fixture.json).includes("0123456789abcdef0123456789abcdef"),
  );

  const owned = await invoke(onRequest, {
    headers: { Authorization: "Bearer good" },
    body: { roomId: ownedRoom, userId, role: "host" },
    fetchImpl: fOk,
  });
  assert("zego: owned synthetic room → token", owned.status === 200 && owned.json?.token);

  void calls;
}

// --- gemini-live-proxy exposure ---
{
  const onRequest = await loadHandler("deploy/cloudflare/functions/api/gemini-live-proxy.js");
  const { fetchImpl, calls } = makeFetchRouter([
    {
      match: () => true,
      handler: async () => new Response("should-not-run", { status: 500 }),
    },
  ]);
  const get = await invoke(onRequest, { method: "GET", fetchImpl, env: { GEMINI_API_KEY: "leak-me" } });
  assert("gemini-proxy: GET → 410 gone", get.status === 410 && get.json?.code === "gemini_live_proxy_pages_disabled");
  assert("gemini-proxy: secret 未使用 · 外部fetchなし", calls.length === 0);

  const src = fs.readFileSync(
    path.join(root, "deploy/cloudflare/functions/api/gemini-live-proxy.js"),
    "utf8",
  );
  assert(
    "gemini-proxy: Pages 実装は 410 stub（Upgrade/WS なし）",
    src.includes("410") &&
      src.includes("gemini_live_proxy_pages_disabled") &&
      !/\bWebSocketPair\b/.test(src) &&
      !/generativelanguage\.googleapis\.com/.test(src) &&
      !/env\.GEMINI_API_KEY/.test(src),
  );
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Phase 3-A auth guards Summary ---`);
console.log(`Total: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
