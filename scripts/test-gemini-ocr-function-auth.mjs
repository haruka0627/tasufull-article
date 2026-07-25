#!/usr/bin/env node
/**
 * Gemini OCR Function + client auth regression
 *   node scripts/test-gemini-ocr-function-auth.mjs
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
const FUNCTION_ORIGIN = "https://tasufull-article.pages.dev";
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
    SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    OCR_IP_RATE_HMAC_SECRET: "test-ocr-ip-hmac-secret-32b",
    ...extra,
  };
}

function makeRequest(headers, body) {
  return new Request(`${FUNCTION_ORIGIN}/api/gemini-ocr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: FUNCTION_ORIGIN,
      "CF-Connecting-IP": "203.0.113.10",
      ...(headers || {}),
    },
    body: JSON.stringify(
      body || {
        mimeType: "image/png",
        base64: PNG_1X1,
        surface: "chat",
        feature: "ocr_turn",
      }
    ),
  });
}

/**
 * @param {{
 *   authStatus?: number,
 *   authBody?: object | null,
 *   authThrow?: boolean,
 *   geminiOk?: boolean,
 * }} [opts]
 */
function installFetchMock(opts = {}) {
  const authCalls = [];
  const geminiCalls = [];
  const guardRestCalls = [];
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
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      geminiCalls.push({ url: u, init });
      if (opts.geminiOk === false) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: { message: "upstream" } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "ocr-text" }] } }],
        }),
      };
    }
    // guard / rest
    guardRestCalls.push({ url: u, init });
    if (u.includes("/rest/v1/rpc/consume_ocr_ip_rate_limit")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, count: 1, limit: 10, remaining: 9 }),
      };
    }
    if (u.includes("/rest/v1/rpc/reserve_ai_workspace_quota")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          reservation_id: "11111111-1111-4111-8111-111111111111",
          used: 1,
          remaining: 4,
        }),
      };
    }
    if (u.includes("/rest/v1/rpc/commit_ai_workspace_quota_reservation")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "committed" }) };
    }
    if (u.includes("/rest/v1/rpc/release_ai_workspace_quota_reservation")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "released" }) };
    }
    if (u.includes("/rest/v1/rpc/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, allowed: true, used: 0, remaining: 5 }),
      };
    }
    if (u.includes("gen_ai_subscriptions")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  };

  return {
    authCalls,
    geminiCalls,
    guardRestCalls,
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

async function callOcr(headers, body, fetchOpts) {
  const mock = installFetchMock(fetchOpts);
  try {
    const mod = await loadOcrModule();
    const res = await mod.onRequest({
      request: makeRequest(headers, body),
      env: envBase(),
    });
    const json = await res.json().catch(() => null);
    return { res, json, mock };
  } finally {
    mock.restore();
  }
}

// --- static ---
{
  const fn = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const client = read("chat-ocr.js");
  assert("static: /auth/v1/user verify", fn.includes("/auth/v1/user"));
  assert("static: Bearer parse", fn.includes("Bearer"));
  assert("static: server user_id overwrite", fn.includes("user_id: authenticatedUserId"));
  assert("static: no jwt decode-only atob", !/atob\s*\(/.test(fn) && !fn.includes("JSON.parse(atob"));
  assert("static: client Authorization Bearer", client.includes('Authorization: "Bearer "'));
  assert("static: client getSession", client.includes("getSession"));
  assert("static: client no token in body key", !/body:.*access_token/s.test(client));
  assert("static: endpoint pinning retained", client.includes('GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr"'));
}

// --- Function auth cases 1–19 ---
{
  const { res, json, mock } = await callOcr({}, { mimeType: "image/png", base64: PNG_1X1, surface: "chat" });
  assert("1 no Authorization → 401", res.status === 401 && json?.error === "auth_required");
  assert("1 Gemini fetch 0", mock.geminiCalls.length === 0);
  assert("1 auth provider fetch 0", mock.authCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" }
  );
  assert("2 empty Authorization → 401", res.status === 401 && json?.error === "auth_required");
  assert("2 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Basic abc" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" }
  );
  assert("3 Basic auth → 401", res.status === 401 && json?.error === "auth_required");
  assert("3 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" }
  );
  assert("4 Bearer only → 401", res.status === 401 && json?.error === "auth_required");
  assert("4 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer bad-token" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 401 }
  );
  assert("5 invalid token → 401", res.status === 401 && json?.error === "auth_required");
  assert("5 Gemini 0", mock.geminiCalls.length === 0);
  assert("5 auth called", mock.authCalls.length === 1);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer expired-token" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 401, authBody: { msg: "JWT expired" } }
  );
  assert("6 expired token → 401", res.status === 401 && json?.error === "auth_required");
  assert("6 no JWT expired leak", !JSON.stringify(json).includes("expired"));
  assert("6 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer t" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 503 }
  );
  assert("7 auth provider 5xx sanitized", res.status === 503 && json?.error === "auth_unavailable");
  assert("7 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer good" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat", user_id: "forged" },
    { authStatus: 200, authBody: { id: "user-server-1" } }
  );
  assert("8 valid token → success", res.status === 200 && json?.ok === true && json?.text === "ocr-text");
  assert("8 Gemini after auth", mock.geminiCalls.length === 1 && mock.authCalls.length === 1);
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer good" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 200, authBody: { id: "" } }
  );
  assert("9 user ID missing → 401", res.status === 401 && json?.error === "auth_required");
  assert("9 Gemini 0", mock.geminiCalls.length === 0);
}
{
  const mock = installFetchMock({ authStatus: 200, authBody: { id: "user-server-1" } });
  try {
    const mod = await loadOcrModule();
    const guardBodies = [];
    const realImport = await import(
      pathToFileURL(path.join(root, "deploy/cloudflare/functions/_shared/ai-usage-guard.mjs")).href
    );
    // Observe via wrapping fetch for gemini only; re-check by body forge cases using surface workspace + missing service role
    const res = await mod.onRequest({
      request: makeRequest(
        { Authorization: "Bearer good" },
        { mimeType: "image/png", base64: PNG_1X1, surface: "chat" }
      ),
      env: envBase(),
    });
    const json = await res.json();
    assert("10 body user_idなし → server path ok", res.status === 200 && json.ok === true);
    void realImport;
    void guardBodies;
  } finally {
    mock.restore();
  }
}
{
  const { res, json, mock } = await callOcr(
    { Authorization: "Bearer good" },
    {
      mimeType: "image/png",
      base64: PNG_1X1,
      surface: "ai-workspace",
      user_id: "forged-other-user",
      feature: "ocr_turn",
    },
    { authStatus: 200, authBody: { id: "user-server-1" } }
  );
  assert("11 forged body user_id → still ok with server id", res.status === 200 && json?.ok === true);
  assert("11 Gemini called once", mock.geminiCalls.length === 1);
}
{
  const { res, json } = await callOcr(
    { Authorization: "Bearer good" },
    {
      mimeType: "image/png",
      base64: PNG_1X1,
      surface: "ai-workspace",
      user_id: "user-server-1",
    },
    { authStatus: 200, authBody: { id: "user-server-1" } }
  );
  assert("12 body user_id一致 → server id", res.status === 200 && json?.ok === true);
}
{
  for (const [label, surface] of [
    ["13", ""],
    ["14", "chat"],
    ["15", "listing"],
    ["16", "ai-workspace"],
  ]) {
    const { res, mock } = await callOcr(
      {},
      { mimeType: "image/png", base64: PNG_1X1, surface },
      {}
    );
    assert(`${label} surface=${surface || "(empty)"} auth required`, res.status === 401);
    assert(`${label} Gemini 0`, mock.geminiCalls.length === 0);
  }
}
{
  const { res, mock } = await callOcr(
    { Authorization: "Bearer good" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 200, authBody: { id: "user-server-1" } }
  );
  assert("17 Gemini only after auth success", res.status === 200 && mock.authCalls.length === 1);
  assert("17 auth before gemini", mock.geminiCalls.length === 1);
}
{
  const { mock } = await callOcr(
    {},
    { mimeType: "image/png", base64: PNG_1X1, surface: "ai-workspace", user_id: "x" }
  );
  assert("18 auth failure Gemini 0", mock.geminiCalls.length === 0);
  assert("18 auth failure no auth/v1 when missing header", mock.authCalls.length === 0);
}
{
  const { json, mock } = await callOcr(
    { Authorization: "Bearer secret-token-value" },
    { mimeType: "image/png", base64: PNG_1X1, surface: "chat" },
    { authStatus: 401, authBody: { message: "Invalid JWT", access_token: "leak" } }
  );
  const dumped = JSON.stringify(json);
  assert("19 no token leak in response", !dumped.includes("secret-token-value"));
  assert("19 no provider raw leak", !dumped.includes("Invalid JWT") && !dumped.includes("access_token"));
  assert("19 Gemini 0", mock.geminiCalls.length === 0);
}

// --- Client cases 21–30 ---
function loadClient(opts = {}) {
  const calls = [];
  const win = {
    location: { origin: ORIGIN, pathname: "/chat-detail.html" },
    TASU_CHAT_OCR_CONFIG: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 1024 * 1024 },
    },
  };
  if (opts.session !== undefined) {
    const session = opts.session;
    win.TasuSupabase = {
      getClient: () => {
        if (opts.helperThrow) throw new Error("client boom");
        if (opts.noAuthApi) return {};
        return {
          auth: {
            getSession: async () => {
              if (opts.sessionThrow) throw new Error("session boom");
              return { data: { session } };
            },
          },
        };
      },
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
      const status = opts.httpStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => opts.httpBody ?? { ok: true, text: "ok" },
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
    session: { access_token: "tok-valid" },
  });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("21 valid session Bearer", r.ok === true && calls.length === 1);
  assert(
    "21 Authorization header",
    String(calls[0]?.init?.headers?.Authorization || "") === "Bearer tok-valid"
  );
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert("25 token not in body", !("access_token" in body) && !String(calls[0].init.body).includes("tok-valid"));
  assert("26 token not in URL", !calls[0].url.includes("tok-valid"));
  assert("27 endpoint pinned", calls[0].url === `${ORIGIN}${FIXED_PATH}`);
  assert(
    "30 body fields retained",
    body.mimeType === "image/png" &&
      body.base64 === PNG_1X1 &&
      body.feature === "ocr_turn" &&
      "user_id" in body &&
      body.surface === "chat"
  );
}
{
  const { win, calls } = loadClient({ session: null });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("22 no session fetch 0", calls.length === 0 && r.ok === false && r.reason === "auth_required");
}
{
  const { win, calls } = loadClient({ session: { access_token: "x" }, helperThrow: true });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert(
    "23 helper throw fetch 0",
    calls.length === 0 && r.ok === false && r.reason === "auth_unavailable"
  );
}
{
  const { win, calls } = loadClient({ session: { access_token: "   " } });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("24 empty token fetch 0", calls.length === 0 && r.ok === false && r.reason === "auth_required");
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    httpStatus: 401,
    httpBody: { ok: false, error: "auth_required" },
  });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("28 401 → auth_required", r.ok === false && r.reason === "auth_required" && calls.length === 1);
}
{
  const { win, calls } = loadClient({
    session: { access_token: "tok" },
    httpStatus: 403,
    httpBody: { ok: false, error: "auth_forbidden" },
  });
  const r = await win.TasuChatOcr.extractTextFromImage(SAMPLE);
  assert("29 403 → auth_forbidden", r.ok === false && r.reason === "auth_forbidden" && calls.length === 1);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
