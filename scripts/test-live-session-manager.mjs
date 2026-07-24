#!/usr/bin/env node
/**
 * TLV Live Session Manager — unit tests (Phase2-01 Skeleton)
 *
 *   node scripts/test-live-session-manager.mjs
 *   npm run test:live-session-manager
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOAD_ORDER = [
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

function loadSessionRuntime() {
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
  console.log("\n=== TLV Live Session Manager — unit tests ===\n");

  const ctx = loadSessionRuntime();
  const S = ctx.LIVE_SESSION_STATES;
  const E = ctx.LIVE_SESSION_EVENTS;
  const Manager = ctx.TlvLiveSessionManager;
  const EventBus = ctx.TlvLiveSessionEventBus;

  // --- EventBus ---
  console.log("--- EventBus ---\n");
  {
    const bus = new EventBus();
    const seen = [];
    const handler = (p) => seen.push(p);
    bus.on("X", handler);
    bus.emit("X", { n: 1 });
    assert(seen.length === 1 && seen[0].n === 1, "bus:on-emit");

    bus.off("X", handler);
    bus.emit("X", { n: 2 });
    assert(seen.length === 1, "bus:off");

    const onceSeen = [];
    bus.once("Y", (p) => onceSeen.push(p));
    bus.emit("Y", { n: 1 });
    bus.emit("Y", { n: 2 });
    assert(onceSeen.length === 1 && onceSeen[0].n === 1, "bus:once");
  }

  // --- Initial state ---
  console.log("\n--- SessionManager ---\n");
  {
    const m = new Manager();
    assert(m.state === S.IDLE, "initial:IDLE");
    assert(m.session === null, "initial:no-session");
  }

  // --- Host flow ---
  {
    const m = new Manager();
    const created = collectEvents(m, E.LIVE_CREATED);
    const stateChanges = collectEvents(m, E.STATE_CHANGED);

    const cr = await m.createSession({ roomId: "room-a", role: "host" });
    assert(cr.ok && m.state === S.READY, "host:createSession→READY");
    assert(created.length === 1 && created[0].roomId === "room-a", "host:LIVE_CREATED");

    const started = collectEvents(m, E.LIVE_STARTED);
    const hostConn = collectEvents(m, E.HOST_CONNECTED);
    const sr = await m.start();
    assert(sr.ok && m.state === S.LIVE, "host:start→LIVE");
    assert(started.length === 1 && hostConn.length === 1, "host:LIVE_STARTED+HOST_CONNECTED");

    const ended = collectEvents(m, E.LIVE_ENDED);
    const er = await m.end();
    assert(er.ok && m.state === S.ENDED, "host:end→ENDED");
    assert(ended.length === 1 && ended[0].reason === "host", "host:LIVE_ENDED");

    const rr = await m.reset();
    assert(rr.ok && m.state === S.READY, "host:reset→READY");
    assert(stateChanges.some((p) => p.from === S.IDLE && p.to === S.INITIALIZING), "host:STATE_CHANGED");
  }

  // --- Viewer flow ---
  {
    const m = new Manager();
    await m.createSession({ roomId: "room-b", role: "viewer" });
    const joined = collectEvents(m, E.LIVE_JOINED);
    const viewerConn = collectEvents(m, E.VIEWER_CONNECTED);
    const jr = await m.join();
    assert(jr.ok && m.state === S.CONNECTED, "viewer:join→CONNECTED");
    assert(joined.length === 1 && viewerConn.length === 1, "viewer:LIVE_JOINED+VIEWER_CONNECTED");

    const left = collectEvents(m, E.LIVE_LEFT);
    const lr = await m.leave();
    assert(lr.ok && m.state === S.READY, "viewer:leave→READY");
    assert(left.length === 1 && left[0].role === "viewer", "viewer:LIVE_LEFT");
  }

  // --- Reconnect ---
  {
    const m = new Manager();
    await m.createSession({ roomId: "room-c" });
    await m.start();
    const rec = collectEvents(m, E.RECONNECTING);
    const reconn = collectEvents(m, E.RECONNECTED);
    const r = await m.reconnect();
    assert(r.ok && m.state === S.LIVE, "reconnect:→LIVE");
    assert(rec.length === 1 && rec[0].attempt === 1, "reconnect:RECONNECTING");
    assert(reconn.length === 1, "reconnect:RECONNECTED");
  }

  // --- Guard rejects ---
  {
    const m = new Manager();
    await m.createSession({ roomId: "room-d" });
    const bad = await m.start();
    await m.end();
    const bad2 = await m.start();
    assert(!bad2.ok && m.state === S.ENDED, "guard:start-after-ended");
    assert(bad.ok, "guard:baseline-start-ok");
  }

  // --- destroySession ---
  {
    const m = new Manager();
    await m.createSession({ roomId: "room-e" });
    const dr = await m.destroySession();
    assert(dr.ok && m.state === S.IDLE && m.session === null, "destroySession→IDLE");
  }

  // --- dispose + listener clear ---
  {
    const m = new Manager();
    let count = 0;
    const handler = () => {
      count += 1;
    };
    m.on(E.STATE_CHANGED, handler);
    await m.createSession({ roomId: "room-f" });
    const beforeDispose = count;
    await m.dispose();
    assert(m.state === S.IDLE, "dispose→IDLE");

    const m2 = new Manager();
    let count2 = 0;
    m2.on(E.STATE_CHANGED, () => {
      count2 += 1;
    });
    await m2.createSession({ roomId: "room-f2" });
    assert(count2 > 0, "dispose:new-manager-independent");
    assert(beforeDispose > 0, "dispose:had-events-before");
    assert(count === beforeDispose, "dispose:old-listeners-not-fired");
  }

  // --- Provider signal reconnect ---
  {
    const m = new Manager();
    const SIG = ctx.LIVE_PROVIDER_SIGNALS;
    await m.createSession({ roomId: "room-p1" });
    await m.start();
    await m.handleProviderSignal(SIG.PROVIDER_CONNECTION_LOST, {});
    assert(m.state === S.RECONNECTING, "provider:CONNECTION_LOST");
    await m.handleProviderSignal(SIG.PROVIDER_RECONNECTED, {});
    assert(m.state === S.LIVE, "provider:RECONNECTED→LIVE");
  }

  // --- SDK isolation static ---
  console.log("\n--- Static isolation ---\n");
  for (const rel of LOAD_ORDER) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert(!/ZegoExpressEngine|zego\.im/i.test(text), `isolation:no-zego:${rel}`);
  }

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
