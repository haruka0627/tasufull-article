#!/usr/bin/env node
/**
 * Live Platform Chat — Phase D unit tests
 *
 *   node scripts/test-platform-live-chat-phase-d.mjs
 *   npm run test:platform-live-chat-phase-d
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

const VIEWER_LOAD_ORDER = [
  "platform-live/viewer/live-viewer-states.js",
  "platform-live/viewer/live-viewer-events.js",
  "platform-live/viewer/live-viewer-error-codes.js",
  "platform-live/viewer/live-viewer-validation.js",
  "platform-live/viewer/live-viewer-permission.js",
  "platform-live/viewer/live-viewer-ccu-registry.js",
  "platform-live/viewer/live-viewer-service.js",
  "platform-live/viewer/live-viewer-edge-client.js",
];

const CHAT_LOAD_ORDER = [
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

const LOAD_ORDER = [...CORE_LOAD_ORDER, ...BROADCAST_LOAD_ORDER, ...VIEWER_LOAD_ORDER, ...CHAT_LOAD_ORDER];

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

async function setupLiveStack(ctx, PLATFORM, id = "bc-chat") {
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const ViewerService = ctx.TasuLivePlatformViewerService;
  const CcuRegistry = ctx.TasuLivePlatformViewerCcuRegistry;

  const broadcast = new BroadcastService();
  await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: id, roomId: `room-${id}` });
  await broadcast.startBroadcast({ surface: PLATFORM });

  const viewer = new ViewerService({
    broadcastService: broadcast,
    ccuRegistry: new CcuRegistry(),
  });
  await viewer.joinViewer({ surface: PLATFORM, userId: "chat-user-1" });

  return { broadcast, viewer };
}

async function run() {
  console.log("\n=== Live Platform Chat — Phase D unit tests ===\n");

  const ctx = loadRuntime();
  const MS = ctx.PLATFORM_LIVE_CHAT_MESSAGE_STATES;
  const CE = ctx.PLATFORM_LIVE_CHAT_EVENTS;
  const SET = ctx.PLATFORM_LIVE_CHAT_SYSTEM_EVENT_TYPES;
  const CC = ctx.PLATFORM_LIVE_CHAT_ERROR_CODES;
  const MOD = ctx.TasuLivePlatformChatModerationHook.ACTIONS;
  const RATE = ctx.TasuLivePlatformChatRateLimitHook.ACTIONS;
  const ChatGateway = ctx.TasuLivePlatformChatGateway;
  const BroadcastService = ctx.TasuLivePlatformBroadcastService;
  const ViewerService = ctx.TasuLivePlatformViewerService;
  const createProvider = ctx.createPlatformLiveProvider;
  const EdgeClient = ctx.TasuLivePlatformChatEdgeClient;
  const BS = ctx.PLATFORM_LIVE_BROADCAST_STATES;
  const SURFACES = ctx.LIVE_SURFACES;

  const PLATFORM = SURFACES.PLATFORM;

  // --- Scaffold ---
  console.log("--- Scaffold ---\n");
  for (const rel of CHAT_LOAD_ORDER) {
    assert(fs.existsSync(path.join(ROOT, rel)), `static:file:${rel.split("/").pop()}`);
  }
  assert(fs.existsSync(path.join(ROOT, "supabase/functions/live-platform-chat/index.ts")), "static:edge-function");

  // --- Send message ---
  console.log("\n--- Send message ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-send");
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });

    const sent = [];
    gw.on(CE.MESSAGE_SENT, (p) => sent.push(p));
    const sr = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-send",
      userId: "chat-user-1",
      text: "Hello live chat",
    });
    assert(sr.ok && sr.state === MS.SENT, "send:→sent");
    assert(sent.length === 1 && sent[0].text === "Hello live chat", "send:MESSAGE_SENT");
  }

  // --- Empty message denied ---
  console.log("\n--- Empty message ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-empty");
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });
    const bad = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-empty",
      userId: "chat-user-1",
      text: "   ",
    });
    assert(!bad.ok && bad.code === CC.CHAT_VALIDATION_ERROR, "send:empty-denied");
  }

  // --- Invalid surface ---
  console.log("\n--- Invalid surface ---\n");
  {
    const gw = new ChatGateway();
    const bad = await gw.sendMessage({
      surface: "bad",
      broadcastId: "bc-x",
      userId: "u1",
      text: "hi",
    });
    assert(!bad.ok && bad.code === CC.SURFACE_ERROR, "surface:invalid");
  }

  // --- Viewer not watching ---
  console.log("\n--- Viewer not watching ---\n");
  {
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-nowatch", roomId: "room-nw" });
    await broadcast.startBroadcast({ surface: PLATFORM });
    const viewer = new ViewerService({ broadcastService: broadcast, ccuRegistry: new ctx.TasuLivePlatformViewerCcuRegistry() });
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });

    const denied = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-nowatch",
      userId: "no-viewer",
      text: "hi",
    });
    assert(!denied.ok && denied.code === CC.VIEWER_NOT_WATCHING, "send:not-watching-denied");
  }

  // --- Broadcast not live ---
  console.log("\n--- Broadcast not live ---\n");
  {
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-draft", roomId: "room-draft" });
    const viewer = new ViewerService({ broadcastService: broadcast, ccuRegistry: new ctx.TasuLivePlatformViewerCcuRegistry() });
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });

    const denied = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-draft",
      userId: "u1",
      text: "hi",
    });
    assert(!denied.ok && denied.code === CC.BROADCAST_NOT_LIVE, "send:not-live-denied");
  }

  // --- Moderation block ---
  console.log("\n--- Moderation ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-mod-block");
    const gw = new ChatGateway({
      broadcastService: broadcast,
      viewerService: viewer,
      moderationHook: () => ({ action: MOD.BLOCK, reason: "test block" }),
    });
    const blocked = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-mod-block",
      userId: "chat-user-1",
      text: "blocked text",
    });
    assert(!blocked.ok && blocked.state === MS.BLOCKED && blocked.code === CC.MODERATION_BLOCKED, "mod:block");

    const gw2 = new ChatGateway({
      broadcastService: broadcast,
      viewerService: viewer,
      moderationHook: () => ({ action: MOD.FLAG }),
    });
    const flagged = await gw2.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-mod-block",
      userId: "chat-user-1",
      text: "flagged ok",
    });
    assert(flagged.ok && flagged.message?.flagged === true, "mod:flag-still-sent");
  }

  // --- Rate limit ---
  console.log("\n--- Rate limit ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-rate");
    const gwDeny = new ChatGateway({
      broadcastService: broadcast,
      viewerService: viewer,
      rateLimitHook: () => ({ action: RATE.DENY, reason: "spam" }),
    });
    const denied = await gwDeny.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-rate",
      userId: "chat-user-1",
      text: "deny me",
    });
    assert(!denied.ok && denied.code === CC.RATE_LIMIT_DENIED, "rate:deny");

    const gwThrottle = new ChatGateway({
      broadcastService: broadcast,
      viewerService: viewer,
      rateLimitHook: () => ({ action: RATE.THROTTLE, retryAfterMs: 1000 }),
    });
    const throttled = await gwThrottle.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-rate",
      userId: "chat-user-1",
      text: "slow down",
    });
    assert(!throttled.ok && throttled.code === CC.RATE_LIMIT_THROTTLED, "rate:throttle");
  }

  // --- Reactions ---
  console.log("\n--- Reactions ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-react");
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });
    const sr = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-react",
      userId: "chat-user-1",
      text: "react to me",
    });

    const ar = await gw.addReaction({
      surface: PLATFORM,
      broadcastId: "bc-react",
      userId: "chat-user-1",
      messageId: sr.message.id,
      reaction: "like",
    });
    assert(ar.ok && ar.counts.like === 1, "reaction:add");

    const rr = await gw.removeReaction({
      surface: PLATFORM,
      broadcastId: "bc-react",
      userId: "chat-user-1",
      messageId: sr.message.id,
      reaction: "like",
    });
    assert(rr.ok && (rr.counts.like || 0) === 0, "reaction:remove");
  }

  // --- System events ---
  console.log("\n--- System events ---\n");
  {
    const { broadcast } = await setupLiveStack(ctx, PLATFORM, "bc-sys");
    const gw = new ChatGateway({ broadcastService: broadcast });

    const events = [];
    gw.on(CE.SYSTEM_EVENT, (p) => events.push(p));

    for (const type of Object.values(SET)) {
      const er = await gw.emitSystemEvent({
        surface: PLATFORM,
        broadcastId: "bc-sys",
        type,
        payload: { test: true },
      });
      assert(er.ok, `system:${type}`);
    }
    assert(events.length === Object.values(SET).length, "system:all-emitted");
  }

  // --- Provider stub ---
  console.log("\n--- Provider stub ---\n");
  {
    const provider = createProvider("stub");
    await provider.initialize({ surface: PLATFORM });
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-prov");
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer, provider });

    const sr = await gw.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-prov",
      userId: "chat-user-1",
      text: "via stub",
    });
    assert(sr.ok, "provider:send");

    const zegoFallback = createProvider("zego", { allowStubFallback: true });
    const cr = await zegoFallback.sendChatMessage({
      surface: PLATFORM,
      broadcastId: "bc-prov",
      userId: "u",
      messageId: "m1",
      text: "t",
    });
    assert(cr.stub === true, "provider:zego-fallback");
  }

  // --- Edge client local ---
  console.log("\n--- Edge client (local) ---\n");
  {
    const { broadcast, viewer } = await setupLiveStack(ctx, PLATFORM, "bc-edge");
    const gw = new ChatGateway({ broadcastService: broadcast, viewerService: viewer });
    const client = new EdgeClient({ localGateway: gw });

    const sr = await client.sendMessage({
      surface: PLATFORM,
      broadcastId: "bc-edge",
      userId: "chat-user-1",
      text: "edge local",
    });
    assert(sr.ok && sr.state === MS.SENT, "edge-local:send");
  }

  // --- Phase A/B/C regression ---
  console.log("\n--- Phase A/B/C regression ---\n");
  {
    const SessionManager = ctx.TasuLivePlatformSessionManager;
    const session = new SessionManager();
    const broadcast = new BroadcastService();
    await broadcast.createBroadcast({ surface: PLATFORM, broadcastId: "bc-reg", roomId: "room-reg" });
    await broadcast.startBroadcast({ surface: PLATFORM });
    assert(broadcast.state === BS.LIVE, "regression:broadcast-live");

    const viewer = new ViewerService({
      broadcastService: broadcast,
      sessionManager: session,
      ccuRegistry: new ctx.TasuLivePlatformViewerCcuRegistry(),
    });
    await viewer.joinViewer({ surface: PLATFORM, userId: "reg-u" });
    assert(session.state === ctx.PLATFORM_LIVE_SESSION_STATES.CONNECTED, "regression:session-connected");
  }

  // --- No TLV side effects ---
  console.log("\n--- No TLV side effects ---\n");
  {
    const commentsPath = path.join(ROOT, "live/live-comments.js");
    const watchVideoPath = path.join(ROOT, "live/watch-video.html");
    const beforeC = fs.readFileSync(commentsPath, "utf8");
    const beforeW = fs.readFileSync(watchVideoPath, "utf8");

    const gwCode = fs.readFileSync(path.join(ROOT, "platform-live/chat/live-chat-gateway.js"), "utf8");
    assert(!gwCode.includes("live-comments"), "tlv:no-comments-import");
    assert(!gwCode.includes("watch-video"), "tlv:no-watch-video-ref");
    assert(!beforeC.includes("TasuLivePlatformChatGateway"), "tlv:comments-unwired");

    assert(beforeC === fs.readFileSync(commentsPath, "utf8"), "tlv:live-comments-unmodified");
    assert(beforeW === fs.readFileSync(watchVideoPath, "utf8"), "tlv:watch-video-unmodified");
  }

  console.log("\n=== Summary ===");
  console.log(`PASS: ${summary.pass}  FAIL: ${summary.fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPhase D tests: PASS\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
