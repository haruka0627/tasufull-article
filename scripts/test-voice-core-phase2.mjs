#!/usr/bin/env node
/**
 * Voice Core Phase 2 — OpenAI Realtime adapter skeleton (mock-compatible)
 *   node scripts/test-voice-core-phase2.mjs
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

const phase2Files = [
  "voice-realtime-options.js",
  "voice-realtime-event-mapper.js",
  "adapters/voice-openai-realtime-adapter.js",
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

for (const name of phase2Files) {
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

const allJs = collectJsFiles(voiceDir);
let combined = "";
for (const rel of allJs) {
  combined += fs.readFileSync(path.join(voiceDir, rel), "utf8") + "\n";
}

const connectionForbidden = [
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bRTCPeerConnection\b/,
  /wss:\/\//,
  /https:\/\/api\./,
  /XMLHttpRequest/,
];

let connHit = false;
for (const re of connectionForbidden) {
  if (re.test(combined)) {
    bad("no external connection code", re.toString());
    connHit = true;
  }
}
if (!connHit) ok("no external connection code in voice-core tree");

const secretForbidden = [/sk-[a-zA-Z0-9]{10,}/, /\bapi[_-]?key\s*[:=]/i, /Bearer\s+[a-zA-Z0-9_-]{20,}/];

let secretHit = false;
for (const re of secretForbidden) {
  if (re.test(combined)) {
    bad("no API key strings", re.toString());
    secretHit = true;
  }
}
if (!secretHit) ok("no API key strings in voice-core tree");

console.log("\nRunning adapter + router smoke …");
const Core = loadVoiceCore();
const g = globalThis;

try {
  g.TasuVoiceCoreAdapterInterface.assertAdapter(g.TasuVoiceCoreOpenAiRealtimeAdapter);
  ok("openai realtime adapter passes assertAdapter");
} catch (e) {
  bad("openai realtime adapter passes assertAdapter", e.message);
}

const resolved = Core.resolveAdapter({ provider: "openai_realtime", kind: "live" });
if (resolved?.adapter?.id === "openai-realtime-skeleton") ok("router resolves openai_realtime:live");
else bad("router resolves openai_realtime:live", resolved?.adapter?.id);

const events = [];
const session = Core.createSession({ surface: "phase2", provider: "openai_realtime", kind: "live" });
session.receiveEvent((ev) => events.push(ev));
session.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: true });

session.sendText("phase2 check");
session.sendAudio(new Uint8Array([4, 5, 6]));
session.stopSession();

for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
  if (events.some((ev) => ev.type === t)) ok(`openai mock-compatible event: ${t}`);
  else bad(`openai mock-compatible event: ${t}`);
}

const mapper = g.TasuVoiceCoreRealtimeEventMapper;
const mappedStart = mapper.mapWireEventToVoiceCore(
  { type: mapper.WIRE_EVENT.SESSION_CREATED, session: { id: "x" } },
  { sessionId: "x", mockCompatible: true, provider: "openai_realtime" }
);
if (mappedStart?.type === "session_started") ok("wire mapper: session.created → session_started");
else bad("wire mapper: session.created → session_started");

const mappedText = mapper.mapWireEventToVoiceCore(
  { type: mapper.WIRE_EVENT.RESPONSE_TEXT_DELTA, delta: "hi" },
  { sessionId: "x", mockCompatible: true }
);
if (mappedText?.type === "text_delta" && mappedText.text === "hi") ok("wire mapper: response.text.delta → text_delta");
else bad("wire mapper: response.text.delta → text_delta");

const opts = g.TasuVoiceCoreRealtimeOptions.normalizeRealtimeOptions({
  provider: "openai_realtime",
  kind: "live",
  mockCompatible: true,
});
if (opts.provider === "openai_realtime" && opts.mockCompatible === true) ok("realtime session options normalized");
else bad("realtime session options normalized");

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
      const s = window.TasuVoiceCore.createSession({ provider: "openai_realtime", kind: "live" });
      s.receiveEvent((ev) => events.push(ev.type));
      s.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: true });
      s.sendText("browser");
      s.sendAudio(new Uint8Array([1]));
      s.stopSession();
      const adapter = window.TasuVoiceCore.resolveAdapter({ provider: "openai_realtime", kind: "live" });
      return { events, adapterId: adapter?.adapter?.id || "" };
    });
    if (result.adapterId === "openai-realtime-skeleton") ok("browser: openai_realtime adapter");
    else bad("browser: openai_realtime adapter", result.adapterId);
    for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
      if (result.events.includes(t)) ok(`browser openai event: ${t}`);
      else bad(`browser openai event: ${t}`);
    }
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

console.log("\nRunning Builder AI Phase 7 regression …");
const p7 = spawnSync("node", ["scripts/test-builder-ai-ui-phase7.mjs"], { cwd: root, encoding: "utf8", shell: true });
if (/=== \d+\/\d+ PASS ===/.test(p7.stdout || "") && !/FAIL:/.test(p7.stdout || "")) {
  ok("builder-ai-ui phase7 regression");
} else {
  bad("builder-ai-ui phase7 regression", (p7.stdout || p7.stderr || "").slice(-200));
}

console.log(`\n=== Voice Core Phase 2: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
