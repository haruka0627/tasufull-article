#!/usr/bin/env node
/**
 * detail-shop.html 店舗・販売「その他」E2E
 *
 * 1. detail-shop.html（id なし → shop-store-demo-other-001）
 * 2. detail-shop.html?demo=other
 * 3. detail-shop.html?id=shop-store-demo-other-001
 * 4. 店舗・販売 + その他 → detail-general.html に飛ばない
 *
 * 事前: npm run dev
 *   node scripts/test-detail-shop-other-browser.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "..", "screenshots", "detail-shop-regression");
const STORAGE_KEY = "tasful_listings";
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

async function waitShopLoaded(page) {
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
    timeout: 12000,
  });
}

async function waitShopOtherReady(page) {
  await waitShopLoaded(page);
  await page.waitForFunction(
    () => {
      const tabs = Array.from(document.querySelectorAll("[data-shop-action-tab]")).map((el) =>
        el.textContent?.trim()
      );
      const title = document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "";
      const products = document.getElementById("section-products");
      const access = document.getElementById("section-shop-bottom");
      const reviews = document.getElementById("section-reviews");
      const priceText =
        document.querySelector("[data-biz-detail-sidebar-price]")?.textContent?.trim() ||
        document.querySelector(".shop-hero-meta")?.textContent ||
        "";
      const sectionVisible = (el) =>
        el && !el.hidden && el.getBoundingClientRect().height > 8;
      return (
        title.includes("地域セレクト") &&
        tabs.some((t) => t.includes("商品")) &&
        tabs.some((t) => t.includes("アクセス")) &&
        tabs.some((t) => t.includes("口コミ")) &&
        sectionVisible(products) &&
        sectionVisible(access) &&
        sectionVisible(reviews)
      );
    },
    { timeout: 12000 }
  );
}

async function collectPageData(page) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    lead:
      document.querySelector("[data-biz-detail-lead]")?.textContent?.trim() || "",
    tagTexts: Array.from(
      document.querySelectorAll(
        "[data-biz-detail-hero-genre-tags] .shop-tag, [data-biz-detail-hero-condition-tags] .beauty-chip, [data-biz-detail-condition-tags] .beauty-chip, [data-biz-detail-genre-tags] .bsd-hero__pill, .biz-detail-hero__genre-tag, [data-bsd-hero-bottom-tags] .bsd-hero__tag"
      )
    )
      .map((el) => el.textContent?.trim())
      .filter(Boolean),
    priceText:
      document.querySelector("[data-biz-detail-sidebar-price]")?.textContent?.trim() ||
      document.querySelector(".shop-hero-meta")?.textContent?.trim() ||
      "",
    tabLabels: Array.from(document.querySelectorAll("[data-shop-action-tab]")).map((el) =>
      el.textContent?.trim()
    ),
    ctaTexts: Array.from(
      document.querySelectorAll(
        ".shop-sticky-action-nav__btn, [data-biz-detail-sidebar-actions] .biz-detail-btn"
      )
    ).map((el) => el.textContent?.trim()),
    handlingText: document.getElementById("section-shop-handling-info")?.textContent?.trim() || "",
    productsHidden: document.getElementById("section-products")?.hidden,
    accessHidden: document.getElementById("section-shop-bottom")?.hidden,
    reviewsHidden: document.getElementById("section-reviews")?.hidden,
    box: document.querySelector("[data-biz-detail-root]")?.getBoundingClientRect(),
    listingId: document.body.dataset.listingId || "",
    demoMode: document.body.dataset.shopDemoMode || "",
  }));
}

async function verifyShopOtherPage(page, label) {
  const data = await collectPageData(page);

  if (!/\/detail-shop\.html/i.test(data.url)) {
    fail(`${label}: detail-shop 表示`, data.url);
  } else {
    pass(`${label}: detail-shop 表示`, data.url);
  }

  if (data.title.includes(DEMO_TITLE)) pass(`${label}: タイトル`, data.title);
  else fail(`${label}: タイトル`, data.title);

  const descOk =
    data.lead.includes("ハンドメイド") ||
    data.title.includes("地域セレクト") ||
    (data.box && data.box.width < 500);
  if (descOk) pass(`${label}: 説明`);
  else fail(`${label}: 説明`, data.lead.slice(0, 60));

  const expectedTags = ["ハンドメイド", "地域商品", "TASFUL"];
  const tagsOk = expectedTags.every((tag) => data.tagTexts.some((t) => t.includes(tag)));
  if (tagsOk) pass(`${label}: タグ`, data.tagTexts.join(", "));
  else fail(`${label}: タグ`, data.tagTexts.join(", "));

  if (/要相談|見積/.test(data.priceText)) pass(`${label}: 価格表示`, data.priceText);
  else fail(`${label}: 価格表示`, data.priceText);

  const retailTabs = ["商品", "アクセス", "口コミ"];
  const tabsOk = retailTabs.every((tab) => data.tabLabels.some((t) => t.includes(tab)));
  if (tabsOk) pass(`${label}: タブ`, data.tabLabels.join(", "));
  else fail(`${label}: タブ`, data.tabLabels.join(", "));

  const ctaJoined = data.ctaTexts.join(" ");
  if (ctaJoined.includes("問い合わせ") || ctaJoined.includes("お問い合わせ")) {
    pass(`${label}: CTA`);
  } else {
    fail(`${label}: CTA`, ctaJoined.slice(0, 80));
  }

  if (!data.productsHidden) pass(`${label}: 商品表示`);
  else fail(`${label}: 商品表示`);

  if (!data.accessHidden) pass(`${label}: アクセス表示`);
  else fail(`${label}: アクセス表示`);

  if (!data.reviewsHidden) pass(`${label}: 口コミ表示`);
  else fail(`${label}: 口コミ表示`);

  if (data.box && data.box.width > 300) {
    pass(`${label}: レイアウト`, `${Math.round(data.box.width)}px`);
  } else {
    fail(`${label}: レイアウト`, `${data.box?.width ?? 0}px`);
  }
}

async function verifyRouting(page) {
  await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, record }) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const idx = list.findIndex((item) => item.id === record.id);
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      localStorage.setItem(key, JSON.stringify(list));
    },
    {
      key: STORAGE_KEY,
      record: {
        id: "lm-link-shop-other",
        title: "店舗・販売 その他テスト",
        listingType: "shop-store",
        businessType: "shop_store",
        scope: "business",
        category: "その他",
        price: 0,
        priceLabel: "要相談",
        description: "shop その他詳細表示テスト",
        tags: ["店舗", "その他"],
        products: [],
        reviews: [],
        access: null,
        status: "active",
        imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=ShopOther",
        postedAt: "2026-05-08T09:00:00.000Z",
      },
    }
  );

  const href = await page.evaluate(() => {
    const store = window.TasuListingLocalStore;
    const record = store?.fetchById?.("lm-link-shop-other");
    return store?.buildDetailPageUrl?.(record) || "";
  });

  if (/detail-shop\.html\?id=lm-link-shop-other/.test(href)) {
    pass("URL判定: detail-shop.html", href);
  } else {
    fail("URL判定: detail-shop.html", href);
  }

  await page.goto(`${BASE}/detail-shop.html?id=lm-link-shop-other`, {
    waitUntil: "domcontentloaded",
  });
  await waitShopLoaded(page);

  const url = page.url();
  if (/detail-shop\.html/.test(url) && !/detail-general/.test(url)) {
    pass("general へリダイレクトなし", url);
  } else {
    fail("general へリダイレクトなし", url);
  }
}

async function runViewport(page, label, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/detail-shop.html?id=${DEMO_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopOtherReady(page);
  await verifyShopOtherPage(page, label);
}

async function main() {
  const consoleErrors = [];
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err?.message || err));
  });

  console.log(`\ndetail-shop 店舗・販売 その他 E2E — ${BASE}\n`);

  console.log("\n=== detail-shop.html（id なし） ===");
  await page.goto(`${BASE}/detail-shop.html`, { waitUntil: "domcontentloaded" });
  await waitShopOtherReady(page);
  await verifyShopOtherPage(page, "id なし");

  console.log("\n=== detail-shop.html?demo=other ===");
  await page.goto(`${BASE}/detail-shop.html?demo=other`, { waitUntil: "domcontentloaded" });
  await waitShopOtherReady(page);
  await verifyShopOtherPage(page, "demo=other");

  console.log("\n=== detail-shop.html?id=shop-store-demo-other-001 ===");
  await page.goto(`${BASE}/detail-shop.html?id=${DEMO_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopOtherReady(page);
  await verifyShopOtherPage(page, "明示 id");

  console.log("\n=== URL判定（店舗・販売 + その他） ===");
  await verifyRouting(page);

  console.log("\n=== スマホ表示 ===");
  await runViewport(page, "スマホ", 390, 844);
  await mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, "other-001-sp.png") });

  console.log("\n=== PC表示 ===");
  await runViewport(page, "PC", 1280, 900);
  await page.screenshot({ path: path.join(SHOT_DIR, "other-001-pc.png") });

  if (consoleErrors.length === 0) pass("console エラーなし");
  else fail("console エラーなし", consoleErrors.slice(0, 3).join(" | "));

    });

  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- 結果: ${ok}/${total} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
