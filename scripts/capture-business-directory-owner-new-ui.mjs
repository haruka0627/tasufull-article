#!/usr/bin/env node
/**
 * Business Directory Owner 新規掲載 UI ブラッシュアップ確認（Playwright）
 *
 *   node scripts/capture-business-directory-owner-new-ui.mjs
 *
 * 確認: 1280 / 768 / 390 · Console Error 0 · overflow なし · ボタン 44px+
 * スクリーンショット: reports/business-directory-owner-new-ui/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = path.join(root, "reports", "business-directory-owner-new-ui");
const PAGE_PATH = "business-directory/new.html";
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

const IGNORE_PATTERNS = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g/i,
];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  page: PAGE_PATH,
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

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const url = buildLocalPageUrl(STANDARD_LOCAL_BASE, PAGE_PATH, "bdMock=1");
  console.log(`=== BD Owner New UI @ ${url} ===\n`);

  const probe = await fetch(url).catch(() => null);
  if (!probe || !probe.ok) {
    bad("HTTP 200", `status=${probe?.status ?? "unreachable"} — start npm run dev on 8788`);
    fs.writeFileSync(path.join(SHOT_DIR, "report.json"), JSON.stringify(report, null, 2));
    process.exit(1);
  }
  ok("HTTP 200", String(probe.status));

  const browser = await chromium.launch({ headless: true });

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
    await page.waitForSelector("[data-bd-new-form]", { timeout: 10000 });
    await page.waitForSelector("[data-bd-plan-panel] .bd-plan-card", { timeout: 10000 });
    await page.waitForTimeout(400);

    const shotPath = path.join(SHOT_DIR, `owner-new-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    ok(`screenshot ${vp.name}`, path.relative(root, shotPath));

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const form = document.querySelector("[data-bd-new-form]");
      const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
      const buttons = [...document.querySelectorAll(".bd-form__actions .dash-btn, .bd-page-head .dash-btn")];
      const inputs = [
        ...document.querySelectorAll(
          ".bd-form input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), .bd-form select, .bd-form textarea"
        ),
      ].filter((el) => {
        if (el.closest("[hidden]")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const btnSizes = buttons.map((el) => {
        const r = el.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width), text: (el.textContent || "").trim() };
      });
      const inputHeights = inputs.map((el) => Math.round(el.getBoundingClientRect().height));
      const formWidth = form ? Math.round(form.getBoundingClientRect().width) : 0;
      const broken = formWidth > window.innerWidth + 1;
      return {
        overflowX,
        btnSizes,
        minBtnH: btnSizes.length ? Math.min(...btnSizes.map((b) => b.h)) : 0,
        minInputH: inputHeights.length ? Math.min(...inputHeights) : 0,
        formWidth,
        broken,
        hasPlanCard: !!document.querySelector(".bd-plan-card"),
        hasAddrGrid: !!document.querySelector(".bd-addr-grid"),
        hasTypePicker: !!document.querySelector(".bd-type-picker"),
      };
    });

    if (metrics.overflowX <= 1) ok(`overflow ${vp.name}`, `overflowX=${metrics.overflowX}`);
    else bad(`overflow ${vp.name}`, `overflowX=${metrics.overflowX}`);

    if (!metrics.broken) ok(`form layout ${vp.name}`, `formWidth=${metrics.formWidth}`);
    else bad(`form layout ${vp.name}`, `form wider than viewport (${metrics.formWidth})`);

    if (metrics.minBtnH >= 44) ok(`button height ${vp.name}`, `min=${metrics.minBtnH}px`);
    else bad(`button height ${vp.name}`, `min=${metrics.minBtnH}px < 44`);

    if (metrics.minInputH >= 44) ok(`input height ${vp.name}`, `min=${metrics.minInputH}px`);
    else bad(`input height ${vp.name}`, `min=${metrics.minInputH}px < 44`);

    if (metrics.hasPlanCard && metrics.hasAddrGrid && metrics.hasTypePicker) {
      ok(`structure ${vp.name}`, "plan/addr/type present");
    } else {
      bad(`structure ${vp.name}`, JSON.stringify(metrics));
    }

    const realErrors = consoleErrors.filter((t) => !isIgnored(t));
    if (realErrors.length === 0) ok(`console ${vp.name}`, "0 errors");
    else bad(`console ${vp.name}`, realErrors.slice(0, 5).join(" | "));

    await context.close();
  }

  await browser.close();

  const summaryPath = path.join(SHOT_DIR, "report.json");
  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "HAS FAIL"} · pass=${pass} fail=${fail} ===`);
  console.log(`report: ${path.relative(root, summaryPath)}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
