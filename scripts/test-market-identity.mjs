#!/usr/bin/env node
/**
 * NB-3 STEP 5 — 市場 buyer/seller identity 検証
 *   node scripts/test-market-identity.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  listingOwnerId,
  shouldBlockMarketLsIdentity,
  isOwnerMatch,
} from "./lib/market-identity-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isOwnerMatch("u_a", { user_id: "u_a" }), "core: owner match");
assert(!isOwnerMatch("u_a", { user_id: "u_b" }), "core: owner mismatch");
assert(listingOwnerId({ form_data: { user_id: "u_x" } }) === "u_x", "core: form_data owner");
assert(shouldBlockMarketLsIdentity({ hostname: "tasful.jp" }), "core: prod blocks LS");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "market-identity.js" });
} catch (err) {
  console.warn("[test-market-identity] dev server unavailable:", err.message);
  console.log("SUMMARY: core PASS · browser SKIPPED");
  await closeAllBrowsers();
  process.exit(0);
}

await withPlaywrightBrowser(async (browser) => {
  const url = buildLocalPageUrl(base, "shop-market-mypage.html", "?talkDev=1&userId=u_me");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.TasuMarketIdentity !== "undefined", {
    timeout: 15000,
  });

  const demoBuyer = await page.evaluate(async () => {
    await window.TasuMarketIdentity.refreshMarketIdentityFromDb();
    return {
      buyer: window.TasuMarketIdentity.getCurrentBuyerId(),
      sellerShop: window.TasuMarketIdentity.getCurrentSellerShopId(),
      source: window.TasuMarketIdentity.getMarketIdentitySource(),
    };
  });
  assert(demoBuyer.buyer === "u_me", "demo buyer u_me");
  assert(demoBuyer.sellerShop, "demo seller shop id");

  const demoSellerLs = await page.evaluate(() => {
    localStorage.setItem(
      "tasu_market_seller_profile",
      JSON.stringify({ shopId: "demo-shop-custom", sellerUserId: "u_seller_demo" })
    );
    window.TasuMarketIdentity.invalidateMarketIdentityCache();
    return {
      shop: window.TasuMarketIdentity.getCurrentSellerShopId(),
      seller: window.TasuMarketIdentity.resolveSellerUserIdForShop("demo-shop-haru-cafe"),
    };
  });
  assert(demoSellerLs.shop === "demo-shop-custom", "demo LS seller shop");
  assert(demoSellerLs.seller === "u_shop_demo", "demo seller map");

  const prodBlocked = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.setItem(
      "tasu_market_seller_profile",
      JSON.stringify({ shopId: "demo-shop-custom", sellerUserId: "u_fake_seller" })
    );
    localStorage.setItem("tasu_market_seller_products", "[]");
    window.TasuMarketIdentity.invalidateMarketIdentityCache();
    const buyer = window.TasuMarketIdentity.getCurrentBuyerId();
    const sellerShop = window.TasuMarketIdentity.getCurrentSellerShopId();
    const notifyBuyer = window.TasfulMarketNotify?.resolveBuyerUserId?.();
    const notifySeller = window.TasfulMarketNotify?.resolveSellerUserId?.("demo-shop-haru-cafe");
    return { buyer, sellerShop, notifyBuyer, notifySeller };
  });
  assert(!prodBlocked.buyer, "prod buyer blocked without JWT");
  assert(!prodBlocked.sellerShop, "prod LS seller shop blocked");
  assert(!prodBlocked.notifyBuyer, "prod notify buyer blocked");
  assert(!prodBlocked.notifySeller, "prod notify seller blocked without cache");

  const prodOwner = await page.evaluate(() => {
    const listing = { user_id: "u_owner_prod", id: "demo-shop-haru-cafe" };
    return window.TasuMarketIdentity.isListingOwnedByCurrentUser(listing);
  });
  assert(!prodOwner, "prod listing owner without JWT");

  const checkoutUrl = buildLocalPageUrl(base, "shop-market-checkout.html", "?talkDev=1&userId=u_me");
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.TasuMarketIdentity !== "undefined", {
    timeout: 15000,
  });
  const checkoutOk = await page.evaluate(() => ({
    hasIdentity: typeof window.TasuMarketIdentity !== "undefined",
    hasCheckout: typeof window.TasuMarketIdentity.getCurrentBuyerId === "function",
    body: Boolean(document.querySelector("[data-tasful-checkout-body], [data-tasful-checkout-status]")),
  }));
  assert(checkoutOk.hasIdentity, "checkout identity loaded");
  assert(checkoutOk.body, "checkout page renders");

  console.log("  demo buyer/seller: PASS");
  console.log("  demo LS seller: PASS");
  console.log("  prod LS blocked: PASS");
  console.log("  checkout page: PASS");
  console.log("\nSUMMARY: ALL PASS");
});

await closeAllBrowsers();
