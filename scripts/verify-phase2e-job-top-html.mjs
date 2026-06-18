#!/usr/bin/env node
/**
 * Verify Phase 2-E job-top.html: encoding + DOM hooks for job-top-page.js
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = "job-top.html";

const HOOKS = {
  selectors: [
    "[data-page='job-top']",
    "[data-job-top-search-form]",
    "[data-job-top-keyword]",
    "#jobTopKeyword",
    "#jobTopJobType",
    "[data-job-top-industry-select]",
    "#jobTopEmployment",
    "[data-job-top-employment-select]",
    "#jobTopArea",
    "#jobTopSalary",
    "[data-job-top-popular-tags]",
    "[data-job-top-pr-section]",
    "[data-job-top-pr-grid]",
    "[data-job-top-filter-toggle]",
    "[data-job-top-filter-panel]",
    "[data-job-top-filter-form]",
    "[data-job-top-filter-apply]",
    "[data-job-top-filter-clear]",
    "[data-job-top-count]",
    "[data-job-top-sort]",
    "#jobTopSort",
    "[data-job-top-tabs]",
    "[data-job-list-body]",
    "[data-job-list-mobile]",
    "[data-job-top-pagination]",
    "[data-job-top-range]",
    "[data-job-top-empty]",
  ],
  ids: ["top", "jobTopKeyword", "jobTopJobType", "jobTopEmployment", "jobTopArea", "jobTopSalary", "jobTopSort"],
  scripts: ["job-top-renderer.js", "job-top-page.js", "listings-db.js", "job-listing-fields.js"],
  staticText: ["キーワード検索", "絞り込み", "求人一覧", "detail-job.html"],
};

function countPattern(text, re) {
  return (text.match(re) || []).length;
}

const html = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const missing = [];

for (const sel of HOOKS.selectors) {
  if (sel.startsWith("#")) {
    const id = sel.slice(1);
    if (!html.includes(`id="${id}"`)) missing.push(sel);
  } else if (sel.includes("=")) {
    const attr = sel.match(/\[([^\]=]+)/)?.[1];
    const val = sel.match(/='([^']+)'/)?.[1];
    if (attr && val && !html.includes(`${attr}="${val}"`) && !html.includes(`${attr}='${val}'`))
      missing.push(sel);
    else if (attr && !val && !html.includes(attr)) missing.push(sel);
  } else {
    const attr = sel.match(/\[([^\]]+)\]/)?.[1];
    if (attr && !html.includes(attr)) missing.push(sel);
  }
}

for (const id of HOOKS.ids) {
  if (!html.includes(`id="${id}"`)) missing.push(`#${id}`);
}

for (const src of HOOKS.scripts) {
  if (!html.includes(src)) missing.push(`script:${src}`);
}

for (const text of HOOKS.staticText) {
  if (text.includes(".html")) {
    if (!html.includes(text) && html.includes("job-top-renderer.js")) continue;
  } else if (!html.includes(text)) missing.push(`text:${text}`);
}

const result = {
  file: FILE,
  ufffd: countPattern(html, /\uFFFD/g),
  eCorrupt: countPattern(html, /[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g),
  question: countPattern(html, /\?\?/g),
  brokenTags: countPattern(
    html,
    /[^<]\/(?:span|a|h[1-6]|div|p|section|button|legend|label|option)>/g
  ),
  eClose: countPattern(html, /E\/[a-z]+>/gi),
  missingHooks: missing,
  ok:
    missing.length === 0 &&
    !countPattern(html, /\uFFFD/g) &&
    countPattern(html, /[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) === 0 &&
    !countPattern(html, /\?\?/g) &&
    !countPattern(html, /E\/[a-z]+>/gi),
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
