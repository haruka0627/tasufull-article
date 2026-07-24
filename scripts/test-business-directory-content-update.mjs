#!/usr/bin/env node
/**
 * Business Directory — content_update (published edit → re-review) static checks
 *   node scripts/test-business-directory-content-update.mjs
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

console.log("=== Business Directory content_update ===\n");

const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260715110000_business_directory_content_update.sql"),
  "utf8",
);
const shared = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/business-directory.ts"),
  "utf8",
);
const ownerJs = fs.readFileSync(path.join(root, "business-directory/business-directory-owner.js"), "utf8");
const editHtml = fs.readFileSync(path.join(root, "business-directory/edit.html"), "utf8");
const commonJs = fs.readFileSync(path.join(root, "business-directory/business-directory-common.js"), "utf8");

mustInclude(migration, "business_directory_pending_updates", "pending_updates table");
mustInclude(migration, "published_snapshot_json", "published_snapshot_json column");
mustInclude(migration, "review_requested' and l.published_at is not null", "public view keeps live during review");

mustInclude(shared, "updatePublishedPendingListing", "updatePublishedPendingListing");
mustInclude(shared, "applyContentSnapshotToLive", "applyContentSnapshotToLive");
mustInclude(shared, 'requestType === "content_update"', "submit content_update branch");
mustInclude(shared, "listing.reject_content_update", "reject content_update keeps published");
mustInclude(shared, "listing.approve_content_update", "approve content_update applies pending");
mustInclude(shared, "isPubliclyVisibleListing", "public visibility helper");

mustInclude(ownerJs, "data-bd-submit-content-update", "owner content update button hook");
mustInclude(ownerJs, "canSubmitContentUpdate", "owner uses canSubmitContentUpdate");
mustInclude(ownerJs, "content_update", "owner submits content_update");

mustInclude(editHtml, "data-bd-submit-content-update", "edit.html content update button");
mustInclude(editHtml, "data-bd-content-update-pending", "edit.html content update banner");

mustInclude(commonJs, "canSubmitContentUpdate", "common canSubmitContentUpdate");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
