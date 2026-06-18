#!/usr/bin/env node
/**
 * 安否 Phase2 RLS P0 検証（dev DROP 後）
 *
 *   node scripts/verify-anpi-no-response-rls-p0.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (existsSync(envPath)) {
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
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let anonKey = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  return {
    url,
    anonKey,
    jwtA: process.env.ANPI_RLS_USER_A_JWT || "",
    jwtB: process.env.ANPI_RLS_USER_B_JWT || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

async function rest(cfg, { table, jwt, method = "GET", query = "", body }) {
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${jwt || cfg.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
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

async function main() {
  console.log("\n=== 安否 Phase2 RLS P0 検証 ===\n");
  const cfg = loadEnv();
  if (!cfg.url || !cfg.anonKey || !cfg.jwtA || !cfg.jwtB) {
    fail("SUPABASE_URL / anon / ANPI JWT required");
    process.exit(2);
  }

  const anonIns = await rest(cfg, {
    table: "anpi_check_sessions",
    method: "POST",
    body: { target_user_id: "x", contract_holder_id: "y", status: "sent_to_user" },
  });
  if (anonIns.status === 201 || (anonIns.ok && !String(JSON.stringify(anonIns.data)).includes("row-level security"))) {
    fail(`anon INSERT anpi_check_sessions allowed (${anonIns.status})`);
  } else pass("anon INSERT anpi_check_sessions 拒否");

  const anonTalk = await rest(cfg, { table: "talk_notifications", query: "select=id&limit=5" });
  const anonTalkRows = Array.isArray(anonTalk.data) ? anonTalk.data.length : 0;
  if (anonTalkRows > 0) fail(`anon READ talk_notifications rows=${anonTalkRows}`);
  else pass("anon READ talk_notifications 0 行");

  const ins = await rest(cfg, {
    table: "anpi_check_sessions",
    jwt: cfg.jwtA,
    method: "POST",
    body: {
      target_user_id: "anpi_rls_target_x",
      contract_holder_id: "anpi_rls_member_a",
      status: "family_notified",
      target_user_name: "RLS probe",
    },
  });
  const checkId = ins.data?.[0]?.id;
  if (!ins.ok || !checkId) fail(`holder INSERT check session (${ins.status})`);
  else pass("contract_holder INSERT check session");

  const strangerRead = await rest(cfg, {
    table: "anpi_check_sessions",
    jwt: cfg.jwtB,
    query: `select=id&id=eq.${checkId}`,
  });
  const sRows = Array.isArray(strangerRead.data) ? strangerRead.data.length : 0;
  if (sRows > 0) fail("stranger READ check session");
  else pass("stranger READ check session 拒否");

  const auditIns = await rest(cfg, {
    table: "anpi_no_response_audit_log",
    jwt: cfg.jwtA,
    method: "POST",
    body: {
      anpi_check_id: checkId,
      actor_user_id: "anpi_rls_member_a",
      action_type: "confirmed",
      payload: { probe: true },
    },
  });
  const auditId = auditIns.data?.[0]?.id;
  if (!auditIns.ok || !auditId) fail(`audit INSERT (${auditIns.status})`);
  else pass("contract_holder audit INSERT");

  const auditUpd = await rest(cfg, {
    table: "anpi_no_response_audit_log",
    jwt: cfg.jwtA,
    method: "PATCH",
    query: `id=eq.${auditId}`,
    body: { action_type: "ops_consult" },
  });
  const patched = Array.isArray(auditUpd.data) ? auditUpd.data.length : 0;
  if (auditUpd.ok && patched > 0) fail("audit UPDATE allowed");
  else pass("audit UPDATE 拒否（改ざん不可）");

  const auditDel = await rest(cfg, {
    table: "anpi_no_response_audit_log",
    jwt: cfg.jwtA,
    method: "DELETE",
    query: `id=eq.${auditId}`,
  });
  const deleted = Array.isArray(auditDel.data) ? auditDel.data.length : 0;
  if (auditDel.ok && deleted > 0) fail("audit DELETE allowed");
  else pass("audit DELETE 拒否");

  if (cfg.serviceKey && checkId) {
    await rest(cfg, {
      table: "anpi_no_response_audit_log",
      jwt: cfg.serviceKey,
      method: "DELETE",
      query: `anpi_check_id=eq.${checkId}`,
    });
    await rest(cfg, {
      table: "anpi_check_sessions",
      jwt: cfg.serviceKey,
      method: "DELETE",
      query: `id=eq.${checkId}`,
    });
    pass("cleanup probe rows");
  }

  console.log(`\n=== ${errors.length ? "FAIL" : "PASS"} (${errors.length} errors) ===\n`);
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
