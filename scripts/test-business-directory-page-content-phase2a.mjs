#!/usr/bin/env node
/**
 * Business Directory page content Phase 2a — static checks
 *   node scripts/test-business-directory-page-content-phase2a.mjs
 */
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

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("=== Business Directory page content Phase 2a ===\n");

const migration = read("supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql");
const shared = read("supabase/functions/_shared/business-directory.ts");
const aiTs = read("supabase/functions/_shared/business-directory-ai.ts");
const editHtml = read("business-directory/edit.html");
const newHtml = read("business-directory/new.html");
const ownerJs = read("business-directory/business-directory-owner.js");
const aiJs = read("business-directory/business-directory-ai-draft.js");
const commonJs = read("business-directory/business-directory-common.js");

mustInclude(migration, "seo_title", "migration seo_title");
mustInclude(migration, "meta_description", "migration meta_description");
mustInclude(migration, "faq_items jsonb", "migration faq_items");
mustInclude(migration, "recommended_uses text[]", "migration recommended_uses");
mustInclude(migration, "full_description", "migration public view full_description");

mustInclude(shared, "full_description?:", "DraftListingInput full_description");
mustInclude(shared, "faq_items?:", "DraftListingInput faq_items");
mustInclude(shared, "recommended_uses?:", "DraftListingInput recommended_uses");
mustInclude(shared, "normalizeProfileFaqItems", "normalizeProfileFaqItems");
mustInclude(shared, "normalizeRecommendedUses", "normalizeRecommendedUses");

mustInclude(aiTs, "full_description: string", "AI draft full_description type");

mustInclude(editHtml, 'name="seo_title"', "edit seo_title field");
mustInclude(editHtml, 'name="meta_description"', "edit meta_description field");
mustInclude(editHtml, 'name="full_description"', "edit full_description field");
mustInclude(editHtml, "data-bd-faq-editor", "edit faq editor");
mustInclude(editHtml, 'name="recommended_uses_text"', "edit recommended uses field");
mustInclude(editHtml, "data-bd-ai-draft-host", "edit ai draft host");

if (!newHtml.includes('name="full_description"')) ok("new.html minimal (no full_description)");
else bad("new.html should not add full_description");

mustInclude(ownerJs, "faq_items:", "owner payload faq_items");
mustInclude(ownerJs, "recommended_uses:", "owner payload recommended_uses");
mustInclude(ownerJs, "seo_title:", "owner payload seo_title");
mustInclude(ownerJs, "wireFaqEditor", "owner faq editor");
mustInclude(ownerJs, "syncFullDescriptionPlanGate", "owner full_description plan gate");
mustInclude(ownerJs, "applyPageContentFields", "owner applyPageContentFields");

mustInclude(aiJs, "data-bd-ai-apply-all", "ai apply all button");
mustInclude(aiJs, "data-bd-ai-apply=", "ai per-field apply");
mustInclude(aiJs, "full_description", "ai draft full_description");
if (!aiJs.includes("Phase 2 で保存予定")) ok("ai draft removed future-save label");
else bad("ai draft still has future-save label");

mustInclude(commonJs, "profileFieldsFromBody", "mock profileFieldsFromBody");
mustInclude(commonJs, "faq_items", "mock handles faq_items");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
