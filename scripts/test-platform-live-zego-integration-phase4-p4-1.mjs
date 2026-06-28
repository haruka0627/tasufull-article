#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-1 (Edge Sync) unit tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-1.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-1
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

const LOAD_ORDER = [
  "platform-live/core/live-platform-diagnostics.js",
  "platform-live/core/live-platform-edge-sync.js",
  "platform-live/broadcast/live-broadcast-edge-client.js",
  "platform-live/viewer/live-viewer-edge-client.js",
  "platform-live/chat/live-chat-edge-client.js",
  "platform-live/recording/live-recording-edge-client.js",
  "platform-live/monitoring/live-monitoring-edge-client.js",
];

const REGRESSION_SCRIPTS = [
  "test:platform-live-zego-integration-phase3",
  "test:platform-live-zego-adapter-phase1",
  "test:platform-live-core-phase-a",
  "test:platform-live-broadcast-phase-b",
  "test:platform-live-viewer-phase-c",
  "test:platform-live-chat-phase-d",
  "test:platform-live-recording-phase-e",
  "test:platform-live-monitoring-phase-f",
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
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "mock fetch disabled" }) }),
  };
  context.window = context;
  context.globalThis = context;
  const ctx = vm.createContext(context);
  for (const rel of LOAD_ORDER) {
    vm.runInContext(read(rel), ctx);
  }
  return ctx;
}

function mockBroadcastClient(overrides = {}) {
  let live = false;
  return {
    calls: [],
    async create(p) {
      this.calls.push(["create", p]);
      if (overrides.createFail) return { ok: false, error: "create failed" };
      return { ok: true, state: "draft" };
    },
    async start(p) {
      this.calls.push(["start", p]);
      if (overrides.startFail) return { ok: false, error: "start failed" };
      live = true;
      return { ok: true, state: "live" };
    },
    async stop(p) {
      this.calls.push(["stop", p]);
      live = false;
      return { ok: true, state: "ended" };
    },
    async setLive(p) {
      return this.start(p);
    },
    async clearLive(p) {
      return this.stop(p);
    },
    isLive: () => live,
  };
}

function mockSetLiveClient(name, fail = false) {
  return {
    name,
    calls: [],
    async setLive(p) {
      this.calls.push(["setLive", p]);
      if (fail) return { ok: false, error: `${name} setLive failed` };
      return { ok: true, broadcastLive: true };
    },
    async clearLive(p) {
      this.calls.push(["clearLive", p]);
      if (fail) return { ok: false, error: `${name} clearLive failed` };
      return { ok: true, broadcastLive: false };
    },
  };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-1 (Edge Sync) ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);

  console.log("--- Guardrails ---\n");
  assert(fs.existsSync(path.join(ROOT, "platform-live/core/live-platform-edge-sync.js")), "static:edge-sync-exists");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");

  const ctx = loadRuntime();
  const EdgeSync = ctx.TasuLivePlatformEdgeSync;
  const Diagnostics = ctx.TasuLivePlatformDiagnostics;

  console.log("\n--- useEdgeSync=false no-op ---\n");
  {
    const diag = new Diagnostics();
    const sync = new EdgeSync({ useEdgeSync: false, diagnostics: diag });
    const res = await sync.setLive({
      surface: "platform",
      broadcastId: "bc-p4",
      roomId: "room-p4",
      manualToken: "secret-token-should-not-appear",
    });
    assert(res.ok === true && res.skipped === true, "noop:setLive-skipped");
    assert(res.edgeSync === false, "noop:edgeSync-flag-false");
    const snap = diag.snapshot();
    assert(snap.edgeSyncEvents.some((e) => e.name === "skipped"), "noop:diagnostics-skipped");
    const payloadStr = JSON.stringify(snap.edgeSyncEvents);
    assert(!payloadStr.includes("secret-token"), "noop:no-token-in-diagnostics");
  }

  console.log("\n--- idempotent setLive ---\n");
  {
    const diag = new Diagnostics();
    const bc = mockBroadcastClient();
    const sync = new EdgeSync({
      useEdgeSync: true,
      diagnostics: diag,
      broadcastEdgeClient: bc,
      viewerEdgeClient: mockSetLiveClient("viewer"),
      chatEdgeClient: mockSetLiveClient("chat"),
      recordingEdgeClient: mockSetLiveClient("recording"),
      monitoringEdgeClient: {
        calls: [],
        async patchLive(p) {
          this.calls.push(["patchLive", p]);
          return { ok: true };
        },
      },
    });

    const ctxPayload = {
      surface: "platform",
      broadcastId: "bc-idem",
      roomId: "room-idem",
      hostUserId: "host-1",
      sessionId: "sess-1",
      streamId: "room-idem_host-1_main",
      providerState: "live",
    };

    const first = await sync.setLive(ctxPayload);
    assert(first.ok === true && !first.partial, "idem:first-success");
    assert(bc.calls.length >= 2, "idem:broadcast-create-start", `calls=${bc.calls.length}`);

    const second = await sync.setLive(ctxPayload);
    assert(second.ok === true && second.idempotent === true && second.alreadyLive === true, "idem:second-noop");
    assert(bc.calls.length >= 2, "idem:broadcast-not-duplicated", `calls=${bc.calls.length}`);
  }

  console.log("\n--- edge failure non-fatal ---\n");
  {
    const diag = new Diagnostics();
    const bc = mockBroadcastClient();
    const sync = new EdgeSync({
      useEdgeSync: true,
      diagnostics: diag,
      broadcastEdgeClient: bc,
      viewerEdgeClient: mockSetLiveClient("viewer", true),
      chatEdgeClient: mockSetLiveClient("chat"),
      recordingEdgeClient: mockSetLiveClient("recording"),
      monitoringEdgeClient: {
        async patchLive() {
          return { ok: true };
        },
      },
    });

    let publishOk = false;
    try {
      const syncRes = await sync.setLive({
        surface: "platform",
        broadcastId: "bc-fail",
        roomId: "room-fail",
        hostUserId: "host-f",
        sessionId: "sess-f",
        providerState: "live",
      });
      publishOk = syncRes.ok === true && syncRes.partial === true && Array.isArray(syncRes.failures);
      assert(publishOk, "fail:returns-ok-partial");
      assert(syncRes.failures.some((f) => f.target === "viewer"), "fail:viewer-failure-recorded");
    } catch (err) {
      fail("fail:no-throw", err?.message || String(err));
    }

    assert(publishOk, "fail:publish-lifecycle-not-broken");
    const failedEvents = diag.snapshot().edgeSyncEvents.filter((e) => e.name === "failed");
    assert(failedEvents.length >= 1, "fail:diagnostics-failed-phase");
  }

  console.log("\n--- structured diagnostics ---\n");
  {
    const diag = new Diagnostics();
    const sync = new EdgeSync({
      useEdgeSync: true,
      diagnostics: diag,
      broadcastEdgeClient: mockBroadcastClient(),
      viewerEdgeClient: new ctx.TasuLivePlatformViewerEdgeClient(),
      chatEdgeClient: new ctx.TasuLivePlatformChatEdgeClient(),
      recordingEdgeClient: new ctx.TasuLivePlatformRecordingEdgeClient(),
      monitoringEdgeClient: new ctx.TasuLivePlatformMonitoringEdgeClient(),
    });

    await sync.setLive({
      surface: "platform",
      broadcastId: "bc-diag",
      roomId: "room-diag",
      hostUserId: "host-d",
      sessionId: "sess-d",
      streamId: "stream-d",
      providerState: "live",
    });

    const snap = diag.snapshot();
    assert(Array.isArray(snap.edgeSyncEvents) && snap.edgeSyncEvents.length >= 2, "diag:edgeSyncEvents");
    assert(snap.edgeSyncEvents.some((e) => e.name === "attempted"), "diag:attempted");
    assert(snap.edgeSyncEvents.some((e) => e.name === "succeeded"), "diag:succeeded");
    const last = sync.getLastResult();
    assert(last?.broadcastId === "bc-diag", "diag:lastResult-broadcastId");
    assert(last?.sessionId === "sess-d", "diag:lastResult-sessionId");
    assert(last?.streamId === "stream-d", "diag:lastResult-streamId");
    assert(last?.providerState === "live", "diag:lastResult-providerState");
  }

  console.log("\n--- clearLive idempotent ---\n");
  {
    const sync = new EdgeSync({
      useEdgeSync: true,
      broadcastEdgeClient: mockBroadcastClient(),
      viewerEdgeClient: mockSetLiveClient("viewer"),
      chatEdgeClient: mockSetLiveClient("chat"),
      recordingEdgeClient: mockSetLiveClient("recording"),
      monitoringEdgeClient: { async patchLive() { return { ok: true }; } },
    });
    await sync.setLive({ surface: "platform", broadcastId: "bc-cl", roomId: "r", hostUserId: "h" });
    const cleared = await sync.clearLive({ surface: "platform", broadcastId: "bc-cl", reason: "test" });
    assert(cleared.ok === true && !cleared.partial, "clear:success");
    const again = await sync.clearLive({ surface: "platform", broadcastId: "bc-cl" });
    assert(again.ok === true && again.alreadyClear === true, "clear:idempotent");
  }

  console.log("\n--- edge client setLive stub (no baseUrl) ---\n");
  {
    const viewer = new ctx.TasuLivePlatformViewerEdgeClient();
    const res = await viewer.setLive({ surface: "platform", broadcastId: "bc-stub" });
    assert(res.ok === true && res.noop === true, "client:viewer-setLive-noop");
    const cleared = await viewer.clearLive({ surface: "platform", broadcastId: "bc-stub" });
    assert(cleared.ok === true && cleared.broadcastLive === false, "client:viewer-clearLive");
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
  console.log("\nPhase 4 P4-1 tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
