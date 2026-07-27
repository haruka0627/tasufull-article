/**
 * ANPI Phase 43 — unit tests for RPC client mappers / error normalization.
 * Run: node scripts/test-anpi-phase43-rpc-client.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "anpi-rpc-client.js"), "utf8");

const sandbox = { window: {}, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const Api = sandbox.window.TasuAnpiRpc;
assert.ok(Api, "TasuAnpiRpc exported");

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

check("normalizeTime", () => {
  assert.equal(Api.normalizeTime("08:30"), "08:30:00");
  assert.equal(Api.normalizeTime("09:15:00"), "09:15:00");
});

check("hoursToInterval / intervalToHours", () => {
  assert.equal(Api.hoursToInterval(2), "2 hours");
  assert.equal(Api.hoursToInterval(0.5), "30 minutes");
  assert.equal(Api.intervalToHours("02:00:00"), 2);
  assert.equal(Api.intervalToHours("2 hours"), 2);
});

check("error kinds", () => {
  assert.equal(Api.normalizeError({ message: "anpi_auth_required", status: 401 }).kind, "UNAUTHENTICATED");
  assert.equal(Api.normalizeError({ message: "anpi_check_not_accessible", status: 403 }).kind, "FORBIDDEN");
  assert.equal(Api.normalizeError({ message: "anpi_contact_duplicate", status: 409 }).kind, "CONFLICT");
  assert.equal(Api.normalizeError({ message: "anpi_invalid_schedule_type", status: 400 }).kind, "VALIDATION");
  assert.equal(Api.normalizeError({ message: "Failed to fetch" }).kind, "NETWORK");
  assert.equal(Api.normalizeError({ status: 500, message: "boom" }).kind, "SERVER");
  assert.ok(!Api.normalizeError({ message: "anpi_invalid_x" }).userMessage.includes("anpi_invalid"));
});

check("hasSettingsRow", () => {
  assert.equal(Api.hasSettingsRow(null), false);
  assert.equal(Api.hasSettingsRow({}), false);
  assert.equal(Api.hasSettingsRow({ id: "x" }), true);
});

check("mapCheckStatus", () => {
  assert.equal(Api.mapCheckStatus(null).key, "none");
  assert.equal(Api.mapCheckStatus({ status: "scheduled" }).key, "pending");
  assert.equal(Api.mapCheckStatus({ status: "confirmed" }).key, "confirmed");
});

check("no service_role string in client source", () => {
  const text = fs.readFileSync(path.join(root, "anpi-rpc-client.js"), "utf8");
  assert.equal(/service_role/i.test(text) && /SUPABASE_SERVICE/i.test(text), false);
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\./);
});

{
  let calls = 0;
  sandbox.window.__ANPI_RPC_MOCK__ = {
    async rpc(name) {
      calls += 1;
      if (name === "anpi_upsert_my_settings") {
        await new Promise((r) => setTimeout(r, 30));
        return { ok: true, data: { id: "s1", enabled: true, initial_notification_time: "08:00:00" } };
      }
      return { ok: true, data: null };
    },
  };
  const p1 = Api.upsertMySettings({
    enabled: true,
    schedule_type: "daily",
    weekdays: [1],
    initial_notification_time: "08:00",
    reminder_count: 1,
    contact_notify_after_hours: 2,
  });
  const p2 = Api.upsertMySettings({
    enabled: true,
    schedule_type: "daily",
    weekdays: [1],
    initial_notification_time: "08:00",
    reminder_count: 1,
    contact_notify_after_hours: 2,
  });
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  assert.equal(b.error.kind, "CONFLICT");
  assert.equal(calls, 1);
  pass += 1;
  console.log("PASS mock upsert + double-submit style singleFlight");
}

{
  sandbox.window.__ANPI_RPC_MOCK__ = {
    async rpc() {
      return { ok: true, data: { check_id: "c1", status: "confirmed", duplicate: true } };
    },
  };
  const res = await Api.confirmCheck("c1");
  assert.equal(res.ok, true);
  assert.equal(res.alreadyConfirmed, true);
  pass += 1;
  console.log("PASS confirm alreadyConfirmed");
}

console.log(`\nPASS ${pass} checks`);
