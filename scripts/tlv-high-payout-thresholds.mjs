/**
 * Ver2: 高還元「条件ライン」逆算（70% Top Creator / 80% Elite Creator）
 */
import {
  RANK_RATES,
  RANK_ORDER,
  BASE_CONDITION_LINES,
  computeFinancialSummary,
  buildRankProgressReport,
  PHILOSOPHY,
} from "./tlv-payout-engine.mjs";

export const HIGH_PAYOUT_TARGET_RATES = [60, 65, 70, 75, 80];

/**
 * @param {object} inputs
 */
export function buildCostModel(inputs) {
  const gross = inputs.total_ad_revenue || 1;
  const stripeRate = inputs.stripe_fee / gross;
  const fixedCosts =
    inputs.cloudflare_cost + inputs.ai_cost + inputs.fixed_operation_cost;
  const reserveTotal =
    inputs.tax_reserve + inputs.development_reserve + inputs.emergency_reserve;
  const requiredCompanyKeep = inputs.minimum_company_profit + reserveTotal;

  return {
    stripeRate,
    fixedCosts,
    reserveTotal,
    minimumCompanyProfit: inputs.minimum_company_profit,
    requiredCompanyKeep,
    taxReserve: inputs.tax_reserve,
    developmentReserve: inputs.development_reserve,
    emergencyReserve: inputs.emergency_reserve,
  };
}

export function grossRevenueForPayoutPool(requiredPool, costModel) {
  const denom = 1 - costModel.stripeRate;
  if (denom <= 0) return Infinity;
  return Math.ceil((requiredPool + costModel.fixedCosts + costModel.requiredCompanyKeep) / denom);
}

export function payoutPoolAtGross(gross, costModel) {
  return Math.max(
    0,
    gross * (1 - costModel.stripeRate) - costModel.fixedCosts - costModel.requiredCompanyKeep
  );
}

function payoutForRosterAtNormalRanks(creators) {
  return creators.reduce((sum, c) => {
    let rank = "Starter";
    if (c.monthly_revenue >= 15_000) rank = "Pro";
    else if (c.monthly_revenue >= 3_000) rank = "Creator";
    return sum + Math.round(c.monthly_revenue * (RANK_RATES[rank] / 100));
  }, 0);
}

function payoutWithNSpecial(nTop, nElite, creators) {
  const sorted = [...creators].sort((a, b) => b.monthly_revenue - a.monthly_revenue);
  const elite = sorted.slice(0, nElite);
  const top = sorted.slice(nElite, nElite + nTop);
  const specialIds = new Set([...elite, ...top].map((c) => c.creator_id));

  let total = 0;
  for (const c of elite) total += Math.round(c.monthly_revenue * 0.8);
  for (const c of top) total += Math.round(c.monthly_revenue * 0.7);
  for (const c of creators) {
    if (specialIds.has(c.creator_id)) continue;
    let rank = "Starter";
    if (c.monthly_revenue >= 15_000) rank = "Pro";
    else if (c.monthly_revenue >= 3_000) rank = "Creator";
    total += Math.round(c.monthly_revenue * (RANK_RATES[rank] / 100));
  }
  return total;
}

/**
 * @param {object} inputs
 * @param {object[]} creators
 * @param {object} payoutDecision
 */
export function runHighPayoutThresholdAnalysis(inputs, creators, payoutDecision) {
  const costModel = buildCostModel(inputs);
  const cl = payoutDecision.condition_lines;
  const rankReport = buildRankProgressReport(payoutDecision);

  const thresholds = [
    analyzeProRate(60, creators, costModel, payoutDecision),
    analyzeProRate(65, creators, costModel, payoutDecision),
    analyzeSpecialRate(70, "Top Creator", creators, costModel, payoutDecision, cl),
    analyzeSpecialRate(75, "Pro", creators, costModel, payoutDecision, cl),
    analyzeSpecialRate(80, "Elite Creator", creators, costModel, payoutDecision, cl),
  ];

  return {
    engine_version: "2.0",
    generated_at: new Date().toISOString().slice(0, 10),
    philosophy: PHILOSOPHY,
    reference_month: {
      month: payoutDecision.month,
      gross_revenue: payoutDecision.gross_revenue,
      payout_pool: payoutDecision.payout_pool,
      safety_status: payoutDecision.safety_status,
      max_platform_payout_rate: payoutDecision.max_platform_payout_rate,
      highest_actual_rate: Math.max(...payoutDecision.creator_payouts.map((p) => p.payout_rate), 0),
      top_creator_count: payoutDecision.creator_payouts.filter((p) => p.rank === "Top Creator").length,
      elite_creator_count: payoutDecision.creator_payouts.filter((p) => p.rank === "Elite Creator").length,
      why_70_not_applied: explainWhyNotSpecial(payoutDecision, 70, "Top Creator"),
      why_80_not_applied: explainWhyNotSpecial(payoutDecision, 80, "Elite Creator"),
    },
    condition_lines: cl,
    rank_conditions: RANK_ORDER.map((rank) => ({
      rank,
      payout_rate: RANK_RATES[rank],
      conditions: cl.ranks[rank],
      rate_guaranteed_on_achievement: rank === "Top Creator" || rank === "Elite Creator",
    })),
    rank_progress: rankReport.creators,
    headcount_simulation: payoutDecision.headcount_simulation,
    cost_assumptions: {
      stripe_rate: costModel.stripeRate,
      fixed_costs_ex_stripe: costModel.fixedCosts,
      required_company_keep: costModel.requiredCompanyKeep,
    },
    safety_principle:
      "最低利益・税金積立・開発積立・緊急予備費を確保した後にのみ高還元条件ラインを開放",
    lp_copy: {
      public_wording: "成果に応じた段階制の収益還元",
      top_creator: "Top Creator は最大70%（条件達成者のみ・達成後は保証）",
      elite_creator: "Elite Creator は最大80%も可能（条件達成者のみ・達成後は保証）",
      always: "還元率は月次収支・運営コスト・貢献度に基づき算出。毎月固定○%はありません。",
      ai_role: "AI が毎月変更するのは還元率ではなく「条件ライン」",
    },
    thresholds,
  };
}

function explainWhyNotSpecial(payoutDecision, rate, rankName) {
  const reasons = [];
  const qualified = payoutDecision.creator_payouts.filter((p) => p.rank === rankName);
  if (qualified.length === 0) {
    reasons.push(`${rankName} 条件未達 — 条件ラインは output/condition-lines.json を参照`);
    const cond = payoutDecision.condition_lines.ranks[rankName];
    reasons.push(
      `個人発生収益 ¥${cond.min_monthly_revenue.toLocaleString("ja-JP")} 以上 / プラットフォーム総収益 ¥${cond.min_platform_gross_revenue.toLocaleString("ja-JP")} 以上が必要`
    );
    reasons.push(
      `今月の還元プール ¥${payoutDecision.payout_pool.toLocaleString("ja-JP")} — Top 最大 ${payoutDecision.headcount_simulation.top_creator_max_affordable} 名 / Elite 最大 ${payoutDecision.headcount_simulation.elite_max_affordable} 名まで収容可能`
    );
  } else {
    for (const q of qualified) {
      if (q.payout_rate >= rate && q.rate_guaranteed) {
        reasons.push(`${q.creator_name}: ${rate}% 条件達成・保証適用中`);
      }
    }
  }
  return reasons;
}

function analyzeProRate(targetRate, creators, costModel, payoutDecision) {
  const normalPool = payoutForRosterAtNormalRanks(creators);
  const requiredGross = grossRevenueForPayoutPool(normalPool, costModel);
  return buildThresholdRow({
    target_rate: targetRate,
    applies_to: "Pro / Creator（一般ランク）",
    label: `一般ランク上限付近（${targetRate}%）`,
    required_pool: normalPool,
    required_gross: requiredGross,
    costModel,
    payoutDecision,
    max_creators: creators.length,
  });
}

function analyzeSpecialRate(targetRate, rankName, creators, costModel, payoutDecision, cl) {
  const n = rankName === "Elite Creator" ? 1 : 1;
  const nElite = rankName === "Elite Creator" ? n : 0;
  const nTop = rankName === "Top Creator" ? n : 0;
  const requiredPool = payoutWithNSpecial(nTop, nElite, creators);
  const requiredGross = grossRevenueForPayoutPool(requiredPool, costModel);
  const poolAtGross = payoutPoolAtGross(payoutDecision.gross_revenue, costModel);

  let maxAtCurrent = 0;
  const maxSlots = rankName === "Elite Creator" ? 2 : 5;
  for (let i = 1; i <= maxSlots; i++) {
    const need =
      rankName === "Elite Creator"
        ? payoutWithNSpecial(0, i, creators)
        : payoutWithNSpecial(i, 0, creators);
    if (need <= poolAtGross + 1) maxAtCurrent = i;
    else break;
  }

  const multiPool =
    rankName === "Elite Creator"
      ? payoutWithNSpecial(0, Math.min(2, maxAtCurrent || 1), creators)
      : payoutWithNSpecial(Math.min(3, maxAtCurrent || 1), 0, creators);

  return {
    ...buildThresholdRow({
      target_rate: targetRate,
      applies_to: rankName,
      label: `${rankName}（${targetRate}% 保証）`,
      required_pool: requiredPool,
      required_gross: requiredGross,
      costModel,
      payoutDecision,
      max_creators: maxAtCurrent,
    }),
    condition_line: cl.ranks[rankName],
    top_contributor_one: {
      description: `${rankName} 1人に ${targetRate}% 保証適用`,
      required_payout_pool: requiredPool,
      required_monthly_gross_revenue: requiredGross,
      min_creator_monthly_revenue: cl.ranks[rankName].min_monthly_revenue,
    },
    top_contributor_multiple: {
      description: `${rankName} 複数人に ${targetRate}% 保証`,
      required_payout_pool: multiPool,
      required_monthly_gross_revenue: grossRevenueForPayoutPool(multiPool, costModel),
      max_affordable_at_reference_gross: maxAtCurrent,
    },
    guarantee_rule: "条件達成月は AI 都合で還元率を下げない（保証）",
  };
}

function buildThresholdRow(ctx) {
  const { target_rate, applies_to, label, required_pool, required_gross, costModel, payoutDecision, max_creators } = ctx;
  const currentPool = payoutDecision.payout_pool;
  const achievable = currentPool >= required_pool;
  const why_not = [];
  if (!achievable) {
    why_not.push(`還元プール不足: 現状 ¥${currentPool.toLocaleString("ja-JP")} / 必要 ¥${required_pool.toLocaleString("ja-JP")}`);
    why_not.push(`必要月間総収益: ¥${required_gross.toLocaleString("ja-JP")}（差額 +¥${Math.max(0, required_gross - payoutDecision.gross_revenue).toLocaleString("ja-JP")}）`);
    why_not.push("予備費・最低利益確保後の原資が不足");
  }

  return {
    target_rate,
    applies_to_tier: applies_to,
    label,
    required_monthly_gross_revenue: required_gross,
    required_payout_pool: required_pool,
    required_profit_before_payout: required_gross - costModel.fixedCosts - Math.round(required_gross * costModel.stripeRate),
    company_keep_amount: costModel.requiredCompanyKeep,
    max_creators_at_target_rate: max_creators,
    current_month: {
      achievable,
      revenue_gap: Math.max(0, required_gross - payoutDecision.gross_revenue),
      why_not,
    },
    lp_copy: lpForRate(target_rate, required_gross, achievable),
  };
}

function lpForRate(rate, gross, achievable) {
  const man = (gross / 10_000).toFixed(0);
  if (rate === 70) {
    return {
      headline: "Top Creator は最大70%（条件達成者のみ）",
      body: `月間総収益 約${man}万円規模・個人高収益が目安。達成後は70%保証。`,
      note: achievable ? undefined : "参考月は未達 — 条件ラインは収支に応じて AI が調整",
    };
  }
  if (rate === 80) {
    return {
      headline: "Elite Creator は最大80%も可能（条件達成者のみ）",
      body: `月間総収益 約${man}万円以上・極少数向け。達成後は80%保証。`,
      note: achievable ? undefined : "参考月は未達",
    };
  }
  return {
    headline: "成果に応じた段階制の収益還元",
    body: `一般ランクは ${rate}% 付近。全員同一還元率はありません。`,
  };
}

export function formatThresholdMarkdown(analysis) {
  const lines = [];
  lines.push("# インフルエンサー向け高還元条件 — 逆算レポート（Ver2）");
  lines.push("");
  lines.push("> AI は還元率ではなく **条件ライン** を毎月調整。Top/Elite 条件達成者の還元率は **保証**（引き下げなし）。");
  lines.push("");
  lines.push(`**参照月:** ${analysis.reference_month.month}`);
  lines.push(`**最高実効還元率:** ${analysis.reference_month.highest_actual_rate}%`);
  lines.push(`**会社利益維持時の最大還元率（加重）:** ${analysis.reference_month.max_platform_payout_rate}%`);
  lines.push("");
  lines.push("## 各ランク条件");
  lines.push("");
  lines.push("| ランク | 還元率 | 発生収益目安 | 保証 |");
  lines.push("|--------|--------|-------------|------|");
  for (const r of analysis.rank_conditions) {
    lines.push(
      `| ${r.rank} | ${r.payout_rate}% | ¥${r.conditions.min_monthly_revenue.toLocaleString("ja-JP")}〜 | ${r.rate_guaranteed_on_achievement ? "達成後保証" : "—"} |`
    );
  }
  lines.push("");
  lines.push("## 70% / 80% 到達条件");
  lines.push("");
  const t70 = analysis.thresholds.find((t) => t.target_rate === 70);
  const t80 = analysis.thresholds.find((t) => t.target_rate === 80);
  if (t70) {
    lines.push(`### 70%（Top Creator）`);
    lines.push(`- 必要総収益: **¥${t70.required_monthly_gross_revenue.toLocaleString("ja-JP")}**`);
    lines.push(`- 個人発生収益: ¥${t70.condition_line?.min_monthly_revenue?.toLocaleString("ja-JP") ?? "—"} 以上`);
    lines.push(`- 今月適用可能人数: 最大 ${analysis.headcount_simulation.top_creator_max_affordable} 名`);
    lines.push("");
  }
  if (t80) {
    lines.push(`### 80%（Elite Creator）`);
    lines.push(`- 必要総収益: **¥${t80.required_monthly_gross_revenue.toLocaleString("ja-JP")}**`);
    lines.push(`- 個人発生収益: ¥${t80.condition_line?.min_monthly_revenue?.toLocaleString("ja-JP") ?? "—"} 以上`);
    lines.push(`- 今月適用可能人数: 最大 ${analysis.headcount_simulation.elite_max_affordable} 名`);
    lines.push("");
  }
  lines.push("## 目標還元率別 — 必要売上ライン");
  lines.push("");
  for (const t of analysis.thresholds) {
    lines.push(`### ${t.target_rate}% — ${t.label}`);
    lines.push(`- 必要月間総収益: **¥${t.required_monthly_gross_revenue.toLocaleString("ja-JP")}**`);
    lines.push(`- 必要還元プール: ¥${t.required_payout_pool.toLocaleString("ja-JP")}`);
    lines.push(`- 参照月: ${t.current_month.achievable ? "達成可能" : "未達"}`);
    lines.push("");
  }
  lines.push("## あといくらで次ランクか（参照月）");
  lines.push("");
  for (const c of analysis.rank_progress) {
    lines.push(`- **${c.creator_name}**（${c.rank}）→ ${c.next_rank ?? "最高"}: ${c.gap_message}`);
  }
  lines.push("");
  lines.push("## 広告・LP 用");
  lines.push(`- ${analysis.lp_copy.public_wording}`);
  lines.push(`- ${analysis.lp_copy.top_creator}`);
  lines.push(`- ${analysis.lp_copy.elite_creator}`);
  lines.push(`- ${analysis.lp_copy.ai_role}`);
  lines.push("");
  lines.push("*Generated by scripts/generate-tlv-business-simulator.mjs*");
  return lines.join("\n");
}

// Ver1 互換スタブ
export const TARGET_RATE_SPECS = {};
