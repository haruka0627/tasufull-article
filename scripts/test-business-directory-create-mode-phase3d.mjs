#!/usr/bin/env node
/**
 * Business Directory Phase 3d — post-apply save guidance static checks
 *   node scripts/test-business-directory-create-mode-phase3d.mjs
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

console.log("=== Business Directory Phase 3d — save guidance ===\n");

const newHtml = read("business-directory/new.html");
const aiPageJs = read("business-directory/business-directory-ai-page.js");
const aiDraftJs = read("business-directory/business-directory-ai-draft.js");
const ownerJs = read("business-directory/business-directory-owner.js");
const css = read("business-directory/business-directory.css");

mustInclude(newHtml, "bd-banner--ai-applied", "applied banner variant");
mustInclude(newHtml, "AI生成内容をフォームに反映しました", "applied banner title");
mustInclude(newHtml, "まだ保存・公開はされていません", "unsaved warning");
mustInclude(newHtml, "data-bd-jump-save", "jump to save link");
mustInclude(newHtml, 'id="bd-save-draft"', "save anchor id");
mustInclude(newHtml, "data-bd-save-draft-wrap", "save actions wrap");
mustInclude(newHtml, "data-bd-save-draft-btn", "save draft button hook");

mustInclude(aiPageJs, "guideToSaveDraft", "guideToSaveDraft export");
mustInclude(aiPageJs, "bd-form__actions--emphasis", "save emphasis class");
mustInclude(aiPageJs, "clearSaveDraftGuide", "clear emphasis helper");
mustInclude(aiPageJs, "guideToSaveDraft(form)", "apply calls save guide");

mustInclude(aiDraftJs, "guideToSaveDraft", "manual draft uses save guide");
mustInclude(ownerJs, "createDraftListing", "create draft on new save");
mustInclude(read("business-directory/business-directory-common.js"), "buildOwnerEditUrl", "edit url helper");
mustInclude(ownerJs, "buildOwnerEditUrl", "owner uses edit url helper");

mustInclude(css, "bd-banner--ai-applied", "banner css");
mustInclude(css, "bd-form__actions--emphasis", "save emphasis css");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
