/**
 * Platform OPS-FLOW-2 — チャット通報 → AI-ops 案件 + AI秘書 inbox
 * Product 判定ロジックは変更せず、submitReport 成功後の導線のみ
 */
(function (global) {
  "use strict";

  function onChatReportSubmitted(event) {
    const d = event?.detail || {};
    const Store = global.TasuAiOpsCaseStore;
    if (!Store?.createCaseFromInput) return;

    const reason = String(d.reason || "通報").trim();
    const detail = String(d.detail || "").trim();
    const roomId = String(d.roomId || "").trim();
    const messageId = String(d.messageId || "").trim();

    const row = Store.createCaseFromInput(
      {
        title: `【通報】${reason}`,
        body: [detail, roomId ? `room: ${roomId}` : "", messageId ? `message: ${messageId}` : ""]
          .filter(Boolean)
          .join("\n"),
        source: "chat_report",
        ops_category: "report",
        severity: "high",
        status: "needs_review",
        user_id: d.reporterId || "unknown",
      },
      true
    );

    if (row?.id) {
      try {
        global.dispatchEvent?.(new CustomEvent("tasu:ai-ops-cases-changed", { detail: { id: row.id } }));
        global.dispatchEvent?.(new CustomEvent("tasu:admin-daily-inbox-updated"));
      } catch {
        /* ignore */
      }
    }
  }

  function drainPendingReports() {
    try {
      const KEY = "tasu_ops_chat_report_pending_v1";
      const raw = global.localStorage?.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list) || !list.length) return;
      list.forEach((row) => onChatReportSubmitted({ detail: row }));
      global.localStorage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  function init() {
    global.addEventListener("tasu:chat-report-submitted", onChatReportSubmitted);
    drainPendingReports();
  }

  global.TasuPlatformOpsChatReportBridge = { init };

  init();
})(typeof window !== "undefined" ? window : globalThis);
