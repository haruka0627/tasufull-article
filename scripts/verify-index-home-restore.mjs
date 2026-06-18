#!/usr/bin/env node
/**
 * index.html home-page UI restore verification
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "index.html";
const html = fs.readFileSync(path.join(ROOT, FILE), "utf8");

const ufffd = (html.match(/\uFFFD/g) || []).length;
let parseOk = true;
try {
  parse(html);
} catch (err) {
  parseOk = false;
  console.error("parse5:", err);
}

const staticChecks = {
  ufffd,
  parse5: parseOk,
  homePageBody: /class="home-page"/.test(html),
  indexHomeCss: html.includes('href="index-home.css"'),
  indexHomeJs: html.includes('src="index-home.js"'),
  dataHomeCats: html.includes("data-home-cats"),
  dataHomeFeatured: html.includes("data-home-featured"),
  dataHomeNewList: html.includes("data-home-new-list"),
  prSectionTitle: html.includes("PR掲載"),
  sidebar: html.includes('class="sidebar"'),
  aiHero: html.includes("home-hero__right"),
  oldIndexPage: html.includes('class="index-page"'),
};

const BASE = process.env.BASE_URL || "http://127.0.0.1:5188";
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

let loaded = false;
let dom = {};
try {
  const res = await page.goto(`${BASE}/index.html`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  loaded = res?.ok() ?? false;
  await page.waitForTimeout(3500);

  dom = {
    bodyHomePage: await page.evaluate(() =>
      document.body.classList.contains("home-page"),
    ),
    aiBannerVisible: await page.locator(".home-hero__right .home-ai-title").isVisible(),
    categoryGridVisible: await page.locator("[data-home-cats] .home-cat, [data-home-cats] a").first().isVisible().catch(() => false),
    categoryGridChildCount: await page.locator("[data-home-cats] *").count(),
    prSectionVisible: await page.locator('.pr-featured-section, section[aria-label="PR掲載"]').isVisible(),
    prTitleText: await page.locator(".pr-featured-section .home-section__title").textContent().catch(() => ""),
    featuredCardCount: await page.locator("[data-home-featured] .featured-big, [data-home-featured] article").count(),
    newListCardCount: await page.locator("[data-home-new-list] .home-list-card, [data-home-new-list] article").count(),
    sidebarVisible: await page.locator("aside.sidebar").isVisible(),
  };

  if (!dom.categoryGridVisible && dom.categoryGridChildCount > 0) {
    dom.categoryGridVisible = true;
  }
} catch (err) {
  pageErrors.push(`navigation: ${err.message || err}`);
}

});

const report = {
  static: staticChecks,
  browser: {
    baseUrl: BASE,
    loaded,
    pageErrors,
    consoleErrors,
    dom,
  },
};

const pass =
  ufffd === 0 &&
  parseOk &&
  staticChecks.homePageBody &&
  staticChecks.indexHomeCss &&
  staticChecks.indexHomeJs &&
  !staticChecks.oldIndexPage &&
  loaded &&
  pageErrors.length === 0 &&
  consoleErrors.length === 0 &&
  dom.bodyHomePage &&
  dom.aiBannerVisible &&
  dom.categoryGridVisible &&
  dom.prSectionVisible &&
  dom.featuredCardCount > 0 &&
  dom.newListCardCount > 0 &&
  dom.sidebarVisible;

console.log(JSON.stringify(report, null, 2));
console.log(pass ? "PASS index.html home-page restore" : "FAIL index.html home-page restore");
process.exitCode = pass ? 0 : 1;

await closeAllBrowsers();
