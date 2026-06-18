/**
 * TASFUL市場 TOP (shop-store.html) — 390 / 768 / 1280px スクリーンショット
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-top-viewports";
const OUT_DIR = path.join(__dirname, "..", "screenshots", FOLDER_ID);
const TOP_PATH = "shop-store.html";
const VIEWPORTS = [
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 900, name: "768px" },
  { width: 1280, height: 900, name: "1280px" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: TOP_PATH });
const topUrl = buildLocalPageUrl(base, TOP_PATH);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const reports = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(
    vp.width < 961 ? ".tasful-market-mobile-top .tasful-market-card" : ".tasful-market-pc-hero-full",
    { timeout: 20000 }
  );
  await page.waitForSelector("[data-tasful-market-header]", { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  const audit = await page.evaluate((viewportName) => {
    const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => {
      try {
        return new URL(l.href).pathname.split("/").pop();
      } catch {
        return l.getAttribute("href");
      }
    });
    const topIdx = stylesheets.indexOf("shop-market-top.css");
    const headerIdx = stylesheets.indexOf("shop-market-header.css");
    const pcIdx = stylesheets.indexOf("shop-market-pc.css");
    const stack = document.querySelector(".tasful-market-mall-header__stack");
    const tabbar = document.querySelector(".tasful-market-tabbar");
    const grid = document.querySelector(".tasful-market-mobile-top .tasful-market-grid");
    const scrollCard = document.querySelector(
      ".tasful-market-mobile-top .tasful-market-scroll .tasful-market-card, .tasful-market-pc-shelf-card"
    );
    const title =
      viewportName === "1280px"
        ? document.querySelector(".tasful-market-pc-shelf__title")
        : document.querySelector(".tasful-market-mobile-top .tasful-market-card__title");
    const pcHero = document.querySelector(".tasful-market-pc-hero-full");
    return {
      viewport: viewportName,
      href: window.location.href,
      scrollWidth: document.documentElement.scrollWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      stylesheets,
      cssOrderOk: topIdx >= 0 && headerIdx > topIdx && pcIdx > headerIdx,
      hasTopCss: topIdx >= 0,
      hasPcCss: pcIdx >= 0,
      tabbarDisplay: tabbar ? getComputedStyle(tabbar).display : "none",
      stackMaxWidth: stack ? getComputedStyle(stack).maxWidth : "",
      gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : "",
      scrollCardWidth: scrollCard ? Math.round(scrollCard.getBoundingClientRect().width) : 0,
      cardTitleWeight: title ? getComputedStyle(title).fontWeight : "",
      cardTitleSize: title ? getComputedStyle(title).fontSize : "",
      shelfCardCount:
        viewportName === "1280px"
          ? document.querySelectorAll(".tasful-market-pc-shelf-card, .tasful-market-pc-quad__thumb").length
          : document.querySelectorAll(".tasful-market-mobile-top .tasful-market-card").length,
      hasPcHero: Boolean(pcHero),
    };
  }, vp.name);

  const file = `shop-store-${vp.width}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: false });
  reports.push({ ...audit, screenshot: file });
}

await browser.close();

const pass = reports.every((r) => {
  const mobileOk = r.viewport === "390px"
    ? r.noHorizontalOverflow && r.tabbarDisplay !== "none" && r.gridCols.includes(" ") && parseInt(r.cardTitleWeight, 10) === 600
    : true;
  const tabletOk = r.viewport === "768px" ? r.noHorizontalOverflow : true;
  const pcOk = r.viewport === "1280px"
    ? r.noHorizontalOverflow &&
      r.cssOrderOk &&
      r.tabbarDisplay === "none" &&
      r.stackMaxWidth === "1600px" &&
      r.hasPcHero &&
      parseInt(r.cardTitleWeight, 10) >= 700 &&
      r.scrollCardWidth >= 179 &&
      r.scrollCardWidth <= 181
    : true;
  return r.hasTopCss && r.hasPcCss && mobileOk && tabletOk && pcOk;
});

const report = {
  generatedAt: new Date().toISOString(),
  topUrl,
  pass,
  reports,
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場TOP viewport 検証",
  report,
  targetPage: TOP_PATH,
  viewports: ["390", "768", "1280"],
  overall: pass ? "PASS" : "FAIL",
  screenshotCatalog: reports.map((r) => ({
    file: r.screenshot,
    label: `shop-store ${r.viewport}`,
    url: TOP_PATH,
    viewport: String(r.viewport).replace("px", ""),
  })),
});

process.exit(pass ? 0 : 1);
