/**
 * Read-only adapter: public.ai_usage_events rows → Economics cost records.
 * Does not query DB. Caller supplies SELECT rows.
 */

import { ACTUALITY, COST_TYPES, COST_CLASS } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";

/**
 * @param {object[]} rows
 * @param {{ fx_rate?: number|null, fx_source?: string|null }} [fx]
 */
export function adaptAiUsageEvents(rows, fx = {}) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    const occurred_at = String(row.created_at || row.occurred_at || "").trim();
    if (!occurred_at) {
      errors.push({ source_id: row.request_id || row.id, error: "missing_occurred_at" });
      continue;
    }
    const currency = String(row.currency || "JPY").toUpperCase();
    const amount = row.estimated_cost;
    if (amount == null || !Number.isFinite(Number(amount))) {
      // Missing estimated cost → emit UNAVAILABLE marker via FX_MISSING-like null amount path:
      // skip inventing ¥0; surface as meta cost with amount null by using ESTIMATED 0 only when
      // explicitly present. Here: skip event but report missing.
      errors.push({
        source_id: row.request_id || row.id,
        error: "missing_estimated_cost",
        note: "not coerced to ¥0",
      });
      continue;
    }
    const raw = {
      product: "AI",
      feature: row.feature || null,
      provider: row.provider || null,
      vendor: row.provider || null,
      user_id: row.user_id || null,
      user_role: row.user_id ? "AI_SUBSCRIBER" : null,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: COST_CLASS.DIRECT_VARIABLE,
      source_currency: currency,
      source_amount: Number(amount),
      fx_rate: currency === "JPY" ? 1 : fx.fx_rate,
      fx_source: currency === "JPY" ? "IDENTITY" : fx.fx_source || null,
      fx_timestamp: occurred_at,
      actuality: ACTUALITY.ESTIMATED,
      source: "ai_usage_events",
      source_id: String(row.request_id || row.id),
      occurred_at,
      period: toJstMonthKey(occurred_at),
      quantity: row.total_units == null ? null : Number(row.total_units),
      unit: "units",
      adapter: "adaptAiUsageEvents",
    };
    const result = normalizeEconomicsEvent(raw);
    if (!result.ok) errors.push({ source_id: raw.source_id, error: result.error });
    else records.push(result.record);
  }
  return {
    adapter: "ai_usage_events",
    status: "REAL_READ_ONLY_ADAPTER",
    connected: false,
    note: "Shape adapter only — no automatic DB fetch",
    records,
    errors,
  };
}
