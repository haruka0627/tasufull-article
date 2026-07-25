#!/usr/bin/env node
/**
 * Business Directory Admin UI ブラッシュアップ確認（Playwright）
 *
 *   node scripts/capture-business-directory-admin-ui.mjs
 *
 * 確認: reviews + listing · 1280 / 768 / 390 · Console Error 0 · overflow なし · 44px+
 * スクリーンショット: reports/business-directory-admin-ui/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = path.join(root, "reports", "business-directory-admin-ui");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

const IGNORE_PATTERNS = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g/i];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  timestamp: new Date().toISOString(),
  checks: [],
};

function ok(label, detail) {
  pass += 1;
  report.checks.push({ step: label, ok: true, detail });
  console.log(`PASS ${label}${detail ? ` · ${detail}` : ""}`);
}

function bad(label, detail) {
  fail += 1;
  report.checks.push({ step: label, ok: false, detail });
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function isIgnored(text) {
  return IGNORE_PATTERNS.some((re) => re.test(text));
}

async function measurePage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
    const buttons = [...document.querySelectorAll(".bd-admin-btn")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const btnHeights = buttons.map((el) => Math.round(el.getBoundingClientRect().height));
    const textareas = [...document.querySelectorAll(".bd-admin-reason textarea")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const taHeights = textareas.map((el) => Math.round(el.getBoundingClientRect().height));
    return {
      overflowX,
      minBtnH: btnHeights.length ? Math.min(...btnHeights) : 44,
      minTaH: taHeights.length ? Math.min(...taHeights) : 44,
      btnCount: buttons.length,
      hasLayout: !!document.querySelector(".bd-admin-layout"),
    };
  });
}

async function checkPage(browser, { label, pagePath, search, waitFor, shotPrefix }) {
  const url = buildLocalPageUrl(STANDARD_LOCAL_BASE, pagePath, search);
  const probe = await fetch(url).catch(() => null);
  if (!probe || !probe.ok) {
    bad(`${label} HTTP 200`, `status=${probe?.status ?? "unreachable"}`);
    return;
  }
  ok(`${label} HTTP 200`, String(probe.status));

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    /** @type {string[]} */
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(String(msg.text()));
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(waitFor, { timeout: 10000 });
    await page.waitForTimeout(350);

    const shotPath = path.join(SHOT_DIR, `${shotPrefix}-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    ok(`${label} screenshot ${vp.name}`, path.relative(root, shotPath));

    const metrics = await measurePage(page);
    if (metrics.overflowX <= 1) ok(`${label} overflow ${vp.name}`, `overflowX=${metrics.overflowX}`);
    else bad(`${label} overflow ${vp.name}`, `overflowX=${metrics.overflowX}`);

    if (metrics.hasLayout) ok(`${label} layout ${vp.name}`, "bd-admin-layout");
    else bad(`${label} layout ${vp.name}`, "missing layout");

    if (metrics.minBtnH >= 44) ok(`${label} button ${vp.name}`, `min=${metrics.minBtnH}px`);
    else bad(`${label} button ${vp.name}`, `min=${metrics.minBtnH}px < 44`);

    if (metrics.minTaH >= 44) ok(`${label} textarea ${vp.name}`, `min=${metrics.minTaH}px`);
    else bad(`${label} textarea ${vp.name}`, `min=${metrics.minTaH}px < 44`);

    const realErrors = consoleErrors.filter((t) => !isIgnored(t));
    if (realErrors.length === 0) ok(`${label} console ${vp.name}`, "0 errors");
    else bad(`${label} console ${vp.name}`, realErrors.slice(0, 5).join(" | "));

    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  console.log(`=== BD Admin UI @ ${STANDARD_LOCAL_BASE} ===\n`);

  const browser = await chromium.launch({ headless: true });

  await checkPage(browser, {
    label: "reviews",
    pagePath: "business-directory/admin/reviews.html",
    search: "bdAdminMock=1",
    waitFor: "[data-bd-admin-queue] .bd-admin-table, [data-bd-admin-queue-empty]:not([hidden])",
    shotPrefix: "admin-reviews",
  });

  // Nav: reviews → listing
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const reviewsUrl = buildLocalPageUrl(
      STANDARD_LOCAL_BASE,
      "business-directory/admin/reviews.html",
      "bdAdminMock=1"
    );
    await page.goto(reviewsUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-bd-admin-queue] .bd-admin-table", { timeout: 10000 });
    const detailLink = page.locator(".bd-admin-table a.bd-admin-btn").first();
    const href = await detailLink.getAttribute("href");
    if (href && href.includes("listing.html")) ok("admin nav reviews→listing", href);
    else bad("admin nav reviews→listing", href || "missing");
    await detailLink.click();
    await page.waitForSelector("[data-bd-admin-detail-readonly] .bd-admin-dl", { timeout: 10000 });
    const back = page.locator(".bd-admin-head__back");
    const backHref = await back.getAttribute("href");
    if (backHref && backHref.includes("reviews.html")) ok("admin nav listing→reviews", backHref);
    else bad("admin nav listing→reviews", backHref || "missing");
    await context.close();
  }

  await checkPage(browser, {
    label: "listing",
    pagePath: "business-directory/admin/listing.html",
    search: "id=admin-mock-1&bdAdminMock=1",
    waitFor: "[data-bd-admin-detail-readonly] .bd-admin-dl",
    shotPrefix: "admin-listing",
  });

  await browser.close();

  report.pass = pass;
  report.fail = fail;
  const summaryPath = path.join(SHOT_DIR, "report.json");
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "HAS FAIL"} · pass=${pass} fail=${fail} ===`);
  console.log(`report: ${path.relative(root, summaryPath)}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
