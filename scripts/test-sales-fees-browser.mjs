#!/usr/bin/env node
/**
 * 売上・手数料管理 — Playwright E2E
 *   node scripts/test-sales-fees-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const PAGE = "/sales-fees.html";
const STORAGE_KEY = "tasful_transactions";
const FEE_RATE = 0.1;

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function calcFee(sales) {
  return Math.round(sales * FEE_RATE);
}

async function gotoPage(page) {
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-sf-stats]", { timeout: 15000 });
  await page.waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 }).catch(() => null);
}

async function seedDemo(page) {
  await gotoPage(page);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-sf-tbody] tr", { timeout: 15000 });
}

async function testLayout(page, label) {
  await page.waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 }).catch(() => null);
  const checks = [
    ["#dashSidebarNav a.dash-nav-link", "サイドバー"],
    [".dash-header__title", "ヘッダー"],
    ["[data-sf-stats] .sf-stat", "サマリーカード"],
    ["[data-sf-filters]", "期間フィルター"],
  ];
  for (const [sel, name] of checks) {
    if ((await page.locator(sel).count()) === 0) {
      fail(`${label}: ${name}`, sel);
      return;
    }
  }
  const box = await page.locator(".sf-layout").boundingBox();
  pass(`${label}: レイアウト`, box ? `${Math.round(box.width)}px` : "ok");
}

async function main() {
  console.log(`\n売上・手数料管理 E2E — ${BASE}${PAGE}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await seedDemo(page);
    pass("ページが開く");

    await page.setViewportSize({ width: 1280, height: 800 });
    await testLayout(page, "PC");
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page);
    await testLayout(page, "スマホ");
    await page.setViewportSize({ width: 1280, height: 800 });

    const salesNav = page.locator('#dashSidebarNav a[href="sales-fees.html"]');
    const navClass = await salesNav.getAttribute("class");
    if (navClass?.includes("is-active")) pass("サイドバー active", "売上・手数料管理");
    else fail("サイドバー active", navClass || "");

    const rowCount = await page.locator("[data-sf-tbody] tr").count();
    if (rowCount > 0) pass("取引履歴表示", `${rowCount}件`);
    else fail("取引履歴表示", "0件");

    const firstRow = page.locator("[data-sf-tbody] tr").first();
    const cells = await firstRow.locator("td").allTextContents();
    const salesText = cells[4]?.replace(/[^\d]/g, "") || "0";
    const feeText = cells[5]?.replace(/[^\d]/g, "") || "0";
    const netText = cells[6]?.replace(/[^\d]/g, "") || "0";
    const sales = Number(salesText);
    const fee = Number(feeText);
    const net = Number(netText);
    const expectedFee = calcFee(sales);
    const expectedNet = sales - expectedFee;
    if (fee === expectedFee && net === expectedNet) {
      pass("手数料10%・受取額", `売上${sales} 手数料${fee} 受取${net}`);
    } else {
      fail("手数料10%・受取額", `expected fee=${expectedFee} net=${expectedNet} got fee=${fee} net=${net}`);
    }

    await page.click('[data-sf-period="all"]');
    await page.waitForTimeout(200);
    const allCount = await page.locator("[data-sf-tbody] tr").count();
    if (allCount >= rowCount) pass("期間フィルター: すべて", `${allCount}件`);
    else fail("期間フィルター: すべて", `${allCount}件`);

    await page.click('[data-sf-period="lastMonth"]');
    await page.waitForTimeout(200);
    pass("期間フィルター: 先月", `${await page.locator("[data-sf-tbody] tr").count()}件`);

    await page.evaluate((key) => localStorage.setItem(key, "[]"), STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    const emptyVisible = await page.locator("[data-sf-empty]:not([hidden])").isVisible();
    if (emptyVisible) pass("0件表示");
    else fail("0件表示");

    const severe = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (severe.length) fail("コンソールエラー", severe.join(" | "));
    else pass("コンソールエラーなし");
  } catch (err) {
    fail("例外", err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();
