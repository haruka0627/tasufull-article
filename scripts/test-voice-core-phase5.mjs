#!/usr/bin/env node
/**
 * Voice Core Phase 5 — OpenAI Realtime live boundary + WebSocket transport (5-A + 5-B)
 *   node scripts/test-voice-core-phase5.mjs
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

const phase5BoundaryFiles = [
  "voice-realtime-connect-policy.js",
  "voice-realtime-config.js",
  "voice-openai-realtime-wire-client.js",
];

const phase5TransportFile = "transports/voice-openai-realtime-websocket-transport.js";

const loadOrder = [
  "voice-core-events.js",
  "voice-adapter-interface.js",
  "voice-mock-adapter.js",
  "voice-realtime-options.js",
  "voice-realtime-connect-policy.js",
  "voice-realtime-config.js",
  "voice-realtime-event-mapper.js",
  "voice-openai-realtime-wire-client.js",
  phase5TransportFile,
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

for (const name of [...phase5BoundaryFiles, phase5TransportFile]) {
  const p = path.join(voiceDir, name);
  if (fs.existsSync(p)) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

let phase5BoundaryCombined = "";
for (const name of phase5BoundaryFiles) {
  phase5BoundaryCombined += fs.readFileSync(path.join(voiceDir, name), "utf8") + "\n";
}

const adapterSource = fs.readFileSync(path.join(voiceDir, "adapters/voice-openai-realtime-adapter.js"), "utf8");

const transportSource = fs.readFileSync(path.join(voiceDir, phase5TransportFile), "utf8");

const connectionForbidden = [
  /\bfetch\s*\(/,
  /\bnew WebSocket\b/,
  /\bRTCPeerConnection\b/,
  /wss:\/\//,
  /https:\/\/api\./,
  /XMLHttpRequest/,
];

let connHit = false;
for (const re of connectionForbidden) {
  if (re.test(phase5BoundaryCombined)) {
    bad("no forbidden I/O in phase5 boundary files", re.toString());
    connHit = true;
  }
}
if (!connHit) ok("no forbidden I/O in phase5 boundary files");

const adapterForbidden = [/\bnew WebSocket\b/, /\bfetch\s*\(/, /wss:\/\//];
let adapterHit = false;
for (const re of adapterForbidden) {
  if (re.test(adapterSource)) {
    bad("adapter has no direct socket I/O", re.toString());
    adapterHit = true;
  }
}
if (!adapterHit) ok("adapter delegates WebSocket to transport module");

if (/\bWebSocket\b/.test(transportSource)) ok("transport module includes WebSocket");
else bad("transport module includes WebSocket");

const hardcodedHostForbidden = [/wss:\/\/api\.openai\.com/, /https:\/\/api\.openai\.com/];
let hostHit = false;
for (const re of hardcodedHostForbidden) {
  if (re.test(transportSource)) {
    bad("no hardcoded OpenAI host in transport", re.toString());
    hostHit = true;
  }
}
if (!hostHit) ok("no hardcoded OpenAI host in transport");

const secretScanCombined = phase5BoundaryCombined + "\n" + adapterSource + "\n" + transportSource;

const secretForbidden = [/sk-[a-zA-Z0-9]{10,}/, /\bapi[_-]?key\s*[:=]/i, /Bearer\s+[a-zA-Z0-9_-]{20,}/];
let secretHit = false;
for (const re of secretForbidden) {
  if (re.test(secretScanCombined)) {
    bad("no secret strings in phase5 files", re.toString());
    secretHit = true;
  }
}
if (!secretHit) ok("no secret strings in phase5 files");

console.log("\nRunning Phase 5-A policy/config/mapper smoke …");
const Core = loadVoiceCore();
const g = globalThis;

if (Core.VERSION?.includes("phase5b")) ok("VERSION phase5b");
else bad("VERSION phase5b", Core.VERSION);

if (typeof Core.createOpenAiRealtimeWebSocketTransport === "function") ok("export createOpenAiRealtimeWebSocketTransport");
else bad("export createOpenAiRealtimeWebSocketTransport");

const defaultPolicy = Core.resolveConnectPolicy({ mockCompatible: true });
if (defaultPolicy.mode === "mock" && defaultPolicy.allowLive === false) ok("policy default mock");
else bad("policy default mock", JSON.stringify(defaultPolicy));

const disabledPolicy = Core.resolveConnectPolicy({ mockCompatible: false });
if (disabledPolicy.mode === "mock" && disabledPolicy.reason === "live_disabled") ok("policy live_disabled without flag");
else bad("policy live_disabled without flag", JSON.stringify(disabledPolicy));

g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors({ isLiveEnabled: true });
const livePolicy = Core.resolveConnectPolicy({ mockCompatible: false });
if (livePolicy.mode === "live" && livePolicy.allowLive === true) ok("policy live allowed with flag");
else bad("policy live allowed with flag", JSON.stringify(livePolicy));
g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors(null);

const config = Core.createRealtimeConfig({
  getEndpoint: () => "injected-endpoint",
  getModel: () => "injected-model",
  getSessionCredential: async () => ({ type: "ephemeral_token", value: "test-token" }),
});
if (config.getEndpoint() === "injected-endpoint") ok("config endpoint injection");
else bad("config endpoint injection");
if (config.getModel({}) === "injected-model") ok("config model injection");
else bad("config model injection");

const emptyConfig = Core.createRealtimeConfig({});
if (emptyConfig.getEndpoint() === null) ok("config empty endpoint default");
else bad("config empty endpoint default");

const mapper = g.TasuVoiceCoreRealtimeEventMapper;
const normalized = mapper.normalizeOpenAiServerEvent({
  type: "response.audio_transcript.delta",
  delta: "hello",
});
if (normalized?.type === mapper.WIRE_EVENT.RESPONSE_TEXT_DELTA) ok("normalizeOpenAi: audio_transcript.delta");
else bad("normalizeOpenAi: audio_transcript.delta");

const normalizedErr = mapper.normalizeOpenAiServerEvent({
  type: "error",
  error: { code: "rate_limit", message: "slow down" },
});
const mappedErr = mapper.mapWireEventToVoiceCore(normalizedErr, { mockCompatible: false, sessionId: "s1" });
if (mappedErr?.type === "error" && mappedErr.code === "rate_limit") ok("normalize+map OpenAI error (live)");
else bad("normalize+map OpenAI error (live)", mappedErr?.type);

console.log("\nRunning mock-compatible regression …");
const mockEvents = [];
const mockSession = Core.createSession({ surface: "phase5-mock", provider: "openai_realtime", kind: "live" });
mockSession.receiveEvent((ev) => mockEvents.push(ev));
mockSession.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: true });
mockSession.sendText("phase5 mock");
mockSession.sendAudio(new Uint8Array([7, 8]));
mockSession.stopSession();
for (const t of ["session_started", "text_delta", "audio_delta_mock", "session_stopped"]) {
  if (mockEvents.some((ev) => ev.type === t)) ok(`mock-compatible event: ${t}`);
  else bad(`mock-compatible event: ${t}`);
}

console.log("\nRunning live boundary with injectable transport …");
function createFakeTransport() {
  return {
    id: "fake-transport",
    async connect({ onServerEvent, endpoint, credential }) {
      if (!endpoint || !credential?.value) {
        return { ok: false, code: "live_not_configured" };
      }
      onServerEvent({ type: "session.created", session: { id: "fake-live-1" } });
      return { ok: true, sessionId: "fake-live-1" };
    },
    sendText() {
      return { ok: true };
    },
    sendAudio() {
      return { ok: true };
    },
    async close() {
      return { ok: true };
    },
  };
}

g.TasuVoiceCoreOpenAiRealtimeAdapter.setSessionRuntime(
  {
    isLiveEnabled: true,
    getEndpoint: () => "injected-endpoint",
    getModel: () => "injected-model",
    getSessionCredential: async () => ({ type: "ephemeral_token", value: "ephemeral-test" }),
  },
  createFakeTransport()
);

const liveEvents = [];
const liveSession = Core.createSession({ surface: "phase5-live", provider: "openai_realtime", kind: "live" });
liveSession.receiveEvent((ev) => liveEvents.push(ev));
liveSession.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: false });
await new Promise((r) => setTimeout(r, 20));
if (liveEvents.some((ev) => ev.type === "session_started")) ok("injectable transport: session_started");
else bad("injectable transport: session_started", liveEvents.map((e) => e.type).join(","));

liveSession.stopSession();
g.TasuVoiceCoreOpenAiRealtimeAdapter.setSessionRuntime(null, null);

console.log("\nRunning live_disabled + fallback plan …");
const failEvents = [];
const failSession = Core.createSession({ provider: "openai_realtime", kind: "live" });
failSession.receiveEvent((ev) => failEvents.push(ev));
failSession.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: false });
if (failEvents.some((ev) => ev.code === "live_disabled")) ok("live_disabled error without flag");
else bad("live_disabled error without flag", failEvents.map((e) => e.code).join(","));

const router = Core.createFallbackRouter();
const plan = router.resolveStartPlan(
  { provider: "openai_realtime", kind: "live" },
  { mockCompatible: false }
);
if (plan.liveAttempt?.suggestFallback === true) ok("fallback plan suggests fallback on live_disabled");
else bad("fallback plan suggests fallback on live_disabled", JSON.stringify(plan.liveAttempt));

const classified = router.classifyConnectFailure("live_not_configured");
if (classified.retriable && classified.suggestFallback) ok("classifyConnectFailure live_not_configured");
else bad("classifyConnectFailure live_not_configured");

console.log("\nRunning Phase 5-B WebSocket transport (MockWebSocket) …");
const WsTransport = g.TasuVoiceCoreOpenAiRealtimeWebSocketTransport;

class MockWebSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.sent = [];
    MockWebSocket.last = this;
    queueMicrotask(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen({});
    });
  }
  send(data) {
    this.sent.push(data);
  }
  close(code, reason) {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code, reason });
  }
  simulateServer(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}

const urlBuilt = WsTransport.buildConnectUrl("wss://injected.example/v1/realtime", "test-model");
if (urlBuilt.includes("model=test-model")) ok("buildConnectUrl adds model");
else bad("buildConnectUrl adds model", urlBuilt);

const protos = WsTransport.buildSubprotocols({ type: "ephemeral_token", value: "ephemeral-test" });
if (protos?.some((p) => p.includes("openai-insecure-api-key."))) ok("buildSubprotocols ephemeral");
else bad("buildSubprotocols ephemeral");

const wsTransport = WsTransport.createOpenAiRealtimeWebSocketTransport({ WebSocket: MockWebSocket });
const wsEvents = [];
const connectResult = await wsTransport.connect({
  endpoint: "wss://injected.example/v1/realtime",
  credential: { type: "ephemeral_token", value: "ephemeral-test" },
  model: "test-model",
  sessionOptions: { voice: "alloy" },
  onServerEvent: (ev) => wsEvents.push(ev),
});
if (connectResult.ok) ok("MockWebSocket transport connect");
else bad("MockWebSocket transport connect", JSON.stringify(connectResult));

MockWebSocket.last.simulateServer({ type: "session.created", session: { id: "ws-mock-1" } });
if (wsEvents.some((e) => e.type === "session.created")) ok("MockWebSocket onServerEvent");
else bad("MockWebSocket onServerEvent");

const textSent = wsTransport.sendText("hello ws");
if (textSent.ok && MockWebSocket.last.sent.some((s) => s.includes("conversation.item.create"))) {
  ok("MockWebSocket sendText wire event");
} else bad("MockWebSocket sendText wire event");

const audioSent = wsTransport.sendAudio(new Uint8Array([1, 2, 3]));
if (audioSent.ok && MockWebSocket.last.sent.some((s) => s.includes("input_audio_buffer.append"))) {
  ok("MockWebSocket sendAudio wire event");
} else bad("MockWebSocket sendAudio wire event");

await wsTransport.close("test");
if (MockWebSocket.last.readyState === 3) ok("MockWebSocket close");
else bad("MockWebSocket close");

console.log("\nRunning adapter + WebSocket transport opt-in …");
g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors({
  isLiveEnabled: true,
  getEndpoint: () => "wss://injected.example/v1/realtime",
  getModel: () => "test-model",
  getSessionCredential: async () => ({ type: "ephemeral_token", value: "ephemeral-test" }),
  useWebSocketTransport: true,
  webSocketOptions: { WebSocket: MockWebSocket },
});

const wsLiveEvents = [];
const wsLiveSession = Core.createSession({ surface: "phase5b-ws", provider: "openai_realtime", kind: "live" });
wsLiveSession.receiveEvent((ev) => wsLiveEvents.push(ev));
wsLiveSession.startSession({
  provider: "openai_realtime",
  kind: "live",
  mockCompatible: false,
  useWebSocketTransport: true,
  _voiceCoreWebSocketOptions: { WebSocket: MockWebSocket },
});
await new Promise((r) => setTimeout(r, 30));
MockWebSocket.last?.simulateServer({ type: "session.created", session: { id: "ws-live-1" } });
await new Promise((r) => setTimeout(r, 10));
if (wsLiveEvents.some((ev) => ev.type === "session_started")) ok("adapter websocket opt-in: session_started");
else bad("adapter websocket opt-in: session_started", wsLiveEvents.map((e) => e.type).join(","));
wsLiveSession.stopSession();
g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors(null);
g.TasuVoiceCoreOpenAiRealtimeAdapter.setSessionRuntime(null, null);

console.log("\nRunning live flag without websocket opt-in stays noop …");
g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors({
  isLiveEnabled: true,
  getEndpoint: () => "wss://injected.example/v1/realtime",
  getSessionCredential: async () => ({ type: "ephemeral_token", value: "ephemeral-test" }),
});
const noopEvents = [];
const noopSession = Core.createSession({ provider: "openai_realtime", kind: "live" });
noopSession.receiveEvent((ev) => noopEvents.push(ev));
noopSession.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: false });
await new Promise((r) => setTimeout(r, 30));
if (noopEvents.some((ev) => ev.code === "transport_not_configured")) ok("live without ws opt-in: transport_not_configured");
else bad("live without ws opt-in: transport_not_configured", noopEvents.map((e) => e.code).join(","));
g.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors(null);

async function syncCheckDist() {
  const relPaths = [
    "voice-core.js",
    "voice-openai-realtime-wire-client.js",
    phase5TransportFile,
    "adapters/voice-openai-realtime-adapter.js",
    "voice-core-test.html",
  ];
  for (const rel of relPaths) {
    const src = path.join(voiceDir, rel);
    const dist = path.join(root, "deploy/cloudflare/dist/shared/voice-core", rel);
    if (!fs.existsSync(dist)) {
      bad(`dist mirror exists: ${rel}`);
      continue;
    }
    const a = fs.readFileSync(src, "utf8");
    const b = fs.readFileSync(dist, "utf8");
    if (rel.endsWith(".html")) {
      const marker = "transports/voice-openai-realtime-websocket-transport.js";
      if (a.includes(marker) && b.includes(marker)) ok(`source/dist html marker: ${rel}`);
      else bad(`source/dist html marker: ${rel}`);
      continue;
    }
    if (a === b) ok(`source/dist match: ${rel}`);
    else bad(`source/dist match: ${rel}`);
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

  const distHtml = path.join(root, "deploy/cloudflare/dist/shared/voice-core/voice-core-test.html");
  const htmlPath = fs.existsSync(distHtml) ? distHtml : path.join(voiceDir, "voice-core-test.html");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => window.TasuVoiceCore?.resolveConnectPolicy, null, { timeout: 10000 });
    const result = await page.evaluate(() => {
      const policy = window.TasuVoiceCore.resolveConnectPolicy({ mockCompatible: true });
      const events = [];
      const s = window.TasuVoiceCore.createSession({ provider: "openai_realtime", kind: "live" });
      s.receiveEvent((ev) => events.push(ev.type));
      s.startSession({ provider: "openai_realtime", kind: "live", mockCompatible: true });
      s.sendText("browser phase5");
      s.stopSession();
      return { policyMode: policy.mode, events, version: window.TasuVoiceCore.VERSION };
    });
    if (result.policyMode === "mock") ok("browser: default policy mock");
    else bad("browser: default policy mock", result.policyMode);
    if (result.version?.includes("phase5b")) ok("browser: VERSION phase5b");
    else bad("browser: VERSION phase5b", result.version);
    if (result.events.includes("session_started")) ok("browser: mock session_started");
    else bad("browser: mock session_started");
  } finally {
    await browser.close();
  }
}

function runRegression(script, pattern) {
  const r = spawnSync("node", [script], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, TASFUL_SKIP_PAGES_BUILD: "1" },
  });
  const out = (r.stdout || "") + (r.stderr || "");
  if (pattern.test(out) && !/FAIL:/.test(out)) ok(`${path.basename(script)} regression`);
  else bad(`${path.basename(script)} regression`, out.slice(-250));
}

console.log("\nRunning build:pages …");
if (process.env.TASFUL_SKIP_PAGES_BUILD === "1") {
  ok("build:pages SKIP (nested regression)");
} else {
  const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, shell: true, encoding: "utf8" });
  if (build.status === 0) ok("build:pages PASS");
  else bad("build:pages", (build.stderr || build.stdout || "").slice(0, 300) || String(build.status));
}

console.log("\nRunning source ↔ dist sync …");
await syncCheckDist();

console.log("\nRunning browser smoke …");
await browserSmoke();

console.log("\nRunning Voice Core Phase 1–4 regressions …");
runRegression("scripts/test-voice-core-phase1.mjs", /=== Voice Core Phase 1: \d+\/\d+ PASS ===/);
runRegression("scripts/test-voice-core-phase2.mjs", /=== Voice Core Phase 2: \d+\/\d+ PASS ===/);
runRegression("scripts/test-voice-core-phase3.mjs", /=== Voice Core Phase 3: \d+\/\d+ PASS ===/);
runRegression("scripts/test-voice-core-phase4.mjs", /=== Voice Core Phase 4: \d+\/\d+ PASS ===/);

console.log("\nRunning Builder AI Phase 7 regression …");
runRegression("scripts/test-builder-ai-ui-phase7.mjs", /=== \d+\/\d+ PASS ===/);

console.log(`\n=== Voice Core Phase 5: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
