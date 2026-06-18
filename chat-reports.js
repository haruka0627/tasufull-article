/**
 * 通報（reports）— UI定数・将来 BAN / moderation_logs 連携
 */
(function () {
  "use strict";

  /** @typedef {{ id: string, label: string }} ReportReasonOption */

  /** @type {ReportReasonOption[]} */
  const REPORT_REASONS = [
    { id: "contact_exchange", label: "連絡先交換" },
    { id: "external_redirect", label: "外部誘導" },
    { id: "scam", label: "詐欺" },
    { id: "harassment", label: "暴言" },
    { id: "inappropriate_image", label: "不適切画像" },
    { id: "other", label: "その他" },
  ];

  const REPORT_SUCCESS_MESSAGE = "通報を受け付けました";

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "").trim()
    );
  }

  function getReasonLabel(reasonId) {
    const found = REPORT_REASONS.find((r) => r.id === reasonId);
    return found?.label || reasonId;
  }

  // --- 将来連携: 通報数集計（reported_user_id 別） ---
  // async function countReportsByReportedUser(reportedUserId) { ... }

  // --- 将来連携: moderation_logs + reports → 危険率スコア ---
  // async function computeUserRiskScore(userId) { ... }

  // --- 将来連携: 自動BAN / review_scores 更新 ---
  // async function evaluateAutoBan(userId) { ... }

  window.TasuChatReports = {
    REPORT_REASONS,
    REPORT_SUCCESS_MESSAGE,
    isUuid,
    getReasonLabel,
  };
})();
