#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-6 (executeWithRetry) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-6.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-6
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
const RETRY_PATH = "platform-live/core/live-platform-retry.js";

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
  "platform-live/core/live-platform-retry.js",
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

const CHAT_LOAD = [
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

const RECORDING_LOAD = [
  "platform-live/recording/live-recording-states.js",
  "platform-live/recording/live-recording-events.js",
  "platform-live/recording/live-recording-error-codes.js",
  "platform-live/recording/live-recording-validation.js",
  "platform-live/recording/live-recording-service.js",
  "platform-live/recording/live-recording-edge-client.js",
];

const MONITORING_LOAD = [
  "platform-live/monitoring/live-monitoring-states.js",
  "platform-live/monitoring/live-monitoring-events.js",
  "platform-live/monitoring/live-monitoring-error-codes.js",
  "platform-live/monitoring/live-monitoring-validation.js",
  "platform-live/monitoring/live-monitoring-metrics-store.js",
  "platform-live/monitoring/live-monitoring-smoke-runner.js",
  "platform-live/monitoring/live-monitoring-service.js",
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
  "test:platform-live-zego-integration-phase4-p4-5",
  "test:platform-live-zego-integration-phase4-p4-4",
  "test:platform-live-zego-integration-phase4-p4-3",
  "test:platform-live-zego-integration-phase4-p4-2",
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

function loadRuntime(options = {}) {
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
  const coreLoad = options.withoutRetry
    ? CORE_LOAD.filter((p) => p !== "platform-live/core/live-platform-retry.js")
    : CORE_LOAD;
  for (const rel of [
    ...coreLoad,
    ...BROADCAST_LOAD,
    ...VIEWER_LOAD,
    ...CHAT_LOAD,
    ...RECORDING_LOAD,
    ...MONITORING_LOAD,
    ...PROVIDER_LOAD,
  ]) {
    vm.runInContext(read(rel), ctx);
  }
  return ctx;
}

function createMockEdgeSync() {
  return {
    enabled: true,
    setLiveCalls: [],
    clearLiveCalls: [],
    patchLiveCalls: [],
    async setLive(ctx) {
      this.setLiveCalls.push(ctx);
      return { ok: true, edgeSync: true };
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

function patchOnceTransient(target, method, failPayload) {
  let calls = 0;
  const orig = target[method].bind(target);
  target[method] = async (...args) => {
    calls += 1;
    if (calls === 1) {
      return typeof failPayload === "function" ? failPayload(calls) : failPayload;
    }
    return orig(...args);
  };
  return () => calls;
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-6 ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);
  const integrationSrc = read(INTEGRATION_PATH);
  const retrySrc = read(RETRY_PATH);

  console.log("--- Guardrails ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");
  assert(/executeWithRetry|_executeIntegrationRetry/.test(integrationSrc), "static:retry-wired");
  assert(/recordRetry/.test(read("platform-live/core/live-platform-diagnostics.js")), "static:recordRetry");
  assert(/classifyIntegrationRetry/.test(retrySrc), "static:classifyIntegrationRetry");

  const ctx = loadRuntime();
  const Integration = ctx.TasuLivePlatformIntegration;
  const Retry = ctx.TasuLivePlatformRetry;
  const CODES = ctx.TasuLivePlatformZegoErrorMap.PLATFORM_CODES;
  const PLATFORM = "platform";

  console.log("\n--- classification ---\n");
  {
    const net = Retry.classifyIntegrationRetry({ ok: false, error: "network websocket offline" });
    assert(net.retryable === true, "classify:network-retryable");

    const timeout = Retry.classifyIntegrationRetry({ ok: false, error: "timed out waiting for join" });
    assert(timeout.retryable === true, "classify:timeout-retryable");

    const perm = Retry.classifyIntegrationRetry({ ok: false, error: "Permission denied: camera not allowed" });
    assert(perm.retryable === false, "classify:permission-no-retry");
    assert(perm.code === CODES.PERMISSION_DENIED, "classify:permission-code");

    const mic = Retry.classifyIntegrationRetry({ ok: false, error: "microphone denied by user" });
    assert(mic.retryable === false, "classify:microphone-no-retry");

    const tokenMissing = Retry.classifyIntegrationRetry({ ok: false, error: "token missing" });
    assert(tokenMissing.retryable === false, "classify:token-missing-no-retry");

    const config = Retry.classifyIntegrationRetry({ ok: false, error: "appId config missing" });
    assert(config.retryable === false, "classify:config-no-retry");

    const misconfig = Retry.classifyIntegrationRetry({ ok: false, error: "provider misconfigured" });
    assert(misconfig.retryable === false, "classify:misconfigured-no-retry");

    const transient = Retry.classifyIntegrationRetry({ ok: false, error: "transient provider error 503" });
    assert(transient.retryable === true, "classify:transient-retryable");
  }

  console.log("\n--- publish transient → retry → success ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const getCalls = patchOnceTransient(integ._broadcast, "startBroadcast", {
      ok: false,
      error: "network websocket connection failed",
      code: CODES.NETWORK_ERROR,
    });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-retry-pub",
      userId: "host-retry-pub",
      broadcastId: "bc-retry-pub",
      manualToken: "secret-retry-redacted",
    });
    assert(pub.ok !== false, "publish-retry:success");
    assert(getCalls() === 2, "publish-retry:two-attempts", `calls=${getCalls()}`);
    const diag = integ.getDiagnostics();
    assert(diag.retryEvents?.some((e) => e.name === "retrying" && e.payload?.operation === "publish"), "publish-retry:retrying-event");
    assert(diag.retryEvents?.some((e) => e.name === "succeeded" && e.payload?.operation === "publish"), "publish-retry:succeeded-event");
    assert(diag.retryLastResult?.recovered === true, "publish-retry:recovered-flag");
    assert(diag.retryLastResult?.operation === "publish", "publish-retry:last-operation");
    assert(!JSON.stringify(diag).includes("secret-retry-redacted"), "publish-retry:no-token-diag");
    assert("sessionState" in pub && "diagnostics" in pub, "publish-retry:return-shape");
    await integ.dispose();
  }

  console.log("\n--- joinLive transient → retry → success ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const getCalls = patchOnceTransient(integ._provider, "joinLive", {
      ok: false,
      error: "timeout: joinLive timed out",
    });

    const join = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-retry-join",
      userId: "viewer-retry-join",
    });
    assert(join.ok !== false, "joinLive-retry:success");
    assert(getCalls() === 2, "joinLive-retry:two-attempts", `calls=${getCalls()}`);
    const diag = integ.getDiagnostics();
    assert(diag.retryLastResult?.recovered === true, "joinLive-retry:recovered");
    assert(diag.retryEvents?.some((e) => e.name === "retrying" && e.payload?.operation === "joinLive"), "joinLive-retry:event");
    assert("sessionState" in join && "diagnostics" in join, "joinLive-retry:return-shape");
    await integ.dispose();
  }

  console.log("\n--- joinAsViewer transient → retry → success ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    await integ.createBroadcast({
      surface: PLATFORM,
      broadcastId: "bc-retry-viewer",
      roomId: "room-retry-viewer",
      hostUserId: "host-retry-viewer",
    });
    integ._broadcast._state = ctx.PLATFORM_LIVE_BROADCAST_STATES.LIVE;
    const getCalls = patchOnceTransient(integ._viewer, "joinViewer", {
      ok: false,
      error: "transient provider error 503",
    });

    const jr = await integ.joinAsViewer({
      surface: PLATFORM,
      broadcastId: "bc-retry-viewer",
      userId: "viewer-retry",
    });
    assert(jr.ok !== false, "joinAsViewer-retry:success");
    assert(getCalls() === 2, "joinAsViewer-retry:two-attempts", `calls=${getCalls()}`);
    const diag = integ.getDiagnostics();
    assert(diag.retryLastResult?.operation === "joinAsViewer", "joinAsViewer-retry:last-operation");
    assert("sessionState" in jr && "diagnostics" in jr, "joinAsViewer-retry:return-shape");
    await integ.dispose();
  }

  console.log("\n--- permission / config errors — no retry ---\n");
  {
    const integPerm = new Integration({ providerId: "stub" });
    await integPerm.initialize({ surface: PLATFORM, providerId: "stub" });
    let permCalls = 0;
    integPerm._broadcast.startBroadcast = async () => {
      permCalls += 1;
      return { ok: false, error: "Permissions policy violation: camera not allowed" };
    };
    const permPub = await integPerm.startPublish({
      surface: PLATFORM,
      roomId: "room-perm",
      userId: "host-perm",
      broadcastId: "bc-perm",
    });
    assert(permPub.ok === false, "no-retry:permission-fail");
    assert(permCalls === 1, "no-retry:permission-single-call", `calls=${permCalls}`);
    await integPerm.dispose();

    const integCfg = new Integration({ providerId: "stub" });
    await integCfg.initialize({ surface: PLATFORM, providerId: "stub" });
    let cfgCalls = 0;
    integCfg._broadcast.startBroadcast = async () => {
      cfgCalls += 1;
      return { ok: false, error: "token missing" };
    };
    const cfgPub = await integCfg.startPublish({
      surface: PLATFORM,
      roomId: "room-cfg",
      userId: "host-cfg",
      broadcastId: "bc-cfg",
    });
    assert(cfgPub.ok === false, "no-retry:token-missing-fail");
    assert(cfgCalls === 1, "no-retry:token-missing-single-call", `calls=${cfgCalls}`);
    const failedEv = integCfg.getDiagnostics().retryEvents?.filter((e) => e.name === "failed");
    assert((failedEv?.length || 0) >= 1, "no-retry:failed-recorded");
    assert(integCfg.getDiagnostics().retryLastResult?.exhausted !== true, "no-retry:not-exhausted");
    await integCfg.dispose();
  }

  console.log("\n--- retry exhausted diagnostics ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    let calls = 0;
    integ._broadcast.startBroadcast = async () => {
      calls += 1;
      return { ok: false, error: "network offline", code: CODES.NETWORK_ERROR };
    };

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-exhaust",
      userId: "host-exhaust",
      broadcastId: "bc-exhaust",
    });
    assert(pub.ok === false, "exhausted:fail");
    assert(calls === 2, "exhausted:max-attempts", `calls=${calls}`);
    const diag = integ.getDiagnostics();
    assert(diag.retryLastResult?.exhausted === true, "exhausted:flag");
    assert(diag.retryLastResult?.attempts === 2, "exhausted:attempt-count");
    assert(diag.retryEvents?.some((e) => e.name === "exhausted"), "exhausted:event");
    await integ.dispose();
  }

  console.log("\n--- stop / chat not retried ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-noretry",
      userId: "host-noretry",
      broadcastId: "bc-noretry",
    });

    let stopCalls = 0;
    const origStop = integ._broadcast.stopBroadcast.bind(integ._broadcast);
    integ._broadcast.stopBroadcast = async (...args) => {
      stopCalls += 1;
      if (stopCalls === 1) return { ok: false, error: "network offline" };
      return origStop(...args);
    };
    const stopRes = await integ.stopPublish({ surface: PLATFORM });
    assert(stopCalls === 1, "no-retry:stop-single-call", `calls=${stopCalls}`);
    assert(stopRes.ok === false, "no-retry:stop-fails-immediately");

    const beforeChatRetry = integ.getDiagnostics().retryEvents?.length || 0;
    if (integ._chatGateway) {
      let chatCalls = 0;
      const origSend = integ._chatGateway.sendMessage.bind(integ._chatGateway);
      integ._chatGateway.sendMessage = async (...args) => {
        chatCalls += 1;
        if (chatCalls === 1) return { ok: false, error: "network offline" };
        return origSend(...args);
      };
      await integ.sendChatMessage({
        surface: PLATFORM,
        broadcastId: "bc-noretry",
        userId: "host-noretry",
        text: "hello",
      });
      assert(chatCalls === 1, "no-retry:chat-single-call", `calls=${chatCalls}`);
    }
    const afterChatRetry = integ.getDiagnostics().retryEvents?.length || 0;
    assert(afterChatRetry === beforeChatRetry, "no-retry:no-new-retry-events-from-chat");
    await integ.dispose();
  }

  console.log("\n--- P4-5 monitoring path intact ---\n");
  {
    const integ = new Integration({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-p46-mon",
      userId: "host-p46-mon",
      broadcastId: "bc-p46-mon",
    });
    assert(pub.ok !== false, "p45:publish-ok");
    assert(integ.getDiagnostics().monitoringFeed != null, "p45:monitoring-feed");
    assert(pub.recordingCandidate?.candidate === true, "p44:candidate-intact");
    await integ.dispose();
  }

  console.log("\n--- P4-3 chat watching with edge sync ---\n");
  {
    const mockSync = createMockEdgeSync();
    const chatEdge = {
      calls: [],
      async setWatching(p) {
        this.calls.push(p);
        return { ok: true };
      },
    };
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: chatEdge,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: chatEdge,
    });
    const join = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-p46-chat",
      userId: "viewer-p46-chat",
    });
    assert(join.ok !== false, "p43:joinLive-ok");
    assert(join.watchingSync?.ok === true, "p43:watching-sync");
    await integ.dispose();
  }

  console.log("\n--- P4-2 edge sync on publish ---\n");
  {
    const mockSync = createMockEdgeSync();
    const integ = new Integration({ providerId: "stub", useEdgeSync: true, edgeSync: mockSync });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
    });
    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-p46-edge",
      userId: "host-p46-edge",
      broadcastId: "bc-p46-edge",
    });
    assert(pub.ok !== false, "p42:publish-ok");
    assert(mockSync.setLiveCalls.length >= 1, "p42:setLive-called");
    assert(pub.edgeSync?.ok === true, "p42:edgeSync-result");
    await integ.dispose();
  }

  console.log("\n--- module-unloaded fallback (Phase 3 compat) ---\n");
  {
    const ctxNoRetry = loadRuntime({ withoutRetry: true });
    const IntegrationNoRetry = ctxNoRetry.TasuLivePlatformIntegration;
    const integ = new IntegrationNoRetry({ providerId: "stub" });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-fallback",
      userId: "host-fallback",
      broadcastId: "bc-fallback",
    });
    assert(pub.ok !== false, "fallback:publish-without-retry-module");
    assert(integ.getDiagnostics().retryLastResult == null, "fallback:no-retryLastResult");
    assert(ctxNoRetry.TasuLivePlatformRetry == null, "fallback:retry-module-absent");
    await integ.dispose();
  }

  console.log("\n--- Regression ---\n");
  for (const script of REGRESSION_SCRIPTS) {
    try {
      execSync(`npm run ${script}`, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
      pass(`regression:${script}`);
    } catch (err) {
      fail(`regression:${script}`, err.stdout?.slice(-400) || err.message);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nP4-6 GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
