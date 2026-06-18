/**
 * TASFUL TALK — 通話シグナリング（Supabase DB + Realtime）
 */
(function (global) {
  "use strict";

  const SESSIONS_TABLE = "talk_call_sessions";
  const SIGNALS_TABLE = "talk_call_signals";
  const RINGING_STATUSES = new Set(["ringing", "active"]);
  const RING_TIMEOUT_MS = 60 * 1000;

  /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
  let realtimeChannel = null;
  /** @type {string} */
  let subscribedUserId = "";
  /** @type {{ onSessionChange?: Function, onSignal?: Function }|null} */
  let lastHandlers = null;
  /** @type {boolean} */
  let authHooked = false;

  function hookAuthResubscribe() {
    if (authHooked) return;
    const sb = getClient();
    if (!sb?.auth?.onAuthStateChange) return;
    authHooked = true;
    sb.auth.onAuthStateChange((event, session) => {
      if (!lastHandlers) return;
      if (event === "SIGNED_OUT") {
        unsubscribeRealtime();
        return;
      }
      if (!session?.access_token) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        subscribedUserId = "";
        subscribeRealtime(lastHandlers);
      }
    });
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function isAvailable() {
    return Boolean(getClient());
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function expiresAtIso() {
    return new Date(Date.now() + RING_TIMEOUT_MS).toISOString();
  }

  function isParticipant(session, userId) {
    if (!session) return false;
    const uid = String(userId || "");
    return String(session.caller_id) === uid || String(session.callee_id) === uid;
  }

  async function findBusyUser(userId) {
    const sb = getClient();
    if (!sb || !userId) return null;
    const now = nowIso();
    const { data, error } = await sb
      .from(SESSIONS_TABLE)
      .select("*")
      .in("status", ["ringing", "active"])
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.warn("[TasuTalkCallSignaling] findBusyUser:", error.message);
      return null;
    }
    const rows = Array.isArray(data) ? data : [];
    return (
      rows.find(
        (row) =>
          row.status === "active" ||
          (row.status === "ringing" && String(row.expires_at || "") > now)
      ) || null
    );
  }

  async function createSession({ roomId, callerId, calleeId }) {
    const sb = getClient();
    if (!sb) throw new Error("Supabase が未設定です");
    const row = {
      room_id: String(roomId),
      caller_id: String(callerId),
      callee_id: String(calleeId),
      status: "ringing",
      expires_at: expiresAtIso(),
    };
    const { data, error } = await sb.from(SESSIONS_TABLE).insert(row).select("*").single();
    if (error) throw new Error(error.message || "セッション作成に失敗しました");
    return data;
  }

  async function updateSessionStatus(sessionId, status, extra) {
    const sb = getClient();
    if (!sb) throw new Error("Supabase が未設定です");
    const patch = { status, ...(extra || {}) };
    if (status === "active" && !patch.started_at) patch.started_at = nowIso();
    if (["ended", "missed", "rejected"].includes(status) && !patch.ended_at) {
      patch.ended_at = nowIso();
    }
    const { data, error } = await sb
      .from(SESSIONS_TABLE)
      .update(patch)
      .eq("id", sessionId)
      .select("*")
      .single();
    if (error) throw new Error(error.message || "セッション更新に失敗しました");
    return data;
  }

  async function fetchSession(sessionId) {
    const sb = getClient();
    if (!sb) return null;
    const { data, error } = await sb.from(SESSIONS_TABLE).select("*").eq("id", sessionId).maybeSingle();
    if (error) {
      console.warn("[TasuTalkCallSignaling] fetchSession:", error.message);
      return null;
    }
    return data;
  }

  async function fetchSessionsByRoom(roomId, options) {
    const sb = getClient();
    const rid = String(roomId || "").trim();
    if (!sb || !rid) return [];
    const limit = Math.min(50, Math.max(1, Number(options?.limit) || 20));
    const { data, error } = await sb
      .from(SESSIONS_TABLE)
      .select("*")
      .eq("room_id", rid)
      .in("status", ["ended", "missed", "rejected"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[TasuTalkCallSignaling] fetchSessionsByRoom:", error.message);
      return [];
    }
    const rows = Array.isArray(data) ? data : [];
    const uid = getMeId();
    return rows.filter((row) => isParticipant(row, uid));
  }

  async function insertSignal({ sessionId, senderId, signalType, payload }) {
    const sb = getClient();
    if (!sb) throw new Error("Supabase が未設定です");
    const row = {
      session_id: sessionId,
      sender_id: String(senderId),
      signal_type: signalType,
      payload: payload || {},
    };
    const { data, error } = await sb.from(SIGNALS_TABLE).insert(row).select("*").single();
    if (error) throw new Error(error.message || "シグナル送信に失敗しました");
    return data;
  }

  async function fetchSignalsSince(sessionId, sinceIso) {
    const sb = getClient();
    if (!sb) return [];
    let q = sb
      .from(SIGNALS_TABLE)
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (sinceIso) q = q.gt("created_at", sinceIso);
    const { data, error } = await q;
    if (error) {
      console.warn("[TasuTalkCallSignaling] fetchSignalsSince:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  /**
   * @param {{
   *   onSessionChange?: (session: object, eventType: string) => void,
   *   onSignal?: (signal: object) => void,
   * }} handlers
   */
  function subscribeRealtime(handlers) {
    const sb = getClient();
    const uid = getMeId();
    if (!sb || !uid) return () => {};

    lastHandlers = handlers || null;
    hookAuthResubscribe();
    unsubscribeRealtime();

    subscribedUserId = uid;
    const channelName = `talk-call-${uid}-${Date.now()}`;

    realtimeChannel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SESSIONS_TABLE },
        (payload) => {
          const session = payload.new || payload.old;
          if (!session || !isParticipant(session, uid)) return;
          handlers?.onSessionChange?.(session, payload.eventType || payload.event || "");
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: SIGNALS_TABLE },
        (payload) => {
          const signal = payload.new;
          if (!signal?.session_id) return;
          handlers?.onSignal?.(signal);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[TasuTalkCallSignaling] Realtime channel error");
        }
      });

    return unsubscribeRealtime;
  }

  function unsubscribeRealtime() {
    const sb = getClient();
    if (sb && realtimeChannel) {
      try {
        sb.removeChannel(realtimeChannel);
      } catch {
        /* ignore */
      }
    }
    realtimeChannel = null;
    subscribedUserId = "";
  }

  global.TasuTalkCallSignaling = {
    SESSIONS_TABLE,
    SIGNALS_TABLE,
    RING_TIMEOUT_MS,
    isAvailable,
    getMeId,
    findBusyUser,
    createSession,
    updateSessionStatus,
    fetchSession,
    fetchSessionsByRoom,
    insertSignal,
    fetchSignalsSince,
    subscribeRealtime,
    unsubscribeRealtime,
    isParticipant,
  };
})(typeof window !== "undefined" ? window : globalThis);
