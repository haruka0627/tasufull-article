#!/usr/bin/env node
/**
 * talk-voice-core unit tests
 *   node scripts/test-talk-voice-core.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function loadCore(extra = {}) {
  const sandbox = { console, Date, Math, Set, Map, Object, Array, String, Number, Boolean, ...extra };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const files = [
    "scripts/talk-voice-core/errors.js",
    "scripts/talk-voice-core/state-machine.js",
    "scripts/talk-voice-core/permissions.js",
    "scripts/talk-voice-core/entitlement.js",
    "scripts/talk-voice-core/usage.js",
    "scripts/talk-voice-core/provider-interface.js",
    "scripts/talk-voice-core/index.js",
  ];
  for (const f of files) {
    vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
  }
  return sandbox;
}

const g = loadCore({ location: { search: "?talkDev=1" } });

// state machine
{
  const SM = g.TasuTalkVoiceStateMachine;
  assert("sm: idle→authorizing", SM.canTransition("idle", "authorizing"));
  assert("sm: idle↛connected", !SM.canTransition("idle", "connected"));
  assert("sm: ended↛connected", !SM.canTransition("ended", "connected"));
  assert("sm: failed↛ringing", !SM.canTransition("failed", "ringing_outgoing"));
  assert("sm: connected↛ringing", !SM.canTransition("connected", "ringing_outgoing"));
  const m = SM.createMachine();
  assert("sm: start idle", m.getState() === "idle");
  assert("sm: go authorizing", m.go("authorizing").ok);
  assert("sm: reject jump", !m.go("connected").ok);
  assert("sm: stay authorizing", m.getState() === "authorizing");
}

// permissions
{
  const P = g.TasuTalkVoicePermissions;
  const thread = {
    id: "room-1",
    partnerUserId: "u_b",
    buyerId: "u_a",
    sellerId: "u_b",
  };
  assert(
    "perm: eligible",
    P.assertCanStartCall({ thread, authUserId: "u_a" }).ok === true
  );
  assert(
    "perm: self-call",
    P.assertCanStartCall({
      thread: { id: "r", partnerUserId: "u_a" },
      authUserId: "u_a",
    }).reason === "self_call"
  );
  assert(
    "perm: group",
    P.assertCanStartCall({
      thread: { id: "g", threadKind: "group", partnerUserId: "u_b" },
      authUserId: "u_a",
    }).ok === false
  );
  assert(
    "perm: blocked",
    P.assertCanStartCall({ thread, authUserId: "u_a", blocked: true }).reason === "blocked"
  );
  assert(
    "perm: missing auth",
    P.assertCanStartCall({ thread, authUserId: "" }).reason === "auth_required"
  );
  assert(
    "perm: session participant",
    P.assertSessionParticipant({ caller_id: "u_a", callee_id: "u_b" }, "u_a").ok
  );
  assert(
    "perm: non-participant",
    !P.assertSessionParticipant({ caller_id: "u_a", callee_id: "u_b" }, "u_x").ok
  );
  assert(
    "perm: signal on ended",
    !P.assertSignalAllowed({ caller_id: "u_a", callee_id: "u_b", status: "ended" }, "u_a", "offer").ok
  );
}

// entitlement
{
  const E = g.TasuTalkVoiceEntitlement;
  const legacy = E.evaluateEntitlement({});
  assert("ent: legacy unmetered allowed", legacy.allowed && legacy.reason === "legacy_unmetered");
  const productionLike = loadCore();
  const productionDefault = productionLike.TasuTalkVoiceEntitlement.evaluateEntitlement({});
  assert(
    "ent: production-like missing config is disabled",
    !productionDefault.allowed && productionDefault.reason === "feature_disabled"
  );
  const hardened = loadCore({
    location: { search: "?talkDev=1" },
    TASU_TALK_CALL_CONFIG: { allowTalkDevFixture: false },
  });
  const hardenedDefault = hardened.TasuTalkVoiceEntitlement.evaluateEntitlement({});
  assert(
    "ent: production assets ignore talkDev fixture bypass",
    !hardenedDefault.allowed && hardenedDefault.reason === "feature_disabled"
  );

  g.TASU_TALK_VOICE_CONFIG = { voice_feature_enabled: false };
  assert("ent: feature disabled", !E.evaluateEntitlement({}).allowed);

  g.TASU_TALK_VOICE_CONFIG = {
    voice_feature_enabled: true,
    voice_entitlement_enforced: true,
  };
  assert(
    "ent: enforced without limits → config unavailable",
    E.evaluateEntitlement({}).reason === "configuration_unavailable"
  );

  g.TASU_TALK_VOICE_CONFIG = {
    voice_feature_enabled: true,
    voice_entitlement_enforced: true,
    daily_free_seconds: 600,
    monthly_free_seconds: 3600,
    max_call_seconds: 1800,
  };
  const ok = E.evaluateEntitlement({ usedDailySeconds: 100, usedMonthlySeconds: 200 });
  assert("ent: eligible", ok.allowed && ok.reason === "eligible");
  assert("ent: session limit min", ok.max_session_seconds === 500);

  const dailyHit = E.evaluateEntitlement({ usedDailySeconds: 600 });
  assert("ent: daily limit", dailyHit.reason === "daily_limit_reached");

  const monthlyHit = E.evaluateEntitlement({ usedDailySeconds: 0, usedMonthlySeconds: 3600 });
  assert("ent: monthly limit", monthlyHit.reason === "monthly_limit_reached");

  assert(
    "ent: active session conflict",
    E.evaluateEntitlement({ activeSessionExists: true }).reason === "active_session_exists"
  );

  delete g.TASU_TALK_VOICE_CONFIG;
}

// usage
{
  const U = g.TasuTalkVoiceUsage;
  const start = "2026-07-26T10:00:00.000Z";
  const end = "2026-07-26T10:01:40.000Z";
  assert("usage: duration 100s", U.computeDurationSeconds({ startedAt: start, endedAt: end }) === 100);
  assert("usage: ignore client duration", U.ignoreClientDuration(9999) === null);
  const stale = U.shouldReconcileDisconnect({
    status: "active",
    lastHeartbeatAt: "2026-07-26T10:00:00.000Z",
    now: "2026-07-26T10:05:00.000Z",
    graceSec: 120,
  });
  assert("usage: stale heartbeat reconcile", stale.ok && stale.reason === "heartbeat_stale");
  const fresh = U.shouldReconcileDisconnect({
    status: "active",
    lastHeartbeatAt: "2026-07-26T10:04:30.000Z",
    now: "2026-07-26T10:05:00.000Z",
    graceSec: 120,
  });
  assert("usage: within grace", !fresh.ok);
}

// provider interface
{
  const I = g.TasuTalkVoiceProviderInterface;
  assert("iface: missing methods", !I.assertAdapter({}).ok);
  const fake = {};
  for (const m of I.REQUIRED_METHODS) fake[m] = () => {};
  assert("iface: complete", I.assertAdapter(fake).ok);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- talk-voice-core Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
