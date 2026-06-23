#!/usr/bin/env node
/**
 * L8 — Edge prep: JWT claim path + local MATCH Edge smoke with allowlist tokens
 *
 *   node scripts/verify-auth-hook-l8-edge-prep.mjs
 *
 * Uses local Deno smoke router (match-auth.ts handlers) — MATCH not deployed to linked ref yet.
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · no metadata writes
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST_SLOTS, loadL7Config, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";
import { decodeJwtPayload } from "./lib/auth-current-user-core.mjs";
import {
  extractTalkUserIdFromClaims,
  extractMemberIdFromClaims,
  extractAdminRoleFromClaims,
  assertHookMergeClaims,
  assertNotDemoMisroute,
} from "./lib/match-auth-claim-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SMOKE_BASE = "http://127.0.0.1:54321/functions/v1";

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
  const sqlPath = path.join(ROOT, "sql/auth-hook-l8-verify-gates.sql");
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`SQL gates failed: ${combined.slice(0, 500)}`);
  const row = parseCliJson(combined)?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no rows");
  return row;
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

async function signIn(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

function makeUnsignedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
    .toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.unsigned`;
}

function verifyClaimPriorityUnit() {
  const appFirst = decodeJwtPayload(
    makeUnsignedJwt({
      sub: "00000000-0000-4000-8000-000000000099",
      app_metadata: { talk_user_id: "t_priority", member_id: "m_priority" },
      talk_user_id: "root_should_not_win",
    }),
  );
  if (extractTalkUserIdFromClaims(appFirst) !== "t_priority") {
    throw new Error("priority: app_metadata.talk_user_id not first");
  }
  if (extractMemberIdFromClaims(appFirst) !== "m_priority") {
    throw new Error("member_id from app_metadata");
  }

  const rootSecond = decodeJwtPayload(
    makeUnsignedJwt({
      sub: "00000000-0000-4000-8000-000000000099",
      talk_user_id: "root_talk",
    }),
  );
  if (extractTalkUserIdFromClaims(rootSecond) !== "root_talk") {
    throw new Error("priority: root talk_user_id second");
  }

  const memberFallback = decodeJwtPayload(
    makeUnsignedJwt({
      sub: "00000000-0000-4000-8000-000000000099",
      app_metadata: { member_id: "m_only" },
    }),
  );
  if (extractTalkUserIdFromClaims(memberFallback) !== "m_only") {
    throw new Error("priority: app_metadata.member_id fallback");
  }

  const subOnly = decodeJwtPayload(
    makeUnsignedJwt({ sub: "2d537fc9-ee67-4da8-97d3-bafe824ba466" }),
  );
  if (extractTalkUserIdFromClaims(subOnly) !== null) {
    throw new Error("sub must not be used as talk_user_id fallback");
  }

  const userMetaEvil = decodeJwtPayload(
    makeUnsignedJwt({
      sub: "x",
      user_metadata: { talk_user_id: "u_me" },
    }),
  );
  if (extractTalkUserIdFromClaims(userMetaEvil) !== null) {
    throw new Error("user_metadata.talk_user_id must not be trusted");
  }
}

async function loginAllSlots(cfg) {
  /** @type {Map<string, { slot: typeof ALLOWLIST_SLOTS[0], accessToken: string }>} */
  const tokens = new Map();
  for (const slot of ALLOWLIST_SLOTS) {
    const res = await signIn(cfg, slot.email);
    if (!res.ok || !res.data?.access_token) {
      throw new Error(`${slot.slot} login HTTP ${res.status}`);
    }
    tokens.set(slot.slot, { slot, accessToken: res.data.access_token });
  }
  return tokens;
}

function verifyAllowlistJwtClaims(tokens) {
  for (const [slotName, { slot, accessToken }] of tokens) {
    const payload = decodeJwtPayload(accessToken);
    const app = payload?.app_metadata && typeof payload.app_metadata === "object"
      ? payload.app_metadata
      : {};
    if (app.talk_user_id !== slot.talkUserId) {
      throw new Error(`${slotName} JWT talk_user_id ${app.talk_user_id}`);
    }
    if (app.member_id !== slot.memberId) {
      throw new Error(`${slotName} JWT member_id ${app.member_id}`);
    }
    if (app.provider !== "email") throw new Error(`${slotName} provider lost`);
    if (!Array.isArray(app.providers) || !app.providers.includes("email")) {
      throw new Error(`${slotName} providers lost`);
    }
    assertHookMergeClaims(app);

    const fromEdge = extractTalkUserIdFromClaims(payload);
    assertNotDemoMisroute(fromEdge, slotName);
    if (fromEdge !== slot.talkUserId) {
      throw new Error(`${slotName} edge extract ${fromEdge}`);
    }
    if (extractMemberIdFromClaims(payload) !== slot.memberId) {
      throw new Error(`${slotName} member extract mismatch`);
    }
  }
}

function startSmokeServer() {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawn(
    cmd,
    ["deno", "run", "--allow-net", "--allow-read", "scripts/match-local-edge-smoke-server.ts"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" },
  );
}

async function waitForSmokeServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${SMOKE_BASE}/match-record-swipe`, { method: "OPTIONS" });
      if (res.status === 200 || res.status === 204) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function edgePost(functionName, body, headers = {}) {
  const res = await fetch(`${SMOKE_BASE}/${functionName}`, {
    method: "POST",
    headers: {
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
  return { status: res.status, json };
}

async function runEdgeSmoke(tokens) {
  const noAuth = await edgePost("match-record-swipe", {
    target_user_id: "t2",
    action: "like",
  });
  if (noAuth.status !== 401 || noAuth.json?.code !== "unauthorized") {
    throw new Error(`missing bearer: status=${noAuth.status} code=${noAuth.json?.code}`);
  }

  const invalid = await edgePost(
    "match-record-swipe",
    { target_user_id: "t2", action: "like" },
    { Authorization: "Bearer not.a.valid.jwt" },
  );
  if (invalid.status !== 401) {
    throw new Error(`invalid token: status=${invalid.status}`);
  }

  const subOnly = await edgePost(
    "match-record-swipe",
    { target_user_id: "t2", action: "like" },
    { Authorization: `Bearer ${makeUnsignedJwt({ sub: ALLOWLIST_SLOTS[0].id })}` },
  );
  if (subOnly.status !== 403 || subOnly.json?.code !== "forbidden") {
    throw new Error(`sub-only JWT: status=${subOnly.status} code=${subOnly.json?.code}`);
  }

  for (const [slotName, { slot, accessToken }] of tokens) {
    const other = ALLOWLIST_SLOTS.find((s) => s.slot !== slotName);
    const targetId = other?.talkUserId || "t9";
    const res = await edgePost(
      "match-record-swipe",
      { target_user_id: targetId, action: "like" },
      { Authorization: `Bearer ${accessToken}` },
    );
    if (res.status >= 500) {
      throw new Error(`${slotName} edge smoke 5xx: ${res.status}`);
    }
    if (res.status !== 200 || res.json?.ok !== true) {
      throw new Error(`${slotName} edge smoke: ${JSON.stringify(res.json)}`);
    }

    const self = await edgePost(
      "match-record-swipe",
      { target_user_id: slot.talkUserId, action: "like" },
      { Authorization: `Bearer ${accessToken}` },
    );
    if (self.status !== 422 || self.json?.code !== "validation_error") {
      throw new Error(`${slotName} self-swipe: status=${self.status}`);
    }

    const headerSpoof = await edgePost(
      "match-record-swipe",
      { target_user_id: targetId, action: "like" },
      {
        Authorization: `Bearer ${accessToken}`,
        "x-match-user-id": "u_me",
      },
    );
    if (headerSpoof.status !== 200) {
      throw new Error(`${slotName} x-match-user-id spoof failed status=${headerSpoof.status}`);
    }
    assertNotDemoMisroute(extractTalkUserIdFromClaims(decodeJwtPayload(accessToken)), slotName);
  }

  const stubToken = await edgePost(
    "match-record-swipe",
    { target_user_id: "t1", action: "like" },
    { Authorization: "Bearer stub-match-token" },
  );
  if (stubToken.status !== 200) {
    throw new Error("stub-match-token dev path broken");
  }
  const stubResolved = "stub-user-current";
  if (stubResolved === "u_me" || stubResolved === "u_hiro") {
    throw new Error("stub token resolves to demo id");
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
}

function runMatchAuthRegression() {
  const script = path.join(ROOT, "scripts", "test-match-edge-jwt-stub.mjs");
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`test-match-edge-jwt-stub.mjs failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
  }
}

async function main() {
  const cfg = loadL7Config();
  console.log(`L8 Edge prep · ref=${PROJECT_REF} · Hook ON · local match-auth handlers`);

  try {
    const row = runSqlGates();
    if (Number(row.hook_func_count) !== 1) throw new Error(`hook=${row.hook_func_count}`);
    if (Number(row.match_table_count) !== 0) throw new Error(`match=${row.match_table_count}`);
    if (Number(row.legacy_user_count) !== 7) throw new Error(`legacy=${row.legacy_user_count}`);
    if (Number(row.allowlist_provider_drift) !== 0) throw new Error("provider drift");
    if (row.t1_talk !== "t1" || row.t5_talk !== "t5") throw new Error("allowlist talk drift");
    pass("SQL DB gates", "hook=1 match=0 legacy=7 allowlist L7 state");
  } catch (e) {
    fail("SQL DB gates", e.message);
    process.exit(1);
  }

  try {
    verifyClaimPriorityUnit();
    pass("Claim priority unit", "app_metadata.talk_user_id > root > member_id · sub/user_metadata rejected");
  } catch (e) {
    fail("Claim priority unit", e.message);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = await loginAllSlots(cfg);
    pass("Allowlist login T1–T5", "HTTP 200 each");
  } catch (e) {
    fail("Allowlist login", e.message);
    process.exit(1);
  }

  try {
    verifyAllowlistJwtClaims(tokens);
    pass("Allowlist JWT + hook merge claims", "talk/member/provider + role/platform_role/is_ops");
  } catch (e) {
    fail("Allowlist JWT claims", e.message);
    process.exit(1);
  }

  const server = startSmokeServer();
  let serverLog = "";
  server.stdout?.on("data", (c) => {
    serverLog += String(c);
  });
  server.stderr?.on("data", (c) => {
    serverLog += String(c);
  });

  const ready = await waitForSmokeServer();
  if (!ready) {
    fail("Local Edge smoke server", serverLog.slice(0, 400));
    server.kill();
    process.exit(1);
  }
  pass("Local Edge smoke server", SMOKE_BASE);

  try {
    await runEdgeSmoke(tokens);
    pass("Edge smoke T1–T5 real JWT", "200 swipe · 422 self · 401/403 invalid · no u_me/u_hiro");
  } catch (e) {
    fail("Edge smoke", e.message);
    server.kill();
    console.error("STOP: consider Hook OFF rollback (L6 §11)");
    process.exit(1);
  } finally {
    server.kill();
  }

  try {
    await apiHealthSmoke(cfg);
    pass("Linked ref API health", "no 5xx on auth/rest");
  } catch (e) {
    fail("Linked ref API health", e.message);
    process.exit(1);
  }

  try {
    runMatchAuthRegression();
    pass("match-auth.ts regression", "test-match-edge-jwt-stub.mjs PASS");
  } catch (e) {
    fail("match-auth regression", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL8 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_LINKED_REF_L9_EDGE_SMOKE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
