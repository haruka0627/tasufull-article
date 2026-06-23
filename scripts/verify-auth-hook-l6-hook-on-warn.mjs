#!/usr/bin/env node
/**
 * L6 — Dashboard Custom Access Token Hook ON + WARN monitoring
 *
 *   node scripts/verify-auth-hook-l6-hook-on-warn.mjs
 *   node scripts/verify-auth-hook-l6-hook-on-warn.mjs --skip-enable   # hook already ON
 *
 * Enable (if not --skip-enable):
 *   npx supabase config push --project-ref ddojquacsyqesrjhcvmn --yes
 *
 * Ref: ddojquacsyqesrjhcvmn only
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  decodeJwtPayload,
  extractClaimsFromJwt,
  canUseLocalStorageFallback,
} from "./lib/auth-current-user-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const HOOK_URI = "pg-functions://postgres/public/custom_access_token_hook";

const T1 = {
  email: "t1@tasful.invalid",
  authUserId: "2d537fc9-ee67-4da8-97d3-bafe824ba466",
  talkUserId: "t1",
  memberId: "t1",
};

const T2 = {
  email: "t2@tasful.invalid",
  authUserId: "d9f57cfa-61f9-4426-ad6a-78ebbd1b7723",
};

const args = new Set(process.argv.slice(2));
const skipEnable = args.has("--skip-enable");

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
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  if (ref !== PROJECT_REF) {
    throw new Error(`Ref mismatch: expected ${PROJECT_REF}, got ${ref || url}`);
  }
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  if (!password) throw new Error("AUTH_HOOK_L2_ALLOWLIST_PASSWORD required (.env)");
  return { url, anonKey, password };
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
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/) || out.match(/\{[\s\S]*"backups"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function claimsSummary(payload) {
  const app = payload?.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
  return {
    sub: payload?.sub ?? null,
    role: payload?.role ?? null,
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

function hookOffSignal(appMeta) {
  return appMeta.platform_role == null && appMeta.role == null && appMeta.is_ops == null;
}

function hookOnSignal(appMeta) {
  return (
    appMeta.platform_role === "member" &&
    appMeta.role === "authenticated" &&
    appMeta.is_ops === false
  );
}

function assertT1JwtClaims(label, payload, expectHookOn) {
  const s = claimsSummary(payload);
  if (s.sub !== T1.authUserId) throw new Error(`${label}: sub mismatch ${s.sub}`);
  if (s.app_metadata.talk_user_id !== T1.talkUserId) {
    throw new Error(`${label}: talk_user_id mismatch ${JSON.stringify(s)}`);
  }
  if (s.app_metadata.member_id !== T1.memberId) {
    throw new Error(`${label}: member_id mismatch ${JSON.stringify(s)}`);
  }
  if (s.app_metadata.provider !== "email") throw new Error(`${label}: provider lost`);
  if (!Array.isArray(s.app_metadata.providers) || !s.app_metadata.providers.includes("email")) {
    throw new Error(`${label}: providers lost`);
  }
  if (expectHookOn) {
    if (!hookOnSignal(s.app_metadata)) {
      throw new Error(`${label}: hook ON signal missing ${JSON.stringify(s.app_metadata)}`);
    }
  }
  return s;
}

function assertT2JwtClaims(label, payload) {
  const s = claimsSummary(payload);
  if (s.sub !== T2.authUserId) throw new Error(`${label}: sub mismatch ${s.sub}`);
  if (s.app_metadata.talk_user_id != null) {
    throw new Error(`${label}: unexpected talk_user_id ${s.app_metadata.talk_user_id}`);
  }
  if (s.app_metadata.member_id != null) {
    throw new Error(`${label}: unexpected member_id ${s.app_metadata.member_id}`);
  }
  if (s.app_metadata.provider !== "email") throw new Error(`${label}: provider lost`);
  if (!Array.isArray(s.app_metadata.providers) || !s.app_metadata.providers.includes("email")) {
    throw new Error(`${label}: providers lost`);
  }
  return s;
}

async function authFetch(cfg, { method, pathSuffix, body }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
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

async function signIn(cfg, email, password) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password },
  });
}

async function refreshToken(cfg, refreshTokenValue) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=refresh_token",
    body: { refresh_token: refreshTokenValue },
  });
}

async function rpcTalkCurrentUserId(cfg, accessToken) {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/talk_current_user_id`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`rpc talk_current_user_id: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text.replace(/^"|"$/g, "");
  }
}

function resolveTasuAuthCurrentUser(session) {
  const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
  const user = session?.user || null;
  const claims = extractClaimsFromJwt(payload, user);
  const prodEnv = { hostname: "tasful.jp", config: { talkProductionMode: true } };
  if (!canUseLocalStorageFallback(prodEnv)) {
    const talkUserId = String(claims.talk_user_id || claims.sub || "").trim();
    return {
      authenticated: Boolean(talkUserId),
      sub: claims.sub || "",
      talkUserId,
      memberId: String(claims.member_id || talkUserId).trim(),
      authUserId: claims.sub || "",
      source: talkUserId ? "jwt" : "none",
    };
  }
  throw new Error("expected production lockdown");
}

function preCheckArtifacts() {
  const required = [
    "reports/tasful-auth-linked-ref-l1-backup-baseline.md",
    "reports/tasful-auth-linked-ref-l5-hook-create-off.md",
    "supabase/migrations/20260621150000_create_custom_access_token_hook.sql",
  ];
  for (const rel of required) {
    if (!existsSync(path.join(ROOT, rel))) {
      throw new Error(`missing prerequisite artifact: ${rel}`);
    }
  }
  const l5 = readFileSync(path.join(ROOT, "reports/tasful-auth-linked-ref-l5-hook-create-off.md"), "utf8");
  if (!/drop function if exists public\.custom_access_token_hook/i.test(l5)) {
    throw new Error("L5 report missing rollback SQL");
  }
}

function preCheckBackups() {
  const r = runSupabaseCli(["backups", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
  const parsed = parseCliJson(`${r.stdout}\n${r.stderr}`);
  if (r.status !== 0 || !parsed) {
    throw new Error(`backups list failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
  }
  return {
    pitr_enabled: parsed.pitr_enabled ?? null,
    walg_enabled: parsed.walg_enabled ?? null,
    backup_count: Array.isArray(parsed.backups) ? parsed.backups.length : null,
    region: parsed.region ?? null,
  };
}

function runSqlGates() {
  const sqlPath = path.join(ROOT, "sql/auth-hook-l6-verify-gates.sql");
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) {
    throw new Error(`SQL gates failed: ${combined.slice(0, 500)}`);
  }
  const parsed = parseCliJson(combined);
  const row = parsed?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no rows");

  if (Number(row.hook_func_count) !== 1) throw new Error(`hook_func_count=${row.hook_func_count}`);
  if (Number(row.match_table_count) !== 0) throw new Error(`match_table_count=${row.match_table_count}`);
  if (row.t1_db_talk_user_id !== "t1" || row.t1_db_member_id !== "t1") {
    throw new Error(`T1 DB metadata changed: ${JSON.stringify(row)}`);
  }
  if (Number(row.t2_t5_with_talk_member) !== 0) {
    throw new Error(`T2-T5 talk/member unexpectedly set: ${row.t2_t5_with_talk_member}`);
  }
  if (Number(row.legacy_user_count) !== 7) {
    throw new Error(`legacy user count=${row.legacy_user_count}, expected 7`);
  }
  return row;
}

function enableHookViaConfigPush() {
  const cfgPath = path.join(ROOT, "supabase/config.toml");
  const cfg = readFileSync(cfgPath, "utf8");
  if (!cfg.includes("[auth.hook.custom_access_token]")) {
    throw new Error("config.toml missing [auth.hook.custom_access_token]");
  }
  if (!cfg.includes(HOOK_URI)) {
    throw new Error(`config.toml missing hook uri ${HOOK_URI}`);
  }
  const r = runSupabaseCli(["config", "push", "--project-ref", PROJECT_REF, "--yes"]);
  if (r.status !== 0) {
    throw new Error(`config push failed: ${(r.stderr || r.stdout).slice(0, 500)}`);
  }
  return (r.stdout || r.stderr || "").trim();
}

async function apiSmoke(cfg) {
  const authHealth = await fetch(`${cfg.url}/auth/v1/health`, {
    headers: { apikey: cfg.anonKey },
  });
  const restHead = await fetch(`${cfg.url}/rest/v1/`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  });
  return {
    authHealthStatus: authHealth.status,
    restStatus: restHead.status,
  };
}

async function main() {
  const cfg = loadConfig();
  console.log(`L6 verify · ref=${PROJECT_REF} · Hook ON + WARN${skipEnable ? " · skip-enable" : ""}`);

  try {
    preCheckArtifacts();
    pass("Prerequisite artifacts", "L1 baseline + L5 rollback SQL present");
  } catch (e) {
    fail("Prerequisite artifacts", e.message);
    process.exit(1);
  }

  let backupInfo;
  try {
    backupInfo = preCheckBackups();
    pass(
      "Backup/PITR state",
      `pitr=${backupInfo.pitr_enabled} walg=${backupInfo.walg_enabled} backups=${backupInfo.backup_count} region=${backupInfo.region}`
    );
  } catch (e) {
    fail("Backup/PITR state", e.message);
    process.exit(1);
  }

  let preLogin;
  try {
    preLogin = await signIn(cfg, T1.email, cfg.password);
    if (!preLogin.ok) throw new Error(`HTTP ${preLogin.status}`);
    const prePayload = decodeJwtPayload(preLogin.data.access_token);
    const preSummary = claimsSummary(prePayload);
    if (!skipEnable && !hookOffSignal(preSummary.app_metadata)) {
      pass("Pre-enable Hook OFF signal", "already shows hook merge fields (may be ON)");
    } else if (hookOffSignal(preSummary.app_metadata)) {
      pass("Pre-enable Hook OFF signal", "no hook merge fields in app_metadata");
    } else {
      pass("Pre-enable JWT baseline", JSON.stringify(preSummary.app_metadata));
    }
  } catch (e) {
    fail("Pre-enable T1 login", e.message);
    process.exit(1);
  }

  if (!skipEnable) {
    try {
      const pushOut = enableHookViaConfigPush();
      pass("Dashboard Hook ON (config push)", `uri=${HOOK_URI}`);
      if (pushOut) console.log(`    push: ${pushOut.split("\n").slice(-3).join(" | ")}`);
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      fail("Dashboard Hook ON", e.message);
      process.exit(1);
    }
  } else {
    pass("Dashboard Hook ON", "skipped (--skip-enable)");
  }

  try {
    runSqlGates();
    pass("SQL DB gates", "hook=1 match=0 T1/T2-T5/legacy unchanged");
  } catch (e) {
    fail("SQL DB gates", e.message);
    process.exit(1);
  }

  const login = await signIn(cfg, T1.email, cfg.password);
  if (!login.ok || !login.data?.access_token) {
    fail("T1 login", `HTTP ${login.status} ${login.text?.slice(0, 120)}`);
    console.error("ROLLBACK: Dashboard Hook OFF required");
    process.exit(1);
  }
  pass("T1 login", `HTTP ${login.status}`);

  let loginSummary;
  try {
    const loginPayload = decodeJwtPayload(login.data.access_token);
    loginSummary = assertT1JwtClaims("login JWT", loginPayload, true);
    pass("T1 login JWT claims", JSON.stringify(loginSummary.app_metadata));
  } catch (e) {
    fail("T1 login JWT", e.message);
    console.error("ROLLBACK: set [auth.hook.custom_access_token] enabled=false and config push");
    process.exit(1);
  }

  const refreshed = await refreshToken(cfg, login.data.refresh_token);
  if (!refreshed.ok || !refreshed.data?.access_token) {
    fail("T1 refresh", `HTTP ${refreshed.status}`);
    process.exit(1);
  }
  pass("T1 refresh", `HTTP ${refreshed.status}`);

  let refreshSummary;
  try {
    const refreshPayload = decodeJwtPayload(refreshed.data.access_token);
    refreshSummary = assertT1JwtClaims("refresh JWT", refreshPayload, true);
    pass("T1 refresh JWT claims", JSON.stringify(refreshSummary.app_metadata));

    const loginApp = JSON.stringify(loginSummary.app_metadata);
    const refreshApp = JSON.stringify(refreshSummary.app_metadata);
    if (loginApp !== refreshApp) {
      throw new Error(`login vs refresh mismatch: ${loginApp} vs ${refreshApp}`);
    }
    pass("T1 login/refresh claim parity", "identical app_metadata");
  } catch (e) {
    fail("T1 refresh JWT", e.message);
    process.exit(1);
  }

  try {
    const rpcLogin = await rpcTalkCurrentUserId(cfg, login.data.access_token);
    const rpcRefresh = await rpcTalkCurrentUserId(cfg, refreshed.data.access_token);
    if (rpcLogin !== T1.talkUserId || rpcRefresh !== T1.talkUserId) {
      throw new Error(`RPC mismatch login=${rpcLogin} refresh=${rpcRefresh}`);
    }
    pass("Postgres auth.jwt() proxy", `talk_current_user_id=${rpcRefresh}`);
  } catch (e) {
    fail("Postgres auth.jwt() proxy", e.message);
    process.exit(1);
  }

  try {
    const session = {
      access_token: refreshed.data.access_token,
      user: refreshed.data.user || login.data.user,
    };
    const tasu = resolveTasuAuthCurrentUser(session);
    if (tasu.talkUserId !== T1.talkUserId) throw new Error(`talkUserId=${tasu.talkUserId}`);
    if (tasu.memberId !== T1.memberId) throw new Error(`memberId=${tasu.memberId}`);
    if (tasu.authUserId !== T1.authUserId) throw new Error(`authUserId=${tasu.authUserId}`);
    if (tasu.source !== "jwt") throw new Error(`source=${tasu.source}`);
    pass(
      "TasuAuthCurrentUser",
      `talk=${tasu.talkUserId} member=${tasu.memberId} source=${tasu.source}`
    );
  } catch (e) {
    fail("TasuAuthCurrentUser", e.message);
    process.exit(1);
  }

  const t2Login = await signIn(cfg, T2.email, cfg.password);
  if (!t2Login.ok || !t2Login.data?.access_token) {
    fail("T2 login", `HTTP ${t2Login.status} ${t2Login.text?.slice(0, 120)}`);
    process.exit(1);
  }
  pass("T2 login (WARN path)", `HTTP ${t2Login.status}`);

  try {
    const t2Payload = decodeJwtPayload(t2Login.data.access_token);
    const t2Summary = assertT2JwtClaims("T2 login JWT", t2Payload);
    pass("T2 login JWT (missing talk/member OK)", JSON.stringify(t2Summary.app_metadata));
  } catch (e) {
    fail("T2 login JWT", e.message);
    process.exit(1);
  }

  try {
    const smoke = await apiSmoke(cfg);
    if (smoke.authHealthStatus >= 500) throw new Error(`auth health ${smoke.authHealthStatus}`);
    if (smoke.restStatus >= 500) throw new Error(`rest ${smoke.restStatus}`);
    pass("API smoke", `auth/health=${smoke.authHealthStatus} rest=${smoke.restStatus}`);
  } catch (e) {
    fail("API smoke", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL6 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) {
    console.error("WARN rollback: Dashboard Hook OFF immediately");
    process.exit(1);
  }
  console.log("Judgment: READY_FOR_LINKED_REF_L7_BACKFILL_EXPAND");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
