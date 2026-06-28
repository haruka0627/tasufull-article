#!/usr/bin/env node
/**
 * Live Platform Monitoring — Phase F unit tests
 *
 *   node scripts/test-platform-live-monitoring-phase-f.mjs
 *   npm run test:platform-live-monitoring-phase-f
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CORE_LOAD_ORDER = [
  "platform-live/core/live-surfaces.js",
  "platform-live/core/live-session-states.js",
  "platform-live/core/live-session-events.js",
  "platform-live/core/live-session-event-bus.js",
  "platform-live/core/live-session-error-codes.js",
  "platform-live/core/live-provider-signals.js",
  "platform-live/core/live-session-validation.js",
  "platform-live/core/live-session-manager.js",
  "platform-live/provider/live-provider-types.js",
  "platform-live/provider/live-provider-interface.js",
  "platform-live/provider/stub-live-provider.js",
  "platform-live/provider/create-platform-live-provider.js",
];

const BROADCAST_LOAD_ORDER = [
  "platform-live/broadcast/live-broadcast-states.js",
  "platform-live/broadcast/live-broadcast-events.js",
  "platform-live/broadcast/live-broadcast-provider-signals.js",
  "platform-live/broadcast/live-broadcast-error-codes.js",
  "platform-live/broadcast/live-broadcast-validation.js",
  "platform-live/broadcast/live-broadcast-service.js",
  "platform-live/broadcast/live-broadcast-edge-client.js",
];

const VIEWER_LOAD_ORDER = [
  "platform-live/viewer/live-viewer-states.js",
  "platform-live/viewer/live-viewer-events.js",
  "platform-live/viewer/live-viewer-error-codes.js",
  "platform-live/viewer/live-viewer-validation.js",
  "platform-live/viewer/live-viewer-permission.js",
  "platform-live/viewer/live-viewer-ccu-registry.js",
  "platform-live/viewer/live-viewer-service.js",
  "platform-live/viewer/live-viewer-edge-client.js",
];

const CHAT_LOAD_ORDER = [
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

const RECORDING_LOAD_ORDER = [
  "platform-live/recording/live-recording-states.js",
  "platform-live/recording/live-recording-events.js",
  "platform-live/recording/live-recording-error-codes.js",
  "platform-live/recording/live-recording-validation.js",
  "platform-live/recording/live-recording-service.js",
  "platform-live/recording/live-recording-edge-client.js",
];

const MONITORING_LOAD_ORDER = [
  "platform-live/monitoring/live-monitoring-states.js",
  "platform-live/monitoring/live-monitoring-events.js",
  "platform-live/monitoring/live-monitoring-error-codes.js",
  "platform-live/monitoring/live-monitoring-validation.js",
  "platform-live/monitoring/live-monitoring-metrics-store.js",
  "platform-live/monitoring/live-monitoring-smoke-runner.js",
  "platform-live/monitoring/live-monitoring-service.js",
  "platform-live/monitoring/live-monitoring-edge-client.js",
];

const LOAD_ORDER = [
  ...CORE_LOAD_ORDER,
  ...BROADCAST_LOAD_ORDER,
  ...VIEWER_LOAD_ORDER,
  ...CHAT_LOAD_ORDER,
  ...RECORDING_LOAD_ORDER,
  ...MONITORING_LOAD_ORDER,
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
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  for (const rel of LOAD_ORDER) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) throw new Error(`missing ${rel}`);
    vm.runInContext(fs.readFileSync(abs, "utf8"), ctx);
  }
  return context;
}

async function setupLiveStack(ctx, PLATFORM, id = "bc-mon") {
  const SessionManager = ctx.TasuLivePlatformSessionManager;
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const ViewerService = ctx.TasuLivePlatformViewerService;
  const ChatGateway = ctx.TasuLivePlatformChatGateway;
  const RecordingService = ctx.TasuLivePlatformRecordingService;
  const CcuRegistry = ctx.TasuLivePlatformViewerCcuRegistry;
  const createProvider = ctx.createPlatformLiveProvider;

  const session = new SessionManager();
  const provider = createProvider("stub");
  await provider.initialize({ surface: PLATFORM });
  const broadcast = new BroadcastService({ sessionManager: session, provider });
  const ccuRegistry = new CcuRegistry();
  const viewer = new ViewerService({ broadcastService: broadcast, ccuRegistry, provider });
  const chat = new ChatGateway({ broadcastService: broadcast, viewerService: viewer, provider });
  const recording = new RecordingService({ broadcastService: broadcast, sessionManager: session, provider });

  await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: id, roomId: `room-${id}` });
  await broadcast.startBroadcast({ surface: PLATFORM });
  await viewer.joinViewer({ surface: PLATFORM, broadcastId: id, userId: "mon-user-1" });

  return { session, broadcast, viewer, chat, recording, provider, ccuRegistry, broadcastId: id };
}

async function run() {
  console.log("\n=== Live Platform Monitoring — Phase F unit tests ===\n");

  const ctx = loadRuntime();
  const HS = ctx.PLATFORM_LIVE_MONITORING_HEALTH_STATES;
  const ME = ctx.PLATFORM_LIVE_MONITORING_EVENTS;
  const MC = ctx.PLATFORM_LIVE_MONITORING_ERROR_CODES;
  const MonitoringService = ctx.TasuLivePlatformMonitoringService;
  const SmokeRunner = ctx.TasuLivePlatformMonitoringSmokeRunner;
  const EdgeClient = ctx.TasuLivePlatformMonitoringEdgeClient;
  const SURFACES = ctx.LIVE_SURFACES;
  const BS = ctx.PLATFORM_LIVE_BROADCAST_STATES;
  const SS = ctx.PLATFORM_LIVE_SESSION_STATES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of MONITORING_LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }
  assert(fs.existsSync(path.join(ROOT, "supabase/functions/live-platform-monitoring/index.ts")), "static:edge-function");

  // --- Health healthy ---
  console.log("\n--- Health healthy ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-healthy");
    const mon = new MonitoringService();
    mon.wire({ ...stack, ccuRegistry: stack.ccuRegistry });
    const hr = await mon.getHealth({ surface: PLATFORM });
    assert(hr.healthy && hr.health === HS.HEALTHY, "health:healthy");
    assert(hr.services?.broadcast?.live === true, "health:broadcast-live");
  }

  // --- Degraded provider ---
  console.log("\n--- Degraded provider ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-degraded");
    stack.provider.getMonitoringProbe = async () => ({ ok: true, status: "degraded", stub: true });
    const mon = new MonitoringService();
    mon.wire(stack);
    const hr = await mon.getHealth({ surface: PLATFORM });
    assert(hr.health === HS.DEGRADED, "health:degraded-provider");
  }

  // --- Failed service ---
  console.log("\n--- Failed service ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-failed");
    await stack.session.reportError({
      surface: PLATFORM,
      code: "TEST_ERROR",
      message: "injected failure",
      recoverable: false,
    });
    const mon = new MonitoringService();
    mon.wire(stack);
    const hr = await mon.getHealth({ surface: PLATFORM });
    assert(hr.health === HS.FAILED, "health:failed-session");
  }

  // --- Metrics snapshot ---
  console.log("\n--- Metrics snapshot ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-metrics");
    const mon = new MonitoringService();
    mon.wire(stack);

    await stack.chat.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-metrics",
      userId: "mon-user-1",
      text: "metrics test",
    });
    await stack.recording.startRecording({ surface: PLATFORM, broadcastId: "bc-metrics" });

    const mr = await mon.getMetrics({ surface: PLATFORM });
    const m = mr.metrics;
    const keys = [
      "activeSessions",
      "liveBroadcasts",
      "activeViewers",
      "ccu",
      "messagesSent",
      "messagesBlocked",
      "reactions",
      "activeRecordings",
      "completedRecordings",
      "providerStatus",
      "lastHeartbeatAt",
      "errors",
    ];
    assert(mr.ok && keys.every((k) => k in m), "metrics:required-keys");
    assert(m.liveBroadcasts >= 1 && m.activeRecordings >= 1, "metrics:live-values");
    assert(m.messagesSent >= 1, "metrics:messagesSent");
  }

  // --- Surface filter ---
  console.log("\n--- Surface filter ---\n");
  {
    const mon = new MonitoringService();
    const bad = await mon.getHealth({ surface: "bad-surface" });
    assert(!bad.ok && bad.code === MC.SURFACE_ERROR, "surface:invalid");
  }

  // --- Smoke runner success ---
  console.log("\n--- Smoke runner success ---\n");
  {
    const mon = new MonitoringService({ smokeRunner: new SmokeRunner() });
    const sr = await mon.runSmoke({ surface: PLATFORM });
    assert(sr.ok && sr.smoke?.ok, "smoke:success");
    assert((sr.smoke?.steps?.length || 0) >= 8, "smoke:step-count");
    assert(sr.smoke?.steps?.every((s) => s.name && typeof s.ok === "boolean"), "smoke:step-shape");
  }

  // --- Smoke runner failure ---
  console.log("\n--- Smoke runner failure ---\n");
  {
    const mon = new MonitoringService({ smokeRunner: new SmokeRunner() });
    const sr = await mon.runSmoke({ surface: PLATFORM, failAtStep: "chat_send" });
    assert(!sr.ok && sr.code === MC.MONITORING_SMOKE_FAILED, "smoke:failure-code");
    assert(sr.smoke?.failedStep === "chat_send", "smoke:failed-step");
  }

  // --- Errors aggregation ---
  console.log("\n--- Errors aggregation ---\n");
  {
    const mon = new MonitoringService();
    mon.recordError({ surface: PLATFORM, code: "E1", message: "first" });
    mon.recordError({ surface: PLATFORM, code: "E2", message: "second" });
    const mr = await mon.getMetrics({ surface: PLATFORM });
    assert(mr.metrics?.errors?.length >= 2, "errors:aggregated");
  }

  // --- Service status & provider status ---
  console.log("\n--- Service status ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-status");
    const mon = new MonitoringService();
    mon.wire(stack);
    const st = mon.getServiceStatus({ surface: PLATFORM });
    assert(st.ok && st.services?.session?.state, "status:session");
    assert(st.services?.broadcast?.state === BS.LIVE, "status:broadcast-live");
    const ps = await mon.getProviderStatus({ surface: PLATFORM });
    assert(ps.ok && ps.providerId, "provider:status");
  }

  // --- Edge client (local) ---
  console.log("\n--- Edge client (local) ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-edge");
    const mon = new MonitoringService({ smokeRunner: new SmokeRunner() });
    mon.wire(stack);
    const client = new EdgeClient({ localService: mon });
    const hr = await client.health({ surface: PLATFORM });
    assert(hr.ok && hr.healthy && hr.health === HS.HEALTHY, "edge-local:health");
    const mr = await client.metrics({ surface: PLATFORM });
    assert(mr.ok && mr.metrics, "edge-local:metrics");
  }

  // --- Phase A/B/C/D/E regression ---
  console.log("\n--- Phase A/B/C/D/E regression ---\n");
  {
    const stack = await setupLiveStack(ctx, PLATFORM, "bc-reg");
    assert(stack.broadcast.state === BS.LIVE, "regression:broadcast-live");
    assert(stack.session.state === SS.LIVE, "regression:session-live");

    const chat = await stack.chat.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-reg",
      userId: "mon-user-1",
      text: "regression",
    });
    assert(chat.ok, "regression:chat-send");

    const rec = await stack.recording.startRecording({ surface: PLATFORM, broadcastId: "bc-reg" });
    assert(rec.ok, "regression:recording-start");
  }

  // --- No TLV side effects ---
  console.log("\n--- No TLV side effects ---\n");
  {
    const paths = [
      "live/live-comments.js",
      "live/watch-video.html",
      "live/live-broadcasts.js",
      "live/live-video-upload.js",
    ];
    const snapshots = paths.map((p) => ({ p, content: fs.readFileSync(path.join(ROOT, p), "utf8") }));

    const svcCode = fs.readFileSync(path.join(ROOT, "platform-live/monitoring/live-monitoring-service.js"), "utf8");
    assert(!svcCode.includes("watch-video"), "tlv:no-watch-video-ref");
    assert(!svcCode.includes("live-broadcasts"), "tlv:no-broadcasts-ref");
    assert(!svcCode.includes("live-comments"), "tlv:no-comments-ref");
    assert(!svcCode.includes("live-video-upload"), "tlv:no-vod-ref");

    for (const { p, content } of snapshots) {
      assert(content === fs.readFileSync(path.join(ROOT, p), "utf8"), `tlv:${p.split("/").pop()}-unmodified`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase F tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
