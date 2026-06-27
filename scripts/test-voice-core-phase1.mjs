#!/usr/bin/env node
/**
 * Voice Core Phase 1 — mock-only foundation tests
 *   node scripts/test-voice-core-phase1.mjs
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
const coreFiles = [
  "voice-core-events.js",
  "voice-adapter-interface.js",
  "voice-mock-adapter.js",
  "voice-provider-router.js",
  "voice-session.js",
  "voice-core.js",
  "voice-core-test.html",
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

for (const name of coreFiles) {
  const p = path.join(voiceDir, name);
  if (fs.existsSync(p)) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

const forbidden = [
  /openai/i,
  /gemini/i,
  /elevenlabs/i,
  /azure/i,
  /sk-[a-z0-9]{10,}/i,
  /api[_-]?key/i,
  /realtime\.openai/i,
  /generativelanguage\.googleapis/i,
];

const forbiddenScanFiles = [
  "voice-core-events.js",
  "voice-adapter-interface.js",
  "voice-mock-adapter.js",
  "voice-session.js",
];

let combined = "";
for (const name of forbiddenScanFiles) {
  combined += fs.readFileSync(path.join(voiceDir, name), "utf8") + "\n";
}

let forbiddenHit = false;
for (const re of forbidden) {
  if (re.test(combined)) {
    bad("no forbidden API strings", re.toString());
    forbiddenHit = true;
  }
}
if (!forbiddenHit) ok("no forbidden API strings in phase1 core modules");

const js = fs.readFileSync(path.join(voiceDir, "voice-core.js"), "utf8");
if (js.includes("startSession") && js.includes("TasuVoiceCore")) ok("voice-core facade");
else bad("voice-core facade");

if (js.includes("ADAPTER_KIND") && js.includes("EVENT")) ok("exports event constants");
else bad("exports event constants");

async function nodeSessionSmoke() {
  const eventsPath = path.join(voiceDir, "voice-core-events.js");
  const adapterPath = path.join(voiceDir, "voice-adapter-interface.js");
  const mockPath = path.join(voiceDir, "voice-mock-adapter.js");
  const routerPath = path.join(voiceDir, "voice-provider-router.js");
  const sessionPath = path.join(voiceDir, "voice-session.js");
  const corePath = path.join(voiceDir, "voice-core.js");

  const g = globalThis;
  Function("global", fs.readFileSync(eventsPath, "utf8"))(g);
  Function("global", fs.readFileSync(adapterPath, "utf8"))(g);
  Function("global", fs.readFileSync(mockPath, "utf8"))(g);
  Function("global", fs.readFileSync(routerPath, "utf8"))(g);
  Function("global", fs.readFileSync(sessionPath, "utf8"))(g);
  Function("global", fs.readFileSync(corePath, "utf8"))(g);

  const Core = g.TasuVoiceCore;
  if (!Core?.startSession) {
    bad("node smoke: TasuVoiceCore API");
    return;
  }
  ok("node smoke: TasuVoiceCore API");

  const events = [];
  const session = Core.createSession({ surface: "test", provider: "mock", kind: "mock" });
  session.receiveEvent((ev) => events.push(ev.type));
  session.startSession({ provider: "mock", kind: "mock" });

  session.sendText("phase1 check");
  session.sendAudio(new Uint8Array([1, 2, 3]));
  session.stopSession();

  const need = ["session_started", "text_delta", "audio_delta_mock", "session_stopped"];
  for (const t of need) {
    if (events.includes(t)) ok(`node smoke event: ${t}`);
    else bad(`node smoke event: ${t}`);
  }

  const resolved = Core.resolveAdapter({ provider: "mock", kind: "mock" });
  if (resolved?.adapter?.id === "mock-local") ok("router selects mock adapter");
  else bad("router selects mock adapter", resolved?.adapter?.id);

  session.sendText("after stop");
  if (events.includes("error_mock") || events.some((e) => e === "error_mock")) {
    ok("inactive session emits error_mock on sendText");
  } else {
    bad("inactive session emits error_mock on sendText");
  }
}

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }

  const testHtml = path.join(voiceDir, "voice-core-test.html");
  const distHtml = path.join(root, "deploy/cloudflare/dist/shared/voice-core/voice-core-test.html");
  const htmlPath = fs.existsSync(distHtml) ? distHtml : testHtml;
  if (!fs.existsSync(htmlPath)) {
    bad("browser smoke: test html missing");
    return;
  }

  const fileUrl = pathToFileURL(htmlPath).href;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => window.TasuVoiceCore?.startSession, null, { timeout: 10000 });

    const result = await page.evaluate(() => {
      const events = [];
      const s = window.TasuVoiceCore.createSession({ surface: "browser", provider: "mock" });
      s.receiveEvent((ev) => events.push(ev.type));
      s.startSession({ provider: "mock", kind: "mock" });
      s.sendText("browser test");
      s.sendAudio(new Uint8Array([9, 8, 7]));
      s.stopSession();
      const adapter = window.TasuVoiceCore.resolveAdapter({ provider: "mock", kind: "mock" });
      return {
        events,
        adapterId: adapter?.adapter?.id || "",
        version: window.TasuVoiceCore.VERSION,
      };
    });

    if (result.adapterId === "mock-local") ok("browser: mock adapter");
    else bad("browser: mock adapter", result.adapterId);

    for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
      if (result.events.includes(t)) ok(`browser event: ${t}`);
      else bad(`browser event: ${t}`);
    }

    if (result.version?.includes("phase")) ok("browser: VERSION tag");
    else bad("browser: VERSION tag");
  } finally {
    await browser.close();
  }
}

console.log("\nRunning node session smoke …");
await nodeSessionSmoke();

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

console.log("\nRunning Builder AI Phase 7 regression …");
const p7 = spawnSync("node", ["scripts/test-builder-ai-ui-phase7.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
if (/=== \d+\/\d+ PASS ===/.test(p7.stdout || "") && !/FAIL:/.test(p7.stdout || "")) {
  ok("builder-ai-ui phase7 regression");
} else {
  bad("builder-ai-ui phase7 regression", (p7.stdout || p7.stderr || "").slice(-200));
}

console.log(`\n=== Voice Core Phase 1: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
