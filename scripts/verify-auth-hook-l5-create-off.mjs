#!/usr/bin/env node
/**
 * L5 — custom_access_token_hook CREATE (Dashboard Hook OFF) verification
 *
 *   node scripts/verify-auth-hook-l5-create-off.mjs
 *
 * Prerequisite: apply migration to linked ref:
 *   npx supabase db query --linked --yes -f supabase/migrations/20260621150000_create_custom_access_token_hook.sql
 *
 * Ref: ddojquacsyqesrjhcvmn only
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { decodeJwtPayload } from "./lib/auth-current-user-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  if (ref !== "ddojquacsyqesrjhcvmn") {
    throw new Error(`Ref mismatch: expected ddojquacsyqesrjhcvmn, got ${ref || url}`);
  }
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  if (!password) throw new Error("AUTH_HOOK_L2_ALLOWLIST_PASSWORD required (.env)");
  return { url, anonKey, password };
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
    },
  };
}

function assertT1JwtClaims(label, payload) {
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
  return { ok: res.ok, status: res.status, data };
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

function runSqlGates() {
  const sqlPath = path.join(ROOT, "sql/auth-hook-l5-verify-gates.sql");
  const r = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--yes", "-f", sqlPath],
    { cwd: ROOT, encoding: "utf8", shell: true }
  );
  const combined = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) {
    throw new Error(`SQL gates failed (exit ${r.status}): ${combined.slice(0, 500)}`);
  }

  const jsonMatch = combined.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse supabase db query JSON: ${combined.slice(0, 500)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  const row = parsed?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no rows");

  if (Number(row.hook_func_count) !== 1) {
    throw new Error(`hook_func_count expected 1, got ${row.hook_func_count}`);
  }
  if (Number(row.match_table_count) !== 0) {
    throw new Error(`match_table_count expected 0, got ${row.match_table_count}`);
  }
  if (row.t1_talk_user_id !== "t1" || row.t1_member_id !== "t1") {
    throw new Error(`T1 hook merge failed: ${JSON.stringify(row)}`);
  }
  if (row.t1_provider !== "email") {
    throw new Error("T1 hook lost provider");
  }
  if (!Array.isArray(row.t1_providers) || !row.t1_providers.includes("email")) {
    throw new Error("T1 hook lost providers");
  }
  if (row.t1_iss !== "https://ddojquacsyqesrjhcvmn.supabase.co/auth/v1") {
    throw new Error("T1 hook lost iss claim");
  }
  if (row.t2_claims_unchanged !== true) {
    throw new Error(`T2 hook mutated claims: ${JSON.stringify(row)}`);
  }
  if (row.t2_provider !== "email") {
    throw new Error("T2 hook lost provider");
  }
  if (!Array.isArray(row.t2_providers) || !row.t2_providers.includes("email")) {
    throw new Error("T2 hook lost providers");
  }

  return row;
}

async function readOnlyMetadataSanity(cfg) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceKey) return { skipped: true };

  const checkUser = async (id, expectTalk) => {
    const res = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) throw new Error(`admin read ${id} failed: ${res.status}`);
    const user = await res.json();
    const app = user.app_metadata || {};
    if (app.provider !== "email") throw new Error(`${id}: provider changed`);
    if (expectTalk) {
      if (app.talk_user_id !== expectTalk.talk || app.member_id !== expectTalk.member) {
        throw new Error(`${id}: talk/member metadata changed`);
      }
    } else if (app.talk_user_id != null || app.member_id != null) {
      throw new Error(`${id}: unexpected talk/member set`);
    }
  };

  await checkUser(T1.authUserId, { talk: T1.talkUserId, member: T1.memberId });
  await checkUser(T2.authUserId, null);
  return { skipped: false };
}

async function main() {
  const cfg = loadConfig();
  console.log("L5 verify · ref=ddojquacsyqesrjhcvmn · Hook CREATE · Dashboard OFF");

  try {
    const gateRow = runSqlGates();
    pass(
      "SQL gates",
      `hook=1 · T1=${gateRow.t1_talk_user_id}/${gateRow.t1_member_id} · T2 unchanged · match=0`
    );
  } catch (e) {
    fail("SQL gates", e.message);
    console.error(
      "\nIf hook missing, apply migration:\n" +
        "  npx supabase db query --linked --yes -f supabase/migrations/20260621150000_create_custom_access_token_hook.sql"
    );
    process.exit(1);
  }

  const login = await signIn(cfg, T1.email, cfg.password);
  if (!login.ok || !login.data?.access_token) {
    fail("T1 login", `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("T1 login", `HTTP ${login.status}`);

  try {
    const loginPayload = decodeJwtPayload(login.data.access_token);
    const loginSummary = assertT1JwtClaims("login JWT", loginPayload);
    pass("T1 login JWT (Hook OFF · L4-equivalent)", JSON.stringify(loginSummary.app_metadata));
  } catch (e) {
    fail("T1 login JWT", e.message);
    process.exit(1);
  }

  const refreshed = await refreshToken(cfg, login.data.refresh_token);
  if (!refreshed.ok || !refreshed.data?.access_token) {
    fail("T1 refresh", `HTTP ${refreshed.status}`);
    process.exit(1);
  }
  pass("T1 refresh", `HTTP ${refreshed.status}`);

  try {
    const refreshPayload = decodeJwtPayload(refreshed.data.access_token);
    const refreshSummary = assertT1JwtClaims("refresh JWT", refreshPayload);
    pass("T1 refresh JWT (Hook OFF · L4-equivalent)", JSON.stringify(refreshSummary.app_metadata));
  } catch (e) {
    fail("T1 refresh JWT", e.message);
    process.exit(1);
  }

  const t2Login = await signIn(cfg, T2.email, cfg.password);
  if (!t2Login.ok || !t2Login.data?.access_token) {
    fail("T2 login", `HTTP ${t2Login.status}`);
    process.exit(1);
  }
  pass("T2 login", `HTTP ${t2Login.status}`);

  try {
    const t2Payload = decodeJwtPayload(t2Login.data.access_token);
    const t2Summary = assertT2JwtClaims("T2 login JWT", t2Payload);
    pass("T2 login JWT (talk/member unset)", JSON.stringify(t2Summary.app_metadata));
  } catch (e) {
    fail("T2 login JWT", e.message);
    process.exit(1);
  }

  try {
    const meta = await readOnlyMetadataSanity(cfg);
    if (meta.skipped) {
      pass("metadata sanity", "skipped (no SUPABASE_SERVICE_ROLE_KEY)");
    } else {
      pass("metadata sanity", "T1/T2 app_metadata unchanged");
    }
  } catch (e) {
    fail("metadata sanity", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL5 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
