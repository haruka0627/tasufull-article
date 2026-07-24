#!/usr/bin/env node
/**
 * TLV Live Service + Session Manager — unit tests (Phase2-02)
 *
 *   node scripts/test-live-service-session.mjs
 *   npm run test:live-service-session
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SESSION_LOAD_ORDER = [
  "live/session/live-session-states.js",
  "live/session/live-session-events.js",
  "live/session/live-session-event-bus.js",
  "live/session/live-provider-signals.js",
  "live/session/live-session-error-codes.js",
  "live/session/live-session-validation.js",
  "live/session/live-session-manager.js",
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

function loadServiceRuntime() {
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
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: "mock-token", appId: 1, server: "mock" }),
    }),
  };
  context.window = context;
  context.globalThis = context;

  class MockProvider {
    constructor() {
      this._state = "idle";
    }

    get providerId() {
      return "mock";
    }

    get state() {
      return this._state;
    }

    async initialize() {
      this._state = "ready";
      return { ok: true, state: "ready" };
    }

    async startLive() {
      this._state = "live";
      return { ok: true, state: "live" };
    }

    async joinLive() {
      this._state = "joined";
      return { ok: true, state: "joined" };
    }

    async leaveLive() {
      this._state = "idle";
      return { ok: true, state: "idle" };
    }

    async endLive() {
      this._state = "idle";
      return { ok: true, state: "idle" };
    }

    async dispose() {
      this._state = "idle";
      return { ok: true, state: "idle" };
    }
  }

  context.createTlvLiveProvider = () => new MockProvider();
  context.TLV_LIVE_ZEGO_CONFIG = { provider: "mock", appId: 1, server: "wss://mock" };

  const ctx = vm.createContext(context);
  for (const rel of SESSION_LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/live-service.js"), "utf8"), ctx);
  return context;
}

async function run() {
  console.log("\n=== TLV Live Service + Session Manager — unit tests ===\n");

  const ctx = loadServiceRuntime();
  const S = ctx.LIVE_SESSION_STATES;
  const E = ctx.LIVE_SESSION_EVENTS;
  const Service = ctx.TlvLiveService;

  {
    const svc = new Service();
    const events = [];
    svc.onSessionEvent(E.STATE_CHANGED, (p) => events.push(p));
    const res = await svc.initialize("mock");
    assert(res.ok !== false, "init:provider-ok");
    assert(svc.getSessionState() === S.READY, "init:session→READY");
    assert(events.some((p) => p.to === S.READY), "init:STATE_CHANGED→READY");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    const started = [];
    svc.onSessionEvent(E.LIVE_STARTED, (p) => started.push(p));
    const res = await svc.startLive({
      roomId: "room-host",
      userId: "u1",
      userName: "Host",
      videoContainer: null,
    });
    assert(res.ok !== false, "startLive:ok");
    assert(svc.getSessionState() === S.LIVE, "startLive:→LIVE");
    assert(started.length === 1 && started[0].roomId === "room-host", "startLive:LIVE_STARTED");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    const joined = [];
    svc.onSessionEvent(E.LIVE_JOINED, (p) => joined.push(p));
    const res = await svc.joinLive({
      roomId: "room-viewer",
      userId: "v1",
      userName: "Viewer",
      videoContainer: null,
    });
    assert(res.ok !== false, "joinLive:ok");
    assert(svc.getSessionState() === S.CONNECTED, "joinLive:→CONNECTED");
    assert(joined.length === 1, "joinLive:LIVE_JOINED");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    await svc.joinLive({
      roomId: "room-leave",
      userId: "v2",
      userName: "Viewer",
      videoContainer: null,
    });
    const res = await svc.leaveLive();
    assert(res.ok !== false, "leaveLive:ok");
    assert(svc.getSessionState() === S.READY, "leaveLive:viewer→READY");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    await svc.startLive({
      roomId: "room-end",
      userId: "h1",
      userName: "Host",
      videoContainer: null,
    });
    const ended = [];
    svc.onSessionEvent(E.LIVE_ENDED, (p) => ended.push(p));
    const res = await svc.endLive();
    assert(res.ok !== false, "endLive:ok");
    assert(svc.getSessionState() === S.ENDED, "endLive:→ENDED");
    assert(ended.length === 1, "endLive:LIVE_ENDED");
  }

  {
    const svc = new Service();
    let count = 0;
    const handler = () => {
      count += 1;
    };
    svc.onSessionEvent(E.STATE_CHANGED, handler);
    await svc.initialize("mock");
    await svc.dispose();
    assert(svc.getSessionState() === S.IDLE, "dispose:→IDLE");
    await svc.initialize("mock");
    assert(count > 0, "dispose:had-events-before");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    await svc.startLive({
      roomId: "snap-room",
      userId: "h2",
      userName: "Host",
      videoContainer: null,
    });
    const snap = svc.getSessionSnapshot();
    assert(snap.state === S.LIVE, "snapshot:state");
    assert(snap.session?.roomId === "snap-room", "snapshot:roomId");
    assert(
      snap.lastEvent?.event === E.LIVE_STARTED || snap.lastEvent?.event === E.HOST_CONNECTED,
      "snapshot:lastEvent"
    );
  }

  {
    const svc = new Service();
    let count = 0;
    const handler = () => {
      count += 1;
    };
    svc.onSessionEvent(E.STATE_CHANGED, handler);
    svc.offSessionEvent(E.STATE_CHANGED, handler);
    await svc.initialize("mock");
    assert(count === 0, "offSessionEvent:unsubscribed");
  }

  {
    const svc = new Service();
    await svc.initialize("mock");
    svc._provider.startLive = async () => ({ ok: false, error: "mock fail" });
    const before = svc.getSessionState();
    const res = await svc.startLive({
      roomId: "fail-room",
      userId: "h3",
      userName: "Host",
      videoContainer: null,
    });
    assert(res.ok === false, "provider-fail:returns-false");
    assert(svc.getSessionState() === before, "provider-fail:session-unchanged");
  }

  console.log("\n--- Static ---\n");
  const serviceText = fs.readFileSync(path.join(ROOT, "live/live-service.js"), "utf8");
  assert(serviceText.includes("onSessionEvent"), "static:onSessionEvent");
  assert(serviceText.includes("getSessionSnapshot"), "static:getSessionSnapshot");
  assert(!/ZegoExpressEngine/.test(serviceText), "static:no-zego-in-service");

  console.log(`\n=== Result: ${summary.pass} pass, ${summary.fail} fail ===\n`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("ALL PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
