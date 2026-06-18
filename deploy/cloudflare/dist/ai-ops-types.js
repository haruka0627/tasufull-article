/**
 * AI運営センター — 種別・タブ定義
 */
(function (global) {
  "use strict";

  const TABS = Object.freeze({
    INQUIRY: "inquiry",
    PAYMENT: "payment",
    CONNECT: "connect",
    VIOLATION: "violation",
    REPORT: "report",
    PROJECT: "project",
    NEEDS_REVIEW: "needs_review",
    RESOLVED: "resolved",
  });

  const OPS_CATEGORY = Object.freeze({
    INQUIRY: "inquiry",
    REFUND: "refund",
    CHARGEBACK: "chargeback",
    PAYMENT: "payment",
    CONNECT: "connect_issue",
    LEGAL: "legal",
    ABUSE: "abuse_or_policy",
    EXTERNAL_PAYMENT: "external_payment",
    DIRECT_SALES: "direct_sales",
    REPORT: "report",
    VIOLATION: "violation_report",
    PROJECT_TROUBLE: "project_trouble",
    LISTING_SUSPEND: "listing_suspend_candidate",
    BAN_CANDIDATE: "ban_candidate",
    GENERAL: "general",
  });

  const RISK = Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  });

  const TAB_LABELS = {
    [TABS.INQUIRY]: "問い合わせ",
    [TABS.PAYMENT]: "決済",
    [TABS.CONNECT]: "Connect",
    [TABS.VIOLATION]: "違反",
    [TABS.REPORT]: "通報",
    [TABS.PROJECT]: "案件",
    [TABS.NEEDS_REVIEW]: "要確認",
    [TABS.RESOLVED]: "解決済み",
  };

  function tabForCase(c) {
    if (c.status === "resolved") return TABS.RESOLVED;
    if (c.status === "needs_review" || c.ai_risk === RISK.HIGH || c.ai_risk === RISK.CRITICAL) {
      if (c.status !== "resolved") return TABS.NEEDS_REVIEW;
    }
    const cat = c.ops_category || c.ai_category || "";
    if (cat === OPS_CATEGORY.CONNECT) return TABS.CONNECT;
    if ([OPS_CATEGORY.REFUND, OPS_CATEGORY.CHARGEBACK, OPS_CATEGORY.PAYMENT].includes(cat)) {
      return TABS.PAYMENT;
    }
    if (
      [
        OPS_CATEGORY.ABUSE,
        OPS_CATEGORY.EXTERNAL_PAYMENT,
        OPS_CATEGORY.DIRECT_SALES,
        OPS_CATEGORY.VIOLATION,
        OPS_CATEGORY.BAN_CANDIDATE,
        OPS_CATEGORY.LISTING_SUSPEND,
      ].includes(cat)
    ) {
      return TABS.VIOLATION;
    }
    if (cat === OPS_CATEGORY.REPORT) return TABS.REPORT;
    if (cat === OPS_CATEGORY.PROJECT_TROUBLE) return TABS.PROJECT;
    if (cat === OPS_CATEGORY.INQUIRY || cat === OPS_CATEGORY.GENERAL) return TABS.INQUIRY;
    if (c.status === "needs_review") return TABS.NEEDS_REVIEW;
    return TABS.INQUIRY;
  }

  function shouldNotifyOps(c) {
    const risk = c.ai_risk || c.severity || "";
    if (risk === RISK.HIGH || risk === RISK.CRITICAL) return true;
    const cat = c.ops_category || c.ai_category || "";
    const notifyCats = new Set([
      OPS_CATEGORY.LEGAL,
      OPS_CATEGORY.CHARGEBACK,
      OPS_CATEGORY.CONNECT,
      OPS_CATEGORY.ABUSE,
      OPS_CATEGORY.EXTERNAL_PAYMENT,
      OPS_CATEGORY.BAN_CANDIDATE,
    ]);
    return notifyCats.has(cat);
  }

  global.TasuAiOpsTypes = {
    TABS,
    OPS_CATEGORY,
    RISK,
    TAB_LABELS,
    tabForCase,
    shouldNotifyOps,
  };
})(typeof window !== "undefined" ? window : globalThis);
