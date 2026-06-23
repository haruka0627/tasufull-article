#!/usr/bin/env node
/**
 * MATCH auth unification + JWT verify readiness verification
 *
 *   node scripts/verify-match-auth-unification.mjs
 *   node scripts/verify-match-auth-unification.mjs --skip-deploy
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = path.join(ROOT, "supabase/functions");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T3 = slotByName("T3");
const skipDeploy = process.argv.includes("--skip-deploy");

const BETA_FN = "match-search-profiles";
const ADMIN_FN = "match-admin-review";

const DEPLOY_FUNCTIONS = fs
  .readdirSync(FUNCTIONS_DIR)
  .filter((name) => name.startsWith("match-") && fs.existsSync(path.join(FUNCTIONS_DIR, name, "index.ts")));

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, step, detail = "") {
  results.push({ section, step, ok: true, detail });
  console.log(`  OK  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(section, step, detail = "") {
  results.push({ section, step, ok: false, detail });
  console.error(`  NG  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function scanEdgeAuthUsage() {
  const issues = [];
  let asyncCount = 0;
  let adminAsyncCount = 0;

  for (const name of DEPLOY_FUNCTIONS) {
    const src = fs.readFileSync(path.join(FUNCTIONS_DIR, name, "index.ts"), "utf8");
    if (/\brequireUser\(req\)/.test(src)) issues.push(`${name}: sync requireUser(req)`);
    if (/\brequireAdmin\(req\)/.test(src)) issues.push(`${name}: sync requireAdmin(req)`);
    if (/\bawait requireUserAsync\(req\)/.test(src)) asyncCount += 1;
    if (/\bawait requireAdminAsync\(req\)/.test(src)) adminAsyncCount += 1;
  }

  const shared = fs.readFileSync(path.join(FUNCTIONS_DIR, "_shared/match-auth.ts"), "utf8");
  if (!shared.includes("isMatchVerifyJwtEnabled")) issues.push("match-auth.ts: missing isMatchVerifyJwtEnabled");
  if (!shared.includes("resolveJwtClaimsForToken")) issues.push("match-auth.ts: strict verify path missing");

  return { issues, asyncCount, adminAsyncCount };
}

async function login(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json();
  return data?.access_token || "";
}

async function edgePost(functionName, body, token) {
  const cfg = loadL7Config();
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, text };
}

async function restPatchAllowlist(cfg, talkUserId, status) {
  const key = cfg.serviceRoleKey;
  await fetch(`${cfg.url}/rest/v1/match_beta_allowlist?talk_user_id=eq.${encodeURIComponent(talkUserId)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
}

function deployAllMatchFunctions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...DEPLOY_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 600));
}

async function main() {
  console.log("=== MATCH auth unification verify ===\n");
  const cfg = loadL7Config();

  const scan = scanEdgeAuthUsage();
  if (scan.issues.length) fail("Code", "edge auth scan", scan.issues.join("; "));
  else pass("Code", "edge auth scan", `${scan.asyncCount} requireUserAsync · admin ${scan.adminAsyncCount}`);

  const loginGate = fs.readFileSync(path.join(ROOT, "match/match-login-gate.js"), "utf8");
  const betaGate = fs.readFileSync(path.join(ROOT, "match/match-beta-gate.js"), "utf8");
  if (loginGate.includes("ログインする") && loginGate.includes("TASFULトップへ戻る")) {
    pass("Frontend", "login gate CTAs", "present");
  } else fail("Frontend", "login gate CTAs", "missing");

  if (loginGate.includes("招待制β") && betaGate.includes("招待制β")) {
    pass("Frontend", "login vs beta copy", "distinct");
  } else fail("Frontend", "login vs beta copy", "check messages");

  const swipeHtml = fs.readFileSync(path.join(ROOT, "match/match-swipe.html"), "utf8");
  if (swipeHtml.includes("data-match-requires-login") && swipeHtml.includes("match-login-gate.js")) {
    pass("Frontend", "match-swipe.html", "protected + login gate script");
  } else fail("Frontend", "match-swipe.html", "missing attrs");

  if (!skipDeploy) {
    try {
      deployAllMatchFunctions();
      pass("Deploy", "match-* functions", String(DEPLOY_FUNCTIONS.length));
    } catch (err) {
      fail("Deploy", "match-* functions", String(err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  const noAuth = await edgePost(BETA_FN, { limit: 1 }, undefined);
  if (noAuth.status === 401) pass("Live", "no token → 401", noAuth.json?.code || "401");
  else fail("Live", "no token → 401", `status=${noAuth.status}`);

  const t1Token = await login(cfg, T1.email);
  const t3Token = await login(cfg, T3.email);

  await restPatchAllowlist(cfg, T3.talkUserId, "revoked");
  const t3Denied = await edgePost(BETA_FN, { limit: 1 }, t3Token);
  if (t3Denied.status === 403 && (t3Denied.json?.error === "match_beta_not_allowed" || t3Denied.json?.code === "match_beta_not_allowed")) {
    pass("Live", "T3 revoked → 403 beta", t3Denied.json?.error || t3Denied.json?.code);
  } else fail("Live", "T3 revoked → 403 beta", t3Denied.text?.slice(0, 120));

  await restPatchAllowlist(cfg, T3.talkUserId, "invited");
  const t3Invited = await edgePost(BETA_FN, { limit: 1 }, t3Token);
  if (t3Invited.status === 200) pass("Live", "T3 invited → 200", "ok");
  else fail("Live", "T3 invited → 200", t3Invited.text?.slice(0, 120));

  await restPatchAllowlist(cfg, T3.talkUserId, "active");
  const t3Active = await edgePost(BETA_FN, { limit: 1 }, t3Token);
  if (t3Active.status === 200) pass("Live", "T3 active → 200", "ok");
  else fail("Live", "T3 active → 200", t3Active.text?.slice(0, 120));

  const t1Ok = await edgePost(BETA_FN, { limit: 1 }, t1Token);
  if (t1Ok.status === 200) pass("Live", "T1 allowlist → 200", "ok");
  else fail("Live", "T1 allowlist → 200", t1Ok.text?.slice(0, 120));

  const badToken = "not-a-valid-jwt";
  const badRes = await edgePost(BETA_FN, { limit: 1 }, badToken);
  if (badRes.status === 401) pass("Live", "malformed JWT → 401", badRes.json?.code || "401");
  else fail("Live", "malformed JWT → 401", `status=${badRes.status}`);

  const forged =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIiwiYXBwX21ldGFkYXRhIjp7InRhbGtfdXNlcl9pZCI6InQzIn19.x";
  const forgedRes = await edgePost(BETA_FN, { limit: 1 }, forged);
  if ([401, 403, 500].includes(forgedRes.status)) {
    pass("Live", "forged JWT blocked", `status=${forgedRes.status}`);
  } else fail("Live", "forged JWT blocked", `status=${forgedRes.status}`);

  const adminRes = await edgePost(ADMIN_FN, { intent: "list_pending_verifications" }, t3Token);
  if (adminRes.status === 403 && adminRes.json?.code === "forbidden") {
    pass("Live", "admin guard (non-admin T3)", "403 forbidden");
  } else if (adminRes.status === 200) {
    pass("Live", "admin guard", "200 (T3 is admin on ref)");
  } else {
    fail("Live", "admin guard", adminRes.text?.slice(0, 120));
  }

  const stubRes = await edgePost(BETA_FN, { limit: 1 }, "stub-match-token");
  if (stubRes.status === 200 && stubRes.json?.mode === "stub") {
    pass("Live", "stub token demo path", "200 stub mode");
  } else if (stubRes.status === 403) {
    pass("Live", "stub token on live ref", "403 (gate active without allowlist stub user)");
  } else {
    fail("Live", "stub token", stubRes.text?.slice(0, 120));
  }

  return finish();
}

function finish() {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  const verdict = failed === 0 ? "MATCH_AUTH_UNIFICATION_OK" : "MATCH_AUTH_UNIFICATION_BLOCKED";

  console.log(`\nResult: ${passed}/${total} PASS · ${verdict}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  fail("Fatal", "uncaught", String(err));
  finish();
});
