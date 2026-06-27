#!/usr/bin/env node
/**
 * Business Directory Phase 1 — schema / seed / constraint tests (static)
 *   node scripts/test-business-directory-phase1-schema.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = "supabase/migrations/20260711100000_business_directory_phase1_schema.sql";
const SEED = "supabase/migrations/20260711100001_business_directory_phase1_seed.sql";

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

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function mustMatch(hay, re, label) {
  if (re.test(hay)) ok(label);
  else bad(label, `pattern: ${re}`);
}

function main() {
  console.log("=== Business Directory Phase 1 — schema ===\n");

  if (!fs.existsSync(path.join(root, SCHEMA))) bad("schema migration exists");
  else ok("schema migration exists");

  if (!fs.existsSync(path.join(root, SEED))) bad("seed migration exists");
  else ok("seed migration exists");

  const schema = read(SCHEMA);
  const seed = read(SEED);

  const tables = [
    "business_directory_listings",
    "business_directory_profiles",
    "business_directory_categories",
    "business_directory_photos",
    "business_directory_business_hours",
    "business_directory_social_links",
    "business_directory_tlv_videos",
    "business_directory_plan_features",
    "business_directory_review_requests",
    "business_directory_audit_logs",
  ];

  for (const t of tables) {
    mustMatch(schema, new RegExp(`create table if not exists public\\.${t}`, "i"), `table ${t}`);
  }

  const statuses = [
    "draft",
    "review_requested",
    "published",
    "rejected",
    "suspended",
    "unpublished",
    "archived",
  ];
  for (const s of statuses) {
    mustInclude(schema, `'${s}'`, `listings status ${s}`);
  }

  mustMatch(schema, /business_directory_listings_status_chk/i, "listings status check constraint");
  mustMatch(schema, /references auth\.users/i, "FK auth.users");
  mustMatch(schema, /references public\.business_directory_plan_features/i, "FK plan_features");
  mustMatch(schema, /enable row level security/i, "RLS enabled");
  mustMatch(schema, /business_directory_listings_public/i, "public safe view");
  mustMatch(schema, /business_directory_is_ops_admin/i, "ops admin helper");

  mustMatch(schema, /review_requests_status_chk[\s\S]*'open'[\s\S]*'approved'[\s\S]*'rejected'/i, "review_requests status");
  mustMatch(schema, /listing_type in \('shop_retail', 'business_service'\)/i, "listing_type check");

  console.log("\n=== Business Directory Phase 1 — seed ===\n");

  for (const plan of ["free", "standard", "pro", "premium"]) {
    mustInclude(seed, `'${plan}'`, `seed plan ${plan}`);
  }

  mustInclude(seed, "shop_food", "seed shop category");
  mustInclude(seed, "biz_construction", "seed business category");
  mustMatch(seed, /on conflict \(plan_code\) do update/i, "seed plan upsert");
  mustMatch(seed, /on conflict \(code\) do update/i, "seed category upsert");

  console.log("\n=== Business Directory Phase 1 — boundary ===\n");

  mustMatch(schema, /separate from public\.listings/i, "Marketplace listings separation comment");
  if (/alter table public\.listings/i.test(schema)) bad("no alter public.listings");
  else ok("no alter public.listings");

  console.log(`\n=== Business Directory Phase 1: ${pass}/${pass + fail} PASS ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
