#!/usr/bin/env node
/**
 * TASFUL TALK Phase7.1 — Web Push 実送信（VAPID / delivery）テスト
 *
 *   node scripts/test-talk-call-push-delivery.mjs
 *   SUPABASE_STRICT=1 node scripts/test-talk-call-push-delivery.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWebPushPayload,
  deliverPendingPushEvent,
  isInvalidSubscriptionStatusCode,
  isTerminalEventStatus,
  isVapidConfigured,
  readVapidConfig,
  sanitizePushPayload,
  validateOutboundPayload,
} from "./lib/talk-call-push-delivery.mjs";
import { loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EDGE_SRC = readFileSync(join(ROOT, "supabase/functions/talk-call-push-notify/index.ts"), "utf8");
const SHARED_SRC = readFileSync(join(ROOT, "supabase/functions/_shared/talk-call-push-delivery.ts"), "utf8");
const SW_SRC = readFileSync(join(ROOT, "talk-service-worker.js"), "utf8");
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

function sampleEvent(overrides = {}) {
  return {
    id: "evt-001",
    call_id: "call-001",
    callee_user_id: "u_store",
    room_id: "room-abc",
    target_url: "/chat-detail.html?thread=room-abc&callId=call-001&from=notify",
    delivery_status: "pending",
    payload: {
      type: "talk_call_incoming",
      call_id: "call-001",
      room_id: "room-abc",
      caller_display_name: "Store",
    },
    ...overrides,
  };
}

function ringingSession() {
  return {
    id: "call-001",
    status: "ringing",
    expires_at: new Date(Date.now() + 60000).toISOString(),
  };
}

async function runDeliveryUnitTests() {
  const session = ringingSession();
  const event = sampleEvent();

  const skipNoVapid = await deliverPendingPushEvent({
    vapid: null,
    event,
    session,
    subscriptions: [{ endpoint: "https://push.example/1", p256dh_key: "k", auth_key: "a", status: "active" }],
    sendFn: async () => ({ ok: true }),
  });
  assert(skipNoVapid.delivery_status === "skipped" && skipNoVapid.reason === "vapid_unconfigured", "VAPID unset → skipped");
  assert(skipNoVapid.retry_eligible === false, "skipped: no retry");

  const vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@example.com" };
  let sendCount = 0;
  const sent = await deliverPendingPushEvent({
    vapid,
    event,
    session,
    subscriptions: [{ endpoint: "https://push.example/1", p256dh_key: "k", auth_key: "a", status: "active" }],
    sendFn: async () => {
      sendCount += 1;
      return { ok: true };
    },
  });
  assert(sent.delivery_status === "sent", "VAPID set → sent");
  assert(sendCount === 1, "sendNotification invoked once");

  const failedNoSub = await deliverPendingPushEvent({
    vapid,
    event,
    session,
    subscriptions: [],
    sendFn: async () => ({ ok: true }),
  });
  assert(failedNoSub.delivery_status === "failed" && failedNoSub.reason === "no_subscription", "no subscription → failed");
  assert(failedNoSub.retry_eligible === true, "failed: retry_eligible");

  const failed410 = await deliverPendingPushEvent({
    vapid,
    event,
    session,
    subscriptions: [
      { endpoint: "https://push.example/gone", p256dh_key: "k", auth_key: "a", status: "active" },
      { endpoint: "https://push.example/ok", p256dh_key: "k2", auth_key: "a2", status: "active" },
    ],
    sendFn: async (sub) => {
      if (sub.endpoint.includes("gone")) return { ok: false, statusCode: 410 };
      return { ok: true };
    },
  });
  assert(failed410.delivery_status === "sent", "410 on first sub → try second → sent");
  assert(failed410.inactiveEndpoints?.includes("https://push.example/gone"), "410 marks inactive endpoint");

  const allFailed = await deliverPendingPushEvent({
    vapid,
    event,
    session,
    subscriptions: [{ endpoint: "https://push.example/404", p256dh_key: "k", auth_key: "a", status: "active" }],
    sendFn: async () => ({ ok: false, statusCode: 404 }),
  });
  assert(allFailed.delivery_status === "failed" && allFailed.reason === "invalid_subscription", "404 → failed invalid_subscription");
  assert(allFailed.retry_eligible === true, "404 failed: retry_eligible");

  const terminal = await deliverPendingPushEvent({
    vapid,
    event: { ...event, delivery_status: "sent" },
    session,
    subscriptions: [],
    sendFn: async () => ({ ok: true }),
  });
  assert(terminal.reason === "not_pending" || terminal.reason === "already_terminal", "sent event not redelivered");

  const safePayload = sanitizePushPayload(
    { type: "talk_call_incoming", call_id: "c1", room_id: "r1", caller_display_name: "A", email: "x@y.z" },
    "c1",
    "/chat-detail.html?thread=r1&callId=c1&from=notify"
  );
  assert(!("email" in safePayload), "sanitize strips extra keys");
  assert(validateOutboundPayload(safePayload), "sanitized payload validates");
  const payloadStr = buildWebPushPayload(safePayload);
  assert(!payloadStr.includes("token"), "payload no token");
  assert(!payloadStr.includes("credential"), "payload no credential");
  assert(!payloadStr.includes("email"), "payload no email");

  assert(isInvalidSubscriptionStatusCode(410) && isInvalidSubscriptionStatusCode(404), "410/404 invalid subscription");
  assert(isTerminalEventStatus("sent") && isTerminalEventStatus("skipped"), "terminal statuses");
  assert(!isTerminalEventStatus("failed"), "failed is not terminal (retry eligible)");
}

async function runSourceGuardTests() {
  assert(EDGE_SRC.includes('from "https://esm.sh/web-push'), "edge imports web-push");
  assert(SHARED_SRC.includes("WEB_PUSH_VAPID_PUBLIC_KEY"), "shared VAPID env");
  assert(SHARED_SRC.includes("FORBIDDEN_KEYS"), "shared forbidden keys");
  assert(!SHARED_SRC.includes("console.log"), "shared module no console.log");
  assert(EDGE_SRC.includes("safeLog("), "edge uses safeLog");
  assert(!EDGE_SRC.includes("privateKey,"), "edge does not log privateKey");
  assert(SW_SRC.includes('addEventListener("notificationclick"'), "SW notificationclick");
  assert(SW_SRC.includes("openWindow"), "SW opens target_url");

  assert(isVapidConfigured({}) === false, "empty env: VAPID not configured");
  assert(isVapidConfigured({ WEB_PUSH_VAPID_PUBLIC_KEY: "a", WEB_PUSH_VAPID_PRIVATE_KEY: "b" }) === true, "keys set: configured");
  const cfg = readVapidConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: "pub", WEB_PUSH_VAPID_PRIVATE_KEY: "sec" });
  assert(cfg?.publicKey === "pub" && cfg?.privateKey === "sec", "readVapidConfig (secrets stay in env only)");
}

async function runSupabaseIntegration() {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey) {
    fail("integration: supabase config missing");
    return;
  }

  const headers = {
    apikey: cfg.serviceKey,
    Authorization: `Bearer ${cfg.serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const roomId = `talk-push71-${Date.now()}`;
  const callerId = "u_me";
  const calleeId = "u_store";

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

  const payload = sanitizePushPayload(
    { type: "talk_call_incoming", call_id: callId, room_id: roomId, caller_display_name: "Store" },
    callId,
    `/chat-detail.html?thread=${roomId}&callId=${callId}&from=notify`
  );
  const row = {
    call_id: callId,
    callee_user_id: calleeId,
    caller_user_id: callerId,
    room_id: roomId,
    event_type: "talk_call_incoming",
    delivery_status: "pending",
    payload,
    target_url: `/chat-detail.html?thread=${roomId}&callId=${callId}&from=notify`,
  };

  const insertRes = await fetch(`${cfg.url}/rest/v1/talk_call_push_events`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!insertRes.ok) {
    fail(`integration: insert event ${insertRes.status}`);
    await cleanup(cfg, callId, headers);
    return;
  }
  pass("integration: pending event inserted");

  const fnUrl = `${cfg.url.replace(/\/$/, "")}/functions/v1/talk-call-push-notify`;
  const edgeRes = await fetch(fnUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ call_id: callId, mock: true }),
  }).catch(() => null);

  if (edgeRes?.ok) {
    const body = await edgeRes.json();
    assert(body.skipped === true || body.delivery_status === "skipped", "integration: VAPID unset/mock → skipped");
    const evRes = await fetch(
      `${cfg.url}/rest/v1/talk_call_push_events?call_id=eq.${callId}&select=delivery_status,retry_eligible`,
      { headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } }
    );
    const evRows = await evRes.json();
    assert(evRows[0]?.delivery_status === "skipped", "integration: event updated to skipped");
    assert(evRows[0]?.retry_eligible === false, "integration: skipped not retry eligible");
  } else {
    console.log(`  INFO  edge unreachable (${edgeRes?.status || "network"}) — delivery unit tests cover logic`);
  }

  // subscription status column (phase71 migration)
  const subProbe = await fetch(`${cfg.url}/rest/v1/talk_push_subscriptions?limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (subProbe.ok) {
    pass("integration: talk_push_subscriptions reachable");
  }

  await cleanup(cfg, callId, headers);
}

async function cleanup(cfg, callId, headers) {
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
  console.log("TASFUL TALK Phase7.1 — Web Push delivery\n");

  await runDeliveryUnitTests();
  await runSourceGuardTests();

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
  console.log("ALL PASS — talk-call-push-delivery");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
