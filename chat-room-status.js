/**
 * 取引ルーム状態（status + expires_at）
 * 優先: completed > cancelled > expired > active
 * 将来: reviews / review_scores 連携
 */
(function () {
  "use strict";

  /** @typedef {"active" | "fee_pending" | "completion_pending" | "awaiting_payment" | "expired" | "completed" | "cancelled"} RoomLifecycleStatus */

  const FEE_PENDING_NOTICE_MESSAGE = "やりとり開始料のお支払い後にメッセージを送信できます";
  const FEE_PENDING_PLACEHOLDER = "やりとり開始料のお支払い後に送信できます";
  const FEE_PENDING_SEND_MESSAGE = "やりとり開始料のお支払い後に送信できます";

  const EXPIRED_NOTICE_MESSAGE = "この取引は期限切れです";
  const EXPIRED_PLACEHOLDER = "期限切れのため送信できません";
  const EXPIRED_SEND_MESSAGE = "期限切れのため送信できません";

  const COMPLETED_NOTICE_MESSAGE = "この取引は完了しました";
  const COMPLETED_PLACEHOLDER = "取引完了のため送信できません";
  const COMPLETED_SEND_MESSAGE = "取引完了のため送信できません";

  const CANCELLED_NOTICE_MESSAGE = "この取引はキャンセルされました";
  const CANCELLED_PLACEHOLDER = "キャンセル済みのため送信できません";
  const CANCELLED_SEND_MESSAGE = "キャンセル済みのため送信できません";

  const COMPLETE_CONFIRM_BODY =
    "この取引を完了しますか？完了後はメッセージの送信ができなくなります。";

  /** DB の transaction_rooms.status（lifecycle の expired は含めない） */
  function getRoomStatus(room) {
    if (!room) return "active";
    if (room.roomStatus != null && room.roomStatus !== "") {
      const rs = String(room.roomStatus).trim().toLowerCase();
      if (
        rs === "completed" ||
        rs === "closed" ||
        rs === "cancelled" ||
        rs === "active" ||
        rs === "end_requested" ||
        rs === "completion_pending" ||
        rs === "awaiting_payment" ||
        rs === "fee_pending"
      ) {
        if (rs === "closed") return "completed";
        if (rs === "end_requested") return "active";
        return rs;
      }
    }
    const raw = room.lifecycle_status ?? room.lifecycleStatus ?? room.status ?? "active";
    const s = String(raw).trim().toLowerCase();
    if (
      s === "completed" ||
      s === "closed" ||
      s === "cancelled" ||
      s === "active" ||
      s === "end_requested" ||
      s === "completion_pending" ||
      s === "awaiting_payment" ||
      s === "fee_pending"
    ) {
      if (s === "closed") return "completed";
      if (s === "end_requested") return "active";
      return s;
    }
    return "active";
  }

  function getExpiresAt(room) {
    if (!room) return "";
    const raw = room.expiresAt ?? room.expires_at ?? "";
    if (raw == null || raw === "") return "";
    return String(raw);
  }

  function parseExpiresAtMs(expiresAtIso) {
    if (expiresAtIso == null || expiresAtIso === "") return NaN;
    const ms = new Date(expiresAtIso).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  /** expires_at ありかつ expires_at < now() */
  function isExpiresAtPast(expiresAtIso) {
    const ms = parseExpiresAtMs(expiresAtIso);
    if (!Number.isFinite(ms)) return false;
    return ms < Date.now();
  }

  function isRoomExpired(room) {
    return isExpiresAtPast(getExpiresAt(room));
  }

  /**
   * DB status + expires_at を統合（表示・送信制御の正）
   * @param {object|null|undefined} room
   * @returns {RoomLifecycleStatus}
   */
  function resolveRoomLifecycleStatus(room) {
    const dbStatus = getRoomStatus(room);
    if (dbStatus === "completed") return "completed";
    if (dbStatus === "cancelled") return "cancelled";
    if (dbStatus === "completion_pending") return "completion_pending";
    if (dbStatus === "awaiting_payment") return "awaiting_payment";
    if (dbStatus === "fee_pending") {
      if (window.TasuPlatformChatFee?.requiresConversationStartFee?.(room) !== true) {
        return "active";
      }
      return "fee_pending";
    }
    if (isRoomExpired(room)) return "expired";
    return "active";
  }

  /** @returns {{ label: string, pillClass: string }} */
  function getListStatusDisplay(lifecycle) {
    switch (lifecycle) {
      case "completed":
        return { label: "完了", pillClass: "chat-pill--completed" };
      case "cancelled":
        return { label: "キャンセル", pillClass: "chat-pill--cancelled" };
      case "expired":
        return { label: "期限切れ", pillClass: "chat-pill--expired" };
      default:
        return { label: "進行中", pillClass: "chat-pill--active" };
    }
  }

  /**
   * @param {RoomLifecycleStatus} lifecycle
   */
  function getLifecycleUi(lifecycle) {
    switch (lifecycle) {
      case "fee_pending":
        return {
          showNotice: true,
          noticeMessage: FEE_PENDING_NOTICE_MESSAGE,
          placeholder: FEE_PENDING_PLACEHOLDER,
          alertMessage: FEE_PENDING_SEND_MESSAGE,
          sendBlockMessage: FEE_PENDING_SEND_MESSAGE,
          canSend: false,
          allowRealtime: false,
          showCompleteButton: false,
        };
      case "completion_pending":
        return {
          showNotice: false,
          noticeMessage: "",
          placeholder: "",
          alertMessage: "",
          sendBlockMessage: "",
          canSend: true,
          allowRealtime: true,
          showCompleteButton: false,
        };
      case "awaiting_payment":
        return {
          showNotice: false,
          noticeMessage: "",
          placeholder: "",
          alertMessage: "",
          sendBlockMessage: "",
          canSend: true,
          allowRealtime: true,
          showCompleteButton: false,
        };
      case "completed":
        return {
          showNotice: true,
          noticeMessage: COMPLETED_NOTICE_MESSAGE,
          placeholder: COMPLETED_PLACEHOLDER,
          alertMessage: COMPLETED_SEND_MESSAGE,
          sendBlockMessage: COMPLETED_SEND_MESSAGE,
          canSend: false,
          allowRealtime: false,
          showCompleteButton: false,
        };
      case "cancelled":
        return {
          showNotice: true,
          noticeMessage: CANCELLED_NOTICE_MESSAGE,
          placeholder: CANCELLED_PLACEHOLDER,
          alertMessage: CANCELLED_SEND_MESSAGE,
          sendBlockMessage: CANCELLED_SEND_MESSAGE,
          canSend: false,
          allowRealtime: false,
          showCompleteButton: false,
        };
      case "expired":
        return {
          showNotice: true,
          noticeMessage: EXPIRED_NOTICE_MESSAGE,
          placeholder: EXPIRED_PLACEHOLDER,
          alertMessage: EXPIRED_SEND_MESSAGE,
          sendBlockMessage: EXPIRED_SEND_MESSAGE,
          canSend: false,
          allowRealtime: false,
          showCompleteButton: false,
        };
      default:
        return {
          showNotice: false,
          noticeMessage: "",
          placeholder: "",
          alertMessage: "",
          sendBlockMessage: "",
          canSend: true,
          allowRealtime: true,
          showCompleteButton: true,
        };
    }
  }

  function isMessagingAllowed(room) {
    return getLifecycleUi(resolveRoomLifecycleStatus(room)).canSend;
  }

  function isRealtimeAllowed(room) {
    return getLifecycleUi(resolveRoomLifecycleStatus(room)).allowRealtime;
  }

  // --- 将来: seller → buyer レビュー（任意・双方向）---
  // buyer が seller を評価するフローは chat-reviews.js / submitReview() を参照
  // function submitSellerToBuyerReview({ roomId, sellerId, buyerId, rating, comment }) { ... }

  window.TasuChatRoomStatus = {
    EXPIRED_NOTICE_MESSAGE,
    EXPIRED_PLACEHOLDER,
    EXPIRED_SEND_MESSAGE,
    COMPLETED_NOTICE_MESSAGE,
    COMPLETED_PLACEHOLDER,
    COMPLETED_SEND_MESSAGE,
    CANCELLED_NOTICE_MESSAGE,
    CANCELLED_PLACEHOLDER,
    CANCELLED_SEND_MESSAGE,
    COMPLETE_CONFIRM_BODY,
    getRoomStatus,
    getExpiresAt,
    parseExpiresAtMs,
    isExpiresAtPast,
    isRoomExpired,
    resolveRoomLifecycleStatus,
    getListStatusDisplay,
    getLifecycleUi,
    isMessagingAllowed,
    isRealtimeAllowed,
  };
})();
