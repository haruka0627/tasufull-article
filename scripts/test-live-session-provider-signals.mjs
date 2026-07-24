#!/usr/bin/env node
/**
 * TLV Live Session — Provider signal / Reconnect / Error tests (Phase2-05)
 *
 *   node scripts/test-live-session-provider-signals.mjs
 *   npm run test:live-session-provider-signals
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
    addEventListener: () => {},
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  for (const rel of LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/tlv-feature-flags.js"), "utf8"), ctx);
  context.TLV_FEATURE_FLAGS = Object.freeze({
    ...context.TLV_FEATURE_FLAGS,
    liveSessionManagerEnabled: true,
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/live-broadcasts-session-bridge.js"), "utf8"), ctx);
  return context;
}

async function run() {
  console.log("\n=== TLV Session Provider Signals / Reconnect / Error ===\n");

  const ctx = loadRuntime();
  const S = ctx.LIVE_SESSION_STATES;
  const E = ctx.LIVE_SESSION_EVENTS;
  const SIG = ctx.LIVE_PROVIDER_SIGNALS;
  const Manager = ctx.TlvLiveSessionManager;
  const Bridge = ctx.TlvLiveBroadcastsSessionBridge;

  {
    const m = new Manager();
    await m.createSession({ roomId: "r1", role: "host" });
    await m.start();
    const lost = await m.handleProviderSignal(SIG.PROVIDER_CONNECTION_LOST, { reason: "test" });
    assert(lost.ok && m.state === S.RECONNECTING, "signal:CONNECTION_LOST→RECONNECTING");
    const reconn = await m.handleProviderSignal(SIG.PROVIDER_RECONNECTED, {});
    assert(reconn.ok && m.state === S.LIVE, "signal:RECONNECTED→LIVE");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r2", role: "viewer" });
    await m.join();
    await m.handleProviderSignal(SIG.PROVIDER_DISCONNECTED, {});
    assert(m.state === S.RECONNECTING, "signal:DISCONNECTED→RECONNECTING");
    await m.handleProviderSignal(SIG.PROVIDER_RECONNECTED, {});
    assert(m.state === S.CONNECTED, "signal:viewer-RECONNECTED→CONNECTED");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r3" });
    await m.start();
    const err = await m.handleProviderSignal(SIG.PROVIDER_ERROR, {
      message: "network fail",
      recoverable: true,
      code: "NET_FAIL",
    });
    assert(!err.ok && m.state === S.ERROR, "signal:PROVIDER_ERROR→ERROR");
    assert(m.getStatus().lastError?.recoverable === true, "signal:error-recoverable");
    const rec = await m.recoverFromError();
    assert(rec.ok && m.state === S.LIVE, "recoverFromError→LIVE");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r4" });
    await m.start();
    await m.reportError({ message: "fatal", recoverable: false, code: "FATAL" });
    const bad = await m.recoverFromError();
    assert(!bad.ok && m.state === S.ERROR, "recover:blocked-non-recoverable");
    const reset = await m.reset();
    assert(reset.ok && m.state === S.READY, "reset:ERROR→READY");
  }

  {
    const off = Object.freeze({ liveSessionManagerEnabled: false });
    ctx.TLV_FEATURE_FLAGS = off;
    const skipped = await Bridge.handleProviderSignal(SIG.PROVIDER_CONNECTION_LOST, {});
    assert(skipped.enabled === false && skipped.skipped === true, "bridge:flag-off-skip");
  }

  {
    ctx.TLV_FEATURE_FLAGS = Object.freeze({ liveSessionManagerEnabled: true });
    await Bridge.onStudioStart({ broadcastId: "bridge-r1" });
    const r = await Bridge.handleProviderSignal(SIG.PROVIDER_CONNECTION_LOST, {});
    assert(r.enabled === true && r.state === S.RECONNECTING, "bridge:signal→RECONNECTING");
    const snap = Bridge.getSnapshot();
    assert(snap.status?.lastProviderSignal?.signal === SIG.PROVIDER_CONNECTION_LOST, "bridge:snapshot-signal");
  }

  console.log("\n--- Static ---\n");
  const sigFile = fs.readFileSync(path.join(ROOT, "live/session/live-provider-signals.js"), "utf8");
  assert(sigFile.includes("PROVIDER_CONNECTION_LOST"), "static:signals-defined");
  assert(!/ZegoExpressEngine/.test(sigFile), "static:no-zego");

  console.log(`\n=== Result: ${summary.pass} pass, ${summary.fail} fail ===\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("ALL PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
