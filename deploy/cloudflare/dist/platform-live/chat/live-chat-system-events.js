/**
 * Live Platform Chat — System Event 種別（SDK 非依存）
 * Phase D · platform-live/chat
 */
(function (global) {
  "use strict";

  /** @readonly */
  const LIVE_CHAT_SYSTEM_EVENT_TYPES = Object.freeze({
    VIEWER_JOINED: "viewer_joined",
    VIEWER_LEFT: "viewer_left",
    BROADCAST_STARTED: "broadcast_started",
    BROADCAST_ENDED: "broadcast_ended",
    WARNING: "warning",
    PROVIDER_NOTICE: "provider_notice",
  });

  global.TasuLivePlatformChatSystemEventTypes = LIVE_CHAT_SYSTEM_EVENT_TYPES;
  global.PLATFORM_LIVE_CHAT_SYSTEM_EVENT_TYPES = LIVE_CHAT_SYSTEM_EVENT_TYPES;
})(typeof window !== "undefined" ? window : globalThis);
