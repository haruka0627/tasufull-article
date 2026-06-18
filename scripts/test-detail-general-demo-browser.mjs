#!/usr/bin/env node
/**
 * detail-general.html デモ掲載 E2E
 *
 * 1. detail-general.html（id なし → general-demo-002）
 * 2. detail-general.html?id=general-demo-002
 * 3. detail-general.html?id=not-found → 404
 *
 * 事前: npm run dev
 *   node scripts/test-detail-general-demo-browser.mjs
 *   BASE_URL=http://localhost:5180 node scripts/test-detail-general-demo-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const STORAGE_KEY = "tasful_listings";
const DEMO_ID = "general-demo-002";
const DEMO_TITLE = "地域交流イベント参加者募集";

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

async function clearDemoFromStorage(page) {
  await page.evaluate(
    ({ key, demoId }) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const next = list.filter((item) => String(item?.id) !== demoId);
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    { key: STORAGE_KEY, demoId: DEMO_ID }
  );
}

async function readDemoFromStorage(page) {
  return page.evaluate(
    ({ key, demoId }) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return null;
        return list.find((item) => String(item?.id) === demoId) || null;
      } catch {
        return null;
      }
    },
    { key: STORAGE_KEY, demoId: DEMO_ID }
  );
}

async function waitLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "not-found",
    { timeout: 10000 }
  );
}

async function waitGeneralHeroReady(page) {
  await waitLoaded(page);
  if ((await page.evaluate(() => document.body.dataset.listingLoaded)) === "not-found") return;
  await page.waitForFunction(
    () => {
      const category =
        document.querySelector("[data-biz-detail-hero-genre-tags] .bsd-hero__pill")?.textContent?.trim() ||
        "";
      const tagCount = document.querySelectorAll("[data-bsd-hero-bottom-tags] .bsd-hero__tag").length;
      const tabs = Array.from(document.querySelectorAll("[data-business-action-tab]")).map((el) =>
        el.textContent?.trim()
      );
      const priceText = document.querySelector("[data-biz-detail-hero-quick]")?.textContent || "";
      const reviewsEl = document.getElementById("section-reviews");
      const accessEl = document.getElementById("section-service-area");
      const reviewsHidden = !reviewsEl || reviewsEl.hidden === true;
      const accessHidden = !accessEl || accessEl.hidden === true;
      const eventHidden = !document.getElementById("section-general-event-info")?.hidden;
      const organizerHidden = !document.getElementById("section-general-organizer")?.hidden;
      return (
        category === "その他" &&
        tagCount >= 3 &&
        tabs.includes("概要") &&
        tabs.includes("開催情報") &&
        tabs.includes("主催者情報") &&
        !tabs.includes("口コミ") &&
        !tabs.includes("アクセス") &&
        priceText.includes("無料") &&
        reviewsHidden &&
        accessHidden &&
        eventHidden &&
        organizerHidden
      );
    },
    { timeout: 8000 }
  );
}

async function readPageData(page) {
  return page.evaluate(() => ({
    loaded: document.body.dataset.listingLoaded || "",
    listingId: document.body.dataset.listingId || "",
    demoMode: document.body.dataset.generalDemoMode || "",
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    category:
      document.querySelector("[data-biz-detail-hero-genre-tags] .bsd-hero__pill")?.textContent?.trim() ||
      document.querySelector("[data-bsd-hero-category]")?.textContent?.trim() ||
      "",
    description:
      document.querySelector("[data-bsd-overview-description]")?.textContent?.trim() ||
      document.querySelector(".business-summary__description")?.textContent?.trim() ||
      "",
    tagTexts: Array.from(document.querySelectorAll("[data-bsd-hero-bottom-tags] .bsd-hero__tag"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean),
    imageSrc: document.querySelector("[data-biz-detail-hero-img]")?.getAttribute("src") || "",
    ctaPrimary: document.querySelector("[data-business-service-estimate]")?.textContent?.trim() || "",
    ctaSecondary: document.querySelector("[data-business-service-chat]")?.textContent?.trim() || "",
    priceText: document.querySelector("[data-biz-detail-hero-quick]")?.textContent?.trim() || "",
    tabLabels: Array.from(document.querySelectorAll("[data-business-action-tab]")).map((el) =>
      el.textContent?.trim()
    ),
    reviewsHidden: (() => {
      const el = document.getElementById("section-reviews");
      return !el || el.hidden === true;
    })(),
    accessHidden: (() => {
      const el = document.getElementById("section-service-area");
      return !el || el.hidden === true;
    })(),
    eventText: document.getElementById("section-general-event-info")?.textContent?.trim() || "",
    organizerText: document.getElementById("section-general-organizer")?.textContent?.trim() || "",
    notFoundVisible: !document.querySelector("[data-general-not-found]")?.hidden,
    notFoundId: document.querySelector("[data-general-not-found-id]")?.textContent?.trim() || "",
    contentVisible: (() => {
      const root = document.getElementById("business-service-detail-root");
      return root ? !root.hidden : false;
    })(),
    box: document.querySelector(".business-service-page")?.getBoundingClientRect(),
  }));
}

function assertDemoContent(label, data) {
  if (data.loaded === "true") pass(`${label}: 掲載表示`);
  else fail(`${label}: 掲載表示`, data.loaded);

  if (data.listingId === DEMO_ID) pass(`${label}: listingId`, data.listingId);
  else fail(`${label}: listingId`, data.listingId);

  if (data.title === DEMO_TITLE) pass(`${label}: タイトル`, data.title);
  else fail(`${label}: タイトル`, data.title);

  if (data.category === "その他") pass(`${label}: カテゴリ`, data.category);
  else fail(`${label}: カテゴリ`, data.category);

  if (data.description.includes("地域の交流イベント")) pass(`${label}: 説明`);
  else fail(`${label}: 説明`, data.description.slice(0, 40));

  const expectedTags = ["イベント", "地域交流", "初心者歓迎", "TASFUL"];
  const tagsOk = expectedTags.every((tag) => data.tagTexts.includes(tag));
  if (tagsOk) pass(`${label}: タグ`, data.tagTexts.join(", "));
  else fail(`${label}: タグ`, data.tagTexts.join(", "));

  if (data.imageSrc.includes("placehold.co")) pass(`${label}: 画像`);
  else fail(`${label}: 画像`, data.imageSrc);

  if (data.ctaPrimary === "参加について相談する") pass(`${label}: CTA プライマリ`, data.ctaPrimary);
  else fail(`${label}: CTA プライマリ`, data.ctaPrimary);

  if (data.ctaSecondary === "お気に入りに追加") pass(`${label}: CTA セカンダリ`, data.ctaSecondary);
  else fail(`${label}: CTA セカンダリ`, data.ctaSecondary);

  if (data.priceText.includes("無料")) pass(`${label}: 価格表示`, "無料");
  else fail(`${label}: 価格表示`, data.priceText.slice(0, 40));

  const expectedTabs = ["概要", "開催情報", "主催者情報"];
  const tabsOk =
    expectedTabs.every((tab) => data.tabLabels.includes(tab)) &&
    !data.tabLabels.includes("口コミ") &&
    !data.tabLabels.includes("アクセス");
  if (tabsOk) pass(`${label}: タブ`, data.tabLabels.join(", "));
  else fail(`${label}: タブ`, data.tabLabels.join(", "));

  if (data.eventText.includes("2026-07-01") && data.eventText.includes("千葉県成田市")) {
    pass(`${label}: 開催情報`);
  } else {
    fail(`${label}: 開催情報`, data.eventText.slice(0, 60));
  }

  if (data.organizerText.includes("TASFUL運営")) pass(`${label}: 主催者情報`);
  else fail(`${label}: 主催者情報`, data.organizerText.slice(0, 40));

  if (!data.tabLabels.includes("口コミ")) pass(`${label}: 口コミタブなし`);
  else fail(`${label}: 口コミタブなし`, data.tabLabels.join(", "));

  if (!data.tabLabels.includes("アクセス")) pass(`${label}: アクセスタブなし`);
  else fail(`${label}: アクセスタブなし`, data.tabLabels.join(", "));

  if (data.reviewsHidden) pass(`${label}: レビュー非表示`);
  else fail(`${label}: レビュー非表示`);

  if (data.accessHidden) pass(`${label}: アクセス非表示`);
  else fail(`${label}: アクセス非表示`);

  if (data.box && data.box.width > 400) pass(`${label}: レイアウト`, `${Math.round(data.box.width)}px`);
  else fail(`${label}: レイアウト`, `${data.box?.width ?? 0}px`);

  if (data.contentVisible && !data.notFoundVisible) pass(`${label}: 404 非表示`);
  else fail(`${label}: 404 非表示`);
}

async function testNoIdAutoDemo(page) {
  console.log("\n=== detail-general.html（id なし） ===");
  await clearDemoFromStorage(page);

  await page.goto(`${BASE}/detail-general.html`, { waitUntil: "domcontentloaded" });
  await waitGeneralHeroReady(page);

  const data = await readPageData(page);
  assertDemoContent("id なし", data);

  if (data.demoMode === "true") pass("id なし: デモモードフラグ");
  else fail("id なし: デモモードフラグ", data.demoMode);

  const stored = await readDemoFromStorage(page);
  if (stored?.id === DEMO_ID && stored?.source === "demo") {
    pass("id なし: localStorage 自動生成", stored.title);
  } else {
    fail("id なし: localStorage 自動生成", stored ? JSON.stringify(stored).slice(0, 60) : "null");
  }
}

async function testExplicitDemoId(page) {
  console.log("\n=== detail-general.html?id=general-demo-002 ===");
  await page.goto(`${BASE}/detail-general.html?id=${DEMO_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await waitGeneralHeroReady(page);

  const data = await readPageData(page);
  assertDemoContent("明示 id", data);

  if (data.demoMode === "false") pass("明示 id: デモモードフラグ off");
  else fail("明示 id: デモモードフラグ off", data.demoMode);
}

async function testNotFound(page) {
  console.log("\n=== detail-general.html?id=not-found ===");
  await page.goto(`${BASE}/detail-general.html?id=not-found`, {
    waitUntil: "domcontentloaded",
  });
  await waitLoaded(page);

  const data = await readPageData(page);
  if (data.loaded === "not-found") pass("not-found: 404 状態");
  else fail("not-found: 404 状態", data.loaded);

  if (data.notFoundVisible && !data.contentVisible) pass("not-found: 404 UI 表示");
  else fail("not-found: 404 UI 表示");

  if (data.notFoundId.includes("not-found")) pass("not-found: ID 表示", data.notFoundId);
  else fail("not-found: ID 表示", data.notFoundId);
}

async function main() {
  console.log(`\ndetail-general デモ掲載 E2E — ${BASE}\n`);

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
    await page.setViewportSize({ width: 1280, height: 900 });
    await testNoIdAutoDemo(page);
    await testExplicitDemoId(page);
    await testNotFound(page);

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
