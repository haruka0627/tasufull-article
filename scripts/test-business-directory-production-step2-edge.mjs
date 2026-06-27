#!/usr/bin/env node
/**
 * Business Directory Production Step 2 — Edge deploy / secrets smoke
 *   node scripts/test-business-directory-production-step2-edge.mjs
 *   node scripts/test-business-directory-production-step2-edge.mjs --remote
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

let pass = 0;
let fail = 0;
let note = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function nlabel(label) {
  note += 1;
  console.log(`NOTE: ${label}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustExist(rel, label) {
  if (fs.existsSync(path.join(root, rel))) ok(label);
  else bad(label);
}

function runCli(args) {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["supabase", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return { status: r.status ?? 1, out: `${r.stdout || ""}\n${r.stderr || ""}` };
}

async function main() {
  console.log("=== Business Directory Production Step 2 — Edge ===\n");

  mustExist("supabase/functions/business-directory/index.ts", "edge business-directory");
  mustExist("supabase/functions/stripe-webhook/index.ts", "edge stripe-webhook");

  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  for (const ev of [
    "checkout.session.completed",
    "customer.subscription.updated",
    "invoice.payment_failed",
  ]) {
    if (webhook.includes(ev)) ok(`webhook handles ${ev}`);
    else bad(`webhook handles ${ev}`);
  }

  if (read("supabase/functions/business-directory/index.ts").includes("ops_ensure_stripe_prices")) {
    ok("edge ops_ensure_stripe_prices action");
  } else bad("edge ops_ensure_stripe_prices action");

  console.log("\n--- remote verification ---\n");

  if (!remote) {
    nlabel("skipped remote — rerun with --remote after Edge deploy");
  } else {
    const health = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "health" }),
    });
    const healthJson = await health.json().catch(() => ({}));
    if (health.ok && healthJson.service === "business-directory") {
      ok(`health ${healthJson.phase || ""}`.trim());
    } else bad("health", `${health.status} ${JSON.stringify(healthJson).slice(0, 120)}`);

    const pub = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_public_listings", limit: 1 }),
    });
    const pubJson = await pub.json().catch(() => ({}));
    if (pub.ok && Array.isArray(pubJson.listings)) ok("get_public_listings");
    else bad("get_public_listings", `${pub.status}`);

    const list = runCli(["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
    if (list.status === 0) {
      const start = list.out.indexOf("[");
      const end = list.out.lastIndexOf("]");
      const slugs = start >= 0
        ? JSON.parse(list.out.slice(start, end + 1)).map((f) => f.slug || f.name)
        : [];
      if (slugs.includes("business-directory")) ok("functions list business-directory");
      else bad("functions list business-directory");
      if (slugs.includes("stripe-webhook")) ok("functions list stripe-webhook");
      else bad("functions list stripe-webhook");
    } else bad("functions list", list.out.slice(0, 120));

    const secrets = runCli(["secrets", "list", "--project-ref", PROJECT_REF]);
    if (secrets.status === 0) {
      for (const name of [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD",
        "BUSINESS_DIRECTORY_STRIPE_PRICE_PRO",
      ]) {
        if (secrets.out.includes(name)) ok(`secret ${name}`);
        else bad(`secret ${name}`);
      }
      if (secrets.out.includes("SITE_URL")) ok("secret SITE_URL");
      else nlabel("SITE_URL secret optional — set for Checkout redirect");
    } else bad("secrets list", secrets.out.slice(0, 120));
  }

  console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
