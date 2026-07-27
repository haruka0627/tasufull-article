#!/usr/bin/env node
/**
 * ANPI Phase 47 窶・Live staging verification (no external sends)
 *
 * Requirements covered:
 * - staging-safe execution only (ref must not be production)
 * - external provider calls must not happen (Phase 6 TALK local stub)
 * - verify state transitions + local adapter logs
 * - cleanup fixture users/settings/checks
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runAnpiPhase47NotificationRuntimeCore } from "./lib/anpi-phase47-notification-runtime-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_STAGING = path.join(root, ".env.staging");

const PREFIX = `anpi-p47-live-${Date.now().toString(36)}`;
const PASSWORD = `AnpiP47Live!${Date.now().toString(36)}Aa1`;

const p0 = "2026-07-27T00:01:00.000Z";
const p3 = "2026-07-27T06:01:00.000Z";
const pConfirm = "2026-07-27T07:00:00.000Z";
const localDay1 = "2026-07-27";
const scheduledAtDay1Utc = "2026-07-27T00:00:00.000Z";

function pass(name) {
  console.log(`PASS ${name}`);
}
function fail(name, detail) {
  console.error(`FAIL ${name}`);
  if (detail) console.error(String(detail).slice(0, 800));
}

function parseEnvFile(filePath) {
  const txt = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of txt.split(/\r?\n/g)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    const k = s.slice(0, eq).trim();
    const v = s.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

async function adminFetch(apiUrl, serviceKey, pathname, init = {}) {
  const res = await fetch(`${apiUrl}${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  return { res, json };
}

async function restInsert(apiUrl, serviceKey, table, row) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert ${table} failed: ${res.status}`);
  return Array.isArray(json) ? json[0] : json;
}

async function restPatch(apiUrl, serviceKey, table, filter, patchRow) {
  const { res } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patchRow),
  });
  if (!res.ok) throw new Error(`patch ${table} failed: ${res.status}`);
}

async function restSelect(apiUrl, serviceKey, table, query) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${query}`, { method: "GET" });
  if (!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
  return Array.isArray(json) ? json : [];
}

async function createUser(apiUrl, serviceKey, email) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, "/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { anpi_phase47_live_test: true, prefix: PREFIX },
    }),
  });
  if (!res.ok) throw new Error(`createUser failed: ${res.status}`);
  return json.id;
}

async function deleteUser(apiUrl, serviceKey, userId) {
  if (!userId) return;
  await adminFetch(apiUrl, serviceKey, `/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(() => {});
}

function inFilter(ids) {
  const safe = ids.filter(Boolean);
  if (!safe.length) return null;
  return `(${safe.map((id) => `"${id}"`).join(",")})`;
}

async function cleanup(apiUrl, serviceKey, userIds) {
  const filter = inFilter(userIds);
  if (!filter) return;

  // Delete dependent rows first.
  await adminFetch(apiUrl, serviceKey, `/rest/v1/anpi_notification_deliveries?recipient_user_id=in.${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});

  await adminFetch(apiUrl, serviceKey, `/rest/v1/anpi_scheduler_jobs?or=(subject_user_id.in.${filter},recipient_user_id.in.${filter})`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});

  await adminFetch(apiUrl, serviceKey, `/rest/v1/anpi_check_instances?subject_user_id=in.${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});

  await adminFetch(apiUrl, serviceKey, `/rest/v1/anpi_contacts?or=(owner_user_id.in.${filter},subject_user_id.in.${filter},contact_user_id.in.${filter})`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});

  await adminFetch(apiUrl, serviceKey, `/rest/v1/anpi_settings?or=(owner_user_id.in.${filter},subject_user_id.in.${filter})`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});
}

async function main() {
  const env = parseEnvFile(ENV_STAGING);
  const apiUrl = String(env.SUPABASE_URL || "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!apiUrl || !serviceKey) throw new Error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.staging");

  // Runtime core will assert production guard.
  const workerBase = `anpi-p47-live-worker-${Date.now().toString(36)}`;

  let users = { a: null, c: null };
  try {
    users.a = await createUser(apiUrl, serviceKey, `${PREFIX}-a@example.invalid`);
    users.c = await createUser(apiUrl, serviceKey, `${PREFIX}-c-contact@example.invalid`);
    pass("staging fixture users created");

    // Settings: reminder_count=2, contact_notify_after=6h, initial at 09:00 JST.
    const settings = await restInsert(apiUrl, serviceKey, "anpi_settings", {
      owner_user_id: users.a,
      subject_user_id: users.a,
      timezone: "Asia/Tokyo",
      initial_notification_time: "09:00:00",
      reminder_policy: { interval_minutes: [120, 240] },
      reminder_count: 2,
      contact_notify_after: "06:00:00",
    });

    // Initial tick (creates check + initial candidate; runtime core delivers initial to local stub).
    await runAnpiPhase47NotificationRuntimeCore({
      apiUrl,
      serviceKey,
      pNow: p0,
      workerId: `${workerBase}-p0`,
      stubMode: "success",
    });

    const check = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_check_instances",
      `subject_user_id=eq.${users.a}&local_check_date=eq.${localDay1}&select=id,status,scheduled_at,contact_notified_at,confirmed_at`
    ).then((rows) => rows[0] || null);
    assert.ok(check, "check exists after p0");
    assert.equal(check.status, "notified");

    // Eligible contact inserted before overdue tick at +6h.
    await restInsert(apiUrl, serviceKey, "anpi_contacts", {
      owner_user_id: users.a,
      subject_user_id: users.a,
      contact_user_id: users.c,
      relationship: "relative",
      priority: 1,
      status: "active",
      accepted_at: scheduledAtDay1Utc,
      channel: "talk",
      verification_status: "verified",
      verified_at: scheduledAtDay1Utc,
      consent_status: "accepted",
      consented_at: scheduledAtDay1Utc,
      paused_at: null,
      revoked_at: null,
      deleted_at: null,
    });

    await runAnpiPhase47NotificationRuntimeCore({
      apiUrl,
      serviceKey,
      pNow: p3,
      workerId: `${workerBase}-p3`,
      stubMode: "success",
    });

    const checkAfterContact = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_check_instances",
      `id=eq.${check.id}&select=id,status,contact_notified_at`
    ).then((rows) => rows[0] || null);
    assert.ok(checkAfterContact);
    assert.equal(checkAfterContact.status, "contact_notified");

    // Verify local delivery logs: provider should be talk_local_stub and late_confirmation not delivered yet.
    const deliveredInitial = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.initial&status=eq.delivered&select=id,provider,provider_message_id`
    );
    assert.equal(deliveredInitial.length, 1, "initial delivered once");
    for (const r of deliveredInitial) assert.ok(String(r.provider || "").startsWith("talk_local"));

    const deliveredContact = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.contact_unconfirmed&status=eq.delivered&select=id,provider`
    );
    assert.equal(deliveredContact.length, 1, "contact delivered once");
    for (const r of deliveredContact) assert.ok(String(r.provider || "").startsWith("talk_local"));

    const deliveredLate = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.late_confirmation&status=eq.delivered&select=id`
    );
    assert.equal(deliveredLate.length, 0, "phase47 does not deliver late_confirmation");

    // Simulate late confirmation after contact_notified.
    await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
      status: "confirmed_late",
      confirmed_at: pConfirm,
      confirmation_source: "anpi_ui",
    });

    await runAnpiPhase47NotificationRuntimeCore({
      apiUrl,
      serviceKey,
      pNow: pConfirm,
      workerId: `${workerBase}-pConfirm`,
      stubMode: "success",
    });

    const lateJobs = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_scheduler_jobs",
      `check_id=eq.${check.id}&kind=eq.late_confirmation&select=id,status,recipient_user_id`
    );
    assert.ok(lateJobs.length >= 1, "late_confirmation candidate exists");

    const lateDelivered2 = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.late_confirmation&status=eq.delivered&select=id`
    );
    assert.equal(lateDelivered2.length, 0, "still no late_confirmation deliveries in this phase");

    pass("live staging state transitions + local adapter logs verified");
  } catch (e) {
    fail("live staging verification", e?.stack || e);
    process.exitCode = 1;
  } finally {
    try {
      const userIds = [users.a, users.c].filter(Boolean);
      if (userIds.length) await cleanup(apiUrl, serviceKey, userIds);
      if (users.a) await deleteUser(apiUrl, serviceKey, users.a);
      if (users.c) await deleteUser(apiUrl, serviceKey, users.c);
      pass("fixture cleanup attempted");
    } catch {
      // ignore cleanup failures
    }
  }
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});

