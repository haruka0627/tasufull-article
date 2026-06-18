#!/usr/bin/env node
/**
 * business.html — 業務サービスのみ / その他デモ / 詳細 E2E
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/test-business-board-field-service-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const OTHER_DEMO_ID = "business-demo-other-001";
const OTHER_TITLE = "地域サポート・各種相談サービス";

const SHOP_LEAK_PATTERNS = [
  /Re:WORKS/i,
  /HARU CAFE/i,
  /花屋アトリエ/i,
  /TASFUL 雑貨店/i,
  /工具・機材の販売/i,
  /shop-store-demo-/i,
  /demo-biz-store-/i,
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

async function waitBoardReady(page) {
  await page.waitForSelector("[data-category-list] tr, [data-category-empty]:not([hidden])", {
    timeout: 20000,
  });
  await page.waitForTimeout(400);
}

async function collectBoardHaystack(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-category-list]")?.closest("main") || document.body;
    return root.innerText || "";
  });
}

async function collectDetailLinks(page) {
  return page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll(
        '[data-category-list] a[href*="detail"], [data-business-mobile-list] a[href*="detail"]'
      )
    );
    return links.map((a) => ({
      href: a.getAttribute("href") || "",
      text: (a.textContent || "").trim(),
    }));
  });
}

async function main() {
  console.log(`\nbusiness.html field-service E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

  await page.goto(`${BASE}/business.html`, { waitUntil: "domcontentloaded" });
  await waitBoardReady(page);

  const haystack = await collectBoardHaystack(page);
  const links = await collectDetailLinks(page);

  let shopLeak = false;
  for (const pat of SHOP_LEAK_PATTERNS) {
    if (pat.test(haystack)) {
      fail("business一覧に店舗・販売が混在しない", `matched ${pat}`);
      shopLeak = true;
      break;
    }
  }
  if (!shopLeak) pass("business一覧に店舗・販売が混在しない");

  const shopDetailLinks = links.filter(
    (l) => /detail-shop\.html/i.test(l.href) || /demo-shop/i.test(l.href)
  );
  if (shopDetailLinks.length) {
    fail("一覧リンクが業務詳細のみ", shopDetailLinks.map((l) => l.href).join(", "));
  } else {
    pass("一覧リンクが業務詳細のみ");
  }

  if (haystack.includes(OTHER_TITLE)) {
    pass("business一覧にその他デモが表示される", OTHER_DEMO_ID);
  } else {
    fail("business一覧にその他デモが表示される", OTHER_TITLE);
  }

  const storeChip = page.locator('[data-business-category-nav] [data-biz-cat="store"]');
  if ((await storeChip.count()) > 0) {
    fail("店舗カテゴリチップがない");
  } else {
    pass("店舗カテゴリチップがない");
  }

  await page.locator('[data-business-category-nav] [data-biz-cat="other_business"]').click();
  await page.waitForTimeout(500);
  const filteredHay = await collectBoardHaystack(page);
  if (filteredHay.includes(OTHER_TITLE)) {
    pass("その他カテゴリフィルタでその他デモが表示される");
  } else {
    fail("その他カテゴリフィルタでその他デモが表示される");
  }

  await page.goto(`${BASE}/detail-business-service.html?id=${OTHER_DEMO_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 25000 }
  );
  const loaded = await page.evaluate(() => document.body.dataset.listingLoaded);
  if (loaded !== "true") {
    fail("詳細ページが開く", `listingLoaded=${loaded}`);
  } else {
    pass("詳細ページが開く");
  }

  const detailTitle = await page.evaluate(
    () =>
      document.querySelector(".biz-detail-hero__title, [data-biz-detail-title], h1")?.textContent?.trim() ||
      ""
  );
  if (detailTitle.includes("地域サポート")) {
    pass("詳細タイトル一致", detailTitle);
  } else {
    fail("詳細タイトル一致", detailTitle || "(empty)");
  }

  const consultBtn = page.locator(
    '[data-biz-detail-consult], [data-biz-detail-inquiry], a.biz-detail-cta--primary, button.biz-detail-cta--primary'
  ).first();
  if ((await consultBtn.count()) > 0) {
    pass("相談ボタンが存在する");
  } else {
    fail("相談ボタンが存在する");
  }

  const favBtn = page.locator("[data-biz-detail-favorite], [data-favorite-button]").first();
  if ((await favBtn.count()) > 0) {
    await favBtn.click();
    await page.waitForTimeout(300);
    pass("お気に入りボタン操作");
  } else {
    fail("お気に入りボタン操作");
  }

  const criticalErrors = consoleErrors.filter(
    (e) => !/favicon|Failed to load resource.*404/i.test(e)
  );
  if (criticalErrors.length) {
    fail("console error なし", criticalErrors.slice(0, 3).join(" | "));
  } else {
    pass("console error なし");
  }

    });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
