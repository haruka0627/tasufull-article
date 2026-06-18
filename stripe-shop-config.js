/**
 * 店舗商品購入 — Stripe Checkout エンドポイント
 */
(function () {
  "use strict";

  const featured = window.TasuStripeFeaturedConfig || {};
  const raw = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
  const base = String(raw.url || raw.SUPABASE_URL || featured.supabaseUrl || "")
    .trim()
    .replace(/\/$/, "");

  function fnUrl(name) {
    if (!base) return "";
    return `${base}/functions/v1/${name}`;
  }

  window.TasuStripeShopConfig = {
    supabaseUrl: base,
    anonKey: featured.anonKey || featured.getPublishableAnonKey?.() || "",
    createShopCheckoutUrl: fnUrl("stripe-create-shop-checkout"),
    confirmShopCheckoutUrl: fnUrl("stripe-confirm-shop-checkout"),
    getPublishableAnonKey: featured.getPublishableAnonKey || featured.resolvePublishableAnonKey,
    isConfigured() {
      return Boolean(
        base &&
        this.createShopCheckoutUrl &&
        this.confirmShopCheckoutUrl &&
        (this.getPublishableAnonKey?.() || this.anonKey)
      );
    },
  };
})();
