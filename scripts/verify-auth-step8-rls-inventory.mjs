#!/usr/bin/env node
/**
 * NB-3 STEP 8 — RLS 棚卸し + anon / A-B プローブ
 *   node scripts/verify-auth-step8-rls-inventory.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTalkSupabaseConfig,
  ensureTalkJwt,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = path.join(ROOT, "reports", "auth-step8-rls-inventory.json");

const PROBE_TABLES = [
  "talk_notifications",
  "talk_ai_drafts",
  "anpi_user_contexts",
  "anpi_check_sessions",
  "anpi_no_response_audit_log",
  "support_tickets",
  "ai_ops_cases",
  "connect_issues",
  "listings",
  "business_listings",
  "favorites",
  "transaction_rooms",
  "transaction_messages",
  "service_deals",
  "chats",
  "reviews",
  "shop_orders",
  "members",
  "profiles",
];

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

async function rest(cfg, { table, method = "GET", query = "", body, jwt, useService = false }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 200) };
  }
  const range = res.headers.get("content-range") || "";
  const countMatch = range.match(/\/(\d+|\*)/);
  const count = countMatch ? countMatch[1] : null;
  return { ok: res.ok, status: res.status, data, count, countHeader: range };
}

function isDenied(res) {
  if (res.status === 401 || res.status === 403) return true;
  const msg = String(res.data?.message || res.data?.hint || "").toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied");
}

function rowCount(res) {
  if (Array.isArray(res.data)) return res.data.length;
  if (res.count && res.count !== "*") return Number(res.count);
  return 0;
}

async function fetchPolicies(cfg) {
  const res = await rest(cfg, {
    table: "pg_policies",
    query: "select=schemaname,tablename,policyname,roles,cmd,qual,with_check&schemaname=eq.public&order=tablename,policyname",
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data;
}

async function main() {
  loadDotEnv();
  const cfg = loadTalkSupabaseConfig();
  const report = {
    generatedAt: new Date().toISOString(),
    project: cfg.url || "",
    policies: null,
    devPolicyCount: null,
    permissivePolicySamples: [],
    anonProbes: [],
    abProbes: [],
    opsProbes: [],
    errors: [],
    passes: [],
  };

  console.log("\n=== STEP 8 RLS inventory ===\n");

  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    console.error("SUPABASE_URL / anon / service_role required");
    process.exit(1);
  }

  const policies = await fetchPolicies(cfg);
  if (policies) {
    report.policies = policies;
    const dev = policies.filter((p) => String(p.policyname || "").includes("_dev"));
    const staging = policies.filter(
      (p) =>
        String(p.policyname || "").includes("staging_read") ||
        String(p.policyname || "").includes("staging_dual_write")
    );
    const allowAll = policies.filter(
      (p) =>
        String(p.qual || "").trim() === "true" ||
        String(p.with_check || "").trim() === "true" ||
        /allow all/i.test(String(p.policyname || ""))
    );
    report.devPolicyCount = dev.length;
    report.stagingPolicyCount = staging.length;
    report.permissivePolicySamples = allowAll.slice(0, 40).map((p) => ({
      table: p.tablename,
      policy: p.policyname,
      cmd: p.cmd,
      roles: p.roles,
    }));
    if (dev.length === 0) {
      report.passes.push("no *_dev policies in pg_policies");
      console.log("  OK  no *_dev policies");
    } else {
      report.errors.push(`*_dev policies remain: ${dev.length}`);
      console.log(`  NG  *_dev policies: ${dev.length}`);
    }
    if (staging.length === 0) {
      report.passes.push("no staging_read/dual_write policies");
      console.log("  OK  no staging PoC policies");
    } else {
      report.errors.push(`staging policies remain: ${staging.length}`);
      console.log(`  NG  staging policies: ${staging.length}`);
    }
    console.log(`  info policies total: ${policies.length}, using(true) samples: ${allowAll.length}`);
  } else {
    console.log("  skip pg_policies (service role REST)");
  }

  let jwtA = "";
  let jwtB = "";
  let jwtAdmin = "";
  try {
    jwtA = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    jwtB = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    jwtAdmin = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
  } catch (err) {
    report.errors.push(`JWT setup: ${err.message}`);
    console.error(`  NG  JWT: ${err.message}`);
  }

  for (const table of PROBE_TABLES) {
    const anonRead = await rest(cfg, { table, query: "select=id&limit=3" });
    const probe = {
      table,
      anonReadStatus: anonRead.status,
      anonReadRows: rowCount(anonRead),
      anonReadDenied: isDenied(anonRead) || anonRead.status === 404,
      anonInsertStatus: null,
    };
    if (anonRead.status === 404) {
      probe.missing = true;
      report.anonProbes.push(probe);
      continue;
    }
    const insertBody = { id: `step8-probe-${Date.now()}`, user_id: "step8_anon_probe" };
    const anonInsert = await rest(cfg, { table, method: "POST", body: insertBody });
    probe.anonInsertStatus = anonInsert.status;
    probe.anonInsertDenied = isDenied(anonInsert);
    report.anonProbes.push(probe);

    const sensitive = [
      "talk_notifications",
      "anpi_user_contexts",
      "anpi_check_sessions",
      "support_tickets",
      "ai_ops_cases",
      "favorites",
      "transaction_rooms",
      "service_deals",
      "shop_orders",
    ].includes(table);

    if (sensitive && !probe.anonInsertDenied && anonInsert.ok) {
      report.errors.push(`anon INSERT allowed on ${table}`);
      console.log(`  NG  anon INSERT ${table}`);
    } else if (sensitive && probe.anonInsertDenied) {
      report.passes.push(`anon INSERT denied ${table}`);
    }
    if (sensitive && probe.anonReadRows > 0 && !isDenied(anonRead)) {
      report.errors.push(`anon READ ${probe.anonReadRows} rows on ${table}`);
      console.log(`  NG  anon READ ${table} (${probe.anonReadRows} rows)`);
    }
  }

  if (jwtA && jwtB) {
    const aNotif = await rest(cfg, {
      table: "talk_notifications",
      query: `select=id,user_id&user_id=eq.${encodeURIComponent(TALK_TEST_USERS.u_store.talkUserId)}&limit=1`,
      jwt: jwtA,
    });
    const bReadsA = rowCount(aNotif) > 0;
    report.abProbes.push({
      test: "userA reads userB notifications",
      pass: !bReadsA,
      rows: rowCount(aNotif),
    });
    if (bReadsA) {
      report.errors.push("user A can read user B talk_notifications");
      console.log("  NG  A reads B notifications");
    } else {
      report.passes.push("talk_notifications A/B isolation");
      console.log("  OK  talk_notifications A/B isolation");
    }

    for (const table of ["support_tickets", "ai_ops_cases", "connect_issues"]) {
      const r = await rest(cfg, { table, query: "select=id&limit=1", jwt: jwtA });
      if (r.status === 404) continue;
      const leaked = rowCount(r) > 0;
      report.opsProbes.push({ table, role: "member", rows: rowCount(r), pass: !leaked });
      if (leaked) {
        report.errors.push(`member JWT reads ${table}`);
        console.log(`  NG  member reads ${table}`);
      } else {
        console.log(`  OK  member denied ${table}`);
      }
    }

    if (jwtAdmin) {
      const adminOps = await rest(cfg, {
        table: "support_tickets",
        query: "select=id&limit=1",
        jwt: jwtAdmin,
      });
      report.opsProbes.push({
        table: "support_tickets",
        role: "tasu_admin",
        status: adminOps.status,
        rows: rowCount(adminOps),
      });
    }
  }

  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log(`\n  wrote ${OUT_JSON}`);
  console.log(`\n=== ${report.errors.length ? "FAIL" : "PASS"} (${report.passes.length} checks, ${report.errors.length} errors) ===\n`);
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
