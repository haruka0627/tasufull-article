#!/usr/bin/env node
/**
 * Live Platform Viewer — Phase C unit tests
 *
 *   node scripts/test-platform-live-viewer-phase-c.mjs
 *   npm run test:platform-live-viewer-phase-c
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

const LOAD_ORDER = [...CORE_LOAD_ORDER, ...BROADCAST_LOAD_ORDER, ...VIEWER_LOAD_ORDER];

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

async function setupLiveBroadcast(BroadcastService, PLATFORM, id = "bc-live") {
  const bs = new BroadcastService();
  await bs.createBroadcast({ surface: PLATFORM, broadcastId: id, roomId: `room-${id}` });
  await bs.startBroadcast({ surface: PLATFORM });
  return bs;
}

async function run() {
  console.log("\n=== Live Platform Viewer — Phase C unit tests ===\n");

  const ctx = loadRuntime();
  const VS = ctx.PLATFORM_LIVE_VIEWER_STATES;
  const VE = ctx.PLATFORM_LIVE_VIEWER_EVENTS;
  const BS = ctx.PLATFORM_LIVE_BROADCAST_STATES;
  const SURFACES = ctx.LIVE_SURFACES;
  const VC = ctx.PLATFORM_LIVE_VIEWER_ERROR_CODES;
  const ViewerService = ctx.TasuLivePlatformViewerService;
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const SessionManager = ctx.TasuLivePlatformSessionManager;
  const CcuRegistry = ctx.TasuLivePlatformViewerCcuRegistry;
  const createProvider = ctx.createPlatformLiveProvider;
  const EdgeClient = ctx.TasuLivePlatformViewerEdgeClient;
  const SESSION_STATES = ctx.PLATFORM_LIVE_SESSION_STATES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of VIEWER_LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }
  assert(fs.existsSync(path.join(ROOT, "supabase/functions/live-platform-viewer/index.ts")), "static:edge-function");

  // --- Invalid surface ---
  console.log("\n--- Surface validation ---\n");
  {
    const vs = new ViewerService();
    const bad = await vs.joinViewer({ surface: "invalid", userId: "u1" });
    assert(!bad.ok && bad.code === VC.SURFACE_ERROR, "surface:invalid-rejected");
  }

  // --- Join live broadcast ---
  console.log("\n--- Join live broadcast ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM);
    const ccu = new CcuRegistry({ heartbeatTtlMs: 30_000 });
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: ccu });

    const joined = [];
    vs.on(VE.VIEWER_JOINED, (p) => joined.push(p));

    const jr = await vs.joinViewer({ surface: PLATFORM, userId: "viewer-1" });
    assert(jr.ok && jr.state === VS.WATCHING, "join:→watching");
    assert(joined.length === 1, "join:VIEWER_JOINED-event");
    assert(vs.getCcu({ surface: PLATFORM, broadcastId: "bc-live" }) === 1, "join:ccu-1");
    assert(broadcast.broadcast?.viewerCount === 1, "join:broadcast-ccu-sync");
  }

  // --- Join non-live denied ---
  console.log("\n--- Join non-live denied ---\n");
  {
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-draft", roomId: "room-draft" });
    const vs = new ViewerService({ broadcastService: broadcast });

    const denied = await vs.joinViewer({ surface: PLATFORM, userId: "viewer-2" });
    assert(!denied.ok && denied.code === VC.BROADCAST_NOT_LIVE, "join:denied-non-live");
  }

  // --- Leave ---
  console.log("\n--- Leave ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-leave");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });
    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-leave" });

    const lr = await vs.leaveViewer({ surface: PLATFORM, userId: "viewer-leave" });
    assert(lr.ok && lr.state === VS.IDLE, "leave:→idle");
    assert(vs.getCcu({ surface: PLATFORM, broadcastId: "bc-leave" }) === 0, "leave:ccu-0");
    assert(broadcast.broadcast?.viewerCount === 0, "leave:broadcast-ccu-sync");
  }

  // --- Reconnect ---
  console.log("\n--- Reconnect ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-reconn");
    const session = new SessionManager();
    const vs = new ViewerService({
      broadcastService: broadcast,
      sessionManager: session,
      ccuRegistry: new CcuRegistry(),
    });

    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-reconn" });
    const rr = await vs.reconnectViewer({ surface: PLATFORM, userId: "viewer-reconn" });
    assert(rr.ok && rr.state === VS.WATCHING, "reconnect:→watching");
    assert(session.state === SESSION_STATES.CONNECTED || session.state === SESSION_STATES.RECONNECTED, "reconnect:session-ok");
  }

  // --- Heartbeat ---
  console.log("\n--- Heartbeat ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-hb");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });
    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-hb" });

    const hbEvents = [];
    vs.on(VE.VIEWER_HEARTBEAT, (p) => hbEvents.push(p));
    const hr = await vs.heartbeat({ surface: PLATFORM, userId: "viewer-hb" });
    assert(hr.ok && hr.lastHeartbeatAt, "heartbeat:ok");
    assert(hbEvents.length === 1, "heartbeat:event");
  }

  // --- Expired viewer reconnect denied ---
  console.log("\n--- Expired viewer ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-exp");
    const ccu = new CcuRegistry({ heartbeatTtlMs: 1000 });
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: ccu, heartbeatTtlMs: 1000 });
    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-exp" });

    const base = Date.now();
    await vs.expireStaleViewers({ surface: PLATFORM, broadcastId: "bc-exp", nowMs: base + 5000 });

    const ws = vs.getWatchState({ surface: PLATFORM, userId: "viewer-exp" });
    assert(ws.watchState?.viewerState === VS.EXPIRED, "expired:state");

    const denied = await vs.reconnectViewer({ surface: PLATFORM, userId: "viewer-exp" });
    assert(!denied.ok && denied.code === VC.VIEWER_EXPIRED, "expired:reconnect-denied");
  }

  // --- Kicked viewer denied ---
  console.log("\n--- Kicked viewer ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-kick");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });
    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-kick" });
    await vs.kickViewer({ surface: PLATFORM, userId: "viewer-kick", reason: "test" });

    const denied = await vs.joinViewer({ surface: PLATFORM, userId: "viewer-kick" });
    assert(!denied.ok && denied.code === VC.VIEWER_KICKED, "kicked:join-denied");
  }

  // --- CCU count multiple viewers ---
  console.log("\n--- CCU count ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-ccu");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });

    await vs.joinViewer({ surface: PLATFORM, userId: "v-a" });
    await vs.joinViewer({ surface: PLATFORM, userId: "v-b" });
    await vs.joinViewer({ surface: PLATFORM, userId: "v-c" });

    assert(vs.getCcu({ surface: PLATFORM, broadcastId: "bc-ccu" }) === 3, "ccu:3-viewers");
    assert(broadcast.broadcast?.viewerCount === 3, "ccu:broadcast-sync-3");

    await vs.leaveViewer({ surface: PLATFORM, userId: "v-b" });
    assert(vs.getCcu({ surface: PLATFORM, broadcastId: "bc-ccu" }) === 2, "ccu:after-leave-2");
  }

  // --- Provider stub ---
  console.log("\n--- Provider stub ---\n");
  {
    const provider = createProvider("stub");
    await provider.initialize({ surface: PLATFORM });
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-prov");
    const vs = new ViewerService({
      broadcastService: broadcast,
      provider,
      ccuRegistry: new CcuRegistry(),
    });

    const jr = await vs.joinViewer({ surface: PLATFORM, userId: "viewer-prov" });
    assert(jr.ok, "provider:join");
    await vs.heartbeat({ surface: PLATFORM, userId: "viewer-prov" });
    await vs.reconnectViewer({ surface: PLATFORM, userId: "viewer-prov" });
    await vs.leaveViewer({ surface: PLATFORM, userId: "viewer-prov" });

    const zegoFallback = createProvider("zego", { allowStubFallback: true });
    const vh = await zegoFallback.viewerHeartbeat({ surface: PLATFORM, broadcastId: "x", userId: "u" });
    assert(vh.stub === true, "provider:zego-fallback-heartbeat");
  }

  // --- Edge client local ---
  console.log("\n--- Edge client (local) ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-edge");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });
    const client = new EdgeClient({ localService: vs });

    const jr = await client.join({ surface: PLATFORM, userId: "edge-u1" });
    assert(jr.ok && jr.state === VS.WATCHING, "edge-local:join");

    const ws = await client.watchState({ surface: PLATFORM, userId: "edge-u1" });
    assert(ws.ok && ws.watchState?.viewerState === VS.WATCHING, "edge-local:watch-state");

    await client.leave({ surface: PLATFORM, userId: "edge-u1" });
  }

  // --- Phase A / B regression ---
  console.log("\n--- Phase A/B regression ---\n");
  {
    const session = new SessionManager();
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-reg");
    const vs = new ViewerService({ broadcastService: broadcast, sessionManager: session, ccuRegistry: new CcuRegistry() });

    await vs.joinViewer({ surface: PLATFORM, userId: "reg-u1" });
    assert(session.state === SESSION_STATES.CONNECTED, "regression:session-CONNECTED");
    assert(broadcast.state === BS.LIVE, "regression:broadcast-LIVE");
  }

  // --- No TLV side effects ---
  console.log("\n--- No TLV side effects ---\n");
  {
    const watchVideo = path.join(ROOT, "live/watch-video.html");
    const broadcasts = path.join(ROOT, "live/live-broadcasts.js");
    const beforeW = fs.readFileSync(watchVideo, "utf8");
    const beforeB = fs.readFileSync(broadcasts, "utf8");

    const svcCode = fs.readFileSync(path.join(ROOT, "platform-live/viewer/live-viewer-service.js"), "utf8");
    assert(!svcCode.includes("watch-video"), "tlv:no-watch-video-ref");
    assert(!svcCode.includes("live-broadcasts.js"), "tlv:no-broadcasts-import");
    assert(!svcCode.toLowerCase().includes("wallet"), "tlv:no-wallet");

    assert(beforeW === fs.readFileSync(watchVideo, "utf8"), "tlv:watch-video-unmodified");
    assert(beforeB === fs.readFileSync(broadcasts, "utf8"), "tlv:live-broadcasts-unmodified");
  }

  // --- Watch state ---
  console.log("\n--- Watch state ---\n");
  {
    const broadcast = await setupLiveBroadcast(BroadcastService, PLATFORM, "bc-watch");
    const vs = new ViewerService({ broadcastService: broadcast, ccuRegistry: new CcuRegistry() });
    await vs.joinViewer({ surface: PLATFORM, userId: "viewer-ws" });

    const ws = vs.getWatchState({ surface: PLATFORM, userId: "viewer-ws" });
    assert(ws.ok && ws.watchState?.broadcastState === BS.LIVE, "watch-state:broadcast-live");
    assert(ws.watchState?.canReconnect === true, "watch-state:canReconnect");
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase C tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
