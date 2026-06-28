#!/usr/bin/env node
/**
 * Platform Live ZEGO Integration — Phase 5 P5-2 (TLV Platform Live Adapter) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase5-p5-2.mjs
 *   npm run test:platform-live-zego-integration-phase5-p5-2
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ADAPTER_PATH = "live/tlv-platform-live-adapter.js";
const TLV_POC_PROVIDER = "live/providers/zego-live-provider.js";
const INTERFACE_PATH = "platform-live/provider/live-provider-interface.js";
const INTEGRATION_PATH = "platform-live/core/live-platform-integration.js";
const STUDIO_HTML = "live/studio.html";
const WATCH_HTML = "live/watch.html";
const BROADCASTS_PATH = "live/live-broadcasts.js";

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
  "platform-live/core/live-platform-retry.js",
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
  "test:platform-live-zego-integration-phase4-p4-6",
  "test:platform-live-zego-integration-phase5-p5-1",
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

function loadRuntime(options = {}) {
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
    TLV_FEATURE_FLAGS: {
      liveSessionManagerEnabled: false,
      usePlatformLive: options.usePlatformLive === true,
    },
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  const files = [
    "platform-live/core/live-surfaces.js",
    ...(options.withoutIntegration
      ? []
      : [
          ...CORE_LOAD.filter((p) => p !== "platform-live/core/live-surfaces.js"),
          ...BROADCAST_LOAD,
          ...VIEWER_LOAD,
          ...CHAT_LOAD,
          ...RECORDING_LOAD,
          ...MONITORING_LOAD,
          ...PROVIDER_LOAD,
        ]),
    ADAPTER_PATH,
  ];
  if (options.withFlags) {
    files.unshift("live/tlv-feature-flags.js");
  }
  for (const rel of files) {
    vm.runInContext(read(rel), ctx);
  }
  return ctx;
}

async function run() {
  console.log("\n=== Platform Live ZEGO Integration — Phase 5 P5-2 ===\n");

  const adapterSrc = read(ADAPTER_PATH);
  const studioSha = sha256(STUDIO_HTML);
  const watchSha = sha256(WATCH_HTML);
  const broadcastsSha = sha256(BROADCASTS_PATH);
  const tlvProvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);

  console.log("--- Guardrails ---\n");
  assert(/TlvPlatformLiveAdapter/.test(adapterSrc), "static:adapter-class");
  assert(!/TlvZegoLiveProvider|zego-live-provider|ZEGOExpress|createTlvLiveProvider/.test(adapterSrc), "static:no-zego-direct");
  assert(!/executeWithRetry|classifyIntegrationRetry/.test(adapterSrc), "static:no-retry-in-adapter");
  assert(/TasuLivePlatformIntegration/.test(adapterSrc), "static:integration-delegation");
  assert(/usePlatformLive/.test(adapterSrc), "static:p5-3-flag-hook");
  assert(sha256(STUDIO_HTML) === studioSha, "static:studio-unchanged");
  assert(sha256(WATCH_HTML) === watchSha, "static:watch-unchanged");
  assert(sha256(BROADCASTS_PATH) === broadcastsSha, "static:broadcasts-unchanged");

  const ctx = loadRuntime();
  const Adapter = ctx.TlvPlatformLiveAdapter;
  const Utils = ctx.TlvPlatformLiveAdapterUtils;
  const SURFACES = ctx.LIVE_SURFACES;

  console.log("\n--- Adapter construction ---\n");
  {
    const adapter = new Adapter({ providerId: "stub" });
    assert(adapter instanceof Adapter, "create:instance");
    assert(adapter.surface === "tlv", "create:surface-tlv");
    assert(adapter.isEnabled() === false, "create:flag-default-off");
    assert(adapter.isIntegrationAvailable() === true, "create:integration-available");
  }

  console.log("\n--- ID / context normalization ---\n");
  {
    const ids = Utils.normalizeIds({ broadcastId: "bc-abc", liveId: "live-abc" });
    assert(ids.broadcastId === "bc-abc", "ids:broadcastId");
    assert(ids.liveId === "live-abc", "ids:liveId");
    assert(ids.roomId === "bc-abc", "ids:roomId-from-broadcast");

    const fromLive = Utils.normalizeIds({ liveId: "live-only" });
    assert(fromLive.broadcastId === "live-only", "ids:from-liveId");
    assert(fromLive.roomId === "live-only", "ids:room-from-live");

    const roomOnly = Utils.normalizeIds({ roomId: "room-1" });
    assert(roomOnly.broadcastId === "bc-room-1", "ids:broadcast-from-room");

    const host = Utils.normalizeHostContext({
      broadcastId: "bc-host",
      creatorId: "user-host",
      userName: "Host",
    });
    assert(host.surface === SURFACES.TLV, "host:surface");
    assert(host.roomId === "bc-host", "host:roomId");
    assert(host.userId === "user-host", "host:userId");

    const viewer = Utils.normalizeViewerContext({
      liveId: "live-view",
      viewerId: "user-view",
    });
    assert(viewer.surface === SURFACES.TLV, "viewer:surface");
    assert(viewer.broadcastId === "live-view", "viewer:broadcastId");
    assert(viewer.userId === "user-view", "viewer:userId");

    const chat = Utils.normalizeChatContext({
      broadcastId: "bc-chat",
      userId: "u1",
      text: "hello",
    });
    assert(chat.surface === SURFACES.TLV && chat.text === "hello", "chat:context");

    const rec = Utils.normalizeRecordingContext({ broadcastId: "bc-rec", sessionId: "sess-1" });
    assert(rec.broadcastId === "bc-rec" && rec.sessionId === "sess-1", "recording:context");

    const mon = Utils.normalizeMonitoringContext({ liveId: "live-mon", reason: "publish" });
    assert(mon.liveId === "live-mon" && mon.reason === "publish", "monitoring:context");
  }

  console.log("\n--- Flag disabled (P5-3 ready · default skip) ---\n");
  {
    const adapter = new Adapter({ providerId: "stub" });
    const res = await adapter.startHost({ broadcastId: "bc-off", userId: "host-off" });
    assert(res.skipped === true && res.code === "PLATFORM_LIVE_DISABLED", "flag:host-skipped");
    const join = await adapter.joinViewer({ broadcastId: "bc-off", userId: "view-off" });
    assert(join.skipped === true, "flag:viewer-skipped");
  }

  console.log("\n--- Integration not loaded ---\n");
  {
    const ctxBare = loadRuntime({ withoutIntegration: true });
    const adapter = new ctxBare.TlvPlatformLiveAdapter({ providerId: "stub" });
    const res = await adapter.startHost({ broadcastId: "bc-noint", userId: "host", skipFlagCheck: true });
    assert(res.ok === false && res.code === "PLATFORM_INTEGRATION_NOT_LOADED", "noload:fail-safe");
    const diag = adapter.getDiagnostics();
    assert(diag.adapter?.integrationAvailable === false, "noload:diagnostics");
  }

  console.log("\n--- Diagnostics ---\n");
  {
    const mockIntegration = {
      getDiagnostics() {
        return { sessionState: "IDLE", providerId: "stub", retryEvents: [] };
      },
    };
    const adapter = new Adapter({ integration: mockIntegration, providerId: "stub" });
    const diag = adapter.getDiagnostics();
    assert(diag.adapter?.surface === "tlv", "diag:adapter-meta");
    assert(diag.sessionState === "IDLE", "diag:integration-delegate");
    assert(!JSON.stringify(diag).includes("secret"), "diag:no-secrets");
  }

  console.log("\n--- Delegate Host / Viewer / Chat (skipFlagCheck + stub) ---\n");
  {
    const adapter = new Adapter({ providerId: "stub" });
    const init = await adapter.initialize({ skipFlagCheck: true });
    assert(init.ok !== false, "delegate:init");
    assert(init.surface === "tlv", "delegate:init-surface");

    const pub = await adapter.startHost({
      skipFlagCheck: true,
      broadcastId: "bc-delegate",
      creatorId: "host-delegate",
    });
    assert(pub.ok !== false, "delegate:startHost");
    assert(pub.diagnostics != null, "delegate:host-diagnostics");

    const viewerAdapter = new Adapter({ providerId: "stub" });
    await viewerAdapter.initialize({ skipFlagCheck: true });
    const join = await viewerAdapter.joinViewer({
      skipFlagCheck: true,
      broadcastId: "bc-delegate",
      userId: "viewer-delegate",
    });
    assert(join.ok !== false, "delegate:joinViewer", join.error || "");

    const chatIntegration = {
      async initialize() {
        return { ok: true };
      },
      async sendChatMessage(opts) {
        return { ok: true, message: { id: "msg-1", text: opts.text, broadcastId: opts.broadcastId } };
      },
      getDiagnostics() {
        return { chatGatewayReady: true };
      },
      async dispose() {
        return { ok: true };
      },
    };
    const chatAdapter = new Adapter({ integration: chatIntegration, providerId: "stub" });
    await chatAdapter.initialize({ skipFlagCheck: true });
    const chat = await chatAdapter.sendChatMessage({
      skipFlagCheck: true,
      broadcastId: "bc-delegate",
      userId: "viewer-delegate",
      text: "adapter-msg",
    });
    assert(chat.ok !== false && chat.message?.text === "adapter-msg", "delegate:sendChat");
    await chatAdapter.dispose({ skipFlagCheck: true });

    const health = await adapter.getMonitoringHealth({ skipFlagCheck: true });
    assert(health.ok !== false, "delegate:monitoring");

    const diag = adapter.getDiagnostics();
    assert(Array.isArray(diag.retryEvents) || diag.retryLastResult != null || diag.adapter, "delegate:retry-via-integration");
    await viewerAdapter.dispose({ skipFlagCheck: true });
    await adapter.dispose({ skipFlagCheck: true });
  }

  console.log("\n--- Retry delegation (integration owns retry) ---\n");
  {
    const integSrc = read(INTEGRATION_PATH);
    assert(/_executeIntegrationRetry/.test(integSrc), "retry:integration-has-retry");
    assert(!/executeWithRetry/.test(adapterSrc), "retry:not-in-adapter");
  }

  console.log("\n--- Integrity ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvProvSha, "integrity:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "integrity:platform-interface-unchanged");

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
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nP5-2 GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
