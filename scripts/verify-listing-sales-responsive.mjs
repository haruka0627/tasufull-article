#!/usr/bin/env node
/**
 * 掲載管理 / 売上管理 — レスポンシブ最終確認
 *   node scripts/verify-listing-sales-responsive.mjs
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const OUT = join(process.cwd(), "screenshots", "responsive-final");
const VIEWPORTS = [
  { label: "PC", width: 1280, height: 800 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

const PAGES = [
  { name: "listing-management", path: "/listing-management.html", ready: "[data-lm-stats]" },
  { name: "sales-fees", path: "/sales-fees.html", ready: "[data-sf-stats]" },
];

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function checkNoOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      body: body.scrollWidth - body.clientWidth,
    };
  });
  if (overflow.doc <= 2 && overflow.body <= 2) {
    pass(`${label}: 横はみ出しなし`, `doc+${overflow.doc}px`);
    return true;
  }
  fail(`${label}: 横はみ出し`, `doc+${overflow.doc}px body+${overflow.body}px`);
  return false;
}

async function checkElement(page, selector, label, checkFn) {
  const ok = await page.evaluate(
    ({ selector, checkFnBody }) => {
      const el = document.querySelector(selector);
      if (!el) return { ok: false, reason: "要素なし" };
      const fn = new Function("el", checkFnBody);
      return fn(el);
    },
    { selector, checkFnBody: checkFn.toString().match(/\{([\s\S]*)\}/)[1] }
  );
  if (ok.ok) pass(label, ok.detail || "");
  else fail(label, ok.reason || ok.detail || "");
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`\nレスポンシブ最終確認 — ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const pg of PAGES) {
      const label = `${pg.name} @ ${vp.label} (${vp.width}px)`;
      await page.goto(`${BASE}${pg.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(pg.ready, { timeout: 15000 });
      await page.waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 }).catch(() => null);

      await checkNoOverflow(page, label);

      const shot = join(OUT, `${pg.name}-${vp.label}-${vp.width}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      pass(`${label}: スクショ`, shot.replace(/\\/g, "/"));

      if (pg.name === "listing-management") {
        await page.waitForSelector("[data-lm-card]", { timeout: 10000 }).catch(() => null);
        const cardCount = await page.locator("[data-lm-card]").count();
        if (cardCount > 0) {
          await checkElement(
            page,
            "[data-lm-card]:first-child .lm-card__title",
            `${label}: タイトル折返し`,
            (el) => {
              const r = el.getBoundingClientRect();
              const parent = el.closest(".lm-card");
              const pr = parent?.getBoundingClientRect();
              if (!pr) return { ok: false, reason: "親なし" };
              const style = getComputedStyle(el);
              const wraps =
                style.overflowWrap === "break-word" ||
                style.wordBreak === "break-word" ||
                el.scrollWidth <= pr.width + 2;
              return wraps
                ? { ok: true, detail: `w=${Math.round(r.width)}` }
                : { ok: false, reason: `overflow ${el.scrollWidth}>${pr.width}` };
            }
          );
          await checkElement(
            page,
            "[data-lm-card]:first-child .lm-badge",
            `${label}: バッジ表示`,
            (el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0
                ? { ok: true, detail: `${Math.round(r.width)}x${Math.round(r.height)}` }
                : { ok: false, reason: "非表示" };
            }
          );
        }
        const tabsBox = await page.locator("[data-lm-tabs]").boundingBox();
        if (tabsBox && tabsBox.width <= vp.width) {
          pass(`${label}: タブ幅`, `${Math.round(tabsBox.width)}px`);
        } else {
          fail(`${label}: タブ幅`, tabsBox ? `${Math.round(tabsBox.width)}px` : "なし");
        }
      }

      if (pg.name === "sales-fees") {
        await page.click('[data-sf-period="all"]').catch(() => null);
        await page.waitForTimeout(200);
        const wrap = page.locator("[data-sf-table-wrap]");
        const wrapBox = await wrap.boundingBox();
        const scrollW = await wrap.evaluate((el) => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
          overflow: getComputedStyle(el).overflowX,
        }));
        if (wrapBox && wrapBox.width <= vp.width + 2) {
          pass(`${label}: テーブルラッパー幅`, `${Math.round(wrapBox.width)}px`);
        } else {
          fail(`${label}: テーブルラッパー幅`);
        }
        if (scrollW.overflow === "auto" || scrollW.overflow === "scroll" || scrollW.scroll <= scrollW.client + 2) {
          pass(`${label}: テーブル横スクロール`, scrollW.overflow);
        } else {
          fail(`${label}: テーブル横スクロール`, `scroll=${scrollW.scroll} client=${scrollW.client}`);
        }
      }
    }
  }

  // 長文エッジケース
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("tasful_listings"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-lm-card]", { timeout: 15000 });
  await page.evaluate(() => {
    const long =
      "【超長文タイトル検証】TASFULプレミアム業務サービス・出張型ハウスクリーニング＆エアコン分解洗浄＆店舗清掃オールインワンパックプラン（関東全域対応・即日見積可）";
    const title = document.querySelector(".lm-card__title");
    if (title) title.textContent = long;
  });
  await checkNoOverflow(page, "掲載管理 長文タイトル @ mobile");
  await page.screenshot({ path: join(OUT, "listing-management-long-title-mobile.png"), fullPage: true });

  await page.goto(`${BASE}/sales-fees.html`, { waitUntil: "domcontentloaded" });
  await page.click('[data-sf-period="all"]').catch(() => null);
  await page.waitForSelector("[data-sf-tbody] tr", { timeout: 10000 });
  await page.evaluate(() => {
    const longTitle =
      "株式会社サンプルホールディングス・関東統括本部・総合プロジェクトマネジメント支援サービス（長期契約・夜間対応込み）";
    const longBuyer = "山田太郎（代表取締役社長）／株式会社テストコーポレーション・エンタープライズ事業部";
    const row = document.querySelector("[data-sf-tbody] tr");
    if (row) {
      row.children[2].textContent = longTitle;
      row.children[3].textContent = longBuyer;
    }
  });
  await checkNoOverflow(page, "売上管理 長文セル @ mobile");
  await page.screenshot({ path: join(OUT, "sales-fees-long-text-mobile.png"), fullPage: true });

  // 0件表示
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("tasful_listings", "[]"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-lm-empty]:not([hidden])", { timeout: 10000 });
  const lmEmpty = await page.locator("[data-lm-empty]").boundingBox();
  if (lmEmpty) pass("掲載管理 0件表示 @ mobile", `${Math.round(lmEmpty.width)}px`);
  else fail("掲載管理 0件表示 @ mobile");
  await page.screenshot({ path: join(OUT, "listing-management-empty-mobile.png"), fullPage: true });

  await page.goto(`${BASE}/sales-fees.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("tasful_transactions", "[]"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-sf-empty]:not([hidden])", { timeout: 10000 });
  const sfEmpty = await page.locator("[data-sf-empty]").boundingBox();
  if (sfEmpty) pass("売上管理 0件表示 @ mobile", `${Math.round(sfEmpty.width)}px`);
  else fail("売上管理 0件表示 @ mobile");
  await page.screenshot({ path: join(OUT, "sales-fees-empty-mobile.png"), fullPage: true });

  const severe = errors.filter((e) => !/favicon|404|Failed to load|Failed to fetch|\[TasuChat\]|\[Dashboard\]/i.test(e));
  if (severe.length) fail("コンソールエラー", severe.slice(0, 3).join(" | "));
  else pass("コンソールエラーなし");

  await browser.close();

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();
