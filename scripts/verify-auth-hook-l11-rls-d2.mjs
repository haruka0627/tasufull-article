#!/usr/bin/env node
/**
 * L11 — MATCH RLS D2 migration + REST permission tests + Edge smoke
 *
 *   node scripts/verify-auth-hook-l11-rls-d2.mjs
 *   node scripts/verify-auth-hook-l11-rls-d2.mjs --skip-apply
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · RLS enabled on 8 MATCH tables
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWLIST_SLOTS,
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/20260621170000_match_rls_d2.sql";
const skipApply = process.argv.includes("--skip-apply");
const TEST_NICK = "L11RLS";

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseCliJson(out) {
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function runSqlFile(relPath) {
  const sqlPath = path.join(ROOT, relPath);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`${relPath} failed: ${combined.slice(0, 500)}`);
  return parseCliJson(combined)?.rows?.[0] ?? null;
}

function applyMigration() {
  const sqlPath = path.join(ROOT, MIGRATION);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`migration apply failed: ${combined.slice(0, 800)}`);
}

function assertPostGates(row) {
  if (Number(row.core_table_count) !== 8) {
    throw new Error(`core_table_count=${row.core_table_count}`);
  }
  if (Number(row.rls_enabled_count) !== 8) {
    throw new Error(`rls_enabled_count=${row.rls_enabled_count}, expected 8`);
  }
  if (Number(row.policy_count) < 20) {
    throw new Error(`policy_count=${row.policy_count}, expected >= 20`);
  }
  if (Number(row.helper_func_count) !== 3) {
    throw new Error(`helper_func_count=${row.helper_func_count}`);
  }
  if (Number(row.legacy_user_count) !== 7) {
    throw new Error(`legacy_user_count=${row.legacy_user_count}`);
  }
  if (Number(row.allowlist_backfill_count) !== 5) {
    throw new Error(`allowlist_backfill_count=${row.allowlist_backfill_count}`);
  }
  if (Number(row.hook_func_count) !== 1) {
    throw new Error(`hook_func_count=${row.hook_func_count}`);
  }
}

async function authFetch(cfg, { method, pathSuffix, body, bearer }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearer || cfg.anonKey}`,
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
  return { status: res.status, data, text };
}

async function signIn(cfg, email) {
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`login ${email}: HTTP ${res.status}`);
  }
  return res.data.access_token;
}

function makeUnsignedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.unsigned`;
}

async function restFetch(cfg, { table, method = "GET", query = "", body, token, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = token || (serviceRole ? cfg.serviceRoleKey : cfg.anonKey);
  const url = `${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const countHeader = res.headers.get("content-range");
  const count = countHeader?.includes("/") ? Number(countHeader.split("/")[1]) : null;
  return { status: res.status, json, text, count };
}

async function cleanupTestRows(cfg) {
  const profiles = await restFetch(cfg, {
    table: "match_profiles",
    query: `nickname=eq.${TEST_NICK}&select=id,user_id`,
    serviceRole: true,
  });
  const ids = Array.isArray(profiles.json) ? profiles.json.map((r) => r.id) : [];
  if (!ids.length) return;

  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: `or=(swiper_user_id.in.(t1,t2,t3),target_user_id.in.(t1,t2,t3))`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_pairs",
    method: "DELETE",
    query: `or=(user_low_id.in.(t1,t2,t3),user_high_id.in.(t1,t2,t3))`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_blocks",
    method: "DELETE",
    query: `or=(blocker_user_id.in.(t1,t2,t3),blocked_user_id.in.(t1,t2,t3))`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_reports",
    method: "DELETE",
    query: `or=(reporter_user_id.in.(t1,t2,t3),reported_user_id.in.(t1,t2,t3))`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_verifications",
    method: "DELETE",
    query: `user_id=in.(t1,t2,t3)`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_moderation_logs",
    method: "DELETE",
    query: `user_id=in.(t1,t2,t3)`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_profiles",
    method: "DELETE",
    query: `nickname=eq.${TEST_NICK}`,
    serviceRole: true,
  });
}

async function runRlsRestTests(cfg) {
  const t1Token = await signIn(cfg, slotByName("T1").email);
  const t2Token = await signIn(cfg, slotByName("T2").email);
  const t3Token = await signIn(cfg, slotByName("T3").email);

  await cleanupTestRows(cfg);

  const profileBody = {
    user_id: "t1",
    nickname: TEST_NICK,
    gender: "private",
    birth_date: "1990-01-01",
    prefecture: "Tokyo",
    profile_status: "active",
  };

  const t1Insert = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: profileBody,
    token: t1Token,
  });
  if (t1Insert.status >= 500) throw new Error(`T1 insert profile 5xx: ${t1Insert.status}`);
  if (t1Insert.status !== 201 || !t1Insert.json?.[0]?.id) {
    throw new Error(`T1 own profile insert: ${t1Insert.status} ${t1Insert.text.slice(0, 200)}`);
  }
  const t1ProfileId = t1Insert.json[0].id;

  const t1Read = await restFetch(cfg, {
    table: "match_profiles",
    query: "user_id=eq.t1&select=id,nickname",
    token: t1Token,
  });
  if (t1Read.status >= 500) throw new Error(`T1 read own 5xx`);
  if (!Array.isArray(t1Read.json) || t1Read.json.length < 1) {
    throw new Error("T1 own profile read denied");
  }

  const t1Update = await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `id=eq.${t1ProfileId}`,
    body: { bio: "L11 own update ok" },
    token: t1Token,
  });
  if (t1Update.status >= 500) throw new Error(`T1 update own 5xx`);
  if (t1Update.status !== 200) throw new Error(`T1 update own: ${t1Update.status}`);

  const t2Seed = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: { ...profileBody, user_id: "t2" },
    serviceRole: true,
  });
  if (t2Seed.status !== 201) throw new Error(`seed T2 profile: ${t2Seed.status}`);
  const t2ProfileId = t2Seed.json[0].id;

  const t1ReadT2 = await restFetch(cfg, {
    table: "match_profiles",
    query: "user_id=eq.t2&select=id",
    token: t1Token,
  });
  if (t1ReadT2.status >= 500) throw new Error(`T1 read T2 5xx`);
  if (Array.isArray(t1ReadT2.json) && t1ReadT2.json.length > 0) {
    throw new Error("T1 must not read T2 base profile");
  }

  const t1HackT2 = await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `id=eq.${t2ProfileId}`,
    body: { nickname: "HACKED" },
    token: t1Token,
  });
  if (t1HackT2.status >= 500 && !String(t1HackT2.text).includes("verification_status")) {
    throw new Error(`T1 patch T2 unexpected 5xx: ${t1HackT2.status}`);
  }
  const t2After = await restFetch(cfg, {
    table: "match_profiles",
    query: `id=eq.${t2ProfileId}&select=nickname`,
    serviceRole: true,
  });
  if (t2After.json?.[0]?.nickname === "HACKED") {
    throw new Error("T1 illegally updated T2 profile");
  }

  const swipeOk = await restFetch(cfg, {
    table: "match_swipes",
    method: "POST",
    body: { swiper_user_id: "t1", target_user_id: "t2", action: "like" },
    token: t1Token,
  });
  if (swipeOk.status !== 201) throw new Error(`T1 swipe insert: ${swipeOk.status}`);

  const swipeBad = await restFetch(cfg, {
    table: "match_swipes",
    method: "POST",
    body: { swiper_user_id: "t2", target_user_id: "t1", action: "like" },
    token: t1Token,
  });
  if (swipeBad.status < 400) throw new Error("T1 must not insert swipe as t2");

  const pairSeed = await restFetch(cfg, {
    table: "match_pairs",
    method: "POST",
    body: { user_low_id: "t1", user_high_id: "t2", status: "active" },
    serviceRole: true,
  });
  if (pairSeed.status !== 201) throw new Error(`seed pair: ${pairSeed.status}`);

  const t1Pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: "select=id&user_low_id=eq.t1",
    token: t1Token,
  });
  if (!Array.isArray(t1Pairs.json) || t1Pairs.json.length < 1) {
    throw new Error("T1 must read own match_pair");
  }

  const t3Pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: "select=id&user_low_id=eq.t1",
    token: t3Token,
  });
  if (Array.isArray(t3Pairs.json) && t3Pairs.json.length > 0) {
    throw new Error("T3 must not read t1/t2 pair");
  }

  const blockOk = await restFetch(cfg, {
    table: "match_blocks",
    method: "POST",
    body: { blocker_user_id: "t1", blocked_user_id: "t3", block_status: "active", source: "profile" },
    token: t1Token,
  });
  if (blockOk.status !== 201) throw new Error(`T1 block: ${blockOk.status}`);

  const t3Blocks = await restFetch(cfg, {
    table: "match_blocks",
    query: "blocked_user_id=eq.t3&select=id",
    token: t3Token,
  });
  if (Array.isArray(t3Blocks.json) && t3Blocks.json.length > 0) {
    throw new Error("blocked user must not see block row");
  }

  const reportOk = await restFetch(cfg, {
    table: "match_reports",
    method: "POST",
    body: {
      reporter_user_id: "t1",
      reported_user_id: "t2",
      reason: "harassment",
      context_type: "profile",
      status: "open",
    },
    token: t1Token,
  });
  if (reportOk.status !== 201) throw new Error(`T1 report: ${reportOk.status}`);

  const verifyOk = await restFetch(cfg, {
    table: "match_verifications",
    method: "POST",
    body: { user_id: "t1", verification_type: "phone", status: "pending" },
    token: t1Token,
  });
  if (verifyOk.status !== 201) throw new Error(`T1 verification: ${verifyOk.status}`);

  await restFetch(cfg, {
    table: "match_moderation_logs",
    method: "POST",
    body: { user_id: "t1", content_type: "profile_bio", level: "ok", allowed: true },
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_moderation_logs",
    method: "POST",
    body: { user_id: "t2", content_type: "profile_bio", level: "warning", allowed: false },
    serviceRole: true,
  });

  const t1Logs = await restFetch(cfg, {
    table: "match_moderation_logs",
    query: "select=id,user_id",
    token: t1Token,
  });
  if (t1Logs.status >= 500) throw new Error(`T1 logs read 5xx`);
  const t1LogRows = Array.isArray(t1Logs.json) ? t1Logs.json : [];
  if (t1LogRows.some((r) => r.user_id === "t2")) {
    throw new Error("T1 must not read T2 moderation_logs");
  }
  if (!t1LogRows.some((r) => r.user_id === "t1")) {
    throw new Error("T1 must read own moderation_log");
  }

  const srLogs = await restFetch(cfg, {
    table: "match_moderation_logs",
    query: "user_id=in.(t1,t2)&select=id",
    serviceRole: true,
  });
  if (!Array.isArray(srLogs.json) || srLogs.json.length < 2) {
    throw new Error("service_role must read moderation_logs broadly");
  }

  const anonRead = await restFetch(cfg, {
    table: "match_profiles",
    query: "select=id&limit=1",
  });
  if (anonRead.status >= 500) throw new Error(`anon read 5xx`);
  if (anonRead.status === 200 && Array.isArray(anonRead.json) && anonRead.json.length > 0) {
    throw new Error("anon must not read match_profiles");
  }

  const invalidJwt = await restFetch(cfg, {
    table: "match_profiles",
    query: "select=id&limit=1",
    token: "not.a.valid.jwt",
  });
  if (invalidJwt.status !== 401 && invalidJwt.status !== 403) {
    throw new Error(`invalid JWT expected 401/403 got ${invalidJwt.status}`);
  }

  const subOnly = await restFetch(cfg, {
    table: "match_profiles",
    query: "select=id&limit=1",
    token: makeUnsignedJwt({ sub: slotByName("T1").id }),
  });
  if (subOnly.status !== 401 && subOnly.status !== 403) {
    throw new Error(`sub-only JWT expected 401/403 got ${subOnly.status}`);
  }

  for (const slot of ALLOWLIST_SLOTS) {
    const token = slot.slot === "T1" ? t1Token : slot.slot === "T2" ? t2Token : await signIn(cfg, slot.email);
    const own = await restFetch(cfg, {
      table: "match_swipes",
      query: `swiper_user_id=eq.${slot.talkUserId}&select=id&limit=1`,
      token,
    });
    if (own.status >= 500) throw new Error(`${slot.slot} swipe read 5xx`);
  }

  await cleanupTestRows(cfg);
}

async function runEdgeSmokeRegression() {
  const script = path.join(ROOT, "scripts", "verify-auth-hook-l9-remote-edge-smoke.mjs");
  const r = spawnSync(process.execPath, [script, "--skip-deploy", "--skip-db-gates"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`edge smoke failed:\n${(r.stderr || r.stdout).slice(-600)}`);
  }
}

async function apiHealthSmoke(cfg) {
  const authHealth = await fetch(`${cfg.url}/auth/v1/health`, {
    headers: { apikey: cfg.anonKey },
  });
  if (authHealth.status >= 500) throw new Error(`auth health ${authHealth.status}`);

  const rest = await fetch(`${cfg.url}/rest/v1/`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  });
  if (rest.status >= 500) throw new Error(`rest ${rest.status}`);

  const edgeProbe = await fetch(`${cfg.url}/functions/v1/match-record-swipe`, { method: "OPTIONS" });
  if (edgeProbe.status >= 500) throw new Error(`edge OPTIONS ${edgeProbe.status}`);
}

async function main() {
  const cfg = loadL7Config();
  console.log(`L11 MATCH RLS D2 · ref=${PROJECT_REF}${skipApply ? " · skip-apply" : ""}`);

  try {
    const pre = runSqlFile("sql/auth-hook-l11-pre-gates.sql");
    if (!pre || Number(pre.rls_enabled_count) !== 0) {
      throw new Error(`pre rls_enabled_count=${pre?.rls_enabled_count ?? "null"}, expected 0`);
    }
    pass("Pre-apply gate", "RLS disabled on 8 tables");
  } catch (e) {
    if (skipApply) {
      pass("Pre-apply gate", "skipped (--skip-apply · RLS may exist)");
    } else {
      fail("Pre-apply gate", e.message);
      process.exit(1);
    }
  }

  if (!skipApply) {
    try {
      applyMigration();
      pass("MATCH RLS D2 migration", MIGRATION);
    } catch (e) {
      fail("MATCH RLS D2 migration", e.message);
      process.exit(1);
    }
  } else {
    pass("MATCH RLS D2 migration", "skipped (--skip-apply)");
  }

  try {
    const row = runSqlFile("sql/auth-hook-l11-verify-gates.sql");
    if (!row) throw new Error("post gates returned no rows");
    assertPostGates(row);
    pass(
      "Post-apply schema gates",
      `rls=8 policies=${row.policy_count} helpers=3 legacy=7 allowlist=5`,
    );
  } catch (e) {
    fail("Post-apply schema gates", e.message);
    process.exit(1);
  }

  try {
    await runRlsRestTests(cfg);
    pass(
      "RLS REST permission tests",
      "own profile · cross-deny · swipe/block/report/verify · pairs · logs · anon/invalid/sub-only",
    );
  } catch (e) {
    fail("RLS REST permission tests", e.message);
    process.exit(1);
  }

  try {
    await runEdgeSmokeRegression();
    pass("Remote Edge smoke regression", "T1 swipe/self · report/block/verification · admin 403");
  } catch (e) {
    fail("Remote Edge smoke regression", e.message);
    process.exit(1);
  }

  try {
    await apiHealthSmoke(cfg);
    pass("API health", "auth/rest/edge no 5xx");
  } catch (e) {
    fail("API health", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL11 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_LINKED_REF_L12_HOOK_EXCEPTION");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
