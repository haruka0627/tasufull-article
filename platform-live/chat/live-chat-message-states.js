/**
 * Live Platform Chat — Message 状態定数（SDK 非依存）
 * Phase D · platform-live/chat
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_CHAT_MESSAGE_STATES = Object.freeze({
    PENDING: "pending",
    SENT: "sent",
    BLOCKED: "blocked",
    DELETED: "deleted",
    FAILED: "failed",
  });

  global.TasuLivePlatformChatMessageStates = LIVE_CHAT_MESSAGE_STATES;
  global.PLATFORM_LIVE_CHAT_MESSAGE_STATES = LIVE_CHAT_MESSAGE_STATES;
})(typeof window !== "undefined" ? window : globalThis);
