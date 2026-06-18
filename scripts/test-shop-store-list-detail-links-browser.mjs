#!/usr/bin/env node
/**
 * shop-store.html 全カード「ショップを見る」→ detail-shop 表示 E2E
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/test-shop-store-list-detail-links-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 20000 }
  );
}

async function loadAllListCards(page) {
  for (let i = 0; i < 8; i++) {
    const before = await page.locator(".shop-store-card[data-id]").count();
    await page.evaluate(() => {
      const btn = document.querySelector("[data-shop-store-more]");
      if (btn && !btn.hidden) btn.click();
    });
    await page.waitForTimeout(400);
    const after = await page.locator(".shop-store-card[data-id]").count();
    if (after <= before) break;
  }
}

async function main() {
  console.log(`\nshop-store → detail-shop E2E — ${BASE}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/shop-store.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".shop-store-card[data-id]", { timeout: 20000 });
  await loadAllListCards(page);

  const cards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".shop-store-card[data-id]")).map((card) => {
      const id = card.getAttribute("data-id") || "";
      const title =
        card.querySelector(".shop-store-card__name")?.textContent?.trim() ||
        card.querySelector(".shop-store-card__name a")?.textContent?.trim() ||
        "";
      const detailLink =
        card.querySelector('.shop-store-btn--detail[href*="detail-shop"]') ||
        card.querySelector('a[href*="detail-shop.html"]');
      const detailHref = detailLink?.getAttribute("href") || "";
      return { id, title, detailHref };
    });
  });

  console.log(`一覧カード数: ${cards.length}\n`);

  const seen = new Set();
  for (const card of cards) {
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);

    const detailBtn = page.locator(
      `.shop-store-card[data-id="${card.id}"] .shop-store-btn--detail`
    );
    const href = card.detailHref;
  const idFromHref = (() => {
    try {
      const u = new URL(href, BASE);
      return u.searchParams.get("id") || "";
    } catch {
      return "";
    }
  })();

    if (idFromHref === card.id) pass(`URL一致: ${card.title || card.id}`, href);
    else fail(`URL一致: ${card.title || card.id}`, `card=${card.id} href=${href}`);

    if (await detailBtn.count()) {
      await detailBtn.first().click();
    } else {
      await page.goto(`${BASE}/${href.replace(/^\//, "")}`, { waitUntil: "domcontentloaded" });
    }

    await waitShopLoaded(page);
    const state = await page.evaluate(() => ({
      title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
      rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
      statusText: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
      loaded: document.body.dataset.listingLoaded,
    }));

    if (state.loaded === "true" && !state.rootHidden && !/見つかりません/.test(state.statusText)) {
      pass(`詳細表示: ${card.title || card.id}`, state.title.slice(0, 48));
    } else {
      fail(`詳細表示: ${card.title || card.id}`, state.statusText || `loaded=${state.loaded}`);
    }

    await page.goto(`${BASE}/shop-store.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".shop-store-card[data-id]", { timeout: 15000 });
  }

  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
