/**
 * Economics Core V1 — Contribution Profit + status (Phase 4).
 */

import { ACTUALITY, PROFIT_STATUS } from "./contracts.mjs";
import { aggregateRevenue } from "./revenue.mjs";
import { aggregateVariableCosts } from "./costs.mjs";

/**
 * @param {object} opts
 * @param {import('./normalize.mjs').EconomicsRecord[]} opts.records
 * @param {string} [opts.period]
 * @param {string} [opts.product]
 * @param {string|null} [opts.user_id]
 * @param {string[]} [opts.required_cost_types]
 */
export function computeContributionProfit(opts) {
  const filter = {
    period: opts.period,
    product: opts.product,
    user_id: opts.user_id,
  };
  const revenue = aggregateRevenue(opts.records || [], filter);
  const costs = aggregateVariableCosts(opts.records || [], {
    ...filter,
    required_cost_types: opts.required_cost_types || [],
  });

  const attributable_revenue_jpy = revenue.PERIOD_REVENUE.net_jpy;
  const attributable_variable_cost_jpy = costs.total_variable_cost_jpy;

  let contribution_profit_jpy = null;
  if (attributable_variable_cost_jpy == null) {
    contribution_profit_jpy = null;
  } else {
    contribution_profit_jpy = attributable_revenue_jpy - attributable_variable_cost_jpy;
  }

  const status = resolveProfitStatus({
    revenue,
    costs,
    contribution_profit_jpy,
  });

  const base = {
    attributable_revenue_jpy,
    attributable_variable_cost_jpy,
    contribution_profit_jpy,
    PROFIT_STATUS: status,
    missing_cost_zero_forbidden: true,
    revenue_trace: revenue.trace,
    cost_by_type: costs.by_type,
    unavailable_cost_types: costs.unavailable_cost_types,
  };

  return {
    PRODUCT_CONTRIBUTION_PROFIT: opts.product
      ? { product: opts.product, period: opts.period || null, ...base }
      : null,
    USER_CONTRIBUTION_PROFIT: opts.user_id != null
      ? { user_id: opts.user_id, product: opts.product || null, period: opts.period || null, ...base }
      : null,
    PERIOD_CONTRIBUTION_PROFIT: {
      period: opts.period || null,
      product: opts.product || null,
      user_id: opts.user_id ?? null,
      ...base,
    },
  };
}

function resolveProfitStatus({ revenue, costs, contribution_profit_jpy }) {
  if (revenue.PERIOD_REVENUE.fx_missing || costs.fx_missing) {
    return PROFIT_STATUS.UNAVAILABLE;
  }
  if (costs.unavailable_cost_types.length > 0 || contribution_profit_jpy == null) {
    if (revenue.PERIOD_REVENUE.event_count === 0 && costs.unavailable_cost_types.length > 0) {
      return PROFIT_STATUS.UNAVAILABLE;
    }
    return PROFIT_STATUS.PARTIAL_ACTUAL;
  }

  const actualities = [];
  for (const info of Object.values(costs.by_type)) {
    if (info.status === "PRESENT" && info.actuality) actualities.push(info.actuality);
  }
  if (actualities.some((a) => a === ACTUALITY.FORECAST)) return PROFIT_STATUS.FORECAST;
  if (actualities.some((a) => a === ACTUALITY.ESTIMATED)) return PROFIT_STATUS.ESTIMATED;

  const hasEstimatedRevenue = (revenue.trace || []).some((t) => t.actuality === ACTUALITY.ESTIMATED);
  if (hasEstimatedRevenue) return PROFIT_STATUS.ESTIMATED;

  return PROFIT_STATUS.COMPLETE_ACTUAL;
}

/**
 * Future secretary payload shape only (not wired).
 */
export function buildEconomicsSummaryPayload(periodContribution) {
  return {
    type: "ECONOMICS_SUMMARY",
    version: 1,
    read_only: true,
    llm_must_not_recalculate: true,
    payload: periodContribution,
  };
}
