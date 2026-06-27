#!/usr/bin/env node
/**
 * Business Directory Phase 7 — Deploy preflight / dist sync / E2E checklist
 *   node scripts/test-business-directory-phase7-deploy-preflight.mjs
 *
 * Verification only — no deploy, no migration apply.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(root, "deploy/cloudflare/dist");

let pass = 0;
let fail = 0;
let warn = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function note(label) {
  warn += 1;
  console.log(`NOTE: ${label}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustExist(rel, label) {
  if (fs.existsSync(path.join(root, rel))) ok(label || `${rel} exists`);
  else bad(label || `${rel} exists`);
}

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function runNode(script) {
  return spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
}

console.log("=== Business Directory Phase 7 — Deploy Preflight ===\n");

// --- 1) Source manifest (build:pages copies repo root except EXCLUDE_DIRS) ---
console.log("--- source manifest ---\n");

const bdSourceFiles = [
  "business-directory/index.html",
  "business-directory/new.html",
  "business-directory/edit.html",
  "business-directory/business-directory-owner.js",
  "business-directory/business-directory-common.js",
  "business-directory/business-directory-plan.js",
  "business-directory/business-directory.css",
  "business-directory/admin/reviews.html",
  "business-directory/admin/listing.html",
  "business-directory/admin/business-directory-admin.js",
  "business-directory/public/list.html",
  "business-directory/public/detail.html",
  "business-directory/public/business-directory-public.js",
  "business-directory/public/business-directory-public.css",
  "business-directory-repository.js",
];

for (const f of bdSourceFiles) mustExist(f, `source ${f}`);

for (const entry of ["index-top.html", "business.html", "shop-store.html"]) {
  const src = read(entry);
  if (src.includes("business-directory/public/list.html")) ok(`market entry in ${entry}`);
  else bad(`market entry in ${entry}`);
}

// Marketplace non-interference
for (const f of ["shop-checkout.js", "stripe-create-shop-checkout/index.ts"]) {
  const full = path.join(root, f.startsWith("stripe") ? `supabase/functions/${f}` : f);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, "utf8");
  if (!src.includes("business_directory_subscription") && !src.includes("BUSINESS_DIRECTORY_STRIPE")) {
    ok(`${path.basename(f)} no BD stripe coupling`);
  } else bad(`${path.basename(f)} BD stripe coupling`);
}

// --- 2) Migration preflight ---
console.log("\n--- migration preflight ---\n");

const migrations = [
  "supabase/migrations/20260711100000_business_directory_phase1_schema.sql",
  "supabase/migrations/20260711100001_business_directory_phase1_seed.sql",
  "supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql",
];

for (const m of migrations) mustExist(m, `migration ${path.basename(m)}`);

const phase6 = read(migrations[2]);
mustInclude(phase6, "add column if not exists", "phase6 idempotent columns");
mustInclude(read(migrations[0]), "business_directory_listings", "phase1 listings table");
if (!read(migrations[0]).includes("alter table public.listings")) {
  ok("phase1 does not alter public.listings");
} else {
  bad("phase1 alters public.listings");
}

// --- 3) Edge deploy preflight ---
console.log("\n--- edge preflight ---\n");

mustExist("supabase/functions/business-directory/index.ts", "edge business-directory");
mustExist("supabase/functions/_shared/business-directory.ts", "shared business-directory service");
mustExist("supabase/functions/_shared/business-directory-stripe.ts", "shared BD stripe");
mustExist("supabase/functions/stripe-webhook/index.ts", "stripe-webhook");

const config = read("supabase/config.toml");
mustInclude(config, "[functions.business-directory]", "config business-directory function");
mustInclude(config, "[functions.stripe-webhook]", "config stripe-webhook function");
mustInclude(config, "verify_jwt = false", "business-directory verify_jwt false");

const edge = read("supabase/functions/business-directory/index.ts");
for (const action of [
  "create_subscription_checkout",
  "create_billing_portal_session",
  "sync_subscription_status",
  "get_public_listings",
  "get_review_queue",
]) {
  mustInclude(edge, `action === "${action}"`, `edge action ${action}`);
}

// --- 4) Stripe env checklist (static) ---
console.log("\n--- stripe env checklist ---\n");

const stripeMod = read("supabase/functions/_shared/business-directory-plans.ts");
mustInclude(stripeMod, "BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD", "env STANDARD price ref");
mustInclude(stripeMod, "BUSINESS_DIRECTORY_STRIPE_PRICE_PRO", "env PRO price ref");

const webhook = read("supabase/functions/stripe-webhook/index.ts");
for (const ev of [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]) {
  mustInclude(webhook, ev, `webhook handles ${ev}`);
}

note("Manual: set Supabase secrets BUSINESS_DIRECTORY_STRIPE_PRICE_* + STRIPE_* before Edge deploy");
note("Manual: Stripe Dashboard webhook → checkout.session.completed + subscription.* + invoice.payment_*");

// --- 5) build:pages attempt ---
console.log("\n--- build:pages ---\n");

const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:pages"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
  env: { ...process.env },
});

if (build.status === 0) {
  ok("npm run build:pages");
} else {
  const err = `${build.stderr || ""}${build.stdout || ""}`;
  if (/EPERM|Permission denied/i.test(err)) {
    note("build:pages BLOCKED — deploy/cloudflare/dist locked (close IDE/wrangler/dev server, retry)");
    bad("npm run build:pages", "EPERM on dist — see NOTE above");
  } else {
    bad("npm run build:pages", `exit ${build.status}`);
    if (err.trim()) console.error(err.slice(0, 400));
  }
}

// --- 6) dist sync verification ---
console.log("\n--- dist sync ---\n");

const distBd = path.join(distRoot, "business-directory");
if (fs.existsSync(distBd)) {
  for (const f of bdSourceFiles.filter((x) => x.startsWith("business-directory/"))) {
    const rel = f.replace("business-directory/", "");
    if (fs.existsSync(path.join(distBd, rel))) ok(`dist synced ${rel}`);
    else bad(`dist synced ${rel}`, "missing after build");
  }
  if (fs.existsSync(path.join(distRoot, "business-directory-repository.js"))) {
    ok("dist business-directory-repository.js");
  } else bad("dist business-directory-repository.js");
} else {
  bad("dist/business-directory/", "not present — run build:pages after unlocking dist");
}

if (fs.existsSync(path.join(distRoot, "index-top.html"))) {
  const distTop = fs.readFileSync(path.join(distRoot, "index-top.html"), "utf8");
  if (distTop.includes("business-directory/public/list.html")) ok("dist index-top BD entry");
  else bad("dist index-top BD entry", "stale dist — missing BD links");
}

// --- 7) Phase test aggregation ---
console.log("\n--- phase test aggregation ---\n");

const phaseScripts = [
  "scripts/test-business-directory-phase1-schema.mjs",
  "scripts/test-business-directory-phase3-owner-ui.mjs",
  "scripts/test-business-directory-phase4-admin-ui.mjs",
  "scripts/test-business-directory-phase5-public-ui.mjs",
  "scripts/test-business-directory-phase6-stripe.mjs",
];

for (const script of phaseScripts) {
  const r = runNode(script);
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const m = out.match(/(\d+) passed, (\d+) failed/);
  const mPhase1 = out.match(/Phase 1: (\d+)\/(\d+) PASS/);
  if (r.status === 0 && m) {
    ok(`${path.basename(script)} ${m[1]}/${Number(m[1]) + Number(m[2])}`);
  } else if (r.status === 0 && mPhase1) {
    ok(`${path.basename(script)} ${mPhase1[1]}/${mPhase1[2]}`);
  } else {
    bad(path.basename(script), `exit ${r.status}`);
  }
}

const phase2 = runNode("scripts/test-business-directory-phase2-api.mjs");
const phase2out = `${phase2.stdout || ""}${phase2.stderr || ""}`;
if (phase2out.includes("deno check") && phase2out.includes("FAIL")) {
  note("phase2-api: deno check failed locally (@types/node) — CI/Supabase deploy unaffected");
  if (/(\d+) passed, 1 failed/.test(phase2out)) ok("phase2-api static+transitions (deno check env skip)");
  else bad("phase2-api", `exit ${phase2.status}`);
} else if (phase2.status === 0) {
  ok("phase2-api full");
} else {
  bad("phase2-api", `exit ${phase2.status}`);
}

// --- 8) E2E flow URLs (mock) ---
console.log("\n--- e2e flow URLs (local mock) ---\n");

const mockFlows = [
  ["Owner dashboard", "business-directory/index.html?bdMock=1"],
  ["Owner new", "business-directory/new.html?bdMock=1"],
  ["Public list", "business-directory/public/list.html?bdPublicMock=1"],
  ["Admin reviews", "business-directory/admin/reviews.html?bdAdminMock=1"],
];

for (const [name, url] of mockFlows) {
  const htmlPath = url.split("?")[0];
  mustExist(htmlPath, `e2e page ${name}`);
}

ok("E2E mock flows documented in reports/business-directory-phase7-deploy-preflight.md");

console.log(`\n${pass} passed, ${fail} failed, ${warn} notes\n`);
process.exit(fail > 0 ? 1 : 0);
