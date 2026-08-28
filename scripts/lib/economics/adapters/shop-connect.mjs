/**
 * Read-only adapter: Shop Connect checkout fee rows → TASFUL fee revenue (+ optional payment cost).
 * fee_contract_id=SHOP_CONNECT · 10% · min NONE. GMV is not TASFUL revenue.
 */

import { ACTUALITY, COST_TYPES, COST_CLASS, REVENUE_TYPES } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";
import { computeShopConnectPlatformFee } from "../shop-connect.mjs";

/**
 * @param {object[]} rows
 * each: { id, seller_id|user_id, gmv_jpy, platform_fee_amount?, payment_processing_cost_jpy?, occurred_at }
 */
export function adaptShopConnectCheckouts(rows) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    const occurred_at = String(row.occurred_at || row.created_at || "").trim();
    const source_id = String(row.id || row.session_id || "").trim();
    if (!occurred_at || !source_id) {
      errors.push({ source_id, error: "missing_id_or_time" });
      continue;
    }
    const gmv = Math.round(Number(row.gmv_jpy ?? row.amount_total ?? 0));
    const fee =
      row.platform_fee_amount != null
        ? Math.round(Number(row.platform_fee_amount))
        : computeShopConnectPlatformFee(gmv).tasful_revenue_jpy;
    const sellerId = row.seller_id || row.user_id || null;

    const rev = normalizeEconomicsEvent({
      product: "SHOP_CONNECT",
      feature: "checkout",
      user_id: sellerId,
      user_role: sellerId ? "SELLER" : null,
      direction: "revenue",
      revenue_type: REVENUE_TYPES.CHECKOUT_PLATFORM_FEE,
      fee_contract_id: "SHOP_CONNECT",
      source_currency: "JPY",
      source_amount: fee,
      actuality: ACTUALITY.ACTUAL,
      source: "shop_connect_checkout",
      source_id: `${source_id}:platform_fee`,
      occurred_at,
      period: toJstMonthKey(occurred_at),
      adapter: "adaptShopConnectCheckouts",
      party_refs: {
        seller_id: sellerId,
        payer_id: row.payer_id || row.customer_id || null,
      },
    });
    if (!rev.ok) errors.push({ source_id, error: rev.error });
    else records.push(rev.record);

    if (row.payment_processing_cost_jpy != null) {
      const pay = normalizeEconomicsEvent({
        product: "SHOP_CONNECT",
        feature: "checkout",
        user_id: sellerId,
        user_role: sellerId ? "SELLER" : null,
        direction: "cost",
        cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
        cost_class: COST_CLASS.DIRECT_VARIABLE,
        source_currency: "JPY",
        source_amount: Math.round(Number(row.payment_processing_cost_jpy)),
        actuality: ACTUALITY.ACTUAL,
        source: "shop_connect_checkout",
        source_id: `${source_id}:payment_cost`,
        occurred_at,
        period: toJstMonthKey(occurred_at),
        adapter: "adaptShopConnectCheckouts",
      });
      if (!pay.ok) errors.push({ source_id, error: pay.error });
      else records.push(pay.record);
    }

    if (row.refund_platform_fee_jpy != null) {
      const ref = normalizeEconomicsEvent({
        product: "SHOP_CONNECT",
        feature: "checkout_refund",
        user_id: sellerId,
        user_role: sellerId ? "SELLER" : null,
        direction: "refund",
        revenue_type: REVENUE_TYPES.REFUND,
        fee_contract_id: "SHOP_CONNECT",
        source_currency: "JPY",
        source_amount: Math.round(Number(row.refund_platform_fee_jpy)),
        actuality: ACTUALITY.ACTUAL,
        source: "shop_connect_checkout",
        source_id: `${source_id}:refund_fee`,
        occurred_at: String(row.refund_at || occurred_at),
        period: toJstMonthKey(row.refund_at || occurred_at),
        adapter: "adaptShopConnectCheckouts",
      });
      if (!ref.ok) errors.push({ source_id, error: ref.error });
      else records.push(ref.record);
    }
  }
  return {
    adapter: "shop_connect_checkout",
    status: "REAL_READ_ONLY_ADAPTER",
    connected: false,
    note: "Shape adapter · Stripe runtime unchanged · GMV excluded from TASFUL revenue",
    records,
    errors,
  };
}
