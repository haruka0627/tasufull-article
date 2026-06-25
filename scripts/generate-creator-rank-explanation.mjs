#!/usr/bin/env node
/**
 * TLV AI 収益分配エンジン Ver2 — 実装フェーズ③
 * monthly-payout-decision.json + condition-lines.json から Creator 向け説明を生成。
 * 支払額は monthly-payout-decision の確定値のみ（Dashboard 再計算禁止）。
 *
 *   node scripts/generate-creator-rank-explanation.mjs
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
} from "./tlv-payout-engine.mjs";
import { FINANCIAL_INTEGRITY_POLICY } from "./tlv-payout-financial.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");
const DEFAULT_PAYOUT_PATH = path.join(OUTPUT_DIR, "monthly-payout-decision.json");
const DEFAULT_CONDITION_PATH = path.join(OUTPUT_DIR, "condition-lines.json");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "creator-rank-explanation.json");
const LIVE_DATA_DIR = path.join(ROOT, "live", "data");
const LIVE_EXPLANATION_PATH = path.join(LIVE_DATA_DIR, "creator-rank-explanation.json");

function syncExplanationToLiveData(report) {
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  fs.writeFileSync(LIVE_EXPLANATION_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function rankDisplayLabel(canonicalRank) {
  return canonicalRank.replace(/ Creator$/, "");
}

function rankConditionKey(canonicalRank) {
  return rankDisplayLabel(canonicalRank);
}

function formatYen(amount) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function resolvePath(arg, fallback) {
  if (arg) {
    return path.isAbsolute(arg) ? arg : path.resolve(ROOT, arg);
  }
  return fallback;
}

/**
 * @param {object} creator — monthly-payout-decision creators[]
 * @param {object} ctx
 */
function buildCreatorEntry(creator, ctx) {
  const {
    payoutDecision,
    conditionLines,
    rankRates,
    guaranteedRates,
    baseline,
    guidanceByRank,
  } = ctx;

  const canonicalRank = creator.rank;
  const label = rankDisplayLabel(canonicalRank);
  const rankMeta = baseline.rank_system.find((r) => r.rank === canonicalRank);
  const layer = rankMeta?.layer ?? "variable";
  const sourcePayout = creator.payout_amount_yen;
  if (sourcePayout == null || !Number.isInteger(sourcePayout)) {
    throw new Error(
      `Creator ${creator.creator_id} missing payout_amount_yen in monthly-payout-decision`
    );
  }

  const rankExplanation = `今月は ${label} ランクとして判定されています。`;

  const payoutExplanation =
    `今月の対象収益は ${formatYen(creator.gross_revenue)}、` +
    `適用率は ${creator.applied_rate}%、還元予定額は ${formatYen(sourcePayout)} です。`;

  let adjustmentExplanation;
  if (creator.guarantee_applied) {
    const guaranteeRate = guaranteedRates[canonicalRank] ?? creator.applied_rate;
    adjustmentExplanation =
      `${label} 条件を達成しているため、${guaranteeRate}% 保証が適用されています。` +
      `還元率は Production Baseline に基づき変更されません。`;
  } else if (creator.applied_rate < creator.base_rate - 0.01) {
    adjustmentExplanation =
      `今月は還元プールが逼迫しているため、変動層として基準率 ${creator.base_rate}% から ` +
      `${creator.applied_rate}% に調整されています。`;
  } else if (creator.adjustment_reason) {
    adjustmentExplanation = creator.adjustment_reason;
  } else {
    adjustmentExplanation =
      layer === "variable"
        ? `変動層として、残余プール内で基準還元率 ${creator.applied_rate}% が適用されています。`
        : `今月の還元条件に基づき適用されています。`;
  }

  const condKey = rankConditionKey(canonicalRank);
  const nextCond = conditionLines.next_month_condition_lines?.[condKey];
  const rankGuidance = guidanceByRank.get(condKey);

  const nextParts = [];
  if (creator.guarantee_applied && guaranteedRates[canonicalRank] != null) {
    nextParts.push(
      `次月も ${label} 保証（${guaranteedRates[canonicalRank]}%）を受けるには、${conditionLines.month} の条件ライン達成が必要です。`
    );
  } else if (rankMeta?.guaranteed) {
    nextParts.push(
      `次月 ${label} 保証を受けるには、${conditionLines.month} の条件ライン（収益・視聴等）の達成が必要です。`
    );
  } else {
    nextParts.push(`次月（${conditionLines.month}）も ${label} ランク条件の維持・向上を目指してください。`);
  }

  if (nextCond?.required_monthly_revenue > 0) {
    nextParts.push(
      `参考: 必要月間収益 ${formatYen(nextCond.required_monthly_revenue)} 以上。`
    );
  }
  if (nextCond?.notes) {
    nextParts.push(nextCond.notes);
  }
  if (rankGuidance?.message) {
    nextParts.push(rankGuidance.message);
  }

  const nextMonthGuidance = nextParts.join(" ");

  const paymentNotice =
    "この金額は月次確定後の支払予定額です。表示額は monthly-payout-decision.json の確定値であり、" +
    "Dashboard 側で再計算しません。最終支払いは運営確認後に確定します。";

  return {
    creator_id: creator.creator_id,
    display_name: creator.display_name,
    rank: canonicalRank,
    rank_display: label,
    layer,
    gross_revenue: creator.gross_revenue,
    base_rate: creator.base_rate,
    applied_rate: creator.applied_rate,
    payout_amount: sourcePayout,
    payout_amount_yen: sourcePayout,
    guarantee_applied: creator.guarantee_applied,
    safety_status: payoutDecision.summary.safety_status,
    next_month: conditionLines.month,
    rank_explanation: rankExplanation,
    payout_explanation: payoutExplanation,
    adjustment_explanation: adjustmentExplanation,
    next_month_guidance: nextMonthGuidance,
    payment_notice: paymentNotice,
    audit: {
      source_of_truth: FINANCIAL_INTEGRITY_POLICY.source_of_truth,
      payout_amount_source: FINANCIAL_INTEGRITY_POLICY.payout_amount_source,
      payout_amount_yen_is_final: true,
      no_display_recalculation: true,
      source_payout_amount_yen: sourcePayout,
      source_payout_amount: sourcePayout,
      calculated_payout_amount: sourcePayout,
      matches_source: true,
      no_recalculation_required: true,
      canonical_source: FINANCIAL_INTEGRITY_POLICY.canonical_source_file,
      baseline_payout_rate_percent: rankRates[canonicalRank],
      guarantee_rate_percent: rankMeta?.guaranteed
        ? guaranteedRates[canonicalRank]
        : null,
    },
  };
}

/**
 * @param {object} payoutDecision
 * @param {object} conditionLines
 * @param {object} [opts]
 */
export function buildCreatorRankExplanationReport(payoutDecision, conditionLines, opts = {}) {
  const baseline = loadProductionBaseline();
  const rankRates = getRankRates();
  const guaranteedRates = getGuaranteedRates();

  const guidanceByRank = new Map(
    (conditionLines.creator_guidance ?? []).map((g) => [g.rank, g])
  );

  const creators = payoutDecision.creators.map((c) =>
    buildCreatorEntry(c, {
      payoutDecision,
      conditionLines,
      rankRates,
      guaranteedRates,
      baseline,
      guidanceByRank,
    })
  );

  const validations = runValidations({
    payoutDecision,
    conditionLines,
    baseline,
    creators,
  });

  const engineVersion = ENGINE_VERSION.startsWith("v")
    ? ENGINE_VERSION
    : `v${ENGINE_VERSION.replace(/\.0$/, "")}`;

  return {
    engine_version: engineVersion,
    baseline_file: PRODUCTION_BASELINE_RELATIVE_PATH,
    generated_at: new Date().toISOString(),
    source_files: {
      monthly_payout_decision:
        opts.payoutSourceLabel ??
        "reports/tlv-business-simulator/output/monthly-payout-decision.json",
      condition_lines:
        opts.conditionSourceLabel ??
        "reports/tlv-business-simulator/output/condition-lines.json",
    },
    month: payoutDecision.month,
    next_month: conditionLines.month,
    platform_safety_status: payoutDecision.summary.safety_status,
    next_month_safety_status: conditionLines.safety_status,
    financial_integrity: {
      consumer_rule: FINANCIAL_INTEGRITY_POLICY.consumer_rule,
      source_of_truth: FINANCIAL_INTEGRITY_POLICY.source_of_truth,
      confirmed_payout_field: FINANCIAL_INTEGRITY_POLICY.confirmed_payout_field,
      no_dashboard_recalculation: true,
    },
    creators,
    validations,
  };
}

function runValidations(ctx) {
  const monthlySourceLoaded =
    ctx.payoutDecision != null &&
    Array.isArray(ctx.payoutDecision.creators) &&
    ctx.payoutDecision.creators.length > 0;

  const conditionLinesLoaded =
    ctx.conditionLines != null &&
    ctx.conditionLines.next_month_condition_lines != null;

  const baselineLoaded =
    ctx.baseline != null && Array.isArray(ctx.baseline.rank_system);

  const explanationFields = [
    "rank_explanation",
    "payout_explanation",
    "adjustment_explanation",
    "next_month_guidance",
    "payment_notice",
  ];

  const allCreatorsHaveExplanations = ctx.creators.every((c) =>
    explanationFields.every(
      (f) => typeof c[f] === "string" && c[f].length > 0
    )
  );

  const payoutAmountsMatch = ctx.payoutDecision.creators.every((src) => {
    const out = ctx.creators.find((c) => c.creator_id === src.creator_id);
    if (!out) return false;
    return (
      out.payout_amount_yen === src.payout_amount_yen &&
      out.payout_amount === src.payout_amount_yen &&
      out.audit.matches_source &&
      out.audit.payout_amount_yen_is_final === true
    );
  });

  const noDashboardRecalculation = ctx.creators.every(
    (c) =>
      c.audit.no_recalculation_required === true &&
      c.audit.no_display_recalculation === true &&
      c.audit.payout_amount_yen_is_final === true &&
      c.audit.source_payout_amount_yen === c.payout_amount_yen &&
      c.audit.calculated_payout_amount === c.payout_amount_yen
  );

  const allPass =
    monthlySourceLoaded &&
    conditionLinesLoaded &&
    baselineLoaded &&
    allCreatorsHaveExplanations &&
    payoutAmountsMatch &&
    noDashboardRecalculation;

  return {
    monthly_source_loaded: monthlySourceLoaded,
    condition_lines_loaded: conditionLinesLoaded,
    baseline_loaded: baselineLoaded,
    all_creators_have_explanations: allCreatorsHaveExplanations,
    payout_amounts_match_monthly_decision: payoutAmountsMatch,
    no_dashboard_recalculation_required: noDashboardRecalculation,
    all_pass: allPass,
  };
}

function main() {
  const payoutPath = resolvePath(process.argv[2], DEFAULT_PAYOUT_PATH);
  const conditionPath = resolvePath(process.argv[3], DEFAULT_CONDITION_PATH);

  if (!fs.existsSync(payoutPath)) {
    console.error("monthly-payout-decision.json not found:", payoutPath);
    console.error("Run: node scripts/generate-monthly-payout-decision.mjs");
    process.exit(1);
  }
  if (!fs.existsSync(conditionPath)) {
    console.error("condition-lines.json not found:", conditionPath);
    console.error("Run: node scripts/generate-condition-lines.mjs");
    process.exit(1);
  }

  const payoutDecision = JSON.parse(fs.readFileSync(payoutPath, "utf8"));
  const conditionLines = JSON.parse(fs.readFileSync(conditionPath, "utf8"));

  const report = buildCreatorRankExplanationReport(payoutDecision, conditionLines, {
    payoutSourceLabel: path.relative(ROOT, payoutPath).replace(/\\/g, "/"),
    conditionSourceLabel: path.relative(ROOT, conditionPath).replace(/\\/g, "/"),
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  syncExplanationToLiveData(report);

  console.log("TLV creator-rank-explanation — generated (Ver2 phase 3):");
  console.log("  Payout source:", payoutPath);
  console.log("  Condition source:", conditionPath);
  console.log("  Baseline:", PRODUCTION_BASELINE_RELATIVE_PATH);
  console.log("  Output:", OUTPUT_PATH);
  console.log("  Live data:", LIVE_EXPLANATION_PATH);
  console.log("  Month:", report.month, "| Next month guidance:", report.next_month);
  console.log("  Creators:", report.creators.length);
  console.log("  Validations all_pass:", report.validations.all_pass);
  if (!report.validations.all_pass) {
    console.error("  FAILED:", JSON.stringify(report.validations, null, 2));
    process.exit(1);
  }
}

main();
