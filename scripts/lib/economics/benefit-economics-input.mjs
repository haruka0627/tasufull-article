/**
 * Economics Core V1 — future Benefit input (read-only, no eligibility).
 */

/**
 * @param {object} userContribution — output of computeUserContribution
 */
export function buildBenefitEconomicsInput(userContribution) {
  if (!userContribution || userContribution.user_id == null) {
    return {
      ok: false,
      error: "attributed_user_required",
      eligibility_decision: null,
    };
  }
  return {
    ok: true,
    type: "BENEFIT_ECONOMICS_INPUT",
    version: 1,
    read_only: true,
    eligibility_decision: null,
    benefit_eligibility_implemented: false,
    internal_only: true,
    payload: {
      user_id: userContribution.user_id,
      period: userContribution.period,
      period_start: userContribution.period_start,
      period_end: userContribution.period_end,
      contribution_profit_jpy: userContribution.contribution_profit_jpy,
      status: userContribution.status,
      product_breakdown: userContribution.products,
      unavailable_cost_types: userContribution.unavailable_cost_types,
    },
  };
}
