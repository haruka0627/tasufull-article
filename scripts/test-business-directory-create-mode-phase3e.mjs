#!/usr/bin/env node
/**
 * Business Directory Phase 3e — post-create edit guide static checks
 *   node scripts/test-business-directory-create-mode-phase3e.mjs
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

console.log("=== Business Directory Phase 3e — edit post-create guide ===\n");

const editHtml = read("business-directory/edit.html");
const ownerJs = read("business-directory/business-directory-owner.js");
const css = read("business-directory/business-directory.css");

mustInclude(editHtml, "data-bd-post-create-guide", "post-create guide host");
mustInclude(editHtml, "下書きを保存しました", "guide title");
mustInclude(editHtml, "プレビューで確認", "preview CTA");
mustInclude(editHtml, "公開設定へ進む", "publish CTA");
mustInclude(editHtml, "data-bd-post-create-guide-close", "close button");

mustInclude(ownerJs, 'created: "1"', "new save adds created=1");
mustInclude(ownerJs, "wirePostCreateGuide", "wire post-create guide");
mustInclude(ownerJs, "shouldShowPostCreateGuide", "show condition helper");
mustInclude(ownerJs, "review_requested", "suppress guide for review");
mustInclude(ownerJs, "published", "suppress guide for published");
mustInclude(ownerJs, "postCreateGuideDismissKey", "sessionStorage dismiss key");
mustInclude(ownerJs, 'activateTab("preview")', "preview tab CTA");
mustInclude(ownerJs, 'activateTab("publish")', "publish tab CTA");
mustInclude(ownerJs, "emphasizeSubmitReview", "publish button emphasis");

mustInclude(css, "bd-post-create-guide", "guide css");
mustInclude(css, "bd-submit-review--emphasis", "submit emphasis css");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
