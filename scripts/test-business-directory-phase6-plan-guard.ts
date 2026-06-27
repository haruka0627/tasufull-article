/**
 * Business Directory Phase 6 — plan guard unit tests (Deno)
 *   npx deno run --allow-read scripts/test-business-directory-phase6-plan-guard.ts
 */
import {
  hasPaidBusinessDirectoryAccess,
  resolveEffectivePlanCode,
  resolvePlanFromStripePriceId,
} from "../supabase/functions/_shared/business-directory-plans.ts";

let pass = 0;
let fail = 0;

function ok(label: string) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function assert(cond: boolean, label: string) {
  if (cond) ok(label);
  else {
    fail += 1;
    console.error(`FAIL: ${label}`);
  }
}

Deno.env.set("BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD", "price_std_test");
Deno.env.set("BUSINESS_DIRECTORY_STRIPE_PRICE_PRO", "price_pro_test");

assert(resolvePlanFromStripePriceId("price_std_test") === "standard", "price → standard");
assert(resolvePlanFromStripePriceId("price_pro_test") === "pro", "price → pro");
assert(resolvePlanFromStripePriceId("unknown") === null, "unknown price → null");

const activePro = {
  plan_code: "pro",
  subscription_status: "active",
  current_period_end: new Date(Date.now() + 86400000).toISOString(),
  cancel_at_period_end: false,
};
assert(hasPaidBusinessDirectoryAccess(activePro), "active pro has access");
assert(resolveEffectivePlanCode(activePro) === "pro", "effective pro");

const pastDueGrace = {
  plan_code: "standard",
  subscription_status: "past_due",
  current_period_end: new Date(Date.now() + 86400000).toISOString(),
  cancel_at_period_end: false,
};
assert(hasPaidBusinessDirectoryAccess(pastDueGrace), "past_due grace keeps access");
assert(resolveEffectivePlanCode(pastDueGrace) === "standard", "effective standard during grace");

const canceledExpired = {
  plan_code: "pro",
  subscription_status: "canceled",
  current_period_end: new Date(Date.now() - 86400000).toISOString(),
  cancel_at_period_end: false,
};
assert(!hasPaidBusinessDirectoryAccess(canceledExpired), "canceled expired no access");
assert(resolveEffectivePlanCode(canceledExpired) === "free", "downgrade to free");

const cancelScheduled = {
  plan_code: "pro",
  subscription_status: "active",
  current_period_end: new Date(Date.now() + 86400000).toISOString(),
  cancel_at_period_end: true,
};
assert(hasPaidBusinessDirectoryAccess(cancelScheduled), "cancel_at_period_end keeps access until end");
assert(resolveEffectivePlanCode(cancelScheduled) === "pro", "effective pro until period end");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) Deno.exit(1);
