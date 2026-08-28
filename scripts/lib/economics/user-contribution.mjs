/**
 * Economics Core V1 Phase 5 — User Contribution Profit.
 * USER_ATTRIBUTABLE_REVENUE − USER_ATTRIBUTABLE_VARIABLE_COST.
 * Negative values preserved. Missing cost ≠ ¥0.
 */

import { PRODUCTS, ATTRIBUTION_STATUS, PROFIT_STATUS } from "./contracts.mjs";
import { dedupeRecords } from "./normalize.mjs";
import { filterRecordsByPeriod } from "./period.mjs";
import { computeContributionProfit } from "./contribution.mjs";

/**
 * @param {import('./normalize.mjs').EconomicsRecord} record
 */
export function resolveAttributionStatus(record) {
  if (record?.user_id == null || String(record.user_id).trim() === "") {
    return ATTRIBUTION_STATUS.UNATTRIBUTED;
  }
  return ATTRIBUTION_STATUS.ATTRIBUTED;
}

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {{
 *   user_id?: string|null,
 *   period_start?: string|null,
 *   period_end?: string|null,
 *   period?: string|null,
 *   product?: string|null,
 *   required_cost_types?: string[],
 *   roles?: string[],
 * }} [opts]
 */
export function computeUserContribution(opts = {}) {
  const periodFiltered = filterRecordsByPeriod(dedupeRecords(opts.records || []), {
    period_start: opts.period_start,
    period_end: opts.period_end,
    period: opts.period,
  });

  const userKey =
    opts.user_id === undefined
      ? undefined
      : opts.user_id == null || opts.user_id === ""
        ? null
        : String(opts.user_id);

  const scoped = periodFiltered.filter((r) => {
    if (opts.product && r.product !== opts.product) return false;
    if (userKey === undefined) return true;
    if (userKey === null) return r.user_id == null || r.user_id === "";
    return String(r.user_id) === userKey;
  });

  const roles = new Set();
  for (const r of scoped) {
    if (r.user_role) roles.add(String(r.user_role));
    for (const role of r.user_roles || []) roles.add(String(role));
  }
  if (Array.isArray(opts.roles)) {
    for (const role of opts.roles) roles.add(String(role));
  }

  const productsPresent = [...new Set(scoped.map((r) => r.product).filter(Boolean))];

  /** @type {Record<string, object>} */
  const products = {};
  let revenueSum = 0;
  let costSum = 0;
  let costKnown = true;
  /** @type {string[]} */
  const unavailable = [];
  let actualAmount = 0;
  let estimatedAmount = 0;
  /** @type {string[]} */
  const traceIds = [];
  /** @type {string[]} */
  const statuses = [];

  const productList = opts.product ? [opts.product] : PRODUCTS.filter((p) => productsPresent.includes(p));

  for (const product of productList.length ? productList : productsPresent) {
    const productRecords = scoped.filter((r) => r.product === product);
    const contrib = computeContributionProfit({
      records: productRecords,
      product,
      period: opts.period || null,
      required_cost_types: opts.required_cost_types || [],
    }).PERIOD_CONTRIBUTION_PROFIT;

    const rev = contrib.attributable_revenue_jpy || 0;
    const cost = contrib.attributable_variable_cost_jpy;
    const profit = contrib.contribution_profit_jpy;
    statuses.push(contrib.PROFIT_STATUS);
    for (const t of contrib.unavailable_cost_types || []) unavailable.push(`${product}:${t}`);
    for (const tr of contrib.revenue_trace || []) {
      if (tr.source_id) traceIds.push(`${product}:${tr.source_id}`);
    }

    if (contrib.PROFIT_STATUS === PROFIT_STATUS.ESTIMATED || contrib.PROFIT_STATUS === PROFIT_STATUS.FORECAST) {
      estimatedAmount += Math.abs(rev) + Math.abs(cost || 0);
    } else {
      actualAmount += Math.abs(rev) + Math.abs(cost || 0);
    }

    revenueSum += rev;
    if (cost == null) costKnown = false;
    else costSum += cost;

    const margin =
      profit == null || rev === 0 ? null : Number((profit / rev).toFixed(6));

    products[product] = {
      product,
      revenue_jpy: rev,
      variable_cost_jpy: cost,
      contribution_profit_jpy: profit,
      contribution_margin: margin,
      status: contrib.PROFIT_STATUS,
      unavailable_cost_types: contrib.unavailable_cost_types || [],
    };
  }

  const contribution_profit_jpy = costKnown ? revenueSum - costSum : null;
  const contribution_margin =
    contribution_profit_jpy == null || revenueSum === 0
      ? null
      : Number((contribution_profit_jpy / revenueSum).toFixed(6));

  const status = mergeStatuses(statuses, costKnown, contribution_profit_jpy);

  return {
    user_id: userKey === undefined ? null : userKey,
    attribution_status:
      userKey === null ? ATTRIBUTION_STATUS.UNATTRIBUTED : ATTRIBUTION_STATUS.ATTRIBUTED,
    period_start: opts.period_start || null,
    period_end: opts.period_end || null,
    period: opts.period || null,
    roles: [...roles],
    revenue_jpy: revenueSum,
    variable_cost_jpy: costKnown ? costSum : null,
    contribution_profit_jpy,
    contribution_margin,
    products,
    actual_amount_jpy: actualAmount,
    estimated_amount_jpy: estimatedAmount,
    unavailable_cost_types: [...new Set(unavailable)],
    status,
    source_count: scoped.length,
    trace_ids: [...new Set(traceIds)],
    missing_cost_zero_forbidden: true,
    internal_only: true,
  };
}

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {object} [opts]
 */
export function computeUserContributionLedger(opts = {}) {
  const periodFiltered = filterRecordsByPeriod(dedupeRecords(opts.records || []), {
    period_start: opts.period_start,
    period_end: opts.period_end,
    period: opts.period,
  });

  const userIds = new Set();
  let hasUnattributed = false;
  for (const r of periodFiltered) {
    if (r.user_id == null || r.user_id === "") hasUnattributed = true;
    else userIds.add(String(r.user_id));
  }

  const users = [...userIds].sort().map((user_id) =>
    computeUserContribution({
      ...opts,
      records: periodFiltered,
      user_id,
    }),
  );

  const unattributed = hasUnattributed
    ? computeUserContribution({
        ...opts,
        records: periodFiltered,
        user_id: null,
      })
    : null;

  return {
    period_start: opts.period_start || null,
    period_end: opts.period_end || null,
    period: opts.period || null,
    users,
    unattributed,
    user_count: users.length,
    has_unattributed: hasUnattributed,
  };
}

function mergeStatuses(statuses, costKnown, profit) {
  if (!statuses.length) return PROFIT_STATUS.UNAVAILABLE;
  if (statuses.includes(PROFIT_STATUS.UNAVAILABLE)) return PROFIT_STATUS.UNAVAILABLE;
  if (!costKnown || profit == null || statuses.includes(PROFIT_STATUS.PARTIAL_ACTUAL)) {
    return PROFIT_STATUS.PARTIAL_ACTUAL;
  }
  if (statuses.includes(PROFIT_STATUS.FORECAST)) return PROFIT_STATUS.FORECAST;
  if (statuses.includes(PROFIT_STATUS.ESTIMATED)) return PROFIT_STATUS.ESTIMATED;
  return PROFIT_STATUS.COMPLETE_ACTUAL;
}
