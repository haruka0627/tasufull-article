/**
 * AI 秘書 Phase 5-A/B — Human Gate（L1–L4 · Human Send Gate 統合）
 */
(function (global) {
  "use strict";

  const LEVELS = Object.freeze({
    L1: {
      id: "L1",
      label: "L1 — 完全自動",
      description: "限定テンプレのみ完全自動（送信は Phase 5-B でも未実装）",
      flow: "auto_internal_only",
    },
    L2: {
      id: "L2",
      label: "L2 — AI処理＋報告",
      description: "AI が整理・報告。利用者への送信は行わない",
      flow: "report_only",
    },
    L3: {
      id: "L3",
      label: "L3 — 返信案 → 承認待ち → 送信可能",
      description: "Human Send Gate に返信案を登録。オーナー承認後にのみ送信可（自動送信なし）",
      flow: "proposal_approval_send",
    },
    L4: {
      id: "L4",
      label: "L4 — オーナー対応",
      description: "オーナーが直接対応。AI は調査・整理のみ",
      flow: "owner_only",
    },
  });

  const L4_RE = /契約|法律|訴訟|高額|本番.*migration|RLS変更|認証変更|憲法|DECISIONS改定/i;
  const L3_RE = /返金|BAN\b|ban\b|掲載停止|チャージバック|返信案|承認|通報|chargeback|complaint/i;
  const L1_RE = /FAQ|自動返信|テンプレ|一般問い合わせのみ/i;

  function resolveLevel(input) {
    const text = String(input?.userText || input?.text || input || "").trim();
    const severity = String(input?.severity || input?.classification?.severity || "medium");
    const category = String(input?.category || input?.classification?.category || "");

    if (L4_RE.test(text) || (category === "incident" && /本番|production/i.test(text))) {
      return { ...LEVELS.L4, reason: "owner_required_policy" };
    }
    if (L3_RE.test(text) || severity === "critical" || category === "report") {
      return { ...LEVELS.L3, reason: "human_approval_required" };
    }
    if (L1_RE.test(text) && severity === "low") {
      return { ...LEVELS.L1, reason: "template_auto_candidate" };
    }
    return { ...LEVELS.L2, reason: "default_report_only" };
  }

  function requiresHumanApproval(levelId) {
    return levelId === "L3" || levelId === "L4";
  }

  function describeLevel(levelId) {
    return LEVELS[levelId] || LEVELS.L2;
  }

  function bridgeToHumanSendGate(task, userText, level, commandResult) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.enqueuePendingItem) return { ok: false, error: "human_send_gate_missing" };

    if (level.id === "L4") {
      return {
        ok: true,
        bridged: false,
        ownerOnly: true,
        message: "L4 — オーナー対応（Human Send Gate 登録なし）",
      };
    }

    if (level.id !== "L3") {
      return { ok: true, bridged: false, skipped: true };
    }

    const rows = commandResult?.rows || [];
    const extractHint =
      rows.length > 0
        ? `\n抽出 ${rows.length} 件: ${rows
            .slice(0, 2)
            .map((r) => r.title)
            .join(" / ")}`
        : "";

    const item = HSG.enqueuePendingItem({
      source: "orchestrator",
      sourceId: task.id,
      category: "support_answer",
      actionType: "human_send",
      proposal: `【L3 返信案】${String(userText || "").slice(0, 240)}${extractHint}`,
      recommendation: `AI秘書 Orchestrator — ${task.agentId} — 承認後に送信可能`,
      reason: level.description,
      impactArea: "Support",
      severity: task.classification?.severity === "critical" ? "critical" : "warning",
      confidence: task.classification?.confidence ?? 0.7,
      payload: {
        taskId: task.id,
        levelId: "L3",
        agentId: task.agentId,
        orchestrator: true,
      },
    });

    return { ok: true, bridged: true, pendingItem: item, pendingId: item?.id };
  }

  global.TasuSecretaryHumanGate = {
    LEVELS,
    resolveLevel,
    requiresHumanApproval,
    describeLevel,
    bridgeToHumanSendGate,
  };
})(typeof window !== "undefined" ? window : globalThis);
