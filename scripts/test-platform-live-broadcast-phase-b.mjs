#!/usr/bin/env node
/**
 * Live Platform Broadcast — Phase B unit tests
 *
 *   node scripts/test-platform-live-broadcast-phase-b.mjs
 *   npm run test:platform-live-broadcast-phase-b
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

const LOAD_ORDER = [...CORE_LOAD_ORDER, ...BROADCAST_LOAD_ORDER];

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

function collectEvents(svc, eventName) {
  const list = [];
  svc.on(eventName, (payload) => list.push(payload));
  return list;
}

async function run() {
  console.log("\n=== Live Platform Broadcast — Phase B unit tests ===\n");

  const ctx = loadRuntime();
  const BS = ctx.PLATFORM_LIVE_BROADCAST_STATES;
  const BE = ctx.PLATFORM_LIVE_BROADCAST_EVENTS;
  const SURFACES = ctx.LIVE_SURFACES;
  const BC = ctx.PLATFORM_LIVE_BROADCAST_ERROR_CODES;
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const SessionManager = ctx.TasuLivePlatformSessionManager;
  const createProvider = ctx.createPlatformLiveProvider;
  const EdgeClient = ctx.TasuLivePlatformBroadcastEdgeClient;
  const SESSION_STATES = ctx.PLATFORM_LIVE_SESSION_STATES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of BROADCAST_LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }
  assert(fs.existsSync(path.join(ROOT, "supabase/functions/live-platform-broadcast/index.ts")), "static:edge-function");

  // --- Invalid surface ---
  console.log("\n--- Surface validation ---\n");
  {
    const svc = new BroadcastService();
    const bad = await svc.createBroadcast({ surface: "bad-surface", roomId: "r1" });
    assert(!bad.ok && bad.code === BC.SURFACE_ERROR, "surface:invalid-rejected");

    const missing = await svc.createBroadcast({ roomId: "r2" });
    assert(!missing.ok && missing.code === BC.SURFACE_ERROR, "surface:missing-rejected");
  }

  // --- Create broadcast ---
  console.log("\n--- Create broadcast ---\n");
  {
    const svc = new BroadcastService();
    const created = collectEvents(svc, BE.BROADCAST_CREATED);
    const cr = await svc.createBroadcast({
      surface: PLATFORM,
      broadcastId: "bc-test-1",
      title: "Test Broadcast",
      roomId: "room-bc-1",
    });
    assert(cr.ok && svc.state === BS.DRAFT, "create:→draft");
    assert(svc.broadcast?.surface === PLATFORM, "create:surface-stored");
    assert(created.length === 1 && created[0].broadcastId === "bc-test-1", "create:BROADCAST_CREATED");
  }

  // --- Start / Stop lifecycle ---
  console.log("\n--- Start / Stop ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-life", roomId: "room-life" });

    const starting = collectEvents(svc, BE.BROADCAST_STARTING);
    const started = collectEvents(svc, BE.BROADCAST_STARTED);
    const sr = await svc.startBroadcast({ surface: PLATFORM });
    assert(sr.ok && svc.state === BS.LIVE, "start:→live");
    assert(starting.length === 1 && started.length === 1, "start:events");

    const stopping = collectEvents(svc, BE.BROADCAST_STOPPING);
    const stopped = collectEvents(svc, BE.BROADCAST_STOPPED);
    const st = await svc.stopBroadcast({ surface: PLATFORM, reason: "test" });
    assert(st.ok && svc.state === BS.ENDED, "stop:→ended");
    assert(stopping.length === 1 && stopped.length === 1, "stop:events");
  }

  // --- Invalid state transition ---
  console.log("\n--- Invalid transitions ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-guard", roomId: "room-guard" });

    const badStart = await svc.startBroadcast({ surface: PLATFORM });
    assert(badStart.ok, "guard:baseline-start");

    const badStart2 = await svc.startBroadcast({ surface: PLATFORM });
    assert(!badStart2.ok && badStart2.code === BC.BROADCAST_STATE_ERROR, "guard:start-from-live");

    const badStop = await svc.stopBroadcast({ surface: PLATFORM });
    assert(badStop.ok, "guard:stop-from-live");

    const badStop2 = await svc.stopBroadcast({ surface: PLATFORM });
    assert(!badStop2.ok && badStop2.code === BC.BROADCAST_STATE_ERROR, "guard:stop-from-ended");
  }

  // --- Health ---
  console.log("\n--- Health ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-health", roomId: "room-health" });
    await svc.startBroadcast({ surface: PLATFORM });

    const healthEvents = collectEvents(svc, BE.BROADCAST_HEALTH);
    const hr = await svc.getBroadcastHealth({ surface: PLATFORM });
    assert(hr.ok && hr.health?.broadcastState === BS.LIVE, "health:live-ok");
    assert(hr.health?.ok === true, "health:ok-flag");
    assert(healthEvents.length === 1, "health:BROADCAST_HEALTH-event");
  }

  // --- Viewer count ---
  console.log("\n--- Viewer count ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-ccu", roomId: "room-ccu" });
    await svc.startBroadcast({ surface: PLATFORM });

    const vcEvents = collectEvents(svc, BE.VIEWER_COUNT_UPDATED);
    const u1 = await svc.updateViewerCount({ surface: PLATFORM, count: 42 });
    assert(u1.ok && u1.viewerCount === 42, "ccu:update-42");
    assert(vcEvents.length === 1 && vcEvents[0].viewerCount === 42, "ccu:event");

    const bad = await svc.updateViewerCount({ surface: PLATFORM, count: -1 });
    assert(!bad.ok, "ccu:reject-negative");

    await svc.stopBroadcast({ surface: PLATFORM });
    const afterStop = await svc.updateViewerCount({ surface: PLATFORM, count: 1 });
    assert(!afterStop.ok, "ccu:reject-after-stop");
  }

  // --- Provider stub + session integration ---
  console.log("\n--- Provider stub + Session ---\n");
  {
    const provider = createProvider("stub");
    await provider.initialize({ surface: PLATFORM });

    const session = new SessionManager();
    const svc = new BroadcastService({ sessionManager: session, provider });
    svc.setProvider(provider);

    const signals = [];
    provider.onBroadcastSignal((sig, payload) => signals.push({ sig, payload }));

    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-prov", roomId: "room-prov" });
    const sr = await svc.startBroadcast({ surface: PLATFORM, userId: "host-1" });
    assert(sr.ok && svc.state === BS.LIVE, "provider:start→live");
    assert(session.state === SESSION_STATES.LIVE, "session:wired→LIVE");
    assert(signals.some((s) => s.sig.includes("STARTED")), "provider:broadcast-signals");

    await svc.updateViewerCount({ surface: PLATFORM, count: 7 });
    const hr = await svc.getBroadcastHealth({ surface: PLATFORM });
    assert(hr.health?.providerOk === true && hr.health?.stub === true, "provider:health-stub");

    await svc.stopBroadcast({ surface: PLATFORM });
    assert(svc.state === BS.ENDED, "provider:stop→ended");
    assert(session.state === SESSION_STATES.ENDED, "session:wired→ENDED");

    const zegoFallback = createProvider("zego", { allowStubFallback: true });
    assert(zegoFallback.providerId === "stub", "provider:zego-fallback");
    const bh = await zegoFallback.getBroadcastHealth({
      broadcastId: "x",
      roomId: "r",
      surface: PLATFORM,
    });
    assert(bh.stub === true, "provider:fallback-health-stub");
  }

  // --- Edge client local fallback ---
  console.log("\n--- Edge client (local) ---\n");
  {
    const svc = new BroadcastService();
    const client = new EdgeClient({ localService: svc });

    const cr = await client.create({ surface: PLATFORM, broadcastId: "bc-edge", roomId: "room-edge" });
    assert(cr.ok && cr.state === BS.DRAFT, "edge-local:create");

    const sr = await client.start({ surface: PLATFORM });
    assert(sr.ok && sr.state === BS.LIVE, "edge-local:start");

    const hr = await client.health({ surface: PLATFORM });
    assert(hr.ok && hr.health?.broadcastState === BS.LIVE, "edge-local:health");

    const vc = await client.updateViewerCount({ surface: PLATFORM, count: 99 });
    assert(vc.ok && vc.viewerCount === 99, "edge-local:viewer-count");

    await client.stop({ surface: PLATFORM });
  }

  // --- Phase A core regression (broadcast does not break session) ---
  console.log("\n--- Phase A regression ---\n");
  {
    const session = new SessionManager();
    const cr = await session.createSession({ surface: PLATFORM, roomId: "room-pa", role: "host" });
    assert(cr.ok && session.state === SESSION_STATES.READY, "phaseA:session-create");

    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-pa", roomId: "room-pa" });
    await svc.startBroadcast({ surface: PLATFORM });
    assert(svc.state === BS.LIVE, "phaseA:broadcast-independent");
  }

  // --- No TLV side effects ---
  console.log("\n--- No TLV side effects ---\n");
  {
    const broadcastsPath = path.join(ROOT, "live/live-broadcasts.js");
    const bridgePath = path.join(ROOT, "live/live-broadcasts-session-bridge.js");
    const beforeB = fs.readFileSync(broadcastsPath, "utf8");
    const beforeBridge = fs.readFileSync(bridgePath, "utf8");

    const svcCode = fs.readFileSync(path.join(ROOT, "platform-live/broadcast/live-broadcast-service.js"), "utf8");
    assert(!svcCode.includes("TlvLive"), "tlv:no-Tlv-prefix");
    assert(!svcCode.includes("live-broadcasts.js"), "tlv:no-broadcasts-import");
    assert(!svcCode.toLowerCase().includes("wallet"), "tlv:no-wallet");
    assert(!beforeB.includes("TasuLivePlatformBroadcastService"), "tlv:broadcasts-unwired");

    const afterB = fs.readFileSync(broadcastsPath, "utf8");
    const afterBridge = fs.readFileSync(bridgePath, "utf8");
    assert(beforeB === afterB, "tlv:live-broadcasts-unmodified");
    assert(beforeBridge === afterBridge, "tlv:session-bridge-unmodified");
  }

  // --- Surface mismatch ---
  console.log("\n--- Surface mismatch ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-mismatch", roomId: "room-m" });
    const bad = await svc.startBroadcast({ surface: SURFACES.TALK });
    assert(!bad.ok && bad.code === BC.SURFACE_ERROR, "surface:mismatch-rejected");
  }

  // --- Reset from ended ---
  console.log("\n--- Reset ---\n");
  {
    const svc = new BroadcastService();
    await svc.createBroadcast({ surface: PLATFORM, broadcastId: "bc-reset", roomId: "room-reset" });
    await svc.startBroadcast({ surface: PLATFORM });
    await svc.stopBroadcast({ surface: PLATFORM });
    const rr = await svc.resetBroadcast({ surface: PLATFORM });
    assert(rr.ok && svc.state === BS.DRAFT, "reset:ended→draft");
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase B tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
