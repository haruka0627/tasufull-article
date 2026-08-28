/**
 * Economics Core V1 — revenue aggregation (Phase 2).
 */

import { REVENUE_TYPES } from "./contracts.mjs";
import { dedupeRecords } from "./normalize.mjs";

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {{ period?: string, product?: string, user_id?: string }} [filter]
 */
export function aggregateRevenue(records, filter = {}) {
  const deduped = dedupeRecords(records);
  const rows = deduped.filter((r) => {
    if (filter.period && r.period !== filter.period) return false;
    if (filter.product && r.product !== filter.product) return false;
    if (filter.user_id != null && r.user_id !== filter.user_id) return false;
    return r.direction === "revenue" || r.direction === "refund";
  });

  let gross = 0;
  let refunds = 0;
  let chargebacks = 0;
  /** @type {object[]} */
  const trace = [];
  let fxMissing = false;

  for (const r of rows) {
    if (r.fx_status === "FX_MISSING" || r.fx_status === "UNSUPPORTED_CURRENCY" || r.amount_jpy == null) {
      fxMissing = true;
      trace.push({ source_id: r.source_id, issue: r.fx_status || "FX_MISSING" });
      continue;
    }
    const amt = Math.round(r.amount_jpy);
    if (r.direction === "refund" || r.revenue_type === REVENUE_TYPES.REFUND) {
      refunds += Math.abs(amt);
      trace.push({
        source_id: r.source_id,
        source: r.source,
        direction: "refund",
        amount_jpy: -Math.abs(amt),
        actuality: r.actuality,
      });
      continue;
    }
    if (r.revenue_type === REVENUE_TYPES.CHARGEBACK) {
      chargebacks += Math.abs(amt);
      trace.push({
        source_id: r.source_id,
        source: r.source,
        direction: "chargeback",
        amount_jpy: -Math.abs(amt),
        actuality: r.actuality,
      });
      continue;
    }
    gross += amt;
    trace.push({
      source_id: r.source_id,
      source: r.source,
      amount_jpy: amt,
      revenue_type: r.revenue_type,
      fee_contract_id: r.fee_contract_id,
      actuality: r.actuality,
    });
  }

  const net = gross - refunds - chargebacks;
  return {
    PRODUCT_REVENUE: filter.product
      ? { product: filter.product, gross_jpy: gross, refunds_jpy: refunds, chargebacks_jpy: chargebacks, net_jpy: net }
      : null,
    USER_ATTRIBUTABLE_REVENUE: filter.user_id != null
      ? { user_id: filter.user_id, gross_jpy: gross, refunds_jpy: refunds, chargebacks_jpy: chargebacks, net_jpy: net }
      : null,
    PERIOD_REVENUE: {
      period: filter.period || null,
      product: filter.product || null,
      user_id: filter.user_id || null,
      gross_jpy: gross,
      refunds_jpy: refunds,
      chargebacks_jpy: chargebacks,
      net_jpy: net,
      event_count: rows.length,
      fx_missing: fxMissing,
    },
    trace,
  };
}
