#!/usr/bin/env node
/**
 * TASFUL TALK Phase7 — Service Worker Push 基盤テスト
 *
 *   node scripts/test-talk-call-service-worker.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SW_SRC = readFileSync(join(ROOT, "talk-service-worker.js"), "utf8");
const SUB_SRC = readFileSync(join(__dirname, "talk-push-subscribe.js"), "utf8");

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

function extractBuildNotificationLogic(swSource) {
  const blockMatch = swSource.match(
    /const PUSH_TYPE = [\s\S]*?function buildNotificationFromPush\(data\)\s*\{[\s\S]*?return \{[\s\S]*?\};\s*\}/
  );
  if (!blockMatch) throw new Error("notification helpers not found");
  const sandbox = { encodeURIComponent, result: null };
  vm.createContext(sandbox);
  vm.runInContext(`${blockMatch[0]}; result = buildNotificationFromPush;`, sandbox);
  return sandbox.result;
}

function loadSubscribeModule(opts = {}) {
  const sandbox = {
    console: { warn: () => {} },
    navigator: opts.navigator || {},
    Notification: opts.Notification || { permission: "default" },
    PushManager: opts.PushManager || function PushManager() {},
    globalThis: {},
    window: {},
    atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
  };
  sandbox.window = sandbox.globalThis;
  sandbox.globalThis.Notification = sandbox.Notification;
  sandbox.globalThis.PushManager = sandbox.PushManager;
  if (opts.config) sandbox.globalThis.TASU_TALK_CALL_CONFIG = opts.config;
  vm.createContext(sandbox);
  vm.runInContext(SUB_SRC, sandbox);
  return sandbox.globalThis.TasuTalkPushSubscribe;
}

async function main() {
  console.log("TASFUL TALK Phase7 — Service Worker / subscribe\n");

  assert(SW_SRC.includes('addEventListener("push"'), "SW has push handler");
  assert(SW_SRC.includes('addEventListener("notificationclick"'), "SW has notificationclick handler");
  assert(SW_SRC.includes("talk_call_incoming"), "SW push type constant");
  assert(!SW_SRC.includes("credential"), "SW source has no credential string");

  const buildNotificationFromPush = extractBuildNotificationLogic(SW_SRC);
  const note = buildNotificationFromPush({
    type: "talk_call_incoming",
    call_id: "abc-123",
    room_id: "room-xyz",
    caller_display_name: "Store",
    target_url: "/chat-detail.html?thread=room-xyz&callId=abc-123&from=notify",
  });
  assert(note.title === "音声通話の着信", "notification title production copy");
  assert(note.body.includes("さんから通話があります"), "notification body production copy");
  assert(note.data.target_url.includes("chat-detail"), "notificationclick target is chat-detail");
  assert(note.data.target_url.includes("thread=room-xyz"), "target has thread");
  assert(note.data.target_url.includes("callId=abc-123"), "target has callId");
  assert(!JSON.stringify(note).includes("token"), "notification payload no token");

  const fallback = buildNotificationFromPush({
    call_id: "c1",
    room_id: "r1",
    caller_display_name: "A",
  });
  assert(fallback.data.target_url.includes("chat-detail.html"), "fallback builds chat-detail URL");
  assert(fallback.data.target_url.includes("callId=c1"), "fallback has callId");

  let requested = false;
  const SubDefault = loadSubscribeModule({
    Notification: {
      permission: "default",
      requestPermission: () => {
        requested = true;
        return Promise.resolve("granted");
      },
    },
    navigator: { serviceWorker: { register: async () => ({ pushManager: {} }) } },
  });
  const defaultRes = await SubDefault.trySyncSubscription();
  assert(defaultRes.skipped === true && defaultRes.reason === "permission_default", "default permission skips subscribe");
  assert(requested === false, "does not call requestPermission on default");

  const SubDenied = loadSubscribeModule({ Notification: { permission: "denied" } });
  const deniedRes = await SubDenied.trySyncSubscription();
  assert(deniedRes.skipped === true && deniedRes.reason === "permission_denied", "denied permission skips");

  const SubNoVapid = loadSubscribeModule({
    Notification: { permission: "granted" },
    config: {},
  });
  const noVapidRes = await SubNoVapid.trySyncSubscription();
  assert(noVapidRes.skipped === true && noVapidRes.reason === "vapid_unconfigured", "no VAPID skips subscribe");

  const Sub = loadSubscribeModule({});
  assert(Sub.SW_URL === "/talk-service-worker.js", "subscribe SW_URL");
  assert(Sub.SW_SCOPE === "/", "subscribe SW_SCOPE");

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("ALL PASS — talk-call-service-worker");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
