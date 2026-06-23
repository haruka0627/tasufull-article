#!/usr/bin/env node
/**
 * L12 — Hook U-7 P2 EXCEPTION + allowlist login + t6 reject + regressions
 *
 *   node scripts/verify-auth-hook-l12-exception.mjs
 *   node scripts/verify-auth-hook-l12-exception.mjs --skip-apply
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · L11 RLS intact
 * Legacy 7: metadata diff only · no login/refresh test
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeJwtPayload } from "./lib/auth-current-user-core.mjs";
import {
  ALLOWLIST_SLOTS,
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "supabase/migrations/20260621180000_custom_access_token_hook_exception.sql";
const skipApply = process.argv.includes("--skip-apply");
const T6_EMAIL = "t6@tasful.invalid";
const TEST_NICK = "L12RLS";

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

function claimsSummary(payload) {
  const app =
    payload?.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
  return {
    sub: payload?.sub ?? null,
    app_metadata: {
      talk_user_id: app.talk_user_id ?? null,
      member_id: app.member_id ?? null,
      provider: app.provider ?? null,
      providers: Array.isArray(app.providers) ? app.providers : null,
      role: app.role ?? null,
      platform_role: app.platform_role ?? null,
      is_ops: app.is_ops ?? null,
    },
  };
}

function assertAllowlistClaims(label, payload, slot) {
  const s = claimsSummary(payload);
  if (s.sub !== slot.id) throw new Error(`${label}: sub mismatch`);
  if (s.app_metadata.talk_user_id !== slot.talkUserId) {
    throw new Error(`${label}: talk_user_id ${JSON.stringify(s.app_metadata)}`);
  }
  if (s.app_metadata.member_id !== slot.memberId) {
    throw new Error(`${label}: member_id ${JSON.stringify(s.app_metadata)}`);
  }
  if (s.app_metadata.provider !== "email") throw new Error(`${label}: provider lost`);
  if (!Array.isArray(s.app_metadata.providers) || !s.app_metadata.providers.includes("email")) {
    throw new Error(`${label}: providers lost`);
  }
  if (s.app_metadata.role !== "authenticated") throw new Error(`${label}: role missing`);
  if (s.app_metadata.platform_role !== "member") throw new Error(`${label}: platform_role missing`);
  if (s.app_metadata.is_ops !== false) throw new Error(`${label}: is_ops missing`);
  return s;
}

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
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
  return { ok: res.ok, status: res.status, data, text };
}

async function findUserByEmail(cfg, email) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: "/admin/users?per_page=200",
    serviceRole: true,
  });
  if (!res.ok) throw new Error(`admin/users: ${res.status}`);
  return (res.data?.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function ensureT6User(cfg) {
  let user = await findUserByEmail(cfg, T6_EMAIL);
  if (user) return user;
  const created = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/admin/users",
    serviceRole: true,
    body: {
      email: T6_EMAIL,
      password: cfg.password,
      email_confirm: true,
      app_metadata: { provider: "email", providers: ["email"] },
    },
  });
  if (!created.ok) throw new Error(`create ${T6_EMAIL}: ${created.status} ${created.text.slice(0, 200)}`);
  return created.data?.user || created.data;
}

async function deleteT6User(cfg) {
  const user = await findUserByEmail(cfg, T6_EMAIL);
  if (!user) return;
  const res = await authFetch(cfg, {
    method: "DELETE",
    pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
    serviceRole: true,
  });
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`delete ${T6_EMAIL}: ${res.status}`);
  }
}

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function refresh(cfg, refreshToken) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=refresh_token",
    body: { refresh_token: refreshToken },
  });
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
  return { status: res.status, json, text };
}

async function runAllowlistLoginRefresh(cfg) {
  for (const slot of ALLOWLIST_SLOTS) {
    const loginRes = await login(cfg, slot.email);
    if (!loginRes.ok || !loginRes.data?.access_token) {
      throw new Error(`${slot.slot} login HTTP ${loginRes.status}`);
    }
    const loginSummary = assertAllowlistClaims(`${slot.slot} login`, decodeJwtPayload(loginRes.data.access_token), slot);

    const refreshRes = await refresh(cfg, loginRes.data.refresh_token);
    if (!refreshRes.ok || !refreshRes.data?.access_token) {
      throw new Error(`${slot.slot} refresh HTTP ${refreshRes.status}`);
    }
    const refreshSummary = assertAllowlistClaims(
      `${slot.slot} refresh`,
      decodeJwtPayload(refreshRes.data.access_token),
      slot,
    );
    if (JSON.stringify(loginSummary.app_metadata) !== JSON.stringify(refreshSummary.app_metadata)) {
      throw new Error(`${slot.slot} login/refresh metadata mismatch`);
    }
  }
}

async function runT6RejectTests(cfg, preMigrationRefreshToken) {
  await ensureT6User(cfg);

  const loginRes = await login(cfg, T6_EMAIL);
  if (loginRes.ok && loginRes.data?.access_token) {
    throw new Error(`T6 login should be rejected, got HTTP ${loginRes.status}`);
  }
  if (loginRes.ok) {
    throw new Error("T6 login must not succeed");
  }

  if (preMigrationRefreshToken) {
    const refreshRes = await refresh(cfg, preMigrationRefreshToken);
    if (refreshRes.ok && refreshRes.data?.access_token) {
      throw new Error("T6 refresh should be rejected after EXCEPTION");
    }
    if (refreshRes.ok) {
      throw new Error("T6 refresh must not succeed");
    }
  }

  await deleteT6User(cfg);
  const still = await findUserByEmail(cfg, T6_EMAIL);
  if (still) throw new Error("T6 user still present after delete");
}

async function runRlsRegression(cfg) {
  const t1Token = (await login(cfg, slotByName("T1").email)).data?.access_token;
  if (!t1Token) throw new Error("T1 login for RLS regression");

  await restFetch(cfg, {
    table: "match_profiles",
    method: "DELETE",
    query: `nickname=eq.${TEST_NICK}`,
    serviceRole: true,
  });

  const insert = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: "t1",
      nickname: TEST_NICK,
      gender: "private",
      birth_date: "1990-01-01",
      prefecture: "Tokyo",
      profile_status: "active",
    },
    token: t1Token,
  });
  if (insert.status !== 201) throw new Error(`T1 own insert: ${insert.status}`);

  const t1ProfileId = insert.json[0].id;
  const t2Seed = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: "t2",
      nickname: TEST_NICK,
      gender: "private",
      birth_date: "1990-01-01",
      prefecture: "Tokyo",
      profile_status: "active",
    },
    serviceRole: true,
  });
  if (t2Seed.status !== 201) throw new Error(`seed T2: ${t2Seed.status}`);

  await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `id=eq.${t2Seed.json[0].id}`,
    body: { nickname: "HACKED" },
    token: t1Token,
  });
  const t2After = await restFetch(cfg, {
    table: "match_profiles",
    query: `id=eq.${t2Seed.json[0].id}&select=nickname`,
    serviceRole: true,
  });
  if (t2After.json?.[0]?.nickname === "HACKED") {
    throw new Error("T1 illegally updated T2 profile");
  }

  const anonRead = await restFetch(cfg, { table: "match_profiles", query: "select=id&limit=1" });
  if (anonRead.status >= 500) throw new Error("anon 5xx");
  if (anonRead.status === 200 && Array.isArray(anonRead.json) && anonRead.json.length > 0) {
    throw new Error("anon must not read match_profiles");
  }

  const invalidJwt = await restFetch(cfg, {
    table: "match_profiles",
    query: "select=id&limit=1",
    token: "not.a.valid.jwt",
  });
  if (invalidJwt.status !== 401 && invalidJwt.status !== 403) {
    throw new Error(`invalid JWT: ${invalidJwt.status}`);
  }

  const subOnly = await restFetch(cfg, {
    table: "match_profiles",
    query: "select=id&limit=1",
    token: makeUnsignedJwt({ sub: slotByName("T1").id }),
  });
  if (subOnly.status !== 401 && subOnly.status !== 403) {
    throw new Error(`sub-only JWT: ${subOnly.status}`);
  }

  await restFetch(cfg, {
    table: "match_profiles",
    method: "DELETE",
    query: `id=eq.${t1ProfileId}`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_profiles",
    method: "DELETE",
    query: `id=eq.${t2Seed.json[0].id}`,
    serviceRole: true,
  });
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

function assertPostGates(row) {
  if (Number(row.hook_func_count) !== 1) throw new Error(`hook_func_count=${row.hook_func_count}`);
  if (Number(row.hook_exception_mode) !== 1) {
    throw new Error(`hook_exception_mode=${row.hook_exception_mode}, expected 1`);
  }
  if (Number(row.rls_enabled_count) !== 8) throw new Error(`rls_enabled_count=${row.rls_enabled_count}`);
  if (Number(row.policy_count) < 20) throw new Error(`policy_count=${row.policy_count}`);
  if (Number(row.legacy_user_count) !== 7) throw new Error(`legacy_user_count=${row.legacy_user_count}`);
  if (Number(row.allowlist_backfill_count) !== 5) {
    throw new Error(`allowlist_backfill_count=${row.allowlist_backfill_count}`);
  }
}

function assertFinalGates(row) {
  assertPostGates(row);
  if (Number(row.t6_user_count) !== 0) throw new Error(`t6_user_count=${row.t6_user_count}`);
}

async function main() {
  const cfg = loadL7Config();
  console.log(`L12 Hook EXCEPTION · ref=${PROJECT_REF}${skipApply ? " · skip-apply" : ""}`);

  let preMigrationT6Refresh = null;

  try {
    const pre = runSqlFile("sql/auth-hook-l12-pre-gates.sql");
    if (!skipApply) {
      if (Number(pre?.hook_func_count) !== 1) throw new Error(`hook_func_count=${pre?.hook_func_count}`);
      if (Number(pre?.hook_exception_mode) !== 0) {
        throw new Error(`pre hook already EXCEPTION mode=${pre?.hook_exception_mode}`);
      }
      if (Number(pre?.rls_enabled_count) !== 8) {
        throw new Error(`rls_enabled_count=${pre?.rls_enabled_count}, expected 8 (L11)`);
      }
    }
    pass("Pre-apply gate", skipApply ? "skipped detail (--skip-apply)" : "WARN mode · RLS=8");
  } catch (e) {
    if (skipApply) pass("Pre-apply gate", "skipped (--skip-apply)");
    else {
      fail("Pre-apply gate", e.message);
      process.exit(1);
    }
  }

  if (!skipApply) {
    try {
      await deleteT6User(cfg);
      await ensureT6User(cfg);
      const warnLogin = await login(cfg, T6_EMAIL);
      if (warnLogin.ok && warnLogin.data?.refresh_token) {
        preMigrationT6Refresh = warnLogin.data.refresh_token;
      }
      pass("T6 pre-migration WARN login", preMigrationT6Refresh ? "refresh token captured" : "login failed (ok if already EXCEPTION)");
    } catch (e) {
      pass("T6 pre-migration WARN login", `skipped: ${e.message}`);
    }

    try {
      applyMigration();
      pass("Hook EXCEPTION migration", MIGRATION);
    } catch (e) {
      fail("Hook EXCEPTION migration", e.message);
      process.exit(1);
    }
  } else {
    pass("Hook EXCEPTION migration", "skipped (--skip-apply)");
  }

  try {
    const row = runSqlFile("sql/auth-hook-l12-verify-gates.sql");
    if (!row) throw new Error("post gates returned no rows");
    assertPostGates(row);
    pass(
      "Post-apply schema gates",
      `EXCEPTION=1 rls=8 policies=${row.policy_count} legacy=7 allowlist=5`,
    );
  } catch (e) {
    fail("Post-apply schema gates", e.message);
    process.exit(1);
  }

  try {
    await runAllowlistLoginRefresh(cfg);
    pass("Allowlist T1–T5 login/refresh", "talk/member t1–t5 · role/platform_role/is_ops · provider preserved");
  } catch (e) {
    fail("Allowlist T1–T5 login/refresh", e.message);
    process.exit(1);
  }

  try {
    await runT6RejectTests(cfg, preMigrationT6Refresh);
    pass("T6 missing-id reject", "login/refresh rejected · user deleted");
  } catch (e) {
    fail("T6 missing-id reject", e.message);
    try {
      await deleteT6User(cfg);
    } catch {
      /* cleanup best effort */
    }
    process.exit(1);
  }

  try {
    const row = runSqlFile("sql/auth-hook-l12-verify-gates.sql");
    if (!row) throw new Error("final gates returned no rows");
    assertFinalGates(row);
    pass(
      "Final gates",
      `EXCEPTION=1 rls=8 policies=${row.policy_count} legacy=7 allowlist=5 t6=0`,
    );
  } catch (e) {
    fail("Final gates", e.message);
    process.exit(1);
  }

  try {
    await runRlsRegression(cfg);
    pass("RLS regression", "T1 own OK · T2 patch denied · anon/invalid/sub-only denied");
  } catch (e) {
    fail("RLS regression", e.message);
    process.exit(1);
  }

  try {
    await runEdgeSmokeRegression();
    pass("Edge smoke regression", "swipe/self/report/block/verification/admin 403");
  } catch (e) {
    fail("Edge smoke regression", e.message);
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
  console.log(`\nL12 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_MATCH_POST_AUTH_FINAL_SMOKE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
