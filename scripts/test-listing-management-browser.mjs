#!/usr/bin/env node
/**
 * 掲載管理 — Playwright E2E
 *   node scripts/test-listing-management-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const PAGE = "/listing-management.html";
const STORAGE_KEY = "tasful_listings";

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function gotoPage(page) {
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-lm-stats]", { timeout: 15000 });
  await page.waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 }).catch(() => null);
}

async function seedDemo(page) {
  await gotoPage(page);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-lm-card]", { timeout: 15000 });
}

async function testLayout(page, label) {
  await page.waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 }).catch(() => null);
  const checks = [
    ["#dashSidebarNav a.dash-nav-link", "サイドバー"],
    [".dash-header__title", "ヘッダー"],
    ["[data-lm-stats] .lm-stat", "サマリーカード"],
    ["[data-lm-tabs]", "タブ"],
    ["[data-lm-list]", "一覧"],
  ];
  for (const [sel, name] of checks) {
    if ((await page.locator(sel).count()) === 0) {
      fail(`${label}: ${name}`, sel);
      return;
    }
  }
  const box = await page.locator(".lm-layout").boundingBox();
  pass(`${label}: レイアウト`, box ? `${Math.round(box.width)}px` : "ok");
}

async function main() {
  console.log(`\n掲載管理 E2E — ${BASE}${PAGE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
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

    const activeNav = page.locator('#dashSidebarNav a[href="listing-management.html"]');
    const navClass = await activeNav.getAttribute("class");
    if (navClass?.includes("is-active")) {
      pass("サイドバー active", "掲載管理");
    } else {
      fail("サイドバー active", navClass || "");
    }

    const cardCount = await page.locator("[data-lm-card]").count();
    if (cardCount > 0) pass("掲載カード表示", `${cardCount}件`);
    else fail("掲載カード表示", "0件");

    await page.click('[data-lm-tab="draft"]');
    await page.waitForTimeout(200);
    const draftCards = await page.locator("[data-lm-card]").count();
    pass("タブ切替: 下書き", `${draftCards}件`);

    await page.click('[data-lm-tab="all"]');

    const activeCard = page.locator('[data-lm-card="lm-demo-1"]');
    await activeCard.locator('[data-lm-action="pause"]').click();
    await page.waitForSelector('[data-lm-card="lm-demo-1"] .lm-badge--paused', { timeout: 5000 });
    pass("停止", "paused");

    await page.locator('[data-lm-card="lm-demo-1"]').locator('[data-lm-action="resume"]').click();
    await page.waitForSelector('[data-lm-card="lm-demo-1"] .lm-badge--active', { timeout: 5000 });
    pass("再開", "active");

    const draftBefore = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      return list.filter((i) => i.status === "draft").length;
    }, STORAGE_KEY);

    await page.locator('[data-lm-card="lm-demo-1"]').locator('[data-lm-action="duplicate"]').click();
    await page.waitForTimeout(300);
    const draftAfter = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      return list.filter((i) => i.status === "draft").length;
    }, STORAGE_KEY);
    if (draftAfter > draftBefore) pass("複製で draft 増加", `${draftBefore} → ${draftAfter}`);
    else fail("複製で draft 増加", `${draftBefore} → ${draftAfter}`);

    page.once("dialog", (d) => d.accept());
    await page.click('[data-lm-tab="all"]');
    await page.waitForTimeout(200);
    const countBeforeDelete = await page.locator("[data-lm-card]").count();
    const deleteTarget = page.locator('[data-lm-card="lm-demo-5"]');
    if (!(await deleteTarget.count())) {
      fail("削除対象", "lm-demo-5 なし");
    } else {
      await deleteTarget.locator('[data-lm-action="delete"]').click();
      await page.waitForTimeout(400);
      const countAfterDelete = await page.locator("[data-lm-card]").count();
      if (countAfterDelete < countBeforeDelete) pass("削除で件数減少", `${countBeforeDelete} → ${countAfterDelete}`);
      else fail("削除で件数減少", `${countBeforeDelete} → ${countAfterDelete}`);
    }

    await page.evaluate((key) => localStorage.setItem(key, "[]"), STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    const emptyVisible = await page.locator("[data-lm-empty]:not([hidden])").isVisible();
    if (emptyVisible) pass("0件表示");
    else fail("0件表示", "empty hidden");

    const severe = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (severe.length) fail("コンソールエラー", severe.join(" | "));
    else pass("コンソールエラーなし");
  } catch (err) {
    fail("例外", err instanceof Error ? err.message : String(err));
  }  });
  

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();

await closeAllBrowsers();
