#!/usr/bin/env node
/**
 * Voice Core Phase 3 — Gemini Live adapter skeleton (mock-compatible)
 *   node scripts/test-voice-core-phase3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const voiceDir = path.join(root, "shared/voice-core");

const phase3Files = [
  "voice-gemini-live-options.js",
  "voice-gemini-live-event-mapper.js",
  "adapters/voice-gemini-live-adapter.js",
];

const loadOrder = [
  "voice-core-events.js",
  "voice-adapter-interface.js",
  "voice-mock-adapter.js",
  "voice-realtime-options.js",
  "voice-realtime-connect-policy.js",
  "voice-realtime-config.js",
  "voice-realtime-event-mapper.js",
  "voice-openai-realtime-wire-client.js",
  "adapters/voice-openai-realtime-adapter.js",
  "voice-gemini-live-options.js",
  "voice-gemini-live-event-mapper.js",
  "adapters/voice-gemini-live-adapter.js",
  "voice-provider-router.js",
  "voice-session.js",
  "voice-core.js",
];

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function loadVoiceCore(g = globalThis) {
  for (const name of loadOrder) {
    Function("global", fs.readFileSync(path.join(voiceDir, name), "utf8"))(g);
  }
  return g.TasuVoiceCore;
}

for (const name of phase3Files) {
  const p = path.join(voiceDir, name);
  if (fs.existsSync(p)) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

function collectJsFiles(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...collectJsFiles(full, rel));
    else if (name.endsWith(".js")) out.push(rel);
  }
  return out;
}

const phase3Js = phase3Files.filter((f) => f.endsWith(".js"));
let phase3Combined = "";
for (const rel of phase3Js) {
  phase3Combined += fs.readFileSync(path.join(voiceDir, rel), "utf8") + "\n";
}

const connectionForbidden = [
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bRTCPeerConnection\b/,
  /wss:\/\//,
  /https:\/\/api\./,
  /generativelanguage\.googleapis/,
  /XMLHttpRequest/,
];

let connHit = false;
for (const re of connectionForbidden) {
  if (re.test(phase3Combined)) {
    bad("no external connection code (phase3 files)", re.toString());
    connHit = true;
  }
}
if (!connHit) ok("no external connection code in phase3 files");

const secretForbidden = [/sk-[a-zA-Z0-9]{10,}/, /\bapi[_-]?key\s*[:=]/i, /Bearer\s+[a-zA-Z0-9_-]{20,}/];

let secretHit = false;
for (const re of secretForbidden) {
  if (re.test(phase3Combined)) {
    bad("no API key strings (phase3 files)", re.toString());
    secretHit = true;
  }
}
if (!secretHit) ok("no API key strings in phase3 files");

console.log("\nRunning Gemini adapter + router smoke …");
const Core = loadVoiceCore();
const g = globalThis;

if (g.TasuVoiceCoreGeminiLiveAdapter?.id === "gemini-live-skeleton") ok("Gemini adapter created");
else bad("Gemini adapter created");

try {
  g.TasuVoiceCoreAdapterInterface.assertAdapter(g.TasuVoiceCoreGeminiLiveAdapter);
  ok("Gemini adapter passes assertAdapter");
} catch (e) {
  bad("Gemini adapter passes assertAdapter", e.message);
}

const resolved = Core.resolveAdapter({ provider: "gemini_live", kind: "live" });
if (resolved?.adapter?.id === "gemini-live-skeleton") ok("router registers gemini_live:live");
else bad("router registers gemini_live:live", resolved?.adapter?.id);

const listed = Core.listAdapters().some((a) => a.provider === "gemini_live" && a.id === "gemini-live-skeleton");
if (listed) ok("listAdapters includes gemini_live");
else bad("listAdapters includes gemini_live");

const opts = g.TasuVoiceCoreGeminiLiveOptions.normalizeGeminiLiveOptions({
  provider: "gemini_live",
  kind: "live",
  mockCompatible: true,
  language: "ja-JP",
});
if (opts.provider === "gemini_live" && opts.mockCompatible === true) ok("Gemini options normalized");
else bad("Gemini options normalized");

const mapper = g.TasuVoiceCoreGeminiLiveEventMapper;
const mappedOpen = mapper.mapGeminiWireEventToVoiceCore(
  { type: mapper.GEMINI_WIRE_EVENT.SESSION_OPENED, session: { id: "g1" } },
  { sessionId: "g1", mockCompatible: true, provider: "gemini_live" }
);
if (mappedOpen?.type === "session_started") ok("event mapper: live.session.opened → session_started");
else bad("event mapper: live.session.opened → session_started");

const mappedText = mapper.mapGeminiWireEventToVoiceCore(
  { type: mapper.GEMINI_WIRE_EVENT.MODEL_TEXT, text: "hello" },
  { sessionId: "g1", mockCompatible: true }
);
if (mappedText?.type === "text_delta" && mappedText.text === "hello") ok("event mapper: server.content.text → text_delta");
else bad("event mapper: server.content.text → text_delta");

const mappedAudio = mapper.mapGeminiWireEventToVoiceCore(
  { type: mapper.GEMINI_WIRE_EVENT.MODEL_AUDIO, delta: "audio-chunk" },
  { sessionId: "g1", mockCompatible: true }
);
if (mappedAudio?.type === "audio_delta_mock") ok("event mapper: server.content.audio → audio_delta_mock");
else bad("event mapper: server.content.audio → audio_delta_mock");

const mappedClose = mapper.mapGeminiWireEventToVoiceCore(
  { type: mapper.GEMINI_WIRE_EVENT.SESSION_CLOSED, reason: "done" },
  { sessionId: "g1", mockCompatible: true }
);
if (mappedClose?.type === "session_stopped") ok("event mapper: live.session.closed → session_stopped");
else bad("event mapper: live.session.closed → session_stopped");

if (Core.GEMINI_WIRE_EVENT?.SESSION_OPENED && Core.normalizeGeminiLiveOptions && Core.mapGeminiWireEventToVoiceCore) {
  ok("Voice Core exports Gemini helpers");
} else {
  bad("Voice Core exports Gemini helpers");
}

const events = [];
const session = Core.createSession({ surface: "phase3", provider: "gemini_live", kind: "live" });
session.receiveEvent((ev) => events.push(ev));
session.startSession({ provider: "gemini_live", kind: "live", mockCompatible: true });

if (session.active && session.id) ok("mock session open");
else bad("mock session open");

session.sendText("phase3 check");
session.sendAudio(new Uint8Array([7, 8, 9]));
session.stopSession();

for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
  if (events.some((ev) => ev.type === t)) ok(`event flow: ${t}`);
  else bad(`event flow: ${t}`);
}

session.sendText("after close");
if (events.some((ev) => ev.type === "error_mock" && ev.code === "not_active")) {
  ok("error handling: inactive session");
} else {
  bad("error handling: inactive session");
}

const emptyErr = g.TasuVoiceCoreGeminiLiveAdapter.sendText(session.id, "   ");
if (emptyErr?.type === "error_mock" && emptyErr.code === "not_active") ok("error handling: empty/stopped session");
else bad("error handling: empty/stopped session");

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }

  const distHtml = path.join(root, "deploy/cloudflare/dist/shared/voice-core/voice-core-test.html");
  const htmlPath = fs.existsSync(distHtml) ? distHtml : path.join(voiceDir, "voice-core-test.html");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => window.TasuVoiceCore?.resolveAdapter, null, { timeout: 10000 });
    const result = await page.evaluate(() => {
      const events = [];
      const s = window.TasuVoiceCore.createSession({ provider: "gemini_live", kind: "live" });
      s.receiveEvent((ev) => events.push(ev.type));
      s.startSession({ provider: "gemini_live", kind: "live", mockCompatible: true });
      s.sendText("browser gemini");
      s.sendAudio(new Uint8Array([3]));
      s.stopSession();
      const adapter = window.TasuVoiceCore.resolveAdapter({ provider: "gemini_live", kind: "live" });
      return { events, adapterId: adapter?.adapter?.id || "", version: window.TasuVoiceCore.VERSION };
    });
    if (result.adapterId === "gemini-live-skeleton") ok("browser: gemini_live adapter");
    else bad("browser: gemini_live adapter", result.adapterId);
    for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
      if (result.events.includes(t)) ok(`browser gemini event: ${t}`);
      else bad(`browser gemini event: ${t}`);
    }
    if (result.version?.includes("phase")) ok("browser: VERSION phase3");
    else bad("browser: VERSION phase3", result.version);
  } finally {
    await browser.close();
  }
}

console.log("\nRunning build:pages …");
if (process.env.TASFUL_SKIP_PAGES_BUILD === "1") {
  ok("build:pages SKIP (nested regression)");
} else {
  const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, shell: true, encoding: "utf8" });
  if (build.status === 0) ok("build:pages PASS");
  else bad("build:pages", build.stderr?.slice(0, 200) || String(build.status));
}

console.log("\nRunning browser smoke …");
await browserSmoke();

console.log("\nRunning Voice Core Phase 1 regression …");
const p1 = spawnSync("node", ["scripts/test-voice-core-phase1.mjs"], { cwd: root, encoding: "utf8", shell: true });
if (/=== Voice Core Phase 1: \d+\/\d+ PASS ===/.test(p1.stdout || "") && !/FAIL:/.test(p1.stdout || "")) {
  ok("voice-core phase1 regression");
} else {
  bad("voice-core phase1 regression", (p1.stdout || p1.stderr || "").slice(-200));
}

console.log("\nRunning Voice Core Phase 2 regression …");
const p2 = spawnSync("node", ["scripts/test-voice-core-phase2.mjs"], { cwd: root, encoding: "utf8", shell: true });
if (/=== Voice Core Phase 2: \d+\/\d+ PASS ===/.test(p2.stdout || "") && !/FAIL:/.test(p2.stdout || "")) {
  ok("voice-core phase2 regression");
} else {
  bad("voice-core phase2 regression", (p2.stdout || p2.stderr || "").slice(-200));
}

console.log("\nRunning Builder AI Phase 7 regression …");
const p7 = spawnSync("node", ["scripts/test-builder-ai-ui-phase7.mjs"], { cwd: root, encoding: "utf8", shell: true });
if (/=== \d+\/\d+ PASS ===/.test(p7.stdout || "") && !/FAIL:/.test(p7.stdout || "")) {
  ok("builder-ai-ui phase7 regression");
} else {
  bad("builder-ai-ui phase7 regression", (p7.stdout || p7.stderr || "").slice(-200));
}

console.log(`\n=== Voice Core Phase 3: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
