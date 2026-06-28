#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-4 (Recording service wire) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-4.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-4
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

const EDGE_EXTRA = ["platform-live/monitoring/live-monitoring-edge-client.js"];

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
    ...EDGE_EXTRA,
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
    async setLive(ctx) {
      this.setLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    async clearLive(ctx) {
      this.clearLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    async patchLive() {
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

function createMockRecordingService(overrides = {}) {
  const RS = overrides.RS || { IDLE: "idle", RECORDING: "recording", COMPLETED: "completed" };
  return {
    state: RS.IDLE,
    metadata: null,
    startCalls: [],
    stopCalls: [],
    async startRecording(opts) {
      this.startCalls.push(opts);
      if (overrides.startFail) return { ok: false, error: "mock start fail" };
      this.state = RS.RECORDING;
      this.metadata = {
        recordingId: "rec-mock-1",
        broadcastId: opts.broadcastId,
        sessionId: opts.sessionId,
        status: RS.RECORDING,
      };
      return { ok: true, state: this.state, metadata: { ...this.metadata } };
    },
    async stopRecording(opts) {
      this.stopCalls.push(opts);
      if (overrides.stopFail) return { ok: false, error: "mock stop fail" };
      this.state = RS.COMPLETED;
      return {
        ok: true,
        state: this.state,
        metadata: { recordingId: opts.recordingId || this.metadata?.recordingId, status: RS.COMPLETED },
      };
    },
    async dispose() {
      return { ok: true };
    },
  };
}

function createMockRecordingEdgeClient(overrides = {}) {
  return {
    startCalls: [],
    stopCalls: [],
    async start(params) {
      this.startCalls.push(params);
      if (overrides.startFail) return { ok: false, error: "mock edge start fail" };
      if (overrides.startThrow) throw new Error("mock edge start throw");
      return { ok: true, stub: true, ...params };
    },
    async stop(params) {
      this.stopCalls.push(params);
      if (overrides.stopFail) return { ok: false, error: "mock edge stop fail" };
      return { ok: true, stub: true, ...params };
    },
    async setLive() {
      return { ok: true };
    },
    async clearLive() {
      return { ok: true };
    },
  };
}

function createMockChatEdgeClient() {
  return {
    setWatchingCalls: [],
    async setWatching(params) {
      this.setWatchingCalls.push(params);
      return { ok: true, stub: true };
    },
    async sendMessage() {
      return { ok: true };
    },
    async setLive() {
      return { ok: true };
    },
    async clearLive() {
      return { ok: true };
    },
  };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-4 ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);
  const integrationSrc = read(INTEGRATION_PATH);

  console.log("--- Guardrails ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");
  assert(/recording:candidate/.test(integrationSrc), "static:recording-candidate-lifecycle");
  const startPublishBody = integrationSrc.match(/async startPublish[\s\S]*?(?=\n    async joinAsViewer)/)?.[0] || "";
  assert(!startPublishBody.includes("this.startRecording("), "static:no-auto-start-on-publish");
  assert(!startPublishBody.includes("_recordingService.startRecording"), "static:no-service-start-on-publish");

  const ctx = loadRuntime();
  const Integration = ctx.TasuLivePlatformIntegration;
  const PLATFORM = "platform";
  const RS = ctx.PLATFORM_LIVE_RECORDING_STATES;

  console.log("\n--- initialize recording delegate ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    assert(integ.recordingService != null, "init:recordingService-wired");
    assert(integ.recordingService.state === RS.IDLE, "init:recording-idle");
    await integ.dispose();
  }

  console.log("\n--- publish success → candidate event ---\n");
  {
    const mockRec = createMockRecordingService({ RS });
    const integ = new Integration({ providerId: "stub", recordingService: mockRec });
    await integ.initialize({ surface: PLATFORM, providerId: "stub", recordingService: mockRec });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-cand",
      userId: "host-cand",
      broadcastId: "bc-cand",
      manualToken: "secret-rec-redacted",
    });
    assert(pub.ok !== false, "candidate:publish-ok");
    assert(pub.recordingCandidate?.candidate === true, "candidate:flag");
    assert(pub.recordingCandidate?.autoStart === false, "candidate:no-autoStart");
    assert(mockRec.startCalls.length === 0, "candidate:no-startRecording");
    assert(mockRec.state === RS.IDLE, "candidate:state-idle");

    const diag = integ.getDiagnostics();
    const lifecycleCand = diag.timeline?.some((e) => e.name === "recording:candidate");
    const recCand = diag.recordingEvents?.some((e) => e.name === "candidate");
    assert(lifecycleCand, "candidate:lifecycle-event");
    assert(recCand, "candidate:recordingEvents");
    assert(!JSON.stringify(diag).includes("secret-rec-redacted"), "candidate:no-token-diag");
    await integ.dispose();
  }

  console.log("\n--- useEdgeSync=false compat ---\n");
  {
    const mockRec = createMockRecordingService({ RS });
    const integ = new Integration({ providerId: "stub", recordingService: mockRec });
    await integ.initialize({ surface: PLATFORM, providerId: "stub", recordingService: mockRec });
    assert(integ.useEdgeSync === false, "default:useEdgeSync-false");

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-off",
      userId: "host-off",
      broadcastId: "bc-off",
    });
    assert(pub.ok !== false, "default:publish-ok");
    assert(pub.recordingCandidate?.candidate === true, "default:candidate-recorded");

    const start = await integ.startRecording({ surface: PLATFORM, broadcastId: "bc-off" });
    assert(start.ok, "default:startRecording-delegate");
    assert(mockRec.startCalls.length === 1, "default:service-start-called");
    assert(start.recordingEdge == null, "default:no-edge-on-start");
    await integ.dispose();
  }

  console.log("\n--- startRecording / stopRecording delegate ---\n");
  {
    const mockRec = createMockRecordingService({ RS });
    const mockEdge = createMockRecordingEdgeClient();
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      recordingService: mockRec,
      recordingEdgeClient: mockEdge,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      recordingService: mockRec,
      recordingEdgeClient: mockEdge,
    });

    await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-rec",
      userId: "host-rec",
      broadcastId: "bc-rec",
    });

    const start = await integ.startRecording({ surface: PLATFORM, broadcastId: "bc-rec" });
    assert(start.ok, "delegate:start-ok");
    assert(mockRec.startCalls.length === 1, "delegate:service-start");
    assert(mockEdge.startCalls.length === 1, "delegate:edge-start");
    assert(mockEdge.startCalls[0]?.recordingId === "rec-mock-1", "delegate:edge-recordingId");

    const stop = await integ.stopRecording({ surface: PLATFORM, recordingId: "rec-mock-1" });
    assert(stop.ok, "delegate:stop-ok");
    assert(mockRec.stopCalls.length === 1, "delegate:service-stop");
    assert(mockEdge.stopCalls.length === 1, "delegate:edge-stop");

    const events = integ.getDiagnostics().recordingEvents || [];
    assert(events.some((e) => e.name === "attempted" && e.payload?.op === "start"), "delegate:start-attempted");
    assert(events.some((e) => e.name === "succeeded" && e.payload?.op === "start"), "delegate:start-succeeded");
    assert(events.some((e) => e.name === "succeeded" && e.payload?.op === "stop"), "delegate:stop-succeeded");
    await integ.dispose();
  }

  console.log("\n--- recording edge failure non-fatal ---\n");
  {
    const mockRec = createMockRecordingService({ RS });
    const mockEdge = createMockRecordingEdgeClient({ startFail: true });
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      recordingService: mockRec,
      recordingEdgeClient: mockEdge,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      recordingService: mockRec,
      recordingEdgeClient: mockEdge,
    });

    await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-edge-fail",
      userId: "host-ef",
      broadcastId: "bc-ef",
    });

    const start = await integ.startRecording({ surface: PLATFORM, broadcastId: "bc-ef" });
    assert(start.ok, "edge-fail:start-still-ok");
    assert(start.recordingEdge?.partial === true, "edge-fail:partial-flag");
    const failedEv = integ.getDiagnostics().recordingEvents?.some(
      (e) => e.name === "failed" && e.payload?.op === "edgeStart",
    );
    assert(failedEv, "edge-fail:diagnostics");
    await integ.dispose();
  }

  console.log("\n--- P4-2 publish/stop intact ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockRec = createMockRecordingService({ RS });
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      recordingService: mockRec,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      recordingService: mockRec,
    });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-p42",
      userId: "host-p42",
      broadcastId: "bc-p42",
    });
    assert(pub.ok !== false, "p42:publish-ok");
    assert(mockSync.setLiveCalls.length === 1, "p42:setLive");
    assert(mockRec.startCalls.length === 0, "p42:no-auto-recording");

    const stop = await integ.stopPublish({ surface: PLATFORM, broadcastId: "bc-p42" });
    assert(stop.ok !== false, "p42:stop-ok");
    assert(mockSync.clearLiveCalls.length === 1, "p42:clearLive");
    await integ.dispose();
  }

  console.log("\n--- P4-3 joinLive / chat intact ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockChat = createMockChatEdgeClient();
    const mockRec = createMockRecordingService({ RS });
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
      recordingService: mockRec,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
      recordingService: mockRec,
    });

    const jr = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-p43",
      userId: "viewer-p43",
      broadcastId: "bc-p43",
    });
    assert(jr.ok !== false, "p43:joinLive-ok");
    assert(mockChat.setWatchingCalls.length === 1, "p43:setWatching");
    assert(mockRec.startCalls.length === 0, "p43:joinLive-no-recording");

    const mockGateway = {
      async sendMessage(opts) {
        return {
          ok: true,
          state: ctx.PLATFORM_LIVE_CHAT_MESSAGE_STATES?.SENT || "sent",
          message: { id: "msg-p43", ...opts, state: "sent" },
        };
      },
    };
    integ._chatGateway = mockGateway;
    const sr = await integ.sendChatMessage({
      surface: PLATFORM,
      broadcastId: "bc-p43",
      userId: "viewer-p43",
      text: "hello p43",
    });
    assert(sr.ok, "p43:sendChatMessage");
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
  console.log("\nPhase 4 P4-4 tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
