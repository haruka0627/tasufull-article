/**
 * 市場TOP PC レイアウト診断 + フルページキャプチャ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "market-top-pc-fix");
fs.mkdirSync(OUT, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const url = buildLocalPageUrl(base, "shop-store.html");
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector(".tasful-market-card", { timeout: 30000 });
await page.waitForTimeout(1500);

const diag = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".tasful-market-main > .tasful-market-section")].map((sec) => {
    const label = sec.getAttribute("aria-label") || "";
    const host = sec.querySelector(
      "[data-tasful-market-timesale], [data-tasful-market-popular], [data-tasful-market-for-you], [data-tasful-market-connect], [data-tasful-market-new], [data-tasful-market-handmade], [data-tasful-market-local], [data-tasful-market-season], .tasful-market-feature-shelves"
    ) || sec.querySelector("div[class*='tasful-market']");
    const inner = host?.firstElementChild;
    const cards = sec.querySelectorAll(".tasful-market-card");
    const rect = sec.getBoundingClientRect();
    const innerRect = inner?.getBoundingClientRect();
    const innerStyle = inner ? getComputedStyle(inner) : null;
    const empty = cards.length === 0;
    const hidden = sec.hasAttribute("hidden") || (inner && inner.children.length === 0);
    return {
      label,
      sectionHeight: Math.round(rect.height),
      innerClass: inner?.className || null,
      innerDisplay: innerStyle?.display,
      innerGridCols: innerStyle?.gridTemplateColumns,
      innerOverflow: innerStyle?.overflow,
      innerHeight: innerRect ? Math.round(innerRect.height) : 0,
      cardCount: cards.length,
      empty,
      hidden,
      gapBelowInner: innerRect ? Math.round(rect.bottom - innerRect.bottom) : null,
    };
  });

  const scrollShelves = [...document.querySelectorAll(".tasful-market-scroll")].map((el, i) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const first = el.querySelector(".tasful-market-card");
    const last = el.querySelector(".tasful-market-card:last-child");
    const fr = first?.getBoundingClientRect();
    const lr = last?.getBoundingClientRect();
    const cardSt = first ? getComputedStyle(first) : null;
    return {
      index: i,
      cardCount: el.querySelectorAll(".tasful-market-card").length,
      display: st.display,
      overflowX: st.overflowX,
      flexWrap: st.flexWrap,
      height: Math.round(r.height),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      firstCardWidth: fr ? Math.round(fr.width) : 0,
      firstCardHeight: fr ? Math.round(fr.height) : 0,
      cardFlex: cardSt?.flex,
      cardHeight: cardSt?.height,
      cardMaxHeight: cardSt?.maxHeight,
      lastCardRight: lr ? Math.round(lr.right) : 0,
      containerRight: Math.round(r.right),
      clipped: lr && r ? lr.right > r.right + 2 : false,
    };
  });

  const grids = [...document.querySelectorAll(".tasful-market-grid")].map((el, i) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      index: i,
      cardCount: el.querySelectorAll(".tasful-market-card").length,
      gridCols: st.gridTemplateColumns,
      height: Math.round(r.height),
      alignItems: st.alignItems,
      rowGap: st.rowGap,
    };
  });

  const footer = document.querySelector(".tasful-market-footer");
  const lastSec = document.querySelector(".tasful-market-main > .tasful-market-section:last-of-type");
  const gapBeforeFooter = footer && lastSec
    ? Math.round(footer.getBoundingClientRect().top - lastSec.getBoundingClientRect().bottom)
    : null;

  return {
    bodyHeight: document.body.scrollHeight,
    mainHeight: document.querySelector(".tasful-market-main")?.getBoundingClientRect().height,
    gapBeforeFooter,
    sectionCount: sections.length,
    sections,
    scrollShelves,
    grids,
  };
});

await page.screenshot({ path: path.join(OUT, "before-full.png"), fullPage: true });

// viewport slices
for (const [name, y] of [
  ["before-top", 0],
  ["before-mid", 1200],
  ["before-lower", 2400],
  ["before-footer", 3600],
]) {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

fs.writeFileSync(path.join(OUT, "diagnostic-before.json"), JSON.stringify(diag, null, 2));

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".tasful-market-card", { timeout: 30000 });
await page.waitForTimeout(1500);

const diagAfter = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".tasful-market-main > .tasful-market-section")].map((sec) => {
    const label = sec.getAttribute("aria-label") || "";
    const inner = sec.querySelector(".tasful-market-scroll, .tasful-market-grid");
    const cards = sec.querySelectorAll(".tasful-market-card");
    const rect = sec.getBoundingClientRect();
    const innerRect = inner?.getBoundingClientRect();
    const innerStyle = inner ? getComputedStyle(inner) : null;
    return {
      label,
      sectionHeight: Math.round(rect.height),
      innerClass: inner?.className || null,
      innerDisplay: innerStyle?.display,
      innerGridCols: innerStyle?.gridTemplateColumns,
      innerHeight: innerRect ? Math.round(innerRect.height) : 0,
      cardCount: cards.length,
    };
  });
  const scrollShelves = [...document.querySelectorAll(".tasful-market-scroll")].map((el, i) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const first = el.querySelector(".tasful-market-card");
    const fr = first?.getBoundingClientRect();
    const cardSt = first ? getComputedStyle(first) : null;
    return {
      index: i,
      cardCount: el.querySelectorAll(".tasful-market-card").length,
      display: st.display,
      gridCols: st.gridTemplateColumns,
      height: Math.round(r.height),
      firstCardHeight: fr ? Math.round(fr.height) : 0,
      cardHeight: cardSt?.height,
    };
  });
  const grids = [...document.querySelectorAll(".tasful-market-grid")].map((el, i) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      index: i,
      cardCount: el.querySelectorAll(".tasful-market-card").length,
      gridCols: st.gridTemplateColumns,
      height: Math.round(r.height),
    };
  });
  const footer = document.querySelector(".tasful-market-footer");
  const lastSec = document.querySelector(".tasful-market-main > .tasful-market-section:last-of-type");
  const gapBeforeFooter = footer && lastSec
    ? Math.round(footer.getBoundingClientRect().top - lastSec.getBoundingClientRect().bottom)
    : null;
  return { bodyHeight: document.body.scrollHeight, gapBeforeFooter, sections, scrollShelves, grids };
});

await page.screenshot({ path: path.join(OUT, "after-full.png"), fullPage: true });

for (const [name, y] of [
  ["after-top", 0],
  ["after-mid", 1200],
  ["after-lower", 2400],
  ["after-footer", 3600],
]) {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

fs.writeFileSync(path.join(OUT, "diagnostic-after.json"), JSON.stringify(diagAfter, null, 2));
console.log(JSON.stringify({ before: diag, after: diagAfter }, null, 2));
});

await closeAllBrowsers();
