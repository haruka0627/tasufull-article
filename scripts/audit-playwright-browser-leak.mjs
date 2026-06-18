#!/usr/bin/env node
/**
 * Playwright browser leak static audit
 *   node scripts/audit-playwright-browser-leak.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/playwright-browser-leak-audit.json");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.mjs$/.test(ent.name)) out.push(p);
  }
  return out;
}

function rel(f) {
  return path.relative(ROOT, f).replace(/\\/g, "/");
}

const files = walk(path.join(ROOT, "scripts"));
const rows = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const usesPlaywright =
    /playwright|chromium\.launch|launchHeadlessBrowser|withPlaywrightSession|withPlaywrightBrowser/.test(text);
  if (!usesPlaywright) continue;

  const launches =
    (text.match(/\bchromium\.launch\b|\blaunchHeadlessBrowser\s*\(/g) || []).length +
    (text.match(/from\s+[\"']playwright[\"']/g) || []).length;
  const browserCloses = (text.match(/\bbrowser\.close\s*\(|\bb\.close\s*\(/g) || []).length;
  const withSession = /\bwithPlaywrightSession\b/.test(text);
  const withBrowser = /\bwithPlaywrightBrowser\b/.test(text);
  const usesLibChromium = /from\s+[\"'].*playwright-browser\.mjs[\"']/.test(text);
  const usesRawPlaywright = /from\s+[\"']playwright[\"']/.test(text);
  const hasFinallyClose = /finally\s*\{[\s\S]{0,400}?\.close\s*\(/.test(text);
  const topLevelLaunch = /^(?:const|let)\s+\w+\s*=\s*await\s+(?:chromium\.launch|launchHeadlessBrowser)/m.test(text);

  const issues = [];
  if (usesRawPlaywright) issues.push("raw_playwright_import");
  if (!usesLibChromium && !file.includes("lib/playwright-browser.mjs")) issues.push("no_lib_wrapper");
  if (launches > browserCloses && !withSession && !withBrowser) issues.push("close_count_lt_launch");
  if (!hasFinallyClose && !withSession && !withBrowser && launches > 0) issues.push("no_finally_close");
  if (topLevelLaunch && !withSession && !withBrowser && !hasFinallyClose) issues.push("top_level_no_finally");

  rows.push({
    file: rel(file),
    group: categorize(rel(file)),
    launches,
    browserCloses,
    withSession,
    withBrowser,
    usesLibChromium,
    usesRawPlaywright,
    hasFinallyClose,
    issues,
  });
}

function categorize(f) {
  if (f.startsWith("scripts/capture-")) return "capture";
  if (f.startsWith("scripts/verify-")) return "verify";
  if (f.startsWith("scripts/smoke-")) return "smoke";
  if (f.startsWith("scripts/test-")) return "test";
  if (f.startsWith("scripts/audit-")) return "audit";
  if (f.startsWith("scripts/lib/")) return "lib";
  return "other";
}

const summary = {
  scanned: rows.length,
  withIssues: rows.filter((r) => r.issues.length).length,
  byGroup: {},
  issueTypes: {},
};

for (const r of rows) {
  summary.byGroup[r.group] = (summary.byGroup[r.group] || 0) + 1;
  for (const i of r.issues) summary.issueTypes[i] = (summary.issueTypes[i] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  fixedInThisPass: [
    "scripts/lib/playwright-browser.mjs — registry + SIGINT/SIGTERM/uncaughtException cleanup",
    "scripts/capture-corp-hp-visual-review.mjs — try/finally",
    "scripts/capture-iwasho-home-top.mjs — withPlaywrightBrowser",
    "scripts/smoke-post-*.mjs (3) — try/finally",
    "scripts/smoke-cloudflare-pages.mjs — closeAllBrowsers in finally",
    "scripts/audit-shop-vendor-flow-supplement.mjs — try/finally",
  ],
  rows: rows.sort((a, b) => b.issues.length - a.issues.length || a.file.localeCompare(b.file)),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(JSON.stringify(summary, null, 2));
console.log(`[audit] wrote ${rel(OUT)}`);
