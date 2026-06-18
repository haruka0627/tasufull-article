#!/usr/bin/env node
/**
 * TASFUL TALK / 通知タブ — 横スクロールカテゴリバー + ⚙フィルター 390px スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = "screenshots/talk-category-tabs";
const EXPECT_CATEGORIES = [
  "すべて",
  "個人",
  "求人",
  "ワーカー",
  "スキル",
  "商品",
  "業務",
  "店舗",
  "Builder",
  "安否",
  "AI",
  "公式",
  "運営",
];

mkdirSync(OUT_DIR, { recursive: true });
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-talk-notify-mobile-chip]", { timeout: 20000 });
await page.waitForTimeout(800);

const notifyAudit = await page.evaluate(() => {
  const bar = document.querySelector("[data-talk-notify-mobile-chips]");
  return {
    labels: [...document.querySelectorAll("[data-talk-notify-mobile-chip]")].map((b) =>
      b.textContent?.replace(/\s*\d+\s*$/, "").trim()
    ),
    scrollWidth: bar?.scrollWidth || 0,
    clientWidth: bar?.clientWidth || 0,
  };
});

await page.screenshot({ path: `${OUT_DIR}/01-notify-category-bar-390.png`, fullPage: false });

await page.evaluate(() => {
  const bar = document.querySelector("[data-talk-notify-mobile-chips]");
  if (bar) bar.scrollLeft = bar.scrollWidth;
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/02-notify-category-bar-scrolled-390.png`, fullPage: false });

await page.locator("[data-talk-notify-filter-toggle]").click();
await page.waitForSelector("[data-talk-notify-filter-panel]:not([hidden])", { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/03-notify-gear-filter-390.png`, fullPage: false });

const gearLabels = await page.evaluate(() =>
  [...document.querySelectorAll("[data-talk-notify-filter-sections] [data-talk-filter-option]")].map(
    (el) => el.textContent?.replace(/\(\d+\)/, "").trim()
  )
);

await page.goto(`${BASE}/talk-home.html?tab=chat`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-talk-line-filter]", { timeout: 20000 });
await page.waitForTimeout(800);

const talkAudit = await page.evaluate(() => {
  const bar = document.querySelector("[data-talk-line-list-filters]");
  return {
    labels: [...document.querySelectorAll("[data-talk-line-filter]")].map((b) => b.textContent?.trim()),
    scrollWidth: bar?.scrollWidth || 0,
    clientWidth: bar?.clientWidth || 0,
  };
});

await page.screenshot({ path: `${OUT_DIR}/04-talk-category-bar-390.png`, fullPage: false });

await page.evaluate(() => {
  const bar = document.querySelector("[data-talk-line-list-filters]");
  if (bar) bar.scrollLeft = bar.scrollWidth;
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/05-talk-category-bar-scrolled-390.png`, fullPage: false });

await page.locator("[data-talk-chat-filter-toggle]").click();
await page.waitForSelector("[data-talk-chat-filter-panel]:not([hidden])", { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/06-talk-gear-filter-390.png`, fullPage: false });

});

const issues = [];
for (const label of EXPECT_CATEGORIES) {
  if (!notifyAudit.labels.includes(label)) issues.push(`notify欠落: ${label}`);
  if (!talkAudit.labels.includes(label)) issues.push(`talk欠落: ${label}`);
}
if (notifyAudit.labels.includes("案件")) issues.push("notifyに案件残存");
if (talkAudit.labels.includes("案件")) issues.push("talkに案件残存");
if (notifyAudit.scrollWidth <= notifyAudit.clientWidth) {
  issues.push(`notify横スクロール不可 scroll=${notifyAudit.scrollWidth}/${notifyAudit.clientWidth}`);
}
if (talkAudit.scrollWidth <= talkAudit.clientWidth) {
  issues.push(`talk横スクロール不可 scroll=${talkAudit.scrollWidth}/${talkAudit.clientWidth}`);
}
if (!gearLabels.some((l) => l?.includes("Builder"))) issues.push("⚙にBuilderなし");

console.log("notify tabs:", notifyAudit.labels.join(", "));
console.log("talk tabs:", talkAudit.labels.join(", "));
console.log("gear filter:", gearLabels.join(", "));

if (issues.length) {
  console.log("NG:", issues.join("; "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("OK: talk category tabs");
await closeAllBrowsers();
process.exit(0);
