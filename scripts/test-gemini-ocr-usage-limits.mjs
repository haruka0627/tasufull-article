#!/usr/bin/env node
/**
 * Gemini OCR usage limits / surface allowlist / fail-closed regression
 *   node scripts/test-gemini-ocr-usage-limits.mjs
 *
 * Real Supabase / Gemini / DB are never called.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_PATH = "/api/gemini-ocr";
const ORIGIN = "https://app.tasful.example";
const STAGING_URL = "https://ahlxuyvhzqdqaojiywmu.supabase.co";
const PROD_URL = "https://ddojquacsyqesrjhcvmn.supabase.co";
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SAMPLE = `data:image/png;base64,${PNG_1X1}`;

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function envBase(extra = {}) {
  return {
    GEMINI_API_KEY: "test-gemini-key",
    SUPABASE_URL: STAGING_URL,
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    ...extra,
  };
}

function defaultBody(extra = {}) {
  return {
    mimeType: "image/png",
    base64: PNG_1X1,
    surface: "chat",
    feature: "ocr_turn",
    ...extra,
  };
}

function makeRequest(headers, body) {
  return new Request("https://app.tasful.example/api/gemini-ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body === undefined ? defaultBody() : body),
  });
}

/**
 * @param {{
 *   authStatus?: number,
 *   authBody?: object | null,
 *   authThrow?: boolean,
 *   geminiOk?: boolean,
 *   geminiInvalid?: boolean,
 *   planRows?: object[] | null,
 *   planStatus?: number,
 *   planThrow?: boolean,
 *   planInvalidJson?: boolean,
 *   checkAllowed?: boolean,
 *   checkUsed?: number,
 *   checkStatus?: number,
 *   checkBody?: object | null,
 *   checkThrow?: boolean,
 *   checkInvalidJson?: boolean,
 *   consumeThrow?: boolean,
 * }} [opts]
 */
function installFetchMock(opts = {}) {
  const authCalls = [];
  const geminiCalls = [];
  const planCalls = [];
  const checkCalls = [];
  const consumeCalls = [];
  const original = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      authCalls.push({ url: u, init });
      if (opts.authThrow) throw new TypeError("auth network down");
      const status = opts.authStatus ?? 200;
      const body =
        opts.authBody === undefined
          ? status === 200
            ? { id: "user-server-1" }
            : { message: "invalid" }
          : opts.authBody;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      geminiCalls.push({ url: u, init });
      if (opts.geminiOk === false) {
        return { ok: false, status: 502, json: async () => ({ error: { message: "upstream" } }) };
      }
      if (opts.geminiInvalid) {
        return { ok: true, status: 200, json: async () => ({ candidates: [] }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "ocr-text" }] } }],
        }),
      };
    }
    if (u.includes("gen_ai_subscriptions")) {
      planCalls.push({ url: u, init });
      if (opts.planThrow) throw new TypeError("plan network");
      const status = opts.planStatus ?? 200;
      if (opts.planInvalidJson) {
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => {
            throw new SyntaxError("bad json");
          },
        };
      }
      const rows = opts.planRows === undefined ? [] : opts.planRows;
      return { ok: status >= 200 && status < 300, status, json: async () => rows };
    }
    if (u.includes("/rest/v1/rpc/check_ai_workspace_quota")) {
      checkCalls.push({ url: u, init: { ...init, body: init.body } });
      if (opts.checkThrow) throw new TypeError("rpc network");
      const status = opts.checkStatus ?? 200;
      if (opts.checkInvalidJson) {
        return {
          ok: false,
          status: 200,
          json: async () => {
            throw new SyntaxError("bad");
          },
        };
      }
      if (status >= 400) {
        return {
          ok: false,
          status,
          json: async () => opts.checkBody || { message: "rpc error detail SECRET" },
        };
      }
      const body =
        opts.checkBody !== undefined
          ? opts.checkBody
          : {
              ok: true,
              allowed: opts.checkAllowed !== false,
              used: opts.checkUsed ?? 0,
              remaining: 5,
            };
      return { ok: true, status: 200, json: async () => body };
    }
    if (u.includes("/rest/v1/rpc/consume_ai_workspace_quota")) {
      consumeCalls.push({ url: u, init: { ...init, body: init.body } });
      if (opts.consumeThrow) throw new TypeError("consume network");
      return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, used: 1 }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  return {
    authCalls,
    geminiCalls,
    planCalls,
    checkCalls,
    consumeCalls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

async function loadOcrModule() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")
  ).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function loadGuard() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ai-usage-guard.mjs")
  ).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function callOcr(headers, body, fetchOpts, envExtra) {
  const mock = installFetchMock(fetchOpts);
  try {
    const mod = await loadOcrModule();
    const res = await mod.onRequest({
      request: makeRequest(headers, body),
      env: envBase(envExtra),
    });
    const json = await res.json().catch(() => null);
    return { res, json, mock };
  } finally {
    mock.restore();
  }
}

const authH = { Authorization: "Bearer good-token" };

// --- static security ---
{
  const fn = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const guard = read("deploy/cloudflare/functions/_shared/ai-usage-guard.mjs");
  const client = read("chat-ocr.js");
  assert("static: normalizeOcrSurface", fn.includes("normalizeOcrSurface"));
  assert("static: getOcrQuotaFeature", fn.includes("getOcrQuotaFeature"));
  assert("static: no workspace-only skip", !guard.includes("if (!isWorkspaceSurface(body))"));
  assert("static: fail-closed unavailable", guard.includes("usage_guard_unavailable"));
  assert("static: OCR_QUOTA_FEATURE vision", guard.includes('OCR_QUOTA_FEATURE = FEATURE_VISION'));
  assert("static: assertOcrGuardSupabaseUrl", guard.includes("assertOcrGuardSupabaseUrl"));
  assert("static: Bearer auth retained", fn.includes("/auth/v1/user"));
  assert("static: client surface allowlist", client.includes("OCR_ALLOWED_SURFACES"));
  assert("static: endpoint pinning", client.includes('GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr"'));
  assert("61 endpoint pinning", client.includes('GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr"'));
  assert("62 Bearer auth", client.includes('Authorization: "Bearer "'));
  assert("63 timeout", client.includes("timeoutMs"));
  assert("64 MIME precheck", client.includes("unsupported_mime_type"));
  assert("65 size precheck", client.includes("attachment_too_large"));
}

// --- surface allowlist (guard unit) ---
{
  const cf = await loadGuard();
  for (const s of ["ai-workspace", "chat", "listing", "builder-ai"]) {
    assert(`surface allow ${s}`, cf.normalizeOcrSurface(s) === s);
  }
  assert("1 ai-workspace allow", cf.isAllowedOcrSurface("ai-workspace"));
  assert("2 chat allow", cf.isAllowedOcrSurface("chat"));
  assert("3 listing allow", cf.isAllowedOcrSurface("listing"));
  assert("4 builder-ai allow", cf.isAllowedOcrSurface("builder-ai"));
  assert("5 empty reject", cf.normalizeOcrSurface("") === "");
  assert("6 whitespace reject", cf.normalizeOcrSurface("   ") === "");
  assert("7 unknown reject", cf.normalizeOcrSurface("unknown") === "");
  assert("8 uppercase normalize", cf.normalizeOcrSurface("CHAT") === "chat");
  assert("9 prefix spoof reject", cf.normalizeOcrSurface("chat-evil") === "");
  assert("10 suffix spoof reject", cf.normalizeOcrSurface("x-ai-workspace") === "");
  assert("11 object reject", cf.normalizeOcrSurface({ surface: "chat" }) === "");
  assert("12 array reject", cf.normalizeOcrSurface(["chat"]) === "");
  assert("13 null reject", cf.normalizeOcrSurface(null) === "");
  assert("14 omitted reject", cf.normalizeOcrSurface(undefined) === "");
}

// --- auth + surface ---
{
  const { res, json, mock } = await callOcr({}, defaultBody({ surface: "chat" }));
  assert("15 unauth → 401", res.status === 401 && json?.error === "auth_required");
  assert("15 Gemini 0", mock.geminiCalls.length === 0);
  assert("15 check 0", mock.checkCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ surface: "" }));
  assert("16 auth+empty surface → 400", res.status === 400 && json?.error === "invalid_surface");
  assert("16 Gemini 0", mock.geminiCalls.length === 0);
  assert("16 check 0", mock.checkCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ surface: "unknown" }));
  assert("16b auth+unknown → 400", res.status === 400 && json?.error === "invalid_surface");
  assert("16b Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }));
  assert("17 auth+valid → guard+gemini", res.status === 200 && mock.checkCalls.length === 1);
  assert("17 Gemini 1", mock.geminiCalls.length === 1);
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat", user_id: "forged-attacker" })
  );
  assert("18 forged user still ok", res.status === 200);
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("18 server user in check", checkBody.p_user_id === "user-server-1");
  const consumeBody = JSON.parse(String(mock.consumeCalls[0]?.init?.body || "{}"));
  assert("50 consume server user", consumeBody.p_user_id === "user-server-1");
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "listing" }));
  assert("19 omitted user_id uses server", res.status === 200);
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("19 server user", checkBody.p_user_id === "user-server-1");
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat", feature: "text_turn" })
  );
  assert("20 forged feature ignored", res.status === 200);
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("20 server feature vision_turn", checkBody.p_feature === "vision_turn");
  const consumeBody = JSON.parse(String(mock.consumeCalls[0]?.init?.body || "{}"));
  assert("52 consume server feature", consumeBody.p_feature === "vision_turn");
}

// --- all surfaces guard ---
{
  for (const surface of ["ai-workspace", "chat", "listing", "builder-ai"]) {
    const { res, mock } = await callOcr(authH, defaultBody({ surface }));
    assert(`21 guard once ${surface}`, res.status === 200 && mock.checkCalls.length === 1);
    assert(`21 gemini ${surface}`, mock.geminiCalls.length === 1);
  }
}
{
  const { mock } = await callOcr(authH, defaultBody({ surface: "talk" }));
  assert("22 invalid surface guard 0", mock.checkCalls.length === 0 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }));
  assert("23 guard success → Gemini", res.status === 200 && mock.geminiCalls.length === 1);
}
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkAllowed: false,
    checkUsed: 5,
  });
  assert("24 quota exceeded", res.status === 402 && json?.error === "quota_exceeded");
  assert("24 Gemini 0", mock.geminiCalls.length === 0);
  assert("24 consume 0", mock.consumeCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_SERVICE_ROLE_KEY: "" }
  );
  assert("25/27 service key missing → 503", res.status === 503 && json?.error === "usage_guard_unavailable");
  assert("25 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkThrow: true,
  });
  assert("26 helper/rpc throw → no Gemini", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_URL: "", TASFUL_SUPABASE_URL: "" }
  );
  // auth also needs URL — expect auth_unavailable 503 before guard, or guard if auth has other keys
  assert("28 URL missing fail-closed", res.status >= 400 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkStatus: 500,
    checkBody: { message: "db down SECRET" },
  });
  assert("29 RPC network/http fail", res.status === 503 && mock.geminiCalls.length === 0);
  assert("29 no raw leak", !JSON.stringify(await Promise.resolve({})).includes("SECRET"));
  const dumped = JSON.stringify((await callOcr(authH, defaultBody({ surface: "chat" }), { checkStatus: 500, checkBody: { message: "db down SECRET" } })).json);
  assert("19 sanitized no SECRET", !dumped.includes("SECRET") && !dumped.includes("db down"));
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkBody: { weird: true },
  });
  assert("30 RPC invalid shape", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkStatus: 400,
    checkBody: { error: "rpc boom" },
  });
  assert("31 RPC error body", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planStatus: 500,
  });
  assert("32 plan lookup failure", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    authBody: { id: "" },
  });
  assert("33 user ID missing", res.status === 401 && mock.geminiCalls.length === 0);
}

// --- quota ---
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [],
    checkAllowed: true,
    checkUsed: 0,
  });
  assert("34 free under limit allow", res.status === 200 && mock.geminiCalls.length === 1);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [],
    checkAllowed: false,
    checkUsed: 5,
  });
  assert("35 free at limit reject", res.status === 402 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [
      {
        plan_code: "pro",
        plan_label: "Pro",
        daily_text_limit: 100,
        subscription_status: "active",
      },
    ],
    checkAllowed: true,
    checkUsed: 10,
  });
  assert("36 paid under limit allow", res.status === 200 && mock.geminiCalls.length === 1);
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("36 paid limit 100", checkBody.p_limit === 100);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [
      {
        plan_code: "pro",
        plan_label: "Pro",
        daily_text_limit: 100,
        subscription_status: "active",
      },
    ],
    checkAllowed: false,
    checkUsed: 100,
  });
  assert("37 paid at limit reject", res.status === 402 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [],
  });
  assert("38 no subscription safe default", res.status === 200);
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("38 default limit 5", checkBody.p_limit === 5);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [
      {
        plan_code: "free",
        plan_label: "Free",
        daily_text_limit: 0,
        subscription_status: "active",
      },
    ],
  });
  assert("39 limit zero reject", res.status === 402 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [
      {
        plan_code: "bad",
        plan_label: "Bad",
        daily_text_limit: "NaN",
        subscription_status: "active",
      },
    ],
  });
  assert("40 invalid limit fail-closed", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planRows: [
      {
        plan_code: "bad",
        plan_label: "Bad",
        daily_text_limit: -1,
        subscription_status: "active",
      },
    ],
  });
  assert("41 negative limit reject", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkBody: { allowed: true, used: Number.NaN },
  });
  assert("42 usage NaN reject", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkBody: { allowed: true, used: 99 },
    planRows: [],
  });
  assert("43 usage > limit with allowed true fail-closed", res.status === 503 && mock.geminiCalls.length === 0);
}

// --- consume ---
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }));
  assert("44 success → consume", res.status === 200 && mock.consumeCalls.length === 1);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    geminiOk: false,
  });
  assert("45 Gemini HTTP fail → no consume", res.status === 502 && mock.consumeCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    geminiInvalid: true,
  });
  // empty candidates → ok true text ""
  assert("46 invalid/empty candidates still 200", res.status === 200);
  assert("46 consume on empty text success path", mock.consumeCalls.length === 1);
}
{
  const { mock } = await callOcr({}, defaultBody({ surface: "chat" }));
  assert("47 auth failure → consume 0", mock.consumeCalls.length === 0);
}
{
  const { mock } = await callOcr(authH, defaultBody({ surface: "nope" }));
  assert("48 surface failure → consume 0", mock.consumeCalls.length === 0);
}
{
  const { mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkAllowed: false,
  });
  assert("49 quota failure → consume 0", mock.consumeCalls.length === 0);
}
{
  const { mock } = await callOcr(authH, defaultBody({ surface: "Listing" }));
  assert("51 consume normalized surface meta via check", mock.checkCalls.length === 1);
  const consumeBody = JSON.parse(String(mock.consumeCalls[0]?.init?.body || "{}"));
  assert("51 consume feature vision", consumeBody.p_feature === "vision_turn");
}
{
  const { mock } = await callOcr(
    authH,
    defaultBody({
      surface: "chat",
      user_id: "client-forged",
      feature: "text_turn",
      meta: { userId: "hack" },
    })
  );
  const consumeBody = JSON.parse(String(mock.consumeCalls[0]?.init?.body || "{}"));
  assert("53 forged client metadata ignored", consumeBody.p_user_id === "user-server-1");
  assert("53 feature not text_turn", consumeBody.p_feature === "vision_turn");
}

// --- fail-closed env / DB ---
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_SERVICE_ROLE_KEY: undefined, TASFUL_SUPABASE_URL: STAGING_URL }
  );
  // spread may keep key — force empty
  const mock2 = installFetchMock({});
  try {
    const mod = await loadOcrModule();
    const res2 = await mod.onRequest({
      request: makeRequest(authH, defaultBody({ surface: "chat" })),
      env: {
        GEMINI_API_KEY: "k",
        SUPABASE_URL: STAGING_URL,
        SUPABASE_ANON_KEY: "anon",
      },
    });
    const json2 = await res2.json();
    assert("54 env missing service key", res2.status === 503 && json2.error === "usage_guard_unavailable");
    assert("54 Gemini 0", mock2.geminiCalls.length === 0);
  } finally {
    mock2.restore();
  }
  void res;
  void mock;
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkThrow: true,
  });
  assert("55 DB unavailable", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    planThrow: true,
  });
  assert("56 guard exception", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "chat" }), {
    checkBody: "not-object",
  });
  assert("57 malformed guard response", res.status === 503 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_URL: PROD_URL, TASFUL_SUPABASE_URL: PROD_URL }
  );
  assert("58 production URL allowed", res.status === 200 && mock.geminiCalls.length === 1);
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_URL: STAGING_URL }
  );
  assert("59 staging URL allowed", res.status === 200 && mock.geminiCalls.length === 1);
}
{
  const { res, mock } = await callOcr(
    authH,
    defaultBody({ surface: "chat" }),
    {},
    { SUPABASE_URL: "https://evil.example.supabase.co", TASFUL_SUPABASE_URL: "https://evil.example.supabase.co" }
  );
  assert("60 unknown host fail-closed", res.status === 503 && mock.geminiCalls.length === 0);
  assert("60 no fail-open", mock.checkCalls.length === 0);
}

// --- client surface / compatibility ---
function loadClient(opts = {}) {
  const calls = [];
  const win = {
    location: {
      origin: ORIGIN,
      pathname: opts.pathname || "/chat-detail.html",
    },
    TASU_CHAT_OCR_CONFIG: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 1024 * 1024 },
    },
  };
  if (opts.session !== undefined) {
    win.TasuSupabase = {
      getClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: opts.session } }),
        },
      }),
    };
  }
  const sandbox = {
    console,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, text: "ok" }),
      };
    },
    window: win,
    location: win.location,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
  return { win, calls };
}

{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/chat-detail.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("66 body surface chat from path", body.surface === "chat" && body.feature === "ocr_turn");
  assert("67 Authorization retained", calls[0].init.headers.Authorization === "Bearer tok");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/post.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("listing path surface", body.surface === "listing");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/ai-workspace.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("workspace path surface", body.surface === "ai-workspace");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/builder/builder-ai.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("builder-ai path surface", body.surface === "builder-ai");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/chat-detail.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE, { surface: "chat_attachment" });
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("alias chat_attachment → chat", body.surface === "chat");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/unknown-page.html",
  });
  await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("unknown path empty surface fail-closed at Function", body.surface === "");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    pathname: "/chat-detail.html",
  });
  // simulate Function 400
  calls.length = 0;
  const sandboxFetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ ok: false, error: "invalid_surface" }),
  });
  // re-load with failing fetch
  const win2 = {
    location: { origin: ORIGIN, pathname: "/chat-detail.html" },
    TASU_CHAT_OCR_CONFIG: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 1024 * 1024 },
    },
    TasuSupabase: {
      getClient: () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
      }),
    },
  };
  const calls2 = [];
  const sandbox = {
    console,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => {
      calls2.push({ url, init });
      return sandboxFetch();
    },
    window: win2,
    location: win2.location,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
  const r = await win2.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("68 invalid_surface fail-closed", r.ok === false && r.error === "invalid_surface");
  void win;
  void calls;
}

// reason compatibility 402/503
{
  const win = {
    location: { origin: ORIGIN, pathname: "/chat-detail.html" },
    TASU_CHAT_OCR_CONFIG: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 1024 * 1024 },
    },
    TasuSupabase: {
      getClient: () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
      }),
    },
  };
  const sandbox = {
    console,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => ({
      ok: false,
      status: 402,
      json: async () => ({ ok: false, error: "quota_exceeded" }),
    }),
    window: win,
    location: win.location,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("67 quota reason", r.ok === false && r.reason === "quota_exceeded");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
