#!/usr/bin/env node
/**
 * L2 — Auth Hook allowlist seed (@tasful.invalid T1–T5)
 *
 *   node scripts/seed-auth-hook-l2-allowlist.mjs
 *   node scripts/seed-auth-hook-l2-allowlist.mjs --dry-run
 *
 * Requires:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_URL (or chat-supabase-config.js)
 *   AUTH_HOOK_L2_ALLOWLIST_PASSWORD (repo 外 · .env · report に平文を書かない)
 *
 * Creates ONLY:
 *   t1@tasful.invalid … t5@tasful.invalid
 *
 * Does NOT update existing @tasful-dev.test users.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWLIST = [
  { slot: "T1", email: "t1@tasful.invalid", role: "normal_user" },
  { slot: "T2", email: "t2@tasful.invalid", role: "match_verified_user" },
  { slot: "T3", email: "t3@tasful.invalid", role: "banned_match_user" },
  { slot: "T4", email: "t4@tasful.invalid", role: "tasu_admin" },
  { slot: "T5", email: "t5@tasful.invalid", role: "missing_talk_user_id" },
];

const L1_BASELINE_IDS = new Set([
  "72d07af0-3d3b-4a87-8358-cae56a3ad721",
  "c8476454-e1f9-4efc-adfc-6fd6ba6102f9",
  "b77481c9-18f5-4130-854b-1a97db97c357",
  "a4a111ca-d70e-4444-bc1c-e7ca4efc5597",
  "15bb209a-7170-4702-8fd9-672bc5352616",
  "9d9bd0bb-8849-4dd5-bd25-b51e230a900a",
  "0f106b57-e056-451f-8fe4-079464c70815",
]);

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

function loadSupabaseConfig() {
  loadDotEnv();
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
  }
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (ref !== "ddojquacsyqesrjhcvmn") {
    throw new Error(`Ref mismatch: expected ddojquacsyqesrjhcvmn, got ${ref || url}`);
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required (.env)");
  }
  return { url, serviceRoleKey };
}

function ensurePassword() {
  loadDotEnv();
  if (process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD) {
    return process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD;
  }
  const generated = `AhL2-${randomBytes(18).toString("base64url")}!`;
  const envPath = path.join(ROOT, ".env");
  const line = `\n# L2 allowlist (do not commit if repo ever tracks .env)\nAUTH_HOOK_L2_ALLOWLIST_PASSWORD=${generated}\n`;
  appendFileSync(envPath, line, "utf8");
  process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD = generated;
  console.log("  wrote AUTH_HOOK_L2_ALLOWLIST_PASSWORD to .env (not printed)");
  return generated;
}

async function authFetch(cfg, { method, pathSuffix, body }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
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

async function listUsers(cfg) {
  const res = await authFetch(cfg, { method: "GET", pathSuffix: "/admin/users?per_page=200" });
  if (!res.ok) throw new Error(`list users failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data?.users || [];
}

function minimalAppMetadata() {
  return {
    provider: "email",
    providers: ["email"],
  };
}

function minimalUserMetadata() {
  return { email_verified: true };
}

async function createAllowlistUser(cfg, spec, password, dryRun) {
  const users = await listUsers(cfg);
  const existing = users.find(
    (u) => String(u.email || "").toLowerCase() === spec.email.toLowerCase()
  );
  if (existing) {
    console.log(`  skip     ${spec.slot} ${spec.email} exists id=${existing.id}`);
    return { action: "skipped", user: existing };
  }

  if (dryRun) {
    console.log(`  dry-run  would create ${spec.slot} ${spec.email}`);
    return { action: "dry-run", user: null };
  }

  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/admin/users",
    body: {
      email: spec.email,
      password,
      email_confirm: true,
      app_metadata: minimalAppMetadata(),
      user_metadata: minimalUserMetadata(),
    },
  });

  if (!res.ok) {
    throw new Error(`create ${spec.email}: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }

  const user = res.data?.user || res.data;
  console.log(`  created  ${spec.slot} ${spec.email} id=${user?.id}`);
  return { action: "created", user };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cfg = loadSupabaseConfig();
  const password = ensurePassword();

  console.log(`L2 allowlist seed · ref=ddojquacsyqesrjhcvmn · dryRun=${dryRun}`);

  const results = [];
  for (const spec of ALLOWLIST) {
    results.push(await createAllowlistUser(cfg, spec, password, dryRun));
  }

  if (dryRun) {
    console.log("dry-run complete — no writes");
    return;
  }

  const users = await listUsers(cfg);
  for (const u of users) {
    if (L1_BASELINE_IDS.has(u.id)) continue;
    const email = String(u.email || "").toLowerCase();
    if (!email.endsWith("@tasful.invalid")) {
      throw new Error(`Unexpected new user outside allowlist: ${email} id=${u.id}`);
    }
  }

  console.log("L2 seed complete");
  for (const r of results) {
    if (r.user?.id) {
      console.log(`  ${r.user.email}\t${r.user.id}\t${r.action}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
