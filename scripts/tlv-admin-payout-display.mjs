/**
 * TLV 管理画面 — 月次還元一覧（表示専用・再計算禁止）
 * SSOT: monthly-payout-decision.json（payout_amount_yen）
 */
import fs from "node:fs";
import path from "node:path";

export const LIVE_MONTHLY_DECISION_RELATIVE = "live/data/monthly-payout-decision.json";
export const LIVE_CREATOR_EXPLANATION_RELATIVE = "live/data/creator-rank-explanation.json";

export const OUTPUT_MONTHLY_DECISION_RELATIVE =
  "reports/tlv-business-simulator/output/monthly-payout-decision.json";
export const OUTPUT_CREATOR_EXPLANATION_RELATIVE =
  "reports/tlv-business-simulator/output/creator-rank-explanation.json";

export const FORBIDDEN_ADMIN_PAYOUT_PATTERNS = [
  /\bgross_revenue\s*\*/,
  /\*\s*applied_rate\b/,
  /\bapplied_rate\s*\*/,
  /Math\.round\s*\(/,
  /Math\.floor\s*\(/,
  /Math\.ceil\s*\(/,
  /\*\s*100\s*\)/,
  /\/\s*100\b/,
  /\bgrossTimesRate/i,
];

/**
 * @param {number} yen
 */
export function formatConfirmedYenDisplay(yen) {
  if (!Number.isInteger(yen) || yen < 0) {
    throw new Error(`formatConfirmedYenDisplay requires non-negative integer yen, got ${yen}`);
  }
  return `¥${yen.toLocaleString("ja-JP")}`;
}

/**
 * @param {string} value
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} [audit]
 */
export function formatAuditStatus(audit) {
  if (!audit) return "—";
  if (audit.payout_amount_yen_is_final === true && audit.no_display_recalculation === true) {
    return "OK";
  }
  return "CHECK";
}

/**
 * @param {object} decision
 * @param {object} explanation
 */
export function mergeAdminPayoutRows(decision, explanation) {
  const explainById = new Map(
    (explanation?.creators ?? []).map((c) => [c.creator_id, c])
  );

  return (decision?.creators ?? []).map((d) => {
    const ex = explainById.get(d.creator_id) ?? {};
    const payoutAmountYen = ex.payout_amount_yen ?? d.payout_amount_yen;
    return {
      creator_id: d.creator_id,
      display_name: ex.display_name ?? d.display_name,
      rank: ex.rank ?? d.rank,
      gross_revenue: ex.gross_revenue ?? d.gross_revenue,
      applied_rate: ex.applied_rate ?? d.applied_rate,
      payout_amount_yen: payoutAmountYen,
      guarantee_applied: ex.guarantee_applied ?? d.guarantee_applied,
      adjustment_reason: d.adjustment_reason ?? "",
      adjustment_explanation: ex.adjustment_explanation ?? d.adjustment_reason ?? "",
      payment_notice: ex.payment_notice ?? "",
      safety_status: ex.safety_status ?? decision.summary?.safety_status ?? "",
      audit_status: formatAuditStatus(d.audit),
    };
  });
}

/**
 * @param {object} decision
 */
export function buildAdminSummaryView(decision) {
  const s = decision.summary ?? {};
  return {
    month: decision.month,
    total_revenue: s.total_revenue,
    total_cost: (s.payment_fee ?? 0) + (s.platform_cost_total ?? 0),
    company_deductions: s.company_deductions_total,
    payout_pool: s.payout_pool,
    guaranteed_payout_total: s.guaranteed_payout_total,
    variable_payout_total: s.variable_payout_total,
    total_payout: s.total_payout,
    final_company_profit: s.final_company_profit,
    safety_status: s.safety_status,
    validations_all_pass: decision.validations?.all_pass === true,
  };
}

/**
 * @param {object} decision
 * @param {object[]} rows
 */
export function buildAdminPayoutCsvRows(decision, rows) {
  const month = decision.month;
  return rows.map((r) => ({
    month,
    creator_id: r.creator_id,
    display_name: r.display_name,
    rank: r.rank,
    gross_revenue: r.gross_revenue,
    applied_rate: r.applied_rate,
    payout_amount_yen: r.payout_amount_yen,
    guarantee_applied: r.guarantee_applied,
    adjustment_explanation: r.adjustment_explanation,
    payment_notice: r.payment_notice,
  }));
}

const CSV_HEADER = [
  "month",
  "creator_id",
  "display_name",
  "rank",
  "gross_revenue",
  "applied_rate",
  "payout_amount_yen",
  "guarantee_applied",
  "adjustment_explanation",
  "payment_notice",
];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {object[]} rows — buildAdminPayoutCsvRows の戻り値
 */
export function buildAdminPayoutCsvString(rows) {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.month,
        r.creator_id,
        csvEscape(r.display_name),
        csvEscape(r.rank),
        String(r.gross_revenue),
        String(r.applied_rate),
        String(r.payout_amount_yen),
        String(r.guarantee_applied),
        csvEscape(r.adjustment_explanation),
        csvEscape(r.payment_notice),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * @param {object} summary
 */
export function renderAdminSummaryHtml(summary) {
  const passLabel = summary.validations_all_pass ? "PASS" : "FAIL";
  const passClass = summary.validations_all_pass ? "is-pass" : "is-fail";

  return `
    <section class="tlv-admin-payouts__summary" data-tlv-admin-payout-summary aria-label="月次サマリー">
      <h2 class="tlv-admin-payouts__section-title">サマリー（monthly-payout-decision.json）</h2>
      <dl class="tlv-admin-payouts__summary-grid">
        <div><dt>対象月</dt><dd>${escapeHtml(summary.month)}</dd></div>
        <div><dt>総売上</dt><dd data-summary-field="total_revenue">${escapeHtml(formatConfirmedYenDisplay(summary.total_revenue))}</dd></div>
        <div><dt>総コスト</dt><dd data-summary-field="total_cost">${escapeHtml(formatConfirmedYenDisplay(summary.total_cost))}</dd></div>
        <div><dt>会社控除</dt><dd data-summary-field="company_deductions">${escapeHtml(formatConfirmedYenDisplay(summary.company_deductions))}</dd></div>
        <div><dt>還元プール</dt><dd data-summary-field="payout_pool">${escapeHtml(formatConfirmedYenDisplay(summary.payout_pool))}</dd></div>
        <div><dt>保証層合計</dt><dd data-summary-field="guaranteed_payout_total">${escapeHtml(formatConfirmedYenDisplay(summary.guaranteed_payout_total))}</dd></div>
        <div><dt>変動層合計</dt><dd data-summary-field="variable_payout_total">${escapeHtml(formatConfirmedYenDisplay(summary.variable_payout_total))}</dd></div>
        <div><dt>還元合計</dt><dd data-summary-field="total_payout">${escapeHtml(formatConfirmedYenDisplay(summary.total_payout))}</dd></div>
        <div><dt>会社利益</dt><dd data-summary-field="final_company_profit">${escapeHtml(formatConfirmedYenDisplay(summary.final_company_profit))}</dd></div>
        <div><dt>安全判定</dt><dd data-summary-field="safety_status">${escapeHtml(summary.safety_status)}</dd></div>
        <div><dt>validations</dt><dd class="tlv-admin-payouts__validation ${passClass}" data-summary-field="validations_all_pass">${passLabel}</dd></div>
      </dl>
    </section>
  `.trim();
}

/**
 * @param {object[]} rows
 */
export function renderAdminPayoutTableHtml(rows) {
  const body = rows
    .map((r) => {
      const guaranteeLabel = r.guarantee_applied ? "適用" : "なし";
      return `
        <tr
          data-creator-id="${escapeHtml(r.creator_id)}"
          data-confirmed-payout-field="payout_amount_yen"
          data-payout-amount-yen="${r.payout_amount_yen}"
        >
          <td data-display-field="creator">${escapeHtml(r.display_name)}<br><small>${escapeHtml(r.creator_id)}</small></td>
          <td data-display-field="rank">${escapeHtml(r.rank)}</td>
          <td data-display-field="gross_revenue">${escapeHtml(formatConfirmedYenDisplay(r.gross_revenue))}</td>
          <td data-display-field="applied_rate">${escapeHtml(String(r.applied_rate))}%</td>
          <td data-display-field="payout_amount_yen">${escapeHtml(formatConfirmedYenDisplay(r.payout_amount_yen))}</td>
          <td data-display-field="guarantee_applied">${escapeHtml(guaranteeLabel)}</td>
          <td data-display-field="adjustment_explanation">${escapeHtml(r.adjustment_explanation)}</td>
          <td data-display-field="payment_notice">${escapeHtml(r.payment_notice)}</td>
          <td data-display-field="safety_status">${escapeHtml(r.safety_status)}</td>
          <td data-display-field="audit_status">${escapeHtml(r.audit_status)}</td>
        </tr>
      `.trim();
    })
    .join("");

  return `
    <section class="tlv-admin-payouts__table-wrap" data-tlv-admin-payout-table aria-label="Creator 還元一覧">
      <div class="tlv-admin-payouts__table-head">
        <h2 class="tlv-admin-payouts__section-title">TLV月次還元一覧</h2>
        <button type="button" class="live-btn live-btn--primary" data-tlv-admin-payout-csv>CSV出力</button>
      </div>
      <p class="tlv-admin-payouts__notice">
        支払確定値は <code>payout_amount_yen</code> のみ。管理画面では <code>gross_revenue × applied_rate</code> をしません。
      </p>
      <div class="tlv-admin-payouts__table-scroll">
        <table class="tlv-admin-payouts__table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Rank</th>
              <th>Gross Revenue</th>
              <th>Applied Rate</th>
              <th>支払確定額 (payout_amount_yen)</th>
              <th>Guarantee</th>
              <th>Adjustment</th>
              <th>Payment Notice</th>
              <th>Safety</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `.trim();
}

/**
 * @param {string} source
 */
export function auditAdminPayoutSource(source) {
  const hits = [];
  for (const pattern of FORBIDDEN_ADMIN_PAYOUT_PATTERNS) {
    if (pattern.test(source)) hits.push(pattern.toString());
  }
  return {
    no_payout_recalculation_logic: hits.length === 0,
    forbidden_pattern_hits: hits,
  };
}

/**
 * @param {object} ctx
 */
export function runAdminPayoutValidations(ctx) {
  const { decision, explanation, adminSource, adminHtmlSource = "", rows, csvRows, csvString } = ctx;

  const sourceAudit = auditAdminPayoutSource(adminSource);

  const decisionById = new Map((decision.creators ?? []).map((c) => [c.creator_id, c]));
  const explainById = new Map((explanation?.creators ?? []).map((c) => [c.creator_id, c]));

  const payoutYenPresent = rows.every(
    (r) => r.payout_amount_yen != null && Number.isInteger(r.payout_amount_yen)
  );

  const displayMatchesExplanation = rows.every((r) => {
    const ex = explainById.get(r.creator_id);
    return ex && r.payout_amount_yen === ex.payout_amount_yen;
  });

  const displayMatchesDecision = rows.every((r) => {
    const d = decisionById.get(r.creator_id);
    return (
      d &&
      r.payout_amount_yen === d.payout_amount_yen &&
      r.gross_revenue === d.gross_revenue &&
      r.applied_rate === d.applied_rate
    );
  });

  const sumMatchesTotal =
    rows.reduce((s, r) => s + r.payout_amount_yen, 0) === decision.summary?.total_payout;

  const csvUsesPayoutAmountYen = csvRows.every((r) => {
    const ex = explainById.get(r.creator_id);
    const d = decisionById.get(r.creator_id);
    return (
      ex &&
      d &&
      r.payout_amount_yen === ex.payout_amount_yen &&
      r.payout_amount_yen === d.payout_amount_yen
    );
  });

  const csvSumMatches =
    csvRows.reduce((s, r) => s + r.payout_amount_yen, 0) === decision.summary?.total_payout;

  const csvNoForbiddenRecalc = !/\bgross_revenue\s*\*/.test(csvString);

  const adminPageIntegrated =
    /live-admin-payouts\.js/.test(adminHtmlSource) &&
    /TasuLiveAdminPayouts/.test(adminSource) &&
    /data-tlv-admin-payout-csv/.test(adminSource) &&
    /data-confirmed-payout-field="payout_amount_yen"/.test(adminSource);

  const explanationIntegrity = (explanation?.creators ?? []).every((ex) => {
    const d = decisionById.get(ex.creator_id);
    return d && ex.payout_amount_yen === d.payout_amount_yen;
  });

  const identityHolds = decision.audit?.balance_check?.identity_holds === true;

  const allPass =
    sourceAudit.no_payout_recalculation_logic &&
    payoutYenPresent &&
    displayMatchesExplanation &&
    displayMatchesDecision &&
    sumMatchesTotal &&
    csvUsesPayoutAmountYen &&
    csvSumMatches &&
    csvNoForbiddenRecalc &&
    adminPageIntegrated &&
    explanationIntegrity &&
    identityHolds &&
    decision.validations?.all_pass === true;

  return {
    no_payout_recalculation_in_admin_module: sourceAudit.no_payout_recalculation_logic,
    forbidden_pattern_hits: sourceAudit.forbidden_pattern_hits,
    admin_page_integrated: adminPageIntegrated,
    payout_amount_yen_present_for_all: payoutYenPresent,
    admin_display_matches_explanation_json: displayMatchesExplanation,
    admin_display_matches_decision_json: displayMatchesDecision,
    payout_amount_yen_sum_matches_total_payout: sumMatchesTotal,
    csv_uses_payout_amount_yen: csvUsesPayoutAmountYen,
    csv_sum_matches_total_payout: csvSumMatches,
    csv_no_gross_times_rate: csvNoForbiddenRecalc,
    explanation_payout_amount_yen_matches_decision: explanationIntegrity,
    identity_holds: identityHolds,
    monthly_decision_validations_all_pass: decision.validations?.all_pass === true,
    all_pass: allPass,
  };
}

/**
 * @param {string} root
 * @param {string} relativeLive
 * @param {string} relativeOutput
 */
function loadJsonPreferLive(root, relativeLive, relativeOutput) {
  const livePath = path.join(root, relativeLive);
  const outputPath = path.join(root, relativeOutput);
  const jsonPath = fs.existsSync(livePath) ? livePath : outputPath;
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON not found: ${jsonPath}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

/**
 * @param {string} root
 */
export function loadAdminPayoutDataForValidation(root) {
  const decision = loadJsonPreferLive(
    root,
    LIVE_MONTHLY_DECISION_RELATIVE,
    OUTPUT_MONTHLY_DECISION_RELATIVE
  );
  const explanation = loadJsonPreferLive(
    root,
    LIVE_CREATOR_EXPLANATION_RELATIVE,
    OUTPUT_CREATOR_EXPLANATION_RELATIVE
  );
  const rows = mergeAdminPayoutRows(decision, explanation);
  const csvRows = buildAdminPayoutCsvRows(decision, rows);
  const csvString = buildAdminPayoutCsvString(csvRows);
  return { decision, explanation, rows, csvRows, csvString };
}
