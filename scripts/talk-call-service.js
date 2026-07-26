/**
 * TASFUL TALK — 1対1音声通話サービス（talk-voice-core 経由 · WebRTC adapter）
 */
(function (global) {
  "use strict";

  const Signaling = () => global.TasuTalkCallSignaling;
  const Ui = () => global.TasuTalkCallUi;
  const Core = () => global.TasuTalkVoiceCore;
  const Provider = () => Core()?.getProvider?.() || global.TasuTalkVoiceWebRtcAdapter?.getDefault?.();

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
  /** @type {number|null} */
  let heartbeatTimerId = null;
  /** @type {ReturnType<typeof Core> extends never ? any : any} */
  let voiceMachine = null;

  function ensureMachine() {
    if (!voiceMachine) {
      voiceMachine = Core()?.stateMachine?.()?.createMachine?.("idle") || null;
    }
    return voiceMachine;
  }

  function machineGo(to) {
    const m = ensureMachine();
    if (!m) return { ok: true, state: to };
    return m.go(to);
  }

  function stopHeartbeat() {
    if (heartbeatTimerId) {
      clearInterval(heartbeatTimerId);
      heartbeatTimerId = null;
    }
  }

  function startHeartbeat(sessionId) {
    stopHeartbeat();
    const cfg = Core()?.entitlement?.()?.getConfig?.() || {};
    const intervalSec = Math.max(30, Number(cfg.heartbeat_interval_sec) || 45);
    heartbeatTimerId = global.setInterval(() => {
      if (!currentSession || currentSession.id !== sessionId) {
        stopHeartbeat();
        return;
      }
      if (String(currentSession.status || "") !== "active") return;
      Signaling()
        ?.heartbeatSession?.(sessionId)
        .catch(() => {});
    }, intervalSec * 1000);
  }

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
    const perm = Core()?.permissions?.()?.assertCanStartCall?.({
      thread,
      authUserId: getMeId(),
      helpers: {
        isOfficialRoomId: (id) => global.TasuTalkOfficialRooms?.isOfficialRoomId?.(id),
        resolvePartnerUserId: (t) => global.TasuTalkChatThreadModel?.resolvePartnerUserId?.(t),
      },
    });
    if (perm && !perm.ok) return false;
    if (!perm) {
      if (!thread?.id || thread._staticCard) return false;
      if (isOfficialThread(thread) || isSystemThread(thread) || isGroupThread(thread)) return false;
      const partnerId = resolvePartnerId(thread);
      if (!partnerId || partnerId === getMeId()) return false;
    }
    const ent = Core()?.entitlement?.()?.evaluateEntitlement?.({
      activeSessionExists: Boolean(currentSession),
    });
    if (ent && !ent.allowed && ent.reason !== "active_session_exists") return false;
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
    stopHeartbeat();
    seenSignalIds.clear();
    offerStarted = false;
    muted = false;
    try {
      await Provider()?.dispose?.();
    } catch {
      /* ignore */
    }
    currentSession = null;
    currentRole = null;
    peerDisplayName = "";
    machineGo("ended");
    machineGo("idle");
    Ui()?.hide?.();
    if (reason && reason !== "silent") {
      /* toast handled by caller */
    }
  }

  function iceHandlers(sessionId) {
    return {
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
        if (state === "connected" || state === "completed") {
          machineGo("connected");
          startHeartbeat(sessionId);
        } else if (state === "connecting") {
          machineGo("connecting");
        } else if (state === "disconnected") {
          machineGo("reconnecting");
        } else if (state === "failed") {
          Ui()?.showToast?.("通話接続に失敗しました。通信環境を確認してください。");
          hangup("failed").catch(() => {});
        }
      },
    };
  }

  async function beginCallerOffer(session) {
    if (offerStarted || !session?.id) return;
    offerStarted = true;
    machineGo("connecting");
    const res = await Provider().createOutgoingConnection(iceHandlers(session.id));
    if (!res?.ok) {
      const mapped = Core()?.errors?.()?.mapProviderError?.(res) || res;
      if (mapped?.code === "media_permission_denied") {
        Ui()?.showToast?.(mapped.message || "マイクが許可されていません");
        await hangup("media_denied");
        return;
      }
      Ui()?.showToast?.(mapped?.message || "発信に失敗しました");
      await hangup("failed");
      return;
    }
    if (res.localDescription) {
      await Signaling().insertSignal({
        sessionId: session.id,
        senderId: getMeId(),
        signalType: "offer",
        payload: res.localDescription,
      });
    }
  }

  async function handleOfferSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (currentRole !== "callee" || currentSession.status !== "active") return;
    if (!signal.payload?.sdp) return;
    const gate = Core()?.permissions?.()?.assertSignalAllowed?.(
      currentSession,
      getMeId(),
      "offer"
    );
    if (gate && !gate.ok) return;
    if (!Provider().getPeerConnection?.()) {
      const prep = await Provider().acceptIncomingConnection(iceHandlers(currentSession.id));
      if (!prep?.ok) {
        Ui()?.showToast?.(prep?.message || "応答に失敗しました");
        await hangup("failed");
        return;
      }
    }
    const answer = await Provider().applyRemoteDescription({
      type: signal.payload.type || "offer",
      sdp: signal.payload.sdp,
    });
    if (answer?.localDescription) {
      await Signaling().insertSignal({
        sessionId: currentSession.id,
        senderId: getMeId(),
        signalType: "answer",
        payload: answer.localDescription,
      });
    }
  }

  async function handleAnswerSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (currentRole !== "caller") return;
    if (!signal.payload?.sdp) return;
    await Provider().applyRemoteDescription({
      type: signal.payload.type || "answer",
      sdp: signal.payload.sdp,
    });
  }

  async function handleCandidateSignal(signal) {
    if (!currentSession || signal.session_id !== currentSession.id) return;
    if (String(signal.sender_id) === getMeId()) return;
    await Provider().addIceCandidate({ candidate: signal.payload });
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
    machineGo("ringing_incoming");
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
      machineGo("connecting");
      if (currentRole === "caller") {
        Ui()?.showActive?.(peerDisplayName, muted);
        await beginCallerOffer(session);
      } else if (currentRole === "callee") {
        Ui()?.showActive?.(peerDisplayName, muted);
        startHeartbeat(session.id);
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
        muted = !Provider().isMuted?.();
        Provider().setMuted(muted);
        Ui()?.showActive?.(peerDisplayName, muted);
      },
    });

    ensureMachine();
    Provider()?.initialize?.().catch(() => {});

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
    const authorizing = machineGo("authorizing");
    if (!authorizing.ok && ensureMachine()?.getState?.() !== "idle") {
      throw new Error("通話処理中です");
    }

    const perm = Core()?.permissions?.()?.assertCanStartCall?.({
      thread: callThread,
      authUserId: getMeId(),
      helpers: {
        isOfficialRoomId: (id) => global.TasuTalkOfficialRooms?.isOfficialRoomId?.(id),
        resolvePartnerUserId: (t) => global.TasuTalkChatThreadModel?.resolvePartnerUserId?.(t),
      },
    });
    if (perm && !perm.ok) {
      machineGo("failed");
      machineGo("idle");
      throw new Error("このルームでは通話できません");
    }
    if (!perm && !canCallThread(callThread)) {
      machineGo("failed");
      machineGo("idle");
      throw new Error("このルームでは通話できません");
    }
    if (currentSession) {
      machineGo("failed");
      machineGo("idle");
      throw new Error("通話中です");
    }

    const ent = Core()?.entitlement?.()?.evaluateEntitlement?.({
      activeSessionExists: false,
    });
    if (ent && !ent.allowed) {
      machineGo("failed");
      machineGo("idle");
      const msg =
        ent.reason === "feature_disabled"
          ? "音声通話は現在利用できません"
          : ent.reason === "daily_limit_reached" || ent.reason === "monthly_limit_reached"
            ? "通話の利用上限に達しています"
            : "通話を開始できません";
      Ui()?.showToast?.(msg);
      return { ok: false, reason: ent.reason };
    }

    const callerId = getMeId();
    const calleeId = perm?.calleeUserId || resolvePartnerId(callThread);
    peerDisplayName = resolvePeerName(callThread);

    const busyCallee = await Signaling().findBusyUser(calleeId);
    if (busyCallee) {
      machineGo("failed");
      machineGo("idle");
      Ui()?.showToast?.("相手は通話中です");
      return { ok: false, reason: "busy" };
    }
    const busySelf = await Signaling().findBusyUser(callerId);
    if (busySelf) {
      machineGo("failed");
      machineGo("idle");
      Ui()?.showToast?.("通話中のため発信できません");
      return { ok: false, reason: "busy_self" };
    }

    const sessionLimit = Core()?.entitlement?.()?.computeSessionLimit?.(ent);
    const session = await Signaling().createSession({
      roomId: callThread.id,
      callerId,
      calleeId,
      provider: "webrtc",
      sessionLimitSeconds: sessionLimit,
    });

    global.TasuTalkCallPushEvents?.enqueueForRingingSession?.(session, {
      actorUserId: callerId,
      callerDisplayName: peerDisplayName,
    }).catch(() => {});

    currentSession = session;
    currentRole = "caller";
    seenSignalIds.clear();
    offerStarted = false;
    machineGo("ringing_outgoing");

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
    if (!ensureMachine()?.can?.("connecting") && ensureMachine()?.getState?.() === "connecting") {
      return;
    }

    const updated = await Signaling().updateSessionStatus(currentSession.id, "active");
    currentSession = updated;
    clearRingTimeout();
    machineGo("connecting");
    const prep = await Provider().acceptIncomingConnection(iceHandlers(currentSession.id));
    if (!prep?.ok) {
      const mapped = prep || {};
      Ui()?.showToast?.(mapped.message || "マイクを利用できません");
      await hangup(mapped.code === "media_permission_denied" ? "media_denied" : "failed");
      return;
    }
    Ui()?.showActive?.(peerDisplayName, muted);
    startSessionSyncPoll(currentSession.id);
    startHeartbeat(currentSession.id);

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
    machineGo("ending");
    const sessionId = currentSession.id;
    const sessionSnap = currentSession;
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
        const duration = Core()?.usage?.()?.computeDurationSeconds?.({
          startedAt: sessionSnap.started_at,
          connectedAt: sessionSnap.started_at,
          endedAt: new Date().toISOString(),
        });
        await Signaling().updateSessionStatus(sessionId, "ended", {
          end_reason: String(reason || "hangup").slice(0, 64),
          duration_seconds: duration,
          billable_seconds: duration,
        });
      } catch {
        try {
          await Signaling().updateSessionStatus(sessionId, "ended");
        } catch {
          /* ignore */
        }
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
    getVoiceState: () => ensureMachine()?.getState?.() || "idle",
    getProvider: () => Provider(),
  };
})(typeof window !== "undefined" ? window : globalThis);
