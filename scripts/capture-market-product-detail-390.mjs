/**
 * TASFUL市場 商品詳細 — 390px 検証（localhost 必須）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-product-detail-390");
const CART_KEY = "tasu_market_cart_count";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-search.html" });
const searchUrl = buildLocalPageUrl(base, "shop-search.html");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-search-card", { timeout: 15000 });

const cardMeta = await page.evaluate(() => {
  const card = document.querySelector(".tasful-market-search-card");
  const title = card?.querySelector(".tasful-market-search-card__title")?.textContent?.trim() || "";
  const link = card?.querySelector(".tasful-market-search-card__link")?.getAttribute("href") || "";
  return { title, link };
});

if (!cardMeta.link) {
  console.log(JSON.stringify({ pass: false, reason: "no-card-link", cardMeta }, null, 2));
  await browser.close();
  process.exit(1);
}

const detailPath = cardMeta.link.replace(/^\//, "");
await page.goto(buildLocalPageUrl(base, detailPath), { waitUntil: "domcontentloaded", timeout: 15000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 15000 });
await page.waitForFunction(
  () => {
    const img = document.querySelector("[data-tasful-product-image]");
    return Boolean(img?.src) && img.complete && img.naturalWidth > 0;
  },
  { timeout: 15000 }
);
await page.waitForTimeout(300);

const mainSrcBeforeThumb = await page.evaluate(
  () => document.querySelector("[data-tasful-product-image]")?.src || ""
);
const secondThumb = page.locator("[data-tasful-product-thumb='1']");
if (await secondThumb.count()) {
  await secondThumb.click();
  await page.waitForTimeout(200);
}
const thumbSwitchOk = await page.evaluate((before) => {
  const after = document.querySelector("[data-tasful-product-image]")?.src || "";
  return Boolean(after) && after !== before;
}, mainSrcBeforeThumb);

const report = await page.evaluate((searchTitle) => {
  const header = document.querySelector("[data-tasful-market-header]");
  const stack = document.querySelector(".tasful-market-mall-header__stack");
  const nav = document.querySelector(".tasful-market-mall-header__nav");
  const headerHeight = Math.max(
    header?.offsetHeight || 0,
    (stack?.offsetHeight || 0) + (nav?.offsetHeight || 0)
  );
  const detailTitle = document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "";
  const heroTop = document.querySelector(".tasful-market-product-hero")?.getBoundingClientRect().top ?? 0;
  const img = document.querySelector("[data-tasful-product-image]");
  const imgStyle = img ? getComputedStyle(img) : null;
  const figureStyle = document.querySelector(".tasful-market-product-hero__figure")
    ? getComputedStyle(document.querySelector(".tasful-market-product-hero__figure"))
    : null;
  const galleryBeforeTitle = (() => {
    const gallery = document.querySelector("[data-tasful-product-gallery]");
    const title = document.querySelector("[data-tasful-product-title]");
    if (!gallery || !title) return false;
    return gallery.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING;
  })();
  const specRows = document.querySelectorAll("[data-tasful-product-specs] table tr, [data-tasful-product-specs] details").length;
  const specSizeOpen = Boolean(
    Array.from(document.querySelectorAll("[data-tasful-product-specs] tr th")).some((th) =>
      /内容量|サイズ/.test(th.textContent || "")
    ) ||
      Array.from(document.querySelectorAll("[data-tasful-product-specs] details")).find(
        (el) => el.querySelector("summary")?.textContent?.includes("内容量") && el.open
      )
  );
  const shelfImages = Array.from(
    document.querySelectorAll(
      "[data-tasful-product-shelf-browsed] img, [data-tasful-product-shelf-related] img, [data-tasful-product-shelf-recent] img"
    )
  );
  const shelfBrokenImages = shelfImages.filter((img) => !img.src || (img.complete && img.naturalWidth === 0)).length;
  const thumbs = document.querySelectorAll("[data-tasful-product-thumb]").length;
  const condition = document.querySelector("[data-tasful-product-condition]")?.textContent?.trim() || "";
  const rating = document.querySelector("[data-tasful-product-rating]")?.textContent || "";
  const price =
    document.querySelector("[data-tasful-product-price-mobile]")?.textContent ||
    document.querySelector("[data-tasful-product-price]")?.textContent ||
    "";
  const shipFree =
    document.querySelector("[data-tasful-product-ship-free-mobile]")?.textContent?.trim() ||
    document.querySelector("[data-tasful-product-ship-free]")?.textContent?.trim() ||
    "";
  const shipDays =
    document.querySelector("[data-tasful-product-ship-days-mobile]")?.textContent?.trim() ||
    document.querySelector("[data-tasful-product-ship-days]")?.textContent?.trim() ||
    "";
  const stock = document.querySelector("[data-tasful-product-stock]")?.textContent?.trim() || "";
  const hasTrustBlock = Boolean(document.querySelector("[data-tasful-product-trust] .tasful-market-product-trust__line"));
  const hasBuybox = Boolean(document.querySelector("[data-tasful-product-buybox]"));
  const cartBtn = document.querySelector("[data-tasful-product-add-cart]");
  const buyBtn = document.querySelector("[data-tasful-product-buy-now]");
  const favBtn = document.querySelector("[data-tasful-product-favorite]");
  const aboutCount = document.querySelectorAll("[data-tasful-product-about-list] li").length;
  const specCount = specRows;
  const shelfBrowsed = document.querySelectorAll("[data-tasful-product-shelf-browsed] .tasful-market-search-mini").length;
  const shelfRelated = document.querySelectorAll("[data-tasful-product-shelf-related] .tasful-market-search-mini").length;
  const shelfRecent = document.querySelectorAll("[data-tasful-product-shelf-recent] .tasful-market-search-mini").length;
  const reviewCount = document.querySelectorAll("[data-tasful-product-reviews-list] .tasful-market-product-reviews__item").length;
  const footer = Boolean(document.querySelector(".tasful-market-footer"));
  const cartStyle = cartBtn ? getComputedStyle(cartBtn) : null;
  const pointsCount = document.querySelectorAll("[data-tasful-product-points] li").length;
  const hasRecommendPoints = Boolean(document.querySelector(".tasful-market-product-points"));
  const sellerRating = document.querySelector("[data-tasful-product-seller-rating]")?.textContent || "";
  const sellerReviews = document.querySelector("[data-tasful-product-seller-reviews]")?.textContent || "";
  const sellerSales = document.querySelector("[data-tasful-product-seller-sales]")?.textContent || "";
  const sellerBadges = document.querySelectorAll("[data-tasful-product-seller-badges] li").length;
  const hasSellerView = Boolean(document.querySelector("[data-tasful-product-seller-view]"));
  const hasSellerFollow = Boolean(document.querySelector("[data-tasful-product-seller-follow]"));
  const reviewScoreValue = document.querySelector(".tasful-market-product-reviews__score-value")?.textContent?.trim() || "";
  const reviewScoreCount = document.querySelector(".tasful-market-product-reviews__score-count")?.textContent || "";
  const reviewStarsBig = document.querySelector(".tasful-market-product-reviews__stars-big")?.textContent || "";
  const reviewPhotoSlots = document.querySelectorAll("[data-tasful-product-reviews-media] .tasful-market-product-reviews__photo-slot").length;
  const thumbLabels = Array.from(document.querySelectorAll("[data-tasful-product-thumb-label]")).map((el) => el.getAttribute("data-tasful-product-thumb-label"));
  return {
    pageUrl: window.location.href,
    isLocalhost: /^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.href),
    searchTitle,
    detailTitle,
    titleMatches: Boolean(searchTitle && detailTitle && searchTitle === detailTitle),
    hasMallHeader: Boolean(header),
    headerHeight,
    headerNotCollapsed: Boolean(header && parseFloat(getComputedStyle(header).height || "0") > 50),
    navItemCount: document.querySelectorAll("[data-tasful-market-nav-item]").length,
    heroBelowHeader: heroTop >= headerHeight - 8,
    hasMainImage: Boolean(img?.src),
    mainImageLoaded: Boolean(img?.complete && img.naturalWidth > 0),
    mainImageNaturalWidth: img?.naturalWidth || 0,
    mainImageObjectFit: imgStyle?.objectFit || "",
    mainImageBorderRadius: figureStyle?.borderRadius || "",
    galleryBeforeTitle: Boolean(
      (() => {
        const gallery = document.querySelector("[data-tasful-product-gallery]");
        const title = document.querySelector("[data-tasful-product-title]");
        if (!gallery || !title) return false;
        return Boolean(gallery.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING);
      })()
    ),
    specSizeOpen,
    shelfBrokenImages,
    thumbCount: thumbs,
    hasCondition: Boolean(condition),
    hasRating: /★/.test(rating),
    hasPrice: /¥/.test(price),
    hasShipFree: shipFree.includes("送料無料"),
    hasShipDays: Boolean(shipDays),
    hasStock: Boolean(stock),
    hasConnectBlock: hasTrustBlock || /Connect/.test(document.querySelector("[data-tasful-product-trust]")?.textContent || ""),
    hasCartBtn: Boolean(cartBtn),
    hasBuyBtn: Boolean(buyBtn),
    hasFavBtn: Boolean(favBtn),
    cartBtnVisible: Boolean(cartBtn && cartBtn.offsetHeight >= 40),
    cartBtnAccent: cartStyle?.backgroundColor === "rgb(255, 216, 20)" || (cartStyle?.backgroundColor || "").includes("255, 216"),
    aboutBulletCount: aboutCount,
    specAccordionCount: specCount,
    shelfBrowsed,
    shelfRelated,
    shelfRecent,
    reviewCount,
    hasReviewMore: Boolean(document.querySelector("[data-tasful-product-reviews-more]")),
    hasFooter: footer,
    pointsCount,
    hasRecommendPoints,
    sellerRating,
    sellerReviews,
    sellerSales,
    sellerBadges,
    hasSellerView,
    hasSellerFollow,
    reviewScoreValue,
    reviewScoreCount,
    reviewStarsBig,
    reviewPhotoSlots,
    hasSceneThumb: thumbLabels.some((l) => l && l.includes("利用シーン")),
    hasSizeThumb: thumbLabels.some((l) => l && l.includes("サイズ")),
    hasPackageThumb: thumbLabels.some((l) => l && l.includes("梱包")),
  };
}, cardMeta.title);

await page.screenshot({ path: path.join(OUT_DIR, "market-product-detail-mobile390.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT_DIR, "market-product-detail-full-page.png"), fullPage: true });

const cartBefore = await page.evaluate((key) => Number(localStorage.getItem(key)) || 0, CART_KEY);
await page.click("[data-tasful-product-add-cart]");
await page.waitForTimeout(400);
const cartAfter = await page.evaluate((key) => Number(localStorage.getItem(key)) || 0, CART_KEY);
const cartBadge = await page.evaluate(
  () => document.querySelector("[data-tasful-market-cart-count]")?.textContent?.trim() || "0"
);
const stayedOnDetail = page.url().includes("detail-shop-product.html");

await page.click("[data-tasful-product-buy-now]");
await page.waitForURL(/shop-market-checkout\.html/, { waitUntil: "domcontentloaded", timeout: 15000 });
const checkoutOk = page.url().includes("shop-market-checkout.html") && page.url().includes("mode=buyNow");

await browser.close();

const pass =
  report.isLocalhost &&
  report.titleMatches &&
  report.hasMallHeader &&
  report.headerHeight >= 120 &&
  report.headerNotCollapsed &&
  report.navItemCount >= 10 &&
  report.heroBelowHeader &&
  report.hasMainImage &&
  report.mainImageLoaded &&
  report.mainImageNaturalWidth > 100 &&
  report.mainImageObjectFit === "cover" &&
  report.mainImageBorderRadius === "12px" &&
  report.galleryBeforeTitle &&
  report.specSizeOpen &&
  report.shelfBrokenImages === 0 &&
  thumbSwitchOk &&
  report.thumbCount >= 1 &&
  report.hasCondition &&
  report.hasRating &&
  report.hasPrice &&
  report.hasShipFree &&
  report.hasShipDays &&
  report.hasStock &&
  report.hasCartBtn &&
  report.hasBuyBtn &&
  report.hasFavBtn &&
  report.aboutBulletCount >= 3 &&
  report.specAccordionCount >= 5 &&
  report.shelfBrowsed >= 2 &&
  report.shelfRelated >= 2 &&
  report.shelfRecent >= 2 &&
  report.reviewCount >= 3 &&
  report.hasReviewMore &&
  report.hasFooter &&
  report.hasRecommendPoints &&
  report.pointsCount >= 3 &&
  /★/.test(report.sellerRating) &&
  /件/.test(report.sellerReviews) &&
  /件/.test(report.sellerSales) &&
  report.sellerBadges >= 1 &&
  report.hasSellerView &&
  report.hasSellerFollow &&
  /^\d\.\d$/.test(report.reviewScoreValue) &&
  (report.reviewScoreCount.includes("レビュー") || report.reviewScoreCount.includes("グローバルレーティング")) &&
  /★/.test(report.reviewStarsBig) &&
  report.reviewPhotoSlots >= 1 &&
  stayedOnDetail &&
  cartAfter > cartBefore &&
  Number(cartBadge) >= cartAfter &&
  checkoutOk;

console.log(
  JSON.stringify(
    {
      baseUrl: base,
      searchUrl,
      detailUrl: report.pageUrl,
      cardMeta,
      report,
      cartBefore,
      cartAfter,
      cartBadge,
      stayedOnDetail,
      thumbSwitchOk,
      checkoutOk,
      pass,
    },
    null,
    2
  )
);
process.exit(pass ? 0 : 1);
