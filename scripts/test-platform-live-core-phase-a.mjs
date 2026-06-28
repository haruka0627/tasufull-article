#!/usr/bin/env node
/**
 * Live Platform Core — Phase A unit tests
 *
 *   node scripts/test-platform-live-core-phase-a.mjs
 *   npm run test:platform-live-core-phase-a
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOAD_ORDER = [
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
  "platform-live/core/live-platform-service.js",
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

function collectEvents(manager, eventName) {
  const list = [];
  manager.on(eventName, (payload) => list.push(payload));
  return list;
}

async function run() {
  console.log("\n=== Live Platform Core — Phase A unit tests ===\n");

  const ctx = loadRuntime();
  const S = ctx.PLATFORM_LIVE_SESSION_STATES;
  const E = ctx.PLATFORM_LIVE_SESSION_EVENTS;
  const SURFACES = ctx.LIVE_SURFACES;
  const Manager = ctx.TasuLivePlatformSessionManager;
  const Service = ctx.TasuLivePlatformService;
  const createProvider = ctx.createPlatformLiveProvider;
  const CODES = ctx.PLATFORM_LIVE_SESSION_ERROR_CODES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Static scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }

  // --- Invalid surface ---
  console.log("\n--- Surface validation ---\n");
  {
    const m = new Manager();
    const bad = await m.createSession({ surface: "invalid-surface", roomId: "room-x" });
    assert(!bad.ok && bad.code === CODES.SURFACE_ERROR, "surface:invalid-rejected");

    const missing = await m.createSession({ roomId: "room-y" });
    assert(!missing.ok && missing.code === CODES.SURFACE_ERROR, "surface:missing-rejected");

    const V = ctx.TasuLivePlatformSessionValidation;
    const reserved = V.validateSurface(SURFACES.TLV);
    assert(reserved.ok && reserved.value === "tlv", "surface:tlv-reserved-valid");
  }

  // --- Create session (platform) ---
  console.log("\n--- Create session ---\n");
  {
    const m = new Manager();
    const created = collectEvents(m, E.LIVE_CREATED);
    const cr = await m.createSession({ surface: PLATFORM, roomId: "room-a", role: "host" });
    assert(cr.ok && m.state === S.READY, "create:→READY");
    assert(m.session?.surface === PLATFORM, "create:surface-stored");
    assert(created.length === 1 && created[0].surface === PLATFORM, "create:LIVE_CREATED+surface");
  }

  // --- Host flow ---
  console.log("\n--- Host lifecycle ---\n");
  {
    const m = new Manager();
    await m.createSession({ surface: PLATFORM, roomId: "room-host", role: "host" });
    const started = collectEvents(m, E.LIVE_STARTED);
    const sr = await m.start({ surface: PLATFORM });
    assert(sr.ok && m.state === S.LIVE, "host:start→LIVE");
    assert(started.length === 1 && started[0].surface === PLATFORM, "host:LIVE_STARTED");

    const er = await m.end({ surface: PLATFORM });
    assert(er.ok && m.state === S.ENDED, "host:end→ENDED");
  }

  // --- Viewer join / leave ---
  console.log("\n--- Join / Leave ---\n");
  {
    const m = new Manager();
    await m.createSession({ surface: PLATFORM, roomId: "room-viewer", role: "viewer" });
    const joined = collectEvents(m, E.LIVE_JOINED);
    const jr = await m.join({ surface: PLATFORM });
    assert(jr.ok && m.state === S.CONNECTED, "viewer:join→CONNECTED");
    assert(joined.length === 1, "viewer:LIVE_JOINED");

    const left = collectEvents(m, E.LIVE_LEFT);
    const lr = await m.leave({ surface: PLATFORM });
    assert(lr.ok && m.state === S.READY, "viewer:leave→READY");
    assert(left.length === 1 && left[0].role === "viewer", "viewer:LIVE_LEFT");
  }

  // --- Reconnect ---
  console.log("\n--- Reconnect ---\n");
  {
    const m = new Manager();
    await m.createSession({ surface: PLATFORM, roomId: "room-reconnect" });
    await m.start({ surface: PLATFORM });
    const rec = collectEvents(m, E.RECONNECTING);
    const reconn = collectEvents(m, E.RECONNECTED);
    const r = await m.reconnect({ surface: PLATFORM });
    assert(r.ok && m.state === S.LIVE, "reconnect:→LIVE");
    assert(rec.length === 1 && rec[0].attempt === 1, "reconnect:RECONNECTING");
    assert(reconn.length === 1, "reconnect:RECONNECTED");
  }

  // --- Presence heartbeat ---
  console.log("\n--- Presence ---\n");
  {
    const m = new Manager();
    await m.createSession({ surface: PLATFORM, roomId: "room-presence", role: "viewer", userId: "user-1" });
    await m.join({ surface: PLATFORM });

    const presenceEvents = collectEvents(m, E.PRESENCE_UPDATED);
    const p1 = await m.updatePresence({ surface: PLATFORM, status: "online", userId: "user-1" });
    assert(p1.ok && p1.presence?.seq === 1, "presence:heartbeat-seq-1");

    const p2 = await m.updatePresence({ surface: PLATFORM, status: "away" });
    assert(p2.ok && p2.presence?.status === "away" && p2.presence?.seq === 2, "presence:heartbeat-seq-2");
    assert(presenceEvents.length === 2 && presenceEvents[1].surface === PLATFORM, "presence:PRESENCE_UPDATED");

    const badState = await m.updatePresence({ surface: PLATFORM });
    await m.leave({ surface: PLATFORM });
    const afterLeave = await m.updatePresence({ surface: PLATFORM });
    assert(!afterLeave.ok, "presence:reject-after-leave");
  }

  // --- Provider stub ---
  console.log("\n--- Provider stub ---\n");
  {
    const stub = createProvider("stub");
    assert(stub.providerId === "stub", "stub:provider-id");
    const init = await stub.initialize({ surface: PLATFORM });
    assert(init.ok && init.stub === true, "stub:initialize");

    const signals = [];
    stub.onSignal((sig, payload) => signals.push({ sig, payload }));
    const start = await stub.startLive({ roomId: "stub-room", userId: "u1", surface: PLATFORM });
    assert(start.ok && start.stub === true, "stub:startLive");
    assert(signals.length >= 2, "stub:emits-signals");

    const zegoFallback = createProvider("zego", { allowStubFallback: true });
    assert(zegoFallback.providerId === "stub", "stub:zego-fallback");
    assert(ctx.isPlatformLiveStubFallback(zegoFallback), "stub:zego-fallback-flag");
  }

  // --- Service integration (platform MVP) ---
  console.log("\n--- LivePlatformService ---\n");
  {
    const svc = new Service();
    const init = await svc.initialize({ surface: PLATFORM, providerId: "stub" });
    assert(init.ok && init.stubFallback === true, "service:init-stub");

    const start = await svc.startLive({
      surface: PLATFORM,
      roomId: "svc-room",
      userId: "host-1",
    });
    assert(start.ok && svc.getSessionState() === S.LIVE, "service:startLive→LIVE");

    const presence = await svc.updatePresence({ surface: PLATFORM, status: "online" });
    assert(presence.ok, "service:updatePresence");

    const recon = await svc.reconnect({ surface: PLATFORM });
    assert(recon.ok && svc.getSessionState() === S.LIVE, "service:reconnect");

    await svc.leaveLive({ surface: PLATFORM });
    await svc.dispose();
    assert(svc.getSessionState() === S.IDLE, "service:dispose→IDLE");
  }

  // --- No TLV side effects ---
  console.log("\n--- No TLV side effects ---\n");
  {
    const tlvSessionPath = path.join(ROOT, "live/session/live-session-manager.js");
    const tlvBefore = fs.readFileSync(tlvSessionPath, "utf8");
    assert(!ctx.TlvLiveSessionManager, "tlv:no-TlvLiveSessionManager-in-runtime");
    assert(!ctx.TlvLiveService, "tlv:no-TlvLiveService-in-runtime");
    assert(!globalThis.TlvLiveSessionManager, "tlv:no-global-TlvManager");

    const platformMgr = fs.readFileSync(path.join(ROOT, "platform-live/core/live-session-manager.js"), "utf8");
    assert(!platformMgr.includes("TlvLive"), "tlv:platform-manager-no-Tlv-prefix");
    assert(!platformMgr.includes("wallet"), "tlv:no-wallet-reference");
    assert(!platformMgr.includes("tip"), "tlv:no-tip-reference");

    const tlvAfter = fs.readFileSync(tlvSessionPath, "utf8");
    assert(tlvBefore === tlvAfter, "tlv:live-session-unmodified");

    const liveHtmlGlob = fs.readdirSync(path.join(ROOT, "live")).filter((f) => f.endsWith(".html"));
    assert(liveHtmlGlob.length > 0, "tlv:live-html-exists-unchanged");
  }

  // --- Surface mismatch ---
  console.log("\n--- Surface mismatch ---\n");
  {
    const m = new Manager();
    await m.createSession({ surface: PLATFORM, roomId: "room-mismatch" });
    const bad = await m.join({ surface: SURFACES.TALK });
    assert(!bad.ok && bad.code === CODES.SURFACE_ERROR, "surface:mismatch-rejected");
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase A tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
