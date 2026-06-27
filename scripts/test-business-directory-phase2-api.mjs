#!/usr/bin/env node
/**
 * Business Directory Phase 2 — API / repository / Edge (static + transitions + deno check)
 *   node scripts/test-business-directory-phase2-api.mjs
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

function mustExist(rel, label) {
  if (fs.existsSync(path.join(root, rel))) ok(label || `${rel} exists`);
  else bad(label || `${rel} exists`);
}

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function runDeno(args) {
  return spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["deno", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

console.log("=== Business Directory Phase 2 — API ===\n");

// 1) Files
mustExist("supabase/functions/_shared/business-directory.ts", "shared service module");
mustExist("supabase/functions/business-directory/index.ts", "Edge router");
mustExist("business-directory-repository.js", "client repository wrapper");

const shared = fs.readFileSync(path.join(root, "supabase/functions/_shared/business-directory.ts"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/business-directory/index.ts"), "utf8");
const client = fs.readFileSync(path.join(root, "business-directory-repository.js"), "utf8");
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

// 2) Service exports
const serviceFns = [
  "createDraftListing",
  "updateDraftListing",
  "getOwnerListings",
  "getOwnerListingDetail",
  "submitListingForReview",
  "getPublicListings",
  "getPublicListingDetail",
  "getReviewQueue",
  "approveListing",
  "rejectListing",
  "suspendListing",
  "unpublishListing",
  "restoreListing",
  "appendAuditLog",
  "assertStatusTransition",
];

for (const fn of serviceFns) {
  const asyncPat = `export async function ${fn}`;
  const syncPat = `export function ${fn}`;
  if (shared.includes(asyncPat) || shared.includes(syncPat)) ok(`service export ${fn}`);
  else bad(`service export ${fn}`, "missing export");
}

// 3) Edge actions
const actions = [
  "create_draft_listing",
  "update_draft_listing",
  "get_owner_listings",
  "get_owner_listing_detail",
  "submit_listing_for_review",
  "get_public_listings",
  "get_public_listing_detail",
  "get_review_queue",
  "approve_listing",
  "reject_listing",
  "suspend_listing",
  "unpublish_listing",
  "restore_listing",
];

for (const action of actions) {
  mustInclude(edge, `action === "${action}"`, `edge action ${action}`);
}

mustInclude(edge, "requireOps", "edge ops guard");
mustInclude(config, "[functions.business-directory]", "config.toml business-directory");
mustInclude(config, "verify_jwt = false", "config verify_jwt false");

// 4) Client repository
const clientMethods = [
  "createDraftListing",
  "updateDraftListing",
  "getOwnerListings",
  "getOwnerListingDetail",
  "submitListingForReview",
  "getPublicListings",
  "getPublicListingDetail",
  "getReviewQueue",
  "approveListing",
  "rejectListing",
  "suspendListing",
  "unpublishListing",
  "restoreListing",
];

for (const m of clientMethods) {
  mustInclude(client, `${m}:`, `client ${m}`);
}

// 5) Transition unit tests (Deno)
console.log("\n--- transition unit tests ---\n");
const transitions = runDeno([
  "run",
  "--allow-read",
  "scripts/test-business-directory-phase2-transitions.ts",
]);
if (transitions.status === 0) {
  for (const line of (transitions.stdout || "").split("\n").filter(Boolean)) {
    if (line.startsWith("PASS:")) ok(`transition ${line.slice(5).trim()}`);
    else if (line.startsWith("FAIL:")) bad(`transition ${line.slice(5).trim()}`);
  }
} else {
  bad("transition unit runner", `exit ${transitions.status}`);
  if (transitions.stderr) console.error(transitions.stderr);
}

// 6) deno check
console.log("\n--- deno check ---\n");
const check = runDeno([
  "check",
  "supabase/functions/_shared/business-directory.ts",
  "supabase/functions/business-directory/index.ts",
]);
if (check.status === 0) ok("deno check business-directory Edge");
else {
  bad("deno check", `exit ${check.status}`);
  if (check.stderr) console.error(check.stderr);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
