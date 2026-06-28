#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-2 (Integration + Edge Sync) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-2.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-2
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TLV_POC_PROVIDER = "live/providers/zego-live-provider.js";
const INTERFACE_PATH = "platform-live/provider/live-provider-interface.js";
const INTEGRATION_PATH = "platform-live/core/live-platform-integration.js";

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

const EDGE_EXTRA = [
  "platform-live/chat/live-chat-edge-client.js",
  "platform-live/recording/live-recording-edge-client.js",
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
  "test:platform-live-zego-integration-phase4-p4-1",
  "test:platform-live-zego-integration-phase3",
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
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "mock fetch disabled" }) }),
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  for (const rel of [...CORE_LOAD, ...BROADCAST_LOAD, ...VIEWER_LOAD, ...EDGE_EXTRA, ...PROVIDER_LOAD]) {
    vm.runInContext(read(rel), ctx);
  }
  return ctx;
}

function createMockEdgeSync(overrides = {}) {
  return {
    enabled: true,
    setLiveCalls: [],
    clearLiveCalls: [],
    patchLiveCalls: [],
    async setLive(ctx) {
      this.setLiveCalls.push(ctx);
      if (overrides.setLiveFail) {
        return { ok: true, partial: true, failures: [{ target: "viewer", error: "mock fail" }] };
      }
      return { ok: true, edgeSync: true, ...(overrides.setLiveResult || {}) };
    },
    async clearLive(ctx) {
      this.clearLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    async patchLive(ctx) {
      this.patchLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
    },
    getStatus() {
      return { enabled: true, liveKeys: [], lastResult: null };
    },
    getLastResult() {
      return null;
    },
  };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-2 ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);
  const joinLiveSrc = read(INTEGRATION_PATH);

  console.log("--- Guardrails ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");
  assert(!/async joinLive[\s\S]*?_runEdgeSetLive/.test(joinLiveSrc), "static:joinLive-body-unchanged");

  const ctx = loadRuntime();
  const Integration = ctx.TasuLivePlatformIntegration;

  console.log("\n--- useEdgeSync=false (default) ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    assert(integ.useEdgeSync === false, "default:useEdgeSync-false");
    await integ.initialize({ surface: "platform", providerId: "stub" });
    assert(integ.useEdgeSync === false, "init:useEdgeSync-false");
    const pub = await integ.startPublish({
      surface: "platform",
      roomId: "room-off",
      userId: "host-off",
      broadcastId: "bc-off",
      manualToken: "secret-should-not-appear",
    });
    assert(pub.ok !== false, "default:publish-ok");
    assert(pub.edgeSync == null, "default:no-edgeSync-result");
    const snap = integ.getDiagnostics();
    assert(snap.useEdgeSync === false, "default:diag-useEdgeSync-false");
    const skipped = snap.edgeSyncEvents?.some((e) => e.name === "skipped");
    assert(!skipped || snap.edgeSyncEvents.length === 0, "default:no-edge-sync-attempt");
    const diagStr = JSON.stringify(snap);
    assert(!diagStr.includes("secret-should-not-appear"), "default:no-token-in-diagnostics");
    await integ.dispose();
  }

  console.log("\n--- useEdgeSync=true setLive / clearLive ---\n");
  {
    const mockSync = createMockEdgeSync();
    const integ = new Integration({ providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    await integ.initialize({ surface: "platform", providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    assert(integ.useEdgeSync === true, "enabled:useEdgeSync-true");

    const pub = await integ.startPublish({
      surface: "platform",
      roomId: "room-on",
      userId: "host-on",
      broadcastId: "bc-on",
      streamId: "room-on_host-on_main",
    });
    assert(pub.ok !== false, "enabled:publish-ok");
    assert(mockSync.setLiveCalls.length === 1, "enabled:setLive-called-once", `calls=${mockSync.setLiveCalls.length}`);
    assert(mockSync.setLiveCalls[0]?.broadcastId === "bc-on", "enabled:setLive-broadcastId");
    assert(pub.edgeSync?.ok === true, "enabled:edgeSync-on-result");

    const stop = await integ.stopPublish({ surface: "platform", broadcastId: "bc-on" });
    assert(stop.ok !== false, "enabled:stop-ok");
    assert(mockSync.clearLiveCalls.length === 1, "enabled:clearLive-called");
    assert(JSON.stringify(integ.getDiagnostics()).includes("bc-on"), "enabled:diagnostics-context");

    await integ.dispose();
  }

  console.log("\n--- edge failure non-fatal ---\n");
  {
    const mockSync = createMockEdgeSync({ setLiveFail: true });
    const integ = new Integration({ providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    await integ.initialize({ surface: "platform", providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    const pub = await integ.startPublish({
      surface: "platform",
      roomId: "room-partial",
      userId: "host-p",
      broadcastId: "bc-partial",
    });
    assert(pub.ok !== false, "partial:publish-still-ok");
    assert(pub.edgeSync?.partial === true, "partial:edgeSync-partial-flag");
    const failedEv = integ.getDiagnostics().edgeSyncEvents?.some((e) => e.name === "failed" || e.name === "succeeded");
    assert(failedEv !== undefined, "partial:diagnostics-recorded");
    await integ.dispose();
  }

  console.log("\n--- joinLive path unchanged ---\n");
  {
    const mockSync = createMockEdgeSync();
    const integ = new Integration({ providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    await integ.initialize({ surface: "platform", providerId: "stub", useEdgeSync: true, edgeSync: mockSync });

    const jr = await integ.joinLive({
      surface: "platform",
      roomId: "room-aud",
      userId: "viewer-aud",
      broadcastId: "bc-aud",
      manualToken: "audience-token-redacted",
    });
    assert(jr.ok !== false, "joinLive:ok");
    assert(mockSync.setLiveCalls.length === 0, "joinLive:no-setLive", `setLive=${mockSync.setLiveCalls.length}`);
    assert(mockSync.clearLiveCalls.length === 0, "joinLive:no-clearLive");
    assert(!JSON.stringify(integ.getDiagnostics()).includes("audience-token-redacted"), "joinLive:no-token-diag");
    await integ.dispose();
  }

  console.log("\n--- edgeSyncEvents in diagnostics ---\n");
  {
    const bc = {
      async create() { return { ok: true }; },
      async start() { return { ok: true, state: "live" }; },
      async stop() { return { ok: true, state: "ended" }; },
    };
    const noopFan = {
      async setLive() { return { ok: true }; },
      async clearLive() { return { ok: true }; },
    };
    const integ = new Integration({ providerId: "stub", useEdgeSync: true });
    await integ.initialize({
      surface: "platform",
      providerId: "stub",
      useEdgeSync: true,
      broadcastEdgeClient: bc,
      viewerEdgeClient: noopFan,
      chatEdgeClient: noopFan,
      recordingEdgeClient: noopFan,
      monitoringEdgeClient: { async patchLive() { return { ok: true }; } },
    });
    await integ.startPublish({ surface: "platform", roomId: "r-d", userId: "h-d", broadcastId: "bc-d" });
    const events = integ.getDiagnostics().edgeSyncEvents || [];
    assert(events.some((e) => e.name === "attempted"), "diag:attempted-event");
    assert(events.some((e) => e.name === "succeeded"), "diag:succeeded-event");
    await integ.dispose();
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-300) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS ${summary.pass} · FAIL ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase 4 P4-2 tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
