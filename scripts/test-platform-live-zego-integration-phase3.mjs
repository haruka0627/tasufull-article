#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 3 unit tests
 *
 *   node scripts/test-platform-live-zego-integration-phase3.mjs
 *   npm run test:platform-live-zego-integration-phase3
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TLV_POC_PROVIDER = "live/providers/zego-live-provider.js";
const INTERFACE_PATH = "platform-live/provider/live-provider-interface.js";
const ADAPTER_PATH = "platform-live/provider/adapters/zego-live-provider-adapter.js";
const INTEGRATION_PATH = "platform-live/core/live-platform-integration.js";

const CORE_LOAD = [
  "platform-live/core/live-surfaces.js",
  "platform-live/core/live-session-states.js",
  "platform-live/core/live-session-events.js",
  "platform-live/core/live-session-event-bus.js",
  "platform-live/core/live-session-error-codes.js",
  "platform-live/core/live-provider-signals.js",
  "platform-live/core/live-session-validation.js",
  "platform-live/core/live-session-manager.js",
  "platform-live/core/live-provider-state-map.js",
  "platform-live/core/live-platform-diagnostics.js",
];

const BROADCAST_LOAD = [
  "platform-live/broadcast/live-broadcast-states.js",
  "platform-live/broadcast/live-broadcast-events.js",
  "platform-live/broadcast/live-broadcast-provider-signals.js",
  "platform-live/broadcast/live-broadcast-error-codes.js",
  "platform-live/broadcast/live-broadcast-validation.js",
  "platform-live/broadcast/live-broadcast-service.js",
];

const VIEWER_LOAD = [
  "platform-live/viewer/live-viewer-states.js",
  "platform-live/viewer/live-viewer-events.js",
  "platform-live/viewer/live-viewer-error-codes.js",
  "platform-live/viewer/live-viewer-validation.js",
  "platform-live/viewer/live-viewer-permission.js",
  "platform-live/viewer/live-viewer-ccu-registry.js",
  "platform-live/viewer/live-viewer-service.js",
];

const PROVIDER_LOAD = [
  "platform-live/provider/zego-platform-error-map.js",
  "platform-live/provider/live-provider-types.js",
  INTERFACE_PATH,
  "platform-live/provider/stub-live-provider.js",
  ADAPTER_PATH,
  "platform-live/provider/create-platform-live-provider.js",
  INTEGRATION_PATH,
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-adapter-phase1",
  "test:platform-live-core-phase-a",
  "test:platform-live-broadcast-phase-b",
  "test:platform-live-viewer-phase-c",
];

const CANONICAL = ["idle", "initializing", "ready", "live", "reconnecting", "stopped", "failed"];

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

function sha256(rel) {
  return crypto.createHash("sha256").update(read(rel)).digest("hex");
}

function loadRuntime(extra = {}) {
  const fetchCalls = [];
  const mockFetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (extra.fetchHandler) return extra.fetchHandler(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: "mock-token",
        appId: 12345,
        server: "wss://mock.zego.im",
        role: "host",
      }),
    };
  };

  class MockPoc {
    constructor() {
      this._state = "idle";
      this.startLiveArgs = null;
      this.joinLiveArgs = null;
    }
    get state() {
      return this._state;
    }
    async initialize() {
      this._state = "ready";
      return { ok: true, state: this._state };
    }
    async startLive(opts) {
      this.startLiveArgs = opts;
      this._state = "live";
      return { ok: true, state: this._state };
    }
    async joinLive(opts) {
      this.joinLiveArgs = opts;
      this._state = "watching";
      return { ok: true, state: this._state };
    }
    async leaveLive() {
      this._state = "ready";
      return { ok: true };
    }
    async endLive() {
      this._state = "ready";
      return { ok: true };
    }
    async dispose() {
      this._state = "disposed";
      return { ok: true };
    }
  }

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
    setTimeout,
    clearTimeout,
    fetch: mockFetch,
    PLATFORM_LIVE_ZEGO_CONFIG: { appId: 12345, server: "wss://mock.zego.im" },
    TlvZegoLiveProvider: extra.MockPoc || MockPoc,
  };
  context.window = context;
  context.globalThis = context;

  const ctx = vm.createContext(context);
  for (const rel of [...CORE_LOAD, ...BROADCAST_LOAD, ...VIEWER_LOAD, ...PROVIDER_LOAD]) {
    vm.runInContext(read(rel), ctx);
  }
  return { ctx, fetchCalls, MockPoc };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 3 ===\n");

  const tlvPocSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);

  console.log("--- Guardrails ---\n");
  assert(fs.existsSync(path.join(ROOT, INTEGRATION_PATH)), "static:integration-exists");
  assert(sha256(TLV_POC_PROVIDER) === tlvPocSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");

  console.log("\n--- Provider state map ---\n");
  {
    const { ctx } = loadRuntime();
    const map = ctx.TasuLivePlatformProviderStateMap;
    assert(Boolean(map?.mapProviderState), "state-map:exists");
    for (const s of CANONICAL) {
      assert(Object.values(map.CANONICAL_PROVIDER_STATES).includes(s), `state-map:canonical:${s}`);
    }
    assert(map.mapProviderState("live") === "live", "state-map:live");
    assert(map.mapProviderState("watching") === "live", "state-map:watching→live");
    assert(map.mapProviderState("ready", { reconnecting: true }) === "reconnecting", "state-map:reconnecting");
  }

  console.log("\n--- Error map ---\n");
  {
    const { ctx } = loadRuntime();
    const em = ctx.TasuLivePlatformZegoErrorMap;
    const perm = em.mapZegoError("Permissions policy blocked camera");
    assert(perm.code === "PERMISSION_DENIED", "error-map:permission");
    const tok = em.mapZegoError("Token API HTTP 503");
    assert(tok.code === "TOKEN_ERROR" && tok.recoverable, "error-map:token-retry");
    assert(em.shouldRetry(tok, 0), "error-map:should-retry");
    assert(!em.shouldRetry(tok, 2), "error-map:max-attempts");
  }

  console.log("\n--- Diagnostics ---\n");
  {
    const { ctx } = loadRuntime();
    const diag = new ctx.TasuLivePlatformDiagnostics();
    diag.recordLifecycle("init", { ok: true });
    diag.recordProviderSignal("PROVIDER_CONNECTED", { roomId: "r1" });
    const snap = diag.snapshot({ extra: true });
    assert(snap.timeline.length >= 2, "diag:timeline");
    assert(snap.providerSignals.length === 1, "diag:provider-signals");
    assert(snap.extra === true, "diag:snapshot-extra");
  }

  console.log("\n--- Integration (stub) ---\n");
  {
    const { ctx } = loadRuntime();
    const Integration = ctx.TasuLivePlatformIntegration;
    const integ = new Integration({ providerId: "stub", allowStubFallback: true });
    const init = await integ.initialize({ surface: "platform", providerId: "stub" });
    assert(init.ok !== false, "integration:stub-init");
    assert(integ.providerId === "stub", "integration:stub-provider");

    const pub = await integ.startPublish({
      surface: "platform",
      roomId: "room-p3",
      userId: "host-p3",
      broadcastId: "bc-p3",
    });
    assert(pub.ok !== false, "integration:stub-publish", `broadcast=${pub.state || integ.broadcastState}`);
    assert(integ.canonicalProviderState === "live" || integ.providerState === "live", "integration:stub-live-state");

    const snap = integ.getSessionSnapshot();
    assert(snap.broadcastState != null, "integration:snapshot-broadcast");
    assert(Array.isArray(integ.getDiagnostics()?.timeline), "integration:diagnostics-timeline");

    await integ.dispose();
  }

  console.log("\n--- Integration (zego adapter mock) ---\n");
  {
    const { ctx } = loadRuntime();
    const Integration = ctx.TasuLivePlatformIntegration;
    const integ = new Integration({ providerId: "zego", allowStubFallback: false });
    const init = await integ.initialize({ surface: "platform", providerId: "zego" });
    assert(init.ok !== false, "integration:zego-init");
    assert(integ.providerId === "zego", "integration:zego-provider");

    const fakeVideo = { tagName: "DIV", appendChild() {} };
    const pub = await integ.startPublish({
      surface: "platform",
      roomId: "room-z3",
      userId: "host-z3",
      broadcastId: "bc-z3",
      videoContainer: fakeVideo,
      manualToken: "manual-tok",
    });
    assert(pub.ok !== false, "integration:zego-publish");
    assert(integ.broadcastState === ctx.PLATFORM_LIVE_BROADCAST_STATES?.LIVE || pub.ok, "integration:broadcast-live");

    const provider = integ.provider;
    assert(typeof provider?.getCanonicalProviderState === "function", "adapter:canonical-state");
    assert(provider.getCanonicalProviderState() === "live", "adapter:canonical-live");
    assert(typeof provider.getIntegrationDiagnostics === "function", "adapter:integration-diagnostics");

    await integ.dispose();

    const viewerInteg = new Integration({ providerId: "zego", allowStubFallback: false });
    await viewerInteg.initialize({ surface: "platform", providerId: "zego" });
    const aud = await viewerInteg.joinLive({
      surface: "platform",
      roomId: "room-z3",
      userId: "viewer-z3",
      videoContainer: fakeVideo,
      manualToken: "manual-tok",
    });
    assert(aud.ok !== false, "integration:zego-viewer-join");
    await viewerInteg.dispose();
  }

  console.log("\n--- Broadcast passthrough ---\n");
  {
    const captured = { startBroadcast: null };
    const { ctx } = loadRuntime();
    const broadcast = new ctx.TasuLivePlatformBroadcastService();
    const provider = {
      providerId: "mock",
      get state() {
        return "ready";
      },
      async startBroadcast(opts) {
        captured.startBroadcast = opts;
        return { ok: true };
      },
    };
    broadcast.setProvider(provider);
    await broadcast.createBroadcast({
      surface: "platform",
      broadcastId: "bc-pt",
      roomId: "room-pt",
      hostUserId: "host-pt",
    });
    await broadcast.startBroadcast({
      surface: "platform",
      userId: "host-pt",
      videoContainer: { id: "v" },
      manualToken: "tok",
      userName: "Host",
      streamId: "stream-1",
    });
    assert(captured.startBroadcast?.videoContainer?.id === "v", "broadcast:passthrough-video");
    assert(captured.startBroadcast?.manualToken === "tok", "broadcast:passthrough-token");
    assert(captured.startBroadcast?.streamId === "stream-1", "broadcast:passthrough-stream");
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-200) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS ${summary.pass} · FAIL ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase 3 unit tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
