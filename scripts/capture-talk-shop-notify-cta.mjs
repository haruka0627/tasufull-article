#!/usr/bin/env node
/**
 * TALK通知センター — 店舗販売通知カード CTA サイズ検証
 *   node scripts/capture-talk-shop-notify-cta.mjs [--phase=before|after]
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { debugScreenshotsDir } from "./lib/screenshot-ops.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const phaseArg = process.argv.find((a) => a.startsWith("--phase="));
const phase = phaseArg?.split("=")[1] || "after";
const OUT = path.join(debugScreenshotsDir(root, "talk-shop-notify-cta"), phase);
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_talk_notifications_seeded_v2",
  "tasu_market_notify_sent_v1",
];

function talkNotifyUrl(base) {
  return buildLocalPageUrl(base, "talk-home.html?tab=notify&talkDev=1&benchEmbed=1&userId=u_me");
}

async function openNotifyCenter(page, base) {
  await page.goto(talkNotifyUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-talk-panel="notify"]');
      return panel && !panel.hidden;
    },
    { timeout: 30000 }
  );
}

async function seedShopStoreNotify(page) {
  await page.evaluate(() => {
    ["tasful_platform_notify_master_v2", "tasful_talk_notifications_seeded_v2", "tasu_market_notify_sent_v1"].forEach(
      (k) => localStorage.removeItem(k)
    );
    globalThis.__tasuTalkNotificationsBootstrapped = false;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const Market = window.TasfulMarketNotify;
    if (Market?.notifyPurchase) {
      Market.notifyPurchase({
        shopId: "demo-shop-haru-cafe",
        orderId: "TS-CTA-AUDIT-001",
        channel: "shop_store",
        shopName: "HARU CAFE",
        productName: "季節のパンケーキ",
        total: 1280,
        lines: [{ title: "季節のパンケーキ", qty: 1, unitPrice: 1280 }],
      });
    }
    window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector(".talk-notify-card--shop-store-purchase"),
    { timeout: 45000 }
  );
  await page.waitForTimeout(800);
}

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), phase, overall: "PASS", viewports: [] };

for (const vp of VIEWPORTS) {
  const vpReport = { label: vp.label, verdict: "PASS", issues: [], shots: [], metrics: null };
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await openNotifyCenter(page, base);
    await seedShopStoreNotify(page);

    const card = await page.$(".talk-notify-card--shop-store-purchase");
    if (!card) throw new Error("店舗販売通知カードなし");
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const metrics = await page.evaluate(() => {
      const card = document.querySelector(".talk-notify-card--shop-store-purchase");
      const cta = card?.querySelector(".talk-notify-card__minimal-action, .talk-notify-card__card-cta");
      const details = card?.querySelector(".talk-notify-card__shop-store-details");
      const cardRect = card?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();
      const ctaStyle = cta ? getComputedStyle(cta) : null;
      const detailsRect = details?.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        scrollW: Math.max(doc.scrollWidth, document.body.scrollWidth),
        clientW: doc.clientWidth,
        shopName: card?.querySelector(".talk-notify-card__shop-name")?.textContent?.trim() || "",
        productName: card?.querySelector(".talk-notify-card__product-name")?.textContent?.trim() || "",
        amount: card?.querySelector(".talk-notify-card__amount")?.textContent?.trim() || "",
        orderNumber: card?.querySelector(".talk-notify-card__order-number")?.textContent?.trim() || "",
        ctaText: cta?.textContent?.trim() || "",
        ctaWidth: ctaRect ? Math.round(ctaRect.width) : 0,
        ctaHeight: ctaRect ? Math.round(ctaRect.height) : 0,
        cardWidth: cardRect ? Math.round(cardRect.width) : 0,
        ctaWidthPct: cardRect && ctaRect ? Math.round((ctaRect.width / cardRect.width) * 100) : 0,
        ctaCssWidth: ctaStyle?.width || "",
        ctaAlignSelf: ctaStyle?.alignSelf || "",
        detailsHeight: detailsRect ? Math.round(detailsRect.height) : 0,
        ctaBelowDetails: detailsRect && ctaRect ? ctaRect.top >= detailsRect.bottom - 2 : false,
        ctaLeftAligned: cardRect && ctaRect ? Math.abs(ctaRect.left - cardRect.left) < 28 : false,
      };
    });

    vpReport.metrics = metrics;

    if (metrics.scrollW > metrics.clientW + 2) {
      vpReport.issues.push(`横スクロール ${metrics.scrollW}px`);
    }
    if (!/HARU CAFE/.test(metrics.shopName)) vpReport.issues.push("店舗名なし");
    if (!/季節のパンケーキ/.test(metrics.productName)) vpReport.issues.push("商品名なし");
    if (!/¥1,?280/.test(metrics.amount)) vpReport.issues.push("金額なし");
    if (!/TS-/.test(metrics.orderNumber)) vpReport.issues.push("注文番号なし");
    if (!/注文を確認する/.test(metrics.ctaText)) vpReport.issues.push("CTAラベル不一致");

    if (vp.label === "390") {
      if (metrics.ctaWidthPct >= 85) vpReport.issues.push(`CTAが幅${metrics.ctaWidthPct}%で主役化`);
      if (metrics.ctaHeight > 40) vpReport.issues.push(`CTA高さ${metrics.ctaHeight}px (>40)`);
      if (metrics.ctaHeight < 34) vpReport.issues.push(`CTA高さ${metrics.ctaHeight}px (<34)`);
      if (metrics.ctaWidth > 125) vpReport.issues.push(`CTA幅${metrics.ctaWidth}px (>120)`);
      if (metrics.ctaWidth < 90 && metrics.ctaWidth > 0) vpReport.issues.push(`CTA幅${metrics.ctaWidth}px (<96)`);
      if (!metrics.ctaLeftAligned) vpReport.issues.push("CTA左寄せでない");
    }

    if (metrics.detailsHeight > 0 && metrics.ctaHeight > 0 && metrics.ctaHeight >= metrics.detailsHeight) {
      vpReport.issues.push("CTAが情報ブロックより目立つ");
    }

    const shotCard = path.join(OUT, `${phase}-shop-notify-card-${vp.label}.png`);
    await page.screenshot({ path: shotCard, fullPage: false });
    vpReport.shots.push(shotCard);

    const shotFull = path.join(OUT, `${phase}-notify-list-${vp.label}.png`);
    await page.screenshot({ path: shotFull, fullPage: true });
    vpReport.shots.push(shotFull);

    if (vpReport.issues.length) vpReport.verdict = "FAIL";
  } catch (err) {
    vpReport.verdict = "FAIL";
    vpReport.issues.push(String(err?.message || err));
  } finally {
    await context.close();
  }
  report.viewports.push(vpReport);
  if (vpReport.verdict !== "PASS") report.overall = "FAIL";
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.overall === "PASS" ? 0 : 1);
