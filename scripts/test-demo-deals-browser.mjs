#!/usr/bin/env node
/**
 * 取引管理デモ — ブラウザ自動確認 (Playwright)
 *
 * dashboard / my-listings からサイドバー遷移、件数、ボタン、localStorage を検証。
 *
 * 事前: npm run dev（別ターミナル）または BASE_URL を指定
 *   node scripts/test-demo-deals-browser.mjs
 *   MOBILE=1 node scripts/test-demo-deals-browser.mjs   # 390px
 *   BASE_URL=http://127.0.0.1:5188 node scripts/test-demo-deals-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5188").replace(/\/$/, "");
const MOBILE = process.env.MOBILE === "1" || process.env.MOBILE === "true";
const VIEWPORT = MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const STORAGE_KEY = "tasful_demo_unpaid_paid_ids";

const PAGES = [
  {
    name: "進行中の取引",
    linkText: "進行中の取引",
    expectedCount: 3,
    url: "demo-progress.html",
  },
  {
    name: "完了した取引",
    linkText: "完了した取引",
    expectedCount: 3,
    url: "demo-complete.html",
  },
  {
    name: "手数料未払い",
    linkText: "手数料未払い",
    expectedCount: 2,
    url: "demo-unpaid.html",
  },
  {
    name: "支払い済み履歴",
    linkText: "支払い済み履歴",
    expectedCount: 2,
    url: "demo-paid.html",
  },
];

const ENTRY_POINTS = [
  { label: "dashboard", path: "/dashboard.html" },
  { label: "my-listings", path: "/my-listings.html" },
];

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

async function waitForDemoCards(page, expected) {
  await page.waitForSelector("[data-demo-deals-list]", { timeout: 20000 });
  await page.waitForFunction(
    (n) => document.querySelectorAll(".demo-deal-card").length === n,
    expected,
    { timeout: 30000 }
  );
}

async function acceptNextDialog(page) {
  return page.waitForEvent("dialog", { timeout: 10000 }).then(async (d) => {
    await d.accept();
    return d.message();
  });
}

async function sidebarNavigate(page, linkText) {
  const link = page.locator("#dashSidebarNav a.dash-nav-link").filter({ hasText: linkText });
  await link.first().waitFor({ state: "visible", timeout: 10000 });
  await Promise.all([
    page.waitForURL(/demo-(progress|complete|unpaid|paid)\.html/, { timeout: 15000 }),
    link.first().click(),
  ]);
}

async function testSidebarFromEntry(page, entry) {
  console.log(`\n=== エントリ: ${entry.label} ===`);
  await page.goto(`${BASE}${entry.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#dashSidebarNav", { timeout: 15000 });

  for (const spec of PAGES) {
    if (spec.url === "demo-unpaid.html") continue;

    const step = `${entry.label} → ${spec.name}（サイドバー）`;
    try {
      if (entry.label !== "dashboard" || spec.url !== "demo-progress.html") {
        await page.goto(`${BASE}${entry.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#dashSidebarNav");
      }
      await sidebarNavigate(page, spec.linkText);
      await waitForDemoCards(page, spec.expectedCount);
      const count = await page.locator(".demo-deal-card").count();
      if (count === spec.expectedCount) {
        pass(step, `${count}件`);
      } else {
        fail(step, `件数 ${count}（期待 ${spec.expectedCount}）`);
      }
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }
}

async function testPageContent(page) {
  console.log("\n=== ページ内容・ボタン動作 ===");

  // 進行中 — 完了報告アラート
  {
    const step = "進行中: 完了報告アラート";
    try {
      await page.goto(`${BASE}/demo-progress.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForDemoCards(page, 3);
      const msgPromise = acceptNextDialog(page);
      await page.locator("[data-demo-complete-report]").first().click();
      const msg = await msgPromise;
      if (/完了報告/.test(msg)) pass(step, msg.slice(0, 40));
      else fail(step, `メッセージ: ${msg}`);
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }

  // 完了 — 評価アラート
  {
    const step = "完了: 評価するアラート";
    try {
      await page.goto(`${BASE}/demo-complete.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForDemoCards(page, 3);
      const ratePromise = acceptNextDialog(page);
      await page.locator("[data-demo-rate]").first().click();
      await ratePromise;
      pass(step);
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }

  // 支払済 — 領収書モーダル
  {
    const step = "支払済: 領収書モーダル";
    try {
      await page.goto(`${BASE}/demo-paid.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForDemoCards(page, 2);
      await page.locator("[data-demo-receipt]").first().click();
      const modal = page.locator("[data-demo-receipt-modal]");
      await modal.waitFor({ state: "visible", timeout: 5000 });
      const title = await page.locator("#demoReceiptTitle").textContent();
      if (title?.includes("ダミー領収書")) pass(step, title.trim());
      else fail(step, `title=${title}`);
      await page.locator("button.demo-deals-modal__close").click();
      await modal.waitFor({ state: "hidden", timeout: 5000 });
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }

  // 未払い — localStorage & 件数減少 & バッジ
  {
    const step = "未払い: 支払い→localStorage→件数更新";
    try {
      await page.goto(`${BASE}/demo-unpaid.html`, { waitUntil: "domcontentloaded" });
      await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForDemoCards(page, 2);

      let badgeBefore = await page
        .locator('#dashSidebarNav a.dash-nav-link')
        .filter({ hasText: "手数料未払い" })
        .locator(".dash-nav-badge")
        .textContent()
        .catch(() => null);

      page.once("dialog", (d) => d.accept());
      await page.locator("[data-demo-pay]").first().click();
      await page.waitForFunction(
        () => document.querySelectorAll(".demo-deal-card").length === 1,
        null,
        { timeout: 8000 }
      );

      const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const count = await page.locator(".demo-deal-card").count();

      if (!Array.isArray(parsed) || parsed.length !== 1) {
        fail(step, `localStorage=${stored}`);
      } else if (count !== 1) {
        fail(step, `残件数=${count}`);
      } else {
        pass(step, `localStorage=${stored}, 残1件`);
      }

      const badgeAfter = await page
        .locator('#dashSidebarNav a.dash-nav-link')
        .filter({ hasText: "手数料未払い" })
        .locator(".dash-nav-badge")
        .textContent()
        .catch(() => null);
      if (badgeAfter === "1") {
        pass("未払い: サイドバーバッジ更新", badgeAfter);
      } else if (badgeBefore === "2" && badgeAfter !== badgeBefore) {
        pass("未払い: サイドバーバッジ更新", `${badgeBefore}→${badgeAfter}`);
      }
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }

  // 詳細リンク deal-detail.html
  {
    const step = "進行中: カードが deal-detail へリンク";
    try {
      await page.goto(`${BASE}/demo-progress.html`, { waitUntil: "domcontentloaded" });
      await waitForDemoCards(page, 3);
      const href = await page.locator("a.demo-progress-deal-card").first().getAttribute("href");
      if (href && /deal-detail\.html\?id=progress_demo_/.test(href)) pass(step, href);
      else fail(step, `href=${href}`);
    } catch (err) {
      fail(step, String(err.message || err));
    }
  }
}

async function main() {
  console.log(`test-demo-deals-browser  BASE=${BASE}  viewport=${VIEWPORT.width}x${VIEWPORT.height}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error("Playwright 起動失敗。npx playwright install chromium を実行してください。");
    console.error(err);
    process.exit(1);
  }

  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));

  try {
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: "domcontentloaded", timeout: 8000 });
  } catch {
    console.error(`\nサーバーに接続できません: ${BASE}`);
    console.error("別ターミナルで npm run dev を起動してから再実行してください。");
    await browser.close();
    process.exit(1);
  }

  for (const entry of ENTRY_POINTS) {
    await testSidebarFromEntry(page, entry);
  }

  await testPageContent(page);

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - failed.length}/${results.length} OK ---`);
  if (pageErrors.length) {
    console.warn("pageerror:", pageErrors.slice(0, 5));
  }

  if (failed.length) {
    console.error("\ntest-demo-deals-browser FAILED:");
    for (const r of failed) console.error(`  - ${r.step}: ${r.detail}`);
    process.exit(1);
  }

  console.log("\ntest-demo-deals-browser OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
