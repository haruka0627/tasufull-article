/**
 * TASFUL TALK — 1対1音声通話サービス（Phase1 MVP）
 */
(function (global) {
  "use strict";

  const Signaling = () => global.TasuTalkCallSignaling;
  const WebRtc = () => global.TasuTalkCallWebRtc;
  const Ui = () => global.TasuTalkCallUi;

  /** @type {object|null} */
  let currentSession = null;
  /** @type {"caller"|"callee"|null} */
  let currentRole = null;
  /** @type {string} */
  let peerDisplayName = "";
  /** @type {number|null} */
  let ringTimeoutId = null;
  /** @type {boolean} */
  let muted = false;
  /** @type {Set<string>} */
  const seenSignalIds = new Set();
  /** @type {boolean} */
  let initialized = false;
  /** @type {string} */
  let initUserId = "";
  /** @type {boolean} */
  let offerStarted = false;

  function getMeId() {
    return Signaling()?.getMeId?.() || "u_me";
  }

  function isAvailable() {
    return Signaling()?.isAvailable?.() === true;
  }

  function isOfficialThread(thread) {
    const id = String(thread?.id || "");
    return Boolean(
      thread?._officialRoom || global.TasuTalkOfficialRooms?.isOfficialRoomId?.(id)
    );
  }

  function isGroupThread(thread) {
    const kind = String(thread?.threadKind || thread?.thread_kind || thread?.kind || "").toLowerCase();
    if (kind === "group") return true;
    if (Array.isArray(thread?.participantIds) && thread.participantIds.length > 2) return true;
    return false;
  }

  function isSystemThread(thread) {
    if (thread?._staticCard) return true;
    const kind = String(thread?.threadKind || thread?.thread_kind || thread?.kind || "").toLowerCase();
    return kind === "system" || kind === "official";
  }

  function isTalkHomePage() {
    return (
      document.body?.dataset?.page === "talk-home" ||
      /talk-home\.html/i.test(String(global.location?.pathname || ""))
    );
  }

  function getActiveCallRoomId() {
    const chatDetail = global.TasuTalkCallChatDetail;
    if (chatDetail?.isPageActive?.()) {
      return String(chatDetail.getActiveRoomId?.() || "").trim();
    }
    const lineThread = global.TasuTalkLineRoom?.getActiveThread?.();
    return String(lineThread?.id || "").trim();
  }

  function shouldShowIncomingOverlay(session) {
    if (!session?.room_id) return false;
    const roomId = String(session.room_id);

    if (global.TasuTalkCallChatDetail?.isPageActive?.()) {
      const active = String(global.TasuTalkCallChatDetail.getActiveRoomId?.() || "").trim();
      return !active || active === roomId;
    }

    if (isTalkHomePage()) {
      const onChatTab = document.body?.classList?.contains("talk-home--tab-chat") === true;
      if (!onChatTab) return false;
      const active = String(global.TasuTalkLineRoom?.getActiveThread?.()?.id || "").trim();
      return active === roomId;
    }

    const activeRoomId = getActiveCallRoomId();
    if (!activeRoomId) return false;
    return activeRoomId === roomId;
  }

  function matchesActiveCallContext(session) {
    return shouldShowIncomingOverlay(session);
  }

  function resolvePeerNameFromContext(session) {
    const roomId = String(session?.room_id || "");
    const chatDetail = global.TasuTalkCallChatDetail;
    if (chatDetail?.isPageActive?.()) {
      const active = chatDetail.getActiveThread?.();
      if (active && String(active.id) === roomId) {
        return resolvePeerName(buildCallThreadFromAny(active));
      }
    }
    const lineThread = global.TasuTalkLineRoom?.getActiveThread?.();
    if (lineThread && String(lineThread.id) === roomId) {
      return resolvePeerName(lineThread);
    }
    return String(session?.caller_id || "相手");
  }

  function buildCallThreadFromAny(thread) {
    if (global.TasuTalkCallChatDetail?.buildCallThread) {
      return global.TasuTalkCallChatDetail.buildCallThread(thread) || thread;
    }
    return thread;
  }

  function resolvePartnerId(thread) {
    const meId = getMeId();
    let partnerId = String(
      global.TasuTalkChatThreadModel?.resolvePartnerUserId?.(thread) ||
        thread?.partnerUserId ||
        thread?.partner_user_id ||
        thread?.partner?.id ||
        ""
    ).trim();
    if (!partnerId || partnerId === meId) {
      const buyer = String(thread?.buyerId || thread?.buyer_id || "").trim();
      const seller = String(thread?.sellerId || thread?.seller_id || "").trim();
      if (buyer && seller) {
        if (meId === buyer) partnerId = seller;
        else if (meId === seller) partnerId = buyer;
      }
    }
    if (!partnerId || partnerId === meId) return "";
    return partnerId;
  }

  function resolvePeerName(thread) {
    const profile = thread?.partnerProfile || {};
    return (
      String(profile.display_name || "").trim() ||
      String(thread?.partner?.displayName || thread?.partner?.name || "").trim() ||
      "相手"
    );
  }

  function canCallThread(thread) {
    if (!isAvailable()) return false;
    if (!thread?.id || thread._staticCard) return false;
    if (isOfficialThread(thread)) return false;
    if (isSystemThread(thread)) return false;
    if (isGroupThread(thread)) return false;
    const partnerId = resolvePartnerId(thread);
    if (!partnerId || partnerId === getMeId()) return false;
    return true;
  }

  function clearRingTimeout() {
    if (ringTimeoutId) {
      clearTimeout(ringTimeoutId);
      ringTimeoutId = null;
    }
  }

  function scheduleRingTimeout(sessionId) {
    clearRingTimeout();
    ringTimeoutId = global.setTimeout(async () => {
      ringTimeoutId = null;
      if (!currentSession || currentSession.id !== sessionId) return;
      const fresh = await Signaling().fetchSession(sessionId);
      if (fresh?.status === "ringing") {
        try {
          await Signaling().updateSessionStatus(sessionId, "missed");
        } catch (err) {
          console.warn("[TasuTalkCallService] missed update:", err);
        }
        Ui()?.showToast?.("応答がありませんでした");
        await cleanup("missed");
      }
    }, Signaling().RING_TIMEOUT_MS);
  }

  async function cleanup(reason) {
    clearRingTimeout();
    stopSessionSyncPoll();
    seenSignalIds.clear();
    offerStarted = false;
    muted = false;
    WebRtc()?.close?.();
    currentSession = null;
    currentRole = null;
    peerDisplayName = "";
    Ui()?.hide?.();
    if (reason && reason !== "silent") {
      /* toast handled by caller */
    }
  }

  async function attachWebRtcHandlers(sessionId) {
    WebRtc().createPeerConnection({
      onIceCandidate: async (candidate) => {
        if (!currentSession || currentSession.id !== sessionId) return;
        try {
          await Signaling().insertSignal({
            sessionId,
            senderId: getMeId(),
            signalType: "candidate",
            payload: candidate,
          });
        } catch (err) {
          console.warn("[TasuTalkCallService] ICE send:", err);
        }
      },
      onConnectionState: (state) => {
        if (state === "failed") {
          Ui()?.showToast?.("通話接続に失敗しました。通信環境を確認してください。");
          hangup("failed").catch(() => {});
        }
      },
    });
    await WebRtc().attachLocalTracks();
  }

  async function beginCallerOffer(session) {
    if (offerStarted || !session?.id) return;
    offerStarted = true;
    await attachWebRtcHandlers(session.id);
    const localDesc = await WebRtc().createOffer();
    await Signaling().insertSignal({
      sessionId: session.id,
      senderId: getMeId(),
      signalType: "offer",
      payload: { type: localDesc.type, sdp: localDesc.sdp },
    });
  }

  async function handleOfferSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (currentRole !== "callee" || currentSession.status !== "active") return;
    if (!signal.payload?.sdp) return;
    if (!WebRtc().getPeerConnection()) {
      await attachWebRtcHandlers(currentSession.id);
    }
    const answerDesc = await WebRtc().acceptOffer({
      type: signal.payload.type || "offer",
      sdp: signal.payload.sdp,
    });
    await Signaling().insertSignal({
      sessionId: currentSession.id,
      senderId: getMeId(),
      signalType: "answer",
      payload: { type: answerDesc.type, sdp: answerDesc.sdp },
    });
  }

  async function handleAnswerSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (currentRole !== "caller") return;
    if (!signal.payload?.sdp) return;
    await WebRtc().acceptAnswer({
      type: signal.payload.type || "answer",
      sdp: signal.payload.sdp,
    });
  }

  async function handleCandidateSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (String(signal.sender_id) === getMeId()) return;
    await WebRtc().addIceCandidate(signal.payload);
  }

  async function handleHangupSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    Ui()?.showToast?.("通話が終了しました");
    await cleanup("hangup");
  }

  async function handleSignal(signal) {
    if (!signal?.id || seenSignalIds.has(signal.id)) return;
    seenSignalIds.add(signal.id);

    const sessionId = signal.session_id;
    const session = await Signaling().fetchSession(sessionId);
    if (!session || !Signaling().isParticipant(session, getMeId())) return;

    if (!currentSession && session.status === "ringing" && session.callee_id === getMeId()) {
      await showIncomingSession(session);
      return;
    }

    if (!currentSession || currentSession.id !== sessionId) return;

    const type = signal.signal_type;
    if (type === "offer") await handleOfferSignal(signal);
    else if (type === "answer") await handleAnswerSignal(signal);
    else if (type === "candidate") await handleCandidateSignal(signal);
    else if (type === "hangup") await handleHangupSignal(signal);
  }

  async function showIncomingSession(session) {
    if (currentSession) return;
    if (!matchesActiveCallContext(session)) return;
    currentSession = session;
    currentRole = "callee";
    peerDisplayName = resolvePeerNameFromContext(session);
    Ui()?.showIncoming?.(peerDisplayName);
    scheduleRingTimeout(session.id);
    startSessionSyncPoll(session.id);
  }

  async function onSessionChange(session, eventType) {
    if (!session?.id || !Signaling().isParticipant(session, getMeId())) return;

    global.TasuTalkCallNotifyBridge?.onSessionUpdate?.(session, eventType);

    if (["ended", "missed", "rejected"].includes(String(session.status || ""))) {
      global.TasuTalkCallHistory?.onSessionTerminal?.(session);
      global.TasuTalkCallPushEvents?.cancelForSession?.(session).catch(() => {});
    }

    if (String(session.status || "") === "active") {
      global.TasuTalkCallPushEvents?.cancelForSession?.(session).catch(() => {});
    }

    if (!matchesActiveCallContext(session)) {
      if (!currentSession || currentSession.id !== session.id) return;
    }

    if (
      !currentSession &&
      session.status === "ringing" &&
      session.callee_id === getMeId()
    ) {
      await showIncomingSession(session);
      return;
    }

    if (!currentSession || currentSession.id !== session.id) return;

    currentSession = session;

    if (session.status === "active") {
      clearRingTimeout();
      if (currentRole === "caller") {
        Ui()?.showActive?.(peerDisplayName, muted);
        await beginCallerOffer(session);
      } else if (currentRole === "callee") {
        Ui()?.showActive?.(peerDisplayName, muted);
      }
      return;
    }

    if (["ended", "missed", "rejected"].includes(session.status)) {
      const msg =
        session.status === "rejected"
          ? "通話が拒否されました"
          : session.status === "missed"
            ? "応答がありませんでした"
            : "通話が終了しました";
      Ui()?.showToast?.(msg);
      await cleanup(session.status);
    }
  }

  async function pollRingingSessions() {
    if (currentSession || !isAvailable()) return;
    const sb = global.TasuSupabase?.getClient?.();
    const uid = getMeId();
    if (!sb) return;
    const now = new Date().toISOString();
    const { data } = await sb
      .from(Signaling().SESSIONS_TABLE)
      .select("*")
      .eq("callee_id", uid)
      .eq("status", "ringing")
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);
    const rows = Array.isArray(data) ? data : [];
    const row = rows.find((item) => matchesActiveCallContext(item)) || null;
    if (row) await showIncomingSession(row);
  }

  function init() {
    const uid = String(getMeId() || "");
    if (initialized && initUserId === uid) {
      pollRingingSessions().catch(() => {});
      return;
    }
    if (initialized) {
      Signaling()?.unsubscribeRealtime?.();
    }
    initialized = true;
    initUserId = uid;

    Ui()?.setHandlers?.({
      onCancel: () => {
        cancelOutgoing().catch((err) => Ui()?.showToast?.(err.message || "キャンセルに失敗しました"));
      },
      onAccept: () => {
        acceptIncoming().catch((err) => Ui()?.showToast?.(err.message || "応答に失敗しました"));
      },
      onReject: () => {
        rejectIncoming().catch((err) => Ui()?.showToast?.(err.message || "拒否に失敗しました"));
      },
      onHangup: () => {
        hangup("user").catch((err) => Ui()?.showToast?.(err.message || "終了に失敗しました"));
      },
      onToggleMute: () => {
        muted = !WebRtc().isMuted();
        WebRtc().setMuted(muted);
        Ui()?.showActive?.(peerDisplayName, muted);
      },
    });

    Signaling()?.subscribeRealtime?.({
      onSessionChange,
      onSignal: (signal) => {
        handleSignal(signal).catch((err) => console.warn("[TasuTalkCallService] signal:", err));
      },
    });

    pollRingingSessions().catch(() => {});
  }

  async function initiateCall(thread) {
    init();
    const callThread = buildCallThreadFromAny(thread);
    if (!canCallThread(callThread)) {
      throw new Error("このルームでは通話できません");
    }
    if (currentSession) {
      throw new Error("通話中です");
    }

    const callerId = getMeId();
    const calleeId = resolvePartnerId(callThread);
    peerDisplayName = resolvePeerName(callThread);

    const busyCallee = await Signaling().findBusyUser(calleeId);
    if (busyCallee) {
      Ui()?.showToast?.("相手は通話中です");
      return { ok: false, reason: "busy" };
    }
    const busySelf = await Signaling().findBusyUser(callerId);
    if (busySelf) {
      Ui()?.showToast?.("通話中のため発信できません");
      return { ok: false, reason: "busy_self" };
    }

    const session = await Signaling().createSession({
      roomId: callThread.id,
      callerId,
      calleeId,
    });

    global.TasuTalkCallPushEvents?.enqueueForRingingSession?.(session, {
      actorUserId: callerId,
      callerDisplayName: peerDisplayName,
    }).catch(() => {});

    currentSession = session;
    currentRole = "caller";
    seenSignalIds.clear();
    offerStarted = false;

    Ui()?.showOutgoing?.(peerDisplayName);
    scheduleRingTimeout(session.id);
    startSessionSyncPoll(session.id);
    return { ok: true, sessionId: session.id };
  }

  /** @type {number|null} */
  let sessionSyncPollId = null;

  function stopSessionSyncPoll() {
    if (sessionSyncPollId) {
      clearInterval(sessionSyncPollId);
      sessionSyncPollId = null;
    }
  }

  function startSessionSyncPoll(sessionId) {
    stopSessionSyncPoll();
    sessionSyncPollId = global.setInterval(() => {
      if (!currentSession || currentSession.id !== sessionId) {
        stopSessionSyncPoll();
        return;
      }
      Signaling()
        .fetchSession(sessionId)
        .then((fresh) => {
          if (!fresh || !currentSession || currentSession.id !== sessionId) return;
          if (fresh.status !== currentSession.status) {
            onSessionChange(fresh, "poll").catch(() => {});
          }
        })
        .catch(() => {});
    }, 1500);
  }

  async function acceptIncoming() {
    if (!currentSession || currentRole !== "callee") return;
    if (currentSession.status !== "ringing") return;

    const updated = await Signaling().updateSessionStatus(currentSession.id, "active");
    currentSession = updated;
    clearRingTimeout();
    await attachWebRtcHandlers(currentSession.id);
    Ui()?.showActive?.(peerDisplayName, muted);
    startSessionSyncPoll(currentSession.id);

    const prior = await Signaling().fetchSignalsSince(currentSession.id, "");
    for (const sig of prior) {
      await handleSignal(sig);
    }
  }

  async function rejectIncoming() {
    if (!currentSession || currentRole !== "callee") return;
    await rejectCallSession(currentSession.id);
  }

  async function rejectCallSession(sessionId) {
    const sid = String(sessionId || "").trim();
    if (!sid) return { ok: false, reason: "missing_session" };
    const session = await Signaling().fetchSession(sid);
    if (!session || String(session.callee_id) !== getMeId()) {
      return { ok: false, reason: "not_callee" };
    }
    if (String(session.status || "") !== "ringing") {
      return { ok: false, reason: "not_ringing", status: session.status };
    }
    await Signaling().updateSessionStatus(sid, "rejected");
    await Signaling().insertSignal({
      sessionId: sid,
      senderId: getMeId(),
      signalType: "hangup",
      payload: { reason: "rejected" },
    });
    if (currentSession?.id === sid) {
      Ui()?.showToast?.("通話が拒否されました");
      await cleanup("rejected");
    }
    global.TasuTalkCallNotifyBridge?.onSessionUpdate?.(
      { ...session, status: "rejected" },
      "reject"
    );
    return { ok: true };
  }

  async function prepareIncomingForCallId(callId) {
    init();
    const sid = String(callId || "").trim();
    if (!sid) return { ok: false, reason: "missing_call_id" };
    const session = await Signaling().fetchSession(sid);
    if (!session || String(session.callee_id) !== getMeId()) {
      return { ok: false, reason: "not_callee" };
    }
    if (String(session.status || "") !== "ringing") {
      return { ok: false, reason: "not_ringing", status: session.status };
    }
    const roomId = String(session.room_id || "");
    const activeRoom = getActiveCallRoomId();
    if (activeRoom && roomId && activeRoom !== roomId) {
      return { ok: false, reason: "room_mismatch" };
    }
    if (!currentSession) {
      await showIncomingSession(session);
    }
    return { ok: true, sessionId: sid };
  }

  async function cancelOutgoing() {
    if (!currentSession || currentRole !== "caller") return;
    if (currentSession.status === "ringing") {
      await Signaling().updateSessionStatus(currentSession.id, "ended");
      await Signaling().insertSignal({
        sessionId: currentSession.id,
        senderId: getMeId(),
        signalType: "hangup",
        payload: { reason: "cancel" },
      });
    }
    await cleanup("cancel");
  }

  async function hangup(reason) {
    if (!currentSession) return;
    const sessionId = currentSession.id;
    if (currentSession.status === "active" || currentSession.status === "ringing") {
      try {
        await Signaling().insertSignal({
          sessionId,
          senderId: getMeId(),
          signalType: "hangup",
          payload: { reason: reason || "hangup" },
        });
      } catch {
        /* ignore */
      }
      try {
        await Signaling().updateSessionStatus(sessionId, "ended");
      } catch {
        /* ignore */
      }
    }
    await cleanup("ended");
  }

  global.TasuTalkCallService = {
    init,
    isAvailable,
    canCallThread,
    isOfficialThread,
    isGroupThread,
    isSystemThread,
    initiateCall,
    acceptIncoming,
    rejectIncoming,
    rejectCallSession,
    prepareIncomingForCallId,
    cancelOutgoing,
    hangup,
    refreshIncomingForActiveRoom: pollRingingSessions,
    getCurrentSession: () => currentSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
