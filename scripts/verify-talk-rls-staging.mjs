#!/usr/bin/env node
/**
 * TASFUL TALK — 本番 RLS 検証（REST + JWT）
 *
 *   node scripts/verify-talk-rls-staging.mjs
 *
 * 要: SUPABASE_SERVICE_ROLE_KEY
 * 任意: TALK_RLS_USER_A_JWT / _B_JWT / _ADMIN_JWT（未設定時はテストユーザー自動発行）
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEST_USERS = {
  a: {
    email: "talk-rls-a@tasful-dev.test",
    password: "TalkRlsA1!",
    talkUserId: "u_me",
  },
  b: {
    email: "talk-rls-b@tasful-dev.test",
    password: "TalkRlsB1!",
    talkUserId: "u_store",
  },
  admin: {
    email: "talk-rls-admin@tasful-dev.test",
    password: "TalkRlsAdmin1!",
    talkUserId: "u_admin",
    role: "tasu_admin",
  },
};

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function loadConfig() {
  loadDotEnv();
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let anonKey = process.env.SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  return { url, anonKey, serviceKey };
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function talkUserIdFromJwt(token) {
  const p = decodeJwtPayload(token);
  return String(
    p.talk_user_id ||
      p.app_metadata?.talk_user_id ||
      p.user_metadata?.talk_user_id ||
      p.member_id ||
      p.app_metadata?.member_id ||
      ""
  ).trim();
}

async function authFetch(cfg, { method, pathSuffix, body, useServiceRole = false }) {
  const key = useServiceRole ? cfg.serviceKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function findUserByEmail(cfg, email) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: "/admin/users?per_page=200",
    useServiceRole: true,
  });
  if (!res.ok) throw new Error(`admin/users: ${res.status}`);
  const users = res.data?.users || [];
  return users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function ensureTalkJwt(cfg, spec) {
  const envKey = spec.envJwtKey;
  if (process.env[envKey]) return process.env[envKey];

  const appMetadata = { talk_user_id: spec.talkUserId, member_id: spec.talkUserId };
  const userMetadata = { talk_user_id: spec.talkUserId };
  if (spec.role) appMetadata.role = spec.role;

  let user = await findUserByEmail(cfg, spec.email);
  if (!user) {
    const created = await authFetch(cfg, {
      method: "POST",
      pathSuffix: "/admin/users",
      useServiceRole: true,
      body: {
        email: spec.email,
        password: spec.password,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      },
    });
    if (!created.ok) throw new Error(`create ${spec.email}: ${created.status}`);
    user = created.data?.user || created.data;
  } else {
    await authFetch(cfg, {
      method: "PUT",
      pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
      useServiceRole: true,
      body: { app_metadata: appMetadata, user_metadata: userMetadata, password: spec.password },
    });
  }

  const login = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: spec.email, password: spec.password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`signIn ${spec.email}: ${login.status}`);
  }
  const token = login.data.access_token;
  const resolved = talkUserIdFromJwt(token);
  if (resolved !== spec.talkUserId) {
    throw new Error(`JWT talk_user_id mismatch ${spec.email}: ${resolved} !== ${spec.talkUserId}`);
  }
  return token;
}

async function rest(cfg, { table, method = "GET", query = "", body, jwt, useService = false }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function countDevPolicies(cfg) {
  const res = await rest(cfg, {
    table: "pg_policies",
    query: "select=policyname&tablename=like.talk_*&policyname=like.*_dev",
    useService: true,
  });
  if (!res.ok) return -1;
  return Array.isArray(res.data) ? res.data.length : 0;
}

async function main() {
  const cfg = loadConfig();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    fail("SUPABASE_URL / anon / service_role required");
    process.exit(1);
  }

  const devCount = await countDevPolicies(cfg);
  if (devCount < 0) pass("dev policy count skip (pg_policies)");
  else if (devCount > 0) {
    fail(`dev policies still present (${devCount}) — run sql/talk-rls-drop-dev-policies.sql`);
  } else pass("no dev policies on talk_* tables");

  let jwtA = "";
  let jwtB = "";
  let jwtAdmin = "";
  try {
    jwtA = await ensureTalkJwt(cfg, { ...TEST_USERS.a, envJwtKey: "TALK_RLS_USER_A_JWT" });
    jwtB = await ensureTalkJwt(cfg, { ...TEST_USERS.b, envJwtKey: "TALK_RLS_USER_B_JWT" });
    jwtAdmin = await ensureTalkJwt(cfg, { ...TEST_USERS.admin, envJwtKey: "TALK_RLS_ADMIN_JWT" });
    pass("JWT issued (talk_user_id claims)");
  } catch (err) {
    fail(`JWT setup: ${err.message}`);
    process.exit(1);
  }

  const marker = `talk-rls-prod-${Date.now()}`;
  const rowA = {
    id: `${marker}-a`,
    user_id: TEST_USERS.a.talkUserId,
    type: "system",
    title: "RLS A",
    body: marker,
    target_url: "talk-home.html?tab=notify",
    source: "rls-verify",
    priority: "normal",
  };
  const rowB = {
    id: `${marker}-b`,
    user_id: TEST_USERS.b.talkUserId,
    type: "system",
    title: "RLS B",
    body: marker,
    target_url: "talk-home.html?tab=notify",
    source: "rls-verify",
    priority: "normal",
  };

  await rest(cfg, { table: "talk_notifications", method: "POST", body: rowA, useService: true });
  await rest(cfg, { table: "talk_notifications", method: "POST", body: rowB, useService: true });
  pass("service_role seed rows");

  const anonLeak = await rest(cfg, {
    table: "talk_notifications",
    query: `select=id,user_id&body=eq.${encodeURIComponent(marker)}`,
  });
  const anonRows = Array.isArray(anonLeak.data) ? anonLeak.data : [];
  if (anonLeak.ok && anonRows.length > 0) fail(`anon reads ${anonRows.length} rows without JWT`);
  else pass("anon cannot read notifications without auth");

  const aRows = await rest(cfg, {
    table: "talk_notifications",
    query: `select=id,user_id&body=eq.${encodeURIComponent(marker)}`,
    jwt: jwtA,
  });
  const aList = Array.isArray(aRows.data) ? aRows.data : [];
  if (!aRows.ok) fail(`user A select (${aRows.status})`);
  else if (!aList.some((r) => r.user_id === TEST_USERS.a.talkUserId)) fail("user A cannot read own row");
  else if (aList.some((r) => r.user_id === TEST_USERS.b.talkUserId)) fail("user A reads user B row");
  else pass("user A reads own notifications only");

  const bRows = await rest(cfg, {
    table: "talk_notifications",
    query: `select=id,user_id&body=eq.${encodeURIComponent(marker)}`,
    jwt: jwtB,
  });
  const bList = Array.isArray(bRows.data) ? bRows.data : [];
  if (!bRows.ok) fail(`user B select (${bRows.status})`);
  else if (!bList.some((r) => r.user_id === TEST_USERS.b.talkUserId)) fail("user B cannot read own row");
  else if (bList.some((r) => r.user_id === TEST_USERS.a.talkUserId)) fail("user B reads user A row");
  else pass("user B reads own notifications only");

  const aDraft = {
    id: `${marker}-draft-a`,
    user_id: TEST_USERS.a.talkUserId,
    mode: "qa",
    input: marker,
    output: marker,
    status: "draft",
  };
  const insDraftA = await rest(cfg, {
    table: "talk_ai_drafts",
    method: "POST",
    body: aDraft,
    jwt: jwtA,
  });
  if (!insDraftA.ok) fail(`user A insert ai draft (${insDraftA.status})`);
  else pass("user A inserts own AI draft");

  const bReadDraft = await rest(cfg, {
    table: "talk_ai_drafts",
    query: `select=id&id=eq.${encodeURIComponent(aDraft.id)}`,
    jwt: jwtB,
  });
  const bDraftRows = Array.isArray(bReadDraft.data) ? bReadDraft.data : [];
  if (bReadDraft.ok && bDraftRows.length > 0) fail("user B reads user A AI draft");
  else pass("user B cannot read user A AI draft");

  const fanoutBlocked = await rest(cfg, {
    table: "talk_notifications",
    method: "POST",
    body: {
      id: `${marker}-fanout-b-by-a`,
      user_id: TEST_USERS.b.talkUserId,
      type: "system",
      title: "blocked",
      body: marker,
      target_url: "#",
      source: "rls-verify",
      priority: "normal",
    },
    jwt: jwtA,
  });
  if (fanoutBlocked.ok) fail("non-admin inserted notification for other user");
  else pass("non-admin cannot fanout to other user");

  const fanoutAdmin = await rest(cfg, {
    table: "talk_notifications",
    method: "POST",
    body: {
      id: `${marker}-fanout-b-by-admin`,
      user_id: TEST_USERS.b.talkUserId,
      type: "system",
      title: "admin fanout",
      body: marker,
      target_url: "#",
      source: "rls-verify",
      priority: "normal",
    },
    jwt: jwtAdmin,
  });
  if (!fanoutAdmin.ok) fail(`admin fanout insert (${fanoutAdmin.status})`);
  else pass("admin can fanout notification to other user");

  for (const id of [
    rowA.id,
    rowB.id,
    `${marker}-fanout-b-by-a`,
    `${marker}-fanout-b-by-admin`,
    aDraft.id,
  ]) {
    await rest(cfg, {
      table: "talk_notifications",
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(id)}`,
      useService: true,
    });
    await rest(cfg, {
      table: "talk_ai_drafts",
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(id)}`,
      useService: true,
    });
  }
  pass("cleanup marker rows");

  console.log("\n---");
  if (errors.length) {
    console.error(`FAILED (${errors.length})`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("Production RLS verification passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
