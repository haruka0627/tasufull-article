/**
 * TASFUL市場 — 出品フロー 390px 検証
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots", "market-listing-flow-390");
const REPORT_PATH = path.join(OUT_DIR, "report.json");
const STATIC_PORT = 8799;

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function startStaticServer(port = STATIC_PORT) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const pathname = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const rel = pathname.replace(/^\//, "") || "index.html";
      try {
        const file = path.join(ROOT, rel);
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const staticServer = await startStaticServer();
const base = `http://127.0.0.1:${STATIC_PORT}`;

const VIEWPORT = { width: 390, height: 844 };
const SELLER_PRODUCTS_KEY = "tasu_market_seller_products";
const SELLER_PROFILE_KEY = "tasu_market_seller_profile";
const SHOP_ID = "tasu-market-seller-me";
const TEST_TITLE = "TASFUL出品テスト商品";
const TEST_IMAGE =
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80";

fs.mkdirSync(OUT_DIR, { recursive: true });

/** @type {Array<{ id: string, file: string, url: string, pass: boolean, checks: Record<string, unknown>, errors: string[] }>} */
const screens = [];

function pushScreen(id, file, url, checks, errors = []) {
  const failed = errors.length > 0 || Object.entries(checks).some(([k, v]) => k.startsWith("ok_") && v === false);
  screens.push({ id, file, url, pass: !failed, checks, errors });
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
}

async function countBrokenImages(page) {
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
    });
  });
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img[src]")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 3000);
            }
          })
      )
    );
    return imgs.filter((img) => {
      const src = (img.getAttribute("src") || "").trim();
      return !src || (img.complete && img.naturalWidth === 0);
    }).length;
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
await page.route(/supabase\.co/i, (route) => route.abort("failed"));

async function waitForSearchResults(pageRef, title, timeoutMs = 45000) {
  await pageRef.waitForFunction(
    (productTitle) => {
      const hit = document.querySelector("[data-tasful-market-search-hit-count]")?.textContent || "";
      if (!/件/.test(hit)) return false;
      const cards = document.querySelectorAll(".tasful-market-search-card");
      if (cards.length) return true;
      const empty = document.querySelector("[data-tasful-market-search-empty]");
      return Boolean(empty && !empty.hidden);
    },
    title,
    { timeout: timeoutMs }
  );
}

let publishedProductId = "";

try {
  await page.addInitScript(
    ({ productsKey, profileKey, shopId }) => {
      try {
        if (sessionStorage.getItem("tasfulListingFlowInit") === "1") return;
        sessionStorage.setItem("tasfulListingFlowInit", "1");
        const existing = JSON.parse(localStorage.getItem(productsKey) || "[]").filter(
          (p) => p.title !== "TASFUL出品テスト商品"
        );
        localStorage.setItem(productsKey, JSON.stringify(existing));
        localStorage.setItem(profileKey, JSON.stringify({ shopId, shopName: "TASFULテストショップ", connectVerified: true }));
      } catch {
        /* ignore */
      }
    },
    { productsKey: SELLER_PRODUCTS_KEY, profileKey: SELLER_PROFILE_KEY, shopId: SHOP_ID }
  );

  await page.goto(buildLocalPageUrl(base, "shop-market-listing-new.html", `?shopId=${SHOP_ID}&v=${Date.now()}`), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForFunction(() => Boolean(window.TasfulMarketProductData?.validateListingInput));
  await page.waitForFunction(() => Boolean(window.__tasfulListingRunConfirmFromDom));

  await page.waitForSelector("[data-tasful-listing-form]", { timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('[data-tasful-listing-category] option[value="food"]') != null,
    null,
    { timeout: 10000 }
  );
  await page.waitForSelector('input[name="conditionType"]', { timeout: 10000 });

  const formPayload = {
    title: TEST_TITLE,
    image: TEST_IMAGE,
    price: "1680",
    seller: "TASFULテストショップ",
    stock: "5",
    category: "food",
    shipKey: "1-2",
    description: "出品フロー検証用のテスト商品です。",
  };

  await page.evaluate((payload) => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.value = val;
    };
    set("[data-tasful-listing-title]", payload.title);
    set("[data-tasful-listing-category]", payload.category);
    set("[data-tasful-listing-description]", payload.description);
    set("[data-tasful-listing-price]", payload.price);
    set("[data-tasful-listing-stock]", payload.stock);
    set("[data-tasful-listing-image]", payload.image);
    set("[data-tasful-listing-seller-name]", payload.seller);
    set("[data-tasful-listing-ship]", payload.shipKey);
    const tax = document.querySelector("[data-tasful-listing-tax]");
    const shipFree = document.querySelector("[data-tasful-listing-free-shipping]");
    const connect = document.querySelector("[data-tasful-listing-connect]");
    if (tax) tax.checked = true;
    if (shipFree) shipFree.checked = true;
    if (connect) connect.checked = true;
    const condition = document.querySelector('input[name="conditionType"][value="new"]');
    if (condition) condition.checked = true;
  }, formPayload);
  await page.waitForTimeout(200);
  await screenshot(page, "01-listing-form.png");

  const formChecks = await page.evaluate(() => {
    const form = document.querySelector("[data-tasful-listing-form]");
    return {
      ok_form: Boolean(form && !form.hidden),
      ok_inputs: document.querySelectorAll(".tasful-market-listing-field__input").length >= 6,
      ok_cta: Boolean(document.querySelector("[data-tasful-listing-to-confirm]")),
      ok_filled: Boolean(document.querySelector("[data-tasful-listing-title]")?.value),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  pushScreen("01-listing-form", "01-listing-form.png", page.url(), formChecks, [
    ...(formChecks.ok_form ? [] : ["出品フォームがありません"]),
    ...(formChecks.ok_inputs ? [] : ["入力欄が不足しています"]),
    ...(formChecks.ok_cta ? [] : ["確認ボタンがありません"]),
    ...(formChecks.ok_filled ? [] : ["フォーム入力が反映されていません"]),
    ...(formChecks.scrollWidth <= 391 ? [] : [`390px横崩れ: ${formChecks.scrollWidth}px`]),
  ]);

  const confirmRun = await page.evaluate((payload) => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.value = val;
    };
    set("[data-tasful-listing-title]", payload.title);
    set("[data-tasful-listing-category]", payload.category);
    set("[data-tasful-listing-description]", payload.description);
    set("[data-tasful-listing-price]", payload.price);
    set("[data-tasful-listing-stock]", payload.stock);
    set("[data-tasful-listing-image]", payload.image);
    set("[data-tasful-listing-seller-name]", payload.seller);
    set("[data-tasful-listing-ship]", payload.shipKey);
    const tax = document.querySelector("[data-tasful-listing-tax]");
    const shipFree = document.querySelector("[data-tasful-listing-free-shipping]");
    const connect = document.querySelector("[data-tasful-listing-connect]");
    if (tax) tax.checked = true;
    if (shipFree) shipFree.checked = true;
    if (connect) connect.checked = true;
    const condition = document.querySelector('input[name="conditionType"][value="new"]');
    if (condition) condition.checked = true;
    window.__tasfulListingRunConfirmFromDom?.();
    const confirm = document.querySelector("[data-tasful-listing-confirm]");
    const text = document.body.innerText || "";
    const confirmChecks = {
      ok_confirm: Boolean(confirm && !confirm.hidden),
      ok_title: text.includes(payload.title),
      ok_price: /¥1,680/.test(text),
      ok_connect: text.includes("Connect"),
      ok_publish: Boolean(document.querySelector("[data-tasful-listing-publish]")),
      ok_image: Boolean(document.querySelector("[data-tasful-listing-confirm-image][src]")),
      scrollWidth: document.documentElement.scrollWidth,
      error: document.querySelector("[data-tasful-listing-error]")?.textContent?.trim() || "",
    };
    if (!confirmChecks.ok_confirm) {
      return { phase: "confirm", ...confirmChecks };
    }
    return { phase: "confirm", ...confirmChecks };
  }, formPayload);
  if (!confirmRun.ok_confirm) {
    throw new Error(`確認画面への遷移に失敗: ${confirmRun.error || "不明"}`);
  }
  await screenshot(page, "02-listing-confirm.png");
  pushScreen("02-listing-confirm", "02-listing-confirm.png", page.url(), confirmRun, [
    ...(confirmRun.ok_confirm ? [] : ["確認画面が表示されていません"]),
    ...(confirmRun.ok_title ? [] : ["確認画面に商品名がありません"]),
    ...(confirmRun.ok_price ? [] : ["確認画面に価格がありません"]),
    ...(confirmRun.ok_publish ? [] : ["公開ボタンがありません"]),
    ...(confirmRun.scrollWidth <= 391 ? [] : [`390px横崩れ: ${confirmRun.scrollWidth}px`]),
  ]);

  const publishRun = await page.evaluate(() => {
    window.__tasfulListingRunPublish?.();
    const done = document.querySelector("[data-tasful-listing-done]");
    return {
      ok_done: Boolean(done && !done.hidden),
      doneHidden: done?.hidden,
      publishError: document.querySelector("[data-tasful-listing-error]")?.textContent?.trim() || "",
    };
  });
  if (publishRun.doneHidden) {
    throw new Error(`公開完了画面への遷移に失敗: ${publishRun.publishError || "不明なエラー"}`);
  }
  await screenshot(page, "03-listing-done.png");

  const storageMeta = await page.evaluate(
    ({ productsKey, title, shopId }) => {
      const list = JSON.parse(localStorage.getItem(productsKey) || "[]");
      const entry = list.find((p) => p.title === title && p.shopId === shopId);
      return {
        count: list.length,
        entry,
        productId: entry?.productId || "",
      };
    },
    { productsKey: SELLER_PRODUCTS_KEY, title: TEST_TITLE, shopId: SHOP_ID }
  );
  publishedProductId = storageMeta.productId;

  const doneChecks = {
    ok_done: true,
    ok_storage: Boolean(storageMeta.entry),
    ok_imageStored: Boolean(storageMeta.entry?.image || storageMeta.entry?.imageUrl),
    storageCount: storageMeta.count,
    productId: storageMeta.productId,
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
  };
  pushScreen("03-listing-done", "03-listing-done.png", page.url(), doneChecks, [
    ...(doneChecks.ok_storage ? [] : ["localStorageに出品商品が保存されていません"]),
    ...(doneChecks.ok_imageStored ? [] : ["保存データに画像URLがありません"]),
    ...(doneChecks.scrollWidth <= 391 ? [] : [`390px横崩れ: ${doneChecks.scrollWidth}px`]),
  ]);

  const searchUrl = buildLocalPageUrl(base, "shop-search.html", `?keyword=${encodeURIComponent(TEST_TITLE)}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await waitForSearchResults(page, TEST_TITLE);
  await page.waitForTimeout(300);
  const searchBroken = await countBrokenImages(page);
  await screenshot(page, "04-search-reflect.png");

  const searchChecks = {
    ...(await page.evaluate((title) => ({
      ok_card: [...document.querySelectorAll(".tasful-market-search-card__title")].some((el) =>
        (el.textContent || "").includes(title)
      ),
      cardCount: document.querySelectorAll(".tasful-market-search-card").length,
      hitCountText: document.querySelector("[data-tasful-market-search-hit-count]")?.textContent || "",
      scrollWidth: document.documentElement.scrollWidth,
    }), TEST_TITLE)),
    brokenImages: searchBroken,
  };
  pushScreen("04-search-reflect", "04-search-reflect.png", searchUrl, searchChecks, [
    ...(searchChecks.ok_card ? [] : ["検索結果に出品商品が表示されていません"]),
    ...(searchChecks.scrollWidth <= 391 ? [] : [`390px横崩れ: ${searchChecks.scrollWidth}px`]),
    ...(searchChecks.brokenImages === 0 ? [] : [`画像リンク切れ: ${searchChecks.brokenImages}件`]),
  ]);

  const sellerUrl = buildLocalPageUrl(base, "shop-market-seller.html", `?shopId=${SHOP_ID}`);
  await page.goto(sellerUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForFunction(
    () => {
      const grid = document.querySelector("[data-tasful-seller-products]");
      if (!grid) return false;
      return grid.querySelector(".tasful-market-grid-card") != null || grid.querySelector(".tasful-market-seller-products__empty") != null;
    },
    null,
    { timeout: 45000 }
  );
  await page.waitForTimeout(300);
  const sellerBroken = await countBrokenImages(page);
  await screenshot(page, "05-seller-reflect.png");

  const sellerChecks = {
    ...(await page.evaluate((title) => ({
      ok_gridCard: [...document.querySelectorAll(".tasful-market-grid-card__title")].some((el) =>
        (el.textContent || "").includes(title)
      ),
      ok_addLink: Boolean(document.querySelector("[data-tasful-seller-add-product-inline][href*='listing-new']")),
      productCount: document.querySelectorAll(".tasful-market-grid-card").length,
      scrollWidth: document.documentElement.scrollWidth,
    }), TEST_TITLE)),
    brokenImages: sellerBroken,
  };
  pushScreen("05-seller-reflect", "05-seller-reflect.png", sellerUrl, sellerChecks, [
    ...(sellerChecks.ok_gridCard ? [] : ["出品者ページに商品が表示されていません"]),
    ...(sellerChecks.ok_addLink ? [] : ["商品を追加リンクがありません"]),
    ...(sellerChecks.scrollWidth <= 391 ? [] : [`390px横崩れ: ${sellerChecks.scrollWidth}px`]),
    ...(sellerChecks.brokenImages === 0 ? [] : [`画像リンク切れ: ${sellerChecks.brokenImages}件`]),
  ]);
} catch (err) {
  screens.push({
    id: "fatal",
    file: "",
    url: page.url(),
    pass: false,
    checks: {},
    errors: [String(err?.message || err)],
  });
} finally {
  await browser.close();
  staticServer?.close?.();
}

const overallPass = screens.length === 5 && screens.every((s) => s.pass);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  viewport: VIEWPORT,
  screenshotsDir: OUT_DIR.replace(/\\/g, "/"),
  shopId: SHOP_ID,
  testTitle: TEST_TITLE,
  publishedProductId,
  overallPass,
  passCount: screens.filter((s) => s.pass).length,
  failCount: screens.filter((s) => !s.pass).length,
  screens,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ overallPass, passCount: report.passCount, failCount: report.failCount, reportPath: REPORT_PATH }, null, 2));
process.exit(overallPass ? 0 : 1);
