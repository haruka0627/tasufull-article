#!/usr/bin/env node
/**
 * TLV AI 収益分配エンジン Ver2 — 実装フェーズ②
 * monthly-payout-decision.json から翌月条件ライン・安全判定を生成する。
 *
 *   node scripts/generate-condition-lines.mjs
 *   node scripts/generate-condition-lines.mjs path/to/monthly-payout-decision.json
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");
const DEFAULT_SOURCE = path.join(OUTPUT_DIR, "monthly-payout-decision.json");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "condition-lines.json");

const POOL_UTIL_GREEN_MAX = 0.85;
const POOL_UTIL_CAUTION_MIN = 0.92;
const PROFIT_GREEN_MARGIN = 1.15;

/** @param {string} yyyyMm */
function nextCalendarMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rankOutputKey(canonicalRank) {
  return canonicalRank.replace(/ Creator$/, "");
}

function buildRankList(baseline) {
  return baseline.rank_system.map((r) => ({
    outputKey: rankOutputKey(r.rank),
    canonicalRank: r.rank,
    layer: r.layer,
    guaranteed: r.guaranteed,
  }));
}

/**
 * @param {object} payoutDecision
 */
function computePoolUtilization(payoutDecision) {
  const pool = payoutDecision.summary.payout_pool;
  const total = payoutDecision.summary.total_payout;
  if (pool <= 0) return total > 0 ? 1 : 0;
  return total / pool;
}

/**
 * @param {object} payoutDecision
 */
function hasVariableRateReduction(payoutDecision) {
  return payoutDecision.creators.some(
    (c) => !c.guarantee_applied && c.applied_rate < c.base_rate - 0.01
  );
}

/**
 * @param {object} payoutDecision
 * @returns {"GREEN"|"CAUTION"|"RED"}
 */
export function computePhase2SafetyStatus(payoutDecision) {
  const s = payoutDecision.summary;
  const validations = payoutDecision.validations ?? {};

  if (validations.all_pass === false) return "RED";
  if (s.final_company_profit < s.minimum_company_profit - 0.5) return "RED";
  if (s.total_payout > s.payout_pool + 0.5) return "RED";

  const utilization = computePoolUtilization(payoutDecision);
  const profitMargin =
    s.minimum_company_profit > 0
      ? s.final_company_profit / s.minimum_company_profit
      : s.final_company_profit >= 0
        ? 2
        : 0;

  const variableReduced = hasVariableRateReduction(payoutDecision);

  if (
    profitMargin >= PROFIT_GREEN_MARGIN &&
    utilization < POOL_UTIL_GREEN_MAX &&
    !variableReduced
  ) {
    return "GREEN";
  }

  if (
    s.final_company_profit >= s.minimum_company_profit - 0.5 &&
    (utilization >= POOL_UTIL_CAUTION_MIN ||
      variableReduced ||
      profitMargin < PROFIT_GREEN_MARGIN)
  ) {
    return "CAUTION";
  }

  return "CAUTION";
}

/**
 * @param {object} defaults
 * @param {"GREEN"|"CAUTION"|"RED"} safetyStatus
 * @param {object} payoutDecision
 */
function adjustConditionLine(defaults, safetyStatus, payoutDecision, rankMeta) {
  const line = {
    required_monthly_revenue: defaults.min_monthly_revenue ?? 0,
    required_views: defaults.min_views ?? 0,
    required_live_minutes: Math.round((defaults.min_live_hours ?? 0) * 60),
    required_active_days: defaults.min_live_hours > 0 ? 7 : 0,
    max_violations_count: rankMeta.guaranteed ? 0 : 3,
    notes: "",
  };

  if (defaults.min_platform_gross_revenue != null) {
    line.required_platform_gross_revenue = defaults.min_platform_gross_revenue;
  }
  if (defaults.max_slots != null) {
    line.max_slots = defaults.max_slots;
  }

  const totalRevenue = payoutDecision.summary.total_revenue;

  if (safetyStatus === "GREEN") {
    line.notes = "今月の収支に余裕があるため、基準条件を維持します。";
    return line;
  }

  if (safetyStatus === "CAUTION") {
    if (rankMeta.guaranteed) {
      line.required_monthly_revenue = Math.ceil(line.required_monthly_revenue * 1.1);
      if (line.required_platform_gross_revenue != null) {
        line.required_platform_gross_revenue = Math.ceil(
          Math.max(line.required_platform_gross_revenue, totalRevenue * 1.05)
        );
      }
      if (line.max_slots != null && line.max_slots > 0) {
        line.max_slots = Math.max(1, line.max_slots - 1);
      }
      line.notes =
        "残余プール逼迫のため、翌月は特別ランクの達成条件をやや厳格化します（還元率は変更しません）。";
    } else if (rankMeta.outputKey === "Pro") {
      line.required_monthly_revenue = Math.ceil(line.required_monthly_revenue * 1.05);
      line.required_views = Math.ceil(line.required_views * 1.05);
      line.notes =
        "変動層の調整が発生したため、翌月は Pro 到達に必要な収益・視聴をやや引き上げます。";
    } else {
      line.notes = "変動層の調整を踏まえ、翌月も基準条件を維持しつつ収益維持を推奨します。";
    }
    return line;
  }

  // RED
  if (rankMeta.guaranteed) {
    line.required_monthly_revenue = Math.ceil(line.required_monthly_revenue * 1.2);
    if (line.required_platform_gross_revenue != null) {
      line.required_platform_gross_revenue = Math.ceil(totalRevenue * 1.15);
    }
    if (line.max_slots != null) {
      line.max_slots = Math.max(0, line.max_slots - 1);
    }
    line.max_violations_count = 0;
    line.notes =
      "収支リスクのため、翌月は特別ランクの条件ラインを厳格化します（還元率は Production Baseline のまま）。";
  } else {
    line.max_violations_count = 2;
    line.notes = "収支リスクのため、翌月は違反許容を厳格化し、基準維持を優先します。";
  }
  return line;
}

/**
 * @param {object} payoutDecision
 * @param {string} [sourceLabel]
 */
export function buildConditionLinesReport(payoutDecision, sourceLabel) {
  const baseline = loadProductionBaseline();
  const rankRates = getRankRates();
  const guaranteedRates = getGuaranteedRates();
  const defaults = baseline.condition_line_defaults;
  const ranks = buildRankList(baseline);

  const safetyStatus = computePhase2SafetyStatus(payoutDecision);
  const poolUtilization = computePoolUtilization(payoutDecision);
  const nextMonth = nextCalendarMonth(payoutDecision.month);

  /** @type {Record<string, object>} */
  const nextMonthConditionLines = {};

  for (const rankMeta of ranks) {
    const canonical = rankMeta.canonicalRank;
    const baseDefaults = defaults[canonical] ?? {};
    const conditions = adjustConditionLine(
      baseDefaults,
      safetyStatus,
      payoutDecision,
      rankMeta
    );

    nextMonthConditionLines[rankMeta.outputKey] = {
      ...conditions,
      canonical_rank: canonical,
      layer: rankMeta.layer,
      baseline_payout_rate_percent: rankRates[canonical],
      guarantee_rate_percent: rankMeta.guaranteed
        ? guaranteedRates[canonical]
        : null,
      rates_are_read_only: true,
      ai_adjusts: "condition_line_only",
    };
  }

  const aiJudgement = buildAiJudgement(payoutDecision, safetyStatus, poolUtilization);
  const creatorGuidance = buildCreatorGuidance(
    ranks,
    safetyStatus,
    guaranteedRates,
    payoutDecision
  );

  const report = {
    engine_version: ENGINE_VERSION.startsWith("v")
      ? ENGINE_VERSION
      : `v${ENGINE_VERSION.replace(/\.0$/, "")}`,
    baseline_file: PRODUCTION_BASELINE_RELATIVE_PATH,
    generated_at: new Date().toISOString(),
    source_file: sourceLabel,
    source_month: payoutDecision.month,
    month: nextMonth,
    safety_status: safetyStatus,
    summary: {
      total_revenue: payoutDecision.summary.total_revenue,
      payout_pool: payoutDecision.summary.payout_pool,
      total_payout: payoutDecision.summary.total_payout,
      final_company_profit: payoutDecision.summary.final_company_profit,
      minimum_company_profit: payoutDecision.summary.minimum_company_profit,
      pool_utilization_rate: Math.round(poolUtilization * 1000) / 1000,
      guaranteed_payout_total: payoutDecision.summary.guaranteed_payout_total,
      variable_payout_total: payoutDecision.summary.variable_payout_total,
    },
    next_month_condition_lines: nextMonthConditionLines,
    ai_judgement: aiJudgement,
    creator_guidance: creatorGuidance,
    validations: runValidations({
      payoutDecision,
      baseline,
      nextMonthConditionLines,
      rankRates,
      guaranteedRates,
      ranks,
    }),
  };

  return report;
}

function buildAiJudgement(payoutDecision, safetyStatus, poolUtilization) {
  const s = payoutDecision.summary;
  const pct = Math.round(poolUtilization * 100);

  if (safetyStatus === "GREEN") {
    return {
      overall: "安全運営",
      risk_level: "low",
      reason: `還元プール利用率 ${pct}%・会社利益が最低利益を十分上回っています。`,
      recommended_action:
        "翌月も現行の条件ラインを維持し、Creator 成長を継続支援してください。",
    };
  }
  if (safetyStatus === "CAUTION") {
    return {
      overall: "注意",
      risk_level: "medium",
      reason: `還元プール利用率 ${pct}%・変動層の還元調整または利益余裕の薄さが見られます。`,
      recommended_action:
        "還元率は変更せず、特別ランクの条件ラインと Pro 到達基準をやや厳格化してください。",
    };
  }
  return {
    overall: "危険",
    risk_level: "high",
    reason:
      "最低利益未満・プール超過・または月次検証失敗のいずれかが発生しています。",
    recommended_action:
      "還元率は変更せず、条件ラインの厳格化と特別ランク人数上限の見直しを優先してください。",
  };
}

function buildCreatorGuidance(ranks, safetyStatus, guaranteedRates, payoutDecision) {
  const variableReduced = hasVariableRateReduction(payoutDecision);

  return ranks.map((rankMeta) => {
    const key = rankMeta.outputKey;
    let message;

    if (key === "Starter") {
      message =
        safetyStatus === "GREEN"
          ? "今月は安全運営を優先し、次月も通常条件を維持します。"
          : "今月は運営余裕が薄いため、次月も Starter 条件は維持しつつ収益の継続を推奨します。";
    } else if (key === "Creator") {
      message =
        "Creator ランクは変動層です。次月も基準条件を満たし、収益・視聴の維持を心がけてください。";
    } else if (key === "Pro") {
      message = variableReduced
        ? "変動層の調整が発生したため、次月は収益・視聴維持を重視してください。"
        : "Pro ランクは変動層です。基準還元率の適用には残余プールの確保が必要です。";
    } else if (key === "Top") {
      const rate = guaranteedRates[rankMeta.canonicalRank];
      message = `保証対象者は条件達成時に ${rate}% 保証が維持されます。還元率自体は AI では変更しません。`;
    } else if (key === "Elite") {
      const rate = guaranteedRates[rankMeta.canonicalRank];
      message = `保証対象者は条件達成時に ${rate}% 保証が維持されます。還元率自体は AI では変更しません。`;
    } else {
      message = "翌月の条件ラインに沿って活動を継続してください。";
    }

    return {
      rank: key,
      canonical_rank: rankMeta.canonicalRank,
      layer: rankMeta.layer,
      message,
    };
  });
}

function runValidations(ctx) {
  const sourceLoaded =
    ctx.payoutDecision != null &&
    ctx.payoutDecision.summary != null &&
    Array.isArray(ctx.payoutDecision.creators);

  const baselineLoaded =
    ctx.baseline != null &&
    ctx.baseline.rank_system != null &&
    ctx.baseline.condition_line_defaults != null;

  const expectedKeys = ctx.ranks.map((r) => r.outputKey);
  const conditionLinesPresent = expectedKeys.every(
    (k) =>
      ctx.nextMonthConditionLines[k] != null &&
      typeof ctx.nextMonthConditionLines[k].required_monthly_revenue === "number"
  );

  const aiDoesNotChangeRates = expectedKeys.every((k) => {
    const line = ctx.nextMonthConditionLines[k];
    const canonical = line.canonical_rank;
    const expectedBase = ctx.rankRates[canonical];
    const expectedGuarantee = ctx.guaranteedRates[canonical] ?? null;

    if (line.baseline_payout_rate_percent !== expectedBase) return false;
    if (line.guarantee_rate_percent !== expectedGuarantee) return false;
    if (line.ai_adjusts !== "condition_line_only") return false;
    if (line.rates_are_read_only !== true) return false;

    const forbidden = ["applied_rate", "adjusted_rate", "payout_rate_override"];
    return !forbidden.some((f) => f in line);
  });

  const allPass =
    sourceLoaded &&
    baselineLoaded &&
    conditionLinesPresent &&
    aiDoesNotChangeRates;

  return {
    source_loaded: sourceLoaded,
    baseline_loaded: baselineLoaded,
    condition_lines_present: conditionLinesPresent,
    ai_does_not_change_rates: aiDoesNotChangeRates,
    all_pass: allPass,
  };
}

function resolveSourcePath(arg) {
  if (arg) {
    return path.isAbsolute(arg) ? arg : path.resolve(ROOT, arg);
  }
  const flagIdx = process.argv.indexOf("--source");
  if (flagIdx >= 0 && process.argv[flagIdx + 1]) {
    const p = process.argv[flagIdx + 1];
    return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  }
  return DEFAULT_SOURCE;
}

function main() {
  const sourcePath = resolveSourcePath(process.argv[2]);
  if (!fs.existsSync(sourcePath)) {
    console.error("Source file not found:", sourcePath);
    console.error("Run first: node scripts/generate-monthly-payout-decision.mjs");
    process.exit(1);
  }

  const payoutDecision = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const sourceLabel = path.relative(ROOT, sourcePath).replace(/\\/g, "/");
  const report = buildConditionLinesReport(payoutDecision, sourceLabel);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("TLV condition-lines — generated (Ver2 phase 2):");
  console.log("  Source:", sourcePath);
  console.log("  Baseline:", PRODUCTION_BASELINE_RELATIVE_PATH);
  console.log("  Output:", OUTPUT_PATH);
  console.log("  Source month:", report.source_month);
  console.log("  Next month:", report.month);
  console.log("  Safety:", report.safety_status);
  console.log("  Pool utilization:", report.summary.pool_utilization_rate);
  console.log("  Validations all_pass:", report.validations.all_pass);
  if (!report.validations.all_pass) {
    console.error("  FAILED:", JSON.stringify(report.validations, null, 2));
    process.exit(1);
  }
}

main();
