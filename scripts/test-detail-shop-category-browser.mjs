#!/usr/bin/env node
/**
 * detail-shop.html カテゴリ別表示 E2E（既存カテゴリ回帰 + その他）
 *
 *   BASE_URL=http://localhost:5180 node scripts/test-detail-shop-category-browser.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "..", "screenshots", "detail-shop-regression");
const OTHER_ID = "shop-store-demo-other-001";
const OTHER_TITLE = "地域セレクト商品の販売相談";
const RESTAURANT_ID = "demo-shop-kichi-dining";
const RESTAURANT_TITLE = "地元食材の創作和食";
const GOODS_ID = "demo-shop-marche-vert";
const GOODS_TITLE = "TASFUL 雑貨店";
const TOOLS_ID = "demo-shop-reworks";
const TOOLS_TITLE = "工具・機材の販売・買取";
const UNKNOWN_ID = "not-found-shop";

const LIST_DETAIL_IDS = [
  { listId: "demo-shop-haru-cafe", titleFragment: "HARU CAFE" },
  { listId: "demo-shop-marche-vert", titleFragment: GOODS_TITLE },
  { listId: "demo-shop-kiichi-dining", titleFragment: "喜一", aliasId: "demo-shop-kichi-dining" },
  { listId: "demo-shop-reworks", titleFragment: "Re:WORKS" },
];

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

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 15000 }
  );
}

async function collectNav(page) {
  return page.evaluate(() => ({
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    tabs: Array.from(document.querySelectorAll("[data-shop-action-tab]")).map((el) =>
      el.textContent?.trim()
    ),
    overviewHidden: document.getElementById("section-shop-overview")?.hidden,
    handlingHidden: document.getElementById("section-shop-handling-info")?.hidden,
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    statusText: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
    mainSectionTitle:
      document.querySelector("#section-products .shop-sec__title")?.textContent?.trim() || "",
    categoryKey: document.body.dataset.shopCategoryProfile || "",
  }));
}

function assertNotOtherDemo(data, label) {
  if (!data.title.includes(OTHER_TITLE)) pass(`${label}: その他デモタイトルなし`);
  else fail(`${label}: その他デモタイトルなし`, data.title);

  if (!data.tabs.includes("概要") && !data.tabs.includes("取扱情報")) {
    pass(`${label}: その他タブなし`, data.tabs.join(", "));
  } else {
    fail(`${label}: その他タブなし`, data.tabs.join(", "));
  }

  if (data.overviewHidden && data.handlingHidden) {
    pass(`${label}: 概要・取扱セクション非表示`);
  } else {
    fail(`${label}: 概要・取扱セクション非表示`);
  }
}

async function testOtherDemo(page) {
  console.log("\n=== その他デモ ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=${OTHER_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await page.waitForTimeout(300);
  const data = await collectNav(page);

  if (data.title.includes(OTHER_TITLE)) pass("その他: タイトル", data.title);
  else fail("その他: タイトル", data.title);

  const retailTabs = ["商品", "アクセス", "口コミ"];
  if (retailTabs.every((t) => data.tabs.some((tab) => tab.includes(t)))) {
    pass("その他: 小売系タブ", data.tabs.join(", "));
  } else {
    fail("その他: 小売系タブ", data.tabs.join(", "));
  }

  if (data.overviewHidden && data.handlingHidden) pass("その他: 概要・取扱セクション非表示");
  else fail("その他: 概要・取扱セクション非表示");

  const productsVisible = await page.evaluate(() => {
    const el = document.getElementById("section-products");
    if (!el || el.hidden) return false;
    return el.getBoundingClientRect().height > 8;
  });
  if (productsVisible) pass("その他: 商品一覧表示");
  else fail("その他: 商品一覧表示");
}

async function testRestaurantDemo(page) {
  console.log("\n=== 飲食デモ ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=${RESTAURANT_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const data = await collectNav(page);

  if (data.title.includes(RESTAURANT_TITLE) || data.title.includes("喜一ダイニング")) {
    pass("飲食: タイトル", data.title);
  } else {
    fail("飲食: タイトル", data.title);
  }

  assertNotOtherDemo(data, "飲食");

  const hasRestaurantNav =
    data.tabs.includes("メニュー") ||
    data.tabs.includes("店内・雰囲気") ||
    data.mainSectionTitle.includes("メニュー");
  if (hasRestaurantNav) pass("飲食: 飲食用見出し/タブ", data.tabs.join(", ") || data.mainSectionTitle);
  else fail("飲食: 飲食用見出し/タブ", data.tabs.join(", "));
}

async function testFlowerAtelierDemo(page) {
  console.log("\n=== 花屋（flower-atelier） ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=demo-shop-flower-atelier`, {
    waitUntil: "domcontentloaded",
  });
  await waitShopLoaded(page);
  await page.waitForTimeout(200);
  const data = await collectNav(page);
  const overflow = await page.evaluate(() => {
    const hero = document.querySelector(".biz-detail-fv.retail-top-fv, .biz-detail-fv.food-top-fv, .biz-detail-fv");
    const points = document.querySelector("[data-shop-restaurant-points]");
    if (!hero || !points || points.hidden) return 0;
    const h = hero.getBoundingClientRect();
    const p = points.getBoundingClientRect();
    return Math.max(Math.round(p.right - h.right), 0);
  });
  if (data.title.includes("風花") || data.title.includes("花屋")) pass("花屋: タイトル", data.title);
  else fail("花屋: タイトル", data.title);
  assertNotOtherDemo(data, "花屋");
  if (overflow <= 2) pass("花屋: こだわりヒーロー内", `${overflow}px`);
  else fail("花屋: こだわりヒーロー内", `${overflow}px`);
  await mkdir(SHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, "flower-atelier-pc.png") });
}

async function testGoodsInteriorDemo(page) {
  console.log("\n=== 雑貨・インテリアデモ ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=${GOODS_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const data = await collectNav(page);

  if (data.title.includes(GOODS_TITLE)) pass("雑貨: タイトル", data.title);
  else fail("雑貨: タイトル", data.title);

  assertNotOtherDemo(data, "雑貨");

  const hasRetailNav =
    data.tabs.includes("商品") ||
    data.mainSectionTitle.includes("商品") ||
    data.mainSectionTitle.includes("おすすめ");
  if (hasRetailNav) pass("雑貨: 商品系タブ/見出し", data.tabs.join(", ") || data.mainSectionTitle);
  else fail("雑貨: 商品系タブ/見出し", data.tabs.join(", "));
}

async function testToolsDemo(page) {
  console.log("\n=== 工具・材料・買取デモ ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=${TOOLS_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const data = await collectNav(page);

  if (data.title.includes(TOOLS_TITLE) || data.title.includes("Re:WORKS")) {
    pass("工具: タイトル", data.title);
  } else {
    fail("工具: タイトル", data.title);
  }

  assertNotOtherDemo(data, "工具");
  await mkdir(SHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOT_DIR, "reworks-pc.png") });
}

async function testUnknownId404(page) {
  console.log("\n=== 不明ID ===\n");
  await page.goto(`${BASE}/detail-shop.html?id=${UNKNOWN_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const data = await collectNav(page);

  if (data.rootHidden && /見つかりません|掲載ID/.test(data.statusText)) {
    pass("不明ID: 404表示", data.statusText.slice(0, 60));
  } else {
    fail("不明ID: 404表示", `rootHidden=${data.rootHidden} status=${data.statusText}`);
  }

  if (!data.title.includes(OTHER_TITLE)) pass("不明ID: その他デモにフォールバックしない");
  else fail("不明ID: その他デモにフォールバックしない", data.title);
}

async function testShopStoreListLinks(page) {
  console.log("\n=== shop-store 一覧 → 詳細 ID ===\n");
  await page.goto(`${BASE}/shop-store.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".shop-store-card[data-id]", { timeout: 15000 }).catch(() => {});

  const idReport = await page.evaluate((ids) => {
    return ids.map((id) => {
      const demo = window.TasuShopStoreDemo?.getById?.(id);
      const card = document.querySelector(`.shop-store-card[data-id="${id}"]`);
      const cardHref =
        card?.querySelector('a[href*="detail-shop.html"]')?.getAttribute("href") ||
        card?.querySelector(".shop-store-card__actions a")?.getAttribute("href") ||
        "";
      const expected = `detail-shop.html?id=${id}`;
      return { id, demoExists: Boolean(demo), cardOnPage: Boolean(card), cardHref, expected };
    });
  }, LIST_DETAIL_IDS.map((x) => x.listId));

  for (const row of idReport) {
    if (row.demoExists) pass(`デモ登録: ${row.id}`);
    else fail(`デモ登録: ${row.id}`);

    if (row.cardHref.includes(`id=${row.id}`)) {
      pass(`一覧カードURL: ${row.id}`, row.cardHref);
    } else if (row.cardOnPage) {
      fail(`一覧カードURL: ${row.id}`, row.cardHref || "(なし)");
    } else {
      pass(`一覧カードURL: ${row.id} (一覧非表示のためスキップ)`, row.expected);
    }
  }

  for (const { listId, titleFragment, aliasId } of LIST_DETAIL_IDS) {
    const detailId = aliasId || listId;
    await page.goto(`${BASE}/detail-shop.html?id=${detailId}`, { waitUntil: "domcontentloaded" });
    await waitShopLoaded(page);
    const data = await collectNav(page);
    if (data.title.includes(titleFragment)) pass(`詳細表示: ${detailId}`, data.title.slice(0, 40));
    else fail(`詳細表示: ${detailId}`, data.title);
    assertNotOtherDemo(data, `詳細→${detailId}`);
  }

  await page.goto(`${BASE}/detail-shop.html?id=demo-shop-kichi-dining`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const aliasOk = await page.evaluate(() => {
    const loader = window.TasuDetailShopStoreLoader;
    const resolved = loader?.resolveShopListingId?.("demo-shop-kichi-dining");
    const title = document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "";
    return resolved === "demo-shop-kiichi-dining" && title.includes("喜一");
  });
  if (aliasOk) pass("詳細IDエイリアス: demo-shop-kichi-dining → demo-shop-kiichi-dining");
  else fail("詳細IDエイリアス: demo-shop-kichi-dining → demo-shop-kiichi-dining");
}

async function main() {
  console.log(`\ndetail-shop カテゴリ表示 E2E — ${BASE}\n`);
  const consoleErrors = [];
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

  await testOtherDemo(page);
  await testRestaurantDemo(page);
  await testGoodsInteriorDemo(page);
  await testFlowerAtelierDemo(page);
  await testToolsDemo(page);
  await testUnknownId404(page);
  await testShopStoreListLinks(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/detail-shop.html?id=${RESTAURANT_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const box = await page.evaluate(() =>
    document.querySelector("[data-biz-detail-root]")?.getBoundingClientRect()
  );
  if (box && box.width > 280) pass("スマホレイアウト", `${Math.round(box.width)}px`);
  else fail("スマホレイアウト", `${box?.width ?? 0}px`);

  const fatal = consoleErrors.filter((t) => !isIgnorableConsoleError(t));
  if (fatal.length === 0) pass("console エラーなし");
  else fail("console エラーなし", fatal.slice(0, 2).join(" | "));

    });
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
