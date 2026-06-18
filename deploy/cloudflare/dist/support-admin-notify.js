/**
 * 重要問い合わせの管理者通知（将来 LINE / メール接続用フック）
 */
(function (global) {
  "use strict";

  const NOTIFY_KEY = "tasu_support_admin_notifications_v1";
  const EVENT_NAME = "tasu:support-admin-notify";

  function readNotifications() {
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      const local = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(local) ? local : [];
      const Read = global.TasuSupabaseOpsRead;
      if (Read?.mergeList) return Read.mergeList(list, "support_admin_notifications");
      return list;
    } catch {
      return [];
    }
  }

  function writeNotifications(list) {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(list.slice(0, 200)));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { count: list.length } }));
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {object} ticket support_tickets 相当
   */
  function notifyAdminImportantTicket(ticket) {
    const Classifier = global.TasuSupportClassifier;
    if (Classifier && !Classifier.shouldNotifyAdmin(ticket)) {
      return { notified: false, reason: "below_threshold" };
    }

    const entry = {
      id: `notify_${ticket?.id || Date.now()}`,
      ticket_id: ticket?.id || "",
      category: ticket?.category || "",
      severity: ticket?.severity || "",
      title: ticket?.title || "",
      created_at: new Date().toISOString(),
      read: false,
    };

    const list = readNotifications();
    const dup = list.some((n) => n.ticket_id === entry.ticket_id && !n.read);
    if (!dup) {
      list.unshift(entry);
      writeNotifications(list);
      if (global.TasuSupabaseOpsWrite?.insertSupportAdminNotification) {
        void global.TasuSupabaseOpsWrite.insertSupportAdminNotification(entry);
      }
    }

    if (typeof console !== "undefined" && console.info) {
      console.info("[TasuSupport] 管理者通知", entry);
    }

    return { notified: true, entry };
  }

  function getUnreadNotificationCount() {
    return readNotifications().filter((n) => !n.read).length;
  }

  function markNotificationsReadForTicket(ticketId) {
    const list = readNotifications().map((n) => {
      if (n.ticket_id !== ticketId) return n;
      const next = { ...n, read: true };
      if (global.TasuSupabaseOpsWrite?.markSupportNotificationRead) {
        void global.TasuSupabaseOpsWrite.markSupportNotificationRead(next.id, true);
      }
      return next;
    });
    writeNotifications(list);
  }

  global.TasuSupportAdminNotify = {
    NOTIFY_KEY,
    EVENT_NAME,
    notifyAdminImportantTicket,
    readNotifications,
    getUnreadNotificationCount,
    markNotificationsReadForTicket,
  };
})(typeof window !== "undefined" ? window : globalThis);
