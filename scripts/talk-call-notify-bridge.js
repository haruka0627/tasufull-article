/**
 * TASFUL TALK — 通話着信 × 通知センター連携（Phase3）
 * talk-home フォアグラウンド着信を通知カードとして表示する。
 */
(function (global) {
  "use strict";

  const SOURCE = "talk_call_v1";
  const SUB_TYPE = "incoming_call";
  const SUB_TYPE_HISTORY = "call_history";
  const POLL_MS = 2500;

  /** @type {number|null} */
  let pollTimerId = null;
  /** @type {boolean} */
  let initialized = false;
  /** @type {Set<string>} */
  const trackedRinging = new Set();

  const Signaling = () => global.TasuTalkCallSignaling;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isTalkHomePage() {
    return (
      document.body?.dataset?.page === "talk-home" ||
      /talk-home\.html/i.test(String(global.location?.pathname || ""))
    );
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      Signaling()?.getMeId?.() ||
      ""
    );
  }

  function notifyIdForSession(sessionId) {
    return `talk-call-${String(sessionId || "").trim()}`;
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

  function resolveCallerDisplayName(session) {
    const callerId = pickStr(session?.caller_id);
    const roomId = pickStr(session?.room_id);
    if (roomId) {
      const threads =
        global.TasuTalkData?.getChatThreads?.() ||
        global.TasuTalkLineRoom?.getThreadList?.() ||
        [];
      const thread = (Array.isArray(threads) ? threads : []).find(
        (row) => String(row?.id || "") === roomId
      );
      if (thread) {
        const buyer = pickStr(thread.buyerId, thread.buyer_id);
        const seller = pickStr(thread.sellerId, thread.seller_id);
        const meId = getMeId();
        if (callerId && callerId !== meId) {
          const partner =
            thread.partner?.displayName ||
            thread.partnerProfile?.display_name ||
            (meId === buyer ? seller : buyer) ||
            callerId;
          if (partner && partner !== meId) return String(partner);
        }
      }
    }
    return callerId || "相手";
  }

  function buildAcceptHref(roomId, callId) {
    const url = new URL("chat-detail.html", global.location?.origin || "http://localhost");
    url.searchParams.set("thread", roomId);
    url.searchParams.set("callId", callId);
    url.searchParams.set("from", "notify");
    let href = url.pathname + url.search;
    if (global.TasuChatUserIdentity?.appendUserIdToUrl) {
      href = global.TasuChatUserIdentity.appendUserIdToUrl(href);
    }
    if (global.TasuTalkNotifyActions?.appendFromNotifyParam) {
      href = global.TasuTalkNotifyActions.appendFromNotifyParam(href);
    }
    return href;
  }

  function pruneStaleRoomCallNotifications(roomId, keepSessionId) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.remove) return;
    const list = store.getAll() || [];
    list.forEach((n) => {
      if (String(n?.source || "") !== SOURCE) return;
      if (pickStr(n?.threadId, n?.thread_id) !== roomId) return;
      const sid = pickStr(n?.callSessionId, n?.call_session_id, String(n?.id || "").replace(/^talk-call-/, ""));
      if (sid && sid !== keepSessionId) {
        store.remove(n.id);
      }
    });
  }

  function removeCallNotification(sessionId) {
    const id = notifyIdForSession(sessionId);
    trackedRinging.delete(String(sessionId));
    if (global.TasuTalkNotifications?.remove?.(id)) {
      dispatchNotifyChanged();
    }
  }

  function upsertCallNotification(session) {
    const meId = getMeId();
    if (!meId || !session?.id) return;
    if (String(session.callee_id) !== meId) return;
    if (String(session.caller_id) === meId) return;
    if (String(session.status || "") !== "ringing") return;
    const expiresAt = String(session.expires_at || "");
    if (expiresAt && expiresAt <= new Date().toISOString()) return;

    const sessionId = String(session.id);
    const roomId = pickStr(session.room_id);
    if (!roomId) return;

    pruneStaleRoomCallNotifications(roomId, sessionId);

    const callerName = resolveCallerDisplayName(session);
    const notifyId = notifyIdForSession(sessionId);
    const href = buildAcceptHref(roomId, sessionId);

    global.TasuTalkNotifications?.add?.({
      id: notifyId,
      type: "general",
      source: SOURCE,
      subType: SUB_TYPE,
      category: "通話",
      title: "音声通話の着信",
      body: `${callerName}さんから通話リクエストがあります`,
      priority: "urgent",
      recipientUserId: meId,
      senderUserId: session.caller_id,
      threadId: roomId,
      callSessionId: sessionId,
      targetUrl: href,
      href,
      actionLabel: "応答する",
      emphasis: "important",
    });

    trackedRinging.add(sessionId);
    dispatchNotifyChanged();
  }

  function onSessionUpdate(session, _eventType) {
    if (!isTalkHomePage()) return;
    const meId = getMeId();
    if (!meId || !session?.id) return;
    if (!Signaling()?.isParticipant?.(session, meId)) return;

    const status = String(session.status || "");
    if (status === "ringing" && String(session.callee_id) === meId && String(session.caller_id) !== meId) {
      upsertCallNotification(session);
      return;
    }
    if (["ended", "rejected", "missed"].includes(status)) {
      removeCallNotification(session.id);
      global.TasuTalkCallPushEvents?.cancelForSession?.(session, { force: false }).catch(() => {});
    }
  }

  function onSessionHistory(session) {
    if (!session?.id) return;
    removeCallNotification(session.id);
  }

  async function reconcileStoredCallNotifications() {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll) return;
    const rows = (store.getAll() || []).filter((n) => String(n?.source || "") === SOURCE);
    for (const n of rows) {
      const sid = pickStr(n.callSessionId, n.call_session_id, String(n.id || "").replace(/^talk-call-/, ""));
      if (!sid) {
        store.remove?.(n.id);
        continue;
      }
      const session = await Signaling().fetchSession(sid);
      const meId = getMeId();
      const stillRinging =
        session &&
        String(session.status || "") === "ringing" &&
        String(session.callee_id) === meId &&
        String(session.expires_at || "") > new Date().toISOString();
      if (!stillRinging) {
        removeCallNotification(sid);
      }
    }
  }

  async function pollIncomingCalls() {
    if (!isTalkHomePage()) return;
    const meId = getMeId();
    const sb = global.TasuSupabase?.getClient?.();
    if (!meId || !sb || !Signaling()?.SESSIONS_TABLE) return;

    const now = new Date().toISOString();
    const { data } = await sb
      .from(Signaling().SESSIONS_TABLE)
      .select("*")
      .eq("callee_id", meId)
      .eq("status", "ringing")
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = Array.isArray(data) ? data : [];
    const latestByRoom = new Map();
    rows.forEach((row) => {
      const roomId = pickStr(row?.room_id);
      if (!roomId || latestByRoom.has(roomId)) return;
      if (String(row.caller_id) === meId) return;
      latestByRoom.set(roomId, row);
    });

    const activeIds = new Set();
    latestByRoom.forEach((row) => {
      activeIds.add(String(row.id));
      onSessionUpdate(row, "poll");
    });

    [...trackedRinging].forEach((sid) => {
      if (!activeIds.has(sid)) {
        removeCallNotification(sid);
      }
    });

    await reconcileStoredCallNotifications();
  }

  function startPoll() {
    if (pollTimerId) return;
    pollTimerId = global.setInterval(() => {
      pollIncomingCalls().catch(() => {});
    }, POLL_MS);
  }

  function stopPoll() {
    if (pollTimerId) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  }

  async function rejectCall(sessionId) {
    const sid = pickStr(sessionId);
    if (!sid) return { ok: false, reason: "missing_session" };
    const svc = global.TasuTalkCallService;
    if (svc?.rejectCallSession) {
      const res = await svc.rejectCallSession(sid);
      if (res?.ok) {
        removeCallNotification(sid);
      }
      return res || { ok: false };
    }
    return { ok: false, reason: "no_service" };
  }

  function init() {
    if (!isTalkHomePage()) return;
    if (!getMeId()) return;
    initialized = true;
    global.TasuTalkCallService?.init?.();
    startPoll();
    pollIncomingCalls().catch(() => {});
    reconcileStoredCallNotifications().catch(() => {});
    global.TasuTalkPushSubscribe?.trySyncSubscription?.().catch(() => {});
  }

  global.TasuTalkCallNotifyBridge = {
    SOURCE,
    SUB_TYPE,
    isTalkCallIncomingNotification(n) {
      return (
        String(n?.source || "") === SOURCE &&
        String(n?.subType || "") === SUB_TYPE
      );
    },
    isTalkCallHistoryNotification(n) {
      return global.TasuTalkCallHistory?.isTalkCallHistoryNotification?.(n) === true;
    },
    notifyIdForSession,
    buildAcceptHref,
    resolveCallerDisplayName,
    onSessionUpdate,
    onSessionHistory,
    pollIncomingCalls,
    rejectCall,
    init,
    stopPoll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
