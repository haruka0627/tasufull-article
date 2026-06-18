#!/usr/bin/env node
/**
 * お気に入り機能 E2E
 *
 * 事前: npm run dev
 *   node scripts/test-favorite-actions-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-favorite-actions-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const FAV_KEY = "tasful_favorites";
const GENERAL_DEMO_ID = "general-demo-002";
const SHOP_OTHER_ID = "shop-store-demo-other-001";
const BIZ_DEMO_ID = "demo-biz-08";

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

async function clearFavorites(page) {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem("tasful_favorite_listings");
  }, FAV_KEY);
}

async function readFavorites(page) {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, FAV_KEY);
}

async function waitDetailLoaded(page) {
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 15000 }
  );
}

async function getFavoriteButton(page) {
  return page.locator("[data-biz-detail-favorite], [data-favorite-button]").first();
}

async function getFavoriteLabel(page) {
  return page.evaluate(() => {
    const btn = document.querySelector("[data-biz-detail-favorite], [data-favorite-button]");
    if (!btn) return "";
    const label = btn.querySelector("[data-bsd-favorite-label], .tasu-favorite-btn__label");
    return (label?.textContent || btn.textContent || "").replace(/\s+/g, " ").trim();
  });
}

async function clickFavorite(page) {
  const btn = await getFavoriteButton(page);
  await btn.click();
  await page.waitForTimeout(400);
}

async function testFavoriteFlow(page, label, url, listingId) {
  console.log(`\n=== ${label} ===`);
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push(msg.text());
    }
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await clearFavorites(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await waitDetailLoaded(page);

  let favs = await readFavorites(page);
  if (favs.length !== 0) fail(`${label}: 初期状態は空`, String(favs.length));
  else pass(`${label}: 初期状態は空`);

  let labelText = await getFavoriteLabel(page);
  if (labelText.includes("お気に入りに追加") && !labelText.includes("済み")) {
    pass(`${label}: 未登録ラベル`, labelText);
  } else {
    fail(`${label}: 未登録ラベル`, labelText);
  }

  await clickFavorite(page);
  favs = await readFavorites(page);
  const match = favs.filter((f) => f.listingId === listingId);
  if (match.length === 1) pass(`${label}: 追加で tasful_favorites 保存`, match[0].title);
  else fail(`${label}: 追加で tasful_favorites 保存`, JSON.stringify(favs));

  const toastAdd = await page.evaluate(() => {
    const el = document.querySelector("[data-tasu-favorite-toast]");
    return el?.textContent?.trim() || "";
  });
  if (toastAdd.includes("お気に入りに追加しました")) pass(`${label}: 追加トースト`);
  else fail(`${label}: 追加トースト`, toastAdd);

  labelText = await getFavoriteLabel(page);
  if (labelText.includes("お気に入り済み")) pass(`${label}: 登録済みラベル`, labelText);
  else fail(`${label}: 登録済みラベル`, labelText);

  const isActive = await page.evaluate(() => {
    const btn = document.querySelector("[data-biz-detail-favorite], [data-favorite-button]");
    return btn?.classList.contains("is-active") || btn?.classList.contains("is-favorite");
  });
  if (isActive) pass(`${label}: is-active`);
  else fail(`${label}: is-active`);

  await clickFavorite(page);
  favs = await readFavorites(page);
  if (!favs.some((f) => f.listingId === listingId)) pass(`${label}: 解除`);
  else fail(`${label}: 解除`, JSON.stringify(favs));

  await clickFavorite(page);
  let favsAfterAdd = await readFavorites(page);
  if (!favsAfterAdd.some((f) => f.listingId === listingId)) {
    fail(`${label}: 重複テスト前の追加`, JSON.stringify(favsAfterAdd));
  } else {
    const dupCheck = await page.evaluate(
      (id) => {
        const store = window.TasuListingLocalStore;
        const listing =
          window.__tasuDetailFavoriteListing ||
          (store?.fetchById?.(id) ? store.toDetailListing(store.fetchById(id)) : null);
        if (!listing || !window.TasuFavoriteStore) return { count: -1 };
        window.TasuFavoriteStore.addFromListing(listing);
        window.TasuFavoriteStore.addFromListing(listing);
        const list = window.TasuFavoriteStore.readAll();
        return { count: list.filter((f) => f.listingId === id).length };
      },
      listingId
    );
    if (dupCheck.count === 1) pass(`${label}: 重複保存なし`);
    else fail(`${label}: 重複保存なし`, String(dupCheck.count));
  }

  await page.reload({ waitUntil: "networkidle" });
  await waitDetailLoaded(page);
  await page.waitForFunction(
    (id) => {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem("tasful_favorites") || "[]");
      } catch {
        return false;
      }
      if (!list.some((f) => f.listingId === id)) return true;
      const btn = document.querySelector("[data-biz-detail-favorite], [data-favorite-button]");
      if (!btn) return false;
      return (
        btn.classList.contains("is-active") ||
        btn.classList.contains("is-favorite") ||
        /お気に入り済み/.test(btn.textContent || "")
      );
    },
    listingId,
    { timeout: 10000 }
  );
  labelText = await getFavoriteLabel(page);
  if (labelText.includes("お気に入り済み")) pass(`${label}: 再読み込み後も登録済み`, labelText);
  else fail(`${label}: 再読み込み後も登録済み`, labelText);

  if (errors.length === 0) pass(`${label}: console エラーなし`);
  else fail(`${label}: console エラーなし`, errors.slice(0, 3).join(" | "));
}

async function testLayout(page, label, url, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await clearFavorites(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await waitDetailLoaded(page);
  const box = await page.evaluate(() => {
    const btn = document.querySelector("[data-biz-detail-favorite], [data-favorite-button]");
    return btn?.getBoundingClientRect();
  });
  if (box && box.width > 0 && box.height > 0) {
    pass(`${label}: ボタン表示 ${width}px`, `${Math.round(box.width)}x${Math.round(box.height)}`);
  } else {
    fail(`${label}: ボタン表示 ${width}px`);
  }
}

async function main() {
  console.log(`\nお気に入り E2E — ${BASE}\n`);
  const browser = await chromium.launch();

  const pc = await browser.newPage();
  await testFavoriteFlow(
    pc,
    "detail-general.html",
    `${BASE}/detail-general.html`,
    GENERAL_DEMO_ID
  );
  await testLayout(pc, "general PC", `${BASE}/detail-general.html`, 1280);
  await pc.close();

  const shop = await browser.newPage();
  await testFavoriteFlow(
    shop,
    "detail-shop other",
    `${BASE}/detail-shop.html?id=${SHOP_OTHER_ID}`,
    SHOP_OTHER_ID
  );
  await testLayout(shop, "shop mobile", `${BASE}/detail-shop.html?id=${SHOP_OTHER_ID}`, 390);
  await shop.close();

  const biz = await browser.newPage();
  await testFavoriteFlow(
    biz,
    "detail-business-service",
    `${BASE}/detail-business-service.html?id=${BIZ_DEMO_ID}`,
    BIZ_DEMO_ID
  );
  await biz.close();

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- 結果: ${ok}/${total} OK ---\n`);
  process.exit(ok === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
