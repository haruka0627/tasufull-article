#!/usr/bin/env node
/**
 * 通知タブ上部カテゴリ — 横スクロール + Builder表記
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = "screenshots/notify-category-chips";
const EXPECT_CHIPS = [
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
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-talk-notify-mobile-chip]", { timeout: 20000 });
await page.waitForTimeout(800);

const audit = await page.evaluate(() => {
  const bar = document.querySelector("[data-talk-notify-mobile-chips]");
  const chips = [...document.querySelectorAll("[data-talk-notify-mobile-chip]")].map((b) => ({
    id: b.getAttribute("data-talk-notify-mobile-chip"),
    label: b.textContent?.replace(/\s*\d+$/, "").trim(),
  }));
  const line = [...document.querySelectorAll("[data-talk-line-filter]")].map((b) =>
    b.textContent?.trim()
  );
  return {
    chips,
    line,
    scrollWidth: bar?.scrollWidth || 0,
    clientWidth: bar?.clientWidth || 0,
  };
});

await page.screenshot({ path: `${OUT_DIR}/01-notify-tab-categories-390.png`, fullPage: true });

const issues = [];
if (!audit.chips.some((c) => c.id === "all" && c.label === "すべて")) {
  issues.push("すべてチップなし");
}
if (audit.chips.some((c) => c.label === "案件" || c.id === "project")) {
  issues.push("案件チップ残存");
}
for (const label of EXPECT_CHIPS) {
  if (!audit.chips.some((c) => c.label === label)) issues.push(`欠落: ${label}`);
}
if (audit.line.includes("案件")) issues.push(`TALK一覧に案件残存: ${audit.line.join(",")}`);
if (!audit.line.includes("Builder")) issues.push(`TALK一覧にBuilderなし: ${audit.line.join(",")}`);
if (audit.scrollWidth <= audit.clientWidth) {
  issues.push(`横スクロール不可 scroll=${audit.scrollWidth}/${audit.clientWidth}`);
}

await page.evaluate(() => {
  document.querySelector('[data-talk-notify-mobile-chip="anpi"]')?.click();
});
await page.waitForTimeout(600);
const anpiFilter = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
  const types = cards.map(
    (c) => c.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "(なし)"
  );
  return { count: cards.length, types: [...new Set(types)] };
});
await page.screenshot({ path: `${OUT_DIR}/02-notify-anpi-filter-390.png`, fullPage: true });
if (anpiFilter.count === 0) issues.push("安否フィルタ0件");
if (anpiFilter.types.some((t) => t !== "安否" && t !== "(なし)")) {
  issues.push(`安否以外混在: ${anpiFilter.types.join(",")}`);
}

await browser.close();

console.log("chips:", audit.chips.map((c) => `${c.id}=${c.label}`).join(", "));
console.log("line tabs:", audit.line.join(", "));
console.log("anpi filter:", anpiFilter);

if (issues.length) {
  console.log("NG:", issues.join("; "));
  process.exit(1);
}
console.log("OK: notify category chips");
process.exit(0);
