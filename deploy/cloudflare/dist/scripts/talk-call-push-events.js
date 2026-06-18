/**
 * TASFUL TALK — 通話 Push 着信イベント（Phase6 土台）
 *
 * ringing 作成時に callee 向け push event を enqueue。
 * 実 Web Push 送信は Edge Function（mock / 段階的本番）。
 */
(function (global) {
  "use strict";

  const EVENTS_TABLE = "talk_call_push_events";
  const PUSH_TYPE = "talk_call_incoming";
  const TERMINAL_SESSION_STATUSES = new Set(["ended", "rejected", "missed", "active", "busy"]);

  const FORBIDDEN_PAYLOAD_KEYS = new Set([
    "email",
    "phone",
    "address",
    "token",
    "credential",
    "password",
    "payment",
    "turnCredential",
    "anonKey",
    "serviceKey",
    "role",
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      global.TasuTalkCallSignaling?.getMeId?.() ||
      ""
    );
  }

  function isPushEnabled() {
    const cfg = global.TASU_TALK_CALL_CONFIG || {};
    if (cfg.pushIncomingEnabled === false) return false;
    return true;
  }

  function isInternalDiagnosticsAllowed() {
    try {
      if (typeof process !== "undefined" && process.env) {
        if (process.env.NODE_ENV === "test") return true;
        if (process.env.TASFUL_TALK_CALL_INTERNAL_TEST === "1") return true;
      }
    } catch {
      /* ignore */
    }
    const cfg = global.TASU_TALK_CALL_CONFIG || {};
    if (cfg.internalTest === true) return true;
    try {
      const search = String(global.location?.search || "");
      if (/[?&]talkDev=1(?:&|$)/i.test(search)) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  /**
   * Push タップ時遷移 — Phase2 overlay 用 chat-detail deep link
   */
  function buildPushTapUrl(roomId, callId) {
    const bridge = global.TasuTalkCallNotifyBridge;
    if (bridge?.buildAcceptHref) {
      return bridge.buildAcceptHref(roomId, callId);
    }
    try {
      const url = new URL("chat-detail.html", global.location?.origin || "http://localhost");
      url.searchParams.set("thread", String(roomId || ""));
      url.searchParams.set("callId", String(callId || ""));
      url.searchParams.set("from", "notify");
      return url.pathname + url.search;
    } catch {
      return `/chat-detail.html?thread=${encodeURIComponent(String(roomId || ""))}&callId=${encodeURIComponent(String(callId || ""))}&from=notify`;
    }
  }

  function sanitizeDisplayName(name) {
    return String(name || "相手")
      .replace(/[<>"']/g, "")
      .slice(0, 80);
  }

  /**
   * Push payload — 秘匿情報なし
   */
  function buildPushPayload({ callId, roomId, callerDisplayName }) {
    const payload = {
      type: PUSH_TYPE,
      call_id: String(callId || ""),
      room_id: String(roomId || ""),
      caller_display_name: sanitizeDisplayName(callerDisplayName),
    };
    FORBIDDEN_PAYLOAD_KEYS.forEach((key) => {
      delete payload[key];
    });
    return payload;
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (String(payload.type || "") !== PUSH_TYPE) return false;
    if (!pickStr(payload.call_id, payload.room_id)) return false;
    const text = JSON.stringify(payload).toLowerCase();
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      if (text.includes(`"${key}"`)) return false;
    }
    return true;
  }

  /**
   * ringing 時・caller のみ enqueue 対象
   */
  function shouldEnqueuePushEvent(session, actorUserId) {
    if (!isPushEnabled()) return false;
    if (!session?.id) return false;
    if (String(session.status || "") !== "ringing") return false;
    const actor = String(actorUserId || "");
    const callerId = String(session.caller_id || "");
    const calleeId = String(session.callee_id || "");
    if (!actor || !callerId || !calleeId) return false;
    if (actor !== callerId) return false;
    if (callerId === calleeId) return false;
    if (!pickStr(session.room_id)) return false;
    if (!global.TasuTalkCallSignaling?.isParticipant?.(session, calleeId)) return false;
    return true;
  }

  function shouldCancelPushEvent(session) {
    if (!session?.id) return false;
    return TERMINAL_SESSION_STATUSES.has(String(session.status || ""));
  }

  function isMissingTableError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return msg.includes("talk_call_push_events") && (msg.includes("does not exist") || msg.includes("schema cache"));
  }

  async function enqueueForRingingSession(session, options) {
    const actorId = pickStr(options?.actorUserId, getMeId());
    if (!shouldEnqueuePushEvent(session, actorId)) {
      return { ok: false, skipped: true, reason: "not_eligible" };
    }

    const sb = getClient();
    if (!sb) return { ok: false, skipped: true, reason: "no_supabase" };

    const callId = String(session.id);
    const roomId = pickStr(session.room_id);
    const calleeId = String(session.callee_id);
    const callerId = String(session.caller_id);
    const callerDisplayName = pickStr(
      options?.callerDisplayName,
      options?.callerName,
      global.TasuTalkCallNotifyBridge?.resolveCallerDisplayName?.(session)
    );
    const payload = buildPushPayload({ callId, roomId, callerDisplayName });
    if (!validatePayload(payload)) {
      return { ok: false, skipped: true, reason: "invalid_payload" };
    }

    const row = {
      call_id: callId,
      callee_user_id: calleeId,
      caller_user_id: callerId,
      room_id: roomId,
      event_type: PUSH_TYPE,
      delivery_status: "pending",
      payload,
      target_url: buildPushTapUrl(roomId, callId),
    };

    const { data, error } = await sb.from(EVENTS_TABLE).insert(row).select("id, call_id, callee_user_id").maybeSingle();
    if (error) {
      if (String(error.code) === "23505") {
        return { ok: true, deduped: true, callId, calleeUserId: calleeId };
      }
      if (isMissingTableError(error)) {
        return { ok: false, skipped: true, reason: "table_missing" };
      }
      console.warn("[TasuTalkCallPushEvents] enqueue:", error.message || error);
      return { ok: false, reason: "insert_failed" };
    }

    if (isInternalDiagnosticsAllowed()) {
      console.debug("[TasuTalkCallPushEvents] enqueued", {
        callId,
        calleeUserId: calleeId,
        roomId,
        type: PUSH_TYPE,
      });
    }

    invokePushSender(callId).catch(() => {});

    return { ok: true, eventId: data?.id, callId, calleeUserId: calleeId };
  }

  async function cancelForSession(sessionOrId, options) {
    const session =
      typeof sessionOrId === "object" && sessionOrId !== null
        ? sessionOrId
        : { id: sessionOrId, status: options?.status || "cancelled" };
    if (!shouldCancelPushEvent(session) && !options?.force) {
      return { ok: false, skipped: true, reason: "not_terminal" };
    }

    const callId = String(session.id || sessionOrId || "");
    if (!callId) return { ok: false, skipped: true, reason: "missing_call_id" };

    const sb = getClient();
    if (!sb) return { ok: false, skipped: true, reason: "no_supabase" };

    const now = new Date().toISOString();
    const { error } = await sb
      .from(EVENTS_TABLE)
      .update({ delivery_status: "cancelled", cancelled_at: now })
      .eq("call_id", callId)
      .eq("delivery_status", "pending");

    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, skipped: true, reason: "table_missing" };
      }
      console.warn("[TasuTalkCallPushEvents] cancel:", error.message || error);
      return { ok: false, reason: "cancel_failed" };
    }
    return { ok: true, callId };
  }

  async function invokePushSender(callId) {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const baseUrl = pickStr(cfg.url, global.TASU_SUPABASE_CONFIG?.url).replace(/\/$/, "");
    const fnUrl = pickStr(
      cfg.talkCallPushFunctionUrl,
      global.TASFUL_TALK_CALL_PUSH_FUNCTION_URL,
      baseUrl ? `${baseUrl}/functions/v1/talk-call-push-notify` : ""
    );
    if (!fnUrl) return { ok: false, skipped: true, reason: "no_function_url" };

    const sb = getClient();
    const token = (await sb?.auth?.getSession?.())?.data?.session?.access_token;
    const headers = {
      "Content-Type": "application/json",
      apikey: cfg.anonKey || "",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const body = { call_id: callId };
    if (isInternalDiagnosticsAllowed() && (cfg.pushInvokeMock === true || global.TASFUL_TALK_PUSH_INVOKE_MOCK === true)) {
      body.mock = true;
    }

    const res = await fetch(fnUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res?.ok) return { ok: false, reason: "invoke_failed" };
    return { ok: true };
  }

  const publicApi = {
    EVENTS_TABLE,
    PUSH_TYPE,
    buildPushPayload,
    buildPushTapUrl,
    shouldEnqueuePushEvent,
    shouldCancelPushEvent,
    validatePayload,
    enqueueForRingingSession,
    cancelForSession,
  };

  if (isInternalDiagnosticsAllowed()) {
    publicApi._test = {
      FORBIDDEN_PAYLOAD_KEYS,
      sanitizeDisplayName,
      isInternalDiagnosticsAllowed,
    };
  }

  global.TasuTalkCallPushEvents = publicApi;
})(typeof window !== "undefined" ? window : globalThis);
