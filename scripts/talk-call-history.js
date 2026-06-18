/**
 * TASFUL TALK — 通話履歴 UI（Phase4）
 * talk_call_sessions を chat-detail タイムラインと TALK 通知に反映する。
 */
(function (global) {
  "use strict";

  const SOURCE = "talk_call_v1";
  const SUB_TYPE_HISTORY = "call_history";
  const MAX_ROOM_HISTORY = 20;
  const HISTORY_STATUSES = new Set(["ended", "missed", "rejected"]);

  const Signaling = () => global.TasuTalkCallSignaling;

  /** @type {string} */
  let activeRoomId = "";
  /** @type {Set<string>} */
  const renderedSessionIds = new Set();

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      Signaling()?.getMeId?.() ||
      ""
    );
  }

  function historyItemId(sessionId) {
    return `call-hist-${String(sessionId || "").trim()}`;
  }

  function historyNotifyId(sessionId) {
    return `talk-call-history-${String(sessionId || "").trim()}`;
  }

  function sessionSortTime(session) {
    return pickStr(session?.ended_at, session?.started_at, session?.created_at) || new Date().toISOString();
  }

  function computeDurationSec(session) {
    const start = pickStr(session?.started_at);
    const end = pickStr(session?.ended_at);
    if (!start || !end) return 0;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.floor(ms / 1000);
  }

  function formatDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (s <= 0) return "";
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  /**
   * @param {object} session
   * @param {string} meId
   * @returns {{ text: string, direction: string, status: string, durationLabel: string, icon: string }}
   */
  function resolvePresentation(session, meId) {
    const uid = String(meId || "");
    const isCaller = String(session?.caller_id) === uid;
    const isCallee = String(session?.callee_id) === uid;
    const status = String(session?.status || "");
    const direction = isCaller ? "outgoing" : isCallee ? "incoming" : "unknown";
    const durationSec = computeDurationSec(session);
    const durationLabel = formatDuration(durationSec);

    let text = "";
    if (status === "ended") {
      if (durationSec > 0) {
        text = "通話が終了しました";
      } else if (isCaller) {
        text = "音声通話を発信しました";
      } else {
        text = "音声通話の着信がありました";
      }
    } else if (status === "missed") {
      text = isCallee ? "不在着信" : "応答されませんでした";
    } else if (status === "rejected") {
      text = isCallee ? "通話は拒否されました" : "拒否されました";
    } else {
      text = isCaller ? "音声通話を発信しました" : "音声通話の着信がありました";
    }

    const icon = direction === "outgoing" ? "📤" : "📥";
    return { text, direction, status, durationLabel, icon };
  }

  function buildChatDetailHref(roomId) {
    const url = new URL("chat-detail.html", global.location?.origin || "http://localhost");
    url.searchParams.set("thread", roomId);
    let href = url.pathname + url.search;
    if (global.TasuChatUserIdentity?.appendUserIdToUrl) {
      href = global.TasuChatUserIdentity.appendUserIdToUrl(href);
    }
    return href;
  }

  function sessionToTimelineItem(session, meId) {
    if (!session?.id || !Signaling()?.isParticipant?.(session, meId)) return null;
    const status = String(session.status || "");
    if (!HISTORY_STATUSES.has(status)) return null;

    const pres = resolvePresentation(session, meId);
    const at = sessionSortTime(session);

    return {
      id: historyItemId(session.id),
      kind: "call_history",
      senderId: "__system__",
      createdAt: at,
      callSessionId: String(session.id),
      callHistory: {
        sessionId: String(session.id),
        roomId: pickStr(session.room_id),
        status,
        direction: pres.direction,
        text: pres.text,
        durationLabel: pres.durationLabel,
        icon: pres.icon,
        createdAt: pickStr(session.created_at),
        endedAt: pickStr(session.ended_at),
      },
    };
  }

  function sessionsToTimelineItems(sessions, meId, roomId) {
    const uid = String(meId || "");
    const rid = String(roomId || "");
    const rows = (Array.isArray(sessions) ? sessions : [])
      .filter((row) => String(row?.room_id || "") === rid)
      .filter((row) => Signaling()?.isParticipant?.(row, uid))
      .filter((row) => HISTORY_STATUSES.has(String(row?.status || "")))
      .sort((a, b) => new Date(sessionSortTime(a)).getTime() - new Date(sessionSortTime(b)).getTime())
      .slice(-MAX_ROOM_HISTORY);

    const byId = new Map();
    rows.forEach((row) => {
      const item = sessionToTimelineItem(row, uid);
      if (item) byId.set(item.id, item);
    });
    return [...byId.values()];
  }

  function mergeMessagesWithHistory(messages, sessions, roomId, meId) {
    const chatOnly = (Array.isArray(messages) ? messages : []).filter(
      (m) => m?.kind !== "call_history" && !String(m?.id || "").startsWith("call-hist-")
    );
    const historyItems = sessionsToTimelineItems(sessions, meId, roomId);
    const merged = [...chatOnly, ...historyItems];
    merged.sort(
      (a, b) => new Date(pickStr(a?.createdAt)).getTime() - new Date(pickStr(b?.createdAt)).getTime()
    );
    return merged;
  }

  async function fetchRoomSessions(roomId) {
    if (!roomId || !Signaling()?.fetchSessionsByRoom) return [];
    return Signaling().fetchSessionsByRoom(roomId, { limit: MAX_ROOM_HISTORY });
  }

  async function mergeMessagesForRoom(messages, roomId) {
    const meId = getMeId();
    if (!meId || !roomId) return Array.isArray(messages) ? messages : [];
    const sessions = await fetchRoomSessions(roomId);
    return mergeMessagesWithHistory(messages, sessions, roomId, meId);
  }

  function renderHistoryItemHtml(item, formatters) {
    const hist = item?.callHistory || {};
    const formatTime = formatters?.formatTime || ((iso) => pickStr(iso));
    const esc = formatters?.escapeHtml || escapeHtml;
    const text = esc(hist.text || "通話");
    const duration = hist.durationLabel ? esc(hist.durationLabel) : "";
    const time = esc(formatTime(item.createdAt));
    const timeIso = esc(item.createdAt || "");
    const direction = esc(hist.direction === "outgoing" ? "発信" : "着信");
    const icon = esc(hist.icon || "📞");
    const sessionId = esc(hist.sessionId || item.callSessionId || "");
    const roomId = esc(hist.roomId || "");

    return (
      `<div class="chat-call-history chat-system-msg chat-system-msg--call" role="status" data-talk-call-history-item data-call-id="${sessionId}" data-room-id="${roomId}" data-call-direction="${esc(hist.direction || "")}" data-call-status="${esc(hist.status || "")}">` +
      `<div class="chat-call-history__inner">` +
      `<span class="chat-call-history__icon" aria-hidden="true">${icon}</span>` +
      `<div class="chat-call-history__body">` +
      `<span class="chat-call-history__label">${direction}</span>` +
      `<p class="chat-call-history__text">${text}</p>` +
      (duration ? `<p class="chat-call-history__duration">通話時間 ${duration}</p>` : "") +
      `</div>` +
      `<time class="chat-call-history__time" datetime="${timeIso}">${time}</time>` +
      `</div>` +
      `</div>`
    );
  }

  function dispatchNotifyChanged() {
    try {
      global.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", {
          detail: { source: SOURCE, notifyOnly: true },
        })
      );
    } catch {
      /* ignore */
    }
  }

  function upsertHistoryNotification(session) {
    const meId = getMeId();
    if (!meId || !session?.id || !Signaling()?.isParticipant?.(session, meId)) return;
    const status = String(session.status || "");
    if (!HISTORY_STATUSES.has(status)) return;

    const roomId = pickStr(session.room_id);
    if (!roomId) return;

    const pres = resolvePresentation(session, meId);
    const durationPart = pres.durationLabel ? `（${pres.durationLabel}）` : "";
    const href = buildChatDetailHref(roomId);

    global.TasuTalkNotifications?.add?.({
      id: historyNotifyId(session.id),
      type: "general",
      source: SOURCE,
      subType: SUB_TYPE_HISTORY,
      category: "通話履歴",
      title: pres.text,
      body: durationPart ? `通話時間 ${pres.durationLabel}` : "チャットで詳細を確認できます",
      priority: "normal",
      recipientUserId: meId,
      senderUserId: String(session.caller_id) === meId ? session.callee_id : session.caller_id,
      threadId: roomId,
      callSessionId: String(session.id),
      targetUrl: href,
      href,
      actionLabel: "チャットを開く",
      emphasis: "normal",
    });
    dispatchNotifyChanged();
  }

  function isTalkCallHistoryNotification(n) {
    return String(n?.source || "") === SOURCE && String(n?.subType || "") === SUB_TYPE_HISTORY;
  }

  function setActiveRoomId(roomId) {
    activeRoomId = String(roomId || "").trim();
  }

  async function refreshActiveRoom(roomId) {
    const rid = pickStr(roomId, activeRoomId);
    if (!rid) return;
    activeRoomId = rid;
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:talk-call-history-refresh", { detail: { roomId: rid } })
      );
    } catch {
      /* ignore */
    }
  }

  function onSessionTerminal(session) {
    if (!session?.id) return;
    const status = String(session.status || "");
    if (!HISTORY_STATUSES.has(status)) return;

    global.TasuTalkCallNotifyBridge?.onSessionHistory?.(session);
    upsertHistoryNotification(session);
    refreshActiveRoom(session.room_id).catch(() => {});
  }

  global.TasuTalkCallHistory = {
    SOURCE,
    SUB_TYPE_HISTORY,
    MAX_ROOM_HISTORY,
    HISTORY_STATUSES,
    historyItemId,
    historyNotifyId,
    resolvePresentation,
    sessionToTimelineItem,
    sessionsToTimelineItems,
    mergeMessagesWithHistory,
    mergeMessagesForRoom,
    fetchRoomSessions,
    renderHistoryItemHtml,
    upsertHistoryNotification,
    isTalkCallHistoryNotification,
    setActiveRoomId,
    refreshActiveRoom,
    onSessionTerminal,
    computeDurationSec,
    formatDuration,
  };
})(typeof window !== "undefined" ? window : globalThis);
