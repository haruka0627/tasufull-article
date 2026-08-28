/**
 * Builder adapter boundary: 8/6/5 scenarios are NEVER actual contribution.
 * Formal runtime fee rows (if any) use their actual contract amounts only.
 */

import { ACTUALITY, REVENUE_TYPES } from "../contracts.mjs";
import { normalizeEconomicsEvent } from "../normalize.mjs";
import { toJstMonthKey } from "../period.mjs";

/**
 * Reject scenario rows from actual contribution pipeline.
 * @param {object[]} rows
 */
export function adaptBuilderScenarioRows(rows) {
  return {
    adapter: "builder_success_fee_scenario",
    status: "FIXTURE_ADAPTER",
    connected: false,
    included_in_actual_contribution: false,
    note: "PRICING_SCENARIO_ONLY — excluded from USER_CONTRIBUTION",
    records: [],
    errors: (rows || []).map((r) => ({
      source_id: r?.id || null,
      error: "builder_scenario_excluded_from_actual",
    })),
  };
}

/**
 * Formal Builder fee events already charged under an actual contract (not 8/6/5 invent).
 * @param {object[]} rows — { id, partner_id|user_id, fee_jpy, fee_contract_id, occurred_at }
 */
export function adaptBuilderFormalFees(rows) {
  const records = [];
  const errors = [];
  for (const row of rows || []) {
    if (row.pricing_scenario_only || row.status === "PRICING_SCENARIO_ONLY") {
      errors.push({ source_id: row.id, error: "scenario_excluded" });
      continue;
    }
    const occurred_at = String(row.occurred_at || "").trim();
    const source_id = String(row.id || "").trim();
    if (!occurred_at || !source_id) {
      errors.push({ source_id, error: "missing_id_or_time" });
      continue;
    }
    const userId = row.partner_id || row.user_id || null;
    const result = normalizeEconomicsEvent({
      product: "BUILDER",
      feature: "success_fee",
      user_id: userId,
      user_role: userId ? "BUILDER_PARTNER" : null,
      direction: "revenue",
      revenue_type: REVENUE_TYPES.TRANSACTION_FEE,
      fee_contract_id: row.fee_contract_id || "BUILDER_FORMAL_RUNTIME",
      source_currency: "JPY",
      source_amount: Math.round(Number(row.fee_jpy || 0)),
      actuality: ACTUALITY.ACTUAL,
      source: "builder_formal_fee",
      source_id: `${source_id}:fee`,
      occurred_at,
      period: toJstMonthKey(occurred_at),
      adapter: "adaptBuilderFormalFees",
    });
    if (!result.ok) errors.push({ source_id, error: result.error });
    else records.push(result.record);
  }
  return {
    adapter: "builder_formal_fee",
    status: "NOT_CONNECTED",
    connected: false,
    included_in_actual_contribution: true,
    note: "Formal fee rows only when they exist — 8/6/5 never invents actual revenue",
    records,
    errors,
  };
}
