#!/usr/bin/env node
/**
 * shop-store.html — その他カテゴリデモ E2E
 *
 *   node scripts/test-shop-store-other-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-shop-store-other-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const DEMO_ID = "shop-store-demo-other-001";
const DEMO_TITLE = "地域セレクト商品の販売相談";

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    t.includes("supabase") ||
    t.includes("Supabase")
  );
}

async function waitGridReady(page) {
  await page.waitForSelector("[data-shop-store-grid] .shop-store-card", { timeout: 15000 });
}

async function findDemoCard(page) {
  return page.evaluate(
    ({ demoId, demoTitle }) => {
      const cards = Array.from(document.querySelectorAll("[data-shop-store-grid] .shop-store-card"));
      return cards.find((card) => {
        const id = card.getAttribute("data-id") || "";
        const text = card.textContent || "";
        return id === demoId || text.includes(demoTitle);
      });
    },
    { demoId: DEMO_ID, demoTitle: DEMO_TITLE }
  );
}

async function testInitialView(page, label) {
  console.log(`\n=== ${label} ===`);
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) errors.push(msg.text());
  });

  await page.goto(`${BASE}/shop-store.html`, { waitUntil: "networkidle" });
  await waitGridReady(page);

  const card = await findDemoCard(page);
  if (card) pass(`${label}: 初期表示にデモカード`);
  else fail(`${label}: 初期表示にデモカード`);

  const meta = await page.evaluate(
    ({ demoId }) => {
      const el = document.querySelector(`[data-shop-store-grid] .shop-store-card[data-id="${demoId}"]`);
      if (!el) return null;
      return {
        title: el.querySelector(".shop-store-card__name")?.textContent?.trim() || "",
        category: el.querySelector(".shop-store-card__tag")?.textContent?.trim() || "",
        price: el.querySelector(".shop-store-card__price")?.textContent?.trim() || "",
        area: el.querySelector(".shop-store-card__location")?.textContent?.trim() || "",
        desc: el.querySelector(".shop-store-card__desc")?.textContent?.trim() || "",
        detailHref: el.querySelector(".shop-store-btn--shop, .shop-store-btn--detail")?.getAttribute("href") || "",
        count: document.querySelector("[data-shop-store-count]")?.textContent?.trim() || "",
      };
    },
    { demoId: DEMO_ID }
  );

  if (meta?.title?.includes(DEMO_TITLE)) pass(`${label}: タイトル`, meta.title);
  else fail(`${label}: タイトル`, meta?.title);

  if (meta?.category === "その他") pass(`${label}: カテゴリバッジ`);
  else fail(`${label}: カテゴリバッジ`, meta?.category);

  if (meta?.price?.includes("要相談")) pass(`${label}: 価格`);
  else fail(`${label}: 価格`, meta?.price);

  if (meta?.area?.includes("成田")) pass(`${label}: エリア`);
  else fail(`${label}: エリア`, meta?.area);

  if (meta?.desc?.includes("ハンドメイド")) pass(`${label}: 説明`);
  else fail(`${label}: 説明`, meta?.desc?.slice(0, 40));

  if (meta?.detailHref?.includes(DEMO_ID)) pass(`${label}: 詳細リンク`, meta.detailHref);
  else fail(`${label}: 詳細リンク`, meta?.detailHref);

  if (errors.length === 0) pass(`${label}: console エラーなし`);
  else fail(`${label}: console エラーなし`, errors.slice(0, 2).join(" | "));
}

async function testOtherCategoryFilter(page, label) {
  await page.goto(`${BASE}/shop-store.html`, { waitUntil: "networkidle" });
  await waitGridReady(page);

  await page.click('[data-shop-platform-cat="other"]');
  await page.waitForTimeout(400);

  const count = await page.evaluate(() => document.querySelector("[data-shop-store-count]")?.textContent?.trim());
  const emptyHidden = await page.evaluate(() => document.querySelector("[data-shop-store-empty]")?.hidden !== false);
  const card = await findDemoCard(page);

  if (card && count !== "0" && emptyHidden) pass(`${label}: その他フィルタ`, `件数 ${count}`);
  else fail(`${label}: その他フィルタ`, `count=${count} empty=${!emptyHidden}`);

  const detailHref = await page.evaluate(
    ({ demoId }) =>
      document
        .querySelector(`[data-shop-store-grid] .shop-store-card[data-id="${demoId}"] .shop-store-btn--gold`)
        ?.getAttribute("href") || "",
    { demoId: DEMO_ID }
  );
  if (detailHref.includes(`detail-shop.html?id=${DEMO_ID}`)) pass(`${label}: 詳細ボタンURL`);
  else fail(`${label}: 詳細ボタンURL`, detailHref);
}

async function testLayout(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/shop-store.html`, { waitUntil: "networkidle" });
  await waitGridReady(page);
  const box = await page.evaluate(
    ({ demoId }) =>
      document
        .querySelector(`[data-shop-store-grid] .shop-store-card[data-id="${demoId}"]`)
        ?.getBoundingClientRect(),
    { demoId: DEMO_ID }
  );
  if (box && box.width > 0) pass(`レイアウト ${width}px`, `${Math.round(box.width)}x${Math.round(box.height)}`);
  else fail(`レイアウト ${width}px`);
}

async function main() {
  console.log(`\nshop-store その他デモ E2E — ${BASE}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await testInitialView(page, "初期表示");
  await testOtherCategoryFilter(page, "その他カテゴリ");
  await testLayout(page, 1280);
  await page.setViewportSize({ width: 390, height: 900 });
  await testLayout(page, 390);

  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
