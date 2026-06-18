#!/usr/bin/env node
/**
 * Verify tas-hero restore on index-top.html (static + optional Playwright).
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { chromium } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "index-top.html");
const html = fs.readFileSync(FILE, "utf8");

const ufffd = (html.match(/\uFFFD/g) || []).length;
let parseOk = true;
try {
  parse(html);
} catch (err) {
  parseOk = false;
  console.error("parse5:", err);
}

const categoryGrid = html.match(
  /<div class="top-categories category-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/,
)?.[1];
const categoryCards = categoryGrid ? (categoryGrid.match(/<a href=/g) || []).length : 0;
const tasHeroCards = (html.match(/class="tas-hero__card /g) || []).length;

const staticChecks = {
  ufffd,
  parse5: parseOk,
  tasHeroCss: html.includes('href="tas-hero.css"'),
  tasHeroSection: html.includes('class="tas-hero"'),
  brandLogo: html.includes("tas-hero__brand-logo"),
  goldLogoImg: html.includes("images/tasful-gold-logo-transparent.png"),
  aiWorkspaceCardImg: html.includes("images/ai-workspace-card.png"),
  aiCampaignBannerImg: html.includes("images/ai-campaign-banner.png"),
  aiCardImageMode: html.includes("tas-hero__card--ai-image"),
  platformBgInCss: fs.readFileSync(path.join(ROOT, "tas-hero.css"), "utf8").includes("platform-top-bg.png"),
  tagline: html.includes("つなぐ、広がる、あなたの") && html.includes("可能性"),
  tasHeroCards,
  trustBar: html.includes("tas-hero__trust"),
  statsBar: html.includes("tas-hero__stats"),
  noPortalHero: !html.includes("top-portal-hero"),
  noVisualWrap: !html.includes("top-visual-wrap"),
  noPillarGrid: !html.includes("top-pillar-grid"),
  topPrArea: html.includes("top-pr-area"),
  topPortalHeader: html.includes("top-portal-header"),
  topSearch: html.includes('class="top-search"'),
  categoryCards,
  topRankCard: (html.match(/class="top-rank-card/g) || []).length,
  topJsUnchanged: html.includes('src="top.js"'),
};

const staticPass =
  ufffd === 0 &&
  parseOk &&
  staticChecks.tasHeroCss &&
  staticChecks.tasHeroSection &&
  staticChecks.brandLogo &&
  staticChecks.goldLogoImg &&
  staticChecks.aiWorkspaceCardImg &&
  staticChecks.aiCampaignBannerImg &&
  staticChecks.aiCardImageMode &&
  staticChecks.platformBgInCss &&
  staticChecks.tagline &&
  tasHeroCards === 3 &&
  staticChecks.trustBar &&
  staticChecks.statsBar &&
  staticChecks.noPortalHero &&
  staticChecks.noVisualWrap &&
  staticChecks.topPrArea &&
  staticChecks.topPortalHeader &&
  staticChecks.topSearch &&
  categoryCards === 7 &&
  staticChecks.topRankCard >= 20 &&
  staticChecks.topJsUnchanged;

const url = process.argv[2] || "http://127.0.0.1:5173/index-top.html";
let browserOk = false;
let domChecks = {};
let consoleErrors = [];

if (process.env.SKIP_BROWSER !== "1") {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
    });
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    if (!res?.ok()) consoleErrors.push(`HTTP ${res?.status()}`);
    await page.waitForSelector(".tas-hero", { timeout: 8000 });
    domChecks = {
      tasHeroVisible: await page.locator(".tas-hero").isVisible(),
      brandLogoVisible: await page.locator(".tas-hero__brand-logo img").isVisible(),
      prBannerVisible: await page.locator(".top-pr-banner__img").isVisible(),
      aiCardImgVisible: await page.locator(".tas-hero__ai-card-img").isVisible(),
      cards: await page.locator(".tas-hero__card").count(),
      statsVisible: await page.locator(".tas-hero__stats").isVisible(),
      categories: await page.locator(".top-category-card").count(),
      rankings: await page.locator(".top-ranking").count(),
    };
    await browser.close();
    browserOk =
      consoleErrors.length === 0 &&
      domChecks.tasHeroVisible &&
      domChecks.brandLogoVisible &&
      domChecks.prBannerVisible &&
      domChecks.aiCardImgVisible &&
      domChecks.cards === 3 &&
      domChecks.statsVisible &&
      domChecks.categories === 7 &&
      domChecks.rankings === 4;
  } catch (err) {
    consoleErrors.push(String(err.message || err));
  }
}

const result = {
  static: staticChecks,
  staticPass,
  dom: domChecks,
  consoleErrors,
  browserPass: browserOk,
  pass: staticPass && (process.env.SKIP_BROWSER === "1" ? true : browserOk),
};

console.log(JSON.stringify(result, null, 2));
console.log(result.pass ? "PASS tas-hero restore" : "FAIL tas-hero restore");
process.exitCode = result.pass ? 0 : 1;
