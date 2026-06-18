#!/usr/bin/env node
/**
 * Phase 3-1b: index-top.html category cards restore checks
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

const categoryGrid = html.match(
  /<div class="top-categories category-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/
)?.[1];
const categoryCards = categoryGrid ? (categoryGrid.match(/<a href=/g) || []).length : 0;
const labels = [
  "スキル",
  "商品",
  "求人",
  "ワーカー",
  "法人・業務",
  "店舗・販売",
  "AI Workspace",
];
const links = [
  "index.html?category=skill",
  "index.html?category=product",
  "job-top.html",
  "index.html?category=worker",
  "business.html",
  "shop-store.html",
  "chat-list.html",
];

const checks = {
  ufffd,
  parse5: parseOk ? 0 : 1,
  categoryCards,
  desc7: html.includes("7つのカテゴリから"),
  hasBusinessMod: html.includes("top-category-card--business"),
  hasShopMod: html.includes("top-category-card--shop"),
  labelsOk: labels.every((t) => html.includes(t)),
  linksOk: links.every((h) => html.includes(`href="${h}"`)),
};

const pass =
  ufffd === 0 &&
  parseOk &&
  categoryCards === 7 &&
  checks.desc7 &&
  checks.hasBusinessMod &&
  checks.hasShopMod &&
  checks.labelsOk &&
  checks.linksOk;

console.log(JSON.stringify(checks, null, 2));
console.log(pass ? "PASS phase 3-1b" : "FAIL phase 3-1b");
process.exitCode = pass ? 0 : 1;
