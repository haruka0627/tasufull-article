#!/usr/bin/env node
/**
 * Builder AI Voice Integration Phase 1
 *   node scripts/test-builder-voice-integration-phase1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { TextEncoder, TextDecoder } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const voiceDir = path.join(root, "shared/voice-core");
const builderDir = path.join(root, "builder");

const VOICE_CORE_LOAD = [
  "voice-core-events.js",
  "voice-adapter-interface.js",
  "voice-mock-adapter.js",
  "voice-realtime-options.js",
  "voice-realtime-connect-policy.js",
  "voice-realtime-config.js",
  "voice-realtime-event-mapper.js",
  "voice-openai-realtime-wire-client.js",
  "transports/voice-openai-realtime-websocket-transport.js",
  "adapters/voice-openai-realtime-adapter.js",
  "voice-provider-router.js",
  "voice-session.js",
  "voice-core.js",
];

const BUILDER_VOICE_FILES = [
  "builder-voice-controller.js",
  "builder-ai-voice-integration.js",
  "builder-ai-voice.js",
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

function loadSandbox(extra = {}) {
  const sandbox = {
    window: {},
    document: { readyState: "complete", addEventListener() {} },
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    ...extra,
  };
  sandbox.global = sandbox.window = sandbox;
  for (const name of VOICE_CORE_LOAD) {
    vm.runInNewContext(fs.readFileSync(path.join(voiceDir, name), "utf8"), sandbox, { filename: name });
  }
  for (const name of BUILDER_VOICE_FILES) {
    vm.runInNewContext(fs.readFileSync(path.join(builderDir, name), "utf8"), sandbox, { filename: name });
  }
  return sandbox;
}

for (const name of BUILDER_VOICE_FILES) {
  if (fs.existsSync(path.join(builderDir, name))) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

const html = fs.readFileSync(path.join(builderDir, "builder-ai.html"), "utf8");
const uiJs = fs.readFileSync(path.join(builderDir, "builder-ai-ui.js"), "utf8");
let combined = BUILDER_VOICE_FILES.map((n) => fs.readFileSync(path.join(builderDir, n), "utf8")).join("\n");

if (html.includes("builder-voice-controller.js") && html.includes("voice-core.js")) ok("html loads voice core + controller");
else bad("html loads voice core + controller");

if (html.includes("data-builder-ai-voice-state")) ok("html voice state marker");
else bad("html voice state marker");

if (uiJs.includes("async function submit") && uiJs.includes("TasuBuilderVoiceIntegration")) ok("ui unified submit");
else bad("ui unified submit");

if (!combined.includes("useWebSocketTransport: true")) ok("no useWebSocketTransport true");
else bad("no useWebSocketTransport true");

const secretForbidden = [/sk-[a-zA-Z0-9]{10,}/, /\bDEEPSEEK_API_KEY\b/];
let secretHit = false;
for (const re of secretForbidden) {
  if (re.test(combined)) {
    bad("no secrets", re.toString());
    secretHit = true;
  }
}
if (!secretHit) ok("no secrets in builder voice layer");

console.log("\nRunning controller …");
const ctx = loadSandbox();
const Ctrl = ctx.TasuBuilderVoiceController;
const init = Ctrl.init({ surface: "builder_ai", mockCompatible: true, useWebSocketTransport: false, sessionTimeoutMs: 5000 });
if (init.ok) ok("controller init");
else bad("controller init", init.error);

const started = Ctrl.startSession();
if (started.ok && started.sessionId) ok("voice session start");
else bad("voice session start", JSON.stringify(started));

const stopped = Ctrl.stopSession("test");
if (stopped.ok) ok("voice session stop");
else bad("voice session stop");

const re = await Ctrl.reconnectSession();
if (re.ok) ok("voice session reconnect");
else bad("voice session reconnect");

Ctrl.startSession();
Ctrl.handleSessionTimeout();
if (Ctrl.getState().detail === "session_timeout" || Ctrl.getState().state === "ready") ok("session timeout");
else bad("session timeout", JSON.stringify(Ctrl.getState()));

console.log("\nRunning integration submit …");
const submits = [];
const Integration = ctx.TasuBuilderVoiceIntegration;
Integration.init({
  surface: "builder_ai",
  onSubmit: async (p) => {
    submits.push(p);
  },
});

const textOut = await Integration.submit({ channel: "text", text: "hello builder" });
if (textOut.ok && submits.length === 1 && submits[0].channel === "text") ok("text submit via integration");
else bad("text submit via integration");

const voiceCap = await Ctrl.captureVoiceInput();
if (voiceCap.ok && voiceCap.text) ok("mock voice capture");
else bad("mock voice capture", JSON.stringify(voiceCap));

const voiceOut = await Integration.submit({ channel: "voice", text: voiceCap.text });
if (voiceOut.ok && submits.some((s) => s.channel === "voice")) ok("voice submit via integration");
else bad("voice submit via integration");

if (submits.filter((s) => s.channel === "voice").every((s) => s.options?.fromVoice === true)) {
  ok("voice submit flags fromVoice");
} else bad("voice submit flags fromVoice");

console.log("\nRunning voice-core isolation …");
const vcCombined = fs.readFileSync(path.join(voiceDir, "voice-core.js"), "utf8");
if (!vcCombined.includes("TasuBuilderVoiceController")) ok("voice-core unchanged by builder");
else bad("voice-core unchanged by builder");

if (uiJs.includes("UI_LOCAL_ONLY") && uiJs.includes("buildLocalStoreConsultReply")) ok("builder ui phase7 invariants preserved");
else bad("builder ui phase7 invariants preserved");

function runRegression(script, pattern) {
  const r = spawnSync("node", [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TASFUL_SKIP_PAGES_BUILD: "1" },
  });
  const out = (r.stdout || "") + (r.stderr || "");
  if (pattern.test(out) && !/FAIL:/.test(out)) ok(`${path.basename(script)} regression`);
  else bad(`${path.basename(script)} regression`, out.slice(-180));
}

console.log("\nRunning Builder AI regressions …");
runRegression("scripts/test-builder-ai-calc-phase3.mjs", /PASS|===/);

console.log(`\n=== Builder Voice Integration Phase 1: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
