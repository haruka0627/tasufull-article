/**
 * TLV 収益分配 — 表示・CSV・Dashboard・レポート用コンシューマー
 * 支払額は monthly-payout-decision.json の payout_amount_yen のみ（再計算禁止）
 */
import { FINANCIAL_INTEGRITY_POLICY } from "./tlv-payout-financial.mjs";

export const SOURCE_OF_TRUTH = FINANCIAL_INTEGRITY_POLICY.source_of_truth;
export const CONFIRMED_PAYOUT_FIELD = FINANCIAL_INTEGRITY_POLICY.confirmed_payout_field;

/**
 * @param {object} creator
 * @returns {number}
 */
export function getConfirmedPayoutYen(creator) {
  const yen = creator.payout_amount_yen;
  if (yen == null || !Number.isInteger(yen) || yen < 0) {
    throw new Error(
      `Invalid confirmed payout for ${creator.creator_id}: payout_amount_yen required (integer yen)`
    );
  }
  return yen;
}

/**
 * 表示専用（計算・丸め変更なし）
 * @param {number} yen
 */
export function formatPayoutYenDisplay(yen) {
  if (!Number.isInteger(yen)) {
    throw new Error(`formatPayoutYenDisplay requires integer yen, got ${yen}`);
  }
  return `¥${yen.toLocaleString("ja-JP")}`;
}

/**
 * 禁止パターン検出用（コンシューマー出力に使用してはいけない値）
 * @param {object} creator
 */
export function grossTimesRateYen(creator) {
  return Math.round((creator.gross_revenue * creator.applied_rate) / 100);
}

/**
 * @param {object} decision — monthly-payout-decision.json
 */
export function buildAdminPayoutDisplay(decision) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    confirmed_payout_field: CONFIRMED_PAYOUT_FIELD,
    month: decision.month,
    safety_status: decision.summary.safety_status,
    payout_pool_yen: decision.summary.payout_pool,
    total_payout_yen: decision.summary.total_payout,
    recalculation_prohibited: true,
    creators: decision.creators.map((c) => {
      const payoutYen = getConfirmedPayoutYen(c);
      return {
        creator_id: c.creator_id,
        display_name: c.display_name,
        rank: c.rank,
        gross_revenue_yen: c.gross_revenue,
        base_rate_percent: c.base_rate,
        applied_rate_percent: c.applied_rate,
        payout_amount_yen: payoutYen,
        payout_display: formatPayoutYenDisplay(payoutYen),
        guarantee_applied: c.guarantee_applied,
        adjustment_reason: c.adjustment_reason ?? "",
      };
    }),
  };
}

/**
 * @param {object} decision
 * @param {object} explanation — creator-rank-explanation.json
 */
export function buildCreatorDashboardPayout(decision, explanation) {
  const explainById = new Map(
    (explanation?.creators ?? []).map((c) => [c.creator_id, c])
  );

  return {
    source_of_truth: SOURCE_OF_TRUTH,
    confirmed_payout_field: CONFIRMED_PAYOUT_FIELD,
    month: decision.month,
    next_month: explanation?.next_month ?? null,
    recalculation_prohibited: true,
    dashboard_does_not_recalculate: true,
    creators: decision.creators.map((c) => {
      const payoutYen = getConfirmedPayoutYen(c);
      const ex = explainById.get(c.creator_id);
      return {
        creator_id: c.creator_id,
        display_name: c.display_name,
        rank: c.rank,
        gross_revenue_yen: c.gross_revenue,
        applied_rate_percent: c.applied_rate,
        payout_amount_yen: payoutYen,
        payout_display: formatPayoutYenDisplay(payoutYen),
        rank_explanation: ex?.rank_explanation ?? "",
        payout_explanation: ex?.payout_explanation ?? "",
        adjustment_explanation: ex?.adjustment_explanation ?? "",
        next_month_guidance: ex?.next_month_guidance ?? "",
        payment_notice: ex?.payment_notice ?? "",
        audit: {
          payout_amount_source: SOURCE_OF_TRUTH,
          payout_amount_yen_is_final: true,
          no_display_recalculation: true,
          source_payout_amount_yen: payoutYen,
          no_recalculation: true,
        },
      };
    }),
  };
}

/**
 * @param {object} decision
 * @param {Record<string, string>} [stripeAccountByCreatorId]
 */
export function buildStripeConnectCsvRows(decision, stripeAccountByCreatorId = {}) {
  return decision.creators
    .map((c) => {
      const payoutYen = getConfirmedPayoutYen(c);
      if (payoutYen <= 0) return null;
      return {
        creator_id: c.creator_id,
        creator_name: c.display_name,
        stripe_connect_account_id:
          stripeAccountByCreatorId[c.creator_id] ?? c.stripe_connect_account_id ?? "",
        payout_amount_jpy: payoutYen,
        currency: "jpy",
        description: `TLV ${decision.month} creator revenue share`,
        internal_note: `${c.rank} / applied ${c.applied_rate}% / confirmed yen only`,
        source_of_truth: SOURCE_OF_TRUTH,
      };
    })
    .filter(Boolean);
}

/**
 * @param {object[]} rows
 */
export function stripeConnectCsvString(rows) {
  const header = [
    "creator_id",
    "creator_name",
    "stripe_connect_account_id",
    "payout_amount_jpy",
    "currency",
    "description",
    "internal_note",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.creator_id,
        csvEscape(r.creator_name),
        r.stripe_connect_account_id,
        String(r.payout_amount_jpy),
        r.currency,
        csvEscape(r.description),
        csvEscape(r.internal_note),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {object} decision
 * @param {object} [explanation]
 */
export function buildMonthlyOperatorReport(decision, explanation) {
  const lines = [];
  lines.push(`# TLV 月次運営レポート — ${decision.month}`);
  lines.push("");
  lines.push(`**正本:** \`${SOURCE_OF_TRUTH}\` — 支払額は \`${CONFIRMED_PAYOUT_FIELD}\` の確定値のみ`);
  lines.push("");
  lines.push("## サマリー");
  lines.push("");
  lines.push(`| 項目 | 金額 |`);
  lines.push(`|------|------|`);
  lines.push(`| 総売上 | ${formatPayoutYenDisplay(decision.summary.total_revenue)} |`);
  lines.push(`| 還元プール | ${formatPayoutYenDisplay(decision.summary.payout_pool)} |`);
  lines.push(`| 還元合計 | ${formatPayoutYenDisplay(decision.summary.total_payout)} |`);
  lines.push(`| 会社利益（確定後） | ${formatPayoutYenDisplay(decision.summary.final_company_profit)} |`);
  lines.push(`| 安全判定 | ${decision.summary.safety_status} |`);
  lines.push("");
  lines.push("## Creator 還元（確定支払額）");
  lines.push("");
  lines.push("| Creator | ランク | 適用率 | 確定支払額 (yen) |");
  lines.push("|---------|--------|--------|------------------|");

  const reportAmounts = [];
  for (const c of decision.creators) {
    const payoutYen = getConfirmedPayoutYen(c);
    reportAmounts.push({ creator_id: c.creator_id, payout_amount_yen: payoutYen });
    lines.push(
      `| ${c.display_name} | ${c.rank} | ${c.applied_rate}% | ${formatPayoutYenDisplay(payoutYen)} |`
    );
  }

  lines.push("");
  lines.push(
    "> 本表の支払額は再計算していません。`gross_revenue × applied_rate` は使用していません。"
  );
  lines.push("");
  if (explanation?.platform_safety_status) {
    lines.push(`翌月ガイダンス基準: ${explanation.next_month}（${explanation.next_month_safety_status}）`);
  }
  lines.push("");
  lines.push("*Generated by scripts/generate-payout-outputs.mjs*");

  return {
    markdown: lines.join("\n"),
    report_amounts: reportAmounts,
    source_of_truth: SOURCE_OF_TRUTH,
    recalculation_prohibited: true,
  };
}

/**
 * @param {object} decision
 * @param {object} outputs
 */
export function validateConsumerIntegrity(decision, outputs) {
  const { admin, dashboard, csvRows, report } = outputs;

  const decisionAmounts = new Map(
    decision.creators.map((c) => [c.creator_id, getConfirmedPayoutYen(c)])
  );

  const payoutDisplayUsesDecisionAmount =
    admin.creators.every((c) => c.payout_amount_yen === decisionAmounts.get(c.creator_id)) &&
    dashboard.creators.every((c) => c.payout_amount_yen === decisionAmounts.get(c.creator_id));

  const dashboardMustUsePayoutAmountYen =
    dashboard.dashboard_does_not_recalculate === true &&
    dashboard.recalculation_prohibited === true &&
    dashboard.creators.every(
      (c) =>
        c.audit?.payout_amount_yen_is_final === true &&
        c.audit?.no_display_recalculation === true &&
        c.payout_amount_yen === c.audit?.source_payout_amount_yen
    );

  const csvMustUsePayoutAmountYen = csvRows.every(
    (r) => r.payout_amount_jpy === decisionAmounts.get(r.creator_id)
  );

  const reportMustUsePayoutAmountYen =
    report.recalculation_prohibited === true &&
    report.report_amounts.every(
      (r) => r.payout_amount_yen === decisionAmounts.get(r.creator_id)
    );

  const noGrossTimesRateForPayment = decision.creators.every((c) => {
    const confirmed = getConfirmedPayoutYen(c);
    const adminRow = admin.creators.find((x) => x.creator_id === c.creator_id);
    const dashRow = dashboard.creators.find((x) => x.creator_id === c.creator_id);
    const csvRow = csvRows.find((x) => x.creator_id === c.creator_id);
    const reportRow = report.report_amounts.find((x) => x.creator_id === c.creator_id);
    const grossCalc = grossTimesRateYen(c);

    const outputsUseConfirmed =
      adminRow?.payout_amount_yen === confirmed &&
      dashRow?.payout_amount_yen === confirmed &&
      (!csvRow || csvRow.payout_amount_jpy === confirmed) &&
      reportRow?.payout_amount_yen === confirmed;

    const outputsUseForbiddenGrossCalc =
      adminRow?.payout_amount_yen === grossCalc &&
      grossCalc !== confirmed;

    return outputsUseConfirmed && !outputsUseForbiddenGrossCalc;
  });

  const yenIntegrityPreserved =
    decision.creators.every((c) => Number.isInteger(getConfirmedPayoutYen(c))) &&
    admin.creators.every((c) => Number.isInteger(c.payout_amount_yen)) &&
    dashboard.creators.every((c) => Number.isInteger(c.payout_amount_yen)) &&
    csvRows.every((r) => Number.isInteger(r.payout_amount_jpy)) &&
    decision.creators.reduce((s, c) => s + getConfirmedPayoutYen(c), 0) ===
      decision.summary.total_payout;

  const allPass =
    payoutDisplayUsesDecisionAmount &&
    dashboardMustUsePayoutAmountYen &&
    csvMustUsePayoutAmountYen &&
    reportMustUsePayoutAmountYen &&
    noGrossTimesRateForPayment &&
    yenIntegrityPreserved;

  return {
    payout_display_uses_decision_amount: payoutDisplayUsesDecisionAmount,
    dashboard_must_use_payout_amount_yen: dashboardMustUsePayoutAmountYen,
    csv_must_use_payout_amount_yen: csvMustUsePayoutAmountYen,
    report_must_use_payout_amount_yen: reportMustUsePayoutAmountYen,
    no_gross_times_rate_for_payment: noGrossTimesRateForPayment,
    yen_integrity_preserved: yenIntegrityPreserved,
    all_pass: allPass,
  };
}
