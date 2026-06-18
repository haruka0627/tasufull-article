/**
 * 市場ページ横断 — shop-market-pc.css 追加影響確認（390px / 1280px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-cross-check");
const CART_KEY = "tasu_market_cart_count";
const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };

const PAGES = [
  {
    id: "top",
    path: "shop-store.html",
    group: "TOP",
    wait: ".tasful-market-card",
    hasTabbar: true,
    pc: { shellMax: "1240px", tabbarHidden: true, extra: "topPcHero" },
  },
  {
    id: "search",
    path: "shop-search.html",
    group: "検索",
    wait: ".tasful-market-search-card",
    hasTabbar: false,
    pc: { shellMax: "1240px", tabbarHidden: true, extra: "searchGrid4" },
  },
  {
    id: "product-detail",
    path: "detail-shop-product.html",
    search: `shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`,
    group: "商品詳細",
    wait: "[data-tasful-product-main]",
    hasTabbar: false,
    pc: { productHeroGrid: true, tabbarHidden: true },
  },
  {
    id: "cart",
    path: "shop-market-cart.html",
    group: "カート",
    wait: ".tasful-market-cart-main",
    hasTabbar: false,
    prep: async (page) => {
      await page.evaluate(
        ({ key, shopId, productId }) => {
          localStorage.setItem(key, "2");
          const raw = localStorage.getItem("tasu_market_cart");
          if (!raw || raw === "[]") {
            localStorage.setItem(
              "tasu_market_cart",
              JSON.stringify([{ shopId, productId, quantity: 2 }])
            );
          }
        },
        { key: CART_KEY, ...PRODUCT }
      );
    },
    pc: { cartLayout2Col: true, tabbarHidden: true },
  },
  {
    id: "order-history",
    path: "shop-market-order-history.html",
    group: "注文履歴",
    wait: ".tasful-market-order-history-main",
    hasTabbar: false,
    pc: { readMax: "960px", tabbarHidden: true },
  },
  {
    id: "checkout",
    path: "shop-market-checkout.html",
    search: `mode=buyNow&shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}&quantity=1`,
    group: "購入フロー",
    wait: "[data-tasful-checkout-layout]",
    hasTabbar: false,
    pc: { checkoutAside: true, readMax: "960px" },
  },
  {
    id: "complete",
    path: "shop-market-complete.html",
    group: "購入フロー",
    wait: ".tasful-market-complete-card",
    hasTabbar: false,
    pc: { readMax: "960px" },
  },
  {
    id: "seller-orders",
    path: "shop-market-seller-orders.html",
    search: `shopId=${PRODUCT.shopId}`,
    group: "出品者注文管理",
    wait: ".tasful-market-seller-orders-main",
    hasTabbar: false,
    pc: { sellerOrders2Col: true, tabbarHidden: true },
  },
  {
    id: "mypage",
    path: "shop-market-mypage.html",
    group: "その他市場",
    wait: ".tasful-market-mypage-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "seller",
    path: "shop-market-seller.html",
    search: `shopId=${PRODUCT.shopId}`,
    group: "その他市場",
    wait: ".tasful-market-seller-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "favorites",
    path: "shop-market-favorites.html",
    group: "その他市場",
    wait: ".tasful-market-catalog-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "recent",
    path: "shop-market-recent.html",
    group: "その他市場",
    wait: ".tasful-market-catalog-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "following",
    path: "shop-market-following.html",
    group: "その他市場",
    wait: ".tasful-market-catalog-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "listing-new",
    path: "shop-market-listing-new.html",
    group: "その他市場",
    wait: ".tasful-market-listing-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
  {
    id: "seller-products",
    path: "shop-market-seller-products.html",
    search: `shopId=${PRODUCT.shopId}`,
    group: "その他市場",
    wait: ".tasful-market-seller-products-main",
    hasTabbar: false,
    pc: { tabbarHidden: true },
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

function auditPage(viewport) {
  return page.evaluate((vp) => {
    const tabbar = document.querySelector(".tasful-market-tabbar");
    const footer = document.querySelector(".tasful-market-footer");
    const footerInner = document.querySelector(".tasful-market-footer__inner");
    const shell = document.querySelector(".tasful-market-shell, .tasful-market-search-shell");
    const cartLayout = document.querySelector(".tasful-market-cart-layout");
    const checkoutLayout = document.querySelector(".tasful-market-checkout-layout");
    const checkoutAside = document.querySelector(".tasful-market-checkout-bar--aside");
    const checkoutAsideBtn = checkoutAside
      ? getComputedStyle(checkoutAside).display
      : "";
    const productHero = document.querySelector(".tasful-market-product-hero");
    const topGrid = document.querySelector(".tasful-market-grid");
    const pcHero = document.querySelector(".tasful-market-pc-hero-full");
    const pcQuad = document.querySelector(".tasful-market-pc-quad-stage");
    const mobileTop = document.querySelector(".tasful-market-mobile-top");
    const searchGrid = document.querySelector(".tasful-market-search-grid");
    const sellerList = document.querySelector(".tasful-market-seller-orders-list");
    const historyMain = document.querySelector(".tasful-market-order-history-main");
    const completeMain = document.querySelector(".tasful-market-complete-main");
    const scrollCard = document.querySelector(
      ".tasful-market-mobile-top .tasful-market-scroll .tasful-market-card, .tasful-market-pc-strip .tasful-market-scroll .tasful-market-card"
    );
    const title = document.querySelector(".tasful-market-card__title");

    let tabbarOverlap = false;
    if (tabbar && footer) {
      const tabRect = tabbar.getBoundingClientRect();
      const copy = document.querySelector(".tasful-market-footer__copy") || footer;
      const copyRect = copy.getBoundingClientRect();
      tabbarOverlap = copyRect.bottom > tabRect.top - 4;
    }

    const readMain = historyMain || completeMain || document.querySelector(".tasful-market-checkout-main");
    const cartLayoutCols = cartLayout ? getComputedStyle(cartLayout).gridTemplateColumns : "";
    const productHeroCols = productHero ? getComputedStyle(productHero).gridTemplateColumns : "";
    const sellerListCols = sellerList ? getComputedStyle(sellerList).gridTemplateColumns : "";
    const topGridCols = topGrid ? getComputedStyle(topGrid).gridTemplateColumns : "";
    const searchGridCols = searchGrid ? getComputedStyle(searchGrid).gridTemplateColumns : "";

    return {
      viewport: vp,
      href: window.location.href,
      hasTabbarEl: Boolean(tabbar),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      hasPcCss: [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) =>
        (l.getAttribute("href") || "").includes("shop-market-pc.css")
      ),
      tabbarDisplay: tabbar ? getComputedStyle(tabbar).display : "none",
      bodyPadBottom: Math.round(parseFloat(getComputedStyle(document.body).paddingBottom) || 0),
      footerPadBottom: footerInner
        ? Math.round(parseFloat(getComputedStyle(footerInner).paddingBottom) || 0)
        : footer
          ? Math.round(parseFloat(getComputedStyle(footer).paddingBottom) || 0)
          : null,
      tabbarOverlap,
      shellMaxWidth: shell ? getComputedStyle(shell).maxWidth : "",
      readMainMaxWidth: readMain ? getComputedStyle(readMain).maxWidth : "",
      cartLayout2Col: cartLayoutCols.includes(" ") && !cartLayoutCols.startsWith("none"),
      checkoutAsideVisible: checkoutAsideBtn !== "none" && checkoutAsideBtn !== "",
      productHero2Col: productHeroCols.includes(" ") && productHeroCols !== "none",
      sellerList2Col: sellerListCols.split(" ").filter(Boolean).length >= 2,
      topGrid3Col: topGridCols.split(" ").filter(Boolean).length >= 3,
      topGrid4Col: topGridCols.split(" ").filter(Boolean).length >= 4,
      hasPcHero: Boolean(pcHero),
      hasPcQuad: Boolean(pcQuad),
      mobileTopHidden: mobileTop ? getComputedStyle(mobileTop).display === "none" : false,
      searchGrid3Plus: searchGridCols.split(" ").filter(Boolean).length >= 3,
      scrollCardWidth: scrollCard ? Math.round(scrollCard.getBoundingClientRect().width) : null,
      cardTitleWeight: title ? getComputedStyle(title).fontWeight : null,
      stackMaxWidth: document.querySelector(".tasful-market-mall-header__stack")
        ? getComputedStyle(document.querySelector(".tasful-market-mall-header__stack")).maxWidth
        : "",
    };
  }, viewport);
}

function checkMobile(audit, spec) {
  const errors = [];
  if (!audit.noHorizontalOverflow) errors.push("horizontal_overflow");
  if (!audit.hasPcCss) errors.push("missing_pc_css_link");
  if (spec.hasTabbar && audit.hasTabbarEl) {
    if (audit.tabbarDisplay === "none") errors.push("pc_tabbar_leak_at_390");
    if (audit.tabbarOverlap) errors.push("tabbar_footer_overlap");
    if ((audit.footerPadBottom ?? 0) < 60) errors.push("footer_tabbar_padding_low");
  }
  if (spec.id === "top" && audit.topGrid4Col) errors.push("pc_grid_leak_at_390");
  if (spec.id === "top" && parseInt(audit.cardTitleWeight, 10) >= 700) {
    errors.push("pc_title_weight_leak_at_390");
  }
  if (audit.stackMaxWidth === "1600px") errors.push("pc_header_max_leak_at_390");
  return errors;
}

function checkPc(audit, spec) {
  const errors = [];
  if (!audit.noHorizontalOverflow) errors.push("horizontal_overflow");
  if (!audit.hasPcCss) errors.push("missing_pc_css_link");
  if (spec.pc?.tabbarHidden && audit.hasTabbarEl && audit.tabbarDisplay !== "none") {
    errors.push("tabbar_not_hidden");
  }
  if (spec.pc?.shellMax && (spec.id === "top" || spec.id === "search") && audit.shellMaxWidth !== spec.pc.shellMax) {
    errors.push(`shell_max_${audit.shellMaxWidth}`);
  }
  if (spec.pc?.readMax && audit.readMainMaxWidth !== spec.pc.readMax) {
    errors.push(`read_max_${audit.readMainMaxWidth || "none"}`);
  }
  if (spec.pc?.cartLayout2Col && !audit.cartLayout2Col) errors.push("cart_not_2col");
  if (spec.pc?.checkoutAside && !audit.checkoutAsideVisible) errors.push("checkout_aside_hidden");
  if (spec.pc?.productHeroGrid && !audit.productHero2Col) errors.push("product_hero_not_2col");
  if (spec.pc?.sellerOrders2Col && !audit.sellerList2Col) errors.push("seller_orders_not_2col");
  if (spec.pc?.extra === "topPcHero" && !audit.hasPcHero) errors.push("top_pc_hero_missing");
  if (spec.pc?.extra === "topPcHero" && !audit.hasPcQuad) errors.push("top_pc_quad_missing");
  if (spec.pc?.extra === "topPcHero" && !audit.mobileTopHidden) errors.push("mobile_top_not_hidden");
  if (spec.pc?.extra === "searchGrid4" && !audit.searchGrid3Plus) errors.push("search_grid_not_multi");
  if (audit.stackMaxWidth !== "1600px") errors.push(`header_stack_${audit.stackMaxWidth}`);
  return errors;
}

for (const spec of PAGES) {
  const url = buildLocalPageUrl(base, spec.path, spec.search || "");
  const entry = { id: spec.id, group: spec.group, url, mobile: null, pc: null, pass: false };
  let loadFailed = false;

  for (const [vpName, size] of [
    ["390", { width: 390, height: 844 }],
    ["1280", { width: 1280, height: 900 }],
  ]) {
    if (loadFailed) break;
    await page.setViewportSize(size);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await assertPlaywrightLocalhostPage(page);
    } catch {
      loadFailed = true;
      entry.mobile = { pass: false, errors: ["page_load_failed"] };
      entry.pc = { pass: false, errors: ["page_load_failed"] };
      break;
    }
    if (spec.prep && vpName === "390") await spec.prep(page);
    if (vpName === "390" && spec.id === "complete") {
      await page.evaluate(() => {
        sessionStorage.setItem(
          "tasu_market_last_order",
          JSON.stringify({ orderId: "TM-TEST", total: 480, items: [] })
        );
      });
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await page.waitForSelector(spec.wait, { timeout: 20000 }).catch(() => {});
    if (vpName === "390" && spec.hasTabbar) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(400);
    const audit = await auditPage(vpName);
    const errors = vpName === "390" ? checkMobile(audit, spec) : checkPc(audit, spec);
    const shot = `${spec.id}-${vpName}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, shot), fullPage: false });
    const row = { ...audit, errors, pass: errors.length === 0, screenshot: shot };
    if (vpName === "390") entry.mobile = row;
    else entry.pc = row;
  }

  entry.pass = entry.mobile?.pass && entry.pc?.pass;
  results.push(entry);
}

await browser.close();

const passCount = results.filter((r) => r.pass).length;
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  passCount,
  failCount: results.length - passCount,
  overallPass: passCount === results.length,
  results,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.overallPass ? 0 : 1);
