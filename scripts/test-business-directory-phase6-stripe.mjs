#!/usr/bin/env node
/**
 * Business Directory Phase 6 — Stripe subscription (static + plan guard + deno)
 *   node scripts/test-business-directory-phase6-stripe.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
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

function runDenoCheck(entry) {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "deno",
    "check",
    entry,
  ], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status === 0) ok(`deno check ${path.basename(entry)}`);
  else bad(`deno check ${path.basename(entry)}`, r.stderr?.slice(0, 200));
}

console.log("=== Business Directory Phase 6 — Stripe Subscription ===\n");

mustExist(
  "supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql",
  "phase6 migration",
);
mustExist("supabase/functions/_shared/business-directory-plans.ts", "plans module");
mustExist("supabase/functions/_shared/business-directory-stripe.ts", "stripe module");

const migration = read("supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql");
const plans = read("supabase/functions/_shared/business-directory-plans.ts");
const stripe = read("supabase/functions/_shared/business-directory-stripe.ts");
const edge = read("supabase/functions/business-directory/index.ts");
const webhook = read("supabase/functions/stripe-webhook/index.ts");
const repo = read("business-directory-repository.js");
const ownerJs = read("business-directory/business-directory-owner.js");
const planJs = read("business-directory/business-directory-plan.js");
const shared = read("supabase/functions/_shared/business-directory.ts");

for (const col of [
  "stripe_price_id",
  "subscription_status",
  "current_period_end",
  "cancel_at_period_end",
  "plan_changed_at",
]) {
  mustInclude(migration, col, `migration column ${col}`);
}

mustInclude(plans, "BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD", "env standard price");
mustInclude(plans, "BUSINESS_DIRECTORY_STRIPE_PRICE_PRO", "env pro price");
mustInclude(plans, "resolveEffectivePlanCode", "effective plan guard");
mustInclude(plans, "hasPaidBusinessDirectoryAccess", "paid access guard");
mustInclude(plans, "business_directory_subscription", "order type constant");

for (const fn of [
  "createBusinessDirectorySubscriptionCheckout",
  "createBusinessDirectoryBillingPortalSession",
  "syncBusinessDirectorySubscriptionStatus",
  "syncBusinessDirectoryFromStripeSubscription",
  "applyBusinessDirectoryFromCheckoutSession",
  "handleBusinessDirectoryInvoiceEvent",
]) {
  mustInclude(stripe, fn, `stripe export ${fn}`);
}

for (const action of [
  "create_subscription_checkout",
  "create_billing_portal_session",
  "sync_subscription_status",
]) {
  mustInclude(edge, `action === "${action}"`, `edge action ${action}`);
}

mustInclude(repo, "createSubscriptionCheckout", "repository checkout");
mustInclude(repo, "createBillingPortalSession", "repository portal");
mustInclude(repo, "syncSubscriptionStatus", "repository sync");

mustInclude(webhook, "isBusinessDirectoryCheckoutSession", "webhook BD checkout branch");
mustInclude(webhook, "customer.subscription.created", "webhook subscription.created");
mustInclude(webhook, "invoice.payment_succeeded", "webhook invoice.payment_succeeded");
mustInclude(webhook, "invoice.payment_failed", "webhook invoice.payment_failed");

mustInclude(shared, 'out.plan_code = "free"', "create forces free plan");
mustInclude(ownerJs, "data-bd-upgrade", "owner upgrade buttons");
mustInclude(ownerJs, "data-bd-billing-portal", "owner billing portal");
mustInclude(ownerJs, "bd_checkout=success", "checkout return handler");
mustInclude(planJs, "effectivePlanCode", "client effective plan");
mustInclude(planJs, "subscriptionWarning", "client subscription warning");

// Non-interference
for (const f of ["shop-store.html", "business.html", "shop-checkout.js", "stripe-create-shop-checkout/index.ts"]) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  const src = read(f);
  if (src.includes("business_directory_subscription") || src.includes("BUSINESS_DIRECTORY_STRIPE")) {
    bad(`${f} marketplace stripe coupling`);
  } else {
    ok(`${f} no BD stripe coupling`);
  }
}

// Admin / public unchanged wiring
mustInclude(read("business-directory/admin/business-directory-admin.js"), "getReviewQueue", "admin unchanged");
mustInclude(read("business-directory/public/business-directory-public.js"), "getPublicListings", "public unchanged");

console.log("\n--- plan guard unit tests ---\n");
const guard = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
  "deno",
  "run",
  "--allow-read",
  "--allow-env",
  "scripts/test-business-directory-phase6-plan-guard.ts",
], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
if (guard.status === 0) {
  for (const line of (guard.stdout || "").split("\n").filter(Boolean)) {
    if (line.startsWith("PASS:")) ok(`guard ${line.slice(5).trim()}`);
    else if (line.startsWith("FAIL:")) bad(`guard ${line.slice(5).trim()}`);
  }
} else {
  bad("plan guard runner", `exit ${guard.status}`);
  if (guard.stderr) console.error(guard.stderr.slice(0, 300));
}

console.log("\n--- deno check ---\n");
runDenoCheck("supabase/functions/_shared/business-directory-plans.ts");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
