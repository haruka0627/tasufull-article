#!/usr/bin/env node
/**
 * Live Platform — ZEGO Integration Phase 4 P4-3 (Chat Gateway + set_watching) tests
 *
 *   node scripts/test-platform-live-zego-integration-phase4-p4-3.mjs
 *   npm run test:platform-live-zego-integration-phase4-p4-3
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
const CHAT_EDGE_PATH = "platform-live/chat/live-chat-edge-client.js";

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

const CHAT_LOAD = [
  "platform-live/chat/live-chat-message-states.js",
  "platform-live/chat/live-chat-system-events.js",
  "platform-live/chat/live-chat-events.js",
  "platform-live/chat/live-chat-error-codes.js",
  "platform-live/chat/live-chat-validation.js",
  "platform-live/chat/live-chat-moderation-hook.js",
  "platform-live/chat/live-chat-rate-limit-hook.js",
  "platform-live/chat/live-chat-gateway.js",
  CHAT_EDGE_PATH,
];

const EDGE_EXTRA = [
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
  for (const rel of [...CORE_LOAD, ...BROADCAST_LOAD, ...VIEWER_LOAD, ...CHAT_LOAD, ...EDGE_EXTRA, ...PROVIDER_LOAD]) {
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

function createMockChatEdgeClient(overrides = {}) {
  return {
    setWatchingCalls: [],
    sendMessageCalls: [],
    async setWatching(params) {
      this.setWatchingCalls.push(params);
      if (overrides.setWatchingFail) {
        return { ok: false, error: "mock set_watching fail" };
      }
      if (overrides.setWatchingThrow) {
        throw new Error("mock set_watching throw");
      }
      return { ok: true, stub: true, ...params };
    },
    async sendMessage(params) {
      this.sendMessageCalls.push(params);
      if (overrides.sendMessageFail) {
        return { ok: false, error: "mock send fail" };
      }
      return { ok: true, messageId: params.messageId, stub: true };
    },
    async setLive() {
      return { ok: true };
    },
    async clearLive() {
      return { ok: true };
    },
  };
}

async function run() {
  console.log("\n=== Live Platform ZEGO Integration — Phase 4 P4-3 ===\n");

  const tlvSha = sha256(TLV_POC_PROVIDER);
  const ifaceSha = sha256(INTERFACE_PATH);
  const joinLiveSrc = read(INTEGRATION_PATH);
  const chatEdgeSrc = read(CHAT_EDGE_PATH);

  console.log("--- Guardrails ---\n");
  assert(sha256(TLV_POC_PROVIDER) === tlvSha, "static:tlv-poc-unchanged");
  assert(sha256(INTERFACE_PATH) === ifaceSha, "static:interface-unchanged");
  assert(!/async joinLive[\s\S]*?_runEdgeSetLive/.test(joinLiveSrc), "static:joinLive-no-setLive");
  assert(/setWatching\s*\(/.test(chatEdgeSrc), "static:chat-edge-setWatching");
  assert(/messageId/.test(chatEdgeSrc), "static:chat-edge-messageId");

  const ctx = loadRuntime();
  const Integration = ctx.TasuLivePlatformIntegration;
  const PLATFORM = "platform";

  console.log("\n--- useEdgeSync=false joinLive compat ---\n");
  {
    const mockChat = createMockChatEdgeClient();
    const integ = new Integration({ providerId: "stub", chatEdgeClient: mockChat });
    await integ.initialize({ surface: PLATFORM, providerId: "stub" });
    assert(integ.chatGateway != null, "default:chatGateway-wired");
    const jr = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-off",
      userId: "viewer-off",
      broadcastId: "bc-off",
      manualToken: "secret-no-diag",
    });
    assert(jr.ok !== false, "default:joinLive-ok");
    assert(jr.watchingSync == null, "default:no-watchingSync");
    assert(mockChat.setWatchingCalls.length === 0, "default:no-setWatching");
    const diagStr = JSON.stringify(integ.getDiagnostics());
    assert(!diagStr.includes("secret-no-diag"), "default:no-token-diag");
    await integ.dispose();
  }

  console.log("\n--- useEdgeSync=true joinLive → set_watching ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockChat = createMockChatEdgeClient();
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
    });

    const jr = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-watch",
      userId: "viewer-watch",
      broadcastId: "bc-watch",
    });
    assert(jr.ok !== false, "enabled:joinLive-ok");
    assert(mockChat.setWatchingCalls.length === 1, "enabled:setWatching-once");
    assert(mockChat.setWatchingCalls[0]?.userId === "viewer-watch", "enabled:setWatching-userId");
    assert(mockChat.setWatchingCalls[0]?.broadcastId === "bc-watch", "enabled:setWatching-broadcastId");
    assert(jr.watchingSync?.ok === true, "enabled:watchingSync-result");
    assert(mockSync.setLiveCalls.length === 0, "enabled:joinLive-no-setLive");
    const events = integ.getDiagnostics().chatEdgeEvents || [];
    assert(events.some((e) => e.name === "attempted"), "enabled:chatEdge-attempted");
    assert(events.some((e) => e.name === "succeeded"), "enabled:chatEdge-succeeded");
    await integ.dispose();
  }

  console.log("\n--- joinLive failure → no set_watching ---\n");
  {
    const mockChat = createMockChatEdgeClient();
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
    });

    const origJoin = integ.provider.joinLive.bind(integ.provider);
    integ.provider.joinLive = async () => ({ ok: false, error: "mock join fail" });

    const jr = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-fail",
      userId: "viewer-fail",
      broadcastId: "bc-fail",
    });
    assert(jr.ok === false, "fail:joinLive-failed");
    assert(mockChat.setWatchingCalls.length === 0, "fail:no-setWatching");

    integ.provider.joinLive = origJoin;
    await integ.dispose();
  }

  console.log("\n--- set_watching failure non-fatal ---\n");
  {
    const mockChat = createMockChatEdgeClient({ setWatchingFail: true });
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
    });

    const jr = await integ.joinLive({
      surface: PLATFORM,
      roomId: "room-partial",
      userId: "viewer-partial",
      broadcastId: "bc-partial",
    });
    assert(jr.ok !== false, "partial:joinLive-still-ok");
    assert(jr.watchingSync?.partial === true, "partial:watchingSync-flag");
    const failedEv = integ.getDiagnostics().chatEdgeEvents?.some((e) => e.name === "failed");
    assert(failedEv, "partial:chatEdge-failed-recorded");
    await integ.dispose();
  }

  console.log("\n--- chat messageId propagation ---\n");
  {
    const captured = [];
    const EdgeClient = ctx.TasuLivePlatformChatEdgeClient;
    const localGw = {
      sendMessage: async (params) => {
        captured.push(params);
        return { ok: true, state: ctx.PLATFORM_LIVE_CHAT_MESSAGE_STATES?.SENT || "sent", message: { id: params.messageId } };
      },
    };
    const client = new EdgeClient({ localGateway: localGw });
    const sr = await client.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-msg",
      userId: "u1",
      text: "hello",
      messageId: "client-msg-42",
    });
    assert(sr.ok !== false, "messageId:send-ok");
    assert(captured.length === 1, "messageId:local-once");
    assert(captured[0]?.messageId === "client-msg-42", "messageId:passed-to-gateway");
  }

  console.log("\n--- P4-2 publish/stop path intact ---\n");
  {
    const mockSync = createMockEdgeSync();
    const mockChat = createMockChatEdgeClient();
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: mockSync,
      chatEdgeClient: mockChat,
    });

    const pub = await integ.startPublish({
      surface: PLATFORM,
      roomId: "room-host",
      userId: "host-1",
      broadcastId: "bc-host",
    });
    assert(pub.ok !== false, "p42:publish-ok");
    assert(mockSync.setLiveCalls.length === 1, "p42:setLive-called");
    assert(mockChat.setWatchingCalls.length === 0, "p42:publish-no-setWatching");

    const stop = await integ.stopPublish({ surface: PLATFORM, broadcastId: "bc-host" });
    assert(stop.ok !== false, "p42:stop-ok");
    assert(mockSync.clearLiveCalls.length === 1, "p42:clearLive-called");
    await integ.dispose();
  }

  console.log("\n--- sendChatMessage + edge messageId ---\n");
  {
    const mockChat = createMockChatEdgeClient();
    const mockGateway = {
      async sendMessage(opts) {
        return {
          ok: true,
          state: ctx.PLATFORM_LIVE_CHAT_MESSAGE_STATES?.SENT || "sent",
          message: {
            id: "msg-integration-99",
            surface: opts.surface,
            broadcastId: opts.broadcastId,
            userId: opts.userId,
            text: opts.text,
            state: ctx.PLATFORM_LIVE_CHAT_MESSAGE_STATES?.SENT || "sent",
          },
        };
      },
    };
    const integ = new Integration({
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
      chatGateway: mockGateway,
    });
    await integ.initialize({
      surface: PLATFORM,
      providerId: "stub",
      useEdgeSync: true,
      edgeSync: createMockEdgeSync(),
      chatEdgeClient: mockChat,
      chatGateway: mockGateway,
    });

    const sr = await integ.sendChatMessage({
      surface: PLATFORM,
      broadcastId: "bc-chat",
      userId: "chat-user",
      text: "integration hello",
    });
    assert(sr.ok, "chat:send-ok");
    assert(sr.message?.id === "msg-integration-99", "chat:gateway-messageId");
    assert(mockChat.sendMessageCalls.length === 1, "chat:edge-send-once");
    assert(mockChat.sendMessageCalls[0]?.messageId === "msg-integration-99", "chat:edge-messageId-match");
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
  console.log(`PASS ${summary.pass} · FAIL ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase 4 P4-3 tests: GO\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
