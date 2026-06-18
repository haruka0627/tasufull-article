#!/usr/bin/env node
/**
 * 安否 RLS — 実 Supabase 検証（P9-5）
 *
 *   node scripts/verify-anpi-rls-real-db.mjs
 *
 * 前提（DB）:
 *   - sql/anpi-rls-production.sql 適用済み
 *   - sql/anpi-rls-drop-dev-policies.sql 適用済み（*_dev 0 件）
 *   - sql/anpi-identity-linking.sql 適用済み
 *
 * 必須環境変数:
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   ANPI_RLS_USER_A_JWT, ANPI_RLS_USER_B_JWT, ANPI_RLS_ADMIN_JWT
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTEXT_TABLE = "anpi_user_contexts";
const LOGS_TABLE = "anpi_notification_logs";

const RUN_SUFFIX =
  String(process.env.ANPI_RLS_RUN_SUFFIX || "").trim() ||
  Date.now().toString(36).slice(-10);

const TEST_CTX_A = `anpi_rls_verify_ctx_a_${RUN_SUFFIX}`;
const TEST_CTX_B = `anpi_rls_verify_ctx_b_${RUN_SUFFIX}`;
const TEST_LOG_A = `anpi_rls_verify_log_a_${RUN_SUFFIX}`;
const TEST_LOG_B = `anpi_rls_verify_log_b_${RUN_SUFFIX}`;

/** 過去実行分も含めて削除 */
const LEGACY_CTX_IDS = ["anpi_rls_verify_ctx_a", "anpi_rls_verify_ctx_b"];
const LEGACY_LOG_IDS = ["anpi_rls_verify_log_a", "anpi_rls_verify_log_b"];

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ANPI_RLS_USER_A_JWT",
  "ANPI_RLS_USER_B_JWT",
  "ANPI_RLS_ADMIN_JWT",
];

/** @type {{ step: string, ok: boolean, detail?: string, skipped?: boolean }[]} */
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
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function loadEnv() {
  loadDotEnv();
  const cfg = {};
  for (const key of REQUIRED_ENV) {
    const fromEnv = String(process.env[key] || "").trim();
    if (fromEnv) cfg[key] = fromEnv;
  }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    try {
      const text = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
      if (!cfg.SUPABASE_URL) {
        const urlMatch = text.match(/url:\s*"(https:[^"]+)"/);
        if (urlMatch?.[1]) cfg.SUPABASE_URL = urlMatch[1].replace(/\/$/, "");
      }
      if (!cfg.SUPABASE_ANON_KEY) {
        const keyMatch = text.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/);
        if (keyMatch?.[1]) cfg.SUPABASE_ANON_KEY = keyMatch[1];
      }
    } catch {
      /* ignore */
    }
  }
  return cfg;
}

function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || "").split(".")[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function memberIdFromJwt(jwt) {
  const p = decodeJwtPayload(jwt);
  return String(
    p.member_id ||
      p.app_metadata?.member_id ||
      p.user_metadata?.member_id ||
      p.sub ||
      ""
  ).trim();
}

async function rest(cfg, { jwt, method, queryPath, body, prefer }) {
  const token = jwt || cfg.SUPABASE_ANON_KEY;
  const headers = {
    apikey: cfg.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${queryPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

function isDenied(res) {
  if (res.status === 401 || res.status === 403) return true;
  const msg = JSON.stringify(res.data || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("jwt") ||
    msg.includes("not authorized")
  );
}

function inList(values) {
  return values.map((v) => encodeURIComponent(v)).join(",");
}

function contextRow(userId, memberId, holderId, name) {
  return {
    user_id: userId,
    anpi_user_id: userId,
    member_id: memberId,
    contract_holder_id: holderId,
    contract_holder_name: name,
    user_name: name,
    notification_level: "call_only",
    notification_method: "tasful_chat",
    notify_channels: ["tasful_chat"],
    line_notification_enabled: false,
    relationship: "self",
    account_scope: "self",
    metadata: { is_anpi_user: true, consent: {}, anpi_rls_verify: true },
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

function logRow(logId, userId, memberId, holderId) {
  return {
    log_id: logId,
    user_id: userId,
    anpi_user_id: userId,
    member_id: memberId,
    contract_holder_id: holderId,
    event_type: "ai_search",
    title: "RLS verify",
    message: "verify",
    severity: "info",
    is_read: false,
    source: "tasful",
    metadata: { anpi_rls_verify: true },
    line_status: "pending",
    notify_channels: [],
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

async function deleteByUserIds(cfg, adminJwt, userIds) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await rest(cfg, {
    jwt: adminJwt,
    method: "DELETE",
    queryPath: `${CONTEXT_TABLE}?user_id=in.(${inList(unique)})`,
    prefer: "return=representation",
  });
}

async function deleteByLogIds(cfg, adminJwt, logIds) {
  const unique = [...new Set(logIds.filter(Boolean))];
  if (!unique.length) return;
  await rest(cfg, {
    jwt: adminJwt,
    method: "DELETE",
    queryPath: `${LOGS_TABLE}?log_id=in.(${inList(unique)})`,
    prefer: "return=representation",
  });
}

/** 検証用行を一括削除（現行 run + レガシー固定 ID） */
async function cleanup(cfg, adminJwt) {
  await deleteByLogIds(cfg, adminJwt, [
    TEST_LOG_A,
    TEST_LOG_B,
    ...LEGACY_LOG_IDS,
  ]);
  await deleteByUserIds(cfg, adminJwt, [
    TEST_CTX_A,
    TEST_CTX_B,
    ...LEGACY_CTX_IDS,
  ]);
}

async function assertNoVerifyContextRows(cfg, adminJwt, userIds) {
  const res = await rest(cfg, {
    jwt: adminJwt,
    method: "GET",
    queryPath: `${CONTEXT_TABLE}?user_id=in.(${inList(userIds)})&select=user_id`,
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.length === 0;
}

/**
 * anon が insert できる = *_dev 等が残っている可能性が高い
 */
async function preflightDevPoliciesLikelyOpen(cfg) {
  const probeUserId = `anpi_rls_preflight_${RUN_SUFFIX}`;
  const res = await rest(cfg, {
    method: "POST",
    queryPath: CONTEXT_TABLE,
    body: contextRow(probeUserId, "anpi_rls_preflight_member", "anpi_rls_preflight_member", "preflight"),
    prefer: "return=representation",
  });
  if (res.status === 201 || (res.ok && !isDenied(res))) {
    return { open: true, probeUserId };
  }
  return { open: false, probeUserId: null };
}

async function main() {
  console.log("\n=== 安否 RLS 実 Supabase 検証 (P9-5) ===\n");
  console.log(`  run_suffix: ${RUN_SUFFIX}`);
  console.log(`  test ctx:   ${TEST_CTX_A} / ${TEST_CTX_B}`);
  console.log(`  test logs:  ${TEST_LOG_A}\n`);

  const cfg = loadEnv();
  const missing = REQUIRED_ENV.filter((k) => !String(cfg[k] || "").trim());
  if (missing.length) {
    console.error("必要な環境変数が不足しています。\n");
    missing.forEach((k) => console.error(`    - ${k}`));
    console.error("\n  JWT: node scripts/issue-anpi-rls-jwt.mjs --write-env\n");
    process.exitCode = 2;
    return;
  }

  const jwtA = cfg.ANPI_RLS_USER_A_JWT;
  const jwtB = cfg.ANPI_RLS_USER_B_JWT;
  const jwtAdmin = cfg.ANPI_RLS_ADMIN_JWT;
  const memberA = memberIdFromJwt(jwtA);
  const memberB = memberIdFromJwt(jwtB);

  if (!memberA || !memberB || memberA === memberB) {
    fail("JWT member_id 解決", `A=${memberA || "?"} B=${memberB || "?"}`);
    process.exitCode = 1;
    return;
  }
  pass("JWT member_id 解決", `A=${memberA} B=${memberB}`);

  await cleanup(cfg, jwtAdmin);
  const clean = await assertNoVerifyContextRows(cfg, jwtAdmin, [
    TEST_CTX_A,
    TEST_CTX_B,
    ...LEGACY_CTX_IDS,
  ]);
  if (clean) pass("事前 cleanup", "verify 用 context 0 件");
  else fail("事前 cleanup", "削除後も verify 用 context が残存");

  const preflight = await preflightDevPoliciesLikelyOpen(cfg);
  if (preflight.open) {
    fail(
      "preflight: anon insert",
      "HTTP 201 — *_dev ポリシーが残っている可能性があります"
    );
    console.error("\n  対処: Supabase SQL Editor で次を実行してください:");
    console.error("    sql/anpi-rls-drop-dev-policies.sql");
    console.error("  確認: sql/anpi-rls-staging-verify.sql セクション 3 が 0 行");
    console.error("  併せて sql/anpi-rls-production.sql の anpi_is_admin() を再適用\n");
    if (preflight.probeUserId) {
      await deleteByUserIds(cfg, jwtAdmin, [preflight.probeUserId]);
    }
    process.exitCode = 3;
    const ng = results.filter((r) => !r.ok);
    console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} OK (aborted) ===\n`);
    if (ng.length) return;
  } else {
    pass("preflight: anon insert 拒否", "dev ポリシー未検出");
  }

  // A. anon
  const anonCtxInsert = await rest(cfg, {
    method: "POST",
    queryPath: CONTEXT_TABLE,
    body: contextRow(TEST_CTX_A, memberA, memberA, "anon test"),
    prefer: "return=representation",
  });
  if (isDenied(anonCtxInsert)) pass("A: anon context insert 拒否");
  else fail("A: anon context insert 拒否", `HTTP ${anonCtxInsert.status}`);

  const anonLogInsert = await rest(cfg, {
    method: "POST",
    queryPath: LOGS_TABLE,
    body: logRow(TEST_LOG_A, TEST_CTX_A, memberA, memberA),
    prefer: "return=representation",
  });
  if (isDenied(anonLogInsert)) pass("A: anon logs insert 拒否");
  else fail("A: anon logs insert 拒否", `HTTP ${anonLogInsert.status}`);

  const anonSelect = await rest(cfg, {
    method: "GET",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_B)}&select=user_id`,
  });
  const anonRows = Array.isArray(anonSelect.data) ? anonSelect.data : [];
  if (anonRows.length === 0 || isDenied(anonSelect)) pass("A: anon 他人 select 不可");
  else fail("A: anon 他人 select 不可", `rows=${anonRows.length}`);

  await cleanup(cfg, jwtAdmin);

  // B. user A own CRUD
  const insA = await rest(cfg, {
    jwt: jwtA,
    method: "POST",
    queryPath: CONTEXT_TABLE,
    body: contextRow(TEST_CTX_A, memberA, memberA, "User A"),
    prefer: "return=representation",
  });
  if (insA.ok) pass("B: user A context insert");
  else fail("B: user A context insert", `HTTP ${insA.status} ${JSON.stringify(insA.data)}`);

  const selA = await rest(cfg, {
    jwt: jwtA,
    method: "GET",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_A)}&select=user_id,member_id`,
  });
  const rowA = Array.isArray(selA.data) ? selA.data[0] : null;
  if (selA.ok && rowA?.user_id === TEST_CTX_A) pass("B: user A context select");
  else fail("B: user A context select", JSON.stringify(selA.data));

  const updA = await rest(cfg, {
    jwt: jwtA,
    method: "PATCH",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_A)}`,
    body: { user_name: "User A updated", updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (updA.ok) pass("B: user A context update");
  else fail("B: user A context update", `HTTP ${updA.status}`);

  const logInsA = await rest(cfg, {
    jwt: jwtA,
    method: "POST",
    queryPath: LOGS_TABLE,
    body: logRow(TEST_LOG_A, TEST_CTX_A, memberA, memberA),
    prefer: "return=representation",
  });
  if (logInsA.ok) pass("B: user A logs insert");
  else fail("B: user A logs insert", `HTTP ${logInsA.status} ${JSON.stringify(logInsA.data)}`);

  const logSelA = await rest(cfg, {
    jwt: jwtA,
    method: "GET",
    queryPath: `${LOGS_TABLE}?log_id=eq.${encodeURIComponent(TEST_LOG_A)}&select=log_id`,
  });
  if (logSelA.ok && Array.isArray(logSelA.data) && logSelA.data.length === 1) {
    pass("B: user A logs select");
  } else fail("B: user A logs select", JSON.stringify(logSelA.data));

  // C. user B cannot access A
  const selBother = await rest(cfg, {
    jwt: jwtB,
    method: "GET",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_A)}&select=user_id`,
  });
  const bRows = Array.isArray(selBother.data) ? selBother.data : [];
  if (bRows.length === 0) pass("C: user B 他人 context select 不可");
  else fail("C: user B 他人 context select 不可", `rows=${bRows.length}`);

  const updBother = await rest(cfg, {
    jwt: jwtB,
    method: "PATCH",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_A)}`,
    body: { user_name: "hack", updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  const patchedRows = Array.isArray(updBother.data) ? updBother.data : [];
  if (isDenied(updBother) || patchedRows.length === 0) {
    pass("C: user B 他人 context update 不可");
  } else {
    fail("C: user B 他人 context update 不可", `updated=${patchedRows.length}`);
  }

  const logSelBother = await rest(cfg, {
    jwt: jwtB,
    method: "GET",
    queryPath: `${LOGS_TABLE}?log_id=eq.${encodeURIComponent(TEST_LOG_A)}&select=log_id`,
  });
  const logBRows = Array.isArray(logSelBother.data) ? logSelBother.data : [];
  if (logBRows.length === 0) pass("C: user B 他人 logs select 不可");
  else fail("C: user B 他人 logs select 不可", `rows=${logBRows.length}`);

  // D. contract holder logs
  const holderLogs = await rest(cfg, {
    jwt: jwtA,
    method: "GET",
    queryPath: `${LOGS_TABLE}?contract_holder_id=eq.${encodeURIComponent(memberA)}&select=log_id,contract_holder_id&limit=20`,
  });
  const holderRows = Array.isArray(holderLogs.data) ? holderLogs.data : [];
  if (holderLogs.ok && holderRows.some((r) => r.log_id === TEST_LOG_A)) {
    pass("D: 契約者 contract_holder_id で logs 参照");
  } else {
    fail("D: 契約者 contract_holder_id で logs 参照", JSON.stringify(holderRows));
  }

  // E. admin
  const insBAdmin = await rest(cfg, {
    jwt: jwtAdmin,
    method: "POST",
    queryPath: CONTEXT_TABLE,
    body: contextRow(TEST_CTX_B, memberB, memberB, "User B"),
    prefer: "return=representation",
  });
  if (!insBAdmin.ok) {
    fail("E: admin context insert (B)", `HTTP ${insBAdmin.status} ${JSON.stringify(insBAdmin.data)}`);
  }

  const adminSel = await rest(cfg, {
    jwt: jwtAdmin,
    method: "GET",
    queryPath: `${CONTEXT_TABLE}?user_id=in.(${inList([TEST_CTX_A, TEST_CTX_B])})&select=user_id`,
  });
  const adminRows = Array.isArray(adminSel.data) ? adminSel.data : [];
  if (adminSel.ok && adminRows.length >= 2) pass("E: admin 全件 select", `count=${adminRows.length}`);
  else fail("E: admin 全件 select", JSON.stringify(adminSel.data));

  const adminUpd = await rest(cfg, {
    jwt: jwtAdmin,
    method: "PATCH",
    queryPath: `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(TEST_CTX_B)}`,
    body: { user_name: "Admin updated B", updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (adminUpd.ok) pass("E: admin update");
  else fail("E: admin update", `HTTP ${adminUpd.status}`);

  await cleanup(cfg, jwtAdmin);

  const ok = results.filter((r) => r.ok && !r.skipped).length;
  const ng = results.filter((r) => !r.ok);
  console.log(`\n=== ${ok}/${results.length} OK ===\n`);
  if (ng.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
