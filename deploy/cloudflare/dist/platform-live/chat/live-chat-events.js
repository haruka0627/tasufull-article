/**
 * Live Platform Chat — Event 定数（SDK 非依存）
 * Phase D · platform-live/chat
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_CHAT_EVENTS = Object.freeze({
    MESSAGE_PENDING: "MESSAGE_PENDING",
    MESSAGE_SENT: "MESSAGE_SENT",
    MESSAGE_BLOCKED: "MESSAGE_BLOCKED",
    MESSAGE_DELETED: "MESSAGE_DELETED",
    MESSAGE_FAILED: "MESSAGE_FAILED",
    REACTION_ADDED: "REACTION_ADDED",
    REACTION_REMOVED: "REACTION_REMOVED",
    SYSTEM_EVENT: "SYSTEM_EVENT",
    MODERATION_ACTION: "MODERATION_ACTION",
    RATE_LIMIT_ACTION: "RATE_LIMIT_ACTION",
    ERROR: "ERROR",
  });

  global.TasuLivePlatformChatEvents = LIVE_CHAT_EVENTS;
  global.PLATFORM_LIVE_CHAT_EVENTS = LIVE_CHAT_EVENTS;
})(typeof window !== "undefined" ? window : globalThis);
