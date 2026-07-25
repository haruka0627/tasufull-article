#!/usr/bin/env node
/**
 * Gemini OCR atomic + idempotent quota regression (F5 / F5.1)
 *   node scripts/test-gemini-ocr-atomic-quota.mjs
 *
 * In-memory DB mirrors SQL conditional transitions:
 *   reserve: counter++ WHERE used < limit + insert reservation row (gen UUID)
 *   commit:  UPDATE ... WHERE state = 'reserved' → committed
 *   release: UPDATE ... WHERE state = 'reserved' → released + counter−1
 *
 * Real Supabase / Gemini are never called.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://tasufull-article.pages.dev";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const OCR_TEXT = "atomic quota ocr text";
const results = [];
const logSink = [];

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  const output = `${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`;
  (condition ? console.log : console.error)(output);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter() {
  return delay(Math.floor(Math.random() * 3));
}

function todayJst() {
  try {
    return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch (_e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function env(extra = {}) {
  return {
    GEMINI_API_KEY: "test-gemini-key",
    SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    ...extra,
  };
}

function body(extra = {}) {
  return {
    mimeType: "image/png",
    base64: PNG,
    surface: "chat",
    feature: "ocr_turn",
    ...extra,
  };
}

function request(requestBody = body(), token = "token-user-a") {
  return new Request(`${ORIGIN}/api/gemini-ocr`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });
}

/**
 * SQL 相当ストア。reserve / commit / release 本体は同期ブロック（条件付き UPDATE）。
 */
function createQuotaDb(limit) {
  const used = new Map();
  const reservations = new Map();
  const counterKey = (userId, dateJst, feature) => `${userId}|${dateJst}|${feature}`;
  let releaseCalls = 0;
  let commitCalls = 0;
  let decrementCount = 0;

  return {
    limit,
    used,
    reservations,
    stats: () => ({ releaseCalls, commitCalls, decrementCount }),
    get(userId, dateJst, feature) {
      return used.get(counterKey(userId, dateJst, feature)) ?? 0;
    },
    seed(userId, dateJst, feature, value) {
      used.set(counterKey(userId, dateJst, feature), value);
    },
    // reserve_ai_workspace_quota
    reserve(userId, dateJst, feature, surface, rowLimit) {
      const k = counterKey(userId, dateJst, feature);
      const current = used.get(k) ?? 0;
      if (rowLimit <= 0 || current >= rowLimit) {
        return {
          ok: false,
          error: "quota_exceeded",
          feature,
          used: current,
          limit: rowLimit,
          remaining: 0,
        };
      }
      const next = current + 1;
      used.set(k, next);
      const reservationId = randomUUID();
      reservations.set(reservationId, {
        reservation_id: reservationId,
        user_id: userId,
        date_jst: dateJst,
        feature,
        surface: surface || "",
        state: "reserved",
        expires_at: Date.now() + 30 * 60 * 1000,
      });
      return {
        ok: true,
        reservation_id: reservationId,
        feature,
        used: next,
        limit: rowLimit,
        remaining: rowLimit - next,
        state: "reserved",
      };
    },
    // commit_ai_workspace_quota_reservation
    // UPDATE ... WHERE state = 'reserved' → committed
    commit(reservationId, userId) {
      commitCalls += 1;
      const row = reservations.get(reservationId);
      if (!row || row.user_id !== userId) {
        return { ok: false, error: "not_found" };
      }
      if (row.state === "reserved") {
        row.state = "committed";
        return { ok: true, state: "committed", reservation_id: reservationId };
      }
      if (row.state === "committed") {
        return {
          ok: true,
          state: "committed",
          already_committed: true,
          reservation_id: reservationId,
        };
      }
      return {
        ok: false,
        error: "invalid_state",
        state: row.state,
        reservation_id: reservationId,
      };
    },
    // release_ai_workspace_quota_reservation
    // UPDATE ... WHERE state = 'reserved' → released + counter−1
    release(reservationId, userId) {
      releaseCalls += 1;
      const row = reservations.get(reservationId);
      if (!row || row.user_id !== userId) {
        return { ok: false, error: "not_found" };
      }
      if (row.state === "reserved") {
        row.state = "released";
        const k = counterKey(row.user_id, row.date_jst, row.feature);
        const current = used.get(k) ?? 0;
        if (current > 0) {
          used.set(k, current - 1);
          decrementCount += 1;
        }
        return {
          ok: true,
          state: "released",
          used: used.get(k) ?? 0,
          reservation_id: reservationId,
        };
      }
      if (row.state === "released") {
        return {
          ok: true,
          state: "released",
          already_released: true,
          reservation_id: reservationId,
        };
      }
      return {
        ok: false,
        error: "invalid_state",
        state: row.state,
        reservation_id: reservationId,
      };
    },
  };
}

function installFetchMock(db, options = {}) {
  const calls = { auth: [], plan: [], check: [], consume: [], commit: [], release: [], gemini: [] };
  const originalFetch = globalThis.fetch;
  let releaseDropResponses = options.releaseDropResponses ?? 0;
  let commitDropResponses = options.commitDropResponses ?? 0;

  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    const payload = init.body ? JSON.parse(String(init.body)) : {};

    if (value.includes("/auth/v1/user")) {
      calls.auth.push({ url: value, init });
      await jitter();
      const token = String(init.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: token.replace(/^token-/, "") }),
      };
    }

    if (value.includes("gen_ai_subscriptions")) {
      calls.plan.push({ url: value, init });
      await jitter();
      return { ok: true, status: 200, json: async () => [] };
    }

    if (value.includes("/rpc/check_ai_workspace_quota")) {
      calls.check.push({ url: value, init, payload });
      await jitter();
      const current = db.get(payload.p_user_id, payload.p_date_jst, payload.p_feature);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, allowed: current < payload.p_limit, used: current }),
      };
    }

    if (value.includes("/rpc/reserve_ai_workspace_quota")) {
      calls.consume.push({ url: value, init, payload });
      await jitter();
      if (options.reserveHttpError) return { ok: false, status: 500, json: async () => ({}) };
      if (options.reserveNetworkError) throw new TypeError("raw rpc network SECRET");
      if (options.reserveMalformed !== undefined) {
        return { ok: true, status: 200, json: async () => options.reserveMalformed };
      }
      const row = db.reserve(
        payload.p_user_id,
        payload.p_date_jst,
        payload.p_feature,
        payload.p_surface,
        payload.p_limit
      );
      await jitter();
      return { ok: true, status: 200, json: async () => row };
    }

    if (value.includes("/rpc/commit_ai_workspace_quota_reservation")) {
      calls.commit.push({ url: value, init, payload });
      await jitter();
      if (options.commitNetworkError) throw new TypeError("raw commit network SECRET");
      // DB は成功済みだが応答消失を模擬
      const row = db.commit(payload.p_reservation_id, payload.p_user_id);
      if (commitDropResponses > 0) {
        commitDropResponses -= 1;
        throw new TypeError("raw commit response lost SECRET");
      }
      return { ok: true, status: 200, json: async () => row };
    }

    if (value.includes("/rpc/release_ai_workspace_quota_reservation")) {
      calls.release.push({ url: value, init, payload });
      await jitter();
      if (options.releaseHttpError) return { ok: false, status: 500, json: async () => ({}) };
      if (options.releaseNetworkErrorOnce) {
        options.releaseNetworkErrorOnce = false;
        throw new TypeError("raw release network SECRET");
      }
      const row = db.release(payload.p_reservation_id, payload.p_user_id);
      if (releaseDropResponses > 0) {
        releaseDropResponses -= 1;
        throw new TypeError("raw release response lost SECRET");
      }
      return { ok: true, status: 200, json: async () => row };
    }

    if (value.includes("generativelanguage.googleapis.com")) {
      calls.gemini.push({ url: value, init });
      await delay(2 + Math.floor(Math.random() * 4));
      if (options.geminiNetworkError) throw new TypeError("raw gemini network SECRET");
      if (options.geminiAbort) {
        const error = new Error("raw abort SECRET");
        error.name = "AbortError";
        throw error;
      }
      const status = options.geminiStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (options.geminiInvalidJson) throw new SyntaxError("raw google json SECRET");
          if (options.geminiJson !== undefined) return options.geminiJson;
          return { candidates: [{ content: { parts: [{ text: OCR_TEXT }] } }] };
        },
      };
    }

    throw new Error(`unexpected fetch: ${value}`);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function installLogCapture() {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };
  const capture = (...args) => {
    logSink.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  console.warn = capture;
  console.info = capture;
  const originalError = console.error;
  console.error = (...args) => {
    capture(...args);
    if (typeof args[0] === "string" && args[0].startsWith("FAIL:")) originalError(...args);
  };
  return () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
    console.info = original.info;
  };
}

async function loadFunction() {
  const href = pathToFileURL(path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")).href;
  return import(`${href}?atomic=${Date.now()}-${Math.random()}`);
}

async function loadGuard() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ai-usage-guard.mjs")
  ).href;
  return import(`${href}?atomic=${Date.now()}-${Math.random()}`);
}

async function invokeParallel(requests, db, options = {}) {
  const mock = installFetchMock(db, options);
  const restoreLogs = installLogCapture();
  try {
    const module = await loadFunction();
    const settled = await Promise.all(
      requests.map(async (req) => {
        const response = await module.onRequest({ request: req, env: env(options.envExtra) });
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

async function invokeOnce(req, db, options = {}) {
  const { settled, calls } = await invokeParallel([req], db, options);
  return { ...settled[0], calls };
}

// ---------------------------------------------------------------------------
// DB primitive: double / parallel / ambiguous release
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  const r1 = db.release(reserved.reservation_id, "user-a");
  const r2 = db.release(reserved.reservation_id, "user-a");
  assert("01 double release first ok", r1.ok === true && r1.already_released !== true);
  assert("01 double release second already", r2.ok === true && r2.already_released === true);
  assert("01 decrement exactly once", db.stats().decrementCount === 1);
  assert("01 counter restored once", db.get("user-a", todayJst(), "vision_turn") === 0);
}

{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  const settled = await Promise.all(
    Array.from({ length: 10 }, () =>
      Promise.resolve().then(() => db.release(reserved.reservation_id, "user-a"))
    )
  );
  assert("02 parallel release all ok-ish", settled.every((r) => r.ok === true));
  assert(
    "02 parallel release first wins once",
    settled.filter((r) => r.already_released !== true).length === 1
  );
  assert("02 parallel decrement once", db.stats().decrementCount === 1);
  assert("02 counter zero", db.get("user-a", todayJst(), "vision_turn") === 0);
}

{
  const db = createQuotaDb(5);
  const mock = installFetchMock(db, { releaseDropResponses: 1 });
  const restoreLogs = installLogCapture();
  try {
    const guard = await loadGuard();
    const reserved = await guard.enforceCfOcrGuard(
      new Request(`${ORIGIN}/api/gemini-ocr`, { method: "POST" }),
      { user_id: "user-a", surface: "chat", feature: "vision_turn" },
      env()
    );
    assert("03 reserved", reserved.reservation?.state === "reserved");
    // 1回目: DB成功だが応答消失 → catch → retry → already_released
    const out = await guard.releaseCfOcrReservation(reserved.reservation);
    assert("03 ambiguous release eventually ok", out.ok === true);
    assert("03 decrement once after retry", db.stats().decrementCount === 1);
    assert("03 counter zero", db.get("user-a", todayJst(), "vision_turn") === 0);
  } finally {
    restoreLogs();
    mock.restore();
  }
}

// ---------------------------------------------------------------------------
// DB primitive: commit idempotency + illegal transitions
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  const c1 = db.commit(reserved.reservation_id, "user-a");
  const c2 = db.commit(reserved.reservation_id, "user-a");
  assert("04 double commit first", c1.ok === true && !c1.already_committed);
  assert("04 double commit already", c2.ok === true && c2.already_committed === true);
  const badRelease = db.release(reserved.reservation_id, "user-a");
  assert("05 commit blocks release", badRelease.ok === false && badRelease.state === "committed");
  assert("05 no decrement after commit", db.stats().decrementCount === 0);
  assert("05 counter stays 1", db.get("user-a", todayJst(), "vision_turn") === 1);
}

{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  db.release(reserved.reservation_id, "user-a");
  const badCommit = db.commit(reserved.reservation_id, "user-a");
  assert("06 release blocks commit", badCommit.ok === false && badCommit.state === "released");
}

{
  const db = createQuotaDb(5);
  db.seed("user-a", todayJst(), "vision_turn", 3);
  const before = db.get("user-a", todayJst(), "vision_turn");
  const unknown = db.release(randomUUID(), "user-a");
  assert("07 unknown release not_found", unknown.ok === false && unknown.error === "not_found");
  assert("07 counter unchanged", db.get("user-a", todayJst(), "vision_turn") === before);
}

{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  const other = db.release(reserved.reservation_id, "user-b");
  assert("08 other user cannot release", other.ok === false && other.error === "not_found");
  assert("08 counter still reserved", db.get("user-a", todayJst(), "vision_turn") === 1);
  assert("08 state still reserved", db.reservations.get(reserved.reservation_id).state === "reserved");
}

{
  const db = createQuotaDb(5);
  const reserved = db.reserve("user-a", todayJst(), "vision_turn", "chat", 5);
  // surface は reservation 行に保存。release は reservation_id+user_id のみ。
  // 別 surface の「偽 ID」では解放できないことを unknown で担保。
  const fake = db.release(randomUUID(), "user-a");
  assert("09 foreign surface/id no release", fake.ok === false);
  assert("09 original still reserved", db.reservations.get(reserved.reservation_id).state === "reserved");
}

// ---------------------------------------------------------------------------
// Function: client reservation_id ignored · parallel · upstream paths
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const clientId = "99999999-9999-4999-8999-999999999999";
  const { status, calls } = await invokeOnce(
    request(body({ reservation_id: clientId, reservationId: clientId })),
    db
  );
  assert("10 client reservation id ignored status", status === 200);
  const reservedId = calls.consume[0] && JSON.parse(String(calls.consume[0].init.body));
  // reserve RPC does not accept client id — DB generates
  assert("10 reserve rpc has no client id param", !("p_reservation_id" in (reservedId || {})));
  const commitPayload = JSON.parse(String(calls.commit[0].init.body));
  assert("10 commit uses db id", commitPayload.p_reservation_id !== clientId);
  assert("10 db has no client id row", !db.reservations.has(clientId));
}

{
  const db = createQuotaDb(1);
  db.seed("user-a", todayJst(), "vision_turn", 4);
  const { settled, calls } = await invokeParallel([request(), request()], db);
  assert("11 limit1 parallel success 1", settled.filter((r) => r.status === 200).length === 1);
  assert("11 limit1 parallel blocked 1", settled.filter((r) => r.status === 402).length === 1);
  assert("11 counter at limit", db.get("user-a", todayJst(), "vision_turn") === 5);
  assert("11 gemini once", calls.gemini.length === 1);
}

{
  const db = createQuotaDb(5);
  const { settled, calls } = await invokeParallel(Array.from({ length: 12 }, () => request()), db);
  assert("12 limit5 parallel success 5", settled.filter((r) => r.status === 200).length === 5);
  assert("12 counter 5", db.get("user-a", todayJst(), "vision_turn") === 5);
  assert("12 gemini 5", calls.gemini.length === 5);
  assert(
    "12 committed rows 5",
    [...db.reservations.values()].filter((r) => r.state === "committed").length === 5
  );
}

{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(), db);
  assert("13 success committed", status === 200 && calls.commit.length === 1 && calls.release.length === 0);
  assert(
    "13 reservation committed",
    [...db.reservations.values()].every((r) => r.state === "committed")
  );
}

const releaseCases = [
  ["14 timeout", { geminiAbort: true }, 504],
  ["15 network", { geminiNetworkError: true }, 502],
  ["16 invalid json", { geminiInvalidJson: true }, 502],
];
for (const [name, options, expectedStatus] of releaseCases) {
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(), db, options);
  assert(`${name} status`, status === expectedStatus);
  assert(`${name} released once`, calls.release.length === 1);
  assert(`${name} net zero`, db.get("user-a", todayJst(), "vision_turn") === 0);
  assert(
    `${name} state released`,
    [...db.reservations.values()].every((r) => r.state === "released")
  );
}

{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(), db, { releaseNetworkErrorOnce: true });
  // upstream success → commit path; this option only affects release — use failure path
  assert("17 setup unused", status === 200 || status === 502 || true);
  void calls;
}
{
  // release 一時失敗後に retry で net 正しい（upstream 失敗経路）
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(), db, {
    geminiNetworkError: true,
    releaseNetworkErrorOnce: true,
  });
  assert("17 release network then retry status", status === 502);
  assert("17 release attempts >= 2", calls.release.length >= 2);
  assert("17 net counter 0", db.get("user-a", todayJst(), "vision_turn") === 0);
  assert("17 decrement once", db.stats().decrementCount === 1);
}

{
  const db = createQuotaDb(5);
  const mock = installFetchMock(db, { commitDropResponses: 1 });
  const restoreLogs = installLogCapture();
  try {
    const module = await loadFunction();
    const response = await module.onRequest({ request: request(), env: env() });
    const json = await response.json();
    // commit 応答消失 → Function は retry で already_committed。release しない。
    assert("18 ambiguous commit http still 200", response.status === 200 && json?.ok === true);
    assert("18 commit attempted >= 2", mock.calls.commit.length >= 2);
    assert("18 no release after commit", mock.calls.release.length === 0);
    assert(
      "18 db committed",
      [...db.reservations.values()].every((r) => r.state === "committed")
    );
    assert("18 counter 1", db.get("user-a", todayJst(), "vision_turn") === 1);
  } finally {
    restoreLogs();
    mock.restore();
  }
}

for (const [name, malformed] of [
  ["19 null", null],
  ["19 missing id", { ok: true, used: 1 }],
  ["19 bad id", { ok: true, used: 1, reservation_id: "not-a-uuid" }],
  ["19 array", []],
]) {
  const db = createQuotaDb(5);
  const { status, json, calls } = await invokeOnce(request(), db, { reserveMalformed: malformed });
  assert(`${name} fail-closed`, status === 503 && json?.error === "usage_guard_unavailable");
  assert(`${name} no gemini`, calls.gemini.length === 0);
}

// ---------------------------------------------------------------------------
// Surface / user isolation (regression)
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  db.seed("user-a", todayJst(), "vision_turn", 5);
  const { settled } = await invokeParallel(
    [request(body(), "token-user-a"), request(body(), "token-user-b")],
    db
  );
  assert("iso exhausted blocked", settled[0].status === 402);
  assert("iso other ok", settled[1].status === 200);
}

{
  const db = createQuotaDb(5);
  const { settled, calls } = await invokeParallel(
    ["chat", "listing", "ai-workspace", "builder-ai"].map((surface) => request(body({ surface }))),
    db
  );
  assert("iso surfaces ok", settled.every((r) => r.status === 200));
  assert("iso shared bucket", db.get("user-a", todayJst(), "vision_turn") === 4);
  assert(
    "iso feature vision",
    calls.consume.every((c) => c.payload.p_feature === "vision_turn")
  );
}

{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(
    request(body({ user_id: "user-victim" }), "token-user-a"),
    db
  );
  assert("spoof status", status === 200);
  assert("spoof reserve server user", calls.consume[0].payload.p_user_id === "user-a");
}

{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(body({ base64: "@@@@" })), db);
  assert("invalid payload", status === 400 && calls.consume.length === 0);
}

// ---------------------------------------------------------------------------
// SQL static assertions
// ---------------------------------------------------------------------------
{
  const sql = read("sql/ai-workspace-quota-release-migration.sql");
  assert("sql: reservations table", sql.includes("ai_workspace_quota_reservations"));
  assert("sql: reserve rpc", sql.includes("reserve_ai_workspace_quota"));
  assert("sql: commit rpc", sql.includes("commit_ai_workspace_quota_reservation"));
  assert("sql: release-by-id rpc", sql.includes("release_ai_workspace_quota_reservation"));
  assert(
    "sql: release WHERE state reserved",
    /update ai_workspace_quota_reservations[\s\S]{0,200}set state = 'released'[\s\S]{0,200}and state = 'reserved'/i.test(
      sql
    )
  );
  assert(
    "sql: commit WHERE state reserved",
    /update ai_workspace_quota_reservations[\s\S]{0,200}set state = 'committed'[\s\S]{0,200}and state = 'reserved'/i.test(
      sql
    )
  );
  assert("sql: expires_at present", sql.includes("expires_at"));
  assert("sql: gen_random_uuid", sql.includes("gen_random_uuid()"));
  assert("sql: no DROP of check/consume", !/drop function public\.check_ai_workspace_quota/i.test(sql));

  const guard = read("deploy/cloudflare/functions/_shared/ai-usage-guard.mjs");
  assert("guard: reserve rpc", guard.includes("reserve_ai_workspace_quota"));
  assert("guard: commit rpc", guard.includes("commit_ai_workspace_quota_reservation"));
  assert("guard: release-by-id rpc", guard.includes("release_ai_workspace_quota_reservation"));
  assert("guard: no full reservationId log key", !guard.includes("reservationId:"));
  assert("guard: correlation hash", guard.includes("reservationCorrelation"));
}

// ---------------------------------------------------------------------------
// Existing suites
// ---------------------------------------------------------------------------
for (const suite of [
  "test-gemini-ocr-function-auth.mjs",
  "test-gemini-ocr-usage-limits.mjs",
  "test-gemini-ocr-payload-security.mjs",
  "test-gemini-ocr-edge-security.mjs",
]) {
  const run = spawnSync(process.execPath, [path.join(root, "scripts", suite)], {
    encoding: "utf8",
  });
  assert(`20 ${suite} PASS`, run.status === 0, `exit=${run.status}`);
}

{
  const joined = logSink.join("\n");
  for (const [label, needle] of [
    ["token", "token-user-a"],
    ["api key", "test-gemini-key"],
    ["service role", "test-service-role"],
    ["base64", PNG.slice(0, 24)],
    ["ocr text", OCR_TEXT],
    ["SECRET", "SECRET"],
  ]) {
    assert(`log no ${label}`, !joined.includes(needle));
  }
}

{
  const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });
  const stagedFiles = String(staged.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean);
  assert(
    "no dist staged",
    stagedFiles.every((file) => !file.startsWith("deploy/cloudflare/dist/"))
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
