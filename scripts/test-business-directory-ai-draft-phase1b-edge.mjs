#!/usr/bin/env node
/**
 * Business Directory AI draft Phase 1b — static + unit checks
 *   node scripts/test-business-directory-ai-draft-phase1b-edge.mjs
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

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

console.log("=== Business Directory AI Draft Phase 1b ===\n");

const files = [
  "supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql",
  "supabase/functions/_shared/business-directory-ai.ts",
  "supabase/functions/_shared/business-directory-ai-quota.ts",
  "supabase/functions/business-directory/index.ts",
  "business-directory-repository.js",
  "business-directory/business-directory-ai-draft.js",
];

for (const rel of files) {
  if (fs.existsSync(path.join(root, rel))) ok(`${rel} exists`);
  else bad(`${rel} exists`);
}

const migration = read("supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql");
const edge = read("supabase/functions/business-directory/index.ts");
const aiTs = read("supabase/functions/_shared/business-directory-ai.ts");
const quotaTs = read("supabase/functions/_shared/business-directory-ai-quota.ts");
const repo = read("business-directory-repository.js");
const uiJs = read("business-directory/business-directory-ai-draft.js");

mustInclude(migration, "business_directory_ai_draft_usage_daily", "quota table");
mustInclude(migration, "used_count", "quota used_count column");
mustInclude(migration, "consume_business_directory_ai_draft_quota", "quota RPC");

mustInclude(edge, 'action === "generate_listing_draft"', "edge action router");
mustInclude(edge, "generateListingDraft", "edge imports generateListingDraft");

mustInclude(aiTs, "buildMockListingDraft", "server mock builder");
mustInclude(aiTs, "gemini_not_configured", "gemini fallback path");
mustInclude(aiTs, "listing.ai_draft_generated", "audit action optional");
mustInclude(aiTs, "parseListingDraftJson", "JSON parser");

mustInclude(quotaTs, "BD_AI_DRAFT_DAILY_LIMITS", "plan limit map");
mustInclude(quotaTs, "consume_business_directory_ai_draft_quota", "quota rpc call");
mustInclude(quotaTs, "quota_exceeded", "quota exceeded error");

mustInclude(repo, "generateListingDraft", "repository method");
mustInclude(repo, "generate_listing_draft", "repository action name");

mustInclude(uiJs, "fetchDraft", "ui fetchDraft");
mustInclude(uiJs, "generateListingDraft", "ui repository call");
mustInclude(uiJs, "quota_exceeded", "ui quota message");
mustInclude(uiJs, "generateMockDraft", "offline fallback retained");
mustInclude(uiJs, "category_id", "ui sends category_id");

console.log("\n--- Deno unit tests ---\n");
const deno = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
  "deno",
  "run",
  "--allow-env",
  "scripts/test-business-directory-ai-draft-phase1b-unit.ts",
], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (deno.stdout) process.stdout.write(deno.stdout);
if (deno.stderr) process.stderr.write(deno.stderr);
if (deno.status === 0) ok("deno unit tests");
else bad("deno unit tests", `exit ${deno.status}`);

console.log("\n--- Phase 1a regression ---\n");
const phase1a = spawnSync(process.execPath, ["scripts/test-business-directory-ai-draft-phase1.mjs"], {
  cwd: root,
  encoding: "utf8",
});
if (phase1a.stdout) process.stdout.write(phase1a.stdout);
if (phase1a.status === 0) ok("phase 1a regression");
else bad("phase 1a regression", `exit ${phase1a.status}`);

console.log(`\n=== ${pass} passed · ${fail} failed ===`);
process.exit(fail ? 1 : 0);
