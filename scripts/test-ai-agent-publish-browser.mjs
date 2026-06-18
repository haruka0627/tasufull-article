#!/usr/bin/env node
/**
 * AI Agent 掲載フロー — Playwright E2E
 *
 * 事前: npm run dev
 *   node scripts/test-ai-agent-publish-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const LISTINGS_KEY = "tasful_listings";
const DRAFT_KEY = "tasful_agent_listing_draft";
const AI_TITLE = "AI Agent E2E スキル掲載";

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

async function clearStorage(page) {
  await page.evaluate(
    ({ listingsKey, draftKey }) => {
      localStorage.removeItem(listingsKey);
      localStorage.removeItem(draftKey);
    },
    { listingsKey: LISTINGS_KEY, draftKey: DRAFT_KEY }
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

async function publishFromPost(page) {
  await page.fill('[data-agent-brief="title"]', AI_TITLE);
  await page.selectOption('[data-agent-brief="category"]', { value: "スキル" });
  await page.fill('[data-agent-brief="price"]', "45000");
  await page.fill(
    '[data-agent-brief="description"]',
    "AI Agent から生成したスキル掲載の E2E テスト説明文です。"
  );
  await page.fill(
    '[data-agent-brief="images"]',
    "https://placehold.co/800x600/e8eef5/1e3a5f?text=AI+Skill"
  );
  await page.fill('[data-agent-brief="tags"]', "AI, スキル, E2E");

  await page.click("[data-agent-generate]");
  await page.waitForSelector('[data-agent-status]:not([hidden])', { timeout: 10000 });

  const title = await page.inputValue("#title");
  const category = await page.inputValue("#category");
  if (!title.includes("AI Agent E2E")) {
    throw new Error(`フォーム反映失敗: ${title}`);
  }
  if (category !== "スキル") {
    throw new Error(`カテゴリ反映失敗: ${category}`);
  }
  pass("AI下書き生成 → フォーム反映", `${title} / ${category}`);

  await setTermsChecked(page, true);
  await page.click("[data-open-confirm]");
  await page.waitForSelector("[data-confirm-modal]:not([hidden])", { timeout: 10000 });
  await page.click("[data-confirm-publish]");
  await page.waitForURL(/listing-management\.html/, { timeout: 25000 });
  pass("掲載保存 → 掲載管理へ遷移");
}

async function verifyListingStorage(page) {
  const stored = await page.evaluate((key) => {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return list.find((item) => String(item.title || "").includes("AI Agent E2E")) || null;
  }, LISTINGS_KEY);

  if (!stored?.id) {
    fail("tasful_listings 保存", "レコードなし");
    return null;
  }

  const checks = [
    ["title", stored.title?.includes("AI Agent E2E")],
    ["source", stored.source === "ai-agent"],
    ["status", stored.status === "active"],
    ["listingType", Boolean(stored.listingType)],
    ["description", Boolean(stored.description)],
    ["images", Array.isArray(stored.images) && stored.images.length > 0],
    ["tags", Array.isArray(stored.tags) && stored.tags.length > 0],
    ["createdAt", Boolean(stored.createdAt)],
    ["updatedAt", Boolean(stored.updatedAt)],
  ];

  const ng = checks.filter(([, ok]) => !ok).map(([k]) => k);
  if (!ng.length) {
    pass("tasful_listings フィールド", stored.id);
  } else {
    fail("tasful_listings フィールド", ng.join(", "));
  }

  return stored;
}

async function verifyManagementCard(page, listingId, label) {
  await page.waitForSelector(`[data-lm-card="${listingId}"]`, { timeout: 15000 });
  const cardTitle = await page
    .locator(`[data-lm-card="${listingId}"] .lm-card__title`)
    .textContent();
  if (cardTitle?.includes("AI Agent E2E")) {
    pass(`${label}: 掲載管理表示`, cardTitle.trim());
  } else {
    fail(`${label}: 掲載管理表示`, cardTitle || "");
  }

  const aiBadge = page.locator(`[data-lm-card="${listingId}"] [data-ai-agent-badge]`);
  if (await aiBadge.isVisible()) {
    pass(`${label}: AI作成バッジ（管理）`);
  } else {
    fail(`${label}: AI作成バッジ（管理）`);
  }

  const detailHref = await page
    .locator(`[data-lm-card="${listingId}"] [data-lm-detail-link]`)
    .getAttribute("href");
  if (detailHref?.includes(`detail-skill.html?id=${listingId}`)) {
    pass(`${label}: 詳細リンク`, detailHref);
  } else {
    fail(`${label}: 詳細リンク`, detailHref || "");
  }

  return detailHref;
}

async function verifyDetailPage(page, listingId, label) {
  await page.locator(`[data-lm-card="${listingId}"] [data-lm-detail-link]`).click();
  await page.waitForURL(new RegExp(`detail-skill\\.html\\?id=${listingId}`), {
    timeout: 15000,
  });
  pass(`${label}: 詳細ページ遷移`, page.url());

  await page.waitForFunction(
    () => {
      const title =
        document.querySelector("[data-listing-title]")?.textContent ||
        document.querySelector("h1")?.textContent ||
        "";
      return title.includes("AI Agent E2E");
    },
    { timeout: 15000 }
  );

  const detailTitle = await page.evaluate(() => {
    return (
      document.querySelector("[data-listing-title]")?.textContent ||
      document.querySelector("h1")?.textContent ||
      ""
    ).trim();
  });

  if (detailTitle.includes("AI Agent E2E")) {
    pass(`${label}: 詳細タイトル表示`, detailTitle.slice(0, 40));
  } else {
    fail(`${label}: 詳細タイトル表示`, detailTitle);
  }

  const aiBadgeVisible = await page.locator("[data-ai-agent-badge]").isVisible();
  if (aiBadgeVisible) {
    pass(`${label}: AI作成バッジ（詳細）`);
  } else {
    fail(`${label}: AI作成バッジ（詳細）`);
  }

  await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
}

async function main() {
  console.log(`\nAI Agent 掲載フロー E2E — ${BASE}\n`);

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
    await page.goto(`${BASE}/post.html`, { waitUntil: "domcontentloaded" });
    await clearStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    pass("post.html 起動");

    await page.setViewportSize({ width: 1280, height: 900 });
    await publishFromPost(page);

    const stored = await verifyListingStorage(page);
    if (!stored) throw new Error("storage missing");

    await verifyManagementCard(page, stored.id, "PC");
    await verifyDetailPage(page, stored.id, "PC");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/listing-management.html`, { waitUntil: "domcontentloaded" });
    await verifyManagementCard(page, stored.id, "スマホ");
    await verifyDetailPage(page, stored.id, "スマホ");

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

await closeAllBrowsers();
