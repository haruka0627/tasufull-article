#!/usr/bin/env node
/**
 * Gemini OCR atomic quota regression
 *   node scripts/test-gemini-ocr-atomic-quota.mjs
 *
 * 並列予約は「in-memory の SQL 相当 DB」に対して実行する。
 * consume / release ハンドラ本体は await を挟まない同期ブロックとして実装し、
 * 単一条件付き UPDATE（行ロック相当）の atomicity を再現する。
 * リクエスト間の interleave は fetch mock 側の非決定遅延で実際に発生させる。
 *
 * Real Supabase / Gemini / DB are never called.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://tasufull-article.pages.dev";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const OCR_TEXT = "atomic quota ocr text";
const results = [];

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
 * SQL 相当の quota ストア。
 * consume / release の本体は同期実行（= 単一 UPDATE の不可分性）。
 */
function createQuotaDb(limit) {
  const used = new Map();
  const key = (userId, dateJst, feature) => `${userId}|${dateJst}|${feature}`;

  return {
    limit,
    used,
    get(userId, dateJst, feature) {
      return used.get(key(userId, dateJst, feature)) ?? 0;
    },
    seed(userId, dateJst, feature, value) {
      used.set(key(userId, dateJst, feature), value);
    },
    // update ... set vision_used = vision_used + 1 where vision_used < p_limit
    consume(userId, dateJst, feature, rowLimit) {
      const k = key(userId, dateJst, feature);
      const current = used.get(k) ?? 0;
      if (rowLimit <= 0 || current >= rowLimit) {
        return { ok: false, error: "quota_exceeded", feature, used: current, limit: rowLimit, remaining: 0 };
      }
      const next = current + 1;
      used.set(k, next);
      return { ok: true, feature, used: next, limit: rowLimit, remaining: rowLimit - next };
    },
    // update ... set vision_used = greatest(0, vision_used - 1) where vision_used > 0
    release(userId, dateJst, feature) {
      const k = key(userId, dateJst, feature);
      const current = used.get(k) ?? 0;
      if (current <= 0) return { ok: false, error: "nothing_to_release", feature };
      used.set(k, Math.max(0, current - 1));
      return { ok: true, feature, used: used.get(k) };
    },
  };
}

function installFetchMock(db, options = {}) {
  const calls = { auth: [], plan: [], check: [], consume: [], release: [], gemini: [] };
  const originalFetch = globalThis.fetch;

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

    if (value.includes("/rpc/consume_ai_workspace_quota")) {
      calls.consume.push({ url: value, init, payload });
      await jitter();
      if (options.reserveHttpError) return { ok: false, status: 500, json: async () => ({}) };
      if (options.reserveNetworkError) throw new TypeError("raw rpc network SECRET");
      if (options.reserveMalformed !== undefined) {
        return { ok: true, status: 200, json: async () => options.reserveMalformed };
      }
      // 同期ブロック — 条件付き UPDATE の不可分性
      const row = db.consume(
        payload.p_user_id,
        payload.p_date_jst,
        payload.p_feature,
        payload.p_limit
      );
      await jitter();
      return { ok: true, status: 200, json: async () => row };
    }

    if (value.includes("/rpc/release_ai_workspace_quota")) {
      calls.release.push({ url: value, init, payload });
      await jitter();
      if (options.releaseHttpError) return { ok: false, status: 500, json: async () => ({}) };
      const row = db.release(payload.p_user_id, payload.p_date_jst, payload.p_feature);
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

const logSink = [];
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

/** 並列 invocation。fetch mock は 1 つを共有し、実際に interleave させる。 */
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
// 1. 上限 1 · 2 並列 → 成功は厳密に 1
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(1);
  db.seed("user-a", todayJst(), "vision_turn", 4); // free limit 5 → 残 1
  const { settled, calls } = await invokeParallel([request(), request()], db);
  const ok = settled.filter((r) => r.status === 200);
  const blocked = settled.filter((r) => r.status === 402);
  assert("01 limit1 parallel2 success exactly 1", ok.length === 1, `ok=${ok.length}`);
  assert("01 limit1 parallel2 blocked exactly 1", blocked.length === 1, `402=${blocked.length}`);
  assert("01 counter equals limit", db.get("user-a", todayJst(), "vision_turn") === 5);
  assert("01 upstream not over-called", calls.gemini.length === 1, `gemini=${calls.gemini.length}`);
}

// ---------------------------------------------------------------------------
// 2. 上限 N · N+複数 並列 → 成功は厳密に N
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const requests = Array.from({ length: 12 }, () => request());
  const { settled, calls } = await invokeParallel(requests, db);
  const ok = settled.filter((r) => r.status === 200);
  assert("02 limitN parallel N+7 success exactly N", ok.length === 5, `ok=${ok.length}`);
  assert("02 counter equals N", db.get("user-a", todayJst(), "vision_turn") === 5);
  assert("02 upstream calls equal N", calls.gemini.length === 5, `gemini=${calls.gemini.length}`);
  assert(
    "02 rest quota_exceeded",
    settled.filter((r) => r.status === 402 && r.json?.error === "quota_exceeded").length === 7
  );
}

// ---------------------------------------------------------------------------
// 2b. 非 atomic な check→upstream→consume 順序なら超過が起きること（test の検出力確認）
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const mock = installFetchMock(db);
  let served = 0;
  try {
    await Promise.all(
      Array.from({ length: 12 }, async () => {
        const checkRes = await globalThis.fetch(
          "https://x/rest/v1/rpc/check_ai_workspace_quota",
          {
            method: "POST",
            body: JSON.stringify({
              p_user_id: "user-a",
              p_date_jst: todayJst(),
              p_feature: "vision_turn",
              p_limit: 5,
            }),
          }
        );
        const check = await checkRes.json();
        if (!check.allowed) return;
        await globalThis.fetch("https://generativelanguage.googleapis.com/x", { method: "POST" });
        served += 1;
      })
    );
  } finally {
    mock.restore();
  }
  assert("02b legacy check-then-consume over-serves", served > 5, `served=${served}`);
}

// ---------------------------------------------------------------------------
// 3. 別ユーザーは quota を共有しない
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  db.seed("user-a", todayJst(), "vision_turn", 5);
  const { settled } = await invokeParallel(
    [request(body(), "token-user-a"), request(body(), "token-user-b")],
    db
  );
  assert("03 exhausted user blocked", settled[0].status === 402);
  assert("03 other user unaffected", settled[1].status === 200);
  assert("03 other user counter 1", db.get("user-b", todayJst(), "vision_turn") === 1);
}

// ---------------------------------------------------------------------------
// 4. surface 分離は現行仕様どおり（OCR は surface 横断で vision_turn バケット共有）
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const surfaces = ["chat", "listing", "ai-workspace", "builder-ai"];
  const { settled, calls } = await invokeParallel(
    surfaces.map((surface) => request(body({ surface }))),
    db
  );
  assert("04 all surfaces reserved", settled.every((r) => r.status === 200));
  assert(
    "04 single shared vision_turn bucket",
    db.get("user-a", todayJst(), "vision_turn") === 4
  );
  assert(
    "04 feature always vision_turn",
    calls.consume.every((c) => c.payload.p_feature === "vision_turn")
  );
}

// ---------------------------------------------------------------------------
// 5. spoofed user ID で他人の quota を使えない
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(
    request(body({ user_id: "user-victim", userId: "user-victim" }), "token-user-a"),
    db
  );
  assert("05 spoofed body accepted but re-keyed", status === 200);
  assert("05 reservation keyed to server id", calls.consume[0].payload.p_user_id === "user-a");
  assert("05 victim untouched", db.get("user-victim", todayJst(), "vision_turn") === 0);
}

// ---------------------------------------------------------------------------
// 6. invalid payload では予約しない
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(body({ base64: "@@@@" })), db);
  assert("06 invalid payload rejected", status === 400);
  assert("06 no reservation", calls.consume.length === 0 && calls.check.length === 0);
  assert("06 counter untouched", db.get("user-a", todayJst(), "vision_turn") === 0);
}

// ---------------------------------------------------------------------------
// 7-10. upstream 失敗系は必ず release される
// ---------------------------------------------------------------------------
const releaseCases = [
  ["07 upstream timeout", { geminiAbort: true }, 504],
  ["08 upstream network error", { geminiNetworkError: true }, 502],
  ["09 upstream invalid JSON", { geminiInvalidJson: true }, 502],
  ["10 upstream invalid shape", { geminiJson: { candidates: [{ content: {} }] } }, 502],
  ["10b upstream 500", { geminiStatus: 500 }, 502],
  ["10c upstream 429", { geminiStatus: 429 }, 503],
];
for (const [name, options, expectedStatus] of releaseCases) {
  const db = createQuotaDb(5);
  const { status, calls } = await invokeOnce(request(), db, options);
  assert(`${name} status`, status === expectedStatus, String(status));
  assert(`${name} reserved once`, calls.consume.length === 1);
  assert(`${name} released once`, calls.release.length === 1);
  assert(`${name} net zero`, db.get("user-a", todayJst(), "vision_turn") === 0);
}

// ---------------------------------------------------------------------------
// 11. upstream 成功時のみ確定消費
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const { status, json, calls } = await invokeOnce(request(), db);
  assert("11 success status", status === 200 && json?.text === OCR_TEXT);
  assert("11 committed once", calls.consume.length === 1 && calls.release.length === 0);
  assert("11 counter 1", db.get("user-a", todayJst(), "vision_turn") === 1);
}

// ---------------------------------------------------------------------------
// 12-13. 二重 release / 二重 consume の防止（状態遷移）
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const mock = installFetchMock(db);
  const restoreLogs = installLogCapture();
  try {
    const guard = await loadGuard();
    const reserved = await guard.enforceCfOcrGuard(
      new Request(`${ORIGIN}/api/gemini-ocr`, { method: "POST" }),
      { user_id: "user-a", surface: "chat", feature: "vision_turn" },
      env()
    );
    assert("12 reservation issued", guard.getOcrReservationState(reserved.reservation) === "reserved");
    assert("12 reservation id not sequential", !/^\d+$/.test(String(reserved.reservation.id)));

    const first = await guard.releaseCfOcrReservation(reserved.reservation);
    const second = await guard.releaseCfOcrReservation(reserved.reservation);
    assert("12 first release ok", first.ok === true);
    assert("12 second release no-op", second.ok === false && second.state === "released");
    assert("12 release rpc once", mock.calls.release.length === 1);
    assert("12 counter restored", db.get("user-a", todayJst(), "vision_turn") === 0);

    const lateCommit = await guard.finalizeCfOcrConsume(reserved.meta, reserved.reservation);
    assert("13 commit after release rejected", lateCommit === null);

    const second2 = await guard.enforceCfOcrGuard(
      new Request(`${ORIGIN}/api/gemini-ocr`, { method: "POST" }),
      { user_id: "user-a", surface: "chat", feature: "vision_turn" },
      env()
    );
    const commit1 = await guard.finalizeCfOcrConsume(second2.meta, second2.reservation);
    const commit2 = await guard.finalizeCfOcrConsume(second2.meta, second2.reservation);
    assert("13 commit once", commit1?.state === "committed" && commit2 === null);
    assert("13 no extra reserve rpc", mock.calls.consume.length === 2);
    const releaseAfterCommit = await guard.releaseCfOcrReservation(second2.reservation);
    assert(
      "13 release after commit rejected",
      releaseAfterCommit.ok === false && releaseAfterCommit.state === "committed"
    );
    assert("13 release rpc still once", mock.calls.release.length === 1);
    assert("13 counter stays consumed", db.get("user-a", todayJst(), "vision_turn") === 1);
  } finally {
    restoreLogs();
    mock.restore();
  }
}

// ---------------------------------------------------------------------------
// 14-15. fail-closed
// ---------------------------------------------------------------------------
{
  const db = createQuotaDb(5);
  const { status, json, calls } = await invokeOnce(request(), db, { reserveHttpError: true });
  assert("14 backend failure fail-closed", status === 503 && json?.error === "usage_guard_unavailable");
  assert("14 upstream not called", calls.gemini.length === 0);
  assert("14 counter untouched", db.get("user-a", todayJst(), "vision_turn") === 0);
}
{
  const db = createQuotaDb(5);
  const { status, json, calls } = await invokeOnce(request(), db, { reserveNetworkError: true });
  assert("14b rpc network failure fail-closed", status === 503 && json?.error === "usage_guard_unavailable");
  assert("14b upstream not called", calls.gemini.length === 0);
}
for (const [name, malformed] of [
  ["15 null", null],
  ["15 array", []],
  ["15 string", "ok"],
  ["15 missing ok", { used: 1 }],
  ["15 non-boolean ok", { ok: "true", used: 1 }],
  ["15 missing used", { ok: true }],
  ["15 used over limit", { ok: true, used: 99 }],
  ["15 used zero", { ok: true, used: 0 }],
  ["15 unknown error", { ok: false, error: "boom" }],
]) {
  const db = createQuotaDb(5);
  const { status, json, calls } = await invokeOnce(request(), db, { reserveMalformed: malformed });
  assert(`${name} fail-closed`, status === 503 && json?.error === "usage_guard_unavailable", String(status));
  assert(`${name} upstream not called`, calls.gemini.length === 0);
}

// ---------------------------------------------------------------------------
// 16. 既存 auth / usage / payload / edge tests 全 PASS
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
  assert(`16 ${suite} PASS`, run.status === 0, `exit=${run.status}`);
}

// ---------------------------------------------------------------------------
// 17. sensitive logging がない
// ---------------------------------------------------------------------------
{
  const joined = logSink.join("\n");
  const forbidden = [
    ["bearer token", "test-token"],
    ["user token", "token-user-a"],
    ["gemini api key", "test-gemini-key"],
    ["service role key", "test-service-role"],
    ["base64 payload", PNG.slice(0, 24)],
    ["ocr text", OCR_TEXT],
    ["raw upstream", "SECRET"],
  ];
  for (const [label, needle] of forbidden) {
    assert(`17 no ${label} in logs`, !joined.includes(needle));
  }
  assert(
    "17 logs limited to fixed taxonomy",
    logSink.every((line) => !/\bupdate |select |insert into|ai_workspace_usage_daily/i.test(line))
  );
}

// ---------------------------------------------------------------------------
// atomic primitive の静的検証（SQL 条件）
// ---------------------------------------------------------------------------
{
  const consumeSql = read("sql/ai-workspace-usage-daily.sql");
  const releaseSql = read("sql/ai-workspace-quota-release-migration.sql");

  assert(
    "sql: reserve uses conditional update guard",
    /update ai_workspace_usage_daily[\s\S]{0,400}?set vision_used = vision_used \+ 1[\s\S]{0,400}?and vision_used < p_limit/i.test(
      consumeSql
    )
  );
  assert(
    "sql: reserve is single statement (no select-then-update)",
    !/select[\s\S]{0,200}vision_used[\s\S]{0,200}into[\s\S]{0,200}update ai_workspace_usage_daily[\s\S]{0,200}vision_used = vision_used \+ 1/i.test(
      consumeSql
    )
  );
  assert("sql: release function defined", releaseSql.includes("release_ai_workspace_quota"));
  assert(
    "sql: release conditional decrement",
    /set vision_used = greatest\(0, vision_used - 1\)[\s\S]{0,300}and vision_used > 0/i.test(releaseSql)
  );
  assert("sql: release security definer", /security definer/i.test(releaseSql));
  assert("sql: release fixed search_path", /set search_path = public/i.test(releaseSql));
  assert(
    "sql: release granted to service_role",
    /grant execute on function public\.release_ai_workspace_quota\(text, text, text\) to service_role/i.test(
      releaseSql
    )
  );

  const guard = read("deploy/cloudflare/functions/_shared/ai-usage-guard.mjs");
  assert("guard: no in-memory lock", !/mutex|globalThis\.__quota|process\.env\.QUOTA_LOCK/i.test(guard));
  assert("guard: release rpc wired", guard.includes("release_ai_workspace_quota"));
  assert("guard: reservation state machine", guard.includes('RESERVATION_RESERVED = "reserved"'));

  const fn = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  assert(
    "fn: reserve before upstream",
    /const guard = await enforceCfOcrGuard\([\s\S]*const outcome = await requestGeminiOcr\(/.test(fn)
  );
  assert("fn: single release call site", (fn.match(/releaseCfOcrReservation\(/g) || []).length === 1);
  assert("fn: single commit call site", (fn.match(/finalizeCfOcrConsume\(/g) || []).length === 1);
}

// ---------------------------------------------------------------------------
// 18. dist を変更 / stage していない
// ---------------------------------------------------------------------------
{
  const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });
  const stagedFiles = String(staged.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean);
  assert(
    "18 no dist staged",
    stagedFiles.every((file) => !file.startsWith("deploy/cloudflare/dist/")),
    stagedFiles.filter((f) => f.startsWith("deploy/cloudflare/dist/")).join(",")
  );
  assert(
    "18 no dist function in change set",
    stagedFiles.every((file) => !file.includes("dist/functions/api/gemini-ocr.js"))
  );
}

function todayJst() {
  try {
    return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch (_e) {
    return new Date().toISOString().slice(0, 10);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
