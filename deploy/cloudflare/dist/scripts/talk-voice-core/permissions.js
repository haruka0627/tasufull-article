/**
 * TASFUL talk-voice-core — thread permission checks (pure · fail-closed)
 *
 * Does not trust client-only participant lists without explicit thread fields.
 * Caller supplies resolved thread + authUserId + optional block lookup result.
 */
(function (global) {
  "use strict";

  function pickStr(v) {
    return String(v ?? "").trim();
  }

  function isOfficialThread(thread, helpers) {
    const id = pickStr(thread?.id);
    if (thread?._officialRoom) return true;
    if (helpers?.isOfficialRoomId?.(id)) return true;
    return false;
  }

  function isGroupThread(thread) {
    const kind = pickStr(thread?.threadKind || thread?.thread_kind || thread?.kind).toLowerCase();
    if (kind === "group") return true;
    if (Array.isArray(thread?.participantIds) && thread.participantIds.length > 2) return true;
    return false;
  }

  function isSystemThread(thread) {
    if (thread?._staticCard) return true;
    const kind = pickStr(thread?.threadKind || thread?.thread_kind || thread?.kind).toLowerCase();
    return kind === "system" || kind === "official";
  }

  function resolvePartnerId(thread, authUserId, helpers) {
    const meId = pickStr(authUserId);
    let partnerId = pickStr(
      helpers?.resolvePartnerUserId?.(thread) ||
        thread?.partnerUserId ||
        thread?.partner_user_id ||
        thread?.partner?.id
    );
    if (!partnerId || partnerId === meId) {
      const buyer = pickStr(thread?.buyerId || thread?.buyer_id);
      const seller = pickStr(thread?.sellerId || thread?.seller_id);
      if (buyer && seller) {
        if (meId === buyer) partnerId = seller;
        else if (meId === seller) partnerId = buyer;
      }
    }
    if (!partnerId || partnerId === meId) return "";
    return partnerId;
  }

  /**
   * @param {{
   *   thread: object,
   *   authUserId: string,
   *   blocked?: boolean,
   *   peerDisabled?: boolean,
   *   threadClosed?: boolean,
   *   helpers?: object,
   * }} input
   */
  function assertCanStartCall(input) {
    const authUserId = pickStr(input?.authUserId);
    if (!authUserId || authUserId === "u_me" && input?.requireRealAuth) {
      return { ok: false, code: "auth_required", reason: "auth_required" };
    }
    if (!authUserId) {
      return { ok: false, code: "auth_required", reason: "auth_required" };
    }

    const thread = input?.thread;
    if (!thread || !pickStr(thread.id)) {
      return { ok: false, code: "permission_denied", reason: "thread_missing" };
    }
    if (input.threadClosed) {
      return { ok: false, code: "permission_denied", reason: "thread_closed" };
    }
    if (isOfficialThread(thread, input.helpers) || isSystemThread(thread) || isGroupThread(thread)) {
      return { ok: false, code: "permission_denied", reason: "thread_not_direct" };
    }
    if (input.blocked) {
      return { ok: false, code: "permission_denied", reason: "blocked" };
    }
    if (input.peerDisabled) {
      return { ok: false, code: "permission_denied", reason: "peer_disabled" };
    }

    const partnerId = resolvePartnerId(thread, authUserId, input.helpers);
    if (!partnerId) {
      const claimed = pickStr(
        input.helpers?.resolvePartnerUserId?.(thread) ||
          thread?.partnerUserId ||
          thread?.partner_user_id ||
          thread?.partner?.id
      );
      if (claimed && claimed === authUserId) {
        return { ok: false, code: "permission_denied", reason: "self_call" };
      }
      return { ok: false, code: "permission_denied", reason: "partner_unresolved" };
    }
    if (partnerId === authUserId) {
      return { ok: false, code: "permission_denied", reason: "self_call" };
    }

    return {
      ok: true,
      code: null,
      reason: "eligible",
      threadId: pickStr(thread.id),
      callerUserId: authUserId,
      calleeUserId: partnerId,
    };
  }

  function assertSessionParticipant(session, userId) {
    const uid = pickStr(userId);
    if (!session || !uid) return { ok: false, code: "permission_denied", reason: "missing" };
    const isPart =
      pickStr(session.caller_id) === uid || pickStr(session.callee_id) === uid;
    if (!isPart) return { ok: false, code: "permission_denied", reason: "not_participant" };
    return { ok: true, code: null, reason: "participant" };
  }

  function assertSignalAllowed(session, userId, signalType) {
    const part = assertSessionParticipant(session, userId);
    if (!part.ok) return part;
    const status = pickStr(session.status);
    if (["ended", "missed", "rejected", "busy", "expired", "cancelled"].includes(status)) {
      return { ok: false, code: "permission_denied", reason: "session_terminal" };
    }
    const type = pickStr(signalType);
    if (!["offer", "answer", "candidate", "hangup", "heartbeat"].includes(type)) {
      return { ok: false, code: "permission_denied", reason: "invalid_signal" };
    }
    return { ok: true, code: null, reason: "allowed" };
  }

  global.TasuTalkVoicePermissions = {
    isOfficialThread,
    isGroupThread,
    isSystemThread,
    resolvePartnerId,
    assertCanStartCall,
    assertSessionParticipant,
    assertSignalAllowed,
  };
})(typeof window !== "undefined" ? window : globalThis);
