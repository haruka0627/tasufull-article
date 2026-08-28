/**
 * TLV progressive Creator Revenue Share (AD-040, 2026-08-28 update).
 *
 * The basis is one creator's monthly Eligible Net. Rank/Score must not
 * affect the result. Rates are marginal bracket rates, never a one-shot tier.
 */

export const TLV_REVENUE_SHARE_MODEL = "TLV_PROGRESSIVE_V1";

export const TLV_PROGRESSIVE_BRACKETS = Object.freeze([
  Object.freeze({ key: "JPY_0_TO_5M", lower_bound_jpy: 0, upper_bound_jpy: 5_000_000, creator_pct: 80, tasful_pct: 20 }),
  Object.freeze({ key: "JPY_5M_TO_10M", lower_bound_jpy: 5_000_000, upper_bound_jpy: 10_000_000, creator_pct: 90, tasful_pct: 10 }),
  Object.freeze({ key: "JPY_10M_TO_30M", lower_bound_jpy: 10_000_000, upper_bound_jpy: 30_000_000, creator_pct: 95, tasful_pct: 5 }),
  Object.freeze({ key: "JPY_ABOVE_30M", lower_bound_jpy: 30_000_000, upper_bound_jpy: null, creator_pct: 99, tasful_pct: 1 }),
]);

function requireEligibleNet(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("monthly_eligible_net_must_be_a_nonnegative_safe_integer_jpy");
  }
  return value;
}

/**
 * Resolve only the highest marginal bracket reached. This metadata must not
 * be used to multiply the whole monthly Eligible Net.
 */
export function resolveTlvTipSplit(monthlyEligibleNetJpy) {
  const eligibleNet = requireEligibleNet(monthlyEligibleNetJpy);
  const bracket = [...TLV_PROGRESSIVE_BRACKETS]
    .reverse()
    .find((candidate) => eligibleNet > candidate.lower_bound_jpy)
    || TLV_PROGRESSIVE_BRACKETS[0];
  return {
    revenue_share_model: TLV_REVENUE_SHARE_MODEL,
    creator_pct: bracket.creator_pct,
    tasful_pct: bracket.tasful_pct,
    band: bracket.key,
    rate_semantics: "MARGINAL_BRACKET_ONLY",
  };
}

/**
 * Calculate the progressive distribution as an exact hundredth-of-yen
 * numerator, then apply the existing creator-month final floor exactly once.
 */
export function computeTlvTipDistribution(monthlyEligibleNetJpy) {
  const creator_attributed_net_jpy = requireEligibleNet(monthlyEligibleNetJpy);
  let creatorNumerator = 0n;
  const bracket_breakdown = [];

  for (const bracket of TLV_PROGRESSIVE_BRACKETS) {
    const capped = bracket.upper_bound_jpy == null
      ? creator_attributed_net_jpy
      : Math.min(creator_attributed_net_jpy, bracket.upper_bound_jpy);
    const portion = Math.max(0, capped - bracket.lower_bound_jpy);
    if (portion === 0) continue;
    const portionCreatorNumerator = BigInt(portion) * BigInt(bracket.creator_pct);
    const portionTasfulNumerator = BigInt(portion) * BigInt(bracket.tasful_pct);
    creatorNumerator += portionCreatorNumerator;
    bracket_breakdown.push({
      bracket: bracket.key,
      lower_bound_jpy: bracket.lower_bound_jpy,
      upper_bound_jpy: bracket.upper_bound_jpy,
      eligible_net_portion_jpy: portion,
      creator_marginal_rate_pct: bracket.creator_pct,
      tasful_marginal_rate_pct: bracket.tasful_pct,
      creator_amount_before_rounding_jpy: Number(portionCreatorNumerator) / 100,
      tasful_amount_before_rounding_jpy: Number(portionTasfulNumerator) / 100,
    });
  }

  const marginal = resolveTlvTipSplit(creator_attributed_net_jpy);
  const creator_distribution_jpy = Number(creatorNumerator / 100n);
  const rounding_residual_jpy = Number(creatorNumerator % 100n) / 100;
  const creator_amount_before_rounding_jpy = creator_distribution_jpy + rounding_residual_jpy;
  const tasful_share_jpy = creator_attributed_net_jpy - creator_distribution_jpy;
  const creator_effective_share_rate_pct = creator_attributed_net_jpy === 0
    ? null
    : Math.round((creator_amount_before_rounding_jpy / creator_attributed_net_jpy) * 100_000_000) / 1_000_000;
  const tasful_effective_share_rate_pct = creator_effective_share_rate_pct == null
    ? null
    : Math.round((100 - creator_effective_share_rate_pct) * 1_000_000) / 1_000_000;

  return {
    revenue_share_model: TLV_REVENUE_SHARE_MODEL,
    creator_attributed_net_jpy,
    creator_amount_before_rounding_jpy,
    rounding_residual_jpy,
    creator_distribution_jpy,
    tasful_share_jpy,
    bracket_breakdown,
    creator_effective_share_rate_pct,
    tasful_effective_share_rate_pct,
    creator_pct: marginal.creator_pct,
    tasful_pct: marginal.tasful_pct,
    band: marginal.band,
    rate_semantics: marginal.rate_semantics,
  };
}
