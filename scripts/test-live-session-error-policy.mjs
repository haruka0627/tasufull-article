#!/usr/bin/env node
/**
 * TLV Live Session — Error Policy / Input Validation (Phase2-06)
 *
 *   node scripts/test-live-session-error-policy.mjs
 *   npm run test:live-session-error-policy
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
  console.log("\n=== TLV Session Error Policy / Input Validation (Phase2-06) ===\n");

  const ctx = loadRuntime();
  const S = ctx.LIVE_SESSION_STATES;
  const E = ctx.LIVE_SESSION_EVENTS;
  const SIG = ctx.LIVE_PROVIDER_SIGNALS;
  const CODES = ctx.LIVE_SESSION_ERROR_CODES;
  const V = ctx.TlvLiveSessionValidation;
  const Manager = ctx.TlvLiveSessionManager;
  const Bridge = ctx.TlvLiveBroadcastsSessionBridge;

  console.log("--- Error codes ---\n");
  const expectedCodes = [
    "VALIDATION_ERROR",
    "PROVIDER_ERROR",
    "CONNECTION_ERROR",
    "SESSION_STATE_ERROR",
    "PERMISSION_ERROR",
    "UNKNOWN_ERROR",
  ];
  for (const code of expectedCodes) {
    assert(CODES[code] === code, `codes:${code}`);
  }

  console.log("\n--- Validation unit ---\n");
  assert(!V.validateRoomId("bad room!").ok, "val:roomId-invalid");
  assert(V.validateRoomId("room-1").ok, "val:roomId-ok");
  assert(!V.validateUserId("user@x").ok, "val:userId-invalid");
  assert(V.validateUserId("user-1").ok, "val:userId-ok");
  assert(!V.validateRole("admin").ok, "val:role-invalid");
  assert(V.validateRole("host").value === "host", "val:role-host");
  assert(!V.validateEventName("NOT_AN_EVENT").ok, "val:event-invalid");
  assert(V.validateEventName(E.ERROR).ok, "val:event-ok");
  assert(!V.validateProviderSignal("FAKE_SIGNAL", SIG).ok, "val:signal-invalid");
  assert(V.validateProviderSignal(SIG.PROVIDER_ERROR).ok, "val:signal-ok");
  assert(!V.validateErrorPayload({}).ok, "val:error-empty");
  assert(V.validateErrorPayload({ message: "x" }).ok, "val:error-ok");
  assert(
    V.normalizeErrorCode("NOT_REAL") === CODES.UNKNOWN_ERROR,
    "val:normalize-unknown"
  );

  console.log("\n--- Manager: no throw ---\n");
  {
    const m = new Manager();
    const errors = [];
    m.on(E.ERROR, (p) => errors.push(p));
    const cr = await m.createSession({ roomId: "bad id!", role: "host" });
    assert(!cr.ok && cr.code === CODES.VALIDATION_ERROR, "mgr:create-invalid-roomId");
    assert(m.state === S.IDLE, "mgr:create-invalid-stays-IDLE");
    assert(errors.length === 1 && errors[0].code === CODES.VALIDATION_ERROR, "mgr:create-emits-ERROR");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r-live", role: "host" });
    await m.start();
    const bad = await m.handleProviderSignal("UNKNOWN_SIG", {});
    assert(!bad.ok && bad.code === CODES.VALIDATION_ERROR && m.state === S.ERROR, "mgr:invalid-signal→ERROR");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r2", role: "host" });
    await m.start();
    const bad = await m.reportError({ message: "" });
    assert(!bad.ok && bad.code === CODES.VALIDATION_ERROR, "mgr:reportError-empty");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r3", role: "viewer" });
    await m.join();
    const bad = await m.end();
    assert(!bad.ok && bad.code === CODES.PERMISSION_ERROR && m.state === S.CONNECTED, "mgr:end-permission");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r4" });
    await m.start();
    await m.end();
    const bad = await m.start();
    assert(!bad.ok && bad.code === CODES.SESSION_STATE_ERROR && m.state === S.ENDED, "mgr:state-guard-no-ERROR");
  }

  {
    const m = new Manager();
    await m.createSession({ roomId: "r5", role: "host" });
    await m.start();
    await m.handleProviderSignal(SIG.PROVIDER_ERROR, { message: "provider fail", recoverable: true });
    assert(m.getStatus().lastError?.code === CODES.PROVIDER_ERROR, "mgr:provider-error-code");
  }

  console.log("\n--- Bridge validation ---\n");
  {
    const r = await Bridge.onStudioStart({ broadcastId: "bad!" });
    assert(r.enabled && r.code === CODES.VALIDATION_ERROR, "bridge:invalid-broadcastId");
  }
  {
    const r = await Bridge.onStudioStart({ broadcastId: "bridge-ok" });
    assert(r.enabled && r.state === S.LIVE, "bridge:valid-start");
  }
  {
    await Bridge.dispose();
    const r = await Bridge.onWatchJoin({ broadcastId: "watch-1", status: "live" });
    assert(r.enabled && r.state === S.CONNECTED, "bridge:watch-join");
  }

  console.log("\n--- Static ---\n");
  assert(fs.existsSync(path.join(ROOT, "live/session/live-session-error-codes.js")), "static:error-codes-file");
  assert(fs.existsSync(path.join(ROOT, "live/session/live-session-validation.js")), "static:validation-file");
  const mgrText = fs.readFileSync(path.join(ROOT, "live/session/live-session-manager.js"), "utf8");
  assert(mgrText.includes("_validationFail"), "static:manager-validation-fail");
  assert(!/throw new/.test(mgrText.replace(/throw new Error\(\s*\"TlvLiveSessionManager/g, "")), "static:manager-no-throw-validation");

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
