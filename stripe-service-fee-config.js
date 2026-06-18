/**
 * 業務サービス — TASFUL 成約手数料 Checkout
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

  window.TasuStripeServiceFeeConfig = {
    supabaseUrl: base,
    createServiceFeeCheckoutUrl: fnUrl("stripe-create-service-fee"),
    confirmServiceFeeUrl: fnUrl("stripe-confirm-service-fee"),
    getPublishableAnonKey: featured.getPublishableAnonKey,
    bankTransferInfo:
      "【TASFUL法人口座（例）】\n三菱UFJ銀行 渋谷支店 普通 1234567\nカ）タスフル\n※振込手数料はご負担ください",
    isConfigured() {
      return Boolean(base && this.createServiceFeeCheckoutUrl && featured.getPublishableAnonKey?.());
    },
  };
})();
