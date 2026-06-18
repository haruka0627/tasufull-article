#!/usr/bin/env node
/**
 * Phase 2-E smoke: job-top.html listing + detail-job link.
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5188";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = collectErrors(page);

try {
  await page.goto(`${BASE}/job-top.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const title = await page.title();
  const keywordLabel = await page.locator('label[for="jobTopKeyword"]').textContent();
  const hasSearchForm = (await page.locator("[data-job-top-search-form]").count()) > 0;
  const hasTabs = (await page.locator("[data-job-top-tabs]").count()) > 0;
  const countText = (await page.locator("[data-job-top-count]").textContent())?.trim();
  const rowCount = await page.locator("[data-job-list-body] .job-table-row, [data-job-list-body] [role='row']").count();
  const mobileCount = await page.locator("[data-job-list-mobile] .job-mobile-card, [data-job-list-mobile] article").count();
  const cardCount = Math.max(rowCount, mobileCount);
  const detailLinks = await page.locator('a[href*="detail-job.html"]').count();

  const html = await page.content();
  const ufffd = (html.match(/\uFFFD/g) || []).length;
  const eCorrupt = (html.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) || []).length;

  const result = {
    url: `${BASE}/job-top.html`,
    title,
    keywordLabel: keywordLabel?.trim(),
    hasSearchForm,
    hasTabs,
    countText,
    cardCount,
    detailLinks,
    ufffdInDom: ufffd,
    eCorruptInDom: eCorrupt,
    errors: [...errors],
    ok:
      title.includes("求人") &&
      keywordLabel?.includes("キーワード") &&
      hasSearchForm &&
      hasTabs &&
      cardCount > 0 &&
      detailLinks > 0 &&
      errors.length === 0 &&
      ufffd === 0 &&
      eCorrupt === 0,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e), errors }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
