/**
 * shop-vendors.html — PC1280 / 390px スクショ + 導線確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "shop-vendors");
const PAGE_PATH = "shop-vendors.html";

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: PAGE_PATH });
const pageUrl = buildLocalPageUrl(base, PAGE_PATH);
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

async function waitListReady() {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-shop-store-grid] .shop-store-card", { timeout: 25000 });
}

async function loadAllCards() {
  for (let i = 0; i < 10; i++) {
    const before = await page.locator(".shop-store-card[data-id]").count();
    await page.evaluate(() => {
      const btn = document.querySelector("[data-shop-load-more]");
      if (btn && !btn.hidden) btn.click();
    });
    await page.waitForTimeout(450);
    const after = await page.locator(".shop-store-card[data-id]").count();
    if (after <= before) break;
  }
}

const report = { url: pageUrl, viewports: {}, flow: {}, shopCount: 0 };

// --- List page audit ---
await waitListReady();
await loadAllCards();

const listAudit = await page.evaluate(() => ({
  dataPage: document.body.dataset.page,
  countText: document.querySelector("[data-shop-store-count]")?.textContent?.trim() || "",
  cardCount: document.querySelectorAll("[data-shop-store-grid] .shop-store-card[data-id]").length,
  hasShopStorePage: [...document.scripts].some((s) => s.src.includes("shop-store-page.js")),
  firstCard: (() => {
    const card = document.querySelector("[data-shop-store-grid] .shop-store-card[data-id]");
    if (!card) return null;
    const id = card.getAttribute("data-id");
    const detailHref =
      card.querySelector('.shop-store-btn--detail[href*="detail-shop"]')?.getAttribute("href") ||
      card.querySelector('a[href*="detail-shop-store"]')?.getAttribute("href") ||
      "";
    return { id, detailHref, title: card.querySelector(".shop-store-card__name")?.textContent?.trim() };
  })(),
}));

report.shopCount = listAudit.cardCount;
report.list = listAudit;

// --- Screenshots ---
for (const vp of [
  { w: 1280, h: 900, file: "shop-vendors-pc-1280.png" },
  { w: 390, h: 844, file: "shop-vendors-mobile-390.png" },
]) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-shop-store-grid] .shop-store-card", { timeout: 20000 });
  if (vp.w >= 1280) await loadAllCards();
  await page.evaluate(() => {
    const results = document.getElementById("shop-store-results");
    if (results) results.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 520);
  });
  await page.waitForTimeout(500);
  const out = path.join(OUT_DIR, vp.file);
  await page.screenshot({ path: out, fullPage: false });
  report.viewports[vp.w] = out;
}

// --- Flow: list → store detail → product ---
if (listAudit.firstCard?.id) {
  const { id, detailHref } = listAudit.firstCard;
  const detailUrl = detailHref.startsWith("http") ? detailHref : buildLocalPageUrl(base, detailHref.replace(/^\//, ""));

  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error" ||
      document.querySelector("[data-biz-detail-title]"),
    { timeout: 20000 }
  );

  const storeDetail = await page.evaluate(() => ({
    href: location.href,
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim() || "",
    rootHidden: document.querySelector("[data-biz-detail-root]")?.hidden,
    statusText: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
    productLink:
      document.querySelector('a[href*="detail-shop-product"]')?.getAttribute("href") ||
      document.querySelector('a[href*="shop-products"]')?.getAttribute("href") ||
      document.querySelector(".shop-store-btn--gold")?.getAttribute("href") ||
      "",
  }));

  report.flow.storeDetail = { id, ...storeDetail, ok: Boolean(storeDetail.title) && !storeDetail.rootHidden };

  let productHref = storeDetail.productLink;
  if (productHref.includes("shop-products.html")) {
    await page.goto(
      productHref.startsWith("http") ? productHref : buildLocalPageUrl(base, productHref.replace(/^\//, "")),
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(600);
    productHref = await page.evaluate(
      () =>
        document.querySelector('a[href*="detail-shop-product"]')?.getAttribute("href") ||
        document.querySelector(".shop-products-card a")?.getAttribute("href") ||
        ""
    );
  }

  if (productHref) {
    const productUrl = productHref.startsWith("http")
      ? productHref
      : buildLocalPageUrl(base, productHref.replace(/^\//, ""));
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const productPage = await page.evaluate(() => ({
      href: location.href,
      title: document.title,
      hasProductRoot: Boolean(
        document.querySelector("[data-market-product-detail]") ||
          document.querySelector(".shop-product-detail") ||
          document.querySelector("[data-shop-product-detail]")
      ),
    }));
    report.flow.productDetail = {
      ...productPage,
      ok:
        productPage.href.includes("detail-shop-product") &&
        (productPage.hasProductRoot || /商品/.test(productPage.title)),
    };
  } else {
    report.flow.productDetail = { ok: false, reason: "no detail-shop-product link" };
  }
}

});

const reportPath = path.join(OUT_DIR, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
console.log("Report:", reportPath);

const ok =
  listAudit.dataPage === "shop_store_list" &&
  listAudit.cardCount >= 20 &&
  listAudit.firstCard?.detailHref?.includes("detail-shop-store.html") &&
  report.flow.storeDetail?.ok &&
  report.flow.productDetail?.ok;

await closeAllBrowsers();
process.exit(ok ? 0 : 1);
