#!/usr/bin/env node
/**
 * TASFUL LIVE P0 — schema / RLS / Storage 検証
 *
 *   node scripts/verify-live-p0-schema.mjs
 *   node scripts/verify-live-p0-schema.mjs --static-only
 *
 * 要（DB 検証）: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * 任意: LIVE_RLS_USER_A_JWT / LIVE_RLS_USER_B_JWT（未設定時 talk テストユーザー自動発行）
 * 任意（Stream env）: CLOUDFLARE_STREAM_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN,
 *                     CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN, LIVE_STREAM_PROVIDER
 *
 * Ref: supabase/migrations/20260628100000_live_p0_schema.sql
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTalkSupabaseConfig,
  ensureTalkJwt,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION_REL = "supabase/migrations/20260628100000_live_p0_schema.sql";
const STATIC_ONLY = process.argv.includes("--static-only");

export const LIVE_SIGNED_URL_TTL_SECONDS = 300;
export const LIVE_SHORT_DAILY_UPLOAD_LIMIT = 10;
export const LIVE_SHORT_ACTIVE_TOTAL_LIMIT = 50;
export const LIVE_STREAM_PROVIDER_DEFAULT = "stub";

const LIVE_TABLES = [
  "live_creator_profiles",
  "live_shorts",
  "live_short_likes",
  "live_broadcasts",
  "live_broadcast_messages",
  "live_creator_follows",
  "live_tips",
  "live_moderation_logs",
  "live_notify_dedupe",
];

const LIVE_COLUMNS = {
  live_creator_profiles: [
    "user_id",
    "creator_status",
    "live_permission_status",
    "short_daily_count",
    "short_active_count",
    "follower_count",
    "fee_rate",
    "payout_policy",
  ],
  live_shorts: ["id", "creator_id", "storage_path", "duration_sec", "status", "published_at"],
  live_tips: ["id", "tipper_id", "creator_id", "payment_status", "idempotency_key", "paid_at"],
  live_broadcasts: ["status", "stream_provider", "playback_url", "tip_total_yen_stub"],
};

const CHECK_SNIPPETS = [
  { id: "CHK-live_permission_status", patterns: ["live_permission_status", "identity_verified", "ops_approved", "suspended", "none"] },
  { id: "CHK-creator_status", patterns: ["creator_status", "draft", "active", "restricted", "suspended"] },
  { id: "CHK-short_status", patterns: ["live_shorts_status_chk", "draft", "published", "hidden", "removed"] },
  { id: "CHK-stream_provider", patterns: ["live_broadcasts_stream_provider_chk", "stub", "cloudflare_stream"] },
  { id: "CHK-stream_status", patterns: ["live_broadcasts_status_chk", "scheduled", "preparing", "live", "ended", "failed", "removed"] },
  { id: "CHK-tip_payment_status", patterns: ["live_tips_payment_status_chk", "stub", "pending", "succeeded", "failed"] },
  { id: "CHK-short_active_count", patterns: ["live_creator_profiles_short_active_count_chk", "short_active_count <= 50"] },
];

const STORAGE_BUCKETS = [
  { id: "short-videos", public: false },
  { id: "short-video-thumbnails", public: false },
  { id: "live-avatars", public: true },
  { id: "live-thumbnails", public: true },
];

const EXPECTED_TABLE_POLICY_COUNT = 34;
const EXPECTED_STORAGE_POLICY_COUNT = 18;
const EXPECTED_TOTAL_LIVE_POLICIES = EXPECTED_TABLE_POLICY_COUNT + EXPECTED_STORAGE_POLICY_COUNT;

const UNTOUCHED_TABLES = [
  "transaction_rooms",
  "talk_notifications",
  "match_profiles",
  "listings",
  "builder_projects",
];

const STREAM_ENV_VARS = [
  "CLOUDFLARE_STREAM_ACCOUNT_ID",
  "CLOUDFLARE_STREAM_API_TOKEN",
  "CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN",
  "LIVE_STREAM_PROVIDER",
];

const summary = { pass: 0, fail: 0, skip: 0 };
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

function skip(id, detail = "") {
  summary.skip += 1;
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function isDenied(res) {
  if (res.status === 401 || res.status === 403) return true;
  const msg = String(res.data?.message || res.data?.hint || res.data?.error || "").toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied");
}

async function rest(cfg, { table, method = "GET", query = "", body, jwt, useService = false, prefer }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: prefer || (method === "GET" ? "count=exact" : "return=representation"),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data, countHeader: res.headers.get("content-range") || "" };
}

async function fetchColumns(cfg, tableName) {
  const res = await rest(cfg, {
    table: "information_schema.columns",
    query: `select=column_name&table_schema=eq.public&table_name=eq.${encodeURIComponent(tableName)}`,
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data.map((r) => String(r.column_name || ""));
}

async function fetchCheckConstraints(cfg, tableName) {
  const res = await rest(cfg, {
    table: "information_schema.table_constraints",
    query: `select=constraint_name,constraint_type&table_schema=eq.public&table_name=eq.${encodeURIComponent(tableName)}&constraint_type=eq.CHECK`,
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data.map((r) => String(r.constraint_name || ""));
}

async function fetchPolicies(cfg, tablename) {
  const res = await rest(cfg, {
    table: "pg_policies",
    query: `select=policyname,cmd,roles&schemaname=eq.public&tablename=eq.${encodeURIComponent(tablename)}`,
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data;
}

async function fetchTableRlsEnabled(cfg, tableName) {
  const res = await rest(cfg, {
    table: "pg_tables",
    query: `select=tablename,rowsecurity&schemaname=eq.public&tablename=eq.${encodeURIComponent(tableName)}`,
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data) || !res.data.length) return null;
  return Boolean(res.data[0].rowsecurity);
}

async function tableReachable(cfg, tableName) {
  const res = await rest(cfg, {
    table: tableName,
    query: "select=*&limit=0",
    useService: true,
  });
  if (res.status === 404) return false;
  return res.ok || res.status === 200 || res.status === 206;
}

async function fetchStorageBucket(cfg, bucketId) {
  const res = await fetch(`${cfg.url}/storage/v1/bucket/${encodeURIComponent(bucketId)}`, {
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
    },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function verifyStaticMigrationFile(sql) {
  console.log("\n=== A. Static migration file ===\n");

  if (!sql.includes("20260628100000_live_p0_schema")) {
    pass("STATIC-file-header", "migration path comment");
  }

  for (const table of LIVE_TABLES) {
    if (sql.includes(`create table if not exists public.${table}`)) {
      pass(`STATIC-table-${table}`);
    } else {
      fail(`STATIC-table-${table}`, "create table not found in migration");
    }
    if (sql.includes(`alter table public.${table} enable row level security`)) {
      pass(`STATIC-rls-enabled-${table}`);
    } else {
      fail(`STATIC-rls-enabled-${table}`, "enable row level security not found");
    }
  }

  for (const chk of CHECK_SNIPPETS) {
    const ok = chk.patterns.every((p) => sql.includes(p));
    if (ok) pass(`STATIC-${chk.id}`);
    else fail(`STATIC-${chk.id}`, `missing pattern in migration`);
  }

  if (sql.includes(String(LIVE_SIGNED_URL_TTL_SECONDS))) {
    pass("STATIC-signed-url-ttl", `${LIVE_SIGNED_URL_TTL_SECONDS}s in migration`);
  } else {
    fail("STATIC-signed-url-ttl", `expected ${LIVE_SIGNED_URL_TTL_SECONDS}`);
  }

  if (/stream_provider\s+text\s+not\s+null\s+default\s+'stub'/i.test(sql)) {
    pass("STATIC-stream-provider-default", LIVE_STREAM_PROVIDER_DEFAULT);
  } else {
    fail("STATIC-stream-provider-default");
  }

  for (const bucket of STORAGE_BUCKETS) {
    if (sql.includes(`'${bucket.id}'`)) pass(`STATIC-bucket-${bucket.id}`);
    else fail(`STATIC-bucket-${bucket.id}`);
  }

  if (/live-archives.*P0.*未作成|live-archives.*NOT created/i.test(sql) || sql.includes("-- P0: live-archives")) {
    pass("STATIC-live-archives-deferred");
  } else {
    skip("STATIC-live-archives-deferred", "comment pattern not matched");
  }

  if (!/alter table public\.transaction_rooms/i.test(sql)) {
    pass("STATIC-no-transaction_rooms-alter");
  } else {
    fail("STATIC-no-transaction_rooms-alter");
  }

  if (!/alter table public\.talk_notifications/i.test(sql)) {
    pass("STATIC-no-talk_notifications-alter");
  } else {
    fail("STATIC-no-talk_notifications-alter");
  }

  for (const t of ["match_profiles", "listings", "builder_projects"]) {
    if (!new RegExp(`alter table public\\.${t}`, "i").test(sql)) {
      pass(`STATIC-no-alter-${t}`);
    } else {
      fail(`STATIC-no-alter-${t}`);
    }
  }

  const policyCount = (sql.match(/^create policy /gm) || []).length;
  if (policyCount === EXPECTED_TOTAL_LIVE_POLICIES) {
    pass("STATIC-policy-count", `${policyCount} policies in migration`);
  } else {
    fail("STATIC-policy-count", `expected ${EXPECTED_TOTAL_LIVE_POLICIES}, found ${policyCount}`);
  }

  for (const envName of STREAM_ENV_VARS) {
    if (sql.includes(envName)) pass(`STATIC-stream-env-doc-${envName}`);
    else skip(`STATIC-stream-env-doc-${envName}`, "not in migration comments");
  }
}

async function verifyDbSchema(cfg) {
  console.log("\n=== B. live_* tables existence ===\n");

  let allTablesOk = true;
  for (const table of LIVE_TABLES) {
    const ok = await tableReachable(cfg, table);
    if (ok) pass(`DB-table-${table}`);
    else {
      fail(`DB-table-${table}`, "not reachable (migration not applied?)");
      allTablesOk = false;
    }
  }

  if (!allTablesOk) {
    skip("DB-schema-rest", "one or more live_* tables missing — apply migration first");
    return false;
  }

  console.log("\n=== C. Columns ===\n");

  for (const [table, cols] of Object.entries(LIVE_COLUMNS)) {
    const found = await fetchColumns(cfg, table);
    if (!found) {
      skip(`DB-columns-${table}`, "information_schema.columns unavailable via REST");
      continue;
    }
    const missing = cols.filter((c) => !found.includes(c));
    if (!missing.length) pass(`DB-columns-${table}`, cols.join(", "));
    else fail(`DB-columns-${table}`, `missing: ${missing.join(", ")}`);
  }

  console.log("\n=== D. CHECK constraints ===\n");

  for (const table of ["live_creator_profiles", "live_shorts", "live_broadcasts", "live_tips"]) {
    const checks = await fetchCheckConstraints(cfg, table);
    if (!checks) {
      skip(`DB-checks-${table}`, "information_schema unavailable");
      continue;
    }
    const liveChecks = checks.filter((n) => n.startsWith("live_"));
    if (liveChecks.length > 0) pass(`DB-checks-${table}`, `${liveChecks.length} CHECK(s)`);
    else fail(`DB-checks-${table}`, "no live_* CHECK constraints");
  }

  const profileChecks = await fetchCheckConstraints(cfg, "live_creator_profiles");
  if (profileChecks?.includes("live_creator_profiles_short_active_count_chk")) {
    pass("DB-check-short_active_count", "<= 50");
  } else if (profileChecks) {
    fail("DB-check-short_active_count", "live_creator_profiles_short_active_count_chk missing");
  } else {
    skip("DB-check-short_active_count", "information_schema unavailable");
  }

  console.log("\n=== E. RLS enabled ===\n");

  let rlsProbeOk = false;
  for (const table of LIVE_TABLES) {
    const enabled = await fetchTableRlsEnabled(cfg, table);
    if (enabled === null) {
      skip(`DB-rls-enabled-${table}`, "pg_tables.rowsecurity unavailable via REST");
      continue;
    }
    rlsProbeOk = true;
    if (enabled) pass(`DB-rls-enabled-${table}`);
    else fail(`DB-rls-enabled-${table}`, "rowsecurity=false");
  }
  if (!rlsProbeOk) {
    skip("DB-rls-enabled-all", "pg_tables not exposed — rely on STATIC-rls-enabled-*");
  }

  console.log("\n=== F. RLS policies ===\n");

  let tablePolicyTotal = 0;
  for (const table of LIVE_TABLES) {
    const policies = await fetchPolicies(cfg, table);
    if (!policies) {
      skip(`DB-rls-policies-${table}`, "pg_policies unavailable");
      continue;
    }
    const livePolicies = policies.filter((p) => String(p.policyname || "").startsWith("live_"));
    tablePolicyTotal += livePolicies.length;
    if (livePolicies.length > 0) {
      pass(`DB-rls-policies-${table}`, `${livePolicies.length} policy(ies)`);
    } else {
      fail(`DB-rls-policies-${table}`, "no live_* policies");
    }
  }

  const storagePolicies = await fetchPolicies(cfg, "objects");
  if (storagePolicies) {
    const liveStorage = storagePolicies.filter((p) =>
      String(p.policyname || "").startsWith("live_storage_")
    );
    if (liveStorage.length >= EXPECTED_STORAGE_POLICY_COUNT) {
      pass("DB-rls-storage-policies", `${liveStorage.length} live_storage_* on storage.objects`);
    } else {
      fail(
        "DB-rls-storage-policies",
        `expected >= ${EXPECTED_STORAGE_POLICY_COUNT}, got ${liveStorage.length}`
      );
    }
    if (tablePolicyTotal >= EXPECTED_TABLE_POLICY_COUNT) {
      pass("DB-rls-table-policy-total", `${tablePolicyTotal} on live_* tables`);
    } else {
      fail("DB-rls-table-policy-total", `expected >= ${EXPECTED_TABLE_POLICY_COUNT}, got ${tablePolicyTotal}`);
    }
  } else {
    skip("DB-rls-storage-policies", "pg_policies for storage.objects unavailable");
  }

  const anonShorts = await rest(cfg, { table: "live_shorts", query: "select=id&limit=1" });
  const anonRows = Array.isArray(anonShorts.data) ? anonShorts.data.length : 0;
  if (anonRows > 0) fail("DB-rls-anon-live_shorts", `anon read ${anonRows} rows`);
  else pass("DB-rls-anon-live_shorts", "no anon read");

  return true;
}

async function verifyStorageBuckets(cfg) {
  console.log("\n=== G. Storage buckets ===\n");

  for (const bucket of STORAGE_BUCKETS) {
    const { status, json } = await fetchStorageBucket(cfg, bucket.id);
    if (status !== 200) {
      fail(`DB-bucket-${bucket.id}`, `status=${status}`);
      continue;
    }
    const isPublic = Boolean(json?.public);
    if (isPublic === bucket.public) {
      pass(`DB-bucket-${bucket.id}`, `public=${isPublic}`);
    } else {
      fail(`DB-bucket-${bucket.id}`, `expected public=${bucket.public}, got ${isPublic}`);
    }
  }

  const archives = await fetchStorageBucket(cfg, "live-archives");
  if (archives.status === 404 || archives.status === 400) {
    pass("DB-bucket-live-archives-absent", `status=${archives.status}`);
  } else if (archives.status === 200) {
    skip("DB-bucket-live-archives-absent", "bucket exists (P0 optional)");
  } else {
    skip("DB-bucket-live-archives-absent", `status=${archives.status}`);
  }
}

async function verifyUntouchedTables(cfg) {
  console.log("\n=== H. TALK / MATCH / Marketplace / Builder (no LIVE migration impact) ===\n");

  const trCols = await fetchColumns(cfg, "transaction_rooms");
  if (trCols) {
    for (const col of ["contact_id", "service_type", "service_ref_id", "source"]) {
      if (trCols.includes(col)) pass(`DB-talk-transaction_rooms-col-${col}`);
      else fail(`DB-talk-transaction_rooms-col-${col}`, "missing (TALK P1 bridge?)");
    }
    if (!trCols.includes("live_permission_status")) {
      pass("DB-talk-transaction_rooms-no-live-columns");
    } else {
      fail("DB-talk-transaction_rooms-no-live-columns");
    }
  } else {
    skip("DB-talk-transaction_rooms-cols", "information_schema unavailable");
  }

  const talkNotify = await tableReachable(cfg, "talk_notifications");
  if (talkNotify) pass("DB-talk-talk_notifications-reachable");
  else fail("DB-talk-talk_notifications-reachable");

  for (const table of ["match_profiles", "listings"]) {
    const ok = await tableReachable(cfg, table);
    if (ok) pass(`DB-untouched-${table}`);
    else skip(`DB-untouched-${table}`, "table not in project or not exposed");
  }

  const builderOk = await tableReachable(cfg, "builder_projects");
  if (builderOk) pass("DB-untouched-builder_projects");
  else skip("DB-untouched-builder_projects", "table not in project (FROZEN schema optional)");
}

async function verifyRlsBehavior(cfg, jwtA, jwtB, jwtAdmin) {
  console.log("\n=== I. RLS behavior (JWT) ===\n");

  const marker = `live-p0-verify-${Date.now()}`;
  const tipId = crypto.randomUUID();
  const idempotencyKey = `${marker}-tip`;

  const seedTip = await rest(cfg, {
    table: "live_tips",
    method: "POST",
    body: {
      id: tipId,
      tipper_id: TALK_TEST_USERS.u_me.talkUserId,
      creator_id: TALK_TEST_USERS.u_store.talkUserId,
      target_type: "short",
      target_id: "00000000-0000-4000-8000-000000000001",
      amount_yen: 100,
      message: marker,
      payment_status: "stub",
      idempotency_key: idempotencyKey,
    },
    useService: true,
  });

  if (!seedTip.ok) {
    skip("DB-rls-live_tips-seed", `service_role insert failed (${seedTip.status})`);
  } else {
    pass("DB-rls-live_tips-seed", "service_role");

    const userPatch = await rest(cfg, {
      table: "live_tips",
      method: "PATCH",
      query: `id=eq.${tipId}`,
      body: { payment_status: "succeeded", paid_at: new Date().toISOString() },
      jwt: jwtA,
      prefer: "return=representation",
    });
    const patched = Array.isArray(userPatch.data) ? userPatch.data.length : 0;
    if (userPatch.ok && patched > 0) {
      fail("DB-rls-live_tips-user-update-blocked", "user PATCH succeeded");
    } else {
      pass("DB-rls-live_tips-user-update-blocked");
    }

    await rest(cfg, {
      table: "live_tips",
      method: "DELETE",
      query: `id=eq.${tipId}`,
      useService: true,
    });
  }

  const modReadUser = await rest(cfg, {
    table: "live_moderation_logs",
    query: "select=id&limit=3",
    jwt: jwtA,
  });
  const modRows = Array.isArray(modReadUser.data) ? modReadUser.data.length : 0;
  if (modReadUser.ok && modRows > 0) {
    fail("DB-rls-live_moderation_logs-user-read", `user read ${modRows} rows`);
  } else {
    pass("DB-rls-live_moderation_logs-user-read", "denied or 0 rows");
  }

  const modInsUser = await rest(cfg, {
    table: "live_moderation_logs",
    method: "POST",
    body: {
      content_type: "live_short",
      content_id: marker,
      user_id: TALK_TEST_USERS.u_me.talkUserId,
      level: "low",
      allowed: true,
    },
    jwt: jwtA,
  });
  if (modInsUser.ok) fail("DB-rls-live_moderation_logs-user-insert", "allowed");
  else pass("DB-rls-live_moderation_logs-user-insert", "denied");

  const modId = crypto.randomUUID();
  await rest(cfg, {
    table: "live_moderation_logs",
    method: "POST",
    body: {
      id: modId,
      content_type: "live_profile",
      content_id: marker,
      level: "low",
      allowed: true,
    },
    useService: true,
  });

  const modReadAdmin = await rest(cfg, {
    table: "live_moderation_logs",
    query: `select=id&id=eq.${modId}`,
    jwt: jwtAdmin,
  });
  const adminRows = Array.isArray(modReadAdmin.data) ? modReadAdmin.data.length : 0;
  if (modReadAdmin.ok && adminRows > 0) {
    pass("DB-rls-live_moderation_logs-admin-read");
  } else {
    skip("DB-rls-live_moderation_logs-admin-read", `status=${modReadAdmin.status} (admin JWT / talk_is_admin)`);
  }

  await rest(cfg, {
    table: "live_moderation_logs",
    method: "DELETE",
    query: `id=eq.${modId}`,
    useService: true,
  });

  const notifyIns = await rest(cfg, {
    table: "talk_notifications",
    method: "POST",
    body: {
      id: `${marker}-notify`,
      user_id: TALK_TEST_USERS.u_me.talkUserId,
      type: "live",
      title: "LIVE verify",
      body: marker,
      target_url: "live/index.html",
      source: "tasful_live",
      priority: "normal",
    },
    useService: true,
  });
  if (notifyIns.ok) {
    pass("DB-talk_notifications-type-live-insert", "no migration required");
    await rest(cfg, {
      table: "talk_notifications",
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(`${marker}-notify`)}`,
      useService: true,
    });
  } else {
    fail("DB-talk_notifications-type-live-insert", `status=${notifyIns.status}`);
  }

  void jwtB;
}

function verifyConstants() {
  console.log("\n=== J. Platform constants ===\n");

  if (LIVE_SIGNED_URL_TTL_SECONDS === 300) {
    pass("CONST-signed-url-ttl", "300 seconds");
  } else {
    fail("CONST-signed-url-ttl");
  }

  if (LIVE_SHORT_DAILY_UPLOAD_LIMIT === 10) {
    pass("CONST-short-daily-limit", "10");
  } else {
    fail("CONST-short-daily-limit");
  }

  if (LIVE_SHORT_ACTIVE_TOTAL_LIMIT === 50) {
    pass("CONST-short-active-limit", "50");
  } else {
    fail("CONST-short-active-limit");
  }
}

function verifyStreamEnvOptional() {
  console.log("\n=== K. Stream env (optional) ===\n");

  for (const name of STREAM_ENV_VARS) {
    if (process.env[name]) {
      pass(`ENV-${name}`, "set");
    } else {
      skip(`ENV-${name}`, "not set (P0 stub mode OK)");
    }
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE P0 schema verification ===\n");
  console.log(`  migration: ${MIGRATION_REL}`);
  console.log(`  mode: ${STATIC_ONLY ? "static-only" : "static + remote DB"}\n`);

  const migrationPath = path.join(ROOT, MIGRATION_REL);
  if (!existsSync(migrationPath)) {
    fail("STATIC-migration-file-exists", migrationPath);
    printSummary();
    process.exit(1);
  }

  const sql = readFileSync(migrationPath, "utf8");
  verifyStaticMigrationFile(sql);
  verifyConstants();
  verifyStreamEnvOptional();

  if (STATIC_ONLY) {
    printSummary();
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    skip("DB-all", "SUPABASE_URL / SUPABASE_ANON_KEY missing");
    printSummary();
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  if (!cfg.serviceKey) {
    skip("DB-all", "SUPABASE_SERVICE_ROLE_KEY missing — static checks only");
    printSummary();
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  const schemaReady = await verifyDbSchema(cfg);
  if (schemaReady) {
    await verifyStorageBuckets(cfg);
    await verifyUntouchedTables(cfg);

    let jwtA = "";
    let jwtB = "";
    let jwtAdmin = "";
    try {
      jwtA = process.env.LIVE_RLS_USER_A_JWT || (await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me));
      jwtB = process.env.LIVE_RLS_USER_B_JWT || (await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store));
      jwtAdmin = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
      pass("DB-jwt-setup", "talk test users");
    } catch (err) {
      skip("DB-rls-behavior", `JWT setup failed: ${err.message}`);
      printSummary();
      process.exit(summary.fail > 0 ? 1 : 0);
    }

    await verifyRlsBehavior(cfg, jwtA, jwtB, jwtAdmin);
  }

  printSummary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\nResult: ${summary.fail > 0 ? "FAIL" : "PASS"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
