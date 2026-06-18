/**
 * TASFUL市場 TOP — 390px スクリーンショット検証
 * 必ず http://localhost 経由（file:// 禁止）。
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-top-390");

const EXPECTED_SECTIONS = [
  "タイムセール",
  "人気ランキング",
  "あなたへのおすすめ",
  "Connect認証済み出品者",
  "新着商品",
  "ハンドメイド特集",
  "地域限定特集",
  "最近見た商品",
  "お気に入り急上昇",
  "値下げ商品",
  "季節特集",
];
const EXPECTED_VIEW_ALL_COUNT = 11;

async function findBaseUrl() {
  return findDevServerBaseUrl({ probePath: "shop-store.html" });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const pageUrl = buildLocalPageUrl(base, "shop-store.html");

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-mobile-top .tasful-market-card", { timeout: 20000 });
await page.waitForSelector("[data-tasful-market-nav-item]", { timeout: 15000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const report = await page.evaluate(({ expectedSections, expectedViewAllCount }) => {
  const headerStack = document.querySelector("[data-tasful-market-header]");
  const searchForm = document.querySelector(".tasful-market-mall-header__search");
  const stackRect = headerStack?.getBoundingClientRect();
  const searchRect = document.querySelector(".tasful-market-mall-header__search-row")?.getBoundingClientRect();
  const banner = document.querySelector(".tasful-market-banner");
  const mobileRoot = document.querySelector(".tasful-market-mobile-top") || document;
  const firstImg = mobileRoot.querySelector("[data-tasful-market-timesale] .tasful-market-card__img img");
  const firstImgRect = firstImg?.getBoundingClientRect();
  const bodyText = document.body.innerText || "";
  const forbidden = ["求人", "スキル", "一般案件", "業務サービス", "建設・職人", "友達", "安否", "店舗一覧", "お店を探す"];
  const hasForbidden = forbidden.filter((w) => bodyText.includes(w));

  const taxDuplicate = Array.from(document.querySelectorAll(".tasful-market-card__price")).some((el) => {
    const t = el.textContent || "";
    return (t.match(/\(税込\)/g) || []).length > 1 || (t.match(/（税込）/g) || []).length > 1;
  });

  const metaLines = Array.from(mobileRoot.querySelectorAll(".tasful-market-card__meta"));
  const allMetaHaveReviewCount = metaLines.length > 0 && metaLines.every((el) => /★[\d.]+\s*\(\d+\)/.test(el.textContent || ""));
  const allMetaHaveSep = metaLines.every((el) => (el.textContent || "").includes("｜"));

  const sectionOrder = Array.from(
    document.querySelectorAll(".tasful-market-mobile-top > .tasful-market-section:not([hidden])")
  ).map((el) => el.getAttribute("aria-label"));

  const viewAllLinks = Array.from(document.querySelectorAll(".tasful-market-mobile-top .tasful-market-section__view-all"));
  const viewAllOk =
    viewAllLinks.length === expectedViewAllCount && viewAllLinks.every((a) => /すべて見る/.test(a.textContent || ""));

  const mainPadBottom = parseFloat(getComputedStyle(document.querySelector(".tasful-market-main")).paddingBottom) || 0;
  const bodyPadBottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;

  const lastSection = document.querySelector("#tasful-market-season-section");
  const footer = document.querySelector(".tasful-market-footer");
  const footerInner = document.querySelector(".tasful-market-footer__inner");
  let sectionFooterGap = null;
  if (lastSection && footer) {
    const lastRect = lastSection.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    sectionFooterGap = Math.round(footerRect.top - lastRect.bottom);
  }

  const footerBg = footer ? getComputedStyle(footer).backgroundColor : "";
  const gradientStackEl = document.querySelector(".tasful-market-mall-header__stack");
  const headerBgColor = gradientStackEl ? getComputedStyle(gradientStackEl).backgroundColor : "";
  const footerPadBottom = footerInner ? parseFloat(getComputedStyle(footerInner).paddingBottom) || 0 : 0;

  const newGrid = mobileRoot.querySelector("[data-tasful-market-new] .tasful-market-grid");
  const scrollShelves = mobileRoot.querySelectorAll(".tasful-market-scroll").length;
  const countdown = document.querySelector("#tasful-market-timesale-section .tasful-market-section__countdown");
  const timesaleWas = document.querySelector("[data-tasful-market-timesale] .tasful-market-card__price-was");
  const newMoreLink = document.querySelector("[data-tasful-market-new-more] .tasful-market-section__more-link");
  const metaBottomSpace = metaLines.length
    ? metaLines.every((el) => (parseFloat(getComputedStyle(el).marginBottom) || 0) >= 4)
    : false;

  return {
    topbarVisible: Boolean(stackRect && stackRect.top <= 2),
    searchVisible: Boolean(searchRect && searchRect.height >= 40),
    searchHeight: searchForm ? Math.round(searchForm.getBoundingClientRect().height) : 0,
    bannerRemoved: !banner,
    productImageInFirstView: Boolean(firstImgRect && firstImgRect.top < 844 && firstImgRect.height > 40),
    firstImgTop: firstImgRect ? Math.round(firstImgRect.top) : null,
    noImagePlaceholder: bodyText.includes("画像準備中"),
    taxDuplicate,
    allMetaHaveReviewCount,
    allMetaHaveSep,
    cardCount: mobileRoot.querySelectorAll(".tasful-market-card").length,
    newCardCount: mobileRoot.querySelectorAll("[data-tasful-market-new] .tasful-market-card").length,
    hasNewGrid: Boolean(newGrid),
    scrollShelfCount: scrollShelves,
    viewAllCount: viewAllLinks.length,
    viewAllOk,
    sectionOrder,
    sectionsMatch: JSON.stringify(sectionOrder) === JSON.stringify(expectedSections),
    mainPadBottom,
    bodyPadBottom: Math.round(bodyPadBottom),
    sectionFooterGap,
    footerBg,
    headerNavyBg: headerBgColor === "rgb(35, 47, 62)",
    footerPadBottom: Math.round(footerPadBottom),
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    hasForbidden,
    scrollY: window.scrollY,
    hasTimesaleTag: Boolean(mobileRoot.querySelector("[data-tasful-market-timesale] .tasful-market-card__tag--sale")),
    hasConnectTag: Boolean(mobileRoot.querySelector("[data-tasful-market-connect] .tasful-market-card__tag--connect")),
    hasDiscountTag: Boolean(mobileRoot.querySelector("[data-tasful-market-discount] .tasful-market-card__tag--discount")),
    hasRankBadge: Boolean(mobileRoot.querySelector("[data-tasful-market-popular] .tasful-market-card__rank")),
    hasCountdown: Boolean(countdown && (countdown.textContent || "").includes("残り2時間")),
    hasTimesaleWasPrice: Boolean(timesaleWas),
    newMoreText: (newMoreLink?.textContent || "").trim(),
    metaBottomSpace,
  };
}, { expectedSections: EXPECTED_SECTIONS, expectedViewAllCount: EXPECTED_VIEW_ALL_COUNT });

const searchStickyAfterScroll = await page.evaluate(async () => {
  window.scrollTo(0, 500);
  await new Promise((r) => setTimeout(r, 200));
  const stack = document.querySelector("[data-tasful-market-header]");
  const search = document.querySelector(".tasful-market-mall-header__search-row");
  const stackRect = stack?.getBoundingClientRect();
  const searchRect = search?.getBoundingClientRect();
  return Boolean(stackRect && stackRect.top <= 2 && searchRect && searchRect.height >= 40);
});
report.searchStickyAfterScroll = searchStickyAfterScroll;

let tabbarOverlap = false;
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
tabbarOverlap = await page.evaluate(() => {
  const tabbar = document.querySelector(".tasful-market-tabbar");
  const footerCopy = document.querySelector(".tasful-market-footer__copy");
  if (!tabbar || !footerCopy) return false;
  const tabRect = tabbar.getBoundingClientRect();
  const copyRect = footerCopy.getBoundingClientRect();
  return copyRect.bottom > tabRect.top - 4;
});
report.tabbarOverlap = tabbarOverlap;

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(OUT_DIR, "market-home-mobile390.png"),
  fullPage: false,
  clip: { x: 0, y: 0, width: 390, height: 844 },
});

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(OUT_DIR, "05-full-page.png"),
  fullPage: true,
});

});

const pass =
  report.topbarVisible &&
  report.searchVisible &&
  report.searchStickyAfterScroll &&
  report.bannerRemoved &&
  report.productImageInFirstView &&
  !report.noImagePlaceholder &&
  !report.taxDuplicate &&
  report.allMetaHaveReviewCount &&
  report.allMetaHaveSep &&
  report.cardCount >= 40 &&
  report.newCardCount >= 1 &&
  report.newCardCount <= 6 &&
  report.hasNewGrid &&
  report.scrollShelfCount >= 7 &&
  report.viewAllOk &&
  report.sectionsMatch &&
  report.mainPadBottom <= 32 &&
  report.bodyPadBottom === 0 &&
  report.footerPadBottom >= 70 &&
  report.footerPadBottom <= 110 &&
  report.sectionFooterGap >= 24 &&
  report.sectionFooterGap <= 32 &&
  report.footerBg === "rgb(31, 41, 55)" &&
  report.headerNavyBg &&
  report.noHorizontalOverflow &&
  report.hasForbidden.length === 0 &&
  !report.tabbarOverlap &&
  report.hasTimesaleTag &&
  report.hasConnectTag &&
  report.hasDiscountTag &&
  report.hasRankBadge &&
  report.hasCountdown &&
  report.hasTimesaleWasPrice &&
  report.newMoreText === "新着商品をすべて見る ＞" &&
  report.metaBottomSpace &&
  report.scrollY === 0;

console.log(JSON.stringify({ baseUrl: base, pageUrl, ...report, pass }, null, 2));
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
