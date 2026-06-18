#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 掲載管理 — 詳細リンク E2E
 *
 * 事前: npm run dev
 *   node scripts/test-listing-detail-link-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-listing-detail-link-browser.mjs
 */

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const PAGE = "/listing-management.html";
const STORAGE_KEY = "tasful_listings";

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
    t.includes("Supabase") ||
    t.includes("TasuChat")
  );
}

const TEST_LISTINGS = [
  {
    id: "lm-link-biz",
    title: "業務サービス掲載",
    listingType: "business-service",
    scope: "business",
    businessType: "field_service",
    category: "清掃",
    price: 8800,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Biz",
    postedAt: "2026-05-01T09:00:00.000Z",
    views: 1,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-shop",
    title: "店舗・販売掲載",
    listingType: "shop-store",
    scope: "business",
    businessType: "shop_store",
    category: "店舗",
    price: 12000,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Shop",
    postedAt: "2026-05-02T09:00:00.000Z",
    views: 2,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-shop-other",
    title: "店舗・販売 その他テスト",
    listingType: "shop-store",
    scope: "business",
    businessType: "shop_store",
    category: "その他",
    price: 0,
    priceLabel: "要相談",
    description: "shop その他詳細表示テスト用",
    tags: ["店舗", "その他"],
    products: [],
    reviews: [],
    access: null,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=ShopOther",
    postedAt: "2026-05-08T09:00:00.000Z",
    views: 1,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-skill",
    title: "スキル掲載",
    listingType: "skill",
    scope: "general",
    category: "Web",
    price: 50000,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Skill",
    postedAt: "2026-05-03T09:00:00.000Z",
    views: 3,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-general",
    title: "一般掲載テスト",
    listingType: "general",
    scope: "general",
    category: "その他",
    price: 15000,
    status: "active",
    source: "ai-agent",
    description: "general 詳細ページ表示テスト用の説明文です。",
    images: [
      "https://placehold.co/800x600/e8eef5/1e3a5f?text=General",
      "https://placehold.co/800x600/dbeafe/1e3a5f?text=Sub",
    ],
    tags: ["general", "テスト", "AI"],
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=General",
    postedAt: "2026-05-07T09:00:00.000Z",
    createdAt: "2026-05-07T09:00:00.000Z",
    updatedAt: "2026-05-07T09:00:00.000Z",
    views: 7,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-product",
    title: "商品掲載",
    listingType: "product",
    scope: "general",
    category: "家電",
    price: 9800,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Product",
    postedAt: "2026-05-04T09:00:00.000Z",
    views: 4,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-job",
    title: "求人掲載",
    listingType: "job",
    scope: "job",
    category: "エンジニア",
    price: 0,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Job",
    postedAt: "2026-05-05T09:00:00.000Z",
    views: 5,
    favorites: 0,
    inquiries: 0,
  },
  {
    id: "lm-link-worker",
    title: "ワーカー掲載",
    listingType: "worker",
    scope: "worker",
    category: "動画編集",
    price: 3000,
    status: "active",
    imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Worker",
    postedAt: "2026-05-06T09:00:00.000Z",
    views: 6,
    favorites: 0,
    inquiries: 0,
  },
];

const EXPECTED_LINKS = {
  "lm-link-biz": /detail-business-service\.html\?id=lm-link-biz/,
  "lm-link-shop": /detail-shop\.html\?id=lm-link-shop/,
  "lm-link-shop-other": /detail-shop\.html\?id=lm-link-shop-other/,
  "lm-link-skill": /detail-skill\.html\?id=lm-link-skill/,
  "lm-link-general": /detail-general\.html\?id=lm-link-general/,
  "lm-link-product": /detail-product\.html\?id=lm-link-product/,
  "lm-link-job": /detail-job\.html\?id=lm-link-job/,
  "lm-link-worker": /detail-worker\.html\?id=lm-link-worker/,
};

async function seedListings(page) {
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, rows }) => localStorage.setItem(key, JSON.stringify(rows)),
    { key: STORAGE_KEY, rows: TEST_LISTINGS }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-lm-list]", { timeout: 15000 });
}

async function verifyDetailHrefs(page, label) {
  for (const [id, pattern] of Object.entries(EXPECTED_LINKS)) {
    const link = page.locator(`[data-lm-card="${id}"] [data-lm-detail-link]`);
    const href = await link.getAttribute("href");
    const visible = await link.isVisible();
    if (visible && pattern.test(href || "")) {
      pass(`${label}: href ${id}`, href);
    } else {
      fail(`${label}: href ${id}`, href || `visible=${visible}`);
    }
  }
}

async function clickAndVerifyNavigation(page, id, pattern, label) {
  const link = page.locator(`[data-lm-card="${id}"] [data-lm-detail-link]`);
  await link.click();
  await page.waitForURL(pattern, { timeout: 15000 });
  pass(`${label}: 遷移 ${id}`, page.url());
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-lm-card="${id}"]`, { timeout: 10000 });
}

async function verifyGeneralDetailPage(page, label) {
  await page.locator('[data-lm-card="lm-link-general"] [data-lm-detail-link]').click();
  await page.waitForURL(/detail-general\.html\?id=lm-link-general/, { timeout: 15000 });
  pass(`${label}: general 詳細遷移`, page.url());

  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () => {
      const category =
        document.querySelector("[data-biz-detail-hero-genre-tags] .bsd-hero__pill")?.textContent?.trim() ||
        "";
      const tagCount = document.querySelectorAll("[data-bsd-hero-bottom-tags] .bsd-hero__tag").length;
      return category === "その他" && tagCount >= 2;
    },
    { timeout: 5000 }
  );

  await page.waitForFunction(
    () => {
      const tabs = Array.from(document.querySelectorAll("[data-business-action-tab]")).map((el) =>
        el.textContent?.trim()
      );
      return tabs.includes("概要") && !tabs.includes("口コミ");
    },
    { timeout: 5000 }
  );

  const data = await page.evaluate(() => ({
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    category:
      document.querySelector("[data-biz-detail-hero-genre-tags] .bsd-hero__pill")?.textContent?.trim() ||
      document.querySelector("[data-bsd-hero-category]")?.textContent?.trim() ||
      "",
    description:
      document.querySelector("[data-bsd-overview-description]")?.textContent?.trim() ||
      document.querySelector(".business-summary__description")?.textContent?.trim() ||
      document.querySelector("#section-overview")?.textContent?.trim() ||
      "",
    priceRow:
      document.querySelector("[data-bsd-pricing-tbody] .service-menu-price")?.textContent?.trim() ||
      "",
    pricingText: document.querySelector("#section-service-menu")?.textContent?.trim() || "",
    tagCount: document.querySelectorAll("[data-bsd-hero-bottom-tags] .bsd-hero__tag").length,
    imageSrc: document.querySelector("[data-biz-detail-hero-img]")?.getAttribute("src") || "",
    aiBadge: document.querySelector("[data-ai-agent-badge]")?.textContent?.trim() || "",
    ctaPrimary: document.querySelector("[data-business-service-estimate]")?.textContent?.trim() || "",
    ctaSecondary: document.querySelector("[data-business-service-chat]")?.textContent?.trim() || "",
    hasReviews: !document.getElementById("section-reviews")?.hidden,
    tabLabels: Array.from(document.querySelectorAll("[data-business-action-tab]")).map((el) =>
      el.textContent?.trim()
    ),
    priceText: document.querySelector("[data-biz-detail-hero-quick]")?.textContent?.trim() || "",
    box: document.querySelector(".business-service-page")?.getBoundingClientRect(),
  }));

  if (data.title.includes("一般掲載テスト")) pass(`${label}: タイトル表示`);
  else fail(`${label}: タイトル表示`, data.title);

  if (data.category === "その他") pass(`${label}: カテゴリ表示`, data.category);
  else fail(`${label}: カテゴリ表示`, data.category);

  if (data.description.includes("general 詳細ページ")) pass(`${label}: 説明表示`);
  else {
    const bodyHas = await page.evaluate(() =>
      document.body.innerText.includes("general 詳細ページ")
    );
    if (bodyHas) pass(`${label}: 説明表示`);
    else fail(`${label}: 説明表示`, data.description.slice(0, 60));
  }

  if (
    data.priceRow.includes("15,000") ||
    data.priceRow.includes("15000") ||
    data.pricingText.includes("15,000") ||
    data.pricingText.includes("15000")
  ) {
    pass(`${label}: 価格表示`, data.priceRow || data.pricingText.slice(0, 40));
  } else {
    fail(`${label}: 価格表示`, data.priceRow || data.pricingText.slice(0, 40));
  }

  if (data.tagCount >= 2) pass(`${label}: タグ表示`, `${data.tagCount}件`);
  else fail(`${label}: タグ表示`, `${data.tagCount}件`);

  if (data.imageSrc.includes("placehold.co")) pass(`${label}: 画像表示`);
  else fail(`${label}: 画像表示`, data.imageSrc);

  if (data.aiBadge.includes("AI作成")) pass(`${label}: AI作成バッジ`);
  else fail(`${label}: AI作成バッジ`, data.aiBadge);

  if (data.ctaPrimary === "相談する") pass(`${label}: CTA プライマリ`, data.ctaPrimary);
  else fail(`${label}: CTA プライマリ`, data.ctaPrimary);

  if (data.ctaSecondary === "お気に入りに追加") pass(`${label}: CTA セカンダリ`, data.ctaSecondary);
  else fail(`${label}: CTA セカンダリ`, data.ctaSecondary);

  if (!data.hasReviews) pass(`${label}: レビュー非表示（データなし）`);
  else fail(`${label}: レビュー非表示（データなし）`);

  if (data.tabLabels.includes("概要") && !data.tabLabels.includes("口コミ")) {
    pass(`${label}: タブ`, data.tabLabels.join(", "));
  } else {
    fail(`${label}: タブ`, data.tabLabels.join(", "));
  }

  if (data.box && data.box.width > 300) pass(`${label}: レイアウト`, `${Math.round(data.box.width)}px`);
  else fail(`${label}: レイアウト`, `${data.box?.width ?? 0}px`);

  await page.goto(`${BASE}/detail-general.html?listingId=lm-link-general`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 10000 }
  );
  const titleViaListingId = await page.locator("[data-biz-detail-title]").textContent();
  if (titleViaListingId?.includes("一般掲載テスト")) {
    pass(`${label}: listingId パラメータ対応`);
  } else {
    fail(`${label}: listingId パラメータ対応`, titleViaListingId || "");
  }

  await page.goto(`${BASE}/detail-general.html?id=missing-listing-id`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "not-found",
    { timeout: 10000 }
  );
  const notFoundVisible = await page.locator("[data-general-not-found]:not([hidden])").isVisible();
  if (notFoundVisible) pass(`${label}: 未掲載表示`);
  else fail(`${label}: 未掲載表示`);

  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
}

async function main() {
  console.log(`\n掲載カード詳細リンク E2E — ${BASE}${PAGE}\n`);

  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isIgnorableConsoleError(err.message)) {
      consoleErrors.push(err.message);
    }
  });

  try {
    await seedListings(page);
    pass("テストデータ seed");

    await page.setViewportSize({ width: 1280, height: 900 });
    await verifyDetailHrefs(page, "PC");

    await clickAndVerifyNavigation(
      page,
      "lm-link-biz",
      /detail-business-service\.html/,
      "PC"
    );
    await clickAndVerifyNavigation(page, "lm-link-shop", /detail-shop\.html/, "PC");
    await clickAndVerifyNavigation(page, "lm-link-skill", /detail-skill\.html/, "PC");
    await verifyGeneralDetailPage(page, "PC");

    const editHref = await page
      .locator('[data-lm-card="lm-link-skill"]')
      .locator('a:has-text("編集")')
      .getAttribute("href");
    if (editHref?.includes("post.html?edit=lm-link-skill")) {
      pass("編集リンクは変更なし", editHref);
    } else {
      fail("編集リンクは変更なし", editHref || "");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await verifyDetailHrefs(page, "スマホ");

    await clickAndVerifyNavigation(
      page,
      "lm-link-product",
      /detail-product\.html/,
      "スマホ"
    );
    await clickAndVerifyNavigation(page, "lm-link-job", /detail-job\.html/, "スマホ");
    await clickAndVerifyNavigation(
      page,
      "lm-link-worker",
      /detail-worker\.html/,
      "スマホ"
    );
    await verifyGeneralDetailPage(page, "スマホ");

    const pauseBtn = page.locator('[data-lm-card="lm-link-biz"] [data-lm-action="pause"]');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await page.waitForSelector('[data-lm-card="lm-link-biz"] .lm-badge--paused', {
        timeout: 5000,
      });
      pass("停止ボタンは従来どおり");
    } else {
      fail("停止ボタンは従来どおり", "pause 非表示");
    }

    await page.goto(`${BASE}/detail-post.html?listingId=lm-link-general`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(/detail-general\.html\?id=lm-link-general/, { timeout: 15000 });
    pass("detail-post → detail-general リダイレクト");

    if (consoleErrors.length === 0) pass("console エラーなし");
    else fail("console エラーなし", consoleErrors.slice(0, 3).join(" | "));
  } catch (err) {
    fail("テスト実行", err.message);
  }  });
  

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();
