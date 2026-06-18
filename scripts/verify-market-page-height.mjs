/**
 * 市場ページ — フッター下の巨大余白がないこと（PC1280/1440・390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const ORDER_KEY = "tasu_market_order_history";

const PAGES = [
  { id: "product-detail", path: "detail-shop-product.html", search: `shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`, wait: "[data-tasful-product-main]" },
  { id: "search", path: "shop-search.html", search: "keyword=milk", wait: ".tasful-market-search-card, .tasful-market-search-empty" },
  { id: "order-history", path: "shop-market-order-history.html", wait: ".tasful-market-order-history-main", prep: "history1" },
  { id: "complete", path: "shop-market-complete.html", wait: ".tasful-market-complete-main" },
  { id: "listing-new", path: "shop-market-listing-new.html", wait: ".tasful-market-listing-main" },
  { id: "seller-products", path: "shop-market-seller-products.html", search: `shopId=${PRODUCT.shopId}`, wait: ".tasful-market-seller-products-main" },
  { id: "seller", path: "shop-market-seller.html", search: `shopId=${PRODUCT.shopId}`, wait: ".tasful-market-seller-main" },
  { id: "mypage", path: "shop-market-mypage.html", wait: ".tasful-market-mypage-main" },
  { id: "cart", path: "shop-market-cart.html", wait: ".tasful-market-cart-main" },
  { id: "checkout", path: "shop-market-checkout.html", wait: ".tasful-market-checkout-main", mobileMaxGap: 124 },
  { id: "top", path: "shop-store.html", wait: ".tasful-market-card, .tasful-market-pc-hero-full" },
  { id: "favorites", path: "shop-market-favorites.html", wait: ".tasful-market-catalog-main" },
  { id: "recent", path: "shop-market-recent.html", wait: ".tasful-market-catalog-main" },
];

const VIEWPORTS = [
  { label: "PC1280", w: 1280, h: 1280, maxGap: 2, maxStretch: 2 },
  { label: "PC1440", w: 1280, h: 1440, maxGap: 2, maxStretch: 2 },
  { label: "390", w: 390, h: 844, maxGap: 28, maxStretch: 2 },
];

function sampleOrder(i) {
  return {
    orderId: `ORD-H-${i}`,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    shopId: PRODUCT.shopId,
    productId: `p-${i}`,
    productName: `テスト商品 ${i}`,
    productImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200",
    quantity: 1,
    price: 1280,
    subtotal: 1280,
    paymentMethod: "クレジットカード",
    sellerName: "TASFUL Bakery",
    connectVerified: true,
    status: "注文受付",
    orderTotal: 1280,
    address: { name: "テスト", phone: "090", zip: "100-0001", address: "東京都" },
  };
}

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    if (pg.prep === "history1") {
      await page.addInitScript(
        ([key, data]) => localStorage.setItem(key, JSON.stringify(data)),
        [ORDER_KEY, [sampleOrder(1)]]
      );
    }
    const url = buildLocalPageUrl(base, pg.path, pg.search ? `?${pg.search}` : "");
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(pg.wait, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);

    const r = await page.evaluate(() => {
      const footer = document.querySelector(".tasful-market-footer");
      const bs = getComputedStyle(document.body);
      const fb = footer ? footer.getBoundingClientRect().bottom + window.scrollY : 0;
      const bh = document.body.offsetHeight;
      const pb = parseFloat(bs.paddingBottom) || 0;
      const forbidden = [];
      for (const sheet of [...document.styleSheets]) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules || []) {
          const text = rule.cssText || "";
          if (!/tasful-market|shop-market/.test(sheet.href || "") && !text.includes("tasful-market")) continue;
          if (/min-height:\s*100vh|height:\s*100vh|min-height:\s*calc\(\s*100vh/i.test(text)) {
            forbidden.push(text.slice(0, 120));
          }
        }
      }
      return {
        gapBelowFooter: Math.round(bh - fb),
        stretch: Math.round(bh - fb - pb),
        bodyMinH: bs.minHeight,
        bodyPadB: bs.paddingBottom,
        hasFooter: Boolean(footer),
        forbiddenCount: forbidden.length,
      };
    });

    const maxGap = vp.label === "390" && pg.mobileMaxGap ? pg.mobileMaxGap : vp.maxGap;
    const ok =
      r.hasFooter &&
      r.gapBelowFooter <= maxGap &&
      r.stretch <= vp.maxStretch &&
      r.bodyMinH !== `${vp.h}px` &&
      parseFloat(r.bodyMinH) !== vp.h;

    results.push({ page: pg.id, viewport: vp.label, ok, ...r });
    console.log(`${ok ? "PASS" : "FAIL"} ${pg.id} @ ${vp.label} gap=${r.gapBelowFooter} stretch=${r.stretch} minH=${r.bodyMinH}`);
    await page.close();
  }
}

await browser.close();

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error("\nFailed:", failed.length);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed.`);
