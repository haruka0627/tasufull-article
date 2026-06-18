/**
 * AI運営センター通知（将来 LINE / メール / Discord）
 */
(function (global) {
  "use strict";

  const KEY = "tasu_ai_ops_admin_notifications_v1";
  const EVENT = "tasu:ai-ops-notify";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const local = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(local) ? local : [];
      const Read = global.TasuSupabaseOpsRead;
      if (Read?.mergeList) return Read.mergeList(list, "ai_ops_admin_notifications");
      return list;
    } catch {
      return [];
    }
  }

  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 300)));
    try {
      global.dispatchEvent(new CustomEvent(EVENT, { detail: { count: list.length } }));
    } catch {
      /* ignore */
    }
  }

  function notifyAdminAiOpsCase(caseRow) {
    const Types = global.TasuAiOpsTypes;
    if (Types && !Types.shouldNotifyOps(caseRow)) {
      return { notified: false };
    }

    const entry = {
      id: `aiops_notify_${caseRow.id}`,
      case_id: caseRow.id,
      ops_category: caseRow.ops_category,
      ai_risk: caseRow.ai_risk,
      title: caseRow.title,
      created_at: new Date().toISOString(),
      read: false,
    };

    const list = read();
    if (!list.some((n) => n.case_id === entry.case_id && !n.read)) {
      list.unshift(entry);
      write(list);
      if (global.TasuSupabaseOpsWrite?.insertAiOpsAdminNotification) {
        void global.TasuSupabaseOpsWrite.insertAiOpsAdminNotification(entry);
      }
    }

    if (typeof console !== "undefined" && console.info) {
      console.info("[TasuAiOps] 運営通知", entry);
    }

    const legacy = global.TasuSupportAdminNotify;
    if (legacy?.notifyAdminImportantTicket && caseRow.support_ticket_id) {
      legacy.notifyAdminImportantTicket({
        id: caseRow.support_ticket_id,
        category: caseRow.support_category,
        severity: caseRow.severity,
        title: caseRow.title,
      });
    }

    return { notified: true, entry };
  }

  function getUnreadCount() {
    return read().filter((n) => !n.read).length;
  }

  function markRead(caseId) {
    write(
      read().map((n) => {
        if (n.case_id !== caseId) return n;
        const next = { ...n, read: true };
        if (global.TasuSupabaseOpsWrite?.markAiOpsNotificationRead) {
          void global.TasuSupabaseOpsWrite.markAiOpsNotificationRead(next.id, true);
        }
        return next;
      })
    );
  }

  global.TasuAiOpsNotify = {
    KEY,
    EVENT,
    notifyAdminAiOpsCase,
    getUnreadCount,
    markRead,
    readNotifications: read,
  };
})(typeof window !== "undefined" ? window : globalThis);
