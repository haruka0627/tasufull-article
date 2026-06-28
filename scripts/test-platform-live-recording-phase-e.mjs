#!/usr/bin/env node
/**
 * Live Platform Recording — Phase E unit tests
 *
 *   node scripts/test-platform-live-recording-phase-e.mjs
 *   npm run test:platform-live-recording-phase-e
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

const LOAD_ORDER = [
  ...CORE_LOAD_ORDER,
  ...BROADCAST_LOAD_ORDER,
  ...VIEWER_LOAD_ORDER,
  ...CHAT_LOAD_ORDER,
  ...RECORDING_LOAD_ORDER,
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

async function setupLiveBroadcast(ctx, PLATFORM, id = "bc-rec") {
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const broadcast = new BroadcastService();
  await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: id, roomId: `room-${id}` });
  await broadcast.startBroadcast({ surface: PLATFORM });
  return broadcast;
}

async function run() {
  console.log("\n=== Live Platform Recording — Phase E unit tests ===\n");

  const ctx = loadRuntime();
  const RS = ctx.PLATFORM_LIVE_RECORDING_STATES;
  const RE = ctx.PLATFORM_LIVE_RECORDING_EVENTS;
  const RC = ctx.PLATFORM_LIVE_RECORDING_ERROR_CODES;
  const TRANS = ctx.PLATFORM_LIVE_RECORDING_TRANSITIONS;
  const RecordingService = ctx.TasuLivePlatformRecordingService;
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const ChatGateway = ctx.TasuLivePlatformChatGateway;
  const ViewerService = ctx.TasuLivePlatformViewerService;
  const createProvider = ctx.createPlatformLiveProvider;
  const EdgeClient = ctx.TasuLivePlatformRecordingEdgeClient;
  const BS = ctx.PLATFORM_LIVE_BROADCAST_STATES;
  const SURFACES = ctx.LIVE_SURFACES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of RECORDING_LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }
  assert(fs.existsSync(path.join(ROOT, "supabase/functions/live-platform-recording/index.ts")), "static:edge-function");

  // --- Start recording for live broadcast ---
  console.log("\n--- Start recording (live broadcast) ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-start-live");
    const rec = new RecordingService({ broadcastService: broadcast });
    const started = [];
    rec.on(RE.RECORDING_STARTED, (p) => started.push(p));

    const sr = await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-start-live" });
    assert(sr.ok && sr.state === RS.RECORDING, "start:→recording");
    assert(sr.metadata?.recordingId && sr.metadata?.broadcastId === "bc-start-live", "start:metadata-fields");
    assert(sr.metadata?.surface === PLATFORM, "start:surface");
    assert(sr.metadata?.startedAt && sr.metadata?.storageKey, "start:timestamps");
    assert(started.length === 1, "start:RECORDING_STARTED-event");
  }

  // --- Start denied for non-live broadcast ---
  console.log("\n--- Start denied (non-live) ---\n");
  {
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-draft", roomId: "room-draft" });
    const rec = new RecordingService({ broadcastService: broadcast });
    const bad = await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-draft" });
    assert(!bad.ok && bad.code === RC.BROADCAST_NOT_LIVE, "start:non-live-denied");
    assert(rec.state === RS.IDLE, "start:non-live-idle");
  }

  // --- Stop recording ---
  console.log("\n--- Stop recording ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-stop");
    const rec = new RecordingService({ broadcastService: broadcast });
    await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-stop" });
    const stopped = [];
    rec.on(RE.RECORDING_COMPLETED, (p) => stopped.push(p));
    const st = await rec.stopRecording({ surface: PLATFORM });
    assert(st.ok && st.state === RS.COMPLETED, "stop:→completed");
    assert(st.metadata?.stoppedAt && st.metadata?.playbackUrl, "stop:playback-metadata");
    assert(st.metadata?.durationSec != null && st.metadata.durationSec >= 0, "stop:durationSec");
    assert(stopped.length === 1, "stop:RECORDING_COMPLETED-event");
  }

  // --- Status & metadata ---
  console.log("\n--- Status & metadata ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-status");
    const rec = new RecordingService({ broadcastService: broadcast });
    await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-status", sessionId: "sess-1" });

    const status = rec.getRecordingStatus({ surface: PLATFORM });
    assert(status.ok && status.state === RS.RECORDING, "status:recording");
    assert(status.metadata?.sessionId === "sess-1", "status:sessionId");

    const meta = rec.getRecordingMetadata({ surface: PLATFORM });
    assert(meta.ok && meta.metadata?.status === RS.RECORDING, "metadata:fields");
    assert(
      ["recordingId", "broadcastId", "sessionId", "surface", "provider", "startedAt", "stoppedAt", "durationSec", "storageKey", "playbackUrl", "status", "errorCode"].every(
        (k) => k in meta.metadata
      ),
      "metadata:required-keys"
    );
  }

  // --- Archive metadata ---
  console.log("\n--- Archive metadata ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-archive");
    const rec = new RecordingService({ broadcastService: broadcast });
    await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-archive" });
    await rec.stopRecording({ surface: PLATFORM });

    const archived = [];
    rec.on(RE.ARCHIVE_CREATED, (p) => archived.push(p));
    const ar = await rec.createArchiveMetadata({ surface: PLATFORM, ttlSec: 3600 });
    assert(ar.ok && ar.archive?.archiveId, "archive:created");
    assert(ar.archive?.expiresAt && ar.archive?.storageKey, "archive:fields");
    assert(archived.length === 1, "archive:ARCHIVE_CREATED-event");
  }

  // --- Invalid surface ---
  console.log("\n--- Invalid surface ---\n");
  {
    const rec = new RecordingService();
    const bad = await rec.startRecording({ surface: "invalid", broadcastId: "bc-x" });
    assert(!bad.ok && bad.code === RC.SURFACE_ERROR, "surface:invalid-start");
  }

  // --- Invalid state transition ---
  console.log("\n--- Invalid state transition ---\n");
  {
    const rec = new RecordingService();
    const stopIdle = await rec.stopRecording({ surface: PLATFORM });
    assert(!stopIdle.ok && (stopIdle.code === RC.RECORDING_NOT_FOUND || stopIdle.code === RC.RECORDING_STATE_ERROR), "transition:stop-idle-denied");

    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-trans");
    const rec2 = new RecordingService({ broadcastService: broadcast });
    await rec2.startRecording({ surface: PLATFORM, broadcastId: "bc-trans" });
    const doubleStart = await rec2.startRecording({ surface: PLATFORM, broadcastId: "bc-trans" });
    assert(!doubleStart.ok && doubleStart.code === RC.RECORDING_STATE_ERROR, "transition:double-start-denied");

    assert(!TRANS[RS.IDLE]?.includes(RS.COMPLETED), "transition:idle→completed-blocked");
    assert(TRANS[RS.RECORDING]?.includes(RS.STOPPING), "transition:recording→stopping-allowed");
  }

  // --- Provider stub ---
  console.log("\n--- Provider stub ---\n");
  {
    const provider = createProvider("stub");
    await provider.initialize({ surface: PLATFORM });
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-prov");
    const rec = new RecordingService({ broadcastService: broadcast, provider });

    const sr = await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-prov" });
    assert(sr.ok && sr.metadata?.storageKey?.includes("stub-rec"), "provider:start-storageKey");

    const st = await rec.stopRecording({ surface: PLATFORM });
    assert(st.ok && st.metadata?.playbackUrl?.includes("stub-playback"), "provider:stop-playbackUrl");

    const ps = provider.getRecordingStatus({ surface: PLATFORM, recordingId: sr.metadata.recordingId });
    assert(ps.ok && ps.state === "idle", "provider:status-after-stop");
  }

  // --- Provider stub fallback (zego) ---
  console.log("\n--- Provider stub fallback ---\n");
  {
    const zegoFallback = createProvider("zego", { allowStubFallback: true });
    const sr = await zegoFallback.startRecording({
      surface: PLATFORM,
      broadcastId: "bc-z",
      recordingId: "rec-z1",
    });
    assert(sr.ok && sr.stub === true, "provider:zego-start-fallback");

    const st = await zegoFallback.stopRecording({
      surface: PLATFORM,
      broadcastId: "bc-z",
      recordingId: "rec-z1",
    });
    assert(st.ok && st.stub === true && st.playbackUrl, "provider:zego-stop-fallback");
  }

  // --- Recording failure path ---
  console.log("\n--- Recording failure path ---\n");
  {
    const failProvider = {
      providerId: "fail-prov",
      async startRecording() {
        return { ok: false, error: "start failed", code: RC.RECORDING_PROVIDER_ERROR };
      },
      async stopRecording() {
        return { ok: false, error: "stop failed" };
      },
    };

    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-fail-start");
    const recStart = new RecordingService({ broadcastService: broadcast, provider: failProvider });
    const fs = await recStart.startRecording({ surface: PLATFORM, broadcastId: "bc-fail-start" });
    assert(!fs.ok && fs.code === RC.RECORDING_PROVIDER_ERROR, "failure:start-provider");
    assert(recStart.state === RS.FAILED, "failure:start→failed");

    const okProvider = {
      providerId: "ok-start-fail-stop",
      async startRecording() {
        return { ok: true, storageKey: "stub://x" };
      },
      async stopRecording() {
        return { ok: false, error: "stop failed" };
      },
    };
    const broadcast2 = await setupLiveBroadcast(ctx, PLATFORM, "bc-fail-stop");
    const recStop = new RecordingService({ broadcastService: broadcast2, provider: okProvider });
    await recStop.startRecording({ surface: PLATFORM, broadcastId: "bc-fail-stop" });
    const fst = await recStop.stopRecording({ surface: PLATFORM });
    assert(!fst.ok && fst.code === RC.RECORDING_PROVIDER_ERROR, "failure:stop-provider");
    assert(recStop.state === RS.FAILED, "failure:stop→failed");
  }

  // --- Expired state ---
  console.log("\n--- Expired state ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-expire");
    const rec = new RecordingService({ broadcastService: broadcast });
    await rec.startRecording({ surface: PLATFORM, broadcastId: "bc-expire" });
    await rec.stopRecording({ surface: PLATFORM });
    const ex = await rec.markExpired({ surface: PLATFORM });
    assert(ex.ok && rec.state === RS.EXPIRED, "expire:→expired");
    assert(ex.metadata?.playbackUrl == null, "expire:playback-cleared");
  }

  // --- Edge client (local) ---
  console.log("\n--- Edge client (local) ---\n");
  {
    const broadcast = await setupLiveBroadcast(ctx, PLATFORM, "bc-edge");
    const rec = new RecordingService({ broadcastService: broadcast });
    const client = new EdgeClient({ localService: rec });

    const sr = await client.start({ surface: PLATFORM, broadcastId: "bc-edge" });
    assert(sr.ok && sr.state === RS.RECORDING, "edge-local:start");

    const st = await client.stop({ surface: PLATFORM });
    assert(st.ok && st.state === RS.COMPLETED, "edge-local:stop");

    const ar = await client.archive({ surface: PLATFORM, ttlSec: 7200 });
    assert(ar.ok && ar.archive?.archiveId, "edge-local:archive");
  }

  // --- Phase A/B/C/D regression ---
  console.log("\n--- Phase A/B/C/D regression ---\n");
  {
    const SessionManager = ctx.TasuLivePlatformSessionManager;
    const session = new SessionManager();
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-reg", roomId: "room-reg" });
    await broadcast.startBroadcast({ surface: PLATFORM });
    assert(broadcast.state === BS.LIVE, "regression:broadcast-live");

    const viewer = new ViewerService({
      broadcastService: broadcast,
      sessionManager: session,
      ccuRegistry: new ctx.TasuLivePlatformViewerCcuRegistry(),
    });
    await viewer.joinViewer({ surface: PLATFORM, userId: "reg-u" });
    assert(session.state === ctx.PLATFORM_LIVE_SESSION_STATES.CONNECTED, "regression:session-connected");

    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });
    const chat = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-reg",
      userId: "reg-u",
      text: "regression chat",
    });
    assert(chat.ok, "regression:chat-send");
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

    const svcCode = fs.readFileSync(path.join(ROOT, "platform-live/recording/live-recording-service.js"), "utf8");
    assert(!svcCode.includes("watch-video"), "tlv:no-watch-video-ref");
    assert(!svcCode.includes("live-video-upload"), "tlv:no-vod-upload-ref");
    assert(!svcCode.includes("live-comments"), "tlv:no-comments-import");
    assert(!svcCode.includes("TasuLivePlatformChatGateway"), "tlv:no-chat-coupling");

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
  console.log("\nPhase E tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
