#!/usr/bin/env node
/**
 * 店舗販売 — 2窓ベンチ通知修正検証
 * 購入フロー + TALK購入通知（A=u_shop_demo）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "shop-store-dual-window-notify-fix");
fs.mkdirSync(OUT, { recursive: true });

const SHOP_ID = "demo-shop-haru-cafe";
const SELLER_A = "u_shop_demo";
const BUYER_B = "u_hiro";
const PRODUCTS = [
  { productId: "demo-restaurant-0", label: "demo" },
  { productId: "p-0", label: "p" },
];
const MODES = ["cart", "buyNow"];
const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "390", width: 390, height: 844 },
];

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
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: "shop", connect: true });
    Demo?.ensureInitialDemoChainState?.(profile, { force: true });
    const sides = Demo?.getSideMeta?.(profile);
    return {
      ok: true,
      sellerA: sides?.A?.userId,
      buyerB: sides?.B?.userId,
      mode: "shop_purchase_bench_initial",
    };
  });
}

async function waitBenchNotifyFrames(page) {
  await page
    .waitForFunction(
      () => {
        const a = document.getElementById("frame-a-notify")?.contentWindow?.location?.href || "";
        const b = document.getElementById("frame-b-notify")?.contentWindow?.location?.href || "";
        return /talk-home\.html/.test(a) && /talk-home\.html/.test(b);
      },
      { timeout: 30000 }
    )
    .catch(() => null);
  await page.waitForTimeout(1500);
}

async function refreshBenchNotify(page) {
  await page.evaluate(() => {
    if (typeof postNotifyRefreshToFrame === "function") {
      postNotifyRefreshToFrame("frame-a-notify", { extended: true, force: true, immediate: true });
      postNotifyRefreshToFrame("frame-b-notify", { extended: true, force: true, immediate: true });
    }
  });
  await page.waitForTimeout(1500);
}

async function readNotifyFrame(page, frameId, userId) {
  return page.evaluate(
    ({ frameId, userId }) => {
      const win = document.getElementById(frameId)?.contentWindow;
      const all = win?.TasuTalkNotifications?.getAll?.() || [];
      const filtered = all.filter((n) => String(n.recipientUserId) === String(userId));
      const purchase = filtered.filter(
        (n) =>
          String(n.id || "").includes("market-order-purchase-") ||
          /新しい注文|商品が購入されました|店舗販売の新しい注文/.test(String(n.title || ""))
      );
      const card = win?.document?.querySelector?.(
        purchase[0]?.id ? `[data-talk-notify-id="${purchase[0].id}"]` : ".talk-notify-card"
      );
      return {
        storageCount: filtered.length,
        purchaseCount: purchase.length,
        purchaseIds: purchase.map((n) => n.id),
        iframeCardCount: win?.document?.querySelectorAll?.(".talk-notify-card, [data-talk-notify-id]")?.length || 0,
        purchaseVisible: Boolean(card && card.offsetParent !== null),
        latestPurchase: purchase[0]
          ? {
              id: purchase[0].id,
              title: purchase[0].title,
              recipientUserId: purchase[0].recipientUserId,
              targetUrl: purchase[0].targetUrl || purchase[0].href,
            }
          : null,
      };
    },
    { frameId, userId }
  );
}

async function showStoragePanel(page, orderId) {
  await page.evaluate((orderId) => {
    const old = document.getElementById("bench-storage-debug");
    old?.remove();
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const sent = JSON.parse(localStorage.getItem("tasu_market_notify_sent_v1") || "{}");
    const last = JSON.parse(localStorage.getItem("tasu_market_last_order") || "null");
    const purchase = notifs.filter((n) => String(n.id || "").includes("market-order-purchase-"));
    const panel = document.createElement("div");
    panel.id = "bench-storage-debug";
    panel.style.cssText =
      "position:fixed;inset:12px;z-index:99999;background:#fff;border:2px solid #d4af37;border-radius:12px;padding:12px;overflow:auto;font:12px/1.4 monospace;";
    panel.innerHTML = `<h3 style="margin:0 0 8px;font-family:sans-serif">localStorage 通知確認</h3>
<pre style="margin:0;white-space:pre-wrap">orderId: ${orderId}
lastOrder.channel: ${last?.channel || "—"}
notify_sent keys: ${Object.keys(sent).join(", ") || "—"}
tasful_talk_notifications (${notifs.length}件):
${JSON.stringify(purchase, null, 2)}</pre>`;
    document.body.appendChild(panel);
  }, orderId);
}

async function runPurchase(shopPage, productId, mode, caseId) {
  const visited = [];
  shopPage.on("framenavigated", (frame) => {
    if (frame === shopPage.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });

  const detailUrl = buildLocalPageUrl(
    base,
    "detail-shop-store-product.html",
    `?shopId=${encodeURIComponent(SHOP_ID)}&productId=${encodeURIComponent(productId)}`
  );
  await shopPage.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
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

  const hasNotifyScripts = await shopPage.evaluate(() => ({
    marketNotify: typeof window.TasfulMarketNotify !== "undefined",
    talkStore: typeof window.TasuTalkNotifications !== "undefined",
  }));
  if (!hasNotifyScripts.marketNotify || !hasNotifyScripts.talkStore) {
    return { ok: false, step: "notify-scripts", hasNotifyScripts, visited, orderId: "" };
  }

  await shopPage.screenshot({ path: shotPath(caseId, "02-checkout-before-order.png"), fullPage: false });

  const submit = shopPage
    .locator("[data-shop-store-checkout-submit]:visible, [data-shop-store-checkout-submit-aside]:visible")
    .first();
  if (await submit.count()) await submit.click({ force: true });
  else {
    await shopPage.evaluate(() =>
      document.querySelector("[data-shop-store-checkout-submit], [data-shop-store-checkout-submit-aside]")?.click()
    );
  }
  await shopPage.waitForTimeout(1500);

  const complete = await shopPage.evaluate(() => ({
    path: location.pathname,
    order: document.querySelector("[data-shop-store-complete-order-id]")?.textContent?.trim() || "",
    hasMarket: /shop-market-(cart|checkout|complete)/.test(location.pathname),
  }));
  const orderId = complete.order.replace(/^注文番号:\s*/, "").trim();
  if (complete.path !== "/shop-store-complete.html" || !orderId || complete.hasMarket) {
    return { ok: false, step: "complete", complete, visited, orderId: "" };
  }

  await shopPage.screenshot({ path: shotPath(caseId, "03-complete-after-order.png"), fullPage: false });

  const storage = await shopPage.evaluate((oid) => {
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const sent = JSON.parse(localStorage.getItem("tasu_market_notify_sent_v1") || "{}");
    const last = JSON.parse(localStorage.getItem("tasu_market_last_order") || "null");
    const purchase = notifs.filter((n) => String(n.id || "").includes(`market-order-purchase-${oid}`));
    return {
      lastChannel: last?.channel || "",
      lastOrderId: last?.id || "",
      notifySentKeys: Object.keys(sent),
      purchaseNotifyCount: purchase.length,
      purchaseRecipients: purchase.map((n) => n.recipientUserId),
      dedupeHit: Object.keys(sent).some((k) => k.startsWith(`${oid}::`)),
    };
  }, orderId);

  return {
    ok: true,
    orderId,
    storage,
    visited: [...new Set(visited)],
    wrongMarket: [...new Set(visited)].filter((p) => /shop-market-(cart|checkout|complete)/.test(p)),
  };
}

const base = await findDevServerBaseUrl({ probePath: "chat-dual-window-demo.html" });
const report = {
  base,
  bench: { pattern: "shop-1", sellerA: SELLER_A, buyerB: BUYER_B, shopId: SHOP_ID },
  cases: [],
  purchaseFlow: "PASS",
  notificationFlow: "PASS",
  sellerNotify: true,
  buyerNotify: false,
  allPass: true,
};

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  for (const prod of PRODUCTS) {
    for (const mode of MODES) {
      const caseId = `${prod.label}-${mode}-${vp.label}`;
      const row = {
        caseId,
        productId: prod.productId,
        mode,
        viewport: vp.label,
        purchasePass: false,
        notifyPass: false,
        pass: false,
        screenshots: {},
      };
      const context = await browser.newContext();
      const benchPage = await context.newPage();
      const shopPage = await context.newPage();
      await benchPage.setViewportSize({ width: vp.width, height: vp.height });
      await shopPage.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await benchPage.goto(benchUrl(vp.label), { waitUntil: "domcontentloaded", timeout: 60000 });
        await benchPage.waitForTimeout(800);
        await clearPurchaseStorage(benchPage);
        const boot = await bootstrapBench(benchPage);
        row.benchBoot = boot;
        if (!boot.ok) throw new Error(boot.reason || "bench_boot_failed");
        await waitBenchNotifyFrames(benchPage);

        const s01 = shotPath(caseId, "01-bench-initial.png");
        await benchPage.screenshot({ path: s01, fullPage: false });
        row.screenshots["01-bench-initial"] = s01.replace(/\\/g, "/");

        const purchase = await runPurchase(shopPage, prod.productId, mode, caseId);
        row.purchase = purchase;
        row.screenshots["02-checkout-before-order"] = shotPath(caseId, "02-checkout-before-order.png").replace(/\\/g, "/");

        if (!purchase.ok) {
          row.purchasePass = false;
          row.notifyPass = false;
          report.purchaseFlow = "FAIL";
          report.notificationFlow = "FAIL";
          report.allPass = false;
          report.cases.push(row);
          await context.close();
          continue;
        }

        row.screenshots["03-complete-after-order"] = shotPath(caseId, "03-complete-after-order.png").replace(/\\/g, "/");

        row.purchasePass =
          purchase.storage?.lastChannel === "shop_store" &&
          purchase.wrongMarket.length === 0 &&
          purchase.storage?.purchaseNotifyCount > 0 &&
          purchase.storage?.purchaseRecipients?.includes(SELLER_A) &&
          purchase.storage?.dedupeHit === true;

        await shopPage.goto(
          buildLocalPageUrl(base, `shop-market-seller-orders.html?shopId=${encodeURIComponent(SHOP_ID)}`),
          { waitUntil: "domcontentloaded" }
        );
        await shopPage.waitForTimeout(1200);
        const sellerHasOrder = await shopPage.evaluate(
          (oid) => Boolean(document.querySelector(`[data-tasful-seller-order-card][data-order-id="${oid}"]`)),
          purchase.orderId
        );
        await shopPage.screenshot({ path: shotPath(caseId, "07-seller-orders.png"), fullPage: false });
        row.screenshots["07-seller-orders"] = shotPath(caseId, "07-seller-orders.png").replace(/\\/g, "/");

        await shopPage.goto(buildLocalPageUrl(base, "shop-market-order-history.html"), {
          waitUntil: "domcontentloaded",
        });
        await shopPage.waitForTimeout(1200);
        const buyerHasOrder = await shopPage.evaluate(
          (oid) => Boolean(document.querySelector(`[data-order-id="${oid}"]`)),
          purchase.orderId
        );
        await shopPage.screenshot({ path: shotPath(caseId, "08-buyer-history.png"), fullPage: false });
        row.screenshots["08-buyer-history"] = shotPath(caseId, "08-buyer-history.png").replace(/\\/g, "/");

        row.purchasePass = row.purchasePass && sellerHasOrder && buyerHasOrder && purchase.ok;

        await refreshBenchNotify(benchPage);
        await benchPage.waitForTimeout(2000);
        await refreshBenchNotify(benchPage);
        await waitBenchNotifyFrames(benchPage);

        await showStoragePanel(benchPage, purchase.orderId);
        await benchPage.screenshot({ path: shotPath(caseId, "04-storage-notifications.png"), fullPage: false });
        row.screenshots["04-storage-notifications"] = shotPath(caseId, "04-storage-notifications.png").replace(/\\/g, "/");
        await benchPage.evaluate(() => document.getElementById("bench-storage-debug")?.remove());

        const frameA = benchPage.locator("#frame-a-notify");
        const frameB = benchPage.locator("#frame-b-notify");
        if (await frameA.count()) {
          await frameA.screenshot({ path: shotPath(caseId, "05-a-notify-after-order.png") });
          row.screenshots["05-a-notify-after-order"] = shotPath(caseId, "05-a-notify-after-order.png").replace(/\\/g, "/");
        }
        if (await frameB.count()) {
          await frameB.screenshot({ path: shotPath(caseId, "06-b-notify-after-order.png") });
          row.screenshots["06-b-notify-after-order"] = shotPath(caseId, "06-b-notify-after-order.png").replace(/\\/g, "/");
        }
        await benchPage.screenshot({ path: shotPath(caseId, "09-bench-summary.png"), fullPage: false });
        row.screenshots["09-bench-summary"] = shotPath(caseId, "09-bench-summary.png").replace(/\\/g, "/");

        const notifyA = await readNotifyFrame(benchPage, "frame-a-notify", SELLER_A);
        const notifyB = await readNotifyFrame(benchPage, "frame-b-notify", BUYER_B);
        row.notifications = { A: notifyA, B: notifyB, storage: purchase.storage };

        const parentPurchaseCount = await benchPage.evaluate((oid) => {
          const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
          return notifs.filter(
            (n) =>
              String(n.id || "").includes(`market-order-purchase-${oid}`) &&
              String(n.recipientUserId) === "u_shop_demo"
          ).length;
        }, purchase.orderId);

        row.notifyPass =
          parentPurchaseCount > 0 &&
          (notifyA.purchaseCount > 0 || notifyA.purchaseVisible) &&
          purchase.storage?.purchaseRecipients?.includes(SELLER_A);

        row.buyerNotifyVisible = notifyB.purchaseCount > 0;
        row.pass = row.purchasePass && row.notifyPass;

        if (!row.purchasePass) report.purchaseFlow = "FAIL";
        if (!row.notifyPass) report.notificationFlow = "FAIL";
        if (!row.pass) report.allPass = false;
      } catch (err) {
        row.error = String(err?.message || err);
        report.purchaseFlow = "FAIL";
        report.notificationFlow = "FAIL";
        report.allPass = false;
      } finally {
        report.cases.push(row);
        await context.close();
      }
    }
  }
}

report.sellerNotify = report.cases.every((c) => c.notifications?.A?.purchaseCount > 0 || c.notifyPass);
report.buyerNotify = report.cases.some((c) => c.buyerNotifyVisible);
report.purchaseFlow = report.cases.every((c) => c.purchasePass) ? "PASS" : "FAIL";
report.notificationFlow = report.cases.every((c) => c.notifyPass) ? "PASS" : "FAIL";
report.allPass =
  report.purchaseFlow === "PASS" && report.notificationFlow === "PASS";

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      purchaseFlow: report.purchaseFlow,
      notificationFlow: report.notificationFlow,
      sellerNotify: report.sellerNotify,
      buyerNotify: report.buyerNotify,
      allPass: report.allPass,
      ok: report.cases.filter((c) => c.pass).length,
      ng: report.cases.filter((c) => !c.pass).length,
    },
    null,
    2
  )
);
await browser.close();
