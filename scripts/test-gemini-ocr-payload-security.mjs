#!/usr/bin/env node
/**
 * Gemini OCR payload security regression
 *   node scripts/test-gemini-ocr-payload-security.mjs
 *
 * Real Gemini / Supabase / DB are never called.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_URL = "https://ahlxuyvhzqdqaojiywmu.supabase.co";
const FUNCTION_ORIGIN = "https://tasufull-article.pages.dev";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG_MIN = "/9j/4AAQSkZJRgABAQAAAQABAAA=";
const GIF87 = "R0lGODdhAAAAAA==";
const GIF89 = "R0lGODlhAAAAAA==";
const WEBP_MIN = "UklGRgQAAABXRUJQ";
const BMP_MIN = "Qk0AAAAAAAAAAAAAAAA=";
const PDF_MIN = "JVBERi0xLjQ=";

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
  return new Request(`${FUNCTION_ORIGIN}/api/gemini-ocr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: FUNCTION_ORIGIN,
      ...(headers || {}),
    },
    body: JSON.stringify(body === undefined ? defaultBody() : body),
  });
}

function installFetchMock(opts = {}) {
  const authCalls = [];
  const geminiCalls = [];
  const checkCalls = [];
  const consumeCalls = [];
  const releaseCalls = [];
  const original = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      authCalls.push({ url: u, init });
      if (opts.authThrow) throw new TypeError("auth down");
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
        return { ok: false, status: 502, json: async () => ({ error: { message: "up" } }) };
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
      return { ok: true, status: 200, json: async () => opts.planRows ?? [] };
    }
    if (u.includes("/rest/v1/rpc/check_ai_workspace_quota")) {
      checkCalls.push({ url: u, init });
      if (opts.checkAllowed === false) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, allowed: false, used: 5 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, allowed: true, used: 0, remaining: 5 }),
      };
    }
    if (u.includes("/rest/v1/rpc/consume_ai_workspace_quota")) {
      consumeCalls.push({ url: u, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, used: 1 }) };
    }
    if (u.includes("/rest/v1/rpc/release_ai_workspace_quota")) {
      releaseCalls.push({ url: u, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, used: 0 }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  return {
    authCalls,
    geminiCalls,
    checkCalls,
    consumeCalls,
    releaseCalls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

async function loadOcr() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")
  ).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function loadVal() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-payload-validation.mjs")
  ).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function callOcr(headers, body, fetchOpts, envExtra) {
  const mock = installFetchMock(fetchOpts);
  try {
    const mod = await loadOcr();
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

const authH = { Authorization: "Bearer good" };

// --- static ---
{
  const fn = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const helper = read("deploy/cloudflare/functions/_shared/ocr-payload-validation.mjs");
  assert("83 model fixed", fn.includes("gemini-2.5-flash"));
  assert("83 prompt fixed", fn.includes("Extract all visible text"));
  assert("79 Bearer auth", fn.includes("/auth/v1/user"));
  assert("81 surface allowlist", fn.includes("normalizeOcrSurface"));
  assert("82 guard fail-closed import", fn.includes("enforceCfOcrGuard"));
  assert("static: validateOcrPayload before guard", /validateOcrPayload[\s\S]*enforceCfOcrGuard/.test(fn));
  assert("static: no empty mime jpeg fallback", !fn.includes('mimeType || "image/jpeg"'));
  assert("static: no payload console.log", !/console\.(log|info|debug)\([^)]*base64/.test(fn + helper));
  assert("85 no payload console", !helper.includes("console.log") && !fn.includes("console.log"));
  assert("static: magic PNG", helper.includes("0x89"));
  assert("static: magic PDF", helper.includes("0x25"));
  assert("static: magic WEBP", helper.includes("0x57"));
}

// --- unit MIME ---
{
  const v = await loadVal();
  assert("1 JPEG allow", v.normalizeOcrMimeType("image/jpeg").ok === true);
  assert("2 JPG alias", v.normalizeOcrMimeType("image/jpg").mime === "image/jpeg");
  assert("3 PNG allow", v.normalizeOcrMimeType("image/png").ok === true);
  assert("4 WebP allow", v.normalizeOcrMimeType("image/webp").ok === true);
  assert("5 GIF allow", v.normalizeOcrMimeType("image/gif").ok === true);
  assert("6 BMP allow", v.normalizeOcrMimeType("image/bmp").ok === true);
  assert("7 PDF allow", v.normalizeOcrMimeType("application/pdf").ok === true);
  assert("8 SVG reject", v.normalizeOcrMimeType("image/svg+xml").ok === false);
  assert("9 HTML reject", v.normalizeOcrMimeType("text/html").ok === false);
  assert("10 text reject", v.normalizeOcrMimeType("text/plain").ok === false);
  assert("11 JS reject", v.normalizeOcrMimeType("application/javascript").ok === false);
  assert("12 octet-stream reject", v.normalizeOcrMimeType("application/octet-stream").ok === false);
  assert("13 empty reject", v.normalizeOcrMimeType("").ok === false);
  assert("14 whitespace-only reject", v.normalizeOcrMimeType("   ").ok === false);
  assert("15 uppercase normalize", v.normalizeOcrMimeType("IMAGE/PNG").mime === "image/png");
  assert("16 surrounding whitespace", v.normalizeOcrMimeType("  image/png  ").mime === "image/png");
  assert("17 MIME parameters reject", v.normalizeOcrMimeType("image/jpeg; charset=utf-8").ok === false);
  assert("18 MIME object reject", v.normalizeOcrMimeType({}).ok === false);
  assert("19 MIME array reject", v.normalizeOcrMimeType(["image/png"]).ok === false);
  assert("20 MIME null reject", v.normalizeOcrMimeType(null).ok === false);
}

// --- unit base64 ---
{
  const v = await loadVal();
  assert("21 valid no padding", v.validateOcrBase64Syntax("YWJj").ok === true);
  assert("22 valid one padding", v.validateOcrBase64Syntax("YWI=").ok === true);
  assert("23 valid two padding", v.validateOcrBase64Syntax("YQ==").ok === true);
  assert("24 empty reject", v.validateOcrBase64Syntax("").ok === false);
  assert("25 invalid char", v.validateOcrBase64Syntax("@@@@").ok === false);
  assert("26 internal equals", v.validateOcrBase64Syntax("ab=c").ok === false);
  assert("27 excessive padding", v.validateOcrBase64Syntax("a===").ok === false);
  assert("28 mod-4 invalid", v.validateOcrBase64Syntax("abc").ok === false);
  assert("29 newline reject", v.validateOcrBase64Syntax("YWJj\n").ok === false);
  assert("30 space reject", v.validateOcrBase64Syntax("YWB j").ok === false);
  assert("31 tab reject", v.validateOcrBase64Syntax("YWJj\t").ok === false);
  assert("32 data URL reject", v.validateOcrBase64Syntax("data:image/png;base64," + PNG_1X1).ok === false);
  assert("33 URL-safe reject", v.validateOcrBase64Syntax("YWJj-_==").ok === false);
  assert("34 object reject", v.validateOcrBase64Syntax({}).ok === false);
  assert("35 array reject", v.validateOcrBase64Syntax([]).ok === false);
  assert("36 null reject", v.validateOcrBase64Syntax(null).ok === false);
}

// --- size ---
{
  const v = await loadVal();
  assert("37 small allow", v.validateOcrPayload(defaultBody()).ok === true);
  // exactly max: craft encoded length that decodes to OCR_MAX_DECODED_BYTES
  const maxBytes = v.OCR_MAX_DECODED_BYTES;
  const maxChars = v.OCR_MAX_BASE64_CHARS;
  assert("max constants aligned", maxBytes === Math.floor((maxChars * 3) / 4));

  // synthetic: estimate early reject for maxChars+1
  const overEnc = "A".repeat(maxChars + 1);
  // pad to mod4 - already +1 may not be mod4
  const overEncPad = "A".repeat(maxChars + 4);
  assert(
    "40 encoded early reject",
    v.validateOcrBase64Syntax(overEncPad).error === "attachment_too_large"
  );

  // max+1 decoded: use estimatedBytes > max
  // length L where (L/4)*3 - pad > maxBytes
  const needLen = Math.ceil(((maxBytes + 1) * 4) / 3);
  const aligned = needLen + ((4 - (needLen % 4)) % 4);
  const big = "A".repeat(aligned);
  const bigRes = v.validateOcrBase64Syntax(big);
  assert("39 max+1 reject", bigRes.ok === false && bigRes.error === "attachment_too_large");

  // exactly max estimated allow at syntax layer
  const exactNeed = Math.ceil((maxBytes * 4) / 3);
  const exactAligned = exactNeed + ((4 - (exactNeed % 4)) % 4);
  // adjust padding so estimated == maxBytes when possible
  let exact = "A".repeat(exactAligned);
  const syn = v.validateOcrBase64Syntax(exact);
  assert("38 exactly max allow (syntax)", syn.ok === true && syn.estimatedBytes <= maxBytes + 3);

  assert("41 zero decoded via empty already", v.validateOcrBase64Syntax("").ok === false);
  assert("42 padded size", v.validateOcrBase64Syntax("YQ==").estimatedBytes === 1);
  assert("43 unpadded policy", v.validateOcrBase64Syntax("YWJj").estimatedBytes === 3);

  const withClientMax = v.validateOcrPayload({
    ...defaultBody(),
    maxBytes: 1,
  });
  assert("44 client max ignored", withClientMax.ok === true);

  const { res, mock } = await callOcr(authH, defaultBody({ base64: overEncPad }));
  assert("45 huge Gemini 0", mock.geminiCalls.length === 0 && res.status === 413);
  assert("45 check 0", mock.checkCalls.length === 0);
}

// --- magic via validateOcrPayload ---
{
  const v = await loadVal();
  assert("46 JPEG valid", v.validateOcrPayload(defaultBody({ mimeType: "image/jpeg", base64: JPEG_MIN })).ok);
  assert(
    "47 JPEG+PNG bytes reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/jpeg", base64: PNG_1X1 })).error ===
      "payload_type_mismatch"
  );
  assert("48 PNG valid", v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: PNG_1X1 })).ok);
  assert(
    "49 PNG short reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: "iVBORw==" })).ok === false
  );
  assert("50 WebP valid", v.validateOcrPayload(defaultBody({ mimeType: "image/webp", base64: WEBP_MIN })).ok);
  // RIFF non-WebP
  const riffOnly = Buffer.from("RIFFxxxxNOTW").toString("base64");
  assert(
    "51 RIFF non-WebP reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/webp", base64: riffOnly })).error ===
      "payload_type_mismatch"
  );
  assert("52 GIF87a valid", v.validateOcrPayload(defaultBody({ mimeType: "image/gif", base64: GIF87 })).ok);
  assert("53 GIF89a valid", v.validateOcrPayload(defaultBody({ mimeType: "image/gif", base64: GIF89 })).ok);
  assert(
    "54 GIF invalid reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/gif", base64: PNG_1X1 })).error ===
      "payload_type_mismatch"
  );
  assert("55 BMP valid", v.validateOcrPayload(defaultBody({ mimeType: "image/bmp", base64: BMP_MIN })).ok);
  assert(
    "56 BMP short reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/bmp", base64: "Qk0=" })).ok === false
  );
  assert("57 PDF valid", v.validateOcrPayload(defaultBody({ mimeType: "application/pdf", base64: PDF_MIN })).ok);
  assert(
    "58 PDF as JPEG reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/jpeg", base64: PDF_MIN })).error ===
      "payload_type_mismatch"
  );
  assert(
    "59 JPEG as PDF reject",
    v.validateOcrPayload(defaultBody({ mimeType: "application/pdf", base64: JPEG_MIN })).error ===
      "payload_type_mismatch"
  );
  const html = Buffer.from("<!DOCTYPE html><html>").toString("base64");
  assert(
    "60 HTML as JPEG reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/jpeg", base64: html })).error ===
      "payload_type_mismatch"
  );
  const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>").toString("base64");
  // may not be mod4
  const svgPad = svg + "=".repeat((4 - (svg.length % 4)) % 4);
  assert(
    "61 SVG as PNG reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: svgPad })).error ===
      "payload_type_mismatch"
  );
  const random = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).toString(
    "base64"
  );
  assert(
    "62 random bytes reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: random })).error ===
      "payload_type_mismatch"
  );
  assert(
    "63 unknown MIME + valid magic reject",
    v.validateOcrPayload(defaultBody({ mimeType: "image/svg+xml", base64: PNG_1X1 })).error ===
      "unsupported_mime_type"
  );
  assert(
    "64 valid MIME missing magic",
    v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: "AAAA" })).error ===
      "payload_type_mismatch" ||
      v.validateOcrPayload(defaultBody({ mimeType: "image/png", base64: "AAAA" })).error ===
        "invalid_base64"
  );
}

// --- Function control flow ---
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ mimeType: "image/svg+xml" }));
  assert("65 invalid MIME", res.status === 415 && json?.error === "unsupported_mime_type");
  assert("65 guard 0", mock.checkCalls.length === 0);
  assert("65 Gemini 0", mock.geminiCalls.length === 0);
  assert("74 consume 0", mock.consumeCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ base64: "@@@@" }));
  assert("66 invalid base64", res.status === 400 && json?.error === "invalid_base64");
  assert("66 guard 0 Gemini 0", mock.checkCalls.length === 0 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ base64: "A".repeat(6 * 1024 * 1024 + 4) }));
  assert("67 oversized", res.status === 413 && mock.checkCalls.length === 0 && mock.geminiCalls.length === 0);
}
{
  const { res, json, mock } = await callOcr(
    authH,
    defaultBody({ mimeType: "image/jpeg", base64: PNG_1X1 })
  );
  assert("68 magic mismatch", res.status === 415 && json?.error === "payload_type_mismatch");
  assert("68 guard/Gemini/consume 0", mock.checkCalls.length === 0 && mock.geminiCalls.length === 0 && mock.consumeCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody());
  assert("69 valid → guard 1", res.status === 200 && mock.checkCalls.length === 1);
}
{
  const { res, mock } = await callOcr(authH, defaultBody(), { checkAllowed: false });
  assert("70 quota exceeded Gemini 0", res.status === 402 && mock.geminiCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody());
  assert("71 under quota Gemini 1", res.status === 200 && mock.geminiCalls.length === 1);
}
{
  const { res, mock } = await callOcr(authH, defaultBody(), { geminiOk: false });
  assert(
    "72 Gemini fail → reservation released",
    res.status === 502 && mock.consumeCalls.length === 1 && mock.releaseCalls.length === 1
  );
}
{
  const { res, mock } = await callOcr(authH, defaultBody());
  assert(
    "73 success consume 1",
    res.status === 200 && mock.consumeCalls.length === 1 && mock.releaseCalls.length === 0
  );
}
{
  const { res, mock } = await callOcr({}, defaultBody());
  assert("75 auth failure precedence", res.status === 401 && mock.checkCalls.length === 0);
}
{
  const { res, mock } = await callOcr(authH, defaultBody({ surface: "unknown" }));
  assert("76 surface failure precedence", res.status === 400 && mock.checkCalls.length === 0);
}
{
  const { mock } = await callOcr(authH, defaultBody({ user_id: "forged" }));
  const checkBody = JSON.parse(String(mock.checkCalls[0]?.init?.body || "{}"));
  assert("77 server user", checkBody.p_user_id === "user-server-1");
  const consumeBody = JSON.parse(String(mock.consumeCalls[0]?.init?.body || "{}"));
  assert("78 server feature", consumeBody.p_feature === "vision_turn");
}
{
  const { res, json, mock } = await callOcr(authH, defaultBody({ mimeType: "" }));
  assert("empty MIME reject", res.status === 415 && json?.error === "unsupported_mime_type");
  assert("empty MIME no Gemini", mock.geminiCalls.length === 0);
}
{
  for (const [mime, b64] of [
    ["image/jpeg", JPEG_MIN],
    ["image/png", PNG_1X1],
    ["image/webp", WEBP_MIN],
    ["image/gif", GIF89],
    ["image/bmp", BMP_MIN],
    ["application/pdf", PDF_MIN],
  ]) {
    const { res, mock } = await callOcr(authH, defaultBody({ mimeType: mime, base64: b64 }));
    assert(`allow ${mime}`, res.status === 200 && mock.geminiCalls.length === 1);
  }
}
{
  const { res, json } = await callOcr(authH, defaultBody({ mimeType: "image/jpg", base64: JPEG_MIN }));
  assert("jpg alias end-to-end", res.status === 200 && json?.ok === true);
}
{
  const { json } = await callOcr(
    authH,
    defaultBody({ mimeType: "image/jpeg", base64: PNG_1X1 })
  );
  const dumped = JSON.stringify(json);
  assert("84 sanitized no payload leak", !dumped.includes(PNG_1X1) && !dumped.includes("stack"));
}
{
  // body.maxBytes ignored end-to-end
  const { res } = await callOcr(authH, defaultBody({ maxBytes: 1 }));
  assert("client maxBytes ignored e2e", res.status === 200);
}
{
  // 80 body user spoof
  const { mock } = await callOcr(authH, defaultBody({ user_id: "attacker" }));
  assert(
    "80 body user spoof",
    JSON.parse(String(mock.checkCalls[0].init.body)).p_user_id === "user-server-1"
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
