/**
 * AI運営分析 Provider（テンプレ実装 / 将来 ChatGPT API 差し替え）
 */
(function (global) {
  "use strict";

  const OPS = () => global.TasuAiOpsTypes?.OPS_CATEGORY || {};
  const RISK = () => global.TasuAiOpsTypes?.RISK || {};

  function inferOpsCategory(text, supportCategory) {
    const t = String(text || "");
    if (/チャージバック|chargeback/i.test(t)) return OPS().CHARGEBACK || "chargeback";
    if (/返金/i.test(t)) return OPS().REFUND || "refund";
    if (/stripe\s*connect|connect|本人確認.*エラー|銀行口座|payout|出金/i.test(t)) {
      return OPS().CONNECT || "connect_issue";
    }
    if (/外部決済|銀行振込|直接振込|stripe以外/i.test(t)) {
      return OPS().EXTERNAL_PAYMENT || "external_payment";
    }
    if (/直営業/i.test(t)) return OPS().DIRECT_SALES || "direct_sales";
    if (/通報/i.test(t)) return OPS().REPORT || "report";
    if (/違反報告|規約違反/i.test(t)) return OPS().VIOLATION || "violation_report";
    if (/案件.*トラブル|現場トラブル|工事トラブル/i.test(t)) return OPS().PROJECT_TROUBLE || "project_trouble";
    if (/掲載停止/i.test(t)) return OPS().LISTING_SUSPEND || "listing_suspend_candidate";
    if (/BAN|アカウント停止/i.test(t)) return OPS().BAN_CANDIDATE || "ban_candidate";
    if (/損害|事故|法的|弁護士|訴訟/i.test(t)) return OPS().LEGAL || "legal";
    if (supportCategory === "connect_issue") return OPS().CONNECT || "connect_issue";
    if (supportCategory === "legal_or_risk") return OPS().LEGAL || "legal";
    if (supportCategory === "abuse_or_policy") return OPS().ABUSE || "abuse_or_policy";
    if (supportCategory === "admin_review") return OPS().REFUND || "refund";
    return OPS().INQUIRY || "inquiry";
  }

  function inferRisk(opsCategory, severity) {
    if (severity === "critical") return RISK().CRITICAL || "critical";
    if (severity === "high") return RISK().HIGH || "high";
    const highCats = new Set([
      "chargeback",
      "legal",
      "ban_candidate",
      "connect_issue",
      "listing_suspend_candidate",
    ]);
    if (highCats.has(opsCategory)) return RISK().HIGH || "high";
    const medCats = new Set(["refund", "project_trouble", "violation_report", "abuse_or_policy"]);
    if (medCats.has(opsCategory)) return RISK().MEDIUM || "medium";
    return RISK().LOW || "low";
  }

  function buildReplyDraft(opsCategory) {
    const map = {
      refund:
        "お問い合わせありがとうございます。返金のご希望について、注文番号・お支払い日・状況を確認のうえ、運営担当よりご連絡いたします。返金の確約・時期は個別判断のため、本メッセージではお約束できません。",
      chargeback:
        "チャージバックに関するお問い合わせを受け付けました。Stripeおよび当社決済記録を確認し、運営担当が対応いたします。詳細は担当者からご連絡します。",
      connect_issue:
        "Stripe Connect・本人確認・口座に関する件を受け付けました。Connect状況を確認し、必要な案内を運営よりお送りします。審査結果の断定はできません。",
      legal:
        "重要なご連絡として受け付けました。法務・リスク担当が内容を確認し、必要に応じてご連絡いたします。",
      external_payment:
        "プラットフォーム外決済に関するご報告を受け付けました。利用規約に基づき運営が確認いたします。",
      direct_sales:
        "直営業に関するご報告を受け付けました。運営が内容を確認いたします。",
      report: "通報ありがとうございます。内容を確認し、必要な対応を検討いたします。",
      violation_report: "違反報告を受け付けました。運営が調査いたします。",
      project_trouble: "案件トラブルのご連絡を受け付けました。担当者が状況を確認いたします。",
      ban_candidate: "アカウントに関する重要なご連絡として受け付けました。運営判断のうえ対応いたします。",
      inquiry:
        "お問い合わせありがとうございます。内容を確認のうえ、必要に応じて担当よりご連絡いたします。",
    };
    return map[opsCategory] || map.inquiry;
  }

  function buildRecommendedAction(opsCategory, risk) {
    const base = {
      refund: "運営確認後に返金判断（API実行は管理者承認後フェーズ）",
      chargeback: "チャージバック証跡の確認・Stripe Connect記録照合",
      connect_issue: "Connect・口座・本人確認を管理者が確認",
      legal: "法務・リスクエスカレーション。自動返信・断定禁止",
      external_payment: "外部決済誘導調査。掲載・制限は管理者ボタンのみ",
      direct_sales: "直営業ポリシー違反調査",
      report: "通報内容の事実確認・関係者ヒアリング",
      violation_report: "違反報告の調査・証跡保全",
      project_trouble: "案件関係者への確認・キャンセル/返金は管理者承認",
      listing_suspend_candidate: "掲載停止候補として要確認キューへ（実行は未実施）",
      ban_candidate: "BAN候補として要確認（自動BAN禁止）",
      inquiry: "一次返信または要確認へ振り分け",
    };
    const action = base[opsCategory] || base.inquiry;
    if (risk === "critical") return `[CRITICAL] ${action}`;
    if (risk === "high") return `[HIGH] ${action}`;
    return action;
  }

  function buildSummary(title, body, opsCategory) {
    const snippet = String(body || "").trim().slice(0, 100);
    const labels = {
      refund: "返金希望",
      chargeback: "チャージバック",
      connect_issue: "Connect・決済基盤",
      legal: "法務・重大クレーム",
      external_payment: "外部決済誘導",
      direct_sales: "直営業",
      report: "通報",
      violation_report: "違反報告",
      project_trouble: "案件トラブル",
      ban_candidate: "BAN候補",
    };
    return `「${String(title || "無題").slice(0, 40)}」— ${labels[opsCategory] || "問い合わせ"}。${snippet}${snippet.length >= 100 ? "…" : ""}`;
  }

  /** Template provider */
  const TemplateAiProvider = {
    id: "template",
    analyze(caseRow) {
      const text = `${caseRow.title || ""}\n${caseRow.body || ""}`;
      const ops_category = inferOpsCategory(text, caseRow.support_category);
      const ai_risk = inferRisk(ops_category, caseRow.severity);
      return {
        ai_summary: buildSummary(caseRow.title, caseRow.body, ops_category),
        ai_category: ops_category,
        ai_risk,
        ai_recommended_action: buildRecommendedAction(ops_category, ai_risk),
        ai_reply_draft: buildReplyDraft(ops_category),
        provider: "template",
      };
    },
  };

  function getActiveProvider() {
    return TemplateAiProvider;
  }

  function analyzeCase(caseRow) {
    return getActiveProvider().analyze(caseRow);
  }

  global.TasuAiOpsProvider = {
    TemplateAiProvider,
    getActiveProvider,
    analyzeCase,
    inferOpsCategory,
  };
})(typeof window !== "undefined" ? window : globalThis);
