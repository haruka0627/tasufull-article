/**
 * Economics Core V1 Phase 5 — platform vs user reconciliation.
 * Invariant: platform ≈ attributed users + unattributed (same event set).
 */

import { dedupeRecords } from "./normalize.mjs";
import { filterRecordsByPeriod } from "./period.mjs";
import { computeContributionProfit } from "./contribution.mjs";
import { computeUserContributionLedger } from "./user-contribution.mjs";

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {object} [opts]
 */
export function reconcilePlatformToUsers(opts = {}) {
  const records = filterRecordsByPeriod(dedupeRecords(opts.records || []), {
    period_start: opts.period_start,
    period_end: opts.period_end,
    period: opts.period,
  });

  const platform = computeContributionProfit({
    records,
    period: opts.period || null,
    required_cost_types: opts.required_cost_types || [],
  }).PERIOD_CONTRIBUTION_PROFIT;

  const ledger = computeUserContributionLedger({
    ...opts,
    records,
  });

  let userRev = 0;
  let userCost = 0;
  let userProfit = 0;
  let costKnown = true;

  for (const u of ledger.users) {
    userRev += u.revenue_jpy || 0;
    if (u.variable_cost_jpy == null) costKnown = false;
    else userCost += u.variable_cost_jpy;
    if (u.contribution_profit_jpy == null) costKnown = false;
    else userProfit += u.contribution_profit_jpy;
  }
  if (ledger.unattributed) {
    userRev += ledger.unattributed.revenue_jpy || 0;
    if (ledger.unattributed.variable_cost_jpy == null) costKnown = false;
    else userCost += ledger.unattributed.variable_cost_jpy;
    if (ledger.unattributed.contribution_profit_jpy == null) costKnown = false;
    else userProfit += ledger.unattributed.contribution_profit_jpy;
  }

  const platformRev = platform.attributable_revenue_jpy || 0;
  const platformCost = platform.attributable_variable_cost_jpy;
  const platformProfit = platform.contribution_profit_jpy;

  const revDelta = userRev - platformRev;
  const costDelta =
    platformCost == null || !costKnown ? null : userCost - platformCost;
  const profitDelta =
    platformProfit == null || !costKnown ? null : userProfit - platformProfit;

  const ok =
    Math.abs(revDelta) < 0.5 &&
    (costDelta == null || Math.abs(costDelta) < 0.5) &&
    (profitDelta == null || Math.abs(profitDelta) < 0.5);

  return {
    ok,
    PLATFORM_REVENUE: platformRev,
    USER_ATTRIBUTED_PLUS_UNATTRIBUTED_REVENUE: userRev,
    REVENUE_DELTA: revDelta,
    PLATFORM_VARIABLE_COST: platformCost,
    USER_ATTRIBUTED_PLUS_UNATTRIBUTED_COST: costKnown ? userCost : null,
    COST_DELTA: costDelta,
    PLATFORM_CONTRIBUTION: platformProfit,
    USER_ATTRIBUTED_PLUS_UNATTRIBUTED_CONTRIBUTION: costKnown ? userProfit : null,
    PROFIT_DELTA: profitDelta,
    DOUBLE_COUNT_GUARD: "source::source_id dedupe before aggregation",
    note: ok
      ? "reconciled within ¥0.5"
      : "reconciliation mismatch — inspect multiparty attribution / duplicates",
  };
}
