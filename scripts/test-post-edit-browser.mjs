#!/usr/bin/env node
/**
 * post.html 編集モード — Playwright E2E
 *
 * 事前: npm run dev
 *   node scripts/test-post-edit-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-post-edit-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const LISTINGS_KEY = "tasful_listings";
const EDIT_ID = "lm-edit-test-1";
const UPDATED_TITLE = "編集後タイトル — 保存確認";

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
    t.includes("supabase") ||
    t.includes("Supabase")
  );
}

const TEST_LISTING = {
  id: EDIT_ID,
  title: "編集テスト掲載",
  listingType: "skill",
  scope: "general",
  category: "スキル",
  price: 88000,
  status: "draft",
  imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Edit",
  postedAt: "2026-05-30T10:00:00.000Z",
  views: 3,
  favorites: 1,
  inquiries: 0,
  description: "編集モード復元テスト用の説明文です。",
  tags: ["テスト", "編集"],
  draft: {
    title: "編集テスト掲載",
    category: "スキル",
    price: 88000,
    description: "編集モード復元テスト用の説明文です。",
    images: ["https://placehold.co/800x600/e8eef5/1e3a5f?text=EditMain"],
    tags: ["テスト", "編集"],
  },
};

async function seedListing(page) {
  await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, listing }) => {
      localStorage.setItem(key, JSON.stringify([listing]));
      localStorage.removeItem("tasful_agent_listing_draft");
    },
    { key: LISTINGS_KEY, listing: TEST_LISTING }
  );
}

async function setTermsChecked(page, checked = true) {
  await page.evaluate((value) => {
    const el = document.querySelector("[data-terms-agree]");
    if (!el) return;
    el.checked = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, checked);
}

async function readFormValues(page) {
  return page.evaluate(() => ({
    title: document.getElementById("title")?.value ?? "",
    category: document.getElementById("category")?.value ?? "",
    price: document.getElementById("price")?.value ?? "",
    description: document.getElementById("description")?.value ?? "",
    tags: document.getElementById("tags")?.value ?? "",
    images: document.getElementById("images")?.value ?? "",
    editMode: document.body.dataset.postEditMode === "true",
    editListingId: document.getElementById("listingForm")?.dataset?.editListingId ?? "",
  }));
}

async function testResponsive(page, label) {
  const box = await page.locator(".post-page").boundingBox();
  const bannerVisible = await page.locator("[data-post-edit-banner]:not([hidden])").isVisible();
  if (box && box.width > 180 && bannerVisible) {
    pass(`${label}: 編集UI`, `${Math.round(box.width)}px`);
  } else {
    fail(`${label}: 編集UI`, `width=${box?.width ?? 0} banner=${bannerVisible}`);
  }
}

async function main() {
  console.log(`\npost 編集モード E2E — ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
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
    await seedListing(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-lm-card="${EDIT_ID}"]`, { timeout: 15000 });
    pass("掲載管理: テストデータ表示");

    const editHref = await page
      .locator(`[data-lm-card="${EDIT_ID}"]`)
      .locator('a:has-text("編集")')
      .getAttribute("href");
    if (editHref?.includes(`edit=${EDIT_ID}`)) {
      pass("編集リンク", editHref);
    } else {
      fail("編集リンク", editHref || "");
    }

    await page.locator(`[data-lm-card="${EDIT_ID}"]`).locator('a:has-text("編集")').click();
    await page.waitForURL(new RegExp(`edit=${EDIT_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), {
      timeout: 15000,
    });
    pass("post.html 編集モードで開く", page.url());

    await page.waitForFunction(
      () => (document.getElementById("title")?.value || "").includes("編集テスト"),
      { timeout: 10000 }
    );

    const restored = await readFormValues(page);
    if (restored.editMode && restored.editListingId === EDIT_ID) {
      pass("編集モード判定", EDIT_ID);
    } else {
      fail("編集モード判定", JSON.stringify(restored));
    }

    if (restored.title === TEST_LISTING.draft.title) pass("title 復元");
    else fail("title 復元", restored.title);

    if (restored.category === "スキル") pass("category 復元", restored.category);
    else fail("category 復元", restored.category);

    if (restored.price === "88000") pass("price 復元", restored.price);
    else fail("price 復元", restored.price);

    if (restored.description.includes("編集モード復元")) pass("description 復元");
    else fail("description 復元", restored.description.slice(0, 40));

    if (restored.tags.includes("テスト")) pass("tags 復元", restored.tags);
    else fail("tags 復元", restored.tags);

    const previewCount = await page.locator("[data-agent-images-preview] img").count();
    if (previewCount >= 1) pass("画像プレビュー復元", `${previewCount}枚`);
    else fail("画像プレビュー復元", `${previewCount}枚`);

    await page.setViewportSize({ width: 1280, height: 900 });
    await testResponsive(page, "PC");

    await page.fill("#title", UPDATED_TITLE);
    await setTermsChecked(page, true);

    await page.click("[data-open-confirm]");
    await page.waitForSelector("[data-confirm-modal]:not([hidden])", { timeout: 10000 });
    pass("確認モーダル表示");

    await page.click("[data-confirm-publish]");
    await page.waitForURL(/listing-management\.html/, { timeout: 20000 });
    pass("保存後 listing-management.html へ遷移");

    const stored = await page.evaluate(
      ({ key, id }) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        return list.find((item) => item.id === id) || null;
      },
      { key: LISTINGS_KEY, id: EDIT_ID }
    );

    if (stored?.title === UPDATED_TITLE) {
      pass("localStorage 更新", stored.title);
    } else {
      fail("localStorage 更新", stored?.title || "not found");
    }

    await page.waitForSelector(`[data-lm-card="${EDIT_ID}"]`, { timeout: 10000 });
    const cardTitle = await page.locator(`[data-lm-card="${EDIT_ID}"] .lm-card__title`).textContent();
    if (cardTitle?.includes(UPDATED_TITLE)) {
      pass("一覧タイトル更新", cardTitle.trim());
    } else {
      fail("一覧タイトル更新", cardTitle?.trim() || "");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/post.html?edit=${EDIT_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.body.dataset.postEditMode === "true",
      { timeout: 10000 }
    );
    await testResponsive(page, "スマホ");

    if (consoleErrors.length === 0) pass("console エラーなし");
    else fail("console エラーなし", consoleErrors.slice(0, 3).join(" | "));
  } catch (err) {
    fail("テスト実行", err.message);
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();
