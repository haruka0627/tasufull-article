#!/usr/bin/env node
/**
 * Voice Core Phase 4 — STT / TTS / Fallback skeleton (mock-only)
 *   node scripts/test-voice-core-phase4.mjs
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

const phase4Files = [
  "stt/voice-stt-adapter-interface.js",
  "stt/voice-stt-mock-adapter.js",
  "tts/voice-tts-adapter-interface.js",
  "tts/voice-tts-mock-adapter.js",
  "voice-fallback-router.js",
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
  "stt/voice-stt-adapter-interface.js",
  "stt/voice-stt-mock-adapter.js",
  "tts/voice-tts-adapter-interface.js",
  "tts/voice-tts-mock-adapter.js",
  "voice-fallback-router.js",
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

for (const name of phase4Files) {
  const p = path.join(voiceDir, name);
  if (fs.existsSync(p)) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

let phase4Combined = "";
for (const rel of phase4Files) {
  phase4Combined += fs.readFileSync(path.join(voiceDir, rel), "utf8") + "\n";
}

const connectionForbidden = [
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bRTCPeerConnection\b/,
  /wss:\/\//,
  /XMLHttpRequest/,
  /\bMediaRecorder\b/,
  /\bgetUserMedia\b/,
  /\bspeechSynthesis\b/,
  /\bSpeechRecognition\b/,
  /\bwebkitSpeechRecognition\b/,
];

let connHit = false;
for (const re of connectionForbidden) {
  if (re.test(phase4Combined)) {
    bad("no forbidden I/O in phase4 files", re.toString());
    connHit = true;
  }
}
if (!connHit) ok("no forbidden I/O in phase4 files");

console.log("\nRunning STT/TTS/Fallback smoke …");
const Core = loadVoiceCore();
const g = globalThis;

const stt = Core.createSTTAdapter({ provider: "mock" });
if (stt?.id === "stt-mock-local") ok("STT adapter created");
else bad("STT adapter created");

try {
  g.TasuVoiceCoreSttAdapterInterface.assertSttAdapter(stt);
  ok("STT interface assertSttAdapter");
} catch (e) {
  bad("STT interface assertSttAdapter", e.message);
}

const sttResult = stt.recognize(new Uint8Array([10, 20]), { language: "ja-JP" });
if (sttResult.text?.includes("mock transcript")) ok("STT mock recognition");
else bad("STT mock recognition");

const sttTypes = sttResult.events.map((e) => e.type);
for (const t of ["stt_recognition_started_mock", "stt_partial_mock", "stt_final_mock"]) {
  if (sttTypes.includes(t)) ok(`STT event flow: ${t}`);
  else bad(`STT event flow: ${t}`);
}

const tts = Core.createTTSAdapter({ provider: "mock" });
if (tts?.id === "tts-mock-local") ok("TTS adapter created");
else bad("TTS adapter created");

try {
  g.TasuVoiceCoreTtsAdapterInterface.assertTtsAdapter(tts);
  ok("TTS interface assertTtsAdapter");
} catch (e) {
  bad("TTS interface assertTtsAdapter", e.message);
}

const ttsResult = tts.synthesize("phase4 hello", { language: "ja-JP" });
if (ttsResult.audio?.bytes?.length > 0) ok("TTS mock synthesis audio");
else bad("TTS mock synthesis audio");

const ttsTypes = ttsResult.events.map((e) => e.type);
for (const t of ["tts_synthesis_started_mock", "tts_audio_chunk_mock", "tts_synthesis_done_mock"]) {
  if (ttsTypes.includes(t)) ok(`TTS event flow: ${t}`);
  else bad(`TTS event flow: ${t}`);
}

const emptyTts = tts.synthesize("  ");
if (emptyTts?.type === "tts_error_mock") ok("TTS error handling: empty text");
else bad("TTS error handling: empty text");

const router = Core.createFallbackRouter();
if (router?.getPrimary && router?.routeOnFailure) ok("Fallback router created");
else bad("Fallback router created");

const primary = router.getPrimary();
if (primary?.provider === "openai_realtime") ok("Fallback primary: openai_realtime");
else bad("Fallback primary: openai_realtime", primary?.provider);

const plan = router.getFallbackPlan();
if (plan.length === 3 && plan[2]?.provider === "mock") ok("Fallback plan chain");
else bad("Fallback plan chain");

const next = router.routeOnFailure("openai_realtime");
if (next.nextProvider === "gemini_live" && next.skeleton === true) ok("Fallback route: openai → gemini");
else bad("Fallback route: openai → gemini");

const mockNext = router.routeOnFailure("gemini_live");
if (mockNext.nextProvider === "mock") ok("Fallback route: gemini → mock");
else bad("Fallback route: gemini → mock");

const exhausted = router.routeOnFailure("mock");
if (exhausted.type === "fallback_exhausted_mock") ok("Fallback error handling: exhausted");
else bad("Fallback error handling: exhausted");

const walk = router.simulateFallbackWalk("openai_realtime");
if (walk.steps?.length >= 2 && walk.skeleton === true) ok("Fallback mock routing walk");
else bad("Fallback mock routing walk");

if (
  Core.createSTTAdapter &&
  Core.createTTSAdapter &&
  Core.createFallbackRouter &&
  Core.VoiceFallbackRouter &&
  Core.DEFAULT_LIVE_CHAIN?.length >= 3
) {
  ok("Voice Core exports STT/TTS/Fallback");
} else {
  bad("Voice Core exports STT/TTS/Fallback");
}

const liveResolved = Core.resolveAdapter({ provider: "gemini_live", kind: "live" });
if (liveResolved?.adapter?.id === "gemini-live-skeleton") ok("session/provider integration: gemini_live");
else bad("session/provider integration: gemini_live");

const session = Core.createSession({ surface: "phase4", provider: "mock", kind: "mock" });
session.startSession({ provider: "mock", kind: "mock" });
if (session.active) ok("session integration: mock session active");
else bad("session integration: mock session active");
session.stopSession();

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
    await page.waitForFunction(() => window.TasuVoiceCore?.createSTTAdapter, null, { timeout: 10000 });
    const result = await page.evaluate(() => {
      const stt = window.TasuVoiceCore.createSTTAdapter({ provider: "mock" });
      const sttOut = stt.recognize(new Uint8Array([5]), { language: "ja-JP" });
      const tts = window.TasuVoiceCore.createTTSAdapter({ provider: "mock" });
      const ttsOut = tts.synthesize("browser phase4");
      const fb = window.TasuVoiceCore.createFallbackRouter();
      const next = fb.routeOnFailure("openai_realtime");
      return {
        sttOk: sttOut.text.includes("mock transcript"),
        ttsOk: ttsOut.events.some((e) => e.type === "tts_audio_chunk_mock"),
        fbOk: next.nextProvider === "gemini_live",
        version: window.TasuVoiceCore.VERSION,
      };
    });
    if (result.sttOk) ok("browser: STT mock");
    else bad("browser: STT mock");
    if (result.ttsOk) ok("browser: TTS mock");
    else bad("browser: TTS mock");
    if (result.fbOk) ok("browser: Fallback mock");
    else bad("browser: Fallback mock");
    if (result.version?.includes("phase")) ok("browser: VERSION phase4");
    else bad("browser: VERSION phase4", result.version);
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

function runRegression(script, pattern) {
  const r = spawnSync("node", [script], { cwd: root, encoding: "utf8", shell: true });
  if (pattern.test(r.stdout || "") && !/FAIL:/.test(r.stdout || "")) ok(`${script} regression`);
  else bad(`${script} regression`, (r.stdout || r.stderr || "").slice(-200));
}

console.log("\nRunning Voice Core Phase 1 regression …");
runRegression("scripts/test-voice-core-phase1.mjs", /=== Voice Core Phase 1: \d+\/\d+ PASS ===/);

console.log("\nRunning Voice Core Phase 2 regression …");
runRegression("scripts/test-voice-core-phase2.mjs", /=== Voice Core Phase 2: \d+\/\d+ PASS ===/);

console.log("\nRunning Voice Core Phase 3 regression …");
runRegression("scripts/test-voice-core-phase3.mjs", /=== Voice Core Phase 3: \d+\/\d+ PASS ===/);

console.log("\nRunning Builder AI Phase 7 regression …");
runRegression("scripts/test-builder-ai-ui-phase7.mjs", /=== \d+\/\d+ PASS ===/);

console.log(`\n=== Voice Core Phase 4: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
