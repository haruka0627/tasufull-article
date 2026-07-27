#!/usr/bin/env node
/**
 * ANPI Phase 47 窶・Notification Runtime Core unit tests (local Supabase)
 *
 * Verification scope (staging-safe simulation only):
 * - daily check creation + same-day de-duplication
 * - initial notification + local delivery logging
 * - +2h reminder / +4h reminder + reminded state reflection
 * - max notifications (initial + reminder*2)
 * - confirmed stop (no further reminders)
 * - paused/cancelled stop (no initial jobs)
 * - overdue (no eligible contacts keeps overdue)
 * - contact notification for eligible contacts (overdue 竊・contact_notified)
 * - unverified / inactive contacts excluded from contact notifications
 * - confirmed_late 竊・late_confirmation candidate generation (candidate only)
 * - idempotency: repeated runs do not double-deliver
 * - timezone/date boundaries: local_check_date uses Asia/Tokyo
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAnpiPhase47NotificationRuntimeCore } from "./lib/anpi-phase47-notification-runtime-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_API = "http://127.0.0.1:54321";

const PREFIX = `anpi-p47-test-${Date.now().toString(36)}`;
const PASSWORD = `AnpiP47!${Date.now().toString(36)}Aa1`;

// Tokyo schedule:
// - initial_notification_time = 09:00 JST (UTC 00:00)
// - reminders at +2h/+4h from scheduled_at
// - contact_notify_after = 06:00 after scheduled_at (emergency contact at +6h)
const p0 = "2026-07-27T00:01:00.000Z"; // 09:01 JST
const p1 = "2026-07-27T02:01:00.000Z"; // 11:01 JST
const p2 = "2026-07-27T04:01:00.000Z"; // 13:01 JST
const p3 = "2026-07-27T06:01:00.000Z"; // 15:01 JST
const pConfirm = "2026-07-27T07:00:00.000Z"; // 16:00 JST
const pNextDay = "2026-07-28T00:01:00.000Z"; // next day 09:01 JST

const localDay1 = "2026-07-27";
const localDay2 = "2026-07-28";
const scheduledAtDay1Utc = "2026-07-27T00:00:00.000Z";

function pass(name) {
  console.log(`PASS ${name}`);
}
function fail(name, detail) {
  console.error(`FAIL ${name}`);
  if (detail) console.error(String(detail).slice(0, 500));
}

function readLocalSupabaseEnv() {
  const isWindows = process.platform === "win32";
  // Match existing test style: use appdata supabase dist on Windows.
  const supabaseCli = isWindows
    ? path.join(process.env.APPDATA || "", "npm", "node_modules", "supabase", "dist", "supabase.js")
    : "supabase";
  const command = isWindows ? process.execPath : supabaseCli;
  const args = isWindows ? [supabaseCli, "status", "-o", "env"] : ["status", "-o", "env"];
  const res = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  if (res.status !== 0) throw new Error("supabase status -o env failed");

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
  const anonKey = String(map.ANON_KEY || "");
  if (apiUrl !== LOCAL_API) {
    throw new Error(`non-local API: expected ${LOCAL_API} got ${apiUrl}`);
  }
  if (!serviceKey) throw new Error("missing service role key");
  return { apiUrl, serviceKey, anonKey };
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

async function rpc(apiUrl, serviceKey, name, args) {
  const { res, json } = await adminFetch(apiUrl, serviceKey, `/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) throw new Error(`rpc ${name} failed: ${res.status}`);
  return json;
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
  const { res, json } = await adminFetch(apiUrl, serviceKey, `/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: { Prefer: "return=representation" },
  });
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
      user_metadata: { anpi_phase47_test: true, prefix: PREFIX },
    }),
  });
  if (!res.ok) throw new Error(`createUser failed: ${res.status}`);
  return { id: json.id, email };
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

  // Delete dependent rows first (no delete cascades are guaranteed).
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

  await adminFetch(
    apiUrl,
    serviceKey,
    `/rest/v1/anpi_contacts?or=(owner_user_id.in.${filter},subject_user_id.in.${filter},contact_user_id.in.${filter})`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  ).catch(() => {});

  await adminFetch(
    apiUrl,
    serviceKey,
    `/rest/v1/anpi_settings?or=(owner_user_id.in.${filter},subject_user_id.in.${filter})`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  ).catch(() => {});
}

async function createSettings(apiUrl, serviceKey, subjectUserId, { reminder_count, contact_notify_after }) {
  const row = {
    owner_user_id: subjectUserId,
    subject_user_id: subjectUserId,
    timezone: "Asia/Tokyo",
    initial_notification_time: "09:00:00",
    reminder_policy: { interval_minutes: [120, 240] },
    reminder_count,
    contact_notify_after,
  };
  const created = await restInsert(apiUrl, serviceKey, "anpi_settings", row);
  return created;
}

async function insertContact(apiUrl, serviceKey, subjectUserId, contactUserId, variant) {
  const now = p0; // any deterministic timestamp
  const row = {
    owner_user_id: subjectUserId,
    subject_user_id: subjectUserId,
    contact_user_id: contactUserId,
    relationship: "relative",
    priority: 1,
    status: "active",
    accepted_at: now,
    channel: "talk",
    verification_status: "verified",
    verified_at: now,
    consent_status: "accepted",
    consented_at: now,
    paused_at: null,
    revoked_at: null,
    deleted_at: null,
  };

  if (variant === "unverified") {
    // Phase 5 derives TALK verification from consent acceptance only when
    // verification_status is 'unverified'/'pending'. Use a non-verified
    // terminal-like value that avoids the backfill.
    row.verification_status = "failed";
    row.verified_at = null;
  } else if (variant === "inactive") {
    row.status = "pending";
  } else {
    assert.equal(variant, "eligible");
  }

  return restInsert(apiUrl, serviceKey, "anpi_contacts", row);
}

async function getCheck(apiUrl, serviceKey, subjectUserId, localCheckDate) {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_check_instances",
    `subject_user_id=eq.${subjectUserId}&local_check_date=eq.${localCheckDate}&select=id,status,scheduled_at,first_notified_at,last_reminded_at,overdue_at,contact_notified_at,confirmed_at,timezone,setting_id`
  );
  return rows[0] || null;
}

async function countDeliveries(apiUrl, serviceKey, { checkId, kind, status }) {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_notification_deliveries",
    `check_id=eq.${checkId}&kind=eq.${kind}` + (status ? `&status=eq.${status}` : "") + `&select=id,attempt_number`
  );
  return Array.isArray(rows) ? rows.length : 0;
}

async function getDeliveries(apiUrl, serviceKey, { checkId, kind, status }) {
  return restSelect(
    apiUrl,
    serviceKey,
    "anpi_notification_deliveries",
    `check_id=eq.${checkId}&kind=eq.${kind}` + (status ? `&status=eq.${status}` : "") + `&select=id,attempt_number,recipient_user_id,contact_id,idempotency_key,delivered_at,created_at`
  );
}

async function getJobs(apiUrl, serviceKey, { checkId, kind }) {
  return restSelect(
    apiUrl,
    serviceKey,
    "anpi_scheduler_jobs",
    `check_id=eq.${checkId}&kind=eq.${kind}&select=id,status,available_at,attempt_count,recipient_user_id,contact_id`
  );
}

async function runCore(apiUrl, serviceKey, pNow, workerIdSuffix) {
  const workerId = `anpi-p47-test-${workerIdSuffix}-${Date.now().toString(36)}`;
  const res = await runAnpiPhase47NotificationRuntimeCore({
    apiUrl,
    serviceKey,
    pNow,
    workerId,
    stubMode: "success",
  });
  return res;
}

async function main() {
  const env = readLocalSupabaseEnv();
  assert.equal(env.apiUrl, LOCAL_API);
  let tests = [];

  const add = (name, fn) => tests.push({ name, fn });

  add("蠖捺律逕滓・ + 蜷梧律驥崎､・亟豁｢ + initial delivery", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-a@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });

      await runCore(apiUrl, serviceKey, p0, "t0");
      await runCore(apiUrl, serviceKey, p0, "t0-repeat");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check, "check created");
      assert.equal(check.status, "notified");

      const checkCount = (await restSelect(apiUrl, serviceKey, "anpi_check_instances", `subject_user_id=eq.${users.a.id}&local_check_date=eq.${localDay1}&select=id`)).length;
      assert.equal(checkCount, 1, "no same-day duplicate check");

      const initialDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "initial", status: "delivered" });
      assert.equal(initialDelivered, 1, "initial delivered once");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("+2h reminder / reminded state reflection", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-b@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "r1-init");
      await runCore(apiUrl, serviceKey, p1, "r1-rem1");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "reminded");

      const reminderDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "reminder", status: "delivered" });
      assert.equal(reminderDelivered, 1, "only reminder1 delivered at +2h");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("+4h reminder / max 2 reminders (initial + reminder*2)", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-c@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "r2-init");
      await runCore(apiUrl, serviceKey, p1, "r2-rem1");
      await runCore(apiUrl, serviceKey, p2, "r2-rem2");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "reminded");

      const reminderDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "reminder", status: "delivered" });
      assert.equal(reminderDelivered, 2, "reminder1+reminder2 delivered");

      await runCore(apiUrl, serviceKey, p2, "r2-repeat");
      const reminderDeliveredAfterRepeat = await countDeliveries(apiUrl, serviceKey, {
        checkId: check.id,
        kind: "reminder",
        status: "delivered",
      });
      assert.equal(reminderDeliveredAfterRepeat, 2, "idempotency: no extra reminder delivered");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("confirmed stop (譛ｬ莠ｺconfirm竊剃ｻ･髯埼夂衍縺ｪ縺・", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-d@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "conf-stop-init");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);

      // Simulate "譛ｬ莠ｺ confirmed" by setting status to confirmed with required fields.
      await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
        status: "confirmed",
        confirmed_at: p0,
        confirmation_source: "anpi_ui",
        confirmed_late_at: null,
      }).catch(async () => {
        // If patch fails due to extra fields, retry with minimal patch.
        await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
          status: "confirmed",
          confirmed_at: p0,
          confirmation_source: "anpi_ui",
        });
      });

      await runCore(apiUrl, serviceKey, p1, "conf-stop-rem1");
      await runCore(apiUrl, serviceKey, p2, "conf-stop-rem2");

      const reminderDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "reminder", status: "delivered" });
      assert.equal(reminderDelivered, 0, "no reminder deliveries after confirmed");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("paused stop (paused繝√ぉ繝・け縺ｯ騾夂衍縺輔ｌ縺ｪ縺・", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-e@example.invalid`) };
    let checkId = null;
    try {
      const settings = await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });

      const check = await restInsert(apiUrl, serviceKey, "anpi_check_instances", {
        setting_id: settings.id,
        owner_user_id: users.a.id,
        subject_user_id: users.a.id,
        local_check_date: localDay1,
        timezone: "Asia/Tokyo",
        scheduled_at: scheduledAtDay1Utc,
        status: "paused",
      });
      checkId = check.id;

      await runCore(apiUrl, serviceKey, p0, "paused-stop");

      const initialDelivered = await countDeliveries(apiUrl, serviceKey, { checkId, kind: "initial", status: "delivered" });
      const reminderDelivered = await countDeliveries(apiUrl, serviceKey, { checkId, kind: "reminder", status: "delivered" });
      assert.equal(initialDelivered, 0);
      assert.equal(reminderDelivered, 0);
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("cancelled stop (cancelled繝√ぉ繝・け縺ｯ騾夂衍縺輔ｌ縺ｪ縺・", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-f@example.invalid`) };
    let checkId = null;
    try {
      const settings = await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });

      const check = await restInsert(apiUrl, serviceKey, "anpi_check_instances", {
        setting_id: settings.id,
        owner_user_id: users.a.id,
        subject_user_id: users.a.id,
        local_check_date: localDay1,
        timezone: "Asia/Tokyo",
        scheduled_at: scheduledAtDay1Utc,
        status: "cancelled",
        cancelled_at: p0,
      });
      checkId = check.id;

      await runCore(apiUrl, serviceKey, p0, "cancelled-stop");

      const initialDelivered = await countDeliveries(apiUrl, serviceKey, { checkId, kind: "initial", status: "delivered" });
      const reminderDelivered = await countDeliveries(apiUrl, serviceKey, { checkId, kind: "reminder", status: "delivered" });
      assert.equal(initialDelivered, 0);
      assert.equal(reminderDelivered, 0);
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("overdue (no eligible contacts keeps overdue)", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-g@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 0, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "overdue-init");
      await runCore(apiUrl, serviceKey, p3, "overdue-p3");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "overdue");

      const contactDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "contact_unconfirmed", status: "delivered" });
      assert.equal(contactDelivered, 0, "no contact delivery without eligible contacts");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  add("contact騾夂衍・・verdue竊団ontact_notified・議ontact delivery・・, async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = {
      a: await createUser(apiUrl, serviceKey, `${PREFIX}-h@example.invalid`),
      c: await createUser(apiUrl, serviceKey, `${PREFIX}-h-contact@example.invalid`),
    };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "contact-init");

      await insertContact(apiUrl, serviceKey, users.a.id, users.c.id, "eligible");
      await runCore(apiUrl, serviceKey, p3, "contact-p3");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "contact_notified");

      const contactDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "contact_unconfirmed", status: "delivered" });
      assert.equal(contactDelivered, 1, "contact_unconfirmed delivered once");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id, users.c.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
      await deleteUser(apiUrl, serviceKey, users.c.id);
    }
  });

  add("譛ｪ謇ｿ隱埼｣邨｡蜈磯勁螟厄ｼ・erification譛ｪ驕披・contact騾夂衍縺ｪ縺暦ｼ・, async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = {
      a: await createUser(apiUrl, serviceKey, `${PREFIX}-i@example.invalid`),
      c: await createUser(apiUrl, serviceKey, `${PREFIX}-i-contact@example.invalid`),
    };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 0, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "unverified-init");

      await insertContact(apiUrl, serviceKey, users.a.id, users.c.id, "unverified");
      await runCore(apiUrl, serviceKey, p3, "unverified-p3");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "overdue", "still overdue");

      const contactDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "contact_unconfirmed", status: "delivered" });
      assert.equal(contactDelivered, 0, "no contact delivery");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id, users.c.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
      await deleteUser(apiUrl, serviceKey, users.c.id);
    }
  });

  add("inactive騾｣邨｡蜈磯勁螟厄ｼ・tatus髯､螟問・contact騾夂衍縺ｪ縺暦ｼ・, async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = {
      a: await createUser(apiUrl, serviceKey, `${PREFIX}-j@example.invalid`),
      c: await createUser(apiUrl, serviceKey, `${PREFIX}-j-contact@example.invalid`),
    };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 0, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "inactive-init");

      await insertContact(apiUrl, serviceKey, users.a.id, users.c.id, "inactive");
      await runCore(apiUrl, serviceKey, p3, "inactive-p3");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "overdue", "still overdue");

      const contactDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "contact_unconfirmed", status: "delivered" });
      assert.equal(contactDelivered, 0, "no contact delivery");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id, users.c.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
      await deleteUser(apiUrl, serviceKey, users.c.id);
    }
  });

  add("confirmed_late 竊・螳御ｺ・夂衍蛟呵｣懶ｼ・ate_confirmation・・ 驥崎､・亟豁｢ + no delivery in phase47", async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = {
      a: await createUser(apiUrl, serviceKey, `${PREFIX}-k@example.invalid`),
      c: await createUser(apiUrl, serviceKey, `${PREFIX}-k-contact@example.invalid`),
    };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 2, contact_notify_after: "06:00:00" });
      await runCore(apiUrl, serviceKey, p0, "late-init");
      await insertContact(apiUrl, serviceKey, users.a.id, users.c.id, "eligible");
      await runCore(apiUrl, serviceKey, p3, "late-contact-delivery");

      const check = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      assert.ok(check);
      assert.equal(check.status, "contact_notified");

      // Simulate user confirmation after contact notification.
      await restPatch(apiUrl, serviceKey, "anpi_check_instances", `id=eq.${check.id}`, {
        status: "confirmed_late",
        confirmed_at: pConfirm,
        confirmation_source: "anpi_ui",
      });

      const beforeJobs = await getJobs(apiUrl, serviceKey, { checkId: check.id, kind: "late_confirmation" });
      assert.equal(beforeJobs.length, 0, "no late jobs before runtime pConfirm");

      await runCore(apiUrl, serviceKey, pConfirm, "late-cand1");

      const jobs1 = await getJobs(apiUrl, serviceKey, { checkId: check.id, kind: "late_confirmation" });
      assert.ok(jobs1.length >= 1, "late_confirmation job created");

      const lateDelivered = await countDeliveries(apiUrl, serviceKey, { checkId: check.id, kind: "late_confirmation", status: "delivered" });
      assert.equal(lateDelivered, 0, "phase47 runtime core does not deliver late_confirmation");

      await runCore(apiUrl, serviceKey, pConfirm, "late-cand-repeat");
      const jobs2 = await getJobs(apiUrl, serviceKey, { checkId: check.id, kind: "late_confirmation" });
      assert.equal(jobs2.length, jobs1.length, "idempotency: no duplicate late jobs");
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id, users.c.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
      await deleteUser(apiUrl, serviceKey, users.c.id);
    }
  });

  add("timezone / 譌･莉伜｢・阜・・ocal_check_date縺卦okyo縺ｧ豁｣縺励＞・・, async () => {
    const apiUrl = env.apiUrl;
    const serviceKey = env.serviceKey;
    const users = { a: await createUser(apiUrl, serviceKey, `${PREFIX}-tz@example.invalid`) };
    try {
      await createSettings(apiUrl, serviceKey, users.a.id, { reminder_count: 0, contact_notify_after: "06:00:00" });

      await runCore(apiUrl, serviceKey, p0, "tz-day1");
      await runCore(apiUrl, serviceKey, pNextDay, "tz-day2");

      const check1 = await getCheck(apiUrl, serviceKey, users.a.id, localDay1);
      const check2 = await getCheck(apiUrl, serviceKey, users.a.id, localDay2);
      assert.ok(check1);
      assert.ok(check2);
      assert.notEqual(check1.id, check2.id);

      const initial1 = await countDeliveries(apiUrl, serviceKey, { checkId: check1.id, kind: "initial", status: "delivered" });
      const initial2 = await countDeliveries(apiUrl, serviceKey, { checkId: check2.id, kind: "initial", status: "delivered" });
      assert.equal(initial1, 1);
      assert.equal(initial2, 1);
    } finally {
      await cleanup(apiUrl, serviceKey, [users.a.id]);
      await deleteUser(apiUrl, serviceKey, users.a.id);
    }
  });

  let passed = 0;
  let failed = 0;
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

  console.log(`\nANPI Phase 47 runtime core tests: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});

