#!/usr/bin/env node
/**
 * Business Directory Production Step 2 — ensure Stripe Test prices + Supabase secrets
 *   node scripts/bootstrap-business-directory-stripe-prices.mjs
 *   node scripts/bootstrap-business-directory-stripe-prices.mjs --dry-run
 *
 * Requires: business-directory Edge deployed · .env SUPABASE_SERVICE_ROLE_KEY
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env missing — need SUPABASE_SERVICE_ROLE_KEY");
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function runSecretsSet(pairs) {
  const args = ["supabase", "secrets", "set", ...pairs, "--project-ref", PROJECT_REF];
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "secrets set failed").slice(0, 400));
  }
}

async function main() {
  const env = loadEnv();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not in .env");

  console.log("=== BD Stripe bootstrap ===\n");
  const res = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action: "ops_ensure_stripe_prices" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ops_ensure_stripe_prices ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const standard = String(data.standard_price_id || "").trim();
  const pro = String(data.pro_price_id || "").trim();
  if (!standard || !pro) {
    throw new Error(`missing price ids: ${JSON.stringify(data)}`);
  }

  console.log(`mode: ${data.mode || "unknown"}`);
  console.log(`BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD=${standard}`);
  console.log(`BUSINESS_DIRECTORY_STRIPE_PRICE_PRO=${pro}`);

  if (dryRun) {
    console.log("\nDRY RUN — secrets not set");
    return;
  }

  runSecretsSet([
    `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD=${standard}`,
    `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO=${pro}`,
  ]);
  console.log("\nSupabase secrets updated (BD price IDs)");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
