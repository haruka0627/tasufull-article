#!/usr/bin/env node
/**
 * Gemini OCR edge security regression
 *   node scripts/test-gemini-ocr-edge-security.mjs
 *
 * Real Supabase / Gemini / DB are never called.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "https://tasufull-article.pages.dev";
const CUSTOM = "https://tasful.jp";
const WWW = "https://www.tasful.jp";
const BRANCH_PREVIEW = "https://cf-pages-deploy.tasufull-article.pages.dev";
const DEPLOY_PREVIEW = "https://deadbeef.tasufull-article.pages.dev";
const LOCAL = "http://127.0.0.1:8788";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const authHeader = { Authorization: "Bearer test-token" };
const results = [];

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  const output = `${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`;
  (condition ? console.log : console.error)(output);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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

function request({
  origin = PROD,
  urlOrigin = origin || PROD,
  method = "POST",
  headers = {},
  requestBody = body(),
  omitOrigin = false,
} = {}) {
  const requestHeaders = { ...headers };
  if (!omitOrigin) requestHeaders.Origin = origin;
  if (method === "POST") requestHeaders["Content-Type"] = "application/json";
  return new Request(`${urlOrigin}/api/gemini-ocr`, {
    method,
    headers: requestHeaders,
    body: method === "POST" ? JSON.stringify(requestBody) : undefined,
  });
}

function installFetchMock(options = {}) {
  const calls = {
    auth: [],
    plan: [],
    check: [],
    consume: [],
    release: [],
    gemini: [],
  };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.includes("/auth/v1/user")) {
      calls.auth.push({ url: value, init });
      if (options.authNetworkError) throw new TypeError("raw supabase network SECRET");
      const status = options.authStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (options.authInvalidJson) throw new SyntaxError("raw supabase json SECRET");
          return options.authBody ?? (status === 200 ? { id: "server-user-1" } : { raw: "SECRET" });
        },
      };
    }
    if (value.includes("gen_ai_subscriptions")) {
      calls.plan.push({ url: value, init });
      return { ok: true, status: 200, json: async () => [] };
    }
    if (value.includes("/rpc/check_ai_workspace_quota")) {
      calls.check.push({ url: value, init });
      if (options.guardNetworkError) throw new TypeError("raw rpc SECRET");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          allowed: options.quotaAllowed !== false,
          used: options.quotaAllowed === false ? 5 : 0,
        }),
      };
    }
    if (value.includes("/rpc/consume_ai_workspace_quota")) {
      calls.consume.push({ url: value, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, used: 1 }) };
    }
    if (value.includes("/rpc/release_ai_workspace_quota")) {
      calls.release.push({ url: value, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, used: 0 }) };
    }
    if (value.includes("generativelanguage.googleapis.com")) {
      calls.gemini.push({ url: value, init });
      if (options.geminiNetworkError) throw new TypeError("raw gemini network SECRET");
      if (options.geminiPending) {
        return await new Promise((resolve, reject) => {
          const rejectAbort = () => {
            const error = new Error("raw abort SECRET");
            error.name = "AbortError";
            reject(error);
          };
          if (init.signal?.aborted) rejectAbort();
          else init.signal?.addEventListener("abort", rejectAbort, { once: true });
          void resolve;
        });
      }
      const status = options.geminiStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (options.geminiInvalidJson) throw new SyntaxError("raw google json SECRET");
          if (options.geminiJson !== undefined) return options.geminiJson;
          if (status >= 400) {
            return { error: { message: "raw google error SECRET", apiKey: "test-gemini-key" } };
          }
          return {
            candidates: [{ content: { parts: [{ text: "safe OCR result" }] } }],
          };
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

async function loadFunction() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")
  ).href;
  return import(`${href}?edge=${Date.now()}-${Math.random()}`);
}

async function invoke(requestValue, options = {}, envExtra = {}) {
  const mock = installFetchMock(options);
  try {
    const module = await loadFunction();
    const response = await module.onRequest({
      request: requestValue,
      env: env(envExtra),
    });
    const json = await response.json().catch(() => null);
    return { response, json, calls: mock.calls };
  } finally {
    mock.restore();
  }
}

/** 予約 1 件が確保され、upstream 失敗で解放されている（実消費 net 0） */
function reservedAndReleased(calls) {
  return calls.consume.length === 1 && calls.release.length === 1;
}

function noWork(calls) {
  return (
    calls.auth.length === 0 &&
    calls.check.length === 0 &&
    calls.gemini.length === 0 &&
    calls.consume.length === 0
  );
}

// Static non-regression and sensitive logging checks.
{
  const source = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  assert("static: no wildcard ACAO", !source.includes('"Access-Control-Allow-Origin": "*"'));
  assert("static: Vary Origin", source.includes('Vary: "Origin"'));
  assert("static: AbortController", source.includes("new AbortController()"));
  assert("static: fixed 15s timeout", source.includes("GEMINI_UPSTREAM_TIMEOUT_MS = 15_000"));
  assert("static: timer cleanup", source.includes("finally") && source.includes("clearTimeout(timer)"));
  assert("static: auth retained", source.includes("/auth/v1/user"));
  assert("static: server user retained", source.includes("user_id: authenticatedUserId"));
  assert("static: surface allowlist retained", source.includes("normalizeOcrSurface"));
  assert("static: guard retained", source.includes("enforceCfOcrGuard"));
  assert("static: payload retained", source.includes("validateOcrPayload"));
  assert("static: model fixed", source.includes('GEMINI_OCR_MODEL = "gemini-2.5-flash"'));
  assert("static: prompt fixed", source.includes("Extract all visible text"));
  assert("static: no console calls", !/console\.(?:log|info|warn|error|debug)/.test(source));
  assert("static: no raw upstream response body", !source.includes("geminiJson.error"));
  assert("static: no upstream status in response", !/status:\s*geminiRes\.status/.test(source));
}

// Origin policy.
for (const [name, origin] of [
  ["1 production custom domain", CUSTOM],
  ["1b production www domain", WWW],
  ["2 production pages.dev", PROD],
  ["3 branch preview", BRANCH_PREVIEW],
  ["3b deployment preview", DEPLOY_PREVIEW],
  ["4 localhost development", LOCAL],
]) {
  const { response, calls } = await invoke(
    request({ origin, urlOrigin: origin, headers: authHeader })
  );
  assert(`${name} allow`, response.status === 200, String(response.status));
  assert(`${name} Gemini once`, calls.gemini.length === 1);
}

for (const [name, origin] of [
  ["5 external domain", "https://evil.example"],
  ["6 tasful suffix spoof", "https://evil-tasful.jp"],
  ["6b tasful parent spoof", "https://tasful.jp.evil.com"],
  ["7 arbitrary pages.dev", "https://evil.pages.dev"],
  ["7b arbitrary project branch", "https://main.evil.pages.dev"],
  ["8 protocol mismatch", "http://tasful.jp"],
  ["9 port mismatch", "https://tasful.jp:444"],
  ["10 malformed", "not-an-origin"],
  ["11 null", "null"],
  ["12 empty", ""],
  ["14 object equivalent", "[object Object]"],
  ["15 encoded hostname trick", "https://tasful%2ejp"],
  ["16 userinfo trick", "https://user@tasful.jp"],
]) {
  const { response, json, calls } = await invoke(
    request({ origin, urlOrigin: PROD, headers: authHeader })
  );
  assert(`${name} reject`, response.status === 403 && json?.error === "origin_forbidden");
  assert(`${name} no edge work`, noWork(calls));
  assert(`${name} no ACAO`, response.headers.get("Access-Control-Allow-Origin") === null);
}

{
  const { response, calls } = await invoke(
    request({ urlOrigin: PROD, headers: authHeader, omitOrigin: true })
  );
  assert("13 missing Origin reject", response.status === 403);
  assert("13 missing Origin no edge work", noWork(calls));
}
{
  const { response, calls } = await invoke(
    request({ origin: CUSTOM, urlOrigin: PROD, headers: authHeader })
  );
  assert("same-origin mismatch reject", response.status === 403);
  assert("same-origin mismatch no auth", calls.auth.length === 0);
}

// OPTIONS / CORS.
{
  const { response, calls } = await invoke(
    request({ origin: PROD, urlOrigin: PROD, method: "OPTIONS" })
  );
  assert("17 valid OPTIONS 204", response.status === 204);
  assert("17 OPTIONS no body", (await response.text()) === "");
  assert("17 OPTIONS no edge work", noWork(calls));
  assert("19 ACAO validated origin", response.headers.get("Access-Control-Allow-Origin") === PROD);
  assert("20 no wildcard", response.headers.get("Access-Control-Allow-Origin") !== "*");
  assert("21 Vary Origin", response.headers.get("Vary") === "Origin");
  assert("22 POST only allowed", response.headers.get("Access-Control-Allow-Methods") === "POST");
  const allowedHeaders = response.headers.get("Access-Control-Allow-Headers") || "";
  assert("23 Authorization allowed", allowedHeaders.includes("Authorization"));
  assert("24 Content-Type allowed", allowedHeaders.includes("Content-Type"));
  assert("25 no unnecessary header", !/Cookie|X-Api-Key|X-Requested-With/i.test(allowedHeaders));
  assert("OPTIONS max age 600", response.headers.get("Access-Control-Max-Age") === "600");
}
{
  const { response, calls } = await invoke(
    request({ origin: "https://evil.example", urlOrigin: PROD, method: "OPTIONS" })
  );
  assert("18 invalid OPTIONS 403", response.status === 403);
  assert("26 invalid OPTIONS no ACAO", response.headers.get("Access-Control-Allow-Origin") === null);
  assert("18 invalid OPTIONS no work", noWork(calls));
}

// Ordering and normal POST CORS.
{
  const { response, calls } = await invoke(
    request({ origin: "https://evil.example", urlOrigin: PROD, headers: authHeader })
  );
  assert("27 invalid Origin auth 0", calls.auth.length === 0);
  assert("28 invalid Origin guard 0", calls.check.length === 0);
  assert("29 invalid Origin Gemini 0", calls.gemini.length === 0);
  assert("invalid Origin 403", response.status === 403);
}
{
  const { response, json, calls } = await invoke(request({ headers: {} }));
  assert("30 valid Origin auth failure", response.status === 401 && json?.error === "auth_required");
  assert("30 valid Origin auth failure CORS", response.headers.get("Access-Control-Allow-Origin") === PROD);
  assert("30 auth failure Gemini 0", calls.gemini.length === 0);
}
{
  const { response, calls } = await invoke(
    request({ headers: authHeader, requestBody: body({ surface: "unknown" }) })
  );
  assert("31 surface failure", response.status === 400);
  assert("31 surface failure Gemini 0", calls.gemini.length === 0);
}
{
  const { response, calls } = await invoke(
    request({ headers: authHeader, requestBody: body({ base64: "@@@@" }) })
  );
  assert("32 payload failure", response.status === 400);
  assert("32 payload failure guard 0", calls.check.length === 0);
  assert("32 payload failure Gemini 0", calls.gemini.length === 0);
}
{
  const { response, calls } = await invoke(
    request({ headers: authHeader }),
    { quotaAllowed: false }
  );
  assert("33 quota failure", response.status === 402);
  assert("33 quota CORS", response.headers.get("Access-Control-Allow-Origin") === PROD);
  assert("33 quota failure Gemini 0", calls.gemini.length === 0);
}
{
  const { response, json, calls } = await invoke(request({ headers: authHeader }));
  assert("34 valid full request", response.status === 200 && json?.text === "safe OCR result");
  assert("34 valid POST ACAO", response.headers.get("Access-Control-Allow-Origin") === PROD);
  assert("34 valid POST Vary", response.headers.get("Vary") === "Origin");
  assert("34 valid guard/Gemini/consume", calls.check.length === 1 && calls.gemini.length === 1 && calls.consume.length === 1);
}

// Timer behavior.
async function invokeWithTimer(options, fireImmediately) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timerState = { delays: [], cleared: [] };
  let sequence = 0;
  globalThis.setTimeout = (callback, delay) => {
    const id = { id: ++sequence };
    timerState.delays.push(delay);
    if (fireImmediately) queueMicrotask(callback);
    return id;
  };
  globalThis.clearTimeout = (id) => timerState.cleared.push(id);
  try {
    const outcome = await invoke(request({ headers: authHeader }), options);
    return { ...outcome, timerState };
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

{
  const { response, calls, timerState } = await invokeWithTimer({}, false);
  assert("35 success before timeout", response.status === 200);
  assert("40 timer clear success", timerState.cleared.length === 1);
  assert("fixed timeout delay", timerState.delays[0] === 15_000);
  assert("success consume one", calls.consume.length === 1);
}
{
  const { response, json, calls, timerState } = await invokeWithTimer(
    { geminiPending: true },
    true
  );
  assert("36 pending Gemini aborted", calls.gemini[0]?.init?.signal?.aborted === true);
  assert("37 AbortError normalized", json?.error === "upstream_timeout");
  assert("38 timeout HTTP 504", response.status === 504);
  assert("39 timeout reservation released", reservedAndReleased(calls));
  assert("44 timer clear abort", timerState.cleared.length === 1);
}
{
  const { response, timerState } = await invokeWithTimer({ geminiStatus: 500 }, false);
  assert("41 timer clear HTTP error", response.status === 502 && timerState.cleared.length === 1);
}
{
  const { response, timerState } = await invokeWithTimer({ geminiInvalidJson: true }, false);
  assert("42 timer clear JSON error", response.status === 502 && timerState.cleared.length === 1);
}
{
  const { response, timerState } = await invokeWithTimer({ geminiNetworkError: true }, false);
  assert("43 timer clear network error", response.status === 502 && timerState.cleared.length === 1);
}
{
  const { response, calls } = await invoke(
    request({ headers: authHeader, requestBody: body({ timeoutMs: 1, timeout: 1 }) })
  );
  assert("45 client timeout ignored", response.status === 200);
  const upstreamBody = JSON.parse(calls.gemini[0].init.body);
  assert("46 body timeout not forwarded", !("timeout" in upstreamBody) && !("timeoutMs" in upstreamBody));
}

// Sanitized upstream errors.
const upstreamCases = [
  ["48 Gemini 400", 400, 502, "upstream_request_failed"],
  ["49 Gemini 401", 401, 503, "provider_configuration_error"],
  ["50 Gemini 403", 403, 503, "provider_configuration_error"],
  ["51 Gemini 429", 429, 503, "upstream_rate_limited"],
  ["52 Gemini 500", 500, 502, "upstream_unavailable"],
  ["53 Gemini 502", 502, 502, "upstream_unavailable"],
  ["54 Gemini 503", 503, 502, "upstream_unavailable"],
];
for (const [name, upstreamStatus, expectedStatus, expectedError] of upstreamCases) {
  const { response, json, calls } = await invoke(
    request({ headers: authHeader }),
    { geminiStatus: upstreamStatus }
  );
  assert(`${name} status`, response.status === expectedStatus, String(response.status));
  assert(`${name} taxonomy`, json?.error === expectedError, String(json?.error));
  assert(`${name} reservation released`, reservedAndReleased(calls));
  const serialized = JSON.stringify(json);
  assert(`${name} no raw body`, !serialized.includes("SECRET") && !serialized.includes("google"));
  assert(`${name} no raw status field`, !Object.prototype.hasOwnProperty.call(json || {}, "status"));
}
{
  const { response, json, calls } = await invoke(
    request({ headers: authHeader }),
    { geminiNetworkError: true }
  );
  assert("47 network reject status", response.status === 502);
  assert("47 network reject taxonomy", json?.error === "upstream_unavailable");
  assert("47 network reservation released", reservedAndReleased(calls));
  assert("47 network raw hidden", !JSON.stringify(json).includes("SECRET"));
}
{
  const { response, json, calls } = await invoke(
    request({ headers: authHeader }),
    { geminiInvalidJson: true }
  );
  assert("55 invalid JSON status", response.status === 502);
  assert("55 invalid JSON taxonomy", json?.error === "invalid_upstream_response");
  assert("55 invalid JSON reservation released", reservedAndReleased(calls));
}
for (const [name, geminiJson] of [
  ["56 empty response", null],
  ["57 candidates missing", {}],
  ["57b parts missing", { candidates: [{ content: {} }] }],
]) {
  const { response, json, calls } = await invoke(
    request({ headers: authHeader }),
    { geminiJson }
  );
  assert(`${name} status`, response.status === 502);
  assert(`${name} taxonomy`, json?.error === "invalid_upstream_response");
  assert(`${name} reservation released`, reservedAndReleased(calls));
}
{
  const { response, json, calls } = await invoke(
    request({ headers: authHeader }),
    { geminiJson: { candidates: [{ finishReason: "SAFETY" }] } }
  );
  assert("58 blocked result status", response.status === 422);
  assert("58 blocked result taxonomy", json?.error === "ocr_unavailable");
  assert("58 blocked reservation released", reservedAndReleased(calls));
}
{
  const { response, json } = await invoke(
    request({ headers: authHeader }),
    { authInvalidJson: true }
  );
  assert("auth invalid JSON status", response.status === 503);
  assert("auth invalid JSON sanitized", json?.error === "auth_unavailable");
  assert("auth invalid JSON raw hidden", !JSON.stringify(json).includes("SECRET"));
}

// Logging and response shape.
{
  const captured = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  for (const name of Object.keys(original)) {
    console[name] = (...args) => captured.push(args.map(String).join(" "));
  }
  try {
    await invoke(request({ headers: authHeader }));
  } finally {
    Object.assign(console, original);
  }
  const output = captured.join("\n");
  assert("63 token not logged", !output.includes("test-token"));
  assert("64 API key not logged", !output.includes("test-gemini-key"));
  assert("65 service role not logged", !output.includes("test-service-role"));
  assert("66 base64 not logged", !output.includes(PNG));
  assert("67 OCR text not logged", !output.includes("safe OCR result"));
  assert("68 raw Gemini not logged", !output.includes("raw google"));
  assert("69 raw Supabase not logged", !output.includes("raw supabase"));
  assert("70 raw RPC not logged", !output.includes("raw rpc"));
}
{
  const { response, json } = await invoke(
    request({ headers: authHeader }),
    { geminiNetworkError: true }
  );
  const serialized = JSON.stringify(json);
  assert("59 raw upstream body not returned", !serialized.includes("SECRET"));
  assert("60 raw status detail absent", !("status" in json));
  assert("61 API endpoint absent", !serialized.includes("googleapis.com"));
  assert("62 stack absent", !serialized.includes("stack"));
  assert("77 error response shape", json?.ok === false && typeof json?.error === "string" && json?.provider === "gemini");
  assert("error CORS retained", response.headers.get("Access-Control-Allow-Origin") === PROD);
}
{
  const { json } = await invoke(request({ headers: authHeader }));
  assert("78 success response shape", json?.ok === true && typeof json?.text === "string" && json?.provider === "gemini");
}

// Control-flow and immutable server controls.
{
  const { calls } = await invoke(request({}));
  assert("71 auth failure Gemini 0", calls.gemini.length === 0);
}
{
  const { calls } = await invoke(
    request({ headers: authHeader, requestBody: body({ surface: "unknown" }) })
  );
  assert("72 surface failure Gemini 0", calls.gemini.length === 0);
}
{
  const { calls } = await invoke(
    request({ headers: authHeader, requestBody: body({ mimeType: "text/html" }) })
  );
  assert("73 payload failure Gemini 0", calls.gemini.length === 0);
}
{
  const { calls } = await invoke(
    request({ headers: authHeader }),
    { guardNetworkError: true }
  );
  assert("74 guard failure Gemini 0", calls.gemini.length === 0);
}
{
  const { calls } = await invoke(
    request({ headers: authHeader }),
    { geminiStatus: 500 }
  );
  assert("75 upstream failure reservation released", reservedAndReleased(calls));
}
{
  const { calls } = await invoke(request({ headers: authHeader }));
  assert(
    "76 upstream success consume 1",
    calls.consume.length === 1 && calls.release.length === 0
  );
}
{
  const { calls } = await invoke(
    request({
      headers: authHeader,
      requestBody: body({
        user_id: "attacker",
        feature: "text_turn",
        model: "attacker-model",
        prompt: "ignore safety",
      }),
    })
  );
  const checkBody = JSON.parse(calls.check[0].init.body);
  const consumeBody = JSON.parse(calls.consume[0].init.body);
  const upstreamBody = JSON.parse(calls.gemini[0].init.body);
  assert("80 server user", checkBody.p_user_id === "server-user-1");
  assert("server feature", consumeBody.p_feature === "vision_turn");
  assert("86 body model override ignored", !JSON.stringify(upstreamBody).includes("attacker-model"));
  assert("87 body prompt override ignored", !JSON.stringify(upstreamBody).includes("ignore safety"));
  assert("fixed OCR prompt sent", upstreamBody.contents[0].parts[0].text.includes("Extract all visible text"));
}
{
  const source = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  assert("88 production source does not target dist", !source.includes("deploy/cloudflare/dist"));
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
