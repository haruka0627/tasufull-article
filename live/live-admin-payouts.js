/**
 * TASFUL LIVE — TLV 月次還元管理（表示専用・再計算禁止）
 * SSOT: live/data/monthly-payout-decision.json（payout_amount_yen）
 */
(function (global) {
  "use strict";

  const DECISION_URL = "data/monthly-payout-decision.json";
  const EXPLANATION_URL = "data/creator-rank-explanation.json";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatConfirmedYenDisplay(yen) {
    if (!Number.isInteger(yen) || yen < 0) {
      throw new Error("formatConfirmedYenDisplay requires non-negative integer yen");
    }
    return "¥" + yen.toLocaleString("ja-JP");
  }

  function formatAuditStatus(audit) {
    if (!audit) return "—";
    if (audit.payout_amount_yen_is_final === true && audit.no_display_recalculation === true) {
      return "OK";
    }
    return "CHECK";
  }

  function mergeAdminPayoutRows(decision, explanation) {
    const explainById = new Map(
      (explanation.creators || []).map(function (c) {
        return [c.creator_id, c];
      })
    );

    return (decision.creators || []).map(function (d) {
      const ex = explainById.get(d.creator_id) || {};
      const payoutAmountYen = ex.payout_amount_yen != null ? ex.payout_amount_yen : d.payout_amount_yen;
      return {
        creator_id: d.creator_id,
        display_name: ex.display_name || d.display_name,
        rank: ex.rank || d.rank,
        gross_revenue: ex.gross_revenue != null ? ex.gross_revenue : d.gross_revenue,
        applied_rate: ex.applied_rate != null ? ex.applied_rate : d.applied_rate,
        payout_amount_yen: payoutAmountYen,
        guarantee_applied: ex.guarantee_applied != null ? ex.guarantee_applied : d.guarantee_applied,
        adjustment_explanation: ex.adjustment_explanation || d.adjustment_reason || "",
        payment_notice: ex.payment_notice || "",
        safety_status: ex.safety_status || (decision.summary && decision.summary.safety_status) || "",
        audit_status: formatAuditStatus(d.audit),
      };
    });
  }

  function buildAdminSummaryView(decision) {
    const s = decision.summary || {};
    return {
      month: decision.month,
      total_revenue: s.total_revenue,
      total_cost: (s.payment_fee || 0) + (s.platform_cost_total || 0),
      company_deductions: s.company_deductions_total,
      payout_pool: s.payout_pool,
      guaranteed_payout_total: s.guaranteed_payout_total,
      variable_payout_total: s.variable_payout_total,
      total_payout: s.total_payout,
      final_company_profit: s.final_company_profit,
      safety_status: s.safety_status,
      validations_all_pass: decision.validations && decision.validations.all_pass === true,
    };
  }

  function buildAdminPayoutCsvRows(decision, rows) {
    return rows.map(function (r) {
      return {
        month: decision.month,
        creator_id: r.creator_id,
        display_name: r.display_name,
        rank: r.rank,
        gross_revenue: r.gross_revenue,
        applied_rate: r.applied_rate,
        payout_amount_yen: r.payout_amount_yen,
        guarantee_applied: r.guarantee_applied,
        adjustment_explanation: r.adjustment_explanation,
        payment_notice: r.payment_notice,
      };
    });
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildAdminPayoutCsvString(rows) {
    const header = [
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
    const lines = [header.join(",")];
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

  function renderAdminSummaryHtml(summary) {
    const passLabel = summary.validations_all_pass ? "PASS" : "FAIL";
    const passClass = summary.validations_all_pass ? "is-pass" : "is-fail";
    return (
      '<section class="tlv-admin-payouts__summary" data-tlv-admin-payout-summary aria-label="月次サマリー">' +
      '<h2 class="tlv-admin-payouts__section-title">サマリー（monthly-payout-decision.json）</h2>' +
      '<dl class="tlv-admin-payouts__summary-grid">' +
      "<div><dt>対象月</dt><dd>" +
      escapeHtml(summary.month) +
      "</dd></div>" +
      '<div><dt>総売上</dt><dd data-summary-field="total_revenue">' +
      escapeHtml(formatConfirmedYenDisplay(summary.total_revenue)) +
      "</dd></div>" +
      '<div><dt>総コスト</dt><dd data-summary-field="total_cost">' +
      escapeHtml(formatConfirmedYenDisplay(summary.total_cost)) +
      "</dd></div>" +
      '<div><dt>会社控除</dt><dd data-summary-field="company_deductions">' +
      escapeHtml(formatConfirmedYenDisplay(summary.company_deductions)) +
      "</dd></div>" +
      '<div><dt>還元プール</dt><dd data-summary-field="payout_pool">' +
      escapeHtml(formatConfirmedYenDisplay(summary.payout_pool)) +
      "</dd></div>" +
      '<div><dt>保証層合計</dt><dd data-summary-field="guaranteed_payout_total">' +
      escapeHtml(formatConfirmedYenDisplay(summary.guaranteed_payout_total)) +
      "</dd></div>" +
      '<div><dt>変動層合計</dt><dd data-summary-field="variable_payout_total">' +
      escapeHtml(formatConfirmedYenDisplay(summary.variable_payout_total)) +
      "</dd></div>" +
      '<div><dt>還元合計</dt><dd data-summary-field="total_payout">' +
      escapeHtml(formatConfirmedYenDisplay(summary.total_payout)) +
      "</dd></div>" +
      '<div><dt>会社利益</dt><dd data-summary-field="final_company_profit">' +
      escapeHtml(formatConfirmedYenDisplay(summary.final_company_profit)) +
      "</dd></div>" +
      '<div><dt>安全判定</dt><dd data-summary-field="safety_status">' +
      escapeHtml(summary.safety_status) +
      "</dd></div>" +
      '<div><dt>validations</dt><dd class="tlv-admin-payouts__validation ' +
      passClass +
      '" data-summary-field="validations_all_pass">' +
      passLabel +
      "</dd></div>" +
      "</dl></section>"
    );
  }

  function renderAdminPayoutTableHtml(rows) {
    const body = rows
      .map(function (r) {
        const guaranteeLabel = r.guarantee_applied ? "適用" : "なし";
        return (
          '<tr data-creator-id="' +
          escapeHtml(r.creator_id) +
          '" data-confirmed-payout-field="payout_amount_yen" data-payout-amount-yen="' +
          r.payout_amount_yen +
          '">' +
          '<td data-display-field="creator">' +
          escapeHtml(r.display_name) +
          "<br><small>" +
          escapeHtml(r.creator_id) +
          "</small></td>" +
          '<td data-display-field="rank">' +
          escapeHtml(r.rank) +
          "</td>" +
          '<td data-display-field="gross_revenue">' +
          escapeHtml(formatConfirmedYenDisplay(r.gross_revenue)) +
          "</td>" +
          '<td data-display-field="applied_rate">' +
          escapeHtml(String(r.applied_rate)) +
          "%</td>" +
          '<td data-display-field="payout_amount_yen">' +
          escapeHtml(formatConfirmedYenDisplay(r.payout_amount_yen)) +
          "</td>" +
          '<td data-display-field="guarantee_applied">' +
          escapeHtml(guaranteeLabel) +
          "</td>" +
          '<td data-display-field="adjustment_explanation">' +
          escapeHtml(r.adjustment_explanation) +
          "</td>" +
          '<td data-display-field="payment_notice">' +
          escapeHtml(r.payment_notice) +
          "</td>" +
          '<td data-display-field="safety_status">' +
          escapeHtml(r.safety_status) +
          "</td>" +
          '<td data-display-field="audit_status">' +
          escapeHtml(r.audit_status) +
          "</td></tr>"
        );
      })
      .join("");

    return (
      '<section class="tlv-admin-payouts__table-wrap" data-tlv-admin-payout-table aria-label="Creator 還元一覧">' +
      '<div class="tlv-admin-payouts__table-head">' +
      '<h2 class="tlv-admin-payouts__section-title">TLV月次還元一覧</h2>' +
      '<button type="button" class="live-btn live-btn--primary" data-tlv-admin-payout-csv>CSV出力</button>' +
      "</div>" +
      '<p class="tlv-admin-payouts__notice">支払確定値は <code>payout_amount_yen</code> のみ。管理画面では <code>gross_revenue × applied_rate</code> をしません。</p>' +
      '<div class="tlv-admin-payouts__table-scroll">' +
      '<table class="tlv-admin-payouts__table">' +
      "<thead><tr>" +
      "<th>Creator</th><th>Rank</th><th>Gross Revenue</th><th>Applied Rate</th>" +
      "<th>支払確定額 (payout_amount_yen)</th><th>Guarantee</th><th>Adjustment</th><th>Payment Notice</th>" +
      "<th>Safety</th><th>Audit</th>" +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
    return res.json();
  }

  function downloadCsv(csvString, filename) {
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindCsvExport(root, decision, csvRows) {
    const btn = root.querySelector("[data-tlv-admin-payout-csv]");
    if (!btn) return;
    const csvString = buildAdminPayoutCsvString(csvRows);
    btn.addEventListener("click", function () {
      downloadCsv(csvString, "tlv-admin-payouts-" + decision.month + ".csv");
    });
  }

  async function mountAdminPayoutsPage(root) {
    root.innerHTML = '<p class="live-loading">月次還元データを読み込み中…</p>';
    try {
      const [decision, explanation] = await Promise.all([
        loadJson(DECISION_URL),
        loadJson(EXPLANATION_URL),
      ]);

      const rows = mergeAdminPayoutRows(decision, explanation);
      const summary = buildAdminSummaryView(decision);
      const csvRows = buildAdminPayoutCsvRows(decision, rows);

      root.innerHTML =
        '<div class="tlv-admin-payouts" data-tlv-admin-payouts data-tlv-payout-display-only="true">' +
        renderAdminSummaryHtml(summary) +
        renderAdminPayoutTableHtml(rows) +
        "</div>";

      bindCsvExport(root, decision, csvRows);
    } catch (err) {
      console.error("[TasuLiveAdminPayouts]", err);
      root.innerHTML =
        '<p class="live-error">読み込みに失敗しました: ' +
        escapeHtml(err.message || String(err)) +
        "</p>" +
        "<p>先に <code>node scripts/generate-monthly-payout-decision.mjs</code> と " +
        "<code>node scripts/generate-creator-rank-explanation.mjs</code> を実行してください。</p>";
    }
  }

  global.TasuLiveAdminPayouts = {
    DECISION_URL,
    EXPLANATION_URL,
    mergeAdminPayoutRows,
    buildAdminPayoutCsvRows,
    buildAdminPayoutCsvString,
    mountAdminPayoutsPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
