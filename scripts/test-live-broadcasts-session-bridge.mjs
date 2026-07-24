#!/usr/bin/env node
/**
 * TLV Live live-broadcasts ↔ Session bridge — unit tests (Phase2-03)
 *
 *   node scripts/test-live-broadcasts-session-bridge.mjs
 *   npm run test:live-broadcasts-session-bridge
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SESSION_LOAD = [
  "live/session/live-session-states.js",
  "live/session/live-session-events.js",
  "live/session/live-session-event-bus.js",
  "live/session/live-provider-signals.js",
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

function loadBridgeRuntime(flagOverrides = null) {
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
    __tlvLiveWatchLeaveBound: false,
  };
  context.window = context;
  context.globalThis = context;

  const ctx = vm.createContext(context);
  for (const rel of SESSION_LOAD) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/tlv-feature-flags.js"), "utf8"), ctx);
  if (flagOverrides) {
    context.TLV_FEATURE_FLAGS = Object.freeze({
      ...context.TLV_FEATURE_FLAGS,
      ...flagOverrides,
    });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "live/live-broadcasts-session-bridge.js"), "utf8"), ctx);
  return context;
}

async function run() {
  console.log("\n=== TLV live-broadcasts Session Bridge — unit tests ===\n");

  const S = (ctx) => ctx.LIVE_SESSION_STATES;
  const Bridge = (ctx) => ctx.TlvLiveBroadcastsSessionBridge;

  console.log("--- Flag OFF (default) ---\n");
  {
    const ctx = loadBridgeRuntime();
    const b = Bridge(ctx);
    assert(b.isEnabled() === false, "flag-off:isEnabled");
    assert(ctx.TLV_LIVE_SESSION_MANAGER_ENABLED === false, "flag-off:global-getter");
    const r = await b.onStudioStart({ broadcastId: "b1" });
    assert(r.enabled === false && r.skipped === true, "flag-off:studio-start-skip");
    const snap = b.getSnapshot();
    assert(snap.enabled === false, "flag-off:snapshot");
  }

  console.log("\n--- Flag ON · Session only (no ZEGO) ---\n");
  {
    const ctx = loadBridgeRuntime({ liveSessionManagerEnabled: true });
    const b = Bridge(ctx);
    assert(b.isEnabled() === true, "flag-on:isEnabled");

    const start = await b.onStudioStart({ broadcastId: "room-1", creatorId: "c1" });
    assert(start.enabled === true && start.state === S(ctx).LIVE, "flag-on:studio-start→LIVE");

    const end = await b.onStudioEnd({ broadcastId: "room-1", creatorId: "c1" });
    assert(end.enabled === true && end.state === S(ctx).ENDED, "flag-on:studio-end→ENDED");

    await b.onStudioStart({ broadcastId: "room-2" });
    const join = await b.onWatchJoin({ broadcastId: "room-3", viewerId: "v1", status: "live" });
    assert(join.enabled === true && join.state === S(ctx).CONNECTED, "flag-on:watch-join→CONNECTED");

    const skip = await b.onWatchJoin({ broadcastId: "room-x", status: "ended" });
    assert(skip.skipped === true, "flag-on:watch-skip-not-live");

    await b.dispose();
    assert(b.getSnapshot().state === S(ctx).IDLE, "flag-on:dispose→IDLE");
  }

  console.log("\n--- live-broadcasts.js hooks ---\n");
  {
    const bc = fs.readFileSync(path.join(ROOT, "live/live-broadcasts.js"), "utf8");
    assert(bc.includes("runSessionBridge"), "broadcasts:runSessionBridge");
    assert(bc.includes('runSessionBridge("onStudioStart"'), "broadcasts:studio-start-hook");
    assert(bc.includes('runSessionBridge("onStudioEnd"'), "broadcasts:studio-end-hook");
    assert(bc.includes('runSessionBridge("onWatchJoin"'), "broadcasts:watch-join-hook");
    assert(!/ZegoExpressEngine|createTlvLiveProvider/.test(bc), "broadcasts:no-zego");
  }

  console.log("\n--- Static isolation ---\n");
  {
    const bridge = fs.readFileSync(path.join(ROOT, "live/live-broadcasts-session-bridge.js"), "utf8");
    assert(!/ZegoExpressEngine|createTlvLiveProvider|TlvLiveService/.test(bridge), "bridge:no-provider");
  }

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
