#!/usr/bin/env node
/**
 * TASFUL市場 — 通知デモプレイ（390px 静止画・E2E補助）
 * 提出優先は動画: npm run demo:market-notify-video
 * 購入〜レビュー依頼の6通知を実画面で検証・スクリーンショット提出
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { devices } from "playwright";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots", "market-notify-390");
const REPORT_PATH = path.join(OUT_DIR, "report.json");

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const BUYER_ID = "u_me";
const SELLER_ID = "u_bakery";
const VIEWPORT = { width: 390, height: 844 };

const NOTIFY_CASES = [
  {
    id: "01-purchase",
    slug: "purchase",
    notifyIdPrefix: "market-order-purchase-",
    recipient: "seller",
    title: "新しい注文が入りました",
    actionLabel: "注文を確認する",
    destPattern: /shop-market-seller-orders\.html/i,
    destHint: "出品者注文管理",
    sellerAction: null,
  },
  {
    id: "02-order-accepted",
    slug: "order-accepted",
    notifyIdPrefix: "market-order-accepted-",
    recipient: "buyer",
    title: "注文を受け付けました",
    actionLabel: "注文履歴を見る",
    destPattern: /shop-market-order-history\.html/i,
    destHint: "注文履歴",
    sellerAction: "注文受付",
  },
  {
    id: "03-preparing",
    slug: "preparing",
    notifyIdPrefix: "market-order-preparing-",
    recipient: "buyer",
    title: "発送準備中です",
    actionLabel: "注文詳細を見る",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
    destHint: "注文詳細（展開）",
    sellerAction: "発送準備中",
  },
  {
    id: "04-shipped",
    slug: "shipped",
    notifyIdPrefix: "market-order-shipped-",
    recipient: "buyer",
    title: "商品を発送しました",
    actionLabel: "注文詳細を見る",
    destPattern: /shop-market-order-history\.html.*detail=1/i,
    destHint: "注文詳細（展開）",
    sellerAction: "発送済み",
  },
  {
    id: "05-delivered",
    slug: "delivered",
    notifyIdPrefix: "market-order-delivered-",
    recipient: "buyer",
    title: "配達が完了しました",
    actionLabel: "注文履歴を見る",
    destPattern: /shop-market-order-history\.html/i,
    destHint: "注文履歴",
    sellerAction: "配達完了",
  },
  {
    id: "06-review",
    slug: "review",
    notifyIdPrefix: "market-order-review-",
    recipient: "buyer",
    title: "レビューをお願いします",
    actionLabel: "レビューをする",
    destPattern: /detail-shop-product\.html.*review=1/i,
    destHint: "商品レビュー",
    sellerAction: null,
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function talkNotifyUrl(base, userId) {
  return buildLocalPageUrl(
    base,
    "talk-home.html",
    `?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

function uiAudit(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    const issues = [];
    if (scrollW > vw + 1) issues.push(`横スクロール: ${scrollW}px > ${vw}px`);
    document.querySelectorAll("button, a[data-talk-notify-action], .talk-notify-card__cta").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.whiteSpace === "nowrap" && el.textContent?.trim().length === 1) {
        issues.push(`1文字縦折返し候補: ${el.textContent?.trim()}`);
      }
      if (rect.right > vw + 1) issues.push(`要素はみ出し: ${el.textContent?.trim()?.slice(0, 20)}`);
      if (rect.width > 0 && rect.height > 0 && rect.height < 32 && /btn|cta/i.test(el.className)) {
        issues.push(`ボタン高さ不足: ${Math.round(rect.height)}px`);
      }
    });
    return { vw, scrollW, issues };
  });
}

/** @type {Array<object>} */
const results = [];
let orderId = "";

const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({
  ...devices["iPhone 13"],
  viewport: VIEWPORT,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.goto(buildLocalPageUrl(base, "shop-store.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.evaluate(() => {
    localStorage.removeItem("tasu_market_order_history");
    localStorage.removeItem("tasu_market_last_order");
    localStorage.removeItem("tasu_market_cart_count");
    localStorage.removeItem("tasu_market_cart_items");
    localStorage.removeItem("tasu_market_notify_sent_v1");
    localStorage.removeItem("tasful_talk_notifications");
    sessionStorage.removeItem("tasuMarketFullFlowInit");
  });

  const detailUrl = buildLocalPageUrl(
    base,
    "detail-shop-product.html",
    `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-tasful-product-buy-now]", { timeout: 20000 });
  await page.click("[data-tasful-product-buy-now]");
  await page.waitForURL(/shop-market-checkout\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-tasful-checkout-submit]", { timeout: 15000 });
  await page.click("[data-tasful-checkout-submit]");
  await page.waitForURL(/shop-market-complete\.html/, { timeout: 15000 });
  orderId = await page.evaluate(() => {
    const text = document.querySelector("[data-tasful-complete-order-id]")?.textContent || "";
    return text.replace(/^注文番号:\s*/, "").trim();
  });
  if (!orderId) throw new Error("注文IDを取得できません");

  const sellerOrdersUrl = buildLocalPageUrl(
    base,
    "shop-market-seller-orders.html",
    `?shopId=${PRODUCT.shopId}`
  );

  for (const spec of NOTIFY_CASES) {
    const row = {
      id: spec.id,
      slug: spec.slug,
      title: spec.title,
      pass: false,
      errors: [],
      notifyId: `${spec.notifyIdPrefix}${orderId}`,
      recipient: spec.recipient,
      expectedDest: spec.destHint,
      screenshots: {},
      audit: {},
    };

    if (spec.sellerAction) {
      await page.goto(sellerOrdersUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(`[data-tasful-seller-order-card][data-order-id="${orderId}"]`, { timeout: 15000 });
      await page.click(
        `[data-tasful-seller-order-card][data-order-id="${orderId}"] [data-tasful-seller-status-btn][data-status="${spec.sellerAction}"]`
      );
      await page.waitForTimeout(400);
    }

    const userId = spec.recipient === "seller" ? SELLER_ID : BUYER_ID;
    const notifyUrl = talkNotifyUrl(base, userId);
    await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
    await page.evaluate((notifyId) => {
      document.querySelector(`[data-talk-notify-id="${notifyId}"]`)?.scrollIntoView({ block: "center" });
    }, row.notifyId);
    await page.waitForSelector(`[data-talk-notify-id="${row.notifyId}"]`, { timeout: 20000 });
    await page.waitForTimeout(700);

    const cardAudit = await page.evaluate((notifyId) => {
      const card = document.querySelector(`[data-talk-notify-id="${notifyId}"]`);
      const cta = card?.querySelector("[data-talk-notify-action]");
      const titleEl = card?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event");
      const bodyEl = card?.querySelector(".talk-notify-card__body, .talk-notify-card__message");
      const stored =
        window.TasuTalkNotifications?.findById?.(notifyId) ||
        (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find((n) => n.id === notifyId);
      return {
        title: titleEl?.textContent?.trim() || stored?.title || "",
        body: (bodyEl?.textContent || stored?.body || "").trim(),
        ctaLabel: cta?.textContent?.trim() || stored?.actionLabel || "",
        href:
          cta?.getAttribute("href") ||
          cta?.getAttribute("data-talk-notify-href") ||
          stored?.href ||
          stored?.targetUrl ||
          "",
      };
    }, row.notifyId);

    row.audit = { ...cardAudit, ...(await uiAudit(page)) };

    const listShot = path.join(OUT_DIR, `market-notify-${spec.id}-talk-list.png`);
    const cardShot = path.join(OUT_DIR, `market-notify-${spec.id}-card.png`);
    const primaryShot = path.join(OUT_DIR, `market-notify-${spec.id}.png`);
    await page.screenshot({ path: listShot, fullPage: false });
    await page.locator(`[data-talk-notify-id="${row.notifyId}"]`).screenshot({ path: cardShot });
    fs.copyFileSync(cardShot, primaryShot);
    row.screenshots.list = listShot.replace(/\\/g, "/");
    row.screenshots.card = cardShot.replace(/\\/g, "/");
    row.screenshots.primary = primaryShot.replace(/\\/g, "/");

    if (cardAudit.title !== spec.title) row.errors.push(`title: expected "${spec.title}", got "${cardAudit.title}"`);
    if (!cardAudit.body) row.errors.push("body empty");
    if (spec.recipient === "buyer" && spec.slug !== "01-purchase") {
      if (!/TASFUL Bakery/i.test(cardAudit.body)) row.errors.push("body missing shop name");
      if (!/milk and honey/i.test(cardAudit.body)) row.errors.push("body missing product name");
    }
    if (cardAudit.ctaLabel !== spec.actionLabel) {
      row.errors.push(`CTA: expected "${spec.actionLabel}", got "${cardAudit.ctaLabel}"`);
    }
    if (row.audit.issues?.length) row.errors.push(...row.audit.issues);

    const cta = page.locator(`[data-talk-notify-id="${row.notifyId}"] [data-talk-notify-action]`).first();
    const card = page.locator(`[data-talk-notify-id="${row.notifyId}"]`).first();
    await card.scrollIntoViewIfNeeded();
    if (await cta.count()) {
      await cta.click({ timeout: 15000 });
    } else {
      await card.click({ timeout: 15000 });
    }
    await page.waitForURL((url) => spec.destPattern.test(url.href), { timeout: 15000 });
    await page.waitForTimeout(800);
    const destUrl = page.url();
    row.destUrl = destUrl;

    if (!spec.destPattern.test(cardAudit.href) && !spec.destPattern.test(destUrl)) {
      row.errors.push(`dest mismatch: stored=${cardAudit.href} actual=${destUrl}`);
    }

    const destShot = path.join(OUT_DIR, `market-notify-${spec.id}-dest.png`);
    await page.screenshot({ path: destShot, fullPage: false });
    row.screenshots.dest = destShot.replace(/\\/g, "/");

    if (spec.slug === "preparing" || spec.slug === "shipped") {
      const detailOpen = await page.evaluate(() => {
        const detail = document.querySelector("[data-tasful-order-detail]:not([hidden])");
        return Boolean(detail);
      });
      if (!detailOpen) row.errors.push("注文詳細が展開されていません");
    }
    if (spec.slug === "review") {
      const reviewFormVisible = await page.evaluate(() => {
        const compose = document.querySelector("[data-tasful-product-review-compose]:not([hidden])");
        const titleInput = document.querySelector("[data-tasful-product-review-title]");
        return Boolean(
          compose &&
            compose.getBoundingClientRect().height > 80 &&
            titleInput &&
            !titleInput.hidden
        );
      });
      if (!reviewFormVisible) row.errors.push("レビュー入力フォームが表示されていません");
    }
    if (spec.slug === "order-accepted") {
      const orderStatus = await page.evaluate((oid) => {
        const cards = [...document.querySelectorAll("[data-tasful-order-card]")];
        const card = cards.find((el) => {
          const text = el.querySelector(".tasful-market-order-history-card__order-id")?.textContent || "";
          return text.includes(oid);
        });
        return card?.querySelector(".tasful-market-order-history-card__status")?.textContent?.trim() || "";
      }, orderId);
      row.orderStatusAtDest = orderStatus;
      if (orderStatus !== "注文受付") {
        row.errors.push(`注文履歴ステータス: expected 注文受付, got "${orderStatus || "—"}"`);
      }
    }
    if (spec.slug === "purchase") {
      const sellerPage = await page.evaluate(() => ({
        hasList: Boolean(document.querySelector("[data-tasful-seller-orders-list]:not([hidden])")),
        hasOrder: Boolean(document.querySelector("[data-tasful-seller-order-card]")),
      }));
      if (!sellerPage.hasList || !sellerPage.hasOrder) row.errors.push("seller-orders 画面が正しく表示されていません");
    }

    row.pass = row.errors.length === 0;
    results.push(row);
  }

  await page.goto(
    talkNotifyUrl(base, BUYER_ID),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector('[data-talk-panel="notify"]:not([hidden])', { timeout: 20000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator("[data-talk-notify-list]").screenshot({
    path: path.join(OUT_DIR, "market-notify-buyer-accents-390.png"),
  });
} catch (err) {
  results.push({
    id: "fatal",
    pass: false,
    errors: [String(err?.message || err)],
  });

}
});


const overallPass = results.length === NOTIFY_CASES.length && results.every((r) => r.pass);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  viewport: VIEWPORT,
  orderId,
  product: PRODUCT,
  overallPass,
  passCount: results.filter((r) => r.pass).length,
  failCount: results.filter((r) => !r.pass).length,
  results,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ overallPass, reportPath: REPORT_PATH, passCount: report.passCount, failCount: report.failCount }, null, 2));
await closeAllBrowsers();
process.exit(overallPass ? 0 : 1);
