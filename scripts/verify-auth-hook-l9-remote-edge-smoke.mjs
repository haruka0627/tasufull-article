#!/usr/bin/env node
/**
 * L9 — Deploy match-* Edge functions + remote smoke (linked ref)
 *
 *   node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs
 *   node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs --skip-deploy
 *   node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs --skip-deploy --skip-db-gates
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON · no metadata/RLS/MATCH migration changes
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST_SLOTS, loadL7Config, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";
import { decodeJwtPayload } from "./lib/auth-current-user-core.mjs";
import {
  extractTalkUserIdFromClaims,
  extractMemberIdFromClaims,
  assertHookMergeClaims,
  assertNotDemoMisroute,
} from "./lib/match-auth-claim-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipDbGates = process.argv.includes("--skip-db-gates");

/** MATCH Edge deploy targets (L9) */
export const MATCH_EDGE_FUNCTIONS = Object.freeze([
  { name: "match-record-swipe", guard: "requireUser" },
  { name: "match-ensure-talk-room", guard: "requireUser" },
  { name: "match-submit-report", guard: "requireUser" },
  { name: "match-block-user", guard: "requireUser" },
  { name: "match-submit-verification", guard: "requireUser" },
  { name: "match-admin-review", guard: "requireAdmin" },
  { name: "match-moderation-log", guard: "requireUser" },
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
  const sqlPath = path.join(ROOT, "sql/auth-hook-l9-verify-gates.sql");
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`SQL gates failed: ${combined.slice(0, 500)}`);
  const row = parseCliJson(combined)?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no rows");
  return row;
}

function deployMatchFunctions() {
  const names = MATCH_EDGE_FUNCTIONS.map((f) => f.name);
  console.log(`  Deploying ${names.length} functions: ${names.join(", ")}`);
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...names,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) {
    throw new Error(`deploy failed: ${(r.stderr || r.stdout).slice(0, 800)}`);
  }
  return (r.stdout || r.stderr || "").trim();
}

function verifyFunctionsListed() {
  const r = runSupabaseCli(["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`functions list failed: ${combined.slice(0, 400)}`);

  const jsonStart = combined.indexOf("[");
  const jsonEnd = combined.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < 0) throw new Error("could not parse functions list JSON");
  const list = JSON.parse(combined.slice(jsonStart, jsonEnd + 1));
  const slugs = new Set(list.map((f) => f.slug || f.name));
  const missing = MATCH_EDGE_FUNCTIONS.filter((f) => !slugs.has(f.name));
  if (missing.length) {
    throw new Error(`missing deployed functions: ${missing.map((f) => f.name).join(", ")}`);
  }
  return list.filter((f) => MATCH_EDGE_FUNCTIONS.some((m) => m.name === (f.slug || f.name)));
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
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.unsigned`;
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

function verifyJwtClaims(tokens) {
  for (const [slotName, { slot, accessToken }] of tokens) {
    const payload = decodeJwtPayload(accessToken);
    const app =
      payload?.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
    if (app.talk_user_id !== slot.talkUserId || app.member_id !== slot.memberId) {
      throw new Error(`${slotName} JWT talk/member mismatch`);
    }
    assertHookMergeClaims(app);
    assertNotDemoMisroute(extractTalkUserIdFromClaims(payload), slotName);
    if (extractMemberIdFromClaims(payload) !== slot.memberId) {
      throw new Error(`${slotName} member extract mismatch`);
    }
  }
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
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }
    if (res.status !== 502 || attempt === retries) {
      return { status: res.status, json, text };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("edgePost retry exhausted");
}

function assertNo5xx(label, status) {
  if (status >= 500) throw new Error(`${label} returned ${status}`);
}

async function runRemoteSmoke(cfg, tokens) {
  const edgeBase = `${cfg.url}/functions/v1`;
  const t1Auth = { Authorization: `Bearer ${tokens.get("T1").accessToken}` };

  const warm = await edgePost(
    cfg,
    "match-record-swipe",
    { target_user_id: "t2", action: "like" },
    t1Auth,
    2,
  );
  assertNo5xx("warmup swipe", warm.status);
  if (warm.status !== 200) throw new Error(`warmup: ${warm.status}`);

  const noAuth = await edgePost(cfg, "match-record-swipe", {
    target_user_id: "t2",
    action: "like",
  });
  assertNo5xx("no auth", noAuth.status);
  if (noAuth.status !== 401 || noAuth.json?.code !== "unauthorized") {
    throw new Error(`no bearer: ${noAuth.status} ${JSON.stringify(noAuth.json)}`);
  }

  const invalid = await edgePost(
    cfg,
    "match-record-swipe",
    { target_user_id: "t2", action: "like" },
    { Authorization: "Bearer not.a.valid.jwt" },
  );
  assertNo5xx("invalid jwt", invalid.status);
  if (invalid.status !== 401) {
    throw new Error(`invalid jwt: ${invalid.status}`);
  }

  const subOnly = await edgePost(
    cfg,
    "match-record-swipe",
    { target_user_id: "t2", action: "like" },
    { Authorization: `Bearer ${makeUnsignedJwt({ sub: ALLOWLIST_SLOTS[0].id })}` },
  );
  assertNo5xx("sub-only", subOnly.status);
  if (subOnly.status !== 403 || subOnly.json?.code !== "forbidden") {
    throw new Error(`sub-only: ${subOnly.status} ${JSON.stringify(subOnly.json)}`);
  }

  const badJson = await edgePost(cfg, "match-record-swipe", "{", {
    Authorization: `Bearer ${tokens.get("T1").accessToken}`,
  });
  assertNo5xx("bad json", badJson.status);
  if (badJson.status !== 400 || badJson.json?.code !== "invalid_json") {
    throw new Error(`bad json: ${badJson.status} ${JSON.stringify(badJson.json)}`);
  }

  const badAction = await edgePost(
    cfg,
    "match-record-swipe",
    { target_user_id: "t2", action: "not_an_action" },
    { Authorization: `Bearer ${tokens.get("T1").accessToken}` },
  );
  assertNo5xx("bad action", badAction.status);
  if (badAction.status !== 422) {
    throw new Error(`bad action: ${badAction.status}`);
  }

  for (const [slotName, { slot, accessToken }] of tokens) {
    const other = ALLOWLIST_SLOTS.find((s) => s.slot !== slotName);
    const targetId = other?.talkUserId || "t9";
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const swipe = await edgePost(
      cfg,
      "match-record-swipe",
      { target_user_id: targetId, action: "like" },
      authHeaders,
    );
    assertNo5xx(`${slotName} swipe`, swipe.status);
    if (swipe.status !== 200 || swipe.json?.ok !== true) {
      throw new Error(`${slotName} swipe: ${JSON.stringify(swipe.json)}`);
    }

    const self = await edgePost(
      cfg,
      "match-record-swipe",
      { target_user_id: slot.talkUserId, action: "like" },
      authHeaders,
    );
    assertNo5xx(`${slotName} self`, self.status);
    if (self.status !== 422 || self.json?.code !== "validation_error") {
      throw new Error(`${slotName} self-swipe: ${self.status}`);
    }

    const resolved = extractTalkUserIdFromClaims(decodeJwtPayload(accessToken));
    assertNotDemoMisroute(resolved, slotName);
    if (resolved !== slot.talkUserId) {
      throw new Error(`${slotName} resolved ${resolved} expected ${slot.talkUserId}`);
    }
  }

  const t1 = tokens.get("T1");
  const t1AuthHeaders = { Authorization: `Bearer ${t1.accessToken}` };
  const otherFns = [
    ["match-ensure-talk-room", { pair_id: "00000000-0000-4000-8000-000000000099" }],
    [
      "match-submit-report",
      { reported_user_id: "t2", reason: "harassment", detail: "L9 remote smoke" },
    ],
    ["match-block-user", { blocked_user_id: "t3", reason: "smoke" }],
    ["match-submit-verification", { verification_type: "phone", metadata: {} }],
    [
      "match-moderation-log",
      {
        source: "profile",
        target_user_id: "t2",
        severity: "low",
        reason: "L9 smoke",
      },
    ],
  ];

  for (const [name, body] of otherFns) {
    const res = await edgePost(cfg, name, body, t1AuthHeaders);
    assertNo5xx(name, res.status);
    if (res.status !== 200 || res.json?.ok !== true) {
      throw new Error(`${name}: ${res.status} ${JSON.stringify(res.json)}`);
    }
  }

  const adminDenied = await edgePost(
    cfg,
    "match-admin-review",
    {
      target_type: "report",
      target_id: "00000000-0000-4000-8000-000000000001",
      action: "dismiss",
      note: "L9 smoke",
    },
    t1AuthHeaders,
  );
  assertNo5xx("admin denied", adminDenied.status);
  if (adminDenied.status !== 403) {
    throw new Error(`admin denied expected 403 got ${adminDenied.status}`);
  }

  const options = await fetch(`${edgeBase}/match-record-swipe`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://tasful.jp",
      "Access-Control-Request-Method": "POST",
    },
  });
  if (options.status >= 500) throw new Error(`OPTIONS ${options.status}`);
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

  const edgeProbe = await fetch(`${cfg.url}/functions/v1/match-record-swipe`, {
    method: "OPTIONS",
  });
  if (edgeProbe.status >= 500) throw new Error(`edge OPTIONS ${edgeProbe.status}`);
}

async function main() {
  const cfg = loadL7Config();
  console.log(`L9 remote Edge smoke · ref=${PROJECT_REF}${skipDeploy ? " · skip-deploy" : ""}`);

  if (skipDbGates) {
    pass("SQL DB gates", "skipped (--skip-db-gates · L10+ post-schema)");
  } else {
    try {
      const row = runSqlGates();
      if (Number(row.hook_func_count) !== 1) throw new Error(`hook=${row.hook_func_count}`);
      if (Number(row.match_table_count) !== 0) throw new Error(`match tables=${row.match_table_count}`);
      if (Number(row.legacy_user_count) !== 7) throw new Error(`legacy=${row.legacy_user_count}`);
      if (Number(row.allowlist_backfill_count) !== 5) {
        throw new Error(`allowlist=${row.allowlist_backfill_count}`);
      }
      pass("SQL DB gates", "hook=1 match=0 legacy=7 allowlist=5");
    } catch (e) {
      fail("SQL DB gates", e.message);
      process.exit(1);
    }
  }

  if (!skipDeploy) {
    try {
      deployMatchFunctions();
      pass("Deploy match-* Edge", `${MATCH_EDGE_FUNCTIONS.length} functions · --no-verify-jwt`);
    } catch (e) {
      fail("Deploy match-* Edge", e.message);
      process.exit(1);
    }
  } else {
    pass("Deploy match-* Edge", "skipped (--skip-deploy)");
  }

  try {
    const deployed = verifyFunctionsListed();
    pass("Functions list", `${deployed.length} match-* ACTIVE on linked ref`);
  } catch (e) {
    fail("Functions list", e.message);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = await loginAllSlots(cfg);
    pass("T1–T5 login", "HTTP 200");
    verifyJwtClaims(tokens);
    pass("JWT claims", "talk/member t1–t5 · hook merge · no demo ids");
  } catch (e) {
    fail("JWT login/claims", e.message);
    process.exit(1);
  }

  try {
    await runRemoteSmoke(cfg, tokens);
    pass(
      "Remote Edge smoke",
      "T1–T5 swipe 200 · self 422 · 401/403 invalid · 400/422 bad input · 5 user fns · admin 403",
    );
  } catch (e) {
    fail("Remote Edge smoke", e.message);
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
  console.log(`\nL9 result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_LINKED_REF_L10_MATCH_SCHEMA");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
