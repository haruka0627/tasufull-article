#!/usr/bin/env node
/**
 * Verify Staging gen_ai_subscriptions after apply (read-only + RLS smoke).
 *   node scripts/verify-staging-gen-ai-subscriptions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function assert(label, cond, detail = "") {
  if (!cond) {
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
  return true;
}

const env = parseEnv(path.join(ROOT, ".env.staging"));
const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.SUPABASE_ANON_KEY || "";
const service = env.SUPABASE_SERVICE_ROLE_KEY || "";

assert("staging url", url.includes(STAGING_REF), url);
assert("keys present", Boolean(anon && service));

async function rest(pathSuffix, { key, method = "GET", body } = {}) {
  const res = await fetch(url + pathSuffix, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

const cols = await rest(
  "/rest/v1/gen_ai_subscriptions?select=user_id,plan_code,status,subscription_status,current_period_end,cancel_at_period_end&limit=1",
  { key: service },
);
assert("service_role select", cols.status === 200, `status=${cols.status}`);

const anonRead = await rest("/rest/v1/gen_ai_subscriptions?select=user_id&limit=1", { key: anon });
assert(
  "anon select blocked or empty under RLS",
  anonRead.status === 200 && Array.isArray(anonRead.data) && anonRead.data.length === 0
    || anonRead.status === 401
    || anonRead.status === 403,
  `status=${anonRead.status}`,
);

const probeId = `pagegen-rls-probe-${Date.now()}`;
const anonWrite = await rest("/rest/v1/gen_ai_subscriptions", {
  key: anon,
  method: "POST",
  body: {
    user_id: probeId,
    plan_code: "pro_980",
    subscription_status: "active",
    status: "active",
  },
});
assert(
  "anon write rejected",
  anonWrite.status === 401 || anonWrite.status === 403 || (anonWrite.status >= 400 && anonWrite.status < 500),
  `status=${anonWrite.status}`,
);

const leftover = await rest(
  `/rest/v1/gen_ai_subscriptions?user_id=eq.${encodeURIComponent(probeId)}`,
  { key: service },
);
assert(
  "anon write did not persist",
  Array.isArray(leftover.data) && leftover.data.length === 0,
  JSON.stringify(leftover.data),
);

if (process.exitCode) {
  console.error("verify FAILED");
  process.exit(1);
}
console.log("verify OK");
