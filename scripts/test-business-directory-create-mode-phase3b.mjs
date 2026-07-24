#!/usr/bin/env node
/**
 * Business Directory Phase 3b — creation mode picker static checks
 *   node scripts/test-business-directory-create-mode-phase3b.mjs
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

console.log("=== Business Directory Phase 3b — creation mode picker ===\n");

const newHtml = read("business-directory/new.html");
const ownerJs = read("business-directory/business-directory-owner.js");
const css = read("business-directory/business-directory.css");

mustInclude(newHtml, "data-bd-create-mode-picker", "mode picker section");
mustInclude(newHtml, 'data-bd-create-mode="ai"', "AI mode button");
mustInclude(newHtml, 'data-bd-create-mode="manual"', "manual mode button");
mustInclude(newHtml, "data-bd-new-form-wrap", "form wrap hidden initially");
mustInclude(newHtml, "data-bd-new-form-wrap hidden", "form wrap starts hidden");
mustInclude(newHtml, "data-bd-ai-page-host", "AI page host");
mustInclude(newHtml, "business-directory-ai-page.js", "ai-page script");
mustInclude(newHtml, "data-bd-new-form", "existing form preserved");
mustInclude(newHtml, "data-bd-action=\"create_draft_listing\"", "create draft action preserved");

mustInclude(ownerJs, "wireCreationModePicker", "creation mode picker wiring");
mustInclude(ownerJs, 'dataset.bdCreateMode', "mode state on root");
mustInclude(ownerJs, "TasuBusinessDirectoryAiPage", "owner wires ai-page");
mustInclude(ownerJs, 'next === "manual"', "manual mode mounts AI draft panel");

mustInclude(css, ".bd-create-mode__grid", "mode picker grid");
mustInclude(css, ".bd-create-mode__card--ai", "AI card emphasis");
mustInclude(css, "max-width: 768px", "mobile stack breakpoint");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
