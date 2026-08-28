/**
 * Economics Core V1 — variable cost aggregation (Phase 3).
 * Missing cost classes must NOT be coerced to ¥0.
 */

import { CONTRIBUTION_COST_TYPES, COST_TYPES, COST_CLASS, ACTUALITY } from "./contracts.mjs";
import { dedupeRecords } from "./normalize.mjs";

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {{ period?: string, product?: string, user_id?: string, required_cost_types?: string[] }} [filter]
 */
export function aggregateVariableCosts(records, filter = {}) {
  const deduped = dedupeRecords(records);
  const required = filter.required_cost_types || [];

  /** @type {Record<string, { amount_jpy: number|null, status: string, actuality: string|null, events: object[] }>} */
  const byType = {};
  for (const t of CONTRIBUTION_COST_TYPES) {
    byType[t] = { amount_jpy: 0, status: "ABSENT", actuality: null, events: [] };
  }

  const rows = deduped.filter((r) => {
    if (r.direction !== "cost") return false;
    if (filter.period && r.period !== filter.period) return false;
    if (filter.product && r.product !== filter.product) return false;
    if (filter.user_id != null && r.user_id !== filter.user_id) return false;
    if (r.cost_class === COST_CLASS.SHARED_FIXED || r.cost_class === COST_CLASS.NON_PRODUCT_COST) {
      return false;
    }
    return true;
  });

  let fxMissing = false;

  for (const r of rows) {
    const type = r.cost_type || COST_TYPES.OTHER_ATTRIBUTABLE_VARIABLE_COST;
    if (!byType[type]) {
      byType[type] = { amount_jpy: 0, status: "ABSENT", actuality: null, events: [] };
    }
    if (r.fx_status === "FX_MISSING" || r.fx_status === "UNSUPPORTED_CURRENCY" || r.amount_jpy == null) {
      fxMissing = true;
      byType[type].status = "UNAVAILABLE";
      byType[type].amount_jpy = null;
      byType[type].events.push({ source_id: r.source_id, issue: r.fx_status || "FX_MISSING" });
      continue;
    }
    if (byType[type].status === "UNAVAILABLE") {
      byType[type].events.push({ source_id: r.source_id, skipped: "type_already_unavailable" });
      continue;
    }
    byType[type].amount_jpy = (byType[type].amount_jpy || 0) + Math.round(r.amount_jpy);
    byType[type].status = "PRESENT";
    byType[type].actuality = r.actuality;
    byType[type].events.push({
      source_id: r.source_id,
      source: r.source,
      amount_jpy: Math.round(r.amount_jpy),
      actuality: r.actuality,
    });
  }

  /** Mark explicitly required-but-missing types */
  for (const t of required) {
    if (!byType[t]) {
      byType[t] = { amount_jpy: null, status: "UNAVAILABLE", actuality: null, events: [] };
    } else if (byType[t].status === "ABSENT") {
      byType[t].status = "UNAVAILABLE";
      byType[t].amount_jpy = null;
    }
  }

  let sum = 0;
  let canSum = true;
  const unavailable = [];
  const estimated = [];

  for (const [type, info] of Object.entries(byType)) {
    if (info.status === "UNAVAILABLE") {
      unavailable.push(type);
      canSum = false;
      continue;
    }
    if (info.status === "ABSENT") continue;
    if (info.actuality === ACTUALITY.ESTIMATED || info.actuality === ACTUALITY.FORECAST) {
      estimated.push(type);
    }
    sum += info.amount_jpy || 0;
  }

  return {
    by_type: byType,
    total_variable_cost_jpy: canSum ? sum : null,
    unavailable_cost_types: unavailable,
    estimated_cost_types: estimated,
    fx_missing: fxMissing,
    missing_cost_zero_forbidden: true,
    note:
      unavailable.length > 0
        ? "Contribution must not treat unavailable costs as ¥0"
        : null,
  };
}
