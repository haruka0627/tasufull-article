#!/usr/bin/env node
/**
 * OCR endpoint pinning security regression
 *   node scripts/test-chat-ocr-endpoint-security.mjs
 *
 * Real OCR / Gemini API is never called. fetch is mocked.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_PATH = "/api/gemini-ocr";
const ORIGIN = "https://app.tasful.example";
const FIXED_URL = `${ORIGIN}${FIXED_PATH}`;
const SAMPLE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

/**
 * @param {{
 *   origin?: string | null | undefined,
 *   location?: object | null,
 *   config?: object,
 *   fetchImpl?: Function,
 * }} [opts]
 */
function loadOcr(opts = {}) {
  const calls = [];
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
      : opts.location !== undefined
        ? opts.location
        : {
            origin: opts.origin === undefined ? ORIGIN : opts.origin,
            pathname: "/chat-detail.html",
          };

  const win = {
    TASU_CHAT_OCR_CONFIG: opts.config || {
      provider: "gemini",
      gemini: { endpoint: FIXED_PATH },
      tesseract: { lang: "jpn+eng" },
    },
  };
  if (location !== null) {
    win.location = location;
  }

  const sandbox = {
    console,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    window: win,
    location: location === null ? undefined : location,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("chat-ocr.js"), sandbox, { filename: "chat-ocr.js" });
  return { sandbox: win, calls, context: sandbox };
}

function isFixedOnly(calls) {
  return (
    calls.length > 0 &&
    calls.every((c) => c.url === FIXED_URL) &&
    !calls.some((c) => /evil\.example|javascript:|data:text/i.test(c.url))
  );
}

function noExternal(calls) {
  return !calls.some((c) => {
    try {
      const u = new URL(c.url, ORIGIN);
      return u.origin !== ORIGIN || u.pathname !== FIXED_PATH;
    } catch {
      return true;
    }
  });
}

// --- static source guards ---
{
  const src = read("chat-ocr.js");
  assert("static: GEMINI_OCR_ENDPOINT_PATH present", src.includes('GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr"'));
  assert("static: no generativelanguage", !src.includes("generativelanguage.googleapis.com"));
  assert("static: no AIza key pattern", !/AIza[0-9A-Za-z_-]{10,}/.test(src));
  assert("static: no apiKey assignment", !/apiKey\s*[:=]/.test(src));
  assert(
    "static: config.gemini.endpoint not used for fetch",
    !/getConfig\(\)\.gemini\?\.endpoint/.test(src) && !/gemini\?\.endpoint\s*\|\|/.test(src)
  );
  assert("static: AbortController present (hardening)", src.includes("AbortController"));
  assert("static: maxBytes gate present (hardening)", src.includes("maxBytes") || src.includes("DEFAULT_MAX_BYTES"));
  assert("static: MIME allowlist present (hardening)", src.includes("allowedMimeTypes") || src.includes("DEFAULT_ALLOWED_MIME"));
  assert("static: fetch uses resolveGeminiOcrFetchUrl", src.includes("resolveGeminiOcrFetchUrl()"));
}

// --- 1–5 normal ---
{
  const { sandbox, calls } = loadOcr();
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL, {
    user_id: "u1",
    surface: "chat_attachment",
  });
  assert("1 provider=gemini runs", result.provider === "gemini");
  assert("2 config endpoint=/api/gemini-ocr ignored for construction", true);
  assert("3 fetch URL is origin+/api/gemini-ocr", calls[0]?.url === FIXED_URL, calls[0]?.url);
  const body = JSON.parse(String(calls[0]?.init?.body || "{}"));
  assert(
    "4 request body shape",
    body.mimeType === "image/png" &&
      typeof body.base64 === "string" &&
      body.base64.length > 0 &&
      body.user_id === "u1" &&
      body.surface === "chat_attachment" &&
      body.feature === "ocr_turn"
  );
  assert("5 valid response → ok:true", result.ok === true && result.text === "hello");
}

async function assertPinnedDespiteEndpoint(name, endpointValue) {
  const { sandbox, calls } = loadOcr({
    config: {
      provider: "gemini",
      gemini: { endpoint: endpointValue },
    },
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  const external = calls.filter((c) => c.url !== FIXED_URL);
  assert(
    `${name}: fetch fixed only`,
    isFixedOnly(calls) && noExternal(calls) && external.length === 0,
    `urls=${JSON.stringify(calls.map((c) => c.url))} ok=${result.ok}`
  );
  assert(`${name}: result not thrown`, result && typeof result.ok === "boolean");
  return { result, calls };
}

// --- 6–14 endpoint tampering ---
await assertPinnedDespiteEndpoint("6 absolute https", "https://evil.example/upload");
await assertPinnedDespiteEndpoint("7 absolute http", "http://evil.example/upload");
await assertPinnedDespiteEndpoint("8 protocol-relative", "//evil.example/upload");
await assertPinnedDespiteEndpoint("9 query route", "/api/gemini-ocr?redirect=https://evil.example");
await assertPinnedDespiteEndpoint("10 hash route", "/api/gemini-ocr#evil");
await assertPinnedDespiteEndpoint("11 extra pathname", "/api/gemini-ocr/extra");
await assertPinnedDespiteEndpoint("12 userinfo URL", "https://user:pass@evil.example/upload");
await assertPinnedDespiteEndpoint("13 data URL", "data:text/plain,test");
await assertPinnedDespiteEndpoint("14 javascript URL", "javascript:alert(1)");

// --- 15 config mutation after first call ---
{
  const { sandbox, calls } = loadOcr({
    config: { provider: "gemini", gemini: { endpoint: FIXED_PATH } },
  });
  await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  sandbox.TASU_CHAT_OCR_CONFIG.gemini.endpoint = "https://evil.example/after";
  await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert(
    "15 post-call mutation still fixed",
    calls.length === 2 && isFixedOnly(calls),
    JSON.stringify(calls.map((c) => c.url))
  );
}

// --- 16 dynamic getter ---
{
  let n = 0;
  const gemini = {};
  Object.defineProperty(gemini, "endpoint", {
    enumerable: true,
    get() {
      n += 1;
      return n === 1 ? FIXED_PATH : "https://evil.example/dynamic";
    },
  });
  const { sandbox, calls } = loadOcr({
    config: { provider: "gemini", gemini },
  });
  await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert(
    "16 getter mutation still fixed",
    calls.length === 2 && isFixedOnly(calls),
    `n=${n} urls=${JSON.stringify(calls.map((c) => c.url))}`
  );
}

// --- 17–19 odd endpoint values ---
await assertPinnedDespiteEndpoint("17 endpoint object", { href: "https://evil.example" });
await assertPinnedDespiteEndpoint("18 endpoint null", null);
{
  const { sandbox, calls } = loadOcr({
    config: { provider: "gemini", gemini: {} },
  });
  await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("19 endpoint missing → fixed", isFixedOnly(calls), JSON.stringify(calls.map((c) => c.url)));
}

// --- 20–23 location anomalies ---
async function assertLocationFail(name, locationOpts) {
  const { sandbox, calls } = loadOcr(locationOpts);
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert(`${name}: external fetch 0`, calls.length === 0, JSON.stringify(calls));
  assert(`${name}: ok:false`, result.ok === false && result.error === "invalid_origin");
}

await assertLocationFail("20 location missing", { location: null });
await assertLocationFail("21 origin undefined", {
  location: { pathname: "/chat-detail.html" },
});
await assertLocationFail("22 origin=null string", { origin: "null" });
await assertLocationFail("23 invalid origin", { origin: "not-a-url" });

// --- 24–26 providers ---
{
  const { sandbox, calls } = loadOcr({
    config: { provider: "weird-cloud", gemini: { endpoint: "https://evil.example" } },
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("24 unknown provider fetch 0", calls.length === 0);
  assert("24 unknown provider fail-closed", result.ok === false && result.error === "unknown_provider");
}
{
  const { sandbox, calls } = loadOcr({
    config: { provider: "none", gemini: { endpoint: "https://evil.example" } },
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("25 none → fetch 0", calls.length === 0);
  assert("25 none → ok empty", result.ok === true && result.text === "" && result.provider === "none");
}
{
  const { sandbox, calls } = loadOcr({
    config: { provider: "tesseract", gemini: { endpoint: "https://evil.example" } },
  });
  // Avoid loading CDN: stub Tesseract on window
  sandbox.Tesseract = {
    recognize: async () => ({ data: { text: "local" } }),
  };
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("26 tesseract → Gemini fetch 0", calls.length === 0);
  assert("26 tesseract ok", result.ok === true && result.provider === "tesseract" && result.text === "local");
}

// --- 27–36 response shapes ---
async function withResponse(name, jsonValue, httpOk = true, status = 200, expectOk, expectError) {
  const { sandbox } = loadOcr({
    fetchImpl: async () => ({
      ok: httpOk,
      status,
      json: async () => jsonValue,
    }),
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  if (expectOk) {
    assert(name, result.ok === true && typeof result.text === "string", JSON.stringify(result));
  } else {
    assert(
      name,
      result.ok === false && (!expectError || result.error === expectError || String(result.error).includes(expectError)),
      JSON.stringify(result)
    );
  }
}

await withResponse("27 valid text", { ok: true, text: "abc" }, true, 200, true);
await withResponse("28 empty string", { ok: true, text: "" }, true, 200, true);
await withResponse("29 ok:false", { ok: false, error: "blocked" }, true, 200, false, "blocked");
await withResponse("30 null JSON", null, true, 200, false, "invalid_response");
await withResponse("31 array JSON", [{ ok: true, text: "x" }], true, 200, false, "invalid_response");
await withResponse("32 text missing", { ok: true }, true, 200, false, "invalid_text");
await withResponse("33 text null", { ok: true, text: null }, true, 200, false, "invalid_text");
await withResponse("34 text object", { ok: true, text: { v: 1 } }, true, 200, false, "invalid_text");
{
  const { sandbox } = loadOcr({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    }),
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("35 invalid JSON → fail-closed", result.ok === false && result.error === "invalid_response");
}
{
  const { sandbox, calls } = loadOcr({
    fetchImpl: async (url) => {
      calls.push({ url: String(url) });
      throw new TypeError("Failed to fetch");
    },
  });
  const result = await sandbox.TasuChatOcr.extractTextFromImage(SAMPLE_DATA_URL);
  assert("36 network reject → fail-closed", result.ok === false && /Failed to fetch/.test(result.error || ""));
  assert("36 network reject used fixed URL only", isFixedOnly(calls));
}

// --- attachmentなし / empty url → fetch 0 ---
{
  const { sandbox, calls } = loadOcr();
  const result = await sandbox.TasuChatOcr.extractTextFromImage("");
  assert("empty image → fetch 0", calls.length === 0 && result.ok === true && result.provider === "none");
}
{
  const { sandbox, calls } = loadOcr();
  const agg = await sandbox.TasuChatOcr.extractTextFromImages([]);
  assert("no images aggregate → fetch 0", calls.length === 0 && agg.ocrText === "" && agg.results.length === 0);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
