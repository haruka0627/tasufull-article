#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSupabaseServerHeaders,
  tryResolveSupabaseServerSecret,
} from "./lib/supabase-server-secret.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingRef = "ahlxuyvhzqdqaojiywmu";
const productionRef = "ddojquacsyqesrjhcvmn";
const outputPath = path.join(root, "reports", "tlv-step5l-prod-gate-03-hosted-parity.json");

function loadEnv(relative) {
  const values = Object.create(null);
  const body = fs.readFileSync(path.join(root, relative), "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function pseudonym(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function jwtPayload(token) {
  const segment = String(token).split(".")[1];
  if (!segment) throw new Error("invalid_jwt_shape");
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

function countFromRange(value) {
  const match = String(value || "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    code: typeof data?.code === "string" ? data.code : null,
    count: countFromRange(response.headers.get("content-range")),
  };
}

async function signIn(baseUrl, anonKey, email, password) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`qa_sign_in_failed:${response.status}`);
  return data.access_token;
}

function userHeaders(anonKey, jwt, method = "GET") {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${jwt}`,
    Accept: "application/json",
    "Accept-Profile": "tlv",
    "Content-Profile": "tlv",
    "Content-Type": "application/json",
    Prefer: method === "GET" ? "count=exact" : "return=minimal",
  };
}

function isDenied(result) {
  return [401, 403, 404, 405].includes(result.status) && result.code !== "PGRST106";
}

const assertions = [];
function check(name, condition, evidence) {
  assertions.push({ name, pass: Boolean(condition), evidence });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
}

async function main() {
  const env = loadEnv(".env.staging");
  const baseUrl = String(env.SUPABASE_URL || env.TASFUL_SUPABASE_URL || "").replace(/\/$/, "");
  const projectRef = String(env.SUPABASE_PROJECT_REF || env.TLV_QA_PROJECT_REF || "");
  const anonKey = String(env.SUPABASE_ANON_KEY || env.TASFUL_SUPABASE_ANON_KEY || "");
  const secret = tryResolveSupabaseServerSecret(env);

  if (projectRef !== stagingRef || !baseUrl.includes(stagingRef) || baseUrl.includes(productionRef)) {
    throw new Error("shared_staging_guard_failed");
  }
  if (!anonKey || !secret.ok) throw new Error("staging_credentials_missing");
  for (const name of [
    "TLV_QA_SENDER_EMAIL",
    "TLV_QA_SENDER_PASSWORD",
    "TLV_QA_RECEIVER_EMAIL",
    "TLV_QA_RECEIVER_PASSWORD",
  ]) {
    if (!env[name]) throw new Error(`qa_credential_missing:${name}`);
  }

  const [senderJwt, receiverJwt] = await Promise.all([
    signIn(baseUrl, anonKey, env.TLV_QA_SENDER_EMAIL, env.TLV_QA_SENDER_PASSWORD),
    signIn(baseUrl, anonKey, env.TLV_QA_RECEIVER_EMAIL, env.TLV_QA_RECEIVER_PASSWORD),
  ]);
  const sender = jwtPayload(senderJwt);
  const receiver = jwtPayload(receiverJwt);
  check("signed_jwt_sender", sender.role === "authenticated" && Boolean(sender.sub), {
    subject: pseudonym(sender.sub),
    role: sender.role,
  });
  check("signed_jwt_receiver", receiver.role === "authenticated" && Boolean(receiver.sub), {
    subject: pseudonym(receiver.sub),
    role: receiver.role,
  });
  check("jwt_subjects_distinct", sender.sub !== receiver.sub, { distinct: sender.sub !== receiver.sub });

  const restBase = `${baseUrl}/rest/v1`;
  const anonHeaders = userHeaders(anonKey, "", "GET");
  delete anonHeaders.Authorization;
  const senderHeaders = userHeaders(anonKey, senderJwt);
  const receiverHeaders = userHeaders(anonKey, receiverJwt);
  const serviceHeaders = {
    ...buildSupabaseServerHeaders(secret.credential, { accept: "application/json", prefer: "count=exact" }),
    "Accept-Profile": "tlv",
    "Content-Profile": "tlv",
  };

  const targetTables = ["monthly_settlements", "payout_log"];
  for (const table of targetTables) {
    const endpoint = `${restBase}/${table}?select=id&limit=1`;
    const [anon, senderRead, receiverRead, serviceRead] = await Promise.all([
      request(endpoint, { headers: anonHeaders }),
      request(endpoint, { headers: senderHeaders }),
      request(endpoint, { headers: receiverHeaders }),
      request(endpoint, { headers: serviceHeaders }),
    ]);
    check(`${table}_anon_denied`, isDenied(anon), anon);
    check(`${table}_sender_authenticated`, senderRead.status === 200, senderRead);
    check(`${table}_receiver_authenticated`, receiverRead.status === 200, receiverRead);
    check(`${table}_service_boundary`, serviceRead.status === 200, serviceRead);
    check(`${table}_zero_row_consistency`, serviceRead.count === 0 && senderRead.count === 0 && receiverRead.count === 0, {
      service: serviceRead.count,
      sender: senderRead.count,
      receiver: receiverRead.count,
    });
  }

  for (const [table, keyColumn] of [
    ["settlement_ledger_links", "settlement_id"],
    ["settlement_state_events", "id"],
    ["settlement_hold_events", "id"],
  ]) {
    const result = await request(`${restBase}/${table}?select=${keyColumn}&limit=1`, { headers: senderHeaders });
    check(`${table}_non_ops_filtered`, result.status === 200 && result.count === 0, result);
  }

  const insertAttempt = await request(`${restBase}/monthly_settlements`, {
    method: "POST",
    headers: userHeaders(anonKey, senderJwt, "POST"),
    body: JSON.stringify({}),
  });
  check("authenticated_settlement_insert_denied", isDenied(insertAttempt), insertAttempt);

  const payoutRpcAttempt = await request(`${restBase}/rpc/create_canonical_settlement_payout`, {
    method: "POST",
    headers: userHeaders(anonKey, senderJwt, "POST"),
    body: JSON.stringify({
      p_settlement_id: "00000000-0000-4000-8000-000000000000",
      p_actor_id: "gate03-authz-deny-probe",
      p_occurred_at: "2026-08-29T00:00:00Z",
    }),
  });
  check("authenticated_payout_rpc_denied", isDenied(payoutRpcAttempt), payoutRpcAttempt);

  const failed = assertions.filter((entry) => !entry.pass);
  const evidence = {
    schema: "tasful.tlv.step5l_gate03_hosted_parity.v1",
    generated_at: new Date().toISOString(),
    environment: "shared_staging",
    project_ref: stagingRef,
    production_ref_denied: true,
    signed_jwt_users: 2,
    source_rows: { monthly_settlements: 0, payout_log: 0 },
    evidence_boundary: "Signed JWT/PostgREST role and privilege boundary on zero-row hosted tables; owner/cross-row fixture semantics are covered by isolated regression plus hosted policy catalog parity.",
    mutations: { attempted_denied_writes: 2, successful_writes: 0 },
    assertions,
    verdict: failed.length ? "FAIL" : "PASS",
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`TLV_STEP5L_PROD_GATE_03_HOSTED_PARITY: ${evidence.verdict} (${assertions.length - failed.length}/${assertions.length})`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`FAIL gate03_hosted_parity:${error.message}`);
  process.exitCode = 1;
});
