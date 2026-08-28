/**
 * Read-only adapter: canonical TLV creator-attributed Net rows → revenue events.
 * Creator distribution is intentionally deferred to the creator-month settlement
 * engine so no ledger row/event/intermediate rounding can occur.
 */

import { ACTUALITY, REVENUE_TYPES } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";

/**
 * @param {object[]} rows — each: { id, creator_id|user_id,
 *   net_amount_jpy, occurred_at|created_at, source_table? }
 */
export function adaptTlvTipEvents(rows) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    const occurred_at = String(row.occurred_at || row.created_at || "").trim();
    const source_id = String(row.id || row.source_id || "").trim();
    if (!occurred_at || !source_id) {
      errors.push({ source_id, error: "missing_id_or_time" });
      continue;
    }
    if (row.source_table && row.source_table !== "tlv.revenue_ledger") {
      errors.push({ source_id, error: "noncanonical_financial_source" });
      continue;
    }
    const attributedNet = Number(row.net_amount_jpy);
    if (!Number.isSafeInteger(attributedNet) || attributedNet < 0) {
      errors.push({ source_id, error: "invalid_creator_attributed_net" });
      continue;
    }
    const creatorId = row.creator_id || row.user_id || null;

    const rev = normalizeEconomicsEvent({
      product: "TLV",
      feature: "gift_tip",
      user_id: creatorId,
      user_role: creatorId ? "CREATOR" : null,
      direction: "revenue",
      revenue_type: REVENUE_TYPES.GIFT_TIP,
      source_currency: "JPY",
      source_amount: attributedNet,
      actuality: ACTUALITY.ACTUAL,
      source: "tlv.revenue_ledger",
      source_id: `${source_id}:creator_attributed_net`,
      occurred_at,
      period: toJstMonthKey(occurred_at),
      adapter: "adaptTlvTipEvents",
      party_refs: { creator_id: creatorId, payer_id: row.payer_id || null },
    });
    if (!rev.ok) errors.push({ source_id, error: rev.error });
    else records.push(rev.record);
  }
  return {
    adapter: "tlv.revenue_ledger",
    status: "REAL_READ_ONLY_ADAPTER",
    connected: false,
    creator_distribution_deferred_to_monthly_settlement: true,
    note: "Canonical Net shape adapter · no DB fetch · no row/event rounding · public.live_tips rejected",
    records,
    errors,
  };
}
