/**
 * TASFUL LIVE — 通知データ取得・正規化（talk_notifications + dev fallback）
 * @deprecated 互換レイヤ — 新規は TasuTlvNotificationService を利用
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;
  const T = () => global.TasuTlvNotificationTypes;
  const S = () => global.TasuTlvNotificationService;

  function mapRawNotificationRow(row, cfg) {
    if (T()?.rowToItem) return T().rowToItem(row, cfg);
    const actorId = String(row?.sender_user_id || row?.actorId || "").trim();
    return {
      id: String(row?.id || ""),
      type: "admin",
      kind: "admin",
      actorId,
      actorName: actorId || "TASFUL LIVE",
      actorAvatar: "",
      targetUserId: String(row?.user_id || ""),
      title: String(row?.title || row?.body || "").slice(0, 80),
      href: String(row?.target_url || "#"),
      thumb: "",
      createdAt: row?.created_at || new Date().toISOString(),
      read: Boolean(row?.read_at),
      unread: !row?.read_at,
    };
  }

  async function fetchNotificationRows(userId) {
    if (S()?.fetchRows) return S().fetchRows(userId);
    return [];
  }

  async function fetchNotificationItems(userId) {
    if (S()?.listNotifications) return S().listNotifications(userId);
    const cfg = C();
    const rows = await fetchNotificationRows(userId);
    return rows.map((row) => mapRawNotificationRow(row, cfg)).filter((item) => item.id);
  }

  function resolveViewerUserId() {
    if (S()?.resolveViewerUserId) return S().resolveViewerUserId();
    return String(C()?.getTalkUserId?.() || "").trim();
  }

  global.TasuLiveNotificationsData = {
    parseLiveNotifyBody: (body) => T()?.parseLiveBody?.(body) || { displayText: String(body || ""), payload: {} },
    normalizeTlvHref: (url) => T()?.normalizeTlvHref?.(url) || url,
    mapRawNotificationRow,
    fetchNotificationRows,
    fetchNotificationItems,
    resolveViewerUserId,
  };
})(typeof window !== "undefined" ? window : globalThis);
