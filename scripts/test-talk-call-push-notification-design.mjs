#!/usr/bin/env node
/**
 * TASFUL TALK Phase6/7 — Push 着信 設計 + DB integration テスト
 *
 *   node scripts/test-talk-call-push-notification-design.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-call-push-notification-design.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";
import { evaluateSessionGuard } from "./lib/talk-call-push-edge-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUSH_SRC = readFileSync(join(__dirname, "talk-call-push-events.js"), "utf8");
const EDGE_SRC = readFileSync(join(__dirname, "..", "supabase/functions/talk-call-push-notify/index.ts"), "utf8");
const SHARED_SRC = readFileSync(join(__dirname, "..", "supabase/functions/_shared/talk-call-push-delivery.ts"), "utf8");
const STRICT = process.env.SUPABASE_STRICT === "1";

/** @type {string[]} */
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function assert(cond, msg) {
  if (cond) pass(msg);
  else fail(msg);
}

function loadPushModule(opts = {}) {
  const env = { NODE_ENV: "test", ...(opts.env || {}) };
  const sandbox = {
    console: {
      log: (...args) => capturedLogs.push(["log", args]),
      warn: (...args) => capturedLogs.push(["warn", args]),
      debug: (...args) => capturedLogs.push(["debug", args]),
    },
    process: { env },
    globalThis: {},
    window: {},
    location: { origin: "http://127.0.0.1:8765", search: opts.search || "" },
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  sandbox.window = sandbox.globalThis;
  sandbox.globalThis.location = sandbox.location;
  if (opts.talkCallConfig) sandbox.globalThis.TASU_TALK_CALL_CONFIG = opts.talkCallConfig;
  if (opts.notifyBridge) sandbox.globalThis.TasuTalkCallNotifyBridge = opts.notifyBridge;
  if (opts.signaling) sandbox.globalThis.TasuTalkCallSignaling = opts.signaling;

  /** @type {Array<[string, unknown[]]>} */
  const capturedLogs = [];
  vm.createContext(sandbox);
  vm.runInContext(PUSH_SRC, sandbox);
  return { Push: sandbox.globalThis.TasuTalkCallPushEvents, logs: capturedLogs, sandbox };
}

function sampleSession(overrides = {}) {
  return {
    id: "call-uuid-001",
    room_id: "room-abc",
    caller_id: "u_me",
    callee_id: "u_store",
    status: "ringing",
    expires_at: new Date(Date.now() + 60000).toISOString(),
    ...overrides,
  };
}

function signalingStub() {
  return {
    isParticipant(session, userId) {
      const uid = String(userId || "");
      return uid === String(session?.caller_id) || uid === String(session?.callee_id);
    },
  };
}

async function invokeEdgeFunction(cfg, callId) {
  const url = `${cfg.url.replace(/\/$/, "")}/functions/v1/talk-call-push-notify`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.serviceKey}`,
      apikey: cfg.serviceKey,
    },
    body: JSON.stringify({ call_id: callId, mock: true }),
  }).catch(() => null);
  return res;
}

async function runSupabaseIntegration() {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey) {
    fail("integration: supabase config missing");
    return;
  }

  const roomId = `talk-push-${Date.now()}`;
  const callerId = "u_me";
  const calleeId = "u_store";
  const headers = {
    apikey: cfg.serviceKey,
    Authorization: `Bearer ${cfg.serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const sessionRes = await fetch(`${cfg.url}/rest/v1/talk_call_sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      room_id: roomId,
      caller_id: callerId,
      callee_id: calleeId,
      status: "ringing",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    }),
  });
  if (!sessionRes.ok) {
    fail(`integration: create session ${sessionRes.status}`);
    return;
  }
  const sessionPayload = await sessionRes.json();
  const callId = Array.isArray(sessionPayload) ? sessionPayload[0]?.id : sessionPayload?.id;
  if (!callId) {
    fail("integration: create session missing id");
    return;
  }

  const { Push } = loadPushModule({
    signaling: signalingStub(),
    notifyBridge: {
      buildAcceptHref(r, c) {
        return `/chat-detail.html?thread=${r}&callId=${c}&from=notify`;
      },
    },
  });
  const payload = Push.buildPushPayload({ callId, roomId, callerDisplayName: "Store" });
  const row = {
    call_id: callId,
    callee_user_id: calleeId,
    caller_user_id: callerId,
    room_id: roomId,
    event_type: Push.PUSH_TYPE,
    delivery_status: "pending",
    payload,
    target_url: Push.buildPushTapUrl(roomId, callId),
  };

  const insertRes = await fetch(`${cfg.url}/rest/v1/talk_call_push_events`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!insertRes.ok) {
    const text = await insertRes.text();
    fail(`integration: insert push event ${insertRes.status} ${text.slice(0, 120)}`);
    await cleanupSession(cfg, callId, headers);
    return;
  }
  pass("integration: push event inserted for callee");

  const dupRes = await fetch(`${cfg.url}/rest/v1/talk_call_push_events`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  assert(dupRes.status === 409 || dupRes.status === 400, "integration: duplicate call_id rejected");

  const edgeRes = await invokeEdgeFunction(cfg, callId);
  if (edgeRes?.ok) {
    const edgeBody = await edgeRes.json();
    assert(edgeBody.delivery_status === "skipped" || edgeBody.skipped === true, "integration: edge marks skipped without VAPID");
    const afterEdge = await fetch(
      `${cfg.url}/rest/v1/talk_call_push_events?call_id=eq.${callId}&select=delivery_status`,
      { headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } }
    );
    const rows = await afterEdge.json();
    assert(rows[0]?.delivery_status !== "pending", "integration: no pending after edge invoke");
  } else {
    console.log(`  INFO  edge invoke skipped (${edgeRes?.status || "unreachable"}) — guard tested via unit tests`);
  }

  // terminal session should not get new enqueue
  assert(Push.shouldEnqueuePushEvent({ id: callId, room_id: roomId, caller_id: callerId, callee_id: calleeId, status: "ended" }, callerId) === false, "integration: ended no enqueue");

  // ended session guard
  const endedGuard = evaluateSessionGuard({ id: callId, status: "ended", expires_at: row.expires_at || new Date().toISOString() });
  assert(endedGuard.ok === false && endedGuard.delivery_status === "skipped", "integration: edge guard rejects ended");

  await cleanupSession(cfg, callId, headers);
}

async function cleanupSession(cfg, callId, headers) {
  await fetch(`${cfg.url}/rest/v1/talk_call_push_events?call_id=eq.${callId}`, {
    method: "DELETE",
    headers,
  }).catch(() => {});
  await fetch(`${cfg.url}/rest/v1/talk_call_sessions?id=eq.${callId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
  }).catch(() => {});
}

async function main() {
  console.log("TASFUL TALK Phase6/7 — Push incoming design + integration\n");

  const { Push } = loadPushModule({
    signaling: signalingStub(),
    notifyBridge: {
      buildAcceptHref(roomId, callId) {
        return `/chat-detail.html?thread=${roomId}&callId=${callId}&from=notify&userId=u_store`;
      },
    },
  });

  const session = sampleSession();
  assert(Push.shouldEnqueuePushEvent(session, "u_me") === true, "ringing: caller may enqueue");
  assert(Push.shouldEnqueuePushEvent(session, "u_store") === false, "ringing: callee cannot enqueue");
  assert(Push.shouldEnqueuePushEvent(session, "u_other") === false, "ringing: other user cannot enqueue");
  assert(Push.shouldEnqueuePushEvent({ ...session, status: "ended" }, "u_me") === false, "ended: no enqueue");
  assert(Push.shouldEnqueuePushEvent({ ...session, status: "rejected" }, "u_me") === false, "rejected: no enqueue");
  assert(Push.shouldEnqueuePushEvent({ ...session, status: "missed" }, "u_me") === false, "missed: no enqueue");
  assert(Push.shouldEnqueuePushEvent({ ...session, status: "active" }, "u_me") === false, "active: no enqueue");

  const payload = Push.buildPushPayload({ callId: session.id, roomId: session.room_id, callerDisplayName: "Store" });
  assert(payload.type === "talk_call_incoming", "payload type");
  assert(!("credential" in payload), "payload no credential");
  assert(Push.validatePayload(payload) === true, "payload validates");

  const tapUrl = Push.buildPushTapUrl(session.room_id, session.id);
  assert(tapUrl.includes("chat-detail.html"), "tap URL uses chat-detail");
  assert(tapUrl.includes(`callId=${session.id}`), "tap URL has callId");

  // Edge guard unit tests
  const ringing = evaluateSessionGuard({ id: "1", status: "ringing", expires_at: new Date(Date.now() + 60000).toISOString() });
  assert(ringing.ok === true, "edge guard: ringing ok");
  const active = evaluateSessionGuard({ id: "1", status: "active", expires_at: new Date(Date.now() + 60000).toISOString() });
  assert(active.ok === false && active.delivery_status === "skipped", "edge guard: active skipped");
  const expired = evaluateSessionGuard({ id: "1", status: "ringing", expires_at: new Date(Date.now() - 1000).toISOString() });
  assert(expired.ok === false && expired.reason === "session_expired", "edge guard: expired skipped");

  assert(EDGE_SRC.includes("evaluateSessionGuard"), "edge source: session guard");
  assert(EDGE_SRC.includes("delivery_status=eq.pending"), "edge source: pending only");
  assert(EDGE_SRC.includes("patchEvent("), "edge source: status patch");
  assert(EDGE_SRC.includes("webpush.sendNotification"), "edge source: web-push send");
  assert(EDGE_SRC.includes("isVapidConfigured"), "edge source: VAPID check");
  assert(SHARED_SRC.includes("WEB_PUSH_VAPID_PUBLIC_KEY"), "shared source: VAPID env names");
  assert(EDGE_SRC.includes("markSubscriptionInactive"), "edge source: subscription cleanup");
  assert(!EDGE_SRC.includes("console.log(body"), "edge source: no raw body log");
  assert(!EDGE_SRC.includes("privateKey:"), "edge source: no privateKey in log payload");

  if (STRICT) {
    await runSupabaseIntegration();
  } else {
    console.log("\nINFO  Set SUPABASE_STRICT=1 for DB integration checks");
  }

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("ALL PASS — talk-call-push-notification-design");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
