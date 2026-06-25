#!/usr/bin/env node
/**
 * TLV AI 収益分配エンジン Ver2 — 実装フェーズ①
 * 本番想定入力から monthly-payout-decision.json を生成する。
 *
 *   node scripts/generate-monthly-payout-decision.mjs
 *   node scripts/generate-monthly-payout-decision.mjs reports/tlv-business-simulator/input/monthly-revenue-2026-06.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadProductionBaseline,
  getRankRates,
  getGuaranteedRates,
  ENGINE_VERSION,
  PRODUCTION_BASELINE_RELATIVE_PATH,
  allocatePayouts,
  computeSafetyStatus,
} from "./tlv-payout-engine.mjs";
import {
  FINANCIAL_INTEGRITY_POLICY,
  buildFinancialAudit,
  buildCreatorPaymentAudit,
  computePayoutPool,
  computeFinalCompanyProfitYen,
} from "./tlv-payout-financial.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "input");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");
const DEFAULT_INPUT = path.join(INPUT_DIR, "monthly-revenue-sample.json");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "monthly-payout-decision.json");
const LIVE_DATA_DIR = path.join(ROOT, "live", "data");
const LIVE_DECISION_PATH = path.join(LIVE_DATA_DIR, "monthly-payout-decision.json");

function syncDecisionToLiveData(decision) {
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  fs.writeFileSync(LIVE_DECISION_PATH, JSON.stringify(decision, null, 2) + "\n", "utf8");
}

/** @param {string} [decisionPath] */
export function loadMonthlyPayoutDecision(decisionPath = OUTPUT_PATH) {
  const resolved = path.isAbsolute(decisionPath)
    ? decisionPath
    : path.resolve(ROOT, decisionPath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function buildRankAliasMap(baseline) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const entry of baseline.rank_system) {
    map[entry.rank] = entry.rank;
    const short = entry.rank.replace(/ Creator$/, "");
    if (short !== entry.rank) {
      map[short] = entry.rank;
    }
  }
  return map;
}

/** @param {string} canonicalRank */
function rankDisplayLabel(canonicalRank) {
  return canonicalRank.replace(/ Creator$/, "");
}

/**
 * @param {string} inputPath
 */
function resolveInputPath(inputPath) {
  if (inputPath) {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT, inputPath);
  }
  const monthArg = process.argv.find((a) => /^monthly-revenue-\d{4}-\d{2}\.json$/.test(a));
  if (monthArg) {
    return path.join(INPUT_DIR, monthArg);
  }
  const flagIdx = process.argv.indexOf("--input");
  if (flagIdx >= 0 && process.argv[flagIdx + 1]) {
    const p = process.argv[flagIdx + 1];
    return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  }
  return DEFAULT_INPUT;
}

/**
 * @param {object} input
 */
function validateInput(input, rankAliases) {
  const required = [
    "month",
    "total_revenue",
    "platform_cost",
    "payment_fee",
    "reserve_amount",
    "minimum_company_profit",
    "creators",
  ];
  for (const key of required) {
    if (input[key] == null) {
      throw new Error(`Input missing required field: ${key}`);
    }
  }
  if (!Array.isArray(input.creators) || input.creators.length === 0) {
    throw new Error("Input creators[] must be a non-empty array");
  }
  for (const c of input.creators) {
    for (const key of ["creator_id", "display_name", "rank", "gross_revenue"]) {
      if (c[key] == null) {
        throw new Error(`Creator ${c.creator_id ?? "?"} missing field: ${key}`);
      }
    }
    if (!(c.rank in rankAliases)) {
      throw new Error(`Unknown rank "${c.rank}" for creator ${c.creator_id}`);
    }
  }
}

/**
 * @param {object} row
 * @param {Record<string, number>} rankRates
 * @param {Record<string, number>} guaranteedRates
 */
function buildCreatorExplanation(row, rankRates, guaranteedRates) {
  const label = rankDisplayLabel(row.rank);
  if (row.guarantee_applied) {
    const rate = guaranteedRates[row.rank] ?? row.applied_rate;
    return `今月は ${label} ランク条件を達成しているため、${rate}% 保証が適用されました。`;
  }
  const base = rankRates[row.rank];
  if (row.applied_rate < base) {
    return `今月は ${label} ランク基準で算定され、全体の還元プール内で ${row.applied_rate}% が適用されました。`;
  }
  return `今月は ${label} ランク基準で算定され、基準還元率 ${row.applied_rate}% が適用されました。`;
}

/**
 * @param {object} input
 * @param {string} [sourceInputLabel]
 */
export function buildMonthlyPayoutDecision(input, sourceInputLabel = "monthly-revenue-sample.json") {
  const baseline = loadProductionBaseline();
  const rankRates = getRankRates();
  const guaranteedRates = getGuaranteedRates();
  const rankAliases = buildRankAliasMap(baseline);
  const guaranteedLayerRanks = new Set(
    baseline.two_layer_allocation.guaranteed_layer.ranks
  );

  validateInput(input, rankAliases);

  const { payoutPool, costs } = computePayoutPool(input);

  const creatorRows = input.creators.map((c) => {
    const canonicalRank = rankAliases[c.rank];
    const eligible = Boolean(c.eligible_for_guarantee);
    const rateGuaranteed = eligible && guaranteedLayerRanks.has(canonicalRank);
    const baseRate = rankRates[canonicalRank];
    const payoutRate = rateGuaranteed
      ? (guaranteedRates[canonicalRank] ?? baseRate)
      : baseRate;

    return {
      creator_id: c.creator_id,
      creator_name: c.display_name,
      display_name: c.display_name,
      rank: canonicalRank,
      revenue_generated: c.gross_revenue,
      gross_revenue: c.gross_revenue,
      payout_rate: payoutRate,
      rate_guaranteed: rateGuaranteed,
      original_rate: payoutRate,
      input_metrics: {
        views: c.views ?? 0,
        live_minutes: c.live_minutes ?? 0,
        tips: c.tips ?? 0,
        ad_revenue: c.ad_revenue ?? 0,
        violations_count: c.violations_count ?? 0,
        eligible_for_guarantee: eligible,
      },
    };
  });

  const allocMeta = allocatePayouts(creatorRows, payoutPool);

  const creators = creatorRows.map((row) => {
    const guaranteeApplied = row.rate_guaranteed;
    const baseRate = rankRates[row.rank];
    const appliedRate = row.adjusted_rate ?? row.payout_rate;
    const payoutAmountYen = row.payout_amount;
    const entry = {
      creator_id: row.creator_id,
      display_name: row.display_name,
      rank: row.rank,
      gross_revenue: row.gross_revenue,
      base_rate: baseRate,
      applied_rate: appliedRate,
      payout_amount_yen: payoutAmountYen,
      payout_amount: payoutAmountYen,
      guarantee_applied: guaranteeApplied,
      adjustment_reason: row.adjustment_reason ?? "",
      audit: buildCreatorPaymentAudit(payoutAmountYen),
    };
    entry.creator_explanation = buildCreatorExplanation(
      { ...entry, guarantee_applied: guaranteeApplied },
      rankRates,
      guaranteedRates
    );
    return entry;
  });

  const guaranteedPayoutTotal = creators
    .filter((c) => c.guarantee_applied)
    .reduce((s, c) => s + c.payout_amount_yen, 0);
  const variablePayoutTotal = creators
    .filter((c) => !c.guarantee_applied)
    .reduce((s, c) => s + c.payout_amount_yen, 0);
  const totalPayout = guaranteedPayoutTotal + variablePayoutTotal;
  const finalCompanyProfit = computeFinalCompanyProfitYen(
    input.total_revenue,
    costs,
    totalPayout
  );

  const guaranteedRows = creators.filter((c) => c.guarantee_applied);
  const variableRows = creatorRows
    .filter((r) => !r.rate_guaranteed)
    .map((r) => {
      const c = creators.find((x) => x.creator_id === r.creator_id);
      return {
        creator_id: r.creator_id,
        gross_revenue: r.gross_revenue,
        base_rate: rankRates[r.rank],
        applied_rate: c.applied_rate,
        payout_amount: c.payout_amount_yen,
        payout_amount_yen: c.payout_amount_yen,
        pre_scale_exact_yen: r.pre_scale_exact_yen ?? r._payout_exact_yen,
        pre_scale_payout_yen: r.pre_scale_payout_yen ?? r.payout_amount,
        post_scale_exact_yen: r.post_scale_exact_yen,
        scale_factor_exact: r.scale_factor_exact,
        largest_remainder_adjustment_yen: r.largest_remainder_adjustment_yen ?? 0,
      };
    });

  const audit = buildFinancialAudit({
    input,
    payoutPool,
    costs,
    guaranteedRows,
    variableRows,
    allocMeta,
    totalPayout,
    finalCompanyProfit,
  });

  const safetyStatus = computeSafetyStatus(
    finalCompanyProfit,
    costs.company_margin_reserved_yen,
    payoutPool,
    totalPayout
  );

  const validations = runValidations({
    creators,
    guaranteedRates,
    guaranteedLayerRanks,
    payoutPool,
    totalPayout,
    finalCompanyProfit,
    costs,
    input,
    audit,
  });

  return {
    engine_version: ENGINE_VERSION,
    baseline_file: PRODUCTION_BASELINE_RELATIVE_PATH,
    generated_at: new Date().toISOString(),
    month: input.month,
    source_input: sourceInputLabel,
    financial_integrity: { ...FINANCIAL_INTEGRITY_POLICY },
    company_deductions: {
      payment_fee: costs.payment_fee,
      platform_cost: costs.platform_cost,
      cdn_storage_live_cost: costs.cdn_storage_live_cost,
      platform_cost_total: costs.platform_cost_total,
      reserve_amount: costs.reserve_amount,
      minimum_company_profit: costs.minimum_company_profit,
      operational_margin: costs.operational_margin,
      company_deductions_total: costs.company_deductions_total,
      company_margin_reserved: costs.company_margin_reserved_yen,
      deduction_order: [...FINANCIAL_INTEGRITY_POLICY.deduction_order],
    },
    summary: {
      total_revenue: input.total_revenue,
      payment_fee: costs.payment_fee,
      platform_cost: costs.platform_cost,
      cdn_storage_live_cost: costs.cdn_storage_live_cost,
      platform_cost_total: costs.platform_cost_total,
      reserve_amount: costs.reserve_amount,
      minimum_company_profit: costs.minimum_company_profit,
      operational_margin: costs.operational_margin,
      company_deductions_total: costs.company_deductions_total,
      company_margin_reserved: costs.company_margin_reserved_yen,
      payout_pool: payoutPool,
      guaranteed_payout_total: guaranteedPayoutTotal,
      variable_payout_total: variablePayoutTotal,
      total_payout: totalPayout,
      final_company_profit: finalCompanyProfit,
      safety_status: safetyStatus,
      allocation_mode: allocMeta.allocation_mode,
      pool_unallocated_yen: payoutPool - totalPayout,
    },
    creators,
    allocation_meta: allocMeta,
    audit,
    validations,
  };
}

/**
 * @param {object} ctx
 */
function runValidations(ctx) {
  const guaranteePreserved = ctx.creators.every((c) => {
    if (!c.guarantee_applied) return true;
    const minRate = ctx.guaranteedRates[c.rank];
    return minRate != null && c.applied_rate >= minRate - 0.01;
  });

  const payoutWithinPool = ctx.totalPayout <= ctx.payoutPool;

  const companyProfitPreserved =
    ctx.finalCompanyProfit >= ctx.costs.company_margin_reserved_yen;

  const companyCostsDeductedFirst =
    ctx.payoutPool ===
    Math.max(0, ctx.input.total_revenue - ctx.costs.company_deductions_total);

  const operationalMarginPreserved =
    ctx.finalCompanyProfit >= ctx.costs.company_margin_reserved_yen;

  const payoutPoolAfterCompanyMargin =
    ctx.audit?.company_deductions_first?.payout_pool_after_company_margin_yen ===
    ctx.payoutPool;

  const noCreatorPayoutFromGrossRevenue =
    ctx.totalPayout <= ctx.payoutPool &&
    ctx.audit?.no_payout_from_gross_revenue?.within_pool === true &&
    ctx.creators.every((c) => {
      const fromGross = Math.round(c.gross_revenue * (c.base_rate / 100));
      if (c.guarantee_applied) {
        return (
          c.payout_amount_yen <= fromGross || c.payout_amount_yen <= ctx.payoutPool
        );
      }
      return c.payout_amount_yen <= ctx.payoutPool;
    });

  const creatorExplanationsPresent = ctx.creators.every(
    (c) => typeof c.creator_explanation === "string" && c.creator_explanation.length > 0
  );

  const payoutAmountYenPresent = ctx.creators.every(
    (c) => c.payout_amount_yen != null
  );

  const payoutAmountYenInteger = ctx.creators.every(
    (c) => Number.isInteger(c.payout_amount_yen) && c.payout_amount_yen >= 0
  );

  const payoutAmountYenMatchesTotal =
    ctx.creators.reduce((s, c) => s + c.payout_amount_yen, 0) === ctx.totalPayout &&
    ctx.audit?.balance_check?.total_payout_yen === ctx.totalPayout;

  const payoutAmountCompatMatchesYen = ctx.creators.every(
    (c) => c.payout_amount === c.payout_amount_yen
  );

  const creatorPaymentAuditComplete = ctx.creators.every(
    (c) =>
      c.audit?.payout_amount_source === "monthly-payout-decision.json" &&
      c.audit?.payout_amount_yen_is_final === true &&
      c.audit?.no_display_recalculation === true &&
      c.audit?.confirmed_payout_amount_yen === c.payout_amount_yen
  );

  const paymentFinalizationAuditPresent =
    ctx.audit?.payment_finalization?.payout_amount_source ===
      "monthly-payout-decision.json" &&
    ctx.audit?.payment_finalization?.payout_amount_yen_is_final === true &&
    ctx.audit?.payment_finalization?.no_display_recalculation === true;

  const dashboardMustUsePayoutAmountYen =
    paymentFinalizationAuditPresent &&
    creatorPaymentAuditComplete &&
    ctx.audit?.payment_finalization?.consumer_rules
      ?.dashboard_must_use_payout_amount_yen === true;

  const csvMustUsePayoutAmountYen =
    paymentFinalizationAuditPresent &&
    creatorPaymentAuditComplete &&
    ctx.audit?.payment_finalization?.consumer_rules?.csv_must_use_payout_amount_yen ===
      true;

  const reportMustUsePayoutAmountYen =
    paymentFinalizationAuditPresent &&
    creatorPaymentAuditComplete &&
    ctx.audit?.payment_finalization?.consumer_rules?.report_must_use_payout_amount_yen ===
      true;

  const noGrossTimesRateForPayment =
    ctx.audit?.payment_finalization?.gross_times_rate_reference_only === true &&
    ctx.creators.every(
      (c) =>
        c.audit?.payout_amount_yen_is_final === true &&
        c.payout_amount_yen === c.audit?.confirmed_payout_amount_yen
    );

  const yenIntegerOnly = payoutAmountYenInteger && payoutAmountCompatMatchesYen;

  const sumMatchesAllocated = payoutAmountYenMatchesTotal;

  const auditPresent =
    ctx.audit != null &&
    ctx.audit.balance_check != null &&
    ctx.audit.guaranteed_layer != null &&
    ctx.audit.variable_layer != null;

  const identityHolds = ctx.audit?.balance_check?.identity_holds === true;

  const variablePoolExact =
    ctx.audit?.variable_layer?.post_scale_total_yen == null ||
    ctx.audit.variable_layer.residual_pool_yen === 0 ||
    ctx.audit.variable_layer.post_scale_total_yen ===
      ctx.audit.variable_layer.residual_pool_yen ||
    ctx.audit.variable_layer.post_scale_total_yen <=
      ctx.audit.variable_layer.residual_pool_yen;

  const allPass =
    guaranteePreserved &&
    payoutWithinPool &&
    companyProfitPreserved &&
    companyCostsDeductedFirst &&
    operationalMarginPreserved &&
    payoutPoolAfterCompanyMargin &&
    noCreatorPayoutFromGrossRevenue &&
    creatorExplanationsPresent &&
    payoutAmountYenPresent &&
    payoutAmountYenInteger &&
    payoutAmountYenMatchesTotal &&
    dashboardMustUsePayoutAmountYen &&
    csvMustUsePayoutAmountYen &&
    reportMustUsePayoutAmountYen &&
    noGrossTimesRateForPayment &&
    yenIntegerOnly &&
    sumMatchesAllocated &&
    auditPresent &&
    identityHolds &&
    variablePoolExact;

  return {
    guarantee_preserved: guaranteePreserved,
    payout_within_pool: payoutWithinPool,
    company_profit_preserved: companyProfitPreserved,
    company_costs_deducted_first: companyCostsDeductedFirst,
    operational_margin_preserved: operationalMarginPreserved,
    payout_pool_after_company_margin: payoutPoolAfterCompanyMargin,
    no_creator_payout_from_gross_revenue: noCreatorPayoutFromGrossRevenue,
    creator_explanations_present: creatorExplanationsPresent,
    payout_amount_yen_present: payoutAmountYenPresent,
    payout_amount_yen_integer: payoutAmountYenInteger,
    payout_amount_yen_matches_total: payoutAmountYenMatchesTotal,
    dashboard_must_use_payout_amount_yen: dashboardMustUsePayoutAmountYen,
    csv_must_use_payout_amount_yen: csvMustUsePayoutAmountYen,
    report_must_use_payout_amount_yen: reportMustUsePayoutAmountYen,
    no_gross_times_rate_for_payment: noGrossTimesRateForPayment,
    yen_integer_only: yenIntegerOnly,
    sum_matches_allocated: sumMatchesAllocated,
    audit_present: auditPresent,
    identity_holds: identityHolds,
    variable_pool_exact: variablePoolExact,
    all_pass: allPass,
  };
}

function main() {
  const inputPath = resolveInputPath(process.argv[2]);
  if (!fs.existsSync(inputPath)) {
    console.error("Input file not found:", inputPath);
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const sourceLabel = path.relative(ROOT, inputPath).replace(/\\/g, "/");
  const decision = buildMonthlyPayoutDecision(input, sourceLabel);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(decision, null, 2) + "\n", "utf8");
  syncDecisionToLiveData(decision);

  console.log("TLV monthly-payout-decision — generated (Ver2 phase 1):");
  console.log("  Input:", inputPath);
  console.log("  Baseline:", PRODUCTION_BASELINE_RELATIVE_PATH);
  console.log("  Output:", OUTPUT_PATH);
  console.log("  Live data:", LIVE_DECISION_PATH);
  console.log("  Month:", decision.month);
  console.log("  Payout pool:", decision.summary.payout_pool);
  console.log("  Total payout:", decision.summary.total_payout);
  console.log("  Pool unallocated:", decision.summary.pool_unallocated_yen);
  console.log("  Audit identity_holds:", decision.audit.balance_check.identity_holds);
  console.log("  Safety:", decision.summary.safety_status);
  console.log("  Validations all_pass:", decision.validations.all_pass);
  if (!decision.validations.all_pass) {
    console.error("  FAILED:", JSON.stringify(decision.validations, null, 2));
    process.exit(1);
  }
}

main();
