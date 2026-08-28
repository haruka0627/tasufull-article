/**
 * Read-only adapter: Marketplace completion / transaction fee rows.
 * Counts platform fee once (no double-count payer+seller).
 */

import { ACTUALITY, COST_TYPES, COST_CLASS, REVENUE_TYPES } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";

/**
 * @param {object[]} rows
 * each: { id, fee_jpy, fee_contract_id?, seller_id?, provider_id?, payer_id?, payment_processing_cost_jpy?, occurred_at }
 */
export function adaptMarketplaceFees(rows) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    const occurred_at = String(row.occurred_at || row.created_at || "").trim();
    const source_id = String(row.id || "").trim();
    if (!occurred_at || !source_id) {
      errors.push({ source_id, error: "missing_id_or_time" });
      continue;
    }
    const fee = Math.round(Number(row.fee_jpy ?? row.platform_fee_amount ?? 0));
    const attributedUser = row.seller_id || row.provider_id || null;
    const rev = normalizeEconomicsEvent({
      product: "MARKETPLACE",
      feature: "transaction_fee",
      user_id: attributedUser,
      user_role: attributedUser ? (row.seller_id ? "SELLER" : "PROVIDER") : null,
      direction: "revenue",
      revenue_type: REVENUE_TYPES.TRANSACTION_FEE,
      fee_contract_id: row.fee_contract_id || "MARKETPLACE_GENERAL",
      source_currency: "JPY",
      source_amount: fee,
      actuality: ACTUALITY.ACTUAL,
      source: "marketplace_fee",
      source_id: `${source_id}:platform_fee`,
      occurred_at,
      period: toJstMonthKey(occurred_at),
      adapter: "adaptMarketplaceFees",
      party_refs: {
        seller_id: row.seller_id || null,
        provider_id: row.provider_id || null,
        payer_id: row.payer_id || null,
      },
    });
    if (!rev.ok) errors.push({ source_id, error: rev.error });
    else records.push(rev.record);

    if (row.payment_processing_cost_jpy != null) {
      const pay = normalizeEconomicsEvent({
        product: "MARKETPLACE",
        feature: "transaction_fee",
        user_id: attributedUser,
        direction: "cost",
        cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
        cost_class: COST_CLASS.DIRECT_VARIABLE,
        source_currency: "JPY",
        source_amount: Math.round(Number(row.payment_processing_cost_jpy)),
        actuality: ACTUALITY.ACTUAL,
        source: "marketplace_fee",
        source_id: `${source_id}:payment_cost`,
        occurred_at,
        period: toJstMonthKey(occurred_at),
        adapter: "adaptMarketplaceFees",
      });
      if (!pay.ok) errors.push({ source_id, error: pay.error });
      else records.push(pay.record);
    }
  }
  return {
    adapter: "marketplace_fee",
    status: "REAL_READ_ONLY_ADAPTER",
    connected: false,
    note: "Shape adapter · one platform fee event counted once",
    records,
    errors,
  };
}
