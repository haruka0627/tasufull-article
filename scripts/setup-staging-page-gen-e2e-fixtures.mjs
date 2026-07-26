#!/usr/bin/env node
/**
 * Phase 2-D0 — Staging fixtures + entitlement/listing smoke (no Production).
 *
 *   node scripts/setup-staging-page-gen-e2e-fixtures.mjs
 *   node scripts/setup-staging-page-gen-e2e-fixtures.mjs --cleanup
 *
 * Requires:
 *   - .env.staging (ahlxuyvhzqdqaojiywmu)
 *   - npm run dev on 127.0.0.1:8788 (for entitlement API checks)
 *   - public.gen_ai_subscriptions on Staging
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const FIXTURE_MARKER = "platform_page_gen_e2e";
const STATE_PATH = path.join(ROOT, "reports", "_tmp-page-gen-e2e-fixtures.json");
const LOCAL_API = "http://127.0.0.1:8788";
const cleanupOnly = process.argv.includes("--cleanup");

function parseEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function assert(label, cond, detail = "") {
  if (!cond) {
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
  return true;
}

const env = parseEnv(path.join(ROOT, ".env.staging"));
const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.SUPABASE_ANON_KEY || "";
const service = env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url.includes(STAGING_REF)) {
  console.error("REFUSE: not Staging", url);
  process.exit(2);
}

async function adminCreateUser(email, password, role) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        test_fixture: FIXTURE_MARKER,
        fixture_role: role,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`admin_create ${res.status} ${JSON.stringify(data)}`);
  return data.user?.id || data.id;
}

async function passwordLogin(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login ${res.status} ${JSON.stringify(data)}`);
  return data.access_token;
}

async function deleteUser(userId) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  return res.ok || res.status === 200;
}

async function upsertPaidSubscription(userId) {
  const res = await fetch(`${url}/rest/v1/gen_ai_subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      plan_code: "pro_980",
      status: "active",
      subscription_status: "active",
      cancel_at_period_end: false,
      current_period_end: new Date(Date.now() + 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`sub_upsert ${res.status} ${text}`);
  return JSON.parse(text);
}

async function deleteSubscription(userId) {
  const res = await fetch(
    `${url}/rest/v1/gen_ai_subscriptions?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    },
  );
  return res.ok || res.status === 204;
}

async function api(pathname, { token, body } = {}) {
  const res = await fetch(LOCAL_API + pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function listingCrud(token, userId) {
  const listingId = crypto.randomUUID();
  const insert = await fetch(`${url}/rest/v1/listings`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: listingId,
      user_id: userId,
      listing_type: "skill",
      title: `[${FIXTURE_MARKER}] skill fixture`,
      description: "Staging page-gen E2E fixture — safe to delete",
      form_data: {
        page_gen_fixture: FIXTURE_MARKER,
        page_doc: { schema_version: 2, surface: "platform", meta: { status: "draft" } },
      },
    }),
  });
  const insertText = await insert.text();
  let insertData = null;
  try {
    insertData = JSON.parse(insertText);
  } catch {
    insertData = insertText;
  }
  if (!insert.ok) {
    return { ok: false, step: "insert", status: insert.status, detail: insertText.slice(0, 300) };
  }

  const read = await fetch(
    `${url}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}&select=id,user_id,listing_type,form_data`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    },
  );
  const rows = await read.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!read.ok || !row) {
    return { ok: false, step: "read", status: read.status, detail: JSON.stringify(rows).slice(0, 300) };
  }

  const update = await fetch(`${url}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "PATCH",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      form_data: {
        ...(row.form_data || {}),
        page_gen_fixture: FIXTURE_MARKER,
        page_doc: {
          ...(row.form_data?.page_doc || {}),
          meta: { status: "draft", updated: true },
        },
      },
    }),
  });
  if (!update.ok) {
    return { ok: false, step: "update", status: update.status, detail: (await update.text()).slice(0, 300) };
  }

  const del = await fetch(`${url}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!(del.ok || del.status === 204)) {
    return { ok: false, step: "delete", status: del.status, detail: (await del.text()).slice(0, 300) };
  }

  return { ok: true, listingId, preservedPageDoc: Boolean(row.form_data?.page_doc) };
}

async function cleanupState(state) {
  if (!state) return;
  if (state.listingId) {
    await fetch(`${url}/rest/v1/listings?id=eq.${encodeURIComponent(state.listingId)}`, {
      method: "DELETE",
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
  }
  if (state.paidUserId) {
    await deleteSubscription(state.paidUserId);
    await deleteUser(state.paidUserId);
  }
  if (state.freeUserId) {
    await deleteUser(state.freeUserId);
  }
  if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  console.log("cleanup done");
}

if (cleanupOnly) {
  const state = fs.existsSync(STATE_PATH)
    ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
    : null;
  await cleanupState(state);
  process.exit(0);
}

const stamp = Date.now();
const paidEmail = `pagegen.paid.${stamp}@tasful.dev`;
const freeEmail = `pagegen.free.${stamp}@tasful.dev`;
const password = `PgE2e!${stamp}Aa`;

const paidUserId = await adminCreateUser(paidEmail, password, "paid");
const freeUserId = await adminCreateUser(freeEmail, password, "free");
assert("create paid user", Boolean(paidUserId), paidUserId.slice(0, 8));
assert("create free user", Boolean(freeUserId), freeUserId.slice(0, 8));

await upsertPaidSubscription(paidUserId);
assert("upsert paid subscription", true);

const paidToken = await passwordLogin(paidEmail, password);
const freeToken = await passwordLogin(freeEmail, password);
assert("login paid", Boolean(paidToken));
assert("login free", Boolean(freeToken));

const unauth = await api("/api/page-gen-entitlement", { body: { isPaid: true } });
assert("unauth 401", unauth.status === 401, `status=${unauth.status}`);

const freeEnt = await api("/api/page-gen-entitlement", { token: freeToken, body: {} });
assert(
  "free paid_entitlement_required",
  freeEnt.status === 402 && freeEnt.data?.error === "paid_entitlement_required",
  `status=${freeEnt.status} err=${freeEnt.data?.error}`,
);

const paidEnt = await api("/api/page-gen-entitlement", {
  token: paidToken,
  body: { isPaid: false, plan: "free" },
});
assert(
  "paid entitlement 200 ignores client false",
  paidEnt.status === 200 &&
    paidEnt.data?.ok === true &&
    paidEnt.data?.entitlement?.status === "active" &&
    paidEnt.data?.entitlement?.feature_id === "ai_page_gen_paid",
  `status=${paidEnt.status}`,
);

const mismatch = await api("/api/page-gen-entitlement", {
  token: paidToken,
  body: { user_id: "00000000-0000-4000-8000-000000000099" },
});
assert(
  "user_mismatch 403",
  mismatch.status === 403 && mismatch.data?.error === "user_mismatch",
  `status=${mismatch.status}`,
);

const listing = await listingCrud(paidToken, paidUserId);
assert("listing insert/read/update/delete", listing.ok === true, JSON.stringify(listing));

const state = {
  purpose: FIXTURE_MARKER,
  created_at: new Date().toISOString(),
  staging_ref: STAGING_REF,
  paid: { email: paidEmail, userId: paidUserId },
  free: { email: freeEmail, userId: freeUserId },
  password_hint: "stored only in this local _tmp file — do not commit",
  password,
  paidUserId,
  freeUserId,
  cleanup: "node scripts/setup-staging-page-gen-e2e-fixtures.mjs --cleanup",
  note: "Auth users + paid subscription kept for Phase 2-D re-run; listing smoke row deleted",
};
fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
console.log(`fixture state → ${STATE_PATH}`);
console.log("Users retained for Phase 2-D. Run --cleanup when finished.");

if (process.exitCode) process.exit(1);
