/**
 * PCヘッダー — 参考画像とのピクセル比較 + 実測値レポート
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-header-pc-compare");
const REF_PATH = path.join(__dirname, "..", "assets", "reference", "tasful-market-pc-header-approved.png");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1600", width: 1600, height: 900 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(REF_PATH), { recursive: true });

const fallbackRefs = [
  path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-rubih-tasufull-article",
    "assets",
    "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_image-1453b902-1e9f-477b-af5f-43ad937e4bb0.png"
  ),
  path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-rubih-tasufull-article",
    "assets",
    "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_244d71ec4e9fe743268f830b7ab81a32_images_image-587d1cb6-baa0-4b9d-99af-06bcdf6ab11c.png"
  ),
];
if (!fs.existsSync(REF_PATH)) {
  for (const ref of fallbackRefs) {
    if (fs.existsSync(ref)) {
      fs.copyFileSync(ref, REF_PATH);
      break;
    }
  }
}

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
const url = buildLocalPageUrl(base, "shop-store.html");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function measure() {
  return page.evaluate(() => {
    const round = (n) => Math.round(n * 10) / 10;
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const rect = (el) => el?.getBoundingClientRect();
    const top = document.querySelector(".tasful-market-mall-header__top");
    const nav = document.querySelector(".tasful-market-mall-header__nav");
    const header = document.querySelector("[data-tasful-market-header]");
    const logoLink = document.querySelector(".tasful-market-mall-header__logo");
    const logoImg = document.querySelector(".tasful-header-pc__logo");
    const brandText = document.querySelector(".tasful-header-pc__brand-text");
    const brand = document.querySelector(".tasful-header-pc__brand");
    const search = document.querySelector(".tasful-market-mall-header__search");
    const searchRow = document.querySelector(".tasful-market-mall-header__search-row");
    const actions = document.querySelector(".tasful-header-pc__actions");
    const icon = document.querySelector(".tasful-header-pc__action .tasful-header-pc__icon");
    const primary = document.querySelector(".tasful-header-pc__main");
    const sub = document.querySelector(".tasful-header-pc__sub");
    const sell = document.querySelector(".tasful-header-pc__action:nth-child(2)");
    const sellBefore = sell ? getComputedStyle(sell, "::before") : null;
    const navItem = document.querySelector(".tasful-market-mall-header__nav-item");
    const actionLinks = [...document.querySelectorAll(".tasful-header-pc__actions > a")];
    const mobileActions = document.querySelector(".tasful-market-mall-header__actions");

    return {
      headerTopHeight: round(rect(top)?.height || 0),
      headerTotalHeight: round(rect(header)?.height || 0),
      categoryHeight: round(rect(nav)?.height || 0),
      categoryFontSize: round(parseFloat(cs(navItem)?.fontSize || "0")),
      logoSrc: logoImg?.currentSrc || logoImg?.src || "",
      logoNaturalWidth: logoImg?.naturalWidth || 0,
      logoNaturalHeight: logoImg?.naturalHeight || 0,
      logoLoaded: Boolean(logoImg?.complete && logoImg?.naturalWidth > 0),
      logoHeight: round(rect(logoImg)?.height || 0),
      logoWidth: round(rect(logoImg)?.width || 0),
      logoLeft: round(rect(logoLink)?.left || 0),
      brandText: brandText?.textContent?.trim() || "",
      brandTextVisible: brandText ? cs(brandText).display !== "none" && rect(brandText).width > 0 : false,
      brandFontSize: round(parseFloat(cs(brandText)?.fontSize || "0")),
      brandFontWeight: round(parseFloat(cs(brandText)?.fontWeight || "0")),
      brandGap: round(parseFloat(cs(brand)?.gap || "0")),
      brandWidth: round(rect(brand)?.width || 0),
      logoTextVisible: brandText ? cs(brandText).display !== "none" && rect(brandText).width > 0 : false,
      logoMarkVisible: (() => {
        const mark = document.querySelector(".tasful-market-mall-header__logo-mark");
        return mark ? cs(mark).display !== "none" && rect(mark).width > 0 : false;
      })(),
      searchHeight: round(rect(search)?.height || 0),
      searchWidth: round(rect(search)?.width || 0),
      searchLeft: round(rect(search)?.left || 0),
      searchRowWidth: round(rect(searchRow)?.width || 0),
      searchBtnWidth: round(parseFloat(cs(document.querySelector(".tasful-market-mall-header__search-btn"))?.width || "0")),
      actionsWidth: round(rect(actions)?.width || 0),
      actionsRight: round(rect(actions)?.right || 0),
      mobileActionsVisible: mobileActions
        ? cs(mobileActions).display !== "none" && rect(mobileActions).width > 0
        : false,
      pcActionsVisible: actions ? cs(actions).display !== "none" && rect(actions).width > 0 : false,
      iconWidth: round(rect(icon)?.width || 0),
      iconHeight: round(rect(icon)?.height || 0),
      iconFontSize: round(parseFloat(cs(icon)?.fontSize || "0")),
      primaryFontSize: round(parseFloat(cs(primary)?.fontSize || "0")),
      subFontSize: round(parseFloat(cs(sub)?.fontSize || "0")),
      dividerHeight: sellBefore ? parseFloat(sellBefore.height) || 0 : 0,
      actionItems: actionLinks.map((el) => ({
        cls: el.classList.contains("tasful-header-pc__action--cart") ? "cart" : el.querySelector(".tasful-header-pc__main")?.textContent?.trim() || "",
        width: round(rect(el).width),
        height: round(rect(el).height),
        left: round(rect(el).left),
      })),
      stackPaddingLeft: round(parseFloat(cs(document.querySelector(".tasful-market-mall-header__stack"))?.paddingLeft || "0")),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

const viewportReports = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(url, { waitUntil: "networkidle" });
  await assertPlaywrightLocalhostPage(page);
  await page.evaluate(() => {
    localStorage.setItem("tasu_market_cart_count", "3");
    window.dispatchEvent(new Event("tasful-market-cart-updated"));
  });
  await page.waitForFunction(() => {
    const img = document.querySelector(".tasful-header-pc__logo");
    return img && img.complete && img.naturalWidth > 0;
  });
  await page.waitForTimeout(300);
  const metrics = await measure();
  const suffix = vp.name === "1280" ? "" : `-${vp.name}`;
  const headerEl = await page.$("[data-tasful-market-header]");
  await headerEl.screenshot({ path: path.join(OUT_DIR, `02-pc-header-after${suffix}.png`) });
  if (vp.name === "1280") {
    await page.screenshot({ path: path.join(OUT_DIR, "03-pc-top-first-view.png"), fullPage: false });
    const brandEl = await page.$(".tasful-header-pc__brand");
    if (brandEl) {
      await brandEl.screenshot({ path: path.join(OUT_DIR, "05-pc-brand-zoom.png") });
    }
  }
  viewportReports.push({ viewport: vp.name, metrics });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const mobileAudit = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  tabbarDisplay: getComputedStyle(document.querySelector(".tasful-market-tabbar")).display,
  actionLinesDisplay: getComputedStyle(document.querySelector(".tasful-market-mall-header__action-lines")).display,
  accountLabelDisplay: getComputedStyle(document.querySelector(".tasful-market-mall-header__account-label")).display,
  logoTextDisplay: getComputedStyle(document.querySelector(".tasful-market-mall-header__logo-text")).display,
  pcBrandDisplay: getComputedStyle(document.querySelector(".tasful-header-pc__brand")).display,
  pcActionsDisplay: getComputedStyle(document.querySelector(".tasful-header-pc__actions")).display,
  cardTitleWeight: getComputedStyle(document.querySelector(".tasful-market-mobile-top .tasful-market-card__title"))
    .fontWeight,
}));
await page.screenshot({ path: path.join(OUT_DIR, "04-mobile-390-unchanged.png"), fullPage: false });

await browser.close();

const m1280 = viewportReports.find((r) => r.viewport === "1280").metrics;
const m1600 = viewportReports.find((r) => r.viewport === "1600").metrics;
const implHeaderPath = path.join(OUT_DIR, "02-pc-header-after.png");
const comparePath = path.join(OUT_DIR, "01-approved-vs-implementation.png");

if (fs.existsSync(REF_PATH)) {
  const refMeta = await sharp(REF_PATH).metadata();
  const implMeta = await sharp(implHeaderPath).metadata();
  const targetW = 1280;
  const refH = Math.round((refMeta.height / refMeta.width) * targetW);
  const implH = Math.round((implMeta.height / implMeta.width) * targetW);
  const rowH = Math.max(refH, implH) + 48;
  const refBuf = await sharp(REF_PATH).resize(targetW, refH, { fit: "contain", background: "#0a1628" }).png().toBuffer();
  const implBuf = await sharp(implHeaderPath)
    .resize(targetW, implH, { fit: "contain", background: "#0a1628" })
    .png()
    .toBuffer();
  const labelH = 36;
  await sharp({
    create: { width: targetW, height: rowH * 2 + labelH * 2, channels: 3, background: "#111827" },
  })
    .composite([
      { input: refBuf, top: labelH, left: 0 },
      { input: implBuf, top: labelH + rowH + labelH, left: 0 },
    ])
    .png()
    .toFile(comparePath);
}

const pass =
  m1280.logoLoaded &&
  m1280.logoSrc.includes("tasful-globe-logo.png") &&
  m1280.brandText === "TASFUL市場" &&
  m1280.brandTextVisible &&
  !m1280.logoMarkVisible &&
  m1280.logoHeight >= 56 &&
  m1280.logoHeight <= 60 &&
  m1280.brandFontSize >= 23 &&
  m1280.brandFontSize <= 25 &&
  m1280.brandGap >= 14 &&
  m1280.brandGap <= 18 &&
  m1280.searchHeight >= 54 &&
  m1280.searchHeight <= 58 &&
  m1280.iconWidth >= 34 &&
  m1280.iconWidth <= 38 &&
  m1280.primaryFontSize >= 15 &&
  m1280.primaryFontSize <= 17 &&
  m1280.subFontSize >= 12 &&
  m1280.subFontSize <= 14 &&
  m1280.actionItems.length === 4 &&
  m1280.actionItems.every((a) => a.width >= 118 && a.width <= 132 && a.height >= 68 && a.height <= 76) &&
  m1280.pcActionsVisible &&
  !m1280.mobileActionsVisible &&
  m1280.scrollWidth <= 1280 &&
  m1600.searchWidth >= 700 &&
  mobileAudit.scrollWidth <= 390 &&
  mobileAudit.actionLinesDisplay === "none" &&
  mobileAudit.pcBrandDisplay === "none" &&
  mobileAudit.pcActionsDisplay === "none" &&
  mobileAudit.accountLabelDisplay !== "none";

const report = {
  generatedAt: new Date().toISOString(),
  url,
  referenceImage: fs.existsSync(REF_PATH) ? REF_PATH : null,
  viewportReports,
  mobileAudit,
  pass,
  changedFiles: [
    "shop-market-header.css",
    "shop-market-header.js",
    "images/tasful-globe-logo.png",
    "scripts/build-tasful-market-header-logo.mjs",
    "scripts/patch-shop-store-pc-header.mjs",
    "scripts/capture-market-header-pc-compare.mjs",
    "shop-store.html",
  ],
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
