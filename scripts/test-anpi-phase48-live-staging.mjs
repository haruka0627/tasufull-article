#!/usr/bin/env node
/**
 * ANPI Phase 48 — Live staging scheduled runtime verification
 *
 * Uses .env.staging (staging ref only). External providers must not appear.
 * Fixture cleanup is verified (0 remaining rows for fixture users).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAnpiPhase48ScheduledRuntime,
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_STAGING = path.join(root, ".env.staging");
const PREFIX = `anpi-p48-live-${Date.now().toString(36)}`;
const PASSWORD = `AnpiP48Live!${Date.now().toString(36)}Aa1`;

const DAY = "2026-07-27";
const SCHEDULED = "2026-07-27T00:00:00.000Z";
const T_INIT = "2026-07-27T00:01:00.000Z";
const T_OVER = "2026-07-27T06:01:00.000Z";
const T_LATE = "2026-07-27T07:00:00.000Z";

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
    out[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
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
  if (!res.ok) throw new Error(`insert ${table}:${res.status}`);
  return Array.isArray(json) ? json[0] : json;
}

async function restPatch(apiUrl, serviceKey, table, filter, patch) {
  const { res } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${table}:${res.status}`);
}

async function restSelect(apiUrl, serviceKey, table, query) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${query}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`select ${table}:${res.status}`);
  return Array.isArray(json) ? json : [];
}

async function restDelete(apiUrl, serviceKey, table, query) {
  await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});
}

async function createUser(apiUrl, serviceKey, email) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, "/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { anpi_phase48_live: true, prefix: PREFIX },
    }),
  });
  if (!res.ok) throw new Error(`createUser:${res.status}`);
  return json.id;
}

async function deleteUser(apiUrl, serviceKey, userId) {
  if (!userId) return;
  await adminFetch(apiUrl, serviceKey, `/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(
    () => {}
  );
}

function inFilter(ids) {
  const safe = ids.filter(Boolean);
  if (!safe.length) return null;
  return `(${safe.map((id) => `"${id}"`).join(",")})`;
}

async function cleanup(apiUrl, serviceKey, userIds) {
  const filter = inFilter(userIds);
  if (!filter) return;
  await restDelete(apiUrl, serviceKey, "anpi_notification_deliveries", `recipient_user_id=in.${filter}`);
  await restDelete(
    apiUrl,
    serviceKey,
    "anpi_scheduler_jobs",
    `or=(subject_user_id.in.${filter},recipient_user_id.in.${filter})`
  );
  await restDelete(apiUrl, serviceKey, "anpi_check_instances", `subject_user_id=in.${filter}`);
  await restDelete(
    apiUrl,
    serviceKey,
    "anpi_contacts",
    `or=(owner_user_id.in.${filter},subject_user_id.in.${filter},contact_user_id.in.${filter})`
  );
  await restDelete(
    apiUrl,
    serviceKey,
    "anpi_settings",
    `or=(owner_user_id.in.${filter},subject_user_id.in.${filter})`
  );
  await restDelete(apiUrl, serviceKey, "anpi_scheduler_runs", `worker_id=like.anpi-p48*`);
}

async function cleanupVerified(apiUrl, serviceKey, userIds) {
  const filter = inFilter(userIds);
  if (!filter) return true;
  const tables = [
    ["anpi_check_instances", `subject_user_id=in.${filter}&select=id`],
    ["anpi_settings", `subject_user_id=in.${filter}&select=id`],
    ["anpi_contacts", `or=(subject_user_id.in.${filter},contact_user_id.in.${filter})&select=id`],
    [
      "anpi_scheduler_jobs",
      `or=(subject_user_id.in.${filter},recipient_user_id.in.${filter})&select=id`,
    ],
    ["anpi_notification_deliveries", `recipient_user_id=in.${filter}&select=id`],
  ];
  for (const [table, q] of tables) {
    const rows = await restSelect(apiUrl, serviceKey, table, q);
    if (rows.length) return false;
  }
  return true;
}

async function main() {
  const fileEnv = parseEnvFile(ENV_STAGING);
  const apiUrl = String(fileEnv.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(fileEnv.SUPABASE_SERVICE_ROLE_KEY || "");
  const projectRef = String(fileEnv.SUPABASE_PROJECT_REF || STAGING_SUPABASE_REF);

  assert.ok(apiUrl && serviceKey, "missing staging URL/key");
  assert.ok(!apiUrl.includes(PRODUCTION_SUPABASE_REF), "production URL forbidden");
  assert.equal(projectRef, STAGING_SUPABASE_REF);

  const users = { a: null, c: null };
  let cleanupOk = false;

  try {
    users.a = await createUser(apiUrl, serviceKey, `${PREFIX}-a@example.invalid`);
    users.c = await createUser(apiUrl, serviceKey, `${PREFIX}-c@example.invalid`);
    pass("staging fixture users created");

    await restInsert(apiUrl, serviceKey, "anpi_settings", {
      owner_user_id: users.a,
      subject_user_id: users.a,
      timezone: "Asia/Tokyo",
      initial_notification_time: "09:00:00",
      reminder_policy: { interval_minutes: [120, 240] },
      reminder_count: 2,
      contact_notify_after: "06:00:00",
    });

    const s0 = await runAnpiPhase48ScheduledRuntime({
      apiUrl,
      serviceKey,
      projectRef: STAGING_SUPABASE_REF,
      enabled: "true",
      pNow: T_INIT,
      workerId: `anpi-p48-live-${Date.now().toString(36)}`,
      holderId: `live-${Date.now().toString(36)}`,
      stubMode: "success",
    });
    assert.equal(s0.status, "PASS");
    assert.equal(s0.provider_validation, "PASS");
    for (const p of s0.providers || []) assert.ok(String(p).startsWith("talk_local"));

    const check = (
      await restSelect(
        apiUrl,
        serviceKey,
        "anpi_check_instances",
        `subject_user_id=eq.${users.a}&local_check_date=eq.${DAY}&select=id,status`
      )
    )[0];
    assert.ok(check);
    assert.equal(check.status, "notified");

    await restInsert(apiUrl, serviceKey, "anpi_contacts", {
      owner_user_id: users.a,
      subject_user_id: users.a,
      contact_user_id: users.c,
      relationship: "relative",
      priority: 1,
      status: "active",
      accepted_at: SCHEDULED,
      channel: "talk",
      verification_status: "verified",
      verified_at: SCHEDULED,
      consent_status: "accepted",
      consented_at: SCHEDULED,
    });

    const s1 = await runAnpiPhase48ScheduledRuntime({
      apiUrl,
      serviceKey,
      projectRef: STAGING_SUPABASE_REF,
      enabled: "true",
      pNow: T_OVER,
      workerId: `anpi-p48-live-over-${Date.now().toString(36)}`,
      holderId: `live-over-${Date.now().toString(36)}`,
      stubMode: "success",
    });
    assert.equal(s1.status, "PASS");

    const after = (
      await restSelect(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}&select=id,status`)
    )[0];
    assert.equal(after.status, "contact_notified");

    await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
      status: "confirmed_late",
      confirmed_at: T_LATE,
      confirmation_source: "anpi_ui",
    });

    const s2 = await runAnpiPhase48ScheduledRuntime({
      apiUrl,
      serviceKey,
      projectRef: STAGING_SUPABASE_REF,
      enabled: "true",
      pNow: T_LATE,
      workerId: `anpi-p48-live-late-${Date.now().toString(36)}`,
      holderId: `live-late-${Date.now().toString(36)}`,
      stubMode: "success",
    });
    assert.equal(s2.status, "PASS");

    const lateJobs = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_scheduler_jobs",
      `check_id=eq.${check.id}&kind=eq.late_confirmation&select=id`
    );
    assert.ok(lateJobs.length >= 1);

    const lateDel = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.late_confirmation&status=eq.delivered&select=id`
    );
    assert.equal(lateDel.length, 0);

    // Duplicate scheduled run should not fail or double-deliver contact
    const s3 = await runAnpiPhase48ScheduledRuntime({
      apiUrl,
      serviceKey,
      projectRef: STAGING_SUPABASE_REF,
      enabled: "true",
      pNow: T_LATE,
      workerId: `anpi-p48-live-dup-${Date.now().toString(36)}`,
      holderId: `live-dup-${Date.now().toString(36)}`,
      stubMode: "success",
    });
    assert.ok(s3.status === "PASS" || s3.status === "SKIPPED");

    const contactDel = await restSelect(
      apiUrl,
      serviceKey,
      "anpi_notification_deliveries",
      `check_id=eq.${check.id}&kind=eq.contact_unconfirmed&status=eq.delivered&select=id,provider`
    );
    assert.equal(contactDel.length, 1);
    assert.ok(String(contactDel[0].provider || "").startsWith("talk_local"));

    pass("live staging scheduled runtime + provider validation");
  } catch (e) {
    fail("live staging verification", e?.stack || e);
    process.exitCode = 1;
  } finally {
    try {
      const ids = [users.a, users.c].filter(Boolean);
      await cleanup(apiUrl, serviceKey, ids);
      await deleteUser(apiUrl, serviceKey, users.a);
      await deleteUser(apiUrl, serviceKey, users.c);
      cleanupOk = await cleanupVerified(apiUrl, serviceKey, ids);
      if (cleanupOk) pass("cleanup verified");
      else fail("cleanup verified", "fixture rows remain");
    } catch (e) {
      fail("cleanup verified", e?.message || e);
      cleanupOk = false;
    }
  }

  if (!cleanupOk) process.exitCode = 1;
  console.log(`\nANPI Phase 48 live staging: cleanupVerified=${cleanupOk ? "YES" : "NO"}`);
  process.exit(process.exitCode ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e?.message || e).slice(0, 300));
  process.exit(1);
});
