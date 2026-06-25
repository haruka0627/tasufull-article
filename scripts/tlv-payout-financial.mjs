/**
 * TLV 収益分配 — 金融計算（1円単位整合性）
 * すべての支払額は整数円。端数・残余は audit に記録する。
 */

/** @typedef {{ exact_yen: number, rounded_yen: number, rounding_delta_yen: number }} YenRounding */

/**
 * @param {number} value
 * @returns {number}
 */
export function roundHalfUpYen(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * 重みに応じて totalYen を整数円で配分（最大剰余法）。合計は必ず totalYen と一致。
 * @param {number} totalYen
 * @param {{ id: string, weight: number }[]} parts
 */
export function distributeYenByLargestRemainder(totalYen, parts) {
  const safeTotal = Math.max(0, roundHalfUpYen(totalYen));
  const weights = parts.map((p) => Math.max(0, p.weight));
  const weightSum = weights.reduce((s, w) => s + w, 0);

  if (safeTotal === 0 || weightSum <= 0) {
    return parts.map((p) => ({
      id: p.id,
      exact_yen: 0,
      allocated_yen: 0,
      fractional_remainder: 0,
    }));
  }

  const exacts = weights.map((w) => (safeTotal * w) / weightSum);
  const floors = exacts.map((e) => Math.floor(e));
  let remainder = safeTotal - floors.reduce((s, f) => s + f, 0);

  const order = exacts
    .map((exact, i) => ({
      i,
      fractional: exact - floors[i],
    }))
    .sort((a, b) => b.fractional - a.fractional || a.i - b.i);

  const allocated = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    allocated[i] += 1;
    remainder -= 1;
  }

  return parts.map((p, i) => ({
    id: p.id,
    exact_yen: exacts[i],
    allocated_yen: allocated[i],
    fractional_remainder: exacts[i] - floors[i],
  }));
}

/**
 * @param {number} grossRevenue
 * @param {number} ratePercent
 * @returns {YenRounding}
 */
export function computeLinePayoutYen(grossRevenue, ratePercent) {
  const exact = (grossRevenue * ratePercent) / 100;
  const rounded = roundHalfUpYen(exact);
  return {
    exact_yen: exact,
    rounded_yen: rounded,
    rounding_delta_yen: rounded - exact,
  };
}

export const FINANCIAL_INTEGRITY_POLICY = {
  currency: "JPY",
  unit: "yen",
  integer_only: true,
  canonical_source_file: "reports/tlv-business-simulator/output/monthly-payout-decision.json",
  source_of_truth: "monthly-payout-decision.json",
  confirmed_payout_field: "creators[].payout_amount_yen",
  payout_amount_source: "monthly-payout-decision.json",
  payout_amount_yen_is_final: true,
  no_display_recalculation: true,
  gross_times_rate_reference_only: true,
  consumer_rule:
    "UI・Creator Dashboard・支払CSV・月次レポートは monthly-payout-decision.json の確定値のみを参照し、各画面で再計算しない",
  rounding_policy: "half_up_per_line_then_largest_remainder_for_variable_pool",
  payout_pool_formula:
    "total_revenue - payment_fee - platform_cost - reserve_amount - minimum_company_profit - operational_margin",
  company_first_rule:
    "会社側の必要経費・予備費・最低利益・運営マージンを先控除し、残りのみ payout_pool とする。総売上から直接 Creator 還元を計算しない",
  deduction_order: [
    "payment_fee",
    "platform_cost",
    "reserve_amount",
    "minimum_company_profit",
    "operational_margin",
  ],
};

/**
 * @param {object} input
 */
export function normalizeCompanyCosts(input) {
  const payment_fee = input.payment_fee ?? 0;
  const platform_cost = input.platform_cost ?? 0;
  const cdn_storage_live_cost = input.cdn_storage_live_cost ?? 0;
  const platform_cost_total = platform_cost + cdn_storage_live_cost;
  const reserve_amount = input.reserve_amount ?? 0;
  const minimum_company_profit = input.minimum_company_profit ?? 0;
  const operational_margin = input.operational_margin ?? 0;

  const company_deductions_total =
    payment_fee +
    platform_cost_total +
    reserve_amount +
    minimum_company_profit +
    operational_margin;

  return {
    payment_fee,
    platform_cost,
    cdn_storage_live_cost,
    platform_cost_total,
    reserve_amount,
    minimum_company_profit,
    operational_margin,
    company_deductions_total,
    company_margin_reserved_yen: minimum_company_profit + operational_margin,
  };
}

/**
 * 固定順序で payout_pool を算出（総売上から直接 Creator 還元しない）
 * @param {object} input
 */
export function computePayoutPool(input) {
  const costs = normalizeCompanyCosts(input);
  const payoutPool = Math.max(0, input.total_revenue - costs.company_deductions_total);
  return { payoutPool, costs };
}

/**
 * @param {number} totalRevenue
 * @param {object} costs
 * @param {number} totalPayout
 */
export function computeFinalCompanyProfitYen(totalRevenue, costs, totalPayout) {
  return (
    totalRevenue -
    costs.payment_fee -
    costs.platform_cost_total -
    costs.reserve_amount -
    totalPayout
  );
}

/**
 * Creator ごとの支払確定 audit（表示・CSV・レポートは再計算禁止）
 * @param {number} payoutAmountYen
 */
export function buildCreatorPaymentAudit(payoutAmountYen) {
  return {
    payout_amount_source: FINANCIAL_INTEGRITY_POLICY.payout_amount_source,
    payout_amount_yen_is_final: FINANCIAL_INTEGRITY_POLICY.payout_amount_yen_is_final,
    no_display_recalculation: FINANCIAL_INTEGRITY_POLICY.no_display_recalculation,
    confirmed_payout_amount_yen: payoutAmountYen,
  };
}

/**
 * @param {object} params
 */
export function buildFinancialAudit(params) {
  const {
    input,
    payoutPool,
    costs,
    guaranteedRows,
    variableRows,
    allocMeta,
    totalPayout,
    finalCompanyProfit,
  } = params;

  const guaranteedAudit = guaranteedRows.map((r) => {
    const line = computeLinePayoutYen(r.gross_revenue, r.applied_rate);
    return {
      creator_id: r.creator_id,
      gross_revenue_yen: r.gross_revenue,
      rate_percent: r.applied_rate,
      exact_yen: line.exact_yen,
      payout_amount_yen: r.payout_amount,
      rounding_delta_yen: r.payout_amount - line.exact_yen,
      paid_from_payout_pool: true,
    };
  });

  const variablePreTotal = variableRows.reduce((s, r) => s + r.pre_scale_payout_yen, 0);
  const variablePostTotal = variableRows.reduce((s, r) => s + r.payout_amount, 0);

  const variableAudit = variableRows.map((r) => ({
    creator_id: r.creator_id,
    gross_revenue_yen: r.gross_revenue,
    base_rate_percent: r.base_rate,
    pre_scale_exact_yen: r.pre_scale_exact_yen,
    pre_scale_payout_yen: r.pre_scale_payout_yen,
    scale_factor_exact: r.scale_factor_exact ?? 1,
    post_scale_exact_yen: r.post_scale_exact_yen,
    payout_amount_yen: r.payout_amount,
    applied_rate_display_percent: r.applied_rate,
    rounding_delta_yen: r.payout_amount - (r.post_scale_exact_yen ?? r.pre_scale_exact_yen),
    largest_remainder_adjustment_yen: r.largest_remainder_adjustment_yen ?? 0,
    paid_from_payout_pool: true,
  }));

  const identitySum =
    input.total_revenue -
    costs.payment_fee -
    costs.platform_cost_total -
    costs.reserve_amount -
    totalPayout -
    finalCompanyProfit;

  return {
    rounding_policy: FINANCIAL_INTEGRITY_POLICY.rounding_policy,
    source_of_truth: FINANCIAL_INTEGRITY_POLICY.source_of_truth,
    confirmed_payout_field: FINANCIAL_INTEGRITY_POLICY.confirmed_payout_field,
    pool_formula: FINANCIAL_INTEGRITY_POLICY.payout_pool_formula,
    deduction_order: [...FINANCIAL_INTEGRITY_POLICY.deduction_order],
    company_deductions_first: {
      payment_fee_yen: costs.payment_fee,
      platform_cost_yen: costs.platform_cost,
      cdn_storage_live_cost_yen: costs.cdn_storage_live_cost,
      platform_cost_total_yen: costs.platform_cost_total,
      reserve_amount_yen: costs.reserve_amount,
      minimum_company_profit_yen: costs.minimum_company_profit,
      operational_margin_yen: costs.operational_margin,
      company_deductions_total_yen: costs.company_deductions_total,
      company_margin_reserved_yen: costs.company_margin_reserved_yen,
      payout_pool_after_company_margin_yen: payoutPool,
    },
    payout_pool_yen: payoutPool,
    allocated_total_yen: totalPayout,
    pool_unallocated_yen: payoutPool - totalPayout,
    no_payout_from_gross_revenue: {
      rule: "Creator payout は payout_pool 内のみ。総売上×還元率を直接支払額としない",
      total_payout_yen: totalPayout,
      payout_pool_yen: payoutPool,
      within_pool: totalPayout <= payoutPool,
    },
    guaranteed_layer: {
      total_yen: guaranteedRows.reduce((s, r) => s + r.payout_amount, 0),
      per_creator: guaranteedAudit,
    },
    variable_layer: {
      residual_pool_yen: allocMeta.residual_pool ?? 0,
      pre_scale_total_yen: variablePreTotal,
      post_scale_total_yen: variablePostTotal,
      scale_factor_exact: allocMeta.variable_scale ?? 1,
      scale_factor_display:
        allocMeta.variable_scale != null
          ? Math.round(allocMeta.variable_scale * 10000) / 10000
          : 1,
      rounding_adjustment_yen: variablePostTotal - Math.round(variablePreTotal * (allocMeta.variable_scale ?? 1)),
      per_creator: variableAudit,
    },
    company_profit_audit: {
      formula:
        "total_revenue - payment_fee - platform_cost_total - reserve_amount - total_payout",
      final_company_profit_yen: finalCompanyProfit,
      minimum_company_profit_yen: costs.minimum_company_profit,
      operational_margin_yen: costs.operational_margin,
      required_company_margin_yen: costs.company_margin_reserved_yen,
      operational_margin_preserved: finalCompanyProfit >= costs.company_margin_reserved_yen,
    },
    payment_finalization: {
      payout_amount_source: FINANCIAL_INTEGRITY_POLICY.payout_amount_source,
      payout_amount_yen_is_final: FINANCIAL_INTEGRITY_POLICY.payout_amount_yen_is_final,
      no_display_recalculation: FINANCIAL_INTEGRITY_POLICY.no_display_recalculation,
      gross_times_rate_reference_only:
        FINANCIAL_INTEGRITY_POLICY.gross_times_rate_reference_only,
      consumer_rules: {
        dashboard_must_use_payout_amount_yen: true,
        csv_must_use_payout_amount_yen: true,
        report_must_use_payout_amount_yen: true,
      },
    },
    balance_check: {
      total_revenue_yen: input.total_revenue,
      payment_fee_yen: costs.payment_fee,
      platform_cost_total_yen: costs.platform_cost_total,
      reserve_amount_yen: costs.reserve_amount,
      minimum_company_profit_yen: costs.minimum_company_profit,
      operational_margin_yen: costs.operational_margin,
      total_payout_yen: totalPayout,
      payout_pool_yen: payoutPool,
      final_company_profit_yen: finalCompanyProfit,
      identity_delta_yen: identitySum,
      identity_holds: identitySum === 0,
    },
  };
}

/**
 * 変動層を残余プール（整数円）に厳密一致させる。
 * @param {object[]} normalRows - rate_guaranteed=false の行（payout_amount は事前計算済み）
 * @param {number} residualPoolYen
 */
export function finalizeVariableLayerYen(normalRows, residualPoolYen) {
  const pool = Math.max(0, roundHalfUpYen(residualPoolYen));
  const preTotal = normalRows.reduce((s, r) => s + r.pre_scale_payout_yen, 0);

  if (normalRows.length === 0 || pool === 0) {
    for (const r of normalRows) {
      r.payout_amount = 0;
      r.post_scale_exact_yen = 0;
      r.largest_remainder_adjustment_yen = 0;
      r.applied_rate = 0;
      r.adjusted_rate = 0;
      r.payout_rate = 0;
    }
    return { variable_total: 0, scale_factor_exact: 0 };
  }

  const scale = preTotal > 0 ? pool / preTotal : 0;

  const parts = normalRows.map((r) => ({
    id: r.creator_id,
    weight: r.pre_scale_payout_yen * scale,
  }));

  // weight は post-scale exact に相当
  const exacts = normalRows.map((r) => (r.pre_scale_payout_yen * pool) / preTotal);
  const distribution = distributeYenByLargestRemainder(
    pool,
    normalRows.map((r, i) => ({ id: r.creator_id, weight: exacts[i] || 0 }))
  );
  const byId = Object.fromEntries(distribution.map((d) => [d.id, d]));

  for (const r of normalRows) {
    const d = byId[r.creator_id];
    const flooredExact = (r.pre_scale_payout_yen * pool) / preTotal;
    r.post_scale_exact_yen = flooredExact;
    r.payout_amount = d.allocated_yen;
    r.largest_remainder_adjustment_yen = d.allocated_yen - Math.floor(flooredExact);
    r.scale_factor_exact = scale;
    r.applied_rate =
      r.gross_revenue > 0
        ? Math.round((r.payout_amount / r.gross_revenue) * 1000) / 10
        : 0;
    r.adjusted_rate = r.applied_rate;
    r.payout_rate = r.applied_rate;
  }

  return {
    variable_total: normalRows.reduce((s, r) => s + r.payout_amount, 0),
    scale_factor_exact: scale,
  };
}
