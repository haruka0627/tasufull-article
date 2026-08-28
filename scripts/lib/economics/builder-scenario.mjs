/**
 * Economics Core V1 — Builder fee SCENARIO only (AD-042).
 * NOT runtime fee. NOT locked. PRICING_SCENARIO_ONLY.
 */

import { FEE_CONTRACTS } from "./contracts.mjs";

/**
 * @param {number} requestTotalJpy
 * @param {number} ratePercent — e.g. 8, 6, 5
 */
export function simulateBuilderSuccessFee(requestTotalJpy, ratePercent) {
  const total = Math.max(0, Math.round(Number(requestTotalJpy) || 0));
  const pct = Number(ratePercent);
  if (![8, 6, 5].includes(pct)) {
    return {
      ok: false,
      error: "rate_not_in_candidates",
      status: "PRICING_SCENARIO_ONLY",
      runtime_applied: false,
      candidates_pct: FEE_CONTRACTS.BUILDER_SUCCESS_FEE.candidates_pct,
    };
  }
  const fee = Math.round((total * pct) / 100);
  return {
    ok: true,
    fee_contract_id: "BUILDER_SUCCESS_FEE",
    request_total_jpy: total,
    rate_percent: pct,
    fee_jpy: fee,
    status: "PRICING_SCENARIO_ONLY",
    runtime_applied: false,
    tier_boundaries: "UNLOCKED",
    progressive_tiering: "CANDIDATE",
    note: "Do not apply as formal runtime Builder fee",
  };
}

/**
 * Progressive tier scenario skeleton — boundaries UNLOCKED (do not invent).
 * @param {number} requestTotalJpy
 * @param {{ up_to_jpy: number|null, rate_percent: number }[]} tiers
 */
export function simulateBuilderProgressiveFee(requestTotalJpy, tiers) {
  return {
    ok: false,
    error: "tier_boundaries_unlocked",
    status: "PRICING_SCENARIO_ONLY",
    runtime_applied: false,
    request_total_jpy: Math.max(0, Math.round(Number(requestTotalJpy) || 0)),
    tiers_provided: Array.isArray(tiers) ? tiers.length : 0,
    note: "AD-042: progressive tiering is a candidate; boundaries require Human Approval",
  };
}
