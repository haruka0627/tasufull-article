/**
 * Economics Core Phase 6 — Benefit Candidate design + simulation (NO entitlement).
 * ADR-043 Accepted (2026-08-12): policy constants LOCKED. Candidate only.
 * Human Approval required. Missing / unverified option cost ≠ ¥0.
 */

import { PROFIT_STATUS } from "./contracts.mjs";
import { computeTlvTipDistribution } from "./tlv-tip.mjs";

/** Financial base comparison IDs (historical A/B retained for sims). */
export const BENEFIT_FINANCIAL_BASE_CANDIDATES = Object.freeze({
  A_USER_ATTRIBUTABLE_REVENUE: "A_USER_ATTRIBUTABLE_REVENUE",
  B_USER_CONTRIBUTION_PROFIT: "B_USER_CONTRIBUTION_PROFIT",
  C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY: "C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY",
});

/** @deprecated Use LOCKED_FINANCIAL_BASE — alias for ADR-043. */
export const RECOMMENDED_FINANCIAL_BASE =
  BENEFIT_FINANCIAL_BASE_CANDIDATES.C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY;

/** ADR-043 LOCK */
export const LOCKED_FINANCIAL_BASE =
  BENEFIT_FINANCIAL_BASE_CANDIDATES.C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY;

/** Scenario grid rates (simulation only). Locked operating rate is 15%. */
export const BENEFIT_RATE_SCENARIOS = Object.freeze([0.1, 0.15, 0.2]);

/** ADR-043 LOCK — INTERNAL non-cash cost budget rate (not cash rebate). */
export const LOCKED_BENEFIT_RATE = 0.15;

/** @deprecated Use LOCKED_BENEFIT_RATE */
export const RECOMMENDED_BENEFIT_RATE = LOCKED_BENEFIT_RATE;

/** Historical minimum scenarios (simulation tables). Locked min is ¥30,000 (Phase 7). */
export const MINIMUM_CONTRIBUTION_SCENARIOS_JPY = Object.freeze([
  3000, 5000, 10000, 30000, 50000,
]);

/** ADR-043 LOCK — Amended Phase 7 Human Policy (was ¥10,000). */
export const LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY = 30000;

/** @deprecated Use LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY */
export const SIMULATION_DEFAULT_MINIMUM_JPY = LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY;

/** ADR-043 LOCK — Benefit Budget cap ⇒ retained target before option spend */
export const LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET = 0.85;

export const BENEFIT_PERIOD_CANDIDATES = Object.freeze({
  MONTHLY_PRIOR_CALENDAR: "MONTHLY_PRIOR_CALENDAR",
  ROLLING_30_DAYS: "ROLLING_30_DAYS",
  QUARTERLY: "QUARTERLY",
});

/** ADR-043 LOCK */
export const LOCKED_PERIOD = BENEFIT_PERIOD_CANDIDATES.MONTHLY_PRIOR_CALENDAR;
export const LOCKED_PERIOD_TIMEZONE = "Asia/Tokyo";
export const LOCKED_BENEFIT_CARRYOVER = false;
export const LOCKED_CASH_BENEFIT = false;

/** @deprecated Use LOCKED_PERIOD */
export const RECOMMENDED_PERIOD = LOCKED_PERIOD;

/**
 * ADR-043 LOCK — status → eligibility.
 */
export const STATUS_ELIGIBILITY_DESIGN = Object.freeze({
  COMPLETE_ACTUAL: "ELIGIBLE",
  PARTIAL_ACTUAL: "HUMAN_REVIEW_ONLY",
  ESTIMATED: "NOT_ELIGIBLE",
  FORECAST: "NOT_ELIGIBLE",
  UNAVAILABLE: "NOT_ELIGIBLE",
});

export const BENEFIT_COST_BASIS = Object.freeze({
  LIST_PRICE: "LIST_PRICE",
  TASFUL_ATTRIBUTABLE_OPTION_COST: "TASFUL_ATTRIBUTABLE_OPTION_COST",
  VERIFIED_TASFUL_ATTRIBUTABLE_OPTION_COST:
    "VERIFIED_TASFUL_ATTRIBUTABLE_OPTION_COST",
  MAX_OF_COST_AND_FLOOR: "MAX_OF_COST_AND_FLOOR",
});

/** ADR-043 LOCK */
export const LOCKED_BENEFIT_COST_BASIS =
  BENEFIT_COST_BASIS.VERIFIED_TASFUL_ATTRIBUTABLE_OPTION_COST;

/** @deprecated Use LOCKED_BENEFIT_COST_BASIS */
export const RECOMMENDED_BENEFIT_COST_BASIS = LOCKED_BENEFIT_COST_BASIS;

export const HIGH_CONTRIBUTION_MODELS = Object.freeze({
  ONE_OPTION_PER_MONTH: "ONE_OPTION_PER_MONTH",
  CAPPED_ALLOWANCE: "CAPPED_ALLOWANCE",
  MULTIPLE_UNDER_BUDGET: "MULTIPLE_UNDER_BUDGET",
  TIERED_BENEFIT: "TIERED_BENEFIT",
});

/** ADR-043 LOCK — ONE_PAID_OPTION_PER_USER_PER_MONTH */
export const LOCKED_HIGH_CONTRIBUTION_MODEL =
  HIGH_CONTRIBUTION_MODELS.ONE_OPTION_PER_MONTH;

/** @deprecated Use LOCKED_HIGH_CONTRIBUTION_MODEL */
export const RECOMMENDED_HIGH_CONTRIBUTION_MODEL = LOCKED_HIGH_CONTRIBUTION_MODEL;

/** ADR-043 LOCK — Phase 7 V1 delivery */
export const LOCKED_V1_PRIMARY_DELIVERY = "VISIBLE_PREMIUM_OPTION_GRANT";
export const LOCKED_BENEFIT_COIN_STATUS = "DEFERRED";

/**
 * Frozen policy snapshot for tests / reports (ADR-043 Accepted + Phase 7 amendment).
 */
export const ADR043_LOCKED_POLICY = Object.freeze({
  financial_base: LOCKED_FINANCIAL_BASE,
  benefit_rate: LOCKED_BENEFIT_RATE,
  minimum_monthly_contribution_jpy: LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY,
  base_retained_contribution_target: LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET,
  high_contribution_model: LOCKED_HIGH_CONTRIBUTION_MODEL,
  benefit_cost_basis: LOCKED_BENEFIT_COST_BASIS,
  period: LOCKED_PERIOD,
  timezone: LOCKED_PERIOD_TIMEZONE,
  carryover: LOCKED_BENEFIT_CARRYOVER,
  cash_benefit: LOCKED_CASH_BENEFIT,
  v1_primary_delivery: LOCKED_V1_PRIMARY_DELIVERY,
  benefit_coin: LOCKED_BENEFIT_COIN_STATUS,
  unused_budget_to_coin: false,
  human_approval_required: true,
  automatic_grant: false,
  entitlement_implemented: false,
});

/**
 * @param {number} contributionProfitJpy
 * @param {number} benefitRate
 */
export function computeBenefitBudget(contributionProfitJpy, benefitRate) {
  const profit = Number(contributionProfitJpy);
  const rate = Number(benefitRate);
  if (!Number.isFinite(profit) || !Number.isFinite(rate) || rate < 0) {
    return {
      ok: false,
      error: "invalid_input",
      benefit_budget_jpy: null,
      retained_before_option_cost_jpy: null,
    };
  }
  if (profit <= 0) {
    return {
      ok: true,
      eligible_for_budget: false,
      reason: "non_positive_contribution",
      contribution_profit_jpy: profit,
      benefit_rate: rate,
      benefit_budget_jpy: 0,
      retained_before_option_cost_jpy: profit,
    };
  }
  const benefit_budget_jpy = Math.round(profit * rate);
  return {
    ok: true,
    eligible_for_budget: true,
    contribution_profit_jpy: profit,
    benefit_rate: rate,
    benefit_budget_jpy,
    retained_before_option_cost_jpy: profit - benefit_budget_jpy,
    retained_pct_before_option: Number((1 - rate).toFixed(4)),
  };
}

/**
 * Resolve benefit cost from option contract (unverified / missing cost → not eligible).
 * @param {object} option
 * @param {string} [basis]
 */
export function resolveBenefitCost(option, basis = LOCKED_BENEFIT_COST_BASIS) {
  if (!option || !option.option_id) {
    return { ok: false, error: "missing_option", benefit_cost_jpy: null };
  }
  const costStatus = String(option.cost_status || "").toUpperCase();
  if (
    costStatus !== "VERIFIED" ||
    option.tasful_variable_cost == null ||
    !Number.isFinite(Number(option.tasful_variable_cost))
  ) {
    return {
      ok: false,
      error: "BENEFIT_OPTION_NOT_ELIGIBLE",
      reason:
        costStatus !== "VERIFIED"
          ? "cost_status_not_verified"
          : "missing_or_unknown_option_cost",
      benefit_cost_jpy: null,
      missing_cost_zero_forbidden: true,
    };
  }
  const cost = Math.round(Number(option.tasful_variable_cost));
  const list = Math.round(Number(option.normal_user_price || 0));
  let benefit_cost_jpy = cost;
  if (basis === BENEFIT_COST_BASIS.LIST_PRICE) benefit_cost_jpy = list;
  if (basis === BENEFIT_COST_BASIS.MAX_OF_COST_AND_FLOOR) {
    const floor =
      option.benefit_cost_floor_jpy == null
        ? cost
        : Math.round(Number(option.benefit_cost_floor_jpy));
    benefit_cost_jpy = Math.max(cost, floor);
  }
  if (
    (basis === BENEFIT_COST_BASIS.TASFUL_ATTRIBUTABLE_OPTION_COST ||
      basis === BENEFIT_COST_BASIS.VERIFIED_TASFUL_ATTRIBUTABLE_OPTION_COST) &&
    option.benefit_cost != null &&
    Number.isFinite(Number(option.benefit_cost))
  ) {
    benefit_cost_jpy = Math.round(Number(option.benefit_cost));
  }
  return {
    ok: true,
    option_id: option.option_id,
    benefit_cost_jpy,
    basis,
    normal_user_price: list,
    tasful_variable_cost: cost,
    cost_status: "VERIFIED",
  };
}

/**
 * @param {object} input
 */
export function buildBenefitCandidate(input) {
  const status = String(input.status || PROFIT_STATUS.COMPLETE_ACTUAL);
  const statusGate = STATUS_ELIGIBILITY_DESIGN[status] || "NOT_ELIGIBLE";
  const rate =
    input.benefit_rate == null ? LOCKED_BENEFIT_RATE : Number(input.benefit_rate);
  const min =
    input.minimum_contribution_jpy == null
      ? LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY
      : Number(input.minimum_contribution_jpy);
  const profit = Number(input.contribution_profit_jpy);

  const base = input.financial_base || LOCKED_FINANCIAL_BASE;
  let eligible_base_amount = profit;
  if (base === BENEFIT_FINANCIAL_BASE_CANDIDATES.A_USER_ATTRIBUTABLE_REVENUE) {
    eligible_base_amount = Number(input.revenue_jpy);
  }
  if (base === BENEFIT_FINANCIAL_BASE_CANDIDATES.C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY) {
    if (status !== PROFIT_STATUS.COMPLETE_ACTUAL) {
      return {
        type: "BENEFIT_CANDIDATE",
        candidate: false,
        granted: false,
        reason:
          status === PROFIT_STATUS.PARTIAL_ACTUAL
            ? "partial_actual_human_review_only"
            : "complete_actual_required_for_base_C",
        status,
        status_gate: statusGate,
        human_approval_required: true,
        entitlement_implemented: false,
        automatic_grant: false,
      };
    }
  }

  if (!Number.isFinite(eligible_base_amount)) {
    return {
      type: "BENEFIT_CANDIDATE",
      candidate: false,
      granted: false,
      reason: "invalid_financial_base_amount",
      human_approval_required: true,
      entitlement_implemented: false,
      automatic_grant: false,
    };
  }

  if (
    statusGate === "NOT_ELIGIBLE" ||
    statusGate === "HUMAN_REVIEW_ONLY"
  ) {
    return {
      type: "BENEFIT_CANDIDATE",
      candidate: false,
      granted: false,
      reason:
        statusGate === "HUMAN_REVIEW_ONLY"
          ? "status_human_review_only"
          : `status_${statusGate.toLowerCase()}`,
      status,
      status_gate: statusGate,
      human_approval_required: true,
      entitlement_implemented: false,
      automatic_grant: false,
    };
  }

  if (eligible_base_amount <= 0) {
    return {
      type: "BENEFIT_CANDIDATE",
      candidate: false,
      granted: false,
      reason: "non_positive_contribution",
      contribution_profit_jpy: profit,
      human_approval_required: true,
      entitlement_implemented: false,
      automatic_grant: false,
    };
  }

  if (min != null && eligible_base_amount < min) {
    return {
      type: "BENEFIT_CANDIDATE",
      candidate: false,
      granted: false,
      reason: "below_minimum_contribution",
      minimum_contribution_jpy: min,
      contribution_profit_jpy: profit,
      human_approval_required: true,
      entitlement_implemented: false,
      automatic_grant: false,
    };
  }

  const budget = computeBenefitBudget(eligible_base_amount, rate);
  const costBasis = input.benefit_cost_basis || LOCKED_BENEFIT_COST_BASIS;
  const options = Array.isArray(input.options) ? input.options : [];
  const option_results = [];
  for (const opt of options) {
    const cost = resolveBenefitCost(opt, costBasis);
    if (!cost.ok) {
      option_results.push({
        option_id: opt.option_id,
        display_name: opt.display_name || null,
        candidate: false,
        reason: cost.error,
      });
      continue;
    }
    const underBudget = cost.benefit_cost_jpy <= budget.benefit_budget_jpy;
    option_results.push({
      option_id: opt.option_id,
      display_name: opt.display_name || null,
      candidate: underBudget,
      benefit_cost_jpy: cost.benefit_cost_jpy,
      normal_user_price: cost.normal_user_price,
      tasful_variable_cost: cost.tasful_variable_cost,
      reason: underBudget ? "within_budget" : "over_budget",
      post_benefit_contribution_if_selected: underBudget
        ? eligible_base_amount - cost.benefit_cost_jpy
        : null,
      retained_pct_if_selected: underBudget
        ? Number(
            (
              (eligible_base_amount - cost.benefit_cost_jpy) /
              eligible_base_amount
            ).toFixed(4),
          )
        : null,
    });
  }

  return {
    type: "BENEFIT_CANDIDATE",
    version: 1,
    candidate: true,
    granted: false,
    status,
    status_gate: statusGate,
    financial_base: base,
    contribution_profit_jpy: profit,
    eligible_base_amount_jpy: eligible_base_amount,
    benefit_rate: rate,
    benefit_budget_jpy: budget.benefit_budget_jpy,
    retained_before_option_cost_jpy: budget.retained_before_option_cost_jpy,
    base_retained_contribution_target: LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET,
    minimum_contribution_jpy: min,
    options: option_results,
    high_contribution_model: LOCKED_HIGH_CONTRIBUTION_MODEL,
    benefit_cost_basis: costBasis,
    period: LOCKED_PERIOD,
    timezone: LOCKED_PERIOD_TIMEZONE,
    carryover: LOCKED_BENEFIT_CARRYOVER,
    cash_benefit: LOCKED_CASH_BENEFIT,
    v1_primary_delivery: LOCKED_V1_PRIMARY_DELIVERY,
    benefit_coin: LOCKED_BENEFIT_COIN_STATUS,
    unused_budget_to_coin: false,
    tip_distribution_changed: false,
    pricing_changed: false,
    human_approval_required: true,
    policy_gate_required: true,
    entitlement_implemented: false,
    automatic_grant: false,
    note: "Candidate only — not entitlement · ADR-043 Accepted",
  };
}

/**
 * Grid simulation for report tables.
 */
export function simulateBenefitGrid() {
  const contributions = [0, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  const rates = [...BENEFIT_RATE_SCENARIOS];
  const optionCosts = [100, 300, 500, 1000, 3000, 10000];
  const rows = [];
  for (const profit of contributions) {
    for (const rate of rates) {
      const budget = computeBenefitBudget(profit, rate);
      const eligibleOptions = optionCosts.filter(
        (c) => profit > 0 && c <= (budget.benefit_budget_jpy || 0),
      );
      rows.push({
        contribution_profit_jpy: profit,
        benefit_rate: rate,
        benefit_budget_jpy: budget.benefit_budget_jpy,
        retained_before_option_cost_jpy: budget.retained_before_option_cost_jpy,
        retained_pct_before_option: budget.retained_pct_before_option ?? null,
        option_costs_eligible: eligibleOptions,
        option_costs_ineligible: optionCosts.filter((c) => !eligibleOptions.includes(c)),
      });
    }
  }
  return rows;
}

/**
 * TLV creator vignettes — streaming unknown separated (not ¥0).
 */
export function simulateTlvCreatorCases() {
  const cases = [
    {
      label: "SMALL_CREATOR",
      gift_gmv_jpy: 200_000,
      payment_cost_jpy: 6000,
      streaming_cost: { status: "UNKNOWN", amount_jpy: null },
    },
    {
      label: "MID_CREATOR",
      gift_gmv_jpy: 2_000_000,
      payment_cost_jpy: 50000,
      streaming_cost: { status: "ESTIMATED", amount_jpy: 80000 },
    },
    {
      label: "LARGE_CREATOR",
      gift_gmv_jpy: 7_000_000,
      payment_cost_jpy: 140000,
      streaming_cost: { status: "ESTIMATED", amount_jpy: 250000 },
    },
    {
      label: "VERY_LARGE_CREATOR",
      gift_gmv_jpy: 15_000_000,
      payment_cost_jpy: 250000,
      streaming_cost: { status: "ACTUAL", amount_jpy: 400000 },
    },
  ];

  return cases.map((c) => {
    const eligible_net_jpy = c.gift_gmv_jpy - c.payment_cost_jpy;
    const distribution = computeTlvTipDistribution(eligible_net_jpy);
    const tasful_share_jpy = distribution.tasful_share_jpy;
    const streamingKnown = c.streaming_cost.amount_jpy != null;
    const streaming = streamingKnown ? c.streaming_cost.amount_jpy : null;
    let contribution = null;
    let status = PROFIT_STATUS.COMPLETE_ACTUAL;
    if (!streamingKnown) {
      contribution = null;
      status = PROFIT_STATUS.PARTIAL_ACTUAL;
    } else if (c.streaming_cost.status === "ESTIMATED") {
      contribution = tasful_share_jpy - streaming;
      status = PROFIT_STATUS.ESTIMATED;
    } else {
      contribution = tasful_share_jpy - streaming;
      status = PROFIT_STATUS.COMPLETE_ACTUAL;
    }

    const rates = {};
    for (const rate of BENEFIT_RATE_SCENARIOS) {
      if (contribution == null || contribution <= 0) {
        rates[rate] = {
          candidate: false,
          reason:
            contribution == null
              ? "streaming_cost_unknown_or_incomplete"
              : "non_positive",
          status,
        };
        continue;
      }
      const cand = buildBenefitCandidate({
        contribution_profit_jpy: contribution,
        status,
        benefit_rate: rate,
        minimum_contribution_jpy: LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY,
        options: [
          {
            option_id: "beauty_premium",
            display_name: "Beauty Premium Option",
            normal_user_price: 1000,
            tasful_variable_cost: 200,
            benefit_cost: 200,
            cost_status: "VERIFIED",
          },
          {
            option_id: "vtuber_premium",
            display_name: "VTuber Premium Option",
            normal_user_price: 3000,
            tasful_variable_cost: 700,
            benefit_cost: 700,
            cost_status: "VERIFIED",
          },
          {
            option_id: "ai_premium",
            display_name: "AI Premium Option",
            normal_user_price: 5000,
            tasful_variable_cost: 2000,
            benefit_cost: 2000,
            cost_status: "VERIFIED",
          },
        ],
      });
      rates[String(rate)] = {
        benefit_budget_jpy: cand.benefit_budget_jpy ?? null,
        candidate: cand.candidate,
        status: cand.status,
        options: (cand.options || []).filter((o) => o.candidate).map((o) => o.option_id),
        post_benefit_if_cheapest:
          cand.candidate && cand.options?.some((o) => o.candidate)
            ? contribution -
              Math.min(
                ...cand.options.filter((o) => o.candidate).map((o) => o.benefit_cost_jpy),
              )
            : null,
      };
    }

    return {
      ...c,
      eligible_net_jpy,
      revenue_share_model: distribution.revenue_share_model,
      applied_marginal_bracket: distribution.band,
      revenue_share_brackets: distribution.bracket_breakdown,
      tasful_share_jpy,
      gift_gmv_not_benefit_base: true,
      contribution_profit_jpy: contribution,
      profit_status: status,
      streaming_cost_note: streamingKnown
        ? c.streaming_cost.status
        : "UNKNOWN — not treated as ¥0; Benefit auto-eligibility blocked under COMPLETE_ACTUAL base",
      benefit_by_rate: rates,
    };
  });
}

/**
 * Compare financial bases qualitatively for the report.
 */
export function compareFinancialBases() {
  return [
    {
      id: BENEFIT_FINANCIAL_BASE_CANDIDATES.A_USER_ATTRIBUTABLE_REVENUE,
      pros: ["Simple", "Easy to explain"],
      cons: ["Ignores high COGS users", "Risk of over-benefiting unprofitable revenue"],
      recommended: false,
      locked: false,
    },
    {
      id: BENEFIT_FINANCIAL_BASE_CANDIDATES.B_USER_CONTRIBUTION_PROFIT,
      pros: ["Aligns with AD-041 truth", "Protects margin vs revenue-only"],
      cons: ["Needs cost completeness discipline"],
      recommended: false,
      locked: false,
      note: "Strong, but incomplete actuals should not auto-grant",
    },
    {
      id: BENEFIT_FINANCIAL_BASE_CANDIDATES.C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY,
      pros: [
        "Strictest protection of TASFUL required profit",
        "Matches missing-cost≠0",
        "Best for Human-trustable candidates",
      ],
      cons: ["Fewer auto-candidates until meters connect"],
      recommended: true,
      locked: true,
    },
  ];
}

export function comparePeriods() {
  return [
    {
      id: BENEFIT_PERIOD_CANDIDATES.MONTHLY_PRIOR_CALENDAR,
      recommended: true,
      locked: true,
      timezone: LOCKED_PERIOD_TIMEZONE,
      pros: ["Matches Creator Program / TLV JST month", "Clear closeout", "Simple ops"],
      cons: ["Month-edge timing"],
    },
    {
      id: BENEFIT_PERIOD_CANDIDATES.ROLLING_30_DAYS,
      recommended: false,
      locked: false,
      pros: ["Smoother for new creators"],
      cons: ["Harder closeout", "More compute", "Ambiguous Benefit month UX"],
    },
    {
      id: BENEFIT_PERIOD_CANDIDATES.QUARTERLY,
      recommended: false,
      locked: false,
      pros: ["Larger budgets", "Less churn noise"],
      cons: ["Slow feedback", "Refund complexity"],
    },
  ];
}
