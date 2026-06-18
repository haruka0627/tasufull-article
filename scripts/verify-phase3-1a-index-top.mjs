#!/usr/bin/env node
/**
 * Phase 3-1a: index-top.html header + ranking restore checks
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = "index-top.html";
const html = fs.readFileSync(path.join(ROOT, FILE), "utf8");

const ufffd = (html.match(/\uFFFD/g) || []).length;
let parseOk = true;
try {
  parse(html);
} catch (err) {
  parseOk = false;
  console.error("parse5:", err);
}

const topRankCard = (html.match(/class="top-rank-card/g) || []).length;
const dataRankingTrack = (html.match(/data-ranking-track/g) || []).length;
const placeholdOld = (html.match(/placehold\.co\/400x260/g) || []).length;

const checks = {
  ufffd,
  parse5: parseOk ? 0 : 1,
  tasfulAiLogo: html.includes("tasful-ai-logo.css"),
  topRankingCss: html.includes("top-ranking.css"),
  topPortalHeader: html.includes("top-portal-header"),
  topRankCard,
  dataRankingTrack,
  rankingSectionIds: [
    "rankingPopularTitle",
    "rankingNewTitle",
    "rankingProductTitle",
    "rankingSkillTitle",
  ].every((id) => html.includes(`id="${id}"`)),
  placeholdOld,
  topJs: html.includes('src="top.js"'),
};

const pass =
  ufffd === 0 &&
  parseOk &&
  checks.tasfulAiLogo &&
  checks.topRankingCss &&
  checks.topPortalHeader &&
  topRankCard >= 20 &&
  dataRankingTrack === 4 &&
  checks.rankingSectionIds &&
  placeholdOld === 0 &&
  checks.topJs;

console.log(JSON.stringify(checks, null, 2));
console.log(pass ? "PASS phase 3-1a" : "FAIL phase 3-1a");
process.exitCode = pass ? 0 : 1;
