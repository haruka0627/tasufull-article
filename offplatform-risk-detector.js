/**
 * 外部決済・直営業・連絡先流出の検知（自動制限・返金なし）
 */
(function (global) {
  "use strict";

  const RULES = [
    { risk_type: "line_exchange", severity: "high", re: /LINE\s*(ID|交換|で連絡|追加)|ラインで/i },
    { risk_type: "phone_share", severity: "high", re: /電話番号|携帯番号|0\d{1,4}-\d{1,4}-\d{4}|\d{10,11}/i },
    { risk_type: "email_share", severity: "medium", re: /メールアドレス|@[a-z0-9.-]+\.[a-z]{2,}/i },
    { risk_type: "bank_transfer", severity: "critical", re: /銀行振込|口座振込|振込で|直接振込/i },
    { risk_type: "paypay", severity: "high", re: /PayPay|ペイペイ/i },
    { risk_type: "cash_payment", severity: "high", re: /現金払い|現金手渡し|現金で/i },
    { risk_type: "direct_contract", severity: "critical", re: /直接契約|直契約|TASFUL外|タスフル外|プラットフォーム外/i },
    { risk_type: "offplatform_intent", severity: "critical", re: /TASFULを使わず|手数料回避|手数料を避け|外でやろう|外でお願い/i },
    { risk_type: "url_redirect", severity: "medium", re: /https?:\/\/|bit\.ly|短縮URL/i },
    { risk_type: "sns_redirect", severity: "medium", re: /Instagram|インスタ|Twitter|X\.com|Facebook|SNSで/i },
    { risk_type: "qr_code", severity: "medium", re: /QRコード|QR送|二次元コード/i },
    { risk_type: "external_payment", severity: "critical", re: /外部決済|Stripe以外|stripe以外|決済を迂回/i },
    { risk_type: "direct_sales", severity: "high", re: /直営業|営業電話|訪問販売/i },
  ];

  function scanText(text) {
    const src = String(text || "");
    const matches = [];

    RULES.forEach((rule) => {
      const m = src.match(rule.re);
      if (m) {
        matches.push({
          risk_type: rule.risk_type,
          severity: rule.severity,
          matched_terms: [m[0]],
        });
      }
    });

    if (!matches.length) {
      return {
        detected: false,
        risk_type: null,
        severity: "low",
        matched_terms: [],
        admin_required: false,
        suggested_warning_message: "",
        suggested_admin_action: "",
      };
    }

    const order = { critical: 4, high: 3, medium: 2, low: 1 };
    matches.sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0));
    const top = matches[0];
    const allTerms = matches.flatMap((x) => x.matched_terms);

    return {
      detected: true,
      risk_type: top.risk_type,
      severity: top.severity,
      matched_terms: [...new Set(allTerms)],
      all_matches: matches,
      admin_required: true,
      suggested_warning_message:
        "プラットフォーム外での決済・連絡先交換は利用規約で禁止されています。TASFUL 内のメッセージ・決済をご利用ください。",
      suggested_admin_action:
        "外部決済・直営業の疑い — チャット・案件を確認し、管理者が警告・掲載停止候補を検討（自動 BAN・返金は行わない）",
    };
  }

  global.TasuOffplatformRiskDetector = {
    RULES,
    scanText,
  };
})(typeof window !== "undefined" ? window : globalThis);
