/**
 * チャット — やりとりキャンセル（理由選択 → 閲覧専用）
 */
(function (global) {
  "use strict";

  const CANCELLED_STATUS = "cancelled";

  const REASONS = Object.freeze([
    { id: "reject_hire", label: "採用見送り" },
    { id: "withdraw", label: "応募辞退" },
    { id: "mismatch", label: "条件不一致" },
    { id: "other", label: "その他" },
  ]);

  const CANCEL_REQUEST_REASONS = Object.freeze([
    { id: "schedule", label: "日程都合" },
    { id: "scope_change", label: "内容変更" },
    { id: "mutual", label: "双方合意" },
    { id: "no_contact", label: "連絡不能" },
    { id: "other", label: "その他" },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCompletionFlow() {
    return global.TasuPlatformChatCompletionFlow;
  }

  function getConnectFlow() {
    return global.TasuPlatformChatConnectChatFlow;
  }

  function resolveActorName(userId, thread) {
    return (
      getCompletionFlow()?.resolveActorDisplayName?.(userId, thread) ||
      pickStr(thread?.sellerName, thread?.buyerName, "利用者")
    );
  }

  function formatCancelSystemMessage(actorName) {
    const actor =
      getCompletionFlow()?.sanitizeUserFacingLabel?.(actorName) || pickStr(actorName, "利用者");
    const particle =
      getCompletionFlow()?.formatActorParticle?.(actor) === "が" ? "が" : "さんが";
    return `${actor}${particle}やりとりを終了しました`;
  }

  function formatConnectCancelSystemMessage() {
    return "やりとりをキャンセルしました";
  }

  function getRoomStatus(thread) {
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === CANCELLED_STATUS) return CANCELLED_STATUS;
    if (rs === "completed") return "completed";
    if (rs === "completion_pending" || thread?.completionRequestedBy) return "completion_pending";
    return "active";
  }

  function isConnectThread(thread) {
    if (global.TasuPlatformChatFee?.shouldNotifyOnCompletion?.({
      id: thread?.listingId,
      listing_type: thread?.listingType,
      listingType: thread?.listingType,
    })) {
      return true;
    }
    const profile = global.TasuPlatformChatDualWindowDemo?.resolveProfileForThread?.(thread);
    return profile?.connect === true;
  }

  function isWorkerServiceConnectThread(thread) {
    return (
      global.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(thread) === true
    );
  }

  function hasPendingCancelRequest(thread) {
    return pickStr(thread?.cancelRequestStatus).toLowerCase() === "pending";
  }

  function canRequestCancelConversation(thread, userId) {
    if (!isWorkerServiceConnectThread(thread)) return false;
    const status = getRoomStatus(thread);
    if (status !== "active") return false;
    if (pickStr(thread?.completionRequestedBy)) return false;
    if (hasPendingCancelRequest(thread)) return false;
    const me = pickStr(userId);
    if (!me) return false;
    const seller = pickStr(thread?.sellerId, thread?.seller_id);
    const buyer = pickStr(thread?.buyerId, thread?.buyer_id);
    return me === seller || me === buyer;
  }

  function canRespondToCancelRequest(thread, userId) {
    if (!hasPendingCancelRequest(thread)) return false;
    const me = pickStr(userId);
    const requester = pickStr(thread?.cancelRequestedBy);
    if (!me || !requester || me === requester) return false;
    const seller = pickStr(thread?.sellerId, thread?.seller_id);
    const buyer = pickStr(thread?.buyerId, thread?.buyer_id);
    return me === seller || me === buyer;
  }

  function requestCancelConversation({ threadId, thread, userId, reasonId, reasonLabel }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || getCompletionFlow()?.readThread?.(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (!canRequestCancelConversation(room, userId)) {
      return { ok: false, reason: "キャンセル申請できません" };
    }
    const reason = pickStr(reasonLabel, CANCEL_REQUEST_REASONS.find((r) => r.id === reasonId)?.label, reasonId);
    const now = new Date().toISOString();
    patchThread(id, {
      cancelRequestStatus: "pending",
      cancelRequestedBy: pickStr(userId),
      cancelRequestReason: reason,
      cancelRequestedAt: now,
    });
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoCancelRequested?.({
        threadId: id,
        thread: room,
        requesterId: pickStr(userId),
        reasonLabel: reason,
      });
    } catch (err) {
      console.warn("[TasuPlatformChatCancelFlow] cancel request notify failed:", err);
    }
    return { ok: true, pending: true };
  }

  function approveCancelRequest({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || getCompletionFlow()?.readThread?.(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (!canRespondToCancelRequest(room, userId)) {
      return { ok: false, reason: "承認できません" };
    }
    const reason = pickStr(room.cancelRequestReason, "キャンセル申請");
    const res = cancelConversation({
      threadId: id,
      thread: room,
      userId: pickStr(room.cancelRequestedBy),
      reasonId: "cancel_request",
      reasonLabel: reason,
    });
    if (res?.ok) {
      patchThread(id, {
        cancelRequestStatus: "approved",
        cancelRequestResolvedBy: pickStr(userId),
        cancelRequestResolvedAt: new Date().toISOString(),
      });
      try {
        global.TasuPlatformChatDualWindowNotify?.notifyDemoCancelRequestApproved?.({
          threadId: id,
          thread: room,
          approverId: pickStr(userId),
        });
      } catch {
        /* ignore */
      }
    }
    return res;
  }

  function rejectCancelRequest({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || getCompletionFlow()?.readThread?.(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (!canRespondToCancelRequest(room, userId)) {
      return { ok: false, reason: "却下できません" };
    }
    const requesterId = pickStr(room.cancelRequestedBy);
    patchThread(id, {
      cancelRequestStatus: "",
      cancelRequestedBy: "",
      cancelRequestReason: "",
      cancelRequestedAt: "",
    });
    appendSystemMessage(id, "キャンセル申請は却下されました。取引を継続します。");
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoCancelRequestRejected?.({
        threadId: id,
        thread: room,
        rejecterId: pickStr(userId),
        requesterId,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, rejected: true };
  }

  function renderCancelRequestReasonsHtml() {
    return CANCEL_REQUEST_REASONS.map(
      (r) =>
        `<label class="chat-report-reason"><input type="radio" name="chatCancelReason" value="${esc(r.id)}" data-cancel-label="${esc(r.label)}"> ${esc(r.label)}</label>`
    ).join("");
  }

  function canCancelConversation(thread, userId) {
    if (!thread) return false;
    if (isWorkerServiceConnectThread(thread)) return false;
    const status = getRoomStatus(thread);
    if (status === CANCELLED_STATUS || status === "completed") return false;
    const me = pickStr(userId);
    if (!me) return false;
    const seller = pickStr(thread?.sellerId, thread?.seller_id);
    const buyer = pickStr(thread?.buyerId, thread?.buyer_id);
    if (!seller && !buyer) return false;
    if (status === "completion_pending" && isConnectThread(thread)) {
      return me === seller || me === buyer;
    }
    if (status !== "active") return false;
    return me === seller || me === buyer;
  }

  function patchThread(threadId, patch) {
    return getCompletionFlow()?.patchThread?.(threadId, patch);
  }

  function appendSystemMessage(threadId, text) {
    return getCompletionFlow()?.appendSystemMessage?.(threadId, text);
  }

  function cancelConversation({ threadId, thread, userId, reasonId, reasonLabel }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || getCompletionFlow()?.readThread?.(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (!canCancelConversation(room, userId)) {
      return { ok: false, reason: "キャンセルできません" };
    }

    const status = getRoomStatus(room);
    const connect = isConnectThread(room);
    const actorName = resolveActorName(userId, room);
    const reason = pickStr(reasonLabel, REASONS.find((r) => r.id === reasonId)?.label, reasonId);
    const now = new Date().toISOString();

    if (status === "completion_pending" && connect) {
      patchThread(id, {
        roomStatus: CANCELLED_STATUS,
        status: CANCELLED_STATUS,
        cancelledBy: pickStr(userId),
        cancelReason: reason,
        cancelledAt: now,
        completionRequestedBy: "",
        completionRequestedAt: "",
      });
      appendSystemMessage(id, formatConnectCancelSystemMessage());
      getConnectFlow()?.appendRefundDoneCard?.(id);
      try {
        getConnectFlow()?.markConnectRefunded?.({
          threadId: id,
          thread: room,
          userId: pickStr(userId),
        });
      } catch {
        /* ignore */
      }
      try {
        global.TasuPlatformChatDualWindowNotify?.notifyDemoConversationCancelled?.({
          threadId: id,
          thread: room,
          cancelledBy: pickStr(userId),
          reasonLabel: reason,
        });
      } catch (err) {
        console.warn("[TasuPlatformChatCancelFlow] demo cancel notify failed:", err);
      }
      return { ok: true, connect: true, refunded: true };
    }

    patchThread(id, {
      roomStatus: CANCELLED_STATUS,
      status: CANCELLED_STATUS,
      cancelledBy: pickStr(userId),
      cancelReason: reason,
      cancelledAt: now,
    });
    appendSystemMessage(id, formatCancelSystemMessage(actorName));
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoConversationCancelled?.({
        threadId: id,
        thread: room,
        cancelledBy: pickStr(userId),
        reasonLabel: reason,
      });
    } catch (err) {
      console.warn("[TasuPlatformChatCancelFlow] demo cancel notify failed:", err);
    }
    return { ok: true, connect: false };
  }

  function rejectConnectCompletion({ threadId, thread, userId }) {
    return cancelConversation({
      threadId,
      thread,
      userId,
      reasonId: "mismatch",
      reasonLabel: "条件不一致",
    });
  }

  function renderCancelReasonsHtml() {
    return REASONS.map(
      (r) =>
        `<label class="chat-report-reason"><input type="radio" name="chatCancelReason" value="${esc(r.id)}" data-cancel-label="${esc(r.label)}"> ${esc(r.label)}</label>`
    ).join("");
  }

  global.TasuPlatformChatCancelFlow = {
    CANCELLED_STATUS,
    REASONS,
    CANCEL_REQUEST_REASONS,
    formatCancelSystemMessage,
    formatConnectCancelSystemMessage,
    isWorkerServiceConnectThread,
    hasPendingCancelRequest,
    canRequestCancelConversation,
    canRespondToCancelRequest,
    requestCancelConversation,
    approveCancelRequest,
    rejectCancelRequest,
    canCancelConversation,
    cancelConversation,
    rejectConnectCompletion,
    renderCancelReasonsHtml,
    renderCancelRequestReasonsHtml,
    isConnectThread,
  };
})(typeof window !== "undefined" ? window : globalThis);
