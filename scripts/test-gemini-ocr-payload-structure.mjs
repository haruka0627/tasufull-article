#!/usr/bin/env node
/**
 * Gemini OCR payload structural limits (F7)
 *   node scripts/test-gemini-ocr-payload-structure.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://tasufull-article.pages.dev";
const SECRET = "test-ocr-ip-hmac-secret-32b";
const results = [];
const logSink = [];

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  (condition ? console.log : console.error)(
    `${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`
  );
}

function b64(buf) {
  return Buffer.from(buf).toString("base64");
}

function env(extra = {}) {
  return {
    GEMINI_API_KEY: "test-gemini-key",
    SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    OCR_IP_RATE_HMAC_SECRET: SECRET,
    ...extra,
  };
}

function makeJpeg({ width = 1, height = 1, progressive = false } = {}) {
  const parts = [];
  parts.push(Buffer.from([0xff, 0xd8]));
  parts.push(
    Buffer.from([
      0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
      0x00, 0x00,
    ])
  );
  const dqt = Buffer.alloc(69);
  dqt[0] = 0xff;
  dqt[1] = 0xdb;
  dqt.writeUInt16BE(67, 2);
  dqt[4] = 0;
  for (let i = 0; i < 64; i += 1) dqt[5 + i] = 16;
  parts.push(dqt);
  const sof = Buffer.from([
    0xff,
    progressive ? 0xc2 : 0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
  parts.push(sof);
  const dhtPayload = Buffer.from([0x00, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x08]);
  const dhtLen = dhtPayload.length + 2;
  parts.push(
    Buffer.concat([Buffer.from([0xff, 0xc4, (dhtLen >> 8) & 0xff, dhtLen & 0xff]), dhtPayload])
  );
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]));
  parts.push(Buffer.from([0x7f]));
  parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function pngCrc32(type, data) {
  let table = pngCrc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    pngCrc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < type.length; i += 1) crc = table[(crc ^ type[i]) & 0xff] ^ (crc >>> 8);
  for (let j = 0; j < data.length; j += 1) crc = table[(crc ^ data[j]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng({ width = 1, height = 1, bitDepth = 8, colorType = 2, extraChunks = [], trail = Buffer.alloc(0) } = {}) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  function chunk(typeStr, data) {
    const type = Buffer.from(typeStr, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(pngCrc32(type, data), 0);
    return Buffer.concat([len, type, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width >>> 0, 0);
  ihdr.writeUInt32BE(height >>> 0, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // minimal empty IDAT (may be invalid zlib — structure does not inflate)
  const idat = chunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]));
  const parts = [sig, chunk("IHDR", ihdr), ...extraChunks, idat, chunk("IEND", Buffer.alloc(0)), trail];
  return Buffer.concat(parts);
}

function makePdf({ pages = 1, encrypt = false, js = false, embed = false, objectsExtra = 0, nestDepth = 0, trail = "" } = {}) {
  let body = "%PDF-1.4\n";
  const offsets = [0];
  function addObj(n, content) {
    offsets[n] = Buffer.byteLength(body);
    body += `${n} 0 obj\n${content}\nendobj\n`;
  }
  let nest = "";
  for (let i = 0; i < nestDepth; i += 1) nest += "<< ";
  for (let i = 0; i < nestDepth; i += 1) nest += ">> ";
  const kids = [];
  let n = 3;
  addObj(1, `<< /Type /Catalog /Pages 2 0 R ${encrypt ? "/Encrypt 99 0 R" : ""} ${js ? "/Names << /JavaScript 98 0 R >>" : ""} >>`);
  for (let p = 0; p < pages; p += 1) {
    kids.push(`${n} 0 R`);
    addObj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3 3] ${embed ? "/EmbeddedFile 97 0 R" : ""} ${nest} >>`);
    n += 1;
  }
  for (let i = 0; i < objectsExtra; i += 1) {
    addObj(n, `<< /Status /Pad >>`);
    n += 1;
  }
  if (encrypt) addObj(99, "<< /Filter /Standard /V 1 /R 2 /O (x) /U (x) /P -4 >>");
  if (js) addObj(98, "<< /S /JavaScript /JS (app.alert\\(1\\);) >>");
  if (embed) addObj(97, "<< /Type /EmbeddedFile /Length 1 >>\nstream\nx\nendstream");
  // rewrite pages obj — insert before xref by rebuilding simpler: write pages as obj 2 with known kids
  // Rebuild cleanly:
  body = "%PDF-1.4\n";
  const off = [0];
  const add = (num, content) => {
    off[num] = Buffer.byteLength(body);
    body += `${num} 0 obj\n${content}\nendobj\n`;
  };
  const pageNums = [];
  let id = 3;
  for (let p = 0; p < pages; p += 1) {
    pageNums.push(id);
    let content = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3 3]`;
    if (embed) content += ` /EF << /F ${id + 1000} 0 R >>`;
    for (let d = 0; d < nestDepth; d += 1) content += " << /X 1";
    for (let d = 0; d < nestDepth; d += 1) content += " >>";
    content += " >>";
    add(id, content);
    id += 1;
  }
  for (let i = 0; i < objectsExtra; i += 1) {
    add(id, "<< /Pad 1 >>");
    id += 1;
  }
  if (encrypt) add(90, "<< /Filter /Standard /V 1 /Length 40 >>");
  if (js) add(91, "<< /S /JavaScript /JS (1) >>");
  const kidsStr = pageNums.map((x) => `${x} 0 R`).join(" ");
  add(2, `<< /Type /Pages /Kids [${kidsStr}] /Count ${pages} >>`);
  let catalog = "<< /Type /Catalog /Pages 2 0 R";
  if (encrypt) catalog += " /Encrypt 90 0 R";
  if (js) catalog += " /OpenAction 91 0 R";
  catalog += " >>";
  add(1, catalog);
  const xrefPos = Buffer.byteLength(body);
  const maxId = Math.max(...Object.keys(off).map(Number));
  body += `xref\n0 ${maxId + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= maxId; i += 1) {
    const o = off[i] || 0;
    body += `${String(o).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R ${encrypt ? "/Encrypt 90 0 R" : ""} >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  body += trail;
  return Buffer.from(body, "ascii");
}

async function loadVal() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-payload-validation.mjs")
  ).href;
  return import(`${href}?st=${Date.now()}`);
}

async function loadStruct() {
  const href = pathToFileURL(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-payload-structure.mjs")
  ).href;
  return import(`${href}?st=${Date.now()}`);
}

function installFetchMock() {
  const calls = { rate: [], reserve: [], gemini: [], auth: [] };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      calls.auth.push(1);
      return { ok: true, status: 200, json: async () => ({ id: "user-a" }) };
    }
    if (u.includes("gen_ai_subscriptions")) return { ok: true, status: 200, json: async () => [] };
    if (u.includes("/rpc/consume_ocr_ip_rate_limit")) {
      calls.rate.push(1);
      return { ok: true, status: 200, json: async () => ({ ok: true, count: 1, limit: 10, remaining: 9 }) };
    }
    if (u.includes("/rpc/check_ai_workspace_quota")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, used: 0 }) };
    }
    if (u.includes("/rpc/reserve_ai_workspace_quota")) {
      calls.reserve.push(init);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          used: 1,
          reservation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      };
    }
    if (u.includes("/rpc/commit_ai_workspace_quota_reservation")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "committed" }) };
    }
    if (u.includes("/rpc/release_ai_workspace_quota_reservation")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, state: "released" }) };
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      calls.gemini.push(1);
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "ocr" }] } }] }),
      };
    }
    throw new Error(`unexpected ${u}`);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function installLogs() {
  const orig = console.error;
  console.error = (...args) => {
    logSink.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    if (typeof args[0] === "string" && args[0].startsWith("FAIL:")) orig(...args);
  };
  return () => {
    console.error = orig;
  };
}

async function callOcr(mime, bytes) {
  const mock = installFetchMock();
  const restore = installLogs();
  try {
    const mod = await import(
      pathToFileURL(path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js")).href +
        `?st=${Date.now()}-${Math.random()}`
    );
    const req = new Request(`${ORIGIN}/api/gemini-ocr`, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/json",
        Authorization: "Bearer token-user-a",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({
        mimeType: mime,
        base64: b64(bytes),
        surface: "chat",
        feature: "ocr_turn",
      }),
    });
    const res = await mod.onRequest({ request: req, env: env() });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, calls: mock.calls };
  } finally {
    restore();
    mock.restore();
  }
}

const v = await loadVal();
const s = await loadStruct();

// --- common ---
{
  assert("01 valid min png", v.validateOcrPayload({ mimeType: "image/png", base64: b64(PNG_1X1) }).ok);
  assert("02 valid jpeg", v.validateOcrPayload({ mimeType: "image/jpeg", base64: b64(makeJpeg()) }).ok);
  const badPng = Buffer.concat([PNG_1X1.slice(0, 20), Buffer.alloc(100)]);
  // truncated after magic — structure fail
  const r = v.validateOcrPayload({ mimeType: "image/png", base64: b64(badPng) });
  assert("03 structure rejects bad png", r.ok === false && r.error === "invalid_image_structure");
}
{
  const overWide = makePng({ width: 12001, height: 1 });
  // keep under decoded size — small IDAT
  const out = await callOcr("image/png", overWide);
  assert("04 no reserve on structure fail", out.calls.reserve.length === 0, String(out.status));
  assert("05 no gemini on structure fail", out.calls.gemini.length === 0);
  assert("04b error taxonomy", out.json?.error === "image_dimensions_exceeded");
}
{
  // ops budget: force many PNG chunks
  const chunks = [];
  for (let i = 0; i < 3000; i += 1) {
    const type = Buffer.from("tEXt");
    const data = Buffer.from("a");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(1, 0);
    const crc = Buffer.alloc(4);
    // intentional wrong CRC still counted — use valid CRC
    const table = (() => {
      /* use makePng path instead */
    })();
    void table;
  }
  // build via makePng extraChunks with valid CRCs
  const extras = [];
  for (let i = 0; i < 2100; i += 1) {
    const type = Buffer.from("tEXt");
    const data = Buffer.from("x");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    // compute via structure module's path: use makePng helper inline
    let c = 0xffffffff;
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let x = n;
      for (let k = 0; k < 8; k += 1) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1;
      tbl[n] = x >>> 0;
    }
    for (let j = 0; j < 4; j += 1) c = tbl[(c ^ type[j]) & 0xff] ^ (c >>> 8);
    for (let j = 0; j < data.length; j += 1) c = tbl[(c ^ data[j]) & 0xff] ^ (c >>> 8);
    crcBuf.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    extras.push(Buffer.concat([len, type, data, crcBuf]));
  }
  const flooded = makePng({ extraChunks: extras });
  const fr = s.validatePngStructure(new Uint8Array(flooded));
  assert("06/20 chunk flood bounded", fr.ok === false && fr.error === "invalid_image_structure");
}
{
  const valSrc = fs.readFileSync(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-payload-validation.mjs"),
    "utf8"
  );
  const decodeCalls = (valSrc.match(/(?<!function )decodeOcrBase64\(/g) || []).length;
  assert("08 structure wired once", valSrc.includes("validateOcrStructure(mimeResult.mime, bytes)"));
  assert("08 single decode call site", decodeCalls === 1, `calls=${decodeCalls}`);
}

// --- PNG ---
{
  assert("10 width 0", s.validatePngStructure(new Uint8Array(makePng({ width: 0, height: 1 }))).error === "invalid_image_structure");
  assert("11 height 0", s.validatePngStructure(new Uint8Array(makePng({ width: 1, height: 0 }))).error === "invalid_image_structure");
  assert(
    "12 width exceeded",
    s.validatePngStructure(new Uint8Array(makePng({ width: 12001, height: 1 }))).error ===
      "image_dimensions_exceeded"
  );
  assert(
    "13 height exceeded",
    s.validatePngStructure(new Uint8Array(makePng({ width: 1, height: 12001 }))).error ===
      "image_dimensions_exceeded"
  );
  assert(
    "14 pixels exceeded",
    s.validatePngStructure(new Uint8Array(makePng({ width: 10000, height: 5000 }))).error ===
      "image_dimensions_exceeded"
  );
  // invalid IHDR length
  const badIhdr = Buffer.from(PNG_1X1);
  // craft: signature + IHDR with length 12
  const sig = PNG_1X1.subarray(0, 8);
  const ihdrData = Buffer.alloc(12);
  const type = Buffer.from("IHDR");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(12);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(0);
  const crafted = Buffer.concat([sig, len, type, ihdrData, crc, Buffer.from(PNG_1X1.subarray(8 + 25))]);
  assert("15 invalid IHDR length", s.validatePngStructure(new Uint8Array(crafted)).ok === false);
  assert(
    "16 invalid bit depth/color",
    s.validatePngStructure(new Uint8Array(makePng({ bitDepth: 3, colorType: 2 }))).error ===
      "invalid_image_structure"
  );
  assert(
    "17 truncated chunk",
    s.validatePngStructure(new Uint8Array(PNG_1X1.subarray(0, 20))).error === "invalid_image_structure"
  );
  // chunk length overflow
  const over = Buffer.concat([
    PNG_1X1.subarray(0, 8),
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x48, 0x44, 0x52]),
  ]);
  assert("18 chunk length overflow", s.validatePngStructure(new Uint8Array(over)).ok === false);
  // IEND missing: strip last chunk
  const noIend = PNG_1X1.subarray(0, PNG_1X1.length - 12);
  assert("19 IEND missing", s.validatePngStructure(new Uint8Array(noIend)).ok === false);
  const trail = makePng({ trail: Buffer.alloc(200, 0x41) });
  assert("21 IEND trailing", s.validatePngStructure(new Uint8Array(trail)).error === "invalid_image_structure");
  assert("01b real png ok", s.validatePngStructure(new Uint8Array(PNG_1X1)).ok);
}

// --- JPEG ---
{
  assert("22 no SOI", s.validateJpegStructure(new Uint8Array([0x00, 0x01, 0x02])).ok === false);
  const noEoi = makeJpeg().subarray(0, makeJpeg().length - 2);
  assert("23 no EOI", s.validateJpegStructure(new Uint8Array(noEoi)).ok === false);
  // SOF missing: SOI + APP0 + EOI
  const noSof = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  assert("24 no SOF", s.validateJpegStructure(new Uint8Array(noSof)).ok === false);
  assert(
    "25 zero dim",
    s.validateJpegStructure(new Uint8Array(makeJpeg({ width: 0, height: 1 }))).error ===
      "invalid_image_structure"
  );
  assert(
    "26 width exceeded",
    s.validateJpegStructure(new Uint8Array(makeJpeg({ width: 12001, height: 1 }))).error ===
      "image_dimensions_exceeded"
  );
  assert(
    "27 height exceeded",
    s.validateJpegStructure(new Uint8Array(makeJpeg({ width: 1, height: 12001 }))).error ===
      "image_dimensions_exceeded"
  );
  assert(
    "28 pixels exceeded",
    s.validateJpegStructure(new Uint8Array(makeJpeg({ width: 10000, height: 5000 }))).error ===
      "image_dimensions_exceeded"
  );
  const badSeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);
  assert("29 malformed segment", s.validateJpegStructure(new Uint8Array(badSeg)).ok === false);
  assert(
    "30 truncated segment",
    s.validateJpegStructure(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a])).ok === false
  );
  // marker flood
  const flood = [0xff, 0xd8];
  for (let i = 0; i < 9000; i += 1) flood.push(0xff, 0xfe, 0x00, 0x02);
  flood.push(0xff, 0xd9);
  assert("31 marker flood", s.validateJpegStructure(new Uint8Array(flood)).ok === false);
  const trailJ = Buffer.concat([makeJpeg(), Buffer.alloc(200, 0x42)]);
  assert("32 EOI trailing", s.validateJpegStructure(new Uint8Array(trailJ)).ok === false);
  assert(
    "33 progressive allowed",
    s.OCR_ALLOW_PROGRESSIVE_JPEG === true &&
      s.validateJpegStructure(new Uint8Array(makeJpeg({ progressive: true }))).ok === true
  );
}

// --- PDF ---
{
  assert("34 valid min pdf", s.validatePdfStructure(new Uint8Array(makePdf())).ok);
  assert(
    "35 bad header",
    s.validatePdfStructure(new Uint8Array(Buffer.from("%PDX-1.4\n%%EOF\n"))).ok === false
  );
  const noEof = Buffer.from("%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\n");
  assert("36 no EOF", s.validatePdfStructure(new Uint8Array(noEof)).ok === false);
  let badXref = makePdf().toString("ascii").replace(/startxref\n\d+/, "startxref\n999999");
  assert("37 startxref OOB", s.validatePdfStructure(new Uint8Array(Buffer.from(badXref))).ok === false);
  assert(
    "39 pages exceeded",
    s.validatePdfStructure(new Uint8Array(makePdf({ pages: 21 }))).error === "pdf_limits_exceeded"
  );
  assert(
    "40 objects exceeded",
    s.validatePdfStructure(new Uint8Array(makePdf({ objectsExtra: 10001 }))).error ===
      "pdf_limits_exceeded"
  );
  assert(
    "41 nesting exceeded",
    s.validatePdfStructure(new Uint8Array(makePdf({ nestDepth: 40 }))).error === "pdf_limits_exceeded"
  );
  assert(
    "42 encrypt rejected",
    s.validatePdfStructure(new Uint8Array(makePdf({ encrypt: true }))).error === "unsupported_pdf"
  );
  assert(
    "43 javascript rejected",
    s.validatePdfStructure(new Uint8Array(makePdf({ js: true }))).error === "unsupported_pdf"
  );
  // embedded file keyword
  const emb = Buffer.from(
    makePdf().toString("ascii").replace("/MediaBox [0 0 3 3]", "/MediaBox [0 0 3 3] /EmbeddedFile 9 0 R")
  );
  assert("44 embedded file rejected", s.validatePdfStructure(new Uint8Array(emb)).error === "unsupported_pdf");
  // excessive incremental EOF
  let multi = makePdf().toString("ascii");
  multi += "%%EOF\n%%EOF\n%%EOF\n%%EOF\n";
  assert("45 excessive incremental", s.validatePdfStructure(new Uint8Array(Buffer.from(multi))).ok === false);
  const poly = Buffer.concat([makePdf(), Buffer.alloc(500, 0x41)]);
  assert("46 trailing polyglot", s.validatePdfStructure(new Uint8Array(poly)).error === "invalid_pdf_structure");
  assert(
    "48 unsupported ObjStm",
    s.validatePdfStructure(
      new Uint8Array(Buffer.from("%PDF-1.4\n/ObjStm\n%%EOF\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [] /Count 0 >>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<< /Size 1 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"))
    ).error === "unsupported_pdf" ||
      s.validatePdfStructure(
        new Uint8Array(
          Buffer.from(
            "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] /ObjStm 1 >>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF\n"
          )
        )
      ).error === "unsupported_pdf"
  );
}

// --- e2e + privacy ---
{
  const okPng = await callOcr("image/png", PNG_1X1);
  assert("e2e valid png 200", okPng.status === 200 && okPng.calls.gemini.length === 1);
  const joined = logSink.join("\n");
  assert("09 no base64 in logs", !joined.includes(b64(PNG_1X1).slice(0, 24)));
  assert("09 no SECRET", !joined.includes("SECRET") && !joined.includes(SECRET));
}

// static order
{
  const fn = fs.readFileSync(path.join(root, "deploy/cloudflare/functions/api/gemini-ocr.js"), "utf8");
  const val = fs.readFileSync(
    path.join(root, "deploy/cloudflare/functions/_shared/ocr-payload-validation.mjs"),
    "utf8"
  );
  assert("order: structure in payload", val.includes("validateOcrStructure"));
  assert("order: payload before guard", /validateOcrPayload[\s\S]*enforceCfOcrGuard/.test(fn));
  assert("no sharp import", !val.includes("sharp") && !fn.includes("from \"sharp\""));
}

// --- regression suites ---
for (const suite of [
  "test-gemini-ocr-ip-rate-limit.mjs",
  "test-gemini-ocr-atomic-quota.mjs",
  "test-gemini-ocr-function-auth.mjs",
  "test-gemini-ocr-usage-limits.mjs",
  "test-gemini-ocr-payload-security.mjs",
  "test-gemini-ocr-edge-security.mjs",
]) {
  const run = spawnSync(process.execPath, [path.join(root, "scripts", suite)], { encoding: "utf8" });
  assert(`reg ${suite}`, run.status === 0, `exit=${run.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
