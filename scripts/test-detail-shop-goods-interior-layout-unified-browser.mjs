#!/usr/bin/env node
/**
 * 店舗・販売詳細 — 雑貨・インテリア（lumiere）土台レイアウト統一 E2E
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/test-detail-shop-goods-interior-layout-unified-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const REF_ID = "demo-shop-lumiere";

const TARGETS = [
  { id: REF_ID, label: "lumiere (基準)" },
  { id: "demo-shop-haru-cafe", label: "飲食" },
  { id: "demo-shop-reworks", label: "工具" },
  { id: "demo-shop-marche-vert", label: "雑貨" },
  { id: "demo-shop-flower-atelier", label: "花屋" },
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

async function measureLayout(page) {
  return page.evaluate(() => {
    const fv = document.querySelector(".biz-detail-fv");
    const pointsHost = document.querySelector(
      ".shop-hero-right [data-shop-restaurant-points]:not([hidden])"
    );
    const points = document.querySelector(
      ".shop-hero-right .retail-points, .shop-hero-right .shop-restaurant-points:not([hidden])"
    );
    const products = document.getElementById("section-products");
    const sticky = document.querySelector("[data-shop-sticky-action-nav]");
    if (!fv) return { error: "no fv" };
    const fvStyle = getComputedStyle(fv);
    const fvBox = fv.getBoundingClientRect();
    const pointsBox = points?.getBoundingClientRect();
    const prodBox = products?.getBoundingClientRect();
    return {
      profile: document.body.dataset.shopCategoryProfile || "",
      layout: document.body.dataset.shopLayout || "",
      retailTopFv: fv.classList.contains("retail-top-fv"),
      foodTopFv: fv.classList.contains("food-top-fv"),
      display: fvStyle.display,
      gridCols: fvStyle.gridTemplateColumns,
      gap: fvStyle.gap,
      padding: fvStyle.padding,
      pointsVisible: Boolean(pointsHost && !pointsHost.hidden),
      pointsRight: pointsBox ? Math.round(pointsBox.right) : null,
      pointsLeft: pointsBox ? Math.round(pointsBox.left) : null,
      fvRight: Math.round(fvBox.right),
      productsTop: prodBox ? Math.round(prodBox.top) : null,
      stickyTabCount: sticky
        ? document.querySelectorAll("[data-shop-action-tab]").length
        : 0,
    };
  });
}

async function main() {
  console.log(`\n店舗詳細 雑貨・インテリア土台統一 — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${BASE}/detail-shop.html?id=${REF_ID}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await page.waitForTimeout(400);
  const ref = await measureLayout(page);

  if (ref.profile === "goods_interior" && ref.layout === "goods_interior") {
    pass("基準: CSSプロファイル goods_interior");
  } else {
    fail("基準: CSSプロファイル", `profile=${ref.profile} layout=${ref.layout}`);
  }
  if (ref.retailTopFv && !ref.foodTopFv) pass("基準: retail-top-fv");
  else fail("基準: retail-top-fv", `retail=${ref.retailTopFv} food=${ref.foodTopFv}`);
  if (ref.display === "grid") pass("基準: ヒーロー display grid", ref.gridCols);
  else fail("基準: ヒーロー display", ref.display);

  for (const { id, label } of TARGETS) {
    if (id === REF_ID) continue;
    await page.goto(`${BASE}/detail-shop.html?id=${id}`, { waitUntil: "domcontentloaded" });
    await waitShopLoaded(page);
    await page.waitForTimeout(400);
    const m = await measureLayout(page);

    if (m.retailTopFv && !m.foodTopFv) pass(`${label}: retail-top-fv`);
    else fail(`${label}: retail-top-fv`, `retail=${m.retailTopFv} food=${m.foodTopFv}`);

    if (m.profile === "goods_interior" && m.layout === "goods_interior") {
      pass(`${label}: CSSプロファイル goods_interior`);
    } else {
      fail(`${label}: CSSプロファイル`, `profile=${m.profile} layout=${m.layout}`);
    }

    if (m.display === ref.display) pass(`${label}: ヒーロー display`, m.display);
    else fail(`${label}: ヒーロー display`, `${m.display} vs ${ref.display}`);

    if (m.gridCols === ref.gridCols) pass(`${label}: grid-template-columns 一致`);
    else fail(`${label}: grid-template-columns`, `${m.gridCols} vs ${ref.gridCols}`);

    if (m.gap === ref.gap) pass(`${label}: gap 一致`, m.gap);
    else fail(`${label}: gap`, `${m.gap} vs ${ref.gap}`);

    if (m.padding === ref.padding) pass(`${label}: padding 一致`);
    else fail(`${label}: padding`, `${m.padding} vs ${ref.padding}`);

    if (m.pointsVisible) {
      const drift =
        ref.pointsLeft != null && m.pointsLeft != null
          ? Math.abs(m.pointsLeft - ref.pointsLeft)
          : 0;
      if (drift <= 48) pass(`${label}: こだわり横位置`, `Δ${drift}px`);
      else fail(`${label}: こだわり横位置`, `Δ${drift}px (ref ${ref.pointsLeft} vs ${m.pointsLeft})`);
    } else {
      pass(`${label}: こだわりなし（データなし）`);
    }

    if (
      ref.productsTop != null &&
      m.productsTop != null &&
      Math.abs(m.productsTop - ref.productsTop) <= 80
    ) {
      pass(`${label}: 商品セクション縦位置`, `Δ${Math.abs(m.productsTop - ref.productsTop)}px`);
    } else if (m.productsTop != null) {
      fail(`${label}: 商品セクション縦位置`, `ref=${ref.productsTop} cur=${m.productsTop}`);
    }

    if (m.stickyTabCount >= 3) pass(`${label}: タブ追従バー`, `${m.stickyTabCount} tabs`);
    else fail(`${label}: タブ追従バー`, `${m.stickyTabCount}`);
  }

    });
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
