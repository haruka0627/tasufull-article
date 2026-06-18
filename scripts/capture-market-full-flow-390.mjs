/**
 * TASFUL市場 — 購入者・出品者導線 全画面 390px スクリーンショット検証
 * localhost 必須（file:// 禁止）
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
const OUT_DIR = path.join(ROOT, "screenshots", "market-full-flow-390");
const REPORT_PATH = path.join(OUT_DIR, "report.json");
const STATIC_PORT = 8798;

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
const PRODUCT = {
  shopId: "demo-shop-tasful-bakery",
  productId: "p-0",
};
const ORDER_HISTORY_KEY = "tasu_market_order_history";
const CART_COUNT_KEY = "tasu_market_cart_count";
const CART_ITEMS_KEY = "tasu_market_cart_items";

function parseOrderId(text) {
  return String(text || "")
    .replace(/^注文番号:\s*/, "")
    .trim();
}

function orderCardSelector(orderId) {
  return `[data-tasful-seller-order-card][data-order-id="${String(orderId || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/** @type {Array<{ id: string, file: string, url: string, pass: boolean, checks: Record<string, unknown>, errors: string[] }>} */
const screens = [];

function pushScreen(id, file, url, checks, errors = []) {
  const failed = errors.length > 0 || Object.entries(checks).some(([k, v]) => k.startsWith("ok_") && v === false);
  screens.push({
    id,
    file,
    url,
    pass: !failed,
    checks,
    errors,
  });
}

function commonChecks(result) {
  const errors = [];
  if (!result.hasHeader) errors.push("市場ヘッダーが見つかりません");
  if (!result.hasSearchBar) errors.push("検索バーが見つかりません");
  if (!result.hasCartBadgeEl) errors.push("カート件数バッジ要素が見つかりません");
  if (!result.noHorizontalOverflow) errors.push(`390px横崩れ: scrollWidth=${result.scrollWidth}`);
  return errors;
}

async function countBrokenImages(page) {
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
    });
  });
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img[src]")];
    const waitForImg = (img, ms = 4000) =>
      new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, ms);
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    await Promise.all(imgs.map((img) => waitForImg(img)));
    return imgs.filter((img) => {
      const src = (img.getAttribute("src") || "").trim();
      if (!src) return true;
      return img.complete && img.naturalWidth === 0;
    }).length;
  });
}

async function screenshot(page, filename) {
  const filePath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function evalCommon(page) {
  return page.evaluate(() => {
    const header = document.querySelector("[data-tasful-market-header]");
    const search = document.querySelector("[data-tasful-market-search-input]");
    const cartBadge = document.querySelector("[data-tasful-market-cart-count]");
    const scrollWidth = document.documentElement.scrollWidth;
    return {
      hasHeader: Boolean(header && header.getBoundingClientRect().height > 0),
      hasSearchBar: Boolean(search && search.getBoundingClientRect().height >= 36),
      hasCartBadgeEl: Boolean(cartBadge),
      cartCountVisible: cartBadge ? !cartBadge.hidden : false,
      cartCountText: cartBadge?.textContent?.trim() || "0",
      noHorizontalOverflow: scrollWidth <= 391,
      scrollWidth,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

await page.addInitScript(
  ({ historyKey, cartCountKey, cartItemsKey }) => {
    try {
      if (sessionStorage.getItem("tasuMarketFullFlowInit") === "1") return;
      sessionStorage.setItem("tasuMarketFullFlowInit", "1");
      localStorage.removeItem(historyKey);
      localStorage.setItem(cartCountKey, "0");
      localStorage.removeItem(cartItemsKey);
    } catch {
      /* ignore */
    }
  },
  { historyKey: ORDER_HISTORY_KEY, cartCountKey: CART_COUNT_KEY, cartItemsKey: CART_ITEMS_KEY }
);

await page.route(/supabase\.co/i, (route) => route.abort("failed"));

let flowOrderId = "";
let flowProductId = PRODUCT.productId;

try {
  // ── 1. 市場TOP ──
  const topUrl = buildLocalPageUrl(base, "shop-store.html");
  await page.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-card", { timeout: 20000 });
  await page.waitForTimeout(500);
  await screenshot(page, "01-market-top.png");
  const topCommon = await evalCommon(page);
  const topSpecific = await page.evaluate(() => ({
    ok_shelves: document.querySelectorAll(".tasful-market-section").length >= 3,
    shelfCardCount: document.querySelectorAll(".tasful-market-card").length,
    hasTimesale: Boolean(document.querySelector("#tasful-market-timesale-section")),
    hasPopular: Boolean(document.querySelector("#tasful-market-rank-section")),
  }));
  pushScreen("01-market-top", "01-market-top.png", topUrl, { ...topCommon, ...topSpecific }, [
    ...commonChecks(topCommon),
    ...(topSpecific.ok_shelves ? [] : ["商品棚が不足しています"]),
  ]);

  // ── 2. 検索結果 ──
  const searchUrl = buildLocalPageUrl(base, "shop-search.html", "?keyword=コーヒー");
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-search-card", { timeout: 20000 });
  await page.waitForTimeout(400);
  const searchBrokenImages = await countBrokenImages(page);
  await screenshot(page, "02-search.png");
  const searchCommon = await evalCommon(page);
  const searchSpecific = await page.evaluate(() => {
    const grid = document.querySelector("[data-tasful-market-search-grid]");
    const gridStyle = grid ? getComputedStyle(grid) : null;
    const cols = gridStyle?.gridTemplateColumns || "";
    const colParts = cols.split(/\s+/).filter(Boolean);
    const hitNodes = document.querySelectorAll("[data-tasful-market-search-hit-count]");
    return {
      ok_twoColGrid: /repeat\(\s*2/i.test(cols) || colParts.length >= 2,
      gridTemplateColumns: cols,
      cardCount: document.querySelectorAll(".tasful-market-search-card").length,
      ok_filters: Boolean(document.querySelector("[data-tasful-market-search-filters]")?.children.length),
      ok_sort: Boolean(document.querySelector("[data-tasful-market-search-sort]")),
      hitCountText: document.querySelector("[data-tasful-market-search-hit-count]")?.textContent?.trim() || "",
      ok_hitCount: hitNodes.length === 1 && /件/.test(hitNodes[0]?.textContent || ""),
      ok_hitKeyword: (hitNodes[0]?.textContent || "").includes("コーヒー"),
    };
  });
  pushScreen("02-search", "02-search.png", searchUrl, { ...searchCommon, ...searchSpecific, brokenImages: searchBrokenImages }, [
    ...commonChecks(searchCommon),
    ...(searchSpecific.cardCount >= 1 ? [] : ["検索結果カードがありません"]),
    ...(searchSpecific.ok_twoColGrid ? [] : ["2列グリッドではありません"]),
    ...(searchSpecific.ok_filters ? [] : ["フィルターが表示されていません"]),
    ...(searchSpecific.ok_sort ? [] : ["並び替えが表示されていません"]),
    ...(searchSpecific.ok_hitCount ? [] : ["検索件数表示がありません"]),
    ...(searchSpecific.ok_hitKeyword ? [] : ["検索キーワードが件数に反映されていません"]),
    ...(searchBrokenImages === 0 ? [] : [`画像リンク切れ: ${searchBrokenImages}件`]),
  ]);

  // ── 3. 商品詳細 ──
  const detailUrl = buildLocalPageUrl(
    base,
    "detail-shop-product.html",
    `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: 20000 });
  await page.waitForSelector("[data-tasful-product-image][src]", { timeout: 15000 });
  await page.waitForTimeout(400);
  const detailBrokenImages = await countBrokenImages(page);
  await screenshot(page, "03-product-detail.png");
  const detailCommon = await evalCommon(page);
  const detailSpecific = await page.evaluate(() => {
    const img = document.querySelector("[data-tasful-product-image]");
    const imgRect = img?.getBoundingClientRect();
    const imgSrc = img?.getAttribute("src") || "";
    const connectEl = document.querySelector("[data-tasful-product-connect]");
    const connectText = document.body.innerText || "";
    return {
      ok_mainImage: Boolean(imgSrc && imgRect && imgRect.width > 40 && imgRect.height > 40),
      ok_breadImage: imgSrc.includes("photo-1549931319") && !imgSrc.includes("photo-1486427948969"),
      ok_addCart: Boolean(document.querySelector("[data-tasful-product-add-cart]")),
      ok_buyNow: Boolean(document.querySelector("[data-tasful-product-buy-now]")),
      ok_connect: Boolean(connectEl && !connectEl.hidden) || connectText.includes("Connect"),
      ok_sellerCard: Boolean(document.querySelector("[data-tasful-product-seller-card]")),
      ok_sellerName: Boolean(document.querySelector("[data-tasful-product-seller-name]")?.textContent?.trim()),
      ok_qtySelect: Boolean(document.querySelector("[data-tasful-product-qty]")),
      productTitle: document.querySelector("[data-tasful-product-title]")?.textContent?.trim() || "",
      imgSrc,
    };
  });
  pushScreen("03-product-detail", "03-product-detail.png", detailUrl, { ...detailCommon, ...detailSpecific, brokenImages: detailBrokenImages }, [
    ...commonChecks(detailCommon),
    ...(detailSpecific.ok_mainImage ? [] : ["メイン画像が表示されていません"]),
    ...(detailSpecific.ok_breadImage ? [] : ["p-0商品の画像が不一致です"]),
    ...(detailSpecific.ok_addCart ? [] : ["カートに入れるボタンがありません"]),
    ...(detailSpecific.ok_buyNow ? [] : ["今すぐ購入ボタンがありません"]),
    ...(detailSpecific.ok_connect ? [] : ["Connect認証表示がありません"]),
    ...(detailSpecific.ok_sellerCard ? [] : ["出品者カードがありません"]),
    ...(detailBrokenImages === 0 ? [] : [`画像リンク切れ: ${detailBrokenImages}件`]),
  ]);

  // カート準備: 数量2でカート追加
  await page.selectOption("[data-tasful-product-qty]", "2");
  await page.click("[data-tasful-product-add-cart]");
  await page.waitForTimeout(400);

  // ── 4. カート ──
  const cartUrl = buildLocalPageUrl(base, "shop-market-cart.html");
  await page.goto(cartUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-market-cart-items]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(400);
  await screenshot(page, "04-cart.png");
  const cartCommon = await evalCommon(page);
  const cartSpecific = await page.evaluate(() => ({
    ok_items: document.querySelectorAll(".tasful-market-cart-item").length >= 1,
    ok_quantity: /数量\s*2/.test(document.body.innerText || ""),
    ok_checkout: Boolean(document.querySelector("[data-tasful-market-cart-checkout]:not([hidden])")),
    ok_noSearchBtn: !document.body.innerText.includes("商品を探す"),
    itemCount: document.querySelectorAll(".tasful-market-cart-item").length,
    summaryText: document.querySelector("[data-tasful-market-cart-summary]")?.textContent?.trim() || "",
  }));
  pushScreen("04-cart", "04-cart.png", cartUrl, { ...cartCommon, ...cartSpecific }, [
    ...commonChecks(cartCommon),
    ...(cartSpecific.ok_items ? [] : ["カート商品が表示されていません"]),
    ...(cartSpecific.ok_quantity ? [] : ["数量表示（数量2）が確認できません"]),
    ...(cartSpecific.ok_checkout ? [] : ["注文確認へ進むボタンがありません"]),
    ...(cartSpecific.ok_noSearchBtn ? [] : ["カートに商品を探すが残っています"]),
  ]);

  // ── 5. 注文確認 ──
  const checkoutUrl = buildLocalPageUrl(
    base,
    "shop-market-checkout.html",
    `?mode=buyNow&shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}&quantity=1`
  );
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(400);
  await screenshot(page, "05-checkout.png");
  const checkoutCommon = await evalCommon(page);
  const checkoutSpecific = await page.evaluate(() => {
    const submitBtn = document.querySelector("[data-tasful-checkout-submit]");
    const submitStyle = submitBtn ? getComputedStyle(submitBtn) : null;
    const totalText = document.querySelector(".tasful-market-checkout-totals .is-total dd")?.textContent || "";
    const barSummary = document.querySelector("[data-tasful-checkout-bar-summary]")?.textContent || "";
    return {
      ok_address: Boolean(document.querySelector("[data-tasful-checkout-address]")?.textContent?.includes("山田")),
      ok_payment: Boolean(document.querySelector('[data-tasful-checkout-payment] input[value="card"]')?.checked),
      ok_items: document.querySelectorAll(".tasful-market-checkout-item").length >= 1,
      ok_total: /¥/.test(totalText),
      ok_submit: Boolean(submitBtn?.textContent?.includes("注文を確定")),
      ok_barSummary: /注文合計：¥/.test(barSummary) && barSummary.includes("税込"),
      submitYellow:
        submitStyle?.backgroundColor === "rgb(255, 216, 20)" ||
        (submitStyle?.backgroundColor || "").includes("255, 216"),
      totalText,
      barSummary,
    };
  });
  pushScreen("05-checkout", "05-checkout.png", checkoutUrl, { ...checkoutCommon, ...checkoutSpecific }, [
    ...commonChecks(checkoutCommon),
    ...(checkoutSpecific.ok_address ? [] : ["お届け先が表示されていません"]),
    ...(checkoutSpecific.ok_payment ? [] : ["支払い方法が表示されていません"]),
    ...(checkoutSpecific.ok_items ? [] : ["注文商品がありません"]),
    ...(checkoutSpecific.ok_total ? [] : ["合計金額が表示されていません"]),
    ...(checkoutSpecific.ok_submit ? [] : ["注文を確定するボタンがありません"]),
    ...(checkoutSpecific.ok_barSummary ? [] : ["CTA直上の注文合計サマリーがありません"]),
  ]);

  // ── 6. 注文完了 ──
  await page.click("[data-tasful-checkout-submit]");
  await page.waitForURL(/shop-market-complete\.html/, { waitUntil: "domcontentloaded", timeout: 15000 });
  const completeUrl = page.url();
  await assertPlaywrightLocalhostPage(page);
  await page.waitForTimeout(400);
  await screenshot(page, "06-complete.png");
  const completeCommon = await evalCommon(page);
  const completeSpecific = await page.evaluate(() => ({
    ok_orderId: Boolean(document.querySelector("[data-tasful-complete-order-id]")?.textContent?.includes("TM-")),
    ok_historyCta: Boolean(document.querySelector('a[href="shop-market-order-history.html"]')),
    ok_topReturn: Boolean(document.body.innerText.includes("トップへ戻る")),
    ok_noSearchBtn: !document.body.innerText.includes("商品を探す"),
    orderIdText: document.querySelector("[data-tasful-complete-order-id]")?.textContent?.trim() || "",
    totalText: document.querySelector("[data-tasful-complete-total]")?.textContent?.trim() || "",
  }));
  pushScreen("06-complete", "06-complete.png", completeUrl, { ...completeCommon, ...completeSpecific }, [
    ...commonChecks(completeCommon),
    ...(completeSpecific.ok_orderId ? [] : ["注文番号が表示されていません"]),
    ...(completeSpecific.ok_historyCta ? [] : ["注文履歴を見るリンクがありません"]),
    ...(completeSpecific.ok_topReturn ? [] : ["トップへ戻るリンクがありません"]),
    ...(completeSpecific.ok_noSearchBtn ? [] : ["完了ページに商品を探すが残っています"]),
  ]);

  flowOrderId = parseOrderId(completeSpecific.orderIdText);
  if (!flowOrderId) {
    const orderMetaFromStorage = await page.evaluate((key) => {
      try {
        const history = JSON.parse(localStorage.getItem(key) || "[]");
        const entry = history.find((h) => String(h.shopId || "") === "demo-shop-tasful-bakery") || history[0];
        return entry ? { orderId: String(entry.orderId || ""), productId: String(entry.productId || "") } : null;
      } catch {
        return null;
      }
    }, ORDER_HISTORY_KEY);
    flowOrderId = orderMetaFromStorage?.orderId || "";
    flowProductId = orderMetaFromStorage?.productId || PRODUCT.productId;
  }

  // ── 7. 注文履歴 ──
  const historyUrl = buildLocalPageUrl(base, "shop-market-order-history.html");
  await page.goto(historyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-order-history-list]:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(300);
  await screenshot(page, "07-order-history.png");
  const historyCommon = await evalCommon(page);
  let historyExpandOk = false;
  await page.click("[data-tasful-order-toggle]");
  await page.waitForSelector("[data-tasful-order-detail]:not([hidden])", { timeout: 5000 }).catch(() => {});
  const historySpecific = await page.evaluate(() => {
    const detail = document.querySelector("[data-tasful-order-detail]:not([hidden])");
    const detailText = detail?.innerText || "";
    return {
      ok_cards: document.querySelectorAll("[data-tasful-order-card]").length >= 1,
      ok_expand: Boolean(detail && !detail.hidden),
      ok_detailPayment: detailText.includes("支払い方法"),
      ok_detailAddress: detailText.includes("配送先"),
      cardCount: document.querySelectorAll("[data-tasful-order-card]").length,
    };
  });
  historyExpandOk = historySpecific.ok_expand;
  pushScreen("07-order-history", "07-order-history.png", historyUrl, { ...historyCommon, ...historySpecific }, [
    ...commonChecks(historyCommon),
    ...(historySpecific.ok_cards ? [] : ["注文カードがありません"]),
    ...(historyExpandOk ? [] : ["注文詳細の展開に失敗しました"]),
  ]);

  // ── 8. マイページ ──
  const mypageUrl = buildLocalPageUrl(base, "shop-market-mypage.html");
  await page.goto(mypageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector(".tasful-market-mypage-grid", { timeout: 15000 });
  await page.waitForTimeout(400);
  await screenshot(page, "08-mypage.png");
  const mypageCommon = await evalCommon(page);
  const mypageSpecific = await page.evaluate(() => {
    const sections = [...document.querySelectorAll(".tasful-market-mypage-section__title")].map((el) => el.textContent?.trim());
    const gridStyle = getComputedStyle(document.querySelector(".tasful-market-mypage-grid"));
    const cols = gridStyle.gridTemplateColumns || "";
    const colParts = cols.split(/\s+/).filter(Boolean);
    return {
      ok_purchase: sections.some((s) => s?.includes("購入")),
      ok_account: sections.some((s) => s?.includes("アカウント")),
      ok_market: sections.some((s) => s?.includes("市場")),
      ok_support: sections.some((s) => s?.includes("サポート")),
      ok_twoCol: /repeat\(\s*2/i.test(cols) || colParts.length >= 2,
      gridTemplateColumns: cols,
      cardCount: document.querySelectorAll(".tasful-market-mypage-card").length,
      sections,
    };
  });
  pushScreen("08-mypage", "08-mypage.png", mypageUrl, { ...mypageCommon, ...mypageSpecific }, [
    ...commonChecks(mypageCommon),
    ...(mypageSpecific.ok_purchase ? [] : ["【購入】セクションがありません"]),
    ...(mypageSpecific.ok_account ? [] : ["【アカウント】セクションがありません"]),
    ...(mypageSpecific.ok_market ? [] : ["【市場】セクションがありません"]),
    ...(mypageSpecific.ok_support ? [] : ["【サポート】セクションがありません"]),
    ...(mypageSpecific.ok_twoCol ? [] : ["2列カードレイアウトではありません"]),
  ]);

  // ── 9. 出品者注文管理 ──
  await page.evaluate(
    ({ historyKey, shopId, productId, orderId, productName }) => {
      const Data = window.TasfulMarketProductData;
      if (!orderId) return false;
      if (Data?.ensureSellerOrderEntry) {
        Data.ensureSellerOrderEntry({
          orderId,
          shopId,
          productId,
          productName: productName || "洋書 milk and honey (rupi kaur)",
          sellerName: "TASFUL Bakery",
          shopName: "TASFUL Bakery",
          price: 480,
          subtotal: 480,
          orderTotal: 480,
          quantity: 1,
          status: "注文受付",
        });
        return true;
      }
      try {
        const raw = JSON.parse(localStorage.getItem(historyKey) || "[]");
        const next = raw.map((item) => {
          if (String(item.orderId) === orderId && String(item.productId) === productId) {
            return { ...item, status: "注文受付" };
          }
          return item;
        });
        localStorage.setItem(historyKey, JSON.stringify(next));
        return true;
      } catch {
        return false;
      }
    },
    {
      historyKey: ORDER_HISTORY_KEY,
      shopId: PRODUCT.shopId,
      productId: flowProductId,
      orderId: flowOrderId,
      productName: "洋書 milk and honey (rupi kaur)",
    }
  );

  const sellerOrdersUrl = buildLocalPageUrl(
    base,
    "shop-market-seller-orders.html",
    `?shopId=${PRODUCT.shopId}`
  );
  await page.goto(sellerOrdersUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-seller-orders-list]:not([hidden])", { timeout: 20000 });
  await page.waitForFunction(
    (orderId) => {
      const card = document.querySelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`);
      return Boolean(card && card.querySelector("[data-tasful-seller-status-btn]"));
    },
    flowOrderId,
    { timeout: 20000 }
  );
  await page.waitForTimeout(200);
  await screenshot(page, "09-seller-orders.png");
  const sellerOrdersCommon = await evalCommon(page);
  const cardSel = orderCardSelector(flowOrderId);
  const sellerOrdersBefore = await page.evaluate((sel) => {
    const card = document.querySelector(sel);
    return {
      ok_list: Boolean(card),
      ok_statusButtons: card ? card.querySelectorAll("[data-tasful-seller-status-btn]").length >= 4 : false,
      hasShippingPrep: Boolean(card?.querySelector('[data-tasful-seller-status-btn][data-status="発送準備中"]')),
      hasShipped: Boolean(card?.querySelector('[data-tasful-seller-status-btn][data-status="発送済み"]')),
      hasDelivered: Boolean(card?.querySelector('[data-tasful-seller-status-btn][data-status="配達完了"]')),
      initialStatus: card?.querySelector("[data-tasful-seller-order-status]")?.textContent?.trim() || "",
      orderId: card?.getAttribute("data-order-id") || "",
    };
  }, cardSel);

  for (const status of ["発送準備中", "発送済み", "配達完了"]) {
    await page.click(`${cardSel} [data-tasful-seller-status-btn][data-status="${status}"]`);
    await page.waitForFunction(
      ({ sel, expected }) =>
        document.querySelector(`${sel} [data-tasful-seller-order-status]`)?.textContent?.trim() === expected,
      { sel: cardSel, expected: status },
      { timeout: 5000 }
    );
  }

  const sellerOrdersAfter = await page.evaluate(
    ({ historyKey, orderId, productId, cardSel }) => {
      const uiStatus = document.querySelector(`${cardSel} [data-tasful-seller-order-status]`)?.textContent?.trim();
      let storedStatus = "";
      try {
        const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
        const entry = history.find(
          (h) => String(h.orderId) === String(orderId) && String(h.productId) === String(productId)
        );
        storedStatus = entry?.status || "";
      } catch {
        /* ignore */
      }
      return {
        uiStatus,
        storedStatus,
        orderId,
        productId,
        ok_statusChange: uiStatus === "配達完了" && storedStatus === "配達完了",
      };
    },
    { historyKey: ORDER_HISTORY_KEY, orderId: flowOrderId, productId: flowProductId, cardSel }
  );

  pushScreen(
    "09-seller-orders",
    "09-seller-orders.png",
    sellerOrdersUrl,
    { ...sellerOrdersCommon, ...sellerOrdersBefore, ...sellerOrdersAfter },
    [
      ...commonChecks(sellerOrdersCommon),
      ...(sellerOrdersBefore.ok_list ? [] : ["出品者注文一覧がありません"]),
      ...(sellerOrdersBefore.ok_statusButtons ? [] : ["ステータス変更ボタンが不足しています"]),
      ...(sellerOrdersBefore.hasShippingPrep ? [] : ["発送準備中ボタンがありません"]),
      ...(sellerOrdersBefore.hasShipped ? [] : ["発送済みボタンがありません"]),
      ...(sellerOrdersBefore.hasDelivered ? [] : ["配達完了ボタンがありません"]),
      ...(flowOrderId ? [] : ["検証用注文IDが取得できません"]),
      ...(sellerOrdersAfter.ok_statusChange ? [] : ["ステータス同期に失敗しました"]),
    ]
  );

  // ── 10. 出品者ページ ──
  const sellerUrl = buildLocalPageUrl(base, "shop-market-seller.html", `?shopId=${PRODUCT.shopId}`);
  await page.goto(sellerUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForSelector("[data-tasful-seller-hero]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(400);
  await screenshot(page, "10-seller-page.png");
  const sellerCommon = await evalCommon(page);
  const sellerSpecific = await page.evaluate(() => {
    const bodyText = document.body.innerText || "";
    return {
      ok_shopName: Boolean(document.querySelector("[data-tasful-seller-name]")?.textContent?.trim()),
      ok_rating: (document.querySelector("[data-tasful-seller-rating]")?.textContent || "").includes("★"),
      ok_connect: bodyText.includes("Connect"),
      ok_products: document.querySelectorAll(".tasful-market-grid-card").length >= 1,
      shopName: document.querySelector("[data-tasful-seller-name]")?.textContent?.trim() || "",
      productCount: document.querySelectorAll(".tasful-market-grid-card").length,
    };
  });
  pushScreen("10-seller-page", "10-seller-page.png", sellerUrl, { ...sellerCommon, ...sellerSpecific }, [
    ...commonChecks(sellerCommon),
    ...(sellerSpecific.ok_shopName ? [] : ["ショップ名が表示されていません"]),
    ...(sellerSpecific.ok_rating ? [] : ["評価が表示されていません"]),
    ...(sellerSpecific.ok_connect ? [] : ["Connect認証が表示されていません"]),
    ...(sellerSpecific.ok_products ? [] : ["商品一覧がありません"]),
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

const overallPass = screens.length === 10 && screens.every((s) => s.pass);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  viewport: VIEWPORT,
  screenshotsDir: OUT_DIR.replace(/\\/g, "/"),
  product: PRODUCT,
  overallPass,
  passCount: screens.filter((s) => s.pass).length,
  failCount: screens.filter((s) => !s.pass).length,
  screens,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

console.log(JSON.stringify({ overallPass, passCount: report.passCount, failCount: report.failCount, reportPath: REPORT_PATH }, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(overallPass ? 0 : 1);
