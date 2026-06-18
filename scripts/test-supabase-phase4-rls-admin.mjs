#!/usr/bin/env node
/**
 * Supabase Phase 4 — 運営系本番相当 RLS / admin 検証（Staging リンク済み DB）
 *
 *   node scripts/load-dotenv-run.mjs scripts/test-supabase-phase4-rls-admin.mjs
 *
 * 前提:
 *   node scripts/apply-staging-phase4-ops-rls.mjs
 *   ANPI_RLS_ADMIN_JWT, ANPI_RLS_USER_A_JWT（scripts/issue-anpi-rls-jwt.mjs）
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = Date.now().toString(36).slice(-8);
const TEST_TICKET = `ops_rls_p4_${RUN}`;
const TEST_CASE = `ops_rls_case_p4_${RUN}`;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = /^\s*([^#=]+)=(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1].trim()]) process.env[m[1].trim()] = v;
    }
  }
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const adminJwt = process.env.ANPI_RLS_ADMIN_JWT || "";
  const userJwt = process.env.ANPI_RLS_USER_A_JWT || "";
  if (!url || !anon) {
    return null;
  }
  return { url, anon, service, adminJwt, userJwt };
}

async function rest(cfg, table, { method = "GET", jwt, query = "", body, prefer } = {}) {
  const headers = {
    apikey: cfg.anon,
    Authorization: `Bearer ${jwt || cfg.anon}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
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

async function testRlsMatrix(cfg) {
  if (!cfg.adminJwt || !cfg.userJwt) {
    console.log("SKIP: Phase 4 RLS live (set ANPI_RLS_ADMIN_JWT + ANPI_RLS_USER_A_JWT)");
    return;
  }

  const anonRead = await rest(cfg, "support_tickets", { query: "?select=id&limit=1" });
  const anonRows = Array.isArray(anonRead.data) ? anonRead.data : [];
  if (anonRows.length > 0) fail(`anon should not read support_tickets (got ${anonRows.length})`);
  pass("anon SELECT support_tickets — deny（0 rows）");

  const userRead = await rest(cfg, "support_tickets", {
    jwt: cfg.userJwt,
    query: "?select=id&limit=1",
  });
  const userRows = Array.isArray(userRead.data) ? userRead.data : [];
  if (userRows.length > 0) fail(`general user should not read ops tables (got ${userRows.length})`);
  pass("authenticated 一般会員 SELECT — deny");

  const adminRead = await rest(cfg, "support_tickets", {
    jwt: cfg.adminJwt,
    query: "?select=id&limit=5",
  });
  if (!adminRead.ok) fail(`admin SELECT HTTP ${adminRead.status} ${JSON.stringify(adminRead.data)}`);
  pass(`admin SELECT support_tickets — allow (HTTP ${adminRead.status})`);

  const now = new Date().toISOString();
  const insertBody = {
    id: TEST_TICKET,
    user_id: "ops_rls_test",
    title: "Phase4 RLS insert test",
    body: "staging admin only",
    category: "admin_review",
    severity: "medium",
    status: "open",
    source: "phase4_rls_test",
    created_at: now,
    updated_at: now,
  };

  const userInsert = await rest(cfg, "support_tickets", {
    method: "POST",
    jwt: cfg.userJwt,
    body: insertBody,
    prefer: "return=representation",
  });
  if (userInsert.ok && Array.isArray(userInsert.data) && userInsert.data.length > 0) {
    fail("general user INSERT should be denied");
  }
  pass("authenticated 一般会員 INSERT — deny");

  const adminInsert = await rest(cfg, "support_tickets", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: insertBody,
    prefer: "return=representation",
  });
  if (!adminInsert.ok || !Array.isArray(adminInsert.data) || adminInsert.data.length < 1) {
    fail(`admin INSERT HTTP ${adminInsert.status} ${JSON.stringify(adminInsert.data)}`);
  }
  pass("admin INSERT support_tickets — allow");

  const adminUpdate = await rest(cfg, "support_tickets", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(TEST_TICKET)}`,
    body: { status: "needs_review", admin_note: "phase4 patch", resolved_at: null },
    prefer: "return=representation",
  });
  if (!adminUpdate.ok) fail(`admin UPDATE HTTP ${adminUpdate.status}`);
  pass("admin UPDATE support_tickets（status / admin_note）— allow");

  const adminDelete = await rest(cfg, "support_tickets", {
    method: "DELETE",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(TEST_TICKET)}`,
    prefer: "return=representation",
  });
  if (adminDelete.ok && Array.isArray(adminDelete.data) && adminDelete.data.length > 0) {
    fail("admin DELETE should be denied by RLS");
  }
  pass("admin DELETE support_tickets — deny（ポリシーなし）");

  const caseInsert = await rest(cfg, "ai_ops_cases", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: TEST_CASE,
      title: "Phase4 case",
      body: "ops rls",
      status: "needs_review",
      source: "phase4_rls_test",
      created_at: now,
      updated_at: now,
    },
    prefer: "return=representation",
  });
  if (!caseInsert.ok) fail(`admin INSERT ai_ops_cases ${caseInsert.status}`);
  pass("admin INSERT ai_ops_cases — allow");

  if (cfg.service) {
    const svcDelete = await rest(
      { ...cfg, anon: cfg.service },
      "support_tickets",
      {
        method: "DELETE",
        jwt: cfg.service,
        query: `?id=eq.${encodeURIComponent(TEST_TICKET)}`,
      }
    );
    if (!svcDelete.ok) fail(`service_role cleanup ticket ${svcDelete.status}`);
    await rest(
      { ...cfg, anon: cfg.service },
      "ai_ops_cases",
      {
        method: "DELETE",
        jwt: cfg.service,
        query: `?id=eq.${encodeURIComponent(TEST_CASE)}`,
      }
    );
    pass("service_role DELETE — allow（保守・RLSバイパス）");
  } else {
    console.log("SKIP: service_role cleanup (no SUPABASE_SERVICE_ROLE_KEY)");
  }
}

async function testPhase23Regression() {
  const r2 = spawnSync("node", ["scripts/test-supabase-phase2-read-poc.mjs"], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    env: { ...process.env, BUILDER_BASE_URL: "", SKIP_OPS_LIVE_READ: "1" },
  });
  if (r2.status !== 0) {
    fail(`Phase 2 JS regression:\n${r2.stderr?.toString() || r2.stdout?.toString()}`);
  }
  pass("Phase 2/3 フラグ OFF ブラウザ回帰 — JS 非破壊");

  const r3 = spawnSync("node", ["scripts/test-supabase-phase3-dual-write.mjs"], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    env: { ...process.env, BUILDER_BASE_URL: "", SKIP_OPS_LIVE_DUAL_WRITE: "1" },
  });
  if (r3.status !== 0) {
    fail(`Phase 3 JS regression:\n${r3.stderr?.toString() || r3.stdout?.toString()}`);
  }
  pass("Phase 3 mock dual-write 回帰 — JS 非破壊");
}

async function main() {
  const cfg = loadEnv();
  if (!cfg) {
    console.log("SKIP: Phase 4 RLS (SUPABASE_URL / SUPABASE_ANON_KEY)");
    await testPhase23Regression();
    return;
  }

  await testRlsMatrix(cfg);
  await testPhase23Regression();
  console.log("\nAll Supabase Phase 4 ops RLS admin tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
