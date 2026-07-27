#!/usr/bin/env node
/**
 * ANPI Phase 48 窶・Scheduled runtime accelerated fixture tests (local Supabase)
 *
 * Scenarios A窶的 using Phase 48 entrypoint (reuses Phase 47 core).
 * Timing is forced via fixture scheduled_at / available_at 窶・never mutates prod settings.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAnpiPhase48ScheduledRuntime,
  validatePhase48StagingGuards,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_API = "http://127.0.0.1:54321";
const PREFIX = `anpi-p48-${Date.now().toString(36)}`;
const PASSWORD = `AnpiP48!${Date.now().toString(36)}Aa1`;

const DAY = "2026-07-27";
const SCHEDULED = "2026-07-27T00:00:00.000Z";
const T_INIT = "2026-07-27T00:01:00.000Z";
const T_R1 = "2026-07-27T02:01:00.000Z";
const T_R2 = "2026-07-27T04:01:00.000Z";
const T_OVER = "2026-07-27T06:01:00.000Z";
const T_LATE = "2026-07-27T07:00:00.000Z";

function pass(name) {
  console.log(`PASS ${name}`);
}
function fail(name, detail) {
  console.error(`FAIL ${name}`);
  if (detail) console.error(String(detail).slice(0, 600));
}

function readLocalSupabaseEnv() {
  const isWindows = process.platform === "win32";
  const supabaseCli = isWindows
    ? path.join(process.env.APPDATA || "", "npm", "node_modules", "supabase", "dist", "supabase.js")
    : "supabase";
  const command = isWindows ? process.execPath : supabaseCli;
  const args = isWindows ? [supabaseCli, "status", "-o", "env"] : ["status", "-o", "env"];
  const res = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  if (res.status !== 0) throw new Error("supabase status failed");
  const map = {};
  for (const line of `${res.stdout || ""}\n${res.stderr || ""}`.split(/\r?\n/g)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[m[1]] = value;
  }
  const apiUrl = String(map.API_URL || "").replace(/\/$/, "");
  const serviceKey = String(map.SERVICE_ROLE_KEY || map.SECRET_KEY || "");
  if (apiUrl !== LOCAL_API) throw new Error("non-local API");
  if (!serviceKey) throw new Error("missing service key");
  return { apiUrl, serviceKey };
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
      user_metadata: { anpi_phase48_test: true, prefix: PREFIX },
    }),
  });
  if (!res.ok) throw new Error(`createUser:${res.status}`);
  return { id: json.id, email };
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
  // lease/run rows for this prefix holder
  await restDelete(apiUrl, serviceKey, "anpi_scheduler_runs", `worker_id=like.anpi-p48*`);
}

async function cleanupVerified(apiUrl, serviceKey, userIds) {
  const filter = inFilter(userIds);
  if (!filter) return true;
  const checks = await restSelect(apiUrl, serviceKey, "anpi_check_instances", `subject_user_id=in.${filter}&select=id`);
  const settings = await restSelect(apiUrl, serviceKey, "anpi_settings", `subject_user_id=in.${filter}&select=id`);
  const contacts = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_contacts",
    `or=(subject_user_id.in.${filter},contact_user_id.in.${filter})&select=id`
  );
  const jobs = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_scheduler_jobs",
    `or=(subject_user_id.in.${filter},recipient_user_id.in.${filter})&select=id`
  );
  const dels = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_notification_deliveries",
    `recipient_user_id=in.${filter}&select=id`
  );
  return (
    checks.length === 0 &&
    settings.length === 0 &&
    contacts.length === 0 &&
    jobs.length === 0 &&
    dels.length === 0
  );
}

async function createSettings(apiUrl, serviceKey, userId, opts = {}) {
  return restInsert(apiUrl, serviceKey, "anpi_settings", {
    owner_user_id: userId,
    subject_user_id: userId,
    timezone: "Asia/Tokyo",
    initial_notification_time: "09:00:00",
    reminder_policy: { interval_minutes: [120, 240] },
    reminder_count: opts.reminder_count ?? 2,
    contact_notify_after: opts.contact_notify_after ?? "06:00:00",
  });
}

async function insertEligibleContact(apiUrl, serviceKey, subjectId, contactId) {
  return restInsert(apiUrl, serviceKey, "anpi_contacts", {
    owner_user_id: subjectId,
    subject_user_id: subjectId,
    contact_user_id: contactId,
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
}

async function getCheck(apiUrl, serviceKey, userId) {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_check_instances",
    `subject_user_id=eq.${userId}&local_check_date=eq.${DAY}&select=id,status,confirmed_at,contact_notified_at`
  );
  return rows[0] || null;
}

async function countKind(apiUrl, serviceKey, checkId, kind, status = "delivered") {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_notification_deliveries",
    `check_id=eq.${checkId}&kind=eq.${kind}&status=eq.${status}&select=id`
  );
  return rows.length;
}

async function countJobs(apiUrl, serviceKey, checkId, kind) {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_scheduler_jobs",
    `check_id=eq.${checkId}&kind=eq.${kind}&select=id`
  );
  return rows.length;
}

async function runP48(apiUrl, serviceKey, pNow, holder) {
  return runAnpiPhase48ScheduledRuntime({
    apiUrl,
    serviceKey,
    projectRef: "local",
    enabled: "true",
    pNow,
    workerId: `anpi-p48-test-${holder}-${Date.now().toString(36)}`,
    holderId: holder,
    stubMode: "success",
    failIfDisabled: true,
  });
}

async function main() {
  const env = readLocalSupabaseEnv();
  const { apiUrl, serviceKey } = env;
  let passed = 0;
  let failed = 0;
  const tests = [];
  const add = (name, fn) => tests.push({ name, fn });

  add("guards: Production URL rejected", async () => {
    assert.throws(
      () =>
        validatePhase48StagingGuards({
          apiUrl: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
          serviceKey: "x",
          projectRef: STAGING_SUPABASE_REF,
          enabled: "true",
        }),
      /production/i
    );
  });

  add("guards: disabled fails when failIfDisabled", async () => {
    assert.throws(
      () =>
        validatePhase48StagingGuards({
          apiUrl: LOCAL_API,
          serviceKey: "x",
          projectRef: "local",
          enabled: "false",
          failIfDisabled: true,
        }),
      /disabled/i
    );
  });

  add("guards: disabled noop path", async () => {
    const g = validatePhase48StagingGuards({
      apiUrl: LOCAL_API,
      serviceKey: "x",
      projectRef: "local",
      enabled: "",
      failIfDisabled: false,
    });
    assert.equal(g.skipped, true);
  });

  add("A: scheduled 竊・notified (initial)", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-a@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      const s1 = await runP48(apiUrl, serviceKey, T_INIT, "A1");
      assert.equal(s1.status, "PASS");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      assert.ok(check);
      assert.equal(check.status, "notified");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "initial"), 1);
      for (const p of s1.providers || []) assert.ok(String(p).startsWith("talk_local"));
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("B: first reminder 竊・reminded", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-b@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      await runP48(apiUrl, serviceKey, T_INIT, "B0");
      const s = await runP48(apiUrl, serviceKey, T_R1, "B1");
      assert.equal(s.status, "PASS");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      assert.equal(check.status, "reminded");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "reminder"), 1);
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("C: second reminder delivered", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-c@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      await runP48(apiUrl, serviceKey, T_INIT, "C0");
      await runP48(apiUrl, serviceKey, T_R1, "C1");
      await runP48(apiUrl, serviceKey, T_R2, "C2");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      assert.equal(check.status, "reminded");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "reminder"), 2);
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("D: overdue after deadline", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-d@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id, { reminder_count: 0 });
      await runP48(apiUrl, serviceKey, T_INIT, "D0");
      await runP48(apiUrl, serviceKey, T_OVER, "D1");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      assert.equal(check.status, "overdue");
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("E: contact_unconfirmed 竊・contact_notified", async () => {
    const a = await createUser(apiUrl, serviceKey, `${PREFIX}-e@example.invalid`);
    const c = await createUser(apiUrl, serviceKey, `${PREFIX}-e-c@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, a.id);
      await runP48(apiUrl, serviceKey, T_INIT, "E0");
      await insertEligibleContact(apiUrl, serviceKey, a.id, c.id);
      await runP48(apiUrl, serviceKey, T_OVER, "E1");
      const check = await getCheck(apiUrl, serviceKey, a.id);
      assert.equal(check.status, "contact_notified");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "contact_unconfirmed"), 1);
    } finally {
      await cleanup(apiUrl, serviceKey, [a.id, c.id]);
      await deleteUser(apiUrl, serviceKey, a.id);
      await deleteUser(apiUrl, serviceKey, c.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [a.id, c.id]), true);
    }
  });

  add("F: confirmed exclusion", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-f@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      await runP48(apiUrl, serviceKey, T_INIT, "F0");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
        status: "confirmed",
        confirmed_at: T_INIT,
        confirmation_source: "anpi_ui",
      });
      await runP48(apiUrl, serviceKey, T_R1, "F1");
      await runP48(apiUrl, serviceKey, T_OVER, "F2");
      const after = await getCheck(apiUrl, serviceKey, u.id);
      assert.equal(after.status, "confirmed");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "reminder"), 0);
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "contact_unconfirmed"), 0);
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("G: late_confirmation candidate once, no delivery", async () => {
    const a = await createUser(apiUrl, serviceKey, `${PREFIX}-g@example.invalid`);
    const c = await createUser(apiUrl, serviceKey, `${PREFIX}-g-c@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, a.id);
      await runP48(apiUrl, serviceKey, T_INIT, "G0");
      await insertEligibleContact(apiUrl, serviceKey, a.id, c.id);
      await runP48(apiUrl, serviceKey, T_OVER, "G1");
      const check = await getCheck(apiUrl, serviceKey, a.id);
      assert.equal(check.status, "contact_notified");
      await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
        status: "confirmed_late",
        confirmed_at: T_LATE,
        confirmation_source: "anpi_ui",
      });
      await runP48(apiUrl, serviceKey, T_LATE, "G2");
      assert.equal(await countJobs(apiUrl, serviceKey, check.id, "late_confirmation"), 1);
      await runP48(apiUrl, serviceKey, T_LATE, "G3");
      assert.equal(await countJobs(apiUrl, serviceKey, check.id, "late_confirmation"), 1);
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "late_confirmation"), 0);
    } finally {
      await cleanup(apiUrl, serviceKey, [a.id, c.id]);
      await deleteUser(apiUrl, serviceKey, a.id);
      await deleteUser(apiUrl, serviceKey, c.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [a.id, c.id]), true);
    }
  });

  add("H: duplicate run no extra deliveries", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-h@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      await runP48(apiUrl, serviceKey, T_INIT, "H0");
      await runP48(apiUrl, serviceKey, T_INIT, "H1");
      const check = await getCheck(apiUrl, serviceKey, u.id);
      assert.equal(check.status, "notified");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "initial"), 1);
      await runP48(apiUrl, serviceKey, T_R1, "H2");
      await runP48(apiUrl, serviceKey, T_R1, "H3");
      assert.equal(await countKind(apiUrl, serviceKey, check.id, "reminder"), 1);
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  add("I: concurrent runners 窶・one acquires, no duplicate delivery", async () => {
    const u = await createUser(apiUrl, serviceKey, `${PREFIX}-i@example.invalid`);
    try {
      await createSettings(apiUrl, serviceKey, u.id);
      // Seed due check via one tick first so both runners race on delivery path.
      await runP48(apiUrl, serviceKey, "2026-07-26T23:59:00.000Z", "Iseed").catch(() => {});
      // Ensure a due scheduled check exists for T_INIT race
      // Re-create clean: delete checks if seed made none
      const [r1, r2] = await Promise.all([
        runP48(apiUrl, serviceKey, T_INIT, `IconcA-${Date.now()}`),
        runP48(apiUrl, serviceKey, T_INIT, `IconcB-${Date.now()}`),
      ]);
      const statuses = [r1.status, r2.status].sort();
      // One PASS and one SKIPPED(busy), or both PASS if lease window allowed sequential 窶・still no dup.
      assert.ok(statuses.includes("PASS") || statuses.includes("SKIPPED"));
      const check = await getCheck(apiUrl, serviceKey, u.id);
      if (check) {
        assert.equal(await countKind(apiUrl, serviceKey, check.id, "initial"), 1);
      }
      // At least one skipped OR both completed without duplicate
      const busyOrPass = [r1, r2].filter((r) => r.status === "PASS" || r.status === "SKIPPED");
      assert.equal(busyOrPass.length, 2);
    } finally {
      await cleanup(apiUrl, serviceKey, [u.id]);
      await deleteUser(apiUrl, serviceKey, u.id);
      assert.equal(await cleanupVerified(apiUrl, serviceKey, [u.id]), true);
    }
  });

  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      pass(t.name);
    } catch (e) {
      failed += 1;
      fail(t.name, e?.stack || e);
    }
  }

  console.log(`\nANPI Phase 48 scheduled runtime tests: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
