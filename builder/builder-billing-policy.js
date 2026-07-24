/**
 * Builder 課金方針 — 正本定数（UI / demo 決済）
 * 詳細: docs/AI/BUILDER_ARCHITECTURE.md · docs/AI/BUILDER_MONETIZATION.md
 */
(function (global) {
  "use strict";

  const CONTACT_REVEAL_FEE_YEN = 550;
  const PROJECT_COMMISSION_MIN_PCT = 5;
  const PROJECT_COMMISSION_MAX_PCT = 10;

  const POLICY = Object.freeze({
    contactRevealFeeYen: CONTACT_REVEAL_FEE_YEN,
    projectCommissionMinPct: PROJECT_COMMISSION_MIN_PCT,
    projectCommissionMaxPct: PROJECT_COMMISSION_MAX_PCT,
    opsProject: Object.freeze({
      id: "ops_project",
      label: "運営案件",
      contactRevealRequired: false,
      completionCommission: true,
    }),
    generalProject: Object.freeze({
      id: "general_project",
      label: "一般案件",
      contactRevealRequired: true,
      contactRevealFeeYen: CONTACT_REVEAL_FEE_YEN,
      completionCommission: true,
      commissionPctRange: [PROJECT_COMMISSION_MIN_PCT, PROJECT_COMMISSION_MAX_PCT],
    }),
    workerSearch: Object.freeze({
      id: "worker_search",
      label: "ワーカー検索",
      contactRevealRequired: true,
      contactRevealFeeYen: CONTACT_REVEAL_FEE_YEN,
      completionCommission: false,
    }),
    vendorSearch: Object.freeze({
      id: "vendor_search",
      label: "業者検索",
      contactRevealRequired: true,
      contactRevealFeeYen: CONTACT_REVEAL_FEE_YEN,
      completionCommission: false,
    }),
    vendorPageSubscription: Object.freeze({
      id: "vendor_page_subscription",
      label: "業者ページ（サブスク）",
      contactRevealRequired: false,
      completionCommission: false,
      subscription: true,
    }),
  });

  function formatYen(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  global.TasuBuilderBillingPolicy = {
    CONTACT_REVEAL_FEE_YEN,
    PROJECT_COMMISSION_MIN_PCT,
    PROJECT_COMMISSION_MAX_PCT,
    POLICY,
    formatYen,
    contactRevealLabel() {
      return `連絡先開示料 ${formatYen(CONTACT_REVEAL_FEE_YEN)}（税込）`;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
