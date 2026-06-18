/**
 * 運営コマンド自然文 → フィルター
 */
(function (global) {
  "use strict";

  const COMMANDS = [
    { re: /返金/, filter: { ops_category: "refund" } },
    { re: /チャージバック|chargeback/i, filter: { ops_category: "chargeback" } },
    { re: /高リスク|今日.*リスク/, filter: { ai_risk_in: ["high", "critical"] } },
    { re: /BAN候補|BAN/, filter: { ops_category: "ban_candidate" } },
    { re: /Connect問題|Connectだけ|connect/i, filter: { ops_category: "connect_issue" } },
    { re: /未対応.*問い合わせ|未対応問い合わせ/, filter: { tab: "inquiry", status_in: ["open", "needs_review"] } },
    { re: /外部決済/, filter: { ops_category: "external_payment" } },
    { re: /違反報告/, filter: { ops_category: "violation_report" } },
    { re: /通報/, filter: { ops_category: "report" } },
    { re: /直営業/, filter: { ops_category: "direct_sales" } },
    { re: /案件トラブル|案件/, filter: { ops_category: "project_trouble" } },
    { re: /決済/, filter: { tab: "payment" } },
    { re: /解決済み/, filter: { tab: "resolved" } },
    { re: /要確認/, filter: { tab: "needs_review" } },
  ];

  function parseOpsCommand(raw) {
    const text = String(raw || "").trim();
    if (!text) return { ok: false, error: "コマンドが空です" };

    for (const cmd of COMMANDS) {
      if (cmd.re.test(text)) {
        return { ok: true, label: text, filter: { ...cmd.filter } };
      }
    }

    return {
      ok: true,
      label: text,
      filter: { q: text },
    };
  }

  global.TasuAiOpsCommand = {
    parseOpsCommand,
  };
})(typeof window !== "undefined" ? window : globalThis);
