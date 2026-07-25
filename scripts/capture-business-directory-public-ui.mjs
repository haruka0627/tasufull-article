#!/usr/bin/env node
/**
 * Business Directory Public / Vendor Pages UI 確認（Playwright）
 *
 *   node scripts/capture-business-directory-public-ui.mjs
 *
 * スクリーンショット: reports/business-directory-public-ui/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = path.join(root, "reports", "business-directory-public-ui");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];
const IGNORE_PATTERNS = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g|placehold/i];

let pass = 0;
let fail = 0;
const report = { baseUrl: STANDARD_LOCAL_BASE, timestamp: new Date().toISOString(), checks: [] };

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

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
    const buttons = [...document.querySelectorAll(".bd-public-btn, .bd-public-back")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.classList.contains("bd-public-btn--muted");
    });
    const heights = buttons.map((el) => Math.round(el.getBoundingClientRect().height));
    return {
      overflowX,
      minBtnH: heights.length ? Math.min(...heights) : 44,
      hasHeroImg: !!document.querySelector(".bd-public-hero img"),
      hasMediaEmpty: !!document.querySelector(".bd-public-media-empty__text"),
      mediaEmptyText: document.querySelector(".bd-public-media-empty__text")?.textContent?.trim() || "",
      hasCta: !!document.querySelector(".bd-public-cta-bar, .bd-public-cta-box"),
      hasIdentity: !!document.querySelector(".bd-public-detail__title"),
      cardPlaceholders: [...document.querySelectorAll(".bd-public-card__thumb--placeholder")].map((el) =>
        el.textContent.trim(),
      ),
    };
  });
}

async function checkUrl(browser, { label, pagePath, search, waitFor, shotPrefix, assertFn }) {
  const url = buildLocalPageUrl(STANDARD_LOCAL_BASE, pagePath, search);
  const probe = await fetch(url).catch(() => null);
  if (!probe?.ok) {
    bad(`${label} HTTP 200`, `status=${probe?.status ?? "unreachable"}`);
    return;
  }
  ok(`${label} HTTP 200`, String(probe.status));

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    /** @type {string[]} */
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(String(msg.text()));
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(waitFor, { timeout: 10000 });
    await page.waitForTimeout(400);

    const shotPath = path.join(SHOT_DIR, `${shotPrefix}-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    ok(`${label} screenshot ${vp.name}`, path.relative(root, shotPath));

    const m = await measure(page);
    if (m.overflowX <= 1) ok(`${label} overflow ${vp.name}`, `overflowX=${m.overflowX}`);
    else bad(`${label} overflow ${vp.name}`, `overflowX=${m.overflowX}`);

    if (m.minBtnH >= 44) ok(`${label} button ${vp.name}`, `min=${m.minBtnH}px`);
    else bad(`${label} button ${vp.name}`, `min=${m.minBtnH}px`);

    if (assertFn) {
      const r = assertFn(m, vp);
      if (r.ok) ok(`${label} content ${vp.name}`, r.detail);
      else bad(`${label} content ${vp.name}`, r.detail);
    }

    const realErrors = consoleErrors.filter((t) => !isIgnored(t));
    if (realErrors.length === 0) ok(`${label} console ${vp.name}`, "0 errors");
    else bad(`${label} console ${vp.name}`, realErrors.slice(0, 5).join(" | "));

    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  console.log(`=== BD Public / Vendor UI @ ${STANDARD_LOCAL_BASE} ===\n`);
  const browser = await chromium.launch({ headless: true });

  await checkUrl(browser, {
    label: "list",
    pagePath: "business-directory/public/list.html",
    search: "bdPublicMock=1",
    waitFor: "[data-bd-public-grid] .bd-public-card",
    shotPrefix: "public-list",
    assertFn: (m) => {
      const hasEmptyLabel = m.cardPlaceholders.some((t) => t.includes("画像未登録"));
      return hasEmptyLabel
        ? { ok: true, detail: "list placeholder 画像未登録" }
        : { ok: false, detail: `placeholders=${JSON.stringify(m.cardPlaceholders)}` };
    },
  });

  await checkUrl(browser, {
    label: "detail-photo",
    pagePath: "business-directory/public/detail.html",
    search: "slug=tanaka-shop&type=shop_retail&bdPublicMock=1",
    waitFor: "[data-bd-public-detail] .bd-public-detail__title",
    shotPrefix: "public-detail-photo",
    assertFn: (m) => {
      if (!m.hasHeroImg) return { ok: false, detail: "hero image missing" };
      if (!m.hasCta) return { ok: false, detail: "CTA missing" };
      if (!m.hasIdentity) return { ok: false, detail: "identity missing" };
      return { ok: true, detail: "hero+CTA+identity" };
    },
  });

  await checkUrl(browser, {
    label: "detail-empty",
    pagePath: "business-directory/public/detail.html",
    search: "slug=no-photo-cafe&type=shop_retail&bdPublicMock=1",
    waitFor: "[data-bd-public-detail] .bd-public-media-empty",
    shotPrefix: "public-detail-empty",
    assertFn: (m) => {
      if (m.mediaEmptyText !== "画像未登録") return { ok: false, detail: m.mediaEmptyText };
      if (!m.hasCta) return { ok: false, detail: "CTA missing" };
      return { ok: true, detail: "画像未登録 + CTA" };
    },
  });

  await browser.close();
  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(SHOT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "HAS FAIL"} · pass=${pass} fail=${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
