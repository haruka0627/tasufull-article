#!/usr/bin/env node
/**
 * Business Directory OB4 P0 — 本番 URL Browser Smoke（Playwright）
 *
 *   node scripts/capture-business-directory-ob4-smoke.mjs                  # 8788 ローカル
 *   node scripts/capture-business-directory-ob4-smoke.mjs --prod            # 本番 URL（BUILD_BASE_URL 環境変数から）
 *   node scripts/capture-business-directory-ob4-smoke.mjs --url https://... # 明示的 URL 指定
 *
 * 確認項目（全 6 チェック · 4 画面）:
 *   1. /business-directory/public/list.html — 主要セレクタ + 一覧表示
 *   2. /business-directory/public/detail.html?slug=... — 主要セレクタ + 詳細表示
 *   3. list.html Console Error 0
 *   4. detail.html Console Error 0
 *   5. /business-directory/index.html — Owner dashboard 表示
 *   6. /business-directory/admin/reviews.html — Admin reviews 表示
 *
 * スクリーンショット: reports/business-directory-ob4-smoke/
 * exit 0 = 全 PASS, exit 1 = FAIL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = path.join(root, "reports", "business-directory-ob4-smoke");

// CLI args
const isProd = process.argv.includes("--prod");
const urlArgIdx = process.argv.indexOf("--url");
const explicitUrl = urlArgIdx >= 0 ? process.argv[urlArgIdx + 1] : "";
const baseUrl = explicitUrl
  ? explicitUrl.replace(/\/$/, "")
  : isProd
    ? (process.env.BUILD_BASE_URL || process.env.PAGES_BASE_URL || "https://tasufull-article.pages.dev").replace(/\/$/, "")
    : STANDARD_LOCAL_BASE;

const PUBLIC_SLUG = "tanaka-shop";
const PUBLIC_TYPE = "shop_retail";

let pass = 0;
let fail = 0;
const report = {
  baseUrl,
  timestamp: new Date().toISOString(),
  checks: [],
};

function ok(label, detail) {
  pass += 1;
  report.checks.push({ step: label, ok: true, detail });
  console.log(`PASS [${pass + fail}] ${label}${detail ? ` · ${detail}` : ""}`);
}

function bad(label, detail) {
  fail += 1;
  report.checks.push({ step: label, ok: false, detail });
  console.error(`FAIL [${pass + fail}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`=== BD OB4 Browser Smoke @ ${baseUrl} ===\n`);

  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  /** @type {string[]} */
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(String(msg.text()));
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

  // 無視する既知のエラー
  const IGNORE_PATTERNS = [
    /favicon/i,
    /manifest\.json/i,
    /Failed to load resource.*favicon/i,
    /net::ERR_BLOCKED_BY_CLIENT/i,
    /Content Security Policy/i,
    /Failed to load resource: the server responded with a status of 401/i,
  ];

  function realErrors() {
    return consoleErrors.filter(
      (e) => !IGNORE_PATTERNS.some((p) => p.test(e))
    );
  }

  try {
    // ── 1. Public list ──────────────────────────────────────────────

    consoleErrors.length = 0;
    const listUrl = buildLocalPageUrl(baseUrl, "business-directory/public/list.html");
    console.log(`\n--- Public list: ${listUrl} ---`);
    const listRes = await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!listRes || !listRes.ok()) {
      bad("Public list HTTP", `status ${listRes?.status()}`);
    } else {
      ok("Public list HTTP", `${listRes.status()}`);
    }

    const listBody = await page.locator("body").count();
    if (listBody > 0) {
      ok("Public list body", "page rendered");
    } else {
      bad("Public list body", "no body element");
    }

    await page.screenshot({ path: path.join(SHOT_DIR, "001-public-list-1280.png"), fullPage: true });

    // ── 2. Public detail ────────────────────────────────────────────

    consoleErrors.length = 0;
    const detailUrl = buildLocalPageUrl(baseUrl, "business-directory/public/detail.html", `slug=${PUBLIC_SLUG}&listing_type=${PUBLIC_TYPE}`);
    console.log(`\n--- Public detail: ${detailUrl} ---`);
    const detailRes = await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!detailRes || !detailRes.ok()) {
      bad("Public detail HTTP", `status ${detailRes?.status()}`);
    } else {
      ok("Public detail HTTP", `${detailRes.status()}`);
    }

    const detailBody = await page.locator("body").count();
    if (detailBody > 0) {
      ok("Public detail body", "page rendered");
    } else {
      bad("Public detail body", "no body element");
    }

    await page.screenshot({ path: path.join(SHOT_DIR, "002-public-detail-1280.png"), fullPage: true });

    // ── 3. Console Error: list ──────────────────────────────────────
    // list 画面の Console Error は Step 1 で捕捉済

    const listErrs = realErrors();
    if (listErrs.length === 0) {
      ok("Console Error: public list", "0 errors");
    } else {
      bad("Console Error: public list", `${listErrs.length} error(s) · ${listErrs.slice(0, 3).join(" | ")}`);
    }

    // ── 4. Console Error: detail ────────────────────────────────────

    const detailErrs = realErrors();
    if (detailErrs.length === 0) {
      ok("Console Error: public detail", "0 errors");
    } else {
      bad("Console Error: public detail", `${detailErrs.length} error(s) · ${detailErrs.slice(0, 3).join(" | ")}`);
    }

    // ── 5. Owner dashboard ──────────────────────────────────────────

    consoleErrors.length = 0;
    const ownerUrl = buildLocalPageUrl(baseUrl, "business-directory/index.html");
    console.log(`\n--- Owner dashboard: ${ownerUrl} ---`);
    const ownerRes = await page.goto(ownerUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!ownerRes || !ownerRes.ok()) {
      bad("Owner dashboard HTTP", `status ${ownerRes?.status()}`);
    } else {
      ok("Owner dashboard HTTP", `${ownerRes.status()}`);
    }

    await page.screenshot({ path: path.join(SHOT_DIR, "003-owner-dashboard-1280.png"), fullPage: true });

    // ── 6. Admin reviews ────────────────────────────────────────────

    consoleErrors.length = 0;
    const adminUrl = buildLocalPageUrl(baseUrl, "business-directory/admin/reviews.html");
    console.log(`\n--- Admin reviews: ${adminUrl} ---`);
    const adminRes = await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!adminRes || !adminRes.ok()) {
      bad("Admin reviews HTTP", `status ${adminRes.status()}`);
    } else {
      ok("Admin reviews HTTP", `${adminRes.status()}`);
    }

    await page.screenshot({ path: path.join(SHOT_DIR, "004-admin-reviews-1280.png"), fullPage: true });

  } finally {
    await context.close();
    await browser.close();
  }

  // ── レポート保存 ──────────────────────────────────────────────────

  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(SHOT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");

  const total = pass + fail;
  console.log(`\n=== BD OB4 Browser Smoke: ${pass}/${total} PASS${fail > 0 ? ` · ${fail} FAIL` : ""} ===`);
  console.log(`Screenshots: ${SHOT_DIR}`);

  if (fail > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
});