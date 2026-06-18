#!/usr/bin/env node
/**
 * Phase 3-1c: index-top.html portal hero restore checks
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";

const ROOT = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index-top.html"), "utf8");

const ufffd = (html.match(/\uFFFD/g) || []).length;
let parseOk = true;
try {
  parse(html);
} catch (err) {
  parseOk = false;
  console.error("parse5:", err);
}

const pillarCards = (html.match(/class="top-pillar-card top-pillar-card--/g) || []).length;

const checks = {
  ufffd,
  parse5: parseOk ? 0 : 1,
  portalHero: html.includes('class="top-portal-hero"'),
  pillarGrid: html.includes('class="top-pillar-grid hero-main-cards'),
  pillarCards,
  hasGeneral: html.includes("top-pillar-card--general"),
  hasBusiness: html.includes("top-pillar-card--business"),
  hasAi: html.includes("top-pillar-card--ai ai-card"),
  trustBar: html.includes('class="top-trust-bar"'),
  statsBar: html.includes('class="top-stats-bar"'),
  portalTitle: html.includes("top-portal-hero__title"),
  noDual: !html.includes("top-dual"),
  noSvgLogo: !html.includes("top-hero__svg-logo"),
  noOldHero: !html.includes('class="top-hero hero-section"'),
  searchKept: html.includes('class="top-search"'),
  categoriesKept: html.includes("top-categories-section"),
};

const pass =
  ufffd === 0 &&
  parseOk &&
  checks.portalHero &&
  checks.pillarGrid &&
  pillarCards === 3 &&
  checks.hasGeneral &&
  checks.hasBusiness &&
  checks.hasAi &&
  checks.trustBar &&
  checks.statsBar &&
  checks.noDual &&
  checks.noSvgLogo &&
  checks.noOldHero &&
  checks.searchKept &&
  checks.categoriesKept;

console.log(JSON.stringify(checks, null, 2));
console.log(pass ? "PASS phase 3-1c" : "FAIL phase 3-1c");
process.exitCode = pass ? 0 : 1;
