#!/usr/bin/env node
/**
 * 店舗販売購入通知 — コンパクトカード検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-notify-compact");
fs.mkdirSync(OUT, { recursive: true });

const SHOP_ID = "demo-shop-haru-cafe";
const SELLER_A = "u_shop_demo";
const PRODUCTS = [
  { productId: "demo-restaurant-0", label: "demo" },
  { productId: "p-0", label: "p" },
];
const MODES = ["cart", "buyNow"];
const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "390", width: 390, height: 844 },
];

let base = "";

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

function shotPath(caseId, name) {
  return path.join(OUT, `${caseId}-${name}`);
}

async function clearPurchaseStorage(page) {
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

async function waitBenchNotifyFrames(page) {
  await page
    .waitForFunction(
      () => {
        const a = document.getElementById("frame-a-notify")?.contentWindow?.location?.href || "";
        return /talk-home\.html/.test(a);
      },
      { timeout: 30000 }
    )
    .catch(() => null);
  await page.waitForTimeout(1500);
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

async function readCompactCard(page, orderId) {
  return page.evaluate(
    ({ orderId }) => {
      const win = document.getElementById("frame-a-notify")?.contentWindow;
      const all = win?.TasuTalkNotifications?.getAll?.() || [];
      const purchase = all.find(
        (n) =>
          String(n.recipientUserId) === "u_shop_demo" &&
          String(n.id || "").includes(`market-order-purchase-${orderId}`)
      );
      const card = purchase?.id
        ? win?.document?.querySelector(`[data-talk-notify-id="${purchase.id}"]`)
        : null;
      const text = card?.textContent?.replace(/\s+/g, " ").trim() || "";
      const head = card?.querySelector?.(".talk-notify-card__shop-store-head");
      const headRect = head?.getBoundingClientRect?.();
      const cardRect = card?.getBoundingClientRect?.();
      const cta = card?.querySelector?.(".talk-notify-card__minimal-action");
      const ctaRect = cta?.getBoundingClientRect?.();
      const orderRaw = String(purchase?.orderNumber || purchase?.orderId || orderId || "").trim();
      const orderHash = orderRaw ? `#${orderRaw.replace(/^#/, "")}` : "";
      return {
        found: Boolean(purchase),
        cardVisible: Boolean(card && card.offsetParent !== null),
        cardText: text,
        cardHeight: Math.round(cardRect?.height || 0),
        headHeight: Math.round(headRect?.height || 0),
        ctaHeight: Math.round(ctaRect?.height || 0),
        hasHeadRow: Boolean(head),
        headInline:
          Boolean(head) &&
          Boolean(head.querySelector(".talk-notify-card__market-badge--new")) &&
          Boolean(head.querySelector(".talk-notify-card__category-chip")),
        ux: {
          categoryTag: /店舗販売/.test(text),
          newBadge: /\bNEW\b/.test(text),
          shopName: purchase?.shopName ? text.includes(purchase.shopName) : false,
          productName: purchase?.productName ? text.includes(purchase.productName) : false,
          amount: purchase?.amount != null ? text.includes(`¥${Number(purchase.amount).toLocaleString("ja-JP")}`) : false,
          orderHash: orderHash ? text.includes(orderHash) : false,
          noOrderLabel: !/注文番号/.test(text),
          cta: /注文を確認する/.test(text),
        },
      };
    },
    { orderId }
  );
}

async function runPurchase(shopPage, productId, mode) {
  await shopPage.goto(
    buildLocalPageUrl(
      base,
      "detail-shop-store-product.html",
      `?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(productId)}`
    ),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await shopPage.waitForTimeout(1800);
  if (mode === "cart") {
    await shopPage.locator("[data-shop-product-add-cart]").click({ force: true });
    await shopPage.waitForTimeout(500);
    await shopPage.goto(buildLocalPageUrl(base, "shop-store-checkout.html?mode=cart"), {
      waitUntil: "domcontentloaded",
    });
    await shopPage.waitForTimeout(1500);
  } else {
    await shopPage.locator("[data-shop-product-buy-now]").click({ force: true });
    await shopPage.waitForURL(/shop-store-checkout\.html/, { timeout: 15000 });
    await shopPage.waitForTimeout(1500);
  }
  await shopPage.evaluate(() =>
    document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
  );
  await shopPage.waitForTimeout(1500);
  const complete = await shopPage.evaluate(() => ({
    path: location.pathname,
    order: document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || "",
  }));
  const orderId = complete.order.replace(/^注文番号:\s*/, "").trim();
  return complete.path === "/shop-store-complete.html" && orderId ? { ok: true, orderId } : { ok: false, orderId: "" };
}

const report = { cases: [], compactFlow: "PASS", allPass: true };
base = await findDevServerBaseUrl({ probePath: "chat-dual-window-demo.html" });
report.base = base;

await withPlaywrightBrowser(async (browser) => {let canonicalCaseId = "";

for (const vp of VIEWPORTS) {
  for (const prod of PRODUCTS) {
    for (const mode of MODES) {
      const caseId = `${prod.label}-${mode}-${vp.label}`;
      const row = { caseId, productId: prod.productId, mode, viewport: vp.label, compactPass: false, screenshots: {} };
      const context = await browser.newContext();
      const benchPage = await context.newPage();
      const shopPage = await context.newPage();
      await benchPage.setViewportSize({ width: vp.width, height: vp.height });
      await shopPage.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await benchPage.goto(benchUrl(vp.label), { waitUntil: "domcontentloaded", timeout: 60000 });
        await benchPage.waitForTimeout(800);
        await clearPurchaseStorage(benchPage);
        if (!(await bootstrapBench(benchPage)).ok) throw new Error("bench_boot_failed");
        await waitBenchNotifyFrames(benchPage);

        const purchase = await runPurchase(shopPage, prod.productId, mode);
        row.purchase = purchase;
        if (!purchase.ok) throw new Error("purchase_failed");

        await refreshBenchNotify(benchPage);
        await refreshBenchNotify(benchPage);
        await waitBenchNotifyFrames(benchPage);

        const card = await readCompactCard(benchPage, purchase.orderId);
        row.card = card;

        const frameA = benchPage.locator("#frame-a-notify");
        if (await frameA.count()) {
          const p = shotPath(caseId, "05-a-notify-after-order.png");
          await frameA.screenshot({ path: p });
          row.screenshots["05-a-notify-after-order"] = p.replace(/\\/g, "/");
        }
        const summaryPath = shotPath(caseId, "09-bench-summary.png");
        await benchPage.screenshot({ path: summaryPath, fullPage: false });
        row.screenshots["09-bench-summary"] = summaryPath.replace(/\\/g, "/");
        if (!canonicalCaseId) canonicalCaseId = caseId;

        const ux = card.ux || {};
        const ctaOk = vp.label === "390" ? card.ctaHeight >= 36 : card.ctaHeight >= 36;
        row.compactPass =
          card.cardVisible &&
          card.found &&
          card.hasHeadRow &&
          card.headInline &&
          ux.categoryTag &&
          ux.newBadge &&
          ux.shopName &&
          ux.productName &&
          ux.amount &&
          ux.orderHash &&
          ux.noOrderLabel &&
          ux.cta &&
          ctaOk &&
          card.cardHeight > 0 &&
          card.headHeight > 0 &&
          card.headHeight <= 28;

        if (!row.compactPass) {
          report.compactFlow = "FAIL";
          report.allPass = false;
        }
      } catch (err) {
        row.error = String(err?.message || err);
        report.compactFlow = "FAIL";
        report.allPass = false;
      } finally {
        report.cases.push(row);
        await context.close();
      }
    }
  }
}

if (canonicalCaseId) {
  for (const name of ["05-a-notify-after-order.png", "09-bench-summary.png"]) {
    const src = shotPath(canonicalCaseId, name);
    const dest = path.join(OUT, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

report.ok = report.cases.filter((c) => c.compactPass).length;
report.ng = report.cases.filter((c) => !c.compactPass).length;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ compactFlow: report.compactFlow, allPass: report.allPass, ok: report.ok, ng: report.ng }, null, 2)
);
});

await closeAllBrowsers();
