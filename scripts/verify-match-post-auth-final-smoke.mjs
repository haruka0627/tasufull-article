#!/usr/bin/env node
/**
 * MATCH post-auth final smoke — L0–L12 integration gate
 *
 *   node scripts/verify-match-post-auth-final-smoke.mjs
 *   node scripts/verify-match-post-auth-final-smoke.mjs --skip-ui
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · EXCEPTION · RLS D2
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canUseLocalStorageFallback,
  decodeJwtPayload,
  extractClaimsFromJwt,
} from "./lib/auth-current-user-core.mjs";
import {
  ALLOWLIST_SLOTS,
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  STANDARD_LOCAL_BASE,
  findDevServerBaseUrl,
  buildLocalPageUrl,
} from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_GATES = "sql/match-post-auth-final-smoke-readonly.sql";
const T6_EMAIL = "t6@tasful.invalid";
const TEST_NICK = "FINALSMOKE";
const skipUi = process.argv.includes("--skip-ui");

/** MATCH Edge deploy targets (L9) */
const MATCH_EDGE_FUNCTIONS = Object.freeze([
  "match-record-swipe",
  "match-ensure-talk-room",
  "match-submit-report",
  "match-block-user",
  "match-submit-verification",
  "match-admin-review",
  "match-moderation-log",
]);

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

function runSqlGates() {
  const sqlPath = path.join(ROOT, SQL_GATES);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`SQL gates failed: ${combined.slice(0, 500)}`);
  const row = parseCliJson(combined)?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no combined row");
  return row;
}

function assertSqlGates(row) {
  if (Number(row.hook_func_count) !== 1) throw new Error(`hook_func_count=${row.hook_func_count}`);
  if (Number(row.hook_exception_mode) !== 1) {
    throw new Error(`hook_exception_mode=${row.hook_exception_mode}`);
  }
  if (Number(row.core_table_count) !== 8) throw new Error(`core_table_count=${row.core_table_count}`);
  if (Number(row.rls_enabled_count) !== 8) throw new Error(`rls_enabled_count=${row.rls_enabled_count}`);
  if (Number(row.policy_count) !== 20) throw new Error(`policy_count=${row.policy_count}`);
  if (Number(row.legacy_user_count) !== 7) throw new Error(`legacy_user_count=${row.legacy_user_count}`);
  if (Number(row.allowlist_backfill_count) !== 5) {
    throw new Error(`allowlist_backfill_count=${row.allowlist_backfill_count}`);
  }
  if (Number(row.t6_user_count) !== 0) throw new Error(`t6_user_count=${row.t6_user_count}`);
}

function resolveTasuAuthCurrentUser(session) {
  const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
  const user = session?.user || null;
  const claims = extractClaimsFromJwt(payload, user);
  const prodEnv = { hostname: "tasful.jp", config: { talkProductionMode: true } };
  if (canUseLocalStorageFallback(prodEnv)) {
    throw new Error("expected production lockdown (source must be jwt)");
  }
  const talkUserId = String(claims.talk_user_id || "").trim();
  return {
    talkUserId,
    memberId: String(claims.member_id || talkUserId).trim(),
    authUserId: claims.sub || "",
    source: talkUserId ? "jwt" : "none",
  };
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
  if (await findUserByEmail(cfg, T6_EMAIL)) return;
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
  if (!created.ok) throw new Error(`create t6: ${created.status}`);
}

async function deleteT6User(cfg) {
  const user = await findUserByEmail(cfg, T6_EMAIL);
  if (!user) return;
  const res = await authFetch(cfg, {
    method: "DELETE",
    pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
    serviceRole: true,
  });
  if (res.status !== 200 && res.status !== 204) throw new Error(`delete t6: ${res.status}`);
}

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function refreshToken(cfg, refreshTokenValue) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=refresh_token",
    body: { refresh_token: refreshTokenValue },
  });
}

async function runAllowlistAuth(cfg) {
  for (const slot of ALLOWLIST_SLOTS) {
    const loginRes = await login(cfg, slot.email);
    if (!loginRes.ok || !loginRes.data?.access_token) {
      throw new Error(`${slot.slot} login HTTP ${loginRes.status}`);
    }
    const loginPayload = decodeJwtPayload(loginRes.data.access_token);
    const app = loginPayload?.app_metadata || {};
    if (app.talk_user_id !== slot.talkUserId || app.member_id !== slot.memberId) {
      throw new Error(`${slot.slot} JWT talk/member mismatch`);
    }
    if (app.role !== "authenticated" || app.platform_role !== "member" || app.is_ops !== false) {
      throw new Error(`${slot.slot} hook merge missing`);
    }

    const refreshRes = await refreshToken(cfg, loginRes.data.refresh_token);
    if (!refreshRes.ok || !refreshRes.data?.access_token) {
      throw new Error(`${slot.slot} refresh HTTP ${refreshRes.status}`);
    }

    const tasu = resolveTasuAuthCurrentUser({
      access_token: refreshRes.data.access_token,
      user: refreshRes.data.user || loginRes.data.user,
    });
    if (tasu.source !== "jwt") throw new Error(`${slot.slot} TasuAuth source=${tasu.source}`);
    if (tasu.talkUserId !== slot.talkUserId) throw new Error(`${slot.slot} talkUserId=${tasu.talkUserId}`);
    if (tasu.memberId !== slot.memberId) throw new Error(`${slot.slot} memberId=${tasu.memberId}`);
  }
}

async function runMissingUserReject(cfg) {
  await deleteT6User(cfg);
  await ensureT6User(cfg);
  const loginRes = await login(cfg, T6_EMAIL);
  if (loginRes.ok && loginRes.data?.access_token) {
    throw new Error("t6 login must not issue token");
  }
  await deleteT6User(cfg);
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

async function runRlsRegression(cfg) {
  const t1Login = await login(cfg, slotByName("T1").email);
  const t1Token = t1Login.data?.access_token;
  if (!t1Token) throw new Error("T1 login for RLS");

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
  const t2Id = t2Seed.json?.[0]?.id;

  await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `id=eq.${t2Id}`,
    body: { nickname: "HACKED" },
    token: t1Token,
  });
  const t2After = await restFetch(cfg, {
    table: "match_profiles",
    query: `id=eq.${t2Id}&select=nickname`,
    serviceRole: true,
  });
  if (t2After.json?.[0]?.nickname === "HACKED") throw new Error("T1 updated T2 illegally");

  const pairSeed = await restFetch(cfg, {
    table: "match_pairs",
    method: "POST",
    body: { user_low_id: "t1", user_high_id: "t2", status: "active" },
    serviceRole: true,
  });
  if (pairSeed.status !== 201) throw new Error(`pair seed: ${pairSeed.status}`);

  const t1Pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: "select=id&user_low_id=eq.t1",
    token: t1Token,
  });
  if (!Array.isArray(t1Pairs.json) || t1Pairs.json.length < 1) throw new Error("T1 pair read denied");

  const t3Login = await login(cfg, slotByName("T3").email);
  const t3Pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: "select=id&user_low_id=eq.t1",
    token: t3Login.data.access_token,
  });
  if (Array.isArray(t3Pairs.json) && t3Pairs.json.length > 0) throw new Error("T3 read pair denied fail");

  const anonRead = await restFetch(cfg, { table: "match_profiles", query: "select=id&limit=1" });
  if (anonRead.status === 200 && Array.isArray(anonRead.json) && anonRead.json.length > 0) {
    throw new Error("anon read denied fail");
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
    table: "match_pairs",
    method: "DELETE",
    query: `user_low_id=eq.t1&user_high_id=eq.t2`,
    serviceRole: true,
  });
  await restFetch(cfg, {
    table: "match_profiles",
    method: "DELETE",
    query: `nickname=eq.${TEST_NICK}`,
    serviceRole: true,
  });
}

function verifyFunctionsListed() {
  const r = runSupabaseCli(["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`functions list failed: ${combined.slice(0, 400)}`);
  const jsonStart = combined.indexOf("[");
  const jsonEnd = combined.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < 0) throw new Error("could not parse functions list");
  const list = JSON.parse(combined.slice(jsonStart, jsonEnd + 1));
  const slugs = new Set(list.map((f) => f.slug || f.name));
  const missing = MATCH_EDGE_FUNCTIONS.filter((name) => !slugs.has(name));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
  const active = list.filter(
    (f) => MATCH_EDGE_FUNCTIONS.includes(f.slug || f.name) && f.status !== "INACTIVE",
  );
  if (active.length !== MATCH_EDGE_FUNCTIONS.length) {
    throw new Error(`active count=${active.length}, expected ${MATCH_EDGE_FUNCTIONS.length}`);
  }
  return active.length;
}

async function edgePost(cfg, functionName, body, headers = {}, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }
    if (res.status !== 502 || attempt === retries) {
      return { status: res.status, json };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("edgePost retry exhausted");
}

async function runEdgeSmoke(cfg) {
  const tokens = new Map();
  for (const slot of ALLOWLIST_SLOTS) {
    const res = await login(cfg, slot.email);
    if (!res.ok || !res.data?.access_token) throw new Error(`${slot.slot} edge login`);
    tokens.set(slot.slot, res.data.access_token);
  }

  const t1Auth = { Authorization: `Bearer ${tokens.get("T1")}` };
  const warm = await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Auth, 2);
  if (warm.status !== 200) throw new Error(`T1 swipe: ${warm.status}`);

  const self = await edgePost(
    cfg,
    "match-record-swipe",
    { target_user_id: "t1", action: "like" },
    t1Auth,
  );
  if (self.status !== 422) throw new Error(`T1 self-swipe: ${self.status}`);

  for (const [name, body] of [
    ["match-submit-report", { reported_user_id: "t2", reason: "harassment", context_type: "profile" }],
    ["match-block-user", { blocked_user_id: "t3", reason: "smoke" }],
    ["match-submit-verification", { verification_type: "phone", metadata: {} }],
  ]) {
    const res = await edgePost(cfg, name, body, t1Auth);
    if (res.status !== 200 || res.json?.ok !== true) {
      throw new Error(`${name}: ${res.status} ${JSON.stringify(res.json)}`);
    }
  }

  const admin = await edgePost(
    cfg,
    "match-admin-review",
    {
      target_type: "report",
      target_id: "00000000-0000-4000-8000-000000000001",
      action: "dismiss",
      note: "final smoke",
    },
    t1Auth,
  );
  if (admin.status !== 403) throw new Error(`admin-review: ${admin.status}`);
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

async function probeUiBase(base) {
  try {
    const res = await fetch(`${base}/match/match-top.html`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureUiBaseUrl() {
  try {
    return await findDevServerBaseUrl({ probePath: "match/match-top.html" });
  } catch {
    /* start wrangler */
  }

  const distMarker = path.join(ROOT, "deploy/cloudflare/dist/match/match-top.html");
  if (!fs.existsSync(distMarker)) {
    throw new Error("deploy/cloudflare/dist/match missing — run npm run build:pages");
  }

  const child = spawn(
    "npx",
    ["wrangler", "pages", "dev", "deploy/cloudflare/dist", "--port", "8788", "--ip", "127.0.0.1"],
    { cwd: ROOT, shell: true, stdio: "ignore", detached: true },
  );
  child.unref();

  for (let i = 0; i < 90; i += 1) {
    if (await probeUiBase(STANDARD_LOCAL_BASE)) return STANDARD_LOCAL_BASE;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("wrangler pages dev did not become ready on :8788");
}

async function runMatchUiSmoke(base) {
  const checks = [
    {
      name: "profile create",
      path: "match/match-profile-create.html",
      probe: () => ({
        wizard: Boolean(document.querySelector("[data-match-profile-wizard]")),
        next: Boolean(document.querySelector("[data-match-step-next]")),
      }),
      assert: (r) => r.wizard && r.next,
    },
    {
      name: "swipe",
      path: "match/match-swipe.html",
      probe: () => ({
        like: Boolean(document.querySelector('[data-match-swipe-action="like"]')),
        wiring: typeof window.MatchWiring === "object",
      }),
      assert: (r) => r.like && r.wiring,
    },
    {
      name: "list",
      path: "match/match-list.html",
      probe: () => ({
        pairList: Boolean(document.querySelector("[data-match-pair-list]")),
        tabbar: Boolean(document.querySelector('.match-tabbar__link[href="match-list.html"]')),
      }),
      assert: (r) => r.pairList && r.tabbar,
    },
    {
      name: "talk bridge",
      path: "match/match-talk-bridge.html",
      probe: () => ({
        cta: Boolean(document.querySelector("[data-match-talk-cta]")),
        wiring: typeof window.TasfulMatchAPI?.ensureTalkRoom === "function",
      }),
      assert: (r) => r.cta && r.wiring,
    },
    {
      name: "safety",
      path: "match/match-safety.html",
      probe: () => ({
        hero: Boolean(document.querySelector(".match-safety-hero")),
        verifyLink: Boolean(document.querySelector('a[href="match-verify.html"]')),
      }),
      assert: (r) => r.hero && r.verifyLink,
    },
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const check of checks) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      const url = buildLocalPageUrl(base, check.path);
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      if (!res || res.status() >= 400) throw new Error(`${check.name} HTTP ${res?.status()}`);

      const probe = await page.evaluate(check.probe);
      if (!check.assert(probe)) throw new Error(`${check.name} probe failed: ${JSON.stringify(probe)}`);
      if (errors.length) throw new Error(`${check.name} console: ${errors.join(" | ")}`);

      await page.close();
    }

    const swipePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await swipePage.goto(buildLocalPageUrl(base, "match/match-swipe.html"), {
      waitUntil: "networkidle",
    });
    const swipeAction = await swipePage.evaluate(async () => {
      const calls = [];
      const api = window.TasfulMatchAPI;
      if (!api?.recordSwipe) return { ok: false, reason: "no api" };
      const orig = api.recordSwipe.bind(api);
      api.recordSwipe = async (payload) => {
        calls.push(payload);
        return orig(payload);
      };
      document.querySelector('[data-match-swipe-action="skip"]')?.click();
      await new Promise((r) => setTimeout(r, 80));
      return { ok: calls.length > 0, calls };
    });
    if (!swipeAction.ok) throw new Error("swipe action wiring failed");
    await swipePage.close();
  });

  await closeAllBrowsers();
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH post-auth final smoke · ref=${PROJECT_REF}${skipUi ? " · skip-ui" : ""}`);

  try {
    const row = runSqlGates();
    assertSqlGates(row);
    pass(
      "SQL schema/RLS/metadata gates",
      `tables=8 rls=8 policies=20 hook=EXCEPTION legacy=7 allowlist=5`,
    );
  } catch (e) {
    fail("SQL schema/RLS/metadata gates", e.message);
    process.exit(1);
  }

  try {
    await runAllowlistAuth(cfg);
    pass("T1–T5 login/refresh + TasuAuth", "source=jwt · talk/member t1–t5");
  } catch (e) {
    fail("T1–T5 login/refresh + TasuAuth", e.message);
    process.exit(1);
  }

  try {
    await runMissingUserReject(cfg);
    pass("Missing-id user reject", "t6@tasful.invalid login denied · user removed");
  } catch (e) {
    fail("Missing-id user reject", e.message);
    try {
      await deleteT6User(cfg);
    } catch {
      /* best effort */
    }
    process.exit(1);
  }

  try {
    const n = verifyFunctionsListed();
    pass("MATCH Edge functions", `${n} ACTIVE on linked ref`);
  } catch (e) {
    fail("MATCH Edge functions", e.message);
    process.exit(1);
  }

  try {
    await runEdgeSmoke(cfg);
    pass("Remote Edge smoke", "swipe 200 · self 422 · report/block/verification 200 · admin 403");
  } catch (e) {
    fail("Remote Edge smoke", e.message);
    process.exit(1);
  }

  try {
    await runRlsRegression(cfg);
    pass("RLS regression", "own OK · cross-update denied · pair participant · anon/invalid/sub-only");
  } catch (e) {
    fail("RLS regression", e.message);
    process.exit(1);
  }

  try {
    await apiHealthSmoke(cfg);
    pass("API health", "auth/rest/edge no 5xx");
  } catch (e) {
    fail("API health", e.message);
    process.exit(1);
  }

  if (!skipUi) {
    try {
      const base = await ensureUiBaseUrl();
      await runMatchUiSmoke(base);
      pass("MATCH UI flows", `profile/swipe/list/talk/safety @ ${base}`);
    } catch (e) {
      fail("MATCH UI flows", e.message);
      process.exit(1);
    }
  } else {
    pass("MATCH UI flows", "skipped (--skip-ui)");
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nFinal smoke result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_MATCH_UI_PROD_URL_REVIEW");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
