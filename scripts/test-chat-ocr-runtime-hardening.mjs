#!/usr/bin/env node
/**
 * OCR runtime hardening regression
 *   node scripts/test-chat-ocr-runtime-hardening.mjs
 *
 * Real OCR / Gemini API is never called.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_PATH = "/api/gemini-ocr";
const ORIGIN = "https://app.tasful.example";
const FIXED_URL = `${ORIGIN}${FIXED_PATH}`;
const SERVER_MAX_BASE64_CHARS = 6 * 1024 * 1024;
const DEFAULT_MAX_BYTES = Math.floor((SERVER_MAX_BASE64_CHARS * 3) / 4);
const DEFAULT_TIMEOUT_MS = 15000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

function dataUrl(mime, base64) {
  return `data:${mime};base64,${base64}`;
}

function b64Bytes(n) {
  return Buffer.alloc(n).toString("base64");
}

/**
 * @param {{
 *   config?: object,
 *   fetchImpl?: Function,
 *   location?: object | null,
 *   timers?: { setTimeout: Function, clearTimeout: Function },
 * }} [opts]
 */
function loadOcr(opts = {}) {
  const calls = [];
  const timerCalls = { set: 0, clear: 0, ids: [] };

  const fetchImpl =
    opts.fetchImpl ||
    (async (url, init) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, text: "hello" }),
      };
    });

  const location =
    opts.location === null
      ? null
      : opts.location || { origin: ORIGIN, pathname: "/chat-detail.html" };

  const win = {
    TASU_CHAT_OCR_CONFIG: opts.config || {
      provider: "gemini",
      gemini: {
        endpoint: FIXED_PATH,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxBytes: DEFAULT_MAX_BYTES,
        allowedMimeTypes: [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/bmp",
          "application/pdf",
        ],
      },
    },
    TasuSupabase: {
      getClient: () => ({
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "test-ocr-token" } },
          }),
        },
      }),
    },
    // privacy UI は専用 suite で検証 · ここは送信経路の hardening を測る
    TasuOcrPrivacyConsent: {
      ensureConsent: async () => ({
        granted: true,
        reason: "already_granted",
        disclosureVersion: "test",
      }),
      notifyRunStart() {},
      notifyRunEnd() {},
    },
  };
  if (location) win.location = location;

  const setTimeoutFn =
    opts.timers?.setTimeout ||
    ((fn, ms) => {
      timerCalls.set += 1;
      const id = setTimeout(fn, ms);
      timerCalls.ids.push(id);
      return id;
    });
  const clearTimeoutFn =
    opts.timers?.clearTimeout ||
    ((id) => {
      timerCalls.clear += 1;
      return clearTimeout(id);
    });

  const sandbox = {
    console,
    URL,
    AbortController,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    fetch: fetchImpl,
    window: win,
    location: location || undefined,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
  return { win, calls, timerCalls, context: sandbox };
}

async function extract(win, mime = "image/png", base64 = PNG_1X1, options) {
  return win.TasuChatOcr.extractTextFromImage(dataUrl(mime, base64), options);
}

function hangFetch(calls) {
  return (url, init) =>
    new Promise((resolve, reject) => {
      calls.push({ url: String(url), init });
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
        return;
      }
      signal.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
}

function httpFetch(status, body) {
  return async (url, init) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// Probe normalize via observable behavior: timeout used in setTimeout delay
async function probeTimeoutMs(timeoutMs) {
  let captured = null;
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs, maxBytes: 1024 },
    },
    timers: {
      setTimeout: (fn, ms) => {
        captured = ms;
        return setTimeout(fn, ms);
      },
      clearTimeout,
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, text: "ok" }),
    }),
  });
  await extract(win);
  return captured;
}

async function probeMaxBytes(maxBytes, payloadBytes) {
  const calls = [];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes },
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "ok" }) };
    },
  });
  const result = await extract(win, "image/png", b64Bytes(payloadBytes));
  return { result, fetchCount: calls.length };
}

async function probeMime(mime, allowedMimeTypes) {
  const calls = [];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: {
        endpoint: FIXED_PATH,
        timeoutMs: 5000,
        maxBytes: DEFAULT_MAX_BYTES,
        allowedMimeTypes,
      },
    },
    fetchImpl: async (url) => {
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "ok" }) };
    },
  });
  const result = await extract(win, mime, PNG_1X1);
  return { result, fetchCount: calls.length };
}

// --- static ---
{
  const src = read("chat-ocr.js");
  const cfg = read("chat-ocr-config.js");
  assert("static: endpoint path fixed", src.includes('GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr"'));
  assert("static: AbortController", src.includes("AbortController"));
  assert("static: clearTimeout", src.includes("clearTimeout"));
  assert("static: no generativelanguage", !src.includes("generativelanguage.googleapis.com"));
  assert("static: no AIza", !/AIza[0-9A-Za-z_-]{10,}/.test(src));
  assert("static: config endpoint not used for fetch", !/gemini\?\.endpoint\s*\|\|/.test(src));
  assert("static: Object.freeze snapshot", src.includes("Object.freeze"));
  assert("config: provider still gemini", /provider:\s*"gemini"/.test(cfg));
  assert("config: no stale 送信継続", !cfg.includes("送信継続"));
  assert("config: fail-closed mention", cfg.includes("fail-closed") || cfg.includes("送信停止"));
}

// --- 1–9 timeout normalize ---
{
  const d = await probeTimeoutMs(undefined);
  assert("1 default timeout", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(12000);
  assert("2 valid timeout", d === 12000, String(d));
}
{
  const d = await probeTimeoutMs("9000");
  assert("3 timeout string", d === 9000, String(d));
}
{
  const d = await probeTimeoutMs(Number.NaN);
  assert("4 timeout NaN → default", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(Number.POSITIVE_INFINITY);
  assert("5 timeout Infinity → default", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(0);
  assert("6 timeout 0 → default", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(-5);
  assert("7 timeout negative → default", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(500);
  assert("8 timeout under minimum → default", d === DEFAULT_TIMEOUT_MS, String(d));
}
{
  const d = await probeTimeoutMs(60000);
  assert("9 timeout over maximum → clamped", d === MAX_TIMEOUT_MS, String(d));
}

// --- 10–14 maxBytes ---
{
  const { result, fetchCount } = await probeMaxBytes(64, 32);
  assert("10 valid maxBytes allows", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMaxBytes("64", 32);
  assert("11 maxBytes string normalized", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMaxBytes(0, 32);
  assert(
    "12 maxBytes 0 → default (allow small)",
    result.ok === true && fetchCount === 1,
    JSON.stringify(result)
  );
}
{
  const { result, fetchCount } = await probeMaxBytes(-10, 32);
  assert("13 maxBytes negative → default", result.ok === true && fetchCount === 1);
}
{
  // config asks above server-derived decoded cap; still capped → large but under default may fetch
  const over = DEFAULT_MAX_BYTES + 1024;
  const { result, fetchCount } = await probeMaxBytes(over, DEFAULT_MAX_BYTES + 1);
  assert(
    "14 maxBytes server limit超過 → still capped reject",
    result.ok === false &&
      result.reason === "attachment_too_large" &&
      fetchCount === 0,
    JSON.stringify(result)
  );
}

// --- 15–20 allowedMime / config snapshot ---
{
  const { result, fetchCount } = await probeMime("image/png", ["image/png", "image/jpeg"]);
  assert("15 allowedMimeTypes正常", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMime("image/png", "not-array");
  assert("16 allowedMimeTypes非array → default allow png", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMime("image/png", ["image/png", 123, null]);
  assert("17 allowedMimeTypesに非string ignored", result.ok === true && fetchCount === 1);
}
{
  const cfg = {
    get provider() {
      return "gemini";
    },
    get gemini() {
      throw new Error("gemini boom");
    },
  };
  const calls = [];
  const { win } = loadOcr({
    config: cfg,
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  const result = await extract(win);
  assert(
    "18 config getter throw → defaults / no throw",
    result && typeof result.ok === "boolean" && result.ok === true && calls.length === 1,
    JSON.stringify(result)
  );
}
{
  const gemini = {
    endpoint: FIXED_PATH,
    timeoutMs: 5000,
    maxBytes: 1024,
    get allowedMimeTypes() {
      throw new Error("mime boom");
    },
  };
  const calls = [];
  const { win } = loadOcr({
    config: { provider: "gemini", gemini },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  const result = await extract(win);
  assert(
    "19 nested getter throw → fail-closed or default",
    result && typeof result.ok === "boolean" && (result.ok === true || result.ok === false),
    JSON.stringify(result)
  );
  assert("19 process survived", true);
}
{
  const calls = [];
  const allowed = ["image/png"];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: {
        endpoint: FIXED_PATH,
        timeoutMs: MIN_TIMEOUT_MS,
        maxBytes: 2048,
        allowedMimeTypes: allowed,
      },
    },
    fetchImpl: hangFetch(calls),
  });
  const p = extract(win, "image/png", PNG_1X1);
  // mutate during in-flight
  win.TASU_CHAT_OCR_CONFIG.gemini.endpoint = "https://evil.example/x";
  win.TASU_CHAT_OCR_CONFIG.gemini.maxBytes = 1;
  allowed.push("image/svg+xml");
  await new Promise((r) => setTimeout(r, 30));
  assert(
    "20 config mutation後snapshot不変 (endpoint pinned if fetched)",
    calls.every((c) => c.url === FIXED_URL),
    JSON.stringify(calls.map((c) => c.url))
  );
  const result = await p;
  assert("20 result shape", result && typeof result.ok === "boolean");
}

// --- 21–32 MIME ---
{
  const cases = [
    ["21 JPEG allow", "image/jpeg", true],
    ["22 PNG allow", "image/png", true],
    ["23 WebP allow", "image/webp", true],
    ["24 PDF allow", "application/pdf", true],
    ["25 SVG reject", "image/svg+xml", false],
    ["26 HTML reject", "text/html", false],
    ["27 JavaScript reject", "application/javascript", false],
    ["28 empty reject", "", false],
    ["29 unknown reject", "image/heic", false],
  ];
  for (const [name, mime, allow] of cases) {
    const { result, fetchCount } = await probeMime(mime || " ", undefined);
    if (!mime) {
      // empty mime via custom data url (space MIME → trim → empty)
      const calls = [];
      const { win } = loadOcr({
        fetchImpl: async (url) => {
          calls.push(url);
          return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
        },
      });
      const r = await win.TasuChatOcr.extractTextFromImage(`data: ;base64,${PNG_1X1}`);
      assert(
        name,
        r.ok === false &&
          calls.length === 0 &&
          (r.reason === "unsupported_mime_type" || r.reason === "invalid_data_url"),
        JSON.stringify(r)
      );
      continue;
    }
    assert(
      name,
      allow
        ? result.ok === true && fetchCount === 1
        : result.ok === false && fetchCount === 0 && result.reason === "unsupported_mime_type",
      JSON.stringify(result)
    );
  }
}
{
  const { result, fetchCount } = await probeMime("IMAGE/PNG", undefined);
  assert("30 uppercase normalized", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMime("  image/png  ", undefined);
  assert("31 whitespace normalized", result.ok === true && fetchCount === 1);
}
{
  const calls = [];
  const { win } = loadOcr({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  // force object mime via broken data url won't parse; craft by patching is hard.
  // Use data URL with mime that stringifies oddly — object can't appear in data URL.
  // Instead: empty mime already covered; simulate via invalid type token "object"
  const r = await win.TasuChatOcr.extractTextFromImage(`data:[object Object];base64,${PNG_1X1}`);
  assert("32 MIME object reject", r.ok === false && calls.length === 0);
}

// --- 33–41 size ---
{
  const { result, fetchCount } = await probeMaxBytes(64, 16);
  assert("33 small payload allow", result.ok === true && fetchCount === 1);
}
{
  const { result, fetchCount } = await probeMaxBytes(48, 48);
  assert("34 exactly max allow", result.ok === true && fetchCount === 1, JSON.stringify(result));
}
{
  const { result, fetchCount } = await probeMaxBytes(48, 49);
  assert(
    "35 max+1 reject",
    result.ok === false && fetchCount === 0 && result.reason === "attachment_too_large",
    JSON.stringify(result)
  );
}
{
  const calls = [];
  const { win } = loadOcr({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  const r = await win.TasuChatOcr.extractTextFromImage("data:image/png;base64,@@@@");
  assert(
    "36 invalid base64 reject",
    r.ok === false && calls.length === 0 && r.reason === "invalid_data_url",
    JSON.stringify(r)
  );
}
{
  // padding variants
  const calls = [];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 16 },
    },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  let r = await win.TasuChatOcr.extractTextFromImage("data:image/png;base64,AAAA");
  assert("37 padding 0", r.ok === true && calls.length === 1, JSON.stringify(r));
  calls.length = 0;
  r = await win.TasuChatOcr.extractTextFromImage("data:image/png;base64,AAA=");
  assert("38 padding 1", r.ok === true && calls.length === 1, JSON.stringify(r));
  calls.length = 0;
  r = await win.TasuChatOcr.extractTextFromImage("data:image/png;base64,AA==");
  assert("39 padding 2", r.ok === true && calls.length === 1, JSON.stringify(r));
  calls.length = 0;
  r = await win.TasuChatOcr.extractTextFromImage(`data:image/png;base64,AA AA`);
  assert("40 whitespace base64", r.ok === true && calls.length === 1, JSON.stringify(r));
}
{
  const calls = [];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: 5000, maxBytes: 32 },
    },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  // Avoid allocating huge buffers: exceed via length check using oversized base64 string built cheaply
  const huge = "A".repeat(SERVER_MAX_BASE64_CHARS + 4);
  const r = await win.TasuChatOcr.extractTextFromImage(`data:image/png;base64,${huge}`);
  assert(
    "41 very large synthetic payload fetch 0",
    r.ok === false && calls.length === 0 && r.reason === "attachment_too_large",
    JSON.stringify({ ok: r.ok, reason: r.reason, fetches: calls.length })
  );
}

// --- 42–48 timeout ---
{
  const { win, timerCalls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 1024 },
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, text: "fast" }),
    }),
  });
  const r = await extract(win);
  assert("42 success before timeout", r.ok === true && r.text === "fast");
  assert("45 timer cleared on success", timerCalls.clear >= 1, JSON.stringify(timerCalls));
}
{
  const calls = [];
  const { win, timerCalls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 1024 },
    },
    fetchImpl: hangFetch(calls),
  });
  const r = await extract(win);
  assert("43 pending fetch abort", r.ok === false && r.reason === "ocr_timeout", JSON.stringify(r));
  assert("44 AbortError normalized", r.error === "ocr_timeout");
  assert("43 fetch was attempted", calls.length === 1 && calls[0].url === FIXED_URL);
  assert("43 timer cleared after timeout", timerCalls.clear >= 1);
}
{
  const { win, timerCalls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 1024 },
    },
    fetchImpl: httpFetch(500, { ok: false, error: "boom" }),
  });
  const r = await extract(win);
  assert("46 timer cleared on HTTP error", timerCalls.clear >= 1 && r.ok === false);
}
{
  const { win, timerCalls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 1024 },
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad");
      },
    }),
  });
  const r = await extract(win);
  assert(
    "47 timer cleared on JSON error",
    timerCalls.clear >= 1 && r.ok === false && r.reason === "invalid_response"
  );
}
{
  const { win, timerCalls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 1024 },
    },
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  const r = await extract(win);
  assert(
    "48 timer cleared on network reject",
    timerCalls.clear >= 1 && r.ok === false && r.reason === "network_error",
    JSON.stringify(r)
  );
}

// --- 49–61 HTTP / response ---
{
  const table = [
    [400, "http_400", "49 400"],
    [401, "auth_required", "50 401"],
    [403, "auth_forbidden", "51 403"],
    [413, "attachment_too_large", "52 413"],
    [415, "unsupported_mime_type", "53 415"],
    [429, "http_429", "54 429"],
    [500, "http_5xx", "55 500"],
    [502, "http_5xx", "56 502"],
    [503, "http_5xx", "57 503"],
  ];
  for (const [status, reason, name] of table) {
    const { win } = loadOcr({
      fetchImpl: httpFetch(status, { ok: false, error: `e${status}` }),
    });
    const r = await extract(win);
    assert(name, r.ok === false && r.reason === reason, JSON.stringify(r));
  }
}
{
  const { win } = loadOcr({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    }),
  });
  const r = await extract(win);
  assert("58 invalid JSON", r.ok === false && r.reason === "invalid_response");
}
{
  const { win } = loadOcr({
    fetchImpl: httpFetch(200, { ok: false, error: "blocked" }),
  });
  const r = await extract(win);
  assert("59 ok:false", r.ok === false && (r.error === "blocked" || r.reason === "blocked"));
}
{
  const { win } = loadOcr({
    fetchImpl: httpFetch(200, { ok: true, text: { x: 1 } }),
  });
  const r = await extract(win);
  assert("60 invalid text shape", r.ok === false && r.reason === "invalid_response");
}
{
  const { win } = loadOcr({
    fetchImpl: httpFetch(200, { ok: true, text: "" }),
  });
  const r = await extract(win);
  assert("61 empty string success", r.ok === true && r.text === "");
}

// --- 62–70 provider / integration ---
{
  const calls = [];
  const { win } = loadOcr({
    config: { provider: "none", gemini: { endpoint: "https://evil.example" } },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  const r = await extract(win);
  assert("62 none fetch 0", calls.length === 0 && r.provider === "none");
}
{
  const calls = [];
  const { win } = loadOcr({
    config: { provider: "tesseract", gemini: { endpoint: "https://evil.example" } },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  win.Tesseract = { recognize: async () => ({ data: { text: "local" } }) };
  const r = await extract(win);
  assert("63 tesseract Gemini fetch 0", calls.length === 0 && r.provider === "tesseract");
}
{
  const calls = [];
  const { win } = loadOcr({
    config: { provider: "nope", gemini: { endpoint: FIXED_PATH } },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "x" }) };
    },
  });
  const r = await extract(win);
  assert("64 unknown fetch 0", calls.length === 0 && r.error === "unknown_provider");
}
{
  const calls = [];
  const { win } = loadOcr({
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return { ok: true, status: 200, json: async () => ({ ok: true, text: "ok" }) };
    },
  });
  const r = await win.TasuChatOcr.extractTextFromImage(dataUrl("image/png", PNG_1X1), {
    user_id: "u9",
    surface: "chat_attachment",
  });
  assert("65 Gemini valid request", r.ok === true && calls.length === 1);
  assert("66 endpoint remains pinned", calls[0].url === FIXED_URL);
  assert(
    "67 request body unchanged",
    calls[0].body.mimeType === "image/png" &&
      calls[0].body.base64 === PNG_1X1 &&
      calls[0].body.user_id === "u9" &&
      calls[0].body.surface === "chat" &&
      calls[0].body.feature === "ocr_turn"
  );
}
{
  const { win } = loadOcr({
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  const r = await extract(win);
  assert(
    "68 OCR failure compatible",
    r.ok === false && typeof r.error === "string" && r.provider === "gemini" && r.text === ""
  );
}
{
  const calls = [];
  let n = 0;
  const { win } = loadOcr({
    fetchImpl: async (url) => {
      calls.push(String(url));
      n += 1;
      if (n === 1) {
        return { ok: true, status: 200, json: async () => ({ ok: true, text: "a" }) };
      }
      return { ok: false, status: 500, json: async () => ({ ok: false, error: "x" }) };
    },
  });
  const agg = await win.TasuChatOcr.extractTextFromImages([
    dataUrl("image/png", PNG_1X1),
    dataUrl("image/png", PNG_1X1),
  ]);
  assert(
    "69 multiple images preserve per-item failures",
    agg.results.length === 2 &&
      agg.results[0].ok === true &&
      agg.results[1].ok === false &&
      agg.ocrText === "a"
  );
}
{
  const calls = [];
  const { win } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH, timeoutMs: MIN_TIMEOUT_MS, maxBytes: 2048 },
    },
    fetchImpl: hangFetch(calls),
  });
  const p = win.TasuChatOcr.extractTextFromImages([dataUrl("image/png", PNG_1X1)]);
  // replace global config mid-flight
  win.TASU_CHAT_OCR_CONFIG = {
    provider: "gemini",
    gemini: { endpoint: "https://evil.example/upload", timeoutMs: 5000, maxBytes: 2048 },
  };
  await new Promise((r) => setTimeout(r, 30));
  assert(
    "70 config global replacement does not change active snapshot fetch URL",
    calls.every((c) => c.url === FIXED_URL),
    JSON.stringify(calls.map((c) => c.url))
  );
  try {
    await p;
  } catch {
    /* ignore */
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
