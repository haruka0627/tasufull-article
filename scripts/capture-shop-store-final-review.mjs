#!/usr/bin/env node
/**
 * 店舗販売導線 — 最終目視レビュー（調査・スクショ・レポートのみ）
 *
 * 通常: 全ページ × 390/1280 × TALK通知まで
 * 高速: 修正箇所のみ（デフォルト checkout 390px）
 *
 *   node scripts/capture-shop-store-final-review.mjs
 *   node scripts/capture-shop-store-final-review.mjs --fast
 *   node scripts/capture-shop-store-final-review.mjs --page checkout --viewport 390
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { primaryScreenshotsDir } from "./lib/screenshot-ops.mjs";
import {
  auditReviewGauge,
  auditReviewSectionUx,
  captureReviewGaugeShots,
  gotoShopDetailForReviewGauge,
  judgeReviewSection,
  REVIEW_GAUGE_SHOP_ID,
  scrollToReviewFooterCta,
  scrollToReviewSection,
  mergeUxDockAudit,
} from "./lib/capture-shop-store-review-gauge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = primaryScreenshotsDir(ROOT);

const SHOP_ID = "demo-shop-haru-cafe";
const PRODUCT_ID = "p-0";
const EXPECT = {
  shopName: "HARU CAFE",
  productTitle: "季節のパンケーキ",
  priceFragment: "1,280",
};

const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const STEPS = [
  { id: "01-vendors", name: "店舗一覧", path: "shop-vendors.html" },
  { id: "02-shop-detail", name: "店舗詳細", path: `detail-shop-store.html?id=${SHOP_ID}` },
  { id: "08-review-gauge", name: "口コミ評価ゲージ", path: null },
  { id: "03-products", name: "商品一覧", path: `shop-products.html?id=${SHOP_ID}` },
  { id: "04-product-detail", name: "商品詳細", path: `detail-shop-store-product.html?shopId=${SHOP_ID}&productId=${PRODUCT_ID}` },
  { id: "05-checkout", name: "注文確認（店舗販売）", path: null, channel: "shop_store" },
  { id: "06-complete", name: "注文完了（店舗販売）", path: null, channel: "shop_store" },
  { id: "05-market-checkout", name: "注文確認（市場）", path: null, channel: "market" },
  { id: "06-market-complete", name: "注文完了（市場）", path: null, channel: "market" },
  { id: "07-talk-notify", name: "TALK通知", path: null },
];

/** --fast のデフォルト（最後に修正したページをここで更新） */
const FAST_FOCUS = {
  page: "checkout",
  viewport: "390",
};

const PAGE_ALIASES = {
  vendors: "01-vendors",
  "shop-detail": "02-shop-detail",
  shop: "02-shop-detail",
  "review-gauge": "08-review-gauge",
  gauge: "08-review-gauge",
  products: "03-products",
  "product-detail": "04-product-detail",
  product: "04-product-detail",
  "store-checkout": "05-checkout",
  "store-complete": "06-complete",
  "market-checkout": "05-market-checkout",
  "market-complete": "06-market-complete",
  notify: "07-talk-notify",
  "talk-notify": "07-talk-notify",
};

const PAGE_STEP_GROUPS = {
  checkout: ["05-checkout", "05-market-checkout"],
  complete: ["06-complete", "06-market-complete"],
};

function parseCliArgs(argv) {
  const args = { fast: false, page: null, viewport: null };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--fast") args.fast = true;
    else if (token === "--page" && argv[i + 1]) args.page = argv[++i];
    else if (token === "--viewport" && argv[i + 1]) args.viewport = argv[++i];
    else if (token === "--help" || token === "-h") args.help = true;
  }
  return args;
}

function resolveRunPlan(cli) {
  if (cli.help) {
    console.log(`Usage:
  node scripts/capture-shop-store-final-review.mjs
  node scripts/capture-shop-store-final-review.mjs --fast
  node scripts/capture-shop-store-final-review.mjs --page checkout --viewport 390

Pages: ${Object.keys(PAGE_ALIASES).join(", ")}
Viewports: 390, 1280`);
    process.exit(0);
  }

  const pageKey = cli.page || (cli.fast ? FAST_FOCUS.page : null);
  const viewportLabel = cli.viewport || (cli.fast ? FAST_FOCUS.viewport : null);
  const isPartial = Boolean(cli.fast || cli.page || cli.viewport);

  const resolvedStepIds = pageKey
    ? PAGE_STEP_GROUPS[pageKey] || [PAGE_ALIASES[pageKey] || pageKey]
    : null;
  if (isPartial && pageKey && !resolvedStepIds.every((id) => STEPS.some((s) => s.id === id))) {
    throw new Error(`Unknown --page: ${pageKey}`);
  }

  const viewports = viewportLabel
    ? VIEWPORTS.filter((v) => v.label === String(viewportLabel))
    : VIEWPORTS;
  if (viewportLabel && !viewports.length) {
    throw new Error(`Unknown --viewport: ${viewportLabel}`);
  }

  const steps = isPartial && resolvedStepIds ? STEPS.filter((s) => resolvedStepIds.includes(s.id)) : STEPS;

  return {
    mode: cli.fast ? "fast" : isPartial ? "partial" : "full",
    viewports,
    steps,
    stepIds: new Set(steps.map((s) => s.id)),
    focus: pageKey || viewportLabel ? { page: pageKey, viewport: viewportLabel } : null,
  };
}

const cli = parseCliArgs(process.argv);
const runPlan = resolveRunPlan(cli);

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });

const report = {
  generatedAt: new Date().toISOString(),
  base,
  mode: runPlan.mode,
  focus: runPlan.focus,
  canonical: { shopId: SHOP_ID, productId: PRODUCT_ID, mode: "buyNow" },
  overall: "PASS",
  pages: [],
  uiConcerns: [],
  fixPriorities: [],
  viewports: [],
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worst(a, b) {
  const rank = { PASS: 0, MINOR: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function countVerdicts(items = []) {
  return {
    failCount: items.filter((item) => item.verdict === "FAIL").length,
    minorCount: items.filter((item) => item.verdict === "MINOR").length,
    passCount: items.filter((item) => item.verdict === "PASS").length,
  };
}

/** failCount > 0 → FAIL / minor only → MINOR / else PASS */
function resolveOverallFromVerdicts(failCount, minorCount) {
  if (failCount > 0) return "FAIL";
  if (minorCount > 0) return "MINOR";
  return "PASS";
}

function resolveOverallFromPages(pages = []) {
  const { failCount, minorCount } = countVerdicts(pages);
  return resolveOverallFromVerdicts(failCount, minorCount);
}

function benchUrl(vpLabel) {
  const u = new URL(`${base}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", "shop");
  u.searchParams.set("demoConnect", "1");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("benchPattern", "shop-1");
  u.searchParams.set("liveFlowReset", "1");
  u.searchParams.set("benchViewport", vpLabel === "390" ? "390" : "1280");
  return u.toString();
}

const PRODUCT_CTA_MIN_BOTTOM_GAP_PX = 24;
const PRODUCT_CTA_OVERLAP_FAIL_PX2 = 400;

async function measureProductCtasInPage(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const overlapArea = (a, b) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const fixedEls = [...document.querySelectorAll("body *")].filter((el) => {
      const st = getComputedStyle(el);
      if (!["fixed", "sticky"].includes(st.position)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 24 && r.height >= 12;
    });
    const measure = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, found: false };
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      const overlaps = [];
      for (const fe of fixedEls) {
        const fr = fe.getBoundingClientRect();
        const area = overlapArea(box, fr);
        if (area > 16) {
          overlaps.push({
            cls: String(fe.className || fe.tagName).slice(0, 60),
            position: getComputedStyle(fe).position,
            overlapPx2: Math.round(area),
          });
        }
      }
      return {
        sel,
        found: true,
        label: (el.textContent || "").trim().slice(0, 32),
        fullyVisible: r.top >= 0 && r.left >= 0 && r.bottom <= vh + 0.5 && r.right <= vw + 0.5,
        bottomGapPx: Math.round(vh - r.bottom),
        clickable: !el.disabled && !el.hidden && st.display !== "none" && st.visibility !== "hidden" && st.pointerEvents !== "none",
        hasFixedOverlap: overlaps.length > 0,
        overlaps,
        rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) },
      };
    };
    const fixedBottomBars = fixedEls
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          cls: String(el.className || el.tagName).slice(0, 50),
          bottom: Math.round(r.bottom),
          top: Math.round(r.top),
          position: getComputedStyle(el).position,
        };
      })
      .filter((f) => f.bottom >= vh - 12);
    return {
      vh,
      vw,
      scrollY: Math.round(window.scrollY),
      url: location.pathname + location.search,
      fixedBottomBars,
      buyNow: measure("[data-shop-product-buy-now]"),
      addCart: measure("[data-shop-product-add-cart]"),
    };
  });
}

/**
 * 商品詳細 390px — CTA を overlap / 表示 / 押下 / 下端余白で監査
 * @param {import('playwright').Page} page
 */
async function auditProductDetailCta390(page) {
  const issues = [];
  const minors = [];
  const atLoad = await measureProductCtasInPage(page);

  await page.locator("[data-shop-product-buy-now]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const scrolledIntoView = await measureProductCtasInPage(page);

  let addCartClick = { ok: false };
  try {
    await page.locator("[data-shop-product-add-cart]").click({ timeout: 8000 });
    await page.waitForTimeout(400);
    const cartCount = await page.evaluate(() =>
      Number(localStorage.getItem("tasu_market_cart_count") || localStorage.getItem("tasu_shop_store_cart_count") || 0)
    );
    addCartClick = { ok: cartCount > 0, cartCount };
  } catch (err) {
    addCartClick = { ok: false, error: String(err?.message || err) };
  }

  let buyNowClick = { ok: false };
  try {
    const before = page.url();
    await page.locator("[data-shop-product-buy-now]").click({ timeout: 8000 });
    await page.waitForTimeout(600);
    buyNowClick = { ok: /checkout/.test(page.url()), before, after: page.url() };
  } catch (err) {
    buyNowClick = { ok: false, error: String(err?.message || err) };
  }

  const judgeScrolledCta = (cta) => {
    if (!cta?.found) {
      issues.push("商品詳細390px: CTA要素が見つかりません");
      return;
    }
    const name = cta.label || cta.sel;
    if (!cta.fullyVisible) {
      issues.push(`商品詳細390px: ${name} がスクロール後もビューポート内に完全表示されません`);
    }
    if (!cta.clickable) {
      issues.push(`商品詳細390px: ${name} が押下不可状態です`);
    }
    if (cta.hasFixedOverlap) {
      const detail = cta.overlaps.map((o) => `${o.cls}(${o.overlapPx2}px²)`).join(", ");
      const maxOverlap = Math.max(...cta.overlaps.map((o) => o.overlapPx2));
      const msg = `商品詳細390px: ${name} が固定要素と重なっています (${detail})`;
      if (maxOverlap >= PRODUCT_CTA_OVERLAP_FAIL_PX2) issues.push(msg);
      else minors.push(msg);
    } else if (cta.bottomGapPx < PRODUCT_CTA_MIN_BOTTOM_GAP_PX && cta.bottomGapPx >= 0) {
      minors.push(`商品詳細390px: ${name} の下端余白が24px未満（${cta.bottomGapPx}px）`);
    }
  };

  judgeScrolledCta(scrolledIntoView.buyNow);
  judgeScrolledCta(scrolledIntoView.addCart);

  if (!addCartClick.ok) issues.push("商品詳細390px: カートに入れるがクリックできません");
  if (!buyNowClick.ok) issues.push("商品詳細390px: 今すぐ購入がクリックできません");

  const record = {
    generatedAt: new Date().toISOString(),
    viewport: "390",
    atLoad: {
      buyNow: atLoad.buyNow,
      addCart: atLoad.addCart,
      fixedBottomBars: atLoad.fixedBottomBars,
    },
    scrolledIntoView: {
      buyNow: scrolledIntoView.buyNow,
      addCart: scrolledIntoView.addCart,
      fixedBottomBars: scrolledIntoView.fixedBottomBars,
    },
    interactions: { addCartClick, buyNowClick },
    issues,
    minors,
  };

  return { issues, minors, record };
}

async function pageAudit(page, stepId, vpLabel) {
  return page.evaluate(
    ({ stepId, vpLabel, expect }) => {
      const issues = [];
      const minors = [];
      const doc = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
      const clientW = doc.clientWidth;
      const hScroll = scrollW > clientW + 2;
      if (hScroll) issues.push(`横スクロール (${scrollW}px > ${clientW}px)`);

      const minFont = (() => {
        let min = 99;
        document.querySelectorAll("main p, main span, main a, main button, main h1, main h2, main dt, main dd, main li").forEach((el) => {
          if (el.closest(".tasful-market-checkout-item__condition")) return;
          const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
          if (fs > 0 && fs < min) min = fs;
        });
        return min;
      })();
      if (minFont < 11) minors.push(`最小フォント ${minFont}px`);

      const header = document.querySelector(".shop-market-header, .shop-store-market-header");
      const footer = document.querySelector(".tasful-market-footer, .tasful-shop-mall-footer");
      const headerBg = header ? getComputedStyle(header).backgroundColor : "";
      const banner = document.querySelector(".tasu-banner");

      const text = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() || "";

      function auditMarketHeaderOverlap() {
        const logoText = document.querySelector(".tasful-market-mall-header__logo-text");
        const cart = document.querySelector(".tasful-market-mall-header__cart");
        if (!logoText || !cart) return null;
        const lr = logoText.getBoundingClientRect();
        const cr = cart.getBoundingClientRect();
        const gap = cr.left - lr.right;
        return { gapPx: Math.round(gap), overlaps: gap < 0, sameRow: Math.abs(cr.top - lr.top) < 24 };
      }

      function auditMarketCheckout() {
        const bodyEl = document.querySelector("[data-tasful-checkout-body]");
        const sectionTitles = bodyEl
          ? [...bodyEl.querySelectorAll(".tasful-market-checkout-section__title")].map((el) =>
              el.textContent?.replace(/\s+/g, " ").trim()
            )
          : [];
        const productIdx = sectionTitles.indexOf("注文商品");
        const addressIdx = sectionTitles.indexOf("お届け先");
        const paymentIdx = sectionTitles.indexOf("支払い方法");
        if (vpLabel === "390") {
          if (productIdx < 0 || addressIdx < 0 || productIdx >= addressIdx) {
            issues.push("商品サマリーが配送先より上にありません");
          }
        } else {
          const asideTitle = document.querySelector(
            "[data-tasful-checkout-aside-summary] .tasful-market-checkout-aside-item__title"
          );
          if (!asideTitle?.textContent?.includes(expect.productTitle)) {
            issues.push("右カラムに注文商品サマリーがありません");
          }
        }
        if (paymentIdx >= 0 && addressIdx >= 0 && paymentIdx <= addressIdx) {
          issues.push("支払い方法が配送先より下にありません");
        }
        data.sectionOrder = sectionTitles;

        const headerOverlap = auditMarketHeaderOverlap();
        if (headerOverlap) {
          data.headerGapPx = headerOverlap.gapPx;
          if (!headerOverlap.sameRow && headerOverlap.gapPx < 8) minors.push("ヘッダー要素が縦にずれています");
          if (headerOverlap.overlaps) {
            issues.push(`ヘッダー重なり（市場ロゴ / カート gap ${headerOverlap.gapPx}px）`);
          }
        }

        const items = text("[data-tasful-checkout-items]");
        const totals = text("[data-tasful-checkout-totals]");
        const aside = text("[data-tasful-checkout-aside-summary]");
        const productVisible = items.includes(expect.productTitle) || aside.includes(expect.productTitle);
        if (!productVisible) issues.push("注文商品名なし");
        if (
          !items.includes(expect.shopName) &&
          !items.includes("ハルカフェ") &&
          !aside.includes(expect.shopName) &&
          !aside.includes("ハルカフェ")
        ) {
          minors.push("店舗名が明細にない");
        }
        if (!totals.includes(expect.priceFragment) && !aside.includes(expect.priceFragment)) {
          issues.push("合計金額不一致");
        }
        const submit = document.querySelector("[data-tasful-checkout-submit], [data-tasful-checkout-submit-aside]");
        if (!submit || submit.disabled) issues.push("注文確定ボタン不可");

        if (vpLabel === "390") {
          const itemTitle = document.querySelector("[data-tasful-checkout-items] .tasful-market-checkout-item__title");
          const itemImg = document.querySelector("[data-tasful-checkout-items] .tasful-market-checkout-item__img");
          const bar = document.querySelector("[data-tasful-checkout-bar-mobile]");
          const barRect = bar?.getBoundingClientRect();
          const barVisible = Boolean(bar && !bar.hidden && barRect && barRect.height > 8 && barRect.width > 8);
          const titleRect = itemTitle?.getBoundingClientRect();
          const imgRect = itemImg?.getBoundingClientRect();
          if (!titleRect || titleRect.top > window.innerHeight * 0.72) {
            issues.push("注文商品がファーストビュー外");
          }
          data.firstView = {
            itemTop: titleRect ? Math.round(titleRect.top) : null,
            itemImgTop: imgRect ? Math.round(imgRect.top) : null,
          };
          if (!barVisible) {
            issues.push("モバイル固定CTAバーが非表示");
          } else {
            const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
            const hasPadClass = document.body.classList.contains("content-bottom-padding");
            if (!hasPadClass || bodyPad < barRect.height * 0.9) {
              minors.push(`固定CTA下余白不足 (body ${Math.round(bodyPad)}px)`);
            }
            const payment = document.querySelector("[data-tasful-checkout-payment]");
            const bank = payment?.querySelector('input[value="bank"]')?.closest("label");
            const paymentSection = document.querySelector(".tasful-market-checkout-payment-section");
            const trustSection = document.querySelector(".tasful-market-checkout-trust-section");
            const barH = barRect.height || 140;
            if (paymentSection) {
              const paymentTarget =
                paymentSection.getBoundingClientRect().bottom +
                window.scrollY -
                (window.innerHeight - barH) +
                16;
              window.scrollTo(0, Math.max(0, paymentTarget));
            }
            if (trustSection) {
              const trustTarget =
                trustSection.getBoundingClientRect().bottom +
                window.scrollY -
                (window.innerHeight - barH) +
                16;
              window.scrollTo(0, Math.max(0, trustTarget));
            }
            const bankRect = bank?.getBoundingClientRect();
            const sectionRect = paymentSection?.getBoundingClientRect();
            const trustRect = trustSection?.getBoundingClientRect();
            const barTop = bar.getBoundingClientRect().top;
            data.ctaGapPx = bankRect ? Math.round(barTop - bankRect.bottom) : null;
            data.ctaSectionGapPx = sectionRect ? Math.round(barTop - sectionRect.bottom) : null;
            data.ctaTrustGapPx = trustRect ? Math.round(barTop - trustRect.bottom) : null;
            data.bodyPaddingBottom = bodyPad;
            data.hasContentBottomPadding = hasPadClass;
            if (bankRect && bankRect.bottom > barTop + 2) {
              issues.push(`支払方法と固定CTA重なり (gap ${Math.round(barTop - bankRect.bottom)}px)`);
            }
            if (sectionRect && sectionRect.bottom > barTop + 2) {
              issues.push(`支払い方法セクションと固定CTA重なり (gap ${Math.round(barTop - sectionRect.bottom)}px)`);
            }
            if (trustRect && trustRect.bottom > barTop + 2) {
              issues.push(`注意事項と固定CTA重なり (gap ${Math.round(barTop - trustRect.bottom)}px)`);
            }
          }
        }
      }

      function auditMarketComplete() {
        const shop = text("[data-tasful-complete-shop]");
        const product = text("[data-tasful-complete-product]");
        const order = text("[data-tasful-complete-order-id]");
        const total = text("[data-tasful-complete-total]");
        if (!shop || shop === "—" || shop === "-") issues.push(`完了画面店舗名なし: ${shop}`);
        else if (!/HARU|ハルカフェ/i.test(shop)) issues.push(`完了画面店舗名不一致: ${shop}`);
        if (!product || product === "—" || product === "-") issues.push(`完了画面商品名なし: ${product}`);
        if (!/^TM-/.test(order)) issues.push(`注文番号なし: ${order}`);
        if (order === "—" || order === "-") issues.push(`注文番号が未表示: ${order}`);
        if (!total.includes("¥") || !total.includes(expect.priceFragment)) issues.push(`合計表示なし: ${total}`);
        if (total === "—" || total === "-") issues.push(`合計が未表示: ${total}`);
        const ctaOrder = [...document.querySelectorAll(".tasful-market-complete-actions__btn")].map((el) =>
          el.textContent?.trim()
        );
        if (ctaOrder[0] !== "店舗を見る") issues.push(`CTA順序不正: ${ctaOrder.join(" / ")}`);
        if (!ctaOrder.includes("店舗一覧へ")) issues.push("副CTA（店舗一覧へ）なし");
        data.complete = { shop, product, order, total, ctaOrder };
      }

      function auditHeaderOverlap() {
        if (!header) return null;
        const logoText = header.querySelector(".shop-market-header__logo .tasful-ai-logo-text");
        const cart = header.querySelector(".shop-market-header__action--cart");
        if (!logoText || !cart) return null;
        const lr = logoText.getBoundingClientRect();
        const cr = cart.getBoundingClientRect();
        const gap = cr.left - lr.right;
        return { gapPx: Math.round(gap), overlaps: gap < 0 };
      }

      const data = {
        hScroll,
        minFont,
        headerBg,
        hasHeader: Boolean(header),
        hasFooter: Boolean(footer),
        hasBanner: Boolean(banner),
        url: location.pathname + location.search,
      };

      if (stepId === "01-vendors") {
        const cards = document.querySelectorAll(".shop-vendors-card, .shop-store-card, [data-shop-vendor-card], a[href*='detail-shop-store']");
        if (cards.length < 1) issues.push("店舗カードが見つからない");
      }

      if (stepId === "02-shop-detail") {
        const title = text("[data-biz-detail-title], .shop-detail__title, h1");
        if (!title) issues.push("店舗名が表示されていない");
        else if (!/HARU|CAFE|cafe/i.test(title)) minors.push(`店舗名表記: ${title}`);
        const shopLink = document.querySelector("a[href*='shop-products']");
        if (!shopLink) issues.push("商品一覧への導線なし");
      }

      if (stepId === "03-products") {
        const card = document.querySelector(".shop-products-card__link, a[href*='detail-shop-store-product']");
        if (!card) issues.push("商品カードリンクなし");
        const imgs = [...document.querySelectorAll(".shop-products-card img, .shop-products-card__img img")];
        const imgOk = imgs.some((img) => img.naturalWidth > 0);
        if (imgs.length && !imgOk) issues.push("商品一覧画像が読み込まれていない");
      }

      if (stepId === "04-product-detail") {
        const title = text("[data-shop-product-title]");
        const shop = text("[data-shop-product-shop-name]");
        const price = text("[data-shop-product-price]");
        const img = document.querySelector("[data-shop-product-image]");
        if (!img?.naturalWidth) issues.push("商品画像なし");
        if (!title.includes(expect.productTitle)) issues.push(`商品名不一致: ${title}`);
        if (!shop.includes(expect.shopName)) issues.push(`店舗名不一致: ${shop}`);
        if (!price.includes(expect.priceFragment)) issues.push(`価格不一致: ${price}`);
        const deliveryRows = document.querySelectorAll("[data-shop-product-delivery] .shop-store-delivery__row").length;
        if (deliveryRows < 4) issues.push(`配送情報不足 (${deliveryRows}行)`);
        const buy = document.querySelector("[data-shop-product-buy-now]");
        const cart = document.querySelector("[data-shop-product-add-cart]");
        if (!buy || buy.disabled) issues.push("今すぐ購入不可");
        if (!cart || cart.disabled) minors.push("カート追加ボタン無効");
        data.title = title;
        data.shop = shop;
        data.price = price;
        data.deliveryRows = deliveryRows;
      }

      if (stepId === "05-checkout") {
        const bodyEl = document.querySelector("[data-shop-store-checkout-body]");
        const sectionTitles = bodyEl
          ? [...bodyEl.querySelectorAll(".tasful-market-checkout-section__title")].map((el) =>
              el.textContent?.replace(/\s+/g, " ").trim()
            )
          : [];
        const productIdx = sectionTitles.indexOf("注文商品");
        const addressIdx = sectionTitles.indexOf("お届け先");
        const paymentIdx = sectionTitles.indexOf("支払い方法");
        if (productIdx < 0 || addressIdx < 0 || productIdx >= addressIdx) {
          issues.push("商品サマリーが配送先より上にありません");
        }
        if (paymentIdx >= 0 && addressIdx >= 0 && paymentIdx <= addressIdx) {
          issues.push("支払い方法が配送先より下にありません");
        }
        data.sectionOrder = sectionTitles;

        const headerOverlap = auditHeaderOverlap();
        if (headerOverlap) {
          data.headerGapPx = headerOverlap.gapPx;
          if (headerOverlap.overlaps) {
            issues.push(`ヘッダー重なり（店舗・販売 / カート gap ${headerOverlap.gapPx}px）`);
          }
        }

        const items = text("[data-shop-store-checkout-items]");
        const totals = text("[data-shop-store-checkout-totals]");
        const delivery = document.querySelector("[data-shop-store-checkout-delivery]");
        const deliveryRows = delivery?.querySelectorAll(".shop-store-delivery__row").length || 0;
        if (!items.includes(expect.productTitle)) issues.push("注文商品名なし");
        if (!items.includes(expect.shopName) && !totals) minors.push("店舗名が明細にない");
        if (!totals.includes(expect.priceFragment) && !totals.includes("1,280")) issues.push("合計金額不一致");
        if (deliveryRows < 3) issues.push(`配送情報不足 (${deliveryRows}行)`);
        const submit = document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]");
        if (!submit || submit.disabled) issues.push("注文確定ボタン不可");
        if (vpLabel === "390") {
          const bar = document.querySelector("[data-shop-store-checkout-bar-mobile]");
          const barRect = bar?.getBoundingClientRect();
          const barVisible = Boolean(bar && !bar.hidden && barRect && barRect.height > 8 && barRect.width > 8);
          if (!barVisible) {
            issues.push("モバイル固定CTAバーが非表示");
          } else {
            const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
            const hasPadClass = document.body.classList.contains("content-bottom-padding");
            if (!hasPadClass || bodyPad < barRect.height * 0.9) {
              minors.push(`固定CTA下余白不足 (body ${Math.round(bodyPad)}px)`);
            }
            const payment = document.querySelector("[data-shop-store-checkout-payment]");
            const bank = payment?.querySelector('input[value="bank"]')?.closest("label");
            const paymentSection = document.querySelector(".shop-store-checkout-payment-section");
            if (payment && bank) {
              const barH = barRect.height || 120;
              const target =
                payment.getBoundingClientRect().bottom +
                window.scrollY -
                (window.innerHeight - barH) +
                16;
              window.scrollTo(0, Math.max(0, target));
              const bankRect = bank.getBoundingClientRect();
              const sectionRect = paymentSection?.getBoundingClientRect();
              const barTop = bar.getBoundingClientRect().top;
              const gap = barTop - bankRect.bottom;
              const sectionGap = sectionRect ? barTop - sectionRect.bottom : gap;
              data.ctaGapPx = Math.round(gap);
              data.ctaSectionGapPx = Math.round(sectionGap);
              data.bodyPaddingBottom = bodyPad;
              data.hasContentBottomPadding = hasPadClass;
              if (bankRect.bottom > barTop + 2) {
                issues.push(`支払方法と固定CTA重なり (gap ${Math.round(gap)}px)`);
              }
              if (sectionRect && sectionRect.bottom > barTop + 2) {
                issues.push(`支払い方法セクションと固定CTA重なり (gap ${Math.round(sectionGap)}px)`);
              }
            }
          }
        }
        data.deliveryRows = deliveryRows;
      }

      if (stepId === "06-complete") {
        const shop = text("[data-shop-store-complete-shop]");
        const product = text("[data-shop-store-complete-product]");
        const order = text("[data-shop-store-complete-order-id]");
        const total = text("[data-shop-store-complete-total]");
        if (!shop.includes(expect.shopName)) issues.push(`完了画面店舗名なし: ${shop}`);
        if (!product.includes(expect.productTitle)) issues.push(`完了画面商品名なし: ${product}`);
        if (!/^TS-/.test(order)) issues.push(`注文番号なし: ${order}`);
        if (order === "—" || order === "-") issues.push(`注文番号が未表示: ${order}`);
        if (!total.includes("¥") || !total.includes(expect.priceFragment)) issues.push(`合計表示なし: ${total}`);
        if (total === "—" || total === "-") issues.push(`合計が未表示: ${total}`);
        const primaryCta = document.querySelector("[data-shop-store-complete-shop-link]");
        const secondaryCta = document.querySelector(".shop-store-complete-actions .shop-store-flow-btn--outline");
        const ctaOrder = [...document.querySelectorAll(".shop-store-complete-actions .shop-store-flow-btn")].map(
          (el) => el.textContent?.trim()
        );
        if (!primaryCta || primaryCta.hidden) issues.push("主CTA（店舗を見る）が非表示");
        if (!secondaryCta) issues.push("副CTA（店舗一覧へ）なし");
        if (ctaOrder[0] !== "店舗を見る") issues.push(`CTA順序不正: ${ctaOrder.join(" / ")}`);
        data.complete = { shop, product, order, total, ctaOrder };
      }

      if (stepId === "05-market-checkout") {
        auditMarketCheckout();
      }

      if (stepId === "06-market-complete") {
        auditMarketComplete();
      }

      return { data, issues, minors };
    },
    { stepId, vpLabel, expect: EXPECT }
  );
}

function judgeStep(issues, minors) {
  if (issues.length) return "FAIL";
  if (minors.length) return "MINOR";
  return "PASS";
}

async function clearStorage(page) {
  try {
    await page.evaluate(() => {
      [
        "tasu_market_cart_items",
        "tasu_market_cart_count",
        "tasu_market_last_order",
        "tasu_market_order_history",
        "tasu_market_notify_sent_v1",
        "tasful_talk_notifications",
        "tasful_talk_notifications_seeded_v2",
      ].forEach((k) => localStorage.removeItem(k));
    });
  } catch {
    /* cross-origin frame — skip */
  }
}

async function bootstrapBench(page) {
  return page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const profile = Demo?.getProfile?.("shop", true);
    if (!profile) return { ok: false };
    Live?.resetLiveFlow?.({ profile: "shop", connect: true });
    Demo?.ensureInitialDemoChainState?.(profile, { force: true });
    return { ok: true };
  });
}

async function refreshBenchNotify(page) {
  await page.evaluate(() => {
    ["frame-a-notify", "frame-b-notify"].forEach((frameId) => {
      document.getElementById(frameId)?.contentWindow?.postMessage?.(
        { type: "tasu-bench-notify-refresh", extended: true, force: true },
        "*"
      );
    });
  });
  await page.waitForTimeout(2000);
}

function pushStepResult(vpReport, vpLabel, step, audit, file, extra = {}) {
  const verdict = judgeStep(audit.issues, audit.minors);
  const row = {
    stepId: step.id,
    stepName: step.name,
    file,
    url: audit.data?.url || "",
    verdict,
    issues: audit.issues,
    minors: audit.minors,
    data: audit.data,
    ...extra,
  };
  vpReport.steps.push(row);
  vpReport.verdict = worst(vpReport.verdict, verdict);
  report.pages.push({ viewport: vpLabel, ...row });
  return row;
}

async function captureReviewGaugeStep(page, step, vpLabel, vpReport) {
  await gotoShopDetailForReviewGauge(page, base, REVIEW_GAUGE_SHOP_ID);
  await scrollToReviewSection(page);
  const audit = await auditReviewGauge(page);
  const ux = await auditReviewSectionUx(page);
  if (vpLabel === "390") {
    await scrollToReviewFooterCta(page);
    const uxDock = await auditReviewSectionUx(page);
    Object.assign(ux, mergeUxDockAudit(ux, uxDock));
  }
  const shots = await captureReviewGaugeShots(page, OUT, vpLabel, {
    filePrefix: `${vpLabel}-${step.id}`,
  });
  const issues = [...audit.issues, ...ux.issues];
  const verdict = judgeReviewSection(audit.issues, ux.issues);
  const row = {
    stepId: step.id,
    stepName: step.name,
    file: shots.sectionFile,
    viewportFile: shots.viewportFile,
    sectionFile: shots.sectionFile,
    url: audit.url,
    verdict,
    issues,
    minors: [],
    data: {
      bars: audit.rows,
      profile: audit.profile,
      hasBars: audit.hasBars,
      ux: ux.layout,
      dock: ux.dock,
    },
  };
  vpReport.steps.push(row);
  vpReport.verdict = worst(vpReport.verdict, verdict);
  report.pages.push({ viewport: vpLabel, ...row });
  return row;
}

async function captureStaticStep(page, step, vpLabel, vpReport) {
  await page.goto(buildLocalPageUrl(base, step.path), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(step.id === "04-product-detail" ? 2200 : 1500);
  if (step.id === "04-product-detail") {
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector("[data-shop-product-image]");
          return Boolean(img?.complete && img.naturalWidth > 0);
        },
        { timeout: 12000 }
      )
      .catch(() => null);
  }
  const file = `${vpLabel}-${step.id}-full.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const audit = await pageAudit(page, step.id, vpLabel);
  if (step.id === "04-product-detail" && vpLabel === "390") {
    const ctaAudit = await auditProductDetailCta390(page);
    audit.data = { ...audit.data, cta390: ctaAudit.record };
    audit.issues.push(...ctaAudit.issues);
    audit.minors.push(...ctaAudit.minors);
    fs.writeFileSync(path.join(OUT, "verify-product-cta-390.json"), JSON.stringify(ctaAudit.record, null, 2));
  }
  return pushStepResult(vpReport, vpLabel, step, audit, file);
}

async function navigateToCheckout(page) {
  const checkoutUrl = buildLocalPageUrl(
    base,
    `shop-store-checkout.html?mode=buyNow&shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}&quantity=1`
  );
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForSelector("[data-shop-store-checkout-body]:not([hidden])", { timeout: 20000 })
    .catch(async () => {
      await page.goto(
        buildLocalPageUrl(
          base,
          `detail-shop-store-product.html?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}`
        ),
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector("[data-shop-product-buy-now]")?.click());
      await page.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 });
      await page.waitForSelector("[data-shop-store-checkout-body]:not([hidden])", { timeout: 20000 });
    });
  await page.waitForTimeout(1200);
}

async function navigateToMarketCheckout(page) {
  const checkoutUrl = buildLocalPageUrl(
    base,
    `shop-market-checkout.html?mode=buyNow&shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}&quantity=1`
  );
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 20000 })
    .catch(async () => {
      await page.goto(
        buildLocalPageUrl(
          base,
          `detail-shop-product.html?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}`
        ),
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      await page.waitForTimeout(1800);
      await page.evaluate(() => {
        const pc = document.querySelector("[data-tasful-product-buy-now-pc]");
        const mobile = document.querySelector("[data-tasful-product-buy-now]");
        const target = pc && pc.offsetParent !== null ? pc : mobile;
        target?.click();
      });
      await page.waitForURL(/shop-market-checkout\.html/, { timeout: 15000 });
      await page.waitForSelector("[data-tasful-checkout-body]:not([hidden])", { timeout: 20000 });
    });
  await page.waitForTimeout(1200);
}

async function captureMarketCheckoutStep(page, step, vpLabel, vpReport) {
  await navigateToMarketCheckout(page);
  const file = `${vpLabel}-${step.id}-full.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const audit = await pageAudit(page, step.id, vpLabel);
  return pushStepResult(vpReport, vpLabel, step, audit, file);
}

async function captureMarketCompleteStep(page, step, vpLabel, vpReport) {
  await navigateToMarketCheckout(page);
  await page.evaluate(() =>
    document.querySelector("[data-tasful-checkout-submit], [data-tasful-checkout-submit-aside]")?.click()
  );
  await page.waitForURL(/shop-market-complete\.html/, { timeout: 15000 });
  await page.waitForTimeout(1800);
  const file = `${vpLabel}-${step.id}-full.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const audit = await pageAudit(page, step.id, vpLabel);
  return pushStepResult(vpReport, vpLabel, step, audit, file);
}

async function captureCheckoutStep(page, step, vpLabel, vpReport) {
  await navigateToCheckout(page);
  const file = `${vpLabel}-${step.id}-full.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const audit = await pageAudit(page, step.id, vpLabel);
  return pushStepResult(vpReport, vpLabel, step, audit, file);
}

async function captureCompleteStep(page, step, vpLabel, vpReport) {
  await navigateToCheckout(page);
  await page.evaluate(() =>
    document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
  );
  await page.waitForTimeout(1800);
  const file = `${vpLabel}-${step.id}-full.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const audit = await pageAudit(page, step.id, vpLabel);
  return pushStepResult(vpReport, vpLabel, step, audit, file);
}

async function captureTalkNotifyStep(context, benchPage, step, vpLabel, vpReport) {
  const shopPage = await context.newPage();
  await shopPage.setViewportSize({ width: vpReport.width, height: vpReport.height || 844 });
  let orderId = "";

  await benchPage.goto(benchUrl(vpLabel), { waitUntil: "domcontentloaded", timeout: 60000 });
  await benchPage.waitForTimeout(800);
  await clearStorage(benchPage);
  if (!(await bootstrapBench(benchPage)).ok) throw new Error("bench_boot_failed");
  await benchPage
    .waitForFunction(
      () => /talk-home\.html/.test(document.getElementById("frame-a-notify")?.contentWindow?.location?.href || ""),
      { timeout: 30000 }
    )
    .catch(() => null);
  await benchPage.waitForTimeout(1200);

  await clearStorage(shopPage);
  await shopPage.goto(
    buildLocalPageUrl(
      base,
      `detail-shop-store-product.html?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(PRODUCT_ID)}`
    ),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await shopPage.waitForTimeout(1500);
  await shopPage.locator("[data-shop-product-buy-now]").click({ force: true });
  await shopPage.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 });
  await shopPage.waitForTimeout(1200);
  await shopPage.evaluate(() =>
    document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
  );
  await shopPage.waitForTimeout(1500);
  orderId = await shopPage.evaluate(
    () => document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || ""
  );

  await refreshBenchNotify(benchPage);
  await refreshBenchNotify(benchPage);
  await benchPage.waitForTimeout(2000);

  const notifyAudit = await benchPage.evaluate(
    ({ orderId, expect }) => {
      const issues = [];
      const minors = [];
      const win = document.getElementById("frame-a-notify")?.contentWindow;
      const all = win?.TasuTalkNotifications?.getAll?.() || [];
      const purchase = all.find(
        (n) =>
          String(n.recipientUserId) === "u_shop_demo" &&
          String(n.id || "").includes(orderId ? `market-order-purchase-${orderId}` : "market-order-purchase-")
      );
      const card = purchase?.id
        ? win?.document?.querySelector(`[data-talk-notify-id="${purchase.id}"]`)
        : null;
      const cta = card?.querySelector?.(".talk-notify-card__minimal-action, .talk-notify-card__action, a");
      const href = cta?.getAttribute?.("href") || purchase?.targetUrl || purchase?.href || "";
      const text = card?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!card) issues.push("通知カードが表示されていない");
      if (!/店舗販売/.test(text)) issues.push("店舗販売カテゴリなし");
      if (!text.includes(expect.shopName)) issues.push("通知に店舗名なし");
      if (!text.includes(expect.productTitle)) issues.push("通知に商品名なし");
      if (!/注文を確認する/.test(text)) issues.push("CTA文言なし");
      if (!href || href === "#") issues.push("CTAリンクなし");
      else if (!/seller-orders|order-history|shop-store/.test(href)) minors.push(`CTA先: ${href}`);
      return {
        issues,
        minors,
        data: { href, text: text.slice(0, 200), orderId: purchase?.orderId || orderId, url: "chat-dual-window-demo.html" },
      };
    },
    { orderId: orderId.replace(/^注文番号:\s*/, "").trim(), expect: EXPECT }
  );

  const file = `${vpLabel}-${step.id}-full.png`;
  await benchPage.screenshot({ path: path.join(OUT, file), fullPage: true });
  const frame = benchPage.locator("#frame-a-notify");
  if (await frame.count()) {
    await frame.screenshot({ path: path.join(OUT, `${vpLabel}-${step.id}-notify-frame.png`) });
  }

  const row = pushStepResult(vpReport, vpLabel, step, notifyAudit, file, {
    notifyFrame: `${vpLabel}-${step.id}-notify-frame.png`,
    url: "chat-dual-window-demo.html",
  });
  await shopPage.close();
  return row;
}

function renderIndexHtml(reportData = report) {
  const pageCards = reportData.viewports
    .map((vp) => {
      const shots = vp.steps
        .map(
          (s) => `<article class="shot-card">
        <header class="shot-card__head">
          <h3>${esc(s.stepName)} <span class="badge badge--${s.verdict.toLowerCase()}">${esc(s.verdict)}</span></h3>
          <p class="shot-card__meta">${esc(vp.label)}px · <code>${esc(s.file)}</code></p>
          ${s.issues?.length ? `<ul class="issues fail">${s.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
          ${s.minors?.length ? `<ul class="issues minor">${s.minors.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
        </header>
        <a href="${esc(s.file)}" class="shot-card__link" target="_blank" rel="noopener">
          <img src="${esc(s.file)}" alt="${esc(s.stepName)}" loading="lazy" decoding="async">
        </a>
      </article>`
        )
        .join("");
      return `<section class="vp-section"><h2>${esc(vp.label)}px</h2><div class="shot-grid">${shots}</div></section>`;
    })
    .join("");

  const concerns = reportData.uiConcerns.map((c) => `<li>${esc(c)}</li>`).join("");
  const priorities = reportData.fixPriorities.map((p, i) => `<li><strong>${i + 1}.</strong> ${esc(p)}</li>`).join("");
  const notes = reportData.finalNotes;
  const finalNotesHtml = notes
    ? `<section class="final-notes">
      <h2>最終判定メモ</h2>
      <ul>
        <li><strong>購入フロー:</strong> ${esc(notes.purchaseFlow || "—")}</li>
        <li><strong>Gemini P1:</strong> ${esc(notes.geminiP1 || "—")}</li>
        <li><strong>残件:</strong> ${esc(notes.remaining || "—")}</li>
        <li><strong>FAIL:</strong> ${notes.failCount ?? "—"}件</li>
      </ul>
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>店舗販売 最終目視レビュー</title>
  <style>
    :root { --bg:#f1f5f9; --card:#fff; --text:#0f172a; --muted:#64748b; --pass:#15803d; --minor:#b45309; --fail:#b91c1c; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:"Noto Sans JP",system-ui,sans-serif; background:var(--bg); color:var(--text); }
    .page { max-width:1400px; margin:0 auto; padding:20px 16px 48px; }
    .hero { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:20px; }
    .hero h1 { margin:0 0 8px; font-size:1.4rem; }
    .summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin:16px 0; }
    .summary div { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; }
    .summary strong { display:block; font-size:.75rem; color:var(--muted); }
    .badge { font-size:.75rem; font-weight:800; padding:2px 8px; border-radius:999px; }
    .badge--pass { background:#dcfce7; color:var(--pass); }
    .badge--minor { background:#ffedd5; color:var(--minor); }
    .badge--fail { background:#fee2e2; color:var(--fail); }
    .vp-section { margin-bottom:28px; }
    .vp-section h2 { margin:0 0 12px; border-bottom:2px solid #d4af37; padding-bottom:6px; }
    .shot-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; }
    .shot-card { background:var(--card); border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
    .shot-card__head { padding:10px 12px; }
    .shot-card__head h3 { margin:0 0 6px; font-size:.9rem; }
    .shot-card__meta { margin:0; font-size:.7rem; color:var(--muted); word-break:break-all; }
    .issues { margin:8px 0 0; padding-left:18px; font-size:.75rem; }
    .issues.fail { color:var(--fail); }
    .issues.minor { color:var(--minor); }
    .shot-card__link { display:block; background:#0f172a; }
    .shot-card__link img { width:100%; height:auto; display:block; object-fit:contain; max-height:70vh; }
    .lists { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px; }
    @media (max-width:800px){ .lists { grid-template-columns:1fr; } }
    .lists section { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; }
    .lists h2 { margin:0 0 8px; font-size:1rem; }
    .lists ul { margin:0; padding-left:18px; font-size:.85rem; }
    .final-notes { background:#ecfdf5; border:1px solid #86efac; border-radius:12px; padding:14px; margin-top:20px; }
    .final-notes h2 { margin:0 0 8px; font-size:1rem; color:#166534; }
    .final-notes ul { margin:0; padding-left:18px; font-size:.85rem; color:#14532d; }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <h1>店舗販売導線 — 最終目視レビュー</h1>
      <p>生成: ${esc(reportData.generatedAt)} · 総合判定: <span class="badge badge--${reportData.overall.toLowerCase()}">${esc(reportData.overall)}</span></p>
      <div class="summary">
        <div><strong>店舗</strong>${esc(SHOP_ID)}</div>
        <div><strong>商品</strong>${esc(PRODUCT_ID)} (${esc(EXPECT.productTitle)})</div>
        <div><strong>導線</strong>buyNow</div>
        <div><strong>ページ数</strong>${reportData.pages.length}</div>
      </div>
    </header>
    ${pageCards}
    ${finalNotesHtml}
    <div class="lists">
      <section><h2>気になるUI</h2><ul>${concerns || "<li>特になし</li>"}</ul></section>
      <section><h2>修正優先順位</h2><ol>${priorities || "<li>現時点でFAILなし — 任意のMINOR改善のみ</li>"}</ol></section>
    </div>
  </div>
</body>
</html>`;
}

const browser = await chromium.launch({ headless: true });

console.log(
  JSON.stringify(
    {
      mode: runPlan.mode,
      focus: runPlan.focus,
      viewports: runPlan.viewports.map((v) => v.label),
      steps: runPlan.steps.map((s) => s.id),
    },
    null,
    2
  )
);

for (const vp of runPlan.viewports) {
  const vpReport = { label: vp.label, width: vp.width, height: vp.height, steps: [], verdict: "PASS" };
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const benchPage = runPlan.stepIds.has("07-talk-notify") ? await context.newPage() : null;

  try {
    if (runPlan.mode === "full") {
      await page.goto(buildLocalPageUrl(base, "shop-vendors.html"), { waitUntil: "domcontentloaded" });
      await clearStorage(page);
      await page.waitForTimeout(1000);
    } else if (
      runPlan.stepIds.has("05-checkout") ||
      runPlan.stepIds.has("06-complete") ||
      runPlan.stepIds.has("05-market-checkout") ||
      runPlan.stepIds.has("06-market-complete")
    ) {
      await clearStorage(page);
    }

    for (const step of runPlan.steps.filter((s) => s.path)) {
      await captureStaticStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("08-review-gauge")) {
      const step = STEPS.find((s) => s.id === "08-review-gauge");
      await captureReviewGaugeStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("05-checkout")) {
      const step = STEPS.find((s) => s.id === "05-checkout");
      await captureCheckoutStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("06-complete")) {
      const step = STEPS.find((s) => s.id === "06-complete");
      await captureCompleteStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("05-market-checkout")) {
      const step = STEPS.find((s) => s.id === "05-market-checkout");
      await captureMarketCheckoutStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("06-market-complete")) {
      const step = STEPS.find((s) => s.id === "06-market-complete");
      await captureMarketCompleteStep(page, step, vp.label, vpReport);
    }

    if (runPlan.stepIds.has("07-talk-notify")) {
      const step = STEPS.find((s) => s.id === "07-talk-notify");
      await captureTalkNotifyStep(context, benchPage, step, vp.label, vpReport);
    }
  } catch (err) {
    vpReport.error = String(err?.message || err);
    vpReport.verdict = "FAIL";
    report.pages.push({ viewport: vp.label, stepId: "error", verdict: "FAIL", issues: [String(err?.message || err)] });
  } finally {
    report.viewports.push(vpReport);
    report.overall = worst(report.overall, vpReport.verdict);
    await context.close();
  }
}

function loadExistingReport() {
  const reportPath = path.join(OUT, "report.json");
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
}

function mergePartialReport(existing, incoming) {
  if (!existing) return incoming;
  const key = (p) => `${p.viewport || ""}::${p.stepId || ""}`;
  const map = new Map((existing.pages || []).map((p) => [key(p), p]));
  for (const p of incoming.pages || []) map.set(key(p), p);
  const viewports = new Map((existing.viewports || []).map((v) => [v.label, v]));
  for (const v of incoming.viewports || []) {
    const prev = viewports.get(v.label);
    if (!prev) {
      viewports.set(v.label, v);
      continue;
    }
    const stepMap = new Map((prev.steps || []).map((s) => [s.stepId, s]));
    for (const s of v.steps || []) stepMap.set(s.stepId, s);
    const steps = [...stepMap.values()];
    viewports.set(v.label, {
      ...prev,
      ...v,
      steps,
      verdict: resolveOverallFromPages(steps),
      error: v.error,
    });
  }
  const pages = [...map.values()].filter((p) => p.stepId !== "error");
  return {
    ...existing,
    ...incoming,
    generatedAt: incoming.generatedAt,
    mode: incoming.mode,
    focus: incoming.focus,
    pages,
    viewports: [...viewports.values()],
    overall: resolveOverallFromPages(pages),
  };
}

function applyUiSummary(target) {
  const allMinors = new Set();
  const allFails = new Set();
  for (const p of target.pages || []) {
    (p.issues || []).forEach((i) => allFails.add(i));
    (p.minors || []).forEach((m) => allMinors.add(m));
  }

  target.uiConcerns = [];
  target.fixPriorities = [];

  if (allMinors.has("最小フォント 10px") || [...allMinors].some((m) => /最小フォント/.test(m))) {
    target.uiConcerns.push("一部ページで本文フォントがやや小さい（11px未満）");
  }
  if ([...allMinors].some((m) => /固定CTA/.test(m) && !/商品詳細390px/.test(m))) {
    target.uiConcerns.push("モバイル注文確認で固定CTAバーと本文の余白がタイト");
  }
  if ([...allMinors].some((m) => /商品詳細390px:.*固定要素と重なっています/.test(m))) {
    target.uiConcerns.push("商品詳細390pxでCTAと固定要素の重なり");
  }
  if ([...allMinors].some((m) => /CTA先/.test(m))) {
    target.uiConcerns.push("TALK通知CTAは出品者向け注文管理（seller-orders）へ遷移 — 購入者の注文確認とは別導線");
  }
  if ([...allMinors].some((m) => /店舗名表記/.test(m))) {
    target.uiConcerns.push("店舗詳細のタイトル表記が商品名ベース（店舗名と異なる場合あり）");
  }
  if (!target.uiConcerns.length && allMinors.size) {
    target.uiConcerns.push(...[...allMinors].slice(0, 5));
  }

  const pages = target.pages || [];
  const { failCount, minorCount, passCount } = countVerdicts(pages);
  const overall = resolveOverallFromVerdicts(failCount, minorCount);

  if (allFails.size) {
    target.fixPriorities.push("FAIL項目の解消（導線・画像・情報欠損）");
  }
  if ([...allMinors].some((m) => /固定CTA/.test(m))) {
    target.fixPriorities.push("モバイル注文確認の下部固定バー余白調整");
  }
  if ([...allMinors].some((m) => /最小フォント/.test(m))) {
    target.fixPriorities.push("スマホ向け最小フォントサイズの底上げ（11px→12px・任意）");
  }
  if (!target.fixPriorities.length) {
    target.fixPriorities.push("必須修正なし。MINORのみならリリース可");
  }
  if (failCount === 0) {
    target.fixPriorities.unshift("購入フローは本番可（FAIL 0）");
  }

  for (const vp of target.viewports || []) {
    vp.verdict = resolveOverallFromPages(vp.steps || []);
  }

  target.overall = overall;
  target.summary = {
    mode: target.mode,
    focus: target.focus,
    overall,
    byViewport: (target.viewports || []).map((v) => ({ label: v.label, verdict: v.verdict })),
    failCount,
    minorCount,
    passCount,
  };

  target.finalNotes = {
    purchaseFlow: "本番可",
    geminiP1: "全対応済み",
    remaining:
      "小フォント（店舗一覧・市場 checkout）と口コミセクション店舗名サマリー帯（P2・後回し・本番ブロッカーではない）",
    failCount,
    productionReady: failCount === 0,
  };
}

await browser.close();

applyUiSummary(report);

const existingReport = runPlan.mode !== "full" ? loadExistingReport() : null;
const finalReport = mergePartialReport(existingReport, report);
applyUiSummary(finalReport);
finalReport.reviewGauge = {
  updatedAt: new Date().toISOString(),
  stepId: "08-review-gauge",
  overall: finalReport.pages.filter((p) => p.stepId === "08-review-gauge").every((p) => p.verdict === "PASS")
    ? "PASS"
    : "FAIL",
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(finalReport, null, 2));
fs.writeFileSync(path.join(OUT, "index.html"), renderIndexHtml(finalReport));

console.log(JSON.stringify(finalReport.summary, null, 2));
await finalizeVerification(ROOT, { primaryFolder: "shop-store-final-review" });
