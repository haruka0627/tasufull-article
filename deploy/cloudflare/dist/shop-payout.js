/**
 * 店舗・販売 — 振込先 / Stripe Connect / プラットフォーム手数料
 * TASFUL は販売者ではなく、掲載・決済導線を提供するプラットフォーム。
 */
(function () {
  "use strict";

  const DEFAULT_PLATFORM_FEE_RATE = 0.1;
  const PAYOUT_NOT_READY_MSG =
    "この店舗は現在、購入決済に対応していません。出品者の決済設定が完了すると、商品を購入できます。";

  function readDemoConnectFromUrl() {
    try {
      const q = String(new URLSearchParams(window.location.search).get("demoConnect") || "")
        .trim()
        .toLowerCase();
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function isBenchPurchaseContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("review") === "chat-demo" || params.get("liveFlow") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function resolvePurchaseBlockedMessage(shop) {
    const Category = window.TasuPlatformChatCategoryFlow;
    const demo = readDemoConnectFromUrl();
    if (demo === false || (Category?.readDemoConnectFlag?.(shop) === false && isBenchPurchaseContext())) {
      return Category?.getConnectRequiredSetupMessage?.("shop_store", { bench: true }) || PAYOUT_NOT_READY_MSG;
    }
    return Category?.getConnectRequiredSetupMessage?.("shop_store") || PAYOUT_NOT_READY_MSG;
  }

  function isShopPurchaseConnectEnabled(shop) {
    const Category = window.TasuPlatformChatCategoryFlow;
    if (Category?.isShopPurchaseConnectEnabled) {
      return Category.isShopPurchaseConnectEnabled(shop) === true;
    }
    const demo = readDemoConnectFromUrl();
    if (demo === false) return false;
    if (demo === true) return true;
    const payout = extractShopPayout(shop);
    return Boolean(payout?.payout_enabled && payout?.stripe_account_id);
  }

  function isDemoShopId(shopId) {
    const id = String(shopId || "").trim();
    if (!id) return false;
    if (/^demo-shop-/i.test(id)) return true;
    if (id === "demo-shop-store" || id === "demo-shop") return true;
    if (window.TasuShopStoreDemo?.isShopStoreDemoId?.(id)) return true;
    return false;
  }

  /**
   * @param {object} shop — business_listings / shop demo row
   * @returns {import('./shop-payout').ShopPayoutInfo}
   */
  function extractShopPayout(shop) {
    if (!shop || typeof shop !== "object") return null;

    const fd = shop.form_data && typeof shop.form_data === "object" ? shop.form_data : {};
    const extra =
      shop.category_extra?.shop_store && typeof shop.category_extra.shop_store === "object"
        ? shop.category_extra.shop_store
        : {};

    const shopId = String(shop.id || shop.demo_id || fd.demo_id || "").trim();
    const stripe_account_id = String(
      shop.stripe_account_id ||
        shop.stripe_connect_account_id ||
        fd.stripe_account_id ||
        extra.stripe_account_id ||
        ""
    ).trim();

    const payout_account_status = String(
      shop.payout_account_status || fd.payout_account_status || extra.payout_account_status || "not_connected"
    ).trim();

    let platform_fee_rate = Number(
      shop.platform_fee_rate ?? fd.platform_fee_rate ?? extra.platform_fee_rate
    );
    if (!Number.isFinite(platform_fee_rate) || platform_fee_rate < 0 || platform_fee_rate > 1) {
      platform_fee_rate = DEFAULT_PLATFORM_FEE_RATE;
    }

    const seller_user_id = String(
      shop.seller_user_id || shop.user_id || fd.seller_user_id || ""
    ).trim();

    const isDemo = isDemoShopId(shopId);
    let payout_enabled = shop.payout_enabled === true || fd.payout_enabled === true;

    if (isDemo) {
      payout_enabled = true;
    } else if (stripe_account_id) {
      const activeStatus = /^(active|verified|enabled)$/i.test(payout_account_status);
      payout_enabled = payout_enabled || activeStatus;
      if (shop.payout_enabled === false) payout_enabled = false;
    } else {
      payout_enabled = false;
    }

    return {
      shopId,
      stripe_account_id,
      payout_account_status,
      payout_enabled,
      platform_fee_rate,
      seller_user_id,
      isDemo,
    };
  }

  function calcFees(amountTotal, platformFeeRate) {
    const total = Math.max(0, Math.round(Number(amountTotal) || 0));
    const rate =
      Number.isFinite(Number(platformFeeRate)) && platformFeeRate >= 0 && platformFeeRate <= 1
        ? Number(platformFeeRate)
        : DEFAULT_PLATFORM_FEE_RATE;
    const platform_fee_amount = Math.round(total * rate);
    const seller_amount = Math.max(0, total - platform_fee_amount);
    return { amount_total: total, platform_fee_amount, seller_amount, platform_fee_rate: rate };
  }

  function isStripeConfigured() {
    return Boolean(window.TasuShopCheckout?.isStripeConfigured?.());
  }

  /**
   * オンライン購入可否
   * @returns {{ ok: boolean, reason?: string, useDemoCheckout?: boolean, payout?: object }}
   */
  function evaluatePurchase(shop) {
    const payout = extractShopPayout(shop);
    if (!payout?.shopId) {
      return { ok: false, reason: "店舗情報を取得できませんでした。" };
    }

    if (payout.isDemo) {
      if (!isShopPurchaseConnectEnabled(shop)) {
        return {
          ok: false,
          reason: resolvePurchaseBlockedMessage(shop),
          payout,
        };
      }
      return {
        ok: true,
        payout,
        useDemoCheckout: !isStripeConfigured() || !payout.stripe_account_id,
      };
    }

    if (!payout.payout_enabled || !payout.stripe_account_id) {
      return { ok: false, reason: resolvePurchaseBlockedMessage(shop), payout };
    }

    if (!isStripeConfigured()) {
      return {
        ok: false,
        reason: "決済システムの準備中です。しばらくお待ちください。",
        payout,
      };
    }

    return { ok: true, payout, useDemoCheckout: false };
  }

  window.TasuShopPayout = {
    DEFAULT_PLATFORM_FEE_RATE,
    PAYOUT_NOT_READY_MSG,
    isDemoShopId,
    extractShopPayout,
    calcFees,
    evaluatePurchase,
  };
})();
