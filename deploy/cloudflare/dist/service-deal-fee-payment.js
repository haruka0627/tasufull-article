/**
 * 業務サービス — プラットフォーム手数料支払い（デモ / 将来 Stripe）
 */
(function () {
  "use strict";

  const PAYMENT_METHOD_DEMO = "demo";
  const PAYMENT_STATUS_PAID = "paid";

  /**
   * fee_paid 遷移用パッチ（adapter 共通）
   * @param {object} [overrides]
   */
  function buildFeePaidPatch(overrides) {
    const now = new Date().toISOString();
    const txId =
      overrides?.platform_fee_transaction_id != null
        ? String(overrides.platform_fee_transaction_id)
        : `demo_fee_${Date.now()}`;
    return {
      status: "fee_paid",
      platform_fee_paid_at: overrides?.platform_fee_paid_at || now,
      platform_fee_payment_method:
        overrides?.platform_fee_payment_method || PAYMENT_METHOD_DEMO,
      platform_fee_payment_status:
        overrides?.platform_fee_payment_status || PAYMENT_STATUS_PAID,
      platform_fee_transaction_id: txId,
      fee_paid_at: overrides?.fee_paid_at || overrides?.platform_fee_paid_at || now,
      updated_at: overrides?.updated_at || now,
      ...(overrides || {}),
    };
  }

  /**
   * localStorage デモ支払い（即時 fee_paid）
   * @param {string} dealId
   */
  async function payPlatformFeeDemo(dealId) {
    const key = String(dealId || "").trim();
    if (!key) throw new Error("取引IDがありません");

    const deal = await window.TasuServiceDealsDb?.fetchDealById?.(key);
    if (!deal) throw new Error("取引が見つかりません");
    if (deal.status !== "fee_pending") {
      throw new Error("手数料支払いは手数料支払い待ちの取引のみ可能です");
    }

    const patch = buildFeePaidPatch();
    const updated = await window.TasuServiceDealsDb.updateDeal(key, patch);
    if (!updated) throw new Error("手数料の支払い記録に失敗しました");
    return updated;
  }

  /**
   * @param {string} dealId
   * @param {{ adapter?: 'demo'|'stripe', stripeSessionId?: string }} [options]
   */
  async function payPlatformFee(dealId, options) {
    const adapter = String(options?.adapter || "demo").trim().toLowerCase();
    if (adapter === "stripe") {
      if (window.TasuServiceDealFeePaymentStripe?.payPlatformFee) {
        return window.TasuServiceDealFeePaymentStripe.payPlatformFee(dealId, options);
      }
      throw new Error("Stripe 手数料支払いは未設定です");
    }
    return payPlatformFeeDemo(dealId);
  }

  window.TasuServiceDealFeePayment = {
    PAYMENT_METHOD_DEMO,
    PAYMENT_STATUS_PAID,
    buildFeePaidPatch,
    payPlatformFeeDemo,
    payPlatformFee,
  };
})();
