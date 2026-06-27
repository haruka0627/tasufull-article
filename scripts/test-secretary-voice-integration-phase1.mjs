#!/usr/bin/env node
/**
 * AI 秘書 Voice Integration Phase 1
 *   node scripts/test-secretary-voice-integration-phase1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { TextEncoder, TextDecoder } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const voiceDir = path.join(root, "shared/voice-core");

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

const SECRETARY_VOICE_FILES = [
  "admin-ai-secretary-voice-controller.js",
  "admin-ai-secretary-voice-integration.js",
  "admin-ai-secretary-voice.js",
];

const PHASE6_LOAD = [
  "admin-ai-secretary-ops-data-provider.js",
  "admin-ai-secretary-insight-engine.js",
  "admin-ai-secretary-priority-engine.js",
  "admin-ai-secretary-suggestion-engine.js",
  "admin-ai-secretary-operations-engine.js",
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
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    addEventListener() {},
    dispatchEvent() {},
    sessionStorage: {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = v;
      },
      removeItem(k) {
        delete this._data[k];
      },
    },
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
  for (const name of PHASE6_LOAD) {
    vm.runInNewContext(fs.readFileSync(path.join(root, name), "utf8"), sandbox, { filename: name });
  }
  for (const name of SECRETARY_VOICE_FILES) {
    vm.runInNewContext(fs.readFileSync(path.join(root, name), "utf8"), sandbox, { filename: name });
  }
  return sandbox;
}

for (const name of SECRETARY_VOICE_FILES) {
  if (fs.existsSync(path.join(root, name))) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

const html = fs.readFileSync(path.join(root, "admin-operations-dashboard.html"), "utf8");
const phase2Js = fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8");
let combined = SECRETARY_VOICE_FILES.map((n) => fs.readFileSync(path.join(root, n), "utf8")).join("\n");
combined += phase2Js;

if (html.includes("admin-ai-secretary-voice-controller.js") && html.includes("voice-core.js")) {
  ok("html loads voice core + secretary controller");
} else bad("html loads voice core + secretary controller");

if (html.includes("data-ops-secretary-voice-state") && html.includes("data-ops-secretary-voice")) {
  ok("html voice button + state marker");
} else bad("html voice button + state marker");

if (phase2Js.includes("async function submit") && phase2Js.includes("TasuSecretaryVoiceIntegration")) {
  ok("phase2 unified submit");
} else bad("phase2 unified submit");

if (phase2Js.includes("dispatchSecretaryMessage") && phase2Js.includes("opsAnalysis")) {
  ok("phase2 ops intelligence path");
} else bad("phase2 ops intelligence path");

if (html.includes("voice-realtime-session-client.js")) ok("html loads session client");
else bad("html loads session client");

if (combined.includes("__TASU_VOICE_LIVE_OPS_SECRETARY__") && combined.includes("isLiveOptInEnabled")) {
  ok("live opt-in flags defined");
} else bad("live opt-in flags defined");

if (combined.includes('surface: "ops_secretary"') || combined.includes("surface: 'ops_secretary'")) {
  ok("ops_secretary surface");
} else bad("ops_secretary surface");

console.log("\nRunning controller …");
const ctx = loadSandbox();
const Ctrl = ctx.TasuSecretaryVoiceController;
const init = Ctrl.init({ surface: "ops_secretary", mockCompatible: true, useWebSocketTransport: false, sessionTimeoutMs: 5000 });
if (init.ok) ok("controller init");
else bad("controller init", init.error);

if (Ctrl.isLiveOptInEnabled?.() === false) ok("live opt-in OFF by default");
else bad("live opt-in OFF by default");

const started = await Ctrl.startSession();
if (started.ok && started.sessionId) ok("voice session start");
else bad("voice session start", JSON.stringify(started));

const stopped = Ctrl.stopSession("test");
if (stopped.ok) ok("voice session stop");
else bad("voice session stop");

const re = await Ctrl.reconnectSession();
if (re.ok) ok("voice session reconnect");
else bad("voice session reconnect");

Ctrl.startSession();
await new Promise((r) => setTimeout(r, 10));
Ctrl.handleSessionTimeout();
if (Ctrl.getState().detail === "session_timeout" || Ctrl.getState().state === "ready") ok("session timeout");
else bad("session timeout", JSON.stringify(Ctrl.getState()));

console.log("\nRunning integration + operations engine …");
const opsRuns = [];
const Engine = ctx.TasuSecretaryOperationsEngine;
const origRun = Engine.runAnalysis.bind(Engine);
Engine.runAnalysis = async (opts) => {
  opsRuns.push(opts);
  return origRun(opts);
};

const submits = [];
const Integration = ctx.TasuSecretaryVoiceIntegration;
Integration.init({
  surface: "ops_secretary",
  onSubmit: async (p) => {
    submits.push(p);
  },
});

const textOut = await Integration.submit({ channel: "text", text: "本日の優先対応は？" });
if (textOut.ok && submits.length === 1 && submits[0].channel === "text") ok("text submit via integration");
else bad("text submit via integration");

if (opsRuns.length >= 1 && opsRuns[0]?.ctx?.userText === "本日の優先対応は？") {
  ok("operations engine invoked on text submit");
} else bad("operations engine invoked on text submit");

if (submits[0]?.meta?.opsAnalysis?.ok) ok("opsAnalysis attached to submit payload");
else bad("opsAnalysis attached to submit payload");

const voiceCap = await Ctrl.captureVoiceInput();
if (voiceCap.ok && voiceCap.text) ok("mock voice capture");
else bad("mock voice capture", JSON.stringify(voiceCap));

const voiceOut = await Integration.submit({ channel: "voice", text: voiceCap.text });
if (voiceOut.ok && submits.some((s) => s.channel === "voice")) ok("voice submit via integration");
else bad("voice submit via integration");

if (submits.filter((s) => s.channel === "voice").every((s) => s.options?.fromVoice === true)) {
  ok("voice submit flags fromVoice");
} else bad("voice submit flags fromVoice");

if (opsRuns.some((r) => r?.ctx?.channel === "voice")) ok("operations engine invoked on voice submit");
else bad("operations engine invoked on voice submit");

console.log("\nRunning voice-core isolation …");
const vcCombined = fs.readFileSync(path.join(voiceDir, "voice-core.js"), "utf8");
if (!vcCombined.includes("TasuSecretaryVoiceController")) ok("voice-core unchanged by secretary");
else bad("voice-core unchanged by secretary");

function runRegression(script, pattern) {
  const r = spawnSync("node", [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TASFUL_SKIP_PAGES_BUILD: "1" },
  });
  const out = (r.stdout || "") + (r.stderr || "");
  if (pattern.test(out) && !/FAIL:/.test(out)) ok(`${path.basename(script)} regression`);
  else bad(`${path.basename(script)} regression`, out.slice(-220));
}

console.log("\nRunning secretary regressions …");
runRegression("scripts/test-secretary-operations-phase6.mjs", /25\/25 PASS|PASS:/);

console.log(`\n=== Secretary Voice Integration Phase 1: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
