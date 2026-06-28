#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-5 (Monitoring wire) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-5.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-5
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
  "platform-live/core/live-platform-edge-sync.js",
];

const BROADCAST_LOAD = [
  "platform-live/broadcast/live-broadcast-states.js",
  "platform-live/broadcast/live-broadcast-events.js",
  "platform-live/broadcast/live-broadcast-provider-signals.js",
  "platform-live/broadcast/live-broadcast-error-codes.js",
  "platform-live/broadcast/live-broadcast-validation.js",
  "platform-live/broadcast/live-broadcast-service.js",
  "platform-live/broadcast/live-broadcast-edge-client.js",
];

const VIEWER_LOAD = [
  "platform-live/viewer/live-viewer-states.js",
  "platform-live/viewer/live-viewer-events.js",
  "platform-live/viewer/live-viewer-error-codes.js",
  "platform-live/viewer/live-viewer-validation.js",
  "platform-live/viewer/live-viewer-permission.js",
  "platform-live/viewer/live-viewer-ccu-registry.js",
  "platform-live/viewer/live-viewer-service.js",
  "platform-live/viewer/live-viewer-edge-client.js",
];

const CHAT_LOAD = [
  "platform-live/chat/live-chat-message-states.js",
  "platform-live/chat/live-chat-system-events.js",
  "platform-live/chat/live-chat-events.js",
  "platform-live/chat/live-chat-error-codes.js",
  "platform-live/chat/live-chat-validation.js",
  "platform-live/chat/live-chat-moderation-hook.js",
  "platform-live/chat/live-chat-rate-limit-hook.js",
  "platform-live/chat/live-chat-gateway.js",
  "platform-live/chat/live-chat-edge-client.js",
];

const RECORDING_LOAD = [
  "platform-live/recording/live-recording-states.js",
  "platform-live/recording/live-recording-events.js",
  "platform-live/recording/live-recording-error-codes.js",
  "platform-live/recording/live-recording-validation.js",
  "platform-live/recording/live-recording-service.js",
  "platform-live/recording/live-recording-edge-client.js",
];

const MONITORING_LOAD = [
  "platform-live/monitoring/live-monitoring-states.js",
  "platform-live/monitoring/live-monitoring-events.js",
  "platform-live/monitoring/live-monitoring-error-codes.js",
  "platform-live/monitoring/live-monitoring-validation.js",
  "platform-live/monitoring/live-monitoring-metrics-store.js",
  "platform-live/monitoring/live-monitoring-smoke-runner.js",
  "platform-live/monitoring/live-monitoring-service.js",
  "platform-live/monitoring/live-monitoring-edge-client.js",
];

const PROVIDER_LOAD = [
  "platform-live/provider/zego-platform-error-map.js",
  "platform-live/provider/live-provider-types.js",
  INTERFACE_PATH,
  "platform-live/provider/stub-live-provider.js",
  "platform-live/provider/adapters/zego-live-provider-adapter.js",
  "platform-live/provider/create-platform-live-provider.js",
  INTEGRATION_PATH,
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase4-p4-4",
  "test:platform-live-zego-integration-phase4-p4-3",
  "test:platform-live-zego-integration-phase4-p4-2",
  "test:platform-live-zego-integration-phase4-p4-1",
  "test:platform-live-zego-integration-phase3",
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

function sha256(rel) {
  return crypto.createHash("sha256").update(read(rel)).digest("hex");
}

function loadRuntime() {
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
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "mock fetch disabled" }) }),
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  for (const rel of [
    ...CORE_LOAD,
    ...BROADCAST_LOAD,
    ...VIEWER_LOAD,
    ...CHAT_LOAD,
    ...RECORDING_LOAD,
    ...MONITORING_LOAD,
    ...PROVIDER_LOAD,
  ]) {
    vm.runInContext(read(rel), ctx);
  }
  return ctx;
}

function createMockEdgeSync() {
  return {
    enabled: true,
    setLiveCalls: [],
    clearLiveCalls: [],
    patchLiveCalls: [],
    async setLive(ctx) {
      this.setLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    async clearLive(ctx) {
      this.clearLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    async patchLive(ctx) {
      this.patchLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    getStatus() {
      return { enabled: true, liveKeys: [], lastResult: null };
    },
    getLastResult() {
      return null;
    },
  };
}

function createMockMonitoringEdgeClient(overrides = {}) {
  return {
    patchCalls: [],
    async patchLive(params) {
      this.patchCalls.push(params);
      if (overrides.patchFail) return { ok: false, error: "mock patch fail" };
      if (overrides.patchThrow) throw new Error("mock patch throw");
      return { ok: true, stub: true, ...params };
    },
  };
}

function createTrackingEdgeClient(name) {
  return {
    name,
    calls: [],
    async setLive(p) {
      this.calls.push({ op: "setLive", ...p });
      return { ok: true };
    },
    async clearLive(p) {
      this.calls.push({ op: "clearLive", ...p });
      return { ok: true };
    },
    async start(p) {
      this.calls.push({ op: "start", ...p });
      return { ok: true };
    },
    async stop(p) {
      this.calls.push({ op: "stop", ...p });
      return { ok: true };
    },
    async setWatching(p) {
      this.calls.push({ op: "setWatching", ...p });
      return { ok: true };
    },
  };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-5 ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);
  const integrationSrc = read(INTEGRATION_PATH);

  console.log("--- Guardrails ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");
  assert(/recordMonitoring/.test(integrationSrc), "static:recordMonitoring-wired");
  assert(/_runMonitoringEdgePatch/.test(integrationSrc), "static:monitoring-edge-patch");

  const ctx = loadRuntime();
  const Integration = ctx.TasuLivePlatformIntegration;
  const PLATFORM = "platform";
  const HS = ctx.PLATFORM_LIVE_MONITORING_HEALTH_STATES;

  console.log("\n--- initialize monitoring delegate ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    assert(integ.monitoringService != null, "init:monitoringService-wired");
    const diag = integ.getDiagnostics();
    assert(diag.monitoringServiceReady === true, "init:monitoringServiceReady");
    assert(diag.monitoringEvents?.some((e) => e.name === "feed"), "init:feed-on-init");
    await integ.dispose();
  }

  console.log("\n--- diagnostics feed on publish ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-feed",
      userId: "host-feed",
      broadcastId: "bc-feed",
      manualToken: "secret-mon-redacted",
    });
    assert(pub.ok !== false, "feed:publish-ok");
    const diag = integ.getDiagnostics();
    assert(diag.monitoringFeed != null, "feed:snapshot-present");
    assert(diag.monitoringState != null, "feed:monitoringState-set");
    assert(diag.monitoringEvents?.filter((e) => e.name === "feed").length >= 2, "feed:events-recorded");
    assert(!JSON.stringify(diag).includes("secret-mon-redacted"), "feed:no-token-diag");
    await integ.dispose();
  }

  console.log("\n--- useEdgeSync=true monitoring edge patch ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockMon = createMockMonitoringEdgeClient();
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      monitoringEdgeClient: mockMon,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      monitoringEdgeClient: mockMon,
    });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-patch",
      userId: "host-patch",
      broadcastId: "bc-patch",
    });
    assert(pub.ok !== false, "patch:publish-ok");
    assert(mockMon.patchCalls.length >= 1, "patch:called-on-publish");
    assert(pub.monitoringPatch?.ok === true, "patch:result-on-publish");
    const lastPatch = mockMon.patchCalls[mockMon.patchCalls.length - 1];
    assert(lastPatch?.broadcastLive === true, "patch:broadcastLive");
    assert(lastPatch?.providerState != null, "patch:providerState");
    assert(mockMon.patchCalls.every((p) => !("manualToken" in p)), "patch:no-token-in-payload");

    const events = integ.getDiagnostics().monitoringEvents || [];
    assert(events.some((e) => e.name === "attempted" && e.payload?.op === "patch"), "patch:attempted-event");
    assert(events.some((e) => e.name === "succeeded" && e.payload?.op === "patch"), "patch:succeeded-event");
    await integ.dispose();
  }

  console.log("\n--- patch monitoring-only (no broadcast/chat/recording edge) ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockMon = createMockMonitoringEdgeClient();
    const bcEdge = createTrackingEdgeClient("broadcast");
    const chatEdge = createTrackingEdgeClient("chat");
    const recEdge = createTrackingEdgeClient("recording");
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      monitoringEdgeClient: mockMon,
      broadcastEdgeClient: bcEdge,
      chatEdgeClient: chatEdge,
      recordingEdgeClient: recEdge,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      monitoringEdgeClient: mockMon,
      broadcastEdgeClient: bcEdge,
      chatEdgeClient: chatEdge,
      recordingEdgeClient: recEdge,
    });

    mockMon.patchCalls.length = 0;
    await integ.getMonitoringHealth({ surface: PLATFORM });
    await integ._runMonitoringEdgePatch({
      surface: PLATFORM,
      broadcastId: "bc-only-mon",
      broadcastLive: true,
      sessionActive: true,
    });

    assert(mockMon.patchCalls.length === 1, "only-mon:patch-once");
    assert(bcEdge.calls.length === 0, "only-mon:no-broadcast-edge");
    assert(chatEdge.calls.length === 0, "only-mon:no-chat-edge");
    assert(recEdge.calls.length === 0, "only-mon:no-recording-edge");
    await integ.dispose();
  }

  console.log("\n--- useEdgeSync=false compat ---\n");
  {
    const mockMon = createMockMonitoringEdgeClient();
    const integ = new Integration({ providerId: "stub", monitoringEdgeClient: mockMon });
    await integ.initialize({ surface: PLATFORM, providerId: "stub", monitoringEdgeClient: mockMon });
    assert(integ.useEdgeSync === false, "default:useEdgeSync-false");

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-off",
      userId: "host-off",
      broadcastId: "bc-off",
    });
    assert(pub.ok !== false, "default:publish-ok");
    assert(pub.monitoringPatch == null, "default:no-monitoringPatch");
    assert(mockMon.patchCalls.length === 0, "default:no-edge-patch");
    assert(integ.getDiagnostics().monitoringFeed != null, "default:feed-still-works");
    await integ.dispose();
  }

  console.log("\n--- monitoring edge failure non-fatal ---\n");
  {
    const mockMon = createMockMonitoringEdgeClient({ patchFail: true });
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      monitoringEdgeClient: mockMon,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      monitoringEdgeClient: mockMon,
    });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-partial",
      userId: "host-partial",
      broadcastId: "bc-partial",
    });
    assert(pub.ok !== false, "partial:publish-still-ok");
    assert(pub.monitoringPatch?.partial === true, "partial:patch-flag");
    const failedEv = integ.getDiagnostics().monitoringEvents?.some(
      (e) => e.name === "failed" && e.payload?.op === "patch",
    );
    assert(failedEv, "partial:failed-recorded");
    await integ.dispose();
  }

  console.log("\n--- smoke integration variant ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const smoke = await integ.runMonitoringSmoke({ surface: PLATFORM });
    assert(smoke.ok, "smoke:ok");
    assert(smoke.smoke?.stepCount >= 9, "smoke:steps", `count=${smoke.smoke?.stepCount}`);
    assert(integ.getDiagnostics().monitoringEvents?.some((e) => e.name === "succeeded" && e.payload?.op === "smoke"), "smoke:event");
    await integ.dispose();
  }

  console.log("\n--- P4-4 recording path intact ---\n");
  {
    const mockRec = {
      state: "idle",
      startCalls: [],
      stopCalls: [],
      async startRecording(opts) {
        this.startCalls.push(opts);
        this.state = "recording";
        return { ok: true, state: "recording", metadata: { recordingId: "rec-p45", broadcastId: opts.broadcastId } };
      },
      async stopRecording() {
        return { ok: true, state: "completed", metadata: { recordingId: "rec-p45" } };
      },
      async dispose() {
        return { ok: true };
      },
    };
    const integ = new Integration({ providerId: "stub", recordingService: mockRec });
    await integ.initialize({ surface: PLATFORM, providerId: "stub", recordingService: mockRec });
    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-rec",
      userId: "host-rec",
      broadcastId: "bc-rec",
    });
    assert(pub.recordingCandidate?.candidate === true, "p44:candidate");
    assert(mockRec.startCalls.length === 0, "p44:no-auto-start");
    await integ.startRecording({ surface: PLATFORM, broadcastId: "bc-rec" });
    assert(mockRec.startCalls.length === 1, "p44:explicit-start");
    await integ.dispose();
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-400) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS ${summary.pass} · FAIL ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase 4 P4-5 tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
