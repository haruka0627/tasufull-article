/**
 * 返金・キャンセル判断チェックリスト（自動返金なし・運営確認必須）
 */
(function (global) {
  "use strict";

  const ITEMS = Object.freeze({
    before_work: { label: "作業前", weight: 1 },
    during_work: { label: "作業中", weight: 1 },
    after_complete: { label: "完了後", weight: 2 },
    delivered: { label: "納品済み", weight: 2 },
    has_complaint: { label: "クレームあり", weight: 2 },
    has_evidence: { label: "証拠あり", weight: -1 },
    conflicting_claims: { label: "双方主張不一致", weight: 3 },
    no_contact: { label: "連絡不通", weight: 2 },
    past_deadline: { label: "期限超過", weight: 2 },
    policy_violation_suspected: { label: "規約違反疑い", weight: 3 },
    external_payment_hint: { label: "外部決済誘導あり", weight: 4 },
    direct_sales_hint: { label: "直営業疑い", weight: 3 },
  });

  function evaluate(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const flags = ctx.flags || ctx;
    const triggered = [];
    let score = 0;

    Object.keys(ITEMS).forEach((key) => {
      if (flags[key]) {
        triggered.push(ITEMS[key].label);
        score += ITEMS[key].weight;
      }
    });

    const offplatform =
      global.TasuOffplatformRiskDetector?.scanText?.(
        `${ctx.body || ""}\n${ctx.user_message || ""}\n${ctx.provider_message || ""}`
      ) || null;
    if (offplatform?.detected) {
      triggered.push("外部決済・オフプラットフォーム検知");
      score += 4;
    }

    let recommended_review_level = "standard";
    if (score >= 8 || flags.external_payment_hint || flags.policy_violation_suspected) {
      recommended_review_level = "urgent";
    } else if (score >= 4 || flags.has_complaint || flags.conflicting_claims) {
      recommended_review_level = "elevated";
    }

    const required_evidence = [];
    if (flags.delivered || flags.after_complete) {
      required_evidence.push("納品・完了記録", "チャット履歴");
    }
    if (flags.has_complaint || flags.conflicting_claims) {
      required_evidence.push("双方の主張メモ", "写真・添付");
    }
    if (flags.external_payment_hint || offplatform?.detected) {
      required_evidence.push("メッセージ全文", "決済履歴");
    }
    if (!required_evidence.length) required_evidence.push("注文・案件情報", "チャット概要");

    return {
      triggered_items: triggered,
      score,
      recommended_review_level,
      required_evidence: [...new Set(required_evidence)],
      suggested_admin_action:
        "運営が事実関係を確認のうえ返金・キャンセル可否を判断してください。自動返金・自動 BAN は行いません。",
      suggested_user_reply:
        "お問い合わせありがとうございます。内容を確認のうえ、担当よりご連絡いたします。最終判断までお時間をいただく場合があります。",
      suggested_provider_reply:
        "案件内容を確認中です。事実関係の整理のため、チャット履歴・納品状況の共有にご協力ください。",
      should_auto_refund: false,
      admin_required: true,
      disclaimer: "本チェックリストは AI 補助です。どちらが不当かを自動断定しません。",
      offplatform_risk: offplatform?.detected ? offplatform : null,
    };
  }

  global.TasuRefundCancelChecklist = {
    ITEMS,
    evaluate,
  };
})(typeof window !== "undefined" ? window : globalThis);
