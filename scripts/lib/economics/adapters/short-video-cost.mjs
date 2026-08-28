/**
 * Read-only adapter: public.short_video_cost_events → Economics cost records.
 */

import { ACTUALITY, COST_TYPES, COST_CLASS } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";

/**
 * @param {object[]} rows
 * @param {{ fx_rate?: number|null, fx_source?: string|null }} [fx]
 */
export function adaptShortVideoCostEvents(rows, fx = {}) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    const occurred_at = String(row.created_at || "").trim();
    if (!occurred_at) {
      errors.push({ source_id: row.id, error: "missing_occurred_at" });
      continue;
    }
    const hasActual = row.actual_cost != null && Number.isFinite(Number(row.actual_cost));
    const hasEst = row.estimated_cost != null && Number.isFinite(Number(row.estimated_cost));
    if (!hasActual && !hasEst) {
      errors.push({ source_id: row.id, error: "missing_cost", note: "not coerced to ¥0" });
      continue;
    }
    const amount = hasActual ? Number(row.actual_cost) : Number(row.estimated_cost);
    const currency = String(row.currency || "JPY").toUpperCase();
    const costType =
      String(row.event_type || "").includes("storage")
        ? COST_TYPES.STORAGE_COST
        : COST_TYPES.MEDIA_PROCESSING_COST;
    const raw = {
      product: "SHORT",
      feature: row.event_type || null,
      provider: row.provider || null,
      vendor: row.provider || null,
      user_id: row.user_id || null,
      user_role: row.user_id ? "SHORT_USER" : null,
      direction: "cost",
      cost_type: costType,
      cost_class: COST_CLASS.DIRECT_VARIABLE,
      source_currency: currency,
      source_amount: amount,
      fx_rate: currency === "JPY" ? 1 : fx.fx_rate,
      fx_source: currency === "JPY" ? "IDENTITY" : fx.fx_source || null,
      actuality: hasActual ? ACTUALITY.ACTUAL : ACTUALITY.ESTIMATED,
      source: "short_video_cost_events",
      source_id: String(row.id),
      occurred_at,
      period: toJstMonthKey(occurred_at),
      quantity: row.quantity == null ? null : Number(row.quantity),
      unit: row.unit || null,
      adapter: "adaptShortVideoCostEvents",
    };
    const result = normalizeEconomicsEvent(raw);
    if (!result.ok) errors.push({ source_id: raw.source_id, error: result.error });
    else records.push(result.record);
  }
  return {
    adapter: "short_video_cost_events",
    status: "REAL_READ_ONLY_ADAPTER",
    connected: false,
    note: "Shape adapter only — no automatic DB fetch",
    records,
    errors,
  };
}
