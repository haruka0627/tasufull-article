#!/usr/bin/env node
/**
 * Live Platform — ZEGO Adapter Phase 1 unit tests
 *
 *   node scripts/test-platform-live-zego-adapter-phase1.mjs
 *   npm run test:platform-live-zego-adapter-phase1
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const POC_PATH = "live/providers/zego-live-provider.js";
const INTERFACE_PATH = "platform-live/provider/live-provider-interface.js";
const ADAPTER_PATH = "platform-live/provider/adapters/zego-live-provider-adapter.js";
const FACTORY_PATH = "platform-live/provider/create-platform-live-provider.js";

const BASE_LOAD = [
  "platform-live/core/live-provider-signals.js",
  "platform-live/broadcast/live-broadcast-provider-signals.js",
  "platform-live/provider/live-provider-types.js",
  INTERFACE_PATH,
  "platform-live/provider/stub-live-provider.js",
  ADAPTER_PATH,
  FACTORY_PATH,
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-core-phase-a",
  "test:platform-live-broadcast-phase-b",
  "test:platform-live-viewer-phase-c",
  "test:platform-live-chat-phase-d",
  "test:platform-live-recording-phase-e",
  "test:platform-live-monitoring-phase-f",
];

const summary = { pass: 0, fail: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, id, detail = "") {
  if (cond) pass(id, detail);
  else fail(id, detail);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha(rel) {
  return read(rel);
}

function loadRuntime(extra = {}) {
  const fetchCalls = [];
  const mockFetch = async (url, init) => {
    fetchCalls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    if (extra.fetchHandler) return extra.fetchHandler(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: "mock-token-abc",
        appId: 12345,
        server: "wss://mock.zego.im",
        role: JSON.parse(init.body).role === "host" ? "host" : "audience",
        configured: true,
      }),
    };
  };

  const context = {
    console,
    Date,
    Promise,
    Error,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    fetch: mockFetch,
    PLATFORM_LIVE_ZEGO_CONFIG: {
      appId: 12345,
      server: "wss://mock.zego.im",
      tokenApiPath: "/api/tlv-zego-token",
    },
  };
  context.window = context;
  context.globalThis = context;

  class MockTlvZegoLiveProvider {
    constructor() {
      this._state = "idle";
      this._initArgs = null;
      this._startArgs = null;
      this._joinArgs = null;
      this.endLiveCalls = 0;
      this.leaveLiveCalls = 0;
      this.disposeCalls = 0;
    }
    get providerId() {
      return "zego";
    }
    get state() {
      return this._state;
    }
    async initialize(options) {
      this._initArgs = options;
      this._state = "ready";
      return { ok: true, state: this._state };
    }
    async startLive(options) {
      this._startArgs = options;
      this._state = "live";
      return { ok: true, state: this._state };
    }
    async joinLive(options) {
      this._joinArgs = options;
      this._state = "watching";
      return { ok: true, state: this._state };
    }
    async leaveLive() {
      this.leaveLiveCalls += 1;
      this._state = "ready";
      return { ok: true, state: this._state };
    }
    async endLive() {
      this.endLiveCalls += 1;
      this._state = "ready";
      return { ok: true, state: this._state };
    }
    async dispose() {
      this.disposeCalls += 1;
      this._state = "disposed";
      return { ok: true, state: this._state };
    }
  }

  context.TlvZegoLiveProvider = extra.MockPoc || MockTlvZegoLiveProvider;

  const ctx = vm.createContext(context);
  for (const rel of BASE_LOAD) {
    vm.runInContext(read(rel), ctx);
  }

  return { ctx, fetchCalls, MockTlvZegoLiveProvider };
}

const INTERFACE_METHODS = [
  "initialize",
  "startLive",
  "joinLive",
  "leaveLive",
  "endLive",
  "reconnectLive",
  "startBroadcast",
  "stopBroadcast",
  "getBroadcastHealth",
  "updateViewerCount",
  "joinViewer",
  "leaveViewer",
  "reconnectViewer",
  "viewerHeartbeat",
  "sendChatMessage",
  "addChatReaction",
  "removeChatReaction",
  "emitChatSystemEvent",
  "startRecording",
  "stopRecording",
  "getRecordingStatus",
  "getArchiveMetadata",
  "getMonitoringProbe",
  "dispose",
  "onSignal",
  "onBroadcastSignal",
];

async function run() {
  console.log("\n=== Live Platform ZEGO Adapter — Phase 1 ===\n");

  const pocBefore = sha(POC_PATH);
  const ifaceBefore = sha(INTERFACE_PATH);

  // --- Static / unchanged files ---
  console.log("--- Unchanged sources ---\n");
  assert(fs.existsSync(path.join(ROOT, ADAPTER_PATH)), "static:adapter-exists");
  assert(read(POC_PATH) === pocBefore, "static:tlv-poc-unchanged-on-disk");
  assert(read(INTERFACE_PATH) === ifaceBefore, "static:interface-unchanged-on-disk");
  assert(!read(ADAPTER_PATH).includes("ZegoExpressEngine"), "static:adapter-no-direct-sdk");

  const { ctx, fetchCalls } = loadRuntime();
  const SIG = ctx.PLATFORM_LIVE_PROVIDER_SIGNALS;
  const BSIG = ctx.PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS;
  const createProvider = ctx.createPlatformLiveProvider;
  const Adapter = ctx.ZegoLiveProviderAdapter;
  const Base = ctx.PlatformLiveProviderInterface;

  // --- Interface conformance ---
  console.log("\n--- Interface conformance ---\n");
  {
    const adapter = new Adapter();
    assert(adapter instanceof Base, "iface:extends-base");
    assert(adapter.isZegoAdapter === true, "iface:isZegoAdapter");
    assert(adapter.providerId === "zego", "iface:providerId");
    for (const name of INTERFACE_METHODS) {
      assert(typeof adapter[name] === "function", `iface:method:${name}`);
    }
  }

  // --- Factory ---
  console.log("\n--- Factory ---\n");
  {
    const noPocCtx = vm.createContext({
      console,
      Date,
      Promise,
      Error,
      Set,
      Map,
      Array,
      Object,
      String,
      Number,
      Boolean,
      window: {},
      globalThis: {},
    });
    noPocCtx.window = noPocCtx;
    noPocCtx.globalThis = noPocCtx;
    for (const rel of [
      "platform-live/core/live-provider-signals.js",
      "platform-live/broadcast/live-broadcast-provider-signals.js",
      "platform-live/provider/live-provider-types.js",
      INTERFACE_PATH,
      "platform-live/provider/stub-live-provider.js",
      ADAPTER_PATH,
      FACTORY_PATH,
    ]) {
      vm.runInContext(read(rel), noPocCtx);
    }
    const fallback = noPocCtx.createPlatformLiveProvider("zego", { allowStubFallback: true });
    assert(fallback.providerId === "stub", "factory:env-missing-stub-fallback");
    assert(noPocCtx.isPlatformLiveStubFallback(fallback), "factory:stub-fallback-flag");

    const adapter = createProvider("zego", { allowStubFallback: true });
    assert(adapter.isZegoAdapter === true, "factory:zego-returns-adapter");
    assert(!ctx.isPlatformLiveStubFallback(adapter), "factory:adapter-not-stub-fallback");
  }

  // --- initialize ---
  console.log("\n--- initialize ---\n");
  {
    const adapter = new Adapter();
    const init = await adapter.initialize({ surface: "platform" });
    assert(init.ok && init.adapter === true, "init:ok");
    assert(adapter.state === "ready", "init:state-ready");

    const bad = new Adapter({ config: { appId: 0, server: "" } });
    const badRes = await bad.initialize({ surface: "platform" });
    assert(!badRes.ok, "init:missing-config-fails");
  }

  // --- publish / host token ---
  console.log("\n--- publish (host token) ---\n");
  {
    fetchCalls.length = 0;
    const adapter = new Adapter();
    const poc = adapter._poc;
    await adapter.initialize({ surface: "platform" });

    const signals = [];
    const bsignals = [];
    adapter.onSignal((s, p) => signals.push({ s, p }));
    adapter.onBroadcastSignal((s, p) => bsignals.push({ s, p }));

    const videoContainer = { id: "vc-host" };
    const res = await adapter.startLive({
      surface: "platform",
      roomId: "room-1",
      userId: "host-1",
      videoContainer,
      broadcastId: "bc-1",
    });

    assert(res.ok, "publish:startLive-ok");
    assert(fetchCalls.length === 1, "publish:token-fetch-once");
    assert(fetchCalls[0].url === "/api/tlv-zego-token", "publish:token-api-path");
    assert(fetchCalls[0].body.role === "host", "publish:token-role-host");
    assert(poc._startArgs?.token === "mock-token-abc", "publish:token-passed-to-poc");
    assert(poc._startArgs?.videoContainer === videoContainer, "publish:videoContainer-passed");
    assert(
      signals.some((x) => x.s === SIG.PROVIDER_CONNECTED),
      "publish:connected-signal",
    );
    assert(
      bsignals.some((x) => x.s === BSIG.BROADCAST_PROVIDER_STARTED),
      "publish:broadcast-started-signal",
    );
  }

  // --- subscribe / audience token ---
  console.log("\n--- subscribe (audience token) ---\n");
  {
    fetchCalls.length = 0;
    const adapter = new Adapter();
    const poc = adapter._poc;
    await adapter.initialize({ surface: "platform" });

    const res = await adapter.joinLive({
      surface: "platform",
      roomId: "room-2",
      userId: "viewer-1",
      videoContainer: { id: "vc-viewer" },
    });

    assert(res.ok, "subscribe:joinLive-ok");
    assert(fetchCalls[0].body.role === "audience", "subscribe:token-role-audience");
    assert(poc._joinArgs?.token === "mock-token-abc", "subscribe:token-to-poc");
  }

  // --- joinViewer / startBroadcast ---
  console.log("\n--- joinViewer / startBroadcast ---\n");
  {
    const adapter = new Adapter();
    await adapter.initialize({ surface: "platform" });
    const jv = await adapter.joinViewer({
      surface: "platform",
      broadcastId: "bc-v",
      roomId: "room-v",
      userId: "v1",
    });
    assert(jv.ok && adapter.state === "watching", "joinViewer:ok");

    fetchCalls.length = 0;
    const adapter2 = new Adapter();
    await adapter2.initialize({ surface: "platform" });
    const sb = await adapter2.startBroadcast({
      surface: "platform",
      broadcastId: "bc-h",
      roomId: "room-h",
      userId: "h1",
    });
    assert(sb.ok && fetchCalls[0].body.role === "host", "startBroadcast:host-token");
  }

  // --- reconnect ---
  console.log("\n--- reconnect ---\n");
  {
    fetchCalls.length = 0;
    const adapter = new Adapter();
    const poc = adapter._poc;
    await adapter.initialize({ surface: "platform" });
    await adapter.startLive({
      surface: "platform",
      roomId: "room-r",
      userId: "host-r",
      videoContainer: { id: "vc-r" },
    });
    assert(fetchCalls.length === 1, "reconnect:initial-token-fetch");

    fetchCalls.length = 0;
    const signals = [];
    adapter.onSignal((s) => signals.push(s));

    const recon = await adapter.reconnectLive();
    assert(recon.ok, "reconnect:ok");
    assert(poc.endLiveCalls >= 1, "reconnect:host-endLive");
    assert(fetchCalls.length >= 1, "reconnect:refetch-token");
    assert(signals.includes(SIG.PROVIDER_RECONNECTING), "reconnect:reconnecting-signal");
    assert(signals.includes(SIG.PROVIDER_RECONNECTED), "reconnect:reconnected-signal");
  }

  // --- stop / disconnect ---
  console.log("\n--- stop / disconnect ---\n");
  {
    const adapter = new Adapter();
    const poc = adapter._poc;
    await adapter.initialize({ surface: "platform" });
    await adapter.startLive({
      surface: "platform",
      roomId: "room-s",
      userId: "host-s",
      manualToken: "t",
    });

    const end = await adapter.endLive();
    assert(end.ok && poc.endLiveCalls >= 1, "stop:endLive");

    await adapter.startLive({
      surface: "platform",
      roomId: "room-s2",
      userId: "host-s2",
      manualToken: "t2",
    });
    const stopB = await adapter.stopBroadcast({
      surface: "platform",
      broadcastId: "bc-s",
      roomId: "room-s2",
    });
    assert(stopB.ok, "stop:stopBroadcast");

    const adapter2 = new Adapter();
    await adapter2.initialize({ surface: "platform" });
    await adapter2.joinLive({
      surface: "platform",
      roomId: "room-l",
      userId: "v-l",
      manualToken: "t",
    });
    const leave = await adapter2.leaveLive();
    assert(leave.ok && adapter2._poc.leaveLiveCalls >= 1, "stop:leaveLive");

    const disp = await adapter2.dispose();
    assert(disp.ok && disp.state === "disposed", "disconnect:dispose");
  }

  // --- Future noop ---
  console.log("\n--- Future noop ---\n");
  {
    const adapter = new Adapter();
    await adapter.initialize({ surface: "platform" });

    const chat = await adapter.sendChatMessage({
      surface: "platform",
      broadcastId: "b",
      userId: "u",
      messageId: "m1",
      text: "hi",
    });
    assert(chat.ok && chat.future === true, "noop:chat");

    const rec = await adapter.startRecording({
      surface: "platform",
      broadcastId: "b",
      recordingId: "r1",
    });
    assert(rec.ok && rec.future === true, "noop:recording-start");

    const mon = await adapter.getMonitoringProbe({ surface: "platform" });
    assert(mon.ok && mon.future === true, "noop:monitoring");

    const hb = await adapter.viewerHeartbeat({ surface: "platform", broadcastId: "b", userId: "u" });
    assert(hb.ok && hb.future === true, "noop:heartbeat");
  }

  // --- manual token bypass ---
  console.log("\n--- manual token ---\n");
  {
    fetchCalls.length = 0;
    const adapter = new Adapter();
    await adapter.initialize({ surface: "platform" });
    await adapter.startLive({
      surface: "platform",
      roomId: "room-m",
      userId: "host-m",
      manualToken: "manual-token-xyz",
    });
    assert(fetchCalls.length === 0, "manual:no-fetch");
    assert(adapter._poc._startArgs?.token === "manual-token-xyz", "manual:token-to-poc");
  }

  // --- PoC file still unchanged ---
  console.log("\n--- Post-run integrity ---\n");
  assert(read(POC_PATH) === pocBefore, "integrity:tlv-poc-unchanged-after-tests");
  assert(read(INTERFACE_PATH) === ifaceBefore, "integrity:interface-unchanged-after-tests");

  // --- Phase A–F regression ---
  console.log("\n--- Phase A–F regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      const out = `${err.stdout || ""}\n${err.stderr || ""}`.trim();
      fail(`regression:${script}`, out.slice(-200) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase 1 ZEGO Adapter tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
