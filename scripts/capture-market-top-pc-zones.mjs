/**
 * TASFUL市場 TOP — PC 1280px ゾーン別スクリーンショット + 視認可能見出し検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-top-pc-zones");
const VIEWPORT = { width: 1280, height: 900 };
const REQUIRED_HEADINGS = [
  "あなたへのおすすめ",
  "これにも注目",
  "人気商品",
  "Connect認証済み商品",
  "閲覧履歴",
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const url = buildLocalPageUrl(base, "shop-store.html");
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: VIEWPORT });

async function scrollSectionBelowHeader(sectionId) {
  await page.evaluate((id) => {
    const section = document.getElementById(id);
    if (!section) return;
    const head = section.querySelector(".tasful-market-pc-shelf__head");
    const header = document.querySelector("[data-tasful-market-header]");
    const headerBottom = header ? header.getBoundingClientRect().bottom : 168;
    const headTop = (head || section).getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, headTop - headerBottom - 4));
  }, sectionId);
}

async function auditVisibleHeadingNearRow(sectionId, maxGap = 40) {
  return page.evaluate(
    ({ id, gapLimit }) => {
      const section = document.getElementById(id);
      if (!section) return { ok: false, reason: "no-section" };
      const header = document.querySelector("[data-tasful-market-header]");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const title = section.querySelector(".tasful-market-pc-shelf__title");
      const headBar = section.querySelector(".tasful-market-pc-shelf__head");
      const row = section.querySelector(".tasful-market-pc-shelf-scroll, .tasful-market-pc-mini-strip");
      if (!title || !row || !headBar) return { ok: false, reason: "no-title-row-or-head" };

      const tr = title.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const hr = headBar.getBoundingClientRect();
      const gap = rr.top - tr.bottom;
      const cs = getComputedStyle(title);
      const opacity = parseFloat(cs.opacity);
      const visible =
        tr.height > 0 &&
        tr.width > 0 &&
        tr.top >= headerBottom - 1 &&
        tr.bottom <= window.innerHeight + 1 &&
        cs.visibility !== "hidden" &&
        cs.display !== "none" &&
        opacity > 0.5 &&
        (title.textContent || "").trim().length > 0;

      return {
        ok:
          visible &&
          gap >= 0 &&
          gap <= gapLimit &&
          hr.height >= 36 &&
          hr.height <= 44 &&
          tr.top >= headerBottom - 1,
        sectionId: id,
        titleText: (title.textContent || "").trim(),
        titleTop: Math.round(tr.top * 10) / 10,
        titleBottom: Math.round(tr.bottom * 10) / 10,
        rowTop: Math.round(rr.top * 10) / 10,
        headerBottom: Math.round(headerBottom * 10) / 10,
        gapAboveRow: Math.round(gap * 10) / 10,
        headBarHeight: Math.round(hr.height * 10) / 10,
        hiddenUnderHeader: tr.top < headerBottom - 1,
        titleVisible: visible,
      };
    },
    { id: sectionId, gapLimit: maxGap }
  );
}

async function auditAllVisibleHeadingsNearRows(maxGap = 40) {
  return page.evaluate((gapLimit) => {
    const header = document.querySelector("[data-tasful-market-header]");
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const rows = [...document.querySelectorAll(".tasful-market-pc-shelf-scroll, .tasful-market-pc-mini-strip")];

    return rows.map((row) => {
      const section = row.closest(".tasful-market-pc-shelf");
      const title = section?.querySelector(".tasful-market-pc-shelf__title");
      const headBar = section?.querySelector(".tasful-market-pc-shelf__head");
      if (!section || !title || !headBar) {
        return { ok: false, sectionId: section?.id || "", reason: "missing-elements" };
      }
      const tr = title.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const hr = headBar.getBoundingClientRect();
      const gap = rr.top - tr.bottom;
      const cs = getComputedStyle(title);
      const inViewport = rr.top < window.innerHeight && rr.bottom > headerBottom;
      if (!inViewport) {
        return { ok: true, sectionId: section.id, skipped: true, titleText: title.textContent.trim() };
      }
      const visible =
        tr.height > 0 &&
        tr.width > 0 &&
        tr.top >= headerBottom - 1 &&
        tr.bottom <= window.innerHeight + 1 &&
        cs.visibility !== "hidden" &&
        cs.display !== "none" &&
        parseFloat(cs.opacity) > 0.5;
      return {
        ok: visible && gap >= 0 && gap <= gapLimit && hr.height >= 36 && hr.height <= 44,
        sectionId: section.id,
        titleText: (title.textContent || "").trim(),
        gapAboveRow: Math.round(gap * 10) / 10,
        headBarHeight: Math.round(hr.height * 10) / 10,
        hiddenUnderHeader: tr.top < headerBottom - 1,
        titleVisible: visible,
      };
    });
  }, maxGap);
}

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-pc-hero-full", { timeout: 20000 });
await page.waitForFunction(
  () => {
    const top = document.querySelector("[data-tasful-market-pc-top]");
    return top && !top.hasAttribute("hidden");
  },
  { timeout: 20000 }
);
await page.waitForSelector(".tasful-market-pc-shelf-scroll .tasful-market-pc-shelf-card", { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUT_DIR, "01-pc-first-view-after.png"), fullPage: false });

await scrollSectionBelowHeader("tasful-market-pc-popular-strip");
await page.waitForTimeout(400);
const midHeadingAudit = await auditVisibleHeadingNearRow("tasful-market-pc-popular-strip");
const midAllRowsAudit = await auditAllVisibleHeadingsNearRows();
const detailAudit = await page.evaluate(() => {
  const round = (n) => Math.round(n * 10) / 10;
  const scroll = document.querySelector("#tasful-market-pc-popular-strip .tasful-market-pc-shelf-scroll");
  const cards = [...document.querySelectorAll("#tasful-market-pc-popular-strip .tasful-market-pc-shelf-card")];
  const titles = cards.map((c) => c.querySelector(".tasful-market-pc-shelf-card__title")).filter(Boolean);
  const cardHeights = cards.map((c) => round(c.getBoundingClientRect().height));
  const titleHeights = titles.map((t) => round(t.getBoundingClientRect().height));
  const cs = titles[0] ? getComputedStyle(titles[0]) : null;
  const scrollCs = scroll ? getComputedStyle(scroll) : null;
  const recent = document.querySelector(".tasful-market-pc-shelf--recent");
  const heightsSpread = cardHeights.length ? Math.max(...cardHeights) - Math.min(...cardHeights) : 999;
  const titleSpread = titleHeights.length ? Math.max(...titleHeights) - Math.min(...titleHeights) : 999;
  const fontSize = cs ? parseFloat(cs.fontSize) || 13 : 13;
  const titleHeightPx = cs ? parseFloat(cs.height) || 0 : 0;
  const titleHeightEm = fontSize ? round(titleHeightPx / fontSize) : 0;
  const lineHeightPx = cs ? parseFloat(cs.lineHeight) || 0 : 0;
  const lineHeightRatio = fontSize ? round(lineHeightPx / fontSize) : 0;
  return {
    titleDisplay: cs?.display || "",
    titleWebkitLineClamp: cs?.webkitLineClamp || cs?.getPropertyValue("-webkit-line-clamp") || "",
    titleHeightPx: round(titleHeightPx),
    titleHeightEm,
    titleLineHeight: cs?.lineHeight || "",
    titleLineHeightRatio: lineHeightRatio,
    titleOverflow: cs?.overflow || "",
    cardHeightUniform: heightsSpread <= 2,
    cardHeightsSpread: round(heightsSpread),
    titleHeightUniform: titleSpread <= 1,
    titleHeightsSpread: round(titleSpread),
    scrollbarWidth: scrollCs?.scrollbarWidth || "",
    msOverflowStyle: scrollCs?.msOverflowStyle || "",
    recentMarginBottom: recent ? parseFloat(getComputedStyle(recent).marginBottom) || 0 : 0,
    hasShelfCardBody: cards.every((c) => Boolean(c.querySelector(".tasful-market-pc-shelf-card__body"))),
  };
});
await page.screenshot({ path: path.join(OUT_DIR, "02-pc-mid.png"), fullPage: false });
const midShelfBody = await page.$("#tasful-market-pc-popular-strip .tasful-market-pc-shelf__body");
if (midShelfBody && (await midShelfBody.isVisible())) {
  await midShelfBody.screenshot({ path: path.join(OUT_DIR, "07-pc-title-clamp-evidence.png") });
}
const midScroll = await page.$("#tasful-market-pc-popular-strip .tasful-market-pc-shelf-scroll");
if (midScroll && (await midScroll.isVisible())) {
  await midScroll.screenshot({ path: path.join(OUT_DIR, "08-pc-scrollbar-hidden-evidence.png") });
}
const midHeadEl = await page.$("#tasful-market-pc-popular-strip .tasful-market-pc-shelf__head");
if (midHeadEl && (await midHeadEl.isVisible())) {
  await midHeadEl.screenshot({ path: path.join(OUT_DIR, "02-pc-mid-heading-evidence.png") });
}

await scrollSectionBelowHeader("tasful-market-pc-recent-mini");
await page.waitForTimeout(400);
const bottomHeadingAudit = await auditVisibleHeadingNearRow("tasful-market-pc-recent-mini");
const bottomAllRowsAudit = await auditAllVisibleHeadingsNearRows();
const footerGapAudit = await page.evaluate(() => {
  const round = (n) => Math.round(n * 10) / 10;
  const recent = document.querySelector(".tasful-market-pc-shelf--recent");
  const footer = document.querySelector(".tasful-market-footer");
  const recentRect = recent?.getBoundingClientRect();
  const footerRect = footer?.getBoundingClientRect();
  return {
    recentMarginBottom: recent ? parseFloat(getComputedStyle(recent).marginBottom) || 0 : 0,
    gapBeforeFooter: recentRect && footerRect ? round(footerRect.top - recentRect.bottom) : 0,
  };
});
await page.screenshot({ path: path.join(OUT_DIR, "03-pc-bottom.png"), fullPage: false });
const bottomHeadEl = await page.$("#tasful-market-pc-recent-mini .tasful-market-pc-shelf__head");
if (bottomHeadEl && (await bottomHeadEl.isVisible())) {
  await bottomHeadEl.screenshot({ path: path.join(OUT_DIR, "03-pc-bottom-heading-evidence.png") });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const mobileAudit = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  tabbarDisplay: getComputedStyle(document.querySelector(".tasful-market-tabbar")).display,
  pcTopHidden: getComputedStyle(document.querySelector(".tasful-market-pc-top")).display === "none",
  mobileTopVisible: getComputedStyle(document.querySelector(".tasful-market-mobile-top")).display !== "none",
  cardTitleWeight: getComputedStyle(document.querySelector(".tasful-market-mobile-top .tasful-market-card__title"))
    .fontWeight,
  mobileSectionCount: document.querySelectorAll(".tasful-market-mobile-top .tasful-market-section").length,
}));
await page.screenshot({ path: path.join(OUT_DIR, "04-mobile-first-view.png"), fullPage: false });

});

const pass =
  midHeadingAudit.ok &&
  bottomHeadingAudit.ok &&
  !midHeadingAudit.hiddenUnderHeader &&
  !bottomHeadingAudit.hiddenUnderHeader &&
  REQUIRED_HEADINGS.includes(midHeadingAudit.titleText) &&
  bottomHeadingAudit.titleText === "閲覧履歴" &&
  midHeadingAudit.gapAboveRow <= 40 &&
  bottomHeadingAudit.gapAboveRow <= 40 &&
  midHeadingAudit.headBarHeight >= 36 &&
  midHeadingAudit.headBarHeight <= 44 &&
  bottomHeadingAudit.headBarHeight >= 36 &&
  bottomHeadingAudit.headBarHeight <= 44 &&
  detailAudit.titleWebkitLineClamp === "2" &&
  detailAudit.titleHeightEm >= 2.75 &&
  detailAudit.titleHeightEm <= 2.85 &&
  detailAudit.titleLineHeightRatio >= 1.35 &&
  detailAudit.titleLineHeightRatio <= 1.45 &&
  detailAudit.titleOverflow === "hidden" &&
  detailAudit.cardHeightUniform &&
  detailAudit.titleHeightUniform &&
  detailAudit.scrollbarWidth === "none" &&
  detailAudit.recentMarginBottom >= 38 &&
  detailAudit.recentMarginBottom <= 42 &&
  footerGapAudit.recentMarginBottom >= 38 &&
  footerGapAudit.recentMarginBottom <= 42 &&
  mobileAudit.scrollWidth <= 390 &&
  mobileAudit.tabbarDisplay !== "none" &&
  mobileAudit.pcTopHidden &&
  mobileAudit.mobileTopVisible &&
  parseInt(mobileAudit.cardTitleWeight, 10) === 600;

const report = {
  generatedAt: new Date().toISOString(),
  url,
  viewport: VIEWPORT,
  midHeadingAudit,
  bottomHeadingAudit,
  visibleRowAudits: [...midAllRowsAudit, ...bottomAllRowsAudit].filter((a) => !a.skipped),
  headingsVisibleInScreenshot: midHeadingAudit.ok && bottomHeadingAudit.ok,
  detailAudit,
  footerGapAudit,
  mobileAudit,
  pass,
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
