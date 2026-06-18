/**
 * 安否未応答 Phase2 — 家族向け TALK 通知生成
 */
(function (global) {
  "use strict";

  function formatElapsedSince(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}分`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間`;
    const days = Math.floor(hours / 24);
    return `${days}日`;
  }

  function buildNotification(session) {
    const checkId = String(session?.id || "").trim();
    const name = String(session?.target_user_name || session?.metadata?.target_user_name || "利用者").trim();
    const elapsed = formatElapsedSince(session?.no_response_at || session?.response_deadline_at);
    const holderId = String(session?.contract_holder_id || "").trim();

    return {
      id: `anpi-no-response-${checkId}`,
      type: "anpi",
      subType: "no_response",
      audience: "family",
      priority: "urgent",
      title: "安否確認が未回答です",
      body: `${name}さんが安否確認に応答していません（${elapsed}）。ご確認ください。`,
      actionLabel: "対応する",
      href: `anpi-dashboard.html#no-response?checkId=${encodeURIComponent(checkId)}`,
      targetUrl: `anpi-dashboard.html#no-response?checkId=${encodeURIComponent(checkId)}`,
      recipientUserId: holderId,
      officialRoomId: "official_anpi",
      source: "anpi-no-response-phase2",
      meta: {
        anpi_check_id: checkId,
        target_user_id: session?.target_user_id,
        target_user_name: name,
        audience: "family",
      },
      createdAt: new Date().toISOString(),
      readAt: null,
    };
  }

  async function notifyFamily(session) {
    const row = buildNotification(session);
    if (global.TasuTalkNotifications?.add) {
      global.TasuTalkNotifications.add(row);
      return { ok: true, notification: row };
    }
    console.warn("[TasuAnpiNoResponseNotify] TasuTalkNotifications.add unavailable");
    return { ok: false, reason: "notifications_unavailable" };
  }

  global.TasuAnpiNoResponseNotify = {
    buildNotification,
    notifyFamily,
    formatElapsedSince,
  };
})(window);
