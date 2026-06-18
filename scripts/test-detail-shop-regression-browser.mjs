#!/usr/bin/env node
/**
 * 店舗詳細 カテゴリ回帰 + レイアウト E2E
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/test-detail-shop-regression-browser.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "..", "screenshots", "detail-shop-regression");

const SHOP_CASES = [
  { id: "demo-shop-haru-cafe", label: "飲食", expectPoints: true },
  { id: "demo-shop-reworks", label: "工具", expectPoints: true },
  { id: "demo-shop-bloom", label: "bloom" },
  { id: "demo-shop-marche-vert", label: "雑貨" },
  { id: "demo-shop-flower-atelier", label: "花屋", expectPoints: true },
  {
    id: "shop-store-demo-other-001",
    label: "その他",
    expectRetailNav: true,
  },
];

const SECTION_IDS = [
  "section-shop-overview",
  "section-shop-handling-info",
  "section-products",
  "section-shop-cases",
  "section-shop-highlights",
  "section-shop-bottom",
  "section-reviews",
  "section-faq",
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

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 20000 }
  );
}

async function inspectShop(page, spec, viewport) {
  const vp = viewport.width >= 1000 ? "pc" : "sp";
  console.log(`\n--- ${spec.label} (${spec.id}) [${vp}] ---\n`);
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/detail-shop.html?id=${spec.id}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await page.waitForTimeout(200);

  const loadState = await page.evaluate(() => document.body.dataset.listingLoaded);
  if (loadState === "error") {
    fail(`${vp}/${spec.label}: 読み込み`, "error");
    return;
  }

  const data = await page.evaluate((ids) => {
    const hero = document.querySelector(".shop-hero, .biz-detail-fv.shop-hero");
    const heroRect = hero?.getBoundingClientRect();
    const points = document.querySelector("[data-shop-restaurant-points]");
    const pointsRect = points?.getBoundingClientRect();
    const main = document.querySelector(".shop-hero-main, .biz-detail-fv__main");
    const anchor =
      main?.querySelector("[data-biz-detail-hero-genre-tags]:not([hidden])") ||
      main?.querySelector("[data-biz-detail-title]");
    const sections = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, missing: true };
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || "").replace(/\s+/g, "").trim();
      const hasCard = Boolean(
        el.querySelector(
          "img, article, .food-menu-card, .shop-prod-card, details.shop-faq-item, .food-info-row, .retail-news__item"
        )
      );
      return {
        id,
        hidden: el.hidden,
        isHidden: el.classList.contains("is-hidden"),
        display: style.display,
        height: Math.round(rect.height),
        textLen: text.length,
        hasCard,
      };
    });
    const tabs = Array.from(document.querySelectorAll("[data-shop-action-tab]")).map((el) =>
      el.textContent?.trim()
    );
    return {
      loaded: document.body.dataset.listingLoaded,
      tabs,
      sections,
      heroOverflow:
        heroRect && pointsRect && !points?.hidden
          ? Math.max(
              Math.round(pointsRect.right - heroRect.right),
              Math.round(heroRect.left - pointsRect.left)
            )
          : 0,
      pointsWidth: pointsRect ? Math.round(pointsRect.width) : 0,
      heroWidth: heroRect ? Math.round(heroRect.width) : 0,
      pointsTop: pointsRect && !points.hidden ? Math.round(pointsRect.top) : null,
      anchorTop: anchor ? Math.round(anchor.getBoundingClientRect().top) : null,
      pointsHidden: points?.hidden,
    };
  }, SECTION_IDS);

  if (data.loaded !== "true") {
    fail(`${vp}/${spec.label}: 読み込み`);
    return;
  }

  pass(`${vp}/${spec.label}: 詳細表示`);

  if (spec.expectOverview) {
    if (data.tabs.includes("概要") && data.tabs.includes("取扱情報")) {
      pass(`${vp}/${spec.label}: その他タブ`);
    } else fail(`${vp}/${spec.label}: その他タブ`, data.tabs.join(", "));
  } else if (!data.tabs.includes("概要") && !data.tabs.includes("取扱情報")) {
    pass(`${vp}/${spec.label}: 概要/取扱タブなし`);
  } else {
    fail(`${vp}/${spec.label}: 概要/取扱タブなし`, data.tabs.join(", "));
  }

  if (spec.expectRetailNav) {
    const retailTabs = ["商品", "アクセス", "口コミ"];
    const ok = retailTabs.every((t) => data.tabs.some((tab) => tab.includes(t)));
    if (ok) pass(`${vp}/${spec.label}: 小売系タブ`, data.tabs.join(", "));
    else fail(`${vp}/${spec.label}: 小売系タブ`, data.tabs.join(", "));
  }

  for (const s of data.sections) {
    if (s.missing) continue;
    const visible = !s.hidden && s.display !== "none" && s.height > 8;
    const shouldHide =
      (s.id === "section-shop-overview" && !spec.expectOverview) ||
      (s.id === "section-shop-handling-info" && !spec.expectOverview) ||
      (s.id === "section-products" && spec.skipProducts);
    const hasBody = s.hasCard || s.textLen > 24;

    if (shouldHide && visible) {
      fail(`${vp}/${spec.label}: ${s.id} 非表示`, `h=${s.height}`);
    } else if (shouldHide && !visible) {
      pass(`${vp}/${spec.label}: ${s.id} 非表示`);
    } else if (!visible || s.height <= 8) {
      pass(`${vp}/${spec.label}: ${s.id} 空枠なし`);
    } else if (visible && hasBody) {
      pass(`${vp}/${spec.label}: ${s.id} 表示`);
    } else if (visible) {
      fail(`${vp}/${spec.label}: ${s.id} 空枠`, `h=${s.height}`);
    }
  }

  if (
    spec.expectPoints &&
    viewport.width >= 1000 &&
    data.pointsTop != null &&
    data.anchorTop != null &&
    !data.pointsHidden
  ) {
    const delta = data.pointsTop - data.anchorTop;
    if (delta >= -8 && delta <= 16) pass(`${vp}/${spec.label}: こだわり位置`, `Δ=${delta}px`);
    else fail(`${vp}/${spec.label}: こだわり位置`, `Δ=${delta}px`);
  }

  if (viewport.width >= 1000 && spec.expectPoints) {
    if (data.heroOverflow > 2) {
      fail(
        `${vp}/${spec.label}: ヒーローはみ出し`,
        `${data.heroOverflow}px (hero=${data.heroWidth} card=${data.pointsWidth})`
      );
    } else {
      pass(`${vp}/${spec.label}: ヒーロー内収まり`, `card=${data.pointsWidth}px`);
    }
  }

  const shotName =
    spec.id === "demo-shop-flower-atelier"
      ? `flower-atelier-${vp}`
      : spec.id === "demo-shop-reworks"
        ? `reworks-${vp}`
        : spec.id === "shop-store-demo-other-001"
          ? `other-001-${vp}`
          : null;
  if (shotName) {
    await mkdir(SHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SHOT_DIR, `${shotName}.png`),
      fullPage: false,
    });
  }
}

async function test404(page) {
  console.log("\n--- 不明ID (not-found-shop) ---\n");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/detail-shop.html?id=not-found-shop`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  const data = await page.evaluate(() => ({
    loaded: document.body.dataset.listingLoaded,
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    status: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
  }));
  if (data.loaded === "error" && data.rootHidden && /見つかりません/.test(data.status)) {
    pass("404: 表示");
  } else {
    fail("404: 表示", JSON.stringify(data));
  }
  if (!data.title.includes("地域セレクト")) pass("404: その他デモへフォールバックなし");
  else fail("404: その他デモへフォールバックなし", data.title);
}

async function main() {
  console.log(`\n店舗詳細 回帰 E2E — ${BASE}\n`);
  await mkdir(SHOT_DIR, { recursive: true });
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|404|supabase/i.test(m.text())) {
      consoleErrors.push(m.text());
    }
  });

  for (const spec of SHOP_CASES) {
    await inspectShop(page, spec, { width: 1280, height: 900 });
    await inspectShop(page, spec, { width: 390, height: 844 });
  }
  await test404(page);

  if (consoleErrors.length) fail("console", consoleErrors.slice(0, 2).join(" | "));
  else pass("console エラーなし");

    });
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---`);
  console.log(`スクショ: ${SHOT_DIR}\n`);
  await closeAllBrowsers();
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
