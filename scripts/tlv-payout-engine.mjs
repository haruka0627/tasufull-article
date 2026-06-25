/**
 * TLV AI 収益分配エンジン Ver2 — Production Baseline
 * ランク・保証率・層構造は payout-engine-v2-production-baseline.json を唯一の基準とする。
 * 本番送金なし・Stripe API 非使用。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  computeLinePayoutYen,
  finalizeVariableLayerYen,
  roundHalfUpYen,
} from "./tlv-payout-financial.mjs";

/** @typedef {'Starter'|'Creator'|'Pro'|'Top Creator'|'Elite Creator'} CreatorRank */
/** @typedef {'SAFE'|'CAUTION'|'DANGER'|'RED'} SafetyStatus */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PRODUCTION_BASELINE_RELATIVE_PATH =
  "reports/tlv-business-simulator/payout-engine-v2-production-baseline.json";
const PRODUCTION_BASELINE_PATH = path.join(
  __dirname,
  "..",
  "reports",
  "tlv-business-simulator",
  "payout-engine-v2-production-baseline.json"
);

let _productionBaseline = null;

/** @returns {object} Ver2 Production Baseline（上書き禁止・SSOT） */
export function loadProductionBaseline() {
  if (!_productionBaseline) {
    _productionBaseline = JSON.parse(fs.readFileSync(PRODUCTION_BASELINE_PATH, "utf8"));
  }
  return _productionBaseline;
}

function deriveRankConfig(baseline) {
  const RANK_ORDER = baseline.rank_system.map((r) => r.rank);
  const RANK_RATES = Object.fromEntries(
    baseline.rank_system.map((r) => [r.rank, r.base_rate_percent])
  );
  const SPECIAL_RANKS = new Set(
    baseline.rank_system.filter((r) => r.guaranteed).map((r) => r.rank)
  );
  const GUARANTEED_RATES = Object.fromEntries(
    baseline.rank_system
      .filter((r) => r.guaranteed)
      .map((r) => [r.rank, r.guarantee_rate_percent])
  );
  const VARIABLE_RANKS = new Set(
    baseline.rank_system.filter((r) => r.layer === "variable").map((r) => r.rank)
  );
  return { RANK_ORDER, RANK_RATES, SPECIAL_RANKS, GUARANTEED_RATES, VARIABLE_RANKS };
}

const _baseline = loadProductionBaseline();
export const ENGINE_VERSION = _baseline.engine_version;
export const PHILOSOPHY = _baseline.core_philosophy.goal;
const _rankConfig = deriveRankConfig(_baseline);
export const RANK_ORDER = _rankConfig.RANK_ORDER;
export const RANK_RATES = _rankConfig.RANK_RATES;
export const SPECIAL_RANKS = _rankConfig.SPECIAL_RANKS;
export const GUARANTEED_RATES = _rankConfig.GUARANTEED_RATES;
export const VARIABLE_RANKS = _rankConfig.VARIABLE_RANKS;
export const BASE_CONDITION_LINES = _baseline.condition_line_defaults;

export function getRankRates() {
  return { ...RANK_RATES };
}

export function getGuaranteedRates() {
  return { ...GUARANTEED_RATES };
}

export function getPublicMarketingCopy() {
  return { ...loadProductionBaseline().public_marketing_copy };
}

function getRankPublicLabel(rank) {
  if (rank === "Top Creator") {
    return `Top Creator（最大${GUARANTEED_RATES["Top Creator"]}%・条件達成者のみ）`;
  }
  if (rank === "Elite Creator") {
    return `Elite Creator（最大${GUARANTEED_RATES["Elite Creator"]}%・条件達成者のみ）`;
  }
  return rank;
}

/** @deprecated Ver2 では未使用（後方互換） */
export const BASE_RATE_CANDIDATES = Object.values(
  loadProductionBaseline().two_layer_allocation.guaranteed_layer.rates
).concat(Object.values(loadProductionBaseline().two_layer_allocation.variable_layer.rates));

export const CAUTION_MARGIN_RATIO = 1.15;

/**
 * @param {object} inputs
 */
export function computeFinancialSummary(inputs) {
  const gross_revenue =
    inputs.total_ad_revenue ??
    inputs.short_revenue + inputs.normal_video_revenue + inputs.live_revenue;

  const total_cost =
    inputs.cloudflare_cost +
    inputs.ai_cost +
    inputs.stripe_fee +
    inputs.fixed_operation_cost;

  const reserve_total =
    inputs.tax_reserve + inputs.development_reserve + inputs.emergency_reserve;

  const required_company_keep = inputs.minimum_company_profit + reserve_total;
  const profit_before_payout = gross_revenue - total_cost;
  const payout_pool = Math.max(0, gross_revenue - total_cost - required_company_keep);

  return {
    gross_revenue,
    total_cost,
    reserve_total,
    required_company_keep,
    payout_pool,
    profit_before_payout,
    minimum_company_profit: inputs.minimum_company_profit,
    revenue_summary: {
      total_ad_revenue: gross_revenue,
      short_revenue: inputs.short_revenue,
      normal_video_revenue: inputs.normal_video_revenue,
      live_revenue: inputs.live_revenue,
    },
    cost_summary: {
      cloudflare_cost: inputs.cloudflare_cost,
      ai_cost: inputs.ai_cost,
      stripe_fee: inputs.stripe_fee,
      fixed_operation_cost: inputs.fixed_operation_cost,
      total_cost,
    },
    reserve_summary: {
      tax_reserve: inputs.tax_reserve,
      development_reserve: inputs.development_reserve,
      emergency_reserve: inputs.emergency_reserve,
      reserve_total,
    },
  };
}

/**
 * @param {object} c
 * @param {object} conditions
 * @param {number} platformGross
 */
export function meetsRankConditions(c, conditions, platformGross) {
  if (c.monthly_revenue < conditions.min_monthly_revenue) return false;
  if ((c.views ?? 0) < conditions.min_views) return false;
  if ((c.engagement_score ?? 0) < conditions.min_engagement_score) return false;
  if ((c.live_hours ?? 0) < (conditions.min_live_hours ?? 0)) return false;
  if (
    conditions.min_platform_gross_revenue != null &&
    platformGross < conditions.min_platform_gross_revenue
  ) {
    return false;
  }
  return true;
}

/**
 * @param {object} c
 * @param {Record<string, object>} conditionLines
 * @param {number} platformGross
 * @param {Set<string>} filledSpecialSlots
 * @returns {CreatorRank}
 */
export function assignCreatorRank(c, conditionLines, platformGross, filledSpecialSlots) {
  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    const rank = RANK_ORDER[i];
    const cond = conditionLines[rank];
    if (!meetsRankConditions(c, cond, platformGross)) continue;

    if (SPECIAL_RANKS.has(rank)) {
      const key = rank;
      const used = filledSpecialSlots.has(`${key}:${c.creator_id}`) ? 1 : 0;
      const count = [...filledSpecialSlots].filter((s) => s.startsWith(`${key}:`)).length;
      if (count >= (cond.max_slots ?? 99)) continue;
    }
    return rank;
  }
  return "Starter";
}

/**
 * @param {object} c
 * @param {CreatorRank} currentRank
 * @param {Record<string, object>} conditionLines
 */
export function gapToNextRank(c, currentRank, conditionLines) {
  const idx = RANK_ORDER.indexOf(currentRank);
  if (idx >= RANK_ORDER.length - 1) {
    return { next_rank: null, gaps: {}, message: "最高ランク到達" };
  }
  const nextRank = RANK_ORDER[idx + 1];
  const next = conditionLines[nextRank];
  const gaps = {
    monthly_revenue: Math.max(0, next.min_monthly_revenue - c.monthly_revenue),
    views: Math.max(0, next.min_views - (c.views ?? 0)),
    engagement_score: Math.max(0, Number((next.min_engagement_score - (c.engagement_score ?? 0)).toFixed(2))),
    live_hours: Math.max(0, (next.min_live_hours ?? 0) - (c.live_hours ?? 0)),
  };
  const parts = [];
  if (gaps.monthly_revenue > 0) parts.push(`発生収益 あと ¥${gaps.monthly_revenue.toLocaleString("ja-JP")}`);
  if (gaps.views > 0) parts.push(`再生数 あと ${gaps.views.toLocaleString("ja-JP")}`);
  if (gaps.engagement_score > 0) parts.push(`エンゲージメント あと ${gaps.engagement_score}`);
  if (gaps.live_hours > 0) parts.push(`ライブ あと ${gaps.live_hours}h`);

  return {
    next_rank: nextRank,
    next_rank_rate: RANK_RATES[nextRank],
    gaps,
    message: parts.length ? parts.join(" / ") : `${nextRank} 条件達成済み`,
  };
}

/**
 * @param {object[]} creators
 * @param {Record<string, object>} conditionLines
 * @param {number} platformGross
 */
function payoutForNormalRanks(creators, conditionLines, platformGross) {
  return creators.reduce((sum, c) => {
    const rank = assignCreatorRank(c, conditionLines, platformGross, new Set());
    if (SPECIAL_RANKS.has(rank)) return sum;
    return sum + Math.round(c.monthly_revenue * (RANK_RATES[rank] / 100));
  }, 0);
}

/**
 * @param {number} nElite
 * @param {number} nTop
 * @param {object[]} creators
 * @param {Record<string, object>} conditionLines
 * @param {number} platformGross
 */
function payoutForHeadcount(nElite, nTop, creators, conditionLines, platformGross) {
  const sorted = [...creators].sort((a, b) => b.monthly_revenue - a.monthly_revenue);
  const eliteIds = new Set();
  const topIds = new Set();

  for (const c of sorted) {
    if (eliteIds.size < nElite && meetsRankConditions(c, conditionLines["Elite Creator"], platformGross)) {
      eliteIds.add(c.creator_id);
    }
  }
  for (const c of sorted) {
    if (eliteIds.has(c.creator_id)) continue;
    if (topIds.size < nTop && meetsRankConditions(c, conditionLines["Top Creator"], platformGross)) {
      topIds.add(c.creator_id);
    }
  }

  let total = 0;
  for (const c of creators) {
    if (eliteIds.has(c.creator_id)) {
      total += Math.round(
        c.monthly_revenue * (GUARANTEED_RATES["Elite Creator"] / 100)
      );
    } else if (topIds.has(c.creator_id)) {
      total += Math.round(
        c.monthly_revenue * (GUARANTEED_RATES["Top Creator"] / 100)
      );
    } else {
      const rank = assignCreatorRank(c, conditionLines, platformGross, new Set([...eliteIds, ...topIds].map(id => `x:${id}`)));
      if (!SPECIAL_RANKS.has(rank)) {
        total += Math.round(c.monthly_revenue * (RANK_RATES[rank] / 100));
      } else {
        total += Math.round(c.monthly_revenue * (RANK_RATES.Pro / 100));
      }
    }
  }
  return total;
}

/**
 * @param {object[]} creators
 * @param {object} financials
 * @param {number} platformGross
 */
function simulateHeadcount(creators, financials, platformGross, conditionLines) {
  const pool = financials.payout_pool;
  let maxElite = 0;
  let maxTop = 0;

  for (let e = 0; e <= (conditionLines["Elite Creator"].max_slots ?? 2); e++) {
    for (let t = 0; t <= (conditionLines["Top Creator"].max_slots ?? 5); t++) {
      const need = payoutForHeadcount(e, t, creators, conditionLines, platformGross);
      if (need <= pool + 1) {
        if (e > maxElite || (e === maxElite && t > maxTop)) {
          maxElite = e;
          maxTop = t;
        }
      }
    }
  }

  return {
    elite_max_affordable: maxElite,
    top_creator_max_affordable: maxTop,
    payout_at_max: payoutForHeadcount(maxElite, maxTop, creators, conditionLines, platformGross),
  };
}

/**
 * @param {object} inputs
 * @param {object} financials
 * @param {object[]} creators
 */
export function computeConditionLines(inputs, financials, creators) {
  const platformGross = financials.gross_revenue;
  const pool = financials.payout_pool;

  /** @type {Record<string, object>} */
  const lines = JSON.parse(JSON.stringify(BASE_CONDITION_LINES));

  let headcount = simulateHeadcount(creators, financials, platformGross, lines);

  lines["Elite Creator"].max_slots = headcount.elite_max_affordable;
  lines["Top Creator"].max_slots = headcount.top_creator_max_affordable;

  if (headcount.elite_max_affordable === 0 && pool > 0) {
    const eliteNeed = payoutForHeadcount(1, 0, creators, lines, platformGross);
    if (eliteNeed > pool) {
      lines["Elite Creator"].min_monthly_revenue = Math.max(
        lines["Elite Creator"].min_monthly_revenue,
        Math.ceil((creators[0]?.monthly_revenue ?? 160_000) * 1.15)
      );
      lines["Elite Creator"].min_platform_gross_revenue = Math.ceil(platformGross * 1.2);
    }
  }

  if (headcount.top_creator_max_affordable === 0 && pool > 0) {
    const topNeed = payoutForHeadcount(0, 1, creators, lines, platformGross);
    if (topNeed > pool) {
      lines["Top Creator"].min_monthly_revenue = Math.max(
        lines["Top Creator"].min_monthly_revenue,
        Math.ceil((sortedTopRevenue(creators) ?? 100_000) * 1.1)
      );
      lines["Top Creator"].min_platform_gross_revenue = Math.ceil(platformGross * 1.15);
    }
  }

  headcount = simulateHeadcount(creators, financials, platformGross, lines);
  lines["Elite Creator"].max_slots = headcount.elite_max_affordable;
  lines["Top Creator"].max_slots = headcount.top_creator_max_affordable;

  const stripeRate = inputs.stripe_fee / (inputs.total_ad_revenue || 1);
  const fixedCosts =
    inputs.cloudflare_cost + inputs.ai_cost + inputs.fixed_operation_cost;

  function grossForPool(requiredPool) {
    return Math.ceil(
      (requiredPool + fixedCosts + financials.required_company_keep) / (1 - stripeRate)
    );
  }

  const poolForOneTop = payoutForHeadcount(0, 1, creators, lines, platformGross);
  const poolForOneElite = payoutForHeadcount(1, 0, creators, lines, platformGross);

  return {
    month: inputs.month,
    ai_adjusts: "条件ライン（還元率は固定しない）",
    platform_gross_revenue: platformGross,
    payout_pool: pool,
    ranks: Object.fromEntries(
      RANK_ORDER.map((rank) => [
        rank,
        {
          ...lines[rank],
          payout_rate: RANK_RATES[rank],
          rate_guaranteed_on_achievement: SPECIAL_RANKS.has(rank),
          public_label: getRankPublicLabel(rank),
        },
      ])
    ),
    reach_conditions: {
      top_creator_70: {
        guaranteed_rate: GUARANTEED_RATES["Top Creator"],
        conditions: lines["Top Creator"],
        required_platform_gross_revenue: grossForPool(poolForOneTop),
        required_payout_pool_one_slot: poolForOneTop,
        max_affordable_this_month: headcount.top_creator_max_affordable,
      },
      elite_creator_80: {
        guaranteed_rate: GUARANTEED_RATES["Elite Creator"],
        conditions: lines["Elite Creator"],
        required_platform_gross_revenue: grossForPool(poolForOneElite),
        required_payout_pool_one_slot: poolForOneElite,
        max_affordable_this_month: headcount.elite_max_affordable,
      },
    },
    headcount_simulation: headcount,
    max_platform_payout_rate: computeMaxPlatformRate(financials, creators, lines, platformGross),
  };
}

function sortedTopRevenue(creators) {
  return [...creators].sort((a, b) => b.monthly_revenue - a.monthly_revenue)[0]?.monthly_revenue;
}

/**
 * @param {object} financials
 * @param {object[]} creators
 * @param {Record<string, object>} conditionLines
 * @param {number} platformGross
 */
function computeMaxPlatformRate(financials, creators, conditionLines, platformGross) {
  const totalRev = creators.reduce((s, c) => s + c.monthly_revenue, 0);
  if (totalRev <= 0) return 0;
  const maxPayout = financials.payout_pool;
  const headcount = simulateHeadcount(creators, financials, platformGross, conditionLines);
  const payout = payoutForHeadcount(
    headcount.elite_max_affordable,
    headcount.top_creator_max_affordable,
    creators,
    conditionLines,
    platformGross
  );
  return Math.round((payout / totalRev) * 1000) / 10;
}

/**
 * @param {number} profitAfter
 * @param {number} minimumProfit
 * @param {number} payoutPool
 * @param {number} totalPayout
 */
export function computeSafetyStatus(profitAfter, minimumProfit, payoutPool, totalPayout) {
  if (profitAfter < 0) return "RED";
  if (profitAfter < minimumProfit) return "DANGER";
  const poolUsed = payoutPool > 0 ? totalPayout / payoutPool : 1;
  if (profitAfter < minimumProfit * CAUTION_MARGIN_RATIO || poolUsed > 0.92) return "CAUTION";
  return "SAFE";
}

/**
 * @param {object[]} creatorRows
 * @param {number} pool
 */
export function allocatePayouts(creatorRows, pool) {
  const guaranteed = creatorRows.filter((r) => r.rate_guaranteed);
  const normal = creatorRows.filter((r) => !r.rate_guaranteed);

  for (const r of creatorRows) {
    r.original_rate = r.payout_rate;
    r.adjusted_rate = r.payout_rate;
    r.allocation_layer = r.rate_guaranteed ? "guaranteed" : "variable";
    r.gross_creator_revenue = r.revenue_generated;
  }

  for (const r of guaranteed) {
    r.adjustment_reason = `条件達成・${r.original_rate}% 保証（引き下げなし）`;
    const line = computeLinePayoutYen(r.revenue_generated, r.original_rate);
    r.payout_amount = line.rounded_yen;
    r._payout_exact_yen = line.exact_yen;
    r._payout_rounding_delta_yen = line.rounding_delta_yen;
  }

  for (const r of normal) {
    const line = computeLinePayoutYen(r.revenue_generated, r.original_rate);
    r.pre_scale_exact_yen = line.exact_yen;
    r.pre_scale_payout_yen = line.rounded_yen;
    r.payout_amount = line.rounded_yen;
    r._payout_exact_yen = line.exact_yen;
    r._payout_rounding_delta_yen = line.rounding_delta_yen;
  }

  const guaranteedTotal = guaranteed.reduce((s, r) => s + r.payout_amount, 0);
  const residualPool = pool - guaranteedTotal;

  if (residualPool < 0) {
    for (const r of guaranteed) {
      r.adjustment_reason = "保証層（還元率は維持・プール超過は運営側で吸収）";
    }
    for (const r of normal) {
      r.payout_amount = 0;
      r.payout_rate = 0;
      r.adjusted_rate = 0;
      r.adjustment_reason = "保証層優先のため一般ランク配分なし（プール不足）";
      r.pool_adjusted = true;
    }
    return {
      guaranteed_total: guaranteedTotal,
      residual_pool: 0,
      variable_total: 0,
      guaranteed_shortfall: Math.abs(residualPool),
      variable_scale: 0,
      allocation_mode: "guaranteed_shortfall",
    };
  }

  const normalAtOriginal = normal.reduce((s, r) => s + r.pre_scale_payout_yen, 0);

  if (normal.length === 0) {
    return {
      guaranteed_total: guaranteedTotal,
      residual_pool: residualPool,
      variable_total: 0,
      guaranteed_shortfall: 0,
      variable_scale: 1,
      allocation_mode: residualPool > 0 ? "guaranteed_only_surplus" : "guaranteed_only",
    };
  }

  if (normalAtOriginal <= residualPool) {
    for (const r of normal) {
      r.payout_amount = r.pre_scale_payout_yen;
      r.applied_rate = r.original_rate;
      r.adjusted_rate = r.original_rate;
      r.payout_rate = r.original_rate;
      r.post_scale_exact_yen = r.pre_scale_exact_yen;
      r.largest_remainder_adjustment_yen = 0;
      r.scale_factor_exact = 1;
      r.adjustment_reason =
        guaranteed.length > 0
          ? "Top/Elite 保証控除後の残余プールで基準還元率を適用"
          : "残余プール全体を一般ランクへ配分（基準還元率を適用）";
      if (residualPool > normalAtOriginal) {
        r.adjustment_reason += "（売上好調・基準還元率に到達）";
      }
    }
    const variableTotal = normal.reduce((s, r) => s + r.payout_amount, 0);
    return {
      guaranteed_total: guaranteedTotal,
      residual_pool: residualPool,
      variable_total: variableTotal,
      guaranteed_shortfall: 0,
      variable_scale: 1,
      residual_surplus: residualPool - variableTotal,
      allocation_mode: "full_base_rate",
    };
  }

  const scaleResult = finalizeVariableLayerYen(normal, residualPool);
  for (const r of normal) {
    r.pool_adjusted = true;
    r.adjustment_reason = guaranteed.length
      ? `Top/Elite 保証控除後の残余プール（¥${roundHalfUpYen(residualPool).toLocaleString("ja-JP")}）により基準 ${r.original_rate}% → ${r.adjusted_rate}% に調整`
      : `残余プール不足により基準 ${r.original_rate}% → ${r.adjusted_rate}% に調整`;
    if (r.reason) r.reason += " / 還元プール調整（一般ランクのみ・保証対象外）";
  }

  return {
    guaranteed_total: guaranteedTotal,
    residual_pool: residualPool,
    variable_total: scaleResult.variable_total,
    guaranteed_shortfall: 0,
    variable_scale: scaleResult.scale_factor_exact,
    allocation_mode: "variable_scaled_down",
  };
}

/**
 * @param {object} inputs
 * @param {object[]} creators
 */
export function runPayoutDecision(inputs, creators) {
  const financials = computeFinancialSummary(inputs);
  const conditionLines = computeConditionLines(inputs, financials, creators);
  const platformGross = financials.gross_revenue;

  const sorted = [...creators].sort((a, b) => b.monthly_revenue - a.monthly_revenue);
  const eliteSlots = new Set();
  const topSlots = new Set();

  const eliteCap = conditionLines.headcount_simulation.elite_max_affordable;
  const topCap = conditionLines.headcount_simulation.top_creator_max_affordable;

  for (const c of sorted) {
    if (
      eliteSlots.size < eliteCap &&
      meetsRankConditions(c, conditionLines.ranks["Elite Creator"], platformGross)
    ) {
      eliteSlots.add(c.creator_id);
    }
  }
  for (const c of sorted) {
    if (eliteSlots.has(c.creator_id)) continue;
    if (
      topSlots.size < topCap &&
      meetsRankConditions(c, conditionLines.ranks["Top Creator"], platformGross)
    ) {
      topSlots.add(c.creator_id);
    }
  }

  const filledSpecial = new Set([
    ...[...eliteSlots].map((id) => `Elite Creator:${id}`),
    ...[...topSlots].map((id) => `Top Creator:${id}`),
  ]);

  /** @type {object[]} */
  const creatorRows = creators.map((c) => {
    let rank;
    if (eliteSlots.has(c.creator_id)) rank = "Elite Creator";
    else if (topSlots.has(c.creator_id)) rank = "Top Creator";
    else rank = assignCreatorRank(c, conditionLines.ranks, platformGross, filledSpecial);

    const payoutRate = RANK_RATES[rank];
    const rateGuaranteed = SPECIAL_RANKS.has(rank);
    const progress = gapToNextRank(c, rank, conditionLines.ranks);

    const reasonParts = [
      `${rank} 判定（個別還元 ${payoutRate}%）`,
      `月間発生収益 ¥${c.monthly_revenue.toLocaleString("ja-JP")}`,
    ];
    if (rateGuaranteed) reasonParts.push(`条件達成・${payoutRate}% 保証（AI による引き下げなし）`);
    if (c.views >= 10_000) reasonParts.push(`再生 ${c.views.toLocaleString("ja-JP")}`);
    if (progress.next_rank) reasonParts.push(`次ランク: ${progress.message}`);

    return {
      creator_id: c.creator_id,
      creator_name: c.creator_name,
      stripe_connect_account_id: c.stripe_connect_account_id ?? "",
      revenue_generated: c.monthly_revenue,
      rank,
      tier: rank,
      payout_rate: payoutRate,
      recommended_rate: payoutRate,
      rate_guaranteed: rateGuaranteed,
      condition_met: true,
      payout_amount: Math.round(c.monthly_revenue * (payoutRate / 100)),
      next_rank: progress.next_rank,
      gap_to_next_rank: progress.gaps,
      gap_message: progress.message,
      reason: reasonParts.join(" / "),
      _metrics: c,
    };
  });

  const allocMeta = allocatePayouts(creatorRows, financials.payout_pool);
  const totalPayout = creatorRows.reduce((s, r) => s + r.payout_amount, 0);
  const profit_after_payout = financials.profit_before_payout - totalPayout;
  const safety_status = computeSafetyStatus(
    profit_after_payout,
    financials.minimum_company_profit,
    financials.payout_pool,
    totalPayout
  );

  const operator_comment = buildOperatorComment({
    month: inputs.month,
    financials,
    conditionLines,
    safety_status,
    totalPayout,
    profit_after_payout,
    creatorRows,
    allocMeta,
  });

  return {
    engine_version: ENGINE_VERSION,
    philosophy: PHILOSOPHY,
    month: inputs.month,
    condition_lines: conditionLines,
    revenue_summary: financials.revenue_summary,
    cost_summary: financials.cost_summary,
    reserve_summary: financials.reserve_summary,
    safety_status,
    gross_revenue: financials.gross_revenue,
    total_cost: financials.total_cost,
    reserve_total: financials.reserve_total,
    required_company_keep: financials.required_company_keep,
    payout_pool: financials.payout_pool,
    profit_before_payout: financials.profit_before_payout,
    profit_after_payout,
    total_payout: totalPayout,
    max_platform_payout_rate: conditionLines.max_platform_payout_rate,
    headcount_simulation: conditionLines.headcount_simulation,
    creator_payouts: creatorRows.map(
      ({
        _metrics,
        stripe_connect_account_id,
        tier,
        recommended_rate,
        allocation_layer,
        original_rate,
        adjusted_rate,
        gross_creator_revenue,
        adjustment_reason,
        ...rest
      }) => ({
        ...rest,
        original_rate,
        adjusted_rate,
        gross_creator_revenue,
        adjustment_reason: adjustment_reason ?? (rest.rate_guaranteed ? "条件達成・還元率保証" : ""),
        allocation_layer,
      })
    ),
    operator_comment,
    marketing_copy: {
      ...getPublicMarketingCopy(),
      disclaimer:
        "会社収支・運営コスト・適用条件に基づき算出。毎月固定の還元率はありません。",
    },
    _creator_rows_full: creatorRows,
    _alloc_meta: allocMeta,
    residual_pool_allocation: buildResidualPoolAllocationReport({
      month: inputs.month,
      payout_pool: financials.payout_pool,
      gross_revenue: financials.gross_revenue,
      creatorRows,
      allocMeta,
    }),
  };
}

function buildOperatorComment(ctx) {
  const lines = [];
  lines.push(`【${ctx.month} Ver2 月次判断】安全: ${ctx.safety_status}`);
  lines.push(ctx.philosophy ?? PHILOSOPHY);
  lines.push("AI は還元率ではなく条件ラインを調整。Top/Elite 条件達成者の還元率は保証。");

  const elite = ctx.creatorRows.filter((r) => r.rank === "Elite Creator");
  const top = ctx.creatorRows.filter((r) => r.rank === "Top Creator");
  if (elite.length) {
    lines.push(
      `Elite Creator ${elite.length} 名（${GUARANTEED_RATES["Elite Creator"]}% 保証）: ${elite.map((e) => e.creator_name).join("、")}`
    );
  }
  if (top.length) {
    lines.push(
      `Top Creator ${top.length} 名（${GUARANTEED_RATES["Top Creator"]}% 保証）: ${top.map((t) => t.creator_name).join("、")}`
    );
  }

  lines.push(
    `条件ライン: Top 個人収益 ¥${ctx.conditionLines.ranks["Top Creator"].min_monthly_revenue.toLocaleString("ja-JP")} / Elite ¥${ctx.conditionLines.ranks["Elite Creator"].min_monthly_revenue.toLocaleString("ja-JP")}`
  );
  lines.push(
    `人数上限シミュレーション: Top ${ctx.conditionLines.headcount_simulation.top_creator_max_affordable} 名 / Elite ${ctx.conditionLines.headcount_simulation.elite_max_affordable} 名`
  );

  if (ctx.allocMeta.guaranteed_shortfall > 0) {
    lines.push(`警告: 保証還元合計がプールを ¥${ctx.allocMeta.guaranteed_shortfall.toLocaleString("ja-JP")} 超過 — 条件ライン見直し推奨`);
  }

  return lines.join("\n");
}

export function defaultMonthlyInputs() {
  return {
    month: "2026-05",
    total_ad_revenue: 620_000,
    short_revenue: 286_000,
    normal_video_revenue: 273_000,
    live_revenue: 61_000,
    cloudflare_cost: 5_200,
    ai_cost: 15_000,
    stripe_fee: 22_320,
    fixed_operation_cost: 300_000,
    tax_reserve: 31_000,
    development_reserve: 50_000,
    emergency_reserve: 20_000,
    minimum_company_profit: 50_000,
    creator_count: 6,
  };
}

export function defaultSampleCreators() {
  return [
    {
      creator_id: "cr_001",
      creator_name: "ひろチャンネル",
      stripe_connect_account_id: "acct_sample_hiro_001",
      monthly_revenue: 185_000,
      views: 92_000,
      watch_time: 14_200,
      live_hours: 28,
      new_users: 420,
      engagement_score: 0.82,
    },
    {
      creator_id: "cr_002",
      creator_name: "ゲーム実況タロウ",
      stripe_connect_account_id: "acct_sample_taro_002",
      monthly_revenue: 98_000,
      views: 48_000,
      watch_time: 7_800,
      live_hours: 18,
      new_users: 210,
      engagement_score: 0.71,
    },
    {
      creator_id: "cr_003",
      creator_name: "料理ショートみかん",
      stripe_connect_account_id: "acct_sample_mikan_003",
      monthly_revenue: 52_000,
      views: 65_000,
      watch_time: 5_100,
      live_hours: 4,
      new_users: 180,
      engagement_score: 0.68,
    },
    {
      creator_id: "cr_004",
      creator_name: "音楽ライブユキ",
      stripe_connect_account_id: "acct_sample_yuki_004",
      monthly_revenue: 38_000,
      views: 12_000,
      watch_time: 3_200,
      live_hours: 22,
      new_users: 95,
      engagement_score: 0.75,
    },
    {
      creator_id: "cr_005",
      creator_name: "初心者Vlogサクラ",
      stripe_connect_account_id: "acct_sample_sakura_005",
      monthly_revenue: 8_500,
      views: 9_200,
      watch_time: 1_100,
      live_hours: 2,
      new_users: 45,
      engagement_score: 0.52,
    },
    {
      creator_id: "cr_006",
      creator_name: "テスト配信くん",
      stripe_connect_account_id: "acct_sample_test_006",
      monthly_revenue: 2_200,
      views: 1_800,
      watch_time: 280,
      live_hours: 0,
      new_users: 12,
      engagement_score: 0.31,
    },
  ];
}

export function baselineMonthlyInputs() {
  return {
    month: "2026-04",
    total_ad_revenue: 85_640,
    short_revenue: 39_600,
    normal_video_revenue: 37_800,
    live_revenue: 8_240,
    cloudflare_cost: 1_142,
    ai_cost: 15_000,
    stripe_fee: 3_083,
    fixed_operation_cost: 300_000,
    tax_reserve: 4_300,
    development_reserve: 10_000,
    emergency_reserve: 5_000,
    minimum_company_profit: 30_000,
    creator_count: 3,
  };
}

/** 保証後残余プール配分レポート */
export function buildResidualPoolAllocationReport(ctx) {
  const { month, payout_pool, gross_revenue, creatorRows, allocMeta } = ctx;
  const guaranteed = creatorRows.filter((r) => r.allocation_layer === "guaranteed");
  const variable = creatorRows.filter((r) => r.allocation_layer === "variable");

  const guaranteedPayouts = guaranteed.map((r) => ({
    creator_id: r.creator_id,
    creator_name: r.creator_name,
    rank: r.rank,
    guaranteed_rate: r.original_rate,
    gross_creator_revenue: r.gross_creator_revenue,
    payout_amount: r.payout_amount,
    adjustment_reason: r.adjustment_reason ?? "条件達成・還元率保証（引き下げなし）",
  }));

  const variablePayouts = variable.map((r) => ({
    creator_id: r.creator_id,
    creator_name: r.creator_name,
    rank: r.rank,
    original_rate: r.original_rate,
    adjusted_rate: r.adjusted_rate,
    gross_creator_revenue: r.gross_creator_revenue,
    payout_amount: r.payout_amount,
    adjustment_reason: r.adjustment_reason ?? "基準還元率を適用",
  }));

  const variableTotal = variable.reduce((s, r) => s + r.payout_amount, 0);
  const guaranteedTotal = guaranteed.reduce((s, r) => s + r.payout_amount, 0);

  let narrative;
  if (guaranteed.length === 0) {
    narrative =
      "今月は Top/Elite 該当者なし。還元プール全体を Starter / Creator / Pro の変動層へ配分。";
  } else if (allocMeta.allocation_mode === "full_base_rate") {
    narrative =
      "Top/Elite 保証支払いを確保したうえで、残余プールで一般ランクに基準還元率を適用（売上好調）。";
  } else if (allocMeta.allocation_mode === "variable_scaled_down") {
    narrative =
      "Top/Elite 保証支払いを優先確保し、残余プールの範囲内で一般ランクのみ還元率を調整。";
  } else {
    narrative = "保証層と変動層の配分を実施。";
  }

  return {
    engine_version: ENGINE_VERSION,
    month,
    purpose:
      "高還元保証者を守ったあと、残りを一般クリエイターへ公平に配分する過程の可視化",
    payout_pool,
    gross_revenue,
    guaranteed_layer: {
      description: "Top Creator（70%）/ Elite Creator（80%）— 条件達成者は還元率を下げない",
      total: guaranteedTotal,
      count: guaranteed.length,
      payouts: guaranteedPayouts,
    },
    residual_pool: allocMeta.residual_pool ?? payout_pool - guaranteedTotal,
    variable_layer: {
      description: "Starter / Creator / Pro — 残余プールから配分（変動層）",
      total: variableTotal,
      count: variable.length,
      allocation_mode: allocMeta.allocation_mode,
      variable_scale: allocMeta.variable_scale ?? 1,
      residual_surplus: allocMeta.residual_surplus ?? 0,
      payouts: variablePayouts,
    },
    summary: {
      total_payout: guaranteedTotal + variableTotal,
      guaranteed_count: guaranteed.length,
      variable_count: variable.length,
      pool_utilization_pct:
        payout_pool > 0
          ? Math.round(((guaranteedTotal + variableTotal) / payout_pool) * 1000) / 10
          : 0,
      narrative,
    },
  };
}

export function formatResidualPoolMarkdown(report) {
  const lines = [];
  lines.push("# 保証後残余プール配分レポート");
  lines.push("");
  lines.push(`**対象月:** ${report.month} | **還元プール:** ¥${report.payout_pool.toLocaleString("ja-JP")}`);
  lines.push("");
  lines.push(`> ${report.purpose}`);
  lines.push("");
  lines.push(`**サマリー:** ${report.summary.narrative}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 1. 保証層（Top Creator / Elite Creator）");
  lines.push("");
  lines.push(`| 合計 | ¥${report.guaranteed_layer.total.toLocaleString("ja-JP")} | ${report.guaranteed_layer.count} 名 |`);
  lines.push("");
  if (report.guaranteed_layer.payouts.length) {
    lines.push("| クリエイター | ランク | 保証率 | 発生収益 | 支払額 |");
    lines.push("|-------------|--------|--------|---------|--------|");
    for (const p of report.guaranteed_layer.payouts) {
      lines.push(
        `| ${p.creator_name} | ${p.rank} | ${p.guaranteed_rate}% | ¥${p.gross_creator_revenue.toLocaleString("ja-JP")} | ¥${p.payout_amount.toLocaleString("ja-JP")} |`
      );
    }
  } else {
    lines.push("*今月の保証層該当者はいません。*");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 2. 残余プール");
  lines.push("");
  lines.push(`| 項目 | 金額 |`);
  lines.push(`|------|------|`);
  lines.push(`| 還元プール | ¥${report.payout_pool.toLocaleString("ja-JP")} |`);
  lines.push(`| 保証層控除 | ¥${report.guaranteed_layer.total.toLocaleString("ja-JP")} |`);
  lines.push(`| **残余プール** | **¥${report.residual_pool.toLocaleString("ja-JP")}** |`);
  lines.push(`| 配分モード | ${report.variable_layer.allocation_mode} |`);
  if (report.variable_layer.residual_surplus > 0) {
    lines.push(`| 残余余剰（未配分） | ¥${report.variable_layer.residual_surplus.toLocaleString("ja-JP")} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 3. 変動層（Starter / Creator / Pro）");
  lines.push("");
  lines.push("| クリエイター | ランク | 基準率 | 適用率 | 発生収益 | 支払額 | 調整理由 |");
  lines.push("|-------------|--------|--------|--------|---------|--------|---------|");
  for (const p of report.variable_layer.payouts) {
    lines.push(
      `| ${p.creator_name} | ${p.rank} | ${p.original_rate}% | ${p.adjusted_rate}% | ¥${p.gross_creator_revenue.toLocaleString("ja-JP")} | ¥${p.payout_amount.toLocaleString("ja-JP")} | ${p.adjustment_reason} |`
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 4. 整合性");
  lines.push("");
  lines.push(`- 支払合計: ¥${report.summary.total_payout.toLocaleString("ja-JP")}`);
  lines.push(`- プール使用率: ${report.summary.pool_utilization_pct}%`);
  lines.push("- 詳細: `output/monthly-payout-decision.json` / `output/residual-pool-allocation.json`");
  lines.push("");
  lines.push("*Generated by scripts/generate-tlv-business-simulator.mjs*");
  return lines.join("\n");
}

/** Ver2 ランク進捗レポート */
export function buildRankProgressReport(payoutDecision) {
  return {
    engine_version: ENGINE_VERSION,
    month: payoutDecision.month,
    condition_lines: payoutDecision.condition_lines,
    creators: payoutDecision.creator_payouts.map((p) => ({
      creator_id: p.creator_id,
      creator_name: p.creator_name,
      rank: p.rank,
      payout_rate: p.payout_rate,
      rate_guaranteed: p.rate_guaranteed,
      next_rank: p.next_rank,
      gap_to_next_rank: p.gap_to_next_rank,
      gap_message: p.gap_message,
    })),
    headcount_simulation: payoutDecision.headcount_simulation,
    max_platform_payout_rate: payoutDecision.max_platform_payout_rate,
    reach_conditions: payoutDecision.condition_lines.reach_conditions,
  };
}

/** Creator 向けランク説明レポート */
export function buildCreatorRankExplanationReport(payoutDecision) {
  const ranks = payoutDecision.condition_lines?.ranks ?? {};
  const baseline = loadProductionBaseline();
  const guaranteedRanks = baseline.two_layer_allocation.guaranteed_layer.ranks;
  const variableRanks = baseline.two_layer_allocation.variable_layer.ranks;
  const marketing = getPublicMarketingCopy();

  const creators = payoutDecision.creator_payouts.map((p) => {
    const guaranteeStatus = p.rate_guaranteed ? "guaranteed" : "variable";
    const nextRank = p.next_rank ?? null;
    const nextRankRequiredRevenue =
      nextRank && ranks[nextRank] ? ranks[nextRank].min_monthly_revenue : null;
    const gapRevenue = p.gap_to_next_rank?.monthly_revenue ?? 0;

    let adjustmentReason = p.adjustment_reason ?? "";
    if (guaranteeStatus === "guaranteed") {
      adjustmentReason = `条件達成月のため還元率を保証（${p.rank} ${p.original_rate}%）。AI による引き下げはありません。`;
    } else if (p.adjusted_rate < p.original_rate) {
      adjustmentReason = `今月の残余プールに基づく調整（基準 ${p.original_rate}% → 適用 ${p.adjusted_rate}%）`;
    } else if (p.adjusted_rate === p.original_rate) {
      adjustmentReason =
        "今月の残余プールで基準還元率を適用（月次収支により変動層として配分）";
    }

    const rankExplanation =
      guaranteeStatus === "guaranteed"
        ? `${p.rank}：特別ランク。条件達成月は還元率が保証されます。`
        : `${p.rank}：一般ランク。月次収支（残余プール）により還元率が調整される場合があります。`;

    return {
      creator_id: p.creator_id,
      creator_name: p.creator_name,
      current_rank: p.rank,
      original_rate: p.original_rate,
      adjusted_rate: p.adjusted_rate,
      payout_amount: p.payout_amount,
      gross_creator_revenue: p.gross_creator_revenue ?? p.revenue_generated,
      next_rank: nextRank,
      next_rank_required_revenue: nextRankRequiredRevenue,
      gap_to_next_rank: gapRevenue,
      gap_message: p.gap_message ?? "",
      adjustment_reason: adjustmentReason,
      guarantee_status: guaranteeStatus,
      rank_explanation: rankExplanation,
    };
  });

  return {
    engine_version: ENGINE_VERSION,
    month: payoutDecision.month,
    audience: "creator",
    purpose: "クリエイターが自分のランク・還元率・次ランク条件・支払予定額・調整理由を理解するため",
    policy_summary: {
      guaranteed_ranks: guaranteedRanks,
      variable_ranks: variableRanks,
      guaranteed_note: "条件達成月は還元率を保証（引き下げなし）",
      variable_note: "月次収支の残余プールに基づき還元率が調整される場合があります",
      public_marketing_copy: marketing,
    },
    creators,
  };
}

export function formatCreatorRankExplanationMarkdown(report) {
  const lines = [];
  lines.push("# Creator 向けランク説明レポート");
  lines.push("");
  lines.push(`**対象月:** ${report.month}`);
  lines.push("");
  lines.push("> 本レポートはクリエイター向けの還元説明です。還元率は毎月固定ではありません。");
  lines.push(">");
  lines.push(`> - **保証対象:** ${report.policy_summary.guaranteed_ranks.join("、")} — ${report.policy_summary.guaranteed_note}`);
  lines.push(`> - **変動対象:** ${report.policy_summary.variable_ranks.join("、")} — ${report.policy_summary.variable_note}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const c of report.creators) {
    lines.push(`## ${c.creator_name}`);
    lines.push("");
    lines.push(`| 項目 | 内容 |`);
    lines.push(`|------|------|`);
    lines.push(`| 現在のランク | **${c.current_rank}** |`);
    lines.push(`| 保証ステータス | ${c.guarantee_status === "guaranteed" ? "保証（guaranteed）" : "変動（variable）"} |`);
    lines.push(`| 基準還元率 | ${c.original_rate}% |`);
    lines.push(`| 今月の適用還元率 | **${c.adjusted_rate}%** |`);
    lines.push(`| 今月の発生収益 | ¥${c.gross_creator_revenue.toLocaleString("ja-JP")} |`);
    lines.push(`| **今月の支払予定額** | **¥${c.payout_amount.toLocaleString("ja-JP")}** |`);
    lines.push(`| 調整理由 | ${c.adjustment_reason} |`);
    if (c.next_rank) {
      lines.push(`| 次のランク | ${c.next_rank} |`);
      lines.push(
        `| 次ランク必要収益 | ¥${(c.next_rank_required_revenue ?? 0).toLocaleString("ja-JP")} |`
      );
      lines.push(
        `| あと必要（発生収益） | ¥${c.gap_to_next_rank.toLocaleString("ja-JP")} |`
      );
    } else {
      lines.push(`| 次のランク | 最高ランク到達 |`);
    }
    lines.push("");
    lines.push(c.rank_explanation);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("## 公開向けの補足");
  lines.push("");
  const marketing = report.policy_summary.public_marketing_copy ?? getPublicMarketingCopy();
  lines.push(`- ${marketing.primary}`);
  lines.push(`- ${marketing.top_creator}、${marketing.elite_creator}（${marketing.eligibility}）`);
  lines.push("- 詳細の数値は運営状況により月ごとに変動します");
  lines.push("");
  lines.push("*Generated by scripts/generate-tlv-business-simulator.mjs*");
  return lines.join("\n");
}

/** Ver2 Production Baseline + 直近検証スナップショット */
export function buildPayoutEngineV2FinalSpec(verification = {}) {
  const baseline = loadProductionBaseline();
  return {
    ...baseline,
    generated_at: new Date().toISOString().slice(0, 10),
    verification_last_run: verification,
  };
}

export function formatPayoutEngineV2FinalSpecMarkdown(spec) {
  const lines = [];
  lines.push("# TLV AI 収益分配エンジン Ver2 — Production Baseline（正式版）");
  lines.push("");
  lines.push(
    `**仕様バージョン:** ${spec.spec_version} | **エンジン:** ${spec.engine_version} | **ステータス:** ${spec.status} | **生成日:** ${spec.generated_at}`
  );
  lines.push("");
  lines.push(`> ${spec.purpose}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 0. ガバナンス（Single Source of Truth）");
  lines.push("");
  lines.push("**Ver2 は Production Baseline として固定済み。上書き禁止。**");
  lines.push("");
  lines.push("### SSOT");
  for (const p of spec.governance.single_source_of_truth) {
    lines.push(`- \`${p}\``);
  }
  lines.push("");
  lines.push(`**変更ポリシー:** ${spec.governance.change_policy}`);
  lines.push("");
  lines.push("**以降の作業:** " + spec.governance.implementation_phase_only.join("・") + " のみ");
  lines.push("");
  lines.push(`**コードルール:** ${spec.governance.code_rule}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 1. 基本思想");
  lines.push("");
  lines.push(`**目的:** ${spec.core_philosophy.goal}`);
  lines.push("");
  lines.push(`**目的ではないこと:** ${spec.core_philosophy.not_the_goal}`);
  lines.push("");
  for (const p of spec.core_philosophy.principles) {
    lines.push(`- ${p}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 2. ランク体系");
  lines.push("");
  lines.push("| ランク | 還元率 | 層 | 保証 |");
  lines.push("|--------|--------|-----|------|");
  for (const r of spec.rank_system) {
    lines.push(
      `| ${r.rank} | ${r.base_rate_percent}% | ${r.layer} | ${r.guaranteed ? "YES" : "—"} |`
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 3. 2層配分構造");
  lines.push("");
  lines.push("### 保証層");
  lines.push(`- 対象: ${spec.two_layer_allocation.guaranteed_layer.ranks.join("、")}`);
  const gRates = spec.two_layer_allocation.guaranteed_layer.rates;
  lines.push(
    `- ${Object.entries(gRates)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(" / ")}`
  );
  lines.push(`- ${spec.two_layer_allocation.guaranteed_layer.description}`);
  lines.push("");
  lines.push("### 変動層");
  lines.push(`- 対象: ${spec.two_layer_allocation.variable_layer.ranks.join("、")}`);
  const vRates = spec.two_layer_allocation.variable_layer.rates;
  lines.push(
    `- ${Object.entries(vRates)
      .map(([k, v]) => `${k} ${v}%`)
      .join(" / ")}`
  );
  lines.push(`- ${spec.two_layer_allocation.variable_layer.description}`);
  lines.push("");
  lines.push("### フロー");
  for (const step of spec.two_layer_allocation.flow) {
    lines.push(`1. ${step}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 4. 保証ルール");
  lines.push("");
  for (const rule of spec.guarantee_rules) {
    lines.push(`- ${rule}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 5. AI の役割");
  lines.push("");
  lines.push(`- **調整するもの:** ${spec.ai_role.adjusts}`);
  lines.push(`- **調整しないもの:** ${spec.ai_role.does_not_adjust}`);
  lines.push("");
  for (const r of spec.ai_role.responsibilities) {
    lines.push(`- ${r}`);
  }
  if (spec.ai_role.prohibited?.length) {
    lines.push("");
    lines.push("**禁止:**");
    for (const p of spec.ai_role.prohibited) {
      lines.push(`- ${p}`);
    }
  }
  lines.push("");
  lines.push("**考慮する入力:** " + spec.ai_role.inputs_considered.join("、"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 6. 出力一覧");
  lines.push("");
  lines.push("| ファイル | 説明 |");
  lines.push("|---------|------|");
  for (const o of spec.outputs) {
    lines.push(`| \`${o.path}\` | ${o.description} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 7. 検証条件");
  lines.push("");
  for (const v of spec.verification_criteria) {
    lines.push(`- ${v}`);
  }
  lines.push("");
  if (spec.verification_last_run && Object.keys(spec.verification_last_run).length) {
    lines.push("### 直近検証結果");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(spec.verification_last_run, null, 2));
    lines.push("```");
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("## 8. 公開用表現");
  lines.push("");
  const m = spec.public_marketing_copy;
  lines.push(`- ${m.primary}`);
  lines.push(`- ${m.top_creator}`);
  lines.push(`- ${m.elite_creator}`);
  lines.push(`- ${m.eligibility}`);
  lines.push(`- ${m.disclaimer}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 9. 実装フェーズ");
  lines.push("");
  if (spec.implementation_phase) {
    lines.push(`**ステータス:** ${spec.implementation_phase.status}`);
    lines.push("");
    for (const t of spec.implementation_phase.targets) {
      lines.push(`- **${t.id}. ${t.name}** — ${t.description}`);
    }
    lines.push("");
    lines.push("**完了条件:**");
    for (const c of spec.implementation_phase.completion_criteria) {
      lines.push(`- ${c}`);
    }
    lines.push("");
    lines.push("詳細: `reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md`");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 実装");
  lines.push("");
  lines.push(`- 基準 JSON: \`reports/tlv-business-simulator/payout-engine-v2-production-baseline.json\``);
  lines.push(`- エンジン: \`${spec.implementation.engine}\``);
  lines.push(`- 生成: \`${spec.implementation.generator}\``);
  lines.push("");
  lines.push("```bash");
  lines.push("node scripts/generate-tlv-business-simulator.mjs");
  lines.push("```");
  lines.push("");
  lines.push(
    "*Ver2 Production Baseline — frozen. Spec changes require Ver3. Regenerate to refresh verification snapshot only.*"
  );
  return lines.join("\n");
}

export function finalSpecToExcelRows(spec) {
  const rows = [
    { セクション: "meta", 項目: "spec_version", 値: spec.spec_version },
    { セクション: "meta", 項目: "engine_version", 値: spec.engine_version },
    { セクション: "meta", 項目: "status", 値: spec.status },
    { セクション: "meta", 項目: "generated_at", 値: spec.generated_at },
    { セクション: "meta", 項目: "purpose", 値: spec.purpose },
    { セクション: "ガバナンス", 項目: "change_policy", 値: spec.governance?.change_policy ?? "" },
    { セクション: "ガバナンス", 項目: "code_rule", 値: spec.governance?.code_rule ?? "" },
  ];
  spec.core_philosophy.principles.forEach((p, i) => {
    rows.push({ セクション: "基本思想", 項目: `principle_${i + 1}`, 値: p });
  });
  for (const r of spec.rank_system) {
    rows.push({
      セクション: "ランク体系",
      項目: r.rank,
      値: `${r.base_rate_percent}% / ${r.layer}${r.guaranteed ? " / 保証" : ""}`,
    });
  }
  rows.push({
    セクション: "2層配分",
    項目: "保証層",
    値: spec.two_layer_allocation.guaranteed_layer.ranks.join(", "),
  });
  rows.push({
    セクション: "2層配分",
    項目: "変動層",
    値: spec.two_layer_allocation.variable_layer.ranks.join(", "),
  });
  spec.guarantee_rules.forEach((rule, i) => {
    rows.push({ セクション: "保証ルール", 項目: `rule_${i + 1}`, 値: rule });
  });
  spec.ai_role.responsibilities.forEach((r, i) => {
    rows.push({ セクション: "AIの役割", 項目: `resp_${i + 1}`, 値: r });
  });
  for (const o of spec.outputs) {
    rows.push({ セクション: "出力", 項目: o.path, 値: o.description });
  }
  spec.verification_criteria.forEach((v, i) => {
    rows.push({ セクション: "検証条件", 項目: `criteria_${i + 1}`, 値: v });
  });
  const m = spec.public_marketing_copy;
  rows.push({ セクション: "公開表現", 項目: "primary", 値: m.primary });
  rows.push({ セクション: "公開表現", 項目: "top_creator", 値: m.top_creator });
  rows.push({ セクション: "公開表現", 項目: "elite_creator", 値: m.elite_creator });
  rows.push({ セクション: "公開表現", 項目: "eligibility", 値: m.eligibility });
  rows.push({ セクション: "公開表現", 項目: "disclaimer", 値: m.disclaimer });
  if (spec.verification_last_run) {
    rows.push({
      セクション: "直近検証",
      項目: "summary",
      値: JSON.stringify(spec.verification_last_run),
    });
  }
  return rows;
}
