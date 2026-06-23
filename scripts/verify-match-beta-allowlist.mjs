#!/usr/bin/env node
/**
 * MATCH beta allowlist gate verification
 *
 *   node scripts/verify-match-beta-allowlist.mjs
 *   node scripts/verify-match-beta-allowlist.mjs --skip-deploy
 *   node scripts/verify-match-beta-allowlist.mjs --skip-migration
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
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const MIGRATION = "supabase/migrations/20260627100000_match_beta_allowlist.sql";
const T1 = slotByName("T1");
const T3 = slotByName("T3");
const T4 = slotByName("T4");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipMigration = process.argv.includes("--skip-migration");

const GATED_FN = "match-search-profiles";
const ADMIN_FN = "match-admin-review";

const DEPLOY_FUNCTIONS = [
  GATED_FN,
  ADMIN_FN,
  "match-upsert-profile",
  "match-record-swipe",
  "match-list-pairs",
  "match-ensure-talk-room",
  "match-block-user",
  "match-submit-report",
  "match-unmatch-pair",
  "match-submit-verification",
  "match-upload-photo",
  "match-get-profile-completeness",
];

const REPORT_GATE = path.join(ROOT, "reports/match-beta0-allowlist-gate.md");

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

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = bearer || (serviceRole ? cfg.serviceRoleKey : cfg.anonKey);
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
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

async function login(cfg, email) {
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
  return res.data?.access_token || "";
}

async function edgePost(functionName, body, token) {
  const cfg = loadL7Config();
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

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

async function restFetch(cfg, { table, method = "GET", query = "", body, serviceRole = true }) {
  const key = cfg.serviceRoleKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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

async function setAllowlistStatus(cfg, talkUserId, patch) {
  const res = await restFetch(cfg, {
    table: "match_beta_allowlist",
    method: "PATCH",
    query: `talk_user_id=eq.${encodeURIComponent(talkUserId)}`,
    body: { ...patch, updated_at: new Date().toISOString() },
  });
  return res;
}

async function upsertAllowlist(cfg, row) {
  const existing = await restFetch(cfg, {
    table: "match_beta_allowlist",
    query: `talk_user_id=eq.${encodeURIComponent(row.talk_user_id)}&select=id`,
  });
  if (Array.isArray(existing.json) && existing.json.length > 0) {
    return setAllowlistStatus(cfg, row.talk_user_id, row);
  }
  return restFetch(cfg, {
    table: "match_beta_allowlist",
    method: "POST",
    body: row,
  });
}

async function deleteAllowlist(cfg, talkUserId) {
  return restFetch(cfg, {
    table: "match_beta_allowlist",
    method: "DELETE",
    query: `talk_user_id=eq.${encodeURIComponent(talkUserId)}`,
  });
}

function deployFunctions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...DEPLOY_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
  ]);
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 500));
}

function applyMigration() {
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", MIGRATION]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 600));
}

function isBetaDenied(res) {
  return (
    res.status === 403 &&
    (res.json?.code === "match_beta_not_allowed" || res.json?.error === "match_beta_not_allowed")
  );
}

async function main() {
  console.log("=== MATCH beta allowlist gate ===\n");
  const cfg = loadL7Config();

  if (!skipMigration) {
    try {
      applyMigration();
      pass("Migration", "db query", MIGRATION);
    } catch (err) {
      fail("Migration", "db query", String(err));
    }
  } else {
    pass("Migration", "skipped", "--skip-migration");
  }

  if (!skipDeploy) {
    try {
      deployFunctions();
      pass("Deploy", "functions", String(DEPLOY_FUNCTIONS.length));
    } catch (err) {
      fail("Deploy", "functions", String(err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  const noAuth = await edgePost(GATED_FN, { limit: 1 }, null);
  if (noAuth.status === 401) pass("Auth", "no token → 401", String(noAuth.status));
  else fail("Auth", "no token → 401", `status=${noAuth.status}`);

  const t1Token = await login(cfg, T1.email);
  const t3Token = await login(cfg, T3.email);
  const t4Token = await login(cfg, T4.email);

  if (t1Token) pass("Auth", "T1 login", T1.email);
  else fail("Auth", "T1 login", "no token");

  if (t3Token) pass("Auth", "T3 login", T3.email);
  else fail("Auth", "T3 login", "no token");

  await deleteAllowlist(cfg, T3.talkUserId);

  const t3Denied = await edgePost(GATED_FN, { limit: 1 }, t3Token);
  if (isBetaDenied(t3Denied)) pass("Gate", "T3 not on allowlist → 403", t3Denied.json?.code || t3Denied.json?.error);
  else fail("Gate", "T3 not on allowlist → 403", t3Denied.text?.slice(0, 160));

  await upsertAllowlist(cfg, {
    talk_user_id: T3.talkUserId,
    email: T3.email,
    status: "invited",
    invited_at: new Date().toISOString(),
  });

  const t3Invited = await edgePost(GATED_FN, { limit: 1 }, t3Token);
  if (t3Invited.status === 200 && t3Invited.json?.ok !== false) {
    pass("Gate", "T3 invited → 200", `status=${t3Invited.status}`);
  } else {
    fail("Gate", "T3 invited → 200", t3Invited.text?.slice(0, 160));
  }

  await setAllowlistStatus(cfg, T3.talkUserId, {
    status: "active",
    accepted_at: new Date().toISOString(),
  });

  const t3Active = await edgePost(GATED_FN, { limit: 1 }, t3Token);
  if (t3Active.status === 200 && t3Active.json?.ok !== false) {
    pass("Gate", "T3 active → 200", `status=${t3Active.status}`);
  } else {
    fail("Gate", "T3 active → 200", t3Active.text?.slice(0, 160));
  }

  await setAllowlistStatus(cfg, T3.talkUserId, { status: "revoked" });

  const t3Revoked = await edgePost(GATED_FN, { limit: 1 }, t3Token);
  if (isBetaDenied(t3Revoked)) pass("Gate", "T3 revoked → 403", t3Revoked.json?.error || t3Revoked.json?.code);
  else fail("Gate", "T3 revoked → 403", t3Revoked.text?.slice(0, 160));

  const t1Ok = await edgePost(GATED_FN, { limit: 1 }, t1Token);
  if (t1Ok.status === 200 && t1Ok.json?.ok !== false) {
    pass("Gate", "T1 active seed → 200", `status=${t1Ok.status}`);
  } else {
    fail("Gate", "T1 active seed → 200", t1Ok.text?.slice(0, 160));
  }

  const adminRes = await edgePost(
    ADMIN_FN,
    { intent: "list_pending_verifications" },
    t4Token,
  );
  if (adminRes.status === 200 || adminRes.json?.ok === true) {
    pass("Admin", "match-admin-review (no beta gate)", `status=${adminRes.status}`);
  } else if (adminRes.status === 403 && adminRes.json?.code === "forbidden") {
    pass("Admin", "admin guard intact", "403 forbidden (non-admin path ok)");
  } else {
    fail("Admin", "match-admin-review", adminRes.text?.slice(0, 160));
  }

  const gateJs = fs.readFileSync(path.join(ROOT, "match/match-beta-gate.js"), "utf8");
  if (gateJs.includes("招待制β")) pass("Frontend", "match-beta-gate.js", "message present");
  else fail("Frontend", "match-beta-gate.js", "message missing");

  return finish();
}

function finish() {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  const verdict = failed === 0 ? "MATCH_BETA0_GATE_READY" : "MATCH_BETA0_GATE_BLOCKED";

  let md = `# TASFUL MATCH — β0 Allowlist Gate\n\n`;
  md += `| 項目 | 内容 |\n|------|------|\n`;
  md += `| 版 | v1.0 |\n`;
  md += `| 作成日 | 2026-06-22 |\n`;
  md += `| ref | \`${PROJECT_REF}\` |\n`;
  md += `| migration | \`20260627100000_match_beta_allowlist.sql\` |\n`;
  md += `| 検証 | \`node scripts/verify-match-beta-allowlist.mjs\` |\n`;
  md += `| 結果 | **${passed}/${total} PASS** |\n`;
  md += `| 判定 | **${verdict}** |\n\n`;

  md += `## 実装\n\n`;
  md += `- テーブル \`match_beta_allowlist\` + RPC \`match_is_beta_allowed()\`\n`;
  md += `- Edge \`requireMatchBetaAllowed()\` in \`_shared/match-beta.ts\`\n`;
  md += `- 403: \`{ ok: false, code: "match_beta_not_allowed", error: "match_beta_not_allowed" }\`\n`;
  md += `- フロント \`match-beta-gate.js\` 専用パネル\n`;
  md += `- 無効化: Edge env \`MATCH_BETA_GATE_DISABLED=1\` · stub token スキップ\n\n`;

  md += `## ゲート適用 Function\n\n`;
  for (const fn of DEPLOY_FUNCTIONS.filter((f) => f !== ADMIN_FN)) {
    md += `- \`${fn}\`\n`;
  }
  md += `\n**対象外:** \`match-admin-review\`（admin guard のみ）\n\n`;

  md += `## 検証ステップ\n\n| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "FAIL"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }

  fs.mkdirSync(path.dirname(REPORT_GATE), { recursive: true });
  fs.writeFileSync(REPORT_GATE, md, "utf8");
  console.log(`\nReport: ${REPORT_GATE}`);
  console.log(`Result: ${passed}/${total} PASS · ${verdict}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  fail("Fatal", "uncaught", String(err));
  finish();
});
